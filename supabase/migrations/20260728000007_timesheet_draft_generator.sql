-- =============================================================================
-- Timesheet auto-draft generator
--
-- Spec: docs/TIMESHEET_AUTODRAFT.md §4
--
-- Pre-creates draft timesheet entries from published schedule_instances so a
-- teacher confirms rather than reconstructs. The rate snapshot trigger
-- (20260728000003) prices each draft on insert, so a generated entry arrives
-- with a dollar figure already on it.
--
-- Written as a Postgres function, not application code. There are two callers
-- (a nightly job and the timesheet page on load) and native clients are
-- planned; today's session removed three divergent copies of
-- getOrCreateTimesheet for exactly this reason.
--
-- IDEMPOTENT. Keyed on (teacher, schedule_instance_id). Re-running never
-- duplicates, and an entry the teacher deleted stays deleted — deletion is a
-- decision, and regenerating it would be the system arguing with them.
-- =============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='timesheet_entries'
                   and column_name='schedule_instance_id') then
    raise exception 'Pre-flight failed: timesheet_entries.schedule_instance_id not found';
  end if;

  if not exists (select 1 from pg_trigger where tgname='trg_snapshot_timesheet_entry_rate') then
    raise exception 'Pre-flight failed: rate snapshot trigger missing — drafts would be unpriced';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Link attendance to the occurrence it belongs to
--
--    `attendance` is (class_id, student_id, class_date). Answering "was
--    attendance taken for THIS occurrence" by matching class and date breaks
--    when a class meets twice in one day, which rehearsal weeks do.
--    Free right now: attendance has 0 rows.
-- -----------------------------------------------------------------------------
alter table public.attendance
  add column if not exists schedule_instance_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='attendance_schedule_instance_fkey') then
    alter table public.attendance
      add constraint attendance_schedule_instance_fkey
      foreign key (schedule_instance_id)
      references public.schedule_instances(id) on delete set null;
  end if;
end $$;

create index if not exists attendance_schedule_instance_idx
  on public.attendance (schedule_instance_id);

comment on column public.attendance.schedule_instance_id is
  'The occurrence this attendance record belongs to. Nullable for legacy rows; required going forward. Matching on (class_id, class_date) is ambiguous when a class meets twice in a day.';

-- -----------------------------------------------------------------------------
-- 2. Resolve (or create) the timesheet a work date belongs on
--
--    Mirrors getOrCreateTimesheet in lib/timesheets/helpers.ts, including the
--    period-from-WORK-DATE rule and the edit-cutoff default. Kept in SQL so the
--    generator does not depend on the app being the one to call it.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_timesheet_for_date(
  p_tenant_id  uuid,
  p_teacher_id uuid,
  p_work_date  date
)
returns uuid
language plpgsql
security definer
set search_path = public as $fn$
declare
  v_month int := extract(month from p_work_date);
  v_year  int := extract(year  from p_work_date);
  v_period uuid;
  v_timesheet uuid;
begin
  select id into v_period from pay_periods
  where tenant_id = p_tenant_id and period_month = v_month and period_year = v_year;

  if v_period is null then
    insert into pay_periods
      (tenant_id, period_month, period_year, submission_deadline,
       teacher_edit_cutoff, status, pay_cadence)
    values
      (p_tenant_id, v_month, v_year,
       make_date(v_year, v_month, 26),
       (make_date(v_year, v_month, 1) + interval '1 month' + interval '2 days')::date,
       'open', 'monthly')
    returning id into v_period;
  end if;

  select id into v_timesheet from timesheets
  where tenant_id = p_tenant_id and teacher_id = p_teacher_id and pay_period_id = v_period;

  if v_timesheet is null then
    insert into timesheets (tenant_id, teacher_id, pay_period_id, status)
    values (p_tenant_id, p_teacher_id, v_period, 'draft')
    returning id into v_timesheet;
  end if;

  return v_timesheet;
end $fn$;

-- -----------------------------------------------------------------------------
-- 3. The generator
-- -----------------------------------------------------------------------------
create or replace function public.generate_timesheet_drafts(
  p_tenant_id  uuid,
  p_from       date,
  p_to         date,
  p_teacher_id uuid default null   -- null = every teacher
)
returns TABLE (created int, skipped_locked int, skipped_existing int, skipped_no_teacher int)
language plpgsql
security definer
set search_path = public as $fn$
declare
  r record;
  v_timesheet uuid;
  v_created int := 0;
  v_locked  int := 0;
  v_exists  int := 0;
  v_noteach int := 0;
  v_hours numeric;
  v_type text;
  v_cutoff date;
begin
  for r in
    select si.id, si.class_id, si.event_date, si.start_time, si.end_time,
           si.event_type, si.production_id,
           -- The person who actually worked: a substitute if one is recorded,
           -- otherwise the assigned teacher. A covered teacher is not paid
           -- (PAYROLL §3.6), so they are simply never drafted.
           coalesce(si.substitute_teacher_id, si.teacher_id) as worker_id,
           (si.substitute_teacher_id is not null) as is_sub,
           si.teacher_id as assigned_id,
           coalesce(c.is_rehearsal, false) as is_rehearsal,
           ct.role as ct_role
    from schedule_instances si
    left join classes c on c.id = si.class_id
    left join class_teachers ct
           on ct.class_id = si.class_id
          and ct.teacher_id = coalesce(si.substitute_teacher_id, si.teacher_id)
    where si.tenant_id = p_tenant_id
      and si.event_date between p_from and p_to
      and si.status = 'published'
      and si.event_type not in ('room_block','teacher_absence','studio_closure')
      and (p_teacher_id is null
           or coalesce(si.substitute_teacher_id, si.teacher_id) = p_teacher_id)
  loop
    -- No teacher and no substitute: nothing to draft. Counted, not silent —
    -- these surface on the admin exception report.
    if r.worker_id is null then
      v_noteach := v_noteach + 1;
      continue;
    end if;

    -- Never draft into a period past its edit cutoff.
    select teacher_edit_cutoff into v_cutoff from pay_periods
    where tenant_id = p_tenant_id
      and period_month = extract(month from r.event_date)
      and period_year  = extract(year  from r.event_date);

    if v_cutoff is not null and current_date > v_cutoff then
      v_locked := v_locked + 1;
      continue;
    end if;

    -- Idempotency, and the teacher's deletion is respected: if any entry
    -- already references this occurrence for this person, do nothing.
    if exists (
      select 1 from timesheet_entries te
      join timesheets t on t.id = te.timesheet_id
      where te.schedule_instance_id = r.id and t.teacher_id = r.worker_id
    ) then
      v_exists := v_exists + 1;
      continue;
    end if;

    -- Category. entry_type drives which rate resolves, so this mapping is the
    -- difference between a $75 class and a $35 rehearsal.
    v_type := case
      when r.is_sub then 'substitute'
      when r.is_rehearsal or r.event_type = 'rehearsal' then 'rehearsal'
      when r.event_type = 'performance' then 'performance_event'
      when r.ct_role is not null and r.ct_role <> 'lead' then 'class_assistant'
      else 'class_lead'
    end;

    -- Hours from the occurrence. Null start/end leaves hours null and the row
    -- unpriced rather than guessed — the teacher fills it in.
    v_hours := case
      when r.start_time is null or r.end_time is null then null
      else round(extract(epoch from (r.end_time - r.start_time))/3600.0, 2)
    end;

    v_timesheet := public.resolve_timesheet_for_date(p_tenant_id, r.worker_id, r.event_date);

    insert into timesheet_entries
      (timesheet_id, tenant_id, date, entry_type, total_hours, status,
       teacher_role, schedule_instance_id, class_id, production_id,
       is_auto_populated, is_substitute, substitute_for_teacher_id,
       start_time, end_time)
    values
      (v_timesheet, p_tenant_id, r.event_date, v_type, v_hours, 'draft',
       case when r.is_sub then 'substitute' else 'lead' end,
       r.id, r.class_id, r.production_id,
       true, r.is_sub,
       case when r.is_sub then r.assigned_id else null end,
       r.start_time, r.end_time);

    v_created := v_created + 1;
  end loop;

  return query select v_created, v_locked, v_exists, v_noteach;
end $fn$;

comment on function public.generate_timesheet_drafts(uuid, date, date, uuid) is
  'Pre-creates draft timesheet entries from published schedule_instances. Idempotent on (teacher, schedule_instance_id). See docs/TIMESHEET_AUTODRAFT.md.';

-- Callable by the app; SECURITY DEFINER so the nightly job and the page share
-- one path. Not granted to anon.
revoke all on function public.generate_timesheet_drafts(uuid, date, date, uuid) from public;
grant execute on function public.generate_timesheet_drafts(uuid, date, date, uuid) to authenticated, service_role;
revoke all on function public.resolve_timesheet_for_date(uuid, uuid, date) from public;
grant execute on function public.resolve_timesheet_for_date(uuid, uuid, date) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='generate_timesheet_drafts') then
    raise exception 'Post-flight failed: generator not created';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='attendance'
                   and column_name='schedule_instance_id') then
    raise exception 'Post-flight failed: attendance link not created';
  end if;
end $$;
