import { Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { totalDuration, useEditorStore } from "@/lib/editor-store";

export function ExportBar() {
  const clips = useEditorStore((s) => s.clips);
  const subtitles = useEditorStore((s) => s.subtitles);
  const audioTrack = useEditorStore((s) => s.audioTrack);
  const exportState = useEditorStore((s) => s.exportState);
  const setExportState = useEditorStore((s) => s.setExportState);
  const resetExport = useEditorStore((s) => s.resetExport);

  const busy = !["idle", "done", "error"].includes(exportState.stage);

  const runExport = async () => {
    if (clips.length === 0) {
      toast.error("Add at least one clip first.");
      return;
    }
    resetExport();
    setExportState({ stage: "loading", progress: 2, message: "Loading the video engine" });

    try {
      const { exportVideo } = await import("@/lib/video-export");
      const { url, warnings } = await exportVideo({
        clips,
        subtitles,
        audioTrack,
        onProgress: ({ stage, progress, message }) => setExportState({ stage, progress, message }),
      });
      setExportState({
        stage: "done",
        progress: 100,
        message: "Your video is ready",
        outputUrl: url,
      });
      warnings.forEach((warning) => toast.warning(warning));
      toast.success("Export finished — download it below.");
    } catch (error) {
      console.error(error);
      setExportState({
        stage: "error",
        progress: 0,
        message: error instanceof Error ? error.message : "Export failed.",
      });
      toast.error(error instanceof Error ? error.message : "Export failed.");
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-border bg-card/60 px-4 py-3">
      <div className="mr-auto">
        <h1 className="text-base font-semibold tracking-tight text-foreground">AutoVid Studio</h1>
        <p className="text-xs text-muted-foreground">
          {clips.length} {clips.length === 1 ? "scene" : "scenes"} ·{" "}
          {totalDuration(clips).toFixed(1)}s · everything renders in your browser
        </p>
      </div>

      {busy && (
        <div className="w-64">
          <Progress value={exportState.progress} className="h-2" />
          <p className="mt-1 text-xs text-muted-foreground">{exportState.message}</p>
        </div>
      )}

      {exportState.outputUrl && (
        <Button asChild variant="secondary">
          <a href={exportState.outputUrl} download="autovid-export.mp4">
            <Download className="size-4" /> Download MP4
          </a>
        </Button>
      )}

      <Button onClick={() => void runExport()} disabled={busy || clips.length === 0}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {busy ? "Rendering…" : "Export video"}
      </Button>
    </header>
  );
}
