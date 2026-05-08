// Voice transcription via Lovable AI Gateway (Gemini multimodal, OpenAI-compatible)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pickFormat(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "mp4";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("flac")) return "flac";
  return "webm";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audio, mime } = await req.json();
    if (!audio || typeof audio !== "string") {
      return new Response(JSON.stringify({ error: "audio (base64) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const audioMime = (typeof mime === "string" && mime) ? mime : "audio/webm";
    const format = pickFormat(audioMime);

    async function callGateway(model: string) {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "你是一个中文语音转写助手。把用户提供的语音原样、准确地转写成中文文字。只输出转写结果文本本身，不要任何解释、引号、前后缀或标注。如果完全听不清，输出空字符串。",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "请把这段语音转写成中文文字。" },
                { type: "input_audio", input_audio: { data: audio, format } },
              ],
            },
          ],
        }),
      });
    }

    let resp = await callGateway("google/gemini-2.5-flash");
    if (!resp.ok && resp.status !== 429 && resp.status !== 402) {
      const t = await resp.text();
      console.error("transcribe primary model failed:", resp.status, t);
      // Fallback to a stronger multimodal model
      resp = await callGateway("google/gemini-2.5-pro");
    }

    if (resp.status === 429 || resp.status === 402) {
      return new Response(JSON.stringify({ error: resp.status === 429 ? "请求过于频繁" : "AI 额度已用完" }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("transcribe gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "转写服务暂时不可用", detail: t.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = (data.choices?.[0]?.message?.content ?? "").toString().trim();
    console.log("transcribe ok, len=", text.length, "format=", format);
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe error:", e);
    return new Response(JSON.stringify({ error: "请求处理失败" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
