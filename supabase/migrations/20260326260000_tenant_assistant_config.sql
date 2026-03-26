CREATE TABLE IF NOT EXISTS public.tenant_assistant_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  assistant_name        TEXT NOT NULL DEFAULT 'Angelina',
  assistant_avatar_url  TEXT,
  director_name         TEXT NOT NULL DEFAULT 'Miss Amanda',
  greeting_message      TEXT NOT NULL DEFAULT 'Welcome! I''m here to help you find the perfect class.',
  primary_color         TEXT NOT NULL DEFAULT '#9C8BBF',
  enrollment_enabled    BOOLEAN NOT NULL DEFAULT true,
  trial_enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_assistant_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage assistant config" ON public.tenant_assistant_config;
CREATE POLICY "Admins can manage assistant config" ON public.tenant_assistant_config FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Public can read assistant config" ON public.tenant_assistant_config;
CREATE POLICY "Public can read assistant config" ON public.tenant_assistant_config FOR SELECT USING (true);
INSERT INTO public.tenant_assistant_config (tenant_id, assistant_name, director_name, greeting_message, primary_color, enrollment_enabled, trial_enabled)
VALUES ('84d98f72-c82f-414f-8b17-172b802f6993', 'Angelina', 'Miss Amanda', 'Hi! I''m Angelina, your guide to Ballet Academy and Movement. Are you looking to enroll a dancer or try a free trial class?', '#9C8BBF', true, true)
ON CONFLICT (tenant_id) DO NOTHING;
