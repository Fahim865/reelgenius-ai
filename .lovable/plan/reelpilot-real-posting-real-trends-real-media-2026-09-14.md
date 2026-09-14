# ReelPilot: real posting, real trends, real media

Turns the current demo into a working agent: accounts, cloud-saved reels, real stock footage, live trend research, an approval queue, and publishing with performance tracking.  
  
Add a 3D Interactive Cinematic Hero Section on the Landing Page using Three.js / React Three Fiber. 

Requirements:

1. Create a dynamic, open-world game-like environment background with subtle camera movements that respond to mouse scroll and cursor position.

2. Incorporate glowing neon nodes, floating 3D glassmorphic cards, and cinematic particle effects.

3. Ensure high performance and light GPU consumption so it does not lag the video editing canvas or FFmpeg renderer.

## What changes for you

1. **Sign in.** Email + Google sign-in. Your keys, settings, reels, schedule and stats move from this browser into your account.
2. **Trend scanner.** A "Trending now" panel researches live topics in your niche with the built-in AI (no extra key), scores each one, shows what similar creators are posting, and feeds the winner straight into the script writer. Runs on demand and on a schedule.
3. **Real media.** Scene lines are matched to real Pexels stock clips and a royalty-free music bed instead of coloured placeholders. You can swap any clip for another search result.
4. **Approval mode.** Every reel lands in a Pending approval queue: read the script, watch the rendered preview, then Approve, Request changes, or Reject. Only approved reels publish. Auto mode skips the queue; the kill switch freezes everything instantly.
5. **Publishing.** Approved reels upload to your linked YouTube, Facebook Page and Instagram Business accounts, with status and error shown per platform and automatic retry on failure.
6. **Analytics.** Views, likes, comments and shares are pulled back on a schedule per posted reel, charted over time, and summarised into "what worked" notes the script writer reads before writing the next hook.

## What you need to supply

None of the three social platforms has a ready-made integration here, so publishing needs your own developer credentials:

- **YouTube** — a Google Cloud project with YouTube Data API v3 enabled, plus an OAuth client ID and secret. You then click Connect once and approve upload access.
- **Facebook Reels + Instagram Reels** — one Meta developer app, an Instagram Business account linked to a Facebook Page, and a Page access token. Both platforms run through the same Meta app.
- **Pexels** — a free API key (instant signup) for stock video.
- Music: a curated royalty-free set ships built in; optionally add a free Jamendo key for a larger library.

I'll build every screen and the full server pipeline first. Each platform shows "Credentials needed" until you paste its keys into a secure form, then goes live without further code changes. Trends, approval, media and analytics-charting all work before any social credentials exist.

## Honest limits

- Rendering happens in your browser. A reel publishes by itself only after it has been rendered and uploaded once — the agent can research, write and queue around the clock, but the render step needs the studio tab open. A "Render queue" panel makes this explicit and batches pending reels when you open it.
- Instagram cannot publish to a personal account — Business or Creator only.
- Meta Page tokens expire; the app warns before expiry and prompts a reconnect.
- Google Trends has no official API, so trend research uses the built-in AI's live research rather than raw Trends numbers.

## Technical design

**Data (Lovable Cloud, RLS scoped to `auth.uid()`, GRANTs per table):**
`profiles`, `agent_settings` (mode, kill switch, niche, cadence), `social_accounts` (platform, external id, encrypted tokens, expiry, status), `trends` (topic, score, source, rationale, used_at), `videos` (script, title, scenes JSON, storage path, state: draft → rendered → pending_approval → approved → publishing → published → failed), `approvals` (decision, note, actor), `posts` (video, platform, remote id, permalink, error), `post_metrics` (post, captured_at, views, likes, comments, shares), `insights` (rolling summary fed into the script prompt). Private `reels` storage bucket, owner-only policies.

**Server functions** (`src/lib/*.functions.ts`, `requireSupabaseAuth`):
`scanTrends` (AI research + scoring, Responses API, streaming), `generateScript` (extended with trend context + `insights`), `buildScenes` (scene split + Pexels clip and music search), `submitForApproval` / `decideApproval`, `publishVideo` (per-platform adapters), `refreshMetrics`, `summarizeInsights`.

**Platform adapters** (`src/lib/publishers/*.server.ts`): YouTube resumable upload (`videos.insert`, `shorts` via ≤60 s 9:16); Facebook Page `video_reels` three-step start/upload/finish; Instagram `media` with `media_type=REELS` + `media_publish`. Each reads its signed storage URL, streams the file, records `posts` rows, and normalises provider errors.

**OAuth**: server routes under `src/routes/api/public/oauth/{youtube,meta}/callback` with state verification; refresh tokens stored server-side only, never in the browser.

**Scheduling**: `pg_cron` → `/api/public/hooks/{agent-tick,metrics-sweep}`. Agent tick (hourly) scans trends, writes scripts and queues reels; metrics sweep (every 6 h) pulls platform stats and rebuilds insights. Both exit immediately when the kill switch is on. Publishing retries with backoff, max 3 attempts.

**Frontend**: `/trends`, `/approvals`, `/analytics` routes; Connections rebuilt around real OAuth state; Library shows render/publish state per reel; Studio gains a media bin backed by Pexels search and an "upload to cloud" step after export.