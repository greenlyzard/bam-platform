-- ============================================================
-- STUDENT EVALUATIONS PHASE 1 — TEMPLATE SYSTEM
-- ============================================================

-- 1. Evaluation question bank (global + tenant-specific questions)
CREATE TABLE IF NOT EXISTS public.evaluation_question_bank (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  slug            TEXT        NOT NULL,
  label           TEXT        NOT NULL,
  description     TEXT,
  question_type   TEXT        NOT NULL DEFAULT 'nse_rating' CHECK (question_type IN ('nse_rating', 'free_text', 'level_placement', 'text_input', 'numeric', 'boolean')),
  category        TEXT,
  is_global       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_question_bank_tenant ON evaluation_question_bank(tenant_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_slug ON evaluation_question_bank(slug);

ALTER TABLE evaluation_question_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage question bank" ON evaluation_question_bank;
CREATE POLICY "Admins can manage question bank" ON evaluation_question_bank
  FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Teachers can read question bank" ON evaluation_question_bank;
CREATE POLICY "Teachers can read question bank" ON evaluation_question_bank
  FOR SELECT USING (is_teacher());

-- 2. Evaluation templates
CREATE TABLE IF NOT EXISTS public.evaluation_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL,
  level_tag       TEXT,
  description     TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_eval_templates_tenant ON evaluation_templates(tenant_id);

ALTER TABLE evaluation_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage eval templates" ON evaluation_templates;
CREATE POLICY "Admins can manage eval templates" ON evaluation_templates
  FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Teachers can read eval templates" ON evaluation_templates;
CREATE POLICY "Teachers can read eval templates" ON evaluation_templates
  FOR SELECT USING (is_teacher());

-- 3. Evaluation template sections
CREATE TABLE IF NOT EXISTS public.evaluation_template_sections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID        NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL,
  description     TEXT,
  visibility      TEXT        NOT NULL DEFAULT 'always' CHECK (visibility IN ('always', 'if_applicable', 'conditional')),
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_sections_template ON evaluation_template_sections(template_id);

ALTER TABLE evaluation_template_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage eval sections" ON evaluation_template_sections;
CREATE POLICY "Admins can manage eval sections" ON evaluation_template_sections
  FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Teachers can read eval sections" ON evaluation_template_sections;
CREATE POLICY "Teachers can read eval sections" ON evaluation_template_sections
  FOR SELECT USING (is_teacher());

-- 4. Evaluation template questions (junction: section → question bank)
CREATE TABLE IF NOT EXISTS public.evaluation_template_questions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      UUID        NOT NULL REFERENCES evaluation_template_sections(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES evaluation_question_bank(id) ON DELETE CASCADE,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  is_required     BOOLEAN     NOT NULL DEFAULT true,
  override_label  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(section_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_tpl_questions_section ON evaluation_template_questions(section_id);

ALTER TABLE evaluation_template_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage eval tpl questions" ON evaluation_template_questions;
CREATE POLICY "Admins can manage eval tpl questions" ON evaluation_template_questions
  FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Teachers can read eval tpl questions" ON evaluation_template_questions;
CREATE POLICY "Teachers can read eval tpl questions" ON evaluation_template_questions
  FOR SELECT USING (is_teacher());

-- 5. Student evaluation responses (per-question answers)
CREATE TABLE IF NOT EXISTS public.student_evaluation_responses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID        NOT NULL REFERENCES student_evaluations(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES evaluation_question_bank(id) ON DELETE CASCADE,
  nse_value       TEXT        CHECK (nse_value IN ('N', 'S', 'E')),
  text_value      TEXT,
  numeric_value   NUMERIC,
  boolean_value   BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_responses_evaluation ON student_evaluation_responses(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_eval_responses_question ON student_evaluation_responses(question_id);

ALTER TABLE student_evaluation_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage eval responses" ON student_evaluation_responses;
CREATE POLICY "Admins can manage eval responses" ON student_evaluation_responses
  FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Teachers can manage own eval responses" ON student_evaluation_responses;
CREATE POLICY "Teachers can manage own eval responses" ON student_evaluation_responses
  FOR ALL USING (is_teacher());

-- 6. Student evaluation history (audit trail)
CREATE TABLE IF NOT EXISTS public.student_evaluation_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID        NOT NULL REFERENCES student_evaluations(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL CHECK (action IN ('created', 'submitted', 'changes_requested', 'approved', 'published', 'reopened')),
  performed_by    UUID,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_history_evaluation ON student_evaluation_history(evaluation_id);

ALTER TABLE student_evaluation_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage eval history" ON student_evaluation_history;
CREATE POLICY "Admins can manage eval history" ON student_evaluation_history
  FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Teachers can read eval history" ON student_evaluation_history;
CREATE POLICY "Teachers can read eval history" ON student_evaluation_history
  FOR SELECT USING (is_teacher());
