ALTER TABLE public.private_sessions
ADD COLUMN IF NOT EXISTS student_can_see_notes BOOLEAN DEFAULT false;
