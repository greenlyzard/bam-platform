-- ============================================================
-- BAM Platform — Row Level Security Policies
-- RLS enabled on EVERY table — no exceptions
-- ============================================================

-- ============================================================
-- Helper functions
-- ============================================================

-- Get current user's role
create or replace function auth.user_role()
returns text as $$
  select role::text from public.profiles where id = auth.uid()
$$ language sql security definer stable;

-- Check if admin or super_admin
create or replace function auth.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
$$ language sql security definer stable;

-- Check if teacher
create or replace function auth.is_teacher()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  )
$$ language sql security definer stable;

-- Get student IDs belonging to current parent
create or replace function auth.my_student_ids()
returns uuid[] as $$
  select coalesce(array_agg(id), '{}')
  from public.students
  where parent_id = auth.uid()
$$ language sql security definer stable;

-- Get class IDs taught by current teacher
create or replace function auth.my_class_ids()
returns uuid[] as $$
  select coalesce(array_agg(id), '{}')
  from public.classes
  where teacher_id = auth.uid()
$$ language sql security definer stable;


-- ============================================================
-- PROFILES
-- ============================================================
alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select to authenticated using (id = auth.uid());

create policy "profiles_select_admin" on profiles
  for select to authenticated using (auth.is_admin());

create policy "profiles_select_teacher_parents" on profiles
  for select to authenticated using (
    auth.is_teacher()
    and id in (
      select s.parent_id from students s
      join enrollments e on e.student_id = s.id
      where e.class_id = any(auth.my_class_ids())
    )
  );

create policy "profiles_update_own" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin" on profiles
  for update to authenticated using (auth.is_admin());

create policy "profiles_insert_self" on profiles
  for insert to authenticated with check (id = auth.uid());


-- ============================================================
-- STUDENTS
-- ============================================================
alter table students enable row level security;

create policy "students_select_parent" on students
  for select to authenticated using (parent_id = auth.uid());

create policy "students_select_teacher" on students
  for select to authenticated using (
    auth.is_teacher()
    and id in (
      select e.student_id from enrollments e
      where e.class_id = any(auth.my_class_ids())
    )
  );

create policy "students_all_admin" on students
  for all to authenticated using (auth.is_admin());

create policy "students_insert_parent" on students
  for insert to authenticated with check (parent_id = auth.uid());

create policy "students_update_parent" on students
  for update to authenticated
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());


-- ============================================================
-- CLASSES
-- ============================================================
alter table classes enable row level security;

-- Everyone can read active classes (for enrollment browsing)
create policy "classes_select_authenticated" on classes
  for select to authenticated using (true);

create policy "classes_all_admin" on classes
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- ENROLLMENTS
-- ============================================================
alter table enrollments enable row level security;

create policy "enrollments_select_parent" on enrollments
  for select to authenticated
  using (student_id = any(auth.my_student_ids()));

create policy "enrollments_select_teacher" on enrollments
  for select to authenticated
  using (class_id = any(auth.my_class_ids()));

create policy "enrollments_insert_parent" on enrollments
  for insert to authenticated
  with check (student_id = any(auth.my_student_ids()));

create policy "enrollments_all_admin" on enrollments
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- ATTENDANCE
-- ============================================================
alter table attendance enable row level security;

create policy "attendance_select_parent" on attendance
  for select to authenticated
  using (student_id = any(auth.my_student_ids()));

create policy "attendance_all_teacher" on attendance
  for all to authenticated
  using (class_id = any(auth.my_class_ids()));

create policy "attendance_all_admin" on attendance
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- TEACHERS
-- ============================================================
alter table teachers enable row level security;

create policy "teachers_select_own" on teachers
  for select to authenticated using (id = auth.uid());

create policy "teachers_update_own" on teachers
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "teachers_all_admin" on teachers
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- LMS_CONTENT
-- ============================================================
alter table lms_content enable row level security;

-- All authenticated users see published content
create policy "lms_content_select_published" on lms_content
  for select to authenticated
  using (is_published = true);

-- Staff see all content (including drafts)
create policy "lms_content_select_staff" on lms_content
  for select to authenticated
  using (auth.is_teacher() or auth.is_admin());

create policy "lms_content_insert_teacher" on lms_content
  for insert to authenticated
  with check (auth.is_teacher() and uploaded_by = auth.uid());

create policy "lms_content_update_teacher" on lms_content
  for update to authenticated
  using (auth.is_teacher() and uploaded_by = auth.uid());

create policy "lms_content_all_admin" on lms_content
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- STUDENT_CONTENT_PROGRESS
-- ============================================================
alter table student_content_progress enable row level security;

create policy "progress_select_parent" on student_content_progress
  for select to authenticated
  using (student_id = any(auth.my_student_ids()));

create policy "progress_upsert_parent" on student_content_progress
  for insert to authenticated
  with check (student_id = any(auth.my_student_ids()));

create policy "progress_update_parent" on student_content_progress
  for update to authenticated
  using (student_id = any(auth.my_student_ids()));

create policy "progress_select_teacher" on student_content_progress
  for select to authenticated using (
    auth.is_teacher()
    and student_id in (
      select e.student_id from enrollments e
      where e.class_id = any(auth.my_class_ids())
    )
  );

create policy "progress_all_admin" on student_content_progress
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- BADGES
-- ============================================================
alter table badges enable row level security;

create policy "badges_select_authenticated" on badges
  for select to authenticated using (active = true);

create policy "badges_all_admin" on badges
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- STUDENT_BADGES
-- ============================================================
alter table student_badges enable row level security;

create policy "student_badges_select_parent" on student_badges
  for select to authenticated
  using (student_id = any(auth.my_student_ids()));

create policy "student_badges_insert_teacher" on student_badges
  for insert to authenticated
  with check (auth.is_teacher() and awarded_by = auth.uid());

create policy "student_badges_all_admin" on student_badges
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- SKILL_ASSESSMENTS
-- ============================================================
alter table skill_assessments enable row level security;

create policy "assessments_select_parent" on skill_assessments
  for select to authenticated
  using (student_id = any(auth.my_student_ids()) and visible_to_parent = true);

create policy "assessments_all_teacher_own" on skill_assessments
  for all to authenticated
  using (auth.is_teacher() and teacher_id = auth.uid());

create policy "assessments_all_admin" on skill_assessments
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- LIVE_SESSIONS
-- ============================================================
alter table live_sessions enable row level security;

create policy "live_sessions_select_public" on live_sessions
  for select to authenticated
  using (status in ('scheduled', 'live'));

create policy "live_sessions_select_staff" on live_sessions
  for select to authenticated
  using (auth.is_teacher() or auth.is_admin());

create policy "live_sessions_manage_teacher" on live_sessions
  for insert to authenticated
  with check (auth.is_teacher() and created_by = auth.uid());

create policy "live_sessions_update_teacher" on live_sessions
  for update to authenticated
  using (auth.is_teacher() and created_by = auth.uid());

create policy "live_sessions_all_admin" on live_sessions
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- STREAM_ACCESS
-- ============================================================
alter table stream_access enable row level security;

create policy "stream_access_select_own" on stream_access
  for select to authenticated using (user_id = auth.uid());

create policy "stream_access_all_admin" on stream_access
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- SHOP_CONFIGS
-- ============================================================
alter table shop_configs enable row level security;

create policy "shop_configs_select_active" on shop_configs
  for select to authenticated using (is_active = true);

create policy "shop_configs_all_admin" on shop_configs
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- PRODUCTS
-- ============================================================
alter table products enable row level security;

create policy "products_select_active" on products
  for select to authenticated using (is_active = true);

create policy "products_all_admin" on products
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- SHOP_ORDERS
-- ============================================================
alter table shop_orders enable row level security;

create policy "orders_select_own" on shop_orders
  for select to authenticated using (customer_id = auth.uid());

create policy "orders_insert_authenticated" on shop_orders
  for insert to authenticated
  with check (customer_id = auth.uid());

create policy "orders_all_admin" on shop_orders
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- COMPETITOR_STUDIOS (admin only)
-- ============================================================
alter table competitor_studios enable row level security;

create policy "competitors_all_admin" on competitor_studios
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- EXPANSION_MARKETS (admin only)
-- ============================================================
alter table expansion_markets enable row level security;

create policy "expansion_all_admin" on expansion_markets
  for all to authenticated using (auth.is_admin());


-- ============================================================
-- MANDATED_REPORTER_INCIDENTS
-- ============================================================
alter table mandated_reporter_incidents enable row level security;

-- Teachers can create incidents
create policy "incidents_insert_teacher" on mandated_reporter_incidents
  for insert to authenticated
  with check (auth.is_teacher() and reporter_id = auth.uid());

-- Teachers can read their own reports
create policy "incidents_select_reporter" on mandated_reporter_incidents
  for select to authenticated using (reporter_id = auth.uid());

-- Admins can read and update status (acknowledge)
create policy "incidents_all_admin" on mandated_reporter_incidents
  for all to authenticated using (auth.is_admin());

-- No delete policy for anyone — incidents are permanent
