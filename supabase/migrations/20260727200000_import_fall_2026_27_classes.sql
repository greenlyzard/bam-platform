-- Fall 2026/2027 San Clemente class import
--
-- Source: Studio Pro export, parsed and then reviewed/corrected by Amanda
--         (BAM_Fall_2026_27_Classes_REVIEW.xlsx, 2026-07-27).
--
-- 89 classes. Naming follows the 2025/2026 convention verified against live data:
--   `name` = <Difficulty> <Discipline>[-<Qualifier>], never the level and never the day.
--   The level lives in `description`, matching the Studio Pro display string.
--
-- Both halves of every competing column pair are written, matching how all 63
-- rows of 2025/2026 are populated — day_of_week/days_of_week,
-- max_students/max_enrollment, room/room_id, season/season_id,
-- discipline/style. An import writing only one half renders inconsistently
-- depending on which surface reads it.
--
-- KNOWN, DELIBERATE: two schedule overlaps are imported as-is, to serve as live
-- test data for conflict detection (which does not exist yet):
--   1. Monday Studio 1 — Beginner Jazz 16:15-17:00 overlaps Beginner Ballet
--      16:30-17:30. Different teachers, same room.
--   2. Thursday Studio 3 — Mini Star Hip Hop 15:30-16:30 overlaps its own
--      rehearsal 16:15-16:30, same teacher (Leila Meghdadi). Present in the
--      Studio Pro source; the class likely ends at 16:15.
--
-- 4 classes have no teacher yet (teacher_id NULL). They will not appear on any
-- "My Classes" surface until assigned.
--
-- SCOPING NOTE: `classes` has NO tenant_id column. Tenant is derivable only via
-- location_id -> studio_locations.tenant_id (nullable, ON DELETE SET NULL), and
-- is asserted for real on class_teachers.tenant_id, which IS NOT NULL. So the
-- tenant lives on the join row, not the class.
--
-- Idempotent: guarded on (location, season, name, day_of_week, start_time, room).
-- Room is part of the key because two classes can legitimately share a name and
-- slot: Wednesday 17:30 has 'Intermediate Ballet' in Studio 3 (Level 2C,
-- Katherine Thomas) AND Studio 1 (Level 4B, Amanda Cobb).
-- Re-running inserts nothing.

DO $preflight$
DECLARE v_count bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = '84d98f72-c82f-414f-8b17-172b802f6993') THEN
    RAISE EXCEPTION 'Pre-flight: BAM tenant not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e') THEN
    RAISE EXCEPTION 'Pre-flight: 2026/2027 season not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.studio_locations WHERE id = '70acde19-bd54-46c2-a4f4-2200b0adb393') THEN
    RAISE EXCEPTION 'Pre-flight: San Clemente location not found';
  END IF;
  SELECT count(*) INTO v_count FROM public.rooms
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name IN ('Studio 1','Studio 2','Studio 3','Pilates Room');
  IF v_count < 4 THEN
    RAISE EXCEPTION 'Pre-flight: expected 4 San Clemente rooms, found %', v_count;
  END IF;
END
$preflight$;


--  1. Monday 15:30-16:15  Mini Star Ballet  [Level 1+]  Studio 3  Moorea Pike
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Mini Star Ballet', 'Level 1+ - Ballet', ARRAY['Level 1+']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '15:30:00', '16:15:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'd7e7f3a7-70bf-401d-8494-be8c478fc041', 12, 12, 12500,
  4, 6, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Mini Star Ballet' AND day_of_week = 1 AND start_time = '15:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'd7e7f3a7-70bf-401d-8494-be8c478fc041', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Mini Star Ballet' AND c.day_of_week = 1 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

--  2. Monday 15:30-16:15  Princess Petites-Ballet & Movement  [Petites]  Studio 1  Paola Gonzalez
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Princess Petites-Ballet & Movement', 'Petites - Ballet', ARRAY['Petites']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '15:30:00', '16:15:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '80181273-4970-4e3b-8d5e-fd579304dc89', 9, 9, 12500,
  3, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Princess Petites-Ballet & Movement' AND day_of_week = 1 AND start_time = '15:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '80181273-4970-4e3b-8d5e-fd579304dc89', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Princess Petites-Ballet & Movement' AND c.day_of_week = 1 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

--  3. Monday 15:30-16:30  Beginner Musical Theater-Rehearsal  [Level 2A]  Studio 2  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Musical Theater-Rehearsal', 'Level 2A - Musical Theater', ARRAY['Level 2A']::text[], 'Musical Theater', 'Musical Theater',
  1, ARRAY[1]::int[], '15:30:00', '16:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 12, 12, 12500,
  6, 8, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Musical Theater-Rehearsal' AND day_of_week = 1 AND start_time = '15:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Musical Theater-Rehearsal' AND c.day_of_week = 1 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

--  4. Monday 16:15-17:00  Beginner Jazz  [Level 2A]  Studio 1  Paola Gonzalez
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Jazz', 'Level 2A - Jazz', ARRAY['Level 2A']::text[], 'Jazz', 'Jazz',
  1, ARRAY[1]::int[], '16:15:00', '17:00:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '80181273-4970-4e3b-8d5e-fd579304dc89', 12, 12, 12500,
  6, 8, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Jazz' AND day_of_week = 1 AND start_time = '16:15:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '80181273-4970-4e3b-8d5e-fd579304dc89', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Jazz' AND c.day_of_week = 1 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

--  5. Monday 16:15-16:30  Mini Star Ballet-Rehearsal  [Level 1+]  Studio 3  Moorea Pike
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Mini Star Ballet-Rehearsal', 'Level 1+ - Ballet', ARRAY['Level 1+']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '16:15:00', '16:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'd7e7f3a7-70bf-401d-8494-be8c478fc041', 12, 12, 12500,
  4, 6, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Mini Star Ballet-Rehearsal' AND day_of_week = 1 AND start_time = '16:15:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'd7e7f3a7-70bf-401d-8494-be8c478fc041', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Mini Star Ballet-Rehearsal' AND c.day_of_week = 1 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

--  6. Monday 16:30-17:30  Intermediate Ballet  [Level 2C]  Studio 3  Moorea Pike
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 2C - Ballet', ARRAY['Level 2C']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '16:30:00', '17:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'd7e7f3a7-70bf-401d-8494-be8c478fc041', 14, 14, 12500,
  6, 9, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 1 AND start_time = '16:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'd7e7f3a7-70bf-401d-8494-be8c478fc041', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 1 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

--  7. Monday 16:30-17:30  Beginner Ballet  [Level 3A]  Studio 1  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Ballet', 'Level 3A - Ballet', ARRAY['Level 3A']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '16:30:00', '17:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 10, 10, 12500,
  9, 14, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Ballet' AND day_of_week = 1 AND start_time = '16:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Ballet' AND c.day_of_week = 1 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

--  8. Monday 17:00-18:30  Intermediate Ballet  [Level 4B]  Studio 2  Cara Matchett
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 4B - Ballet', ARRAY['Level 4B']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '17:00:00', '18:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'e406cbc5-8937-4a53-95e7-059097cd29c2', 15, 15, 15000,
  11, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 1 AND start_time = '17:00:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'e406cbc5-8937-4a53-95e7-059097cd29c2', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 1 AND c.start_time = '17:00:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

--  9. Monday 17:30-18:30  Intermediate Jazz  [Level 2C]  Studio 3  Paola Gonzalez
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Jazz', 'Level 2C - Jazz', ARRAY['Level 2C']::text[], 'Jazz', 'Jazz',
  1, ARRAY[1]::int[], '17:30:00', '18:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '80181273-4970-4e3b-8d5e-fd579304dc89', 14, 14, 12500,
  6, 9, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Jazz' AND day_of_week = 1 AND start_time = '17:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '80181273-4970-4e3b-8d5e-fd579304dc89', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Jazz' AND c.day_of_week = 1 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 10. Monday 17:30-18:00  Intermediate Ballet-Rehearsal  [Teen]  Studio 1  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Rehearsal', 'Teen - Ballet', ARRAY['Teen']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '17:30:00', '18:00:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 15, 15, 12500,
  12, 18, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Rehearsal' AND day_of_week = 1 AND start_time = '17:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Rehearsal' AND c.day_of_week = 1 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 11. Monday 18:00-18:30  Intermediate Ballet-Pre Pointe  [Teen]  Studio 1  Moorea Pike
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Pre Pointe', 'Teen - Ballet', ARRAY['Teen']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '18:00:00', '18:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'd7e7f3a7-70bf-401d-8494-be8c478fc041', 15, 15, 12500,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Pre Pointe' AND day_of_week = 1 AND start_time = '18:00:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'd7e7f3a7-70bf-401d-8494-be8c478fc041', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Pre Pointe' AND c.day_of_week = 1 AND c.start_time = '18:00:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 12. Monday 18:30-20:00  Advanced Ballet  [Level 4C; Level 4D]  Studio 2  Cara Matchett
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Ballet', 'Level 4C/Level 4D - Ballet', ARRAY['Level 4C','Level 4D']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '18:30:00', '20:00:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'e406cbc5-8937-4a53-95e7-059097cd29c2', 15, 15, 15000,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Ballet' AND day_of_week = 1 AND start_time = '18:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'e406cbc5-8937-4a53-95e7-059097cd29c2', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Ballet' AND c.day_of_week = 1 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 13. Monday 18:30-19:30  Intermediate Jazz-Turns & Tricks  [Level 4B]  Studio 1  Paola Gonzalez
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Jazz-Turns & Tricks', 'Level 4B - Jazz', ARRAY['Level 4B']::text[], 'Jazz', 'Jazz',
  1, ARRAY[1]::int[], '18:30:00', '19:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '80181273-4970-4e3b-8d5e-fd579304dc89', 15, 15, 12500,
  11, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Jazz-Turns & Tricks' AND day_of_week = 1 AND start_time = '18:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '80181273-4970-4e3b-8d5e-fd579304dc89', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Jazz-Turns & Tricks' AND c.day_of_week = 1 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 14. Monday 18:30-19:30  Intermediate Ballet  [Teen]  Studio 3  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Teen - Ballet', ARRAY['Teen']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '18:30:00', '19:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 15, 15, 12500,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 1 AND start_time = '18:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 1 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 15. Monday 19:30-20:30  Intermediate Ballet  [Level 4A; Adult/Teen]  Studio 1  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 4A/Adult/Teen - Ballet', ARRAY['Level 4A','Adult/Teen']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '19:30:00', '20:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 15, 15, 12500,
  11, 99, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 1 AND start_time = '19:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 1 AND c.start_time = '19:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 16. Monday 20:00-20:30  Advanced Ballet-Pointe-Rehearsal  [Level 4C]  Studio 2  Cara Matchett
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Ballet-Pointe-Rehearsal', 'Level 4C - Ballet', ARRAY['Level 4C']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '20:00:00', '20:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'e406cbc5-8937-4a53-95e7-059097cd29c2', 15, 15, 12500,
  12, 18, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Ballet-Pointe-Rehearsal' AND day_of_week = 1 AND start_time = '20:00:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'e406cbc5-8937-4a53-95e7-059097cd29c2', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Ballet-Pointe-Rehearsal' AND c.day_of_week = 1 AND c.start_time = '20:00:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 17. Monday 20:30-21:00  Beginner Ballet-Rehearsal  [Level 4A]  Studio 1  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Ballet-Rehearsal', 'Level 4A - Ballet', ARRAY['Level 4A']::text[], 'Ballet', 'Ballet',
  1, ARRAY[1]::int[], '20:30:00', '21:00:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 15, 15, 12500,
  11, 99, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Ballet-Rehearsal' AND day_of_week = 1 AND start_time = '20:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Ballet-Rehearsal' AND c.day_of_week = 1 AND c.start_time = '20:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 18. Tuesday 15:30-16:15  Intermediate Ballet  [Level 2B]  Studio 3  Madelynn Hampton
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 2B - Ballet', ARRAY['Level 2B']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '15:30:00', '16:15:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '04263b03-5128-49e7-b058-857b62162fff', 12, 12, 12500,
  6, 8, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 2 AND start_time = '15:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '04263b03-5128-49e7-b058-857b62162fff', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 2 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 19. Tuesday 15:30-16:15  Beginner Musical Theater  [Level 1]  Studio 2  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Musical Theater', 'Level 1 - Musical Theater', ARRAY['Level 1']::text[], 'Musical Theater', 'Musical Theater',
  2, ARRAY[2]::int[], '15:30:00', '16:15:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 12, 12, 12500,
  4, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Musical Theater' AND day_of_week = 2 AND start_time = '15:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Musical Theater' AND c.day_of_week = 2 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 20. Tuesday 15:30-16:15  Princess Petites-Ballet & Movement  [Petites]  Studio 1  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Princess Petites-Ballet & Movement', 'Petites - Ballet', ARRAY['Petites']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '15:30:00', '16:15:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 9, 9, 12500,
  3, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Princess Petites-Ballet & Movement' AND day_of_week = 2 AND start_time = '15:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Princess Petites-Ballet & Movement' AND c.day_of_week = 2 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 21. Tuesday 16:15-16:45  Intermediate Musical Theater  [Level 2B]  Studio 3  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Musical Theater', 'Level 2B - Musical Theater', ARRAY['Level 2B']::text[], 'Musical Theater', 'Musical Theater',
  2, ARRAY[2]::int[], '16:15:00', '16:45:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 12, 12, 12500,
  6, 8, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Musical Theater' AND day_of_week = 2 AND start_time = '16:15:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Musical Theater' AND c.day_of_week = 2 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 22. Tuesday 16:15-16:45  Beginner Ballet  [Level 1]  Studio 2  Madelynn Hampton
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Ballet', 'Level 1 - Ballet', ARRAY['Level 1']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '16:15:00', '16:45:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '04263b03-5128-49e7-b058-857b62162fff', 12, 12, 12500,
  4, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Ballet' AND day_of_week = 2 AND start_time = '16:15:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '04263b03-5128-49e7-b058-857b62162fff', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Ballet' AND c.day_of_week = 2 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 23. Tuesday 16:15-16:30  Princess Petites-Ballet & Movement-Rehearsal  [Petites]  Studio 1  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Princess Petites-Ballet & Movement-Rehearsal', 'Petites - Ballet', ARRAY['Petites']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '16:15:00', '16:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 9, 9, 12500,
  3, 6, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Princess Petites-Ballet & Movement-Rehearsal' AND day_of_week = 2 AND start_time = '16:15:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Princess Petites-Ballet & Movement-Rehearsal' AND c.day_of_week = 2 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 24. Tuesday 16:30-17:00  Intermediate Jazz  [Level 3B]  Studio 1  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Jazz', 'Level 3B - Jazz', ARRAY['Level 3B']::text[], 'Jazz', 'Jazz',
  2, ARRAY[2]::int[], '16:30:00', '17:00:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 12, 12, 12500,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Jazz' AND day_of_week = 2 AND start_time = '16:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Jazz' AND c.day_of_week = 2 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 25. Tuesday 16:45-17:00  Intermediate Ballet-Rehearsal  [Level 2B]  Studio 3  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Rehearsal', 'Level 2B - Ballet', ARRAY['Level 2B']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '16:45:00', '17:00:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 12, 12, 12500,
  6, 8, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Rehearsal' AND day_of_week = 2 AND start_time = '16:45:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Rehearsal' AND c.day_of_week = 2 AND c.start_time = '16:45:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 26. Tuesday 16:45-17:00  Beginner Ballet-Rehearsal  [Level 1]  Studio 2  Madelynn Hampton
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Ballet-Rehearsal', 'Level 1 - Ballet', ARRAY['Level 1']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '16:45:00', '17:00:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '04263b03-5128-49e7-b058-857b62162fff', 12, 12, 12500,
  4, 6, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Ballet-Rehearsal' AND day_of_week = 2 AND start_time = '16:45:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '04263b03-5128-49e7-b058-857b62162fff', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Ballet-Rehearsal' AND c.day_of_week = 2 AND c.start_time = '16:45:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 27. Tuesday 17:00-17:30  Intermediate Ballet-Rehearsal  [Level 3B]  Studio 1  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Rehearsal', 'Level 3B - Ballet', ARRAY['Level 3B']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '17:00:00', '17:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 12, 12, 12500,
  9, 11, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Rehearsal' AND day_of_week = 2 AND start_time = '17:00:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Rehearsal' AND c.day_of_week = 2 AND c.start_time = '17:00:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 28. Tuesday 17:00-18:30  Advanced Jazz-Conditioning  [Level 4C]  Studio 3  Paola Gonzalez
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Jazz-Conditioning', 'Level 4C - Jazz', ARRAY['Level 4C']::text[], 'Jazz', 'Jazz',
  2, ARRAY[2]::int[], '17:00:00', '18:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '80181273-4970-4e3b-8d5e-fd579304dc89', 15, 15, 15000,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Jazz-Conditioning' AND day_of_week = 2 AND start_time = '17:00:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '80181273-4970-4e3b-8d5e-fd579304dc89', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Jazz-Conditioning' AND c.day_of_week = 2 AND c.start_time = '17:00:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 29. Tuesday 17:00-18:30  Intermediate Ballet  [Level 3C]  Studio 2  Madelynn Hampton
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 3C - Ballet', ARRAY['Level 3C']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '17:00:00', '18:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '04263b03-5128-49e7-b058-857b62162fff', 12, 12, 15000,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 2 AND start_time = '17:00:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '04263b03-5128-49e7-b058-857b62162fff', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 2 AND c.start_time = '17:00:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 30. Tuesday 17:30-18:30  Intermediate Ballet  [Level 3B]  Studio 1  Amanda Cobb
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 3B - Ballet', ARRAY['Level 3B']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '17:30:00', '18:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '6518a096-9b37-435a-8c0c-595063a2dcd9', 12, 12, 12500,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 2 AND start_time = '17:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '6518a096-9b37-435a-8c0c-595063a2dcd9', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 2 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 31. Tuesday 18:30-20:00  Advanced Ballet  [Level 4A; Adult/Teen]  Studio 3  Madelynn Hampton
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Ballet', 'Level 4A/Adult/Teen - Ballet', ARRAY['Level 4A','Adult/Teen']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '18:30:00', '20:00:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '04263b03-5128-49e7-b058-857b62162fff', 15, 15, 15000,
  11, 99, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Ballet' AND day_of_week = 2 AND start_time = '18:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '04263b03-5128-49e7-b058-857b62162fff', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Ballet' AND c.day_of_week = 2 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 32. Tuesday 18:30-19:30  Intermediate Jazz  [Level 3B+; Level 3C]  Studio 2  Paola Gonzalez
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Jazz', 'Level 3B+/Level 3C - Jazz', ARRAY['Level 3B+','Level 3C']::text[], 'Jazz', 'Jazz',
  2, ARRAY[2]::int[], '18:30:00', '19:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '80181273-4970-4e3b-8d5e-fd579304dc89', 12, 12, 12500,
  6, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Jazz' AND day_of_week = 2 AND start_time = '18:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '80181273-4970-4e3b-8d5e-fd579304dc89', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Jazz' AND c.day_of_week = 2 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 33. Tuesday 18:30-20:00  Advanced Ballet-Pointe & Variations  [Level 4C]  Studio 1  Amanda Cobb
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Ballet-Pointe & Variations', 'Level 4C - Ballet', ARRAY['Level 4C']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '18:30:00', '20:00:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '6518a096-9b37-435a-8c0c-595063a2dcd9', 15, 15, 15000,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Ballet-Pointe & Variations' AND day_of_week = 2 AND start_time = '18:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '6518a096-9b37-435a-8c0c-595063a2dcd9', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Ballet-Pointe & Variations' AND c.day_of_week = 2 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 34. Tuesday 20:00-20:30  Beginner Ballet-Rehearsal  [Level 4A; Adult/Teen]  Studio 3  Madelynn Hampton
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Ballet-Rehearsal', 'Level 4A/Adult/Teen - Ballet', ARRAY['Level 4A','Adult/Teen']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '20:00:00', '20:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '04263b03-5128-49e7-b058-857b62162fff', 15, 15, 12500,
  11, 99, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Ballet-Rehearsal' AND day_of_week = 2 AND start_time = '20:00:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '04263b03-5128-49e7-b058-857b62162fff', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Ballet-Rehearsal' AND c.day_of_week = 2 AND c.start_time = '20:00:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 35. Tuesday 20:00-20:30  Advanced Ballet-Principals-Rehearsal  [Level 4C]  Studio 1  Amanda Cobb
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Ballet-Principals-Rehearsal', 'Level 4C - Ballet', ARRAY['Level 4C']::text[], 'Ballet', 'Ballet',
  2, ARRAY[2]::int[], '20:00:00', '20:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '6518a096-9b37-435a-8c0c-595063a2dcd9', 15, 15, 12500,
  12, 18, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Ballet-Principals-Rehearsal' AND day_of_week = 2 AND start_time = '20:00:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '6518a096-9b37-435a-8c0c-595063a2dcd9', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Ballet-Principals-Rehearsal' AND c.day_of_week = 2 AND c.start_time = '20:00:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 36. Wednesday 15:30-16:15  Princess Petites-Ballet & Movement  [Petites]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Princess Petites-Ballet & Movement', 'Petites - Ballet', ARRAY['Petites']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '15:30:00', '16:15:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 9, 9, 12500,
  3, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Princess Petites-Ballet & Movement' AND day_of_week = 3 AND start_time = '15:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Princess Petites-Ballet & Movement' AND c.day_of_week = 3 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 37. Wednesday 15:30-16:15  Mini Star Ballet  [Level 1+]  Studio 1  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Mini Star Ballet', 'Level 1+ - Ballet', ARRAY['Level 1+']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '15:30:00', '16:15:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 12, 12, 12500,
  4, 6, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Mini Star Ballet' AND day_of_week = 3 AND start_time = '15:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Mini Star Ballet' AND c.day_of_week = 3 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 38. Wednesday 15:30-16:15  Pop Star Jazz-Beginning Jazz  [Level 2A; Level 2B]  Studio 3  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Pop Star Jazz-Beginning Jazz', 'Level 2A/Level 2B - Jazz', ARRAY['Level 2A','Level 2B']::text[], 'Jazz', 'Jazz',
  3, ARRAY[3]::int[], '15:30:00', '16:15:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 12, 12, 12500,
  6, 8, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Pop Star Jazz-Beginning Jazz' AND day_of_week = 3 AND start_time = '15:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Pop Star Jazz-Beginning Jazz' AND c.day_of_week = 3 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 39. Wednesday 16:15-16:30  Beginner Jazz-Rehearsal  [Level 2A; Level 2B]  Studio 3  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Jazz-Rehearsal', 'Level 2A/Level 2B - Jazz', ARRAY['Level 2A','Level 2B']::text[], 'Jazz', 'Jazz',
  3, ARRAY[3]::int[], '16:15:00', '16:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 12, 12, 12500,
  6, 8, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Jazz-Rehearsal' AND day_of_week = 3 AND start_time = '16:15:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Jazz-Rehearsal' AND c.day_of_week = 3 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 40. Wednesday 16:15-16:30  Princess Petites-Ballet & Movement-Rehearsal  [Petites]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Princess Petites-Ballet & Movement-Rehearsal', 'Petites - Ballet', ARRAY['Petites']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '16:15:00', '16:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 9, 9, 12500,
  3, 6, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Princess Petites-Ballet & Movement-Rehearsal' AND day_of_week = 3 AND start_time = '16:15:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Princess Petites-Ballet & Movement-Rehearsal' AND c.day_of_week = 3 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 41. Wednesday 16:15-16:30  Mini Star Ballet-Rehearsal  [Level 1+]  Studio 1  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Mini Star Ballet-Rehearsal', 'Level 1+ - Ballet', ARRAY['Level 1+']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '16:15:00', '16:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 12, 12, 12500,
  4, 6, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Mini Star Ballet-Rehearsal' AND day_of_week = 3 AND start_time = '16:15:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Mini Star Ballet-Rehearsal' AND c.day_of_week = 3 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 42. Wednesday 16:30-17:30  Intermediate Jazz  [Level 3B; Level 3C]  Studio 3  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Jazz', 'Level 3B/Level 3C - Jazz', ARRAY['Level 3B','Level 3C']::text[], 'Jazz', 'Jazz',
  3, ARRAY[3]::int[], '16:30:00', '17:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 12, 12, 12500,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Jazz' AND day_of_week = 3 AND start_time = '16:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Jazz' AND c.day_of_week = 3 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 43. Wednesday 16:30-17:00  Intermediate Contemporary  [Level 2C]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Contemporary', 'Level 2C - Contemporary', ARRAY['Level 2C']::text[], 'Contemporary', 'Contemporary',
  3, ARRAY[3]::int[], '16:30:00', '17:00:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 14, 14, 12500,
  6, 9, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Contemporary' AND day_of_week = 3 AND start_time = '16:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Contemporary' AND c.day_of_week = 3 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 44. Wednesday 16:30-17:30  Intermediate Ballet  [Level 2B]  Studio 1  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 2B - Ballet', ARRAY['Level 2B']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '16:30:00', '17:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 12, 12, 12500,
  6, 8, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 3 AND start_time = '16:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 3 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 45. Wednesday 17:00-17:30  Intermediate Ballet-Rehearsal  [Level 2C]  Studio 2  Leila Meghdadi
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Rehearsal', 'Level 2C - Ballet', ARRAY['Level 2C']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '17:00:00', '17:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '88525f5f-4ef9-4038-9a11-e860ed611bfb', 14, 14, 12500,
  6, 9, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Rehearsal' AND day_of_week = 3 AND start_time = '17:00:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '88525f5f-4ef9-4038-9a11-e860ed611bfb', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Rehearsal' AND c.day_of_week = 3 AND c.start_time = '17:00:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 46. Wednesday 17:30-18:30  Advanced Contemporary  [Level 4C]  Studio 2  Leila Meghdadi
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Contemporary', 'Level 4C - Contemporary', ARRAY['Level 4C']::text[], 'Contemporary', 'Contemporary',
  3, ARRAY[3]::int[], '17:30:00', '18:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '88525f5f-4ef9-4038-9a11-e860ed611bfb', 15, 15, 12500,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Contemporary' AND day_of_week = 3 AND start_time = '17:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '88525f5f-4ef9-4038-9a11-e860ed611bfb', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Contemporary' AND c.day_of_week = 3 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 47. Wednesday 17:30-18:30  Intermediate Ballet  [Level 2C]  Studio 3  Katherine Thomas
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 2C - Ballet', ARRAY['Level 2C']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '17:30:00', '18:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '95bbed94-7050-46f2-a76a-1990876ad93f', 14, 14, 12500,
  6, 9, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 3 AND start_time = '17:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '95bbed94-7050-46f2-a76a-1990876ad93f', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 3 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 48. Wednesday 17:30-19:00  Intermediate Ballet  [Level 4B]  Studio 1  Amanda Cobb
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 4B - Ballet', ARRAY['Level 4B']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '17:30:00', '19:00:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '6518a096-9b37-435a-8c0c-595063a2dcd9', 15, 15, 15000,
  11, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 3 AND start_time = '17:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '6518a096-9b37-435a-8c0c-595063a2dcd9', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 3 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 49. Wednesday 18:30-19:30  Intermediate Musical Theater  [Teen]  Studio 3  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Musical Theater', 'Teen - Musical Theater', ARRAY['Teen']::text[], 'Musical Theater', 'Musical Theater',
  3, ARRAY[3]::int[], '18:30:00', '19:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 15, 15, 12500,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Musical Theater' AND day_of_week = 3 AND start_time = '18:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Musical Theater' AND c.day_of_week = 3 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 50. Wednesday 18:30-20:00  Advanced Ballet  [Level 4C; Level 4D]  Studio 2  Katherine Thomas
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Ballet', 'Level 4C/Level 4D - Ballet', ARRAY['Level 4C','Level 4D']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '18:30:00', '20:00:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '95bbed94-7050-46f2-a76a-1990876ad93f', 15, 15, 15000,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Ballet' AND day_of_week = 3 AND start_time = '18:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '95bbed94-7050-46f2-a76a-1990876ad93f', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Ballet' AND c.day_of_week = 3 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 51. Wednesday 19:00-19:30  Intermediate Hip Hop  [Level 4B]  Studio 1  Leila Meghdadi
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Hip Hop', 'Level 4B - Hip Hop', ARRAY['Level 4B']::text[], 'Hip Hop', 'Hip Hop',
  3, ARRAY[3]::int[], '19:00:00', '19:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '88525f5f-4ef9-4038-9a11-e860ed611bfb', 15, 15, 12500,
  11, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Hip Hop' AND day_of_week = 3 AND start_time = '19:00:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '88525f5f-4ef9-4038-9a11-e860ed611bfb', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Hip Hop' AND c.day_of_week = 3 AND c.start_time = '19:00:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 52. Wednesday 19:30-20:00  Intermediate Ballet-Rehearsal  [Level 4B]  Studio 1  Leila Meghdadi
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Rehearsal', 'Level 4B - Ballet', ARRAY['Level 4B']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '19:30:00', '20:00:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '88525f5f-4ef9-4038-9a11-e860ed611bfb', 15, 15, 12500,
  11, 18, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Rehearsal' AND day_of_week = 3 AND start_time = '19:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '88525f5f-4ef9-4038-9a11-e860ed611bfb', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Rehearsal' AND c.day_of_week = 3 AND c.start_time = '19:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 53. Wednesday 19:30-20:30  Beginner Ballet  [Level 4A; Adult/Teen]  Studio 3  Deborah Fauerbach
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Ballet', 'Level 4A/Adult/Teen - Ballet', ARRAY['Level 4A','Adult/Teen']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '19:30:00', '20:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '0da9bb9e-10a2-4be4-aeab-de8421347827', 15, 15, 12500,
  11, 99, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Ballet' AND day_of_week = 3 AND start_time = '19:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '0da9bb9e-10a2-4be4-aeab-de8421347827', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Ballet' AND c.day_of_week = 3 AND c.start_time = '19:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 54. Wednesday 20:00-20:30  Advanced Ballet-Pointe-Rehearsal  [Level 4C; Level 4D]  Studio 2  Katherine Thomas
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Ballet-Pointe-Rehearsal', 'Level 4C/Level 4D - Ballet', ARRAY['Level 4C','Level 4D']::text[], 'Ballet', 'Ballet',
  3, ARRAY[3]::int[], '20:00:00', '20:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '95bbed94-7050-46f2-a76a-1990876ad93f', 15, 15, 12500,
  12, 18, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Ballet-Pointe-Rehearsal' AND day_of_week = 3 AND start_time = '20:00:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '95bbed94-7050-46f2-a76a-1990876ad93f', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Ballet-Pointe-Rehearsal' AND c.day_of_week = 3 AND c.start_time = '20:00:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 55. Thursday 15:30-16:15  Princess Petites-Ballet & Movement  [Petites]  Studio 1  Elie Johnson
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Princess Petites-Ballet & Movement', 'Petites - Ballet', ARRAY['Petites']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '15:30:00', '16:15:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '202c98f4-40f6-4122-84f1-ad702106f0e8', 9, 9, 12500,
  3, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Princess Petites-Ballet & Movement' AND day_of_week = 4 AND start_time = '15:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '202c98f4-40f6-4122-84f1-ad702106f0e8', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Princess Petites-Ballet & Movement' AND c.day_of_week = 4 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 56. Thursday 15:30-16:15  Beginner Contemporary  [Level 2A; Level 2B]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Contemporary', 'Level 2A/Level 2B - Contemporary', ARRAY['Level 2A','Level 2B']::text[], 'Contemporary', 'Contemporary',
  4, ARRAY[4]::int[], '15:30:00', '16:15:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 12, 12, 12500,
  6, 8, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Contemporary' AND day_of_week = 4 AND start_time = '15:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Contemporary' AND c.day_of_week = 4 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 57. Thursday 15:30-16:30  Mini Star Hip Hop  [Level 1]  Studio 3  Leila Meghdadi
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Mini Star Hip Hop', 'Level 1 - Hip Hop', ARRAY['Level 1']::text[], 'Hip Hop', 'Hip Hop',
  4, ARRAY[4]::int[], '15:30:00', '16:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '88525f5f-4ef9-4038-9a11-e860ed611bfb', 12, 12, 12500,
  4, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Mini Star Hip Hop' AND day_of_week = 4 AND start_time = '15:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '88525f5f-4ef9-4038-9a11-e860ed611bfb', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Mini Star Hip Hop' AND c.day_of_week = 4 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 58. Thursday 16:15-16:30  Intermediate Ballet-Rehearsal  [Level 2B]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Rehearsal', 'Level 2B - Ballet', ARRAY['Level 2B']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '16:15:00', '16:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 12, 12, 12500,
  6, 8, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Rehearsal' AND day_of_week = 4 AND start_time = '16:15:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Rehearsal' AND c.day_of_week = 4 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 59. Thursday 16:15-16:30  Princess Petites-Ballet & Movement-Rehearsal  [Petites]  Studio 1  NO TEACHER
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Princess Petites-Ballet & Movement-Rehearsal', 'Petites - Ballet', ARRAY['Petites']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '16:15:00', '16:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  NULL, 9, 9, 12500,
  3, 6, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Princess Petites-Ballet & Movement-Rehearsal' AND day_of_week = 4 AND start_time = '16:15:00'
     AND room = 'Studio 1'
);

-- 60. Thursday 16:15-16:30  Beginner Hip Hop-Tricks-Rehearsal  [Level 1]  Studio 3  Leila Meghdadi
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Hip Hop-Tricks-Rehearsal', 'Level 1 - Hip Hop', ARRAY['Level 1']::text[], 'Hip Hop', 'Hip Hop',
  4, ARRAY[4]::int[], '16:15:00', '16:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '88525f5f-4ef9-4038-9a11-e860ed611bfb', 12, 12, 12500,
  4, 6, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Hip Hop-Tricks-Rehearsal' AND day_of_week = 4 AND start_time = '16:15:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '88525f5f-4ef9-4038-9a11-e860ed611bfb', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Hip Hop-Tricks-Rehearsal' AND c.day_of_week = 4 AND c.start_time = '16:15:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 61. Thursday 16:30-17:00  Intermediate Contemporary-Rehearsal  [Level 3C]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Contemporary-Rehearsal', 'Level 3C - Contemporary', ARRAY['Level 3C']::text[], 'Contemporary', 'Contemporary',
  4, ARRAY[4]::int[], '16:30:00', '17:00:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 12, 12, 12500,
  9, 11, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Contemporary-Rehearsal' AND day_of_week = 4 AND start_time = '16:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Contemporary-Rehearsal' AND c.day_of_week = 4 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 62. Thursday 16:30-17:30  Intermediate Ballet  [Level 3B]  Studio 1  Melanie Seeley
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 3B - Ballet', ARRAY['Level 3B']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '16:30:00', '17:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '47b58f03-2103-4f58-ac9d-70e4d71a11ee', 12, 12, 12500,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 4 AND start_time = '16:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '47b58f03-2103-4f58-ac9d-70e4d71a11ee', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 4 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 63. Thursday 16:30-17:15  Beginner Hip Hop  [Level 2]  Studio 3  Leila Meghdadi
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Hip Hop', 'Level 2 - Hip Hop', ARRAY['Level 2']::text[], 'Hip Hop', 'Hip Hop',
  4, ARRAY[4]::int[], '16:30:00', '17:15:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '88525f5f-4ef9-4038-9a11-e860ed611bfb', 12, 12, 12500,
  5, 7, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Hip Hop' AND day_of_week = 4 AND start_time = '16:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '88525f5f-4ef9-4038-9a11-e860ed611bfb', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Hip Hop' AND c.day_of_week = 4 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 64. Thursday 17:00-17:30  Intermediate Contemporary  [Level 3C]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Contemporary', 'Level 3C - Contemporary', ARRAY['Level 3C']::text[], 'Contemporary', 'Contemporary',
  4, ARRAY[4]::int[], '17:00:00', '17:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 12, 12, 12500,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Contemporary' AND day_of_week = 4 AND start_time = '17:00:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Contemporary' AND c.day_of_week = 4 AND c.start_time = '17:00:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 65. Thursday 17:15-17:30  Beginner Hip Hop-Rehearsal  [Level 2]  Studio 3  Leila Meghdadi
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Hip Hop-Rehearsal', 'Level 2 - Hip Hop', ARRAY['Level 2']::text[], 'Hip Hop', 'Hip Hop',
  4, ARRAY[4]::int[], '17:15:00', '17:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '88525f5f-4ef9-4038-9a11-e860ed611bfb', 12, 12, 12500,
  5, 7, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Hip Hop-Rehearsal' AND day_of_week = 4 AND start_time = '17:15:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '88525f5f-4ef9-4038-9a11-e860ed611bfb', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Hip Hop-Rehearsal' AND c.day_of_week = 4 AND c.start_time = '17:15:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 66. Thursday 17:30-18:30  Intermediate Contemporary  [Level 4B]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Contemporary', 'Level 4B - Contemporary', ARRAY['Level 4B']::text[], 'Contemporary', 'Contemporary',
  4, ARRAY[4]::int[], '17:30:00', '18:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 15, 15, 12500,
  11, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Contemporary' AND day_of_week = 4 AND start_time = '17:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Contemporary' AND c.day_of_week = 4 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 67. Thursday 17:30-18:30  Intermediate Ballet-Pre Pointe-Rehearsal  [Level 3B]  Studio 3  Ally Helmen
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Pre Pointe-Rehearsal', 'Level 3B - Ballet', ARRAY['Level 3B']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '17:30:00', '18:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', 12, 12, 12500,
  9, 11, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Pre Pointe-Rehearsal' AND day_of_week = 4 AND start_time = '17:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Pre Pointe-Rehearsal' AND c.day_of_week = 4 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 68. Thursday 17:30-18:30  Intermediate Ballet  [Level 3C]  Studio 1  Melanie Seeley
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 3C - Ballet', ARRAY['Level 3C']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '17:30:00', '18:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '47b58f03-2103-4f58-ac9d-70e4d71a11ee', 12, 12, 12500,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 4 AND start_time = '17:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '47b58f03-2103-4f58-ac9d-70e4d71a11ee', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 4 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 69. Thursday 18:30-19:30  Intermediate Ballet  [Level 4B]  Studio 1  Ally Helmen
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 4B - Ballet', ARRAY['Level 4B']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '18:30:00', '19:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', 15, 15, 12500,
  11, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 4 AND start_time = '18:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 4 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 70. Thursday 18:30-19:30  Advanced Contemporary  [Level 4C]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Contemporary', 'Level 4C - Contemporary', ARRAY['Level 4C']::text[], 'Contemporary', 'Contemporary',
  4, ARRAY[4]::int[], '18:30:00', '19:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 15, 15, 12500,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Contemporary' AND day_of_week = 4 AND start_time = '18:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Contemporary' AND c.day_of_week = 4 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 71. Thursday 18:30-19:00  Intermediate Ballet-Rehearsal  [Level 3C]  Studio 3  Cara Matchett
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Rehearsal', 'Level 3C - Ballet', ARRAY['Level 3C']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '18:30:00', '19:00:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'e406cbc5-8937-4a53-95e7-059097cd29c2', 12, 12, 12500,
  9, 11, 'any', false, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Rehearsal' AND day_of_week = 4 AND start_time = '18:30:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'e406cbc5-8937-4a53-95e7-059097cd29c2', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Rehearsal' AND c.day_of_week = 4 AND c.start_time = '18:30:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 72. Thursday 19:00-19:30  Intermediate Ballet-Pre Pointe  [Level 3C; Level 4A; Adult/Teen]  Studio 3  Cara Matchett
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Pre Pointe', 'Level 3C/Level 4A/Adult/Teen - Ballet', ARRAY['Level 3C','Level 4A','Adult/Teen']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '19:00:00', '19:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'e406cbc5-8937-4a53-95e7-059097cd29c2', 15, 15, 12500,
  9, 99, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Pre Pointe' AND day_of_week = 4 AND start_time = '19:00:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'e406cbc5-8937-4a53-95e7-059097cd29c2', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Pre Pointe' AND c.day_of_week = 4 AND c.start_time = '19:00:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 73. Thursday 19:30-20:30  Advanced Ballet  [Level 4A; Adult/Teen]  Studio 2  Samantha Weeks
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Ballet', 'Level 4A/Adult/Teen - Ballet', ARRAY['Level 4A','Adult/Teen']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '19:30:00', '20:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', 15, 15, 12500,
  11, 99, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Ballet' AND day_of_week = 4 AND start_time = '19:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '9033aa5d-6240-4c01-a3a6-bbb147cc84e6', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Ballet' AND c.day_of_week = 4 AND c.start_time = '19:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 74. Thursday 19:30-20:30  Advanced Ballet-Pointe  [Level 4C; Level 4D]  Studio 1  Ally Helmen
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Advanced Ballet-Pointe', 'Level 4C/Level 4D - Ballet', ARRAY['Level 4C','Level 4D']::text[], 'Ballet', 'Ballet',
  4, ARRAY[4]::int[], '19:30:00', '20:30:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', 15, 15, 12500,
  12, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Advanced Ballet-Pointe' AND day_of_week = 4 AND start_time = '19:30:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Advanced Ballet-Pointe' AND c.day_of_week = 4 AND c.start_time = '19:30:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 75. Friday 15:30-16:15  Beginner Song & Poms  [Level 1]  Studio 2  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Song & Poms', 'Level 1 - Jazz', ARRAY['Level 1']::text[], 'Jazz', 'Jazz',
  5, ARRAY[5]::int[], '15:30:00', '16:15:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 12, 12, 12500,
  4, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Song & Poms' AND day_of_week = 5 AND start_time = '15:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Song & Poms' AND c.day_of_week = 5 AND c.start_time = '15:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 76. Friday 15:30-16:30  Intermediate Movement-Tricks  [Level 2B; Level 2C]  Studio 3  NO TEACHER
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Movement-Tricks', 'Level 2B/Level 2C - Movement', ARRAY['Level 2B','Level 2C']::text[], 'Movement', 'Movement',
  5, ARRAY[5]::int[], '15:30:00', '16:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  NULL, 14, 14, 12500,
  6, 9, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Movement-Tricks' AND day_of_week = 5 AND start_time = '15:30:00'
     AND room = 'Studio 3'
);

-- 77. Friday 16:30-17:30  Intermediate Song & Poms  [Level 2C; Level 3C]  Studio 2  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Song & Poms', 'Level 2C/Level 3C - Jazz', ARRAY['Level 2C','Level 3C']::text[], 'Jazz', 'Jazz',
  5, ARRAY[5]::int[], '16:30:00', '17:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 14, 14, 12500,
  6, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Song & Poms' AND day_of_week = 5 AND start_time = '16:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Song & Poms' AND c.day_of_week = 5 AND c.start_time = '16:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 78. Friday 16:30-17:30  Intermediate Movement-Tricks & Conditioning  [Level 4B; Level 4C; Level 4D]  Studio 3  NO TEACHER
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Movement-Tricks & Conditioning', 'Level 4B/Level 4C/Level 4D - Movement', ARRAY['Level 4B','Level 4C','Level 4D']::text[], 'Movement', 'Movement',
  5, ARRAY[5]::int[], '16:30:00', '17:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  NULL, 15, 15, 12500,
  11, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Movement-Tricks & Conditioning' AND day_of_week = 5 AND start_time = '16:30:00'
     AND room = 'Studio 3'
);

-- 79. Friday 17:30-18:30  Intermediate Song & Poms  [Level 4B; Level 4C; Level 4D]  Studio 2  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Song & Poms', 'Level 4B/Level 4C/Level 4D - Jazz', ARRAY['Level 4B','Level 4C','Level 4D']::text[], 'Jazz', 'Jazz',
  5, ARRAY[5]::int[], '17:30:00', '18:30:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 15, 15, 12500,
  11, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Song & Poms' AND day_of_week = 5 AND start_time = '17:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Song & Poms' AND c.day_of_week = 5 AND c.start_time = '17:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 80. Friday 17:30-18:30  Intermediate Movement-Tricks  [Level 3B; Level 3C]  Studio 3  NO TEACHER
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Movement-Tricks', 'Level 3B/Level 3C - Movement', ARRAY['Level 3B','Level 3C']::text[], 'Movement', 'Movement',
  5, ARRAY[5]::int[], '17:30:00', '18:30:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  NULL, 12, 12, 12500,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Movement-Tricks' AND day_of_week = 5 AND start_time = '17:30:00'
     AND room = 'Studio 3'
);

-- 81. Saturday 09:00-09:55  Intermediate Ballet  [Level 2B]  Studio 2  Ally Helmen
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 2B - Ballet', ARRAY['Level 2B']::text[], 'Ballet', 'Ballet',
  6, ARRAY[6]::int[], '09:00:00', '09:55:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', 12, 12, 12500,
  6, 8, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 6 AND start_time = '09:00:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 6 AND c.start_time = '09:00:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 82. Saturday 09:00-09:45  Beginner Jazz-Turns & Tricks  [Level 1]  Studio 3  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Beginner Jazz-Turns & Tricks', 'Level 1 - Jazz', ARRAY['Level 1']::text[], 'Jazz', 'Jazz',
  6, ARRAY[6]::int[], '09:00:00', '09:45:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 12, 12, 12500,
  4, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Beginner Jazz-Turns & Tricks' AND day_of_week = 6 AND start_time = '09:00:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Beginner Jazz-Turns & Tricks' AND c.day_of_week = 6 AND c.start_time = '09:00:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 83. Saturday 09:00-09:45  Princess Petites-Ballet & Movement  [Petites]  Studio 1  Kailey Luebrecht
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Princess Petites-Ballet & Movement', 'Petites - Ballet', ARRAY['Petites']::text[], 'Ballet', 'Ballet',
  6, ARRAY[6]::int[], '09:00:00', '09:45:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'bac19dfd-fabb-487d-a8bd-5902d0ad7fbf', 9, 9, 12500,
  3, 6, 'any', true, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Princess Petites-Ballet & Movement' AND day_of_week = 6 AND start_time = '09:00:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'bac19dfd-fabb-487d-a8bd-5902d0ad7fbf', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Princess Petites-Ballet & Movement' AND c.day_of_week = 6 AND c.start_time = '09:00:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 84. Saturday 09:45-10:00  Princess Petites-Ballet & Movement-Rehearsal  [Petites]  Studio 1  Kailey Luebrecht
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Princess Petites-Ballet & Movement-Rehearsal', 'Petites - Ballet', ARRAY['Petites']::text[], 'Ballet', 'Ballet',
  6, ARRAY[6]::int[], '09:45:00', '10:00:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'bac19dfd-fabb-487d-a8bd-5902d0ad7fbf', 9, 9, 12500,
  3, 6, 'any', true, 1,
  true, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Princess Petites-Ballet & Movement-Rehearsal' AND day_of_week = 6 AND start_time = '09:45:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'bac19dfd-fabb-487d-a8bd-5902d0ad7fbf', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Princess Petites-Ballet & Movement-Rehearsal' AND c.day_of_week = 6 AND c.start_time = '09:45:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 85. Saturday 10:00-10:55  Intermediate Jazz  [Level 2B; Level 2C]  Studio 3  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Jazz', 'Level 2B/Level 2C - Jazz', ARRAY['Level 2B','Level 2C']::text[], 'Jazz', 'Jazz',
  6, ARRAY[6]::int[], '10:00:00', '10:55:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 14, 14, 12500,
  6, 9, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Jazz' AND day_of_week = 6 AND start_time = '10:00:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Jazz' AND c.day_of_week = 6 AND c.start_time = '10:00:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 86. Saturday 10:00-10:55  Intermediate Ballet-Pre Pointe  [Level 3B; Level 3C]  Studio 1  Ally Helmen
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet-Pre Pointe', 'Level 3B/Level 3C - Ballet', ARRAY['Level 3B','Level 3C']::text[], 'Ballet', 'Ballet',
  6, ARRAY[6]::int[], '10:00:00', '10:55:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', 12, 12, 12500,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet-Pre Pointe' AND day_of_week = 6 AND start_time = '10:00:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet-Pre Pointe' AND c.day_of_week = 6 AND c.start_time = '10:00:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 87. Saturday 10:30-12:00  Intermediate Ballet  [Level 4B; Level 4C]  Studio 2  Katherine Thomas
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 4B/Level 4C - Ballet', ARRAY['Level 4B','Level 4C']::text[], 'Ballet', 'Ballet',
  6, ARRAY[6]::int[], '10:30:00', '12:00:00',
  'Studio 2', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 2' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '95bbed94-7050-46f2-a76a-1990876ad93f', 15, 15, 15000,
  11, 18, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 6 AND start_time = '10:30:00'
     AND room = 'Studio 2'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '95bbed94-7050-46f2-a76a-1990876ad93f', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 6 AND c.start_time = '10:30:00'
   AND c.room = 'Studio 2'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 88. Saturday 11:00-11:55  Intermediate Ballet  [Level 2C]  Studio 3  Ally Helmen
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Ballet', 'Level 2C - Ballet', ARRAY['Level 2C']::text[], 'Ballet', 'Ballet',
  6, ARRAY[6]::int[], '11:00:00', '11:55:00',
  'Studio 3', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 3' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', 14, 14, 12500,
  6, 9, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Ballet' AND day_of_week = 6 AND start_time = '11:00:00'
     AND room = 'Studio 3'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, '26dc1c63-e3c2-43ee-9566-d8f3ccfe7e02', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Ballet' AND c.day_of_week = 6 AND c.start_time = '11:00:00'
   AND c.room = 'Studio 3'
ON CONFLICT (class_id, teacher_id) DO NOTHING;

-- 89. Saturday 11:00-11:50  Intermediate Jazz  [Level 3B; Level 3C]  Studio 1  Lauryn Rowe
INSERT INTO public.classes (
  name, description, levels, discipline, style,
  day_of_week, days_of_week, start_time, end_time,
  room, room_id, location_id, season, season_id,
  teacher_id, max_students, max_enrollment, fee_cents,
  age_min, age_max, gender, trial_eligible, point_cost,
  is_rehearsal, is_performance, status, online_registration, is_active
)
SELECT
  'Intermediate Jazz', 'Level 3B/Level 3C - Jazz', ARRAY['Level 3B','Level 3C']::text[], 'Jazz', 'Jazz',
  6, ARRAY[6]::int[], '11:00:00', '11:50:00',
  'Studio 1', (SELECT id FROM public.rooms WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND name = 'Studio 1' LIMIT 1),
  '70acde19-bd54-46c2-a4f4-2200b0adb393', '2026/2027', 'af220d93-0b39-4816-a2ec-0d09c6dfda7e',
  'fc7d6951-6f67-472a-8920-a4faace6642a', 12, 12, 12500,
  9, 11, 'any', false, 1,
  false, false, 'active', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
     AND name = 'Intermediate Jazz' AND day_of_week = 6 AND start_time = '11:00:00'
     AND room = 'Studio 1'
);
INSERT INTO public.class_teachers (class_id, teacher_id, tenant_id, role, is_primary)
SELECT c.id, 'fc7d6951-6f67-472a-8920-a4faace6642a', '84d98f72-c82f-414f-8b17-172b802f6993', 'lead', true FROM public.classes c
 WHERE c.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND c.season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e'
   AND c.name = 'Intermediate Jazz' AND c.day_of_week = 6 AND c.start_time = '11:00:00'
   AND c.room = 'Studio 1'
ON CONFLICT (class_id, teacher_id) DO NOTHING;


-- Verify
DO $verify$
DECLARE v_classes bigint; v_noteacher bigint;
BEGIN
  SELECT count(*) INTO v_classes FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e';
  SELECT count(*) INTO v_noteacher FROM public.classes
   WHERE location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393' AND season_id = 'af220d93-0b39-4816-a2ec-0d09c6dfda7e' AND teacher_id IS NULL;
  RAISE NOTICE 'Fall 2026/2027 classes now: % (% without a teacher)', v_classes, v_noteacher;
END
$verify$;

NOTIFY pgrst, 'reload schema';
