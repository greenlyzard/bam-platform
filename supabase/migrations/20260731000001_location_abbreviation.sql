-- =============================================================================
-- studio_locations.abbreviation — an explicit short label
--
-- THE FAILURE THIS CLOSES: short labels are currently *derived*, by splitting
-- the location name on punctuation. "Ballet Academy and Movement — San Clemente"
-- happens to yield "San Clemente" because someone typed an em dash. That is a
-- coincidence of data entry, not a rule: rename the location, use a hyphen
-- instead of an em dash, or add a location with no separator at all, and the
-- derived label silently becomes wrong or becomes the entire name. This column
-- lets the short form be stated instead of inferred.
--
-- NULLABLE, AND MUST STAY NULLABLE. Null is a legitimate, expected value — it
-- means "this location has no established short form", and the consumer falls
-- back to `name`. Four of the six rows today are in exactly that state. Making
-- this NOT NULL would force someone to invent abbreviations for venues that do
-- not have them, which is the derivation problem again in a new place.
--
-- BACKFILL SCOPE: the two `studio` rows only — 'SC' and 'RSM', both in daily
-- verbal use at the studio. The four partner_venue/internal rows are left null
-- deliberately. No short form for them is in use, and this migration does not
-- invent one.
--
-- NOTHING CONSUMES THIS COLUMN YET. No display or schedule surface is changed
-- here; only the admin location form learns to write it. Wiring readers to it
-- (and retiring the punctuation-splitting) is a separate change.
--
-- PRE-FLIGHT: the two studio rows are verified to exist BY ID before the
-- backfill runs, and the migration raises if either is missing rather than
-- silently updating zero rows and reporting success. `supabase db push` runs
-- each migration in a transaction, so a RAISE here rolls the whole thing back.
-- =============================================================================

ALTER TABLE public.studio_locations
  ADD COLUMN IF NOT EXISTS abbreviation text;

DO $$
DECLARE
  -- Verified live 2026-07-31. Pinned by id, not by name: matching on name is
  -- what this column exists to stop relying on, and a rename between authoring
  -- and running this migration must not turn the backfill into a no-op.
  sc_id  uuid := '70acde19-bd54-46c2-a4f4-2200b0adb393';  -- BAM — San Clemente
  rsm_id uuid := '4550db75-6bdc-40b9-ab21-a59be26f792a';  -- BAM — Rancho Santa Margarita
  missing text;
BEGIN
  -- --------------------------------------------------------------------------
  -- Pre-flight: both backfill targets must exist.
  -- --------------------------------------------------------------------------
  SELECT string_agg(t.label || ' (' || t.id || ')', E'\n  ' ORDER BY t.label)
    INTO missing
    FROM (VALUES
            ('Ballet Academy and Movement — San Clemente',          sc_id),
            ('Ballet Academy and Movement — Rancho Santa Margarita', rsm_id)
         ) AS t(label, id)
   WHERE NOT EXISTS (
           SELECT 1 FROM public.studio_locations sl WHERE sl.id = t.id
         );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION E'Expected studio_locations row(s) not found by id. Refusing to backfill.\n\nMissing:\n  %\n\nNothing has been changed. The ids in this migration were verified live 2026-07-31; if a row was deleted or replaced, look up the current id and update this migration before re-running.',
      missing
      USING ERRCODE = 'no_data_found';
  END IF;

  RAISE NOTICE 'studio_locations pre-flight passed: both studio rows found by id.';

  -- --------------------------------------------------------------------------
  -- Constraint: shape the value when one is present. Says nothing about null.
  -- --------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.studio_locations'::regclass
       AND conname  = 'studio_locations_abbreviation_shape'
  ) THEN
    RAISE NOTICE 'Constraint studio_locations_abbreviation_shape already exists — skipping.';
  ELSE
    ALTER TABLE public.studio_locations
      ADD CONSTRAINT studio_locations_abbreviation_shape
      CHECK (
        abbreviation IS NULL
        OR (
          char_length(abbreviation) BETWEEN 1 AND 12
          AND btrim(abbreviation) <> ''
        )
      );
    RAISE NOTICE 'Constraint studio_locations_abbreviation_shape added.';
  END IF;

  -- --------------------------------------------------------------------------
  -- Backfill: the two studio rows, and only where still unset. Re-running this
  -- migration must not clobber an abbreviation an admin has since edited.
  -- --------------------------------------------------------------------------
  UPDATE public.studio_locations
     SET abbreviation = 'SC', updated_at = now()
   WHERE id = sc_id AND abbreviation IS NULL;

  UPDATE public.studio_locations
     SET abbreviation = 'RSM', updated_at = now()
   WHERE id = rsm_id AND abbreviation IS NULL;
END $$;

COMMENT ON COLUMN public.studio_locations.abbreviation IS
  'Optional short label for this location (e.g. ''SC'', ''RSM''), 1-12 chars when '
  'present. NULL IS A LEGITIMATE VALUE, not missing data: it means the location '
  'has no established short form, and every consumer must fall back to `name`. '
  'Never make this NOT NULL and never backfill it by deriving from `name` — '
  'replacing name-splitting is the reason this column exists.';

NOTIFY pgrst, 'reload schema';
