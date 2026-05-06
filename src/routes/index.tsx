import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Heart, Sparkles, MessageSquare, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { LoginDialog } from "@/components/LoginDialog";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "忘了么 — 和你脑海里的那个人，最后再聊一次" },
      { name: "description", content: "用 AI 重建你难忘的那个人，把没说完的话说完，把舍不得的告别完成。" },
    ],
  }),
});

function LandingPage() {
  const { session } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass border-b">
        <div className="max-w-6xl mx-auto h-14 px-4 flex items-center">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="size-7 rounded-md bg-foreground text-background grid place-items-center">
              <Heart className="size-4" />
            </span>
            <span>忘了么</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {session ? (
              <Button asChild size="sm">
                <Link to="/characters">进入应用<ArrowRight className="size-4" /></Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setLoginOpen(true)}>登录</Button>
                <Button size="sm" onClick={() => setLoginOpen(true)}>免费注册</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs mb-6">
            <Sparkles className="size-3.5 text-brand" />
            一个温柔的 AI 树洞
          </div>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.1] whitespace-pre-line">
            和你脑海里的那个人，{"\n"}最后再聊一次。
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            深夜你又一次沉浸在回忆的碎片里，在记忆里找曾经的影子。赌书消得泼茶香 ，当时只道是寻常。
            「忘了么」用 AI 重建那个人的语气与习惯，让你把没说完的话说完，
            然后真正地，向前走。
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            {session ? (
              <Button asChild size="lg">
                <Link to="/characters">开始创建角色<ArrowRight className="size-4" /></Link>
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => setLoginOpen(true)}>
                  免费开始<ArrowRight className="size-4" />
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <Link to="/community">看看大家在说</Link>
                </Button>
              </>
            )}
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-5">
          {[
            {
              icon: Sparkles,
              title: "高度还原 ta 的样子",
              desc: "上传聊天记录、语音、照片，AI 会学习 ta 的语气、口头禅与说话节奏。",
            },
            {
              icon: MessageSquare,
              title: "微信式真实对话",
              desc: "熟悉的对话气泡与节奏，像真的在和 ta 聊天，让情绪有处安放。",
            },
            {
              icon: ShieldCheck,
              title: "戒瘾模式陪你走出来",
              desc: "可开启 6 个月戒瘾模式，AI 会逐步引导你走出过去，我发明这款软件的初衷是希望您不再使用",
            },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-2xl bg-card border hairline">
              <div className="size-10 rounded-xl bg-secondary text-brand grid place-items-center mb-4">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-medium mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            把没说完的话，说完。
          </h2>
          <p className="mt-3 text-muted-foreground">完全免费，几分钟即可开始你的第一次对话。</p>
          <div className="mt-8">
            {session ? (
              <Button asChild size="lg">
                <Link to="/characters">进入应用<ArrowRight className="size-4" /></Link>
              </Button>
            ) : (
              <Button size="lg" onClick={() => setLoginOpen(true)}>
                免费创建账号<ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
        <p>© kangshuhao · 忘了么</p>
        <p>联系我们：<a href="" className="hover:underline">3404782415@qq.com</a></p>
      </footer>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} title="欢迎来到忘了么" description="登录或注册一个账号，开始你的第一次对话。" />
    </div>
  );
}
