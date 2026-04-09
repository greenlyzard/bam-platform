-- Student upsell/engagement opportunities — admin-facing
CREATE TABLE IF NOT EXISTS student_opportunities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  student_id        uuid NOT NULL,
  opportunity_type  text NOT NULL,
  title             text NOT NULL,
  description       text,
  action_label      text,
  action_url        text,
  metadata          jsonb DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','dismissed','converted','snoozed')),
  snoozed_until     date,
  dismissed_at      timestamptz,
  dismissed_by      uuid,
  converted_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  expires_at        date
);

CREATE INDEX IF NOT EXISTS idx_student_opportunities_student
  ON student_opportunities(student_id);
CREATE INDEX IF NOT EXISTS idx_student_opportunities_tenant_status
  ON student_opportunities(tenant_id, status);

ALTER TABLE student_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_opportunities_admin_all ON student_opportunities;
CREATE POLICY student_opportunities_admin_all ON student_opportunities
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
