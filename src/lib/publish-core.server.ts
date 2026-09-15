import type { SupabaseClient } from "@supabase/supabase-js";
import { publishToYouTube } from "./publishers/youtube.server";
import { publishToFacebook, publishToInstagram } from "./publishers/meta.server";
import type { PublishResult } from "./publishers/types.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type Platform = "youtube" | "facebook" | "instagram";

const MAX_ATTEMPTS = 3;

export async function publishVideoForUser(
  db: Db,
  userId: string,
  videoId: string,
  platforms?: Platform[],
) {
  const { data: settings } = await db
    .from("agent_settings")
    .select("kill_switch, platforms")
    .eq("user_id", userId)
    .maybeSingle();

  if (settings?.kill_switch) throw new Error("The kill switch is on — publishing is frozen.");

  const { data: video, error: videoError } = await db
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .eq("user_id", userId)
    .single();
  if (videoError || !video) throw new Error("That reel no longer exists.");
  if (!video.storage_path) throw new Error("This reel has not been rendered and uploaded yet.");
  if (video.state !== "approved" && video.state !== "publishing" && video.state !== "failed") {
    throw new Error("Only approved reels can be published.");
  }

  const { data: signed, error: signedError } = await db.storage
    .from("reels")
    .createSignedUrl(video.storage_path, 60 * 60 * 3);
  if (signedError || !signed?.signedUrl) throw new Error("Could not prepare the video file for upload.");

  const targets: Platform[] =
    platforms && platforms.length > 0
      ? platforms
      : ((settings?.platforms ?? ["youtube", "facebook", "instagram"]) as Platform[]);

  const { data: accounts } = await db
    .from("social_accounts")
    .select("*")
    .eq("user_id", userId)
    .in("platform", targets);

  await db.from("videos").update({ state: "publishing", updated_at: new Date().toISOString() }).eq("id", videoId);

  const results: Array<{ platform: Platform; ok: boolean; message: string }> = [];

  for (const platform of targets) {
    const account = (accounts ?? []).find((a: { platform: string }) => a.platform === platform);

    const { data: existing } = await db
      .from("posts")
      .select("*")
      .eq("video_id", videoId)
      .eq("platform", platform)
      .maybeSingle();

    if (existing?.status === "published") {
      results.push({ platform, ok: true, message: "Already published." });
      continue;
    }

    const postId =
      existing?.id ??
      (
        await db
          .from("posts")
          .insert({ user_id: userId, video_id: videoId, platform, status: "queued" })
          .select("id")
          .single()
      ).data?.id;

    if (!account || account.status !== "connected" || !account.access_token) {
      await db
        .from("posts")
        .update({ status: "failed", error: `No connected ${platform} account.`, attempts: (existing?.attempts ?? 0) + 1 })
        .eq("id", postId);
      results.push({ platform, ok: false, message: `No connected ${platform} account.` });
      continue;
    }

    if ((existing?.attempts ?? 0) >= MAX_ATTEMPTS) {
      results.push({ platform, ok: false, message: `${platform} failed ${MAX_ATTEMPTS} times — reconnect and retry.` });
      continue;
    }

    await db.from("posts").update({ status: "publishing" }).eq("id", postId);

    try {
      const payload = {
        fileUrl: signed.signedUrl,
        title: video.title as string,
        description: (video.script as string | null)?.slice(0, 900) ?? "",
        accessToken: account.access_token as string,
        externalId: (account.external_id as string | null) ?? null,
      };

      let result: PublishResult;
      if (platform === "youtube") result = await publishToYouTube(payload);
      else if (platform === "facebook") result = await publishToFacebook(payload);
      else result = await publishToInstagram(payload);

      await db
        .from("posts")
        .update({
          status: "published",
          remote_id: result.remoteId,
          permalink: result.permalink,
          error: null,
          published_at: new Date().toISOString(),
          attempts: (existing?.attempts ?? 0) + 1,
        })
        .eq("id", postId);

      results.push({ platform, ok: true, message: "Published." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown publishing error.";
      await db
        .from("posts")
        .update({ status: "failed", error: message, attempts: (existing?.attempts ?? 0) + 1 })
        .eq("id", postId);
      results.push({ platform, ok: false, message });
    }
  }

  const anySuccess = results.some((r) => r.ok);
  await db
    .from("videos")
    .update({ state: anySuccess ? "published" : "failed", updated_at: new Date().toISOString() })
    .eq("id", videoId);

  return results;
}
