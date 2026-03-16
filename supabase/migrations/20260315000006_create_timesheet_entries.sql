-- ============================================================
-- Create timesheet_entries table
-- Merges columns from original 20260312000001 definition plus
-- additions from 20260313000010, 20260313000012, 20260315000003,
-- and 20260315000004 — none of which ran because the table
-- didn't exist.
--
-- FK change: substitute_for_teacher_id references profiles(id)
-- instead of teacher_profiles(id), since teacher_profiles is a VIEW.
-- ============================================================

-- ── TIMESHEET_ENTRIES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  timesheet_id uuid NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,

  -- Type & role
  entry_type text NOT NULL
    CHECK (entry_type IN (
      'class_lead', 'class_assistant', 'private', 'rehearsal',
      'performance_event', 'competition', 'training', 'admin',
      'substitute', 'bonus'
    )),
  teacher_role text NOT NULL DEFAULT 'lead'
    CHECK (teacher_role IN ('lead', 'assistant', 'substitute')),

  -- Linked records
  session_id uuid REFERENCES schedule_instances(id) ON DELETE SET NULL,
  production_id uuid,        -- FK to productions deferred (table not yet created)
  competition_id uuid,       -- FK to competition_events deferred (table not yet created)
  schedule_instance_id uuid REFERENCES schedule_instances(id),
  class_id uuid REFERENCES classes(id),

  -- Time
  date date NOT NULL,
  start_time time,
  end_time time,
  total_hours decimal(4,2) NOT NULL DEFAULT 0 CHECK (total_hours >= 0),

  -- Description
  description varchar(500),
  notes text,

  -- Pay rate snapshot
  rate_key varchar(50),
  rate_amount decimal(10,2) DEFAULT 0 CHECK (rate_amount >= 0),
  rate_override boolean NOT NULL DEFAULT false,
  rate_override_by uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Auto-population
  is_auto_populated boolean NOT NULL DEFAULT false,
  attendance_status text
    CHECK (attendance_status IS NULL OR attendance_status IN ('confirmed', 'absent', 'substitute_covered')),

  -- Substitute fields
  is_substitute boolean NOT NULL DEFAULT false,
  substitute_for_teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  substitute_notes text,
  sub_for text,

  -- Event / production metadata (from 20260313000010)
  event_tag text,
  production_name text,

  -- Approval workflow (from 20260313000012)
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  flagged_at timestamptz,
  flagged_by uuid,
  flag_question text,
  flag_response text,
  flag_responded_at timestamptz,
  adjusted_by uuid,
  adjustment_note text,
  paid_at timestamptz,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Status constraint
  CONSTRAINT timesheet_entries_status_check
    CHECK (status IN ('draft', 'submitted', 'approved', 'flagged', 'adjusted', 'paid'))
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheet
  ON timesheet_entries(timesheet_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date
  ON timesheet_entries(date);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_session
  ON timesheet_entries(session_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_type
  ON timesheet_entries(entry_type);

-- Prevent duplicate auto-populated entries for the same session
CREATE UNIQUE INDEX IF NOT EXISTS idx_timesheet_entries_session_unique
  ON timesheet_entries(timesheet_id, session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_status
  ON timesheet_entries(status);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_production
  ON timesheet_entries(production_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_schedule_instance
  ON timesheet_entries(schedule_instance_id);

-- ── Trigger ─────────────────────────────────────────────────
CREATE TRIGGER set_timesheet_entries_updated_at
  BEFORE UPDATE ON public.timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_timesheet_entries"
  ON public.timesheet_entries FOR ALL
  USING (is_admin());

CREATE POLICY "teachers_own_entries_select"
  ON public.timesheet_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND t.teacher_id = auth.uid()
    )
  );

CREATE POLICY "teachers_own_entries_insert"
  ON public.timesheet_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND t.teacher_id = auth.uid()
        AND t.status IN ('draft', 'rejected')
    )
  );

CREATE POLICY "teachers_own_entries_update"
  ON public.timesheet_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND t.teacher_id = auth.uid()
        AND t.status IN ('draft', 'rejected')
    )
  );

-- ── Grant ───────────────────────────────────────────────────
GRANT ALL ON public.timesheet_entries TO authenticated;


-- ============================================================
-- timesheet_entry_changes — audit log (from 20260313000012)
-- The original CREATE TABLE IF NOT EXISTS may or may not have
-- run. We create it here unconditionally (IF NOT EXISTS) and
-- then fix the RLS policies to use direct auth.uid() join.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.timesheet_entry_changes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  entry_id        uuid NOT NULL,
  changed_by      uuid NOT NULL,
  changed_by_name text,
  change_type     text NOT NULL,
  field_changed   text,
  old_value       text,
  new_value       text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entry_changes_entry ON timesheet_entry_changes(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_changes_tenant ON timesheet_entry_changes(tenant_id);

ALTER TABLE timesheet_entry_changes ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies (safe if they don't exist)
DROP POLICY IF EXISTS "admins_entry_changes" ON timesheet_entry_changes;
DROP POLICY IF EXISTS "teacher_read_own_changes" ON timesheet_entry_changes;
DROP POLICY IF EXISTS "teacher_insert_own_changes" ON timesheet_entry_changes;

CREATE POLICY "admins_entry_changes" ON timesheet_entry_changes
  FOR ALL USING (is_admin());

CREATE POLICY "teacher_read_own_changes" ON timesheet_entry_changes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM timesheet_entries te
      JOIN timesheets ts ON ts.id = te.timesheet_id
      WHERE te.id = timesheet_entry_changes.entry_id
        AND ts.teacher_id = auth.uid()
    )
  );

CREATE POLICY "teacher_insert_own_changes" ON timesheet_entry_changes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM timesheet_entries te
      JOIN timesheets ts ON ts.id = te.timesheet_id
      WHERE te.id = timesheet_entry_changes.entry_id
        AND ts.teacher_id = auth.uid()
    )
  );

GRANT ALL ON public.timesheet_entry_changes TO authenticated;


-- ============================================================
-- Add FK from teacher_hour_productions to timesheet_entries
-- The table was created in 20260315000002 with
--   timesheet_entry_id REFERENCES timesheet_entries(id)
-- but timesheet_entries didn't exist yet, so the column was
-- added without the FK constraint. Add it now.
-- ============================================================
-- Add timesheet_entry_id column + FK to teacher_hour_productions
-- (only if the table exists — it may not if its own migration failed)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teacher_hour_productions') THEN
    ALTER TABLE teacher_hour_productions
      ADD COLUMN IF NOT EXISTS timesheet_entry_id uuid;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'teacher_hour_productions_timesheet_entry_id_fkey'
        AND table_name = 'teacher_hour_productions'
    ) THEN
      ALTER TABLE teacher_hour_productions
        ADD CONSTRAINT teacher_hour_productions_timesheet_entry_id_fkey
        FOREIGN KEY (timesheet_entry_id) REFERENCES timesheet_entries(id) ON DELETE CASCADE;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_thp_timesheet_entry
      ON teacher_hour_productions(timesheet_entry_id);
  END IF;
END;
$$;
