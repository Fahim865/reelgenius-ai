import { create } from "zustand";

export type Clip = {
  id: string;
  name: string;
  url: string;
  file?: File;
  duration: number;
  trimStart: number;
  trimEnd: number;
};

export type SubtitlePosition = "top" | "center" | "bottom";

export type Subtitle = {
  id: string;
  text: string;
  start: number;
  end: number;
  position: SubtitlePosition;
  size: number;
};

export type AudioTrack = {
  name: string;
  url: string;
  file?: File;
  volume: number;
  clipVolume: number;
};

export type ExportStage =
  "idle" | "loading" | "trimming" | "concat" | "audio" | "subtitles" | "done" | "error";

export type ExportState = {
  stage: ExportStage;
  progress: number;
  message: string;
  outputUrl: string | null;
};

export type Selection = { kind: "clip" | "subtitle"; id: string } | null;

type EditorState = {
  clips: Clip[];
  subtitles: Subtitle[];
  audioTrack: AudioTrack | null;
  selection: Selection;
  exportState: ExportState;

  addClip: (clip: Omit<Clip, "id" | "trimStart" | "trimEnd">) => void;
  removeClip: (id: string) => void;
  updateClip: (id: string, patch: Partial<Pick<Clip, "trimStart" | "trimEnd" | "name">>) => void;
  reorderClips: (fromId: string, toId: string) => void;

  addSubtitle: (start: number) => void;
  updateSubtitle: (id: string, patch: Partial<Omit<Subtitle, "id">>) => void;
  removeSubtitle: (id: string) => void;

  setAudioTrack: (track: Omit<AudioTrack, "volume" | "clipVolume"> | null) => void;
  updateAudioTrack: (patch: Partial<Pick<AudioTrack, "volume" | "clipVolume">>) => void;

  select: (selection: Selection) => void;
  setExportState: (patch: Partial<ExportState>) => void;
  resetExport: () => void;
};

const newId = () => Math.random().toString(36).slice(2, 10);

export const clipLength = (clip: Clip) => Math.max(0, clip.trimEnd - clip.trimStart);

export const totalDuration = (clips: Clip[]) =>
  clips.reduce((sum, clip) => sum + clipLength(clip), 0);

export const useEditorStore = create<EditorState>((set) => ({
  clips: [],
  subtitles: [],
  audioTrack: null,
  selection: null,
  exportState: { stage: "idle", progress: 0, message: "", outputUrl: null },

  addClip: (clip) =>
    set((state) => ({
      clips: [...state.clips, { ...clip, id: newId(), trimStart: 0, trimEnd: clip.duration }],
    })),

  removeClip: (id) =>
    set((state) => {
      const clip = state.clips.find((c) => c.id === id);
      if (clip?.file && clip.url.startsWith("blob:")) URL.revokeObjectURL(clip.url);
      return {
        clips: state.clips.filter((c) => c.id !== id),
        selection: state.selection?.id === id ? null : state.selection,
      };
    }),

  updateClip: (id, patch) =>
    set((state) => ({
      clips: state.clips.map((clip) => {
        if (clip.id !== id) return clip;
        const next = { ...clip, ...patch };
        next.trimStart = Math.min(Math.max(0, next.trimStart), clip.duration);
        next.trimEnd = Math.min(Math.max(next.trimStart + 0.1, next.trimEnd), clip.duration);
        return next;
      }),
    })),

  reorderClips: (fromId, toId) =>
    set((state) => {
      const from = state.clips.findIndex((c) => c.id === fromId);
      const to = state.clips.findIndex((c) => c.id === toId);
      if (from === -1 || to === -1 || from === to) return state;
      const clips = [...state.clips];
      const moved = clips.splice(from, 1)[0]!;
      clips.splice(to, 0, moved);
      return { clips };
    }),

  addSubtitle: (start) => {
    const id = newId();
    const end = Math.max(start + 2, 2);
    set((state) => ({
      subtitles: (
        [
          ...state.subtitles,
          { id, text: "New subtitle", start, end, position: "bottom", size: 42 },
        ] as Subtitle[]
      ).sort((a, b) => a.start - b.start),
      selection: { kind: "subtitle", id },
    }));
  },

  updateSubtitle: (id, patch) =>
    set((state) => ({
      subtitles: state.subtitles
        .map((sub) => {
          if (sub.id !== id) return sub;
          const next = { ...sub, ...patch };
          next.start = Math.max(0, next.start);
          next.end = Math.max(next.start + 0.2, next.end);
          return next;
        })
        .sort((a, b) => a.start - b.start),
    })),

  removeSubtitle: (id) =>
    set((state) => ({
      subtitles: state.subtitles.filter((sub) => sub.id !== id),
      selection: state.selection?.id === id ? null : state.selection,
    })),

  setAudioTrack: (track) =>
    set((state) => {
      if (state.audioTrack?.file && state.audioTrack.url.startsWith("blob:")) {
        URL.revokeObjectURL(state.audioTrack.url);
      }
      return { audioTrack: track ? { ...track, volume: 1, clipVolume: 0.3 } : null };
    }),

  updateAudioTrack: (patch) =>
    set((state) => ({ audioTrack: state.audioTrack ? { ...state.audioTrack, ...patch } : null })),

  select: (selection) => set({ selection }),

  setExportState: (patch) => set((state) => ({ exportState: { ...state.exportState, ...patch } })),

  resetExport: () =>
    set((state) => {
      if (state.exportState.outputUrl) URL.revokeObjectURL(state.exportState.outputUrl);
      return { exportState: { stage: "idle", progress: 0, message: "", outputUrl: null } };
    }),
}));

export function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
