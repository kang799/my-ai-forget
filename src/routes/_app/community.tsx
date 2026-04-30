import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageCircle, Trash2 } from "lucide-react";
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

function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
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
      await load();
      setLoading(false);
    })();
  }, []);

  async function load() {
    const { data: ps } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (ps as Post[]) ?? [];
    setPosts(list);
    if (list.length) {
      const ids = list.map((p) => p.id);
      const { data: cs } = await supabase
        .from("community_comments")
        .select("*")
        .in("post_id", ids)
        .order("created_at", { ascending: true });
      const map: Record<string, Comment[]> = {};
      (cs as Comment[] | null)?.forEach((c) => {
        (map[c.post_id] ||= []).push(c);
      });
      setCommentsByPost(map);
    } else {
      setCommentsByPost({});
    }
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
      <p className="text-sm text-muted-foreground mb-6">
        在这里分享你与"难忘的TA"的故事、戒瘾历程、或者只是今天的心情。
      </p>

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
              isOwner={me?.id === p.user_id}
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
  post, comments, isOwner, onComment, onDelete,
}: {
  post: Post;
  comments: Comment[];
  isOwner: boolean;
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
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
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
