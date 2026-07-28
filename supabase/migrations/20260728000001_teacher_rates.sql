-- =============================================================================
-- teacher_rates: effective-dated, per-category, hourly-or-flat pay rates
--
-- Spec: docs/PAYROLL_CORRECTNESS_AND_REPORTING.md §3.2, §3.3
--
-- Replaces the four flat columns on `teachers` (class/private/rehearsal/admin),
-- which cannot express: the six entry types with no column, the class_lead vs
-- class_assistant split, a flat fee, or effective dating.
--
-- SCHEMA ONLY. Rate values are seeded in a separate migration so a bad seed
-- cannot force a schema rollback.
--
-- Also splits teachers.employment_type into its two conflated dimensions
-- (tax classification vs schedule commitment) — same table touch, so done here
-- rather than in a second migration requiring a second type regeneration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pre-flight. Fail loudly before any DDL rather than half-applying.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'tenants') then
    raise exception 'Pre-flight failed: public.tenants does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'teachers') then
    raise exception 'Pre-flight failed: public.teachers does not exist';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'profile_roles') then
    raise exception 'Pre-flight failed: public.profile_roles does not exist';
  end if;

  -- teachers.id IS the profile id. If that ever stops being true, the RLS
  -- self-access policy below silently grants nothing.
  if exists (select 1 from teachers t
             where not exists (select 1 from profiles p where p.id = t.id)) then
    raise exception 'Pre-flight failed: teachers rows exist with no matching profiles row';
  end if;

  if exists (select 1 from teachers
             where employment_type is not null
               and employment_type not in
                   ('employee','part_time','full_time','contract',
                    'contractor_1099','pending_classification','owner')) then
    raise exception 'Pre-flight failed: unexpected employment_type value present';
  end if;
end $$;

create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- 1. teacher_rates
-- -----------------------------------------------------------------------------
create table if not exists public.teacher_rates (
  id            uuid primary key default gen_random_uuid(),

  -- teachers has no tenant_id, so tenant is carried explicitly rather than
  -- inherited. NO ACTION: a tenant with pay history must not be deletable.
  tenant_id     uuid not null references public.tenants(id) on delete no action,

  -- teachers.id IS the profile id — there is no teachers.profile_id/user_id.
  teacher_id    uuid not null references public.teachers(id) on delete cascade,

  -- Must match timesheet_entries.entry_type exactly, or a resolver lookup
  -- silently finds nothing and the entry is valued at zero.
  rate_key      text not null check (rate_key in (
                  'class_lead','class_assistant','private','rehearsal',
                  'performance_event','competition','training','admin',
                  'substitute','bonus')),

  rate_type     text not null default 'hourly'
                  check (rate_type in ('hourly','flat')),

  -- Integer cents everywhere. timesheet_entries.rate_amount is numeric; that
  -- discrepancy is resolved when the snapshot column is added.
  amount_cents  integer not null check (amount_cents >= 0),

  valid_from    date not null default current_date,
  valid_to      date null,

  note          text null,
  created_at    timestamptz not null default now(),
  created_by    uuid null references public.profiles(id) on delete set null,
  updated_at    timestamptz not null default now(),

  constraint teacher_rates_valid_range check (valid_to is null or valid_to > valid_from)
);

-- No two open or overlapping windows for the same teacher and category.
-- Half-open range: a row ending 2026-08-15 and one starting 2026-08-15 abut
-- without overlapping, which is what closing a row and opening the next does.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teacher_rates_no_overlap') then
    alter table public.teacher_rates
      add constraint teacher_rates_no_overlap
      exclude using gist (
        teacher_id with =,
        rate_key with =,
        daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[)') with &&
      );
  end if;
end $$;

create index if not exists teacher_rates_lookup_idx
  on public.teacher_rates (teacher_id, rate_key, valid_from desc);

create index if not exists teacher_rates_tenant_idx
  on public.teacher_rates (tenant_id);

comment on table public.teacher_rates is
  'Effective-dated pay rates. Resolution is by the WORK DATE of a timesheet entry, never the entry or approval date. See docs/PAYROLL_CORRECTNESS_AND_REPORTING.md §3.1.';

comment on column public.teacher_rates.rate_type is
  'hourly: amount_cents x hours. flat: amount_cents as-is, entry carries no hours. Lives on the rate row, not the teacher — a guest performer is flat for performances and hourly for rehearsals simultaneously.';

-- -----------------------------------------------------------------------------
-- 2. Split employment_type into its two dimensions
--    employment_type is retained: classifyEmployment still reads it.
-- -----------------------------------------------------------------------------
alter table public.teachers
  add column if not exists tax_classification text,
  add column if not exists schedule_type      text;

update public.teachers
set tax_classification = case employment_type
      when 'owner'                  then 'owner'
      when 'contractor_1099'        then 'contractor_1099'
      when 'contract'               then 'contractor_1099'
      when 'pending_classification' then 'pending'
      when 'employee'               then 'w2'
      when 'part_time'              then 'w2'
      when 'full_time'              then 'w2'
      else 'pending'
    end
where tax_classification is null;

update public.teachers
set schedule_type = case employment_type
      when 'full_time' then 'full_time'
      when 'part_time' then 'part_time'
      when 'employee'  then 'full_time'
      when 'owner'     then 'part_time'
      else 'as_needed'
    end
where schedule_type is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teachers_tax_classification_check') then
    alter table public.teachers
      add constraint teachers_tax_classification_check
      check (tax_classification is null or tax_classification in
             ('w2','contractor_1099','owner','pending'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'teachers_schedule_type_check') then
    alter table public.teachers
      add constraint teachers_schedule_type_check
      check (schedule_type is null or schedule_type in
             ('full_time','part_time','as_needed'));
  end if;
end $$;

comment on column public.teachers.tax_classification is
  'W-2 vs 1099 vs owner. Square Payroll is authoritative; this is a mirror and a mismatch is an anomaly worth surfacing.';

comment on column public.teachers.employment_type is
  'LEGACY — conflates tax classification with schedule commitment. Superseded by tax_classification + schedule_type. Still read by classifyEmployment; retire once that is migrated.';

-- -----------------------------------------------------------------------------
-- 3. Pay-management guard
--    NOT has_finance_role() (excludes studio_manager) and NEVER is_admin()
--    (admits plain 'admin', which must not see pay).
-- -----------------------------------------------------------------------------
create or replace function public.can_manage_pay(p_tenant_id uuid)
returns boolean language sql stable security definer
set search_path = public as $fn$
  select exists (
    select 1 from profile_roles
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
      and role in ('super_admin','finance_admin','studio_manager')
      and is_active = true
  )
$fn$;

create or replace function public.can_manage_pay()
returns boolean language sql stable security definer
set search_path = public as $fn$
  select exists (
    select 1 from profile_roles
    where user_id = auth.uid()
      and role in ('super_admin','finance_admin','studio_manager')
      and is_active = true
  )
$fn$;

comment on function public.can_manage_pay(uuid) is
  'Pay visibility and edit rights. Prefer this tenant-scoped form. See docs/PAYROLL_CORRECTNESS_AND_REPORTING.md §3.3.';

-- -----------------------------------------------------------------------------
-- 4. RLS — ships with the table, not after it
-- -----------------------------------------------------------------------------
alter table public.teacher_rates enable row level security;

drop policy if exists teacher_rates_select_own on public.teacher_rates;
create policy teacher_rates_select_own
  on public.teacher_rates for select
  using (teacher_id = auth.uid());

drop policy if exists teacher_rates_select_pay_manager on public.teacher_rates;
create policy teacher_rates_select_pay_manager
  on public.teacher_rates for select
  using (public.can_manage_pay(tenant_id));

drop policy if exists teacher_rates_insert_pay_manager on public.teacher_rates;
create policy teacher_rates_insert_pay_manager
  on public.teacher_rates for insert
  with check (public.can_manage_pay(tenant_id));

drop policy if exists teacher_rates_update_pay_manager on public.teacher_rates;
create policy teacher_rates_update_pay_manager
  on public.teacher_rates for update
  using (public.can_manage_pay(tenant_id))
  with check (public.can_manage_pay(tenant_id));

-- No delete policy. Rates are closed by setting valid_to, never removed —
-- deleting one silently rewrites what a past entry should have been worth.

-- -----------------------------------------------------------------------------
-- 5. Post-flight
-- -----------------------------------------------------------------------------
do $$
declare v_missing int;
begin
  select count(*) into v_missing from teachers where tax_classification is null;
  if v_missing > 0 then
    raise exception 'Post-flight failed: % teachers rows have null tax_classification', v_missing;
  end if;

  select count(*) into v_missing from teachers where schedule_type is null;
  if v_missing > 0 then
    raise exception 'Post-flight failed: % teachers rows have null schedule_type', v_missing;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'teacher_rates_no_overlap') then
    raise exception 'Post-flight failed: overlap exclusion constraint was not created';
  end if;
end $$;
