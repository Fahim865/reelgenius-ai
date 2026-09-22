import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Activity, BarChart3, Film, Radar, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const Hero3D = lazy(() => import("@/components/hero-3d"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReelPilot — Autonomous AI Reel Studio & Publisher" },
      {
        name: "description",
        content:
          "ReelPilot researches trending topics, writes hook-first scripts, renders 9:16 reels in your browser and publishes them to YouTube Shorts, Facebook Reels and Instagram.",
      },
      { property: "og:title", content: "ReelPilot — Autonomous AI Reel Studio & Publisher" },
      {
        property: "og:description",
        content: "Trend research, scriptwriting, browser video rendering, approvals and auto-publishing in one autopilot studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Radar, title: "Trend radar", body: "The agent researches what is spiking in your niche and scores every topic before writing a word." },
  { icon: Sparkles, title: "Hook-first scripts", body: "Every script opens with a five-second pattern interrupt, then paces for retention and ends on one clear CTA." },
  { icon: Film, title: "Browser render studio", body: "Stock footage, voiceover, burned-in captions and music stitched into a 9:16 reel right in your browser." },
  { icon: ShieldCheck, title: "Approval mode", body: "Review every script and cut before anything goes live — or flip to fully autonomous when you trust it." },
  { icon: Upload, title: "Auto publishing", body: "One approved reel posts to YouTube Shorts, Facebook Reels and Instagram with per-platform status." },
  { icon: BarChart3, title: "Feedback loop", body: "Views, likes, comments and shares flow back in and reshape the next script automatically." },
];

function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <section className="relative flex min-h-[92vh] items-center">
        <div className="absolute inset-0">
          <ClientOnly fallback={<div className="absolute inset-0 bg-[#05030f]" />}>
            <Suspense fallback={<div className="absolute inset-0 bg-[#05030f]" />}>
              <Hero3D />
            </Suspense>
          </ClientOnly>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/10 via-background/40 to-background" />

        <div className="relative mx-auto w-full max-w-5xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Activity className="size-3.5" /> Autonomous short-form video agent
          </span>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-tight sm:text-6xl">
            Your reels research, write, render and <span className="gradient-text">publish themselves</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            ReelPilot finds the trending topic, writes the hook, pulls real stock footage and music, renders a vertical
            reel and posts it to your channels — with you approving as much or as little as you like.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gradient-accent text-primary-foreground">
              <Link to="/auth">Start your agent</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Open the studio</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-28">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Everything the agent handles</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          From the first trend scan to the analytics that shape tomorrow's hook.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur transition hover:border-primary/50"
            >
              <span className="gradient-accent inline-flex size-10 items-center justify-center rounded-xl">
                <f.icon className="size-5 text-primary-foreground" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
