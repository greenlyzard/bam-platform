-- Authorization Checkout — Slice 1. Implements docs/AUTHORIZATION_CHECKOUT.md §2/§3/§5.
--
-- Verified live 2026-07-16 (bam-schema-sync, read-only): no `charge_timing` anywhere; no
-- registration-fee source; no scheduled-intent table; families.stripe_customer_id populated on 0
-- rows; ledger_accounts lacks 'revenue_registration' (chart has 'revenue_fees').
--
-- All guarded/re-runnable (IF NOT EXISTS / constraint-name checks / ON CONFLICT); RLS + tenant_id
-- on the new table; no forward FKs (all FK targets — tenants/families/students/classes — exist).

-- 1. Registration fee config (studio-wide). $50 = 5000 cents (addendum "locked"). The DEFAULT
--    backfills the existing studio_settings row(s), so no separate seed is needed.
ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS registration_fee_cents integer NOT NULL DEFAULT 5000;

-- 2. charge_timing on cart line items. A class enrollment is tuition → 'scheduled' by default (§1);
--    an admin may flip a class to 'immediate' to charge it at checkout.
ALTER TABLE public.enrollment_cart_items
  ADD COLUMN IF NOT EXISTS charge_timing text NOT NULL DEFAULT 'scheduled';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.enrollment_cart_items'::regclass
      AND conname='enrollment_cart_items_charge_timing_check') THEN
    ALTER TABLE public.enrollment_cart_items
      ADD CONSTRAINT enrollment_cart_items_charge_timing_check
      CHECK (charge_timing IN ('immediate','scheduled'));
  END IF;
END $$;

-- 3. Vaulted card-on-file on the family (§3). Mandate column reserved for the ACH slice (stays null).
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS stripe_mandate_id text;

-- 4. revenue_registration chart account (§5) — registration fee revenue, distinct from tuition.
INSERT INTO public.ledger_accounts (slug, code, name, acct_type, normal_balance) VALUES
  ('revenue_registration', 4011, 'Registration Fee Revenue', 'revenue', 'credit')
ON CONFLICT (slug) DO NOTHING;

-- 5. Scheduled tuition intent staging (§3). The later 15th draw engine reads this; minimal now.
CREATE TABLE IF NOT EXISTS public.tuition_schedule_intent (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  family_id            uuid REFERENCES public.families(id) ON DELETE SET NULL,
  student_id           uuid REFERENCES public.students(id) ON DELETE SET NULL,
  class_id             uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  monthly_amount_cents integer NOT NULL,
  anchor_day           int  NOT NULL DEFAULT 15,
  status               text NOT NULL DEFAULT 'pending_setup',
  source_ref           text,   -- stripe payment intent / checkout session id
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.tuition_schedule_intent'::regclass
      AND conname='tuition_schedule_intent_status_check') THEN
    ALTER TABLE public.tuition_schedule_intent
      ADD CONSTRAINT tuition_schedule_intent_status_check
      CHECK (status IN ('pending_setup','active','cancelled'));
  END IF;
END $$;
-- Idempotency for webhook retries: one intent per (payment, class, student).
CREATE UNIQUE INDEX IF NOT EXISTS ux_tuition_intent_source
  ON public.tuition_schedule_intent (source_ref, class_id, student_id)
  WHERE source_ref IS NOT NULL AND class_id IS NOT NULL AND student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tuition_intent_family
  ON public.tuition_schedule_intent (tenant_id, family_id);

ALTER TABLE public.tuition_schedule_intent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tuition_intent_admin_all ON public.tuition_schedule_intent;
CREATE POLICY tuition_intent_admin_all ON public.tuition_schedule_intent
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

NOTIFY pgrst, 'reload schema';
