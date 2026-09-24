import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ShieldCheck, Upload, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState, GlassCard, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideApproval, listApprovals } from "@/lib/videos.functions";
import { publishVideo } from "@/lib/publish.functions";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Queue — ReelPilot" },
      { name: "description", content: "Review every AI-generated script and rendered reel before it publishes." },
      { property: "og:title", content: "Approval Queue — ReelPilot" },
      { property: "og:description", content: "Approve, request changes or reject each reel before it goes live." },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const queryClient = useQueryClient();
  const fetchQueue = useServerFn(listApprovals);
  const decide = useServerFn(decideApproval);
  const publish = useServerFn(publishVideo);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queue = useQuery({ queryKey: ["approvals"], queryFn: () => fetchQueue() });

  const decision = useMutation({
    mutationFn: (input: { videoId: string; decision: "approved" | "rejected" | "changes_requested" }) =>
      decide({ data: { ...input, note: notes[input.videoId] ?? "" } }),
    onSuccess: () => {
      toast.success("Decision saved");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const push = useMutation({
    mutationFn: (videoId: string) => publish({ data: { videoId } }),
    onSuccess: (result) => {
      const failed = result.filter((r) => !r.ok);
      if (failed.length === 0) toast.success("Published everywhere");
      else toast.warning(`Some platforms failed: ${failed.map((f) => `${f.platform}: ${f.message}`).join(" · ")}`);
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Approvals" subtitle="Nothing goes live until you say so">
      {queue.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading queue…</p>
      ) : (queue.data ?? []).length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Queue is clear"
          description="When the agent finishes a reel it will wait for you right here."
        />
      ) : (
        <div className="space-y-4">
          {(queue.data ?? []).map((video) => (
            <GlassCard key={video.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{video.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {video.topic ?? "No topic"} · updated {new Date(video.updated_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={video.state} />
              </div>

              {video.script ? (
                <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                  {video.script}
                </pre>
              ) : null}

              <Textarea
                className="mt-4"
                rows={2}
                placeholder="Optional note for the agent (what to change, what you liked)"
                value={notes[video.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [video.id]: e.target.value }))}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gradient-accent text-primary-foreground"
                  disabled={decision.isPending}
                  onClick={() => decision.mutate({ videoId: video.id, decision: "approved" })}
                >
                  <CheckCircle2 className="mr-2 size-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decision.isPending}
                  onClick={() => decision.mutate({ videoId: video.id, decision: "changes_requested" })}
                >
                  Request changes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={decision.isPending}
                  onClick={() => decision.mutate({ videoId: video.id, decision: "rejected" })}
                >
                  <XCircle className="mr-2 size-4 text-destructive" /> Reject
                </Button>
                {video.storage_path ? (
                  <Button size="sm" variant="secondary" disabled={push.isPending} onClick={() => push.mutate(video.id)}>
                    <Upload className="mr-2 size-4" /> Publish now
                  </Button>
                ) : (
                  <span className="self-center text-xs text-muted-foreground">Render and upload it in the studio first</span>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </AppShell>
  );
}
