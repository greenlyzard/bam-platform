-- =============================================================================
-- Rate snapshot on timesheet_entries
--
-- Spec: docs/PAYROLL_CORRECTNESS_AND_REPORTING.md §3.1
--
-- Pay is currently computed at RENDER time from teachers.*_rate_cents as they
-- are right now, so an annual figure spanning a rate change reprices the whole
-- year at today's rate. This stores the amount on the entry when it is written.
--
-- Resolution is by the entry's WORK DATE (timesheet_entries.date), not the date
-- it was entered or approved. A teacher who files late does not get a new rate
-- applied to old work, and an approval landing after a raise does not reprice
-- the period.
--
-- The snapshot is applied by TRIGGER rather than by application code. There are
-- several write paths today and native clients planned; a trigger cannot be
-- bypassed by a path that forgets to call the resolver.
-- =============================================================================

do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='teacher_rates') then
    raise exception 'Pre-flight failed: teacher_rates does not exist — run 20260728000001 first';
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='timesheet_entries'
                   and column_name='rate_override') then
    raise exception 'Pre-flight failed: timesheet_entries.rate_override not found';
  end if;

  -- The snapshot must never silently overwrite existing values.
  if exists (select 1 from timesheet_entries where rate_amount is not null) then
    raise exception 'Pre-flight failed: timesheet_entries.rate_amount is populated; review before snapshotting';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Snapshot columns
--    rate_amount (numeric) is left alone as legacy. amount_cents is the figure
--    payroll sums — integer cents, matching teacher_rates.
-- -----------------------------------------------------------------------------
alter table public.timesheet_entries
  add column if not exists amount_cents      integer,
  add column if not exists rate_id           uuid,
  add column if not exists rate_resolved_at  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='timesheet_entries_amount_cents_check') then
    alter table public.timesheet_entries
      add constraint timesheet_entries_amount_cents_check
      check (amount_cents is null or amount_cents >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname='timesheet_entries_rate_id_fkey') then
    alter table public.timesheet_entries
      add constraint timesheet_entries_rate_id_fkey
      foreign key (rate_id) references public.teacher_rates(id) on delete set null;
  end if;
end $$;

comment on column public.timesheet_entries.amount_cents is
  'Snapshotted pay for this entry, resolved against the rate in effect on `date`. Payroll SUMS this; it never multiplies hours by a current rate.';

comment on column public.timesheet_entries.rate_id is
  'Provenance — which teacher_rates row produced amount_cents. Null where rate_override is true or no rate resolved.';

-- -----------------------------------------------------------------------------
-- 2. Resolver
--
--    SECURITY INVOKER deliberately. A SECURITY DEFINER function returning an
--    amount would let any caller learn any teacher's rate, defeating the §3.3
--    visibility rule. Entry writes happen server-side with the service role,
--    which resolves fine; clients never call this directly.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_teacher_rate(
  p_teacher_id uuid,
  p_rate_key   text,
  p_work_date  date
)
returns table (rate_id uuid, rate_type text, amount_cents integer)
language sql stable
set search_path = public as $fn$
  select tr.id, tr.rate_type, tr.amount_cents
  from teacher_rates tr
  where tr.teacher_id = p_teacher_id
    and tr.rate_key   = p_rate_key
    and tr.valid_from <= p_work_date
    and (tr.valid_to is null or tr.valid_to > p_work_date)
  limit 1
$fn$;

comment on function public.resolve_teacher_rate(uuid, text, date) is
  'The rate in effect for a teacher and category on a given work date. At most one row — teacher_rates_no_overlap guarantees it.';

-- -----------------------------------------------------------------------------
-- 3. Snapshot trigger
-- -----------------------------------------------------------------------------
create or replace function public.snapshot_timesheet_entry_rate()
returns trigger language plpgsql
set search_path = public as $fn$
declare
  v_teacher uuid;
  v_rate    record;
begin
  -- An overridden entry carries a manually set amount and is never re-resolved.
  if new.rate_override is true then
    return new;
  end if;

  -- A paid entry is immutable. Square has already paid it; rewriting the amount
  -- would put this platform in disagreement with money that actually moved.
  -- A retroactive rate change produces a separate adjustment entry (§3.1).
  if tg_op = 'UPDATE' and old.paid_at is not null then
    return new;
  end if;

  -- Only re-resolve when something that affects the amount actually changed.
  if tg_op = 'UPDATE'
     and new.date = old.date
     and new.entry_type = old.entry_type
     and new.total_hours is not distinct from old.total_hours then
    return new;
  end if;

  select t.teacher_id into v_teacher
  from timesheets t where t.id = new.timesheet_id;

  if v_teacher is null then
    return new;
  end if;

  select * into v_rate
  from public.resolve_teacher_rate(v_teacher, new.entry_type, new.date);

  if v_rate.rate_id is null then
    -- No rate in effect. Leave the amount null rather than guessing zero —
    -- a null surfaces as unpriced; a zero looks like unpaid work.
    new.rate_id          := null;
    new.amount_cents     := null;
    new.rate_resolved_at := null;
    return new;
  end if;

  new.rate_id          := v_rate.rate_id;
  new.rate_key         := new.entry_type;
  new.rate_resolved_at := now();

  if v_rate.rate_type = 'flat' then
    -- A flat fee is the amount, whatever hours were recorded.
    new.amount_cents := v_rate.amount_cents;
  else
    new.amount_cents := round(v_rate.amount_cents * coalesce(new.total_hours, 0))::integer;
  end if;

  return new;
end $fn$;

drop trigger if exists trg_snapshot_timesheet_entry_rate on public.timesheet_entries;
create trigger trg_snapshot_timesheet_entry_rate
  before insert or update on public.timesheet_entries
  for each row execute function public.snapshot_timesheet_entry_rate();

-- -----------------------------------------------------------------------------
-- 4. Post-flight
-- -----------------------------------------------------------------------------
do $$
declare v_id uuid; v_amt integer;
begin
  if not exists (select 1 from pg_trigger where tgname='trg_snapshot_timesheet_entry_rate') then
    raise exception 'Post-flight failed: snapshot trigger not created';
  end if;

  -- The resolver must find a Fall rate and must find nothing before the season.
  select rate_id, amount_cents into v_id, v_amt
  from public.resolve_teacher_rate(
    (select p.id from profiles p where lower(p.email)='cara@bamsocal.com'),
    'class_lead', date '2026-09-01');

  if v_id is null or v_amt <> 6000 then
    raise exception 'Post-flight failed: expected 6000 cents for class_lead on 2026-09-01, got %', v_amt;
  end if;

  select rate_id into v_id
  from public.resolve_teacher_rate(
    (select p.id from profiles p where lower(p.email)='cara@bamsocal.com'),
    'class_lead', date '2026-07-01');

  if v_id is not null then
    raise exception 'Post-flight failed: a rate resolved before valid_from';
  end if;
end $$;
