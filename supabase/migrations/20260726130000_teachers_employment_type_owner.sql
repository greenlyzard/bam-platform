-- ============================================================
-- Widen teachers.employment_type CHECK to allow 'owner'
--
-- The studio owner logs timesheets like any other teacher — her hours
-- reconcile against private billing whether or not a draw is taken — but
-- payments to her are an owner's draw (equity distribution), not wages.
-- She must therefore be classifiable separately from W-2 and 1099 so her
-- hours never flow into wage expense. See lib/timesheets/employment.ts
-- ('owner' -> PayrollClass 'owner_draw').
--
-- WIDEN ONLY. Every pre-existing value is carried forward unchanged:
--   full_time, part_time, contract, employee, contractor_1099,
--   pending_classification
-- Nothing is renamed, narrowed, or remapped, so no existing row can be
-- invalidated by this migration.
--
-- Constraint name verified 2026-07-26 against pg_constraint (not assumed
-- from the <table>_<column>_check convention):
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE contype='c' AND pg_get_constraintdef(oid) ILIKE '%employment_type%';
--   -> teachers_employment_type_check  (single match, on public.teachers)
--
-- This migration deliberately does NOT assign 'owner' to any teacher.
-- Amanda's classification is set separately once confirmed with her.
-- ============================================================

ALTER TABLE public.teachers
  DROP CONSTRAINT IF EXISTS teachers_employment_type_check;

ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_employment_type_check
  CHECK (employment_type IN (
    'full_time',
    'part_time',
    'contract',
    'employee',
    'contractor_1099',
    'pending_classification',
    'owner'
  ));

NOTIFY pgrst, 'reload schema';
