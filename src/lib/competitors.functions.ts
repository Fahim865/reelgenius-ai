import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CompetitorReel = { title: string; views: number; hook: string };

export const listCompetitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("competitors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    // My own best reels, by latest view snapshot per post
    const { data: metrics } = await context.supabase
      .from("post_metrics")
      .select("views, likes, shares, captured_at, posts(platform, videos(title))")
      .order("captured_at", { ascending: false })
      .limit(200);
    const seen = new Map<string, { title: string; views: number; likes: number; shares: number; platform: string }>();
    for (const m of metrics ?? []) {
      const post = m.posts as unknown as { platform: string; videos: { title: string } | null } | null;
      const key = `${post?.videos?.title}-${post?.platform}`;
      if (!post || seen.has(key)) continue;
      seen.set(key, {
        title: post.videos?.title ?? "Untitled",
        platform: post.platform,
        views: Number(m.views),
        likes: Number(m.likes),
        shares: Number(m.shares),
      });
    }
    const mine = [...seen.values()].sort((a, b) => b.views - a.views).slice(0, 5);

    return {
      competitors: (data ?? []).map((c) => ({ ...c, top_reels: (c.top_reels ?? []) as unknown as CompetitorReel[] })),
      mine,
    };
  });

export const scanCompetitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ niche: z.string().min(2).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { callAiJson } = await import("./ai-core.server");
    const result = await callAiJson<{
      accounts: Array<{
        handle: string;
        platform: string;
        followers: string;
        why_it_works: string;
        cta_style: string;
        top_reels: CompetitorReel[];
      }>;
    }>([
      {
        role: "system",
        content:
          "You are a short-form video strategist. List real, well-known creator accounts that currently dominate a niche on YouTube Shorts, Instagram Reels or TikTok. Only name accounts you are confident exist. Views are approximate. Return strict JSON only.",
      },
      {
        role: "user",
        content: `Niche: ${data.niche}
Return 5 accounts: {"accounts":[{"handle":"@name","platform":"youtube|instagram|tiktok","followers":"1.2M","why_it_works":"one sentence","cta_style":"their typical call to action, quoted","top_reels":[{"title":"","views":0,"hook":"first line spoken"}]}]} with 3 top_reels each.`,
      },
    ]);

    const rows = (result.accounts ?? []).slice(0, 8).map((a) => ({
      user_id: context.userId,
      handle: String(a.handle).slice(0, 80),
      platform: String(a.platform ?? "youtube").slice(0, 20),
      followers: a.followers ? String(a.followers).slice(0, 20) : null,
      why_it_works: a.why_it_works ?? null,
      cta_style: a.cta_style ?? null,
      top_reels: (a.top_reels ?? []).slice(0, 5).map((r) => ({
        title: String(r.title ?? ""),
        views: Number(r.views) || 0,
        hook: String(r.hook ?? ""),
      })),
    }));
    if (rows.length === 0) throw new Error("No competitor accounts found for that niche. Try a broader niche.");

    await context.supabase.from("competitors").delete().eq("user_id", context.userId);
    const { error } = await context.supabase.from("competitors").insert(rows);
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });
