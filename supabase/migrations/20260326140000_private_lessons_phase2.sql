-- ============================================================
-- PRIVATE LESSONS PHASE 2 — BILLING INTEGRATION
-- ============================================================

-- Create billing_charges if not exists (referenced by FK below)
CREATE TABLE IF NOT EXISTS public.billing_charges (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  family_id       UUID,
  student_id      UUID,
  charge_type     TEXT        NOT NULL DEFAULT 'private_lesson',
  description     TEXT,
  amount_cents    INTEGER     NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'billed', 'paid', 'waived', 'refunded')),
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  stripe_payment_intent_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_charges_tenant ON billing_charges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_charges_family ON billing_charges(family_id);

ALTER TABLE billing_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage billing_charges" ON billing_charges;
CREATE POLICY "Admins can manage billing_charges" ON billing_charges
  FOR ALL USING (is_admin());

-- Create tenant_billing_settings if not exists
CREATE TABLE IF NOT EXISTS public.tenant_billing_settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  show_studio_contribution BOOLEAN    NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_billing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage tenant_billing_settings" ON tenant_billing_settings;
CREATE POLICY "Admins can manage tenant_billing_settings" ON tenant_billing_settings
  FOR ALL USING (is_admin());

-- Add billing_charge_id to private_session_billing
ALTER TABLE public.private_session_billing
  ADD COLUMN IF NOT EXISTS billing_charge_id UUID;

-- Seed BAM billing settings
INSERT INTO public.tenant_billing_settings (tenant_id, show_studio_contribution)
VALUES ('84d98f72-c82f-414f-8b17-172b802f6993', true)
ON CONFLICT (tenant_id) DO UPDATE SET show_studio_contribution = true;
