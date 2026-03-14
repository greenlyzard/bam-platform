-- ============================================================
-- Timesheet Approval Workflow
-- Adds: per-entry approval fields, change log table,
--        teacher notification preferences
-- ============================================================

-- ── Per-entry approval/flag fields ────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'timesheet_entries') THEN
    ALTER TABLE timesheet_entries
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approved_by UUID,
      ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS flagged_by UUID,
      ADD COLUMN IF NOT EXISTS flag_question TEXT,
      ADD COLUMN IF NOT EXISTS flag_response TEXT,
      ADD COLUMN IF NOT EXISTS flag_responded_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS adjusted_by UUID,
      ADD COLUMN IF NOT EXISTS adjustment_note TEXT,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
  END IF;
END;
$$;

-- Add status check constraint
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'timesheet_entries') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'timesheet_entries_status_check'
    ) THEN
      ALTER TABLE timesheet_entries ADD CONSTRAINT timesheet_entries_status_check
        CHECK (status IN ('draft', 'submitted', 'approved', 'flagged', 'adjusted', 'paid'));
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'timesheet_entries') THEN
    CREATE INDEX IF NOT EXISTS idx_timesheet_entries_status ON timesheet_entries(status);
  END IF;
END;
$$;


-- ── Change log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheet_entry_changes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  entry_id        UUID NOT NULL,
  changed_by      UUID NOT NULL,
  changed_by_name TEXT,
  change_type     TEXT NOT NULL,
  field_changed   TEXT,
  old_value       TEXT,
  new_value       TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entry_changes_entry ON timesheet_entry_changes(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_changes_tenant ON timesheet_entry_changes(tenant_id);

ALTER TABLE timesheet_entry_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies (safe — they reference timesheet_entries only inside EXISTS subqueries
-- which will simply return false if the table doesn't exist yet)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins_entry_changes' AND tablename = 'timesheet_entry_changes') THEN
    CREATE POLICY "admins_entry_changes" ON timesheet_entry_changes
      FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','finance_admin'))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_own_changes' AND tablename = 'timesheet_entry_changes') THEN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'timesheet_entries') THEN
      CREATE POLICY "teacher_read_own_changes" ON timesheet_entry_changes
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM timesheet_entries te
            JOIN timesheets ts ON ts.id = te.timesheet_id
            JOIN teacher_profiles tp ON tp.id = ts.teacher_id
            WHERE te.id = timesheet_entry_changes.entry_id
              AND tp.user_id = auth.uid()
          )
        );
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_insert_own_changes' AND tablename = 'timesheet_entry_changes') THEN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'timesheet_entries') THEN
      CREATE POLICY "teacher_insert_own_changes" ON timesheet_entry_changes
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM timesheet_entries te
            JOIN timesheets ts ON ts.id = te.timesheet_id
            JOIN teacher_profiles tp ON tp.id = ts.teacher_id
            WHERE te.id = timesheet_entry_changes.entry_id
              AND tp.user_id = auth.uid()
          )
        );
    END IF;
  END IF;
END;
$$;


-- ── Teacher notification preferences ──────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teacher_profiles') THEN
    ALTER TABLE teacher_profiles
      ADD COLUMN IF NOT EXISTS notify_on_approval BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS notify_on_flag BOOLEAN NOT NULL DEFAULT true;
  END IF;
END;
$$;
