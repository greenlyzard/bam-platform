-- =============================================================================
-- Restrict timesheet and entry access to pay managers
--
-- Spec: docs/PAYROLL_CORRECTNESS_AND_REPORTING.md §3.3
--
-- `admins_timesheet_entries` and `admins_timesheets` are both FOR ALL with
-- `is_admin()`, which admits five roles — admin, studio_admin, studio_manager,
-- finance_admin, super_admin. So a plain `admin` can read and write every
-- teacher's `amount_cents` and `timesheets.total_pay`.
--
-- §3.3 restricts pay to super_admin, finance_admin and studio_manager. Plain
-- `admin` is deliberately excluded: the studio has administrative staff who
-- legitimately see family detail and must not see compensation. Cara Matchett
-- and Adelyn Haderlie hold `admin` today.
--
-- Teachers keep their own pay. `teachers_own_*` policies match on
-- `timesheets.teacher_id = auth.uid()` and are untouched — self-access is an
-- identity check, never a role check, so a teacher who is also an admin still
-- sees their own entries through the teacher policy.
--
-- Note what this does NOT do: it cannot hide `amount_cents` from someone who
-- may read the row. RLS is row-level, and Postgres column privileges are per
-- DATABASE role while every signed-in user is `authenticated`. Withholding a
-- column while granting the row would require moving amounts to their own
-- table. That is not needed here because non-pay admins have no established
-- need for other teachers' hours either — confirmed with the product owner
-- 2026-07-28. If that changes, the amounts-in-their-own-table design in §3.3
-- is the answer, not a column grant.
--
-- ⚠️ CONSEQUENCE: admin timesheet surfaces become finance-only. `adminAddEntry`
-- (/admin/timesheets) is gated in application code on `isAdmin`, but its writes
-- go through the RLS-bound client, so a plain `admin` will now be refused at
-- the database. That is the intended outcome — filing hours on a teacher's
-- behalf is a payroll act — but the UI still offers it and will surface an
-- error rather than hiding the control. Tighten the route guard to
-- can_manage_pay() to match.
--
-- `pay_periods` is deliberately left on `is_admin()`. A period is a calendar
-- window with no money in it, and teachers already read it.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'can_manage_pay'
                   and p.pronargs = 1) then
    raise exception 'Pre-flight failed: can_manage_pay(uuid) not found — run 20260728000001 first';
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='timesheet_entries'
                   and column_name='tenant_id') then
    raise exception 'Pre-flight failed: timesheet_entries.tenant_id not found';
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='timesheets'
                   and column_name='tenant_id') then
    raise exception 'Pre-flight failed: timesheets.tenant_id not found';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- timesheet_entries
-- -----------------------------------------------------------------------------
drop policy if exists admins_timesheet_entries on public.timesheet_entries;

create policy pay_managers_timesheet_entries
  on public.timesheet_entries for all
  using (public.can_manage_pay(tenant_id))
  with check (public.can_manage_pay(tenant_id));

-- -----------------------------------------------------------------------------
-- timesheets — carries total_hours and total_pay, so the same rule applies
-- -----------------------------------------------------------------------------
drop policy if exists admins_timesheets on public.timesheets;

create policy pay_managers_timesheets
  on public.timesheets for all
  using (public.can_manage_pay(tenant_id))
  with check (public.can_manage_pay(tenant_id));

-- -----------------------------------------------------------------------------
-- Post-flight
-- -----------------------------------------------------------------------------
do $$
declare v_bad text;
begin
  select string_agg(tablename||'.'||policyname, ', ') into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename in ('timesheets','timesheet_entries')
    and qual like '%is_admin()%';

  if v_bad is not null then
    raise exception 'Post-flight failed: is_admin() still governs %', v_bad;
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='timesheet_entries'
                   and policyname='pay_managers_timesheet_entries') then
    raise exception 'Post-flight failed: entry pay-manager policy missing';
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='timesheets'
                   and policyname='pay_managers_timesheets') then
    raise exception 'Post-flight failed: timesheet pay-manager policy missing';
  end if;

  -- Self-access must survive untouched.
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='timesheet_entries'
                   and policyname='teachers_own_entries_select') then
    raise exception 'Post-flight failed: teacher self-select policy was removed';
  end if;
end $$;
