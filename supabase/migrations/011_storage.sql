INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('homesteward', 'homesteward', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {prefix}/{user_id}/... ; foldername() is 1-indexed and
-- excludes the filename, so [2] is the user id at any depth.
-- NOTE: if these CREATE POLICY statements fail with "must be owner of table
-- objects", create the same four policies via Dashboard > Storage > Policies
-- using the same expressions instead.

CREATE POLICY "homesteward_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'homesteward' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "homesteward_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homesteward'
    AND (storage.foldername(name))[1] = ANY (ARRAY['reports','photos','avatars'])
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "homesteward_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'homesteward' AND (storage.foldername(name))[2] = auth.uid()::text)
  WITH CHECK (bucket_id = 'homesteward' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "homesteward_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'homesteward' AND (storage.foldername(name))[2] = auth.uid()::text);
