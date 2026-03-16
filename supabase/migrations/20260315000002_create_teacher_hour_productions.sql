-- ============================================================
-- Create teacher_hour_productions junction table
-- Links timesheet entries to multiple productions
-- ============================================================

CREATE TABLE IF NOT EXISTS teacher_hour_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_hour_id uuid REFERENCES teacher_hours(id) ON DELETE CASCADE,
  production_id uuid REFERENCES productions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_thp_teacher_hour ON teacher_hour_productions(teacher_hour_id);
CREATE INDEX idx_thp_production ON teacher_hour_productions(production_id);

-- Also support the newer timesheet_entries table
ALTER TABLE teacher_hour_productions
  ADD COLUMN IF NOT EXISTS timesheet_entry_id uuid REFERENCES timesheet_entries(id) ON DELETE CASCADE;

CREATE INDEX idx_thp_timesheet_entry ON teacher_hour_productions(timesheet_entry_id);

-- RLS
ALTER TABLE teacher_hour_productions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admins_teacher_hour_productions" ON teacher_hour_productions
  FOR ALL USING (public.is_admin());

-- Teachers can manage their own entries (via teacher_hours)
CREATE POLICY "teachers_own_hour_productions_via_teacher_hours" ON teacher_hour_productions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM teacher_hours th
      WHERE th.id = teacher_hour_productions.teacher_hour_id
        AND th.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM timesheet_entries te
      JOIN timesheets t ON t.id = te.timesheet_id
      WHERE te.id = teacher_hour_productions.timesheet_entry_id
        AND t.teacher_id = auth.uid()
    )
  );

-- Grant
GRANT ALL ON teacher_hour_productions TO authenticated;
