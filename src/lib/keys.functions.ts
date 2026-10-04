import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Names = z.enum([
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "META_APP_ID",
  "META_APP_SECRET",
  "PEXELS_API_KEY",
  "YOUTUBE_API_KEY",
  "JAMENDO_CLIENT_ID",
]);

/** Returns which keys are saved — never the values. */
export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_api_keys").select("name, updated_at");
    if (error) throw new Error(error.message);
    const saved = Object.fromEntries((data ?? []).map((r) => [r.name, r.updated_at]));
    return Names.options.map((name) => ({
      name,
      savedAt: (saved[name] as string | undefined) ?? null,
      projectDefault: Boolean(process.env[name]),
    }));
  });

export const saveApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ name: Names, value: z.string().trim().min(4).max(4000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_api_keys")
      .upsert({ user_id: context.userId, name: data.name, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ name: Names }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_api_keys").delete().eq("name", data.name);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
