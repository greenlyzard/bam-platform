-- Add sender_name column to announcements for sender alias feature
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS sender_name TEXT;
