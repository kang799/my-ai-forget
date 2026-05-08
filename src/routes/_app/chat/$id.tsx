import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Loader2, MoreHorizontal, Mic, Keyboard, Play } from "lucide-react";
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
  audio_url?: string | null;
  duration_ms?: number | null;
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
const DETOX_DAYS = 180;

function ChatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [shake, setShake] = useState<"me" | "them" | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
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

  async function callAI(history: Msg[]) {
    if (detoxStopped) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          character_id: id,
          messages: history
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.audio_url ? "[语音消息]" : m.content })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "AI 回复失败");
      if (data.stopped) return;
      const reply = data.content as string;
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      await supabase.from("messages").insert({ user_id: user.id, character_id: id, role: "assistant", content: reply });
    } catch (e: any) {
      toast.error(e.message ?? "发送失败");
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !character) return;
    setInput("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    await supabase.from("messages").insert({ user_id: user.id, character_id: id, role: "user", content: text });
    await callAI([...messages, userMsg]);
  }

  async function sendVoice(blob: Blob, durationMs: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("voices").upload(path, blob, {
      contentType: blob.type || "audio/webm",
      upsert: false,
    });
    if (upErr) { toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("voices").getPublicUrl(path);
    const audio_url = pub.publicUrl;
    const userMsg: Msg = { role: "user", content: "[语音消息]", audio_url, duration_ms: durationMs };
    setMessages((m) => [...m, userMsg]);
    await supabase.from("messages").insert({
      user_id: user.id, character_id: id, role: "user",
      content: "[语音消息]", audio_url, duration_ms: durationMs,
    });
    await callAI([...messages, userMsg]);
  }

  async function clearHistory() {
    if (!confirm("确认清空与该角色的所有聊天记录？")) return;
    const { error } = await supabase.from("messages").delete().eq("character_id", id);
    if (error) return toast.error(error.message);
    setMessages([]);
    toast.success("已清空");
  }

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
        user_id: user.id, character_id: id, role: "system", content: text,
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
              <span className="opacity-70">小提示：双击对方或自己的头像可以"拍一拍"，按住麦克风可发送语音</span>
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

      {/* Input bar — WeChat style with voice toggle */}
      <div className="bg-[#f7f7f7] border-t border-black/10">
        <div className="max-w-3xl mx-auto px-2 py-2">
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-foreground"
              onClick={() => setVoiceMode((v) => !v)}
              title={voiceMode ? "切换到键盘" : "切换到语音"}
            >
              {voiceMode ? <Keyboard className="size-5" /> : <Mic className="size-5" />}
            </Button>

            {voiceMode ? (
              <HoldToTalk onFinish={sendVoice} disabled={sending || detoxStopped} />
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HoldToTalk({
  onFinish, disabled,
}: { onFinish: (blob: Blob, ms: number) => void; disabled?: boolean }) {
  const [recording, setRecording] = useState(false);
  const [cancelHover, setCancelHover] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  async function start(e: React.PointerEvent) {
    if (disabled) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startYRef.current = e.clientY;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const ms = Date.now() - startRef.current;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (cancelHover) return;
        if (ms < 800) { toast.message("说话时间太短"); return; }
        onFinish(blob, ms);
      };
      recRef.current = rec;
      startRef.current = Date.now();
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
      }, 200);
    } catch (err: any) {
      toast.error("无法访问麦克风：" + (err?.message ?? ""));
    }
  }

  function move(e: React.PointerEvent) {
    if (!recording) return;
    setCancelHover(startYRef.current - e.clientY > 60);
  }

  function stop() {
    if (!recording) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    try { recRef.current?.stop(); } catch {}
    setTimeout(() => setCancelHover(false), 50);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        className={
          "flex-1 h-10 rounded bg-white border border-black/10 text-sm select-none active:bg-[#dedede] disabled:opacity-50 transition-colors " +
          (recording ? "bg-[#dedede]" : "")
        }
      >
        {recording ? "松开 发送 · 上滑取消" : "按住 说话"}
      </button>

      {recording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={
            "rounded-2xl px-8 py-6 shadow-2xl text-white flex flex-col items-center gap-3 min-w-[220px] " +
            (cancelHover ? "bg-red-600/90" : "bg-black/70")
          }>
            {cancelHover ? (
              <>
                <div className="size-14 rounded-full bg-white/15 grid place-items-center text-2xl">×</div>
                <div className="text-xs">松开手指，取消发送</div>
              </>
            ) : (
              <>
                <div className="h-12 flex items-end gap-0.5">
                  <span className="voice-bar" />
                  <span className="voice-bar" />
                  <span className="voice-bar" />
                  <span className="voice-bar" />
                  <span className="voice-bar" />
                </div>
                <div className="text-sm tabular-nums">{seconds}″ · 上滑取消</div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function VoiceBubble({ url, ms, isUser }: { url: string; ms: number; isUser: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seconds = Math.max(1, Math.round(ms / 1000));
  // Width scales with duration (60s max), like WeChat
  const width = Math.min(220, 70 + seconds * 4);

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onpause = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  return (
    <button
      onClick={toggle}
      style={{ width }}
      className={
        "px-3 py-2.5 text-[14.5px] flex items-center gap-3 select-none " +
        (isUser ? "wechat-bubble-me mr-1 flex-row-reverse" : "wechat-bubble-them ml-1")
      }
    >
      <span className="inline-flex items-end gap-0.5 h-4 text-foreground/70 w-5 justify-center">
        {playing ? (
          <>
            <span className="voice-bar" />
            <span className="voice-bar" />
            <span className="voice-bar" />
          </>
        ) : isUser ? (
          <Play className="size-4" />
        ) : (
          <Play className="size-4 -scale-x-100" />
        )}
      </span>
      <span className="tabular-nums text-foreground/80">{seconds}″</span>
    </button>
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
      {msg.audio_url ? (
        <VoiceBubble url={msg.audio_url} ms={msg.duration_ms ?? 1000} isUser={isUser} />
      ) : (
        <div
          className={
            "px-3 py-2 text-[14.5px] leading-relaxed whitespace-pre-wrap max-w-[72%] " +
            (isUser ? "wechat-bubble-me mr-1" : "wechat-bubble-them ml-1")
          }
        >
          {msg.content}
        </div>
      )}
    </div>
  );
}
