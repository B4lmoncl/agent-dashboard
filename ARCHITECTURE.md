# Architecture Guide

> For LLMs and developers working on QuestHall. This document explains how the system works, where things live, and what to watch out for.

## System Overview

QuestHall is a monolithic Node.js application: an Express API server that also serves a Next.js static frontend. All persistence is JSON files on disk — no database.

```
Browser → Express (port 3001) → lib/state.js (in-memory) → /data/*.json (disk)
                              → /out/ (static Next.js build)
```

## Directory Map

| Directory | Purpose | Language |
|-----------|---------|----------|
| `lib/` | Backend business logic (state, helpers, engines) | JS (CommonJS) |
| `routes/` | Express route handlers (14 files) | JS (CommonJS) |
| `app/` | Next.js app directory (page, types, utils, context) | TypeScript |
| `components/` | React UI components (36 files) | TypeScript |
| `public/data/` | Read-only game templates (JSON) | JSON |
| `data/` | Runtime persistent data (Docker volume) | JSON |
| `server.js` | Express entry point, boot sequence | JS |

## Data Flow

### Two directories, two purposes

```
public/data/  (DATA_DIR)     → Read-only templates shipped with the image
data/         (RUNTIME_DIR)  → Mutable runtime state (Docker volume mount)
```

Files in `public/data/` are **templates** — they define what items, NPCs, quests etc. exist.
Files in `data/` are **runtime state** — they track what players have done, their inventory, quest progress, etc.

On first boot, `ensureRuntimeFiles()` seeds `data/` with empty defaults. `seedMutableFiles()` copies templates that need to be mutable (questCatalog, classes, roadmap) from `public/data/` to `data/`.

### State management (lib/state.js)

All runtime data lives in the `state` object, which is a global singleton imported by all route files.

#### Primary data

| Field | Type | Description |
|-------|------|-------------|
| `state.users` | Object (keyed by lowercase userId) | Player profiles |
| `state.quests` | Array | All quests (open, completed, etc.) |
| `state.campaigns` | Array | Campaign quest chains |
| `state.rituals` | Object `{active, completed, vows}` | Player rituals |
| `state.habits` | Array | Tracked habits |
| `state.npcState` | Object | Active NPCs, cooldowns, quest IDs |
| `state.gachaState` | Object (keyed by playerId) | Pity counters, pull history |

#### O(1) lookup Maps (IMPORTANT — always use these instead of array scans)

| Map | Keyed by | Description |
|-----|----------|-------------|
| `state.questsById` | quest ID | O(1) quest lookup — **always use instead of `state.quests.find()`** |
| `state.usersByName` | lowercase name | O(1) user lookup by name — **use for login/register** |
| `state.usersByApiKey` | API key string | O(1) user lookup by API key — **use for auth** |
| `state.questCatalogById` | template ID | O(1) quest template lookup |
| `state.gearById` | gear item ID | O(1) gear item lookup |
| `state.itemTemplates` | item ID | O(1) consumable item lookup |
| `state.validApiKeys` | (Set) | O(1) API key validation |

#### Keeping Maps in sync

When mutating `state.quests`:
```js
// After push:
state.quests.push(quest);
state.questsById.set(quest.id, quest);  // ← ALWAYS ADD THIS

// After reassignment (filter/replace):
state.quests = state.quests.filter(...);
rebuildQuestsById();  // ← ALWAYS CALL THIS

// After user creation:
state.usersByName.set(name.toLowerCase(), user);
state.usersByApiKey.set(apiKey, user);
```

### Save pattern

Saves use **debouncing** (200ms) to coalesce rapid writes:
```js
debouncedSave('users', () => writeFileSync(FILES.USERS, ...));
```
On shutdown, `flushPendingSaves()` executes all pending saves immediately (not just cancels timers).

**Important**: Saves are still synchronous (`writeFileSync`). The debounce prevents thrashing, but each write blocks the event loop briefly.

## Route Structure

All routes are mounted in `server.js` in order. The last route file (`npcs-misc.js`) contains the SPA catch-all `GET /*`.

| File | Key Endpoints | Auth |
|------|---------------|------|
| `agents.js` | Agent CRUD, heartbeat, commands, `/api/health` | API key |
| `quests.js` | Quest CRUD, claim, complete, bulk ops | API key |
| `config-admin.js` | Game config, leaderboard, **`/api/dashboard`** batch, quest pool, admin keys | Mixed |
| `users.js` | Registration, JWT auth, XP awards, streaks | Rate-limited login |
| `players.js` | Player profiles, companions, favorites | Mixed |
| `shop.js` | Gear purchase, shop items, forge challenges | API key |
| `currency.js` | Currency earn/spend/convert | API key |
| `gacha.js` | Banner pulls (1x, 10x), pity tracking | API key + pull lock |
| `game.js` | Classes, roadmap, rituals | Mixed |
| `habits-inventory.js` | Habits, inventory, equipment, item effects | API key |
| `integrations.js` | GitHub webhook (HMAC verified), catalog API | Webhook signature |
| `campaigns.js` | Campaign CRUD, quest chains | API key |
| `npcs-misc.js` | NPC rotation, feedback (admin-only), SPA fallback | Master key (feedback) |
| `docs.js` | OpenAPI spec, HTML docs | Public |

### Batch Dashboard Endpoint

`GET /api/dashboard?player=X` returns everything the frontend needs in **one call** instead of 14 separate fetches:

```json
{
  "agents": [...],
  "quests": { "open": [...], "inProgress": [...], "completed": [...], "suggested": [...], "rejected": [...] },
  "users": [...],
  "achievements": [...],
  "campaigns": [...],
  "rituals": [...],
  "habits": [...],
  "favorites": [...],
  "activeNpcs": [...],
  "apiLive": true
}
```

The frontend tries this first, falls back to individual fetches if unavailable.

### Authentication layers

1. **API Key** (`requireApiKey` / `requireAuth`): Header `X-API-Key` or JWT Bearer token
2. **Master Key** (`requireMasterKey`): For admin operations (key management, NPC rotation, feedback)
3. **JWT**: Login returns access + refresh tokens. Refresh cookie at `/api/auth`
4. **Pull Lock**: Per-player mutex prevents concurrent gacha pulls (in-memory Map)
5. **Rate Limit**: Global 2000 req/15min + 10 req/min on login/register endpoints
6. **Webhook**: GitHub webhook verified via HMAC-SHA256 (`GITHUB_WEBHOOK_SECRET` env var)

## Pagination

GET endpoints support optional pagination via query params:
```
?limit=50&offset=0
```
Returns: `{ items, total, limit, offset, hasMore }`

Without `?limit`, endpoints return all data (backward compatible).

Supported on: `/api/users`, `/api/feedback`, `/api/catalog`.

Use `paginate(array, req.query)` helper from `lib/helpers.js`.

## Gear & Equipment System

- **6 Slots**: weapon, shield, helm, armor, amulet, boots
- **4 Tiers**: Abenteurer (L1-8), Veteranen (L9-16), Meister (L17-24), Legendär (L25-30)
- **Stats**: kraft, ausdauer, weisheit, glueck — summed from equipped items
- **Tier Set Bonuses**: 3/6 = +5% all stats, 6/6 = +10% all stats (auto-detected by tier)
- **Named Set Bonuses**: Defined in `gearTemplates.json → namedSets[]`. Support partial (2/3 threshold) and full bonuses.
- **Legendary Effects**: Items with `rarity: "legendary"` can have a `legendaryEffect` field. Types: `xp_bonus`, `gold_bonus`, `drop_bonus`, `decay_reduction`, `streak_protection`. Applied via `getLegendaryModifiers()` in `lib/helpers.js`.
- **Stat effects**: Kraft → +1% XP, Weisheit → +1% Gold, Ausdauer → -0.5% forge decay, Glück → +0.5% drop chance

## Title System

- **Definitions**: `public/data/titles.json` — each title has `id`, `name`, `rarity`, `condition`
- **Conditions**: `level`, `quests_completed`, `streak`, `inventory_count`, `gold`, `npc_chains`, `forge_temp`, `gacha_legendary`, `full_equipment`
- **Award**: `checkAndAwardTitles(userId)` runs on quest completion. Earned titles stored in `user.earnedTitles[]`.
- **Equip**: `POST /api/player/:name/title/equip` with `{ titleId }` or `{ titleId: null }` to unequip
- **Display**: Equipped title shown in Player Card (page.tsx) and Leaderboard (LeaderboardView.tsx)

## Frontend Architecture

### Code splitting

View components are lazy-loaded with `React.lazy()` + `Suspense`:
- `LeaderboardView`, `HonorsView`, `CVBuilderPanel`, `CampaignHub`
- `ShopView`, `GachaView`, `CharacterView`, `RitualChamber`, `ForgeView`

Only loaded when the tab is activated — reduces initial bundle by ~40%.

### Performance optimizations

- **React.memo**: `QuestCard`, `CompletedQuestRow`, `EpicQuestCard`, `AgentCard` wrapped to prevent unnecessary re-renders
- **content-visibility**: `.cv-auto` CSS class on quest cards — browser skips rendering offscreen cards
- **GPU scrolling**: `will-change: scroll-position` on body
- **useMemo/useCallback**: Filter and sort functions memoized
- **Batch fetch**: `fetchDashboard()` replaces 14 individual API calls with 1

### Quest pool constraints

The quest system limits what players see:
- **~10 open quests** in the daily pool (rotated)
- **Max ~25 in-progress** before XP malus makes it pointless (80% penalty at 30+)
- **Total visible:** ~35 quest cards maximum — no virtual scrolling needed

## Game Systems

### Quest lifecycle
```
suggested → open → claimed (in_progress) → completed
                 → unclaimed (released back to open)
```

Quests can be: player-created, NPC-generated, GitHub webhook-generated, daily rotation, or template-spawned.

### NPC system
- NPCs rotate via `npc-engine.js` — spawn with cooldowns, stay for X days, then depart
- Each NPC has quest chains defined in `npcQuestGivers.json`
- Permanent NPCs (Dobbie, Lyra) never depart

### Gacha system
- Two banner types: Standard, Featured
- Pity system: soft pity at 35 pulls, hard pity at 50 (legendary guaranteed)
- Epic pity: guaranteed every 10 pulls
- Duplicate items refund currency (Runensplitter)
- Per-player pull lock prevents race conditions

### XP & Leveling
- 30 levels defined in `levels.json`
- XP multiplied by: forge temp, kraft stat, gear bonus, companion bonus, bond level, hoarding malus
- Gold multiplied by: forge temp, weisheit stat, streak bonus

### Currency system
- **Gold**: Primary currency (quest rewards, shop purchases, crafting costs)
- **Stardust**: Premium currency (level-up rewards, season rewards)
- **Essenz**: Crafting currency
- **Runensplitter**: Gacha currency
- Conversion between currencies with 20% tax

### Companion Ultimates
- **Unlock**: Bond Level 5 ("Best Friend")
- **Cooldown**: 7 days per use
- **3 Abilities**: Instant quest complete, double next reward, +3 streak days
- **Visual**: Golden glow + breathing animation on widget (4s)
- **Buff system**: `double_reward` buff integrates with `onQuestCompletedByUser` via `activeBuffs`
- **Endpoint**: `POST /api/player/:name/companion/ultimate`

### Achievement Points System
- Each achievement awards points based on rarity: common=5, uncommon=10, rare=25, epic=50, legendary=100
- Points accumulate in `user.achievementPoints`
- **Cosmetic frame milestones**: At 50/100/200/350/500/750/1000/1500/2000/3000 pts, players unlock decorative frames for their UserCard
- **Title milestones**: At certain thresholds, exclusive titles are awarded
- Frames equipped via `POST /api/player/:name/frame`
- Frame renders as colored border + optional glow on UserCard

### Crafting Professions System
- **3 Professions**: Schmied (stat rerolling), Alchemist (buff potions), Verzauberer (gear enchanting)
- **Materials**: Drop from quest completion based on quest rarity (10 material types, common→legendary)
- **Material drop rates**: Defined in `professions.json → materialDropRates` — rarer quests drop rarer materials
- **Recipes**: Each has gold cost + material cost + profession level requirement + cooldown
- **Profession leveling**: 10 levels per profession, XP gained per craft
- **Unlock conditions**: Schmied/Alchemist at player level 5, Verzauberer at level 8
- **Frontend**: "Deepforge" tab with NPC popout modals (same createPortal pattern as WandererRest)
- **Endpoints**: `GET /api/professions?player=X`, `POST /api/professions/craft`
- **Data**: `public/data/professions.json` (professions, materials, recipes)

## Security measures

- GitHub webhook HMAC-SHA256 signature verification (`GITHUB_WEBHOOK_SECRET`)
- Auth rate limiting (10 attempts/min/IP on login/register)
- Feedback endpoints require master key (admin only)
- JWT with refresh token rotation
- API key validation via Set (O(1) lookup)
- User lookup via Map (O(1) — no array scan)

## Memory management

- `todayCompletions`: Pruned hourly — only today's entries kept
- `departureNotifications`: Capped at 50 most recent
- `revokedRefreshTokens`: Pruned hourly (tokens older than 1h removed)
- Debounced saves prevent disk thrashing
- `flushPendingSaves()` executes (not just cancels) pending writes on shutdown

## Known limitations

- **No database**: JSON file persistence limits concurrent writes and scalability
- **Synchronous saves**: `writeFileSync` blocks event loop briefly (debounced to 200ms)
- **No clustering**: Single-process, single-thread
- **Effect handler**: Large switch statement in `habits-inventory.js` (25+ cases) — not data-driven yet
- **No schema validation**: JSON files parsed without schema enforcement

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `API_KEY` / `API_KEYS` | Yes | API authentication (comma-separated) |
| `MASTER_KEY` | No | Admin operations |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | `production` or `development` |
| `GITHUB_WEBHOOK_SECRET` | No | Webhook HMAC verification |
