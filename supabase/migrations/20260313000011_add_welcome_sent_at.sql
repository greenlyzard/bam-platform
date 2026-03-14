DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'teacher_profiles') THEN
    ALTER TABLE teacher_profiles
    ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ;
  END IF;
END $$;
