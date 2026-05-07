import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { Users, MessageSquare, LogOut, Heart, Globe2, LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginDialog } from "@/components/LoginDialog";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);

  const nav = [
    { to: "/characters", label: "角色", icon: Users },
    { to: "/chat", label: "对话", icon: MessageSquare },
    { to: "/community", label: "社群", icon: Globe2 },
    ...(isAdmin ? [{ to: "/admin", label: "管理", icon: ShieldAlert }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass border-b">
        <div className="max-w-6xl mx-auto h-14 px-4 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="size-7 rounded-md bg-foreground text-background grid place-items-center">
              <Heart className="size-4" />
            </span>
            <span>忘了么</span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((n) => {
              const active = path.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={
                    "px-3 py-1.5 rounded-md text-sm transition-colors " +
                    (active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <n.icon className="size-4" />
                    {n.label}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {user.email ?? user.phone}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="size-4" />
                  退出
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setLoginOpen(true)}>
                <LogIn className="size-4" />
                登录 / 注册
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
