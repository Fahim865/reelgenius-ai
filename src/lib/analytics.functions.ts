import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MetricPoint = {
  captured_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  post_id: string;
};

export const listMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("post_metrics")
      .select("post_id, captured_at, views, likes, comments, shares")
      .order("captured_at", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []) as MetricPoint[];
  });

export const getInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("insights")
      .select("summary, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data ?? { summary: "", updated_at: null };
  });

export const refreshMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { refreshMetricsForUser } = await import("./metrics-core.server");
    return refreshMetricsForUser(context.supabase, context.userId);
  });

export const summarizeInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { summarizeInsightsForUser } = await import("./metrics-core.server");
    return summarizeInsightsForUser(context.supabase, context.userId);
  });
