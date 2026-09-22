import { createFileRoute } from "@tanstack/react-router";

/** Scheduled agent run: scans trends and drafts the next reel for every active user.
 * Protected by LOVABLE_CRON_SECRET; exits immediately when the kill switch is on. */
export const Route = createFileRoute("/api/public/hooks/agent-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['LOVABLE_CRON_SECRET'];
        const provided = request.headers.get("x-cron-secret");
        if (!secret || provided !== secret) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { callAiJson, callAi } = await import("@/lib/ai-core.server");
        const { publishVideoForUser } = await import("@/lib/publish-core.server");

        const { data: users } = await supabaseAdmin
          .from("agent_settings")
          .select("*")
          .eq("active", true)
          .eq("kill_switch", false);

        const report: Array<{ user: string; action: string }> = [];

        for (const settings of users ?? []) {
          const userId = settings.user_id as string;
          try {
            // 1. Research a fresh trend.
            const research = await callAiJson<{ trends: Array<{ topic: string; angle: string; rationale: string; competitors: string; score: number }> }>([
              {
                role: "system",
                content: "You research spiking short-form video topics. Return strict JSON only.",
              },
              {
                role: "user",
                content: `Niche: "${settings.niche}". Find the single best topic to post about in the next hour.
Return JSON: {"trends":[{"topic":"","angle":"","rationale":"","competitors":"","score":0}]}`,
              },
            ]);

            const best = research.trends?.[0];
            if (!best) {
              report.push({ user: userId, action: "no-trend" });
              continue;
            }

            const { data: trend } = await supabaseAdmin
              .from("trends")
              .insert({
                user_id: userId,
                topic: best.topic,
                angle: best.angle,
                rationale: best.rationale,
                competitors: best.competitors,
                score: Math.max(0, Math.min(100, Math.round(Number(best.score) || 60))),
                source: "agent-tick",
              })
              .select("id")
              .single();

            // 2. Write the script, informed by what has performed well.
            const { data: insight } = await supabaseAdmin
              .from("insights")
              .select("summary")
              .eq("user_id", userId)
              .maybeSingle();

            const script = await callAi([
              {
                role: "system",
                content:
                  "You write 9:16 reel scripts. First 5 seconds must be a pattern-interrupt hook. Short spoken lines. Plain text as HOOK:/BODY:/CTA:/TITLE:.",
              },
              {
                role: "user",
                content: `Topic: ${best.topic}\nAngle: ${best.angle}\nNiche: ${settings.niche}\nTone: ${settings.tone}\nLength: ${settings.video_length}s${insight?.summary ? `\nLessons from past posts:\n${insight.summary}` : ""}`,
              },
            ]);

            const title = script.match(/^TITLE:\s*(.+)$/m)?.[1]?.trim() ?? best.topic.slice(0, 60);

            await supabaseAdmin.from("videos").insert({
              user_id: userId,
              title,
              topic: best.topic,
              script: script.replace(/^TITLE:.*$/m, "").trim(),
              trend_id: trend?.id ?? null,
              duration_seconds: settings.video_length,
              state: "draft",
            });

            report.push({ user: userId, action: `drafted: ${title}` });

            // 3. Publish anything already approved and rendered.
            const { data: ready } = await supabaseAdmin
              .from("videos")
              .select("id")
              .eq("user_id", userId)
              .eq("state", "approved")
              .not("storage_path", "is", null)
              .limit(3);

            for (const video of ready ?? []) {
              await publishVideoForUser(supabaseAdmin, userId, video.id as string);
              report.push({ user: userId, action: `published ${video.id}` });
            }
          } catch (error) {
            report.push({ user: userId, action: `error: ${error instanceof Error ? error.message : "unknown"}` });
          }
        }

        return Response.json({ ok: true, report });
      },
    },
  },
});
