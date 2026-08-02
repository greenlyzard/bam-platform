-- Nutcracker 2026 — production, events, and closures
--
-- Five dated events at San Juan Hills High School, hanging off one production:
--   Sat Nov 7   10:30–16:30  theater rehearsal
--   Sat Nov 14  11:00–12:45  performance
--   Sat Nov 14  14:30–16:15  performance
--   Sun Nov 15  11:00–12:45  performance
--   Sun Nov 15  14:30–16:15  performance
--
-- Closes CALENDAR_AND_PUBLIC_EVENTS.md open question 2 in favour of
-- schedule_instances: productions.performance_date is singular and cannot
-- express a four-show run. The production becomes the container; each dated
-- event is a row carrying production_id.
--
-- No schema change needed — schedule_instances already has production_id,
-- venue_name and venue_address.
--
-- ---------------------------------------------------------------------------
-- Location scoping instead of exemption gymnastics
-- ---------------------------------------------------------------------------
-- The Nov 7 rehearsal runs 10:30–16:30 and overlaps Saturday classes that run
-- 09:00–12:00, so those classes genuinely cannot run.
--
-- Both closures are scoped to San Clemente (all_studios = false). The theater
-- events sit at San Juan Hills, a different location_id, so they are simply out
-- of scope — no exemption is needed to protect them.
--
-- This avoids the trap in STUDIO_CLOSURES.md §16.5: exempting `rehearsal`
-- tenant-wide would also spare studio rehearsals on the same day, including the
-- 09:45–10:00 Princess Petites rehearsal, which would then run alone while the
-- company is at the theater.
--
-- ---------------------------------------------------------------------------
-- Pre-flight
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  if not exists (select 1 from public.studio_locations
                 where id = 'bfc15a1f-d2d0-4b19-8653-7dfb22451d92') then
    raise exception 'San Juan Hills High School location not found';
  end if;

  if not exists (select 1 from public.studio_locations
                 where id = '70acde19-bd54-46c2-a4f4-2200b0adb393') then
    raise exception 'San Clemente location not found';
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='studio_closures'
                   and column_name='closure_type') then
    raise exception 'closure_type missing — run 20260801000001 first';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- The production
--
-- performance_date is set to the first performance (Nov 14) for backward
-- compatibility with any reader that still expects it. It is NOT the source of
-- truth for the run — the five event rows are.
-- ---------------------------------------------------------------------------
insert into public.productions (
  id, tenant_id, name, production_type, season,
  performance_date, venue_name,
  approval_status, is_published, notes
)
select
  '9a1f0c3e-4d7b-4a52-9c18-2f6b8e5d0a71'::uuid,
  '84d98f72-c82f-414f-8b17-172b802f6993'::uuid,
  'The Nutcracker 2026',
  'showcase',
  '2026/2027',
  '2026-11-14'::date,
  'San Juan Hills High School',
  'approved',
  false,
  'Four performances Nov 14-15 plus theater rehearsal Nov 7. Additional performances at Pelican Hill and Casa Romantica in early December, dates TBD. Call times vary by role — see casting.'
where not exists (
  select 1 from public.productions
  where tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'::uuid
    and name = 'The Nutcracker 2026'
);

-- ---------------------------------------------------------------------------
-- The five events
--
-- teacher_id is deliberately NULL. A show is worked by a crew, not one teacher,
-- and who attends comes out of casting. See NUTCRACKER_2026_DRY_RUN.md nuance 2.
--
-- room_id NULL — external venue. location_id carries the venue, so venue_name
-- and venue_address are left null here rather than duplicating the production.
--
-- The natural-key unique index only covers rows WHERE class_id IS NOT NULL, so
-- these rows have no collision protection. Guarded with NOT EXISTS instead.
-- ---------------------------------------------------------------------------
insert into public.schedule_instances (
  tenant_id, production_id, class_id, teacher_id, room_id, location_id,
  event_type, event_date, start_time, end_time,
  status, approval_status, is_trial_eligible, notes
)
select
  '84d98f72-c82f-414f-8b17-172b802f6993'::uuid,
  '9a1f0c3e-4d7b-4a52-9c18-2f6b8e5d0a71'::uuid,
  null, null, null,
  'bfc15a1f-d2d0-4b19-8653-7dfb22451d92'::uuid,
  v.event_type, v.event_date, v.start_time, v.end_time,
  'published', 'approved', false, v.note
from (values
  ('rehearsal'::text,   '2026-11-07'::date, '10:30'::time, '16:30'::time,
   'Theater rehearsal. Envelope only — role call times vary, set in casting.'),
  ('performance',       '2026-11-14',       '11:00',       '12:45',
   'Matinee. Curtain times only; teacher pay spans call to release.'),
  ('performance',       '2026-11-14',       '14:30',       '16:15',
   'Evening. Curtain times only; teacher pay spans call to release.'),
  ('performance',       '2026-11-15',       '11:00',       '12:45',
   'Matinee. Curtain times only; teacher pay spans call to release.'),
  ('performance',       '2026-11-15',       '14:30',       '16:15',
   'Evening. Curtain times only; teacher pay spans call to release.')
) as v(event_type, event_date, start_time, end_time, note)
where not exists (
  select 1 from public.schedule_instances si
  where si.production_id = '9a1f0c3e-4d7b-4a52-9c18-2f6b8e5d0a71'::uuid
    and si.event_date = v.event_date
    and si.start_time = v.start_time
);

-- ---------------------------------------------------------------------------
-- The closures — San Clemente only
--
-- exempt_event_types = {private_lesson}: classes and studio rehearsals stop,
-- privates continue by arrangement, matching every other partial closure.
-- The theater events are out of scope by location, not by exemption.
-- ---------------------------------------------------------------------------
insert into public.studio_closures (
  id, tenant_id, closed_date, closed_through, reason,
  closure_type, is_total, all_studios, exempt_event_types, makeup_deadline
)
select v.id, '84d98f72-c82f-414f-8b17-172b802f6993'::uuid,
       v.d_from, v.d_to, v.reason,
       'production_conflict'::public.closure_type, false, false,
       array['private_lesson']::text[], v.makeup
from (values
  ('c1a70b4e-8f32-4d19-b6c5-1e9a7d3c0b28'::uuid, '2026-11-07'::date, '2026-11-07'::date,
   'Nutcracker — Theater Rehearsal', '2026-11-28'::date),
  ('d2b81c5f-9e43-4a27-c7d6-2f0b8e4a1c39'::uuid, '2026-11-14'::date, '2026-11-15'::date,
   'Nutcracker — Performances', '2026-12-06'::date)
) as v(id, d_from, d_to, reason, makeup)
where not exists (
  select 1 from public.studio_closures sc
  where sc.tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'::uuid
    and sc.closed_date = v.d_from
    and sc.reason = v.reason
);

-- Scope both closures to San Clemente
insert into public.closure_locations (closure_id, location_id, tenant_id)
select sc.id,
       '70acde19-bd54-46c2-a4f4-2200b0adb393'::uuid,
       '84d98f72-c82f-414f-8b17-172b802f6993'::uuid
from public.studio_closures sc
where sc.tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'::uuid
  and sc.reason in ('Nutcracker — Theater Rehearsal', 'Nutcracker — Performances')
  and not exists (
    select 1 from public.closure_locations cl
    where cl.closure_id = sc.id
      and cl.location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393'::uuid
  );

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
do $$
declare
  v_events int;
  v_closures int;
  v_scoped int;
begin
  select count(*) into v_events from public.schedule_instances
  where production_id = '9a1f0c3e-4d7b-4a52-9c18-2f6b8e5d0a71'::uuid;

  select count(*) into v_closures from public.studio_closures
  where reason like 'Nutcracker%';

  select count(*) into v_scoped from public.closure_locations cl
  join public.studio_closures sc on sc.id = cl.closure_id
  where sc.reason like 'Nutcracker%';

  if v_events <> 5 then
    raise exception 'Expected 5 Nutcracker events, found %', v_events;
  end if;
  if v_closures <> 2 then
    raise exception 'Expected 2 Nutcracker closures, found %', v_closures;
  end if;
  if v_scoped <> 2 then
    raise exception 'Expected 2 closure_locations rows, found %', v_scoped;
  end if;
end $$;
