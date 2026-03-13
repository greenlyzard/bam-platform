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

-- 2. Add phone column (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- 3. Replace signup trigger — populates first_name, last_name from metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    coalesce(
      (NEW.raw_user_meta_data ->> 'role')::user_role,
      'parent'
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name, profiles.last_name),
    email      = COALESCE(EXCLUDED.email, profiles.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
