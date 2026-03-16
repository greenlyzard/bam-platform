-- ============================================================
-- Fix RLS Recursion and Auth Functions
--
-- Problem: is_admin(), is_teacher(), user_role() all query the
-- profiles table, which has RLS policies that call these same
-- functions — infinite recursion.
--
-- Fix: Rewrite all helper functions to query profile_roles only
-- (which has a simple user_id = auth.uid() policy, no recursion).
-- Then drop/recreate every policy that directly queries profiles.
-- ============================================================


-- ============================================================
-- SECTION 1: Fix Helper Functions
-- ============================================================

-- 1a. is_admin() — profile_roles only, includes all admin-tier roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'super_admin', 'studio_admin', 'finance_admin', 'studio_manager')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1b. is_teacher() — profile_roles only
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role = 'teacher'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1c. is_front_desk() — profile_roles only
CREATE OR REPLACE FUNCTION public.is_front_desk()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role = 'front_desk'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1d. get_user_role() — new canonical name, profile_roles only
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT COALESCE(
    (SELECT pr.role FROM public.profile_roles pr
     WHERE pr.user_id = auth.uid() AND pr.is_active = true AND pr.is_primary = true
     LIMIT 1),
    'parent'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1d (compat). user_role() delegates to get_user_role()
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text AS $$
  SELECT public.get_user_role()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1e. handle_new_user() — NULLIF guards against empty string enum cast failure
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'role', ''),
      'parent'
    )::user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name, profiles.last_name),
    email      = COALESCE(EXCLUDED.email, profiles.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SECTION 2: Drop/Recreate Policies That Directly Query profiles
--
-- Policies that call is_admin()/is_teacher() do NOT need recreation
-- because the function body change propagates automatically.
-- Only policies with inline EXISTS (SELECT 1 FROM profiles ...) need fixing.
-- ============================================================

-- ── profile_roles (from 20260314000002) ─────────────────────
DROP POLICY IF EXISTS "admins_manage_roles" ON profile_roles;
CREATE POLICY "admins_manage_roles" ON profile_roles
  FOR ALL USING (public.is_admin());

-- ── permissions (from 20260314000002) ───────────────────────
DROP POLICY IF EXISTS "super_admin_manage_permissions" ON permissions;
CREATE POLICY "super_admin_manage_permissions" ON permissions
  FOR ALL USING (public.is_admin());

-- ── role_permissions (from 20260314000002 + 20260314000003) ─
DROP POLICY IF EXISTS "super_admin_manage_role_perms" ON role_permissions;
DROP POLICY IF EXISTS "admins_manage_role_perms" ON role_permissions;
CREATE POLICY "admins_manage_role_perms" ON role_permissions
  FOR ALL USING (public.is_admin());

-- ── roles (from 20260314000003) ─────────────────────────────
DROP POLICY IF EXISTS "admins_manage_roles_table" ON roles;
CREATE POLICY "admins_manage_roles_table" ON roles
  FOR ALL USING (public.is_admin());

-- ── teacher_profiles (from 20260312000001) ──────────────────
DROP POLICY IF EXISTS "admins_teacher_profiles" ON teacher_profiles;
CREATE POLICY "admins_teacher_profiles" ON teacher_profiles
  FOR ALL USING (public.is_admin());

-- ── rate_definitions (from 20260312000001) ──────────────────
DROP POLICY IF EXISTS "admins_rate_definitions" ON rate_definitions;
CREATE POLICY "admins_rate_definitions" ON rate_definitions
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "teachers_rate_definitions_read" ON rate_definitions;
CREATE POLICY "teachers_rate_definitions_read" ON rate_definitions
  FOR SELECT USING (public.is_teacher());

-- ── global_rates (from 20260312000001) ──────────────────────
DROP POLICY IF EXISTS "admins_global_rates" ON global_rates;
CREATE POLICY "admins_global_rates" ON global_rates
  FOR ALL USING (public.is_admin());

-- ── teacher_rates (from 20260312000001) ─────────────────────
DROP POLICY IF EXISTS "admins_teacher_rates" ON teacher_rates;
CREATE POLICY "admins_teacher_rates" ON teacher_rates
  FOR ALL USING (public.is_admin());

-- ── school_years (from 20260312000001) ──────────────────────
DROP POLICY IF EXISTS "admins_school_years" ON school_years;
CREATE POLICY "admins_school_years" ON school_years
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "teachers_school_years_read" ON school_years;
CREATE POLICY "teachers_school_years_read" ON school_years
  FOR SELECT USING (public.is_teacher());

-- ── competition_events (from 20260312000001) ────────────────
DROP POLICY IF EXISTS "admins_competition_events" ON competition_events;
CREATE POLICY "admins_competition_events" ON competition_events
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "teachers_competitions_read" ON competition_events;
CREATE POLICY "teachers_competitions_read" ON competition_events
  FOR SELECT USING (public.is_teacher());

-- ── pay_periods (from 20260312000001) ───────────────────────
DROP POLICY IF EXISTS "admins_pay_periods" ON pay_periods;
CREATE POLICY "admins_pay_periods" ON pay_periods
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "teachers_pay_periods_read" ON pay_periods;
CREATE POLICY "teachers_pay_periods_read" ON pay_periods
  FOR SELECT USING (public.is_teacher());

-- ── timesheets (from 20260312000001) ────────────────────────
DROP POLICY IF EXISTS "admins_timesheets" ON timesheets;
CREATE POLICY "admins_timesheets" ON timesheets
  FOR ALL USING (public.is_admin());

-- ── timesheet_entries (from 20260312000001) ─────────────────
DROP POLICY IF EXISTS "admins_timesheet_entries" ON timesheet_entries;
CREATE POLICY "admins_timesheet_entries" ON timesheet_entries
  FOR ALL USING (public.is_admin());

-- ── private_billing_records (from 20260312000001) ───────────
DROP POLICY IF EXISTS "admins_private_billing_records" ON private_billing_records;
CREATE POLICY "admins_private_billing_records" ON private_billing_records
  FOR ALL USING (public.is_admin());

-- ── private_billing_splits (from 20260312000001) ────────────
DROP POLICY IF EXISTS "admins_private_billing_splits" ON private_billing_splits;
CREATE POLICY "admins_private_billing_splits" ON private_billing_splits
  FOR ALL USING (public.is_admin());

-- ── absence_records (from 20260312000001) ───────────────────
DROP POLICY IF EXISTS "admins_absence_records" ON absence_records;
CREATE POLICY "admins_absence_records" ON absence_records
  FOR ALL USING (public.is_admin());

-- ── substitute_assignments (from 20260312000001) ────────────
DROP POLICY IF EXISTS "admins_substitute_assignments" ON substitute_assignments;
CREATE POLICY "admins_substitute_assignments" ON substitute_assignments
  FOR ALL USING (public.is_admin());

-- ── makeup_credits (from 20260312000001) ────────────────────
DROP POLICY IF EXISTS "admins_makeup_credits" ON makeup_credits;
CREATE POLICY "admins_makeup_credits" ON makeup_credits
  FOR ALL USING (public.is_admin());

-- ── angelina_conversations (from 20260311000017) ────────────
DROP POLICY IF EXISTS "angelina_conversations_all_admin" ON angelina_conversations;
CREATE POLICY "angelina_conversations_all_admin" ON angelina_conversations
  FOR ALL USING (
    public.is_admin()
    OR public.is_front_desk()
  );

-- ── angelina_feedback (from 20260311000017) ─────────────────
DROP POLICY IF EXISTS "angelina_feedback_select_admin" ON angelina_feedback;
CREATE POLICY "angelina_feedback_select_admin" ON angelina_feedback
  FOR SELECT USING (public.is_admin());

-- ── studio_hours (from 20260311000019) ──────────────────────
DROP POLICY IF EXISTS "admins_studio_hours" ON studio_hours;
CREATE POLICY "admins_studio_hours" ON studio_hours
  FOR ALL USING (public.is_admin());

-- ── resource_recommendations (from 20260311000019) ──────────
DROP POLICY IF EXISTS "admins_resource_recommendations" ON resource_recommendations;
CREATE POLICY "admins_resource_recommendations" ON resource_recommendations
  FOR ALL USING (public.is_admin());

-- ── room_rentals (from 20260311000019) ──────────────────────
DROP POLICY IF EXISTS "admins_room_rentals" ON room_rentals;
CREATE POLICY "admins_room_rentals" ON room_rentals
  FOR ALL USING (public.is_admin());

-- ── knowledge_articles (from 20260312000009) ────────────────
DROP POLICY IF EXISTS "Admin full access to knowledge_articles" ON knowledge_articles;
CREATE POLICY "admins_knowledge_articles" ON knowledge_articles
  FOR ALL USING (public.is_admin());

-- ── feature_flags (from 20260313000003) ─────────────────────
DROP POLICY IF EXISTS "Super admin can manage feature_flags" ON feature_flags;
CREATE POLICY "admins_manage_feature_flags" ON feature_flags
  FOR ALL USING (public.is_admin());

-- ── platform_modules (from 20260313000005) ──────────────────
DROP POLICY IF EXISTS "Super admin can manage modules" ON platform_modules;
CREATE POLICY "admins_manage_platform_modules" ON platform_modules
  FOR ALL USING (public.is_admin());

-- ── rehearsals (from 20260313000004) ────────────────────────
DROP POLICY IF EXISTS "Admin full access to rehearsals" ON rehearsals;
CREATE POLICY "admins_rehearsals" ON rehearsals
  FOR ALL USING (public.is_admin());

-- ── enrollment_carts (from 20260313000007) ──────────────────
DROP POLICY IF EXISTS "admins_carts" ON enrollment_carts;
CREATE POLICY "admins_carts" ON enrollment_carts
  FOR ALL USING (public.is_admin());

-- ── enrollment_cart_items (from 20260313000007) ─────────────
DROP POLICY IF EXISTS "admins_cart_items" ON enrollment_cart_items;
CREATE POLICY "admins_cart_items" ON enrollment_cart_items
  FOR ALL USING (public.is_admin());

-- ── timesheet_entry_changes (from 20260313000012) ───────────
DROP POLICY IF EXISTS "admins_entry_changes" ON timesheet_entry_changes;
CREATE POLICY "admins_entry_changes" ON timesheet_entry_changes
  FOR ALL USING (public.is_admin());


-- ============================================================
-- SECTION 3: Recreate teacher_profiles View
-- ============================================================

CREATE OR REPLACE VIEW public.teacher_profiles AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.phone,
  p.avatar_url,
  t.employment_type,
  t.hire_date,
  true AS is_active
FROM profiles p
JOIN profile_roles pr ON pr.user_id = p.id AND pr.role = 'teacher' AND pr.is_active = true
LEFT JOIN teachers t ON t.id = p.id;

GRANT SELECT ON public.teacher_profiles TO authenticated;


-- ============================================================
-- SECTION 4: Add start_time and end_time to teacher_hours
-- ============================================================
ALTER TABLE teacher_hours ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE teacher_hours ADD COLUMN IF NOT EXISTS end_time time;
