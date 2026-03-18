-- Attendance-to-Timesheet Bridge: notifications table for check-in alerts and late pickup
-- Also adds indexes for attendance cross-referencing with timesheet_entries

-- Notifications table for in-app notifications (check-in, late pickup, etc.)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  recipient_id UUID NOT NULL, -- profiles.id
  notification_type TEXT NOT NULL, -- 'checkin', 'late_pickup', 'system'
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type, created_at DESC);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
CREATE POLICY "Admins can insert notifications" ON notifications
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Service role full access notifications" ON notifications;
CREATE POLICY "Service role full access notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');

-- Index on attendance for faster cross-reference with timesheet entries
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, class_date);

-- Index on timesheet_entries for class + date lookups
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_class_date ON timesheet_entries(class_id, date);
