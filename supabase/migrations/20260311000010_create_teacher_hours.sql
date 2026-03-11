-- ============================================================
-- BAM Platform — Teacher Hours Table
-- Tracks teaching hours by category for payroll
-- ============================================================

create table teacher_hours (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references profiles(id) on delete cascade not null,
  class_id uuid references classes(id) on delete set null,
  date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  category text not null check (category in ('class', 'private', 'rehearsal', 'admin', 'sub')),
  notes text,
  approved boolean default false,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index idx_teacher_hours_teacher on teacher_hours(teacher_id);
create index idx_teacher_hours_date on teacher_hours(date);
create index idx_teacher_hours_teacher_date on teacher_hours(teacher_id, date);

-- RLS
alter table teacher_hours enable row level security;

-- Teachers can see and insert their own hours
create policy "teachers_own_hours_select" on teacher_hours
  for select using (teacher_id = auth.uid());

create policy "teachers_own_hours_insert" on teacher_hours
  for insert with check (teacher_id = auth.uid());

create policy "teachers_own_hours_update" on teacher_hours
  for update using (teacher_id = auth.uid() and approved = false);

-- Admins have full access
create policy "admins_teacher_hours" on teacher_hours
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- Updated_at trigger
create trigger set_teacher_hours_updated_at
  before update on teacher_hours
  for each row execute function update_updated_at();
