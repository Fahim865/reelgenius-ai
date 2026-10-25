import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PromptTemplateRow = {
  id: string;
  user_id: string | null;
  name: string;
  body: string;
  niche: string | null;
  is_builtin: boolean;
  created_at: string;
};

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prompt_templates")
      .select("*")
      .order("is_builtin", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PromptTemplateRow[];
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        body: z.string().min(10).max(4000),
        niche: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("prompt_templates")
      .insert({ user_id: context.userId, name: data.name, body: data.body, niche: data.niche ?? null })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as PromptTemplateRow;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("prompt_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** The AI brain designs fresh prompt templates for the user's niche. */
export const suggestTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ niche: z.string().min(2).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { callAiJson } = await import("./ai-core.server");
    const result = await callAiJson<{ templates: Array<{ name: string; body: string }> }>(
      [
        {
          role: "system",
          content:
            "You design viral prompt templates for short-form 9:16 reel scripts. A template is a reusable brief containing placeholders like {topic}, {keyword} or {trend}, plus concrete structure instructions (5-second hook, problem, solution, CTA). Return strict JSON only.",
        },
        {
          role: "user",
          content: `Niche: "${data.niche}". Design 3 prompt templates that would reliably produce viral reels in this niche. Each body: 2-4 sentences, concrete structure with placeholders. Return JSON: {"templates":[{"name":"","body":""}]}`,
        },
      ],
      { userId: context.userId, action: "template-suggest" },
    );
    return (result.templates ?? [])
      .slice(0, 3)
      .map((t) => ({ name: String(t.name ?? "").slice(0, 120), body: String(t.body ?? "").slice(0, 4000) }))
      .filter((t) => t.name && t.body);
  });
