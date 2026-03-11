-- ============================================================
-- BAM Platform — Teachers Table
-- Extends profiles with teacher-specific fields
-- ============================================================

create table teachers (
  id uuid references profiles(id) on delete cascade primary key,
  bio text,
  specialties text[] default '{}',
  certifications text[] default '{}',
  hire_date date,
  employment_type text check (employment_type in ('full_time', 'part_time', 'contract')),
  headshot_url text,

  -- Pay rates (cents per hour)
  class_rate_cents int check (class_rate_cents >= 0),
  private_rate_cents int check (private_rate_cents >= 0),
  rehearsal_rate_cents int check (rehearsal_rate_cents >= 0),
  admin_rate_cents int check (admin_rate_cents >= 0),

  -- Mandated reporter compliance
  is_mandated_reporter_certified boolean default false,
  mandated_reporter_cert_date date,
  mandated_reporter_cert_expires_at date,
  background_check_complete boolean default false,
  background_check_expires_at date,
  w9_on_file boolean default false,
  can_be_scheduled boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_teachers_schedulable on teachers(can_be_scheduled);
