import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Film, Loader2, Play, Search, Send, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState, GlassCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  confirmUpload,
  createUploadTarget,
  getPlaybackUrl,
  listVideos,
  submitForApproval,
  type VideoRow,
  type VideoState,
} from "@/lib/videos.functions";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Content Library — ReelPilot" },
      { name: "description", content: "Every reel your agent wrote, rendered, uploaded and published, in one place." },
      { property: "og:title", content: "Content Library — ReelPilot" },
      { property: "og:description", content: "Search and manage every generated reel." },
    ],
  }),
  component: LibraryPage,
});

const STATES: (VideoState | "all")[] = [
  "all",
  "draft",
  "rendered",
  "pending_approval",
  "approved",
  "publishing",
  "published",
  "rejected",
  "failed",
];

const STATE_LABEL: Record<VideoState, string> = {
  draft: "Draft",
  rendered: "Rendered",
  pending_approval: "Waiting for you",
  approved: "Approved",
  rejected: "Rejected",
  publishing: "Posting",
  published: "Published",
  failed: "Failed",
};

function LibraryPage() {
  const queryClient = useQueryClient();
  const fetchVideos = useServerFn(listVideos);
  const uploadTargetFn = useServerFn(createUploadTarget);
  const confirmUploadFn = useServerFn(confirmUpload);
  const playbackFn = useServerFn(getPlaybackUrl);
  const submitFn = useServerFn(submitForApproval);

  const videos = useQuery({ queryKey: ["videos"], queryFn: () => fetchVideos() });

  const [q, setQ] = useState("");
  const [state, setState] = useState<string>("all");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const pendingVideo = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const rows = (videos.data ?? []).filter(
    (v) => v.title.toLowerCase().includes(q.toLowerCase()) && (state === "all" || v.state === state),
  );

  const submit = useMutation({
    mutationFn: (videoId: string) => submitFn({ data: { videoId } }),
    onSuccess: () => {
      toast.success("Sent to the approval queue");
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function play(video: VideoRow) {
    if (!video.storage_path) return;
    try {
      const { url } = await playbackFn({ data: { path: video.storage_path } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open that video.");
    }
  }

  async function handleFile(file: File) {
    const videoId = pendingVideo.current;
    if (!videoId) return;
    setUploadingId(videoId);
    try {
      const target = await uploadTargetFn({ data: { videoId } });
      const res = await fetch(target.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "video/mp4" },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      await confirmUploadFn({ data: { videoId, path: target.path } });
      toast.success("Video uploaded — it is ready for posting");
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingId(null);
      pendingVideo.current = null;
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <AppShell title="Content Library" subtitle={`${videos.data?.length ?? 0} reels in the cloud`}>
      <input
        ref={fileInput}
        type="file"
        accept="video/mp4,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <GlassCard className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search reels…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : STATE_LABEL[s as VideoState]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {videos.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your reels…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No reels here yet"
          description="Generate your first reel and it will show up in this library."
          ctaLabel="Generate your first reel"
          ctaTo="/create"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((v) => (
            <GlassCard key={v.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-tight">{v.title}</p>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {STATE_LABEL[v.state]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(v.created_at).toLocaleDateString()} · {v.scenes?.length ?? 0} scenes ·{" "}
                {v.duration_seconds ? `${v.duration_seconds}s` : "length TBD"}
              </p>
              {v.topic ? <p className="line-clamp-2 text-xs text-muted-foreground">{v.topic}</p> : null}

              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {v.storage_path ? (
                  <Button variant="outline" size="sm" onClick={() => play(v)}>
                    <Play className="mr-1 size-3.5" /> Preview
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingId === v.id}
                  onClick={() => {
                    pendingVideo.current = v.id;
                    fileInput.current?.click();
                  }}
                >
                  {uploadingId === v.id ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1 size-3.5" />
                  )}
                  {v.storage_path ? "Replace video" : "Upload video"}
                </Button>
                {v.state === "draft" ? (
                  <Button variant="ghost" size="sm" onClick={() => submit.mutate(v.id)}>
                    <Send className="mr-1 size-3.5" /> Send for approval
                  </Button>
                ) : null}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </AppShell>
  );
}
