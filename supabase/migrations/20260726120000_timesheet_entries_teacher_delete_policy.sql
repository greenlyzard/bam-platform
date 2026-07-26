-- ============================================================
-- Add the missing teacher DELETE policy on timesheet_entries
--
-- 20260315000006 created teachers_own_entries_{select,insert,update}
-- but no DELETE policy. deleteTimesheetEntry() in
-- app/(teach)/teach/timesheets/actions.ts therefore affects 0 rows
-- and returns no error, so the UI falsely reports success while the
-- row remains.
--
-- Scoped to exactly match teachers_own_entries_update: the teacher's
-- own rows, and only while the parent timesheet is draft or rejected.
-- Admins already have ALL via admins_timesheet_entries / is_admin().
-- ============================================================

DROP POLICY IF EXISTS "teachers_own_entries_delete" ON public.timesheet_entries;

CREATE POLICY "teachers_own_entries_delete"
  ON public.timesheet_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND t.teacher_id = auth.uid()
        AND t.status IN ('draft', 'rejected')
    )
  );

NOTIFY pgrst, 'reload schema';
