-- ============================================================
-- Extend admin_tasks for enrollment/trial requests
-- Adds: enrollment_request, trial_request to task_type
-- Adds: related_student_id, related_family_id columns
-- ============================================================

-- Add student and family reference columns
alter table admin_tasks
  add column if not exists related_student_id uuid references students(id) on delete set null,
  add column if not exists related_family_id uuid references families(id) on delete set null,
  add column if not exists metadata jsonb;

create index if not exists idx_admin_tasks_student on admin_tasks(related_student_id);
create index if not exists idx_admin_tasks_family on admin_tasks(related_family_id);

-- Expand task_type CHECK to include enrollment types
do $$
declare
  v_conname text;
begin
  -- Find the existing task_type CHECK constraint
  select con.conname into v_conname
  from pg_constraint con
  join pg_attribute att on att.attnum = any(con.conkey) and att.attrelid = con.conrelid
  where con.conrelid = 'admin_tasks'::regclass
    and con.contype = 'c'
    and att.attname = 'task_type'
  limit 1;

  if v_conname is not null then
    execute format('alter table admin_tasks drop constraint %I', v_conname);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'admin_tasks_task_type_check_v2'
  ) then
    alter table admin_tasks add constraint admin_tasks_task_type_check_v2
      check (task_type in (
        'makeup_needed','class_at_risk','coverage_needed',
        'cancellation_pay_decision','timesheet_review',
        'enrollment_request','trial_request',
        'other'
      ));
  end if;
end;
$$;
