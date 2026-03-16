-- Add class_id column (referenced in code but missing from schema)
ALTER TABLE public.timesheet_entries
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id);
