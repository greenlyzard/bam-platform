-- =============================================================================
-- Pay periods for the 2026/2027 season
--
-- Problem this fixes: `timesheets.pay_period_id` is NOT NULL, so a timesheet
-- cannot exist without a pay period. Only two periods existed — March 2026 and
-- July 2026 — and the July row was created on 2026-07-26, the same day its
-- deadline passed. As of 2026-07-28 no teacher can log any hours at all:
-- July is locked and August does not exist. Fall classes begin 2026-08-15.
--
-- Also separates two concepts the code had collapsed into one:
--
--   submission_deadline  — the DUE DATE. "Email timesheets by the 26th" is the
--                          studio's existing rule and appears on the live
--                          Google Sheet timesheets. It is a deadline, not a
--                          freeze: Katherine's June 2026 sheet carries a 6/30
--                          entry, so late-month work plainly happens.
--
--   teacher_edit_cutoff  — the actual freeze. Null on both existing rows, so
--                          the app fell back to submission_deadline and hard
--                          blocked entry creation from the 27th onward. That
--                          leaves the last days of every month with nowhere to
--                          be recorded.
--
-- Cutoff is set to the 3rd of the following month: past the due date, past
-- month end, before payroll is run.
--
-- ⚠️ Cadence is INFERRED from two rows (monthly, 26th). Confirm with Amanda.
--    If the studio runs semi-monthly, this migration is wrong in shape, not
--    just in dates.
-- =============================================================================

do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='pay_periods') then
    raise exception 'Pre-flight failed: pay_periods does not exist';
  end if;

  if not exists (select 1 from tenants where id = '84d98f72-c82f-414f-8b17-172b802f6993') then
    raise exception 'Pre-flight failed: BAM tenant not found';
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='pay_periods'
                   and column_name='teacher_edit_cutoff') then
    raise exception 'Pre-flight failed: pay_periods.teacher_edit_cutoff not found';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. August 2026 through June 2027
-- -----------------------------------------------------------------------------
insert into public.pay_periods
  (tenant_id, period_month, period_year, submission_deadline,
   teacher_edit_cutoff, status, pay_cadence)
select
  '84d98f72-c82f-414f-8b17-172b802f6993'::uuid,
  v.m, v.y,
  make_date(v.y, v.m, 26),
  -- 3rd of the following month
  (make_date(v.y, v.m, 1) + interval '1 month' + interval '2 days')::date,
  'open',
  'monthly'
from (values
  (8,2026),(9,2026),(10,2026),(11,2026),(12,2026),
  (1,2027),(2,2027),(3,2027),(4,2027),(5,2027),(6,2027)
) as v(m, y)
where not exists (
  select 1 from public.pay_periods pp
  where pp.tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
    and pp.period_month = v.m
    and pp.period_year  = v.y
);

-- -----------------------------------------------------------------------------
-- 2. Unfreeze July 2026
--
--    Its deadline (2026-07-26) has passed and teacher_edit_cutoff is null, so
--    the app is treating the due date as a freeze. Setting the cutoff to
--    2026-08-03 restores the ability to record work done 7/27–7/31 — which is
--    the behaviour the paper process always had.
-- -----------------------------------------------------------------------------
update public.pay_periods
set teacher_edit_cutoff = date '2026-08-03'
where tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
  and period_month = 7 and period_year = 2026
  and teacher_edit_cutoff is null;

-- March 2026 is left alone. It is historical and still `status = 'open'`,
-- which is its own question — do not resolve it silently here.

-- -----------------------------------------------------------------------------
-- 3. Post-flight
-- -----------------------------------------------------------------------------
do $$
declare v_season int; v_aug int;
begin
  select count(*) into v_season
  from pay_periods
  where tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
    and ((period_year = 2026 and period_month >= 8)
      or (period_year = 2027 and period_month <= 6));

  if v_season <> 11 then
    raise exception 'Post-flight failed: expected 11 season periods, got %', v_season;
  end if;

  select count(*) into v_aug
  from pay_periods
  where tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
    and period_year = 2026 and period_month = 8
    and submission_deadline = date '2026-08-26'
    and teacher_edit_cutoff = date '2026-09-03';

  if v_aug <> 1 then
    raise exception 'Post-flight failed: August 2026 period missing or misdated';
  end if;

  if exists (select 1 from pay_periods
             where tenant_id = '84d98f72-c82f-414f-8b17-172b802f6993'
               and period_month = 7 and period_year = 2026
               and teacher_edit_cutoff is null) then
    raise exception 'Post-flight failed: July 2026 still has no edit cutoff';
  end if;
end $$;
