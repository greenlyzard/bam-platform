-- Create pay_periods and timesheets tables
-- These were defined in 20260312000001 but never actually created in the database.
-- FK teacher_id references profiles(id) instead of teacher_profiles(id),
-- since teacher_profiles is now a VIEW (as of 20260315000001).

-- ============================================================
-- pay_periods
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pay_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year BETWEEN 2020 AND 2099),
  submission_deadline date NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'exported')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_pay_periods_tenant_status
  ON public.pay_periods(tenant_id, status);

-- ============================================================
-- timesheets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pay_period_id uuid NOT NULL REFERENCES pay_periods(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'exported')),
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_notes text,
  total_hours decimal(6,2) DEFAULT 0,
  total_pay decimal(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, teacher_id, pay_period_id)
);

CREATE INDEX IF NOT EXISTS idx_timesheets_teacher
  ON public.timesheets(teacher_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_period
  ON public.timesheets(pay_period_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_tenant_status
  ON public.timesheets(tenant_id, status);

-- updated_at trigger (reuses existing update_updated_at function)
CREATE TRIGGER set_timesheets_updated_at
  BEFORE UPDATE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies from prior migrations (safety)
DROP POLICY IF EXISTS "admins_pay_periods" ON public.pay_periods;
DROP POLICY IF EXISTS "teachers_pay_periods_read" ON public.pay_periods;
DROP POLICY IF EXISTS "teachers_pay_periods_insert" ON public.pay_periods;
DROP POLICY IF EXISTS "admins_timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "teachers_own_timesheets_select" ON public.timesheets;
DROP POLICY IF EXISTS "teachers_own_timesheets_insert" ON public.timesheets;
DROP POLICY IF EXISTS "teachers_own_timesheets_update" ON public.timesheets;

-- pay_periods policies
CREATE POLICY "admins_pay_periods"
  ON public.pay_periods FOR ALL
  USING (is_admin());

CREATE POLICY "teachers_pay_periods_read"
  ON public.pay_periods FOR SELECT
  USING (is_teacher());

CREATE POLICY "teachers_pay_periods_insert"
  ON public.pay_periods FOR INSERT
  WITH CHECK (is_teacher());

-- timesheets policies
CREATE POLICY "admins_timesheets"
  ON public.timesheets FOR ALL
  USING (is_admin());

CREATE POLICY "teachers_own_timesheets_select"
  ON public.timesheets FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "teachers_own_timesheets_insert"
  ON public.timesheets FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "teachers_own_timesheets_update"
  ON public.timesheets FOR UPDATE
  USING (teacher_id = auth.uid() AND status IN ('draft', 'rejected'));
