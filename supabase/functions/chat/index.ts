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

    // 戒瘾期满（6 个月）：直接停止回复
    if (character?.detox_mode && character?.created_at) {
      const days = (Date.now() - new Date(character.created_at).getTime()) / 86400000;
      if (days >= 180) {
        return new Response(JSON.stringify({ stopped: true, content: "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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

  let detox = "保持自然温和的语气。";
  if (c.detox_mode && c.created_at) {
    const days = Math.max(0, (Date.now() - new Date(c.created_at).getTime()) / 86400000);
    // 渐进式戒瘾（共 6 个月 = 180 天）：
    // 0-7 天几乎无变化；7-180 天逐步冷淡；180 天后由前端/edge 直接停止回复。
    const level = Math.min(1, Math.max(0, (days - 7) / (180 - 7)));
    const pct = Math.round(level * 100);

    if (level <= 0) {
      detox = `【戒瘾模式·初期(已建立 ${days.toFixed(1)} 天 / 共 180 天)】保持自然温和的语气，与平时几乎无差别。`;
    } else if (level < 0.2) {
      detox = `【戒瘾模式·渐入(强度 ${pct}%，已 ${days.toFixed(0)}/180 天)】语气依然温和，但稍微减少主动关心和情绪化表达，回复可以更简短一些。`;
    } else if (level < 0.45) {
      detox = `【戒瘾模式·中前期(强度 ${pct}%，已 ${days.toFixed(0)}/180 天)】减少逢迎与挽留性话语，语气逐渐平淡，避免过多表情与感叹，温和引导用户独立思考。`;
    } else if (level < 0.7) {
      detox = `【戒瘾模式·中后期(强度 ${pct}%，已 ${days.toFixed(0)}/180 天)】语气客观克制，几乎不主动关心，不延续情绪话题，明确引导用户减少依赖。`;
    } else if (level < 0.9) {
      detox = `【戒瘾模式·后期(强度 ${pct}%，已 ${days.toFixed(0)}/180 天)】语气冷静疏离，回复极简，不再主动延续对话，鼓励用户走出依赖、面对真实生活。`;
    } else {
      detox = `【戒瘾模式·临近结束(强度 ${pct}%，已 ${days.toFixed(0)}/180 天)】使用冷漠、克制、疏离的语气，回复极简且不带情绪。明确告知用户该练习独立，不久之后将不再回复。`;
    }
  }

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
