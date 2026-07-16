-- Add the phantom columns behind two features the code already WRITES and READS but which were
-- never created (→ 42703 at runtime, e.g. getFamilyEnrollments / getClassEnrollments on
-- /admin/families/[id]). Column set + types/defaults/nullability derived by reading every write
-- site:
--   * enrollments override → app/(admin)/admin/families/actions.ts (insert) + enroll-modal.tsx + zod
--   * classes name variants → lib/schedule/actions.ts::upsertClass + class-form.tsx (~30 read sites)
--
-- Guarded / re-runnable: ADD COLUMN IF NOT EXISTS throughout. All amounts are INTEGER CENTS
-- (confirmed + commented). No forward FKs (override_by is a bare audit uuid, matching created_by).

-- 1. Per-enrollment billing override. The admin enroll action sets all of these; other enroll
--    paths (webhook, imports) don't, so everything except the boolean is nullable.
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS billing_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_amount  integer,   -- INTEGER CENTS: overridden fee for this enrollment
  ADD COLUMN IF NOT EXISTS override_reason  text,
  ADD COLUMN IF NOT EXISTS override_by      uuid,      -- admin who set the override (audit; no FK)
  ADD COLUMN IF NOT EXISTS proration_method text,      -- per_class|daily|split|custom|none (app-validated)
  ADD COLUMN IF NOT EXISTS prorated_amount  integer;   -- INTEGER CENTS: prorated first-period charge

COMMENT ON COLUMN public.enrollments.override_amount IS 'Overridden fee for this enrollment, in integer cents.';
COMMENT ON COLUMN public.enrollments.prorated_amount IS 'Prorated first-period charge, in integer cents.';

-- 2. Class display-name variants (upsertClass writes simple_name/full_name/short_name/display_name;
--    ~30 read sites render `simple_name || name`). All nullable text display fields.
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS simple_name  text,
  ADD COLUMN IF NOT EXISTS full_name    text,
  ADD COLUMN IF NOT EXISTS short_name   text,
  ADD COLUMN IF NOT EXISTS display_name text;

NOTIFY pgrst, 'reload schema';
