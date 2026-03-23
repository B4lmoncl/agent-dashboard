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
  page.tsx            # Main dashboard component (~2350 lines)
  types.ts            # Shared TypeScript interfaces (~725 lines)
  utils.ts            # Fetch helpers, fetchDashboard batch, level utils (~350 lines)
  config.ts           # UI configuration constants
  globals.css         # Tailwind + CSS utilities + animations (~1165 lines)
  layout.tsx          # Root layout wrapper
  DashboardContext.tsx # React context for shared state
components/           # React UI components (49 files, ~23k lines)
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
  DungeonView.tsx     # The Undercroft: cooperative group dungeons (lazy-loaded)
  ...                 # 27 more components
hooks/                # React custom hooks
  useQuestActions.ts  # Quest action handlers (claim, complete, approve, etc.)
lib/                  # Backend business logic (8 files, ~3950 lines)
  state.js            # Central state, Maps, JSON persistence (~1230 lines)
  helpers.js          # Utility functions, paginate() (~1690 lines)
  auth.js             # JWT, refresh tokens, API key auth
  quest-catalog.js    # Quest template seeding
  npc-engine.js       # NPC rotation & spawning
  rotation.js         # Daily quest rotation logic
  middleware.js       # Express middleware (auth, master key)
  quest-templates.js  # Quest template interpolation
routes/               # Express API routes (24 files, ~11400 lines)
  quests.js           # Quest CRUD, claim, complete (~855 lines)
  habits-inventory.js # Rituals, gear, inventory, effects (~880 lines)
  config-admin.js     # Game config, leaderboard, /api/dashboard batch (~607 lines)
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
  world-boss.js       # World Boss: community bosses, contribution, unique drops
  gems.js             # Gem/Socket system: 6 gem types, 5 tiers, socketing/upgrading
  dungeons.js         # Dungeon system: async coop group dungeons (2-4 players)
public/
  data/               # Game template data (43 JSON files)
  images/             # Pixel art assets (~284 files)
    portraits/        # NPC and character portraits
    companions/       # Companion icons
    npcs/             # NPC portraits
electron-quest-app/   # Electron desktop companion app (10 files)
scripts/              # Asset generation & data validation (5 files)
server.js             # Express entry point, boot sequence (~322 lines)
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

## Item & Gear Balancing Rules

Inspired by WoW Classic (item budget system, source exclusivity, set design) and Diablo 3 (primary/secondary affix split, legendary powers, Loot 2.0 philosophy). These rules are MANDATORY for all gear item creation and modification.

### Core Principle: Rarity = Affix Count, Level = Stat Values

**Rarity determines HOW MANY stats roll.** A level 30 common and a level 30 legendary roll from the **same value ranges** — the legendary just has more affix slots.

**Level determines the VALUE RANGES** of individual affixes. Higher level = higher per-affix values, but scaling is deliberately flat (small numbers matter because all multipliers stack multiplicatively).

### Affix Slot Counts by Rarity (D3-style)

| Rarity | Primary Affixes | Minor Affixes | Legendary Effect | Sockets |
|--------|----------------|---------------|------------------|---------|
| Common | 1 / 1 | 0 / 0 | — | 0 |
| Uncommon | 1 / 2 | 0 / 1 | — | 0-1 |
| Rare | 2 / 2 | 1 / 1 | — | 1 |
| Epic | 2 / 3 | 1 / 2 | Possible | 1-2 |
| Legendary | 3 / 3 | 2 / 2 | Yes | 2-3 |

Format: `"count": [min, max]`. Primary stats: kraft, weisheit, ausdauer, glueck. Minor stats: fokus, vitalitaet, charisma, tempo.

### Stat Value Ranges by Level (per individual affix)

These ranges apply **identically regardless of rarity**. An affix pool entry always uses these ranges based on the item's `reqLevel`.

| Level Range | Primary (min-max) | Minor (min-max) |
|------------|-------------------|-----------------|
| 1–10 | 1–3 | 1–2 |
| 11–20 | 2–4 | 1–3 |
| 21–30 | 3–6 | 2–4 |
| 31–40 | 4–7 | 3–5 |
| 41–50 | 5–8 | 3–6 |

**BiS ceiling (Lv50 Legendary):** 3×(5-8) primary + 2×(3-6) minor = 15-24 primary + 6-12 minor total. With kraft cap at 30, this keeps endgame powerful but not broken.

### Tier & SetId Assignment

| Level Range | Tier | SetId |
|------------|------|-------|
| 1–8 | 1 | `adventurer` |
| 9–16 | 2 | `veteran` |
| 17–24 | 3 | `master` |
| 25–50 | 4 | `legendary` |

### Legendary Effect Value Ranges

Legendary effects are multiplicative with other systems — keep values **small**.

| Item Level | Effect % Range | Example |
|-----------|---------------|---------|
| 20–30 | 1–3% | `"xp_bonus", "min": 1, "max": 3` |
| 31–40 | 2–5% | `"crit_chance", "min": 2, "max": 5` |
| 41–50 | 3–6% | `"drop_bonus", "min": 3, "max": 6` |
| Unique (T5) | 5–20% | Reserved for unique named items |

**All legendary effect types:**
- Existing: `xp_bonus`, `gold_bonus`, `drop_bonus`, `decay_reduction`, `streak_protection`, `variety_bonus`, `material_double`, `night_double_gold`, `every_nth_bonus`, `auto_streak_shield`
- New: `crit_chance` (+X% double quest rewards), `companion_bond_boost` (+X% bond XP), `cooldown_reduction` (-X% craft cooldown), `salvage_bonus` (+X% salvage materials), `faction_rep_boost` (+X% faction rep), `challenge_score_bonus` (+X% challenge score), `dungeon_loot_bonus` (+X% dungeon rewards), `forge_temp_flat` (+X flat forge temp/quest), `pity_reduction` (-X pity pulls needed), `expedition_speed` (-X% expedition time), `gem_preserve` (+X% gem preserve on removal), `ritual_streak_bonus` (+X% XP per streak day)

### Loot Source Exclusivity (WoW-style)

Items should feel **earned from their source**. Use `shopHidden: true, price: 0` for drop-only items. ID prefixes indicate source:

| Prefix | Source | Typical Rarity | Binding |
|--------|--------|---------------|---------|
| `gen-` | General pool (quests, shop) | Common–Rare | Buyable |
| `dun-` | Dungeon drops | Rare–Epic | Drop only |
| `rift-` | Rift drops | Rare–Legendary | Drop only |
| `wb-` | World Boss | Epic–Legendary | Drop only |
| `fac-` | Faction vendor | Uncommon–Epic | Rep-gated |
| `ch-` | Challenge rewards | Rare–Epic | Drop only |
| `bp-` | Battle Pass | Uncommon–Epic | Pass-gated |
| `gacha-` | Gacha exclusive | Rare–Legendary | Pull only |
| `craft-` | Crafting rewards | Uncommon–Rare | Crafted |

### Named Set Design Rules

- **3–4 pieces per set** (not 6 — our 6-slot system makes full sets too dominant)
- **Partial bonus at 2 pieces**, full bonus at 3–4 pieces
- Set bonuses: flat stat bonuses (+3–8 per stat) or small % multipliers (5–10%)
- Never stack with tier-based set bonuses (named sets override generic setId)

### Item Template JSON Format

```json
{
  "id": "prefix-unique-name",
  "name": "German Name",
  "slot": "weapon|shield|helm|armor|amulet|boots",
  "tier": 1-4,
  "reqLevel": 1-50,
  "rarity": "common|uncommon|rare|epic|legendary",
  "price": 0,
  "desc": "German description (Kingkiller Chronicle tone)",
  "icon": null,
  "shopHidden": true,
  "affixes": {
    "primary": { "count": [min, max], "pool": [{ "stat": "kraft", "min": N, "max": N }] },
    "minor": { "count": [min, max], "pool": [{ "stat": "fokus", "min": N, "max": N }] }
  },
  "legendaryEffect": null,
  "setId": "adventurer|veteran|master|legendary|named-set-id"
}
```

### Balancing Checklist (for every new item)

1. Do affix counts match the rarity table?
2. Do stat ranges match the level table (not inflated by rarity)?
3. Is the legendary effect value within the level-appropriate range?
4. Does the affix pool have 2–3 primary and 1–3 minor options (variety for rolling)?
5. Is the item source-appropriate (no legendaries in general pool, no commons in raids)?
6. Does the total stat ceiling stay below the kraft/weisheit cap of 30 for a full 6-slot build?

## UI Design Guidelines

These rules ensure visual consistency across all features. Follow them for EVERY new component, modal, or UI element.

### Typography & Sizing
- **Minimum font size:** 12px (`text-xs`) for any readable text — never go below
- **Headers:** `text-sm font-bold` or `text-lg font-bold` — use visual hierarchy (larger = more important)
- **Stat values:** `text-2xl font-bold font-mono` for hero numbers (XP, Gold, Level)
- **Labels:** `text-xs uppercase tracking-widest text-w30` for category labels

### Colors & Theme
- **Background base:** `#111318` (--background)
- **Text primary:** `#e8e8e8` (--foreground), secondary: `text-w40` (40% opacity), tertiary: `text-w25`
- **Accent:** `#ff4444` (--accent)
- **Rarity colors:** common `#9ca3af`, uncommon `#22c55e`, rare `#3b82f6`, epic `#a855f7`, legendary `#f97316`, unique `#e6cc80` (WoW artifact gold — handcrafted items only)
- **Stat names** (Kraft, Weisheit, etc.) are German game-world proper nouns — do NOT translate
- **Currency names** (Runensplitter, Sternentaler, etc.) are German proper nouns — do NOT translate

### Interactive Elements
- **Buttons:** Always use `cursor: pointer` when enabled, `cursor: not-allowed` + dimmed opacity when disabled
- **Disabled buttons:** Must show WHY disabled via `title` tooltip (e.g., "Need 15 more Runensplitter")
- **Loading states:** Show "Action…" text or spinner during API calls; disable button to prevent double-clicks
- **Destructive actions** (discard, dismantle, abandon): Always require 2-step confirmation dialog
- **Click targets:** Minimum 32px height for buttons (`py-2` minimum)

### Feedback & Celebrations
- **Reward celebration popup** (`RewardCelebration`): Use for ALL flows where player gains XP, gold, items, titles, or currencies (quests, rituals, vows, battle pass, factions, world boss, dungeons, companions, challenges)
- **Toast notifications** (`addToast`): Use for small confirmations (daily mission milestone, shop purchase, settings saved)
- **Inline result text:** Use only for repetitive actions (crafting, recipe learn) where a popup would be annoying
- **Error feedback:** Always show error messages — never silently fail. Auto-dismiss errors after 5 seconds

### Tooltips
- **GameTooltip system** (`<Tip k="...">` / `<TipCustom>`): Use for stats, currencies, systems, section headers
- **Heading tooltips** (`heading` prop): Centered alignment, dotted underline, golden loading bar on hover
- **Inline tooltips:** Subtle opacity shift on hover, 800ms delay
- **HTML `title` attribute:** Only for simple action buttons (Delete, Claim) and dynamic data — NOT for system explanations
- **Every stat, currency icon, and system mechanic** visible to the player should have a tooltip explaining what it does

### Modals
- **All modals** must use `useModalBehavior` hook (ESC to close, body scroll lock)
- **Backdrop:** Use `modal-backdrop` class (atmospheric radial gradient + blur)
- **Close button:** Top-right, minimum `w-8 h-8` with hover feedback
- **Click-outside-to-close:** Required for all modals (via `e.target === e.currentTarget` or ModalPortal)
- **Z-index:** Modals use `z-[100]`–`z-[200]`; tooltips use `z-[10100]+` (always above modals)

### Visual Depth (RPG Style)
- **Cards:** Use `inset shadow` for embossed/pressed depth (inset top highlight + inset bottom shadow)
- **Progress bars:** Use `progress-bar-diablo` class (7px, beveled, segment marks, pulse at >90%)
- **Stat cards:** Use `stat-card-depth` class (radial gradient + inset shadows)
- **Quest cards:** Use `quest-card-emboss` class (grain overlay + inset depth)
- **Rarity indicators:** Glowing top accent bar (`box-shadow` with rarity color) on cards/items

### Animations & Transitions
- **View transitions:** `tab-content-enter` class on all view wrappers (0.3s slide-up fade-in)
- **Reward popups:** `reward-burst-enter` class (scale bounce-in)
- **Skeleton loading:** `skeleton-pulse` animation for placeholder cards during data fetch
- **Hover effects:** Subtle `translateY(-2px)` lift + enhanced `boxShadow` on cards
- **No jarring layout shifts:** Use fixed dimensions or min-height on containers that load async data

### Images
- **Rendering:** `image-rendering: smooth` everywhere (class `img-render-auto`)
- **Fallback:** Always add `onError` handler to hide broken images gracefully
- **Alt text:** Required for meaningful images; empty `alt=""` for decorative icons

### Consistency Checklist (for new features)
1. Does every action give visual feedback (loading → success/error)?
2. Does every number/stat have a tooltip explaining what it means?
3. Do destructive actions require confirmation?
4. Does the new view use `tab-content-enter` animation?
5. Do modals use `useModalBehavior`?
6. Are disabled buttons styled with `cursor: not-allowed` + tooltip?
7. Is minimum font size 12px?
8. Do reward flows trigger a celebration popup or toast?

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

Quest system (pool of ~10 open + ~25 max in-progress per player), XP/leveling (50 levels with 20 new prestige levels 31-50 each with unique titles), gear/inventory with Diablo-3-style affix rolling (primary + minor stats with ranges), gem/socket system (6 gem types — Ruby(kraft)/Sapphire(weisheit)/Emerald(glueck)/Topaz(ausdauer)/Amethyst(vitalitaet)/Diamond(fokus), 5 tiers Chipped→Flawed→[Name]→Flawless→Royal, socket gear then upgrade gems in-place; gem stat bonuses scale by tier; salvage gems to recover lower tier), set bonuses and legendary effects (15 types including gameplay-changers: night gold, every-5th bonus, auto streak shield, material double, variety bonus), **Unique Named Items** (handcrafted legendary items with fixed stats, unique flavor text, and lore — not randomly rolled; tracked in a collection log per player; discoverable from world bosses, Mythic Rift, and special events), companions with bond levels + ultimates at Bond 5, gacha banners with pity (soft 55, hard 75), daily rituals/streaks, campaign quest chains, multi-currency economy (gold, stardust, essenz, runensplitter, sternentaler), title system (earn and equip titles displayed in player card and leaderboard), **achievement points** (common=5, uncommon=10, rare=25, epic=50, legendary=100 pts; cosmetic frame unlocks at milestones), **Artisan's Quarter** (crafting hub with 4 profession NPCs: Blacksmith/Grimvar for gear rerolling+reinforcing, Alchemist/Ysolde for buff potions+flasks, Enchanter/Eldric for gear enchanting+infusions+targeted stat rerolling (D3 Mystic-style: pick one stat on an item to reroll from its affix pool, preserving all other stats; cost escalates per reroll; locked stat visually marked), Cook/Bruna for meals+consumables; 2-profession limit per player; 10 levels per profession with WoW-style ranks Novice→Apprentice→Journeyman→Expert→Artisan→Master; recipe-specific XP scaling 8-50 XP; daily bonus 2x XP on first craft; recipe discovery unlocks at higher ranks; batch crafting x1-x10 for buff recipes; per-recipe cooldowns; 13 materials common→legendary from quest drops; WoW-style skill-up colors orange/yellow/green/gray; synergy hints for profession pairings), **Schmiedekunst** (dismantle items → essenz + materials with D3-style Salvage All per rarity, transmute 3 same-slot epics + 500g → 1 legendary; slot-locked selection UI), **Workshop Tools** (4-tier permanent XP upgrades: Sturdy→Masterwork→Legendary→Mythic, 2-10% XP bonus), **Sternenpfad** (solo weekly challenge: 3 stages with star ratings 1-3 per stage, max 9 stars; weekly modifiers +50%/-25% per quest type; speed bonus +1★ if stage completed within 2 days; star-scaled rewards +15% at 2★, +33% at 3★; exclusive sternentaler currency), **Expedition** (cooperative weekly challenge: guild-wide shared progress toward 3+bonus checkpoints; scales with registered player count; no per-player cap so active players compensate for inactive ones; bonus checkpoint awards rotating titles), **Bazaar shop** (two categories: self-care rewards like gaming/movie/spa + gameplay boosts with temporary buff effects like XP scrolls, luck coins, streak shields — buffs applied server-side on purchase via `applyShopEffect()`), **Social System "The Breakaway"** (friends with 3-tier online status online/idle/offline via `lastActiveAt` tracking, direct messaging with auto-read receipts and double-checkmark indicators, item+gold trading with negotiation rounds and D3-style rarity-colored item display with stat tooltips, WoW Guild News-style activity feed showing quest completions, level-ups, achievements, epic+ gacha pulls, rare drops and trades from friends with compact/detailed view toggle; friends displayed as card grid instead of list; activity log capped at 500 events; **Player Search** with debounced autocomplete for finding and adding friends; **Player Profiles** Steam/Diablo-style modal showing equipment, achievements, professions, companion, online status — accessible from leaderboard, friends list, and search results), **Daily Missions** (HSR-style daily checklist with 6 missions: login, quests, rituals, companion, crafting; 4 milestone reward tiers at 100/300/500/750 points with currency rewards), **Workshop Upgrades** (4 permanent bonus items in Artisan's Quarter: Gold-Forged Tools +2-5% gold, Loot Chance Amulet +1-3% drop, Streak Shield Charm auto-save 1x/week, Material Magnet +5-15% material chance; all additive bonuses with tiered progression), **The Hearth** (tavern/rest mode: freeze streaks + forge temp for 1-7 days; optional reason; auto-expire; 30-day cooldown; rest history; room within The Breakaway floor, inspired by Urithiru gathering halls), **The Rift** (dungeon system: timed quest chains with 3 tiers — Normal 3 quests/72h, Hard 5/48h, Legendary 7/36h; escalating difficulty 1x→3.5x; fail cooldown 3/5/7 days; completion bonuses; new room in Great Halls), **Mythic+ Endless Rift** (infinite scaling rift levels beyond Legendary; starts at Mythic+1 after Legendary clear; each level increases difficulty multiplier +0.25x and time pressure; leaderboard tracks highest Mythic+ level per player; bonus loot tiers at M+5/10/15/20; unique rewards and titles at milestone levels; no fail cooldown — retry immediately), **World Boss System** (community-wide boss encounters; boss has shared HP pool damaged by all players via quest completions; contribution tracking per player; 3 boss tiers — Champion/Titan/Colossus with escalating HP and reward tiers; unique boss-only drops including Unique Named Items; spawn cycle with downtime between bosses; damage multiplied by player level and gear score; boss enrage timer; ranked contribution rewards — top contributors earn bonus loot and exclusive titles), **Season Pass** (40-level reward track: XP from quests 10-50 by rarity, rituals 8, vow clean days 5, daily mission milestones; rewards include gold, essenz, runensplitter, stardust, exclusive titles, cosmetic frames; claim per level), **Die Vier Zirkel** (faction system: 4 factions — Orden der Klinge/combat, Zirkel der Sterne/knowledge, Pakt der Wildnis/nature, Bund der Schatten/stealth; 6 rep tiers Neutral→Friendly→Honored→Revered→Exalted→Paragon; auto-rep +10-30 from quest completion based on quest type; tier rewards: titles, recipes, frames, shop discounts, legendary effects; claimable per tier), **GameTooltip System** (rich tooltip framework with 50+ registry entries covering all stats, currencies, and systems; cross-reference sub-tooltips via GTRef; 800ms hover delay; pin-on-complete; close via click-outside or ESC; absolute positioning with scroll tracking), **Dungeon System "The Undercroft"** (async cooperative group dungeons for 2-4 friends; 3 tiers: Sunken Archive Normal Lv10/GS100, Shattered Spire Hard Lv20/GS250, Hollow Core Legendary Lv35/GS500; create run → invite friends → auto-start at minPlayers → 8h idle timer → collect individual rewards; success determined once per run based on combined gear score + bond bonus vs scaled threshold; rewards include gold, essenz, materials, gems, actual gear items, unique named items; 7-day cooldown per dungeon; bonus title + frame on first clear; persistence in data/dungeonState.json), **Companion Expeditions** (idle mechanic: send companion on timed expeditions for rewards; 4 tiers: Quick Forage 4h, Deep Woods 8h, Mountain Pass 12h, Ancient Ruins 24h; bond level multiplier 1+bondLevel×0.1 scales gold; rewards: gold, essenz, runensplitter, materials, gems, rare items; 1h cooldown between expeditions; no bond XP while companion is away; backend-only — no frontend UI yet).

## Important Files

| File | Role |
|------|------|
| `app/page.tsx` | Main dashboard UI (~2350 lines) |
| `app/types.ts` | All TypeScript interfaces (~725 lines) |
| `app/utils.ts` | Fetch helpers, `fetchDashboard()` batch, level system |
| `app/globals.css` | CSS utility classes + animations (~1165 lines) |
| `lib/state.js` | State management, Maps, persistence (~1230 lines) |
| `lib/helpers.js` | Shared utilities, `paginate()` (~1690 lines) |
| `lib/auth.js` | JWT auth, refresh tokens, API key resolution |
| `server.js` | Express entry, boot sequence, memory pruning |
| `routes/quests.js` | Core quest API (~855 lines) |
| `routes/config-admin.js` | Game config, leaderboard, `/api/dashboard` batch |
| `routes/habits-inventory.js` | Rituals, gear, inventory (~880 lines) |
| `public/data/*.json` | Game data templates (43 files) |
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
| `components/WorldBossView.tsx` | World Boss UI: boss HP, contribution, rewards |
| `routes/world-boss.js` | World Boss: community bosses, contribution tracking, unique drops |
| `routes/gems.js` | Gem/Socket system: 6 gem types, 5 tiers, socketing/upgrading |
| `public/data/worldBosses.json` | World boss templates, HP pools, unique drop tables |
| `public/data/gems.json` | Gem definitions, tier stats, upgrade paths |
| `public/data/uniqueItems.json` | Handcrafted unique named items with fixed stats and lore |
| `routes/dungeons.js` | Dungeon system: async coop dungeons, gear/unique drops |
| `components/DungeonView.tsx` | Dungeon UI: tier cards, friend picker, active run, rewards |
| `public/data/dungeons.json` | Dungeon templates (3 tiers), rewards, gear score thresholds |
| `public/data/companionExpeditions.json` | Companion expedition templates (4 tiers, 4-24h) |

## Documentation

- `CLAUDE.md` — THIS FILE. Primary reference. Read first. Tech stack, code rules, UI design guidelines, game systems.
- `ARCHITECTURE.md` — Technical architecture: data flow, component tree, route structure, state management.
- `LYRA-PLAYBOOK.md` — Content creation schemas + **Lore Bible**. Read when adding content to `public/data/*.json`. Contains JSON field schemas for all content types + backend formulas. **IMPORTANT: The "Lore Bible" section at the end is READ-ONLY — do NOT modify it unless the user explicitly asks. It defines world-building, tone, NPC personalities, easter egg rules, and flavor guidelines.**
- `AUDIT_REPORT.md` — Fix history + Appendix A (verified non-issues, features that exist, agent traps). MUST read Appendix A before any audit.
- `AUDIT_PROMPT.md` — Reusable audit prompt. User pastes this to start audit sessions.
- `README.md` — API endpoint docs, deployment, agent setup.
- `BACKLOG.md` — Planned features, known bugs, tech debt.
- `ITEM-SYSTEM-SPEC.md` — Gear/equipment design spec (affix pools, rarity, slots).
- `PROFESSION-SPEC.md` — **Definitive Profession System spec.** WoW Classic referenced design for all 5 professions, target recipe/material counts, gear template gaps, skill-up system, buff stacking rules, and prioritized work packages. **READ THIS before any profession/crafting work.**
- `SCALABILITY-AUDIT.md` — Performance analysis.
- `TEMPLATES.md` — Quest template format reference.
