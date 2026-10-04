import { createFileRoute } from "@tanstack/react-router";
import { appOrigin, readState } from "@/lib/oauth-state.server";

export const Route = createFileRoute("/api/public/oauth/youtube/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const origin = appOrigin(request);
        const fail = (reason: string) =>
          Response.redirect(`${origin}/connections?error=${encodeURIComponent(reason)}`, 302);

        if (!code || !state) return fail("Google did not return an authorization code.");
        const userId = readState(state);
        if (!userId) return fail("This connection link expired. Try again.");

        const { getKey } = await import("@/lib/keys.server");
        const clientId = await getKey("YOUTUBE_CLIENT_ID", userId);
        const clientSecret = await getKey("YOUTUBE_CLIENT_SECRET", userId);
        if (!clientId || !clientSecret) return fail("YouTube credentials are not set up yet.");

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: `${origin}/api/public/oauth/youtube/callback`,
            grant_type: "authorization_code",
          }),
        });
        const token = (await tokenRes.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          error_description?: string;
        };
        if (!tokenRes.ok || !token.access_token) {
          return fail(token.error_description ?? "Google refused the connection.");
        }

        let handle: string | null = null;
        let channelId: string | null = null;
        const channelRes = await fetch(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
          { headers: { Authorization: `Bearer ${token.access_token}` } },
        );
        if (channelRes.ok) {
          const channel = (await channelRes.json()) as {
            items?: Array<{ id?: string; snippet?: { title?: string } }>;
          };
          channelId = channel.items?.[0]?.id ?? null;
          handle = channel.items?.[0]?.snippet?.title ?? null;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("social_accounts").upsert(
          {
            user_id: userId,
            platform: "youtube",
            external_id: channelId,
            handle,
            access_token: token.access_token,
            refresh_token: token.refresh_token ?? null,
            expires_at: token.expires_in
              ? new Date(Date.now() + token.expires_in * 1000).toISOString()
              : null,
            status: "connected",
          },
          { onConflict: "user_id,platform" },
        );

        return Response.redirect(`${origin}/connections?connected=youtube`, 302);
      },
    },
  },
});
