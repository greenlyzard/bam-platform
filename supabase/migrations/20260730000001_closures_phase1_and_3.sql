-- =============================================================================
-- Studio closures — Phase 1 (schema) + Phase 3 (generate_occurrences)
--
-- Spec: docs/STUDIO_CLOSURES.md §5 (data model), §6 (precedence), §12 (build
--       sequence). Amended 2026-07-30 (commit 457b6fb).
-- Depends on: 20260318215218 (studio_closures), 20260331130000
--             (studio_locations), 20260729000001 (natural-key index),
--             20260729000002 (generate_occurrences — dropped and recreated here)
--
-- Phases 1 and 3 land together deliberately. Phase 1 makes a closure a range,
-- and Phase 3 removes the generator's closure filter, which reads closures as
-- single dates (`sc.closed_date = ca.event_date`). Shipping Phase 1 alone would
-- leave a generator that honours the first day of a closure and silently
-- generates through the rest of it — a worse state than either end point.
-- Phase 2 (`apply_closures`) is NOT in this file; until it ships, closures
-- cancel nothing (§11).
--
-- WHAT THIS DOES NOT DO:
--   - No `classes` change. `classes.closure_exempt` is WITHDRAWN (§5, D1) —
--     never created, retracted rather than deferred. The pre-flight refuses to
--     run if that column is found, because its presence would mean the catalog
--     reads this migration was written against are wrong.
--   - Does not collapse the 6 Spring Break rows into one range (§5). They are
--     past dates, nothing reads them, and merging them loses how they were
--     entered. They become six one-day ranges.
--   - Does not drop `private_sessions.studio`. It stays as a free-text ROOM
--     hint ("Studio 1"), is not authoritative for location, and must not be
--     parsed for one.
--
-- Verified against the live catalog 2026-07-30:
--   studio_closures ......... 6 rows, all Spring Break 2026-04-06..04-11
--   closure_locations ....... does not exist
--   classes.closure_exempt .. does not exist (and will not)
--   private_sessions ........ 5 rows, all studio = 'Studio 1'
--   studio_locations ........ 6 rows; San Clemente = 70acde19-…-2200b0adb393
--
-- SINGLE-USE AGAINST THIS CATALOG, and re-drivable within it. Two different
-- properties, and only the second is what "idempotent" usually means:
--
--   - Every DDL statement is individually guarded (IF NOT EXISTS / IF EXISTS /
--     a pg_constraint or pg_trigger existence check), so a partial failure —
--     an interrupted push, a permissions error halfway down — can be re-driven
--     without hand-unwinding what already applied.
--   - It is NOT re-runnable indefinitely. The pre-flight pins studio_closures
--     at exactly 6 rows and private_sessions at exactly 5. Once the §15
--     2026-2027 calendar (12 rows) is entered, or a sixth private is booked,
--     this migration REFUSES TO RUN.
--
-- That refusal is the intended behaviour, not a bug to work around. The pins
-- are what make the backfills below known-correct; if the data has moved, the
-- "Studio 1 -> San Clemente" mapping and the closed_through backfill are no
-- longer statements about a catalog anyone has verified, and a human should
-- look before they are applied.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pre-flight — refuse before any DDL rather than half-applying.
--
-- The row-count assertions pin the exact catalog this migration was authored
-- against. They are strict on purpose: if the data has moved, the backfills
-- below are no longer known-correct and a human should look. Note that these
-- WILL fail once the §15 2026–2027 calendar (12 rows) is entered — this
-- migration is meant to land before that, and the failure is the point.
-- -----------------------------------------------------------------------------
do $$
declare
  v_count       int;
  v_col_count   int;
  v_named_cols  int;
  v_loc_type    text;
begin
  -- --- objects -------------------------------------------------------------
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'tenants') then
    raise exception 'Pre-flight failed: public.tenants does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_closures') then
    raise exception 'Pre-flight failed: public.studio_closures does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_locations') then
    raise exception 'Pre-flight failed: public.studio_locations does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'private_sessions') then
    raise exception 'Pre-flight failed: public.private_sessions does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'schedule_instances') then
    raise exception 'Pre-flight failed: public.schedule_instances does not exist';
  end if;

  -- Phase 3 drops and recreates this. If it is absent, 20260729000002 has not
  -- been applied and the DROP below would silently no-op into a CREATE that
  -- installs a generator this migration did not intend to author from scratch.
  if not exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'generate_occurrences') then
    raise exception 'Pre-flight failed: public.generate_occurrences does not exist. Apply 20260729000002 before this migration.';
  end if;

  -- Idempotency of the recreated generator still lives entirely in this index.
  if not exists (select 1 from pg_indexes
                 where schemaname = 'public'
                   and indexname = 'idx_schedule_instances_natural_key') then
    raise exception 'Pre-flight failed: idx_schedule_instances_natural_key is missing. Apply 20260729000001 before this migration — ON CONFLICT DO NOTHING has no arbiter without it.';
  end if;

  -- --- the withdrawn column ------------------------------------------------
  -- Not a style guard. If this column exists, the catalog reads behind every
  -- decision in this file are wrong and the migration must not proceed.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'classes'
               and column_name = 'closure_exempt') then
    raise exception 'Pre-flight failed: classes.closure_exempt EXISTS. It was verified absent and is withdrawn (docs/STUDIO_CLOSURES.md §5, D1). Something disagrees with the catalog this migration was written against — stop and reconcile before applying.';
  end if;

  -- --- studio_closures data ------------------------------------------------
  select count(*) into v_count from public.studio_closures;
  if v_count <> 6 then
    raise exception 'Pre-flight failed: studio_closures has % rows, expected exactly 6 (Spring Break 2026-04-06..04-11). If the §15 2026-2027 calendar has been entered, this migration is out of date — land it before that data.', v_count;
  end if;

  -- --- private_sessions data -----------------------------------------------
  select count(*) into v_count from public.private_sessions;
  if v_count <> 5 then
    raise exception 'Pre-flight failed: private_sessions has % rows, expected exactly 5. The "Studio 1" -> San Clemente backfill below is only known-correct for those 5.', v_count;
  end if;

  select count(*) into v_count
  from public.private_sessions
  where studio is distinct from 'Studio 1';
  if v_count > 0 then
    raise exception 'Pre-flight failed: % private_sessions rows have studio <> ''Studio 1''. The location backfill maps that one value only; a second value needs a real mapping decision.', v_count;
  end if;

  -- --- San Clemente, the backfill target -----------------------------------
  select location_type::text into v_loc_type
  from public.studio_locations
  where id = '70acde19-bd54-46c2-a4f4-2200b0adb393';

  if v_loc_type is null then
    raise exception 'Pre-flight failed: studio_locations row 70acde19-bd54-46c2-a4f4-2200b0adb393 (San Clemente) does not exist — nothing to backfill privates onto.';
  end if;

  if v_loc_type <> 'studio' then
    raise exception 'Pre-flight failed: San Clemente is location_type=%, expected ''studio''. Closures may only target studio-type locations (§5).', v_loc_type;
  end if;

  -- --- closure_locations ---------------------------------------------------
  -- Written as a SHAPE check, not a bare "does not exist" check, and this is a
  -- deliberate deviation: a bare existence check makes the migration fail on
  -- its own second run, which contradicts the re-runnability requirement. The
  -- guard's real purpose is to catch a DIFFERENT closure_locations arriving
  -- out-of-band, so it raises when the table exists with any shape other than
  -- exactly the three columns created below, and stays silent when it is ours.
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'closure_locations') then

    select count(*) into v_col_count
    from information_schema.columns
    where table_schema = 'public' and table_name = 'closure_locations';

    select count(*) into v_named_cols
    from information_schema.columns
    where table_schema = 'public' and table_name = 'closure_locations'
      and column_name in ('closure_id', 'location_id', 'tenant_id');

    if v_col_count <> 3 or v_named_cols <> 3 then
      raise exception 'Pre-flight failed: public.closure_locations already exists with an unexpected shape (% columns, % of them expected). This migration creates it with exactly closure_id, location_id, tenant_id — something else created this table.', v_col_count, v_named_cols;
    end if;

    raise notice 'closure_locations already present with the expected shape — re-run, continuing.';
  end if;
end $$;

-- =============================================================================
-- PHASE 1 — schema
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. studio_closures — range, scope, totality, exemptions
-- -----------------------------------------------------------------------------

-- Defaults carry the 6 existing rows to exactly the values §12 specifies:
-- all_studios = true, is_total = false, exempt_event_types = '{}'.
alter table public.studio_closures
  add column if not exists all_studios        boolean not null default true,
  add column if not exists is_total           boolean not null default false,
  add column if not exists exempt_event_types text[]  not null default '{}'::text[];

-- closed_through in three steps. Never added NOT NULL directly — the 6 existing
-- rows have no value for it, and a direct NOT NULL add fails against them.
alter table public.studio_closures
  add column if not exists closed_through date;

update public.studio_closures
set closed_through = closed_date
where closed_through is null;

alter table public.studio_closures
  alter column closed_through set not null;

do $$
begin
  -- A closure covers closed_date .. closed_through inclusive. Equal is a
  -- one-day closure, which is what all 6 backfilled rows now are.
  if not exists (select 1 from pg_constraint
                 where conname = 'studio_closures_range_check') then
    alter table public.studio_closures
      add constraint studio_closures_range_check
      check (closed_through >= closed_date);
  end if;

  -- Subset check against the schedule_instances.event_type domain. Without it a
  -- typo ('private_lessons', 'privates') is accepted and exempts NOTHING — the
  -- failure mode is a class quietly cancelled on a day privates were meant to
  -- run, which surfaces as a parent complaint, not an error. Kept in sync by
  -- hand with the event_type CHECK on schedule_instances (20260311000015).
  if not exists (select 1 from pg_constraint
                 where conname = 'studio_closures_exempt_event_types_check') then
    alter table public.studio_closures
      add constraint studio_closures_exempt_event_types_check
      check (exempt_event_types <@ array[
        'class', 'trial_class', 'rehearsal', 'private_lesson',
        'performance', 'room_block', 'teacher_absence', 'studio_closure'
      ]::text[]);
  end if;
end $$;

comment on column public.studio_closures.closed_through is
  'Inclusive end of the closure range. NOT NULL — a single-day closure is closed_through = closed_date, never NULL, so no consumer needs a coalesce or a NULL branch (docs/STUDIO_CLOSURES.md §5). The 6 Spring Break rows are backfilled as six one-day ranges and deliberately NOT collapsed.';

comment on column public.studio_closures.all_studios is
  'true: applies to every location_type=''studio'' location, including studios that do not exist yet. false: applies only to the studios listed in closure_locations. A nullable location_id cannot express "all studios" — see §5.';

comment on column public.studio_closures.is_total is
  'Nobody in the building. Defeats EVERY exemption and EVERY override, including a teacher''s private overrides_closure and an admin''s per-occurrence class override (§6). An override path that survived it would make this flag decorative.';

comment on column public.studio_closures.exempt_event_types is
  'Partial-closure exemptions by schedule_instances.event_type. Confirmed value is {private_lesson} (Amanda, 2026-07-30) — privates run, rehearsals STOP. Constrained to the event_type domain so a typo cannot silently exempt nothing.';

-- -----------------------------------------------------------------------------
-- 2. closure_locations — which studios a non-all_studios closure targets
--
-- tenant_id FK: there was no action to match. studio_closures.tenant_id has NO
-- foreign key at all — it is a bare `uuid NOT NULL` from 20260318215218,
-- confirmed by an empty Relationships array in types/database.types.ts. Rather
-- than propagate that, this table gets a real FK matching studio_locations, the
-- other parent: REFERENCES tenants(id) ON DELETE CASCADE.
--
-- location_id is ON DELETE RESTRICT per spec: a studio referenced by a closure
-- must not vanish underneath it. Note the interaction — because RESTRICT is
-- checked immediately rather than at end of statement, deleting a TENANT (which
-- cascades into studio_locations) will fail while closure rows reference its
-- studios. Tenant deletion is not a live operation, and a loud failure there is
-- the right outcome anyway.
-- -----------------------------------------------------------------------------
create table if not exists public.closure_locations (
  closure_id  uuid not null references public.studio_closures(id)  on delete cascade,
  location_id uuid not null references public.studio_locations(id) on delete restrict,
  tenant_id   uuid not null references public.tenants(id)          on delete cascade,
  primary key (closure_id, location_id)
);

-- PK covers (closure_id, location_id). This one serves the reverse lookup
-- apply_closures needs: "is this occurrence's location in scope for a closure".
create index if not exists closure_locations_location_idx
  on public.closure_locations (location_id);

create index if not exists closure_locations_tenant_idx
  on public.closure_locations (tenant_id);

comment on table public.closure_locations is
  'Which studios a closure targets when all_studios = false. One row per targeted studio; empty when all_studios = true. Studio-type locations ONLY — a closure of the studio has no authority over Casa Romantica or a storage unit (docs/STUDIO_CLOSURES.md §5). Enforced by trg_closure_locations_studio_only.';

-- --- the studio-type rule ----------------------------------------------------
-- IMPLEMENTED AS A TRIGGER, not left to application code. A CHECK cannot read
-- another table, and the house style already uses a BEFORE INSERT OR UPDATE
-- trigger that RAISEs to enforce an invariant a CHECK cannot express
-- (20260728000005, paid-entry immutability). This follows that precedent.
--
-- It enforces two cross-table invariants at once: the referenced location is
-- studio-type, and the tenant on this row agrees with BOTH parents. The tenant
-- check exists because closure_locations.tenant_id is denormalized from two
-- places at once and nothing else would catch a disagreement.
--
-- SECURITY DEFINER IS LOAD-BEARING — do not remove it as gratuitous. This
-- function reads studio_locations, which carries a restrictive SELECT policy:
-- "Authenticated users can view active locations" USING (is_active = true)
-- (20260331130000). As SECURITY INVOKER, an INACTIVE studio is invisible to the
-- caller, v_loc_type comes back NULL, and the function raises "no
-- studio_locations row %" — an error asserting a row does not exist when it
-- exists and is merely filtered. A validation trigger has to read ground truth
-- regardless of who is calling it. `set search_path = public, pg_temp` below is
-- the required companion to DEFINER and must stay with it.
create or replace function public.closure_locations_validate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_loc_type   public.location_type;
  v_loc_tenant uuid;
  v_clo_tenant uuid;
begin
  select sl.location_type, sl.tenant_id
    into v_loc_type, v_loc_tenant
  from public.studio_locations sl
  where sl.id = new.location_id;

  if v_loc_type is null then
    raise exception 'closure_locations: no studio_locations row %', new.location_id;
  end if;

  if v_loc_type <> 'studio' then
    raise exception 'closure_locations: location % is location_type=%, but a closure may only target studio-type locations (docs/STUDIO_CLOSURES.md §5)', new.location_id, v_loc_type;
  end if;

  select sc.tenant_id into v_clo_tenant
  from public.studio_closures sc
  where sc.id = new.closure_id;

  if v_clo_tenant is null then
    raise exception 'closure_locations: no studio_closures row %', new.closure_id;
  end if;

  if new.tenant_id <> v_clo_tenant then
    raise exception 'closure_locations: tenant_id % does not match closure %''s tenant %', new.tenant_id, new.closure_id, v_clo_tenant;
  end if;

  if new.tenant_id <> v_loc_tenant then
    raise exception 'closure_locations: tenant_id % does not match location %''s tenant %', new.tenant_id, new.location_id, v_loc_tenant;
  end if;

  return new;
end $fn$;

drop trigger if exists trg_closure_locations_studio_only on public.closure_locations;
create trigger trg_closure_locations_studio_only
  before insert or update on public.closure_locations
  for each row execute function public.closure_locations_validate();

-- --- RLS ---------------------------------------------------------------------
-- Matches the parent table exactly (studio_closures, 20260318215218): admins
-- manage, any authenticated user reads. Deliberately not made stricter than the
-- parent — a closure that is visible while the studios it targets are not would
-- render a location-scoped closure as a tenant-wide one on every read surface,
-- which is the specific bug this table exists to prevent.
alter table public.closure_locations enable row level security;

drop policy if exists "admin_full_closure_locations" on public.closure_locations;
create policy "admin_full_closure_locations" on public.closure_locations
  for all using (is_admin());

drop policy if exists "authenticated_read_closure_locations" on public.closure_locations;
create policy "authenticated_read_closure_locations" on public.closure_locations
  for select using (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- 3. private_sessions — real location, and the per-private override
--
-- location_id is the PREREQUISITE for location-scoped enforcement on privates
-- (§11). It is location_id and not room_id on purpose: closures are
-- location-scoped (RSM can close while San Clemente stays open), while a single
-- room closing is already representable as
-- schedule_instances.event_type = 'room_block'.
-- -----------------------------------------------------------------------------
alter table public.private_sessions
  add column if not exists location_id uuid references public.studio_locations(id) on delete restrict;

alter table public.private_sessions
  add column if not exists overrides_closure boolean not null default false;

-- Backfill: 5 rows, all free-text "Studio 1", which is a ROOM at San Clemente.
-- Done now because it gets harder with time — five rows of one known value is a
-- trivial mapping; a year of privates across two studios entered as free text
-- is a reconstruction job (§5).
update public.private_sessions
set location_id = '70acde19-bd54-46c2-a4f4-2200b0adb393'
where location_id is null
  and studio = 'Studio 1';

create index if not exists private_sessions_location_idx
  on public.private_sessions (location_id);

comment on column public.private_sessions.location_id is
  'The studio this private happens at. Authoritative for closure scoping. Backfilled 2026-07-30 from free-text studio = "Studio 1" -> San Clemente for all 5 then-existing rows.';

comment on column public.private_sessions.studio is
  'LEGACY free-text ROOM hint ("Studio 1"). NOT authoritative for location and MUST NOT be parsed for one — use location_id. Retained until rooms are properly modelled (docs/STUDIO_CLOSURES.md §5).';

comment on column public.private_sessions.overrides_closure is
  'This private runs even if its studio is closed that day. Settable by ANY teacher who can schedule privates — no admin gate; it is their lesson, their student, their call (§6). Defeated by is_total, which nothing overrides.';

-- =============================================================================
-- PHASE 3 — generate_occurrences stops filtering on closures
--
-- Closures become a cancellation pass (apply_closures, Phase 2), not a
-- generation filter, so the generator ignores studio_closures entirely and the
-- dates_skipped_closed return column goes away.
--
-- This is a BREAKING CHANGE to a published contract (OCCURRENCE_GENERATION.md
-- §4) and now is the cheap moment: the function is called from nowhere, no cron
-- depends on its signature, and the first full-season generation has not run.
--
-- The return type changes, so CREATE OR REPLACE cannot do it — DROP first. The
-- signature below is the exact 4-argument overload from 20260729000002;
-- p_class_id's DEFAULT is not part of the identity and is not written here.
--
-- Everything else in the body is carried over verbatim: the multi-tenant guard,
-- the admin check, argument sanity, the eligible/candidate CTEs, ISO weekday
-- matching, the never-touch-the-past filter, and the bare ON CONFLICT DO
-- NOTHING. Only the closure exclusion and its counter are removed.
-- =============================================================================

drop function if exists public.generate_occurrences(uuid, date, date, uuid);

create or replace function public.generate_occurrences(
  p_tenant_id uuid,
  p_from      date,
  p_to        date,
  p_class_id  uuid default null
)
returns table (
  classes_processed   int,
  occurrences_created int
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_classes int := 0;
  v_created int := 0;
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
  -- privileged; a logged-in caller must be admin-tier.
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
  -- `eligible`  : status='active' AND is_active, per §4. Classes missing any
  --               field generation needs are excluded rather than aborting the
  --               season.
  -- `candidate` : the intersection of [p_from, p_to] with the class's own
  --               [start_date, end_date], restricted to ISO weekday matches and
  --               to future dates.
  -- `ins`       : the insert. NO CLOSURE FILTER — closures are applied
  --               afterwards by apply_closures, which cancels occurrences
  --               rather than preventing them (STUDIO_CLOSURES.md §4).
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
      -- The gap is in the assignment, not the schedule.
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
    -- Bare form on purpose: the Phase 1 index is partial and an explicit
    -- arbiter would have to restate WHERE class_id IS NOT NULL.
    on conflict do nothing
    returning 1
  )
  select
    (select count(*) from eligible)::int,
    -- Rows actually written. ON CONFLICT skips do not appear in RETURNING, so
    -- a second identical run reports 0 here, not the candidate count.
    (select count(*) from ins)::int
  into v_classes, v_created;

  return query select v_classes, v_created;
end;
$$;

-- -----------------------------------------------------------------------------
-- Execute permission — reapplied, because DROP FUNCTION took the old grants
-- with it. Same posture as 20260729000002: authenticated, with the admin-tier
-- check enforced in the body rather than by the grant.
-- -----------------------------------------------------------------------------
revoke all on function public.generate_occurrences(uuid, date, date, uuid) from public;
grant execute on function public.generate_occurrences(uuid, date, date, uuid) to authenticated;

comment on function public.generate_occurrences(uuid, date, date, uuid) is
  'Generates schedule_instances rows for active classes across [p_from, p_to], intersected with each class''s own [start_date, end_date]. docs/OCCURRENCE_GENERATION.md §4.

IGNORES CLOSURES, as of 2026-07-30 (docs/STUDIO_CLOSURES.md Phase 3). Closures are a CANCELLATION PASS, not a generation filter: generate the full season, then run apply_closures to cancel occurrences under a closure. This removed the dates_skipped_closed return column — a breaking change to the published contract, made while the function was called from nowhere. A cancelled occurrence is visible history ("this class was cancelled for Thanksgiving") where a never-generated one is a silent absence, and cancellation is the un-generate path that generation alone never had.

NEVER TOUCHES THE PAST: only dates strictly after current_date are considered, and the function contains no UPDATE and no DELETE. Re-running over a past window is a no-op. This is what makes the occurrence a durable snapshot of who was assigned — the teacher_id written at generation is never recomputed from a live class_teachers lookup.

IDEMPOTENT via idx_schedule_instances_natural_key (migration 20260729000001) and ON CONFLICT DO NOTHING. A second identical run returns occurrences_created = 0. The bare conflict form is required because that index is partial; an explicit arbiter would have to repeat WHERE class_id IS NOT NULL.

SINGLE-TENANT ONLY, enforced by a guard that raises when tenants > 1. classes has no tenant_id column, so eligible classes cannot be scoped and a second tenant''s classes would be written under p_tenant_id. Add classes.tenant_id and scope the selection before onboarding tenant two.

Weekdays are ISO (extract(isodow), Monday=1 .. Sunday=7), pinned by classes_days_of_week_iso_check. Classes with a NULL date, time or days_of_week are skipped rather than aborting the run; zero such classes existed on 2026-07-29. Rows are written status=published, approval_status=approved, substitute_teacher_id NULL.';

-- =============================================================================
-- POST-FLIGHT
-- =============================================================================
do $$
declare
  v_count   int;
  v_cols    int;
  v_def     text;
begin
  -- --- studio_closures -----------------------------------------------------
  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'studio_closures'
    and column_name in ('all_studios', 'is_total', 'exempt_event_types', 'closed_through');
  if v_cols <> 4 then
    raise exception 'Post-flight failed: studio_closures is missing new columns (% of 4 present)', v_cols;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'studio_closures'
               and column_name = 'closed_through' and is_nullable = 'YES') then
    raise exception 'Post-flight failed: studio_closures.closed_through is still nullable';
  end if;

  -- The backfill assertion, checked here because closed_through does not exist
  -- at pre-flight time on a first run.
  select count(*) into v_count
  from public.studio_closures
  where closed_through is null or closed_through < closed_date;
  if v_count > 0 then
    raise exception 'Post-flight failed: % studio_closures rows have a null or inverted range', v_count;
  end if;

  select count(*) into v_count from public.studio_closures;
  if v_count <> 6 then
    raise exception 'Post-flight failed: studio_closures row count changed to % — this migration must not create or destroy closures (the 6 Spring Break rows are NOT collapsed)', v_count;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'studio_closures_range_check') then
    raise exception 'Post-flight failed: studio_closures_range_check was not created';
  end if;

  if not exists (select 1 from pg_constraint where conname = 'studio_closures_exempt_event_types_check') then
    raise exception 'Post-flight failed: studio_closures_exempt_event_types_check was not created';
  end if;

  -- --- closure_locations ---------------------------------------------------
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'closure_locations') then
    raise exception 'Post-flight failed: closure_locations was not created';
  end if;

  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'closure_locations'
                   and c.relrowsecurity = true) then
    raise exception 'Post-flight failed: RLS is not enabled on closure_locations';
  end if;

  if not exists (select 1 from pg_trigger
                 where tgname = 'trg_closure_locations_studio_only') then
    raise exception 'Post-flight failed: trg_closure_locations_studio_only was not created — the studio-type-only rule is unenforced';
  end if;

  -- --- private_sessions ----------------------------------------------------
  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'private_sessions'
    and column_name in ('location_id', 'overrides_closure');
  if v_cols <> 2 then
    raise exception 'Post-flight failed: private_sessions is missing new columns (% of 2 present)', v_cols;
  end if;

  select count(*) into v_count
  from public.private_sessions
  where location_id is distinct from '70acde19-bd54-46c2-a4f4-2200b0adb393';
  if v_count > 0 then
    raise exception 'Post-flight failed: % private_sessions rows did not get the San Clemente backfill', v_count;
  end if;

  -- --- generate_occurrences ------------------------------------------------
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'generate_occurrences';

  if v_def is null then
    raise exception 'Post-flight failed: generate_occurrences does not exist after the drop/create';
  end if;

  -- The whole point of Phase 3. If the body still reads studio_closures, the
  -- old definition survived and two closure mechanisms now coexist.
  if v_def like '%studio_closures%' then
    raise exception 'Post-flight failed: generate_occurrences still references studio_closures';
  end if;

  if v_def like '%dates_skipped_closed%' then
    raise exception 'Post-flight failed: generate_occurrences still returns dates_skipped_closed';
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'generate_occurrences') <> 1 then
    raise exception 'Post-flight failed: more than one generate_occurrences overload exists — the DROP targeted the wrong signature';
  end if;

  raise notice 'Closures Phase 1 + Phase 3 applied. Closures still CANCEL NOTHING until apply_closures (Phase 2) ships.';
end $$;
