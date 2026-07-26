-- ============================================================
-- Backfill the one orphaned staff pay record
--
-- `teacher_profiles` is `profiles p JOIN teachers t ON t.id = p.id`, so a
-- profile holding the 'teacher' role but no `teachers` row is invisible to
-- timesheets, payroll, and the rate editor — and cannot log hours at all
-- (getTeacherContext returns null, surfacing as "Teacher profile not found").
--
-- Audited 2026-07-26: exactly one such profile exists —
--   Derek Shaw <derek@greenlyzard.com>  e2d4355c-f1ba-4f22-acc5-bae094c2bcc2
--   roles: super_admin, teacher (both active)
--
-- Every other profile holding the 'teacher' role already has a row; all 16
-- came from the two seeders, since no account has yet been created through
-- the admin UI (which until now never wrote this table).
--
-- employment_type = 'owner': he is not paid wages by the studio. Classifying
-- as 'owner' maps to PayrollClass 'owner_draw', which keeps him out of the
-- W-2 and 1099 wage totals and the combined payroll total — the accurate
-- treatment. See lib/timesheets/employment.ts.
--
-- can_be_scheduled = false: he does not teach scheduled classes.
--
-- Requires 20260726130000 (which added 'owner' to the CHECK constraint).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = 'e2d4355c-f1ba-4f22-acc5-bae094c2bcc2'
  ) THEN
    RAISE EXCEPTION
      'Cannot backfill teachers row: profile e2d4355c-f1ba-4f22-acc5-bae094c2bcc2 does not exist. Re-run the orphan audit before applying this migration.';
  END IF;
END $$;

INSERT INTO public.teachers (id, employment_type, can_be_scheduled, is_active)
VALUES ('e2d4355c-f1ba-4f22-acc5-bae094c2bcc2', 'owner', false, true)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
