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
    const ytKey = process.env['YOUTUBE_API_KEY'];
    if (ytKey) {
      const rows = await scanYouTube(ytKey, data.niche, context.userId);
      if (rows.length) {
        await context.supabase.from("competitors").delete().eq("user_id", context.userId);
        const { error } = await context.supabase.from("competitors").insert(rows);
        if (error) throw new Error(error.message);
        return { count: rows.length, source: "youtube" as const };
      }
    }
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
    return { count: rows.length, source: "ai" as const };
  });

async function yt<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    console.error(`YouTube Data API failed [${res.status}]: ${body}`);
    throw new Error(`YouTube competitor scan failed [${res.status}]. Check the YouTube Data API key.`);
  }
  return (await res.json()) as T;
}

/** Live scan: most-viewed Shorts in the niche from the last 30 days, grouped by channel. */
async function scanYouTube(key: string, niche: string, userId: string) {
  const after = new Date(Date.now() - 30 * 86400_000).toISOString();
  const search = await yt<{ items?: Array<{ id: { videoId?: string }; snippet: { channelId: string; channelTitle: string } }> }>(
    "search",
    { part: "snippet", q: `${niche} #shorts`, type: "video", videoDuration: "short", order: "viewCount", publishedAfter: after, maxResults: "50" },
    key,
  );
  const ids = (search.items ?? []).map((i) => i.id.videoId).filter(Boolean) as string[];
  if (!ids.length) return [];
  const videos = await yt<{ items?: Array<{ id: string; snippet: { title: string; description: string; channelId: string; channelTitle: string }; statistics: { viewCount?: string } }> }>(
    "videos",
    { part: "snippet,statistics", id: ids.join(",") },
    key,
  );
  const byChannel = new Map<string, { handle: string; reels: Array<CompetitorReel & { desc: string }> }>();
  for (const v of videos.items ?? []) {
    const c = byChannel.get(v.snippet.channelId) ?? { handle: v.snippet.channelTitle, reels: [] };
    c.reels.push({ title: v.snippet.title, views: Number(v.statistics.viewCount ?? 0), hook: v.snippet.title, desc: v.snippet.description });
    byChannel.set(v.snippet.channelId, c);
  }
  const top = [...byChannel.entries()]
    .map(([id, c]) => ({ id, ...c, total: c.reels.reduce((s, r) => s + r.views, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const channels = await yt<{ items?: Array<{ id: string; statistics: { subscriberCount?: string } }> }>(
    "channels",
    { part: "statistics", id: top.map((t) => t.id).join(",") },
    key,
  );
  const subs = new Map((channels.items ?? []).map((c) => [c.id, Number(c.statistics.subscriberCount ?? 0)]));

  // Let the AI read the real titles/descriptions to extract structure + CTA style
  let analysis: Record<string, { why: string; cta: string }> = {};
  try {
    const { callAiJson } = await import("./ai-core.server");
    const r = await callAiJson<{ accounts: Array<{ handle: string; why: string; cta: string }> }>([
      { role: "system", content: "You analyse real short-form video data. Return strict JSON only." },
      {
        role: "user",
        content: `For each channel, explain in one sentence why its Shorts win (hook/structure pattern) and quote the call-to-action style its descriptions use.\n${top
          .map((t) => `${t.handle}: ${t.reels.slice(0, 3).map((r) => `"${r.title}" (${r.views} views) desc: ${r.desc.slice(0, 200)}`).join(" | ")}`)
          .join("\n")}\nReturn {"accounts":[{"handle":"","why":"","cta":""}]}`,
      },
    ]);
    analysis = Object.fromEntries((r.accounts ?? []).map((a) => [a.handle, { why: a.why, cta: a.cta }]));
  } catch {
    // analysis is optional; real numbers still save
  }
  const fmt = (n: number) => Intl.NumberFormat("en", { notation: "compact" }).format(n);
  return top.map((t) => ({
    user_id: userId,
    handle: t.handle.slice(0, 80),
    platform: "youtube",
    followers: subs.get(t.id) ? fmt(subs.get(t.id)!) : null,
    why_it_works: analysis[t.handle]?.why ?? `${fmt(t.total)} Shorts views in the last 30 days.`,
    cta_style: analysis[t.handle]?.cta ?? null,
    top_reels: t.reels.sort((a, b) => b.views - a.views).slice(0, 3).map(({ title, views, hook }) => ({ title, views, hook })),
  }));
}
