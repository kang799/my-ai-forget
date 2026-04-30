import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/chat/")({
  component: ChatIndex,
  head: () => ({ meta: [{ title: "对话 — Persona" }] }),
});

type Char = { id: string; name: string; description: string | null; partner_avatar_url: string | null };

function ChatIndex() {
  const [list, setList] = useState<Char[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("characters")
        .select("id,name,description,partner_avatar_url")
        .order("created_at", { ascending: false });
      const rows = (data as Char[]) ?? [];
      setList(rows);
      if (rows.length === 1) navigate({ to: "/chat/$id", params: { id: rows[0].id } });
    })();
  }, [navigate]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">选择一个角色开始对话</h1>
      <p className="text-sm text-muted-foreground mb-8">每个角色都拥有自己独立的对话历史。</p>

      {list.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <p className="text-sm text-muted-foreground mb-4">你还没有创建任何角色。</p>
          <Button asChild><Link to="/characters/new"><Plus className="size-4" />创建第一个角色</Link></Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((c) => (
            <Link key={c.id} to="/chat/$id" params={{ id: c.id }}>
              <Card className="p-4 hover:shadow-md hover:border-foreground/20 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full overflow-hidden bg-foreground text-background grid place-items-center font-medium">
                    {c.partner_avatar_url ? (
                      <img src={c.partner_avatar_url} alt={c.name} className="size-full object-cover" />
                    ) : (
                      <span>{c.name.slice(0,1)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.description || "开始对话"}</div>
                  </div>
                  <MessageSquare className="size-4 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
