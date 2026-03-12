-- Add app_icon_url column to studio_settings for white-label app icons
alter table public.studio_settings
  add column if not exists app_icon_url text;
