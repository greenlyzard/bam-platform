-- Ledger foundation rebuild — double-entry groups+legs. Implements
-- docs/LEDGER_FOUNDATION_REVIEW.md §4 (Fable; STRUCTURALLY AUTHORITATIVE), merging
-- docs/LEDGER_DOUBLE_ENTRY_DESIGN.md. SUPERSEDES the never-applied
-- 20260715160000_ledger_double_entry_cutover.sql (deleted).
--
-- Verified live 2026-07-15 (bam-schema-sync, read-only): ledger_entries has 0 rows, is still
-- single-entry (direction CHECK revenue/expense, no entry_group_id), and none of the new tables
-- /functions exist. Clean rebuild — no backfill (legacy is quarantined for the archive).
--
-- Re-runnable: quarantine guarded (only when the single-entry table is present); all CREATE ...
-- IF NOT EXISTS; chart seeded ON CONFLICT DO NOTHING; triggers created only if absent;
-- DROP POLICY IF EXISTS before CREATE POLICY. No forward FKs (dimensions are bare uuid;
-- FK targets — ledger_accounts, ledger_entry_groups — are created earlier in this file).

-- ============ 1. Quarantine the legacy single-entry table ============
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='ledger_entries')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='ledger_entries'
               AND column_name='entry_group_id') THEN
    ALTER TABLE public.ledger_entries RENAME TO ledger_entries_legacy_single;
  END IF;
END $$;

-- ============ 2. Chart of accounts (data, not string convention) ============
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  slug           text PRIMARY KEY,
  code           int  NOT NULL UNIQUE,
  name           text NOT NULL,
  acct_type      text NOT NULL CHECK (acct_type IN ('asset','liability','revenue','contra_revenue','expense')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  is_active      boolean NOT NULL DEFAULT true
);
INSERT INTO public.ledger_accounts (slug, code, name, acct_type, normal_balance) VALUES
  ('cash_operating',1000,'Cash – Operating','asset','debit'),
  ('cash_clearing',1010,'Cash – Stripe Clearing','asset','debit'),
  ('accounts_receivable',1100,'Accounts Receivable','asset','debit'),
  ('inventory_merch',1200,'Merchandise Inventory','asset','debit'),
  ('customer_credit_liability',2000,'Customer Credits','liability','credit'),
  ('deposits_liability',2010,'Customer Deposits','liability','credit'),
  ('bundle_liability',2020,'Deferred Revenue – Bundles/Points','liability','credit'),
  ('deferred_revenue_tuition',2030,'Deferred Revenue – Tuition','liability','credit'),
  ('sales_tax_payable',2100,'Sales Tax Payable','liability','credit'),
  ('use_tax_payable',2110,'Use Tax Payable','liability','credit'),
  ('wages_payable',2200,'Wages Payable','liability','credit'),
  ('payroll_tax_payable',2210,'Payroll Tax Payable','liability','credit'),
  ('revenue_tuition',4000,'Tuition Revenue','revenue','credit'),
  ('revenue_fees',4010,'Fees Revenue','revenue','credit'),
  ('revenue_private_lessons',4020,'Private Lesson Revenue','revenue','credit'),
  -- Costume purchase vs rental split (per merge instruction; Fable had a single revenue_costumes).
  ('revenue_costume_purchase',4030,'Costume Purchase Revenue','revenue','credit'),
  ('revenue_costume_rental',4031,'Costume Rental Revenue','revenue','credit'),
  ('revenue_merch',4040,'Merchandise Revenue','revenue','credit'),
  ('revenue_events',4050,'Event Revenue','revenue','credit'),
  ('revenue_fee_recovery',4060,'Fee Recovery Income','revenue','credit'),
  ('discounts_given',4900,'Discounts Given','contra_revenue','debit'),
  ('scholarships_awards',4910,'Scholarships & Awards','contra_revenue','debit'),
  ('payroll_wages_expense',5000,'Wages Expense','expense','debit'),
  ('payroll_tax_expense',5010,'Payroll Tax Expense','expense','debit'),
  ('processing_fees_expense',5100,'Payment Processing Fees','expense','debit'),
  ('supplies_expense',5200,'Supplies Expense','expense','debit'),
  ('cogs_merch',5210,'Cost of Goods Sold – Merch','expense','debit')
ON CONFLICT (slug) DO NOTHING;

-- ============ 3. Tax rates (configurable, seeded EMPTY — accountant supplies CA numbers) ============
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  jurisdiction_code text NOT NULL,
  tax_type          text NOT NULL CHECK (tax_type IN ('sales','use')),
  rate_bps          int  NOT NULL CHECK (rate_bps >= 0),
  effective_from    date NOT NULL,
  effective_to      date,
  UNIQUE (tenant_id, jurisdiction_code, tax_type, effective_from)
);

-- ============ 4. Groups (one row per economic event) ============
CREATE TABLE IF NOT EXISTS public.ledger_entry_groups (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL,
  posting_key          text NOT NULL,
  event_type           text NOT NULL,
  occurred_at          timestamptz NOT NULL,
  posted_at            timestamptz NOT NULL DEFAULT now(),
  source_system        text NOT NULL,
  source_ref           text,
  reversal_of_group_id uuid REFERENCES public.ledger_entry_groups(id),
  adjusts_period       date,
  memo                 text,
  UNIQUE (tenant_id, posting_key)
);

-- ============ 5. Entries (legs; >=2 per group) ============
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  entry_group_id uuid NOT NULL REFERENCES public.ledger_entry_groups(id),
  account        text NOT NULL REFERENCES public.ledger_accounts(slug),
  direction      text NOT NULL CHECK (direction IN ('debit','credit')),
  amount_cents   bigint NOT NULL CHECK (amount_cents > 0),
  charge_status  text CHECK (charge_status IN
                   ('pending','authorized','captured','succeeded','failed','refunded','returned')),
  occurred_at    timestamptz NOT NULL,
  family_id uuid, student_id uuid, class_id uuid, location_id uuid,
  event_id uuid, teacher_id uuid, award_id uuid, discount_id uuid,
  product_id uuid, invoice_id uuid, payment_id uuid, line_item_id uuid,
  jurisdiction_code text,
  tax_rate_bps      int,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_group   ON public.ledger_entries (entry_group_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_acct_dt ON public.ledger_entries (tenant_id, account, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_family  ON public.ledger_entries (tenant_id, family_id)  WHERE family_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_entries_teacher ON public.ledger_entries (tenant_id, teacher_id) WHERE teacher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_entries_class   ON public.ledger_entries (tenant_id, class_id)   WHERE class_id   IS NOT NULL;

-- ============ 6. Balance enforcement (deferred, at commit) ============
CREATE OR REPLACE FUNCTION public.ledger_assert_group_balanced()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_dr bigint; v_cr bigint; v_ct int;
BEGIN
  SELECT COALESCE(SUM(amount_cents) FILTER (WHERE direction='debit'),0),
         COALESCE(SUM(amount_cents) FILTER (WHERE direction='credit'),0),
         COUNT(*)
    INTO v_dr, v_cr, v_ct
    FROM public.ledger_entries WHERE entry_group_id = NEW.entry_group_id;
  IF v_dr <> v_cr OR v_ct < 2 THEN
    RAISE EXCEPTION 'Unbalanced ledger group % (DR % / CR %, % legs)', NEW.entry_group_id, v_dr, v_cr, v_ct;
  END IF;
  RETURN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ledger_group_balanced') THEN
    CREATE CONSTRAINT TRIGGER trg_ledger_group_balanced
      AFTER INSERT ON public.ledger_entries
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION public.ledger_assert_group_balanced();
  END IF;
END $$;

-- ============ 7. Append-only enforcement ============
CREATE OR REPLACE FUNCTION public.ledger_forbid_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Ledger is append-only (% on %)', TG_OP, TG_TABLE_NAME; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ledger_entries_immutable') THEN
    CREATE TRIGGER trg_ledger_entries_immutable
      BEFORE UPDATE OR DELETE ON public.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION public.ledger_forbid_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ledger_groups_immutable') THEN
    CREATE TRIGGER trg_ledger_groups_immutable
      BEFORE UPDATE OR DELETE ON public.ledger_entry_groups
      FOR EACH ROW EXECUTE FUNCTION public.ledger_forbid_mutation();
  END IF;
END $$;

REVOKE UPDATE, DELETE ON public.ledger_entries, public.ledger_entry_groups FROM anon, authenticated;

-- ============ 8. Period close ============
CREATE TABLE IF NOT EXISTS public.ledger_period_closes (
  tenant_id     uuid NOT NULL,
  period        date NOT NULL,           -- first day of month
  closed_at     timestamptz NOT NULL DEFAULT now(),
  closed_by     uuid,
  total_debits  bigint NOT NULL,
  total_credits bigint NOT NULL,
  PRIMARY KEY (tenant_id, period)
);

CREATE OR REPLACE FUNCTION public.ledger_reject_closed_period()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ledger_period_closes
             WHERE tenant_id = NEW.tenant_id
               AND period = date_trunc('month', NEW.occurred_at)::date) THEN
    RAISE EXCEPTION 'Period % is closed; post to the open period with adjusts_period set',
      date_trunc('month', NEW.occurred_at)::date;
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ledger_closed_period') THEN
    CREATE TRIGGER trg_ledger_closed_period
      BEFORE INSERT ON public.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION public.ledger_reject_closed_period();
  END IF;
END $$;

-- ============ 9. Atomic idempotent posting RPC ============
CREATE OR REPLACE FUNCTION public.post_ledger_group(
  p_tenant       uuid,
  p_posting_key  text,
  p_event_type   text,
  p_occurred_at  timestamptz,
  p_source_system text,
  p_source_ref   text,
  p_legs         jsonb,
  p_reversal_of  uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_group_id uuid; v_leg jsonb;
BEGIN
  INSERT INTO public.ledger_entry_groups
    (tenant_id, posting_key, event_type, occurred_at, source_system, source_ref, reversal_of_group_id)
  VALUES
    (p_tenant, p_posting_key, p_event_type, p_occurred_at, p_source_system, p_source_ref, p_reversal_of)
  ON CONFLICT (tenant_id, posting_key) DO NOTHING
  RETURNING id INTO v_group_id;

  -- Already posted (a concurrent/duplicate webhook): return the existing group, insert no legs.
  IF v_group_id IS NULL THEN
    SELECT id INTO v_group_id FROM public.ledger_entry_groups
      WHERE tenant_id = p_tenant AND posting_key = p_posting_key;
    RETURN v_group_id;
  END IF;

  FOR v_leg IN SELECT * FROM jsonb_array_elements(p_legs) LOOP
    INSERT INTO public.ledger_entries (
      tenant_id, entry_group_id, account, direction, amount_cents, charge_status, occurred_at,
      family_id, student_id, class_id, location_id, event_id, teacher_id, award_id, discount_id,
      product_id, invoice_id, payment_id, line_item_id, jurisdiction_code, tax_rate_bps
    ) VALUES (
      p_tenant, v_group_id,
      v_leg->>'account', v_leg->>'direction', (v_leg->>'amount_cents')::bigint,
      v_leg->>'charge_status', p_occurred_at,
      (v_leg->>'family_id')::uuid, (v_leg->>'student_id')::uuid, (v_leg->>'class_id')::uuid,
      (v_leg->>'location_id')::uuid, (v_leg->>'event_id')::uuid, (v_leg->>'teacher_id')::uuid,
      (v_leg->>'award_id')::uuid, (v_leg->>'discount_id')::uuid, (v_leg->>'product_id')::uuid,
      (v_leg->>'invoice_id')::uuid, (v_leg->>'payment_id')::uuid, (v_leg->>'line_item_id')::uuid,
      v_leg->>'jurisdiction_code', (v_leg->>'tax_rate_bps')::int
    );
  END LOOP;

  RETURN v_group_id;  -- deferred trigger validates Σdebit=Σcredit & leg-count>=2 at COMMIT.
END $$;

REVOKE ALL ON FUNCTION public.post_ledger_group(uuid,text,text,timestamptz,text,text,jsonb,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.post_ledger_group(uuid,text,text,timestamptz,text,text,jsonb,uuid)
  TO authenticated, service_role;

-- ============ 10. RLS (admins read via is_admin(); writes only via the SECURITY DEFINER RPC) ============
ALTER TABLE public.ledger_entry_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_period_closes ENABLE ROW LEVEL SECURITY;

-- Ledger is read-only to admins in the app; no INSERT policy → no direct leg writes (RPC/service_role only).
DROP POLICY IF EXISTS ledger_groups_admin_read ON public.ledger_entry_groups;
CREATE POLICY ledger_groups_admin_read ON public.ledger_entry_groups FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS ledger_entries_admin_read ON public.ledger_entries;
CREATE POLICY ledger_entries_admin_read ON public.ledger_entries FOR SELECT USING (is_admin());

-- Chart is readable by any authenticated user (for pickers); managed via migrations only.
DROP POLICY IF EXISTS ledger_accounts_read ON public.ledger_accounts;
CREATE POLICY ledger_accounts_read ON public.ledger_accounts FOR SELECT USING (auth.uid() IS NOT NULL);

-- Tax rates + period closes: admin-managed.
DROP POLICY IF EXISTS tax_rates_admin_all ON public.tax_rates;
CREATE POLICY tax_rates_admin_all ON public.tax_rates FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS period_closes_admin_all ON public.ledger_period_closes;
CREATE POLICY period_closes_admin_all ON public.ledger_period_closes FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
