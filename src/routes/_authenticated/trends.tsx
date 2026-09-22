import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radar, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState, GlassCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listTrends, scanTrends } from "@/lib/trends.functions";
import { getAgentSettings } from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/trends")({
  head: () => ({
    meta: [
      { title: "Trend Radar — ReelPilot" },
      { name: "description", content: "Live AI research on what is spiking in your niche, scored for viral potential." },
      { property: "og:title", content: "Trend Radar — ReelPilot" },
      { property: "og:description", content: "Scan trending topics and turn the best one into your next reel." },
    ],
  }),
  component: TrendsPage,
});

function TrendsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchTrends = useServerFn(listTrends);
  const fetchSettings = useServerFn(getAgentSettings);
  const runScan = useServerFn(scanTrends);
  const [niche, setNiche] = useState("");

  const settings = useQuery({ queryKey: ["agent-settings"], queryFn: () => fetchSettings() });
  const trends = useQuery({ queryKey: ["trends"], queryFn: () => fetchTrends() });

  const scan = useMutation({
    mutationFn: () => runScan({ data: { niche: niche.trim() || settings.data?.niche || "technology", count: 5 } }),
    onSuccess: () => {
      toast.success("Fresh trends in");
      queryClient.invalidateQueries({ queryKey: ["trends"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Trend radar"
      subtitle="What the agent thinks is about to pop"
      actions={
        <div className="flex gap-2">
          <Input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder={settings.data?.niche ?? "Your niche"}
            className="w-44"
          />
          <Button className="gradient-accent text-primary-foreground" onClick={() => scan.mutate()} disabled={scan.isPending}>
            <RefreshCw className={`mr-2 size-4 ${scan.isPending ? "animate-spin" : ""}`} />
            {scan.isPending ? "Scanning…" : "Scan now"}
          </Button>
        </div>
      }
    >
      {trends.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading trends…</p>
      ) : (trends.data ?? []).length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No trends scanned yet"
          description="Run a scan and the agent will research what is spiking in your niche right now."
          ctaLabel="Scan now"
          onCta={() => scan.mutate()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(trends.data ?? []).map((trend) => (
            <GlassCard key={trend.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-semibold">{trend.topic}</p>
                  {trend.angle ? <p className="mt-1 text-sm text-muted-foreground">{trend.angle}</p> : null}
                </div>
                <Badge className="shrink-0 gap-1" variant={trend.score >= 75 ? "default" : "secondary"}>
                  <TrendingUp className="size-3" /> {trend.score}
                </Badge>
              </div>

              {trend.rationale ? <p className="mt-4 text-sm text-muted-foreground">{trend.rationale}</p> : null}
              {trend.competitors ? (
                <p className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Gap: </span>
                  {trend.competitors}
                </p>
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {trend.used_at ? "Already used" : new Date(trend.created_at).toLocaleString()}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ to: "/create", search: { trendId: trend.id } })}
                >
                  <Sparkles className="mr-2 size-4" /> Write the reel
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </AppShell>
  );
}
