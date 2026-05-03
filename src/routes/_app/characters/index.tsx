import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, MessageSquare, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { LoginDialog } from "@/components/LoginDialog";

export const Route = createFileRoute("/_app/characters/")({
  component: CharactersList,
  head: () => ({ meta: [{ title: "角色管理 — 忘了么" }] }),
});

type Character = {
  id: string;
  name: string;
  gender: string | null;
  age_range: string | null;
  description: string | null;
  detox_mode: boolean;
  speed: string;
};

function CharactersList() {
  const [list, setList] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  async function load() {
    if (!user) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data as Character[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function remove(id: string) {
    if (!confirm("确认删除这个角色？相关聊天记录也会一并删除。")) return;
    const { error } = await supabase.from("characters").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("已删除");
    load();
  }

  function onCreateClick() {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    navigate({ to: "/characters/new" });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">角色</h1>
          <p className="text-sm text-muted-foreground mt-1">创建并管理你的 AI 对话对象。</p>
        </div>
        <Button onClick={onCreateClick}>
          <Plus className="size-4" />新建角色
        </Button>
      </div>

      {loading || authLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : !user ? (
        <Card className="p-12 text-center border-dashed">
          <div className="mx-auto size-12 rounded-full bg-secondary grid place-items-center mb-4">
            <Sparkles className="size-5 text-brand" />
          </div>
          <h3 className="font-medium">登录后即可创建你的专属角色</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            注册一个账号，几分钟即可开始你的第一次对话。
          </p>
          <Button onClick={() => setLoginOpen(true)}>登录 / 注册</Button>
        </Card>
      ) : list.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="mx-auto size-12 rounded-full bg-secondary grid place-items-center mb-4">
            <Sparkles className="size-5 text-muted-foreground" />
          </div>
          <h3 className="font-medium">还没有角色</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6">从一段简短描述开始，创建你的第一个角色。</p>
          <Button onClick={onCreateClick}>
            <Plus className="size-4" />创建第一个角色
          </Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-full bg-foreground text-background grid place-items-center font-medium">
                  {c.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {[c.gender, c.age_range].filter(Boolean).join(" · ") || "未设定"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2 min-h-[2.5rem]">
                {c.description || "暂无描述"}
              </p>
              <div className="flex items-center gap-1 mt-3 text-xs">
                {c.detox_mode && (
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">戒瘾</span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {c.speed === "slow" ? "慢" : c.speed === "fast" ? "快" : "中"}速
                </span>
              </div>
              <div className="flex items-center gap-2 mt-5 pt-4 border-t">
                <Button asChild size="sm" className="flex-1">
                  <Link to="/chat/$id" params={{ id: c.id }}>
                    <MessageSquare className="size-4" />对话
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/characters/$id/edit" params={{ id: c.id }}>
                    <Pencil className="size-4" />
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
