-- Backfill start_date / end_date on the 89 imported Fall 2026/2027 classes.
--
-- The import migration (20260727200000_import_fall_2026_27_classes.sql) omitted
-- both columns, leaving all 89 rows NULL. Every class runs Aug 15 -> Jun 15.
--
-- NO EXCEPTION — and that is deliberate. The Studio Pro export carried
-- "Aug 14" on one row, the Wednesday "Princess Petites-Ballet & Movement".
-- That looked like a one-off start date, but 2025-08-14 is exactly the BULK
-- start date of the 2025/2026 season (55 of its 63 classes share
-- 2025-08-14 -> 2026-06-15), which made a stale carry-over more likely than a
-- genuine variation. Amanda confirmed it is stale: all Fall classes start
-- Saturday 2026-08-15. An earlier draft of this migration carved that row out;
-- the carve-out and its pre-flight guard were removed once confirmed. Do not
-- reintroduce an Aug-14 exception from the export alone.
--
-- WHAT THIS DOES AND DOES NOT FIX
-- It does NOT change the /admin/classes calendar. That view never reads these
-- columns: the server query is `.select("*")` with no date predicate, the
-- `filtered` predicate (class-management.tsx:454) checks search/season/location/
-- teacher/level/discipline/day/type/status, and the calendar cell filter
-- (:1021) tests only `day_of_week === dayOfWeek && room_id === room.id`. A class
-- renders on every week regardless of its dates — which is why last season's 63
-- classes, all of which DO have dates ending 2026-06-15, still appear on today's
-- calendar. Making the calendar honour the date window is a separate change.
--
-- These columns ARE load-bearing elsewhere, which is why the backfill matters:
--   lib/classes/status.ts deriveClassStatus  — start_date > today => 'scheduled',
--                                              end_date < today  => 'ended'
--   lib/classes/status.ts isClassOpenForEnrollment — gates api/enrollment/checkout
--   api/calendar/teacher/[id]/[token]        — end_date becomes the iCal UNTIL=
--   api/enrollment/webhook                   — start_date drives proration
--   admin/settings/studio-calendar           — skips classes with either date null
--
-- SIDE EFFECT, INTENDED: start_date 2026-08-15 is in the future, so all 89
-- classes derive as 'scheduled' rather than 'active' until that date.
--
-- CONVENTION: this matches 2025/2026, where 55 of 63 classes shared one bulk pair
-- (2025-08-14 -> 2026-06-15) and the remaining 8 carried per-class overrides for
-- mid-year additions.
--
-- SCOPE: strictly location_id = San Clemente AND season_id = 2026/2027, and
-- explicitly NOT the pre-existing 'Test Classes' row (which already carries
-- 2026-08-03 -> 2026-09-24 and is being decided separately).

DO $$
DECLARE
  v_location_id uuid := '70acde19-bd54-46c2-a4f4-2200b0adb393';  -- San Clemente
  v_season_id   uuid := 'af220d93-0b39-4816-a2ec-0d09c6dfda7e';  -- 2026/2027
  v_target_count integer;
  v_updated integer;
BEGIN
  -- Pre-flight: the in-scope set must be exactly 89 rows.
  SELECT count(*) INTO v_target_count
  FROM classes
  WHERE location_id = v_location_id
    AND season_id = v_season_id
    AND name <> 'Test Classes';

  IF v_target_count <> 89 THEN
    RAISE EXCEPTION
      'Aborting: expected 89 in-scope Fall 2026/2027 classes, found %. The import may have changed — re-verify before backfilling dates.',
      v_target_count;
  END IF;

  -- Every in-scope class gets Aug 15 -> Jun 15. No per-class overrides.
  UPDATE classes
  SET start_date = DATE '2026-08-15',
      end_date   = DATE '2027-06-15',
      updated_at = now()
  WHERE location_id = v_location_id
    AND season_id = v_season_id
    AND name <> 'Test Classes';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Set 2026-08-15 -> 2027-06-15 on % Fall class(es).', v_updated;
END $$;
