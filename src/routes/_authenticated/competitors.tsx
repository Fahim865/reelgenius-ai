import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Swords } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState, GlassCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCompetitors, scanCompetitors } from "@/lib/competitors.functions";
import { getAgentSettings } from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/competitors")({
  head: () => ({
    meta: [
      { title: "Competitors — ReelPilot" },
      { name: "description", content: "Top accounts in your niche and how their best reels compare to yours." },
      { property: "og:title", content: "Competitors — ReelPilot" },
      { property: "og:description", content: "Learn from the most-watched reels in your niche." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompetitorsPage,
});

const fmt = (n: number) => Intl.NumberFormat("en", { notation: "compact" }).format(n);

function CompetitorsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCompetitors);
  const runScan = useServerFn(scanCompetitors);
  const fetchSettings = useServerFn(getAgentSettings);
  const [niche, setNiche] = useState("");
  const settings = useQuery({ queryKey: ["agent-settings"], queryFn: () => fetchSettings() });
  const list = useQuery({ queryKey: ["competitors"], queryFn: () => fetchList() });

  const scan = useMutation({
    mutationFn: () => runScan({ data: { niche: niche.trim() || settings.data?.niche || "technology" } }),
    onSuccess: () => {
      toast.success("Competitors updated — the script writer will learn from them");
      qc.invalidateQueries({ queryKey: ["competitors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const competitors = list.data?.competitors ?? [];
  const mine = list.data?.mine ?? [];
  const theirBest = competitors.flatMap((c) => c.top_reels.map((r) => ({ ...r, handle: c.handle })))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  return (
    <AppShell
      title="Competitors"
      subtitle="Who is winning your niche, and what the agent borrows from them"
      actions={
        <div className="flex gap-2">
          <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder={settings.data?.niche ?? "Your niche"} className="w-44" />
          <Button className="gradient-accent text-primary-foreground" onClick={() => scan.mutate()} disabled={scan.isPending}>
            <RefreshCw className={`mr-2 size-4 ${scan.isPending ? "animate-spin" : ""}`} />
            {scan.isPending ? "Researching…" : "Find competitors"}
          </Button>
        </div>
      }
    >
      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : competitors.length === 0 ? (
        <EmptyState icon={Swords} title="No competitors yet" description="Let the agent find the top accounts in your niche." ctaLabel="Find competitors" onCta={() => scan.mutate()} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <h3 className="mb-3 font-semibold">Their most-watched reels</h3>
              <ul className="space-y-2 text-sm">
                {theirBest.map((r, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate">{r.title} <span className="text-muted-foreground">· {r.handle}</span></span>
                    <span className="font-mono">{fmt(r.views)}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard>
              <h3 className="mb-3 font-semibold">Your most-watched reels</h3>
              {mine.length === 0 ? (
                <p className="text-sm text-muted-foreground">No posted reels with stats yet. Once a reel posts, its numbers appear here for comparison.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {mine.map((r, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">{r.title} <span className="text-muted-foreground">· {r.platform}</span></span>
                      <span className="font-mono">{fmt(r.views)} views · {fmt(r.likes)} likes · {fmt(r.shares)} shares</span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {competitors.map((c) => (
              <GlassCard key={c.id}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{c.handle}</h3>
                  <div className="flex gap-2"><Badge variant="secondary">{c.platform}</Badge>{c.followers && <Badge>{c.followers}</Badge>}</div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.why_it_works}</p>
                {c.cta_style && <p className="mt-2 text-sm"><span className="font-medium">CTA style:</span> {c.cta_style}</p>}
                <ul className="mt-3 space-y-1 text-sm">
                  {c.top_reels.map((r, i) => (
                    <li key={i}>
                      <span className="font-mono text-muted-foreground">{fmt(r.views)}</span> {r.title}
                      {r.hook && <div className="text-xs text-muted-foreground">Hook: “{r.hook}”</div>}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
