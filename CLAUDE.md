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
app/                  # Next.js app directory
  page.tsx            # Main dashboard component (~2150 lines)
  types.ts            # Shared TypeScript interfaces (~540 lines)
  utils.ts            # Fetch helpers, fetchDashboard batch, level utils (~320 lines)
  config.ts           # UI configuration constants
  globals.css         # Tailwind + CSS utilities + animations (~720 lines)
  layout.tsx          # Root layout wrapper
  DashboardContext.tsx # React context for shared state
components/           # React UI components (39 files, ~13k lines)
  DashboardHeader.tsx # Top navigation bar
  DashboardModals.tsx # Modal system (currencies, modifiers, info)
  CharacterView.tsx   # Character screen + equipment (lazy-loaded)
  GachaView.tsx       # Gacha system UI + banners (lazy-loaded)
  QuestCards.tsx      # Quest card rendering (React.memo wrapped)
  AgentCard.tsx       # Agent status card (React.memo wrapped)
  GuildHallBackground.tsx # Dynamic sky canvas + layered foreground
  QuestBoard.tsx      # Quest board barrel export
  CompanionsWidget.tsx # Companion management
  WandererRest.tsx    # NPC board / Wanderer's Rest
  OnboardingWizard.tsx # First-time user tutorial
  ForgeView.tsx       # Crafting/Professions UI (Schmied, Alchemist, Verzauberer)
  UserCard.tsx        # Player card with frame, title, stats
  LeaderboardView.tsx # Proving Grounds leaderboard
  ChallengesView.tsx  # Weekly challenges (Sternenpfad + Expedition) (lazy-loaded)
  ...                 # 26 more components
hooks/                # React custom hooks
  useQuestActions.ts  # Quest action handlers (claim, complete, approve, etc.)
lib/                  # Backend business logic (8 files, ~3800 lines)
  state.js            # Central state, Maps, JSON persistence (~1060 lines)
  helpers.js          # Utility functions, paginate() (~920 lines)
  auth.js             # JWT, refresh tokens, API key auth
  quest-catalog.js    # Quest template seeding
  npc-engine.js       # NPC rotation & spawning
  rotation.js         # Daily quest rotation logic
  middleware.js       # Express middleware (auth, master key)
  quest-templates.js  # Quest template interpolation
routes/               # Express API routes (17 files, ~6200 lines)
  quests.js           # Quest CRUD, claim, complete (~780 lines)
  habits-inventory.js # Rituals, gear, inventory, effects (~830 lines)
  config-admin.js     # Game config, leaderboard, /api/dashboard batch (~430 lines)
  docs.js             # OpenAPI/Swagger documentation (~650 lines)
  agents.js           # Agent CRUD & status
  gacha.js            # Banner pulls with pull lock, pity tracking
  game.js             # Classes, roadmap, rituals
  shop.js             # Shop items, forge challenges
  players.js          # Player profiles
  users.js            # User management, JWT auth, rate-limited login
  campaigns.js        # Campaign quest chains
  currency.js         # Multi-currency system
  integrations.js     # GitHub webhook (HMAC verified), catalog API
  crafting.js         # Crafting professions (Schmied, Alchemist, Verzauberer, Koch) + Schmiedekunst
  challenges-weekly.js # Sternenpfad: 3-stage solo weekly challenges with star ratings
  expedition.js       # Expedition: cooperative weekly challenge with shared checkpoints
  npcs-misc.js        # NPC endpoints, feedback (admin-only), SPA fallback
public/
  data/               # Game template data (36 JSON files)
  images/             # Pixel art assets (~250 files)
    portraits/        # NPC and character portraits
    companions/       # Companion icons
    npcs/             # NPC portraits
electron-quest-app/   # Electron desktop companion app (10 files)
scripts/              # Asset generation & data validation (5 files)
server.js             # Express entry point, boot sequence (~289 lines)
```

## Architecture

- **Monolithic single-process:** Next.js static export served by Express
- **State management:** Backend uses centralized `lib/state.js` with O(1) Maps (`questsById`, `usersByName`, `usersByApiKey`, `questCatalogById`, `gearById`, `itemTemplates`); frontend uses React hooks with `useMemo`/`useCallback`
- **Data flow:** React components → `/api/*` endpoints → `state` object → debounced `saveData()` writes JSON to `/data`
- **Batch endpoint:** `GET /api/dashboard?player=X` returns agents, quests, users, achievements, campaigns, rituals, habits, favorites, NPCs in one call (replaces 14 separate fetches)
- **API:** RESTful routes with `requireApiKey`/`requireAuth` middleware, grouped by domain
- **Rate limiting:** Global 2000 req/15min + 10 req/min on auth endpoints
- **Code splitting:** View components (CharacterView, GachaView, ShopView, etc.) lazy-loaded via `React.lazy()` + `Suspense`
- **Performance:** Quest cards wrapped with `React.memo`, `content-visibility: auto` for offscreen cards, GPU-accelerated scrolling
- **No ORM/DB:** All persistence is JSON files in the `/data` volume
- **Static serving:** Express serves Next.js `/out` build with cache headers

## Code Style & Conventions

- **Indentation:** 2 spaces
- **Frontend:** TypeScript, arrow functions, PascalCase components, camelCase variables
- **Backend:** JavaScript CommonJS (`require`/`module.exports`), camelCase
- **Imports:** Absolute paths via `@/*` alias (e.g., `@/components/`, `@/app/`)
- **Styling:** Tailwind utility classes + custom CSS utility classes in `globals.css`
- **Theme:** Dark theme (`#0b0d11` bg, `#e8e8e8` text, `#ff4444` accents)
- **Image rendering:** `image-rendering: smooth` (no pixelated rendering)
- **CSS utilities:** Custom classes for opacity text (`text-w20`–`text-w70`), backgrounds (`bg-surface`, `bg-card`, `bg-w3`–`bg-w8`), borders (`border-w6`–`border-w15`), modals (`modal-backdrop`), inputs (`input-dark`), performance (`cv-auto`)
- **Comments:** Section headers with `// ─── Section ───` pattern in backend
- **Quest lookups:** Always use `state.questsById.get(id)` — never `state.quests.find()`
- **User lookups:** Use `state.usersByName.get(name)` or `state.usersByApiKey.get(key)` — never `Object.values(state.users).find()`
- **After state.quests.push(q):** Always add `state.questsById.set(q.id, q)`
- **After state.quests reassignment:** Always call `rebuildQuestsById()`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `API_KEY` / `API_KEYS` | API authentication keys |
| `MASTER_KEY` | Admin operations key |
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | `production` or `development` |
| `GITHUB_WEBHOOK_SECRET` | Webhook HMAC-SHA256 verification |

Template: `.env.example`

## Key Game Systems

Quest system (pool of ~10 open + ~25 max in-progress per player), XP/leveling (30 levels), gear/inventory with Diablo-3-style affix rolling (primary + minor stats with ranges), set bonuses and legendary effects (15 types including gameplay-changers: night gold, every-5th bonus, auto streak shield, material double, variety bonus), companions with bond levels + ultimates at Bond 5, gacha banners with pity (soft 55, hard 75), daily rituals/streaks, campaign quest chains, multi-currency economy (gold, stardust, essenz, runensplitter, sternentaler), title system (earn and equip titles displayed in player card and leaderboard), **achievement points** (common=5, uncommon=10, rare=25, epic=50, legendary=100 pts; cosmetic frame unlocks at milestones), **Artisan's Quarter** (crafting hub with 4 profession NPCs: Blacksmith/Grimvar for gear rerolling+reinforcing, Alchemist/Ysolde for buff potions+flasks, Enchanter/Eldric for gear enchanting+infusions, Cook/Bruna for meals+consumables; 2-profession limit per player; 10 levels per profession with WoW-style ranks Novice→Apprentice→Journeyman→Expert→Artisan→Master; recipe-specific XP scaling 8-50 XP; daily bonus 2x XP on first craft; recipe discovery unlocks at higher ranks; batch crafting x1-x10 for buff recipes; per-recipe cooldowns; 13 materials common→legendary from quest drops; WoW-style skill-up colors orange/yellow/green/gray; synergy hints for profession pairings), **Schmiedekunst** (dismantle items → essenz + materials with D3-style Salvage All per rarity, transmute 3 same-slot epics + 500g → 1 legendary; slot-locked selection UI), **Workshop Tools** (4-tier permanent XP upgrades: Sturdy→Masterwork→Legendary→Mythic, 2-10% XP bonus), **Sternenpfad** (solo weekly challenge: 3 stages with star ratings 1-3 per stage, max 9 stars; weekly modifiers +50%/-25% per quest type; speed bonus +1★ if stage completed within 2 days; star-scaled rewards +15% at 2★, +33% at 3★; exclusive sternentaler currency), **Expedition** (cooperative weekly challenge: guild-wide shared progress toward 3+bonus checkpoints; scales with registered player count; no per-player cap so active players compensate for inactive ones; bonus checkpoint awards rotating titles), **Bazaar shop** (two categories: self-care rewards like gaming/movie/spa + gameplay boosts with temporary buff effects like XP scrolls, luck coins, streak shields — buffs applied server-side on purchase via `applyShopEffect()`).

## Important Files

| File | Role |
|------|------|
| `app/page.tsx` | Main dashboard UI (~2150 lines) |
| `app/types.ts` | All TypeScript interfaces (~540 lines) |
| `app/utils.ts` | Fetch helpers, `fetchDashboard()` batch, level system |
| `app/globals.css` | CSS utility classes + animations (~720 lines) |
| `lib/state.js` | State management, Maps, persistence (~1060 lines) |
| `lib/helpers.js` | Shared utilities, `paginate()` (~920 lines) |
| `lib/auth.js` | JWT auth, refresh tokens, API key resolution |
| `server.js` | Express entry, boot sequence, memory pruning |
| `routes/quests.js` | Core quest API (~780 lines) |
| `routes/config-admin.js` | Game config, leaderboard, `/api/dashboard` batch |
| `routes/habits-inventory.js` | Rituals, gear, inventory (~830 lines) |
| `public/data/*.json` | Game data templates (36+ files) |
| `public/data/titles.json` | Title definitions with conditions |
| `public/data/gearTemplates.json` | Gear items, set bonuses, legendary effects |
| `public/data/professions.json` | Crafting professions, materials, recipes |
| `public/data/achievementTemplates.json` | Achievements with points + point milestones |
| `routes/shop.js` | Bazaar shop (self-care + boost items with effects) |
| `routes/crafting.js` | Crafting profession routes (craft, materials) |
| `components/ForgeView.tsx` | Forge UI with NPC popouts for crafting |
| `routes/challenges-weekly.js` | Sternenpfad: 3-stage solo weekly challenges |
| `routes/expedition.js` | Expedition: cooperative weekly challenge |
| `components/ChallengesView.tsx` | Challenges UI (Sternenpfad + Expedition toggle) |
| `public/data/weeklyChallenges.json` | Weekly challenge templates, modifiers, star thresholds |
| `public/data/expeditions.json` | Expedition templates, checkpoint rewards, bonus titles |
| `hooks/useQuestActions.ts` | Quest action handlers (claim, complete, approve, etc.) |

## Documentation

- `README.md` — API endpoints, deployment, agents
- `ARCHITECTURE.md` — System architecture for LLMs and developers
- `LYRA-PLAYBOOK.md` — Content creation guide (NPCs, items, quests, gear, gacha)
- `BACKLOG.md` — Bugs, features, tech debt
- `ITEM-SYSTEM-SPEC.md` — Gear & equipment design
- `SCALABILITY-AUDIT.md` — Performance analysis
- `TEMPLATES.md` — Quest template formats
