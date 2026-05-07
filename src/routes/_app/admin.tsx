import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Loader2, MessageSquare, Users, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "管理后台 — 忘了么" }] }),
});

type Character = {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  detox_mode: boolean;
};

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type Message = {
  id: string;
  role: string;
  content: string;
  audio_url: string | null;
  created_at: string;
  user_id: string;
};

function AdminPage() {
  const { isAdmin, checking } = useIsAdmin();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const [{ data: chars, error: e1 }, { data: profs, error: e2 }] = await Promise.all([
        supabase.from("characters").select("id,name,description,user_id,created_at,detox_mode").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,email,display_name"),
      ]);
      if (e1) toast.error(e1.message);
      if (e2) toast.error(e2.message);
      setCharacters((chars as Character[]) ?? []);
      const map: Record<string, Profile> = {};
      ((profs as Profile[]) ?? []).forEach((p) => (map[p.id] = p));
      setProfiles(map);
      setLoading(false);
    })();
  }, [isAdmin]);

  async function viewMessages(c: Character) {
    setSelected(c);
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from("messages")
      .select("id,role,content,audio_url,created_at,user_id")
      .eq("character_id", c.id)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setMessages((data as Message[]) ?? []);
    setLoadingMsgs(false);
  }

  if (checking) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> 校验权限中…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <Card className="p-10 text-center border-dashed">
          <div className="mx-auto size-12 rounded-full bg-secondary grid place-items-center mb-4">
            <ShieldAlert className="size-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">无权访问</h2>
          <p className="text-sm text-muted-foreground mt-2">该页面仅对管理员开放。</p>
        </Card>
      </div>
    );
  }

  const filtered = characters.filter((c) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    const p = profiles[c.user_id];
    return (
      c.name.toLowerCase().includes(f) ||
      (c.description ?? "").toLowerCase().includes(f) ||
      (p?.email ?? "").toLowerCase().includes(f) ||
      (p?.display_name ?? "").toLowerCase().includes(f)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldAlert className="size-7 text-brand" /> 管理后台
          </h1>
          <p className="text-sm text-muted-foreground mt-1">查看所有用户创建的角色与聊天记录，用于产品改进。</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Users className="size-4" /> 共 {characters.length} 个角色 · {Object.keys(profiles).length} 名用户
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="搜索角色名 / 描述 / 用户邮箱" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const p = profiles[c.user_id];
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-full bg-foreground text-background grid place-items-center font-medium">
                    {c.name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{c.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {p?.email || p?.display_name || c.user_id.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2 min-h-[2.5rem]">
                  {c.description || "暂无描述"}
                </p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => viewMessages(c)}>
                    <MessageSquare className="size-4" /> 查看聊天
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-medium">{selected.name} 的聊天记录</h3>
                <p className="text-xs text-muted-foreground">
                  用户：{profiles[selected.user_id]?.email || selected.user_id.slice(0, 8)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>关闭</Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mr-2" /> 加载中…
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">暂无聊天记录</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                      {m.audio_url ? (
                        <audio src={m.audio_url} controls className="max-w-full" />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      )}
                      <p className={`text-[10px] mt-1 ${m.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
