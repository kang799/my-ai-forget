import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageCircle, Trash2, Heart, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/community")({
  component: CommunityPage,
  head: () => ({ meta: [{ title: "用户社群 — 难忘的TA" }] }),
});

type Post = {
  id: string;
  user_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
};

const TEAM_CONTACT = "3404782415@qq.com";

function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [likesByPost, setLikesByPost] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        const display = (p as any)?.display_name || user.email?.split("@")[0] || "匿名";
        setMe({ id: user.id, name: display });
        setName(display);
      }
      await load(user?.id);
      setLoading(false);
    })();
  }, []);

  async function load(myId?: string) {
    const uid = myId ?? me?.id;
    const { data: ps } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (ps as Post[]) ?? [];

    let commentsMap: Record<string, Comment[]> = {};
    let likeCount: Record<string, number> = {};
    let likedMine: Record<string, boolean> = {};

    if (list.length) {
      const ids = list.map((p) => p.id);
      const [{ data: cs }, { data: ls }] = await Promise.all([
        supabase.from("community_comments").select("*").in("post_id", ids).order("created_at", { ascending: true }),
        supabase.from("community_likes").select("post_id,user_id").in("post_id", ids),
      ]);
      (cs as Comment[] | null)?.forEach((c) => { (commentsMap[c.post_id] ||= []).push(c); });
      (ls as { post_id: string; user_id: string }[] | null)?.forEach((l) => {
        likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1;
        if (uid && l.user_id === uid) likedMine[l.post_id] = true;
      });
    }

    // 排序：rank = 点赞数 + 评论数 - 发布天数
    const now = Date.now();
    const sorted = [...list].sort((a, b) => {
      const sa = (likeCount[a.id] || 0) + (commentsMap[a.id]?.length || 0)
        - (now - new Date(a.created_at).getTime()) / 86400000;
      const sb = (likeCount[b.id] || 0) + (commentsMap[b.id]?.length || 0)
        - (now - new Date(b.created_at).getTime()) / 86400000;
      return sb - sa;
    });

    setPosts(sorted);
    setCommentsByPost(commentsMap);
    setLikesByPost(likeCount);
    setLikedByMe(likedMine);
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!me) return;
    if (!content.trim()) return toast.error("说点什么吧");
    setBusy(true);
    const { error } = await supabase.from("community_posts").insert({
      user_id: me.id,
      author_name: name.trim() || me.name,
      content: content.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setContent("");
    toast.success("已发布");
    load();
  }

  async function addComment(postId: string, text: string) {
    if (!me || !text.trim()) return;
    const { error } = await supabase.from("community_comments").insert({
      post_id: postId,
      user_id: me.id,
      author_name: name.trim() || me.name,
      content: text.trim(),
    });
    if (error) return toast.error(error.message);
    load();
  }

  async function toggleLike(postId: string) {
    if (!me) return;
    const liked = likedByMe[postId];
    // 乐观更新
    setLikedByMe((s) => ({ ...s, [postId]: !liked }));
    setLikesByPost((s) => ({ ...s, [postId]: (s[postId] || 0) + (liked ? -1 : 1) }));
    if (liked) {
      const { error } = await supabase.from("community_likes")
        .delete().eq("post_id", postId).eq("user_id", me.id);
      if (error) { toast.error(error.message); load(); }
    } else {
      const { error } = await supabase.from("community_likes")
        .insert({ post_id: postId, user_id: me.id });
      if (error) { toast.error(error.message); load(); }
    }
  }

  async function delPost(id: string) {
    if (!confirm("确认删除这条帖子？")) return;
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("已删除");
    load();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">用户社群</h1>
      <p className="text-sm text-muted-foreground mb-3">
        在这里分享你与"难忘的TA"的故事、戒瘾历程、或者只是今天的心情。
      </p>

      {/* 制作团队联系方式 */}
      <Card className="p-3 mb-6 bg-muted/40 border-dashed">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">制作团队联系方式：</span>
          <a href="" className="font-medium hover:underline">
            {TEAM_CONTACT}
          </a>
        </div>
      </Card>

      {/* 发帖 */}
      <Card className="p-4 mb-6">
        <form onSubmit={publish} className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="昵称"
              className="max-w-[180px] h-9 text-sm"
            />
            <span className="text-xs text-muted-foreground">将以此昵称发布</span>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="说点什么…"
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !content.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              发布
            </Button>
          </div>
        </form>
      </Card>

      {/* 列表 */}
      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <p className="text-sm text-muted-foreground">还没有人分享。来发第一条吧。</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              comments={commentsByPost[p.id] ?? []}
              likes={likesByPost[p.id] ?? 0}
              liked={!!likedByMe[p.id]}
              isOwner={me?.id === p.user_id}
              onLike={() => toggleLike(p.id)}
              onComment={(t) => addComment(p.id, t)}
              onDelete={() => delPost(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post, comments, likes, liked, isOwner, onLike, onComment, onDelete,
}: {
  post: Post;
  comments: Comment[];
  likes: number;
  liked: boolean;
  isOwner: boolean;
  onLike: () => void;
  onComment: (t: string) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-full bg-foreground text-background grid place-items-center text-sm font-medium shrink-0">
          {(post.author_name || "·").slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-sm">{post.author_name || "匿名"}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(post.created_at).toLocaleString("zh-CN")}
            </span>
          </div>
          <p className="mt-1 text-[14.5px] whitespace-pre-wrap leading-relaxed">{post.content}</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <button
              onClick={onLike}
              className={`inline-flex items-center gap-1 transition-colors ${liked ? "text-red-500" : "hover:text-foreground"}`}
            >
              <Heart className={`size-3.5 ${liked ? "fill-current" : ""}`} />
              {likes || ""}
            </button>
            <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 hover:text-foreground">
              <MessageCircle className="size-3.5" />评论 {comments.length || ""}
            </button>
            {isOwner && (
              <button onClick={onDelete} className="inline-flex items-center gap-1 hover:text-destructive">
                <Trash2 className="size-3.5" />删除
              </button>
            )}
          </div>

          {open && (
            <div className="mt-3 space-y-2 border-t pt-3">
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-medium">{c.author_name || "匿名"}：</span>
                  <span className="text-foreground/90">{c.content}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="写下你的评论…"
                  className="h-9 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (text.trim()) { onComment(text); setText(""); }
                    }
                  }}
                />
                <Button
                  size="sm"
                  disabled={!text.trim()}
                  onClick={() => { onComment(text); setText(""); }}
                >
                  发送
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
