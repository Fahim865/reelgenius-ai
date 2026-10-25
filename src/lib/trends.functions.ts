import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ScanInput = z.object({
  niche: z.string().min(2).max(200),
  count: z.number().int().min(1).max(8).default(5),
});

export type TrendRow = {
  id: string;
  topic: string;
  angle: string | null;
  rationale: string | null;
  competitors: string | null;
  score: number;
  source: string;
  used_at: string | null;
  created_at: string;
};

export const listTrends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trends")
      .select("*")
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return (data ?? []) as TrendRow[];
  });

export const scanTrends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data, context }) => {
    const { callAiJson } = await import("./ai-core.server");

    const today = new Date().toISOString().slice(0, 10);
    const result = await callAiJson<{
      trends: Array<{
        topic: string;
        angle: string;
        rationale: string;
        competitors: string;
        score: number;
      }>;
    }>([
      {
        role: "system",
        content:
          "You are a short-form video trend researcher. You study what is spiking on YouTube Shorts, Instagram Reels, TikTok, X and tech/news media, and what competing creators in a niche are posting. Return strict JSON only.",
      },
      {
        role: "user",
        content: `Today is ${today}. Niche: "${data.niche}".
Find ${data.count} topics with the highest short-form viral potential right now.
For each: a concrete "topic" (not a category), an "angle" (the specific take that would out-perform competitors), a "rationale" (why it spikes now), "competitors" (what similar creators are already publishing and the gap left open), and "score" 0-100 for viral potential.
Return JSON: {"trends":[{"topic":"","angle":"","rationale":"","competitors":"","score":0}]}`,
      },
    ], { userId: context.userId, action: "trends" });

    const rows = (result.trends ?? []).slice(0, data.count).map((t) => ({
      user_id: context.userId,
      topic: String(t.topic ?? "").slice(0, 300),
      angle: String(t.angle ?? "").slice(0, 600),
      rationale: String(t.rationale ?? "").slice(0, 800),
      competitors: String(t.competitors ?? "").slice(0, 800),
      score: Math.max(0, Math.min(100, Math.round(Number(t.score) || 50))),
      source: "ai-research",
    }));

    if (rows.length === 0) throw new Error("No trends came back. Try again.");

    const { data: inserted, error } = await context.supabase.from("trends").insert(rows).select("*");
    if (error) throw new Error(error.message);
    return inserted as TrendRow[];
  });

export const markTrendUsed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trends")
      .update({ used_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
