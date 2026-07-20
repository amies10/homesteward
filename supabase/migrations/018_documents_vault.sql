-- K1: document & warranty vault
CREATE TABLE IF NOT EXISTS documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('manual','warranty','invoice','permit','paint','other')),
  section_slug text,                                   -- optional link to a home section
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  issue_key text,                                      -- optional "reportId:slug:index"
  storage_path text NOT NULL,
  file_name text,
  mime_type text
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_documents" ON documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage: allow the new 'documents/' prefix. Recreates the insert policy from 011.
-- NOTE: if this fails with "must be owner of table objects", recreate the policy via
-- Dashboard > Storage > Policies with the same expression (same caveat as migration 011).
DROP POLICY IF EXISTS "homesteward_owner_insert" ON storage.objects;
CREATE POLICY "homesteward_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homesteward'
    AND (storage.foldername(name))[1] = ANY (ARRAY['reports','photos','avatars','documents'])
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
