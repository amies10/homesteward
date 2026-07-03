-- Adds user_id to all tables and replaces anon RLS policies with
-- authenticated user-scoped policies. Existing rows (null user_id)
-- become orphaned and are effectively invisible to authenticated users.

-- 1. Add user_id columns
ALTER TABLE reports         ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE completed_fixes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE issue_details   ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE user_profile    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) UNIQUE;

-- 2. Ensure RLS is enabled on every table
ALTER TABLE reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_fixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_details   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile    ENABLE ROW LEVEL SECURITY;

-- 3. Drop old permissive anon policies
DROP POLICY IF EXISTS "anon_all_reports"         ON reports;
DROP POLICY IF EXISTS "anon_all_completed_fixes" ON completed_fixes;
DROP POLICY IF EXISTS "anon_all_user_profile"    ON user_profile;
DROP POLICY IF EXISTS "anon_all_issue_details"   ON issue_details;

-- 4. Create user-scoped policies (authenticated role only)
CREATE POLICY "owner_reports" ON reports
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_completed_fixes" ON completed_fixes
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_user_profile" ON user_profile
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_issue_details" ON issue_details
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
