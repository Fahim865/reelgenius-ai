const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class AiGatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ProviderRoute = { url: string; key: string; model: string; label: string };

/** When a user saved their own AI provider key, calls route through it (any
 * OpenAI-compatible endpoint) instead of the built-in gateway. */
async function resolveOwnProvider(userId: string, model?: string): Promise<ProviderRoute | null> {
  try {
    const { getKey } = await import("./keys.server");
    const openai = await getKey("OPENAI_API_KEY", userId);
    if (openai) {
      return {
        url: "https://api.openai.com/v1/chat/completions",
        key: openai,
        model: model ?? (await getKey("AI_PROVIDER_MODEL", userId)) ?? "gpt-4o-mini",
        label: "own OpenAI key",
      };
    }
    const custom = await getKey("AI_PROVIDER_API_KEY", userId);
    if (custom) {
      const base = (await getKey("AI_PROVIDER_BASE_URL", userId))?.replace(/\/+$/, "");
      if (base) {
        return {
          url: `${base}/chat/completions`,
          key: custom,
          model: model ?? (await getKey("AI_PROVIDER_MODEL", userId)) ?? "gpt-4o-mini",
          label: "own provider key",
        };
      }
    }
  } catch {
    // fall through to the built-in gateway
  }
  return null;
}

type Usage = { prompt_tokens?: number; completion_tokens?: number } | undefined;

/** Best-effort usage tracking. Never breaks the AI call itself. */
async function logUsage(userId: string, action: string, model: string, usage: Usage) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      action,
      model,
      input_tokens: Math.max(0, Math.round(usage?.prompt_tokens ?? 0)),
      output_tokens: Math.max(0, Math.round(usage?.completion_tokens ?? 0)),
    });
  } catch (error) {
    console.error("[ai-usage] failed to log usage", error);
  }
}

export async function callAi(
  messages: ChatMessage[],
  opts?: { json?: boolean; model?: string; userId?: string; action?: string },
) {
  const gatewayKey = process.env['LOVABLE_API_KEY'];
  let url = GATEWAY;
  let key = gatewayKey;
  let model = opts?.model ?? MODEL;
  let routeLabel = "built-in AI";

  if (opts?.userId) {
    const own = await resolveOwnProvider(opts.userId, opts.model);
    if (own) {
      url = own.url;
      key = own.key;
      model = own.model;
      routeLabel = own.label;
    }
  }

  if (!key) throw new AiGatewayError(401, "AI is not configured for this project.");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (url === GATEWAY) {
    headers['Lovable-API-Key'] = key;
    headers['X-Lovable-AIG-SDK'] = "fetch";
  } else {
    headers['Authorization'] = `Bearer ${key}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 402) throw new AiGatewayError(402, "AI credits are exhausted. Add credits in Lovable to keep the agent running.");
    if (res.status === 429) throw new AiGatewayError(429, "AI is rate limited right now. Try again in a moment.");
    throw new AiGatewayError(res.status, `AI request failed [${res.status}]: ${body}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: Usage;
  };

  if (opts?.userId) {
    await logUsage(opts.userId, opts.action ?? "other", `${routeLabel}: ${model}`, data.usage);
  }

  return data.choices?.[0]?.message?.content ?? "";
}

export async function callAiJson<T>(
  messages: ChatMessage[],
  opts?: { model?: string; userId?: string; action?: string },
): Promise<T> {
  const raw = await callAi(messages, { json: true, ...opts });
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("The AI returned an unreadable answer. Try again.");
  }
}
