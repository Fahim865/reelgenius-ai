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

export async function callAi(messages: ChatMessage[], opts?: { json?: boolean; model?: string }) {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new AiGatewayError(401, "AI is not configured for this project.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: opts?.model ?? MODEL,
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

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function callAiJson<T>(messages: ChatMessage[]): Promise<T> {
  const raw = await callAi(messages, { json: true });
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
