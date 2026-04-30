CREATE TABLE public.community_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_read_all" ON public.community_likes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "likes_insert_own" ON public.community_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete_own" ON public.community_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_community_likes_post ON public.community_likes(post_id);