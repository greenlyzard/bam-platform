-- Lead audit trail — track every stage change
-- Per docs/NEW_STUDENT_PIPELINE.md
-- FK constraints intentionally omitted per CLAUDE.md migration rules.

CREATE TABLE IF NOT EXISTS lead_stage_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  lead_id       uuid NOT NULL,
  from_stage    text,
  to_stage      text NOT NULL,
  moved_by      uuid NOT NULL,
  moved_by_name text,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON lead_stage_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_tenant ON lead_stage_history(tenant_id);

NOTIFY pgrst, 'reload schema';
