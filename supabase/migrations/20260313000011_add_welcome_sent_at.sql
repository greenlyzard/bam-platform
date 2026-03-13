-- Add welcome_sent_at to teacher_profiles for tracking welcome email status
ALTER TABLE teacher_profiles
ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ;
