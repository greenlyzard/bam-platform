-- Timesheet alerts table (overpayment/underpayment/duplicate detection)
CREATE TABLE IF NOT EXISTS public.timesheet_alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  timesheet_entry_id  UUID        NOT NULL,
  alert_type          TEXT        NOT NULL,
  severity            TEXT        NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'flag')),
  message             TEXT        NOT NULL,
  is_resolved         BOOLEAN     NOT NULL DEFAULT false,
  resolved_by         UUID,
  resolved_at         TIMESTAMPTZ,
  resolution_note     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_alerts_tenant ON timesheet_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_alerts_entry ON timesheet_alerts(timesheet_entry_id);

ALTER TABLE timesheet_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage timesheet_alerts" ON timesheet_alerts;
CREATE POLICY "Admins can manage timesheet_alerts" ON timesheet_alerts
  FOR ALL USING (is_admin());

-- Add source column to timesheet_entry_changes if not exists
ALTER TABLE public.timesheet_entry_changes
  ADD COLUMN IF NOT EXISTS source TEXT;
