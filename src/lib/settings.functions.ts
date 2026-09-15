import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AgentSettingsRow = {
  user_id: string;
  niche: string;
  tone: string;
  language: string;
  video_length: number;
  frequency: number;
  time_slots: string[];
  platforms: string[];
  mode: "auto" | "review";
  kill_switch: boolean;
  active: boolean;
  updated_at: string;
};

export const getAgentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.rpc("ensure_user_bootstrap");
    const { data, error } = await context.supabase
      .from("agent_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as AgentSettingsRow | null;
  });

export const saveAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        niche: z.string().max(200).optional(),
        tone: z.string().max(200).optional(),
        language: z.string().max(60).optional(),
        videoLength: z.number().int().min(10).max(180).optional(),
        frequency: z.number().int().min(0).max(12).optional(),
        timeSlots: z.array(z.string().max(10)).max(12).optional(),
        platforms: z.array(z.enum(["youtube", "facebook", "instagram"])).optional(),
        mode: z.enum(["auto", "review"]).optional(),
        killSwitch: z.boolean().optional(),
        active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.rpc("ensure_user_bootstrap");
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.niche !== undefined) payload['niche'] = data.niche;
    if (data.tone !== undefined) payload['tone'] = data.tone;
    if (data.language !== undefined) payload['language'] = data.language;
    if (data.videoLength !== undefined) payload['video_length'] = data.videoLength;
    if (data.frequency !== undefined) payload['frequency'] = data.frequency;
    if (data.timeSlots !== undefined) payload['time_slots'] = data.timeSlots;
    if (data.platforms !== undefined) payload['platforms'] = data.platforms;
    if (data.mode !== undefined) payload['mode'] = data.mode;
    if (data.killSwitch !== undefined) payload['kill_switch'] = data.killSwitch;
    if (data.active !== undefined) payload['active'] = data.active;

    const { data: row, error } = await context.supabase
      .from("agent_settings")
      .update(payload)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as AgentSettingsRow;
  });
