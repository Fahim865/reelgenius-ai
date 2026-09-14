import { useState } from "react";

import { ExportBar } from "./ExportBar";
import { MediaBin } from "./MediaBin";
import { PreviewPlayer } from "./PreviewPlayer";
import { PropertiesPanel } from "./PropertiesPanel";
import { Timeline } from "./Timeline";

export default function Studio() {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <ExportBar />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        <aside className="hidden min-h-0 lg:block">
          <MediaBin />
        </aside>
        <main className="min-h-0">
          <PreviewPlayer
            time={time}
            playing={playing}
            onTimeChange={setTime}
            onPlayingChange={setPlaying}
          />
        </main>
        <aside className="hidden min-h-0 lg:block">
          <PropertiesPanel />
        </aside>
      </div>
      <div className="lg:hidden">
        <MediaBin />
        <PropertiesPanel />
      </div>
      <Timeline
        time={time}
        onSeek={(next) => {
          setPlaying(false);
          setTime(next);
        }}
      />
    </div>
  );
}
