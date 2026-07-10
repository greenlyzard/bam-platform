-- Commerce & Billing — Layer 1 groundwork: the dimensioned financial ledger.
-- Ref: docs/COMMERCE_AND_BILLING.md §2 (ledger_entries) + §3 (Layer 1 checkout spine).
-- SCOPE: table + indexes + RLS ONLY. No checkout/webhook wiring (next slice).
--
-- FK notes (targets verified live 2026-07-10 via bam-schema-sync):
--   tenant_id  -> tenants(id)           [exists]  ON DELETE CASCADE
--   class_id   -> classes(id)           [exists]  ON DELETE SET NULL
--   location_id-> studio_locations(id)  [exists]  ON DELETE SET NULL
--   family_id  -> families(id)          [exists]  ON DELETE SET NULL
--   event_id   -> NO FK: polymorphic dimension spanning productions/seasons/(future
--                 competition). No single valid target (competition/events table does
--                 not exist), so kept as a plain uuid per spec §2. See comment below.
--   discount_id-> NO FK: discounts table not yet built (spec §8, deferred). Plain uuid.

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  direction      text NOT NULL CHECK (direction IN ('revenue','expense')),

  -- Chart-of-accounts fields; nullable for now — value lists TBD with bookkeeper (§11).
  account        text,
  category       text,

  -- Accounting dimensions (all nullable — an entry may belong to an event, a class,
  -- a location, and/or a family, or none).
  event_id       uuid,  -- polymorphic: productions.id / seasons.id / (future) competition; no FK by design
  class_id       uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  location_id    uuid REFERENCES public.studio_locations(id) ON DELETE SET NULL,
  family_id      uuid REFERENCES public.families(id) ON DELETE SET NULL,

  amount_cents   integer NOT NULL,
  currency       text NOT NULL DEFAULT 'usd',

  period         text,  -- billing/accounting period, e.g. '2026-08'

  occurred_at    timestamptz,
  posted_at      timestamptz DEFAULT now(),

  source         text,  -- enrollment | private | production | expense_entry | allocation | rental
  discount_id    uuid,  -- applied discount; no FK yet (discounts table unbuilt, spec §8)

  review_tier    text NOT NULL DEFAULT 'auto'
                   CHECK (review_tier IN ('auto','review')),
  charge_status  text NOT NULL DEFAULT 'pending'
                   CHECK (charge_status IN ('pending','approved','charged','failed','void','recorded')),

  stripe_reference text,   -- payment intent / charge id when charged
  qbo_export_ref   text,   -- set when exported/synced to QuickBooks (§7)

  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.ledger_entries.event_id IS
  'Polymorphic event dimension (productions.id / seasons.id / future competition table). No FK: no single valid target. Enforce integrity in application code.';
COMMENT ON COLUMN public.ledger_entries.discount_id IS
  'Applied discount. No FK yet — discounts table not built (COMMERCE_AND_BILLING.md §8). Add FK when it lands.';

-- Indexes (per spec: tenant+period reporting, and the dimension/status lookups).
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_period ON public.ledger_entries (tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_family        ON public.ledger_entries (family_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_event         ON public.ledger_entries (event_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_class         ON public.ledger_entries (class_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_charge_status ON public.ledger_entries (charge_status);

-- RLS: financial data — admin-only, mirroring credit_accounts / credit_transactions.
-- Uses the SECURITY DEFINER is_admin() helper (never queries profiles directly).
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage ledger_entries" ON public.ledger_entries;
CREATE POLICY "Admins can manage ledger_entries"
  ON public.ledger_entries
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Reload PostgREST schema cache so the new table is exposed.
NOTIFY pgrst, 'reload schema';
