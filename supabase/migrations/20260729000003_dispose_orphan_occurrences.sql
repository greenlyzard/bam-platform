-- =============================================================================
-- Occurrence generation — Phase 3: dispose of the orphaned occurrences
--
-- Spec: docs/OCCURRENCE_GENERATION.md §5 Phase 3, open question 1
-- Depends on: nothing. Independent of Phases 1 and 2.
--
-- 61 rows in schedule_instances carry a NULL class_id. They are the frozen
-- March seed week — every one dated 2026-03-09 to 2026-03-14, all
-- status='published', event_type class or rehearsal. The class they belonged
-- to is unrecoverable: there is no column, no audit row and no seed artifact
-- that records which one it was.
--
-- They are dead in both directions. Nothing can be recorded against them —
-- attendance is keyed on the occurrence and needs the class to resolve a
-- roster — and nothing can be produced from them, because draft generation
-- joins through class_id to find a teacher and a rate. They are inert rows that
-- appear on calendar surfaces as real sessions.
--
-- CANCELLED, NOT DELETED. Two reasons, and the second is the load-bearing one:
--
--   1. The rows are history. Something was scheduled that week. Deleting the
--      evidence to tidy a NULL is the wrong trade.
--   2. schedule_instances is referenced by six FK columns across five tables
--      (timesheet_entries twice — schedule_instance_id AND session_id —
--      plus attendance, class_reminders, schedule_change_requests,
--      substitute_requests). A DELETE would either cascade into payroll history
--      or abort on a constraint, and which one it does depends on per-FK
--      delete rules nobody has audited. An UPDATE has neither failure mode.
--
-- The cancellation is what removes them from calendar surfaces; the row staying
-- put is what preserves the history. Both properties are wanted.
--
-- This migration does NOT add NOT NULL to schedule_instances.class_id, and
-- must not. The event_type CHECK admits studio_closure, room_block,
-- teacher_absence, performance and private_lesson — none of which have a class.
-- The column is legitimately nullable; these 61 rows are wrong because they are
-- event_type='class' with no class, not because the column allows NULL.
--
-- Verified against the live database 2026-07-29:
--   orphans ....................................... 61 (all status='published')
--   date range .................................... 2026-03-09 .. 2026-03-14
--   orphans with event_date > current_date ........ 0
--   timesheet_entries.schedule_instance_id refs ... 0
--   timesheet_entries.session_id refs ............. 0
--   attendance refs ............................... 0
--   class_reminders / schedule_change_requests /
--     substitute_requests refs .................... 0 each
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pre-flight — re-verify at apply time. Every one of these was zero on
-- 2026-07-29; none should fire.
-- -----------------------------------------------------------------------------
do $$
declare
  v_te_instance  integer;
  v_te_session   integer;
  v_attendance   integer;
  v_reminders    integer;
  v_change_reqs  integer;
  v_sub_reqs     integer;
  v_future       integer;
begin
  -- timesheet_entries reaches schedule_instances through TWO columns. Checking
  -- only schedule_instance_id would clear the migration while leaving a payroll
  -- row pointed at a session we are about to cancel.
  select count(*) into v_te_instance
    from public.timesheet_entries te
    join public.schedule_instances si on si.id = te.schedule_instance_id
   where si.class_id is null;

  select count(*) into v_te_session
    from public.timesheet_entries te
    join public.schedule_instances si on si.id = te.session_id
   where si.class_id is null;

  if v_te_instance > 0 or v_te_session > 0 then
    raise exception 'Pre-flight failed: % timesheet_entries via schedule_instance_id and % via session_id reference orphaned occurrences. Resolve the payroll link before cancelling — see docs/OCCURRENCE_GENERATION.md open question 1.',
      v_te_instance, v_te_session;
  end if;

  -- attendance is the only attendance table with a link to schedule_instances.
  -- attendance_records and rehearsal_attendance both exist but carry no
  -- instance column at all, so they cannot reference an orphan.
  select count(*) into v_attendance
    from public.attendance a
    join public.schedule_instances si on si.id = a.schedule_instance_id
   where si.class_id is null;

  if v_attendance > 0 then
    raise exception 'Pre-flight failed: % attendance row(s) reference orphaned occurrences. An orphan was assumed to be unable to record attendance; that assumption no longer holds.',
      v_attendance;
  end if;

  -- The remaining referencing tables. Not named in the spec, but a pending
  -- substitute request or change request against a row this migration cancels
  -- would be an inconsistency created by this migration.
  select count(*) into v_reminders
    from public.class_reminders r
    join public.schedule_instances si on si.id = r.schedule_instance_id
   where si.class_id is null;

  select count(*) into v_change_reqs
    from public.schedule_change_requests s
    join public.schedule_instances si on si.id = s.instance_id
   where si.class_id is null;

  select count(*) into v_sub_reqs
    from public.substitute_requests s
    join public.schedule_instances si on si.id = s.instance_id
   where si.class_id is null;

  if v_reminders > 0 or v_change_reqs > 0 or v_sub_reqs > 0 then
    raise exception 'Pre-flight failed: orphaned occurrences are referenced by % class_reminders, % schedule_change_requests, % substitute_requests. Resolve those before cancelling.',
      v_reminders, v_change_reqs, v_sub_reqs;
  end if;

  -- The one that matters most. Every known orphan is in the past, which is why
  -- cancelling them is a records cleanup. A future orphan is a different thing
  -- entirely — a session someone may be expecting to teach or attend — and
  -- cancelling it silently would remove it from the calendar with no notice to
  -- anyone. Refuse, and let a human decide.
  select count(*) into v_future
    from public.schedule_instances si
   where si.class_id is null
     and si.event_date > current_date;

  if v_future > 0 then
    raise exception 'Pre-flight failed: % orphaned occurrence(s) are dated in the future. These are a live scheduling problem, not dead history, and must not be bulk-cancelled. Investigate before re-running.',
      v_future;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Dispose. 'cancelled' — double l — is the spelling in
-- schedule_instances_status_check, alongside draft, pending_approval, approved,
-- published and notified. 'canceled' fails the constraint.
--
-- `status <> 'cancelled'` makes this re-runnable: a second apply matches no
-- rows rather than rewriting cancellation_reason on rows already disposed of,
-- including any cancelled for an unrelated reason by a human.
-- -----------------------------------------------------------------------------
update public.schedule_instances
   set status = 'cancelled',
       cancellation_reason = 'Orphaned occurrence: no class_id. Frozen March 2026 seed week; source class unrecoverable. Disposed by docs/OCCURRENCE_GENERATION.md Phase 3.',
       updated_at = now()
 where class_id is null
   and status <> 'cancelled';

-- -----------------------------------------------------------------------------
-- Post-check — nothing orphaned may remain in a live status.
-- -----------------------------------------------------------------------------
do $$
declare
  v_remaining integer;
begin
  select count(*) into v_remaining
    from public.schedule_instances
   where class_id is null
     and status <> 'cancelled';

  if v_remaining > 0 then
    raise exception 'Post-check failed: % orphaned occurrence(s) still have a status other than cancelled. The UPDATE did not cover the full set.',
      v_remaining;
  end if;
end $$;
