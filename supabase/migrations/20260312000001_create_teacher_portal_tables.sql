-- ============================================================
-- BAM Platform — Teacher Portal Tables
-- Tables: teacher_profiles, rate_definitions, global_rates,
--         teacher_rates, school_years, competition_events,
--         pay_periods, timesheets, timesheet_entries,
--         private_billing_records, private_billing_splits,
--         absence_records, substitute_assignments, makeup_credits
-- ============================================================


-- ── TEACHER_PROFILES ────────────────────────────────────────
-- Extended teacher identity for the portal. References existing
-- profiles table via user_id. Does NOT replace the teachers table.
create table public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name varchar(100),
  last_name varchar(100),
  email varchar(255) not null,
  phone varchar(20),
  teacher_type text not null default 'lead'
    check (teacher_type in ('lead', 'assistant', 'substitute', 'contractor_1099', 'admin_only')),
  employment_type text not null default 'w2'
    check (employment_type in ('w2', '1099')),
  is_active boolean not null default true,
  hire_date date,
  bio text,
  headshot_url varchar(500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_teacher_profiles_tenant on teacher_profiles(tenant_id);
create index idx_teacher_profiles_user on teacher_profiles(user_id);
create index idx_teacher_profiles_active on teacher_profiles(tenant_id, is_active);
create unique index idx_teacher_profiles_tenant_user on teacher_profiles(tenant_id, user_id);


-- ── RATE_DEFINITIONS ────────────────────────────────────────
-- Catalog of rate types: rate_regular_class, rate_private, etc.
create table public.rate_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rate_key varchar(50) not null,
  label varchar(100) not null,
  description text,
  edit_requires_role text not null default 'finance_admin'
    check (edit_requires_role in ('finance_admin', 'finance_lead', 'super_admin')),
  is_active boolean not null default true,
  unique(tenant_id, rate_key)
);

create index idx_rate_definitions_tenant on rate_definitions(tenant_id);


-- ── GLOBAL_RATES ────────────────────────────────────────────
-- Tenant-wide default rate amounts per rate_key with effective date.
create table public.global_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rate_key varchar(50) not null,
  rate_amount decimal(10,2) not null check (rate_amount >= 0),
  effective_date date not null,
  set_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_global_rates_tenant_key on global_rates(tenant_id, rate_key);
create index idx_global_rates_effective on global_rates(tenant_id, rate_key, effective_date desc);


-- ── TEACHER_RATES ───────────────────────────────────────────
-- Per-teacher rate overrides. Effective date controls when rate applies.
create table public.teacher_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  teacher_id uuid not null references teacher_profiles(id) on delete cascade,
  rate_key varchar(50) not null,
  rate_amount decimal(10,2) not null check (rate_amount >= 0),
  effective_date date not null,
  set_by uuid references profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_teacher_rates_teacher on teacher_rates(teacher_id);
create index idx_teacher_rates_lookup on teacher_rates(tenant_id, teacher_id, rate_key, effective_date desc);


-- ── SCHOOL_YEARS ────────────────────────────────────────────
-- Tenant-configurable academic years (not hardcoded Aug–Jul).
create table public.school_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  label varchar(20) not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);

-- Only one current school year per tenant
create unique index idx_school_years_current
  on school_years(tenant_id)
  where is_current = true;

create index idx_school_years_tenant on school_years(tenant_id);


-- ── COMPETITION_EVENTS ──────────────────────────────────────
-- Competition events for cost tracking on timesheet entries.
-- Productions already exist in the productions table (migration 000014).
create table public.competition_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name varchar(200) not null,
  competition_type text not null default 'other'
    check (competition_type in ('yagp', 'regional', 'national', 'local_showcase', 'other')),
  school_year_id uuid references school_years(id) on delete set null,
  location varchar(300),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_competition_events_tenant on competition_events(tenant_id);
create index idx_competition_events_active on competition_events(tenant_id, is_active);


-- ── PAY_PERIODS ─────────────────────────────────────────────
-- Monthly pay periods with submission deadline (default 26th).
create table public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  period_month integer not null check (period_month between 1 and 12),
  period_year integer not null check (period_year between 2020 and 2099),
  submission_deadline date not null,
  status text not null default 'open'
    check (status in ('open', 'closed', 'exported')),
  created_at timestamptz not null default now(),
  unique(tenant_id, period_month, period_year)
);

create index idx_pay_periods_tenant_status on pay_periods(tenant_id, status);


-- ── TIMESHEETS ──────────────────────────────────────────────
-- One timesheet per teacher per pay period.
create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  teacher_id uuid not null references teacher_profiles(id) on delete cascade,
  pay_period_id uuid not null references pay_periods(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'exported')),
  submitted_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_notes text,
  total_hours decimal(6,2) default 0,
  total_pay decimal(10,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, teacher_id, pay_period_id)
);

create index idx_timesheets_teacher on timesheets(teacher_id);
create index idx_timesheets_period on timesheets(pay_period_id);
create index idx_timesheets_tenant_status on timesheets(tenant_id, status);


-- ── TIMESHEET_ENTRIES ───────────────────────────────────────
-- Individual work entries: classes, privates, rehearsals, admin, etc.
-- Rate amount is a snapshot at entry creation — not recalculated live.
create table public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  timesheet_id uuid not null references timesheets(id) on delete cascade,
  entry_type text not null
    check (entry_type in (
      'class_lead', 'class_assistant', 'private', 'rehearsal',
      'performance_event', 'competition', 'training', 'admin',
      'substitute', 'bonus'
    )),
  teacher_role text not null default 'lead'
    check (teacher_role in ('lead', 'assistant', 'substitute')),
  session_id uuid references schedule_instances(id) on delete set null,
  production_id uuid references productions(id) on delete set null,
  competition_id uuid references competition_events(id) on delete set null,
  date date not null,
  start_time time,
  end_time time,
  total_hours decimal(4,2) not null default 0 check (total_hours >= 0),
  description varchar(500),
  notes text,
  rate_key varchar(50),
  rate_amount decimal(10,2) default 0 check (rate_amount >= 0),
  rate_override boolean not null default false,
  rate_override_by uuid references profiles(id) on delete set null,
  is_auto_populated boolean not null default false,
  attendance_status text
    check (attendance_status is null or attendance_status in ('confirmed', 'absent', 'substitute_covered')),
  is_substitute boolean not null default false,
  substitute_for_teacher_id uuid references teacher_profiles(id) on delete set null,
  substitute_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_timesheet_entries_timesheet on timesheet_entries(timesheet_id);
create index idx_timesheet_entries_date on timesheet_entries(date);
create index idx_timesheet_entries_session on timesheet_entries(session_id);
create index idx_timesheet_entries_type on timesheet_entries(entry_type);
-- Prevent duplicate auto-populated entries for the same session
create unique index idx_timesheet_entries_session_unique
  on timesheet_entries(timesheet_id, session_id)
  where session_id is not null;


-- ── PRIVATE_BILLING_RECORDS ─────────────────────────────────
-- Tracks private lesson confirmation and billing status.
create table public.private_billing_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  timesheet_entry_id uuid not null references timesheet_entries(id) on delete cascade,
  teacher_confirmed boolean,  -- null = not yet answered
  admin_confirmed boolean,
  admin_entered_calendar boolean not null default false,
  billing_split_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_private_billing_records_entry on private_billing_records(timesheet_entry_id);
create index idx_private_billing_records_tenant on private_billing_records(tenant_id);


-- ── PRIVATE_BILLING_SPLITS ──────────────────────────────────
-- Per-student billing split for group privates.
create table public.private_billing_splits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  private_billing_record_id uuid not null references private_billing_records(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  billing_account_id uuid,
  billing_account_suggested uuid,
  billing_account_override boolean not null default false,
  split_amount decimal(8,2) not null default 0 check (split_amount >= 0),
  billing_status text not null default 'unbilled'
    check (billing_status in ('unbilled', 'pending', 'charged', 'waived', 'disputed')),
  date_card_charged date,
  charge_reference varchar(200),
  waiver_reason text,
  dispute_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_private_billing_splits_record on private_billing_splits(private_billing_record_id);
create index idx_private_billing_splits_student on private_billing_splits(student_id);
create index idx_private_billing_splits_status on private_billing_splits(billing_status);


-- ── ABSENCE_RECORDS ─────────────────────────────────────────
-- Teacher absence reports linked to schedule instances.
create table public.absence_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  session_id uuid not null references schedule_instances(id) on delete cascade,
  teacher_id uuid not null references teacher_profiles(id) on delete cascade,
  reason_category text not null
    check (reason_category in ('illness', 'personal', 'emergency', 'professional_development', 'other')),
  notes text,
  reported_at timestamptz not null default now(),
  reported_by uuid references profiles(id) on delete set null
);

create index idx_absence_records_teacher on absence_records(teacher_id);
create index idx_absence_records_session on absence_records(session_id);
create index idx_absence_records_tenant on absence_records(tenant_id);


-- ── SUBSTITUTE_ASSIGNMENTS ──────────────────────────────────
-- Tracks substitute teacher assignment, confirmation, and outcome.
create table public.substitute_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  absence_record_id uuid not null references absence_records(id) on delete cascade,
  session_id uuid not null references schedule_instances(id) on delete cascade,
  substitute_teacher_id uuid not null references teacher_profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  confirmed_at timestamptz,
  response_deadline timestamptz,
  sub_rate_amount decimal(10,2),
  sub_rate_override_by uuid references profiles(id) on delete set null,
  notes text,
  decline_reason text
);

create index idx_substitute_assignments_absence on substitute_assignments(absence_record_id);
create index idx_substitute_assignments_sub on substitute_assignments(substitute_teacher_id);
create index idx_substitute_assignments_status on substitute_assignments(tenant_id, status);


-- ── MAKEUP_CREDITS ──────────────────────────────────────────
-- Tracks student makeup eligibility from absences or cancellations.
create table public.makeup_credits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  originating_session_id uuid references schedule_instances(id) on delete set null,
  trigger_type text not null
    check (trigger_type in ('student_absence', 'class_cancelled_no_coverage', 'class_cancelled_studio_closure')),
  program_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'redeemed', 'expired', 'waived')),
  expires_at date,
  makeup_session_id uuid references schedule_instances(id) on delete set null,
  redeemed_at timestamptz,
  waiver_reason text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_makeup_credits_student on makeup_credits(student_id);
create index idx_makeup_credits_status on makeup_credits(tenant_id, status);
create index idx_makeup_credits_expiry on makeup_credits(expires_at) where status = 'pending';


-- ── AUTO-UPDATE TRIGGERS ────────────────────────────────────
create trigger set_teacher_profiles_updated_at
  before update on teacher_profiles
  for each row execute function update_updated_at();

create trigger set_timesheets_updated_at
  before update on timesheets
  for each row execute function update_updated_at();

create trigger set_timesheet_entries_updated_at
  before update on timesheet_entries
  for each row execute function update_updated_at();

create trigger set_private_billing_records_updated_at
  before update on private_billing_records
  for each row execute function update_updated_at();

create trigger set_private_billing_splits_updated_at
  before update on private_billing_splits
  for each row execute function update_updated_at();


-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table teacher_profiles enable row level security;
alter table rate_definitions enable row level security;
alter table global_rates enable row level security;
alter table teacher_rates enable row level security;
alter table school_years enable row level security;
alter table competition_events enable row level security;
alter table pay_periods enable row level security;
alter table timesheets enable row level security;
alter table timesheet_entries enable row level security;
alter table private_billing_records enable row level security;
alter table private_billing_splits enable row level security;
alter table absence_records enable row level security;
alter table substitute_assignments enable row level security;
alter table makeup_credits enable row level security;


-- ── RLS POLICIES: ADMIN FULL ACCESS ────────────────────────
-- Admins (super_admin, admin) have full access to all teacher portal tables.

create policy "admins_teacher_profiles" on teacher_profiles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_rate_definitions" on rate_definitions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_global_rates" on global_rates
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_teacher_rates" on teacher_rates
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_school_years" on school_years
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_competition_events" on competition_events
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_pay_periods" on pay_periods
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_timesheets" on timesheets
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_timesheet_entries" on timesheet_entries
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_private_billing_records" on private_billing_records
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_private_billing_splits" on private_billing_splits
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_absence_records" on absence_records
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_substitute_assignments" on substitute_assignments
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );

create policy "admins_makeup_credits" on makeup_credits
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin', 'admin'))
  );


-- ── RLS POLICIES: TEACHER OWN-DATA ACCESS ──────────────────

-- Teachers can read their own profile
create policy "teachers_own_profile" on teacher_profiles
  for select using (user_id = auth.uid());

-- Teachers can read rate definitions (to see available rate types)
create policy "teachers_rate_definitions_read" on rate_definitions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'teacher')
  );

-- Teachers can read their own rates (W2 can view, not edit)
create policy "teachers_own_rates" on teacher_rates
  for select using (
    exists (
      select 1 from teacher_profiles tp
      where tp.id = teacher_rates.teacher_id
        and tp.user_id = auth.uid()
    )
  );

-- Teachers can read school years
create policy "teachers_school_years_read" on school_years
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'teacher')
  );

-- Teachers can read active competitions (for tagging entries)
create policy "teachers_competitions_read" on competition_events
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'teacher')
  );

-- Teachers can read pay periods
create policy "teachers_pay_periods_read" on pay_periods
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'teacher')
  );

-- Teachers can read and update their own timesheets
create policy "teachers_own_timesheets_select" on timesheets
  for select using (
    exists (
      select 1 from teacher_profiles tp
      where tp.id = timesheets.teacher_id
        and tp.user_id = auth.uid()
    )
  );

create policy "teachers_own_timesheets_update" on timesheets
  for update using (
    exists (
      select 1 from teacher_profiles tp
      where tp.id = timesheets.teacher_id
        and tp.user_id = auth.uid()
    )
    and status in ('draft', 'rejected')  -- Can only update draft or rejected timesheets
  );

-- Teachers can read, insert, and update their own timesheet entries
create policy "teachers_own_entries_select" on timesheet_entries
  for select using (
    exists (
      select 1 from timesheets t
      join teacher_profiles tp on tp.id = t.teacher_id
      where t.id = timesheet_entries.timesheet_id
        and tp.user_id = auth.uid()
    )
  );

create policy "teachers_own_entries_insert" on timesheet_entries
  for insert with check (
    exists (
      select 1 from timesheets t
      join teacher_profiles tp on tp.id = t.teacher_id
      where t.id = timesheet_entries.timesheet_id
        and tp.user_id = auth.uid()
        and t.status in ('draft', 'rejected')
    )
  );

create policy "teachers_own_entries_update" on timesheet_entries
  for update using (
    exists (
      select 1 from timesheets t
      join teacher_profiles tp on tp.id = t.teacher_id
      where t.id = timesheet_entries.timesheet_id
        and tp.user_id = auth.uid()
        and t.status in ('draft', 'rejected')
    )
  );

-- Teachers can read and update private billing records on their own entries
create policy "teachers_own_billing_records" on private_billing_records
  for select using (
    exists (
      select 1 from timesheet_entries te
      join timesheets t on t.id = te.timesheet_id
      join teacher_profiles tp on tp.id = t.teacher_id
      where te.id = private_billing_records.timesheet_entry_id
        and tp.user_id = auth.uid()
    )
  );

create policy "teachers_own_billing_records_update" on private_billing_records
  for update using (
    exists (
      select 1 from timesheet_entries te
      join timesheets t on t.id = te.timesheet_id
      join teacher_profiles tp on tp.id = t.teacher_id
      where te.id = private_billing_records.timesheet_entry_id
        and tp.user_id = auth.uid()
    )
  );

-- Teachers can read their own absence records
create policy "teachers_own_absences_select" on absence_records
  for select using (
    exists (
      select 1 from teacher_profiles tp
      where tp.id = absence_records.teacher_id
        and tp.user_id = auth.uid()
    )
  );

-- Teachers can insert absence records for themselves
create policy "teachers_own_absences_insert" on absence_records
  for insert with check (
    exists (
      select 1 from teacher_profiles tp
      where tp.id = absence_records.teacher_id
        and tp.user_id = auth.uid()
    )
  );

-- Teachers can read substitute assignments they are involved in
create policy "teachers_own_sub_assignments" on substitute_assignments
  for select using (
    exists (
      select 1 from teacher_profiles tp
      where tp.user_id = auth.uid()
        and (tp.id = substitute_assignments.substitute_teacher_id
             or exists (
               select 1 from absence_records ar
               where ar.id = substitute_assignments.absence_record_id
                 and ar.teacher_id = tp.id
             ))
    )
  );

-- Substitutes can update their own assignment status (confirm/decline)
create policy "subs_update_own_assignment" on substitute_assignments
  for update using (
    exists (
      select 1 from teacher_profiles tp
      where tp.id = substitute_assignments.substitute_teacher_id
        and tp.user_id = auth.uid()
    )
    and status = 'pending'
  );


-- ── SEED: DEFAULT SCHOOL YEAR ───────────────────────────────
-- Insert a default school year for BAM (will need tenant_id from tenants table)
-- This is done conditionally if the BAM tenant exists.
do $$
declare
  v_tenant_id uuid;
begin
  select id into v_tenant_id from tenants where slug = 'bam' limit 1;
  if v_tenant_id is not null then
    insert into school_years (tenant_id, label, start_date, end_date, is_current)
    values (v_tenant_id, '2025-2026', '2025-08-01', '2026-07-31', true)
    on conflict do nothing;
  end if;
end;
$$;
