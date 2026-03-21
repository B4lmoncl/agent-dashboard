# CLAUDE.md

## Project Overview

**Quest Hall / Agent Dashboard** (v1.5.3) — A real-time operations center and gamified quest management system for AI agents and players. Combines agent monitoring, RPG quest mechanics (classes, companions, gacha, leveling), a REST API, and an Electron desktop companion app (Quest Forge).

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
components/           # React UI components (47 files, ~16k lines)
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
  SocialView.tsx      # Social hub: friends, messages, trades, activity feed
  PlayerProfileModal.tsx # Steam/Diablo-style player profile modal
  TavernView.tsx      # The Hearth: rest mode with streak/forge freeze
  RiftView.tsx        # The Rift: timed dungeon quest chains
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
routes/               # Express API routes (21 files, ~8500 lines)
  quests.js           # Quest CRUD, claim, complete (~780 lines)
  habits-inventory.js # Rituals, gear, inventory, effects (~830 lines)
  config-admin.js     # Game config, leaderboard, /api/dashboard batch (~430 lines)
  docs.js             # OpenAPI/Swagger documentation (~650 lines)
  agents.js           # Agent CRUD & status
  gacha.js            # Banner pulls with pull lock, pity tracking
  game.js             # Classes, roadmap, rituals
  shop.js             # Shop items, forge challenges, workshop upgrades
  players.js          # Player profiles, companion, tavern/rest mode
  users.js            # User management, JWT auth, rate-limited login
  campaigns.js        # Campaign quest chains
  currency.js         # Multi-currency system, daily bonus
  integrations.js     # GitHub webhook (HMAC verified), catalog API
  crafting.js         # Crafting professions (Schmied, Alchemist, Verzauberer, Koch) + Schmiedekunst
  challenges-weekly.js # Sternenpfad: 3-stage solo weekly challenges with star ratings
  expedition.js       # Expedition: cooperative weekly challenge with shared checkpoints
  npcs-misc.js        # NPC endpoints, feedback (admin-only), SPA fallback
  social.js           # Friends, messages, trading, activity feed
  rift.js             # The Rift: timed dungeon quest chains (3 difficulty tiers)
  battlepass.js       # Season Pass: 40-level reward track
  factions.js         # Die Vier Zirkel: 4 factions with reputation tiers
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

Quest system (pool of ~10 open + ~25 max in-progress per player), XP/leveling (30 levels), gear/inventory with Diablo-3-style affix rolling (primary + minor stats with ranges), set bonuses and legendary effects (15 types including gameplay-changers: night gold, every-5th bonus, auto streak shield, material double, variety bonus), companions with bond levels + ultimates at Bond 5, gacha banners with pity (soft 55, hard 75), daily rituals/streaks, campaign quest chains, multi-currency economy (gold, stardust, essenz, runensplitter, sternentaler), title system (earn and equip titles displayed in player card and leaderboard), **achievement points** (common=5, uncommon=10, rare=25, epic=50, legendary=100 pts; cosmetic frame unlocks at milestones), **Artisan's Quarter** (crafting hub with 4 profession NPCs: Blacksmith/Grimvar for gear rerolling+reinforcing, Alchemist/Ysolde for buff potions+flasks, Enchanter/Eldric for gear enchanting+infusions, Cook/Bruna for meals+consumables; 2-profession limit per player; 10 levels per profession with WoW-style ranks Novice→Apprentice→Journeyman→Expert→Artisan→Master; recipe-specific XP scaling 8-50 XP; daily bonus 2x XP on first craft; recipe discovery unlocks at higher ranks; batch crafting x1-x10 for buff recipes; per-recipe cooldowns; 13 materials common→legendary from quest drops; WoW-style skill-up colors orange/yellow/green/gray; synergy hints for profession pairings), **Schmiedekunst** (dismantle items → essenz + materials with D3-style Salvage All per rarity, transmute 3 same-slot epics + 500g → 1 legendary; slot-locked selection UI), **Workshop Tools** (4-tier permanent XP upgrades: Sturdy→Masterwork→Legendary→Mythic, 2-10% XP bonus), **Sternenpfad** (solo weekly challenge: 3 stages with star ratings 1-3 per stage, max 9 stars; weekly modifiers +50%/-25% per quest type; speed bonus +1★ if stage completed within 2 days; star-scaled rewards +15% at 2★, +33% at 3★; exclusive sternentaler currency), **Expedition** (cooperative weekly challenge: guild-wide shared progress toward 3+bonus checkpoints; scales with registered player count; no per-player cap so active players compensate for inactive ones; bonus checkpoint awards rotating titles), **Bazaar shop** (two categories: self-care rewards like gaming/movie/spa + gameplay boosts with temporary buff effects like XP scrolls, luck coins, streak shields — buffs applied server-side on purchase via `applyShopEffect()`), **Social System "The Breakaway"** (friends with 3-tier online status online/idle/offline via `lastActiveAt` tracking, direct messaging with auto-read receipts and double-checkmark indicators, item+gold trading with negotiation rounds and D3-style rarity-colored item display with stat tooltips, WoW Guild News-style activity feed showing quest completions, level-ups, achievements, epic+ gacha pulls, rare drops and trades from friends with compact/detailed view toggle; friends displayed as card grid instead of list; activity log capped at 500 events; **Player Search** with debounced autocomplete for finding and adding friends; **Player Profiles** Steam/Diablo-style modal showing equipment, achievements, professions, companion, online status — accessible from leaderboard, friends list, and search results), **Daily Missions** (HSR-style daily checklist with 6 missions: login, quests, rituals, companion, crafting; 4 milestone reward tiers at 100/300/500/750 points with currency rewards), **Workshop Upgrades** (4 permanent bonus items in Artisan's Quarter: Gold-Forged Tools +2-5% gold, Loot Chance Amulet +1-3% drop, Streak Shield Charm auto-save 1x/week, Material Magnet +5-15% material chance; all additive bonuses with tiered progression), **The Hearth** (tavern/rest mode: freeze streaks + forge temp for 1-7 days; optional reason; auto-expire; 30-day cooldown; rest history; room within The Breakaway floor, inspired by Urithiru gathering halls), **The Rift** (dungeon system: timed quest chains with 3 tiers — Normal 3 quests/72h, Hard 5/48h, Legendary 7/36h; escalating difficulty 1x→3.5x; fail cooldown 3/5/7 days; completion bonuses; new room in Great Halls), **Season Pass** (40-level reward track: XP from quests 10-50 by rarity, rituals 8, vow clean days 5, daily mission milestones; rewards include gold, essenz, runensplitter, stardust, exclusive titles, cosmetic frames; claim per level), **Die Vier Zirkel** (faction system: 4 factions — Orden der Klinge/combat, Zirkel der Sterne/knowledge, Pakt der Wildnis/nature, Bund der Schatten/stealth; 6 rep tiers Neutral→Friendly→Honored→Revered→Exalted→Paragon; auto-rep +10-30 from quest completion based on quest type; tier rewards: titles, recipes, frames, shop discounts, legendary effects; claimable per tier), **GameTooltip System** (rich tooltip framework with 50+ registry entries covering all stats, currencies, and systems; cross-reference sub-tooltips via GTRef; 800ms hover delay; pin-on-complete; close via click-outside or ESC; absolute positioning with scroll tracking).

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
| `routes/social.js` | Social system: friends, messages, trades, activity feed |
| `components/SocialView.tsx` | Social UI: card grid friends, messages, trades, activity feed |
| `components/PlayerProfileModal.tsx` | Steam/Diablo-style player profile modal |
| `routes/rift.js` | The Rift: timed dungeon quest chains (3 tiers) |
| `components/RiftView.tsx` | Rift UI: tier selection, stage tracking, rewards |
| `routes/players.js` | Player profiles, companion, tavern/rest mode |
| `components/TavernView.tsx` | The Hearth: rest mode with streak/forge freeze |
| `app/config.ts` | UI config: floor/room navigation, type/priority colors |
| `routes/battlepass.js` | Season Pass: 40-level reward track with XP sources |
| `components/BattlePassView.tsx` | Season Pass UI: level track, reward claiming |
| `routes/factions.js` | Die Vier Zirkel: 4 factions with rep tiers |
| `components/FactionsView.tsx` | Faction UI: rep bars, tier rewards |
| `components/GameTooltip.tsx` | Tooltip system: 50+ registry entries with cross-refs |

## Documentation

- `README.md` — API endpoints, deployment, agents
- `ARCHITECTURE.md` — System architecture for LLMs and developers
- `LYRA-PLAYBOOK.md` — Content creation guide (NPCs, items, quests, gear, gacha)
- `BACKLOG.md` — Bugs, features, tech debt
- `ITEM-SYSTEM-SPEC.md` — Gear & equipment design
- `SCALABILITY-AUDIT.md` — Performance analysis
- `TEMPLATES.md` — Quest template formats
