CREATE TABLE IF NOT EXISTS public.student_families (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  relationship    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, family_id)
);

CREATE INDEX IF NOT EXISTS idx_student_families_student ON public.student_families(student_id);
CREATE INDEX IF NOT EXISTS idx_student_families_family ON public.student_families(family_id);

ALTER TABLE public.student_families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage student families" ON public.student_families;
CREATE POLICY "Admins can manage student families" ON public.student_families
  FOR ALL USING (is_admin());
