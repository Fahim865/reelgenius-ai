/** Server-side billing/entitlement helpers. Never imported from the client. */
import { OWN_AI_KEY_NAMES } from "./keys.server";

export type AgentGate = {
  allowed: boolean;
  reason: string;
  plan: string;
  status: string;
  hasOwnKey: boolean;
};

export async function hasOwnAiKey(userId: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("user_api_keys").select("name").eq("user_id", userId);
    if (data?.some((row) => (OWN_AI_KEY_NAMES as readonly string[]).includes(row['name'] as string))) return true;
  } catch {
    // fall through to project-level keys
  }
  const { getKey } = await import("./keys.server");
  for (const name of OWN_AI_KEY_NAMES) {
    if (await getKey(name, userId)) return true;
  }
  return false;
}

/** The agent runs on a paid plan, or free when the user brings their own AI key. */
export async function canUserRunAgent(userId: string): Promise<AgentGate> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  const plan = (sub?.['plan'] as string) ?? "free";
  const status = (sub?.['status'] as string) ?? "active";
  const periodEnd = sub?.['current_period_end'] as string | null;
  const periodOk = !periodEnd || new Date(periodEnd) > new Date();
  const subscriptionActive = plan === "pro" && status === "active" && periodOk;
  const hasOwnKey = await hasOwnAiKey(userId);

  if (subscriptionActive) {
    return { allowed: true, reason: "Active Pro plan", plan, status, hasOwnKey };
  }
  if (hasOwnKey) {
    return { allowed: true, reason: "Running on your own AI key", plan, status, hasOwnKey };
  }
  return {
    allowed: false,
    reason: "Turn on the Pro plan or add your own AI key before running the agent.",
    plan,
    status,
    hasOwnKey,
  };
}
