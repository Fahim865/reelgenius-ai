import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cable, KeyRound, Link2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { GlassCard, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { disconnectAccount, listSocialAccounts } from "@/lib/publish.functions";
import { getConnectUrl, getCredentialStatus } from "@/lib/oauth.functions";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({
    meta: [
      { title: "Social Connections — ReelPilot" },
      { name: "description", content: "Link YouTube Shorts, Facebook Reels and Instagram so your agent can publish for you." },
      { property: "og:title", content: "Social Connections — ReelPilot" },
      { property: "og:description", content: "Connect your channels once and let the agent post automatically." },
    ],
  }),
  component: ConnectionsPage,
});

const catalog = [
  {
    platform: "youtube" as const,
    provider: "youtube" as const,
    name: "YouTube Shorts",
    color: "oklch(0.62 0.22 25)",
    blurb: "Uploads your vertical reel as a public Short.",
  },
  {
    platform: "facebook" as const,
    provider: "meta" as const,
    name: "Facebook Reels",
    color: "oklch(0.55 0.2 260)",
    blurb: "Posts to the Facebook Page you pick during sign-in.",
  },
  {
    platform: "instagram" as const,
    provider: "meta" as const,
    name: "Instagram Reels",
    color: "oklch(0.65 0.22 350)",
    blurb: "Needs a Business or Creator account linked to that Page.",
  },
];

function ConnectionsPage() {
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listSocialAccounts);
  const fetchCredentials = useServerFn(getCredentialStatus);
  const connectUrl = useServerFn(getConnectUrl);
  const disconnect = useServerFn(disconnectAccount);

  const accounts = useQuery({ queryKey: ["social-accounts"], queryFn: () => fetchAccounts() });
  const credentials = useQuery({ queryKey: ["credential-status"], queryFn: () => fetchCredentials() });

  const connect = useMutation({
    mutationFn: (provider: "youtube" | "meta") =>
      connectUrl({ data: { platform: provider, origin: window.location.origin } }),
    onSuccess: (result) => {
      if (!result.configured || !result.url) {
        toast.error("That platform still needs its app credentials before you can link an account.");
        return;
      }
      window.location.href = result.url;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (platform: "youtube" | "facebook" | "instagram") => disconnect({ data: { platform } }),
    onSuccess: () => {
      toast.success("Account disconnected");
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const missing = credentials.data
    ? [
        !credentials.data.youtube ? "YouTube" : null,
        !credentials.data.meta ? "Facebook & Instagram" : null,
        !credentials.data.pexels ? "stock footage (Pexels)" : null,
        !credentials.data.music ? "mood-matched music (Jamendo)" : null,
        !credentials.data.youtubeData ? "live competitor stats (YouTube Data API key)" : null,
      ].filter(Boolean)
    : [];

  return (
    <AppShell title="Connections" subtitle="Where your agent publishes">
      {missing.length > 0 ? (
        <GlassCard className="mb-5 border-amber-500/40">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 text-amber-500" />
            <div>
              <p className="font-medium">Still waiting on setup keys</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {missing.join(", ")} can't be used until the matching keys are saved. Add or remove them anytime on the API Keys page — everything else keeps working in the meantime.
              </p>
            </div>
          </div>
        </GlassCard>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.map((item) => {
          const account = (accounts.data ?? []).find((a) => a.platform === item.platform);
          const ready = item.provider === "youtube" ? credentials.data?.youtube : credentials.data?.meta;
          return (
            <GlassCard key={item.platform}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-11 items-center justify-center rounded-2xl text-sm font-semibold text-white"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{account?.handle ?? "not linked"}</p>
                  </div>
                </div>
                <StatusBadge status={account?.status ?? "disconnected"} />
              </div>

              <p className="mt-4 text-xs text-muted-foreground">{item.blurb}</p>
              {account?.expires_at ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Access expires {new Date(account.expires_at).toLocaleDateString()}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gradient-accent text-primary-foreground"
                  disabled={connect.isPending || !ready}
                  onClick={() => connect.mutate(item.provider)}
                >
                  <Link2 className="mr-2 size-4" />
                  {account?.status === "connected" ? "Reconnect" : "Connect"}
                </Button>
                {account ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Disconnect
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect {item.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The agent will stop posting there until you link the account again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(item.platform)}>Disconnect</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="mt-6">
        <div className="flex items-start gap-3">
          <Cable className="mt-0.5 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Instagram publishing requires a Business or Creator account linked to the same Facebook Page you pick while
            connecting. Sign in with the Facebook account that manages that Page.
          </p>
        </div>
      </GlassCard>
    </AppShell>
  );
}
