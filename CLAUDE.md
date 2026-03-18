# CLAUDE.md

## Project Overview

**Quest Hall / Agent Dashboard** (v1.4.0) — A real-time operations center and gamified quest management system for AI agents and players. Combines agent monitoring, RPG quest mechanics (classes, companions, gacha, leveling), a REST API, and an Electron desktop companion app (Quest Forge).

## Tech Stack

- **Frontend:** Next.js 16.1.6, React 19, TypeScript 5, Tailwind CSS 4
- **Backend:** Express.js 4.18, Node.js 20, JavaScript (CommonJS)
- **Desktop:** Electron 29 (electron-builder), Quest Forge v1.5.0
- **Persistence:** JSON file storage in `/data` directory (no database)
- **Deployment:** Docker (Node 20 Alpine), Docker Compose
- **CI/CD:** GitHub Actions (Electron build on release, Windows target)

## Quick Reference Commands

```bash
# Frontend development
npm install
npm run dev          # Next.js dev server (port 3000)
npm run build        # Static export to /out
npm run start        # Next.js production server

# Backend
npm run server       # Express API server (port 3001)

# Linting
npm run lint         # ESLint

# Data validation
node scripts/verify-items.js

# Docker
docker compose build --no-cache
docker compose up -d

# Electron app
cd electron-quest-app && npm install && npm start
```

**No test suite configured.** Validation only via `scripts/verify-items.js` and ESLint.

## Project Structure

```
app/                  # Next.js app directory (7 files, ~4400 lines)
  page.tsx            # Main dashboard component (~2750 lines)
  types.ts            # Shared TypeScript interfaces (~420 lines)
  utils.ts            # Fetch helpers & utilities (~290 lines)
  config.ts           # UI configuration constants
  globals.css         # Tailwind + CSS utility classes + animations (~700 lines)
  layout.tsx          # Root layout wrapper
components/           # React UI components (33 files, ~12k lines)
  DashboardHeader.tsx # Extracted top navigation bar
  DashboardModals.tsx # Extracted modal system
  CharacterView.tsx   # Character screen + equipment (largest component)
  GachaView.tsx       # Gacha system UI + banners
  QuestPanels.tsx     # Quest display panels
  QuestModals.tsx     # Quest interaction modals
  QuestCards.tsx      # Quest card rendering
  OnboardingWizard.tsx # First-time user tutorial
  CompanionsWidget.tsx # Companion management
  WandererRest.tsx    # Companion rest/bond UI
  AgentCard.tsx       # Agent status card
  ...                 # 22 more components
lib/                  # Backend business logic (8 files, ~2900 lines)
  state.js            # Central state & JSON persistence (~1020 lines)
  helpers.js          # Utility functions (~900 lines)
  quest-catalog.js    # Quest templates
  npc-engine.js       # NPC rotation
  rotation.js         # Daily rotation logic
  gacha-engine.js     # Gacha mechanics
  middleware.js       # Express middleware (API key validation)
  quest-templates.js  # Quest template definitions
routes/               # Express API routes (14 files, ~4800 lines)
  quests.js           # Quest management (~780 lines)
  habits-inventory.js # Rituals, gear, inventory (~800 lines)
  docs.js             # OpenAPI/Swagger documentation (~650 lines)
  config-admin.js     # Admin key management
  agents.js           # Agent CRUD & status
  gacha.js            # Banner pulls, gacha state
  game.js             # Game state, config
  shop.js             # Shop items, purchases
  players.js          # Player profiles
  users.js            # User management
  campaigns.js        # Campaign quest chains
  currency.js         # Multi-currency system
  integrations.js     # Third-party hooks
  npcs-misc.js        # NPC endpoints + SPA catch-all
public/
  data/               # Game template data (32 JSON files)
  images/             # Pixel art assets (~247 files)
    portraits/        # NPC and character portraits
    companions/       # Companion icons
electron-quest-app/   # Electron desktop companion app (10 files)
scripts/              # Asset generation & data validation (5 files)
server.js             # Express entry point (~166 lines)
```

## Architecture

- **Monolithic single-process:** Next.js static export served by Express
- **State management:** Backend uses centralized `lib/state.js` global object; frontend uses React hooks with `useMemo`/`useCallback` optimizations
- **Data flow:** React components → `/api/*` endpoints → `state` object → `saveData()` writes JSON to `/data`
- **API:** RESTful routes with `requireApiKey` middleware, grouped by domain (`/api/agents/*`, `/api/quests/*`, etc.)
- **Rate limiting:** 2000 requests per 15 minutes via `express-rate-limit`
- **No ORM/DB:** All persistence is JSON files in the `/data` volume
- **Static serving:** Express serves Next.js `/out` build with cache headers (1 year for `/_next/static/`, 1 hour for images and data)

## Code Style & Conventions

- **Indentation:** 2 spaces
- **Frontend:** TypeScript, arrow functions, PascalCase components, camelCase variables
- **Backend:** JavaScript CommonJS (`require`/`module.exports`), camelCase
- **Imports:** Absolute paths via `@/*` alias (e.g., `@/components/`, `@/app/`)
- **Styling:** Tailwind utility classes + custom CSS utility classes in `globals.css`
- **Theme:** Dark theme (`#0b0d11` bg, `#e8e8e8` text, `#ff4444` accents)
- **Image rendering:** `image-rendering: smooth` (no pixelated rendering)
- **CSS utilities:** Custom classes for opacity text (`text-w20`–`text-w70`), backgrounds (`bg-surface`, `bg-card`, `bg-w3`–`bg-w8`), borders (`border-w6`–`border-w15`), modals (`modal-backdrop`), inputs (`input-dark`)
- **Comments:** Section headers with `// ─── Section ───` pattern in backend

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `API_KEY` / `API_KEYS` | API authentication keys |
| `MASTER_KEY` | Admin operations key |
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | `production` or `development` |

Template: `.env.example`

## Key Game Systems

Quest system, XP/leveling, gear/inventory with set bonuses, companions with bond levels, gacha banners with pity, daily rituals/streaks, campaign quest chains, multi-currency economy (gold, stardust, essenz).

## Important Files

| File | Role |
|------|------|
| `app/page.tsx` | Main dashboard UI (~2750 lines, largest file) |
| `app/types.ts` | All TypeScript interfaces (~420 lines) |
| `app/globals.css` | CSS utility classes + animations (~700 lines) |
| `lib/state.js` | State management & persistence (~1020 lines) |
| `lib/helpers.js` | Shared utility functions (~900 lines) |
| `server.js` | Express server entry point |
| `routes/quests.js` | Core quest API (~780 lines) |
| `routes/habits-inventory.js` | Rituals, gear, inventory (~800 lines) |
| `public/data/*.json` | Game data templates (32 files) |

## Documentation

- `README.md` — API endpoints, deployment, agents
- `BACKLOG.md` — Bugs, features, tech debt
- `BUGFIX-TASK.md` — Recent bug fix tracking
- `ITEM-SYSTEM-SPEC.md` — Gear & equipment design
- `GACHA-REBUILD-TASK.md` — Gacha redesign tasks
- `REFACTOR-TASK.md` — Code cleanup priorities
- `SCALABILITY-AUDIT.md` — Performance analysis
- `TEMPLATES.md` — Quest template formats
