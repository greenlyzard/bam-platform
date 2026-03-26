CREATE TABLE IF NOT EXISTS public.level_up_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL,
  requested_by    UUID NOT NULL,
  current_class_id UUID,
  requested_class_id UUID,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','denied','deferred')),
  teacher_note    TEXT,
  admin_note      TEXT,
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_level_up_requests_student ON level_up_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_level_up_requests_tenant ON level_up_requests(tenant_id);

ALTER TABLE level_up_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage level up requests" ON level_up_requests;
CREATE POLICY "Admins manage level up requests" ON level_up_requests FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Parents can create and view own requests" ON level_up_requests;
CREATE POLICY "Parents can create and view own requests" ON level_up_requests FOR ALL USING (requested_by = auth.uid());
