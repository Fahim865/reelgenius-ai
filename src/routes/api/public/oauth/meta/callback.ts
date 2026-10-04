import { createFileRoute } from "@tanstack/react-router";
import { appOrigin, readState } from "@/lib/oauth-state.server";

const GRAPH = "https://graph.facebook.com/v21.0";

export const Route = createFileRoute("/api/public/oauth/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const origin = appOrigin(request);
        const fail = (reason: string) =>
          Response.redirect(`${origin}/connections?error=${encodeURIComponent(reason)}`, 302);

        if (!code || !state) return fail("Meta did not return an authorization code.");
        const userId = readState(state);
        if (!userId) return fail("This connection link expired. Try again.");

        const { getKey } = await import("@/lib/keys.server");
        const appId = await getKey("META_APP_ID", userId);
        const appSecret = await getKey("META_APP_SECRET", userId);
        if (!appId || !appSecret) return fail("Meta credentials are not set up yet.");

        const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
        tokenUrl.searchParams.set("client_id", appId);
        tokenUrl.searchParams.set("client_secret", appSecret);
        tokenUrl.searchParams.set("redirect_uri", `${origin}/api/public/oauth/meta/callback`);
        tokenUrl.searchParams.set("code", code);
        const tokenRes = await fetch(tokenUrl);
        const token = (await tokenRes.json()) as {
          access_token?: string;
          expires_in?: number;
          error?: { message?: string };
        };
        if (!tokenRes.ok || !token.access_token) return fail(token.error?.message ?? "Meta refused the connection.");

        // Exchange for a long-lived user token (~60 days).
        const longUrl = new URL(`${GRAPH}/oauth/access_token`);
        longUrl.searchParams.set("grant_type", "fb_exchange_token");
        longUrl.searchParams.set("client_id", appId);
        longUrl.searchParams.set("client_secret", appSecret);
        longUrl.searchParams.set("fb_exchange_token", token.access_token);
        const longRes = await fetch(longUrl);
        const longToken = (await longRes.json()) as { access_token?: string; expires_in?: number };
        const userToken = longToken.access_token ?? token.access_token;
        const expiresAt = new Date(Date.now() + (longToken.expires_in ?? token.expires_in ?? 3600) * 1000).toISOString();

        const pagesRes = await fetch(
          `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`,
        );
        const pages = (await pagesRes.json()) as {
          data?: Array<{
            id: string;
            name: string;
            access_token: string;
            instagram_business_account?: { id: string; username?: string };
          }>;
        };
        const page = pages.data?.[0];
        if (!page) return fail("No Facebook Page found on this account. Create or select a Page and try again.");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        await supabaseAdmin.from("social_accounts").upsert(
          {
            user_id: userId,
            platform: "facebook",
            external_id: page.id,
            handle: page.name,
            access_token: page.access_token,
            refresh_token: null,
            expires_at: expiresAt,
            status: "connected",
          },
          { onConflict: "user_id,platform" },
        );

        if (page.instagram_business_account?.id) {
          await supabaseAdmin.from("social_accounts").upsert(
            {
              user_id: userId,
              platform: "instagram",
              external_id: page.instagram_business_account.id,
              handle: page.instagram_business_account.username ?? page.name,
              access_token: page.access_token,
              refresh_token: null,
              expires_at: expiresAt,
              status: "connected",
            },
            { onConflict: "user_id,platform" },
          );
        }

        return Response.redirect(`${origin}/connections?connected=meta`, 302);
      },
    },
  },
});
