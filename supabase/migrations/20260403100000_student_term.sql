-- Configurable student terminology per tenant
-- Allows studios to use "Student", "Dancer", "Athlete", "Member", etc.

ALTER TABLE public.studio_settings
ADD COLUMN IF NOT EXISTS student_term_singular TEXT DEFAULT 'Student';

ALTER TABLE public.studio_settings
ADD COLUMN IF NOT EXISTS student_term_plural TEXT DEFAULT 'Students';
