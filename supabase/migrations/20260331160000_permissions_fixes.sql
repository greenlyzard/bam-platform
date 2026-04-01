-- Permissions Fixes — P0 and P1 from docs/PERMISSIONS_AUDIT.md
-- Applied: 2026-03-31

-- ============================================================
-- P0-A: Update is_admin() to include finance_admin, studio_admin, studio_manager
-- Previously only checked admin + super_admin, causing silent RLS failures
-- for users who passed requireAdmin() but were blocked at the database level.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'finance_admin',
                 'studio_admin', 'studio_manager')
    AND is_active = true
  );
$$;

-- ============================================================
-- P0-B: Update my_class_ids() to include class_teachers junction table
-- Previously only checked classes.teacher_id, missing multi-teacher assignments.
-- Affects RLS on: students, enrollments, attendance_records, profiles
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_class_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT ARRAY(
    SELECT DISTINCT c.id
    FROM public.classes c
    LEFT JOIN public.class_teachers ct ON ct.class_id = c.id
    WHERE c.teacher_id = auth.uid()
       OR ct.teacher_id = auth.uid()
  );
$$;

-- ============================================================
-- P1-A: Replace ALL policy on private_sessions with granular policies
-- Teachers should not be able to DELETE their own sessions — admin only.
-- Also adds co_teacher_ids to SELECT policy for co-teacher visibility.
-- ============================================================

DROP POLICY IF EXISTS "Teachers can manage own sessions" ON public.private_sessions;
DROP POLICY IF EXISTS "Admins can manage private sessions" ON public.private_sessions;
DROP POLICY IF EXISTS "Teachers view own sessions" ON public.private_sessions;
DROP POLICY IF EXISTS "Teachers insert own sessions" ON public.private_sessions;
DROP POLICY IF EXISTS "Teachers update own sessions" ON public.private_sessions;
DROP POLICY IF EXISTS "Admins manage private sessions" ON public.private_sessions;

CREATE POLICY "Teachers view own sessions"
ON public.private_sessions FOR SELECT
USING (
  primary_teacher_id = auth.uid()
  OR auth.uid() = ANY(co_teacher_ids)
  OR is_admin()
);

CREATE POLICY "Teachers insert own sessions"
ON public.private_sessions FOR INSERT
WITH CHECK (
  primary_teacher_id = auth.uid() OR is_admin()
);

CREATE POLICY "Teachers update own sessions"
ON public.private_sessions FOR UPDATE
USING (
  primary_teacher_id = auth.uid() OR is_admin()
);

CREATE POLICY "Admins manage private sessions"
ON public.private_sessions FOR DELETE
USING (is_admin());

-- ============================================================
-- P1-B: Allow teachers to view their own staff documents
-- Previously only admins and finance roles could see documents.
-- ============================================================

DROP POLICY IF EXISTS "Teachers view own documents" ON public.staff_documents;

CREATE POLICY "Teachers view own documents"
ON public.staff_documents FOR SELECT
USING (
  profile_id = auth.uid()
);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
