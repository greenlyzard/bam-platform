-- Class Management System Migration
-- Extends classes table, creates class_teachers, disciplines, dance_curriculum,
-- class_pricing_rules, class_phases, studio_closures
-- Per CLAUDE.md: no forward FK references, IF NOT EXISTS on all DDL

-- ============================================================================
-- 1. EXTEND classes TABLE
-- ============================================================================

-- Drop old level column (replacing with levels array)
ALTER TABLE classes DROP COLUMN IF EXISTS level;

-- Add new columns
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS short_description    text,
  ADD COLUMN IF NOT EXISTS medium_description   text,
  ADD COLUMN IF NOT EXISTS long_description     text,
  ADD COLUMN IF NOT EXISTS gender               text CHECK (gender IN ('any', 'female', 'male')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS levels               text[],
  ADD COLUMN IF NOT EXISTS discipline_ids       uuid[],
  ADD COLUMN IF NOT EXISTS curriculum_ids       uuid[],
  ADD COLUMN IF NOT EXISTS days_of_week         integer[],
  ADD COLUMN IF NOT EXISTS start_date           date,
  ADD COLUMN IF NOT EXISTS end_date             date,
  ADD COLUMN IF NOT EXISTS season_id            uuid,
  ADD COLUMN IF NOT EXISTS max_enrollment       integer,
  ADD COLUMN IF NOT EXISTS show_capacity_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS online_registration  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_hidden            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS new_expires_at       date,
  ADD COLUMN IF NOT EXISTS is_rehearsal         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_performance       boolean DEFAULT false;

-- Ensure updated_at exists (spec lists it but table may already have it)
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================================
-- 2. CREATE class_teachers
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_teachers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL,
  teacher_id  uuid NOT NULL,
  role        text NOT NULL DEFAULT 'lead'
              CHECK (role IN ('lead', 'assistant', 'accompanist', 'observer')),
  is_primary  boolean DEFAULT false,
  tenant_id   uuid NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(class_id, teacher_id)
);

-- ============================================================================
-- 3. CREATE disciplines
-- ============================================================================

CREATE TABLE IF NOT EXISTS disciplines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================================
-- 4. CREATE dance_curriculum
-- ============================================================================

CREATE TABLE IF NOT EXISTS dance_curriculum (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================================
-- 5. CREATE class_pricing_rules
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_pricing_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       uuid NOT NULL,
  tenant_id      uuid NOT NULL,
  label          text NOT NULL,
  deadline       date,
  amount         numeric(10,2) NOT NULL,
  discount_type  text CHECK (discount_type IN ('flat', 'percentage')),
  discount_value numeric(10,2),
  is_base_price  boolean DEFAULT false,
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

-- ============================================================================
-- 6. CREATE class_phases
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_phases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL,
  tenant_id     uuid NOT NULL,
  phase         text NOT NULL CHECK (phase IN ('technique', 'rehearsal', 'performance')),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  notes         text,
  production_id uuid,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================================
-- 7. CREATE studio_closures
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_closures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  closed_date date NOT NULL,
  reason      text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, closed_date)
);

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

-- class_teachers
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_class_teachers" ON class_teachers;
CREATE POLICY "admin_full_class_teachers" ON class_teachers
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "teacher_read_class_teachers" ON class_teachers;
CREATE POLICY "teacher_read_class_teachers" ON class_teachers
  FOR SELECT USING (is_teacher());

-- disciplines
ALTER TABLE disciplines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_disciplines" ON disciplines;
CREATE POLICY "admin_full_disciplines" ON disciplines
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "authenticated_read_disciplines" ON disciplines;
CREATE POLICY "authenticated_read_disciplines" ON disciplines
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- dance_curriculum
ALTER TABLE dance_curriculum ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_dance_curriculum" ON dance_curriculum;
CREATE POLICY "admin_full_dance_curriculum" ON dance_curriculum
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "authenticated_read_dance_curriculum" ON dance_curriculum;
CREATE POLICY "authenticated_read_dance_curriculum" ON dance_curriculum
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- class_pricing_rules
ALTER TABLE class_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_class_pricing_rules" ON class_pricing_rules;
CREATE POLICY "admin_full_class_pricing_rules" ON class_pricing_rules
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "authenticated_read_class_pricing_rules" ON class_pricing_rules;
CREATE POLICY "authenticated_read_class_pricing_rules" ON class_pricing_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- class_phases
ALTER TABLE class_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_class_phases" ON class_phases;
CREATE POLICY "admin_full_class_phases" ON class_phases
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "teacher_read_class_phases" ON class_phases;
CREATE POLICY "teacher_read_class_phases" ON class_phases
  FOR SELECT USING (is_teacher());

DROP POLICY IF EXISTS "authenticated_read_class_phases" ON class_phases;
CREATE POLICY "authenticated_read_class_phases" ON class_phases
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- studio_closures
ALTER TABLE studio_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_studio_closures" ON studio_closures;
CREATE POLICY "admin_full_studio_closures" ON studio_closures
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "authenticated_read_studio_closures" ON studio_closures;
CREATE POLICY "authenticated_read_studio_closures" ON studio_closures
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- classes (add teacher read policy if not exists)
DROP POLICY IF EXISTS "teacher_read_classes" ON classes;
CREATE POLICY "teacher_read_classes" ON classes
  FOR SELECT USING (is_teacher());

-- ============================================================================
-- 9. SEED DATA — disciplines
-- ============================================================================

INSERT INTO disciplines (tenant_id, name, sort_order)
VALUES
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Ballet', 1),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Jazz', 2),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Contemporary', 3),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Hip Hop', 4),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Pointe', 5),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Musical Theater', 6),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Combo', 7),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Conditioning', 8)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. SEED DATA — dance_curriculum
-- ============================================================================

INSERT INTO dance_curriculum (tenant_id, name, sort_order)
VALUES
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'RAD', 1),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Cecchetti', 2),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Vaganova', 3),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'ABT', 4),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Progressing Ballet Technique', 5),
  ('84d98f72-c82f-414f-8b17-172b802f6993', 'Acrobatic Arts', 6)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 11. NOTIFY PostgREST to reload schema
-- ============================================================================

NOTIFY pgrst, 'reload schema';
