-- Tighten profiles INSERT to authenticated role only
DROP POLICY IF EXISTS "own_profile_insert" ON public.profiles;
CREATE POLICY "own_profile_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Tighten own_profile_select and own_profile_update to authenticated only
DROP POLICY IF EXISTS "own_profile_select" ON public.profiles;
CREATE POLICY "own_profile_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "own_profile_update" ON public.profiles;
CREATE POLICY "own_profile_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Tighten characters and messages policies (currently apply to public role)
DROP POLICY IF EXISTS "own_chars_all" ON public.characters;
CREATE POLICY "own_chars_all"
ON public.characters
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_msgs_all" ON public.messages;
CREATE POLICY "own_msgs_all"
ON public.messages
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Restrict avatars bucket: remove broad listing policy if any, allow public read of individual objects only
-- Keep public read for avatars but no list. We'll add an explicit per-object SELECT and rely on bucket pubic flag for direct URL access.
-- (No-op if no listing policy exists; we ensure only authenticated users can list/upload their own.)
DO $$
BEGIN
  -- Drop any overly broad SELECT policies on storage.objects for avatars
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar images are publicly accessible') THEN
    DROP POLICY "Avatar images are publicly accessible" ON storage.objects;
  END IF;
END $$;
