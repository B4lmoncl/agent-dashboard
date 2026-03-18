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
| `app/` | Next.js app directory (page, types, utils) | TypeScript |
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

All runtime data lives in the `state` object, which is a global singleton imported by all route files. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `state.users` | Object (keyed by lowercase userId) | Player profiles |
| `state.quests` | Array | All quests (open, completed, etc.) |
| `state.campaigns` | Array | Campaign quest chains |
| `state.rituals` | Object `{active, completed, vows}` | Player rituals |
| `state.habits` | Array | Tracked habits |
| `state.npcState` | Object | Active NPCs, cooldowns, quest IDs |
| `state.gachaState` | Object (keyed by playerId) | Pity counters, pull history |
| `state.questCatalogById` | Map | O(1) quest template lookup |
| `state.gearById` | Map | O(1) gear item lookup |
| `state.itemTemplates` | Map | O(1) consumable item lookup |
| `state.validApiKeys` | Set | Valid API keys for auth |

### Save pattern

Saves use **debouncing** (200ms) to coalesce rapid writes:
```js
debouncedSave('users', () => writeFileSync(FILES.USERS, ...));
```
On shutdown, `flushPendingSaves()` executes all pending writes immediately.

**Important**: Saves are still synchronous (`writeFileSync`). The debounce prevents thrashing, but each write blocks the event loop briefly.

## Route Structure

All routes are mounted in `server.js` in order. The last route file (`npcs-misc.js`) contains the SPA catch-all `GET /*`.

| File | Key Endpoints | Auth |
|------|---------------|------|
| `agents.js` | Agent CRUD, heartbeat, commands, `/api/health` | API key |
| `quests.js` | Quest CRUD, claim, complete, bulk ops | API key |
| `config-admin.js` | Game config, leaderboard, quest pool, admin keys | Master key (admin) |
| `users.js` | Registration, JWT auth, XP awards, streaks | Rate-limited login |
| `players.js` | Player profiles, companions, favorites | Mixed |
| `shop.js` | Gear purchase, shop items, forge challenges | API key |
| `currency.js` | Currency earn/spend/convert | API key |
| `gacha.js` | Banner pulls (1x, 10x), pity tracking | API key + pull lock |
| `game.js` | Classes, roadmap, rituals | Mixed |
| `habits-inventory.js` | Habits, inventory, equipment, item effects | API key |
| `integrations.js` | GitHub webhook, Spotify (placeholder), catalog | Webhook signature |
| `campaigns.js` | Campaign CRUD, quest chains | API key |
| `npcs-misc.js` | NPC rotation, feedback, SPA fallback | Master key (feedback) |
| `docs.js` | OpenAPI spec, HTML docs | Public |

### Authentication layers

1. **API Key** (`requireApiKey` / `requireAuth`): Header `X-API-Key` or JWT Bearer token
2. **Master Key** (`requireMasterKey`): For admin operations (key management, NPC rotation)
3. **JWT**: Login returns access + refresh tokens. Refresh cookie at `/api/auth`
4. **Pull Lock**: Per-player mutex prevents concurrent gacha pulls
5. **Rate Limit**: Global 2000 req/15min + 10 req/min on auth endpoints

## Pagination

GET endpoints support optional pagination via query params:
```
?limit=50&offset=0
```
Returns: `{ items, total, limit, offset, hasMore }`

Without `?limit`, endpoints return all data (backward compatible).

Supported on: `/api/users`, `/api/feedback`, `/api/catalog`.

## Game Systems

### Quest lifecycle
```
suggested → open → claimed → completed
                 → unclaimed (released back)
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
- **Gold**: Primary currency (quest rewards, shop purchases)
- **Stardust**: Premium currency
- **Essenz**: Crafting currency
- **Runensplitter**: Gacha currency
- Conversion between currencies with 20% tax

## Security measures

- GitHub webhook signature verification (HMAC-SHA256 via `GITHUB_WEBHOOK_SECRET` env var)
- Auth rate limiting (10 attempts/min/IP on login/register)
- Feedback endpoints require master key (admin only)
- JWT with refresh token rotation
- API key validation via Set (O(1) lookup)

## Memory management

- `todayCompletions`: Pruned hourly — only today's entries kept
- `departureNotifications`: Capped at 50 most recent
- `revokedRefreshTokens`: Pruned hourly (tokens older than 1h removed)
- Debounced saves prevent disk thrashing

## Known limitations

- **No database**: JSON file persistence limits concurrent writes and scalability
- **Synchronous saves**: `writeFileSync` blocks event loop briefly
- **No clustering**: Single-process, single-thread
- **Effect handler**: Large switch statement in `habits-inventory.js` (25+ cases) — not data-driven yet
- **Quest lookups**: `state.quests` is an array — lookups are O(n). Map index exists only for templates (`questCatalogById`), not active quests
- **No schema validation**: JSON files parsed without schema enforcement

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `API_KEY` / `API_KEYS` | Yes | API authentication (comma-separated) |
| `MASTER_KEY` | No | Admin operations |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | `production` or `development` |
| `GITHUB_WEBHOOK_SECRET` | No | Webhook HMAC verification |
