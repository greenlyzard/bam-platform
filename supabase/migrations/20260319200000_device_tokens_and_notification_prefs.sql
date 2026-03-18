
CREATE TABLE IF NOT EXISTS device_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,
  platform     text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  last_seen_at timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_profile ON device_tokens(profile_id);
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_device_tokens" ON device_tokens;
CREATE POLICY "own_device_tokens" ON device_tokens FOR ALL USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE TABLE IF NOT EXISTS notification_preferences (
  profile_id         uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  check_in           boolean DEFAULT true,
  announcements      boolean DEFAULT true,
  billing            boolean DEFAULT true,
  rehearsal_schedule boolean DEFAULT true,
  class_reminder     boolean DEFAULT true,
  late_pickup        boolean DEFAULT true,
  timesheet_reminder boolean DEFAULT true,
  attendance_summary boolean DEFAULT true,
  push_enabled       boolean DEFAULT true,
  email_enabled      boolean DEFAULT true,
  updated_at         timestamptz DEFAULT now()
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_notification_prefs" ON notification_preferences;
CREATE POLICY "own_notification_prefs" ON notification_preferences FOR ALL USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
