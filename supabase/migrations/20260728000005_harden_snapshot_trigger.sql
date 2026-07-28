-- =============================================================================
-- Harden snapshot_timesheet_entry_rate
--
-- Two gaps found while fixing cross-period re-dating (a673eba):
--
-- 1. `timesheet_id` is absent from the early-return guard. An update that
--    changes ONLY timesheet_id — same date, entry_type, hours — returns early
--    and leaves amount_cents priced against the previous timesheet's teacher.
--    Unreachable from today's code, which sets timesheet_id only alongside a
--    date change. An admin "reassign this entry to another teacher" surface
--    would hit it silently, and that is a plausible next feature.
--
-- 2. A paid entry returns early rather than being refused, so it can still be
--    re-dated or moved to another timesheet while keeping the amount_cents that
--    was already paid. The amount staying put is correct (§3.1: Square has paid
--    it; rewriting would put this platform in disagreement with money that
--    moved). The row being MOVABLE is not. In practice the source-period lock
--    blocks it, but "paid" and "locked" are different conditions and must not
--    be relied on to coincide — an admin path with no lock check reaches it.
--
-- Retroactive rate changes still go through a separate adjustment entry, per
-- docs/PAYROLL_CORRECTNESS_AND_REPORTING.md §3.1. Nothing here changes that.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public'
                   and p.proname = 'snapshot_timesheet_entry_rate') then
    raise exception 'Pre-flight failed: snapshot_timesheet_entry_rate does not exist';
  end if;

  if not exists (select 1 from pg_trigger
                 where tgname = 'trg_snapshot_timesheet_entry_rate') then
    raise exception 'Pre-flight failed: trg_snapshot_timesheet_entry_rate does not exist';
  end if;

  -- Nothing is paid yet, so no existing row can be caught by the new refusal.
  if exists (select 1 from timesheet_entries where paid_at is not null) then
    raise exception 'Pre-flight failed: paid entries already exist; review before tightening';
  end if;
end $$;

create or replace function public.snapshot_timesheet_entry_rate()
returns trigger language plpgsql
set search_path = public as $fn$
declare
  v_teacher uuid;
  v_rate    record;
begin
  -- A paid entry is immutable in the two fields that determine what it is worth
  -- and which period it belongs to. Refuse rather than return early: returning
  -- early would let the move happen and merely decline to reprice it, leaving a
  -- row whose date says one period and whose payment happened in another.
  --
  -- Everything else on a paid entry stays editable — notes, description, and
  -- paid_at itself, so a payment can be corrected or reversed.
  if tg_op = 'UPDATE' and old.paid_at is not null then
    if new.date is distinct from old.date then
      raise exception
        'Entry % was paid on %; its date cannot be changed. Record a correction as a separate adjustment entry.',
        old.id, old.paid_at::date
        using errcode = 'check_violation';
    end if;

    if new.timesheet_id is distinct from old.timesheet_id then
      raise exception
        'Entry % was paid on %; it cannot be moved to another timesheet.',
        old.id, old.paid_at::date
        using errcode = 'check_violation';
    end if;

    -- Paid and unmoved: leave the snapshot exactly as it was.
    return new;
  end if;

  -- An overridden entry carries a manually set amount and is never re-resolved.
  if new.rate_override is true then
    return new;
  end if;

  -- Only re-resolve when something that affects the amount actually changed.
  -- timesheet_id is in this list because the timesheet determines WHOSE rate
  -- applies — moving an entry to another teacher's timesheet changes the rate
  -- even when the date, category and hours are identical.
  if tg_op = 'UPDATE'
     and new.date = old.date
     and new.entry_type = old.entry_type
     and new.total_hours is not distinct from old.total_hours
     and new.timesheet_id is not distinct from old.timesheet_id then
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

do $$
declare v_src text;
begin
  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'snapshot_timesheet_entry_rate';

  if v_src not like '%new.timesheet_id is not distinct from old.timesheet_id%' then
    raise exception 'Post-flight failed: timesheet_id missing from the re-resolve guard';
  end if;

  if v_src not like '%cannot be moved to another timesheet%' then
    raise exception 'Post-flight failed: paid-entry move refusal not present';
  end if;
end $$;
