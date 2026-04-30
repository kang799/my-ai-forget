import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CharacterForm, type CharacterFormValues } from "@/components/CharacterForm";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/characters/$id/edit")({
  component: EditCharacter,
  head: () => ({ meta: [{ title: "编辑角色 — Persona" }] }),
});

function EditCharacter() {
  const { id } = Route.useParams();
  const [data, setData] = useState<CharacterFormValues | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: row, error } = await supabase.from("characters").select("*").eq("id", id).maybeSingle();
      if (error || !row) {
        toast.error("角色不存在");
        navigate({ to: "/characters" });
        return;
      }
      setData({
        id: row.id,
        name: row.name,
        gender: row.gender ?? "",
        age_range: row.age_range ?? "",
        description: row.description ?? "",
        detox_mode: row.detox_mode,
        speed: row.speed,
        avatar_url: (row as any).avatar_url ?? null,
        partner_avatar_url: (row as any).partner_avatar_url ?? null,
        self_nudge_text: (row as any).self_nudge_text ?? "拍了拍 对方",
        partner_nudge_text: (row as any).partner_nudge_text ?? "拍了拍 我",
      });
    })();
  }, [id, navigate]);

  if (!data) return <div className="p-12 grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  return <CharacterForm mode="edit" initial={data} />;
}
