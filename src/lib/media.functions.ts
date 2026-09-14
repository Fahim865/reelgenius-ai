import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type StockClip = {
  id: string;
  query: string;
  previewImage: string;
  videoUrl: string;
  duration: number;
  credit: string;
};

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  url: string;
  mood: string;
};

/** Royalty-free beds served from Jamendo's free-license CDN when a key is present,
 * otherwise a curated public-domain fallback list. */
const FALLBACK_MUSIC: MusicTrack[] = [
  {
    id: "kevin-inspire",
    title: "Inspirational Uplift",
    artist: "Public domain bed",
    url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3",
    mood: "uplifting",
  },
  {
    id: "tech-pulse",
    title: "Tech Pulse",
    artist: "Public domain bed",
    url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bab.mp3",
    mood: "tech",
  },
  {
    id: "hype-drive",
    title: "Hype Drive",
    artist: "Public domain bed",
    url: "https://cdn.pixabay.com/download/audio/2021/11/25/audio_00fa5593f3.mp3",
    mood: "energetic",
  },
];

export const searchStockClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(1).max(120), perPage: z.number().int().min(1).max(12).default(6) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env['PEXELS_API_KEY'];
    if (!key) {
      return { configured: false, clips: [] as StockClip[] };
    }

    const url = new URL("https://api.pexels.com/videos/search");
    url.searchParams.set("query", data.query);
    url.searchParams.set("orientation", "portrait");
    url.searchParams.set("per_page", String(data.perPage));

    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Stock video search failed [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as {
      videos?: Array<{
        id: number;
        duration: number;
        image: string;
        user?: { name?: string };
        video_files?: Array<{ link: string; width: number | null; height: number | null; quality: string }>;
      }>;
    };

    const clips: StockClip[] = (json.videos ?? [])
      .map((v) => {
        const files = (v.video_files ?? []).filter((f) => f.link);
        const portrait = files
          .filter((f) => (f.height ?? 0) >= (f.width ?? 0))
          .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
        const pick = portrait[0] ?? files[0];
        if (!pick) return null;
        return {
          id: String(v.id),
          query: data.query,
          previewImage: v.image,
          videoUrl: pick.link,
          duration: v.duration,
          credit: `Pexels · ${v.user?.name ?? "Unknown"}`,
        } satisfies StockClip;
      })
      .filter((c): c is StockClip => Boolean(c));

    return { configured: true, clips };
  });

export const listMusic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env['JAMENDO_CLIENT_ID'];
    if (!key) return { source: "curated" as const, tracks: FALLBACK_MUSIC };

    const url = new URL("https://api.jamendo.com/v3.0/tracks");
    url.searchParams.set("client_id", key);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "12");
    url.searchParams.set("audioformat", "mp32");
    url.searchParams.set("include", "musicinfo");
    url.searchParams.set("tags", "upbeat+electronic");

    const res = await fetch(url);
    if (!res.ok) return { source: "curated" as const, tracks: FALLBACK_MUSIC };
    const json = (await res.json()) as {
      results?: Array<{ id: string; name: string; artist_name: string; audio: string; musicinfo?: { tags?: { vartags?: string[] } } }>;
    };
    const tracks: MusicTrack[] = (json.results ?? []).map((t) => ({
      id: t.id,
      title: t.name,
      artist: t.artist_name,
      url: t.audio,
      mood: t.musicinfo?.tags?.vartags?.[0] ?? "royalty-free",
    }));
    return { source: "jamendo" as const, tracks: tracks.length ? tracks : FALLBACK_MUSIC };
  });
