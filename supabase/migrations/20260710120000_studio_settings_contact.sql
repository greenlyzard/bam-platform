-- Enrollment Widget Cleanup — studio_settings contact fields
-- Adds tenant-wide contact info shown on the public /enroll footer.
-- Apply with: supabase db push (Regular Terminal). Do NOT apply via MCP.
-- Idempotent: ADD COLUMN IF NOT EXISTS is the skip-if-exists guard; backfill only
-- fills NULLs so re-runs never clobber admin-edited values.

ALTER TABLE public.studio_settings ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.studio_settings ADD COLUMN IF NOT EXISTS email text;

-- Backfill BAM's contact info (only where unset).
UPDATE public.studio_settings SET phone = '(949) 229-0846' WHERE phone IS NULL;
UPDATE public.studio_settings SET email = 'dance@bamsocal.com' WHERE email IS NULL;

-- Expose the new columns to PostgREST immediately.
NOTIFY pgrst, 'reload schema';
