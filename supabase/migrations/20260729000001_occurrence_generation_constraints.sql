-- =============================================================================
-- Occurrence generation — Phase 1: constraints
--
-- Spec: docs/OCCURRENCE_GENERATION.md §3 (decisions settled), §5 Phase 1
--
-- Two constraints, no functions, no data. They exist so that Phase 2's
-- generator can be written as a plain loop with ON CONFLICT DO NOTHING rather
-- than as a read-check-write dance that races itself.
--
-- 1. Partial unique index on (class_id, event_date, start_time).
--    `schedule_instances` has no natural key today — the 1,042 rows are output
--    from a one-time March seed (20260311000016) and nothing has inserted an
--    occurrence since. Without a unique index, ON CONFLICT DO NOTHING has no
--    arbiter and generation would duplicate every occurrence on every run.
--    Partial because 61 rows carry a NULL class_id (spec §2, Phase 3 disposes
--    of them); those are excluded rather than blocking the index.
--
-- 2. CHECK pinning days_of_week elements to ISO 1..7.
--    Phase 0 established that ISO isodow and Postgres dow agree on Monday
--    through Saturday and diverge only on Sunday — ISO 7 against dow 0. All
--    981 testable instances matched both encodings, so the live data cannot
--    distinguish them. No class contains 0 and none contains 7, because no
--    Sunday class exists. That makes the ambiguity harmless today and a trap
--    tomorrow: an admin creating the first Sunday class could reasonably enter
--    0, the generator uses isodow, and the class would silently generate
--    nothing at all — no error, no occurrence, no attendance, no timesheet.
--    Resolved by fiat in §3: Monday=1 … Sunday=7, and 0 is rejected at write
--    time rather than discovered in September.
--
-- Verified against the live database 2026-07-29 before authoring:
--   duplicate (class_id, event_date, start_time) groups .. 0
--   classes with days_of_week outside 1..7 ............... 0
-- Both pre-flight blocks below re-check at apply time; neither should fire.
--
-- No CONCURRENTLY: the table is 1,042 rows and this must run inside the
-- migration transaction alongside the pre-flight guards.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pre-flight 1 — the unique index must not be able to fail mid-migration.
-- -----------------------------------------------------------------------------
do $$
declare
  v_dup_groups integer;
begin
  select count(*)
    into v_dup_groups
    from (
      select class_id, event_date, start_time
        from public.schedule_instances
       where class_id is not null
       group by class_id, event_date, start_time
      having count(*) > 1
    ) d;

  if v_dup_groups > 0 then
    raise exception
      'Pre-flight failed: % duplicate (class_id, event_date, start_time) group(s) in schedule_instances. Resolve duplicates before creating the natural-key index.',
      v_dup_groups;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Pre-flight 2 — the CHECK constraint must not be able to fail mid-migration.
-- `<@` is "is contained by": every element of days_of_week must appear in
-- ARRAY[1,2,3,4,5,6,7]. NULL days_of_week is not a violation.
-- -----------------------------------------------------------------------------
do $$
declare
  v_bad_classes integer;
begin
  select count(*)
    into v_bad_classes
    from public.classes
   where days_of_week is not null
     and not (days_of_week <@ array[1,2,3,4,5,6,7]);

  if v_bad_classes > 0 then
    raise exception
      'Pre-flight failed: % class(es) have days_of_week values outside ISO 1..7 (Monday=1 .. Sunday=7). Remap 0 to 7 before pinning the encoding.',
      v_bad_classes;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Natural-key uniqueness — the ON CONFLICT arbiter for the generator.
-- -----------------------------------------------------------------------------
create unique index if not exists idx_schedule_instances_natural_key
  on public.schedule_instances (class_id, event_date, start_time)
  where class_id is not null;

-- -----------------------------------------------------------------------------
-- 2. ISO weekday encoding on classes.days_of_week.
-- Guarded by pg_constraint rather than IF NOT EXISTS — ADD CONSTRAINT has no
-- IF NOT EXISTS form in Postgres.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'classes'
       and c.conname = 'classes_days_of_week_iso_check'
  ) then
    alter table public.classes
      add constraint classes_days_of_week_iso_check
      check (days_of_week is null or days_of_week <@ array[1,2,3,4,5,6,7]);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Documentation
-- -----------------------------------------------------------------------------
comment on index public.idx_schedule_instances_natural_key is
  'Natural key for a class occurrence: (class_id, event_date, start_time). This index IS what makes ON CONFLICT DO NOTHING work in generate_occurrences (docs/OCCURRENCE_GENERATION.md §4) — without it the generator has no conflict arbiter and re-running duplicates every occurrence. Partial because rows with a NULL class_id (61 orphans as of 2026-07-29) have no class to be unique against; Phase 3 disposes of those separately. Do not drop without replacing the generator''s idempotency guarantee.';

comment on constraint classes_days_of_week_iso_check on public.classes is
  'Pins days_of_week to the ISO encoding, Monday=1 .. Sunday=7, and rejects 0. ISO isodow and Postgres dow are identical Monday-Saturday and diverge only on Sunday (ISO 7 vs dow 0), so today''s data satisfies both and cannot settle the question. generate_occurrences matches on extract(isodow from d). Without this constraint the first Sunday class entered as 0 would generate zero occurrences and raise no error — a silent trap, not a visible failure. See docs/OCCURRENCE_GENERATION.md §3.';
