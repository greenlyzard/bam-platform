-- ============================================================
-- ADD ENROLLMENT + BILLING COLUMNS
-- ============================================================

-- 1. Extend enrollments table with billing/enrollment type columns
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS family_id UUID,
  ADD COLUMN IF NOT EXISTS enrollment_type TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS enrolled_by UUID,
  ADD COLUMN IF NOT EXISTS billing_plan_type TEXT,
  ADD COLUMN IF NOT EXISTS suppress_onboarding BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_enrollments_tenant ON enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_family ON enrollments(family_id);

-- 2. Add trial_eligible and point_cost to classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS trial_eligible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS point_cost INTEGER NOT NULL DEFAULT 1;

-- 3. Create credit_accounts table (if not exists)
CREATE TABLE IF NOT EXISTS public.credit_accounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL,
  family_id   UUID,
  balance     INTEGER     NOT NULL DEFAULT 0,
  lifetime_earned  INTEGER NOT NULL DEFAULT 0,
  lifetime_spent   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_tenant ON credit_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_student ON credit_accounts(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_accounts_student_uniq ON credit_accounts(tenant_id, student_id);

ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage credit_accounts" ON credit_accounts;
CREATE POLICY "Admins can manage credit_accounts" ON credit_accounts
  FOR ALL USING (is_admin());

-- 4. Create credit_transactions table (if not exists)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id  UUID        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('purchase', 'charge', 'refund', 'adjustment', 'expiry')),
  amount      INTEGER     NOT NULL,
  balance_after INTEGER   NOT NULL,
  description TEXT,
  reference_id UUID,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_account ON credit_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_tenant ON credit_transactions(tenant_id);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage credit_transactions" ON credit_transactions;
CREATE POLICY "Admins can manage credit_transactions" ON credit_transactions
  FOR ALL USING (is_admin());

-- 5. Create trial_history table (if not exists)
CREATE TABLE IF NOT EXISTS public.trial_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL,
  class_id    UUID        NOT NULL,
  enrollment_id UUID,
  trial_date  DATE,
  outcome     TEXT        NOT NULL DEFAULT 'pending_conversion' CHECK (outcome IN ('pending_conversion', 'converted', 'declined', 'no_show', 'expired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_history_tenant ON trial_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trial_history_student ON trial_history(student_id, class_id);

ALTER TABLE trial_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage trial_history" ON trial_history;
CREATE POLICY "Admins can manage trial_history" ON trial_history
  FOR ALL USING (is_admin());
