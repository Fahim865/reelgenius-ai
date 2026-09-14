import { useRef } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clipLength,
  formatTime,
  totalDuration,
  useEditorStore,
  type Clip,
} from "@/lib/editor-store";

const PIXELS_PER_SECOND = 46;

function ClipCard({ clip, index }: { clip: Clip; index: number }) {
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);
  const updateClip = useEditorStore((s) => s.updateClip);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clip.id,
  });
  const dragState = useRef<{ edge: "start" | "end"; x: number; value: number } | null>(null);

  const width = Math.max(72, clipLength(clip) * PIXELS_PER_SECOND);
  const active = selection?.kind === "clip" && selection.id === clip.id;

  const onHandleDown = (edge: "start" | "end") => (event: React.PointerEvent) => {
    event.stopPropagation();
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragState.current = {
      edge,
      x: event.clientX,
      value: edge === "start" ? clip.trimStart : clip.trimEnd,
    };
  };

  const onHandleMove = (event: React.PointerEvent) => {
    const state = dragState.current;
    if (!state) return;
    const delta = (event.clientX - state.x) / PIXELS_PER_SECOND;
    const next = state.value + delta;
    updateClip(clip.id, state.edge === "start" ? { trimStart: next } : { trimEnd: next });
  };

  const endDrag = () => {
    dragState.current = null;
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, width }}
      className={`relative shrink-0 overflow-hidden rounded-lg border ${
        active ? "border-primary ring-1 ring-primary" : "border-border"
      } bg-secondary/60 ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      <button
        type="button"
        onClick={() => select({ kind: "clip", id: clip.id })}
        className="flex h-20 w-full flex-col justify-between px-3 py-2 text-left"
      >
        <span className="truncate text-xs font-medium text-foreground">
          {index + 1}. {clip.name}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatTime(clipLength(clip))}
        </span>
      </button>

      <div
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${clip.name}`}
        className="absolute inset-x-0 bottom-0 flex h-5 cursor-grab items-center justify-center bg-muted/60 text-muted-foreground hover:bg-muted"
      >
        <GripHorizontal className="size-3.5" />
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Trim start"
        aria-valuenow={clip.trimStart}
        onPointerDown={onHandleDown("start")}
        onPointerMove={onHandleMove}
        onPointerUp={endDrag}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") updateClip(clip.id, { trimStart: clip.trimStart - 0.2 });
          if (event.key === "ArrowRight") updateClip(clip.id, { trimStart: clip.trimStart + 0.2 });
        }}
        className="absolute left-0 top-0 h-[calc(100%-1.25rem)] w-2 cursor-ew-resize bg-primary/60 hover:bg-primary"
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Trim end"
        aria-valuenow={clip.trimEnd}
        onPointerDown={onHandleDown("end")}
        onPointerMove={onHandleMove}
        onPointerUp={endDrag}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") updateClip(clip.id, { trimEnd: clip.trimEnd - 0.2 });
          if (event.key === "ArrowRight") updateClip(clip.id, { trimEnd: clip.trimEnd + 0.2 });
        }}
        className="absolute right-0 top-0 h-[calc(100%-1.25rem)] w-2 cursor-ew-resize bg-primary/60 hover:bg-primary"
      />
    </div>
  );
}

export function Timeline({ time, onSeek }: { time: number; onSeek: (time: number) => void }) {
  const clips = useEditorStore((s) => s.clips);
  const subtitles = useEditorStore((s) => s.subtitles);
  const reorderClips = useEditorStore((s) => s.reorderClips);
  const addSubtitle = useEditorStore((s) => s.addSubtitle);
  const select = useEditorStore((s) => s.select);
  const selection = useEditorStore((s) => s.selection);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const total = totalDuration(clips);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) reorderClips(String(active.id), String(over.id));
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Timeline
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => addSubtitle(time)}
          disabled={clips.length === 0}
        >
          <Type className="size-3.5" /> Add subtitle here
        </Button>
      </div>

      <div className="relative overflow-x-auto pb-1">
        <div
          className="relative min-w-full"
          style={{ width: Math.max(total * PIXELS_PER_SECOND, 100) }}
        >
          <div
            className="pointer-events-none absolute -top-1 bottom-0 z-20 w-px bg-primary"
            style={{ left: Math.min(time, total) * PIXELS_PER_SECOND }}
          >
            <span className="absolute -left-1 -top-1 size-2 rounded-full bg-primary" />
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={clips.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex items-stretch gap-1">
                {clips.map((clip, index) => (
                  <ClipCard key={clip.id} clip={clip} index={index} />
                ))}
                {clips.length === 0 && (
                  <div className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                    Your scenes will appear here
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="relative mt-2 h-8 rounded-md bg-muted/30">
            {subtitles.map((sub) => {
              const active = selection?.kind === "subtitle" && selection.id === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    select({ kind: "subtitle", id: sub.id });
                    onSeek(sub.start);
                  }}
                  title={sub.text}
                  className={`absolute top-1 h-6 overflow-hidden rounded px-2 text-left text-[10px] ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground"
                  }`}
                  style={{
                    left: sub.start * PIXELS_PER_SECOND,
                    width: Math.max(28, (sub.end - sub.start) * PIXELS_PER_SECOND),
                  }}
                >
                  <span className="block truncate leading-6">{sub.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
