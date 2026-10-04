import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "business_management",
  "read_insights",
].join(",");

export const getConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ platform: z.enum(["youtube", "meta"]), origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { makeState } = await import("./oauth-state.server");
    const { getKey } = await import("./keys.server");

    if (data.platform === "youtube") {
      const clientId = await getKey("YOUTUBE_CLIENT_ID", context.userId);
      if (!clientId) return { configured: false as const, url: null };
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", `${data.origin}/api/public/oauth/youtube/callback`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", YOUTUBE_SCOPES);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", makeState(context.userId));
      return { configured: true as const, url: url.toString() };
    }

    const appId = await getKey("META_APP_ID", context.userId);
    if (!appId) return { configured: false as const, url: null };
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", `${data.origin}/api/public/oauth/meta/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", META_SCOPES);
    url.searchParams.set("state", makeState(context.userId));
    return { configured: true as const, url: url.toString() };
  });

export const getCredentialStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getKey } = await import("./keys.server");
    const k = (n: Parameters<typeof getKey>[0]) => getKey(n, context.userId).then(Boolean);
    const [yi, ys, mi, ms, px, jm, yd] = await Promise.all([
      k("YOUTUBE_CLIENT_ID"), k("YOUTUBE_CLIENT_SECRET"), k("META_APP_ID"), k("META_APP_SECRET"),
      k("PEXELS_API_KEY"), k("JAMENDO_CLIENT_ID"), k("YOUTUBE_API_KEY"),
    ]);
    return { youtube: yi && ys, meta: mi && ms, pexels: px, music: jm, youtubeData: yd };
  });
