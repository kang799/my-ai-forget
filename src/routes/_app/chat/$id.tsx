import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chat/$id")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "对话 — Persona" }] }),
});

type Msg = { id?: string; role: "user" | "assistant"; content: string; created_at?: string };

type Character = {
  id: string; name: string; gender: string | null; age_range: string | null;
  description: string | null; detox_mode: boolean; speed: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function ChatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [{ data: c, error: e1 }, { data: ms, error: e2 }] = await Promise.all([
        supabase.from("characters").select("*").eq("id", id).maybeSingle(),
        supabase.from("messages").select("*").eq("character_id", id).order("created_at", { ascending: true }),
      ]);
      if (e1 || !c) { toast.error("角色不存在"); navigate({ to: "/chat" }); return; }
      setCharacter(c as Character);
      if (e2) toast.error(e2.message);
      setMessages((ms as Msg[]) ?? []);
    })();
  }, [id, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending || !character) return;
    setInput("");
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);

    // Persist user message
    await supabase.from("messages").insert({ user_id: user.id, character_id: id, role: "user", content: text });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          character,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "AI 回复失败");
      const reply = data.content as string;

      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      await supabase.from("messages").insert({ user_id: user.id, character_id: id, role: "assistant", content: reply });
    } catch (e: any) {
      toast.error(e.message ?? "发送失败");
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    if (!confirm("确认清空与该角色的所有聊天记录？")) return;
    const { error } = await supabase.from("messages").delete().eq("character_id", id);
    if (error) return toast.error(error.message);
    setMessages([]);
    toast.success("已清空");
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/chat"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div className="size-9 rounded-full bg-foreground text-background grid place-items-center font-medium">
            {character?.name.slice(0,1) ?? "·"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{character?.name ?? "加载中..."}</div>
            <div className="text-xs text-muted-foreground truncate">
              {character ? [character.gender, character.age_range].filter(Boolean).join(" · ") || "AI 角色" : ""}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clearHistory}>
            <Trash2 className="size-4" />清空
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && character && (
            <div className="text-center py-12">
              <div className="size-14 rounded-full bg-foreground text-background grid place-items-center font-medium mx-auto mb-3">
                {character.name.slice(0,1)}
              </div>
              <h3 className="font-medium">{character.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">说点什么，开始对话吧。</p>
            </div>
          )}
          {messages.map((m, i) => (
            <Bubble key={m.id ?? i} msg={m} name={character?.name} />
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="size-8 rounded-full bg-foreground text-background grid place-items-center text-xs">
                {character?.name.slice(0,1)}
              </div>
              <div className="px-4 py-3 rounded-2xl bg-secondary text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />正在输入…
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-background">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 focus-within:ring-2 ring-brand transition-shadow">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="说点什么…（Enter 发送，Shift+Enter 换行）"
              rows={1}
              className="min-h-[2.25rem] resize-none border-0 focus-visible:ring-0 shadow-none p-2 max-h-40"
            />
            <Button size="icon" onClick={send} disabled={!input.trim() || sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg, name }: { msg: Msg; name?: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={"flex gap-3 " + (isUser ? "flex-row-reverse" : "")}>
      <div className={"size-8 rounded-full grid place-items-center text-xs shrink-0 " +
        (isUser ? "bg-secondary text-foreground" : "bg-foreground text-background")}>
        {isUser ? "我" : name?.slice(0,1) ?? "·"}
      </div>
      <div className={"px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap max-w-[75%] " +
        (isUser ? "bg-foreground text-background rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm")}>
        {msg.content}
      </div>
    </div>
  );
}
