import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Loader2, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chat/$id")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "对话 — 难忘的TA" }] }),
});

type Msg = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
};

type Character = {
  id: string;
  name: string;
  gender: string | null;
  age_range: string | null;
  description: string | null;
  detox_mode: boolean;
  speed: string;
  created_at: string;
  avatar_url: string | null;
  partner_avatar_url: string | null;
  self_nudge_text: string | null;
  partner_nudge_text: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const DETOX_DAYS = 180; // 6 个月

function ChatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [shake, setShake] = useState<"me" | "them" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const detoxStopped = useMemo(() => {
    if (!character?.detox_mode || !character.created_at) return false;
    const days = (Date.now() - new Date(character.created_at).getTime()) / 86400000;
    return days >= DETOX_DAYS;
  }, [character]);

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

    await supabase.from("messages").insert({ user_id: user.id, character_id: id, role: "user", content: text });

    // 戒瘾期满，停止回复
    if (detoxStopped) {
      setSending(false);
      return;
    }

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
          messages: [...messages, userMsg]
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "AI 回复失败");
      if (data.stopped) {
        setSending(false);
        return;
      }
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

  // 双击头像：拍一拍
  async function nudge(target: "me" | "them") {
    if (!character) return;
    const myName = "我";
    const themName = character.name;
    const text = target === "them"
      ? `${myName} ${character.self_nudge_text || "拍了拍 对方"} ${themName}`
      : `${themName} ${character.partner_nudge_text || "拍了拍 我"} ${myName}`;

    setShake(target);
    setTimeout(() => setShake(null), 700);

    const sysMsg: Msg = { role: "system", content: text };
    setMessages((m) => [...m, sysMsg]);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("messages").insert({
        user_id: user.id,
        character_id: id,
        role: "system",
        content: text,
      });
    }
  }

  const partnerAvatar = (
    <div
      onDoubleClick={() => nudge("them")}
      className={"size-9 rounded-md overflow-hidden bg-foreground text-background grid place-items-center text-sm font-medium shrink-0 cursor-pointer select-none " +
        (shake === "them" ? "animate-nudge" : "")}
      title="双击拍一拍"
    >
      {character?.partner_avatar_url ? (
        <img src={character.partner_avatar_url} alt={character.name} className="size-full object-cover" />
      ) : (
        <span>{character?.name.slice(0, 1) ?? "·"}</span>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col wechat-bg">
      {/* 顶部：微信风格 */}
      <div className="bg-[#ededed] border-b border-black/10">
        <div className="max-w-3xl mx-auto px-3 h-12 flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="text-foreground">
            <Link to="/chat"><ArrowLeft className="size-5" /></Link>
          </Button>
          <div className="flex-1 text-center">
            <div className="font-medium text-[15px] truncate">{character?.name ?? "加载中..."}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={clearHistory} title="清空">
            <MoreHorizontal className="size-5" />
          </Button>
        </div>
      </div>

      {/* 戒瘾结束提示 */}
      {detoxStopped && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs text-center py-2 px-4">
          戒瘾模式已满 6 个月，TA 不会再回复你了。愿你早已学会与自己相处。
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 py-4 space-y-3">
          {messages.length === 0 && character && (
            <div className="text-center py-12 text-xs text-muted-foreground">
              说点什么，开始对话吧。<br />
              <span className="opacity-70">小提示：双击对方或自己的头像可以"拍一拍"</span>
            </div>
          )}
          {messages.map((m, i) => {
            if (m.role === "system") {
              return (
                <div key={m.id ?? i} className="text-center">
                  <span className="inline-block text-[12px] text-muted-foreground bg-black/5 rounded px-2.5 py-1">
                    {m.content}
                  </span>
                </div>
              );
            }
            return (
              <Bubble
                key={m.id ?? i}
                msg={m}
                character={character}
                shake={shake}
                onNudge={nudge}
                partnerAvatar={partnerAvatar}
              />
            );
          })}
          {sending && (
            <div className="flex gap-2 items-start">
              {partnerAvatar}
              <div className="px-3 py-2 rounded wechat-bubble-them text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />正在输入…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 输入区：微信风格 */}
      <div className="bg-[#f7f7f7] border-t border-black/10">
        <div className="max-w-3xl mx-auto px-3 py-2">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={detoxStopped ? "TA 已不会再回复…" : "说点什么…"}
              rows={1}
              className="min-h-[2.5rem] resize-none bg-white border border-black/10 rounded p-2 max-h-40 text-sm shadow-none"
            />
            <Button
              size="sm"
              onClick={send}
              disabled={!input.trim() || sending}
              className="h-10 bg-[#07c160] hover:bg-[#06ad56] text-white"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  msg, character, shake, onNudge, partnerAvatar,
}: {
  msg: Msg;
  character: Character | null;
  shake: "me" | "them" | null;
  onNudge: (t: "me" | "them") => void;
  partnerAvatar: React.ReactNode;
}) {
  const isUser = msg.role === "user";

  const meAvatar = (
    <div
      onDoubleClick={() => onNudge("me")}
      className={"size-9 rounded-md overflow-hidden bg-secondary grid place-items-center text-sm font-medium shrink-0 cursor-pointer select-none border " +
        (shake === "me" ? "animate-nudge" : "")}
      title="双击拍一拍"
    >
      {character?.avatar_url ? (
        <img src={character.avatar_url} alt="me" className="size-full object-cover" />
      ) : (
        <span>我</span>
      )}
    </div>
  );

  return (
    <div className={"flex gap-2 items-start " + (isUser ? "flex-row-reverse" : "")}>
      {isUser ? meAvatar : partnerAvatar}
      <div
        className={
          "px-3 py-2 text-[14.5px] leading-relaxed whitespace-pre-wrap max-w-[72%] " +
          (isUser ? "wechat-bubble-me mr-1" : "wechat-bubble-them ml-1")
        }
      >
        {msg.content}
      </div>
    </div>
  );
}
