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
| `routes/` | Express route handlers (21 files) | JS (CommonJS) |
| `app/` | Next.js app directory (page, types, utils, context) | TypeScript |
| `components/` | React UI components (47 files) | TypeScript |
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
| `shop.js` | Gear purchase, shop items (self-care + boosts), forge challenges | API key |
| `currency.js` | Currency earn/spend/convert | API key |
| `gacha.js` | Banner pulls (1x, 10x), pity tracking | API key + pull lock |
| `game.js` | Classes, roadmap, rituals | Mixed |
| `habits-inventory.js` | Habits, inventory, equipment, item effects | API key |
| `integrations.js` | GitHub webhook (HMAC verified), catalog API | Webhook signature |
| `campaigns.js` | Campaign CRUD, quest chains | API key |
| `crafting.js` | Crafting professions, Schmiedekunst (dismantle/transmute) | API key |
| `challenges-weekly.js` | Sternenpfad: 3-stage solo weekly challenges with star ratings, modifiers, speed bonus | API key |
| `expedition.js` | Expedition: cooperative weekly challenge with shared checkpoints, scaling by player count | API key |
| `social.js` | Friends (online status), messages (read receipts), trades (item picker), activity feed | API key |
| `rift.js` | Rift/Dungeon: timed quest chains with 3 tiers (Normal/Hard/Legendary), full reward pipeline | API key |
| `battlepass.js` | Season Pass: 40-level reward track with XP from quests/rituals/missions | API key |
| `factions.js` | Die Vier Zirkel: 4 factions with 6 rep tiers, auto-rep from quests | API key |
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
  "weeklyChallenge": { ... },
  "expedition": { ... },
  "dailyBonusAvailable": true,
  "socialSummary": { "pendingFriendRequests": 0, "unreadMessages": 0, "activeTrades": 0 },
  "dailyMissions": { "missions": [...], "earned": 0, "total": 750, "milestones": [...] },
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
- **Stat effects**: Kraft → +0.5% XP (max +30%), Weisheit → +0.5% Gold (max +30%), Ausdauer → -0.5% forge decay (min 10% of base), Glück → +0.5% drop chance (max 20%)

## Title System

- **Definitions**: `public/data/titles.json` — each title has `id`, `name`, `rarity`, `condition`
- **Conditions**: `level`, `quests_completed`, `streak`, `inventory_count`, `gold`, `npc_chains`, `forge_temp`, `gacha_legendary`, `full_equipment`
- **Award**: `checkAndAwardTitles(userId)` runs on quest completion. Earned titles stored in `user.earnedTitles[]`.
- **Equip**: `POST /api/player/:name/title/equip` with `{ titleId }` or `{ titleId: null }` to unequip
- **Display**: Equipped title shown in Player Card (page.tsx) and Leaderboard (LeaderboardView.tsx)

## Frontend Architecture

### Code splitting

View components are lazy-loaded with `React.lazy()` + `Suspense`:
- `LeaderboardView`, `HonorsView`, `ShopView`, `GachaView`
- `CharacterView`, `RitualChamber`, `ForgeView`, `ChallengesView`
- `DailyLoginCalendar`, `SocialView`

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
- Pity system: soft pity at 55 pulls, hard pity at 75 (legendary guaranteed)
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

### Bazaar Shop System
- **Two categories**: Self-care rewards (real-world treats) + Boosts (temporary gameplay buffs)
- **Boosts**: Items with an `effect` field in `shopItems.json` — applied server-side via `applyShopEffect()` in `routes/shop.js`
- **Buff types**: `xp_boost_10`, `gold_boost_10`, `luck_boost_20`, `streak_shield`, `material_double` (quest-counted buffs added to `user.activeBuffs[]`)
- **Instant effects**: `instant_stardust`, `instant_essenz` (directly modify `user.currencies`)
- **Buff consumption**: Handled in `lib/helpers.js → onQuestCompletedByUser()` — `questsRemaining` decremented per quest, removed when 0
- **Frontend**: `ShopView.tsx` renders boosts (purple accent) above self-care (amber accent)

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

### Artisan's Quarter (Crafting System)
- **4 Professions** (2-limit per player): Blacksmith/Grimvar (gear rerolling, rarity upgrade, reinforcing), Alchemist/Ysolde (buff potions, flasks), Enchanter/Eldric (temp+permanent enchants, arcane infusions), Cook/Bruna (meals, streak shields, champion's feast)
- **18 recipes** across 4 professions with recipe-specific XP (8-50 XP per craft)
- **Recipe discovery**: High-level recipes hidden until `discovery.profLevel` reached (e.g. Rarity Upgrade unlocks at Lv.7)
- **Batch crafting**: Buff/meal recipes support `count` param (1-10), costs multiplied accordingly
- **Daily crafting bonus**: First craft each day grants 2x profession XP, tracked via `u.lastCraftDate`
- **Profession ranks** (WoW-style): Novice→Apprentice→Journeyman→Expert→Artisan→Master, mapped to levels 0-10
- **Skill-up colors** (WoW-style): Orange (guaranteed XP), Yellow (likely), Green (rare), Gray (no XP) based on diff between profLevel and reqProfLevel
- **Per-recipe cooldowns**: Tracked in `u.professions[id].recipeCooldowns[recipeId]` (60min-48h), independent per recipe
- **13 materials** (common→legendary): Drop from quest completion, rates defined in `professions.json → materialDropRates`
- **Schmiedekunst** (Blacksmith tab): Dismantle items → essenz + material drops; D3-style Salvage All per rarity (legendary excluded); Transmute 3 same-slot epics + 500g → random legendary
- **Workshop Tools**: 4-tier permanent XP upgrades (Sturdy 2% → Mythic 10%), sequential unlock via gold/essenz
- **Synergy hints**: Blacksmith+Enchanter = "Gear Mastery", Alchemist+Cook = "Sustenance"
- **Cross-navigation**: Character ↔ Artisan's Quarter links via `onNavigate` prop
- **NPC evolution**: Card border glow/opacity intensifies with rank; portrait border evolves with level
- **Pre-validation**: Reroll template/stats checks run BEFORE cost deduction to prevent resource loss on failure
- **Unlock conditions**: Cook at level 3, Blacksmith/Alchemist at level 5, Enchanter at level 8
- **Frontend**: `ForgeView.tsx` — Artisan's Quarter tab with NPC grid, Workshop Tools, NPC popout modals (createPortal)
- **Endpoints**: `GET /api/professions?player=X` (with dailyBonus), `POST /api/professions/craft` (with count), `POST /api/professions/choose`, `POST /api/professions/switch`, `POST /api/schmiedekunst/dismantle`, `POST /api/schmiedekunst/dismantle-all`, `POST /api/schmiedekunst/transmute`
- **Data**: `public/data/professions.json` (4 professions, 13 materials, 18 recipes, drop rates)

### Challenges System

Two weekly challenge types, accessible under a single "Challenges" tab with toggle buttons:

**Sternenpfad (Solo)**
- 3-stage weekly challenge with star ratings (1-3 per stage, max 9 stars)
- Template rotation: deterministic via ISO week seed (`weekSeed % templates.length`)
- **Star thresholds**: Each stage defines 3 overachievement thresholds. 1★ at threshold[0], 2★ at threshold[1], 3★ at threshold[2]
- **Speed bonus**: Complete a stage within `speedBonusDays` (default 2) for +1★ (capped at 3)
- **Weekly modifiers**: Rotate per week, apply bonus/malus multipliers to specific quest types. Effective progress stored as `progress.effective` alongside raw counts
- **Star-scaled rewards**: Base rewards + bonus (2★: +15%, 3★: +33%)
- **Endpoints**: `GET /api/weekly-challenge?player=X`, `POST /api/weekly-challenge/progress`, `POST /api/weekly-challenge/claim`
- **Data**: `public/data/weeklyChallenges.json` (8 templates, 6 modifiers)

**Expedition (Cooperative)**
- Guild-wide cooperative challenge with shared checkpoint progress
- 4 checkpoints (3 regular + 1 bonus): required quest count scales with registered player count (`questsPerPlayer × playerCount`)
- **Nachholmechanik**: No per-player contribution cap — active players compensate for inactive ones
- **Bonus checkpoint**: Awards a rotating title from `bonusTitles` pool
- Auto-contribution: `contributeQuest(userId)` called from `onQuestCompletedByUser()` in helpers.js
- **Endpoints**: `GET /api/expedition?player=X`, `POST /api/expedition/claim`
- **Data**: `public/data/expeditions.json` (8 narrative templates, 6 bonus titles)
- **State**: `data/runtime/expedition.json` (debounced writes, separate from user data)

### Social System ("The Breakaway")

Player-to-player social features accessible via the "Social" tab in the Trading District.

**Friends**
- Friend request system (send/accept/decline) with 2-way confirmation
- Friends list as card grid (2-3 columns) with 3-tier online status:
  - `online` (green dot + glow) = agent online OR active within 5 min
  - `idle` (yellow dot) = active within 30 min
  - `offline` (gray dot) = inactive > 30 min
- `lastActiveAt` tracking via `requireAuth` middleware on every authenticated request
- **Endpoints**: `GET /api/social/:playerId/friends`, `POST /api/social/friend-request`, `DELETE /api/social/friend/:friendId`

**Messages**
- Direct messaging between friends, 500 char limit per message
- Conversations with unread count, auto-read on fetch (marks `read: true` + `readAt` timestamp)
- Double-checkmark read receipts in UI (✓ sent, ✓✓ blue read)
- Auto-refresh every 10s when conversation is active
- **Endpoints**: `GET /api/social/:playerId/conversations`, `GET /api/social/:playerId/messages/:otherId`, `POST /api/social/message`

**Trading**
- Item + gold trading with negotiation rounds (back-and-forth counter-offers)
- Both players must accept current terms for execution — atomic gold + item transfer
- Item validation (ownership, not equipped), gold validation
- D3-style rarity-colored item display with left border accent
- **Endpoints**: `POST /api/social/trade/propose`, `POST /api/social/trade/:id/counter`, `POST /api/social/trade/:id/accept`, `POST /api/social/trade/:id/decline`

**Activity Feed**
- WoW Guild News-style feed showing events from friends + own activity
- Event types: `quest_complete`, `level_up`, `achievement`, `gacha_pull` (epic+), `rare_drop`, `trade_complete`
- Capped at 500 events, enriched with player name/avatar/color
- Auto-refresh every 30s in frontend
- **Endpoint**: `GET /api/social/:playerId/activity-feed?limit=30`
- **State**: `socialData.activityLog` array in `data/social.json`

### The Rift (Dungeon System)

Timed quest chains with escalating difficulty, accessible from "The Great Halls" floor.

- **3 Tiers**: Normal (3 quests/72h), Hard (5/48h), Legendary (7/36h)
- **Difficulty scaling**: 1x → 1.5x → 2x → 2.5x → 3x → 3.25x → 3.5x per stage
- **Fail cooldown**: 3/5/7 days per tier (cleared on success)
- **Min level gates**: Normal=1, Hard=5, Legendary=10
- **Endpoints**: `GET /api/rift`, `POST /api/rift/enter`, `POST /api/rift/complete-stage`, `POST /api/rift/abandon`
- **State**: Per-user `riftState` in users data (activeRift, cooldowns, history)
- **Files**: `routes/rift.js`, `components/RiftView.tsx`

### The Hearth (Tavern/Rest Mode)

Rest area within "The Breakaway" floor, inspired by Urithiru's gathering halls.

- **Rest mode**: Freeze streaks + forge temp for 1-7 days
- **Auto-expire**: Ends after selected duration
- **30-day cooldown** between rest periods
- **Leave early**: Restores frozen values
- **History**: Last 5 rest entries tracked
- **Endpoints**: `GET /api/tavern/status`, `POST /api/tavern/enter`, `POST /api/tavern/leave`
- **Files**: `routes/players.js`, `components/TavernView.tsx`

### Season Pass (Battle Pass)

40-level reward track with XP earned from quests, rituals, daily missions.

- **XP sources**: quest completion (10-50 XP by rarity), ritual (8), vow clean day (5), daily mission milestones
- **Rewards**: Gold, essenz, runensplitter, stardust, exclusive titles, cosmetic frames
- **Endpoints**: `GET /api/battlepass`, `POST /api/battlepass/claim/:level`
- **Files**: `routes/battlepass.js`, `components/BattlePassView.tsx`, `public/data/battlePass.json`

### Faction System (Die Vier Zirkel)

4 factions with reputation tiers, auto-gained from quest completion.

- **Factions**: Orden der Klinge (combat), Zirkel der Sterne (knowledge), Pakt der Wildnis (nature), Bund der Schatten (stealth)
- **6 rep tiers**: Neutral → Friendly → Honored → Revered → Exalted → Paragon
- **Auto-rep**: Quest completions grant +10-30 rep to matching faction based on quest type
- **Tier rewards**: Titles, recipes, frames, shop discounts, legendary effects
- **Endpoints**: `GET /api/factions`, `POST /api/factions/claim-reward`
- **Files**: `routes/factions.js`, `components/FactionsView.tsx`, `public/data/factions.json`

## Security measures

- GitHub webhook HMAC-SHA256 signature verification (`GITHUB_WEBHOOK_SECRET`)
- Auth rate limiting (10 attempts/min/IP on login/register)
- Feedback endpoints require master key (admin only)
- JWT with refresh token rotation
- API key validation via Set (O(1) lookup)
- User lookup via Map (O(1) — no array scan)
- Trade execution lock (prevents concurrent double-spend)
- Crafting material lock (prevents concurrent material drain)
- Habit ownership validation on score/delete endpoints

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
