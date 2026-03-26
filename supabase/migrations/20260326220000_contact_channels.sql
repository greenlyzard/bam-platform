CREATE TABLE IF NOT EXISTS public.contact_channels (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id            UUID NOT NULL,
  channel_type          TEXT NOT NULL CHECK (channel_type IN ('email','sms','phone')),
  value                 TEXT NOT NULL,
  is_primary            BOOLEAN NOT NULL DEFAULT false,
  email_opt_in          BOOLEAN,
  email_opted_in_at     TIMESTAMPTZ,
  email_opted_out_at    TIMESTAMPTZ,
  email_opt_source      TEXT,
  sms_opt_in            BOOLEAN,
  sms_opted_in_at       TIMESTAMPTZ,
  sms_opted_out_at      TIMESTAMPTZ,
  sms_opt_source        TEXT,
  klaviyo_subscriber_id TEXT,
  klaviyo_synced_at     TIMESTAMPTZ,
  quo_contact_id        TEXT,
  quo_synced_at         TIMESTAMPTZ,
  source                TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('registration','import','manual','self_service','quo_sync')),
  is_verified           BOOLEAN NOT NULL DEFAULT false,
  verified_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_channels_one_primary ON public.contact_channels(profile_id, channel_type) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_contact_channels_value   ON public.contact_channels(value);
CREATE INDEX IF NOT EXISTS idx_contact_channels_profile ON public.contact_channels(profile_id);
CREATE INDEX IF NOT EXISTS idx_contact_channels_tenant  ON public.contact_channels(tenant_id);
ALTER TABLE public.contact_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage contact channels" ON public.contact_channels;
CREATE POLICY "Admins can manage contact channels" ON public.contact_channels FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Users can manage own contact channels" ON public.contact_channels;
CREATE POLICY "Users can manage own contact channels" ON public.contact_channels FOR ALL USING (auth.uid() = profile_id);

CREATE TABLE IF NOT EXISTS public.quo_call_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id       UUID,
  quo_call_id      TEXT NOT NULL UNIQUE,
  direction        TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_number      TEXT NOT NULL,
  to_number        TEXT NOT NULL,
  status           TEXT,
  duration_seconds INTEGER,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  recording_url    TEXT,
  transcript       TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quo_call_logs_profile ON public.quo_call_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_quo_call_logs_tenant  ON public.quo_call_logs(tenant_id);
ALTER TABLE public.quo_call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage call logs" ON public.quo_call_logs;
CREATE POLICY "Admins can manage call logs" ON public.quo_call_logs FOR ALL USING (is_admin());

-- Recreate sms_threads with full schema (drop + recreate since it may have been created with minimal columns)
DROP TABLE IF EXISTS public.sms_messages CASCADE;
DROP TABLE IF EXISTS public.sms_threads CASCADE;

CREATE TABLE IF NOT EXISTS public.sms_threads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id          UUID,
  contact_channel_id  UUID,
  phone_number        TEXT NOT NULL,
  last_message_at     TIMESTAMPTZ,
  last_message_body   TEXT,
  unread_count        INTEGER NOT NULL DEFAULT 0,
  is_matched          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_threads_profile ON public.sms_threads(profile_id);
CREATE INDEX IF NOT EXISTS idx_sms_threads_tenant  ON public.sms_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_threads_phone   ON public.sms_threads(phone_number);
ALTER TABLE public.sms_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage sms threads" ON public.sms_threads;
CREATE POLICY "Admins can manage sms threads" ON public.sms_threads FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id      UUID NOT NULL REFERENCES public.sms_threads(id) ON DELETE CASCADE,
  quo_message_id TEXT UNIQUE,
  direction      TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  body           TEXT NOT NULL,
  status         TEXT,
  sent_by        UUID,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_messages_thread ON public.sms_messages(thread_id);
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage sms messages" ON public.sms_messages;
CREATE POLICY "Admins can manage sms messages" ON public.sms_messages FOR ALL USING (is_admin());

CREATE TABLE IF NOT EXISTS public.unmatched_sms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_number  TEXT NOT NULL,
  body         TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_by  UUID,
  resolved_at  TIMESTAMPTZ,
  resolution   TEXT CHECK (resolution IN ('matched','ignored','created_profile'))
);
CREATE INDEX IF NOT EXISTS idx_unmatched_sms_tenant ON public.unmatched_sms(tenant_id);
ALTER TABLE public.unmatched_sms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage unmatched sms" ON public.unmatched_sms;
CREATE POLICY "Admins can manage unmatched sms" ON public.unmatched_sms FOR ALL USING (is_admin());

-- Seed existing profile emails into contact_channels
INSERT INTO public.contact_channels (tenant_id, profile_id, channel_type, value, is_primary, email_opt_in, source)
SELECT '84d98f72-c82f-414f-8b17-172b802f6993', id, 'email', email, true, true, 'import'
FROM profiles WHERE email IS NOT NULL AND email != ''
ON CONFLICT DO NOTHING;

-- Seed existing profile phones into contact_channels
INSERT INTO public.contact_channels (tenant_id, profile_id, channel_type, value, is_primary, source)
SELECT '84d98f72-c82f-414f-8b17-172b802f6993', id, 'sms',
  '+1' || regexp_replace(phone, '[^0-9]', '', 'g'), true, 'import'
FROM profiles
WHERE phone IS NOT NULL AND phone != ''
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10
ON CONFLICT DO NOTHING;
