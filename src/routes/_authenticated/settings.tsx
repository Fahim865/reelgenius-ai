import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { OctagonX, Save, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAgentSettings, saveAgentSettings, type AgentSettingsRow } from "@/lib/settings.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Agent Settings — ReelPilot" },
      { name: "description", content: "Set niche, tone, posting frequency, target platforms and choose Full Auto or Review Before Post." },
      { property: "og:title", content: "Agent Settings — ReelPilot" },
      { property: "og:description", content: "Tune how your autonomous content agent writes and publishes." },
    ],
  }),
  component: SettingsPage,
});

const targets = [
  { id: "youtube", name: "YouTube Shorts", color: "oklch(0.62 0.22 25)" },
  { id: "facebook", name: "Facebook Reels", color: "oklch(0.55 0.2 260)" },
  { id: "instagram", name: "Instagram Reels", color: "oklch(0.65 0.22 350)" },
] as const;

function SettingsPage() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getAgentSettings);
  const save = useServerFn(saveAgentSettings);
  const [draft, setDraft] = useState<AgentSettingsRow | null>(null);

  const settings = useQuery({ queryKey: ["agent-settings"], queryFn: () => fetchSettings() });

  useEffect(() => {
    if (settings.data && !draft) setDraft(settings.data);
  }, [settings.data, draft]);

  const persist = useMutation({
    mutationFn: (patch: SettingsPatch) => save({ data: patch }),
    onSuccess: (row) => {
      setDraft(row);
      queryClient.setQueryData(["agent-settings"], row);
      toast.success("Agent settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!draft) {
    return (
      <AppShell title="Agent Settings" subtitle="Define what your agent makes and when it posts">
        <p className="text-sm text-muted-foreground">Loading your agent…</p>
      </AppShell>
    );
  }

  const togglePlatform = (id: string) =>
    setDraft({
      ...draft,
      platforms: draft.platforms.includes(id) ? draft.platforms.filter((p) => p !== id) : [...draft.platforms, id],
    });

  return (
    <AppShell
      title="Agent Settings"
      subtitle="Define what your agent makes and when it posts"
      actions={
        <Button
          className="gradient-accent text-primary-foreground"
          disabled={persist.isPending}
          onClick={() =>
            persist.mutate({
              niche: draft.niche,
              tone: draft.tone,
              language: draft.language,
              videoLength: draft.video_length,
              frequency: draft.frequency,
              timeSlots: draft.time_slots,
              platforms: draft.platforms as ("youtube" | "facebook" | "instagram")[],
              mode: draft.mode,
              active: draft.active,
            })
          }
        >
          <Save className="mr-2 size-4" /> Save
        </Button>
      }
    >
      {draft.kill_switch ? (
        <GlassCard className="mb-5 border-destructive/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <OctagonX className="mt-0.5 size-5 text-destructive" />
              <div>
                <p className="font-medium">Emergency stop is on</p>
                <p className="text-sm text-muted-foreground">Nothing will be generated or published until you resume.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => persist.mutate({ killSwitch: false })}>
              Resume the agent
            </Button>
          </div>
        </GlassCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle title="Content identity" />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="niche">Niche / topic</Label>
              <Input id="niche" value={draft.niche} onChange={(e) => setDraft({ ...draft, niche: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">Brand tone / voice</Label>
              <Textarea id="tone" rows={3} value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={draft.language} onValueChange={(v) => setDraft({ ...draft, language: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["English", "Bangla", "Hindi", "Spanish", "Arabic"].map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Video length: {draft.video_length}s</Label>
                <Slider
                  value={[draft.video_length]}
                  min={15}
                  max={90}
                  step={5}
                  onValueChange={(v) => setDraft({ ...draft, video_length: v[0] ?? draft.video_length })}
                />
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Posting schedule" />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Posts per day: {draft.frequency}</Label>
              <Slider
                value={[draft.frequency]}
                min={1}
                max={6}
                step={1}
                onValueChange={(vals) => {
                  const v = vals[0] ?? draft.frequency;
                  setDraft({
                    ...draft,
                    frequency: v,
                    time_slots: Array.from({ length: v }, (_, i) => draft.time_slots[i] ?? "12:00"),
                  });
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.time_slots.map((slot, i) => (
                <div key={i} className="space-y-2">
                  <Label htmlFor={`slot-${i}`}>Slot {i + 1}</Label>
                  <Input
                    id={`slot-${i}`}
                    type="time"
                    value={slot}
                    onChange={(e) => {
                      const slots = [...draft.time_slots];
                      slots[i] = e.target.value;
                      setDraft({ ...draft, time_slots: slots });
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Autopilot</p>
                <p className="text-xs text-muted-foreground">Let the agent work on its own schedule</p>
              </div>
              <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle
            title="Target platforms"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/connections">Manage</Link>
              </Button>
            }
          />
          <ul className="space-y-2">
            {targets.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <span className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
                <Switch checked={draft.platforms.includes(p.id)} onCheckedChange={() => togglePlatform(p.id)} />
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Publishing mode" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "auto" as const, icon: Zap, title: "Full Auto", desc: "Agent generates and publishes on its own." },
              { id: "review" as const, icon: ShieldCheck, title: "Review Before Post", desc: "Every reel waits in your approval queue." },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setDraft({ ...draft, mode: m.id })}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  draft.mode === m.id ? "gradient-border bg-primary/10" : "border-border/60 hover:bg-muted/30",
                )}
              >
                <m.icon className={cn("mb-2 size-5", draft.mode === m.id ? "text-primary" : "text-muted-foreground")} />
                <p className="text-sm font-medium">{m.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/5 p-3">
            <div>
              <p className="text-sm font-medium">Emergency stop</p>
              <p className="text-xs text-muted-foreground">Freeze all generation and publishing immediately</p>
            </div>
            <Switch
              checked={draft.kill_switch}
              onCheckedChange={(v) => {
                setDraft({ ...draft, kill_switch: v });
                persist.mutate({ killSwitch: v });
              }}
            />
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
