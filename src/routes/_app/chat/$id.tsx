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
  transcript?: string | null;
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
            .map((m) => ({
              role: m.role,
              content: m.audio_url
                ? (m.transcript && m.transcript.trim() ? `（语音）${m.transcript}` : "[语音消息]")
                : m.content,
            })),
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

    // 1. Show locally immediately for instant feedback
    const localUrl = URL.createObjectURL(blob);
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMsg: Msg = {
      id: tempId, role: "user", content: "[语音消息]",
      audio_url: localUrl, duration_ms: durationMs, transcript: null,
    };
    setMessages((m) => [...m, tempMsg]);

    // 2. Upload + transcribe in background, then trigger AI
    (async () => {
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("voices").upload(path, blob, {
        contentType: blob.type || "audio/webm",
        upsert: false,
      });
      if (upErr) { toast.error(upErr.message); return; }
      const { data: pub } = supabase.storage.from("voices").getPublicUrl(path);
      const audio_url = pub.publicUrl;

      let transcript = "";
      try {
        const base64 = await blobToBase64(blob);
        const { data: tData, error: tErr } = await supabase.functions.invoke("transcribe", {
          body: { audio: base64, mime: blob.type || "audio/webm" },
        });
        if (tErr) throw tErr;
        transcript = (tData?.text ?? "").toString().trim();
      } catch (e: any) {
        console.error("transcribe failed", e);
      }

      const content = transcript ? transcript : "[语音消息]";
      const { data: inserted } = await supabase.from("messages").insert({
        user_id: user.id, character_id: id, role: "user",
        content, audio_url, duration_ms: durationMs,
        transcript: transcript || null,
      }).select().single();

      const finalMsg: Msg = (inserted as Msg) ?? {
        role: "user", content, audio_url, duration_ms: durationMs, transcript: transcript || null,
      };
      setMessages((arr) => arr.map((x) => (x.id === tempId ? finalMsg : x)));

      if (!transcript) {
        toast.error("没识别到语音内容，AI 暂不回复");
        return;
      }
      // Use latest messages snapshot for AI history
      setMessages((curr) => {
        callAI(curr);
        return curr;
      });
    })();
  }

  async function clearHistory() {
    if (!confirm("确认清空与该角色的所有聊天记录？")) return;
    const { error } = await supabase.from("messages").delete().eq("character_id", id);
    if (error) return toast.error(error.message);
    setMessages([]);
    toast.success("已清空");
  }

  async function deleteMessage(msg: Msg) {
    if (!msg.id) {
      setMessages((arr) => arr.filter((x) => x !== msg));
      return;
    }
    const { error } = await supabase.from("messages").delete().eq("id", msg.id);
    if (error) return toast.error(error.message);
    setMessages((arr) => arr.filter((x) => x.id !== msg.id));
  }

  async function recallMessage(msg: Msg) {
    // WeChat-like: only within 2 minutes
    if (msg.created_at) {
      const ageMs = Date.now() - new Date(msg.created_at).getTime();
      if (ageMs > 2 * 60 * 1000) {
        toast.error("发送已超过 2 分钟，无法撤回");
        return;
      }
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (msg.id) {
      const { error } = await supabase.from("messages").delete().eq("id", msg.id);
      if (error) return toast.error(error.message);
    }
    const sysText = "你撤回了一条消息";
    const { data: inserted } = await supabase
      .from("messages")
      .insert({ user_id: user.id, character_id: id, role: "system", content: sysText })
      .select()
      .single();
    setMessages((arr) => {
      const filtered = arr.filter((x) => x.id !== msg.id);
      return [...filtered, (inserted as Msg) ?? { role: "system", content: sysText }];
    });
  }

  async function transcribeMessage(msg: Msg): Promise<string> {
    if (msg.transcript && msg.transcript.trim()) return msg.transcript;
    if (!msg.audio_url) return "";
    try {
      const blob = await fetch(msg.audio_url).then((r) => r.blob());
      const base64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke("transcribe", {
        body: { audio: base64, mime: blob.type || "audio/webm" },
      });
      if (error) throw error;
      const text = (data?.text ?? "").toString().trim();
      if (!text) { toast.message("没识别到内容"); return ""; }
      if (msg.id) {
        await supabase.from("messages").update({ transcript: text }).eq("id", msg.id);
      }
      setMessages((arr) => arr.map((x) => (x.id === msg.id ? { ...x, transcript: text } : x)));
      return text;
    } catch (e: any) {
      toast.error("转写失败：" + (e?.message ?? ""));
      return "";
    }
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
                onDelete={deleteMessage}
                onRecall={recallMessage}
                onTranscribe={transcribeMessage}
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = String(r.result || "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
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
        const s = Math.floor((Date.now() - startRef.current) / 1000);
        setSeconds(s);
        if (s >= 60) {
          toast.message("已达 60 秒上限，自动发送");
          stop();
        }
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

function VoiceBubble({
  msg, isUser, onDelete, onRecall, onTranscribe,
}: {
  msg: Msg; isUser: boolean;
  onDelete: (m: Msg) => unknown;
  onRecall: (m: Msg) => unknown;
  onTranscribe: (m: Msg) => Promise<string>;
}) {
  const url = msg.audio_url!;
  const ms = msg.duration_ms ?? 1000;
  const [playing, setPlaying] = useState(false);
  const [showText, setShowText] = useState(false);
  const [loadingText, setLoadingText] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seconds = Math.max(1, Math.round(ms / 1000));
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

  async function handleTranscribe() {
    if (msg.transcript) { setShowText(true); return; }
    setLoadingText(true);
    try { await onTranscribe(msg); setShowText(true); }
    finally { setLoadingText(false); }
  }

  const { bind, menu } = useLongPressMenu({
    items: [
      { label: showText ? "收起文字" : (loadingText ? "转写中…" : "转文字"), onClick: () => (showText ? setShowText(false) : handleTranscribe()) },
      ...(isUser ? [{ label: "撤回", onClick: () => onRecall(msg) }] : []),
      { label: "删除", danger: true, onClick: () => onDelete(msg) },
    ],
  });

  return (
    <div className={"relative flex flex-col gap-1 " + (isUser ? "items-end" : "items-start")}>
      <button
        type="button"
        {...bind}
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
      {showText && msg.transcript && (
        <div className={
          "px-3 py-1.5 rounded text-[13px] leading-relaxed max-w-[260px] bg-black/5 text-foreground/80 " +
          (isUser ? "mr-1" : "ml-1")
        }>
          {msg.transcript}
        </div>
      )}
      {menu}
    </div>
  );
}

function useLongPressMenu({ items }: {
  items: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const openedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const moved = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  function clear() {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
  }

  const longPressFired = useRef(false);

  function openMenu() {
    longPressFired.current = true;
    openedAt.current = Date.now();
    setOpen(true);
  }

  const bind = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
      moved.current = false;
      longPressFired.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(openMenu, 450);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!startPos.current) return;
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx > 8 || dy > 8) { moved.current = true; clear(); }
    },
    onPointerUp: () => { clear(); },
    onPointerCancel: () => { clear(); },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); openMenu(); },
    onClickCapture: (e: React.MouseEvent) => {
      if (longPressFired.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    style: { touchAction: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties,
  };

  function tryClose() {
    // Ignore the synthetic click that immediately follows the long-press release.
    if (Date.now() - openedAt.current < 350) return;
    setOpen(false);
    longPressFired.current = false;
  }

  const menu = open ? (
    <>
      <div
        className="fixed inset-0 z-40"
        onPointerDown={tryClose}
        onClick={tryClose}
        onContextMenu={(e) => { e.preventDefault(); tryClose(); }}
      />
      <div className="absolute z-50 -top-2 left-1/2 -translate-x-1/2 -translate-y-full">
        <div className="bg-[#4c4c4c] text-white rounded-md shadow-lg overflow-hidden flex text-[13px]">
          {items.map((it, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
              className={
                "px-3.5 py-2 hover:bg-white/10 whitespace-nowrap " +
                (idx > 0 ? "border-l border-white/10 " : "") +
                (it.danger ? "text-red-300" : "")
              }
            >
              {it.label}
            </button>
          ))}
        </div>
        <div className="w-2 h-2 bg-[#4c4c4c] rotate-45 mx-auto -mt-1" />
      </div>
    </>
  ) : null;

  return { bind, menu };
}


function Bubble({
  msg, character, shake, onNudge, partnerAvatar, onDelete, onRecall, onTranscribe,
}: {
  msg: Msg;
  character: Character | null;
  shake: "me" | "them" | null;
  onNudge: (t: "me" | "them") => void;
  partnerAvatar: React.ReactNode;
  onDelete: (msg: Msg) => unknown;
  onRecall: (msg: Msg) => unknown;
  onTranscribe: (msg: Msg) => Promise<string>;
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
        <VoiceBubble
          msg={msg}
          isUser={isUser}
          onDelete={onDelete}
          onRecall={onRecall}
          onTranscribe={onTranscribe}
        />
      ) : (
        <TextBubble msg={msg} isUser={isUser} onDelete={onDelete} onRecall={onRecall} />
      )}
    </div>
  );
}

function TextBubble({
  msg, isUser, onDelete, onRecall,
}: {
  msg: Msg; isUser: boolean;
  onDelete: (m: Msg) => unknown;
  onRecall: (m: Msg) => unknown;
}) {
  const { bind, menu } = useLongPressMenu({
    items: [
      ...(isUser ? [{ label: "撤回", onClick: () => onRecall(msg) }] : []),
      { label: "删除", danger: true, onClick: () => onDelete(msg) },
    ],
  });
  return (
    <div className="relative">
      <div
        {...bind}
        className={
          "px-3 py-2 text-[14.5px] leading-relaxed whitespace-pre-wrap max-w-[72%] cursor-default " +
          (isUser ? "wechat-bubble-me mr-1" : "wechat-bubble-them ml-1")
        }
      >
        {msg.content}
      </div>
      {menu}
    </div>
  );
}

