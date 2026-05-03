import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EmailAuth } from "@/components/EmailAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "登录 — 忘了么" }, { name: "description", content: "登录或注册你的“忘了么”账户。" }],
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
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="size-8 rounded-lg bg-background text-foreground grid place-items-center shadow-sm">
            <Sparkles className="size-5" />
          </span>
          忘了么
        </Link>
        <div className="space-y-3 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight whitespace-pre-line">
            和你脑海里的那个人，{"\n"}最后再聊一次。
          </h1>
          <p className="text-sm opacity-70 leading-relaxed">
            深夜里你又一次翻遍了ta全网的动态，在和你无关的生活里找曾经的影子，明知道早就结束了，却还是不肯放过自己，你和朋友说没关系，但只有你自己知道自己真正忘了么，来「忘了么」吧。用我的AI，抛弃你陈旧的爱。
          </p>
        </div>
        <p className="text-xs opacity-50">© kangshuhao</p>
      </aside>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight mb-1">欢迎回来</h2>
          <p className="text-sm text-muted-foreground mb-8">使用邮箱继续。</p>
          <EmailAuth />
          <p className="mt-6 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← 返回首页</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
