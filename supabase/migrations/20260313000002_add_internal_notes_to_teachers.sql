-- Add internal_notes column to teachers (admin-only, not visible to teacher)
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS internal_notes text;
