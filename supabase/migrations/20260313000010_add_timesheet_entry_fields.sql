-- ============================================================
-- Add sub_for, event_tag, production_name to timesheet_entries
-- ============================================================

ALTER TABLE timesheet_entries
ADD COLUMN IF NOT EXISTS sub_for text,
ADD COLUMN IF NOT EXISTS event_tag text,
ADD COLUMN IF NOT EXISTS production_name text;

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_production
ON timesheet_entries(production_id);

-- Update platform_modules: disable substitutes from nav
UPDATE platform_modules
SET nav_visible = false, tenant_enabled = false
WHERE key = 'substitutes';
