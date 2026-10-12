# ReelGenius AI

Act as a Principal Full-Stack Architect and AI Systems Engineer. Build a production-ready, autonomous AGI-level Content Creator and Social Publisher web application by integrating features from "ReelPilot UI" and "Scene-Weaver" (in-browser FFmpeg video timeline engine).

### PROJECT GOAL
Create a fully functional Web Studio & Autonomous AI Agent that scans real-time trending topics, writes high-retention video scripts, fetches stock visual/audio assets, renders 9:16 vertical short videos directly in the browser using FFmpeg WASM, and posts them to linked social media channels with automated performance feedback loops.

### CORE ARCHITECTURE & FEATURES

1. Dynamic API Brain & Provider Configuration:
   - Centralized Dashboard Panel to input API Keys (OpenAI, Gemini, Claude, ElevenLabs, Pexels, YouTube Data API, Facebook Page API).
   - Natural language command bar to send live commands to the agent (e.g., "Find top tech news, generate a short reel, and post").

2. Autonomous Trend Scraper & Competitor Analysis:
   - Background scanner integrating Google Trends / Tavily API to extract viral news.
   - Script Engine enforcing a strict "First 5-Seconds Hook", high retention pacing, auto-generated dynamic captions (Alex Hormozi style), and engaging CTAs.

3. In-Browser Video Production Studio:
   - Timeline-based renderer powered by @ffmpeg/ffmpeg (WASM) & Canvas API.
   - Auto-stitch video clips, AI voiceover audio, dynamic text subtitles, and sound effects into a 9:16 vertical video format.
   - High-CTR thumbnail and title generator.

4. Multi-Platform Social Publisher & Feedback Loop:
   - Direct integration endpoints for YouTube Shorts, Facebook Reels, and Instagram API.
   - Analytics Feedback Loop to adjust future video hooks based on past view/engagement metrics.
   - Emergency Kill Switch and Dual-Mode Toggle (Fully Autonomous vs. Human Approval Mode).

### TECH STACK REQUIREMENTS
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI, Zustand.
- Video Processing: @ffmpeg/ffmpeg, Canvas API.
- Backend/Async Workers: Node.js Express server with Task Scheduler.

Build the complete, structured, and fully functional code files adhering to these specifications.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4097f882-ebff-4b04-9863-966e5fa8db49).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
