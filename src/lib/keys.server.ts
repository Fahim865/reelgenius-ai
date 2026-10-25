export const KEY_NAMES = [
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "META_APP_ID",
  "META_APP_SECRET",
  "PEXELS_API_KEY",
  "YOUTUBE_API_KEY",
  "JAMENDO_CLIENT_ID",
  "OPENAI_API_KEY",
  "AI_PROVIDER_API_KEY",
  "AI_PROVIDER_BASE_URL",
  "AI_PROVIDER_MODEL",
] as const;

/** Keys that, when present, let a user run the agent on their own AI budget. */
export const OWN_AI_KEY_NAMES = ["OPENAI_API_KEY", "AI_PROVIDER_API_KEY"] as const;
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
