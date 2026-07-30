-- =============================================================================
-- Studio closures — load the 2026–2027 closure calendar (12 rows)
--
-- Spec: docs/STUDIO_CLOSURES.md §15 (the calendar), §5 (data model / ranged
--       entry), §6 (precedence). Amended 2026-07-30 (commit 457b6fb).
-- Depends on: 20260730000001 (Phase 1 schema — all_studios, is_total,
--             exempt_event_types, closed_through),
--             20260318215218 (studio_closures and its UNIQUE(tenant_id,
--             closed_date), which is this migration's idempotency arbiter)
--
-- DATA ONLY. There is no change to any object in the `public` schema — no
-- table, no column, no constraint, no index, no function, no policy. The two
-- CREATEs below are pg_temp scratch tables, dropped at the end of the file.
-- They exist so the calendar is AUTHORED ONCE and read three times (pre-flight
-- divergence check, insert, post-flight assertions) instead of being retyped
-- three times, where two copies can silently disagree. That risk is real for a
-- hand-entered calendar and is the thing this file is most likely to get wrong.
--
-- THIS MIGRATION DOES NOT RUN apply_closures. It loads the calendar and stops.
-- 417 occurrences currently sit on these 12 dates and every one of them stays
-- `published` when this file finishes — the post-flight asserts exactly that.
-- Cancelling them is a separate, deliberate act: run
--   select * from apply_closures('84d98f72-…', '2026-08-01', '2027-06-30');
-- with the DEFAULT dry run, read the report, then re-run with
-- p_dry_run => false. See 20260730000002.
--
-- LINCOLN DAY (2027-02-12) IS DELIBERATELY ABSENT — DO NOT ADD IT.
-- The studio is NOT closed on Lincoln Day. Confirmed by Amanda 2026-07-30, in
-- the same conversation that ADDED Veterans Day (§15). Feb 12 appears on many
-- California school calendars, so its absence here reads like an oversight and
-- is not one. The post-flight asserts no row is dated 2027-02-12, so a
-- well-meaning "fix" fails loudly instead of quietly closing the studio on a
-- teaching day.
--
-- Verified against the live database 2026-07-30, immediately before this file
-- was written:
--   tenants ................. 1 row: slug 'bam' = 84d98f72-c82f-414f-8b17-
--                             172b802f6993
--   studio_closures ......... 6 rows, Spring Break 2026-04-06..04-11, one per
--                             day, closed_through = closed_date, all_studios
--                             true, is_total false, exempt_event_types '{}'
--   constraints ............. studio_closures_tenant_id_closed_date_key
--                             UNIQUE (tenant_id, closed_date);
--                             studio_closures_range_check;
--                             studio_closures_exempt_event_types_check
--   triggers ................ none on studio_closures
--   closure_locations ....... 0 rows
--   schedule_instances ...... 3,899 published, 61 cancelled
--   timesheet_entries ....... 4 drafts
--   occurrences on the 12 dates (future, not already cancelled) ....... 417
--
-- ── IDEMPOTENCY: THE EXISTING UNIQUE CONSTRAINT, NOT A NEW INDEX ─────────────
--
-- The guard is `on conflict (tenant_id, closed_date) do nothing`, arbitrated by
-- studio_closures_tenant_id_closed_date_key — which has been on the table since
-- 20260318215218 and was confirmed present on live 2026-07-30. No index is
-- created here and none is needed.
--
-- The brief offered (tenant_id, closed_date, reason) as an alternative key.
-- Rejected, and the reason is not stylistic: putting `reason` in the key makes
-- it WEAKER than what the database already enforces. Under that key, someone
-- retitling "Winter Recess" to "Winter Break" in the admin UI and re-running
-- this file would INSERT A SECOND ROW on 2026-12-21 rather than be detected —
-- two overlapping closures on one date, which §6's ladder has no clean answer
-- for. (t, closed_date) is the real natural key: at most one closure per studio
-- per day. Divergence in `reason` is not something to route around with a wider
-- key; it is a signal to stop, which is what the pre-flight does with it.
--
-- The pre-flight and the conflict clause divide the work:
--   - conflict clause -> a row already present with the RIGHT values is skipped
--   - pre-flight      -> a row already present with DIFFERENT values RAISES
-- Without the second half, `do nothing` would quietly bless a divergent row and
-- report success. A partial or edited prior load is a reconcile-by-hand
-- situation (per the brief), and it is treated as one.
--
-- RE-DRIVABLE, INCLUDING FROM A PARTIAL LOAD. The pre-flight does not pin the
-- row count at 6. It pins the row CONTENT: every row already in the table must
-- be either one of the 6 Spring Break rows or one of these 12, matching exactly.
-- So 6 rows (first run), 18 rows (clean re-run), and 6+n (re-drive after an
-- interrupted push) all pass, while an unrecognised or edited row does not.
--
-- ── TENANT RESOLUTION: BY LOOKUP, CHECKED AGAINST THE LITERAL ────────────────
--
-- Resolved as `select id from tenants where slug = 'bam'`. That lookup is the
-- established pattern in this repo — 20260312000001, 20260312000004,
-- 20260312000005 all use it verbatim. (The July 2026 migrations —
-- 20260728000002/4/8 — hardcode the UUID instead; both styles are live, and the
-- lookup is the one the brief asks for.)
--
-- The pre-flight does not just take the lookup's word for it. It asserts
-- exactly one row has slug 'bam' AND that its id equals the documented BAM
-- tenant UUID. A lookup alone would happily load BAM's holiday calendar into
-- whatever tenant happened to claim the slug; the literal alone would survive a
-- database where that id means something else. Requiring both means a
-- disagreement between the two is an error rather than a silent choice.
--
-- ── WHY NO closure_locations ROWS ────────────────────────────────────────────
--
-- Every row is all_studios = true (§15), so the join table is not involved:
-- closure_locations is populated only when all_studios = false (§5). The
-- post-flight asserts it is still empty, because a row appearing there would
-- mean one of these closures was scoped to specific studios and is therefore
-- not the tenant-wide closure §15 describes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The calendar — §15, authored once.
--
-- Every row: all_studios = true.
-- Every PARTIAL row: exempt_event_types = '{private_lesson}' — privates carry
--   on, rehearsals STOP. There is no rehearsal exemption anywhere (§15, §14 Q1).
-- The two is_total rows: exempt_event_types = '{}'. Under a total closure
--   nothing is exempt. Rung 1 of §6's ladder fires before rung 2 ever reads the
--   array, so '{private_lesson}' there would be inert rather than wrong — but it
--   would read as "privates run on Christmas," which is the opposite of what
--   is_total means. An empty list is the honest encoding.
--
-- Winter Recess is THREE rows, not one (§15): Christmas Day is total and sits
-- between two partial stretches, and a total day cannot be expressed inside a
-- partial range. The two Winter Recess rows share a reason and differ in date,
-- which the (tenant_id, closed_date) key handles without complaint.
--
-- pg_temp, dropped at the end of this file. Guarded with to_regclass rather
-- than DROP TABLE IF EXISTS, matching 20260730000002: on a session's first
-- statement there may be no temp schema at all, and to_regclass answers that
-- cleanly.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('pg_temp._closure_calendar_2026_2027') is not null then
    drop table pg_temp._closure_calendar_2026_2027;
  end if;
end $$;

create temp table _closure_calendar_2026_2027 (
  closed_date        date    not null primary key,
  closed_through     date    not null,
  reason             text    not null,
  is_total           boolean not null,
  all_studios        boolean not null,
  exempt_event_types text[]  not null
);

insert into _closure_calendar_2026_2027
  (closed_date, closed_through, reason, is_total, all_studios, exempt_event_types)
values
  ('2026-09-07', '2026-09-07', 'Labor Day',              false, true, '{private_lesson}'::text[]),
  ('2026-11-11', '2026-11-11', 'Veterans Day',           false, true, '{private_lesson}'::text[]),
  ('2026-11-23', '2026-11-25', 'Fall Recess',            false, true, '{private_lesson}'::text[]),
  ('2026-11-26', '2026-11-26', 'Thanksgiving Day',       true,  true, '{}'::text[]),
  ('2026-11-27', '2026-11-27', 'Day after Thanksgiving', false, true, '{private_lesson}'::text[]),
  ('2026-12-21', '2026-12-24', 'Winter Recess',          false, true, '{private_lesson}'::text[]),
  ('2026-12-25', '2026-12-25', 'Christmas Day',          true,  true, '{}'::text[]),
  ('2026-12-26', '2027-01-01', 'Winter Recess',          false, true, '{private_lesson}'::text[]),
  ('2027-01-18', '2027-01-18', 'MLK Day',                false, true, '{private_lesson}'::text[]),
  ('2027-02-15', '2027-02-15', 'Presidents Day',         false, true, '{private_lesson}'::text[]),
  ('2027-04-05', '2027-04-09', 'Spring Recess',          false, true, '{private_lesson}'::text[]),
  ('2027-05-31', '2027-05-31', 'Memorial Day',           false, true, '{private_lesson}'::text[]);
  -- NO 2027-02-12 ROW. Lincoln Day is not a closure — see the header. The
  -- post-flight enforces its absence.

-- -----------------------------------------------------------------------------
-- The 6 pre-existing Spring Break rows, restated so both flights can assert
-- they are untouched. This is the "do not touch the 6" requirement made
-- checkable rather than assumed: this migration writes nothing that could reach
-- them (their dates are not in the calendar above and there is no UPDATE in
-- this file), and the post-flight proves it rather than arguing it.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('pg_temp._spring_break_2026') is not null then
    drop table pg_temp._spring_break_2026;
  end if;
end $$;

create temp table _spring_break_2026 (
  closed_date        date    not null primary key,
  closed_through     date    not null,
  reason             text    not null,
  is_total           boolean not null,
  all_studios        boolean not null,
  exempt_event_types text[]  not null
);

-- Six one-day ranges, NOT collapsed into 2026-04-06..04-11 (§5, and the Phase 1
-- header): past dates, nothing reads them, and merging loses how they were
-- entered. exempt_event_types is '{}' on all six — they predate the confirmed
-- {private_lesson} exemption and are not retrofitted with it, which is why the
-- "every partial row carries {private_lesson}" assertion below is scoped to the
-- 12 new rows and would be FALSE if applied to the whole table.
insert into _spring_break_2026
  (closed_date, closed_through, reason, is_total, all_studios, exempt_event_types)
select d::date, d::date, 'Spring Break', false, true, '{}'::text[]
from generate_series('2026-04-06'::date, '2026-04-11'::date, interval '1 day') as g(d);

-- =============================================================================
-- PRE-FLIGHT — refuse before writing anything.
-- =============================================================================
do $$
declare
  v_tenant      uuid;
  v_tenant_n    int;
  v_cols        int;
  v_count       int;
  v_detail      text;
  c_bam         constant uuid := '84d98f72-c82f-414f-8b17-172b802f6993';
begin
  -- --- objects ---------------------------------------------------------------
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'tenants') then
    raise exception 'Pre-flight failed: public.tenants does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_closures') then
    raise exception 'Pre-flight failed: public.studio_closures does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'closure_locations') then
    raise exception 'Pre-flight failed: public.closure_locations does not exist. Apply 20260730000001 (closures Phase 1) before this migration.';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'schedule_instances') then
    raise exception 'Pre-flight failed: public.schedule_instances does not exist — the post-flight cannot prove nothing was cancelled without it';
  end if;

  -- --- Phase 1 columns -------------------------------------------------------
  -- Without these the INSERT below fails on unknown columns anyway, but it
  -- would fail mid-statement with a bare Postgres error naming one column. This
  -- names the migration to apply instead.
  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'studio_closures'
    and column_name in ('all_studios', 'is_total', 'exempt_event_types', 'closed_through');
  if v_cols <> 4 then
    raise exception 'Pre-flight failed: studio_closures is missing Phase 1 columns (% of 4 present — expected all_studios, is_total, exempt_event_types, closed_through). Apply 20260730000001 before this migration.', v_cols;
  end if;

  -- closed_through NOT NULL is what makes a closure a range everywhere
  -- downstream. apply_closures scans `event_date between closed_date and
  -- closed_through`, which matches NOTHING against a NULL upper bound — a
  -- nullable column here would make every row loaded below silently inert
  -- rather than raise.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'studio_closures'
               and column_name = 'closed_through' and is_nullable = 'YES') then
    raise exception 'Pre-flight failed: studio_closures.closed_through is nullable. §5 requires NOT NULL. Apply 20260730000001 before this migration.';
  end if;

  -- --- the idempotency arbiter -----------------------------------------------
  -- ON CONFLICT (tenant_id, closed_date) needs a unique index over exactly
  -- those columns. If it is gone, the conflict clause raises "no unique or
  -- exclusion constraint matching the ON CONFLICT specification" — a correct
  -- refusal, but this one explains what to restore.
  -- Matched on the COLUMN SET, not on conkey's literal ordering and not on the
  -- constraint's name: ON CONFLICT resolves by columns, so that is what has to
  -- be true. A rebuild that renamed the constraint or declared it
  -- (closed_date, tenant_id) is still a valid arbiter and should not fail here.
  if not exists (
    select 1
    from pg_constraint con
    where con.conrelid = 'public.studio_closures'::regclass
      and con.contype  = 'u'
      and (
        select array_agg(a.attname::text order by a.attname)
        from unnest(con.conkey) as k(attnum)
        join pg_attribute a
          on a.attrelid = con.conrelid and a.attnum = k.attnum
      ) = array['closed_date', 'tenant_id']
  ) then
    raise exception 'Pre-flight failed: the UNIQUE (tenant_id, closed_date) constraint on studio_closures is missing (studio_closures_tenant_id_closed_date_key, from 20260318215218). It is this migration''s ON CONFLICT arbiter and the only thing making a re-run a no-op — without it a second run duplicates all 12 closures.';
  end if;

  -- --- the exempt_event_types domain check -----------------------------------
  -- 'private_lesson' is written 10 times below. If the subset CHECK from Phase 1
  -- is absent, a typo in one of them would be accepted and would exempt NOTHING
  -- — surfacing months later as a class cancelled on a day privates were meant
  -- to run, not as an error.
  if not exists (select 1 from pg_constraint
                 where conname = 'studio_closures_exempt_event_types_check') then
    raise exception 'Pre-flight failed: studio_closures_exempt_event_types_check is missing. It is what stops a mistyped exemption from being accepted and silently exempting nothing. Apply 20260730000001 before this migration.';
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'studio_closures_range_check') then
    raise exception 'Pre-flight failed: studio_closures_range_check is missing (closed_through >= closed_date). Apply 20260730000001 before this migration.';
  end if;

  -- --- the tenant, by lookup, cross-checked against the literal --------------
  select count(*) into v_tenant_n from public.tenants where slug = 'bam';

  if v_tenant_n = 0 then
    raise exception 'Pre-flight failed: no tenant with slug ''bam''. This calendar is BAM''s and there is nothing to load it onto.';
  end if;

  if v_tenant_n > 1 then
    raise exception 'Pre-flight failed: % tenants have slug ''bam'' — the lookup this migration resolves tenant_id with is ambiguous.', v_tenant_n;
  end if;

  select id into v_tenant from public.tenants where slug = 'bam';

  if v_tenant <> c_bam then
    raise exception 'Pre-flight failed: tenant slug ''bam'' resolves to %, but the documented BAM tenant is % (CLAUDE.md §3). The lookup and the literal disagree — loading a holiday calendar into the wrong tenant is not something to guess about.', v_tenant, c_bam;
  end if;

  -- --- no unrecognised rows already in the table -----------------------------
  -- Content, not count. Any row that is neither one of the 6 Spring Break rows
  -- nor one of the 12 below means this migration was authored against a
  -- different table than the one in front of it.
  select string_agg(format('%s (%s)', s.closed_date, coalesce(s.reason, 'no reason')), ', '
                    order by s.closed_date)
    into v_detail
  from public.studio_closures s
  where s.closed_date not in (select closed_date from _closure_calendar_2026_2027)
    and s.closed_date not in (select closed_date from _spring_break_2026);

  if v_detail is not null then
    raise exception 'Pre-flight failed: studio_closures contains closure(s) this migration does not know about: %. Expected only the 6 Spring Break 2026 rows and the 12 §15 rows. Reconcile by hand.', v_detail;
  end if;

  -- --- the 6 Spring Break rows are what we think they are --------------------
  select count(*) into v_count
  from public.studio_closures s
  join _spring_break_2026 sb on sb.closed_date = s.closed_date
  where s.tenant_id            =  v_tenant
    and s.closed_through       =  sb.closed_through
    and s.reason               is not distinct from sb.reason
    and s.is_total             =  sb.is_total
    and s.all_studios          =  sb.all_studios
    and s.exempt_event_types   =  sb.exempt_event_types;

  if v_count <> 6 then
    raise exception 'Pre-flight failed: only % of the 6 Spring Break 2026 rows match their expected values (2026-04-06..04-11, one per day, closed_through = closed_date, reason ''Spring Break'', is_total false, all_studios true, exempt_event_types ''{}''). They were verified on 2026-07-30 and this migration must leave them untouched — if they have moved, find out why before adding 12 more rows.', v_count;
  end if;

  -- --- DIVERGENT prior load --------------------------------------------------
  -- The half this migration exists to catch. A row already sitting on one of the
  -- 12 dates with different values is a partial or hand-edited prior load. ON
  -- CONFLICT DO NOTHING would skip it and report success, leaving the calendar
  -- quietly wrong. Every differing field is listed, so the reconcile has
  -- something to work from.
  select string_agg(d.msg, E'\n  ' order by d.closed_date)
    into v_detail
  from (
    select
      s.closed_date,
      format('%s: %s',
             s.closed_date,
             -- array_to_string skips NULL elements, so the non-differing
             -- fields drop out and only the actual differences are listed.
             array_to_string(array[
               case when s.closed_through is distinct from c.closed_through
                    then format('closed_through is %s, expected %s', s.closed_through, c.closed_through) end,
               case when s.reason is distinct from c.reason
                    then format('reason is %L, expected %L', s.reason, c.reason) end,
               case when s.is_total is distinct from c.is_total
                    then format('is_total is %s, expected %s', s.is_total, c.is_total) end,
               case when s.all_studios is distinct from c.all_studios
                    then format('all_studios is %s, expected %s', s.all_studios, c.all_studios) end,
               case when s.exempt_event_types is distinct from c.exempt_event_types
                    then format('exempt_event_types is %L, expected %L', s.exempt_event_types, c.exempt_event_types) end,
               case when s.tenant_id is distinct from v_tenant
                    then format('tenant_id is %s, expected %s', s.tenant_id, v_tenant) end
             ], '; ')
      ) as msg
    from public.studio_closures s
    join _closure_calendar_2026_2027 c on c.closed_date = s.closed_date
    where s.tenant_id          is distinct from v_tenant
       or s.closed_through     is distinct from c.closed_through
       or s.reason             is distinct from c.reason
       or s.is_total           is distinct from c.is_total
       or s.all_studios        is distinct from c.all_studios
       or s.exempt_event_types is distinct from c.exempt_event_types
  ) d;

  if v_detail is not null then
    raise exception E'Pre-flight failed: closure row(s) already exist on §15 dates with DIFFERENT values than this migration specifies:\n  %\nA partial or divergent prior load is a reconcile-by-hand situation, not something to silently overwrite. This migration inserts only; it never updates an existing closure. Nothing was written.', v_detail;
  end if;

  -- --- how much is left to do ------------------------------------------------
  select count(*) into v_count
  from _closure_calendar_2026_2027 c
  where not exists (
    select 1 from public.studio_closures s
    where s.tenant_id = v_tenant and s.closed_date = c.closed_date
  );

  if v_count = 0 then
    raise notice 'Pre-flight: all 12 §15 closures are already present with the expected values — this is a re-run and the insert below will be a no-op.';
  elsif v_count < 12 then
    raise notice 'Pre-flight: % of 12 §15 closures are missing (% already present and correct) — re-driving a partial load.', v_count, 12 - v_count;
  else
    raise notice 'Pre-flight: clean load — all 12 §15 closures will be inserted alongside the 6 existing Spring Break rows.';
  end if;
end $$;

-- =============================================================================
-- THE LOAD — the only write in this file.
--
-- INSERT ONLY. There is no UPDATE and no DELETE anywhere in this migration, by
-- design: the pre-flight has already established that anything already on these
-- dates matches exactly, so the only correct action on a conflict is to leave it
-- alone. A row that needed changing would have raised above.
--
-- tenant_id is the slug lookup, not the literal — the pre-flight proved the two
-- agree and that the lookup returns exactly one row.
--
-- id and created_at take their column defaults (gen_random_uuid(), now()), so a
-- re-driven partial load is honest about when each row actually landed.
-- =============================================================================
insert into public.studio_closures
  (tenant_id, closed_date, closed_through, reason, is_total, all_studios, exempt_event_types)
select
  (select t.id from public.tenants t where t.slug = 'bam'),
  c.closed_date,
  c.closed_through,
  c.reason,
  c.is_total,
  c.all_studios,
  c.exempt_event_types
from _closure_calendar_2026_2027 c
-- Arbitrated by studio_closures_tenant_id_closed_date_key (20260318215218).
-- Named explicitly rather than left bare: the arbiter is a full, non-partial
-- unique constraint, so there is no reason to be vague about which one, and
-- naming it means a future partial index cannot quietly become the arbiter.
on conflict (tenant_id, closed_date) do nothing;

-- =============================================================================
-- POST-FLIGHT
-- =============================================================================
do $$
declare
  v_tenant    uuid;
  v_count     int;
  v_detail    text;
  v_published int;
  v_cancelled int;
  v_drafts    int;
begin
  select id into v_tenant from public.tenants where slug = 'bam';

  -- --- 18 rows: 6 + 12 -------------------------------------------------------
  select count(*) into v_count from public.studio_closures;
  if v_count <> 18 then
    raise exception 'Post-flight failed: studio_closures has % rows, expected exactly 18 (the 6 Spring Break 2026 rows plus the 12 §15 rows).', v_count;
  end if;

  -- Restated tenant-scoped. Identical today (one tenant), and it stops a future
  -- second tenant's closures from making the count above come out right for the
  -- wrong reason.
  select count(*) into v_count
  from public.studio_closures where tenant_id = v_tenant;
  if v_count <> 18 then
    raise exception 'Post-flight failed: % of the 18 studio_closures rows belong to the BAM tenant — the rest belong to someone else.', v_count;
  end if;

  -- --- the 6 Spring Break rows, unchanged ------------------------------------
  select count(*) into v_count
  from public.studio_closures s
  join _spring_break_2026 sb on sb.closed_date = s.closed_date
  where s.tenant_id          =  v_tenant
    and s.closed_through     =  sb.closed_through
    and s.reason             is not distinct from sb.reason
    and s.is_total           =  sb.is_total
    and s.all_studios        =  sb.all_studios
    and s.exempt_event_types =  sb.exempt_event_types;

  if v_count <> 6 then
    raise exception 'Post-flight failed: only % of the 6 Spring Break 2026 rows still match their pre-migration values. This migration must not touch them — it contains no UPDATE, so if this fails something else did.', v_count;
  end if;

  -- --- all 12 §15 rows present, every field exact ----------------------------
  select string_agg(c.closed_date::text, ', ' order by c.closed_date)
    into v_detail
  from _closure_calendar_2026_2027 c
  where not exists (
    select 1 from public.studio_closures s
    where s.tenant_id          =  v_tenant
      and s.closed_date        =  c.closed_date
      and s.closed_through     =  c.closed_through
      and s.reason             is not distinct from c.reason
      and s.is_total           =  c.is_total
      and s.all_studios        =  c.all_studios
      and s.exempt_event_types =  c.exempt_event_types
  );

  if v_detail is not null then
    raise exception 'Post-flight failed: §15 closure(s) missing or not matching after the load: %', v_detail;
  end if;

  -- --- exactly 2 total closures, and they are the right 2 --------------------
  select count(*) into v_count from public.studio_closures where is_total = true;
  if v_count <> 2 then
    raise exception 'Post-flight failed: % rows have is_total = true, expected exactly 2 (Thanksgiving Day 2026-11-26 and Christmas Day 2026-12-25). is_total defeats every exemption and every override (§6) — one too many closes the building on a day it should be open.', v_count;
  end if;

  select string_agg(closed_date::text, ', ' order by closed_date) into v_detail
  from public.studio_closures where is_total = true;

  if v_detail <> '2026-11-26, 2026-12-25' then
    raise exception 'Post-flight failed: the total-closure dates are (%), expected (2026-11-26, 2026-12-25).', v_detail;
  end if;

  -- --- every partial §15 row carries {private_lesson} ------------------------
  -- SCOPED TO THE 12, deliberately. The 6 Spring Break rows are also partial and
  -- carry '{}' — they predate the confirmed exemption and are not retrofitted
  -- (§5). A table-wide version of this assertion would fail on correct data,
  -- and "fixing" it by widening the exemption would rewrite history.
  select count(*) into v_count
  from public.studio_closures s
  join _closure_calendar_2026_2027 c on c.closed_date = s.closed_date
  where s.tenant_id = v_tenant
    and s.is_total  = false
    and s.exempt_event_types is distinct from '{private_lesson}'::text[];

  if v_count > 0 then
    raise exception 'Post-flight failed: % of the 10 partial §15 closures are MISSING exempt_event_types = ''{private_lesson}''. Privates carry on through a partial closure; rehearsals do not (§15, §14 Q1).', v_count;
  end if;

  -- And the mirror: nothing is exempt under a total closure.
  select count(*) into v_count
  from public.studio_closures s
  join _closure_calendar_2026_2027 c on c.closed_date = s.closed_date
  where s.tenant_id = v_tenant
    and s.is_total  = true
    and s.exempt_event_types <> '{}'::text[];

  if v_count > 0 then
    raise exception 'Post-flight failed: % total closure(s) carry a non-empty exempt_event_types. Nothing is exempt when nobody is in the building (§6).', v_count;
  end if;

  -- --- Lincoln Day is absent -------------------------------------------------
  if exists (select 1 from public.studio_closures where closed_date = '2027-02-12') then
    raise exception 'Post-flight failed: a closure exists on 2027-02-12 (Lincoln Day). The studio is NOT closed that day — confirmed by Amanda 2026-07-30, in the same conversation that added Veterans Day (§15). Its absence is deliberate; remove the row.';
  end if;

  -- Feb 12 also must not be swallowed by a RANGE. Presidents Day (2027-02-15) is
  -- a single day and Spring Recess starts in April, so no §15 row spans it — but
  -- an off-by-a-few edit to either range would close the studio on Lincoln Day
  -- without ever creating a row dated 2027-02-12, and the check above would not
  -- notice.
  if exists (select 1 from public.studio_closures
             where '2027-02-12'::date between closed_date and closed_through) then
    raise exception 'Post-flight failed: 2027-02-12 (Lincoln Day) falls inside a closure RANGE. No §15 closure spans it; a range boundary is wrong.';
  end if;

  -- --- closure_locations untouched -------------------------------------------
  -- All 12 are all_studios = true, so none of them scopes to specific studios.
  select count(*) into v_count from public.closure_locations;
  if v_count <> 0 then
    raise exception 'Post-flight failed: closure_locations has % rows, expected 0. Every §15 closure is all_studios = true and the join table is only populated when all_studios = false (§5).', v_count;
  end if;

  -- --- NOTHING WAS CANCELLED -------------------------------------------------
  -- The point of the whole file. This migration loads a calendar; it does not
  -- apply it. If either number has moved, apply_closures ran during this push
  -- and 417 occurrences were cancelled without anyone reading a dry run first.
  select count(*) filter (where status = 'published'),
         count(*) filter (where status = 'cancelled')
    into v_published, v_cancelled
  from public.schedule_instances;

  if v_published <> 3899 then
    raise exception 'Post-flight failed: schedule_instances published count is %, expected 3899. This migration loads the closure calendar and must NOT cancel anything — apply_closures is a separate, deliberate run.', v_published;
  end if;

  if v_cancelled <> 61 then
    raise exception 'Post-flight failed: schedule_instances cancelled count is %, expected 61 (the disposed March orphans, d7e7b9f). Nothing may be cancelled as a side effect of loading the calendar.', v_cancelled;
  end if;

  -- The payroll half of the same proof. apply_closures deletes draft timesheet
  -- entries for cancelled occurrences (§9); if it had run, this would have moved
  -- too. Cheap, and it closes the other door.
  select count(*) into v_drafts from public.timesheet_entries where status = 'draft';
  if v_drafts <> 4 then
    raise exception 'Post-flight failed: draft timesheet_entries count is %, expected 4. This migration must not delete any — draft cleanup belongs to apply_closures (§9).', v_drafts;
  end if;

  -- --- what is now armed but not fired ---------------------------------------
  select count(*) into v_count
  from public.schedule_instances si
  where si.tenant_id = v_tenant
    and si.status <> 'cancelled'
    and si.event_date > current_date
    and exists (
      select 1 from public.studio_closures sc
      where sc.tenant_id = si.tenant_id
        and si.event_date between sc.closed_date and sc.closed_through
    );

  raise notice 'Closure calendar loaded: 18 closures on file (6 Spring Break 2026 + 12 for 2026-27), 2 of them total. % future occurrence(s) now sit under a closure and are STILL PUBLISHED — this migration cancelled nothing.', v_count;
  if v_count <> 417 then
    raise notice 'NOTE: that count was 417 when this migration was authored (2026-07-30, dry-run simulated in 20260730000002). It is % now — not an error, but read the apply_closures dry-run report carefully before writing.', v_count;
  end if;
  raise notice 'NEXT, as a separate deliberate act: select * from apply_closures(''%'', ''2026-08-01'', ''2027-06-30'');  -- dry run by default. Read the report, then re-run with p_dry_run => false.', v_tenant;
end $$;

-- -----------------------------------------------------------------------------
-- Scratch tables released. ON COMMIT DROP was not used: `supabase db push` runs
-- each migration in its own transaction, but a hand-run in the SQL editor may
-- not, and these must not outlive the file either way.
-- -----------------------------------------------------------------------------
drop table if exists _closure_calendar_2026_2027;
drop table if exists _spring_break_2026;
