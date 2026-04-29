-- Convert seasons.is_public from GENERATED ALWAYS to a regular boolean column
-- Per app behavior: the form has an "Is Public" checkbox, so the user controls
-- visibility manually. The generated rule was leftover from an earlier design.
--
-- Pre-flight verified 2026-04-29: only one season exists (2025/2026) and its
-- current is_public value is computed from program='regular' → true. After
-- the migration the value is preserved literally.

-- Capture current values before dropping the generation expression
CREATE TEMP TABLE _seasons_is_public_snapshot AS
SELECT id, is_public FROM seasons;

-- Drop the column with its GENERATED ALWAYS expression, recreate as regular column
ALTER TABLE seasons DROP COLUMN is_public;
ALTER TABLE seasons ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Restore the previously-computed values
UPDATE seasons s
SET is_public = COALESCE(snap.is_public, false)
FROM _seasons_is_public_snapshot snap
WHERE s.id = snap.id;

DROP TABLE _seasons_is_public_snapshot;

NOTIFY pgrst, 'reload schema';
