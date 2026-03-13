-- Add preferred_name column to profiles for display name override
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_name text;
