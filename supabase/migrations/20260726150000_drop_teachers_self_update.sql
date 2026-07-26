-- ============================================================
-- Remove teacher self-update on the teachers table
--
-- `teachers_update_own` was:
--   FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid())
--
-- with NO column restriction — so any teacher could set their own
-- class_rate_cents / private_rate_cents / rehearsal_rate_cents /
-- admin_rate_cents and their own employment_type. Self-set compensation.
--
-- Postgres RLS cannot restrict an UPDATE policy to a subset of columns:
-- policies evaluate row predicates, not column lists. Column-level GRANTs
-- exist but are granted to a database role, and Supabase runs every end user
-- as the single `authenticated` role — so a column GRANT would apply equally
-- to admins and teachers and could not distinguish them. A BEFORE UPDATE
-- trigger could enforce it, but would also fire for service-role writes and
-- would need an escape hatch that quietly re-opens the hole.
--
-- So the policy is dropped rather than narrowed, per explicit instruction.
--
-- WHAT THIS BREAKS, and how it is handled:
--   app/api/teacher/substitute-alerts/[id]/respond/route.ts incremented
--   teachers.substitute_session_count (and applied the 1099 threshold
--   reclassification) using the teacher's own client, relying on this policy.
--   That write is server-computed, never user-supplied, and has been switched
--   to the service-role admin client in the same change. It remains scoped to
--   the authenticated user's own row.
--
-- Nothing else writes `teachers` as a non-admin. Verified by sweeping every
-- `.from("teachers")` write site: staff-actions (service role), the staff
-- profile actions (admin/finance guarded), PUT /api/teachers/[id]
-- (requireAdmin), and settings/pay-rates (role checked).
--
-- Teachers RETAIN read access to their own row via `teachers_select_own`,
-- so /teach/hours and the teacher portal are unaffected.
-- ============================================================

DROP POLICY IF EXISTS "teachers_update_own" ON public.teachers;

NOTIFY pgrst, 'reload schema';
