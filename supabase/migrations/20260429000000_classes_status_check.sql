-- Replace classes.status CHECK constraint with lifecycle-only vocabulary
-- Per docs/CLASS_SCHEMA_DECISIONS.md (D3) — capacity (waitlist, full) is
-- now computed from enrolled_count vs max_enrollment, not stored in status.
-- Allowed lifecycle values: draft, active, cancelled, completed
--
-- Pre-flight: verified 2026-04-29 via Supabase MCP that all 63 existing
-- classes have status='active', which is in both old and new vocabularies.

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM classes
  WHERE status NOT IN ('draft','active','cancelled','completed');

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Cannot replace CHECK constraint: % rows have status values outside the new allowed set. Run: SELECT DISTINCT status FROM classes; to see them, then update or remap before retrying.', invalid_count;
  END IF;
END $$;

ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_status_check;

ALTER TABLE classes
  ADD CONSTRAINT classes_status_check
  CHECK (status IN ('draft','active','cancelled','completed'));

NOTIFY pgrst, 'reload schema';
