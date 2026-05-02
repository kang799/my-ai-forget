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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Upload, ExternalLink, Sparkles, Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type CharacterFormValues = {
  id?: string;
  name: string;
  gender: string;
  age_range: string;
  description: string;
  detox_mode: boolean;
  speed: string;
  avatar_url?: string | null;
  partner_avatar_url?: string | null;
  self_nudge_text?: string;
  partner_nudge_text?: string;
};

export function CharacterForm({
  initial,
  mode,
}: {
  initial: CharacterFormValues;
  mode: "create" | "edit";
}) {
  const navigate = useNavigate();
  const [v, setV] = useState<CharacterFormValues>({
    self_nudge_text: "拍了拍 对方",
    partner_nudge_text: "拍了拍 我",
    ...initial,
  });
  const [voice, setVoice] = useState<File | null>(null);
  const [chatlog, setChatlog] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingSelf, setUploadingSelf] = useState(false);
  const [uploadingPartner, setUploadingPartner] = useState(false);

  async function uploadIfAny(file: File | null, userId: string) {
    if (!file) return null;
    const path = `${userId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) throw error;
    return path;
  }

  async function uploadAvatar(file: File, kind: "self" | "partner") {
    const setLoading = kind === "self" ? setUploadingSelf : setUploadingPartner;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("请先登录");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${kind}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (kind === "self") setV((s) => ({ ...s, avatar_url: data.publicUrl }));
      else setV((s) => ({ ...s, partner_avatar_url: data.publicUrl }));
      toast.success("头像已上传");
    } catch (e: any) {
      toast.error(e.message ?? "上传失败");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) return toast.error("请填写角色名称");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("请先登录");

      let voice_url: string | null = null;
      let chatlog_url: string | null = null;
      try {
        voice_url = await uploadIfAny(voice, user.id);
        chatlog_url = await uploadIfAny(chatlog, user.id);
      } catch {
        // optional
      }

      const payload = {
        user_id: user.id,
        name: v.name.trim(),
        gender: v.gender || null,
        age_range: v.age_range || null,
        description: v.description || null,
        detox_mode: v.detox_mode,
        speed: v.speed,
        avatar_url: v.avatar_url || null,
        partner_avatar_url: v.partner_avatar_url || null,
        self_nudge_text: v.self_nudge_text?.trim() || "拍了拍 对方",
        partner_nudge_text: v.partner_nudge_text?.trim() || "拍了拍 我",
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
      <div className="flex items-center gap-2 mb-1">
        <Heart className="size-5 text-brand" fill="currentColor" />
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "create" ? "新建一个 TA" : "编辑这个 TA"}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        慢慢来，把记忆里的 TA 一点点描出来。越细致，重逢越像。
      </p>

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
            <div className="flex items-center justify-between">
              <Label>人物描述</Label>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Sparkles className="size-3 text-brand" />越具体，越像 TA
              </span>
            </div>
            <Textarea
              rows={6}
              value={v.description}
              onChange={(e) => setV({ ...v, description: e.target.value })}
              placeholder={`比如：\n• 28 岁，做设计，喜欢猫和深夜便利店\n• 说话简短，常用"嗯""哦"，很少用感叹号\n• 在意细节，会记得我随口提的事\n• 难过时不会直说，会忽然安静或转移话题`}
            />
            <Accordion type="single" collapsible className="mt-2">
              <AccordionItem value="tips" className="border rounded-lg bg-accent/30 px-3">
                <AccordionTrigger className="text-sm py-2.5 hover:no-underline">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-brand" />
                    不知道怎么写？看看「人物小传 20 问」
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
                  <p>把下面的问题在脑海里逐个回答一遍，再把关键的几条写进描述里。越细节越好，AI 越能复刻 TA 的灵魂。</p>
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-foreground/80">
                    <div>1. TA 的全名和你怎么称呼 TA</div>
                    <div>2. 年龄、星座、职业</div>
                    <div>3. 外貌最让你记得的一个细节</div>
                    <div>4. 说话语速快还是慢</div>
                    <div>5. 常用的口头禅、语气词</div>
                    <div>6. 用不用表情包?用什么风格的</div>
                    <div>7. 打字会不会全小写/不加标点</div>
                    <div>8. 高兴时怎么表达</div>
                    <div>9. 难过时是直说还是回避</div>
                    <div>10. 生气时是冷战还是争吵</div>
                    <div>11. 最在意的事 / 最敏感的话题</div>
                    <div>12. 喜欢的食物、电影、音乐</div>
                    <div>13. 一天里几点最活跃</div>
                    <div>14. 对你最常说的一句话</div>
                    <div>15. 你们怎么认识的</div>
                    <div>16. 共同的回忆里最深的一幕</div>
                    <div>17. TA 的家庭 / 成长背景</div>
                    <div>18. 价值观:在乎钱、自由、还是关系</div>
                    <div>19. 你们之间没说出口的事</div>
                    <div>20. 如果只剩最后一次聊天,你想问 TA 什么</div>
                  </div>
                  <p className="pt-1 border-t">📖 进阶技巧:可以参考<a className="text-brand underline underline-offset-2" href="https://zh.wikipedia.org/wiki/%E4%BA%BA%E7%89%A9%E5%B0%8F%E4%BC%A0" target="_blank" rel="noreferrer">人物小传</a>、《故事》(Robert McKee) 里的"角色三层结构"——外在特征 / 内在性格 / 潜意识欲望。</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* 头像 */}
          <div className="grid sm:grid-cols-2 gap-4">
            <AvatarPicker
              label="我的头像"
              url={v.avatar_url}
              uploading={uploadingSelf}
              onPick={(f) => uploadAvatar(f, "self")}
              onClear={() => setV({ ...v, avatar_url: null })}
              fallback="我"
            />
            <AvatarPicker
              label="对方头像"
              url={v.partner_avatar_url}
              uploading={uploadingPartner}
              onPick={(f) => uploadAvatar(f, "partner")}
              onClear={() => setV({ ...v, partner_avatar_url: null })}
              fallback={v.name.slice(0, 1) || "T"}
            />
          </div>

          {/* 拍一拍提示词 */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>我"拍一拍"对方的提示词</Label>
              <Input
                value={v.self_nudge_text ?? ""}
                onChange={(e) => setV({ ...v, self_nudge_text: e.target.value })}
                placeholder="拍了拍 对方"
              />
              <p className="text-xs text-muted-foreground mt-1">在聊天界面双击对方头像触发。</p>
            </div>
            <div>
              <Label>对方"拍一拍"我的提示词</Label>
              <Input
                value={v.partner_nudge_text ?? ""}
                onChange={(e) => setV({ ...v, partner_nudge_text: e.target.value })}
                placeholder="拍了拍 我"
              />
              <p className="text-xs text-muted-foreground mt-1">在聊天界面双击我的头像触发。</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>上传 TA 的录音（可选）</Label>
              <Input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,audio/aac,audio/ogg,audio/webm,.mp3,.m4a,.wav,.aac,.ogg,.webm"
                onChange={(e) => setVoice(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                支持 <span className="font-medium text-foreground/80">.mp3 / .m4a / .wav / .aac / .ogg / .webm</span>，单文件 ≤ 20MB。
                哪怕只是一段几秒的语音、一段视频里的笑声，都能帮 AI 更贴近 TA 的语气。
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>上传你们的聊天记录（可选）</Label>
              <Input
                type="file"
                accept=".txt,.json,.csv,.html,.md"
                onChange={(e) => setChatlog(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                支持 <span className="font-medium text-foreground/80">.txt / .json / .csv / .html / .md</span>。
                聊天记录越多，TA 的"灵魂"就越清晰。
              </p>
              <div className="rounded-lg bg-accent/40 border border-border/60 p-2.5 text-xs space-y-1.5 mt-1.5">
                <div className="font-medium text-foreground/90">📱 不知道怎么导出微信聊天记录?</div>
                <div className="text-muted-foreground">推荐这些工具,几步就能把记录导成文本:</div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <a href="https://github.com/LC044/WeChatMsg" target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-card border hover:border-brand hover:text-brand transition-colors">
                    留痕 (Windows) <ExternalLink className="size-3" />
                  </a>
                  <a href="https://github.com/git-jiadong/wechatDataBackup" target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-card border hover:border-brand hover:text-brand transition-colors">
                    WechatDataBackup <ExternalLink className="size-3" />
                  </a>
                  <a href="https://github.com/BlueMatthew/WechatExporter" target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-card border hover:border-brand hover:text-brand transition-colors">
                    WechatExporter (Mac) <ExternalLink className="size-3" />
                  </a>
                </div>
                <div className="text-muted-foreground/80 pt-1">
                  导出后选择 <span className="text-foreground/80">TXT / HTML</span> 格式上传即可。所有数据仅用于训练这个角色,不会外泄。
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium text-sm">戒瘾模式（6 个月）</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                开启后角色不会立刻变冷漠，而是在 6 个月内逐步疏远；满 6 个月后将彻底停止回复，帮助你真正放下。
              </div>
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

function AvatarPicker({
  label, url, uploading, onPick, onClear, fallback,
}: {
  label: string;
  url?: string | null;
  uploading: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
  fallback: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3 mt-1">
        <div className="size-14 rounded-md overflow-hidden bg-secondary grid place-items-center text-sm font-medium shrink-0 border">
          {url ? (
            <img src={url} alt={label} className="size-full object-cover" />
          ) : (
            <span className="text-muted-foreground">{fallback}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer rounded-md border px-2.5 py-1.5 hover:bg-secondary transition-colors">
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {url ? "更换" : "上传"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
                e.target.value = "";
              }}
            />
          </label>
          {url && (
            <button type="button" className="text-xs text-muted-foreground hover:text-destructive text-left" onClick={onClear}>
              移除
            </button>
          )}
          <p className="text-[11px] text-muted-foreground/80 leading-tight">支持 .jpg / .png / .webp,≤ 5MB</p>
        </div>
      </div>
    </div>
  );
}
