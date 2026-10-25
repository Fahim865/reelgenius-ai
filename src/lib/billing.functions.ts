import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BillingOverview = {
  plan: string;
  status: string;
  periodEnd: string | null;
  hasOwnKey: boolean;
  agentAllowed: boolean;
  agentReason: string;
};

export const getBillingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { canUserRunAgent } = await import("./billing-core.server");
    const gate = await canUserRunAgent(context.userId);

    return {
      plan: (sub?.['plan'] as string) ?? gate.plan,
      status: (sub?.['status'] as string) ?? gate.status,
      periodEnd: (sub?.['current_period_end'] as string | null) ?? null,
      hasOwnKey: gate.hasOwnKey,
      agentAllowed: gate.allowed,
      agentReason: gate.reason,
    } satisfies BillingOverview;
  });

export type AiUsageSummary = {
  month: string;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byAction: Array<{ action: string; calls: number; inputTokens: number; outputTokens: number }>;
};

/** Tracking only — usage never blocks a call. */
export const getAiUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiUsageSummary> => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data, error } = await context.supabase
      .from("ai_usage")
      .select("action, model, input_tokens, output_tokens")
      .gte("created_at", monthStart.toISOString())
      .limit(2000);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const byAction = new Map<string, { calls: number; inputTokens: number; outputTokens: number }>();
    let totalInput = 0;
    let totalOutput = 0;
    for (const row of rows) {
      const action = (row['action'] as string) ?? "other";
      const entry = byAction.get(action) ?? { calls: 0, inputTokens: 0, outputTokens: 0 };
      entry.calls += 1;
      entry.inputTokens += Number(row['input_tokens'] ?? 0);
      entry.outputTokens += Number(row['output_tokens'] ?? 0);
      byAction.set(action, entry);
      totalInput += Number(row['input_tokens'] ?? 0);
      totalOutput += Number(row['output_tokens'] ?? 0);
    }

    return {
      month: monthStart.toISOString().slice(0, 7),
      totalCalls: rows.length,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      byAction: [...byAction.entries()]
        .map(([action, v]) => ({ action, ...v }))
        .sort((a, b) => b.calls - a.calls),
    };
  });
