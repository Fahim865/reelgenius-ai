import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { clipLength, formatTime, totalDuration, useEditorStore } from "@/lib/editor-store";

export function PreviewPlayer({
  time,
  playing,
  onTimeChange,
  onPlayingChange,
}: {
  time: number;
  playing: boolean;
  onTimeChange: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const clips = useEditorStore((s) => s.clips);
  const subtitles = useEditorStore((s) => s.subtitles);
  const audioTrack = useEditorStore((s) => s.audioTrack);
  const exportUrl = useEditorStore((s) => s.exportState.outputUrl);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const frame = useRef<number>(0);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const total = useMemo(() => totalDuration(clips), [clips]);

  const offsets = useMemo(() => {
    let acc = 0;
    return clips.map((clip) => {
      const start = acc;
      acc += clipLength(clip);
      return start;
    });
  }, [clips]);

  const activeIndex = useMemo(() => {
    if (clips.length === 0) return -1;
    for (let i = clips.length - 1; i >= 0; i--) {
      if (time >= offsets[i]! - 0.0001) return i;
    }
    return 0;
  }, [clips, offsets, time]);

  const activeClip = activeIndex >= 0 ? clips[activeIndex] : null;

  // Load the right source and seek to the right spot inside it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    const localTime = activeClip.trimStart + (time - offsets[activeIndex]!);
    if (loadedSrc !== activeClip.url) {
      video.src = activeClip.url;
      setLoadedSrc(activeClip.url);
      const seek = () => {
        video.currentTime = Math.max(0, localTime);
        if (playing) void video.play().catch(() => {});
      };
      video.addEventListener("loadedmetadata", seek, { once: true });
      return;
    }
    if (Math.abs(video.currentTime - localTime) > 0.3) {
      video.currentTime = Math.max(0, localTime);
    }
  }, [activeClip, activeIndex, loadedSrc, offsets, playing, time]);

  // Play / pause both media elements.
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;
    if (playing && activeClip) {
      void video.play().catch(() => onPlayingChange(false));
      if (audio) {
        if (Math.abs(audio.currentTime - time) > 0.3) audio.currentTime = time;
        void audio.play().catch(() => {});
      }
    } else {
      video.pause();
      audio?.pause();
    }
  }, [playing, activeClip, onPlayingChange, time]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (video && activeClip) {
      const local = video.currentTime;
      if (local >= activeClip.trimEnd - 0.03) {
        const next = offsets[activeIndex]! + clipLength(activeClip);
        if (activeIndex >= clips.length - 1) {
          onPlayingChange(false);
          onTimeChange(total);
        } else {
          onTimeChange(next + 0.001);
        }
      } else {
        onTimeChange(offsets[activeIndex]! + Math.max(0, local - activeClip.trimStart));
      }
    }
    frame.current = requestAnimationFrame(tick);
  }, [activeClip, activeIndex, clips.length, offsets, onPlayingChange, onTimeChange, total]);

  useEffect(() => {
    if (!playing) return;
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, tick]);

  useEffect(() => {
    if (audioRef.current && audioTrack) audioRef.current.volume = Math.min(1, audioTrack.volume);
    if (videoRef.current) {
      videoRef.current.volume = audioTrack ? Math.min(1, audioTrack.clipVolume) : 1;
    }
  }, [audioTrack]);

  const visibleSubtitles = subtitles.filter((sub) => time >= sub.start && time <= sub.end);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="@container relative flex-1 overflow-hidden rounded-xl border border-border bg-black">
        <video ref={videoRef} playsInline className="size-full object-contain" />
        {!activeClip && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Add a clip to start previewing your video.
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-[4%]">
          {(["top", "center", "bottom"] as const).map((position) => (
            <div
              key={position}
              className={`flex ${position === "center" ? "flex-1 items-center" : ""} justify-center`}
            >
              <div className="space-y-1 text-center">
                {visibleSubtitles
                  .filter((sub) => sub.position === position)
                  .map((sub) => (
                    <p
                      key={sub.id}
                      className="mx-auto max-w-[85%] font-semibold leading-tight text-white [text-shadow:_0_2px_6px_rgb(0_0_0_/_90%)]"
                      style={{ fontSize: `clamp(0.75rem, ${(sub.size / 1080) * 100}cqh, 4rem)` }}
                    >
                      {sub.text}
                    </p>
                  ))}
              </div>
            </div>
          ))}
        </div>
        {audioTrack && <audio ref={audioRef} src={audioTrack.url} preload="auto" hidden />}
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="secondary"
          aria-label="Back to start"
          onClick={() => {
            onPlayingChange(false);
            onTimeChange(0);
          }}
        >
          <SkipBack className="size-4" />
        </Button>
        <Button
          size="icon"
          aria-label={playing ? "Pause" : "Play"}
          disabled={clips.length === 0}
          onClick={() => {
            if (!playing && time >= total - 0.05) onTimeChange(0);
            onPlayingChange(!playing);
          }}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Slider
          value={[Math.min(time, total)]}
          max={Math.max(total, 0.1)}
          step={0.01}
          onValueChange={(values) => {
            onPlayingChange(false);
            onTimeChange(values[0] ?? 0);
          }}
          className="flex-1"
          aria-label="Scrub timeline"
        />
        <span className="w-28 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {formatTime(Math.min(time, total))} / {formatTime(total)}
        </span>
      </div>

      {exportUrl && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Exported video
          </p>
          <video src={exportUrl} controls className="max-h-64 w-full rounded-md bg-black" />
        </div>
      )}
    </div>
  );
}
