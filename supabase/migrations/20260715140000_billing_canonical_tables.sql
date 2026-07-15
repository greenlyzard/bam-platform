-- Commerce & Billing — Build Sequence Layer 3: canonical billing tables.
-- Ref: docs/COMMERCE_BILLING_ARCHITECTURE.md §4.1–4.5 (invoices, invoice_line_items,
--      payments, payment_allocations, refunds). All money = integer cents.
--
-- Verified live 2026-07-15 (bam-schema-sync, read-only):
--   EXIST (PK id): families, classes, enrollments, students, products, seasons,
--     studio_locations, private_sessions, class_pricing_rules, dances, tenants.
--   DO NOT EXIST (bare uuid, no FK): event_tags/billable_events, award_grants,
--     costume_fees, bundle_entitlements, tuition_charges.
--   is_admin() (SECURITY DEFINER over profile_roles.user_id) already includes finance_admin.
--   A parent owns a family via families.primary_contact_id.
--
-- Safely re-runnable: CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP POLICY IF EXISTS before CREATE POLICY.
-- FK conventions: dimension parents ON DELETE SET NULL; owner/child links ON DELETE CASCADE.

-- ── Parent-scope helper (SECURITY DEFINER: bypasses families RLS cleanly) ──────────
CREATE OR REPLACE FUNCTION public.auth_family_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.families WHERE primary_contact_id = auth.uid()
$$;

-- ── 4.1 invoices ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  family_id             uuid NOT NULL REFERENCES public.families(id) ON DELETE RESTRICT,
  season_id             uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  event_id              uuid,  -- no FK: future event_tags/billable_events (productions today)
  source                text NOT NULL,  -- enrollment|private|pilates|shop|manual|tuition_run
  status                text NOT NULL DEFAULT 'draft', -- draft|open|partially_paid|paid|void|refunded
  subtotal_cents        integer NOT NULL DEFAULT 0,
  discount_cents        integer NOT NULL DEFAULT 0,
  scholarship_cents     integer NOT NULL DEFAULT 0,
  credit_applied_cents  integer NOT NULL DEFAULT 0,
  tax_cents             integer NOT NULL DEFAULT 0,
  surcharge_cents       integer NOT NULL DEFAULT 0,
  total_cents           integer NOT NULL DEFAULT 0,
  amount_paid_cents     integer NOT NULL DEFAULT 0,
  currency              text NOT NULL DEFAULT 'usd',
  location_id           uuid REFERENCES public.studio_locations(id) ON DELETE SET NULL,
  period                text,  -- e.g. '2026-09' for a tuition run
  finalized_at          timestamptz,
  created_by            uuid,  -- no FK: profiles/auth user (audit)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── 4.2 invoice_line_items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id             uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  line_type              text NOT NULL,  -- open/growing set (see §5); NOT an enum
  description            text NOT NULL,
  class_id               uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  enrollment_id          uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  product_id             uuid REFERENCES public.products(id) ON DELETE SET NULL,
  private_session_id     uuid REFERENCES public.private_sessions(id) ON DELETE SET NULL,
  costume_fee_id         uuid,  -- no FK: costume_fees not built yet
  bundle_entitlement_id  uuid,  -- no FK: bundle_entitlements not built yet
  award_id               uuid,  -- no FK: award_grants not built yet
  event_id               uuid,  -- no FK: future event_tags/billable_events
  dance_id               uuid REFERENCES public.dances(id) ON DELETE SET NULL,
  student_id             uuid REFERENCES public.students(id) ON DELETE SET NULL,
  quantity               integer NOT NULL DEFAULT 1,
  unit_price_cents       integer NOT NULL,
  pricing_rule_id        uuid REFERENCES public.class_pricing_rules(id) ON DELETE SET NULL,
  discount_cents         integer NOT NULL DEFAULT 0,
  taxable                boolean NOT NULL DEFAULT false,
  tax_cents              integer NOT NULL DEFAULT 0,
  amount_cents           integer NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ── 4.3 payments ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  family_id              uuid NOT NULL REFERENCES public.families(id) ON DELETE RESTRICT,
  processor              text NOT NULL,  -- stripe|authorize_net|square|paypal|manual
  processor_payment_ref  text,  -- nullable: non-processor tenders (cash/check/credit/points) have none
  method                 text NOT NULL,  -- card|ach|credit|points|cash|check
  amount_cents           integer NOT NULL,
  fee_cents              integer NOT NULL DEFAULT 0,
  status                 text NOT NULL DEFAULT 'pending', -- pending|processing|succeeded|failed|returned|refunded
  recurring_charge_id    uuid,  -- no FK: tuition_charges not built yet
  idempotency_key        text,  -- nullable; UNIQUE index below (dedupes processor charges)
  settlement_expected_at timestamptz,
  captured_at            timestamptz,
  returned_at            timestamptz,
  return_code            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ── 4.4 payment_allocations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id            uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id            uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  invoice_line_item_id  uuid REFERENCES public.invoice_line_items(id) ON DELETE SET NULL,
  amount_cents          integer NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── 4.5 refunds ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refunds (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id            uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  amount_cents          integer NOT NULL,
  reason                text NOT NULL,
  destination           text NOT NULL,  -- card|credit
  processor_refund_ref  text,
  status                text NOT NULL DEFAULT 'pending',
  created_by            uuid,  -- no FK: profiles/auth user (audit)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes (RLS/join support + required UNIQUE idempotency key) ──────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_tenant           ON public.invoices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_family           ON public.invoices (family_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status           ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_line_items_invoice        ON public.invoice_line_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_family           ON public.payments (family_id);
CREATE INDEX IF NOT EXISTS idx_payments_status           ON public.payments (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key
  ON public.payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_allocations_payment       ON public.payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice       ON public.payment_allocations (invoice_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment           ON public.refunds (payment_id);

-- ── RLS: finance_admin (via is_admin) full write; parent SELECT own family only ───────
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds              ENABLE ROW LEVEL SECURITY;

-- invoices
DROP POLICY IF EXISTS invoices_admin_all ON public.invoices;
CREATE POLICY invoices_admin_all ON public.invoices
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS invoices_parent_select ON public.invoices;
CREATE POLICY invoices_parent_select ON public.invoices
  FOR SELECT USING (family_id IN (SELECT public.auth_family_ids()));

-- payments
DROP POLICY IF EXISTS payments_admin_all ON public.payments;
CREATE POLICY payments_admin_all ON public.payments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS payments_parent_select ON public.payments;
CREATE POLICY payments_parent_select ON public.payments
  FOR SELECT USING (family_id IN (SELECT public.auth_family_ids()));

-- invoice_line_items (scope via parent invoice's family)
DROP POLICY IF EXISTS line_items_admin_all ON public.invoice_line_items;
CREATE POLICY line_items_admin_all ON public.invoice_line_items
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS line_items_parent_select ON public.invoice_line_items;
CREATE POLICY line_items_parent_select ON public.invoice_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
        AND i.family_id IN (SELECT public.auth_family_ids())
    )
  );

-- payment_allocations (scope via parent payment's family)
DROP POLICY IF EXISTS allocations_admin_all ON public.payment_allocations;
CREATE POLICY allocations_admin_all ON public.payment_allocations
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS allocations_parent_select ON public.payment_allocations;
CREATE POLICY allocations_parent_select ON public.payment_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_allocations.payment_id
        AND p.family_id IN (SELECT public.auth_family_ids())
    )
  );

-- refunds (scope via parent payment's family)
DROP POLICY IF EXISTS refunds_admin_all ON public.refunds;
CREATE POLICY refunds_admin_all ON public.refunds
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS refunds_parent_select ON public.refunds;
CREATE POLICY refunds_parent_select ON public.refunds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = refunds.payment_id
        AND p.family_id IN (SELECT public.auth_family_ids())
    )
  );

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
