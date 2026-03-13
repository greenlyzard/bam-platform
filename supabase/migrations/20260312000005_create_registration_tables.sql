-- ============================================================
-- Registration Phase 1 — Families, Enhanced Students/Enrollments
-- Creates: families, family_contacts, enrollment_windows
-- Alters: students, enrollments
-- ============================================================


-- ── FAMILIES ────────────────────────────────────────────────
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  primary_contact_id uuid references auth.users(id) on delete set null,
  family_name text not null,
  billing_email text,
  billing_phone text,
  stripe_customer_id text,
  account_credit numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_families_tenant on families(tenant_id);
create index idx_families_primary_contact on families(primary_contact_id);

alter table families enable row level security;


-- ── FAMILY_CONTACTS ─────────────────────────────────────────
create table if not exists family_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  contact_type text not null check (contact_type in ('emergency','stream','both')),
  first_name text not null,
  last_name text not null,
  relationship text,
  phone text,
  email text,
  has_portal_account boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  notify_via_sms boolean not null default true,
  notify_via_email boolean not null default true,
  notify_via_app boolean not null default false,
  is_primary boolean not null default false,
  stream_authorized_student_ids uuid[],
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_family_contacts_family on family_contacts(family_id);
create index idx_family_contacts_tenant on family_contacts(tenant_id);

alter table family_contacts enable row level security;


-- ── ENROLLMENT_WINDOWS ──────────────────────────────────────
create table if not exists enrollment_windows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  school_year text not null,
  returning_open_at timestamptz,
  returning_close_at timestamptz,
  public_open_at timestamptz,
  public_close_at timestamptz,
  earlybird_discount_type text check (earlybird_discount_type is null or earlybird_discount_type in ('percent','amount')),
  earlybird_discount_value numeric(10,2),
  earlybird_applies_to text check (earlybird_applies_to is null or earlybird_applies_to in ('registration_fee','first_month')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_enrollment_windows_tenant on enrollment_windows(tenant_id);

alter table enrollment_windows enable row level security;


-- ── ALTER STUDENTS ──────────────────────────────────────────
alter table students
  add column if not exists tenant_id uuid references tenants(id) on delete cascade,
  add column if not exists family_id uuid references families(id) on delete set null,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists gender text,
  add column if not exists allergy_notes text,
  add column if not exists stream_consent boolean not null default false,
  add column if not exists trial_used boolean not null default false,
  add column if not exists trial_approved_override boolean not null default false,
  add column if not exists portal_access_enabled boolean not null default false,
  add column if not exists portal_access_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists portal_access_approved_at timestamptz,
  add column if not exists portal_access_level text not null default 'view_only';

-- Add CHECK constraint for portal_access_level
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_portal_access_level_check'
  ) then
    alter table students add constraint students_portal_access_level_check
      check (portal_access_level in ('view_only','standard','full'));
  end if;
end;
$$;

-- Backfill tenant_id from BAM tenant
do $$
declare v_tid uuid;
begin
  select id into v_tid from tenants where slug = 'bam' limit 1;
  if v_tid is not null then
    update students set tenant_id = v_tid where tenant_id is null;
  end if;
end;
$$;

create index if not exists idx_students_family on students(family_id);
create index if not exists idx_students_tenant on students(tenant_id);


-- ── ALTER ENROLLMENTS ───────────────────────────────────────
alter table enrollments
  add column if not exists tenant_id uuid references tenants(id) on delete cascade,
  add column if not exists family_id uuid references families(id) on delete set null,
  add column if not exists enrollment_type text not null default 'full',
  add column if not exists enrolled_by uuid references auth.users(id) on delete set null,
  add column if not exists drop_date date,
  add column if not exists drop_reason text,
  add column if not exists drop_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_notice_date date,
  add column if not exists proration_method text not null default 'per_class',
  add column if not exists prorated_amount numeric(10,2),
  add column if not exists proration_override boolean not null default false,
  add column if not exists proration_override_by uuid references auth.users(id) on delete set null,
  add column if not exists proration_override_reason text,
  add column if not exists billing_override boolean not null default false,
  add column if not exists override_amount numeric(10,2),
  add column if not exists override_reason text,
  add column if not exists override_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- Add CHECK constraints for new enrollment columns
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'enrollments_enrollment_type_check'
  ) then
    alter table enrollments add constraint enrollments_enrollment_type_check
      check (enrollment_type in ('full','trial','audit','comp'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'enrollments_proration_method_check'
  ) then
    alter table enrollments add constraint enrollments_proration_method_check
      check (proration_method in ('per_class','daily','split','custom','none'));
  end if;
end;
$$;

-- Migrate status CHECK: drop old inline check, add new named one with more values
do $$
declare
  v_conname text;
begin
  -- Find the existing unnamed status CHECK constraint
  select con.conname into v_conname
  from pg_constraint con
  join pg_attribute att on att.attnum = any(con.conkey) and att.attrelid = con.conrelid
  where con.conrelid = 'enrollments'::regclass
    and con.contype = 'c'
    and att.attname = 'status'
    and con.conname != 'enrollments_enrollment_type_check'
    and con.conname != 'enrollments_proration_method_check'
  limit 1;

  if v_conname is not null then
    execute format('alter table enrollments drop constraint %I', v_conname);
  end if;

  -- Add the new named constraint with expanded values
  if not exists (
    select 1 from pg_constraint where conname = 'enrollments_status_check_v2'
  ) then
    alter table enrollments add constraint enrollments_status_check_v2
      check (status in ('active','waitlist','dropped','trial','completed','pending_payment','suspended'));
  end if;
end;
$$;

-- Backfill tenant_id from BAM tenant
do $$
declare v_tid uuid;
begin
  select id into v_tid from tenants where slug = 'bam' limit 1;
  if v_tid is not null then
    update enrollments set tenant_id = v_tid where tenant_id is null;
  end if;
end;
$$;

create index if not exists idx_enrollments_family on enrollments(family_id);
create index if not exists idx_enrollments_tenant on enrollments(tenant_id);


-- ── TRIGGERS ────────────────────────────────────────────────
-- Reuse existing update_updated_at() function

create trigger set_family_contacts_updated_at
  before update on family_contacts
  for each row execute function update_updated_at();

create trigger set_enrollments_updated_at
  before update on enrollments
  for each row execute function update_updated_at();


-- ── ROW LEVEL SECURITY — FAMILIES ───────────────────────────

-- Admin full access
create policy "admins_families" on families
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin','admin'))
  );

-- Parent can read own family
create policy "parent_own_family" on families
  for select using (primary_contact_id = auth.uid());


-- ── ROW LEVEL SECURITY — FAMILY_CONTACTS ────────────────────

-- Admin full access
create policy "admins_family_contacts" on family_contacts
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin','admin'))
  );

-- Parent can manage contacts for their own family
create policy "parent_own_family_contacts_select" on family_contacts
  for select using (
    exists (
      select 1 from families f
      where f.id = family_contacts.family_id
        and f.primary_contact_id = auth.uid()
    )
  );

create policy "parent_own_family_contacts_insert" on family_contacts
  for insert with check (
    exists (
      select 1 from families f
      where f.id = family_contacts.family_id
        and f.primary_contact_id = auth.uid()
    )
  );

create policy "parent_own_family_contacts_update" on family_contacts
  for update using (
    exists (
      select 1 from families f
      where f.id = family_contacts.family_id
        and f.primary_contact_id = auth.uid()
    )
  );

create policy "parent_own_family_contacts_delete" on family_contacts
  for delete using (
    exists (
      select 1 from families f
      where f.id = family_contacts.family_id
        and f.primary_contact_id = auth.uid()
    )
  );


-- ── ROW LEVEL SECURITY — ENROLLMENT_WINDOWS ─────────────────

-- Admin full access
create policy "admins_enrollment_windows" on enrollment_windows
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('super_admin','admin'))
  );

-- Any authenticated user can read enrollment windows
create policy "authenticated_read_enrollment_windows" on enrollment_windows
  for select using (auth.uid() is not null);
