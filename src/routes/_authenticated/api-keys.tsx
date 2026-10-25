import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteApiKey, listApiKeys, saveApiKey } from "@/lib/keys.functions";

export const Route = createFileRoute("/_authenticated/api-keys")({
  head: () => ({
    meta: [
      { title: "API Keys — ReelPilot" },
      { name: "description", content: "Add or remove your own YouTube, Meta, Pexels and music keys anytime." },
      { property: "og:title", content: "API Keys — ReelPilot" },
      { property: "og:description", content: "Manage the keys that power posting, stock footage and competitor stats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiKeysPage,
});

const INFO: Record<string, { label: string; help: string; where: string }> = {
  YOUTUBE_CLIENT_ID: { label: "YouTube Client ID", help: "Lets you connect your channel to post Shorts.", where: "Google Cloud Console → Credentials → OAuth client" },
  YOUTUBE_CLIENT_SECRET: { label: "YouTube Client Secret", help: "Pairs with the Client ID.", where: "Same OAuth client in Google Cloud Console" },
  META_APP_ID: { label: "Meta App ID", help: "Posts Facebook & Instagram Reels.", where: "developers.facebook.com → your app → Settings → Basic" },
  META_APP_SECRET: { label: "Meta App Secret", help: "Pairs with the App ID.", where: "Same page as the App ID" },
  PEXELS_API_KEY: { label: "Pexels API key", help: "Real royalty-free stock video for every scene.", where: "pexels.com/api" },
  YOUTUBE_API_KEY: { label: "YouTube Data API key", help: "Real competitor view & subscriber counts.", where: "Google Cloud Console → Credentials → API key" },
  JAMENDO_CLIENT_ID: { label: "Jamendo Client ID", help: "Mood-matched royalty-free music library.", where: "devportal.jamendo.com" },
  OPENAI_API_KEY: { label: "OpenAI API key", help: "Runs scripts, trends and the agent on your own OpenAI budget.", where: "platform.openai.com → API keys" },
  AI_PROVIDER_API_KEY: { label: "Own AI provider key", help: "Any OpenAI-compatible provider (router, reseller, self-hosted).", where: "Your provider's dashboard → API keys" },
  AI_PROVIDER_BASE_URL: { label: "Provider base URL", help: "Endpoint of your provider, e.g. https://api.provider.com/v1 (required with the key above).", where: "Your provider's docs → API endpoint" },
  AI_PROVIDER_MODEL: { label: "Default model (optional)", help: "Model id used by the agent, e.g. gpt-4o-mini. Defaults to gpt-4o-mini.", where: "Your provider's model list" },
};

function ApiKeysPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["api-keys"], queryFn: useServerFn(listApiKeys) });
  const save = useServerFn(saveApiKey);
  const remove = useServerFn(deleteApiKey);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["api-keys"] });
    qc.invalidateQueries({ queryKey: ["credential-status"] });
  };
  const saveM = useMutation({
    mutationFn: (name: string) => save({ data: { name: name as never, value: drafts[name] ?? "" } }),
    onSuccess: (_r, name) => {
      setDrafts((d) => ({ ...d, [name]: "" }));
      toast.success("Key saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (name: string) => remove({ data: { name: name as never } }),
    onSuccess: () => {
      toast.success("Key removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="API Keys" subtitle="Add or remove your own keys anytime — they're stored securely and never shown again">
      <div className="grid gap-4 lg:grid-cols-2">
        {(list.data ?? []).map((k) => {
          const info = INFO[k.name];
          return (
            <GlassCard key={k.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" />
                  <h3 className="font-semibold">{info?.label ?? k.name}</h3>
                </div>
                {k.savedAt ? (
                  <Badge className="gap-1"><CheckCircle2 className="size-3" /> Saved</Badge>
                ) : k.projectDefault ? (
                  <Badge variant="secondary">Using project key</Badge>
                ) : (
                  <Badge variant="outline">Not set</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{info?.help}</p>
              <p className="text-xs text-muted-foreground">Get it from: {info?.where}</p>
              <div className="mt-3 flex gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={k.savedAt ? "Paste a new value to replace" : "Paste key"}
                  value={drafts[k.name] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [k.name]: e.target.value }))}
                />
                <Button
                  disabled={(drafts[k.name] ?? "").trim().length < 4 || saveM.isPending}
                  onClick={() => saveM.mutate(k.name)}
                >
                  Save
                </Button>
                {k.savedAt && (
                  <Button variant="outline" size="icon" aria-label="Remove key" onClick={() => delM.mutate(k.name)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </AppShell>
  );
}
