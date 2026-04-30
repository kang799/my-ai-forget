-- 1) characters 增加头像与拍一拍字段
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS partner_avatar_url text,
  ADD COLUMN IF NOT EXISTS self_nudge_text text NOT NULL DEFAULT '拍了拍 对方',
  ADD COLUMN IF NOT EXISTS partner_nudge_text text NOT NULL DEFAULT '拍了拍 我';

-- 2) 公共上传：头像桶（公开可读）
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 头像存储策略：公开读，登录用户上传/更新/删除自己目录
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avatars_public_read') THEN
    CREATE POLICY "avatars_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avatars_user_write') THEN
    CREATE POLICY "avatars_user_write" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avatars_user_update') THEN
    CREATE POLICY "avatars_user_update" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avatars_user_delete') THEN
    CREATE POLICY "avatars_user_delete" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- 3) 社群：帖子与评论
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  author_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

-- 帖子：所有登录用户可读，作者可写/改/删
DROP POLICY IF EXISTS "posts_read_all" ON public.community_posts;
CREATE POLICY "posts_read_all" ON public.community_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "posts_insert_own" ON public.community_posts;
CREATE POLICY "posts_insert_own" ON public.community_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_update_own" ON public.community_posts;
CREATE POLICY "posts_update_own" ON public.community_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_delete_own" ON public.community_posts;
CREATE POLICY "posts_delete_own" ON public.community_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 评论：同上
DROP POLICY IF EXISTS "comments_read_all" ON public.community_comments;
CREATE POLICY "comments_read_all" ON public.community_comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert_own" ON public.community_comments;
CREATE POLICY "comments_insert_own" ON public.community_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON public.community_comments;
CREATE POLICY "comments_delete_own" ON public.community_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.community_comments(post_id, created_at);

-- updated_at 触发器
DROP TRIGGER IF EXISTS trg_posts_touch ON public.community_posts;
CREATE TRIGGER trg_posts_touch BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();