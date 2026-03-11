-- ============================================================
-- BAM Platform — Core Tables Migration
-- Creates: profiles, students, classes, enrollments, attendance
-- ============================================================

-- Custom type for user roles
create type user_role as enum (
  'super_admin', 'admin', 'teacher', 'parent', 'student'
);

-- ============================================================
-- profiles — extends auth.users
-- ============================================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  role user_role not null default 'parent',
  first_name text,
  last_name text,
  email text unique,
  phone text,
  avatar_url text,
  stripe_customer_id text unique,
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_profiles_role on profiles(role);
create index idx_profiles_email on profiles(email);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(
      (new.raw_user_meta_data ->> 'role')::user_role,
      'parent'
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- students — children belonging to parent profiles
-- ============================================================
create table students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  age_group text,
  current_level text,
  medical_notes text,
  emergency_contact jsonb,
  photo_consent boolean default false,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_students_parent on students(parent_id);
create index idx_students_active on students(active);

-- ============================================================
-- classes
-- ============================================================
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  style text not null,
  level text not null,
  age_min int,
  age_max int,
  max_students int default 10 check (max_students > 0),
  teacher_id uuid references profiles(id) on delete set null,
  day_of_week int check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  room text,
  is_active boolean default true,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_classes_teacher on classes(teacher_id);
create index idx_classes_active on classes(is_active);
create index idx_classes_style on classes(style);

-- ============================================================
-- enrollments — student ↔ class
-- ============================================================
create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'waitlist', 'dropped', 'trial', 'completed')),
  enrolled_at timestamptz default now(),
  dropped_at timestamptz,
  trial_class_date date,
  created_at timestamptz default now(),
  unique(student_id, class_id)
);

create index idx_enrollments_student on enrollments(student_id);
create index idx_enrollments_class on enrollments(class_id);
create index idx_enrollments_status on enrollments(status);

-- ============================================================
-- attendance
-- ============================================================
create table attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  class_date date not null,
  status text not null default 'present'
    check (status in ('present', 'absent', 'excused', 'late')),
  teacher_notes text,
  recorded_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(class_id, student_id, class_date)
);

create index idx_attendance_class_date on attendance(class_id, class_date);
create index idx_attendance_student on attendance(student_id);
