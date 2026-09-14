import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clipLength, formatTime, useEditorStore, type SubtitlePosition } from "@/lib/editor-store";

function NumberField({
  label,
  value,
  step = 0.1,
  min = 0,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={Number(value.toFixed(2))}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isNaN(next)) onChange(next);
        }}
      />
    </div>
  );
}

export function PropertiesPanel() {
  const selection = useEditorStore((s) => s.selection);
  const clips = useEditorStore((s) => s.clips);
  const subtitles = useEditorStore((s) => s.subtitles);
  const audioTrack = useEditorStore((s) => s.audioTrack);
  const updateClip = useEditorStore((s) => s.updateClip);
  const updateSubtitle = useEditorStore((s) => s.updateSubtitle);
  const removeSubtitle = useEditorStore((s) => s.removeSubtitle);
  const removeClip = useEditorStore((s) => s.removeClip);
  const updateAudioTrack = useEditorStore((s) => s.updateAudioTrack);

  const clip = selection?.kind === "clip" ? clips.find((c) => c.id === selection.id) : undefined;
  const subtitle =
    selection?.kind === "subtitle" ? subtitles.find((s) => s.id === selection.id) : undefined;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto border-l border-border bg-card/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {clip ? "Clip" : subtitle ? "Subtitle" : "Properties"}
      </h2>

      {clip && (
        <div className="space-y-4">
          <p className="truncate text-sm font-medium text-foreground">{clip.name}</p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Start (s)"
              value={clip.trimStart}
              max={clip.duration}
              onChange={(value) => updateClip(clip.id, { trimStart: value })}
            />
            <NumberField
              label="End (s)"
              value={clip.trimEnd}
              max={clip.duration}
              onChange={(value) => updateClip(clip.id, { trimEnd: value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Using {formatTime(clipLength(clip))} of {formatTime(clip.duration)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => removeClip(clip.id)}
          >
            <Trash2 className="size-4" /> Remove clip
          </Button>
        </div>
      )}

      {subtitle && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Text</Label>
            <Textarea
              value={subtitle.text}
              rows={3}
              onChange={(event) => updateSubtitle(subtitle.id, { text: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Start (s)"
              value={subtitle.start}
              onChange={(value) => updateSubtitle(subtitle.id, { start: value })}
            />
            <NumberField
              label="End (s)"
              value={subtitle.end}
              onChange={(value) => updateSubtitle(subtitle.id, { end: value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Position</Label>
            <Select
              value={subtitle.position}
              onValueChange={(value) =>
                updateSubtitle(subtitle.id, { position: value as SubtitlePosition })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Text size ({subtitle.size}px)</Label>
            <Slider
              value={[subtitle.size]}
              min={18}
              max={120}
              step={2}
              onValueChange={(values) => updateSubtitle(subtitle.id, { size: values[0] ?? 42 })}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => removeSubtitle(subtitle.id)}
          >
            <Trash2 className="size-4" /> Remove subtitle
          </Button>
        </div>
      )}

      {!clip && !subtitle && (
        <p className="text-xs text-muted-foreground">
          Select a clip or subtitle to edit it. Drag the purple edges of a clip to trim it, and the
          bar at its bottom to reorder scenes.
        </p>
      )}

      {audioTrack && (
        <div className="mt-auto space-y-4 rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Audio mixer
          </p>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {audioTrack.name} ({Math.round(audioTrack.volume * 100)}%)
            </Label>
            <Slider
              value={[audioTrack.volume]}
              min={0}
              max={1.5}
              step={0.05}
              onValueChange={(values) => updateAudioTrack({ volume: values[0] ?? 1 })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Original clip sound ({Math.round(audioTrack.clipVolume * 100)}%)
            </Label>
            <Slider
              value={[audioTrack.clipVolume]}
              min={0}
              max={1.5}
              step={0.05}
              onValueChange={(values) => updateAudioTrack({ clipVolume: values[0] ?? 0.3 })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
