import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const Studio = lazy(() => import("@/components/studio/Studio"));

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Video Studio — ReelPilot" },
      {
        name: "description",
        content:
          "Trim clips, reorder scenes, add captions and mix audio, then export a 9:16 MP4 entirely in your browser.",
      },
      { property: "og:title", content: "Video Studio — ReelPilot" },
      {
        property: "og:description",
        content: "A timeline editor that stitches clips, voiceover and subtitles into a vertical reel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioPage,
});

function StudioFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading the studio…</p>
    </div>
  );
}

function StudioPage() {
  return (
    <ClientOnly fallback={<StudioFallback />}>
      <Suspense fallback={<StudioFallback />}>
        <Studio />
      </Suspense>
    </ClientOnly>
  );
}
