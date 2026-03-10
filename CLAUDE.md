# CLAUDE.md — Agent Dashboard

## Project Overview

Agent Dashboard is a real-time operations center and gamified quest management system for AI agents. It combines agent monitoring, quest assignment, player progression, and campaign management into a dark-themed dashboard UI with a companion Electron desktop app (Quest Forge).

**Live instance:** `http://187.77.139.247:3001`
**Repository:** `B4lmoncl/agent-dashboard` on GitHub

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 16.x |
| UI | React | 19.x |
| Styling | Tailwind CSS | v4 |
| Backend API | Express.js | 4.x |
| Language | TypeScript | 5.x |
| Desktop App | Electron | 29.x |
| Deployment | Docker, GitHub Pages | — |

## Project Structure

```
agent-dashboard/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout (dark theme, Geist fonts)
│   ├── page.tsx              # Main dashboard (~4900 lines, all views)
│   └── globals.css           # CSS variables, animations, scrollbar
├── components/               # Reusable React components
│   ├── AgentCard.tsx         # Agent status/metrics card
│   ├── QuestCard.tsx         # Quest display with expand/collapse
│   └── StatBar.tsx           # Label/value stat display
├── public/
│   └── data/                 # JSON data files (agents, quests, users, keys, campaigns)
├── electron-quest-app/       # Quest Forge desktop companion
│   ├── main.js               # Electron main process
│   ├── renderer.js           # Renderer logic
│   ├── index.html            # Quest form UI
│   └── quick-forge.html      # System tray popup
├── server.js                 # Express API server (~2500 lines, 71 routes)
├── .github/workflows/
│   ├── deploy.yml            # GitHub Pages (main → /out)
│   └── build-release.yml     # Electron build on release
├── docker-compose.yml        # Containerized API deployment
├── next.config.js            # Static export, unoptimized images
├── tsconfig.json             # Strict mode, @/* path alias
└── .env.example              # API_KEY template
```

## Commands

```bash
# Development
npm install               # Install dependencies
npm run dev               # Start Next.js dev server (port 3000)
node server.js            # Start Express API server (port 3001)

# Production
npm run build             # Static export to /out
npm start                 # Serve built Next.js app

# Code quality
npm run lint              # ESLint (Next.js core-web-vitals + TypeScript)

# Docker
docker compose up         # Build and run containerized API on port 3001

# Electron app (from electron-quest-app/)
cd electron-quest-app && npm install && npm start
```

The frontend dev server and Express API server run independently. In production, `server.js` serves both the API and the static build.

## Architecture

### Frontend (`app/page.tsx`)

The main dashboard is a single large client component (`"use client"`) containing all views:

- **Agent Roster** — 7 agents (Nova, Hex, Echo, Pixel, Atlas, Lyra, Forge) with real-time status
- **Quest Board** — Tabs: Open, In-Progress, Completed, Suggested, Rejected
- **Player Profile** — XP, levels, achievements, gear, streaks
- **Campaign Hub** — Quest chains with timeline progression
- **Personal Quests** — 8 template types for life/relationship/learning goals
- **Household Board** — Rotating chore assignments
- **CV Skill Tree** — Visual skill/resume builder
- **NPC System** — Dobbie companion with mood states
- **Challenges** — Raid boss encounters

Data is fetched from the Express API via `fetch()` with polling for real-time updates.

### Backend (`server.js`)

Plain Express.js server with 71 REST endpoints. No database — all state persists to JSON files in `public/data/`.

**Key data files:**
- `agents.json` — Agent statuses, metrics, active quests
- `quests.json` — All quests grouped by status
- `users.json` — Player profiles, XP, achievements, gear
- `keys.json` — Managed API keys
- `campaigns.json` — Campaign/quest chain definitions

**Security:**
- API key auth via `X-API-Key` header
- `MASTER_KEY` env var for admin endpoints
- Rate limiting: 500 req / 15 min
- CORS enabled

### Desktop App (`electron-quest-app/`)

Standalone Electron app for quick quest creation from system tray. Communicates with the Express API. Built and released via GitHub Actions on tagged releases.

## Code Conventions

### File & Naming

- **Components:** PascalCase filenames and exports (`AgentCard.tsx`)
- **Variables/functions:** camelCase
- **Interfaces:** PascalCase, defined at top of files (e.g., `Agent`, `Quest`, `User`, `Campaign`)
- **Config objects:** camelCase maps like `priorityConfig`, `statusConfig`, `agentMeta`

### Styling

- Tailwind CSS utility classes combined with inline `style={{}}` for dynamic values
- Dark theme throughout — backgrounds: `#0a0a0a`, `#0b0d11`; accent: red/orange
- Custom CSS animations defined in `globals.css` (pulse-online, pulse-working, btn-pop, shimmer, ripple, etc.)
- No CSS modules or styled-components

### Component Patterns

- `"use client"` directive on all interactive components
- Config-driven rendering via lookup objects (priority colors, status icons, etc.)
- `useCountUp` custom hook for animated numeric transitions
- Inline conditional styling over className toggling for state-dependent visuals
- Expandable/collapsible sections for detailed content

### Server Patterns

- Flat route structure in `server.js` — no router modules
- Direct JSON file read/write for persistence (no ORM/database)
- Middleware: CORS, rate limiter, JSON body parser, API key validation
- Endpoints follow REST conventions: `GET /api/resource`, `POST /api/resource`, `PATCH /api/resource/:id`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `API_KEY` | Single API key (backward-compatible) |
| `API_KEYS` | Comma-separated multiple API keys |
| `MASTER_KEY` | Admin-only operations (key management) |
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | `production` in Docker |

## CI/CD

- **`deploy.yml`** — On push to `main`: build Next.js, deploy `/out` to GitHub Pages
- **`build-release.yml`** — On GitHub release: build Electron portable `.exe`, upload to release assets

## API Overview

The Express server exposes 71 endpoints across these groups:

- **Agents** (9 routes) — CRUD, status updates, health check-ins, command polling
- **Quests** (15+ routes) — Create, claim, complete, approve/reject, co-op, batch ops
- **Users** (8 routes) — Registration, XP awards, achievements, streaks
- **Shop/Gear** (4 routes) — Browse, purchase, inventory
- **Campaigns** (2 routes) — Quest chains, join challenges
- **NPCs** (3 routes) — Companion/NPC data
- **Admin** (3 routes) — API key management (requires `MASTER_KEY`)
- **Integrations** (3 routes) — GitHub webhooks, Spotify connect
- **Utility** — `/api/health`, `/api/version`, `/api/leaderboard`, `/api/docs`

## XP & Level System

| Level | Title | XP Range |
|-------|-------|----------|
| 1 | Novice | 0–99 |
| 2 | Apprentice | 100–299 |
| 3 | Knight | 300–599 |
| 4 | Archmage | 600+ |

## Key Things to Know

1. **No tests exist yet.** There is no test framework configured. If adding tests, consider Jest or Vitest.
2. **`app/page.tsx` is very large (~4900 lines).** All dashboard views live in a single file. Be cautious with edits — search for the specific section before modifying.
3. **`server.js` is also large (~2500 lines, 71 routes).** All routes are in one file with no router separation.
4. **Data is file-based.** All persistence uses JSON files in `public/data/`. There is no database. Writes use `fs.writeFileSync`.
5. **Static export.** Next.js is configured for static export (`output: 'export'`). No server-side rendering or API routes in Next.js — the Express server handles all API logic.
6. **The `@/*` path alias** maps to the project root (configured in `tsconfig.json`).
7. **Tailwind CSS v4** is used with the new PostCSS plugin (`@tailwindcss/postcss`), not the legacy config approach.
8. **Node 20+** is used in CI. The Electron workflow uses Node 22.
