import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    // /characters 列表页允许未登录访问（会显示登录引导卡片）。
    // 其他受保护的子路由（创建/编辑角色、对话、社群发帖等）仍需登录。
    const allowAnon = location.pathname === "/characters" || location.pathname === "/characters/";
    if (allowAnon) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
