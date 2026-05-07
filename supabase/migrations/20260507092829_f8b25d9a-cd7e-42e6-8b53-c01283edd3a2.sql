-- Add audio fields to messages for voice messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

-- Create public voices bucket for voice message audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('voices', 'voices', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (bucket is public, but explicit policy for safety)
DROP POLICY IF EXISTS "voices_public_read" ON storage.objects;
CREATE POLICY "voices_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'voices');

-- Authenticated users can upload to a folder named after their user id
DROP POLICY IF EXISTS "voices_user_insert" ON storage.objects;
CREATE POLICY "voices_user_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voices' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "voices_user_delete" ON storage.objects;
CREATE POLICY "voices_user_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'voices' AND auth.uid()::text = (storage.foldername(name))[1]);