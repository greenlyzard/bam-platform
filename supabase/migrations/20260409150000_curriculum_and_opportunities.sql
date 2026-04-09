-- Curriculum, skills, season curriculum, student skill records, student opportunities
-- Specs:
--   docs/CURRICULUM_AND_PROGRESSION.md §3
--   docs/STUDENT_PROFILE_ENHANCEMENT.md §2
--
-- Per CLAUDE.md migration rules: no forward FK constraints, IF NOT EXISTS
-- everywhere. FK constraints can be added in a later migration once all
-- referenced tables (tenants, seasons, students, classes, profiles) are
-- confirmed to exist on the remote DB.
--
-- No RLS in this migration — to be added in a follow-up alongside the
-- helper functions and parent visibility rules from the spec (§4.2).

-- ============================================================================
-- 1. curriculum_categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS curriculum_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  discipline  text,
  sort_order  integer DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_categories_tenant
  ON curriculum_categories(tenant_id);

-- ============================================================================
-- 2. curriculum_skills
-- ============================================================================
CREATE TABLE IF NOT EXISTS curriculum_skills (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  category_id         uuid NOT NULL,
  name                text NOT NULL,
  description         text,
  assessment_criteria text,
  badge_icon_url      text,
  badge_color_hex     text DEFAULT '#9C8BBF',
  skill_type          text NOT NULL DEFAULT 'achievement'
    CHECK (skill_type IN ('achievement','progressive','seasonal')),
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_skills_tenant   ON curriculum_skills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_skills_category ON curriculum_skills(category_id);

-- ============================================================================
-- 3. season_curriculum
-- ============================================================================
CREATE TABLE IF NOT EXISTS season_curriculum (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  season_id             uuid NOT NULL,
  level_tag             text NOT NULL,
  skill_id              uuid NOT NULL,
  sort_order            integer DEFAULT 0,
  is_visible_to_parents boolean DEFAULT false,
  is_primary            boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (season_id, level_tag, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_season_curriculum_tenant       ON season_curriculum(tenant_id);
CREATE INDEX IF NOT EXISTS idx_season_curriculum_season_level ON season_curriculum(season_id, level_tag);
CREATE INDEX IF NOT EXISTS idx_season_curriculum_skill        ON season_curriculum(skill_id);

-- ============================================================================
-- 4. student_skill_records
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_skill_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  student_id         uuid NOT NULL,
  skill_id           uuid NOT NULL,
  status             text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','achieved','mastered')),
  rating             integer CHECK (rating BETWEEN 1 AND 5),
  awarded_by         uuid,
  awarded_at         timestamptz,
  season_id          uuid,
  class_id           uuid,
  notes              text,
  visible_to_parent  boolean DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (student_id, skill_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_student_skill_records_tenant         ON student_skill_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_skill_records_student        ON student_skill_records(student_id);
CREATE INDEX IF NOT EXISTS idx_student_skill_records_skill          ON student_skill_records(skill_id);
CREATE INDEX IF NOT EXISTS idx_student_skill_records_student_season ON student_skill_records(student_id, season_id);

-- ============================================================================
-- 5. student_opportunities
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_opportunities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  student_id        uuid NOT NULL,
  opportunity_type  text NOT NULL,
  title             text NOT NULL,
  description       text,
  action_label      text,
  action_url        text,
  metadata          jsonb DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','dismissed','converted','snoozed')),
  snoozed_until     date,
  dismissed_at      timestamptz,
  dismissed_by      uuid,
  converted_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  expires_at        date
);

CREATE INDEX IF NOT EXISTS idx_student_opportunities_tenant         ON student_opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_opportunities_student        ON student_opportunities(student_id);
CREATE INDEX IF NOT EXISTS idx_student_opportunities_status         ON student_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_student_opportunities_student_active ON student_opportunities(student_id) WHERE status = 'active';

NOTIFY pgrst, 'reload schema';
