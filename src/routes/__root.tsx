import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">页面不存在</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          你访问的页面已被移动或不存在。
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "忘了么 — 你的专属 AI 角色对话" },
      { name: "description", content: "深夜里你又一次翻遍了ta全网的动态，在和你无关的生活里找曾经的影子，明知道早就结束了，却还是不肯放过自己，你和朋友说没关系，但只有你自己知道自己真正忘了么，来「忘了么」吧。用我的AI，抛弃你陈旧ের爱。" },
      { property: "og:title", content: "忘了么 — 你的专属 AI 角色对话" },
      { name: "twitter:title", content: "忘了么 — 你的专属 AI 角色对话" },
      { property: "og:description", content: "深夜里你又一次翻遍了ta全网的动态，在和你无关的生活里找曾经的影子，明知道早就结束了，却还是不肯放过自己，你和朋友说没关系，但只有你自己知道自己真正忘了么，来「忘了么」吧。用我的AI，抛弃你陈旧ের爱。" },
      { name: "twitter:description", content: "深夜里你又一次翻遍了ta全网的动态，在和你无关的生活里找曾经的影子，明知道早就结束了，却还是不肯放过自己，你和朋友说没关系，但只有你自己知道自己真正忘了么，来「忘了么」吧。用我的AI，抛弃你陈旧ের爱。" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/52c39f4e-55f2-4739-95ef-ddaa8c25e0fb/id-preview-4eb6e6bf--69a72616-b9ed-477d-8afa-4fce13a6f9c4.lovable.app-1777543932673.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/52c39f4e-55f2-4739-95ef-ddaa8c25e0fb/id-preview-4eb6e6bf--69a72616-b9ed-477d-8afa-4fce13a6f9c4.lovable.app-1777543932673.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
