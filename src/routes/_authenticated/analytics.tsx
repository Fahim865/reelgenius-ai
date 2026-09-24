import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Brain, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { EmptyState, GlassCard, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { getInsights, listMetrics, refreshMetrics, summarizeInsights } from "@/lib/analytics.functions";
import { listPosts } from "@/lib/publish.functions";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Reel Analytics — ReelPilot" },
      { name: "description", content: "Views, likes, comments and shares for every published reel, feeding the next script." },
      { property: "og:title", content: "Reel Analytics — ReelPilot" },
      { property: "og:description", content: "See what performed and let the agent learn from it automatically." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const queryClient = useQueryClient();
  const fetchMetrics = useServerFn(listMetrics);
  const fetchInsights = useServerFn(getInsights);
  const fetchPosts = useServerFn(listPosts);
  const refresh = useServerFn(refreshMetrics);
  const summarize = useServerFn(summarizeInsights);

  const metrics = useQuery({ queryKey: ["metrics"], queryFn: () => fetchMetrics() });
  const insights = useQuery({ queryKey: ["insights"], queryFn: () => fetchInsights() });
  const posts = useQuery({ queryKey: ["posts"], queryFn: () => fetchPosts() });

  const refreshAll = useMutation({
    mutationFn: async () => {
      const result = await refresh();
      await summarize();
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Pulled ${result.captured} fresh snapshot${result.captured === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const { series, totals } = useMemo(() => {
    const byDay = new Map<string, { day: string; views: number; likes: number; comments: number; shares: number }>();
    const latestPerPost = new Map<string, { views: number; likes: number; comments: number; shares: number }>();

    for (const point of metrics.data ?? []) {
      const day = new Date(point.captured_at).toISOString().slice(0, 10);
      const row = byDay.get(day) ?? { day, views: 0, likes: 0, comments: 0, shares: 0 };
      row.views += point.views;
      row.likes += point.likes;
      row.comments += point.comments;
      row.shares += point.shares;
      byDay.set(day, row);
      latestPerPost.set(point.post_id, point);
    }

    const totalsAcc = { views: 0, likes: 0, comments: 0, shares: 0 };
    for (const value of latestPerPost.values()) {
      totalsAcc.views += value.views;
      totalsAcc.likes += value.likes;
      totalsAcc.comments += value.comments;
      totalsAcc.shares += value.shares;
    }

    return { series: Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day)), totals: totalsAcc };
  }, [metrics.data]);

  const published = (posts.data ?? []).filter((p) => p.status === "published");

  return (
    <AppShell
      title="Analytics"
      subtitle="What worked, and what the agent learned from it"
      actions={
        <Button className="gradient-accent text-primary-foreground" onClick={() => refreshAll.mutate()} disabled={refreshAll.isPending}>
          <RefreshCw className={`mr-2 size-4 ${refreshAll.isPending ? "animate-spin" : ""}`} />
          {refreshAll.isPending ? "Refreshing…" : "Refresh stats"}
        </Button>
      }
    >
      {published.length === 0 && series.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No published reels yet"
          description="Once a reel goes live, its views, likes, comments and shares land here and shape the next script."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Views", value: totals.views },
              { label: "Likes", value: totals.likes },
              { label: "Comments", value: totals.comments },
              { label: "Shares", value: totals.shares },
            ].map((stat) => (
              <GlassCard key={stat.label}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                <p className="mt-2 font-display text-3xl font-semibold">{stat.value.toLocaleString()}</p>
              </GlassCard>
            ))}
          </div>

          <GlassCard>
            <SectionTitle title="Performance over time" />
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="views" stroke="var(--color-primary)" fill="url(#views)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionTitle title="What the agent learned" />
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {insights.data?.summary?.trim()
                ? insights.data.summary
                : "No lessons yet — refresh your stats once a few reels have been live for a while."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={refreshAll.isPending}
              onClick={() => refreshAll.mutate()}
            >
              <Brain className="mr-2 size-4" /> Re-learn from latest numbers
            </Button>
          </GlassCard>

          <GlassCard>
            <SectionTitle title="Published reels" />
            <div className="mt-4 space-y-2">
              {published.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing published yet.</p>
              ) : (
                published.map((post) => (
                  <div
                    key={post.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm"
                  >
                    <span className="font-medium capitalize">{post.platform}</span>
                    <span className="text-xs text-muted-foreground">
                      {post.published_at ? new Date(post.published_at).toLocaleString() : "—"}
                    </span>
                    {post.permalink ? (
                      <a className="text-xs text-primary underline" href={post.permalink} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </AppShell>
  );
}
