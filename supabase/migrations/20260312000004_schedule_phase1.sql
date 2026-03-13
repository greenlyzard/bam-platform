-- ============================================================
-- Schedule Phase 1 — Classes, Sessions, Attendance, Admin Tasks
-- Alters: productions, classes
-- Creates: class_recurrence_rules, class_sessions,
--          session_attendance, admin_tasks
-- ============================================================


-- ── ALTER PRODUCTIONS ─────────────────────────────────────────
-- Add tenant_id and scheduling-related columns to existing table
alter table productions
  add column if not exists tenant_id uuid references tenants(id) on delete cascade,
  add column if not exists description text,
  add column if not exists performance_dates date[],
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists casting_published boolean default false;

-- Backfill tenant_id for existing rows (use BAM tenant)
do $$
declare v_tid uuid;
begin
  select id into v_tid from tenants where slug = 'bam' limit 1;
  if v_tid is not null then
    update productions set tenant_id = v_tid where tenant_id is null;
  end if;
end;
$$;

create index if not exists idx_productions_tenant on productions(tenant_id);


-- ── ALTER CLASSES ─────────────────────────────────────────────
-- Extend existing classes table with scheduling phase 1 columns.
-- Original columns (name, style, level, age_min, age_max, max_students,
-- teacher_id, day_of_week, start_time, end_time, room, is_active,
-- description) are preserved.

alter table classes
  add column if not exists tenant_id uuid references tenants(id) on delete cascade,
  add column if not exists full_name text,
  add column if not exists short_name text,
  add column if not exists simple_name text,
  add column if not exists display_name text,
  add column if not exists short_description text,
  add column if not exists long_description text,
  add column if not exists class_type text default 'regular',
  add column if not exists program_division text,
  add column if not exists levels text[],
  add column if not exists min_age integer,
  add column if not exists max_age integer,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists location_notes text,
  add column if not exists lead_teacher_id uuid references auth.users(id) on delete set null,
  add column if not exists assistant_teacher_ids uuid[],
  add column if not exists max_enrollment integer,
  add column if not exists min_enrollment integer,
  add column if not exists enrollment_count integer default 0,
  add column if not exists production_id uuid references productions(id) on delete set null,
  add column if not exists status text default 'draft',
  add column if not exists is_published boolean default false,
  add column if not exists is_open_enrollment boolean default true,
  add column if not exists trial_eligible boolean default false,
  add column if not exists trial_requires_approval boolean default false,
  add column if not exists trial_max_per_class integer default 2,
  add column if not exists trial_notes text,
  add column if not exists back_to_back_class_ids uuid[],
  add column if not exists color_code text,
  add column if not exists cover_image_url text,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Add check constraints (cannot use IF NOT EXISTS for constraints)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'classes_class_type_check'
  ) then
    alter table classes add constraint classes_class_type_check
      check (class_type in ('regular','rehearsal','performance',
        'competition','private','workshop','intensive'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'classes_program_division_check'
  ) then
    alter table classes add constraint classes_program_division_check
      check (program_division is null or program_division in (
        'petites','company','advanced','adult','competitive','other'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'classes_status_check_v2'
  ) then
    alter table classes add constraint classes_status_check_v2
      check (status in ('draft','active','cancelled','completed'));
  end if;
end;
$$;

-- Backfill: copy existing column values to new columns where appropriate
update classes set
  full_name = coalesce(full_name, name),
  simple_name = coalesce(simple_name, name),
  lead_teacher_id = coalesce(lead_teacher_id, teacher_id),
  max_enrollment = coalesce(max_enrollment, max_students),
  min_age = coalesce(min_age, age_min),
  max_age = coalesce(max_age, age_max),
  status = case
    when status is not null then status
    when is_active = true then 'active'
    else 'draft'
  end
where full_name is null or lead_teacher_id is null or max_enrollment is null;

-- Backfill tenant_id
do $$
declare v_tid uuid;
begin
  select id into v_tid from tenants where slug = 'bam' limit 1;
  if v_tid is not null then
    update classes set tenant_id = v_tid where tenant_id is null;
  end if;
end;
$$;

create index if not exists idx_classes_tenant on classes(tenant_id);
create index if not exists idx_classes_status on classes(status);
create index if not exists idx_classes_class_type on classes(class_type);
create index if not exists idx_classes_lead_teacher on classes(lead_teacher_id);
create index if not exists idx_classes_production on classes(production_id);


-- ── CLASS_RECURRENCE_RULES ────────────────────────────────────
create table if not exists class_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  days_of_week integer[] not null,
  start_time time not null,
  end_time time not null,
  frequency text not null default 'weekly'
    check (frequency in ('weekly','biweekly','custom')),
  skip_dates date[],
  created_at timestamptz not null default now()
);

create index idx_recurrence_rules_class on class_recurrence_rules(class_id);
create index idx_recurrence_rules_tenant on class_recurrence_rules(tenant_id);


-- ── CLASS_SESSIONS ────────────────────────────────────────────
create table if not exists class_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  production_id uuid references productions(id) on delete set null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer,
  room text,
  location_notes text,
  lead_teacher_id uuid references auth.users(id) on delete set null,
  assistant_teacher_ids uuid[],
  substitute_teacher_id uuid references auth.users(id) on delete set null,
  is_substitute_session boolean not null default false,
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled','rescheduled')),
  is_cancelled boolean not null default false,
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_pay_decision text
    check (cancellation_pay_decision is null or cancellation_pay_decision in (
      'pay_full','pay_reduced','no_pay','pending')),
  cancellation_pay_rate_override numeric(10,2),
  rescheduled_from_id uuid references class_sessions(id) on delete set null,
  is_discounted boolean not null default false,
  needs_coverage boolean not null default false,
  is_livestreamed boolean not null default false,
  stream_url text,
  attendance_locked_at timestamptz,
  livestream_alerts_sent boolean not null default false,
  timesheet_entries_generated boolean not null default false,
  google_event_id text,
  ical_uid text,
  session_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_class_sessions_tenant on class_sessions(tenant_id);
create index idx_class_sessions_class on class_sessions(class_id);
create index idx_class_sessions_date on class_sessions(session_date);
create index idx_class_sessions_teacher on class_sessions(lead_teacher_id);
create index idx_class_sessions_sub on class_sessions(substitute_teacher_id);
create index idx_class_sessions_status on class_sessions(status);
create index idx_class_sessions_production on class_sessions(production_id);
-- Composite for calendar queries
create index idx_class_sessions_calendar
  on class_sessions(tenant_id, session_date, start_time);


-- ── SESSION_ATTENDANCE ────────────────────────────────────────
create table if not exists session_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  session_id uuid not null references class_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null default 'present'
    check (status in ('present','absent','tardy','excused','not_enrolled')),
  checkin_source text
    check (checkin_source is null or checkin_source in (
      'teacher_roster','front_desk','propagated','ai_inferred')),
  propagated_from_session_id uuid references class_sessions(id) on delete set null,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id) on delete set null,
  notes text,
  makeup_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_session_attendance_session on session_attendance(session_id);
create index idx_session_attendance_student on session_attendance(student_id);
create index idx_session_attendance_tenant on session_attendance(tenant_id);
-- Prevent duplicate attendance per session per student
create unique index idx_session_attendance_unique
  on session_attendance(session_id, student_id);


-- ── ADMIN_TASKS ───────────────────────────────────────────────
create table if not exists admin_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  task_type text not null
    check (task_type in (
      'makeup_needed','class_at_risk','coverage_needed',
      'cancellation_pay_decision','timesheet_review','other')),
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('urgent','normal','low')),
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','dismissed')),
  related_class_id uuid references classes(id) on delete set null,
  related_session_id uuid references class_sessions(id) on delete set null,
  related_teacher_id uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  due_date date,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_admin_tasks_tenant on admin_tasks(tenant_id);
create index idx_admin_tasks_status on admin_tasks(tenant_id, status);
create index idx_admin_tasks_type on admin_tasks(task_type);
create index idx_admin_tasks_class on admin_tasks(related_class_id);
create index idx_admin_tasks_session on admin_tasks(related_session_id);
create index idx_admin_tasks_assigned on admin_tasks(assigned_to);


-- ── AUTO-UPDATE TRIGGERS ──────────────────────────────────────
-- Reuse existing update_updated_at() function from teacher portal migration.

create trigger set_class_sessions_updated_at
  before update on class_sessions
  for each row execute function update_updated_at();

create trigger set_session_attendance_updated_at
  before update on session_attendance
  for each row execute function update_updated_at();

create trigger set_admin_tasks_updated_at
  before update on admin_tasks
  for each row execute function update_updated_at();


-- ── ROW LEVEL SECURITY ───────────────────────────────────────

alter table class_recurrence_rules enable row level security;
alter table class_sessions enable row level security;
alter table session_attendance enable row level security;
alter table admin_tasks enable row level security;

-- Admin full access to all schedule tables
create policy "admins_recurrence_rules" on class_recurrence_rules
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_class_sessions" on class_sessions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_session_attendance" on session_attendance
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_admin_tasks" on admin_tasks
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

-- Teachers can read sessions they teach
create policy "teachers_own_sessions" on class_sessions
  for select using (
    lead_teacher_id = auth.uid()
    or auth.uid() = any(assistant_teacher_ids)
    or substitute_teacher_id = auth.uid()
  );

-- Teachers can read recurrence rules for their classes
create policy "teachers_recurrence_rules" on class_recurrence_rules
  for select using (
    exists (
      select 1 from classes c
      where c.id = class_recurrence_rules.class_id
        and (c.lead_teacher_id = auth.uid()
             or auth.uid() = any(c.assistant_teacher_ids))
    )
  );

-- Teachers can read and write attendance for sessions they teach
create policy "teachers_attendance_select" on session_attendance
  for select using (
    exists (
      select 1 from class_sessions cs
      where cs.id = session_attendance.session_id
        and (cs.lead_teacher_id = auth.uid()
             or auth.uid() = any(cs.assistant_teacher_ids)
             or cs.substitute_teacher_id = auth.uid())
    )
  );

create policy "teachers_attendance_insert" on session_attendance
  for insert with check (
    exists (
      select 1 from class_sessions cs
      where cs.id = session_attendance.session_id
        and (cs.lead_teacher_id = auth.uid()
             or auth.uid() = any(cs.assistant_teacher_ids)
             or cs.substitute_teacher_id = auth.uid())
        and cs.attendance_locked_at is null
    )
  );

create policy "teachers_attendance_update" on session_attendance
  for update using (
    exists (
      select 1 from class_sessions cs
      where cs.id = session_attendance.session_id
        and (cs.lead_teacher_id = auth.uid()
             or auth.uid() = any(cs.assistant_teacher_ids)
             or cs.substitute_teacher_id = auth.uid())
        and cs.attendance_locked_at is null
    )
  );

-- Teachers can read tasks assigned to them
create policy "teachers_own_tasks" on admin_tasks
  for select using (
    related_teacher_id = auth.uid()
    or assigned_to = auth.uid()
  );
