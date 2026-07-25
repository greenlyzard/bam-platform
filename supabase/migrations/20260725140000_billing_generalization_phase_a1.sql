-- Billing Generalization — Phase A1 (permissive subset)
-- Spec: docs/BILLING_GENERALIZATION_SPEC_V2.md §3.1, §3.2, §3.9
--
-- A1 is deliberately the subset that CANNOT break running code:
--   • loosens NOT NULL, never tightens it (except cart_items.item_type, which has a DEFAULT)
--   • adds nullable columns
--   • adds FKs on columns whose live values already satisfy them
--   • widens a CHECK vocabulary, never narrows it
--
-- A2 (family_id NOT NULL on charge items) is NOT implemented here. approval-repo.ts:365
-- reads enrollments.family_id as nullable, so A2 needs that guaranteed non-null first.
--
-- Verified against live DB 2026-07-25 before writing:
--   enrollment_charge_items = 0 rows, enrollment_cart_items = 4 rows (all class_id NOT NULL),
--   productions = 0 rows, timesheet_entries = 0 rows (0 orphaned production_id),
--   ledger_entries.invoice_id/payment_id/line_item_id = 0 non-null, 0 code references.


-- ═════════════════════════════════════════════════════════════════════════════
-- PRE-FLIGHT — refuse to proceed on any condition that would corrupt data.
-- Re-checked at apply time: the counts above were taken when this file was
-- written, not when it runs.
-- ═════════════════════════════════════════════════════════════════════════════
DO $preflight$
DECLARE
  v_count   bigint;
  v_missing text;
BEGIN
  -- 1. BAM tenant must exist — productions.tenant_id backfills to it.
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = '84d98f72-c82f-414f-8b17-172b802f6993') THEN
    RAISE EXCEPTION 'Pre-flight: BAM tenant 84d98f72-c82f-414f-8b17-172b802f6993 not found; cannot backfill productions.tenant_id';
  END IF;

  -- 2. FK targets must exist before we reference them.
  FOR v_missing IN
    SELECT t FROM unnest(ARRAY['families','students','classes','productions','tenants']) AS t
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    )
  LOOP
    RAISE EXCEPTION 'Pre-flight: FK target table public.% does not exist', v_missing;
  END LOOP;

  -- 3. Vestigial ledger columns must still be entirely null before we drop them.
  --    Guarded on column existence so this migration stays re-runnable.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='ledger_entries' AND column_name='invoice_id') THEN
    EXECUTE 'SELECT count(*) FROM public.ledger_entries WHERE invoice_id IS NOT NULL' INTO v_count;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Pre-flight: ledger_entries.invoice_id has % non-null rows; refusing to drop', v_count;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='ledger_entries' AND column_name='payment_id') THEN
    EXECUTE 'SELECT count(*) FROM public.ledger_entries WHERE payment_id IS NOT NULL' INTO v_count;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Pre-flight: ledger_entries.payment_id has % non-null rows; refusing to drop', v_count;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='ledger_entries' AND column_name='line_item_id') THEN
    EXECUTE 'SELECT count(*) FROM public.ledger_entries WHERE line_item_id IS NOT NULL' INTO v_count;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Pre-flight: ledger_entries.line_item_id has % non-null rows; refusing to drop', v_count;
    END IF;
  END IF;

  -- 4. No orphaned timesheet_entries.production_id — the new FK would fail on these.
  SELECT count(*) INTO v_count
  FROM public.timesheet_entries te
  WHERE te.production_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.productions p WHERE p.id = te.production_id);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Pre-flight: % timesheet_entries rows have orphaned production_id; resolve before adding FK', v_count;
  END IF;

  -- 5. Existing charge-item FK columns must already satisfy the FKs we are about to add.
  SELECT count(*) INTO v_count
  FROM public.enrollment_charge_items ci
  WHERE ci.family_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.families f WHERE f.id = ci.family_id);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Pre-flight: % enrollment_charge_items rows have unresolvable family_id', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.enrollment_charge_items ci
  WHERE ci.student_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = ci.student_id);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Pre-flight: % enrollment_charge_items rows have unresolvable student_id', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.enrollment_charge_items ci
  WHERE ci.class_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = ci.class_id);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Pre-flight: % enrollment_charge_items rows have unresolvable class_id', v_count;
  END IF;

  -- 6. Every existing item_type must fall inside the widened vocabulary.
  SELECT count(*) INTO v_count
  FROM public.enrollment_charge_items
  WHERE item_type IS NOT NULL
    AND item_type NOT IN ('registration','first_tuition','recurring_tuition','one_time_fee',
                          'private_pack','costume','competition','merchandise','late_fee','adjustment');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Pre-flight: % enrollment_charge_items rows carry an item_type outside the new vocabulary', v_count;
  END IF;
END
$preflight$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. enrollment_charge_items — generalize (§3.1)
-- ═════════════════════════════════════════════════════════════════════════════

-- 1.1 enrollment_id → nullable. A costume or late fee has no enrollment.
ALTER TABLE public.enrollment_charge_items ALTER COLUMN enrollment_id DROP NOT NULL;

-- 1.2 Human label for ad-hoc items ("Nutcracker costume — Clara").
ALTER TABLE public.enrollment_charge_items ADD COLUMN IF NOT EXISTS description text;

-- 1.3 FKs on the three columns that were unconstrained uuids.
--     All stay NULLABLE (A1). NO ACTION per §13 — financial records block deletion,
--     never cascade. Postgres has no ADD CONSTRAINT IF NOT EXISTS, hence the guards.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollment_charge_items_family_id_fkey') THEN
    ALTER TABLE public.enrollment_charge_items
      ADD CONSTRAINT enrollment_charge_items_family_id_fkey
      FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollment_charge_items_student_id_fkey') THEN
    ALTER TABLE public.enrollment_charge_items
      ADD CONSTRAINT enrollment_charge_items_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollment_charge_items_class_id_fkey') THEN
    ALTER TABLE public.enrollment_charge_items
      ADD CONSTRAINT enrollment_charge_items_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE NO ACTION;
  END IF;
END
$$;

-- 1.4 Widen item_type. Existing spellings preserved verbatim — the webhook and
--     approval-repo already write 'registration' and 'first_tuition'; renaming
--     them would break both writers.
ALTER TABLE public.enrollment_charge_items
  DROP CONSTRAINT IF EXISTS enrollment_charge_items_item_type_check;

ALTER TABLE public.enrollment_charge_items
  ADD CONSTRAINT enrollment_charge_items_item_type_check
  CHECK (item_type = ANY (ARRAY[
    'registration'::text,
    'first_tuition'::text,
    'recurring_tuition'::text,
    'one_time_fee'::text,
    'private_pack'::text,
    'costume'::text,
    'competition'::text,
    'merchandise'::text,
    'late_fee'::text,
    'adjustment'::text
  ]));


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. enrollment_cart_items — generalize (§3.2)
-- ═════════════════════════════════════════════════════════════════════════════

-- 2.1 class_id → nullable. FK to classes(id) is untouched and still enforced
--     for non-null values.
ALTER TABLE public.enrollment_cart_items ALTER COLUMN class_id DROP NOT NULL;

-- 2.2 item_type. Added nullable → backfilled → defaulted → SET NOT NULL, in that
--     order, so the 4 live rows survive and the sole writer
--     (app/api/enrollment/cart/route.ts:281, which supplies no item_type)
--     keeps working via the DEFAULT.
--
--     NOTE: this vocabulary intentionally differs from enrollment_charge_items.item_type
--     above — cart items describe WHAT IS BEING BOUGHT, charge items describe WHAT IS
--     BEING BILLED. Spec §3.2 proposes unifying them; that is not settled, so this
--     follows the narrower set specified for A1.
ALTER TABLE public.enrollment_cart_items ADD COLUMN IF NOT EXISTS item_type text;

UPDATE public.enrollment_cart_items
SET item_type = 'class_enrollment'
WHERE item_type IS NULL;

ALTER TABLE public.enrollment_cart_items ALTER COLUMN item_type SET DEFAULT 'class_enrollment';
ALTER TABLE public.enrollment_cart_items ALTER COLUMN item_type SET NOT NULL;

ALTER TABLE public.enrollment_cart_items
  DROP CONSTRAINT IF EXISTS enrollment_cart_items_item_type_check;

ALTER TABLE public.enrollment_cart_items
  ADD CONSTRAINT enrollment_cart_items_item_type_check
  CHECK (item_type = ANY (ARRAY[
    'class_enrollment'::text,
    'private_pack'::text,
    'merchandise'::text,
    'fee'::text
  ]));

-- 2.3 Polymorphic target (package id, product id). Deliberately no FK — the
--     referent table varies by item_type.
ALTER TABLE public.enrollment_cart_items ADD COLUMN IF NOT EXISTS reference_id uuid;

-- 2.4 Human label, mirroring charge items.
ALTER TABLE public.enrollment_cart_items ADD COLUMN IF NOT EXISTS description text;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Ledger cleanup (§3.9)
-- ═════════════════════════════════════════════════════════════════════════════

-- 3.1 Drop vestigial columns pointing at tables dropped 2026-07-20 by
--     20260720100000_retire_legacy_billing_family.sql (invoices, payments,
--     invoice_line_items). Verified 0 non-null values and 0 code references;
--     the pre-flight block re-verifies at apply time.
ALTER TABLE public.ledger_entries DROP COLUMN IF EXISTS invoice_id;
ALTER TABLE public.ledger_entries DROP COLUMN IF EXISTS payment_id;
ALTER TABLE public.ledger_entries DROP COLUMN IF EXISTS line_item_id;

-- 3.2 Rename the clearing account. "Cash – Stripe Clearing" becomes wrong the
--     moment a tenant uses Square/Authorize.net (§5). Slug and code unchanged,
--     so ledger_entries.account (FK → ledger_accounts.slug) is unaffected.
UPDATE public.ledger_accounts
SET name = 'Cash – Processor Clearing'
WHERE slug = 'cash_clearing';

-- 3.3 Undeposited Funds — the only account §6 requires that does not exist.
--     Code 1020 sits between 1010 cash_clearing and 1100 accounts_receivable;
--     verified free. Bare ON CONFLICT DO NOTHING (no target) so a collision on
--     EITHER unique key — slug (PK) or code — is absorbed rather than raising.
INSERT INTO public.ledger_accounts (slug, code, name, acct_type, normal_balance, is_active)
VALUES ('undeposited_funds', 1020, 'Undeposited Funds', 'asset', 'debit', true)
ON CONFLICT DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. productions.tenant_id (§3.9) — multi-tenant hole
-- ═════════════════════════════════════════════════════════════════════════════
-- productions was the only table among productions/seasons/studio_locations with
-- no tenant scoping, so productions could not be tenant-filtered in any report.
--
-- productions.season is deliberately NOT touched — that text→FK conversion
-- belongs with the reporting work.

ALTER TABLE public.productions ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.productions
SET tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
WHERE tenant_id IS NULL;

ALTER TABLE public.productions ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'productions_tenant_id_fkey') THEN
    -- NO ACTION per §13: a tenant with financial/production history cannot be
    -- deleted out from under it. Note seasons/studio_locations use CASCADE;
    -- productions intentionally does not.
    ALTER TABLE public.productions
      ADD CONSTRAINT productions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE NO ACTION;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_productions_tenant ON public.productions (tenant_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. timesheet_entries.production_id FK (§3.9)
-- ═════════════════════════════════════════════════════════════════════════════
-- The column exists and is read by the payroll report, but has never been
-- constrained — nothing prevented an orphaned or mistyped uuid.
-- Orphan count verified 0; pre-flight re-verifies.
--
-- ON DELETE NO ACTION, deliberately NOT SET NULL. Production P&L attributes
-- labor cost through this column (production_id × total_hours × rate_amount).
-- SET NULL would silently destroy that attribution the moment a production was
-- deleted — the hours would survive, detached, and every prior period's labor
-- cost would quietly change. Blocking the delete is correct: a production with
-- logged hours should be archived, never deleted.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timesheet_entries_production_id_fkey') THEN
    ALTER TABLE public.timesheet_entries
      ADD CONSTRAINT timesheet_entries_production_id_fkey
      FOREIGN KEY (production_id) REFERENCES public.productions(id) ON DELETE NO ACTION;
  END IF;
END
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Reload PostgREST schema cache
-- ═════════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
