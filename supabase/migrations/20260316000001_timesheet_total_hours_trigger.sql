-- Recalculate timesheets.total_hours from entries
CREATE OR REPLACE FUNCTION recalculate_timesheet_total_hours()
RETURNS TRIGGER AS $$
DECLARE
  target_timesheet_id uuid;
BEGIN
  -- Determine which timesheet to update
  IF TG_OP = 'DELETE' THEN
    target_timesheet_id := OLD.timesheet_id;
  ELSE
    target_timesheet_id := NEW.timesheet_id;
  END IF;

  -- Recalculate
  UPDATE timesheets
  SET total_hours = COALESCE(
    (SELECT SUM(total_hours) FROM timesheet_entries WHERE timesheet_id = target_timesheet_id),
    0
  )
  WHERE id = target_timesheet_id;

  -- If entry moved to a different timesheet, update the old one too
  IF TG_OP = 'UPDATE' AND OLD.timesheet_id IS DISTINCT FROM NEW.timesheet_id THEN
    UPDATE timesheets
    SET total_hours = COALESCE(
      (SELECT SUM(total_hours) FROM timesheet_entries WHERE timesheet_id = OLD.timesheet_id),
      0
    )
    WHERE id = OLD.timesheet_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recalculate_timesheet_hours
  AFTER INSERT OR UPDATE OF total_hours, timesheet_id OR DELETE
  ON public.timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_timesheet_total_hours();

-- Backfill existing timesheets
UPDATE timesheets t
SET total_hours = COALESCE(
  (SELECT SUM(te.total_hours) FROM timesheet_entries te WHERE te.timesheet_id = t.id),
  0
);
