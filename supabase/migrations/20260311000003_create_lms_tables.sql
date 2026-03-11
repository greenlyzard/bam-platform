-- ============================================================
-- BAM Platform — LMS Tables
-- Creates: lms_content, student_content_progress, badges,
--          student_badges, skill_assessments
-- ============================================================

-- ============================================================
-- lms_content — video lessons, exercises, quizzes
-- ============================================================
create table lms_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  content_type text not null
    check (content_type in ('video', 'exercise', 'quiz', 'announcement')),
  video_url text,
  thumbnail_url text,
  duration_seconds int,
  target_level text,
  target_age_min int,
  target_age_max int,
  uploaded_by uuid references profiles(id) on delete set null,
  is_published boolean default false,
  tags text[] default '{}',
  sort_order int default 0,
  view_count int default 0,
  like_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_lms_content_published on lms_content(is_published);
create index idx_lms_content_type on lms_content(content_type);
create index idx_lms_content_level on lms_content(target_level);

-- ============================================================
-- student_content_progress
-- ============================================================
create table student_content_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  content_id uuid not null references lms_content(id) on delete cascade,
  watched_seconds int default 0,
  completed boolean default false,
  completed_at timestamptz,
  liked boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(student_id, content_id)
);

create index idx_scp_student on student_content_progress(student_id);
create index idx_scp_content on student_content_progress(content_id);

-- ============================================================
-- badges — catalog of earnable badges
-- ============================================================
create table badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  icon_url text,
  category text not null
    check (category in ('skill', 'performance', 'attendance', 'milestone', 'leadership', 'competition', 'special')),
  tier text default 'bronze'
    check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  criteria jsonb,
  auto_award boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

create index idx_badges_category on badges(category);
create index idx_badges_active on badges(active);

-- ============================================================
-- student_badges — earned badges
-- ============================================================
create table student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  awarded_by uuid references profiles(id),
  awarded_at timestamptz default now(),
  notes text,
  -- Physical patch tracking
  patch_status text default 'pending'
    check (patch_status in ('pending', 'ordered', 'received', 'distributed', 'not_applicable')),
  patch_ordered_at timestamptz,
  patch_distributed_at timestamptz,
  unique(student_id, badge_id)
);

create index idx_student_badges_student on student_badges(student_id);
create index idx_student_badges_badge on student_badges(badge_id);
create index idx_student_badges_patch on student_badges(patch_status);

-- ============================================================
-- skill_assessments — teacher evaluations
-- ============================================================
create table skill_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  skill_area text not null,
  score int not null check (score between 1 and 5),
  notes text,
  visible_to_parent boolean default false,
  assessed_at timestamptz default now(),
  created_at timestamptz default now()
);

create index idx_assessments_student on skill_assessments(student_id);
create index idx_assessments_teacher on skill_assessments(teacher_id);
create index idx_assessments_skill on skill_assessments(skill_area);
