-- New Student Pipeline — Section 7 of docs/NEW_STUDENT_PIPELINE.md
-- Adds pipeline tracking columns to leads, links trial_history to leads,
-- and creates evaluation_requests table.
-- FK constraints intentionally omitted per CLAUDE.md migration rules
-- (no forward references — added in a later migration once all tables confirmed).

-- ============================================================
-- 7.1 Additions to leads table
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'inquiry'
    CHECK (pipeline_stage IN (
      'inquiry','trial_requested','trial_scheduled','trial_attended',
      'evaluation_requested','evaluation_scheduled','placement_recommended',
      'contract_pending','enrolled','waitlisted','lost'
    )),
  ADD COLUMN IF NOT EXISTS intake_form_data jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_teacher_id uuid,
  ADD COLUMN IF NOT EXISTS evaluation_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS evaluation_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS placement_notes text,
  ADD COLUMN IF NOT EXISTS recommended_class_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS returning_student_id uuid,
  ADD COLUMN IF NOT EXISTS communication_thread_id uuid;

-- ============================================================
-- 7.2 trial_history connection to pipeline
-- ============================================================

ALTER TABLE trial_history
  ADD COLUMN IF NOT EXISTS lead_id uuid;

-- ============================================================
-- 7.3 New evaluation_requests table
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluation_requests (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL,
  lead_id                uuid,
  student_id             uuid,
  requested_by           uuid,
  request_type           text NOT NULL DEFAULT 'placement'
    CHECK (request_type IN ('placement','level_advancement','re_assessment')),
  experience_description text,
  assigned_teacher_id    uuid,
  scheduled_at           timestamptz,
  completed_at           timestamptz,
  recommended_level      text,
  placement_notes        text,
  status                 text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','scheduled','completed','cancelled','no_show')),
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_requests_lead   ON evaluation_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_eval_requests_tenant ON evaluation_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eval_requests_status ON evaluation_requests(status);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
