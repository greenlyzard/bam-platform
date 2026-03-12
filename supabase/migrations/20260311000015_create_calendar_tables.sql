-- ============================================================
-- Calendar & Scheduling Module — Phase 1 Foundation
-- Tables: tenants, seasons, rooms, schedule_templates,
--         schedule_instances, calendar_subscriptions,
--         schedule_change_requests, approval_tasks,
--         schedule_embeds
-- ============================================================


-- ── TENANTS ───────────────────────────────────────────────
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);


-- ── SEASONS ───────────────────────────────────────────────
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  period text not null check (period in ('fall','winter','spring','summer')),
  program text not null default 'regular' check (program in
    ('regular','performance','competition','summer_intensive','camp','workshop')),
  year integer not null,
  is_public boolean generated always as (program in ('regular','summer_intensive','camp','workshop')) stored,
  start_date date not null,
  end_date date not null,
  is_active boolean default false,
  registration_open boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);

create index idx_seasons_tenant_active on seasons(tenant_id, is_active);


-- ── ROOMS ─────────────────────────────────────────────────
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  capacity int,
  is_bookable boolean default true,
  hourly_rate_private numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ── SCHEDULE_TEMPLATES ────────────────────────────────────
create table public.schedule_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  teacher_id uuid references profiles(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_trial_eligible boolean default false,
  max_capacity int,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index idx_schedule_templates_season on schedule_templates(season_id);
create index idx_schedule_templates_tenant_active on schedule_templates(tenant_id, is_active);


-- ── SCHEDULE_INSTANCES ────────────────────────────────────
create table public.schedule_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  template_id uuid references schedule_templates(id) on delete set null,
  class_id uuid references classes(id) on delete set null,
  teacher_id uuid references profiles(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  event_type text not null default 'class'
    check (event_type in (
      'class', 'trial_class', 'rehearsal', 'private_lesson',
      'performance', 'room_block', 'teacher_absence', 'studio_closure'
    )),
  event_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'published'
    check (status in (
      'draft', 'pending_approval', 'approved', 'published', 'cancelled', 'notified'
    )),
  cancellation_reason text,
  substitute_teacher_id uuid references profiles(id) on delete set null,
  notes text,
  approval_status text default 'approved'
    check (approval_status is null or approval_status in (
      'draft', 'pending_approval', 'approved', 'published', 'notified'
    )),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  notification_sent_at timestamptz,
  ical_uid text unique,
  is_trial_eligible boolean default false,
  production_id uuid references productions(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_schedule_instances_tenant_date on schedule_instances(tenant_id, event_date);
create index idx_schedule_instances_teacher on schedule_instances(teacher_id);
create index idx_schedule_instances_room on schedule_instances(room_id);
create index idx_schedule_instances_status on schedule_instances(status);


-- ── CALENDAR_SUBSCRIPTIONS ────────────────────────────────
create table public.calendar_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  subscription_token text unique not null,
  scope jsonb not null,
  provider text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_calendar_subscriptions_user on calendar_subscriptions(user_id);


-- ── SCHEDULE_CHANGE_REQUESTS ──────────────────────────────
create table public.schedule_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  instance_id uuid not null references schedule_instances(id) on delete cascade,
  change_type text not null
    check (change_type in (
      'cancellation', 'teacher_change', 'room_change',
      'time_change', 'add_instance', 'note_update'
    )),
  requested_by uuid not null references profiles(id) on delete cascade,
  requested_at timestamptz default now(),
  previous_state jsonb not null,
  proposed_state jsonb not null,
  approval_status text default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  notifications_sent boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_schedule_change_requests_tenant_status on schedule_change_requests(tenant_id, approval_status);


-- ── APPROVAL_TASKS ────────────────────────────────────────
create table public.approval_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  change_request_id uuid not null references schedule_change_requests(id) on delete cascade,
  assigned_to uuid not null references profiles(id) on delete cascade,
  status text default 'pending'
    check (status in ('pending', 'completed', 'dismissed')),
  prompted_at timestamptz default now(),
  completed_at timestamptz,
  prompt_channel text[],
  reminder_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_approval_tasks_assigned_status on approval_tasks(assigned_to, status);


-- ── SCHEDULE_EMBEDS ───────────────────────────────────────
create table public.schedule_embeds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  embed_token text unique not null,
  default_season_id uuid references seasons(id) on delete set null,
  default_days int[],
  default_levels text[],
  default_class_types text[],
  default_age_min int,
  default_age_max int,
  default_teacher_id uuid references profiles(id) on delete set null,
  show_trials_only boolean default false,
  show_rehearsals boolean default false,
  allow_filter_season boolean default false,
  allow_filter_day boolean default true,
  allow_filter_level boolean default true,
  allow_filter_age boolean default true,
  allow_filter_class_type boolean default true,
  allow_filter_teacher boolean default false,
  allow_filter_trial boolean default true,
  allow_filter_rehearsal boolean default false,
  display_mode text default 'week'
    check (display_mode in ('week', 'list', 'day')),
  show_teacher boolean default true,
  show_room boolean default false,
  show_capacity boolean default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_schedule_embeds_token on schedule_embeds(embed_token);


-- ============================================================
-- Triggers: auto-update updated_at
-- ============================================================

create trigger set_seasons_updated_at
  before update on seasons
  for each row execute function update_updated_at();

create trigger set_rooms_updated_at
  before update on rooms
  for each row execute function update_updated_at();

create trigger set_schedule_templates_updated_at
  before update on schedule_templates
  for each row execute function update_updated_at();

create trigger set_schedule_instances_updated_at
  before update on schedule_instances
  for each row execute function update_updated_at();

create trigger set_schedule_change_requests_updated_at
  before update on schedule_change_requests
  for each row execute function update_updated_at();

create trigger set_approval_tasks_updated_at
  before update on approval_tasks
  for each row execute function update_updated_at();

create trigger set_schedule_embeds_updated_at
  before update on schedule_embeds
  for each row execute function update_updated_at();


-- ============================================================
-- Row Level Security
-- ============================================================

-- ── TENANTS ───────────────────────────────────────────────
alter table tenants enable row level security;

create policy "tenants_select_authenticated" on tenants
  for select to authenticated using (true);

create policy "tenants_all_admin" on tenants
  for all to authenticated using (public.is_admin());


-- ── SEASONS ───────────────────────────────────────────────
alter table seasons enable row level security;

create policy "seasons_select_authenticated" on seasons
  for select to authenticated using (true);

create policy "seasons_all_admin" on seasons
  for all to authenticated using (public.is_admin());


-- ── ROOMS ─────────────────────────────────────────────────
alter table rooms enable row level security;

create policy "rooms_select_authenticated" on rooms
  for select to authenticated using (true);

create policy "rooms_all_admin" on rooms
  for all to authenticated using (public.is_admin());


-- ── SCHEDULE_TEMPLATES ────────────────────────────────────
alter table schedule_templates enable row level security;

create policy "schedule_templates_select_authenticated" on schedule_templates
  for select to authenticated using (true);

create policy "schedule_templates_all_admin" on schedule_templates
  for all to authenticated using (public.is_admin());


-- ── SCHEDULE_INSTANCES ────────────────────────────────────
alter table schedule_instances enable row level security;

create policy "schedule_instances_all_admin" on schedule_instances
  for all to authenticated using (public.is_admin());

-- Teachers: read instances for their own classes
create policy "schedule_instances_select_teacher" on schedule_instances
  for select to authenticated using (
    public.is_teacher()
    and (
      teacher_id = auth.uid()
      or substitute_teacher_id = auth.uid()
    )
  );

-- Front desk: read approved+ instances
create policy "schedule_instances_select_front_desk" on schedule_instances
  for select to authenticated using (
    public.is_front_desk()
    and status in ('approved', 'published', 'notified')
  );

-- Parents: read published events for enrolled children + performances/closures
create policy "schedule_instances_select_parent" on schedule_instances
  for select to authenticated using (
    status in ('published', 'notified')
    and (
      -- Performances and closures visible to all
      event_type in ('performance', 'studio_closure')
      or
      -- Classes visible if child is enrolled
      class_id in (
        select e.class_id from enrollments e
        where e.student_id = any(public.my_student_ids())
        and e.status in ('active', 'trial')
      )
    )
  );


-- ── CALENDAR_SUBSCRIPTIONS ────────────────────────────────
alter table calendar_subscriptions enable row level security;

create policy "calendar_subscriptions_own" on calendar_subscriptions
  for all to authenticated using (user_id = auth.uid());

create policy "calendar_subscriptions_all_admin" on calendar_subscriptions
  for all to authenticated using (public.is_admin());


-- ── SCHEDULE_CHANGE_REQUESTS ──────────────────────────────
alter table schedule_change_requests enable row level security;

create policy "schedule_change_requests_all_admin" on schedule_change_requests
  for all to authenticated using (public.is_admin());

-- Teachers: insert + read own
create policy "schedule_change_requests_insert_teacher" on schedule_change_requests
  for insert to authenticated
  with check (public.is_teacher() and requested_by = auth.uid());

create policy "schedule_change_requests_select_teacher" on schedule_change_requests
  for select to authenticated using (
    public.is_teacher() and requested_by = auth.uid()
  );

-- Schedule approvers: read pending
create policy "schedule_change_requests_select_approver" on schedule_change_requests
  for select to authenticated using (
    public.is_schedule_approver()
    and approval_status = 'pending'
  );


-- ── APPROVAL_TASKS ────────────────────────────────────────
alter table approval_tasks enable row level security;

create policy "approval_tasks_all_admin" on approval_tasks
  for all to authenticated using (public.is_admin());

-- Assigned user: read + update own
create policy "approval_tasks_select_own" on approval_tasks
  for select to authenticated using (assigned_to = auth.uid());

create policy "approval_tasks_update_own" on approval_tasks
  for update to authenticated
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());


-- ── SCHEDULE_EMBEDS ───────────────────────────────────────
alter table schedule_embeds enable row level security;

create policy "schedule_embeds_all_admin" on schedule_embeds
  for all to authenticated using (public.is_admin());


-- ============================================================
-- Seed Data
-- ============================================================
do $$
declare
  v_tenant_id uuid;
  v_season_id uuid;
begin
  -- Tenant
  insert into public.tenants (name, slug)
  values ('Ballet Academy and Movement', 'bam')
  returning id into v_tenant_id;

  -- Season
  insert into public.seasons (tenant_id, name, period, program, year, start_date, end_date, is_active, registration_open)
  values (v_tenant_id, 'Spring 2026', 'spring', 'regular', 2026, '2026-01-06', '2026-06-14', true, true)
  returning id into v_season_id;

  -- Rooms
  insert into public.rooms (tenant_id, name, capacity, is_bookable, notes) values
    (v_tenant_id, 'Studio A', 10, true, 'Sprung floor'),
    (v_tenant_id, 'Studio B', 8, true, null),
    (v_tenant_id, 'Waiting Area', 20, false, null);
end $$;
