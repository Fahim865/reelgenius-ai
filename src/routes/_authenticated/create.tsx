import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clapperboard, Loader2, Music2, Save, Sparkles, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildScenes, generateScript, type Scene } from "@/lib/ai.functions";
import { listMusic } from "@/lib/media.functions";
import { getAgentSettings } from "@/lib/settings.functions";
import { listTrends } from "@/lib/trends.functions";
import { saveVideo, submitForApproval } from "@/lib/videos.functions";
import { cn } from "@/lib/utils";

type CreateSearch = { trendId?: string | undefined };

export const Route = createFileRoute("/_authenticated/create")({
  validateSearch: (search: Record<string, unknown>): CreateSearch => ({
    trendId: typeof search['trendId'] === "string" ? search['trendId'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Create a Reel — ReelPilot" },
      { name: "description", content: "Turn a trend into a hook-first script, real stock scenes and a finished 9:16 reel." },
      { property: "og:title", content: "Create a Reel — ReelPilot" },
      { property: "og:description", content: "Guided AI generation flow for vertical short-form video." },
    ],
  }),
  component: CreatePage,
});

const steps = ["Brief", "Script", "Scenes", "Save"] as const;

function CreatePage() {
  const navigate = useNavigate();
  const { trendId } = Route.useSearch();

  const fetchSettings = useServerFn(getAgentSettings);
  const fetchTrends = useServerFn(listTrends);
  const fetchMusic = useServerFn(listMusic);
  const writeScriptFn = useServerFn(generateScript);
  const buildScenesFn = useServerFn(buildScenes);
  const saveVideoFn = useServerFn(saveVideo);
  const submitFn = useServerFn(submitForApproval);

  const settings = useQuery({ queryKey: ["agent-settings"], queryFn: () => fetchSettings() });
  const trends = useQuery({ queryKey: ["trends"], queryFn: () => fetchTrends() });
  const music = useQuery({ queryKey: ["music"], queryFn: () => fetchMusic() });

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [brief, setBrief] = useState("");
  const [selectedTrend, setSelectedTrend] = useState<string>(trendId ?? "");
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [musicUrl, setMusicUrl] = useState<string>("");

  useEffect(() => {
    if (!trendId || brief) return;
    const trend = (trends.data ?? []).find((t) => t.id === trendId);
    if (trend) setBrief(trend.angle ? `${trend.topic} — ${trend.angle}` : trend.topic);
  }, [trendId, trends.data, brief]);

  const totalSeconds = scenes.reduce((sum, s) => sum + s.seconds, 0);

  async function withProgress<T>(label: string, fn: () => Promise<T>) {
    setBusy(true);
    setProgress(8);
    const tick = setInterval(() => setProgress((p) => Math.min(p + 6, 92)), 350);
    try {
      const result = await fn();
      toast.success(label);
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
      return null;
    } finally {
      clearInterval(tick);
      setProgress(100);
      setBusy(false);
    }
  }

  async function writeScript() {
    if (brief.trim().length < 3) {
      toast.error("Tell the agent what the reel is about first.");
      return;
    }
    const result = await withProgress("Script written", () =>
      writeScriptFn({
        data: {
          brief: brief.trim(),
          niche: settings.data?.niche ?? "general",
          tone: settings.data?.tone ?? "punchy",
          seconds: settings.data?.video_length ?? 40,
          ...(selectedTrend ? { trendId: selectedTrend } : {}),
        },
      }),
    );
    if (!result) return;
    setScript(result.script);
    setTitle(result.title || brief.slice(0, 60));
    setStep(1);
  }

  async function makeScenes() {
    const result = await withProgress("Scenes and stock footage ready", () =>
      buildScenesFn({ data: { script, seconds: settings.data?.video_length ?? 40 } }),
    );
    if (!result) return;
    setScenes(result.scenes);
    if (!result.stockConfigured) toast.warning("No stock footage key yet — scenes have captions but no clips.");
    setStep(2);
  }

  async function saveToCloud(submit: boolean) {
    const saved = await withProgress(submit ? "Sent for approval" : "Saved to your library", async () => {
      const row = await saveVideoFn({
        data: {
          title: title.trim() || brief.slice(0, 60) || "Untitled reel",
          topic: brief.trim(),
          script,
          scenes: scenes as unknown as Record<string, unknown>[],
          ...(musicUrl ? { musicUrl } : {}),
          durationSeconds: totalSeconds || (settings.data?.video_length ?? 40),
          ...(selectedTrend ? { trendId: selectedTrend } : {}),
        },
      });
      if (submit) await submitFn({ data: { videoId: row.id } });
      return row;
    });
    if (!saved) return;
    setStep(3);
    if (submit) navigate({ to: "/approvals" });
  }

  return (
    <AppShell title="Create a reel" subtitle={settings.data ? `Niche: ${settings.data.niche}` : "Loading your agent…"}>
      <div className="mb-6 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
              i === step
                ? "gradient-accent border-transparent text-primary-foreground"
                : i < step
                  ? "border-success/40 text-success"
                  : "border-border/60 text-muted-foreground",
            )}
          >
            {i < step ? <Check className="size-3" /> : <span className="text-[10px]">{i + 1}</span>}
            {s}
          </button>
        ))}
      </div>

      {busy ? <Progress value={progress} className="mb-4 h-1.5" /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {step === 0 ? (
            <GlassCard>
              <SectionTitle title="Topic / brief" />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Use a scanned trend (optional)</Label>
                  <Select
                    value={selectedTrend || "none"}
                    onValueChange={(v) => {
                      setSelectedTrend(v === "none" ? "" : v);
                      const trend = (trends.data ?? []).find((t) => t.id === v);
                      if (trend) setBrief(trend.angle ? `${trend.topic} — ${trend.angle}` : trend.topic);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Write my own topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Write my own topic</SelectItem>
                      {(trends.data ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.score} · {t.topic}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brief">What is this reel about?</Label>
                  <Textarea
                    id="brief"
                    rows={4}
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Why an AI agent beats hiring an editor"
                  />
                </div>
                <Button className="gradient-accent text-primary-foreground" disabled={busy} onClick={writeScript}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                  Write the script
                </Button>
              </div>
            </GlassCard>
          ) : null}

          {step === 1 ? (
            <GlassCard>
              <SectionTitle title="Script" />
              <div className="mb-3 space-y-1">
                <Label htmlFor="reel-title">Title</Label>
                <Input id="reel-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <Textarea rows={12} value={script} onChange={(e) => setScript(e.target.value)} />
              <Button className="gradient-accent mt-4 text-primary-foreground" disabled={busy} onClick={makeScenes}>
                <Clapperboard className="mr-2 size-4" /> Break into scenes & pull footage
              </Button>
            </GlassCard>
          ) : null}

          {step === 2 ? (
            <GlassCard>
              <SectionTitle title={`Scene breakdown · ${totalSeconds}s`} />
              <ul className="space-y-3">
                {scenes.map((scene, i) => (
                  <li key={scene.id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Scene {i + 1}</p>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Timer className="size-3" /> {scene.seconds}s
                      </span>
                    </div>
                    <div className="mt-2 flex gap-3">
                      {scene.clipPreview ? (
                        <img src={scene.clipPreview} alt="" className="h-24 w-14 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-24 w-14 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                          no clip
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <Input
                          value={scene.caption}
                          onChange={(e) =>
                            setScenes((all) => all.map((x) => (x.id === scene.id ? { ...x, caption: e.target.value } : x)))
                          }
                        />
                        <Input
                          value={scene.keywords}
                          onChange={(e) =>
                            setScenes((all) => all.map((x) => (x.id === scene.id ? { ...x, keywords: e.target.value } : x)))
                          }
                        />
                        {scene.credit ? <p className="text-[10px] text-muted-foreground">{scene.credit}</p> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-2">
                <Label className="flex items-center gap-2">
                  <Music2 className="size-4" /> Background music
                </Label>
                <Select value={musicUrl || "none"} onValueChange={(v) => setMusicUrl(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No music" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No music</SelectItem>
                    {(music.data?.tracks ?? []).map((track) => (
                      <SelectItem key={track.url} value={track.url}>
                        {track.name} — {track.artist}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="gradient-accent text-primary-foreground" disabled={busy} onClick={() => saveToCloud(false)}>
                  <Save className="mr-2 size-4" /> Save to library
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => saveToCloud(true)}>
                  Send for approval
                </Button>
              </div>
            </GlassCard>
          ) : null}

          {step === 3 ? (
            <GlassCard>
              <SectionTitle title="Saved" />
              <p className="text-sm text-muted-foreground">
                Your reel is in the cloud. Open the studio to render the 9:16 video, then upload it so the agent can
                publish it to your channels.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="gradient-accent text-primary-foreground" onClick={() => navigate({ to: "/studio" })}>
                  Open the studio
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/library" })}>
                  View library
                </Button>
              </div>
            </GlassCard>
          ) : null}
        </div>

        <GlassCard className="h-fit">
          <SectionTitle title="Summary" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Aspect ratio · 9:16</p>
            <p>Scenes · {scenes.length || "—"}</p>
            <p>Runtime · {totalSeconds ? `${totalSeconds}s` : `${settings.data?.video_length ?? 40}s target`}</p>
            <p>Mode · {settings.data?.mode === "auto" ? "Full auto" : "Review before post"}</p>
          </div>
          {title ? <p className="mt-4 font-display text-sm font-semibold">{title}</p> : null}
        </GlassCard>
      </div>
    </AppShell>
  );
}
