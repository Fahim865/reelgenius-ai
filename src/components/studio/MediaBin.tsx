import { useRef, useState } from "react";
import { Film, Music, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTime, useEditorStore } from "@/lib/editor-store";

async function probeDuration(src: string) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.onloadedmetadata = () => {
      const value = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      resolve(value);
      video.removeAttribute("src");
    };
    video.onerror = () => reject(new Error("Could not read that video."));
    video.src = src;
  });
}

export function MediaBin() {
  const clips = useEditorStore((s) => s.clips);
  const addClip = useEditorStore((s) => s.addClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);
  const audioTrack = useEditorStore((s) => s.audioTrack);
  const setAudioTrack = useEditorStore((s) => s.setAudioTrack);

  const videoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const objectUrl = URL.createObjectURL(file);
      try {
        const duration = await probeDuration(objectUrl);
        if (!duration) throw new Error("no duration");
        addClip({ name: file.name, url: objectUrl, file, duration });
      } catch {
        URL.revokeObjectURL(objectUrl);
        toast.error(`${file.name} could not be read as a video.`);
      }
    }
    setBusy(false);
  };

  const addFromUrl = async () => {
    const value = url.trim();
    if (!value) return;
    setBusy(true);
    try {
      const duration = await probeDuration(value);
      if (!duration) throw new Error("no duration");
      addClip({ name: value.split("/").pop() || "clip.mp4", url: value, duration });
      setUrl("");
    } catch {
      toast.error("That link could not be loaded. It may block other sites from using it.");
    }
    setBusy(false);
  };

  return (
    <div className="flex h-full flex-col gap-4 border-r border-border bg-card/40 p-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Media
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Videos stay on your device.</p>
      </div>

      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(event) => {
          void addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={audioInput}
        type="file"
        accept="audio/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setAudioTrack({ name: file.name, url: URL.createObjectURL(file), file });
          event.target.value = "";
        }}
      />

      <Button onClick={() => videoInput.current?.click()} disabled={busy} className="w-full">
        <Upload className="size-4" /> Add video clips
      </Button>

      <div className="flex gap-2">
        <Input
          value={url}
          placeholder="Paste a video link"
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void addFromUrl();
          }}
        />
        <Button
          variant="secondary"
          size="icon"
          onClick={() => void addFromUrl()}
          disabled={busy}
          aria-label="Add from link"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <ScrollArea className="-mx-1 flex-1 px-1">
        <ul className="space-y-2">
          {clips.map((clip, index) => {
            const active = selection?.kind === "clip" && selection.id === clip.id;
            return (
              <li key={clip.id}>
                <button
                  type="button"
                  onClick={() => select({ kind: "clip", id: clip.id })}
                  className={`group flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/40 hover:bg-secondary"
                  }`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Film className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {index + 1}. {clip.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatTime(clip.trimEnd - clip.trimStart)} of {formatTime(clip.duration)}
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${clip.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeClip(clip.id);
                    }}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </span>
                </button>
              </li>
            );
          })}
          {clips.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No clips yet. Add a few to start building your timeline.
            </li>
          )}
        </ul>
      </ScrollArea>

      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Music className="size-3.5" /> Audio track
        </div>
        {audioTrack ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {audioTrack.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAudioTrack(null)}
              aria-label="Remove audio track"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
            onClick={() => audioInput.current?.click()}
          >
            Add voiceover or music
          </Button>
        )}
      </div>
    </div>
  );
}
