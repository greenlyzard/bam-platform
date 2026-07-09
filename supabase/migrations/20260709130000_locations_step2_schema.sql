-- Locations & Facilities — Step 2: schema migration (spec §3, §4, §8)
-- Scope: schema only. No app/UI behavior, no resolver, no staff editor, no partner/internal
-- seed rows (those are created via the admin Studio Profile CRUD — see task notes).
-- Apply with: supabase db push (Regular Terminal). Do NOT apply via MCP.
--
-- Adds:
--   1. studio_locations.location_type  (enum studio | partner_venue | internal, default 'studio', NOT NULL)
--   2. schedule_instances.location_id  (uuid -> studio_locations.id, ON DELETE SET NULL, PostgREST-embeddable)
--      schedule_instances.venue_name / venue_address (text, nullable) for genuine one-off venues
--
-- Guards: enum + columns + FK are created only if absent (idempotent-safe); the backfill
-- RAISEs if any studio_locations row would remain NULL location_type.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. studio_locations.location_type
-- ─────────────────────────────────────────────────────────────────────────────

-- Enum type (CREATE TYPE has no IF NOT EXISTS — guard explicitly).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'location_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.location_type AS ENUM ('studio', 'partner_venue', 'internal');
  END IF;
END $$;

-- Add the column nullable first so existing rows can be backfilled before NOT NULL.
ALTER TABLE public.studio_locations
  ADD COLUMN IF NOT EXISTS location_type public.location_type;

-- Backfill existing rows to 'studio' (San Clemente + RSM are both studios).
UPDATE public.studio_locations
  SET location_type = 'studio'
  WHERE location_type IS NULL;

-- Guard: no row may remain NULL before we enforce NOT NULL.
DO $$
DECLARE
  null_count int;
BEGIN
  SELECT count(*) INTO null_count
  FROM public.studio_locations
  WHERE location_type IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION
      '% studio_locations row(s) still have NULL location_type after backfill; aborting before SET NOT NULL.',
      null_count;
  END IF;
END $$;

-- Default for future inserts + enforce NOT NULL.
ALTER TABLE public.studio_locations
  ALTER COLUMN location_type SET DEFAULT 'studio'::public.location_type;
ALTER TABLE public.studio_locations
  ALTER COLUMN location_type SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. schedule_instances location override fields
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.schedule_instances
  ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE public.schedule_instances
  ADD COLUMN IF NOT EXISTS venue_name text;
ALTER TABLE public.schedule_instances
  ADD COLUMN IF NOT EXISTS venue_address text;

-- FK -> studio_locations(id), ON DELETE SET NULL (matches the existing room_id FK).
-- Named so PostgREST can embed it (schedule_instances?select=...,studio_locations(*)).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schedule_instances_location_id_fkey'
      AND conrelid = 'public.schedule_instances'::regclass
  ) THEN
    ALTER TABLE public.schedule_instances
      ADD CONSTRAINT schedule_instances_location_id_fkey
      FOREIGN KEY (location_id)
      REFERENCES public.studio_locations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Index the FK column (mirrors room_id; supports resolver lookups/filtering later).
CREATE INDEX IF NOT EXISTS idx_schedule_instances_location_id
  ON public.schedule_instances (location_id);

-- Reload PostgREST so the new column + FK are exposed for embeds immediately.
NOTIFY pgrst, 'reload schema';
