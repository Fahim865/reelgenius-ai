import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type VideoState =
  | "draft"
  | "rendered"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "publishing"
  | "published"
  | "failed";

export type SceneJson = {
  id: string;
  caption: string;
  keywords: string;
  seconds: number;
  clipUrl: string | null;
  clipPreview: string | null;
  credit: string | null;
};

export type VideoRow = {
  id: string;
  title: string;
  topic: string | null;
  script: string | null;
  scenes: SceneJson[];
  music_url: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  trend_id: string | null;
  state: VideoState;
  created_at: string;
  updated_at: string;
};

export const bootstrapAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.rpc("ensure_user_bootstrap");
    const { data } = await context.supabase
      .from("agent_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

export const listVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as VideoRow[];
  });

export const saveVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        topic: z.string().max(300).optional(),
        script: z.string().max(8000).optional(),
        scenes: z.array(z.record(z.string(), z.unknown())).optional(),
        musicUrl: z.string().url().optional(),
        durationSeconds: z.number().int().min(1).max(600).optional(),
        trendId: z.string().uuid().optional(),
        state: z
          .enum(["draft", "rendered", "pending_approval", "approved", "rejected", "publishing", "published", "failed"])
          .optional(),
        storagePath: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      title: data.title,
      topic: data.topic ?? null,
      script: data.script ?? null,
      ...(data.scenes ? { scenes: data.scenes as unknown as never } : {}),
      music_url: data.musicUrl ?? null,
      duration_seconds: data.durationSeconds ?? null,
      trend_id: data.trendId ?? null,
      ...(data.state ? { state: data.state } : {}),
      ...(data.storagePath ? { storage_path: data.storagePath } : {}),
      updated_at: new Date().toISOString(),
    };

    const query = data.id
      ? context.supabase.from("videos").update(payload).eq("id", data.id).select("*").single()
      : context.supabase.from("videos").insert(payload).select("*").single();

    const { data: row, error } = await query;
    if (error) throw new Error(error.message);
    return row as unknown as VideoRow;
  });

/** Signed upload target for the rendered MP4, scoped to the user's own folder. */
export const createUploadTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ videoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const path = `${context.userId}/${data.videoId}.mp4`;
    const { data: signed, error } = await context.supabase.storage.from("reels").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const confirmUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ videoId: z.string().uuid(), path: z.string().min(3).max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: settings } = await context.supabase
      .from("agent_settings")
      .select("mode, kill_switch")
      .eq("user_id", context.userId)
      .maybeSingle();

    const nextState: VideoState = settings?.kill_switch
      ? "rendered"
      : settings?.mode === "auto"
        ? "approved"
        : "pending_approval";

    const { data: row, error } = await context.supabase
      .from("videos")
      .update({ storage_path: data.path, state: nextState, updated_at: new Date().toISOString() })
      .eq("id", data.videoId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as VideoRow;
  });

export const getPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(3).max(400) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage.from("reels").createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

/* ---------- approval queue ---------- */

export const listApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("videos")
      .select("*")
      .in("state", ["pending_approval", "rejected", "rendered"])
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as VideoRow[];
  });

export const submitForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ videoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("videos")
      .update({ state: "pending_approval", updated_at: new Date().toISOString() })
      .eq("id", data.videoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        videoId: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "changes_requested"]),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const nextState: VideoState =
      data.decision === "approved" ? "approved" : data.decision === "rejected" ? "rejected" : "draft";

    const { error: videoError } = await context.supabase
      .from("videos")
      .update({ state: nextState, updated_at: new Date().toISOString() })
      .eq("id", data.videoId);
    if (videoError) throw new Error(videoError.message);

    const { error } = await context.supabase.from("approvals").insert({
      user_id: context.userId,
      video_id: data.videoId,
      decision: data.decision,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);

    return { state: nextState };
  });
