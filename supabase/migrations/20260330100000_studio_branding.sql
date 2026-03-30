ALTER TABLE public.studio_settings
ADD COLUMN IF NOT EXISTS logo_light_url TEXT;

ALTER TABLE public.studio_settings
ADD COLUMN IF NOT EXISTS logo_dark_url TEXT;

ALTER TABLE public.studio_settings
ADD COLUMN IF NOT EXISTS app_icon_url TEXT;
