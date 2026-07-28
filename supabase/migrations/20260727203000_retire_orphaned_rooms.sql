-- Retire the three orphaned, location-less room rows by RENAMING them.
--
-- THE ROWS
--   c2401222-2dee-46db-9bd6-ad2d213386ec  "Studio 1"
--   2d20e3ee-adfc-403a-b69b-bc452885590b  "Studio 2"
--   75792345-477e-45b8-8f74-4935a37b9769  "Studio 3"
-- All three: location_id IS NULL, is_active = false, 0 rows in `classes`.
--
-- WHY RENAME AND NOT DELETE
-- Deleting was the first instinct and it is wrong. These rows are referenced by
-- **61 `schedule_instances`** (27 / 20 / 14 respectively) — and `schedule_instances`
-- holds only 87 rows in total, so **70% of that table points at these three rooms.**
-- All 61 are status = 'published' and dated 2026-03-09 → 2026-03-14: the frozen
-- single week left behind when the occurrence generator broke (see docs/_INDEX.md
-- pending reconciliation task 19).
--
-- Every FK into `rooms` is ON DELETE SET NULL:
--     classes.room_id, schedule_instances.room_id, schedule_templates.room_id
-- so a DELETE would NOT error. It would silently strip room_id from all 61
-- published instances, destroying the only remaining evidence of which room that
-- week was scheduled in. A guard on "no class references this room" passes here
-- (0 classes) and would have let exactly that happen.
--
-- WHAT THIS MIGRATION FIXES
-- The name collision only. Today these rows are hidden from the admin schedule
-- solely by the `.eq("is_active", true)` filter in
-- app/(admin)/admin/classes/page.tsx — reactivate any one of them and there are
-- two indistinguishable "Studio 1" rows, one real (San Clemente) and one orphaned.
-- Renaming removes that trap without touching the instance data.
--
-- DEFERRED, NOT RESOLVED
-- The disposition of those 61 instances — delete, repoint to the real San Clemente
-- rooms, or leave — is deliberately NOT decided here. It belongs to task 19
-- alongside the generator rebuild.
--
-- ALSO UNAFFECTED
-- `private_sessions.studio` is free text and carries the literal value 'Studio 1'
-- with no FK to `rooms`. That is a third place the name collides and this migration
-- does not and cannot change it.

DO $$
DECLARE
  target_ids uuid[] := ARRAY[
    'c2401222-2dee-46db-9bd6-ad2d213386ec',
    '2d20e3ee-adfc-403a-b69b-bc452885590b',
    '75792345-477e-45b8-8f74-4935a37b9769'
  ]::uuid[];
  offending_class_count integer;
  renamed_count integer;
BEGIN
  -- Hard stop if any target has acquired a class since this was written. The
  -- rename itself is harmless, but a class on a location-less inactive room means
  -- the situation has changed materially and should be re-investigated first.
  SELECT count(*) INTO offending_class_count
  FROM classes WHERE room_id = ANY(target_ids);

  IF offending_class_count > 0 THEN
    RAISE EXCEPTION
      'Aborting: % class row(s) now reference the orphaned rooms %. Re-investigate before retiring them.',
      offending_class_count, target_ids;
  END IF;

  -- Rename, guarded on all three predicates so this can never touch a real room
  -- even if an id were mistyped: it must be one of the three ids AND have no
  -- location AND be inactive.
  UPDATE rooms
  SET name = name || ' (retired)'
  WHERE id = ANY(target_ids)
    AND location_id IS NULL
    AND is_active = false
    AND name NOT LIKE '% (retired)';   -- idempotent: safe to re-run

  GET DIAGNOSTICS renamed_count = ROW_COUNT;
  RAISE NOTICE 'Retired % orphaned room row(s).', renamed_count;
END $$;

COMMENT ON TABLE rooms IS
  'Bookable rooms, scoped to a studio_location. Rows suffixed "(retired)" have '
  'location_id IS NULL and is_active = false: they are retained ONLY because '
  'schedule_instances still references them (the frozen 2026-03-09→14 week from '
  'the broken occurrence generator). Do not delete them — every FK into this table '
  'is ON DELETE SET NULL, so a delete silently strips room_id rather than erroring. '
  'See docs/_INDEX.md task 19.';
