-- Migration: Student profile enrichment, profile addresses, extended contacts
-- Adds address fields, media consent, preferred name to students
-- Adds address fields to profiles
-- Creates extended_contacts and extended_contact_students tables

-- ── 1. Add columns to students table ─────────────────────────

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS media_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_consent_date timestamptz,
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- ── 2. Add address columns to profiles table ─────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- ── 3. Create extended_contacts table ────────────────────────

CREATE TABLE IF NOT EXISTS extended_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  relationship text,
  notify_live_stream boolean NOT NULL DEFAULT false,
  notify_recordings boolean NOT NULL DEFAULT false,
  notify_photos boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extended_contacts_tenant ON extended_contacts(tenant_id);

-- ── 4. Create extended_contact_students join table ───────────

CREATE TABLE IF NOT EXISTS extended_contact_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extended_contact_id uuid NOT NULL,
  student_id uuid NOT NULL,
  UNIQUE(extended_contact_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_extended_contact_students_contact ON extended_contact_students(extended_contact_id);
CREATE INDEX IF NOT EXISTS idx_extended_contact_students_student ON extended_contact_students(student_id);

-- ── 5. RLS on extended_contacts ──────────────────────────────

ALTER TABLE extended_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_extended_contacts" ON extended_contacts;
CREATE POLICY "admin_full_access_extended_contacts" ON extended_contacts
  FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "parent_read_own_extended_contacts" ON extended_contacts;
CREATE POLICY "parent_read_own_extended_contacts" ON extended_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM extended_contact_students ecs
      JOIN student_guardians sg ON sg.student_id = ecs.student_id
      WHERE ecs.extended_contact_id = extended_contacts.id
        AND sg.profile_id = auth.uid()
    )
  );

-- ── 6. RLS on extended_contact_students ──────────────────────

ALTER TABLE extended_contact_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_extended_contact_students" ON extended_contact_students;
CREATE POLICY "admin_full_access_extended_contact_students" ON extended_contact_students
  FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "parent_read_own_extended_contact_students" ON extended_contact_students;
CREATE POLICY "parent_read_own_extended_contact_students" ON extended_contact_students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM student_guardians sg
      WHERE sg.student_id = extended_contact_students.student_id
        AND sg.profile_id = auth.uid()
    )
  );

-- ── 7. Notify PostgREST ─────────────────────────────────────

NOTIFY pgrst, 'reload schema';
