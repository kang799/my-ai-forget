-- Restrict listing on public buckets while preserving public URL reads (public buckets serve files via CDN bypassing RLS)
DROP POLICY IF EXISTS voices_public_read ON storage.objects;
DROP POLICY IF EXISTS avatars_select_own ON storage.objects;

CREATE POLICY "voices_owner_list" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'voices' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_owner_list" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);