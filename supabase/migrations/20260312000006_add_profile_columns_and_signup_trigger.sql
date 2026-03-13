-- ============================================================
-- Add is_teacher flag to profiles + harden signup trigger
-- ============================================================

-- 1. Add is_teacher column (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_teacher boolean DEFAULT false;

-- first_name and last_name already exist in the original schema,
-- but guard with IF NOT EXISTS for safety
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_name text;

-- 2. Replace signup trigger with ON CONFLICT guard
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(
      (NEW.raw_user_meta_data ->> 'role')::user_role,
      'parent'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
