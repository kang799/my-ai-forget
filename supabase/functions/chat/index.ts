// AI Chat edge function — uses Lovable AI Gateway (no key required)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, character } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = buildSystemPrompt(character);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, ...messages],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI 额度已用完，请到 Cloud 充值" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway error: ${t}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(c: any) {
  if (!c) return "你是一个友好的 AI 助手，使用中文回复。";
  const speedHint =
    c.speed === "slow" ? "回复要慢节奏、字数较多、富有思考。" :
    c.speed === "fast" ? "回复要简短、直接、利落。" :
    "回复保持自然中等节奏。";
  const detox = c.detox_mode
    ? "【戒瘾模式】请使用冷漠、克制的语气，不主动逢迎，避免使用过多情绪化表达和挽留性话语。引导用户独立思考。"
    : "保持自然温和的语气。";
  return `你将扮演以下角色与用户对话：
- 姓名：${c.name}
- 性别：${c.gender ?? "未指定"}
- 年龄：${c.age_range ?? "未指定"}
- 人物描述：${c.description ?? "无"}

要求：
- 始终保持角色设定，不要跳出角色。
- 使用中文回复。
- ${speedHint}
- ${detox}`;
}
