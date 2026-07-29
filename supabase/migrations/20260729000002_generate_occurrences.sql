-- =============================================================================
-- Occurrence generation — Phase 2: the generator
--
-- Spec: docs/OCCURRENCE_GENERATION.md §3 (decisions settled), §4 (contract)
-- Depends on: 20260729000001 (natural-key index + ISO weekday CHECK)
--
-- One function. No tables, no data, no cron. Phase 4 runs it for the Fall
-- window; this migration only defines it.
--
-- Three things carry the design:
--
-- 1. It never touches the past. Every candidate date is filtered on
--    `d > current_date`, and the function contains no UPDATE and no DELETE at
--    all. Re-running over a past window is a no-op, not a rewrite. This is the
--    mechanical guarantee behind §3 "the occurrence is the snapshot": a teacher
--    resolved onto an occurrence in August is still there in June no matter how
--    class_teachers changes in between. Not configurable, deliberately — a
--    p_force flag would be the entire safety property with an off switch.
--
-- 2. It is idempotent through the Phase 1 index, not through bookkeeping.
--    ON CONFLICT DO NOTHING against idx_schedule_instances_natural_key. The
--    bare form is used, with no inference clause: the index is partial
--    (WHERE class_id IS NOT NULL) and an explicit arbiter would have to repeat
--    that predicate exactly or fail at runtime. The pre-flight below refuses to
--    install the function if that index is missing, because without it this
--    function silently duplicates every occurrence on the second run.
--
-- 3. It refuses to run multi-tenant. `classes` HAS NO tenant_id column —
--    verified against types/database.types.ts and the live catalog on
--    2026-07-29. Class selection therefore cannot be scoped, and with a second
--    tenant present this function would stamp every studio's classes with
--    p_tenant_id and write them into one tenant's schedule. The guard is the
--    first statement in the body and raises rather than degrading. A loud
--    failure on tenant two beats silent cross-tenant occurrence creation
--    discovered at payroll.
--
-- Verified against the live database 2026-07-29:
--   tenants ......................................... 1  (guard passes)
--   eligible classes (is_active + status='active') .. 153
--   of those, NULL start/end date, start/end time,
--     or days_of_week ............................... 0
--   studio_closures ................................. 6
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pre-flight — every object this function reads or writes, plus the Phase 1
-- index its idempotency depends on.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'schedule_instances') then
    raise exception 'Pre-flight failed: public.schedule_instances does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_closures') then
    raise exception 'Pre-flight failed: public.studio_closures does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'tenants') then
    raise exception 'Pre-flight failed: public.tenants does not exist';
  end if;

  -- Idempotency lives entirely in this index. Installing the generator without
  -- it would produce a function that looks correct and duplicates the whole
  -- season on its second run.
  if not exists (select 1 from pg_indexes
                 where schemaname = 'public'
                   and indexname = 'idx_schedule_instances_natural_key') then
    raise exception 'Pre-flight failed: idx_schedule_instances_natural_key is missing. Apply 20260729000001 before this migration — ON CONFLICT DO NOTHING has no arbiter without it.';
  end if;

  -- The tenant guard in the function body is premised on this. If a later
  -- migration adds classes.tenant_id, the guard becomes unnecessary and the
  -- class selection below should be scoped instead — fail here so that change
  -- cannot pass unnoticed.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'classes'
               and column_name = 'tenant_id') then
    raise exception 'Pre-flight failed: classes.tenant_id now exists. Scope class selection by tenant and drop the single-tenant guard in generate_occurrences before re-applying.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- The generator
-- -----------------------------------------------------------------------------
create or replace function public.generate_occurrences(
  p_tenant_id uuid,
  p_from      date,
  p_to        date,
  p_class_id  uuid default null
)
returns table (
  classes_processed    int,
  occurrences_created  int,
  dates_skipped_closed int
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_classes int := 0;
  v_created int := 0;
  v_closed  int := 0;
begin
  -- ---------------------------------------------------------------------------
  -- Multi-tenancy guard. First statement, before any read of classes.
  -- classes has no tenant_id, so there is no correct way to scope the walk.
  -- ---------------------------------------------------------------------------
  if (select count(*) from public.tenants) > 1 then
    raise exception 'generate_occurrences cannot run multi-tenant: classes has no tenant_id. Add tenant_id to classes and scope class selection before onboarding a second tenant.';
  end if;

  -- ---------------------------------------------------------------------------
  -- Authorization. SECURITY DEFINER bypasses RLS on schedule_instances, so the
  -- caller is checked here. auth.uid() IS NULL means there is no JWT — a
  -- migration, the SQL editor, or a service-role call — which is already
  -- privileged; a logged-in caller must be admin-tier. Spec §4 says "callable
  -- only by schedule managers"; is_schedule_approver() is the natural fit by
  -- name but reads schedule_approvers, which is empty (§3), so it would refuse
  -- everyone including Amanda. is_admin() is the closest existing helper.
  -- ---------------------------------------------------------------------------
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'generate_occurrences requires an admin-tier role';
  end if;

  -- ---------------------------------------------------------------------------
  -- Argument sanity
  -- ---------------------------------------------------------------------------
  if p_tenant_id is null or p_from is null or p_to is null then
    raise exception 'generate_occurrences requires p_tenant_id, p_from and p_to';
  end if;

  if p_to < p_from then
    raise exception 'generate_occurrences: p_to (%) is before p_from (%)', p_to, p_from;
  end if;

  if not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'generate_occurrences: no tenant %', p_tenant_id;
  end if;

  if p_class_id is not null
     and not exists (select 1 from public.classes c where c.id = p_class_id) then
    raise exception 'generate_occurrences: no class %', p_class_id;
  end if;

  -- ---------------------------------------------------------------------------
  -- Walk, insert, count — one statement.
  --
  -- `eligible`  : status='active' AND is_active, per §4. NOT 'published' —
  --               that value belongs to schedule_instances.status and matches
  --               no class row.
  --               Classes missing any field generation needs are excluded
  --               rather than aborting the season: schedule_instances.end_time
  --               is NOT NULL while classes.end_time is nullable, so one
  --               half-entered class would otherwise fail the entire run.
  --               Zero classes are excluded on today's data.
  -- `candidate` : the intersection of [p_from, p_to] with the class's own
  --               [start_date, end_date] (§3 — per-class window, the season
  --               table is not consulted), restricted to ISO weekday matches
  --               and to future dates.
  -- `ins`       : the insert. Closure dates are excluded here; they are counted
  --               separately from the same candidate set, so the count reports
  --               what generation skipped rather than what survived.
  -- ---------------------------------------------------------------------------
  with eligible as (
    select
      c.id             as class_id,
      c.teacher_id     as teacher_id,
      c.room_id        as room_id,
      c.location_id    as location_id,
      c.is_rehearsal   as is_rehearsal,
      c.start_time     as start_time,
      c.end_time       as end_time,
      c.trial_eligible as trial_eligible,
      c.days_of_week   as days_of_week,
      greatest(c.start_date, p_from) as win_from,
      least(c.end_date, p_to)        as win_to
    from public.classes c
    where c.is_active = true
      and c.status = 'active'
      and (p_class_id is null or c.id = p_class_id)
      and c.start_date is not null
      and c.end_date is not null
      and c.start_time is not null
      and c.end_time is not null
      and c.days_of_week is not null
      and array_length(c.days_of_week, 1) > 0
  ),
  candidate as (
    select
      e.class_id,
      e.teacher_id,
      e.room_id,
      e.location_id,
      e.is_rehearsal,
      e.start_time,
      e.end_time,
      e.trial_eligible,
      g.d::date as event_date
    from eligible e
    cross join lateral generate_series(e.win_from, e.win_to, interval '1 day') as g(d)
    where e.win_from <= e.win_to
      -- ISO weekday: Monday=1 .. Sunday=7, pinned by the Phase 1 CHECK.
      -- isodow, never dow — they agree Mon-Sat and disagree on Sunday only.
      and extract(isodow from g.d)::int = any(e.days_of_week)
      -- Generation never touches the past. current_date resolves in the
      -- server timezone (UTC), which is at or ahead of studio-local date, so
      -- this errs toward skipping rather than toward rewriting.
      and g.d::date > current_date
  ),
  ins as (
    insert into public.schedule_instances (
      tenant_id,
      class_id,
      teacher_id,
      room_id,
      location_id,
      event_type,
      event_date,
      start_time,
      end_time,
      status,
      approval_status,
      is_trial_eligible
    )
    select
      p_tenant_id,
      ca.class_id,
      -- May be NULL. Four classes have no teacher; they still get occurrences.
      -- The gap is in the assignment, not the schedule (§6). substitute_teacher_id
      -- is left unset — substitution is assignment-time behaviour (§3).
      ca.teacher_id,
      ca.room_id,
      ca.location_id,
      case when ca.is_rehearsal then 'rehearsal' else 'class' end,
      ca.event_date,
      ca.start_time,
      ca.end_time,
      'published',
      'approved',
      ca.trial_eligible
    from candidate ca
    where not exists (
      select 1
        from public.studio_closures sc
       where sc.tenant_id = p_tenant_id
         and sc.closed_date = ca.event_date
    )
    -- Bare form on purpose: the Phase 1 index is partial and an explicit
    -- arbiter would have to restate WHERE class_id IS NOT NULL.
    on conflict do nothing
    returning 1
  )
  select
    (select count(*) from eligible)::int,
    -- Rows actually written. ON CONFLICT skips do not appear in RETURNING, so
    -- a second identical run reports 0 here, not the candidate count.
    (select count(*) from ins)::int,
    (select count(*)
       from candidate ca
      where exists (
        select 1
          from public.studio_closures sc
         where sc.tenant_id = p_tenant_id
           and sc.closed_date = ca.event_date
      ))::int
  into v_classes, v_created, v_closed;

  return query select v_classes, v_created, v_closed;
end;
$$;

-- -----------------------------------------------------------------------------
-- Execute permission
--
-- No usable schedule-management helper exists: is_schedule_approver() reads
-- schedule_approvers, which is empty, so gating on it would lock everyone out.
-- Falling back to authenticated, with the admin-tier check enforced in the body
-- above rather than by the grant.
-- -----------------------------------------------------------------------------
revoke all on function public.generate_occurrences(uuid, date, date, uuid) from public;
grant execute on function public.generate_occurrences(uuid, date, date, uuid) to authenticated;

comment on function public.generate_occurrences(uuid, date, date, uuid) is
  'Generates schedule_instances rows for active classes across [p_from, p_to], intersected with each class''s own [start_date, end_date]. docs/OCCURRENCE_GENERATION.md §4.

NEVER TOUCHES THE PAST: only dates strictly after current_date are considered, and the function contains no UPDATE and no DELETE. Re-running over a past window is a no-op. This is what makes the occurrence a durable snapshot of who was assigned (§3) — the teacher_id written at generation is never recomputed from a live class_teachers lookup.

IDEMPOTENT via idx_schedule_instances_natural_key (migration 20260729000001) and ON CONFLICT DO NOTHING. A second identical run returns occurrences_created = 0. The bare conflict form is required because that index is partial; an explicit arbiter would have to repeat WHERE class_id IS NOT NULL.

SINGLE-TENANT ONLY, enforced by a guard that raises when tenants > 1. classes has no tenant_id column, so eligible classes cannot be scoped and a second tenant''s classes would be written under p_tenant_id. Add classes.tenant_id and scope the selection before onboarding tenant two.

Weekdays are ISO (extract(isodow), Monday=1 .. Sunday=7), pinned by classes_days_of_week_iso_check. Dates in studio_closures for the tenant are skipped and reported as dates_skipped_closed. Classes with a NULL date, time or days_of_week are skipped rather than aborting the run; zero such classes existed on 2026-07-29. Rows are written status=published, approval_status=approved, substitute_teacher_id NULL.';
