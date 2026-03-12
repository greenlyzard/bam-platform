# BAM Platform — Data Model & Database Architecture

## Stack
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email + magic link + Google OAuth)
- **Storage:** Supabase Storage (videos, images, documents)
- **Realtime:** Supabase Realtime (live class attendance, stream status)
- **RLS:** Row Level Security on every table — no exceptions

---

## Role System

```sql
-- User roles (stored in profiles.role)
type user_role = 'super_admin' | 'admin' | 'teacher' | 'parent' | 'student'

-- Super admin: Derek / Amanda — full access
-- Admin: studio office manager — most access
-- Teacher: their own classes only
-- Parent: their own children only
-- Student: their own content only
```

---

## Core Tables

### profiles
```sql
create table profiles (
  id uuid references auth.users primary key,
  role user_role not null default 'parent',
  first_name text,
  last_name text,
  email text unique,
  phone text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### students
```sql
create table students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references profiles(id),
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  age_group text, -- computed: 'toddler' | 'primary' | 'intermediate' | 'advanced'
  current_level text, -- 'pre_ballet' | 'level_1' | ... | 'level_6' | 'pointe'
  medical_notes text,
  emergency_contact jsonb,
  photo_consent boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);
```

### classes
```sql
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  style text not null, -- 'ballet' | 'jazz' | 'contemporary' | 'musical_theatre'
  level text not null,
  age_min int,
  age_max int,
  max_students int default 10, -- BAM caps at 10
  teacher_id uuid references profiles(id),
  day_of_week int, -- 0=Sun, 6=Sat
  start_time time,
  end_time time,
  room text,
  is_active boolean default true,
  description text,
  created_at timestamptz default now()
);
```

### enrollments
```sql
create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  class_id uuid references classes(id),
  status text default 'active', -- 'active' | 'waitlist' | 'dropped' | 'trial'
  enrolled_at timestamptz default now(),
  dropped_at timestamptz,
  trial_class_date date,
  unique(student_id, class_id)
);
```

### attendance
```sql
create table attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id),
  student_id uuid references students(id),
  class_date date not null,
  status text default 'present', -- 'present' | 'absent' | 'excused' | 'late'
  teacher_notes text,
  recorded_by uuid references profiles(id),
  created_at timestamptz default now()
);
```

### teachers (extends profiles)
```sql
create table teachers (
  id uuid references profiles(id) primary key,
  bio text,
  specialties text[], -- ['ballet', 'pointe', 'contemporary']
  certifications text[],
  hire_date date,
  employment_type text, -- 'full_time' | 'part_time' | 'contract'
  headshot_url text,
  is_mandated_reporter_certified boolean default false,
  mandated_reporter_cert_date date
);
```

---

## LMS Tables

### lms_content
```sql
create table lms_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  content_type text, -- 'video' | 'exercise' | 'quiz' | 'announcement'
  video_url text, -- Supabase Storage or external (Mux/Cloudflare Stream)
  thumbnail_url text,
  duration_seconds int,
  target_level text, -- matches classes.level
  target_age_min int,
  target_age_max int,
  uploaded_by uuid references profiles(id),
  is_published boolean default false,
  tags text[],
  created_at timestamptz default now()
);
```

### student_content_progress
```sql
create table student_content_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  content_id uuid references lms_content(id),
  watched_seconds int default 0,
  completed boolean default false,
  completed_at timestamptz,
  liked boolean,
  created_at timestamptz default now(),
  unique(student_id, content_id)
);
```

### badges
```sql
create table badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon_url text,
  category text, -- 'skill' | 'performance' | 'attendance' | 'milestone'
  criteria jsonb, -- flexible: { type: 'level_complete', level: 'level_2' }
  created_at timestamptz default now()
);
```

### student_badges
```sql
create table student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  badge_id uuid references badges(id),
  awarded_by uuid references profiles(id),
  awarded_at timestamptz default now(),
  notes text,
  unique(student_id, badge_id)
);
```

### skill_assessments
```sql
create table skill_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  teacher_id uuid references profiles(id),
  skill_area text, -- 'posture' | 'turnout' | 'musicality' | 'arabesque' | ...
  score int check (score between 1 and 5),
  notes text,
  assessed_at timestamptz default now()
);
```

---

## Live Streaming Tables

### live_sessions
```sql
create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id),
  teacher_id uuid references profiles(id),
  title text not null,
  session_type text, -- 'class_stream' | 'performance' | 'workshop'
  status text default 'scheduled', -- 'scheduled' | 'live' | 'ended' | 'cancelled'
  stream_key text, -- from streaming provider (Mux/Cloudflare)
  playback_url text,
  is_paid boolean default false,
  ticket_price_cents int,
  scheduled_start timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  max_viewers int,
  recording_url text, -- available after stream ends
  created_at timestamptz default now()
);
```

### stream_access
```sql
create table stream_access (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references live_sessions(id),
  user_id uuid references profiles(id),
  access_type text, -- 'enrolled' | 'purchased' | 'complimentary'
  purchased_at timestamptz,
  amount_paid_cents int,
  unique(session_id, user_id)
);
```

---

## Studio Shop Tables

### shop_configs
```sql
create table shop_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- e.g., "Sugar Plum Shop"
  logo_url text,
  primary_color text,
  secondary_color text,
  is_active boolean default false,
  event_name text, -- e.g., "The Nutcracker 2025"
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz default now()
);
```

### products
```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  shop_config_id uuid references shop_configs(id),
  name text not null,
  description text,
  price_cents int not null,
  image_url text,
  category text, -- 'merchandise' | 'concession' | 'flower' | 'apparel'
  inventory int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### shop_orders
```sql
create table shop_orders (
  id uuid primary key default gen_random_uuid(),
  shop_config_id uuid references shop_configs(id),
  customer_name text,
  customer_email text,
  items jsonb not null, -- [{product_id, quantity, price_cents}]
  subtotal_cents int,
  tax_cents int,
  total_cents int,
  payment_method text, -- 'card' | 'cash' | 'zelle' | 'venmo'
  payment_status text default 'pending',
  created_at timestamptz default now()
);
```

---

## Expansion / Competitive Intelligence Tables

### competitor_studios
```sql
create table competitor_studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  website text,
  phone text,
  programs text[],
  notes text,
  last_researched_at timestamptz,
  created_at timestamptz default now()
);
```

### expansion_markets
```sql
create table expansion_markets (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text default 'CA',
  population int,
  median_household_income int,
  competitor_count int,
  readiness_score int, -- 1-100
  notes text,
  status text default 'research', -- 'research' | 'evaluating' | 'ready' | 'opened'
  created_at timestamptz default now()
);
```

---

## RLS Policies (Critical — apply to every table)

```sql
-- Pattern for parent access to their children's data:
create policy "parents_own_students" on students
  for all using (parent_id = auth.uid());

-- Pattern for teacher access to their classes:
create policy "teachers_own_classes" on classes
  for all using (teacher_id = auth.uid());

-- Pattern for admin full access:
create policy "admins_full_access" on students
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- NEVER expose service_role key to client
-- ALWAYS use anon key on frontend
-- Service role only for server-side API routes
```

---

## Key Relationships Summary

```
profiles (auth)
  ├── students (parent_id)
  │   ├── enrollments → classes
  │   ├── attendance
  │   ├── student_content_progress → lms_content
  │   ├── student_badges → badges
  │   └── skill_assessments
  ├── teachers
  │   ├── classes
  │   └── live_sessions
  └── stream_access → live_sessions
```

---

## Migrations Convention

- All migrations in `/supabase/migrations/`
- Name format: `YYYYMMDDHHMMSS_description.sql`
- Never edit existing migrations — add new ones
- Seed data in `/supabase/seed.sql`
- Run locally with `supabase db reset`
