-- Migration: Create student_guardians table for multi-guardian family system
-- Also adds email_opt_in and sms_opt_in to profiles

-- ── 1. student_guardians table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS student_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN (
    'mother', 'father', 'stepparent', 'grandparent', 'guardian', 'sibling', 'other'
  )),
  is_primary boolean NOT NULL DEFAULT false,
  is_billing boolean NOT NULL DEFAULT false,
  is_emergency boolean NOT NULL DEFAULT false,
  portal_access boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_student ON student_guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_profile ON student_guardians(profile_id);

-- ── 2. RLS policies ────────────────────────────────────────────

ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;

-- Admins can do everything (uses existing is_admin() SECURITY DEFINER function)
DROP POLICY IF EXISTS "admin_full_access_student_guardians" ON student_guardians;
CREATE POLICY "admin_full_access_student_guardians" ON student_guardians
  FOR ALL
  USING (is_admin());

-- Guardians can read their own records
DROP POLICY IF EXISTS "guardian_read_own" ON student_guardians;
CREATE POLICY "guardian_read_own" ON student_guardians
  FOR SELECT
  USING (profile_id = auth.uid());

-- ── 3. Add opt-in columns to profiles ──────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_opt_in boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT true;

-- ── 4. Notify PostgREST ────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
