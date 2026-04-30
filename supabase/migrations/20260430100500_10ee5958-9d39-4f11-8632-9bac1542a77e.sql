-- Restrict SELECT on avatars bucket so only the folder owner can enumerate files via the API.
-- Public CDN URLs continue to work because the bucket is public.

DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;

CREATE POLICY "avatars_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
