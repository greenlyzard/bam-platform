-- =====================================================
-- Add sub_for, event_tag, production_name to timesheet
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'timesheet_entries') THEN
    ALTER TABLE timesheet_entries
    ADD COLUMN IF NOT EXISTS sub_for TEXT,
    ADD COLUMN IF NOT EXISTS event_tag TEXT,
    ADD COLUMN IF NOT EXISTS production_name TEXT;

    CREATE INDEX IF NOT EXISTS idx_timesheet_entries_production
    ON timesheet_entries(production_id);
  END IF;
END $$;

-- Update platform_modules: disable substitutes from nav
UPDATE platform_modules
SET nav_visible = false, tenant_enabled = false
WHERE key = 'substitutes';
