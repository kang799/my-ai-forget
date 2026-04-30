import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "登录 — Persona" }, { name: "description", content: "登录或注册你的 Persona 账户。" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/characters" });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-foreground text-background">
        <div className="flex items-center gap-2 font-semibold">
          <span className="size-7 rounded-md bg-background text-foreground grid place-items-center">
            <Sparkles className="size-4" />
          </span>
          Persona
        </div>
        <div className="space-y-3 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            和你脑海里的那个人，<br />再聊一次。
          </h1>
          <p className="text-sm opacity-70">
            创建专属 AI 角色，定制语气、节奏、戒瘾模式。一切从一段简短的描述开始。
          </p>
        </div>
        <p className="text-xs opacity-50">© Persona</p>
      </aside>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight mb-1">欢迎回来</h2>
          <p className="text-sm text-muted-foreground mb-8">使用邮箱或手机号继续。</p>

          <EmailAuth />
          <p className="mt-6 text-xs text-muted-foreground">
            手机号登录需要后台配置 SMS 服务商，暂未启用。
          </p>
        </div>
      </section>
    </div>
  );
}

function EmailAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("注册成功，请查看邮箱完成验证");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("登录成功");
        navigate({ to: "/characters" });
      }
    } catch (e: any) {
      toast.error(e.message ?? "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="email">邮箱</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div>
        <Label htmlFor="password">密码</Label>
        <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {mode === "signin" ? "登录" : "注册"}
      </Button>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="hover:text-foreground transition-colors">
          {mode === "signin" ? "没有账号？去注册" : "已有账号？去登录"}
        </button>
        <Link to="/login" className="hover:text-foreground transition-colors">忘记密码</Link>
      </div>
    </form>
  );
}

function PhoneAuth() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function sendCode() {
    if (!phone) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      toast.success("验证码已发送");
      setSent(true);
    } catch (e: any) {
      toast.error(e.message ?? "发送失败，请确认手机号格式（含国家码，如 +8613...）");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) throw error;
      toast.success("登录成功");
      navigate({ to: "/characters" });
    } catch (e: any) {
      toast.error(e.message ?? "验证失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={verify} className="space-y-3">
      <div>
        <Label htmlFor="phone">手机号</Label>
        <Input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8613800138000" />
      </div>
      {sent && (
        <div>
          <Label htmlFor="otp">验证码</Label>
          <Input id="otp" required value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6 位数字" />
        </div>
      )}
      {!sent ? (
        <Button type="button" className="w-full" disabled={busy} onClick={sendCode}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          发送验证码
        </Button>
      ) : (
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          验证并登录
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        手机号需包含国家码。短信服务需在后台启用。
      </p>
    </form>
  );
}
