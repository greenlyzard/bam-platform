-- =============================================================================
-- Tenant-scope mandated_reporter_incidents, and narrow who can read them
--
-- Spec: docs/INCIDENT_REPORTING.md §2.1, §4
--
-- This table holds the most sensitive records the platform will ever contain:
-- a named child, a concern about their welfare, and the staff member who
-- observed it. It is one of the 41 tables with no tenant_id
-- (SESSION_2026-07-25_FINDINGS.md).
--
-- With one tenant that is latent. With two it is a cross-studio exposure of
-- child-safety records — the worst category of leak this system could produce.
-- The table is EMPTY, so scoping it now costs nothing; retrofitting it around
-- existing rows would mean touching records that should never be touched.
--
-- Also narrows access. The existing policy is `is_admin()`, which admits five
-- roles including finance_admin. Finance has no role in safeguarding, and
-- "an admin can see everything" is the wrong default for this table
-- specifically.
--
-- ⚠️ NOT the last word on visibility. INCIDENT_REPORTING.md §4 recommends
-- narrower still — super_admin plus a designated safeguarding lead, with reads
-- audited. There is no designated-lead concept in the schema yet, and choosing
-- one is Amanda's decision, not a migration's. This removes the clearly wrong
-- access and leaves the rest for that decision.
-- =============================================================================

do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='mandated_reporter_incidents') then
    raise exception 'Pre-flight failed: mandated_reporter_incidents does not exist';
  end if;

  -- Scoping an empty table is free. Scoping a populated one means deciding
  -- which tenant each existing child-safety record belongs to, which is not a
  -- decision a migration should make silently.
  if exists (select 1 from mandated_reporter_incidents) then
    raise exception 'Pre-flight failed: table is not empty — tenant assignment must be deliberate, not defaulted';
  end if;

  if not exists (select 1 from tenants where id = '84d98f72-c82f-414f-8b17-172b802f6993') then
    raise exception 'Pre-flight failed: BAM tenant not found';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Tenant column
--    NO ACTION on delete: a tenant with safeguarding records must never be
--    deletable, and these must never cascade away.
-- -----------------------------------------------------------------------------
alter table public.mandated_reporter_incidents
  add column if not exists tenant_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='mri_tenant_fkey') then
    alter table public.mandated_reporter_incidents
      add constraint mri_tenant_fkey
      foreign key (tenant_id) references public.tenants(id) on delete no action;
  end if;
end $$;

alter table public.mandated_reporter_incidents
  alter column tenant_id set not null;

create index if not exists mri_tenant_idx
  on public.mandated_reporter_incidents (tenant_id);

comment on column public.mandated_reporter_incidents.tenant_id is
  'Required. Safeguarding records must never be visible across tenants.';

comment on table public.mandated_reporter_incidents is
  'Mandated reporter concerns. SEPARATE from operational incidents by design — see docs/INCIDENT_REPORTING.md §4. The legal obligation to report belongs to the individual reporter and is NOT discharged by creating a row here; this table RECORDS that a report was made, it does not make one.';

-- -----------------------------------------------------------------------------
-- 2. Safeguarding access predicate
--
--    Not is_admin() — that admits finance_admin, which has no safeguarding role.
--    Not can_manage_pay() — a different axis entirely (FAMILY_DATA_ACCESS.md §3).
-- -----------------------------------------------------------------------------
create or replace function public.can_view_safeguarding(p_tenant_id uuid)
returns boolean language sql stable security definer
set search_path = public as $fn$
  select exists (
    select 1 from profile_roles
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
      and role in ('super_admin', 'studio_admin', 'studio_manager', 'admin')
      and is_active = true
  )
$fn$;

comment on function public.can_view_safeguarding(uuid) is
  'Who may read mandated reporter concerns. Excludes finance_admin deliberately. See docs/INCIDENT_REPORTING.md §4 — narrowing this further to a designated safeguarding lead is an open decision.';

revoke all on function public.can_view_safeguarding(uuid) from public;
grant execute on function public.can_view_safeguarding(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Policies
--
--    A reporter keeps read access to their own report — they may need to
--    reference what they wrote, and it is their account of what they observed.
-- -----------------------------------------------------------------------------
drop policy if exists incidents_all_admin on public.mandated_reporter_incidents;
drop policy if exists incidents_select_reporter on public.mandated_reporter_incidents;
drop policy if exists incidents_insert_teacher on public.mandated_reporter_incidents;

create policy mri_safeguarding_all
  on public.mandated_reporter_incidents for all
  using (public.can_view_safeguarding(tenant_id))
  with check (public.can_view_safeguarding(tenant_id));

create policy mri_select_own_report
  on public.mandated_reporter_incidents for select
  using (reporter_id = auth.uid());

-- Any staff member may file. Deliberately not gated on is_teacher(): whether a
-- given person is a mandated reporter under Penal Code §11165.7 is a legal
-- determination about their duties, and a form is not the place to adjudicate
-- it while someone is trying to write down what a child said. If they believe
-- it needs recording, the system takes it.
create policy mri_insert_own_report
  on public.mandated_reporter_incidents for insert
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from profile_roles
      where user_id = auth.uid()
        and tenant_id = mandated_reporter_incidents.tenant_id
        and is_active = true
    )
  );

-- No delete policy. A safeguarding record is never removed.

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='mandated_reporter_incidents'
                   and column_name='tenant_id' and is_nullable='NO') then
    raise exception 'Post-flight failed: tenant_id missing or nullable';
  end if;

  if exists (select 1 from pg_policies
             where schemaname='public' and tablename='mandated_reporter_incidents'
               and qual like '%is_admin()%') then
    raise exception 'Post-flight failed: is_admin() still governs safeguarding records';
  end if;

  if exists (select 1 from pg_policies
             where schemaname='public' and tablename='mandated_reporter_incidents'
               and cmd = 'DELETE') then
    raise exception 'Post-flight failed: a delete policy exists on a safeguarding table';
  end if;
end $$;
