import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function translateAuthError(msg?: string): string {
  if (!msg) return "操作失败，请稍后再试";
  const m = msg.toLowerCase();
  if (m.includes("password is known to be weak") || m.includes("weak_password") || m.includes("pwned"))
    return "该密码过于常见，容易被猜中，请换一个更复杂的密码（建议 8 位以上，混合字母数字与符号）。";
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "邮箱或密码不正确。";
  if (m.includes("user already registered") || m.includes("already registered"))
    return "该邮箱已注册，请直接登录。";
  if (m.includes("email not confirmed"))
    return "邮箱尚未验证，请先到邮箱完成验证。";
  if (m.includes("password should be at least"))
    return "密码长度不足，请至少使用 8 位字符。";
  if (m.includes("rate limit") || m.includes("too many"))
    return "操作过于频繁，请稍后再试。";
  if (m.includes("network") || m.includes("failed to fetch"))
    return "网络连接异常，请检查网络后重试。";
  return msg;
}

export function EmailAuth({
  onSuccess,
  redirectTo = "/characters",
  showForgot = true,
}: {
  onSuccess?: () => void;
  redirectTo?: string;
  showForgot?: boolean;
}) {
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
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          toast.success("注册成功，请登录");
          setMode("signin");
        } else {
          toast.success("注册成功");
          onSuccess ? onSuccess() : navigate({ to: redirectTo as any });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("登录成功");
        onSuccess ? onSuccess() : navigate({ to: redirectTo as any });
      }
    } catch (e: any) {
      toast.error(translateAuthError(e?.message));
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
        <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "至少 8 位，避免常见弱密码" : ""} />
        {mode === "signup" && (
          <p className="text-xs text-muted-foreground mt-1.5">为了你的账户安全，请避免使用 123456、password、qwerty 等常见密码。建议混合字母、数字与符号。</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {mode === "signin" ? "登录" : "注册"}
      </Button>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="hover:text-foreground transition-colors">
          {mode === "signin" ? "没有账号？去注册" : "已有账号？去登录"}
        </button>
        {showForgot && (
          <Link to="/login" className="hover:text-foreground transition-colors">忘记密码</Link>
        )}
      </div>
    </form>
  );
}
