-- Absence records — parent-reported absences, pre-marked attendance
CREATE TABLE IF NOT EXISTS absence_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  student_id            uuid NOT NULL,
  class_id              uuid,
  schedule_instance_id  uuid,
  absence_date          date NOT NULL,
  reported_by           uuid,
  report_channel        text NOT NULL DEFAULT 'portal'
    CHECK (report_channel IN ('portal','email','sms','chat','phone','manual')),
  parent_note           text,
  status                text NOT NULL DEFAULT 'excused'
    CHECK (status IN ('excused','unexcused','present_override')),
  override_by           uuid,
  override_note         text,
  notified_teacher_at   timestamptz,
  notified_admin_at     timestamptz,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_absence_records_student_date
  ON absence_records(student_id, absence_date);
CREATE INDEX IF NOT EXISTS idx_absence_records_class_date
  ON absence_records(class_id, absence_date);
CREATE INDEX IF NOT EXISTS idx_absence_records_tenant
  ON absence_records(tenant_id);

ALTER TABLE absence_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS absence_records_admin_all ON absence_records;
CREATE POLICY absence_records_admin_all ON absence_records
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS absence_records_parent_own ON absence_records;
CREATE POLICY absence_records_parent_own ON absence_records
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS absence_records_teacher_own ON absence_records;
CREATE POLICY absence_records_teacher_own ON absence_records
  FOR SELECT USING (is_teacher());
