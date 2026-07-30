-- =============================================================================
-- Studio closures — Phase 2: apply_closures (the cancellation pass)
--
-- Spec: docs/STUDIO_CLOSURES.md §6 (precedence ladder), §8 (the contract),
--       §9 (payroll interaction), §11 (honesty boundary), §15 (the calendar
--       this will be run against). Amended 2026-07-30 (457b6fb / 6e39ada).
-- Depends on: 20260730000001 (Phase 1 schema + Phase 3 generator),
--             20260729000002 (generate_occurrences — patterns mirrored here),
--             20260728000007 (generate_timesheet_drafts — the drafts §9 cleans up)
--
-- This is the function that finally makes a closure DO something. Until it
-- ships, closures cancel nothing (§11): Phase 3 removed the generator's closure
-- filter and nothing replaced it, so right now a closure is inert.
--
-- CANCELLATION, NOT DELETION. status='cancelled' plus a cancellation_reason
-- naming the closure. A cancelled occurrence is visible history — "this class
-- was cancelled for Thanksgiving" — and it gives a makeup credit an originating
-- row to point at (MAKEUP_POLICY.md). A deleted one is a silent absence that
-- nothing can reference.
--
-- DRY RUN BY DEFAULT. p_dry_run defaults to TRUE and a NULL argument is
-- coalesced to TRUE. This function cancels classes and deletes payroll drafts;
-- a caller who forgets the argument gets a report, never a mutation. The
-- post-flight below asserts the default actually landed as `DEFAULT true`,
-- because that one token is the whole safety property.
--
-- Verified against the live database 2026-07-30, after OCCURRENCE_GENERATION
-- Phase 4:
--   schedule_instances ...... 3,960 rows — 3,899 published, 61 cancelled
--                             span 2026-03-09 .. 2027-06-15
--                             event_type is only 'class' (2,833) and
--                             'rehearsal' (1,127) — ZERO 'private_lesson'
--                             location_id is San Clemente on all 3,899
--                             published rows; the 61 NULLs are exactly the
--                             disposed orphans (d7e7b9f)
--   studio_closures ......... still 6 Spring Break rows, 2026-04-06..04-11.
--                             The §15 2026-27 calendar is NOT loaded yet.
--                             All 6 are in the PAST, so the first real run of
--                             this function against today's data cancels
--                             nothing — by design, not by accident.
--   closure_locations ....... exists, 0 rows
--   private_sessions ........ 5 rows, all San Clemente, all
--                             overrides_closure = false
--   timesheet_entries ....... 4 rows, ALL status='draft', all linked by
--                             schedule_instance_id, none by session_id
--   generate_occurrences .... 4-arg overload, no longer reads studio_closures
--
-- DRY-RUN SIMULATED 2026-07-30 before this file was written. The target-set
-- query below was run read-only against the live schedule with the §15 calendar
-- supplied as a synthetic 12-row closure set. Result: 417 occurrences targeted,
-- 417 cancelled, 0 exempted — matching the independently-counted 417 rows that
-- sit on those 12 dates. The zero is correct and worth reading twice: nothing
-- is exempted because exempt_event_types = {private_lesson} and the schedule
-- contains no private_lesson occurrences, only class and rehearsal. Per-closure:
--   Labor Day 17 · Veterans Day 19 · Fall Recess 54 · Thanksgiving 21 (total)
--   Day after Thanksgiving 6 · Winter Recess 74 · Christmas 6 (total)
--   Winter Recess 89 · MLK 17 · Presidents 17 · Spring Recess 80 · Memorial 17
--
-- IDEMPOTENT. Two independent reasons a second run is a no-op: occurrences
-- already status='cancelled' are excluded from the target set, and drafts for
-- them were deleted on the first pass. Re-running reports zeros.
--
-- This migration only DEFINES the function. It runs nothing. The post-flight
-- asserts the cancelled-row count is still 61 and published still 3,899, so a
-- migration that accidentally executed the pass would fail loudly.
-- =============================================================================
--
-- ── THE PRECEDENCE LADDER, AND THE TWO RUNGS THAT ARE NOT REACHABLE ──────────
--
-- §6, highest first:
--
--   1. is_total = true                        -> cancelled. Nothing below is
--                                                consulted. IMPLEMENTED.
--   2. event_type ∈ exempt_event_types        -> survives. IMPLEMENTED.
--   3. private has overrides_closure = true   -> survives. NOT REACHABLE — see
--                                                below. Guarded, not guessed.
--   4. admin per-occurrence class override    -> survives. NO COLUMN EXISTS.
--   5. otherwise                              -> cancelled. IMPLEMENTED.
--
-- RUNG 4 has no column and none is invented here. §14 Q6 is open — "should an
-- admin class override be a column on the occurrence, or an audited action?" —
-- and answering it by picking one in a migration would settle a design question
-- by side effect. The ladder below is written as an ordered CASE with rung 4's
-- slot marked, so adding it later is one WHEN branch in one expression and
-- nothing else moves.
--
-- RUNG 3 is a different problem, and it is worth being precise about because it
-- looks implementable and is not. There is NO LINK between schedule_instances
-- and private_sessions — no private_session_id column on the occurrence, no
-- schedule_instance_id on the private, verified against types/database.types.ts
-- and the live catalog on 2026-07-30. Privates live in their own table and are
-- not materialized as occurrences; schedule_instances contains zero rows with
-- event_type='private_lesson'. So an occurrence cannot be asked "is there a
-- private behind you that overrides this closure." Matching on
-- (date, time, teacher) would be a join rule this spec does not define, and a
-- wrong match there cancels a lesson a teacher deliberately protected.
--
-- Rung 3 is unreachable in practice anyway, for every closure in §15: rung 2
-- already saves privates. Every partial closure carries
-- exempt_event_types = {private_lesson} (D5), so a private_lesson occurrence
-- survives at rung 2 and rung 3 is never consulted. And under an is_total
-- closure rung 1 fires first and DEFEATS overrides_closure by design (§6) —
-- nobody in the building means nobody. Rung 3 can only matter for a partial
-- closure that does NOT exempt private_lesson, over a private_lesson
-- occurrence. That combination does not exist today and cannot be evaluated
-- correctly if it appears, so the function RAISES on it rather than silently
-- cancelling a private that may have been overridden. Zero rows hit this now;
-- the guard is there for the day someone saves a closure with an empty exempt
-- list.
--
-- A consequence worth stating plainly: THIS FUNCTION DOES NOT CANCEL PRIVATE
-- SESSIONS. It operates on schedule_instances only, which is what §8's
-- "occurrence" and its occurrences_cancelled counter mean. private_sessions has
-- its own status/cancelled_at/cancellation_reason and is untouched here.
-- Closure enforcement on privates is Phase 5 (§10, §12) — refuse a booking
-- under an is_total closure, allow it under a partial closure that exempts
-- private_lesson. Until that ships, an is_total closure stops classes and
-- rehearsals and does NOT stop an already-booked private. That is a real gap,
-- not a rounding error, and it belongs in §11's honesty boundary.
--
-- ── LOCATION SCOPING: A CONFLICT INSIDE THE SPEC ─────────────────────────────
--
-- §8 says in scope when "the closure has all_studios = true, or the
-- occurrence's location_id appears in closure_locations for that closure."
-- Implemented verbatim below.
--
-- §5 says something narrower: all_studios = true "applies to every
-- location_type='studio' location." And §1 states the motivating case outright:
-- "A San Clemente closure must not cancel a performance at Casa Romantica."
-- Under §8's literal rule an all_studios closure DOES reach Casa Romantica,
-- because it reaches everything.
--
-- These disagree. No occurrence is affected today — all 3,899 published rows
-- are at San Clemente, a studio-type location, and the partner venues hold zero
-- occurrences — so the two readings are indistinguishable on current data. The
-- conflict is resolved defensively rather than by guessing:
--
--   - Scoping follows §8 literally (all_studios reaches every location).
--   - Before writing, the function COUNTS in-scope cancel targets sitting at a
--     non-studio location under an all_studios closure. In a dry run it reports
--     them as a NOTICE. On a real run it RAISES and cancels nothing.
--
-- So the §1 case cannot be executed by accident, and the dry run is what tells
-- a human it is about to happen. To adopt §5's reading instead, add
--       and (sl.location_type = 'studio' or si.location_id is null)
-- to the all_studios branch of the scope predicate and delete the guard.
-- §8 needs amending either way — flagged, not silently diverged from (CLAUDE.md
-- §16).
--
-- ── OVERLAPPING CLOSURES ─────────────────────────────────────────────────────
--
-- §6's ladder is written per closure and the spec does not say what happens
-- when two closures cover the same date. §15's calendar has no overlaps, but
-- nothing prevents one. The tie-break here: an occurrence is CANCELLED if ANY
-- covering closure cancels it, and the cancellation is attributed to the
-- highest-priority cancelling closure (is_total first, then earliest
-- closed_date, then id). An occurrence is only EXEMPTED if EVERY covering
-- closure exempts it. Closed-wins is the conservative reading — a closure that
-- does not exempt an event type is a statement that the studio is closed for
-- it, and one closure's exemption should not reopen another closure's day.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pre-flight — refuse before creating anything, rather than installing a
-- function that fails at call time on a missing column.
-- -----------------------------------------------------------------------------
do $$
declare
  v_cols int;
  v_def  text;
begin
  -- --- tables this function reads or writes --------------------------------
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'tenants') then
    raise exception 'Pre-flight failed: public.tenants does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'schedule_instances') then
    raise exception 'Pre-flight failed: public.schedule_instances does not exist';
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
                 where table_schema = 'public' and table_name = 'timesheet_entries') then
    raise exception 'Pre-flight failed: public.timesheet_entries does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'timesheets') then
    raise exception 'Pre-flight failed: public.timesheets does not exist — blocked entries cannot be reported by teacher without it';
  end if;

  -- --- Phase 1: closure_locations ------------------------------------------
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'closure_locations') then
    raise exception 'Pre-flight failed: public.closure_locations does not exist. Apply 20260730000001 (closures Phase 1) before this migration — without it a non-all_studios closure has no scope and would cancel nothing.';
  end if;

  -- --- Phase 1: the four studio_closures columns ---------------------------
  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'studio_closures'
    and column_name in ('all_studios', 'is_total', 'exempt_event_types', 'closed_through');
  if v_cols <> 4 then
    raise exception 'Pre-flight failed: studio_closures is missing Phase 1 columns (% of 4 present — expected all_studios, is_total, exempt_event_types, closed_through). Apply 20260730000001 first.', v_cols;
  end if;

  -- closed_through is NOT NULL by Phase 1, and the range scan below relies on
  -- it: `event_date between closed_date and closed_through` silently matches
  -- NOTHING for a row whose closed_through is null. A nullable column here
  -- would make every closure invisible to this function rather than erroring.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'studio_closures'
               and column_name = 'closed_through' and is_nullable = 'YES') then
    raise exception 'Pre-flight failed: studio_closures.closed_through is nullable. §5 requires NOT NULL; BETWEEN against a NULL upper bound matches no rows, so every closure would be silently skipped.';
  end if;

  -- --- Phase 1: private_sessions -------------------------------------------
  -- Not read by this function (rung 3 is unreachable — see header), but their
  -- absence means Phase 1 did not fully apply and the ladder's premises differ
  -- from what is documented above.
  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'private_sessions'
    and column_name in ('location_id', 'overrides_closure');
  if v_cols <> 2 then
    raise exception 'Pre-flight failed: private_sessions is missing Phase 1 columns (% of 2 present — expected location_id, overrides_closure). Apply 20260730000001 first.', v_cols;
  end if;

  -- --- the columns this function writes ------------------------------------
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'schedule_instances'
                   and column_name = 'cancellation_reason') then
    raise exception 'Pre-flight failed: schedule_instances.cancellation_reason does not exist — cancellation would be indistinguishable from any other cancellation';
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'timesheet_entries'
                   and column_name = 'schedule_instance_id') then
    raise exception 'Pre-flight failed: timesheet_entries.schedule_instance_id does not exist — §9 draft cleanup has no link to follow';
  end if;

  -- The legacy second link. 20260312000001 created timesheet_entries.session_id
  -- referencing schedule_instances(id); 20260728000007 writes the newer
  -- schedule_instance_id instead. Zero live rows use session_id, but §9 says
  -- "entries that REFERENCE a cancelled occurrence" — provenance is not the
  -- test — so both links are followed below and both must exist.
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'timesheet_entries'
                   and column_name = 'session_id') then
    raise exception 'Pre-flight failed: timesheet_entries.session_id does not exist — the legacy occurrence link this function also follows is gone; revisit the draft cleanup predicate';
  end if;

  -- --- the status vocabulary §9 depends on ---------------------------------
  -- Read from 20260315000006 / 20260313000012, not assumed:
  --   timesheet_entries.status ∈ (draft, submitted, approved, flagged, adjusted, paid)
  -- §9 names draft / submitted / approved / paid. 'flagged' and 'adjusted' are
  -- also live values and are NOT draft, so they fall on the protected side —
  -- reported, never deleted. If this constraint is gone, that vocabulary is no
  -- longer pinned and "delete only drafts" is no longer a bounded statement.
  if not exists (select 1 from pg_constraint where conname = 'timesheet_entries_status_check') then
    raise exception 'Pre-flight failed: timesheet_entries_status_check is missing. §9 draft-only deletion depends on a pinned status vocabulary (draft, submitted, approved, flagged, adjusted, paid).';
  end if;

  -- --- generate_occurrences ------------------------------------------------
  if not exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'generate_occurrences') then
    raise exception 'Pre-flight failed: public.generate_occurrences does not exist. Apply 20260729000002 and 20260730000001 before this migration — apply_closures cancels what that function generates, and installing the cancellation half alone is a pass with nothing to act on.';
  end if;

  -- Phase 3 must already have landed. If the generator still filters on
  -- closures, installing this function creates TWO closure mechanisms at once:
  -- generation silently skips closed dates AND this pass cancels them, so a
  -- closed day would be a mix of missing rows and cancelled rows with no way to
  -- tell which came from where.
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'generate_occurrences';

  if v_def like '%studio_closures%' then
    raise exception 'Pre-flight failed: generate_occurrences still references studio_closures. Apply 20260730000001 (Phase 3) first — the generation filter and this cancellation pass must never coexist.';
  end if;

  -- --- the authorization helper --------------------------------------------
  if not exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'is_admin') then
    raise exception 'Pre-flight failed: public.is_admin() does not exist — SECURITY DEFINER would bypass RLS with no caller check in its place';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- The cancellation pass
--
-- Signature is §8 exactly. The RETURN is a SUPERSET of §8: the four scalar
-- columns §8 specifies, in §8's order, plus three columns §8 has no room for —
-- dry_run (so a report is self-describing and a saved one cannot be mistaken
-- for a record of a write), by_closure (the per-closure breakdown), and
-- payroll_conflicts (§9's "report them by teacher and date", which a bare count
-- cannot carry). §8 should be amended to match; the scalars are unchanged so
-- nothing reading the documented contract breaks.
-- -----------------------------------------------------------------------------

-- CREATE OR REPLACE cannot change a return type, and there is no prior version
-- to preserve (verified 2026-07-30: no apply_closures exists). Dropping first
-- makes this migration re-drivable after a partial failure.
drop function if exists public.apply_closures(uuid, date, date, boolean);

create or replace function public.apply_closures(
  p_tenant_id uuid,
  p_from      date,
  p_to        date,
  p_dry_run   boolean default true
)
returns table (
  occurrences_cancelled int,
  exempted              int,
  drafts_removed        int,
  blocked_by_payroll    int,
  dry_run               boolean,
  by_closure            jsonb,
  payroll_conflicts     jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- A NULL argument is not a request to write. Coalesced rather than raised so
  -- a caller passing an unset variable gets the report, which is the whole
  -- posture of §8's "the default must be the safe one".
  v_dry        boolean := coalesce(p_dry_run, true);
  v_cancelled  int     := 0;
  v_exempt     int     := 0;
  v_drafts     int     := 0;
  v_blocked    int     := 0;
  v_by_closure jsonb   := '[]'::jsonb;
  v_conflicts  jsonb   := '[]'::jsonb;
  v_rung3      int     := 0;
  v_offsite    int     := 0;
begin
  -- ---------------------------------------------------------------------------
  -- Authorization. SECURITY DEFINER bypasses RLS on schedule_instances and
  -- timesheet_entries, so the caller is checked here — same posture as
  -- generate_occurrences (20260729000002). auth.uid() IS NULL means there is no
  -- JWT — a migration, the SQL editor, or a service-role call — which is
  -- already privileged; a logged-in caller must be admin-tier, per §7
  -- ("Run apply_closures — admin / super_admin").
  --
  -- is_admin(), not has_finance_role(), even though this deletes timesheet
  -- rows. It deletes DRAFTS ONLY and reads no rate, amount or pay figure — the
  -- payroll report it returns is teacher, date and entry status, nothing
  -- compensatory. Widening to a finance-only gate would put the closure
  -- calendar behind a role Amanda's studio admins do not hold; narrowing pay
  -- data out of the report is what keeps is_admin() correct here (CLAUDE.md §4).
  -- ---------------------------------------------------------------------------
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'apply_closures requires an admin-tier role';
  end if;

  -- ---------------------------------------------------------------------------
  -- Argument sanity
  -- ---------------------------------------------------------------------------
  if p_tenant_id is null or p_from is null or p_to is null then
    raise exception 'apply_closures requires p_tenant_id, p_from and p_to';
  end if;

  if p_to < p_from then
    raise exception 'apply_closures: p_to (%) is before p_from (%)', p_to, p_from;
  end if;

  if not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'apply_closures: no tenant %', p_tenant_id;
  end if;

  -- NOTE ON MULTI-TENANCY — deliberately no guard, unlike generate_occurrences.
  -- That function refuses to run with more than one tenant because `classes`
  -- has no tenant_id and its walk cannot be scoped. Every table this function
  -- touches carries tenant_id: schedule_instances, studio_closures,
  -- closure_locations, timesheet_entries. Each is filtered on p_tenant_id
  -- below, and closures are joined to occurrences on matching tenant_id as
  -- well, so one tenant's closure can never reach another's schedule. Copying
  -- the guard here would block a correct function for a reason that does not
  -- apply to it.

  -- ---------------------------------------------------------------------------
  -- Build the target set ONCE, into a temp table.
  --
  -- Both branches — dry run and write — read this same set, so the report is
  -- the write. Computing the counts and the mutation from two separate queries
  -- is how a dry run drifts from what it claims to predict.
  -- ---------------------------------------------------------------------------
  -- ON COMMIT DROP releases it at the caller's commit, but two calls inside one
  -- transaction would collide, so it is dropped explicitly first. Guarded with
  -- to_regclass rather than DROP TABLE IF EXISTS: on the session's first call
  -- there is no temp schema at all, and to_regclass answers that cleanly.
  if to_regclass('pg_temp._apply_closures_targets') is not null then
    drop table pg_temp._apply_closures_targets;
  end if;

  create temp table _apply_closures_targets on commit drop as
  with pair as (
    select
      si.id                 as occurrence_id,
      si.event_date         as event_date,
      si.event_type         as event_type,
      si.location_id        as location_id,
      sc.id                 as closure_id,
      sc.reason             as closure_reason,
      sc.closed_date        as closed_date,
      sc.closed_through     as closed_through,
      sc.is_total           as is_total,
      sc.all_studios        as all_studios,
      -- ─── the §6 ladder ────────────────────────────────────────────────────
      -- Ordered CASE: the first matching WHEN is the verdict, which is what
      -- makes this the ladder rather than a set of independent tests.
      case
        -- Rung 1. Nothing below is consulted. This is the branch that defeats
        -- a teacher's overrides_closure and an admin's class override alike —
        -- an override path that survived it would make is_total decorative.
        when sc.is_total then 'cancel'

        -- Rung 2. Confirmed value is {private_lesson} on every partial closure
        -- (D5) — privates carry on, rehearsals STOP. The array is constrained
        -- to the event_type domain by Phase 1, so a typo cannot land here and
        -- silently exempt nothing.
        when si.event_type = any (sc.exempt_event_types) then 'exempt'

        -- Rung 3 (private overrides_closure) would go here. It cannot be
        -- expressed: no link exists between schedule_instances and
        -- private_sessions. Guarded immediately below rather than guessed at.
        --
        -- Rung 4 (admin per-occurrence class override) would go here. No
        -- column exists and none is invented — §14 Q6 is open. When it is
        -- answered, this is one additional WHEN branch:
        --     when si.closure_override_by is not null then 'exempt'
        -- and nothing else in this function moves.

        -- Rung 5.
        else 'cancel'
      end as verdict
    from public.schedule_instances si
    join public.studio_closures sc
      on  sc.tenant_id = si.tenant_id
      -- The closure covers closed_date .. closed_through INCLUSIVE.
      -- closed_through is NOT NULL (§5, D2), so no coalesce — and the
      -- pre-flight refuses to install this function if that ever stops being
      -- true, because BETWEEN against NULL would match nothing rather than fail.
      and si.event_date between sc.closed_date and sc.closed_through
    where si.tenant_id = p_tenant_id
      and si.event_date between p_from and p_to
      -- Never touch the past. Strictly after current_date, matching the
      -- generator's rule exactly (20260729000002): current_date resolves in the
      -- server timezone (UTC), at or ahead of studio-local date, so this errs
      -- toward skipping rather than toward rewriting. A same-day closure must
      -- be applied before the day ends — a UI concern, not a reason to let this
      -- function edit history (§8 step 2).
      and si.event_date > current_date
      -- Already cancelled: skip. Two things depend on this. It makes the pass
      -- idempotent, and it protects the 61 disposed March orphans (d7e7b9f) —
      -- rows cancelled for an unrelated reason whose cancellation_reason must
      -- not be overwritten with a closure that had nothing to do with them.
      and si.status <> 'cancelled'
      -- Location scope, §8 verbatim. See the header for how this reads against
      -- §5 and §1, and for the one-line change that adopts the narrower rule.
      and (
        sc.all_studios
        or exists (
          select 1
            from public.closure_locations cl
           where cl.closure_id  = sc.id
             and cl.location_id = si.location_id
        )
      )
  ),
  ranked as (
    -- One row per occurrence. An occurrence covered by two closures is decided
    -- once: cancelling closures outrank exempting ones, is_total outranks
    -- partial for attribution, then earliest date, then id for determinism.
    select
      pr.*,
      row_number() over (
        partition by pr.occurrence_id
        order by
          (pr.verdict = 'cancel') desc,
          pr.is_total              desc,
          pr.closed_date           asc,
          pr.closure_id            asc
      ) as rn
    from pair pr
  )
  select
    occurrence_id,
    event_date,
    event_type,
    location_id,
    closure_id,
    closure_reason,
    closed_date,
    closed_through,
    is_total,
    all_studios,
    verdict
  from ranked
  where rn = 1;

  -- ---------------------------------------------------------------------------
  -- Rung 3 guard — refuse rather than guess.
  --
  -- Reached only by a private_lesson occurrence under a partial closure whose
  -- exempt_event_types does NOT include private_lesson. Under an is_total
  -- closure rung 1 fires first and is correct (overrides are defeated). Under
  -- §15's calendar rung 2 always saves it. This is the residue, and cancelling
  -- it blind could destroy a lesson a teacher deliberately protected.
  -- Zero rows today: schedule_instances holds no private_lesson occurrences.
  -- ---------------------------------------------------------------------------
  select count(*)::int into v_rung3
  from pg_temp._apply_closures_targets t
  where t.verdict = 'cancel'
    and not t.is_total
    and t.event_type = 'private_lesson';

  if v_rung3 > 0 then
    raise exception 'apply_closures: % private_lesson occurrence(s) reach precedence rung 3, which cannot be evaluated. There is no link between schedule_instances and private_sessions, so overrides_closure cannot be read for an occurrence (docs/STUDIO_CLOSURES.md §6 rung 3). Either add private_lesson to that closure''s exempt_event_types, or mark it is_total if privates really must stop, or build the link. Nothing was cancelled.', v_rung3;
  end if;

  -- ---------------------------------------------------------------------------
  -- Off-site guard — the §8-vs-§5 conflict, made visible instead of executed.
  --
  -- An all_studios closure reaching a partner_venue or internal location is
  -- exactly the case §1 says must not happen ("a San Clemente closure must not
  -- cancel a performance at Casa Romantica"), and exactly what §8's literal
  -- scope rule produces. Reported in a dry run; refused on a write. Zero rows
  -- today — the partner venues hold no occurrences.
  -- ---------------------------------------------------------------------------
  select count(*)::int into v_offsite
  from pg_temp._apply_closures_targets t
  join public.studio_locations sl on sl.id = t.location_id
  where t.verdict = 'cancel'
    and t.all_studios
    and sl.location_type <> 'studio';

  if v_offsite > 0 then
    if v_dry then
      raise notice 'apply_closures: % occurrence(s) at NON-STUDIO locations (partner_venue / internal) are in scope of an all_studios closure. §8''s scope rule reaches them; §1 and §5 say a studio closure has no authority over Casa Romantica or a storage unit. A real run will REFUSE until this is resolved.', v_offsite;
    else
      raise exception 'apply_closures: % occurrence(s) at NON-STUDIO locations would be cancelled by an all_studios closure. docs/STUDIO_CLOSURES.md §1 and §5 say a studio closure has no authority over a partner venue; §8''s scope rule does not exclude them. Resolve the spec conflict before writing. Run with p_dry_run => true to list what is affected. Nothing was cancelled.', v_offsite;
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- Counts and the per-closure breakdown — computed from the target set, so
  -- they describe the write whether or not the write happens.
  -- ---------------------------------------------------------------------------
  select
    count(*) filter (where t.verdict = 'cancel')::int,
    count(*) filter (where t.verdict = 'exempt')::int
  into v_cancelled, v_exempt
  from pg_temp._apply_closures_targets t;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'closure_id',            s.closure_id,
        'reason',                s.closure_reason,
        'closed_date',           s.closed_date,
        'closed_through',        s.closed_through,
        'is_total',              s.is_total,
        'occurrences_cancelled', s.n_cancelled,
        'exempted',              s.n_exempted
      )
      order by s.closed_date, s.closure_id
    ),
    '[]'::jsonb
  )
  into v_by_closure
  from (
    select
      t.closure_id,
      t.closure_reason,
      t.closed_date,
      t.closed_through,
      t.is_total,
      count(*) filter (where t.verdict = 'cancel')::int as n_cancelled,
      count(*) filter (where t.verdict = 'exempt')::int as n_exempted
    from pg_temp._apply_closures_targets t
    group by t.closure_id, t.closure_reason, t.closed_date, t.closed_through, t.is_total
  ) s;

  -- ---------------------------------------------------------------------------
  -- §9 — the payroll interaction.
  --
  -- Non-draft entries FIRST, and reported in full. §9: never touch an entry
  -- that is approved, submitted or paid; paid entries are immutable in date and
  -- timesheet_id by 20260728000005, and payroll history is not rewritten by a
  -- scheduling decision. 'flagged' and 'adjusted' are also live status values
  -- (timesheet_entries_status_check) and are likewise not drafts, so the test
  -- is status <> 'draft' — protected by default, which is the right direction
  -- for a predicate guarding pay.
  --
  -- The occurrence is still cancelled when this list is non-empty (§9): the
  -- occurrence is a scheduling fact, the entry is a pay fact, they are allowed
  -- to disagree, and this report is how the disagreement reaches a human.
  --
  -- Both occurrence links are followed. 20260728000007 writes
  -- schedule_instance_id; the older 20260312000001 link is session_id. §9's
  -- test is whether an entry REFERENCES a cancelled occurrence, not which
  -- generator made it. Zero live rows use session_id, so this costs nothing
  -- today and prevents a legacy entry from being missed.
  -- ---------------------------------------------------------------------------
  select
    count(*)::int,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'entry_id',      c.entry_id,
          'teacher_id',    c.teacher_id,
          'teacher_name',  c.teacher_name,
          'date',          c.entry_date,
          'entry_status',  c.entry_status,
          'occurrence_id', c.occurrence_id,
          'closure_id',    c.closure_id
        )
        order by c.teacher_name nulls last, c.entry_date, c.entry_id
      ),
      '[]'::jsonb
    )
  into v_blocked, v_conflicts
  from (
    select distinct
      te.id                                     as entry_id,
      ts.teacher_id                             as teacher_id,
      -- profiles has no full_name column (CLAUDE.md §4) — first + last, and
      -- NULL rather than a stray space when both are absent.
      nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), '')
                                                as teacher_name,
      te.date                                   as entry_date,
      te.status                                 as entry_status,
      t.occurrence_id                           as occurrence_id,
      t.closure_id                              as closure_id
    from pg_temp._apply_closures_targets t
    join public.timesheet_entries te
      on  te.tenant_id = p_tenant_id
      and (te.schedule_instance_id = t.occurrence_id or te.session_id = t.occurrence_id)
    join public.timesheets ts on ts.id = te.timesheet_id
    left join public.profiles pr on pr.id = ts.teacher_id
    where t.verdict = 'cancel'
      and te.status <> 'draft'
  ) c;

  -- Drafts that WOULD be removed. Computed before the branch so the dry-run
  -- number and the executed number come from one predicate.
  select count(*)::int into v_drafts
  from public.timesheet_entries te
  where te.tenant_id = p_tenant_id
    and te.status = 'draft'
    and exists (
      select 1
        from pg_temp._apply_closures_targets t
       where t.verdict = 'cancel'
         and (te.schedule_instance_id = t.occurrence_id or te.session_id = t.occurrence_id)
    );

  -- ---------------------------------------------------------------------------
  -- The write. Everything above this line is read-only.
  -- ---------------------------------------------------------------------------
  if not v_dry then

    -- Cancellation, not deletion. cancellation_reason names the closure, its
    -- reason, its range and its id, so the row explains itself without a join —
    -- "this class was cancelled for Thanksgiving" is the record a parent, a
    -- payroll audit and a makeup credit all need. updated_at is left to
    -- set_schedule_instances_updated_at.
    update public.schedule_instances si
    set status              = 'cancelled',
        cancellation_reason =
          'Studio closure: '
          || coalesce(nullif(trim(t.closure_reason), ''), 'unspecified')
          || ' ('
          || to_char(t.closed_date, 'YYYY-MM-DD')
          || case when t.closed_through > t.closed_date
                  then '..' || to_char(t.closed_through, 'YYYY-MM-DD')
                  else '' end
          || case when t.is_total then ', total closure' else '' end
          || ') [closure ' || t.closure_id::text || ']'
    from pg_temp._apply_closures_targets t
    where si.id        = t.occurrence_id
      and t.verdict    = 'cancel'
      and si.tenant_id = p_tenant_id
      -- Re-asserted against the row itself, not just the target set: the set
      -- was built earlier in this transaction and this is what keeps a
      -- concurrently-cancelled row's reason from being rewritten.
      and si.status   <> 'cancelled';

    get diagnostics v_cancelled = row_count;

    -- §9 cleanup. DRAFTS ONLY. Deleted rather than cancelled because a draft is
    -- a machine-made prediction of work, and the work is no longer happening —
    -- there is nothing to preserve. generate_timesheet_drafts will not recreate
    -- it: it selects si.status = 'published', and the occurrence is now
    -- cancelled.
    delete from public.timesheet_entries te
    where te.tenant_id = p_tenant_id
      and te.status = 'draft'
      and exists (
        select 1
          from pg_temp._apply_closures_targets t
         where t.verdict = 'cancel'
           and (te.schedule_instance_id = t.occurrence_id or te.session_id = t.occurrence_id)
      );

    get diagnostics v_drafts = row_count;

    raise notice 'apply_closures APPLIED: % occurrence(s) cancelled, % exempted, % draft timesheet entr(ies) deleted, % non-draft entr(ies) left for a human.',
      v_cancelled, v_exempt, v_drafts, v_blocked;
  else
    raise notice 'apply_closures DRY RUN — nothing was written. Would cancel % occurrence(s), exempt %, delete % draft timesheet entr(ies); % non-draft entr(ies) would need a human. Re-run with p_dry_run => false to apply.',
      v_cancelled, v_exempt, v_drafts, v_blocked;
  end if;

  if v_blocked > 0 then
    raise notice 'apply_closures: % timesheet entr(ies) are approved/submitted/paid/flagged/adjusted against a cancelled occurrence and were NOT touched (§9). See payroll_conflicts in the returned row — teacher and date are on each.', v_blocked;
  end if;

  return query select
    v_cancelled,
    v_exempt,
    v_drafts,
    v_blocked,
    v_dry,
    v_by_closure,
    v_conflicts;
end;
$$;

-- -----------------------------------------------------------------------------
-- Execute permission — same posture as generate_occurrences (20260729000002):
-- granted to authenticated, with the admin-tier check enforced in the body
-- rather than by the grant. Not granted to service_role: §9 is explicit that
-- this "cannot be a trigger... it touches payroll and needs a dry run, a
-- report, and a human," so there is no unattended caller to grant for.
-- -----------------------------------------------------------------------------
revoke all on function public.apply_closures(uuid, date, date, boolean) from public;
grant execute on function public.apply_closures(uuid, date, date, boolean) to authenticated;

comment on function public.apply_closures(uuid, date, date, boolean) is
  'Cancels schedule_instances that fall under a studio closure across [p_from, p_to]. docs/STUDIO_CLOSURES.md §6, §8, §9. This is the cancellation pass that replaced the generator''s closure filter (Phase 3, 2026-07-30); before it, closures cancelled nothing.

DRY RUN BY DEFAULT. p_dry_run defaults to TRUE and NULL is coalesced to TRUE. A caller who forgets the argument gets a report, never a mutation. Both paths compute from the same target set, so the dry-run numbers are the write.

CANCELS, NEVER DELETES: status=''cancelled'' plus a cancellation_reason naming the closure, its reason, its range and its id. A cancelled occurrence is visible history and gives a makeup credit an originating row to reference; a deleted one is a silent absence.

PRECEDENCE (§6): 1 is_total cancels and nothing below is consulted; 2 event_type in exempt_event_types survives; 3 private overrides_closure survives — NOT REACHABLE, there is no link between schedule_instances and private_sessions, and the function RAISES rather than guessing if an occurrence reaches this rung; 4 admin per-occurrence class override survives — NO COLUMN EXISTS, §14 Q6 is open and none is invented here; 5 otherwise cancels. Where two closures cover one date, cancelling outranks exempting.

DOES NOT CANCEL PRIVATE SESSIONS. It operates on schedule_instances only. private_sessions is a separate table with no occurrence link, so an is_total closure currently stops classes and rehearsals and does NOT stop an already-booked private. Closure enforcement on privates is Phase 5 (§10).

NEVER TOUCHES THE PAST: only event_date strictly after current_date, matching generate_occurrences. Rows already status=''cancelled'' are skipped, which makes the pass idempotent and protects the 61 disposed March orphans from having their cancellation_reason overwritten.

PAYROLL (§9): deletes timesheet_entries with status=''draft'' that reference a cancelled occurrence, by either schedule_instance_id or the legacy session_id. Everything else — submitted, approved, paid, flagged, adjusted — is left untouched and returned in payroll_conflicts with teacher and date. The occurrence is still cancelled when conflicts exist: the occurrence is a scheduling fact, the entry is a pay fact, and they are allowed to disagree.

SCOPE: a closure covers closed_date..closed_through inclusive (closed_through is NOT NULL, no coalesce). In scope when all_studios = true, or the occurrence''s location_id is listed in closure_locations for that closure. NOTE a spec conflict: §8''s all_studios rule reaches partner venues, while §1 and §5 say a studio closure has no authority over Casa Romantica. §8 is implemented; a real run REFUSES if any non-studio occurrence is in scope, and a dry run reports it. Zero occurrences are affected on 2026-07-30 data.

RETURN is a superset of §8: the four documented scalars in order, plus dry_run, by_closure (per-closure breakdown) and payroll_conflicts (§9''s by-teacher-and-date report). §8 should be amended to match.

Multi-tenant safe, unlike generate_occurrences: every table it touches carries tenant_id and is filtered on p_tenant_id, and closures join occurrences on matching tenant_id.';

-- =============================================================================
-- POST-FLIGHT
-- =============================================================================
do $$
declare
  v_args      text;
  v_overloads int;
  v_cancelled int;
  v_published int;
  v_drafts    int;
begin
  select count(*) into v_overloads
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'apply_closures';

  if v_overloads = 0 then
    raise exception 'Post-flight failed: public.apply_closures was not created';
  end if;

  if v_overloads > 1 then
    raise exception 'Post-flight failed: % apply_closures overloads exist — a caller omitting p_dry_run could resolve to the wrong one', v_overloads;
  end if;

  -- THE safety assertion. §8: "p_dry_run defaults to TRUE... a caller has to ask
  -- for the write." If that default is absent or false, every forgetful caller
  -- cancels a season instead of reading about one. This is checked from the
  -- catalog rather than trusted from the source above.
  select pg_get_function_arguments(p.oid) into v_args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'apply_closures';

  if v_args is distinct from 'p_tenant_id uuid, p_from date, p_to date, p_dry_run boolean DEFAULT true' then
    raise exception 'Post-flight failed: apply_closures signature is "%" — expected p_dry_run boolean DEFAULT true as the fourth argument (docs/STUDIO_CLOSURES.md §8)', v_args;
  end if;

  -- This migration DEFINES the pass. It must not have run it. All three counts
  -- are the verified 2026-07-30 state; any movement means the function executed
  -- during the push.
  select count(*) filter (where status = 'cancelled'),
         count(*) filter (where status = 'published')
  into v_cancelled, v_published
  from public.schedule_instances;

  if v_cancelled <> 61 then
    raise exception 'Post-flight failed: schedule_instances cancelled count is %, expected 61 (the disposed March orphans). This migration defines apply_closures and must not run it.', v_cancelled;
  end if;

  if v_published <> 3899 then
    raise exception 'Post-flight failed: schedule_instances published count is %, expected 3899. This migration defines apply_closures and must not run it.', v_published;
  end if;

  select count(*) into v_drafts from public.timesheet_entries where status = 'draft';
  if v_drafts <> 4 then
    raise exception 'Post-flight failed: draft timesheet_entries count is %, expected 4. This migration must not delete any.', v_drafts;
  end if;

  raise notice 'apply_closures created (dry-run default confirmed). Nothing has been cancelled — the function has not been run. Next: load the §15 2026-2027 calendar (12 rows), then apply_closures(tenant, from, to) with the DEFAULT dry run and read the report before writing.';
end $$;
