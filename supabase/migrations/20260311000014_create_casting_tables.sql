-- ============================================================
-- Casting & Rehearsal Module (V2)
-- Tables: productions, dances, production_dances, casting,
--         rehearsals, rehearsal_attendance, schedule_approvers
-- Includes approval workflow + competition/recital dual-track
-- ============================================================

-- Drop old tables if the previous version of this migration ran
drop table if exists performance_events cascade;
drop table if exists rehearsal_attendance cascade;
drop table if exists schedule_approvers cascade;
drop table if exists casting cascade;
drop table if exists rehearsals cascade;
drop table if exists production_dances cascade;
drop table if exists dances cascade;
drop table if exists roles cascade;
drop table if exists productions cascade;


-- ── PRODUCTIONS ─────────────────────────────────────────────
create table public.productions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  production_type text not null default 'recital'
    check (production_type in ('recital', 'showcase', 'competition', 'mixed')),
  season text,
  venue_name text,
  venue_address text,
  venue_directions text,
  performance_date date,
  call_time time,
  start_time time,
  end_time time,
  competition_org text,
  competition_division text,
  notes text,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'pending_review', 'approved', 'published')),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_productions_season on productions(season);
create index idx_productions_approval on productions(approval_status);
create index idx_productions_published on productions(is_published);

-- ── DANCES ──────────────────────────────────────────────────
-- A choreographed piece, independent of which production it appears in
create table public.dances (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  discipline text not null
    check (discipline in ('ballet', 'jazz', 'contemporary', 'hip_hop', 'lyrical', 'tap', 'musical_theatre', 'pointe')),
  choreographer_id uuid references profiles(id) on delete set null,
  level text,
  duration_seconds integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_dances_discipline on dances(discipline);
create index idx_dances_choreographer on dances(choreographer_id);

-- ── PRODUCTION_DANCES ───────────────────────────────────────
-- Links a dance to a production with performance-specific details.
-- Same dance can appear in a recital AND a competition with different music/costumes.
create table public.production_dances (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions(id) on delete cascade,
  dance_id uuid not null references dances(id) on delete cascade,
  performance_type text not null default 'recital'
    check (performance_type in ('recital', 'competition', 'showcase')),
  performance_order integer not null default 0,
  music_title text,
  music_artist text,
  music_duration_seconds integer,
  music_file_url text,
  costume_description text,
  costume_notes text,
  costume_due_date date,
  stage_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_production_dances_production on production_dances(production_id);
create index idx_production_dances_dance on production_dances(dance_id);
-- A dance appears once per production
create unique index idx_production_dances_unique on production_dances(production_id, dance_id);

-- ── CASTING ─────────────────────────────────────────────────
create table public.casting (
  id uuid primary key default gen_random_uuid(),
  production_dance_id uuid not null references production_dances(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  role text not null default 'ensemble'
    check (role in ('principal', 'soloist', 'corps', 'ensemble')),
  costume_assigned boolean not null default false,
  costume_notes text,
  is_alternate boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_casting_production_dance on casting(production_dance_id);
create index idx_casting_student on casting(student_id);
create unique index idx_casting_unique on casting(production_dance_id, student_id);

-- ── REHEARSALS ──────────────────────────────────────────────
create table public.rehearsals (
  id uuid primary key default gen_random_uuid(),
  production_dance_id uuid not null references production_dances(id) on delete cascade,
  rehearsal_date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  location_address text,
  location_directions text,
  rehearsal_type text not null default 'rehearsal'
    check (rehearsal_type in ('rehearsal', 'dress_rehearsal', 'tech_rehearsal', 'spacing')),
  notes text,
  is_mandatory boolean not null default true,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'pending_review', 'approved')),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rehearsals_production_dance on rehearsals(production_dance_id);
create index idx_rehearsals_date on rehearsals(rehearsal_date);
create index idx_rehearsals_approval on rehearsals(approval_status);

-- ── REHEARSAL_ATTENDANCE ────────────────────────────────────
create table public.rehearsal_attendance (
  id uuid primary key default gen_random_uuid(),
  rehearsal_id uuid not null references rehearsals(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null default 'present'
    check (status in ('present', 'absent', 'excused', 'late')),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_rehearsal_attendance_rehearsal on rehearsal_attendance(rehearsal_id);
create index idx_rehearsal_attendance_student on rehearsal_attendance(student_id);
create unique index idx_rehearsal_attendance_unique on rehearsal_attendance(rehearsal_id, student_id);

-- ── SCHEDULE_APPROVERS ──────────────────────────────────────
-- Controls who can approve schedules (Amanda, Cara, etc.)
create table public.schedule_approvers (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  scope text not null default 'all'
    check (scope in ('all', 'production', 'rehearsal')),
  production_id uuid references productions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_schedule_approvers_staff on schedule_approvers(staff_id);


-- ── TRIGGERS: auto-update updated_at ────────────────────────
create trigger set_productions_updated_at
  before update on productions
  for each row execute function update_updated_at();

create trigger set_dances_updated_at
  before update on dances
  for each row execute function update_updated_at();

create trigger set_production_dances_updated_at
  before update on production_dances
  for each row execute function update_updated_at();

create trigger set_rehearsals_updated_at
  before update on rehearsals
  for each row execute function update_updated_at();


-- ============================================================
-- Add front_desk role to user_role enum
-- ============================================================
alter type user_role add value if not exists 'front_desk';

-- ============================================================
-- Row Level Security
-- ============================================================

-- Helper: check if front_desk role
-- Uses role::text cast because the enum value was just added
-- and can't be referenced as a literal in the same transaction
create or replace function public.is_front_desk()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'front_desk'
  )
$$ language sql security definer stable;

-- Helper: check if user is a schedule approver
create or replace function public.is_schedule_approver()
returns boolean as $$
  select exists (
    select 1 from public.schedule_approvers
    where staff_id = auth.uid()
  )
$$ language sql security definer stable;


-- ── PRODUCTIONS ─────────────────────────────────────────────
alter table productions enable row level security;

-- Admin: full access
create policy "productions_all_admin" on productions
  for all to authenticated using (public.is_admin());

-- Teacher: read own (choreographer on a dance in this production)
create policy "productions_select_teacher" on productions
  for select to authenticated using (
    public.is_teacher()
    and id in (
      select pd.production_id from production_dances pd
      join dances d on d.id = pd.dance_id
      where d.choreographer_id = auth.uid()
    )
  );

-- Front desk: read all approved+published
create policy "productions_select_front_desk" on productions
  for select to authenticated using (
    (public.is_front_desk() or public.is_schedule_approver())
    and approval_status in ('approved', 'published')
  );

-- Parent/student: read only published
create policy "productions_select_published" on productions
  for select to authenticated using (
    is_published = true
    and approval_status = 'published'
  );


-- ── DANCES ──────────────────────────────────────────────────
alter table dances enable row level security;

create policy "dances_all_admin" on dances
  for all to authenticated using (public.is_admin());

create policy "dances_select_teacher" on dances
  for select to authenticated using (public.is_teacher());

create policy "dances_manage_choreographer" on dances
  for all to authenticated using (
    public.is_teacher() and choreographer_id = auth.uid()
  );

-- Authenticated users can read dances in published productions
create policy "dances_select_published" on dances
  for select to authenticated using (
    id in (
      select pd.dance_id from production_dances pd
      join productions p on p.id = pd.production_id
      where p.is_published = true
    )
  );


-- ── PRODUCTION_DANCES ───────────────────────────────────────
alter table production_dances enable row level security;

create policy "production_dances_all_admin" on production_dances
  for all to authenticated using (public.is_admin());

create policy "production_dances_select_teacher" on production_dances
  for select to authenticated using (
    public.is_teacher()
    and dance_id in (
      select id from dances where choreographer_id = auth.uid()
    )
  );

create policy "production_dances_select_front_desk" on production_dances
  for select to authenticated using (
    (public.is_front_desk() or public.is_schedule_approver())
    and production_id in (
      select id from productions where approval_status in ('approved', 'published')
    )
  );

create policy "production_dances_select_published" on production_dances
  for select to authenticated using (
    production_id in (
      select id from productions where is_published = true
    )
  );


-- ── CASTING ─────────────────────────────────────────────────
alter table casting enable row level security;

create policy "casting_all_admin" on casting
  for all to authenticated using (public.is_admin());

create policy "casting_manage_teacher" on casting
  for all to authenticated using (
    public.is_teacher()
    and production_dance_id in (
      select pd.id from production_dances pd
      join dances d on d.id = pd.dance_id
      where d.choreographer_id = auth.uid()
    )
  );

-- Front desk: read casting for approved/published productions
create policy "casting_select_front_desk" on casting
  for select to authenticated using (
    (public.is_front_desk() or public.is_schedule_approver())
    and production_dance_id in (
      select pd.id from production_dances pd
      join productions p on p.id = pd.production_id
      where p.approval_status in ('approved', 'published')
    )
  );

-- Parent: read own children's casting in published productions only
create policy "casting_select_parent" on casting
  for select to authenticated using (
    student_id = any(public.my_student_ids())
    and production_dance_id in (
      select pd.id from production_dances pd
      join productions p on p.id = pd.production_id
      where p.is_published = true
    )
  );


-- ── REHEARSALS ──────────────────────────────────────────────
alter table rehearsals enable row level security;

create policy "rehearsals_all_admin" on rehearsals
  for all to authenticated using (public.is_admin());

-- Teacher: manage rehearsals for own dances
create policy "rehearsals_manage_teacher" on rehearsals
  for all to authenticated using (
    public.is_teacher()
    and production_dance_id in (
      select pd.id from production_dances pd
      join dances d on d.id = pd.dance_id
      where d.choreographer_id = auth.uid()
    )
  );

-- Front desk + approvers: read all approved rehearsals
create policy "rehearsals_select_front_desk" on rehearsals
  for select to authenticated using (
    (public.is_front_desk() or public.is_schedule_approver())
    and approval_status = 'approved'
  );

-- Parent: read approved rehearsals where their child is cast
create policy "rehearsals_select_parent" on rehearsals
  for select to authenticated using (
    approval_status = 'approved'
    and production_dance_id in (
      select c.production_dance_id from casting c
      where c.student_id = any(public.my_student_ids())
    )
    and production_dance_id in (
      select pd.id from production_dances pd
      join productions p on p.id = pd.production_id
      where p.is_published = true
    )
  );


-- ── REHEARSAL_ATTENDANCE ────────────────────────────────────
alter table rehearsal_attendance enable row level security;

create policy "rehearsal_attendance_all_admin" on rehearsal_attendance
  for all to authenticated using (public.is_admin());

create policy "rehearsal_attendance_manage_teacher" on rehearsal_attendance
  for all to authenticated using (
    public.is_teacher()
    and rehearsal_id in (
      select r.id from rehearsals r
      join production_dances pd on pd.id = r.production_dance_id
      join dances d on d.id = pd.dance_id
      where d.choreographer_id = auth.uid()
    )
  );

-- Parent: read own child's attendance
create policy "rehearsal_attendance_select_parent" on rehearsal_attendance
  for select to authenticated
  using (student_id = any(public.my_student_ids()));


-- ── SCHEDULE_APPROVERS ──────────────────────────────────────
alter table schedule_approvers enable row level security;

-- Admin only
create policy "schedule_approvers_all_admin" on schedule_approvers
  for all to authenticated using (public.is_admin());

-- Approvers can read their own record
create policy "schedule_approvers_select_own" on schedule_approvers
  for select to authenticated using (staff_id = auth.uid());
