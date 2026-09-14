import type { AudioTrack, Clip, Subtitle } from "./editor-store";

/**
 * Browser-only FFmpeg pipeline. Everything here must be reached through a
 * dynamic import from an event handler — never at module scope in a route.
 */

import wasmAsset from "@/assets/ffmpeg-core.wasm.asset.json";

const CORE_URL = "/ffmpeg/ffmpeg-core.js";

type FFmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;

let ffmpegPromise: Promise<FFmpegInstance> | null = null;

async function getFFmpeg(): Promise<FFmpegInstance> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        // The worker is a module worker, so the ESM core is imported from a
        // blob URL (a bundler-safe URL the dev server does not try to resolve).
        coreURL: await toBlobURL(CORE_URL, "text/javascript"),
        wasmURL: new URL(wasmAsset.url, window.location.origin).href,
      });
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
}

const pad = (n: number, size = 2) => String(Math.floor(n)).padStart(size, "0");

function assTime(seconds: number) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${h}:${pad(m)}:${pad(sec)}.${pad(cs)}`;
}

const alignmentFor = (position: Subtitle["position"]) =>
  position === "top" ? 8 : position === "center" ? 5 : 2;

export function buildAssFile(subtitles: Subtitle[]) {
  const styles = new Map<string, string>();
  const events: string[] = [];

  for (const sub of subtitles) {
    const align = alignmentFor(sub.position);
    const size = Math.round(sub.size);
    const name = `S${size}A${align}`;
    if (!styles.has(name)) {
      styles.set(
        name,
        `Style: ${name},Arial,${size},&H00FFFFFF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,1.5,${align},80,80,70,1`,
      );
    }
    const text = sub.text.replace(/\r?\n/g, "\\N").replace(/[{}]/g, "");
    events.push(`Dialogue: 0,${assTime(sub.start)},${assTime(sub.end)},${name},,0,0,0,,${text}`);
  }

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...styles.values(),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    "",
  ].join("\n");
}

export type ExportProgress = {
  stage: "loading" | "trimming" | "concat" | "audio" | "subtitles";
  progress: number;
  message: string;
};

export type ExportInput = {
  clips: Clip[];
  subtitles: Subtitle[];
  audioTrack: AudioTrack | null;
  onProgress: (progress: ExportProgress) => void;
};

const SCALE_FILTER =
  "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p";

export async function exportVideo({
  clips,
  subtitles,
  audioTrack,
  onProgress,
}: ExportInput): Promise<{ url: string; warnings: string[] }> {
  if (clips.length === 0) throw new Error("Add at least one clip before exporting.");

  const warnings: string[] = [];
  onProgress({ stage: "loading", progress: 2, message: "Loading the video engine" });

  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  let stageProgress = 0;
  const listener = ({ progress }: { progress: number }) => {
    stageProgress = Math.min(1, Math.max(0, progress));
    onProgress(currentStage(stageProgress));
  };

  let stage: ExportProgress["stage"] = "trimming";
  let stageIndex = 0;
  const currentStage = (fraction: number): ExportProgress => {
    const total = clips.length + 2 + (audioTrack ? 1 : 0);
    const done = stageIndex + fraction;
    return {
      stage,
      progress: Math.min(98, 5 + (done / Math.max(1, total)) * 93),
      message:
        stage === "trimming"
          ? `Preparing clip ${Math.min(stageIndex + 1, clips.length)} of ${clips.length}`
          : stage === "concat"
            ? "Stitching the timeline"
            : stage === "audio"
              ? "Mixing audio"
              : "Burning subtitles",
    };
  };
  ffmpeg.on("progress", listener);

  const written: string[] = [];
  const cleanup = async () => {
    ffmpeg.off("progress", listener);
    for (const name of written) {
      await ffmpeg.deleteFile(name).catch(() => {});
    }
  };

  try {
    const parts: string[] = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]!;
      stage = "trimming";
      stageIndex = i;
      onProgress(currentStage(0));

      const ext = (clip.name.includes(".") ? clip.name.split(".").pop() : "mp4") ?? "mp4";
      const input = `in_${i}.${ext}`;
      const output = `part_${i}.mp4`;
      await ffmpeg.writeFile(input, await fetchFile(clip.file ?? clip.url));
      written.push(input);

      const duration = Math.max(0.1, clip.trimEnd - clip.trimStart);
      const base = ["-ss", clip.trimStart.toFixed(3), "-t", duration.toFixed(3), "-i", input];
      const encode = [
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-video_track_timescale",
        "30000",
        output,
      ];

      let code = await ffmpeg.exec([
        ...base,
        "-vf",
        SCALE_FILTER,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        ...encode,
      ]);

      if (code !== 0) {
        // Clip has no audio track: pair it with generated silence so the
        // segments stay concat-compatible.
        code = await ffmpeg.exec([
          ...base,
          "-f",
          "lavfi",
          "-t",
          duration.toFixed(3),
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=48000",
          "-vf",
          SCALE_FILTER,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-shortest",
          ...encode,
        ]);
      }

      if (code !== 0) throw new Error(`Could not process "${clip.name}".`);
      written.push(output);
      parts.push(output);
    }

    stage = "concat";
    stageIndex = clips.length;
    onProgress(currentStage(0));

    let current = parts[0]!;
    if (parts.length > 1) {
      const list = parts.map((name) => `file '${name}'`).join("\n");
      await ffmpeg.writeFile("list.txt", new TextEncoder().encode(list));
      written.push("list.txt");
      const code = await ffmpeg.exec([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "list.txt",
        "-c",
        "copy",
        "concat.mp4",
      ]);
      if (code !== 0) throw new Error("Could not stitch the clips together.");
      written.push("concat.mp4");
      current = "concat.mp4";
    }

    if (audioTrack) {
      stage = "audio";
      stageIndex = clips.length + 1;
      onProgress(currentStage(0));

      const ext =
        (audioTrack.name.includes(".") ? audioTrack.name.split(".").pop() : "mp3") ?? "mp3";
      const trackFile = `track.${ext}`;
      await ffmpeg.writeFile(trackFile, await fetchFile(audioTrack.file ?? audioTrack.url));
      written.push(trackFile);

      const code = await ffmpeg.exec([
        "-i",
        current,
        "-i",
        trackFile,
        "-filter_complex",
        `[0:a]volume=${audioTrack.clipVolume.toFixed(2)}[a0];[1:a]volume=${audioTrack.volume.toFixed(2)}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[a]`,
        "-map",
        "0:v:0",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "mixed.mp4",
      ]);
      if (code === 0) {
        written.push("mixed.mp4");
        current = "mixed.mp4";
      } else {
        warnings.push(
          "The extra audio track could not be mixed in, so the export keeps the original clip sound.",
        );
      }
    }

    if (subtitles.length > 0) {
      stage = "subtitles";
      stageIndex = clips.length + 1 + (audioTrack ? 1 : 0);
      onProgress(currentStage(0));

      await ffmpeg.writeFile("subs.ass", new TextEncoder().encode(buildAssFile(subtitles)));
      written.push("subs.ass");
      const code = await ffmpeg.exec([
        "-i",
        current,
        "-vf",
        "ass=subs.ass",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-c:a",
        "copy",
        "subbed.mp4",
      ]);
      if (code === 0) {
        written.push("subbed.mp4");
        current = "subbed.mp4";
      } else {
        warnings.push(
          "Subtitles could not be burned into the file, but they still show in the preview.",
        );
      }
    }

    const data = (await ffmpeg.readFile(current)) as Uint8Array;
    const blob = new Blob([data.slice().buffer as ArrayBuffer], { type: "video/mp4" });
    onProgress({ stage: "subtitles", progress: 100, message: "Finished" });
    return { url: URL.createObjectURL(blob), warnings };
  } finally {
    await cleanup();
  }
}
