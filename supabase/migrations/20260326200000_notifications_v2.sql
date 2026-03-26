CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('in_app','email','sms','push')),
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'private_scheduled','private_confirmed','class_reminder','evaluation_published',
    'announcement','channel_message','direct_message','billing_alert',
    'performance_update','trial_followup','sub_coverage','waitlist_update',
    'payroll_approved','payroll_flagged'
  )),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel, notification_type)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  endpoint        TEXT NOT NULL,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  device_type     TEXT CHECK (device_type IN ('ios','android','web','unknown')),
  device_name     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own prefs" ON notification_preferences;
CREATE POLICY "Users manage own prefs" ON notification_preferences FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all prefs" ON notification_preferences;
CREATE POLICY "Admins view all prefs" ON notification_preferences FOR SELECT USING (is_admin());

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage own subscriptions" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
