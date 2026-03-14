# CLAUDE.md - Quest Hall Agent Dashboard

## Project Overview

Quest Hall is a gamified quest management and achievement system for the OpenClaw Revenue Team. It provides an operations dashboard for 7 AI agents (Nova, Hex, Echo, Pixel, Atlas, Lyra, Forge) with XP/leveling, quest boards, NPC quest chains, gacha/pull mechanics, and character progression.

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4
- **Backend**: Node.js 20 + Express 4
- **Desktop App**: Electron 29 (in `electron-quest-app/`)
- **Deployment**: Docker (Alpine), GitHub Actions, GitHub Pages
- **Output**: Static export (`next build` → `/out/`)

## Repository Structure

```
├── app/                    # Next.js frontend
│   ├── page.tsx            # Main dashboard (~7900 lines, monolith)
│   ├── config.ts           # Color schemes, icons, badge mappings
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # Fetch helpers, formatters
├── components/             # React components (~33 TSX files)
├── server.js               # Express API entry point (port 3001)
├── routes/                 # Express route handlers (14 files)
│   ├── agents.js           # Agent status, registration
│   ├── quests.js           # Quest CRUD, completion, rewards
│   ├── config-admin.js     # Admin key management
│   ├── users.js            # User accounts
│   ├── players.js          # Character progression
│   ├── shop.js             # Shop/cosmetics economy
│   ├── gacha.js            # Gacha/pull system
│   ├── npcs-misc.js        # NPC spawning, quests
│   ├── campaigns.js        # Campaign management
│   ├── game.js             # Game mechanics
│   ├── currency.js         # Currency operations
│   ├── habits-inventory.js # Habits and gear
│   ├── docs.js             # API documentation
│   └── integrations.js     # External integrations
├── lib/                    # Shared backend logic
│   ├── state.js            # Central state management (~954 lines)
│   ├── helpers.js          # XP/gold calculations, level progression
│   ├── middleware.js        # API key auth middleware
│   ├── npc-engine.js       # NPC spawn/departure logic
│   ├── quest-catalog.js    # Quest pool and rotation
│   ├── gacha-engine.js     # Gacha/pull mechanics
│   ├── rotation.js         # Daily quest rotation
│   └── quest-templates.js  # Quest templating
├── public/data/            # JSON templates (29 files, immutable content)
├── public/images/          # Static assets
├── electron-quest-app/     # Electron desktop companion app
├── .github/workflows/      # CI/CD (deploy.yml, build-release.yml)
├── Dockerfile              # Node 20 Alpine container
└── docker-compose.yml      # Single-service orchestration
```

## Development Commands

```bash
# Frontend development
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Build static export to /out/
npm run start        # Start production Next.js server

# Backend
npm run server       # Start Express API (PORT=3001)

# Linting
npm run lint         # Run ESLint

# Electron app (from electron-quest-app/)
npm start            # Dev mode
npm run build        # Build all platforms
npm run build:win    # Windows only
npm run build:mac    # macOS only
npm run build:linux  # Linux only
```

## Architecture Notes

### Backend

- **Centralized state** in `lib/state.js` — single source of truth for all runtime data
- Template JSON files in `/public/data/` are immutable; runtime state lives in `/data/` (Docker volume)
- Route handlers in `routes/` are modular; each file covers one domain
- Auth via `X-API-Key` header; master key for admin ops (`lib/middleware.js`)
- Rate limiting: 2000 requests per 15 minutes

### Frontend

- Static export mode (`output: 'export'` in `next.config.js`) — no SSR
- Images are unoptimized (`unoptimized: true`)
- Client-side data fetching with abort signals
- Path alias: `@/*` maps to project root

### Data System

- 29 JSON template files drive all content (quests, NPCs, gear, achievements, etc.)
- No code changes needed to add content — only JSON edits
- See `TEMPLATES.md` for the data-driven content guide
- See `public/data/NPC_TEMPLATE.md` for NPC schema

## Key Conventions

### Code Style

- TypeScript strict mode enabled (frontend)
- Backend routes and libs are plain JavaScript (`.js`)
- ESLint v9 flat config with Next.js core web vitals + TypeScript rules
- Tailwind CSS for all styling — no separate CSS files
- React hooks only (no class components)

### File Patterns

- Components: `components/ComponentName.tsx` (PascalCase)
- Routes: `routes/domain-name.js` (kebab-case)
- Libraries: `lib/module-name.js` (kebab-case)
- Data templates: `public/data/camelCase.json`

### API Design

- RESTful JSON endpoints
- All mutation endpoints require API key auth
- Response format: `{ success: true, data: ... }` or `{ error: "message" }`

## Environment Variables

```
PORT=3001              # Server port
API_KEY=<key>          # Single API key (backward compat)
API_KEYS=<k1>,<k2>    # Comma-separated keys for multiple agents
MASTER_KEY=<key>       # Admin key (defaults to first API_KEY)
NODE_ENV=production    # production/development
```

See `.env.example` for reference.

## Docker

```bash
docker-compose up -d   # Start service
# Runtime state persists in /app/data/ (volume mount)
# Static frontend served from /app/out/
```

## Known Technical Debt

- `app/page.tsx` is ~7900 lines (monolith component needing decomposition)
- Large components: `QuestPanels.tsx` (55KB), `GachaView.tsx` (49KB), `CharacterView.tsx` (40KB)
- Duplicate data sources for shop items, gear, and achievements (see `REFACTOR-TASK.md`)
- Some placeholder icons (`icon: "x"`) in UI components (see `BUGFIX-TASK.md`)
- No JSON Schema validation for template imports
- See `SCALABILITY-AUDIT.md` for full architecture recommendations

## CI/CD

- **deploy.yml**: Push to `main` → build Next.js → deploy to GitHub Pages
- **build-release.yml**: GitHub release created → build Electron app for Windows → upload artifacts
