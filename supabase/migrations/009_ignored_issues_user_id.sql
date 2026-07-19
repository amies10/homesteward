-- Hygiene: ignored_issues never got user_id in 006. Backfill from parent report.
ALTER TABLE ignored_issues ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

UPDATE ignored_issues i
SET user_id = r.user_id
FROM reports r
WHERE i.report_id = r.id AND i.user_id IS NULL;

ALTER TABLE ignored_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_ignored_issues" ON ignored_issues;

CREATE POLICY "owner_ignored_issues" ON ignored_issues
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
