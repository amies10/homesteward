-- Feature 1: PDF storage
ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_storage_path text;
-- Feature 9: which location the cost estimates were generated with (null = generic)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS location_used text;
-- Feature 5: profile
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS avatar_path text;
-- Feature 8: issue photos — array of storage paths
ALTER TABLE issue_details ADD COLUMN IF NOT EXISTS photo_paths jsonb;
