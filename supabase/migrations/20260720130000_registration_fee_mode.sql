-- Registration fee cardinality mode (BILLING_APPROVAL_AND_DRAW.md §2).
-- Amanda's rule for BAM: registration is charged PER STUDENT (default). Tenant-configurable for the
-- white-label SaaS: 'per_family' charges it once per family per enrollment event instead.
-- Additive + idempotent; guarded CHECK add per the project migration pattern.

ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS registration_fee_mode text NOT NULL DEFAULT 'per_student';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'studio_settings_registration_fee_mode_check'
  ) THEN
    ALTER TABLE public.studio_settings
      ADD CONSTRAINT studio_settings_registration_fee_mode_check
      CHECK (registration_fee_mode IN ('per_student', 'per_family'));
  END IF;
END $$;

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
