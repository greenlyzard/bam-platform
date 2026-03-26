CREATE TABLE IF NOT EXISTS public.teacher_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id            UUID NOT NULL,
  auto_confirm_bookings BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_preferences_teacher ON teacher_preferences(teacher_id);

ALTER TABLE teacher_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage teacher_preferences" ON teacher_preferences;
CREATE POLICY "Admins can manage teacher_preferences" ON teacher_preferences
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Teachers can manage own preferences" ON teacher_preferences;
CREATE POLICY "Teachers can manage own preferences" ON teacher_preferences
  FOR ALL USING (auth.uid() = teacher_id);
