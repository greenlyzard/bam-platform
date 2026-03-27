CREATE TABLE IF NOT EXISTS public.staff_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL,
  document_type   TEXT NOT NULL CHECK (document_type IN (
                    'w9','w4','i9','background_check','mandated_reporter',
                    'policy_acknowledgment','certification','contract','other'
                  )),
  group_name      TEXT,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       INTEGER,
  uploaded_by     UUID,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_documents_profile
  ON public.staff_documents(profile_id);
ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage staff documents" ON public.staff_documents;
CREATE POLICY "Admins can manage staff documents"
  ON public.staff_documents FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Finance can view documents" ON public.staff_documents;
CREATE POLICY "Finance can view documents"
  ON public.staff_documents FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profile_roles
      WHERE user_id = auth.uid()
        AND role IN ('finance_admin', 'super_admin')
        AND is_active = true
    )
  );
