import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type CharacterFormValues = {
  id?: string;
  name: string;
  gender: string;
  age_range: string;
  description: string;
  detox_mode: boolean;
  speed: string;
};

export function CharacterForm({
  initial,
  mode,
}: {
  initial: CharacterFormValues;
  mode: "create" | "edit";
}) {
  const navigate = useNavigate();
  const [v, setV] = useState<CharacterFormValues>(initial);
  const [voice, setVoice] = useState<File | null>(null);
  const [chatlog, setChatlog] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadIfAny(file: File | null, userId: string) {
    if (!file) return null;
    const path = `${userId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) throw error;
    return path;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) return toast.error("请填写角色名称");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("请先登录");

      // Optional file uploads (best-effort; bucket may not exist yet)
      let voice_url: string | null = null;
      let chatlog_url: string | null = null;
      try {
        voice_url = await uploadIfAny(voice, user.id);
        chatlog_url = await uploadIfAny(chatlog, user.id);
      } catch {
        // Storage bucket may be optional
      }

      const payload = {
        user_id: user.id,
        name: v.name.trim(),
        gender: v.gender || null,
        age_range: v.age_range || null,
        description: v.description || null,
        detox_mode: v.detox_mode,
        speed: v.speed,
        ...(voice_url ? { voice_url } : {}),
        ...(chatlog_url ? { chatlog_url } : {}),
      };

      if (mode === "create") {
        const { error } = await supabase.from("characters").insert(payload);
        if (error) throw error;
        toast.success("角色已创建");
      } else {
        const { error } = await supabase.from("characters").update(payload).eq("id", v.id!);
        if (error) throw error;
        toast.success("已保存");
      }
      navigate({ to: "/characters" });
    } catch (e: any) {
      toast.error(e.message ?? "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/characters"><ArrowLeft className="size-4" />返回</Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        {mode === "create" ? "新建角色" : "编辑角色"}
      </h1>
      <p className="text-sm text-muted-foreground mb-8">为这个 AI 角色设定身份与对话风格。</p>

      <form onSubmit={submit}>
        <Card className="p-6 space-y-5">
          <div>
            <Label>角色名称</Label>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="例如：张经理" required />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>性别</Label>
              <Select value={v.gender} onValueChange={(x) => setV({ ...v, gender: x })}>
                <SelectTrigger><SelectValue placeholder="选择" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">男</SelectItem>
                  <SelectItem value="female">女</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>年龄</Label>
              <Select value={v.age_range} onValueChange={(x) => setV({ ...v, age_range: x })}>
                <SelectTrigger><SelectValue placeholder="选择" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="18-24">18-24 岁</SelectItem>
                  <SelectItem value="25-29">25-29 岁</SelectItem>
                  <SelectItem value="30-35">30-35 岁</SelectItem>
                  <SelectItem value="36-45">36-45 岁</SelectItem>
                  <SelectItem value="46-60">46-60 岁</SelectItem>
                  <SelectItem value="60+">60 岁以上</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>人物描述</Label>
            <Textarea
              rows={4}
              value={v.description}
              onChange={(e) => setV({ ...v, description: e.target.value })}
              placeholder="性格、说话风格、背景故事…"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>上传录音（可选）</Label>
              <Input type="file" accept="audio/*" onChange={(e) => setVoice(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label>上传聊天记录（可选）</Label>
              <Input type="file" accept=".txt,.json,.csv" onChange={(e) => setChatlog(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium text-sm">戒瘾模式</div>
              <div className="text-xs text-muted-foreground mt-0.5">开启后角色不会立刻变冷漠，而是随角色建立时长逐步疏远（约 3 天后开始，30 天达到完全克制）。</div>
            </div>
            <Switch checked={v.detox_mode} onCheckedChange={(x) => setV({ ...v, detox_mode: x })} />
          </div>

          <div>
            <Label>对话节奏</Label>
            <Select value={v.speed} onValueChange={(x) => setV({ ...v, speed: x })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="slow">慢（深思熟虑）</SelectItem>
                <SelectItem value="medium">中（自然）</SelectItem>
                <SelectItem value="fast">快（简短直接）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <div className="flex items-center gap-3 justify-end mt-6">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/characters" })}>
            取消
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "创建角色" : "保存修改"}
          </Button>
        </div>
      </form>
    </div>
  );
}
