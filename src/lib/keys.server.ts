export const KEY_NAMES = [
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "META_APP_ID",
  "META_APP_SECRET",
  "PEXELS_API_KEY",
  "YOUTUBE_API_KEY",
  "JAMENDO_CLIENT_ID",
] as const;
export type KeyName = (typeof KEY_NAMES)[number];

/** User-saved key (from the API Keys page) wins; falls back to a project-level secret. */
export async function getKey(name: KeyName, userId: string | null | undefined): Promise<string | undefined> {
  if (userId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_api_keys")
      .select("value")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();
    if (data?.value) return data.value;
  }
  return process.env[name] || undefined;
}
