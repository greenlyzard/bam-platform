CREATE TABLE IF NOT EXISTS public.attendance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL,
  student_id      UUID NOT NULL,
  teacher_id      UUID NOT NULL,
  date            DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON public.attendance_records(class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance_records(student_id);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance_records;
CREATE POLICY "Admins manage attendance" ON public.attendance_records
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Teachers manage own class attendance" ON public.attendance_records;
CREATE POLICY "Teachers manage own class attendance" ON public.attendance_records
  FOR ALL USING (teacher_id = auth.uid());
