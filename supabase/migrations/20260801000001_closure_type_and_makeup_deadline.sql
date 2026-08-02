-- Phase 1b — STUDIO_CLOSURES.md §16.3 (D8), §16.5 (D9), §16.6 (D10)
--
-- D8  drop UNIQUE (tenant_id, closed_date) — it makes per-location closures
--     unrepresentable, which is what all_studios = false exists to serve
-- D9  add closure_type, ALONGSIDE is_total, not replacing it
-- D10 add makeup_deadline
--
-- is_total stays. It is rung 1 of the §6 precedence ladder and the flag every
-- enforcement path reads. closure_type is the semantic and display layer above
-- it; enforcement continues to read exempt_event_types and nothing else.

-- ---------------------------------------------------------------------------
-- Pre-flight. Fail loudly rather than migrate onto bad assumptions.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing_col int;
  v_bad_makeup  int;
begin
  -- The table must look the way §16.1 verified it does.
  select count(*) into v_missing_col
  from (values ('closed_date'), ('closed_through'), ('is_total'),
               ('all_studios'), ('exempt_event_types'), ('reason')) as required(col)
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'studio_closures'
      and column_name  = required.col
  );

  if v_missing_col > 0 then
    raise exception
      'studio_closures is missing % expected column(s). Phase 1 may not have run; stopping.',
      v_missing_col;
  end if;

  -- Nothing should already violate the makeup_deadline CHECK we are about to
  -- add. The column does not exist yet, so this can only fail if a prior
  -- partial run left one behind.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'studio_closures'
      and column_name  = 'makeup_deadline'
  ) then
    execute 'select count(*) from public.studio_closures
             where makeup_deadline is not null
               and makeup_deadline <= closed_through'
      into v_bad_makeup;

    if v_bad_makeup > 0 then
      raise exception
        '% closure row(s) have makeup_deadline on or before closed_through. Resolve before adding the CHECK.',
        v_bad_makeup;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- D8 — drop date uniqueness
--
-- Uniqueness on (tenant_id, closed_date) permits exactly one closure per date
-- per tenant, so San Clemente and RSM cannot hold different closures on the
-- same day. §14 Q2 assumes they can. RSM is split between Saddleback Valley
-- and Capistrano Unified (§16.4), so divergent dates are expected rather than
-- hypothetical.
--
-- The correct invariant is "one location is not covered by two overlapping
-- closures", which is a statement about closure_locations joined to the date
-- range. That guard is deferred — it needs a trigger or a materialised range
-- column. See §16.3.
-- ---------------------------------------------------------------------------
alter table public.studio_closures
  drop constraint if exists studio_closures_tenant_id_closed_date_key;

-- Dropping the constraint drops its index with it. Lookups by date are the
-- common read, so replace it with a plain index.
create index if not exists studio_closures_tenant_date_idx
  on public.studio_closures (tenant_id, closed_date);

-- Keep the guard where it is still correct: two tenant-wide closures on the
-- same date are a data-entry error under any model. Location-scoped closures
-- (all_studios = false) are deliberately exempt.
create unique index if not exists studio_closures_tenant_date_all_studios_uniq
  on public.studio_closures (tenant_id, closed_date)
  where all_studios = true;

-- ---------------------------------------------------------------------------
-- D9 — closure_type
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'closure_type') then
    create type public.closure_type as enum (
      'holiday_break',
      'total_closure',
      'production_conflict',
      'facility'
    );
  end if;
end $$;

alter table public.studio_closures
  add column if not exists closure_type public.closure_type;

-- Backfill from is_total. Every existing row is a holiday break or a total
-- closure; production_conflict and facility have never been representable, so
-- nothing can be misclassified into them.
update public.studio_closures
   set closure_type = case
         when is_total then 'total_closure'::public.closure_type
         else 'holiday_break'::public.closure_type
       end
 where closure_type is null;

do $$
declare v_null int;
begin
  select count(*) into v_null
  from public.studio_closures where closure_type is null;

  if v_null > 0 then
    raise exception 'closure_type still null on % row(s) after backfill', v_null;
  end if;
end $$;

alter table public.studio_closures
  alter column closure_type set not null;

-- total_closure and is_total must agree. They are the same fact recorded twice
-- during the transition; a row claiming one and not the other is incoherent.
alter table public.studio_closures
  drop constraint if exists studio_closures_type_matches_is_total;

alter table public.studio_closures
  add constraint studio_closures_type_matches_is_total
  check ((closure_type = 'total_closure') = is_total);

-- ---------------------------------------------------------------------------
-- D10 — makeup_deadline
--
-- Authored, not derived. Observed deadlines on the printed flyers run 12, 14,
-- 21, 23, 26, 27, 28 and 33 days past the close — no offset reproduces that.
-- Nullable: total closures generally offer no makeup.
-- ---------------------------------------------------------------------------
alter table public.studio_closures
  add column if not exists makeup_deadline date;

alter table public.studio_closures
  drop constraint if exists studio_closures_makeup_after_close;

alter table public.studio_closures
  add constraint studio_closures_makeup_after_close
  check (makeup_deadline is null or makeup_deadline > closed_through);

-- ---------------------------------------------------------------------------
-- Documentation
-- ---------------------------------------------------------------------------
comment on column public.studio_closures.closure_type is
  'Semantic and display layer. Sets default exempt_event_types at creation and drives parent-facing copy. Enforcement reads exempt_event_types, never this. See STUDIO_CLOSURES.md §16.5.';

comment on column public.studio_closures.makeup_deadline is
  'Authored per closure, not derived. Null when no makeup is offered. See STUDIO_CLOSURES.md §16.6.';

comment on column public.studio_closures.is_total is
  'Rung 1 of the §6 precedence ladder — defeats every exemption and override. Kept alongside closure_type deliberately; see STUDIO_CLOSURES.md §16.5.';
