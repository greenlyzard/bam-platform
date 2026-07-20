-- Billing Approval & Draw — §9 additive schema.
-- Ref: docs/BILLING_APPROVAL_AND_DRAW.md §9 (canonical, Draft 2026-07-17).
--
-- Money model: `charges` is the money-moved source of truth; `refunds` hang off charges.
-- Companion to 20260720100000_retire_legacy_billing_family.sql (which removed the
-- superseded invoices/payments/allocations family). This migration REFUSES to run unless
-- that retirement has been applied (pre-flight guard below), so the two never interleave.
--
-- Conventions:
--   * All money is INTEGER CENTS. No dollars column anywhere in this file.
--   * Every DDL is idempotent: CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--     DROP POLICY IF EXISTS before CREATE POLICY, guarded ADD CONSTRAINT.
--   * Status columns are text with CHECK constraints listing the spec's exact values (no enums).
--   * FKs only where §9 explicitly arrows one (→). Bare uuid otherwise (tenant_id, family/
--     student/class links, billing_tasks link ids) — matching §9 notation exactly.
--   * New tables are ordered so no CREATE references a table created later in this file.
--   * RLS: is_admin() full access on every new table; parent SELECT (auth_family_ids()) only
--     on charges / enrollment_charge_items / refunds per §9.3. Both helpers are SECURITY
--     DEFINER over profile_roles.user_id. Cron writes via service role (bypasses RLS).

-- ── Pre-flight: the retired legacy billing family must already be gone ─────────────────
DO $$
DECLARE
  v_tbl  text;
  v_live text[] := ARRAY[]::text[];
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY[
    'public.refunds', 'public.payment_allocations', 'public.payments',
    'public.invoice_line_items', 'public.invoices'
  ] LOOP
    IF to_regclass(v_tbl) IS NOT NULL THEN
      v_live := array_append(v_live, v_tbl);
    END IF;
  END LOOP;
  IF array_length(v_live, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Legacy billing family still present (%). Run 20260720100000_retire_legacy_billing_family.sql before this migration.',
      array_to_string(v_live, ', ');
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════════════
-- §9.1  NEW TABLES  (ordered to avoid forward FK references)
-- ══════════════════════════════════════════════════════════════════════════════════════

-- ── refund_reasons — tenant-scoped picklist (§10 decision 4) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.refund_reasons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id),   -- NO ACTION: block tenant deletion
  label       text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,   -- shipped default vs tenant-added
  is_active   boolean NOT NULL DEFAULT true,     -- soft-delete only (refunds reference it)
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── charges — money-moved record, source of truth for reversibility (§6.1) ─────────────
CREATE TABLE IF NOT EXISTS public.charges (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES public.tenants(id),  -- NO ACTION: block tenant deletion
  family_id                uuid NOT NULL,
  enrollment_id            uuid,                 -- nullable, bare uuid (§6.1)
  student_id               uuid,                 -- nullable, bare uuid
  class_id                 uuid,                 -- nullable, bare uuid
  intent_id                uuid REFERENCES public.tuition_schedule_intent(id) ON DELETE SET NULL,
  kind                     text NOT NULL,        -- e.g. monthly_tuition | registration | first_tuition | one_time_fee | merch (not enumerated in §9 — no CHECK)
  amount_cents             integer NOT NULL,
  currency                 text NOT NULL DEFAULT 'usd',
  status                   text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','processing','succeeded','failed','canceled','refunded','partially_refunded')),
  stripe_payment_intent_id text,
  stripe_charge_id         text,
  billing_period           text,                 -- nullable 'YYYY-MM' (monthly draws)
  ledger_posting_key       text,
  source                   text NOT NULL
    CHECK (source IN ('approval','draw','manual','merch')),
  created_by               text,                 -- admin uuid (as text) | 'system' sentinel (§6.1)
  refunded_total_cents     integer NOT NULL DEFAULT 0,
  metadata                 jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  captured_at              timestamptz,
  updated_at               timestamptz NOT NULL DEFAULT now()
);
-- Draw idempotency: one monthly_tuition charge per intent per period (§5.5, §9.1).
CREATE UNIQUE INDEX IF NOT EXISTS uq_charges_intent_period
  ON public.charges (intent_id, billing_period)
  WHERE kind = 'monthly_tuition';
CREATE INDEX IF NOT EXISTS idx_charges_tenant     ON public.charges (tenant_id);
CREATE INDEX IF NOT EXISTS idx_charges_family     ON public.charges (family_id);
CREATE INDEX IF NOT EXISTS idx_charges_intent     ON public.charges (intent_id);
CREATE INDEX IF NOT EXISTS idx_charges_enrollment ON public.charges (enrollment_id);
COMMENT ON COLUMN public.charges.kind IS
  'Free text (intentionally not CHECK-constrained). Known kinds per docs/BILLING_APPROVAL_AND_DRAW.md: '
  'monthly_tuition (draw engine), registration, first_tuition, one_time_fee, private_pack (approval items), merch (future).';

-- ── enrollment_charge_items — the approval-queue line items (§2, §9.1) ─────────────────
CREATE TABLE IF NOT EXISTS public.enrollment_charge_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES public.tenants(id),  -- NO ACTION: block tenant deletion
  enrollment_id            uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  family_id                uuid,                 -- bare uuid (§9.1)
  student_id               uuid,                 -- bare uuid
  class_id                 uuid,                 -- bare uuid
  item_type                text NOT NULL
    CHECK (item_type IN ('registration','first_tuition','one_time_fee','private_pack')),
  recurrence_type          text NOT NULL
    CHECK (recurrence_type IN ('recurring','one_time')),
  recommended_amount_cents integer NOT NULL,
  approved_amount_cents     integer,             -- set at approval (post-adjustment)
  charge_timing            text
    CHECK (charge_timing IN ('charge_now','deferred')),
  proration                jsonb,                -- {method, source, full_month_cents, meetings_in_cycle, deliverable_meetings_in_window, start_date, next_anchor_date}
  status                   text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','charging','charged','deferred','declined','failed')),
  charge_id                uuid REFERENCES public.charges(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_charge_items_enrollment ON public.enrollment_charge_items (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_charge_items_family     ON public.enrollment_charge_items (family_id);
CREATE INDEX IF NOT EXISTS idx_charge_items_status     ON public.enrollment_charge_items (status);

-- ── refunds — each linked to its charge (§6.3) ─────────────────────────────────────────
-- NOTE: §6.3's `is_partial` is intentionally OMITTED (Derek 2026-07-20) — derived at read
-- time. Partial-vs-full is already encoded by charges.status (partially_refunded|refunded)
-- and by comparing refunds.amount_cents to charges.amount_cents − charges.refunded_total_cents.
CREATE TABLE IF NOT EXISTS public.refunds (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL REFERENCES public.tenants(id),  -- NO ACTION: block tenant deletion
  charge_id                   uuid NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  amount_cents                integer NOT NULL,
  reason_id                   uuid NOT NULL REFERENCES public.refund_reasons(id) ON DELETE RESTRICT,
  reason_note                 text,             -- optional free text (§6.3)
  stripe_refund_id            text,
  ledger_reversal_posting_key text,
  status                      text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','succeeded','failed')),
  refunded_by                 uuid,             -- admin uuid (§6.3)
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_charge ON public.refunds (charge_id);
CREATE INDEX IF NOT EXISTS idx_refunds_tenant ON public.refunds (tenant_id);

-- ── charge_item_adjustments — append-only adjustment log (§4.4, §9.1) ──────────────────
CREATE TABLE IF NOT EXISTS public.charge_item_adjustments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id),  -- NO ACTION: block tenant deletion
  charge_item_id    uuid NOT NULL REFERENCES public.enrollment_charge_items(id) ON DELETE CASCADE,
  admin_id          uuid,
  adjustment_type   text NOT NULL
    CHECK (adjustment_type IN ('waive','amount_off','percent_off')),
  value             integer NOT NULL,   -- cents for amount_off; whole-percent for percent_off (interpreted by adjustment_type)
  recommended_cents integer,
  approved_cents    integer,
  reason            text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
  -- immutable / append-only: no updated_at
);
CREATE INDEX IF NOT EXISTS idx_adjustments_charge_item ON public.charge_item_adjustments (charge_item_id);

-- ── draw_runs — one row per tenant monthly draw cycle (§5.1, §9.1) ─────────────────────
CREATE TABLE IF NOT EXISTS public.draw_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id),  -- NO ACTION: block tenant deletion
  billing_period text NOT NULL,           -- 'YYYY-MM'
  anchor_date    date,
  status         text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','held','executed')),
  executed_at    timestamptz,
  executed_by    text,                    -- admin uuid (as text) | 'system' sentinel (§9.1)
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_draw_runs_tenant_period ON public.draw_runs (tenant_id, billing_period);

-- ── billing_tasks — structured records emitted on dunning exhaustion (§5.5, §9.1) ──────
CREATE TABLE IF NOT EXISTS public.billing_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id),  -- NO ACTION: block tenant deletion
  type          text NOT NULL,            -- open set 'dunning_exhausted'|… (no CHECK per §9.1)
  intent_id     uuid,                     -- bare uuid (§9.1)
  enrollment_id uuid,                     -- bare uuid
  family_id     uuid,                     -- bare uuid
  status        text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved')),
  payload       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid
);
CREATE INDEX IF NOT EXISTS idx_billing_tasks_tenant_status ON public.billing_tasks (tenant_id, status);

-- ── tenant_communication_modes — per-comm-type automation mode (§10 decision 10, §9.2) ─
CREATE TABLE IF NOT EXISTS public.tenant_communication_modes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id),  -- NO ACTION: block tenant deletion
  comm_type  text NOT NULL,               -- open set 'hold_warning'|'hold_expiry'|'dunning'|'decline'|'confirmation'|… (no CHECK)
  mode       text NOT NULL DEFAULT 'review_then_send'
    CHECK (mode IN ('review_then_send','automatic')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_modes_tenant_type
  ON public.tenant_communication_modes (tenant_id, comm_type);

-- ══════════════════════════════════════════════════════════════════════════════════════
-- §9.2  COLUMN ADDITIONS  (additive only — existing columns/constraints untouched)
-- ══════════════════════════════════════════════════════════════════════════════════════

-- ── enrollments (11 adds). status stays text; new values handled at app layer — existing
--    CHECK/constraint deliberately NOT altered here (additive only). ────────────────────
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS stripe_setup_intent_id  text,
  ADD COLUMN IF NOT EXISTS checkout_session_id     text,
  ADD COLUMN IF NOT EXISTS approved_by             uuid,
  ADD COLUMN IF NOT EXISTS approved_at             timestamptz,
  ADD COLUMN IF NOT EXISTS declined_reason         text,
  ADD COLUMN IF NOT EXISTS declined_at             timestamptz,
  ADD COLUMN IF NOT EXISTS hold_expires_at         timestamptz,
  ADD COLUMN IF NOT EXISTS hold_extended_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hold_last_extended_by   uuid,
  ADD COLUMN IF NOT EXISTS hold_last_extended_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_charge_error       text;

-- ── tuition_schedule_intent (8 adds). anchor_day already exists (no add). status values
--    handled at app layer. enrollment_id gets a real FK (guarded below). ────────────────
ALTER TABLE public.tuition_schedule_intent
  ADD COLUMN IF NOT EXISTS enrollment_id           uuid,
  ADD COLUMN IF NOT EXISTS deferred_addition_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_drawn_period       text,
  ADD COLUMN IF NOT EXISTS next_draw_at            timestamptz,
  ADD COLUMN IF NOT EXISTS failure_count           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_at         timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_code       text,
  ADD COLUMN IF NOT EXISTS canceled_at             timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tuition_schedule_intent_enrollment_id_fkey'
  ) THEN
    ALTER TABLE public.tuition_schedule_intent
      ADD CONSTRAINT tuition_schedule_intent_enrollment_id_fkey
      FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── studio_settings (6 adds). registration_fee_cents already exists (no add). §9.2 lists
--    these as plain typed columns with no CHECK — matched exactly. ───────────────────────
ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS proration_method               text NOT NULL DEFAULT 'meeting',
  ADD COLUMN IF NOT EXISTS hold_expiry_days               integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tuition_anchor_day             integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS refund_policy_enabled          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_window_days             integer,
  ADD COLUMN IF NOT EXISTS registration_stated_refundable boolean NOT NULL DEFAULT false;

-- ══════════════════════════════════════════════════════════════════════════════════════
-- §9.3  RLS — admin full access on all new tables; parent SELECT on the three read tables
-- ══════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.refund_reasons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charges                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_charge_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_item_adjustments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_runs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_communication_modes ENABLE ROW LEVEL SECURITY;

-- Admin (is_admin(): SECURITY DEFINER over profile_roles) full access on every new table.
DROP POLICY IF EXISTS refund_reasons_admin_all ON public.refund_reasons;
CREATE POLICY refund_reasons_admin_all ON public.refund_reasons
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS charges_admin_all ON public.charges;
CREATE POLICY charges_admin_all ON public.charges
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS charge_items_admin_all ON public.enrollment_charge_items;
CREATE POLICY charge_items_admin_all ON public.enrollment_charge_items
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS refunds_admin_all ON public.refunds;
CREATE POLICY refunds_admin_all ON public.refunds
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS adjustments_admin_all ON public.charge_item_adjustments;
CREATE POLICY adjustments_admin_all ON public.charge_item_adjustments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS draw_runs_admin_all ON public.draw_runs;
CREATE POLICY draw_runs_admin_all ON public.draw_runs
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS billing_tasks_admin_all ON public.billing_tasks;
CREATE POLICY billing_tasks_admin_all ON public.billing_tasks
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS comm_modes_admin_all ON public.tenant_communication_modes;
CREATE POLICY comm_modes_admin_all ON public.tenant_communication_modes
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Parent SELECT (own family only) on the three read tables (§9.3).
-- charges + enrollment_charge_items carry family_id directly; refunds scope via their charge.
DROP POLICY IF EXISTS charges_parent_select ON public.charges;
CREATE POLICY charges_parent_select ON public.charges
  FOR SELECT USING (family_id IN (SELECT public.auth_family_ids()));

DROP POLICY IF EXISTS charge_items_parent_select ON public.enrollment_charge_items;
CREATE POLICY charge_items_parent_select ON public.enrollment_charge_items
  FOR SELECT USING (family_id IN (SELECT public.auth_family_ids()));

DROP POLICY IF EXISTS refunds_parent_select ON public.refunds;
CREATE POLICY refunds_parent_select ON public.refunds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.charges c
      WHERE c.id = refunds.charge_id
        AND c.family_id IN (SELECT public.auth_family_ids())
    )
  );

-- ── Reload PostgREST schema cache ──────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
