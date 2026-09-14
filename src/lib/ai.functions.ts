import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ScriptInput = z.object({
  brief: z.string().min(3).max(2000),
  niche: z.string().max(200).optional(),
  tone: z.string().max(200).optional(),
  seconds: z.number().min(10).max(180).optional(),
});

const SYSTEM = `You are a short-form video scriptwriter for 9:16 vertical reels.
Rules:
- The first 5 seconds MUST be a pattern-interrupt hook.
- Fast pacing, short spoken lines (max ~12 words per line).
- Write for the ear, not the page. No stage directions, no emojis, no markdown.
- End with a single clear call to action.
Return plain text in exactly this shape:
HOOK: <one line>
BODY:
<one spoken line per row, 6-12 rows>
CTA: <one line>
TITLE: <high-CTR title under 60 characters>`;

export const generateScript = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ScriptInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Topic: ${data.brief}
Niche: ${data.niche ?? "general"}
Tone: ${data.tone ?? "punchy, friendly, no fluff"}
Target length: ${data.seconds ?? 40} seconds of speech.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Too many requests right now — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits are used up. Add credits in Lovable to keep generating.");
      throw new Error(`Script generation failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("The model returned an empty script. Try rephrasing the brief.");

    const titleMatch = text.match(/^TITLE:\s*(.+)$/m);
    const script = text.replace(/^TITLE:.*$/m, "").trim();

    return { script, title: titleMatch?.[1]?.trim() ?? "" };
  });
