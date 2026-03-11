-- Studio settings: theme, branding, and configuration
-- Single-row table (one settings record per studio instance)

create table if not exists public.studio_settings (
  id uuid primary key default gen_random_uuid(),

  -- Branding
  studio_name text not null default 'Ballet Academy and Movement',
  logo_url text,
  favicon_url text,

  -- Theme
  theme_preset text not null default 'lavender-cream',
  custom_colors jsonb default '{}',
  heading_font text not null default 'Cormorant Garamond',
  body_font text not null default 'Montserrat',

  -- Metadata
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Enable RLS
alter table public.studio_settings enable row level security;

-- Anyone authenticated can read settings (needed for theme rendering)
create policy "Authenticated users can read studio settings"
  on public.studio_settings for select
  to authenticated
  using (true);

-- Only admins can update
create policy "Admins can update studio settings"
  on public.studio_settings for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

-- Only admins can insert (initial seed)
create policy "Admins can insert studio settings"
  on public.studio_settings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

-- Seed default settings row
insert into public.studio_settings (studio_name, theme_preset, heading_font, body_font)
values ('Ballet Academy and Movement', 'lavender-cream', 'Cormorant Garamond', 'Montserrat');
