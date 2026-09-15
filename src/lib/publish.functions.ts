import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PostRow = {
  id: string;
  video_id: string;
  platform: "youtube" | "facebook" | "instagram";
  remote_id: string | null;
  permalink: string | null;
  status: "queued" | "publishing" | "published" | "failed";
  error: string | null;
  attempts: number;
  published_at: string | null;
  created_at: string;
};

export type SocialAccountRow = {
  id: string;
  platform: "youtube" | "facebook" | "instagram";
  external_id: string | null;
  handle: string | null;
  expires_at: string | null;
  status: "connected" | "expired" | "disconnected";
};

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("posts")
      .select("id, video_id, platform, remote_id, permalink, status, error, attempts, published_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as PostRow[];
  });

export const listSocialAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("social_accounts")
      .select("id, platform, external_id, handle, expires_at, status");
    if (error) throw new Error(error.message);
    return (data ?? []) as SocialAccountRow[];
  });

export const disconnectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ platform: z.enum(["youtube", "facebook", "instagram"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("social_accounts").delete().eq("platform", data.platform);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        videoId: z.string().uuid(),
        platforms: z.array(z.enum(["youtube", "facebook", "instagram"])).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { publishVideoForUser } = await import("./publish-core.server");
    return publishVideoForUser(context.supabase, context.userId, data.videoId, data.platforms);
  });
