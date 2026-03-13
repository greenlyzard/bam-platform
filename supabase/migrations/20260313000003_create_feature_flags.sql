-- Feature flags for controlling admin nav visibility
CREATE TABLE IF NOT EXISTS feature_flags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  tenant_id  uuid REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_flags_key ON feature_flags(key);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature_flags"
  ON feature_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin can manage feature_flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Seed disabled flags for features hidden from Amanda on first run
INSERT INTO feature_flags (key, is_enabled) VALUES
  ('compliance', false),
  ('substitute_requests', false),
  ('productions', false),
  ('email_templates', false),
  ('schedule_embeds', false),
  ('announcements', false),
  ('tasks', false),
  ('calendar', false),
  ('seasons', false),
  ('schedule_classes', false);
