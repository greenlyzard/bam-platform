-- ============================================================
-- Add schedule_instance_id to teacher_hours and timesheet_entries
-- Links timesheet entries to specific schedule instances
-- ============================================================

ALTER TABLE teacher_hours
  ADD COLUMN IF NOT EXISTS schedule_instance_id uuid REFERENCES schedule_instances(id);

ALTER TABLE timesheet_entries
  ADD COLUMN IF NOT EXISTS schedule_instance_id uuid REFERENCES schedule_instances(id);

CREATE INDEX IF NOT EXISTS idx_teacher_hours_schedule_instance
  ON teacher_hours(schedule_instance_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_schedule_instance
  ON timesheet_entries(schedule_instance_id);
