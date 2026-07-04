-- Adds user_observation column to issue_details for homeowner firsthand notes
ALTER TABLE issue_details ADD COLUMN IF NOT EXISTS user_observation text;
