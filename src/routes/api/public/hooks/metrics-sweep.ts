import { createFileRoute } from "@tanstack/react-router";

/** Scheduled metrics pull + insight refresh for every active account. */
export const Route = createFileRoute("/api/public/hooks/metrics-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['LOVABLE_CRON_SECRET'];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { refreshMetricsForUser, summarizeInsightsForUser } = await import("@/lib/metrics-core.server");

        const { data: users } = await supabaseAdmin.from("agent_settings").select("user_id").eq("active", true);

        const report: Array<{ user: string; captured: number }> = [];
        for (const row of users ?? []) {
          const userId = row.user_id as string;
          try {
            const { captured } = await refreshMetricsForUser(supabaseAdmin, userId);
            if (captured > 0) await summarizeInsightsForUser(supabaseAdmin, userId);
            report.push({ user: userId, captured });
          } catch {
            report.push({ user: userId, captured: 0 });
          }
        }

        return Response.json({ ok: true, report });
      },
    },
  },
});
