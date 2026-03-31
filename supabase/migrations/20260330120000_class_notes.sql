CREATE TABLE IF NOT EXISTS public.class_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN
    ('general', 'curriculum', 'student_flag', 'announcement')),
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_notes_class_date ON public.class_notes(class_id, note_date DESC);

ALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage their class notes" ON public.class_notes;
CREATE POLICY "Teachers can manage their class notes"
  ON public.class_notes FOR ALL USING (
    teacher_id = auth.uid() OR is_admin()
  );
