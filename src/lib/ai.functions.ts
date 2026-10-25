import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ScriptInput = z.object({
  brief: z.string().min(3).max(2000),
  niche: z.string().max(200).optional(),
  tone: z.string().max(200).optional(),
  seconds: z.number().min(10).max(180).optional(),
  trendId: z.string().uuid().optional(),
});

const SYSTEM = `You are a viral short-form scriptwriter for 9:16 vertical reels.
Structure every script in four timed beats:
1. HOOK (0-5s): pattern interrupt — bold claim, shocking stat, or curiosity gap. Never start with "Hey guys" or an intro.
2. PROBLEM (~20% of runtime): name the viewer's pain in their own words; raise the stakes.
3. SOLUTION (~55% of runtime): 2-4 fast, concrete steps or reveals; each line opens a new loop so viewers keep watching.
4. CTA (last 3-5s): one clear action, modeled on the competitor CTA styles given (comment a keyword, follow for part 2, save this).
Pacing: max ~12 spoken words per line, a new visual every 2-4 seconds. Write for the ear. No emojis, no markdown, no stage directions.
Return plain text in exactly this shape:
HOOK [0-5s]: <one line>
PROBLEM [Xs-Ys]:
<spoken lines>
SOLUTION [Xs-Ys]:
<spoken lines>
CTA [Xs-Ys]: <one line>
TITLE: <high-CTR title under 60 characters>`;

export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScriptInput.parse(input))
  .handler(async ({ data, context }) => {
    const { callAi } = await import("./ai-core.server");

    let trendContext = "";
    if (data.trendId) {
      const { data: trend } = await context.supabase
        .from("trends")
        .select("topic, angle, rationale, competitors")
        .eq("id", data.trendId)
        .maybeSingle();
      if (trend) {
        trendContext = `\nTrending topic: ${trend.topic}\nWinning angle: ${trend.angle ?? ""}\nWhy it spikes: ${trend.rationale ?? ""}\nCompetitor gap: ${trend.competitors ?? ""}`;
      }
    }

    const { data: insight } = await context.supabase
      .from("insights")
      .select("summary")
      .eq("user_id", context.userId)
      .maybeSingle();
    const learned = insight?.summary
      ? `\nWhat performed best on this account so far (follow these lessons):\n${insight.summary}`
      : "";

    const { data: comps } = await context.supabase
      .from("competitors")
      .select("handle, cta_style, top_reels")
      .limit(5);
    const compContext = comps?.length
      ? `\nTop competitors in this niche (borrow their hook patterns and CTA styles, never copy wording):\n${comps
          .map((c) => {
            const hooks = ((c.top_reels ?? []) as Array<{ hook?: string }>).map((r) => r.hook).filter(Boolean).slice(0, 2).join(" | ");
            return `- ${c.handle}: CTA "${c.cta_style ?? ""}"; hooks: ${hooks}`;
          })
          .join("\n")}`
      : "";

    const text = (
      await callAi([
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Topic: ${data.brief}
Niche: ${data.niche ?? "general"}
Tone: ${data.tone ?? "punchy, friendly, no fluff"}
Target length: ${data.seconds ?? 40} seconds of speech.${trendContext}${compContext}${learned}`,
        },
      ], { userId: context.userId, action: "script" })
    ).trim();

    if (!text) throw new Error("The model returned an empty script. Try rephrasing the brief.");

    const titleMatch = text.match(/^TITLE:\s*(.+)$/m);
    const script = text.replace(/^TITLE:.*$/m, "").trim();

    return { script, title: titleMatch?.[1]?.trim() ?? "" };
  });

export type Scene = {
  id: string;
  caption: string;
  keywords: string;
  seconds: number;
  clipUrl: string | null;
  clipPreview: string | null;
  credit: string | null;
};

const ScenesInput = z.object({
  script: z.string().min(10).max(6000),
  seconds: z.number().min(10).max(180).default(40),
});

export const buildScenes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScenesInput.parse(input))
  .handler(async ({ data, context }) => {
    const { callAiJson } = await import("./ai-core.server");

    const plan = await callAiJson<{
      scenes: Array<{ caption: string; keywords: string; seconds: number }>;
    }>([
      {
        role: "system",
        content:
          "You turn a spoken reel script into a shot list for a 9:16 vertical video. Captions are short on-screen burn-in text (Alex Hormozi style: 3-6 words, punchy, upper impact words). Keywords are 2-4 plain words to search stock footage. Return strict JSON only.",
      },
      {
        role: "user",
        content: `Total runtime: ${data.seconds} seconds. Split into 6-12 scenes whose seconds sum to about the runtime. Follow the beat timings in the script ([Xs-Ys]): the HOOK gets 1-2 quick scenes (2-3s each), PROBLEM and SOLUTION lines get one scene each (2-4s), the CTA gets its own final scene. Never put beat labels in captions.
Script:
${data.script}

Return JSON: {"scenes":[{"caption":"","keywords":"","seconds":0}]}`,
      },
    ], { userId: context.userId, action: "scenes" });

    const scenes = (plan.scenes ?? []).slice(0, 14);
    if (scenes.length === 0) throw new Error("Could not split that script into scenes.");

    const { getKey } = await import("./keys.server");
    const pexelsKey = await getKey("PEXELS_API_KEY", context.userId);
    const out: Scene[] = [];

    for (const [i, s] of scenes.entries()) {
      let clipUrl: string | null = null;
      let clipPreview: string | null = null;
      let credit: string | null = null;

      if (pexelsKey) {
        try {
          const url = new URL("https://api.pexels.com/videos/search");
          url.searchParams.set("query", s.keywords || s.caption);
          url.searchParams.set("orientation", "portrait");
          url.searchParams.set("per_page", "3");
          const res = await fetch(url, { headers: { Authorization: pexelsKey } });
          if (res.ok) {
            const json = (await res.json()) as {
              videos?: Array<{
                image: string;
                user?: { name?: string };
                video_files?: Array<{ link: string; width: number | null; height: number | null }>;
              }>;
            };
            const video = json.videos?.[0];
            const files = (video?.video_files ?? []).filter((f) => f.link);
            const pick =
              files.filter((f) => (f.height ?? 0) >= (f.width ?? 0)).sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0] ??
              files[0];
            if (pick) {
              clipUrl = pick.link;
              clipPreview = video?.image ?? null;
              credit = `Pexels · ${video?.user?.name ?? "Unknown"}`;
            }
          }
        } catch {
          // leave the scene without footage; the studio lets the user pick one
        }
      }

      out.push({
        id: `scene-${i + 1}`,
        caption: String(s.caption ?? "").slice(0, 120),
        keywords: String(s.keywords ?? "").slice(0, 80),
        seconds: Math.max(1, Math.min(15, Math.round(Number(s.seconds) || 4))),
        clipUrl,
        clipPreview,
        credit,
      });
    }

    return { scenes: out, stockConfigured: Boolean(pexelsKey) };
  });
