import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

const GRAPH = "https://graph.facebook.com/v21.0";

type Snapshot = { views: number; likes: number; comments: number; shares: number };

async function youtubeStats(remoteId: string, token: string): Promise<Snapshot | null> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(remoteId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    items?: Array<{ statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }>;
  };
  const stats = json.items?.[0]?.statistics;
  if (!stats) return null;
  return {
    views: Number(stats.viewCount ?? 0),
    likes: Number(stats.likeCount ?? 0),
    comments: Number(stats.commentCount ?? 0),
    shares: 0,
  };
}

async function facebookStats(remoteId: string, token: string): Promise<Snapshot | null> {
  const res = await fetch(
    `${GRAPH}/${remoteId}?fields=views,likes.summary(true),comments.summary(true)&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    views?: number;
    likes?: { summary?: { total_count?: number } };
    comments?: { summary?: { total_count?: number } };
  };
  return {
    views: Number(json.views ?? 0),
    likes: Number(json.likes?.summary?.total_count ?? 0),
    comments: Number(json.comments?.summary?.total_count ?? 0),
    shares: 0,
  };
}

async function instagramStats(remoteId: string, token: string): Promise<Snapshot | null> {
  const res = await fetch(
    `${GRAPH}/${remoteId}/insights?metric=plays,likes,comments,shares&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
  };
  const pick = (name: string) => Number(json.data?.find((d) => d.name === name)?.values?.[0]?.value ?? 0);
  return { views: pick("plays"), likes: pick("likes"), comments: pick("comments"), shares: pick("shares") };
}

export async function refreshMetricsForUser(db: Db, userId: string) {
  const { data: posts } = await db
    .from("posts")
    .select("id, platform, remote_id")
    .eq("user_id", userId)
    .eq("status", "published")
    .not("remote_id", "is", null);

  const { data: accounts } = await db.from("social_accounts").select("platform, access_token").eq("user_id", userId);

  let captured = 0;
  for (const post of posts ?? []) {
    const account = (accounts ?? []).find((a: { platform: string }) => a.platform === post.platform);
    if (!account?.access_token) continue;

    let snap: Snapshot | null = null;
    try {
      if (post.platform === "youtube") snap = await youtubeStats(post.remote_id, account.access_token);
      else if (post.platform === "facebook") snap = await facebookStats(post.remote_id, account.access_token);
      else snap = await instagramStats(post.remote_id, account.access_token);
    } catch {
      snap = null;
    }
    if (!snap) continue;

    await db.from("post_metrics").insert({ user_id: userId, post_id: post.id, ...snap });
    captured += 1;
  }

  return { captured };
}

export async function summarizeInsightsForUser(db: Db, userId: string) {
  const { callAi } = await import("./ai-core.server");

  const { data: rows } = await db
    .from("posts")
    .select("platform, video_id, videos(title, script), post_metrics(views, likes, comments, shares, captured_at)")
    .eq("user_id", userId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(25);

  if (!rows || rows.length === 0) return { summary: "" };

  const lines = rows
    .map((r: Record<string, unknown>) => {
      const video = r['videos'] as { title?: string; script?: string } | null;
      const metrics = (r['post_metrics'] as Array<Snapshot> | null) ?? [];
      const latest = metrics[metrics.length - 1];
      const hook = (video?.script ?? "").split("\n")[0]?.slice(0, 120) ?? "";
      return `${r['platform']} | "${video?.title ?? "untitled"}" | hook: ${hook} | views ${latest?.views ?? 0}, likes ${latest?.likes ?? 0}, comments ${latest?.comments ?? 0}, shares ${latest?.shares ?? 0}`;
    })
    .join("\n");

  const summary = await callAi([
    {
      role: "system",
      content:
        "You analyse short-form video performance and write a compact coaching brief that another AI will use when writing the next script. Be concrete about hook styles, topics, pacing and CTAs. Max 180 words, bullet points.",
    },
    { role: "user", content: `Recent posts and their numbers:\n${lines}\n\nWrite: what worked, what flopped, and 4 rules for the next script.` },
  ]);

  await db
    .from("insights")
    .upsert({ user_id: userId, summary: summary.trim(), updated_at: new Date().toISOString() });

  return { summary: summary.trim() };
}
