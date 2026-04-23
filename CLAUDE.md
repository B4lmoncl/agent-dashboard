# CLAUDE.md

## Project Overview

**Quest Hall / Agent Dashboard** (v2.0.0 Open Beta) — A real-time operations center and gamified quest management system for AI agents and players. Combines agent monitoring, RPG quest mechanics (classes, companions, gacha, leveling), a REST API, and an Electron desktop companion app (Quest Forge).

## Game Design References (Primäre Vorbilder)

Diese Spiele sind die **verbindlichen Referenzen** für alle Design-Entscheidungen. Bei Unsicherheit: "Wie macht WoW/Diablo das?" ist immer die erste Frage.

### Hauptreferenzen (1:1 Vorbilder)

| System | Referenz | Was genau |
|--------|----------|-----------|
| **Professions/Crafting** | **WoW Classic** | 1:1 Vorbild. 300 Max Skill, 4 Ränge, Orange/Yellow/Green/Gray Skill-Up, Trainer-Rezepte, Drop-Rezepte, Faction-Rezepte, Shared Transmute Cooldowns, 2 Profession Slots, Free Unlearn. Alles was Berufe betrifft → WoW Classic nachschlagen. |
| **Grind & Progression** | **WoW Classic** | Langzeit-Motivation. Wochen für 1-300 Profession. Streaks, Daily Quests, Weekly Resets — alles soll sich verdient anfühlen, nicht geschenkt. |
| **Item System** | **Diablo 3** | Loot 2.0 Philosophie. Primary/Secondary Affix Split, Rarity = Affix Count, Level = Stat Values. Legendary Effects als Gameplay-Changer. Reforge (Kanai's Cube), Enchanting (Mystic stat reroll). Set-Boni. Gear Score. |
| **Item Transmog/Visuals** | **Diablo 3** | Rarity-Farben, Legendary-Glow, Item-Tooltips mit Stat-Breakdown. Collection Log für Unique Items. Salvage System. |

### Sekundäre Referenzen

| System | Referenz | Was genau |
|--------|----------|-----------|
| **Gamification Loop** | **Habitica** | Reale Aufgaben als Quests. XP/Gold für Alltags-Tasks. Streaks als Motivation. Companions als emotionale Bindung. |
| **Gacha & Daily Login** | **Honkai Star Rail / Genshin Impact** | Pity-System (Soft/Hard Pity), Banner-Rotation, Daily Mission Checklist, Welkin-style Daily Bonus. |
| **UI Feel & Polish** | **WoW Classic + Diablo 3** | Cast Bars, Progress Bars mit Tiefe (Diablo-Beveled), Skill-Up Celebrations, NPC Interaction Feel. Alles soll sich "gewichtig" anfühlen. |
| **Navigation** | **Stormlight Archive (Urithiru)** | Die Quest Hall = ein uralter Turm mit Stockwerken. Jeder Floor hat eigene Räume und Atmosphäre. |
| **Tone & Writing** | **Skulduggery Pleasant + Kingkiller Chronicle** | Siehe LYRA-PLAYBOOK.md Lore Bible. Trockener Humor + poetische Eleganz. |

### Design-Prinzip
Wenn ein Feature unklar ist: **Erst WoW Classic / Diablo 3 nachschlagen**, dann adaptieren für unser System. Nicht neu erfinden was schon perfekt designt wurde.

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
  page.tsx            # Main dashboard component (~3300 lines)
  types.ts            # Shared TypeScript interfaces (~764 lines)
  utils.ts            # Fetch helpers, fetchDashboard batch, level utils (~367 lines)
  config.ts           # UI configuration constants
  globals.css         # Tailwind + CSS utilities + animations (~2150 lines)
  layout.tsx          # Root layout wrapper
  DashboardContext.tsx # React context for shared state
components/           # React UI components (62 files, ~37k lines)
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
  HighstormVFX.tsx    # Stormlight-inspired storm VFX on boss/rift events
  ToastStack.tsx      # Toast notification system with item hover support
  ItemTooltip.tsx     # Item tooltips (exports ItemHoverCard + ItemTooltipBody)
  ...                 # 39 more components
hooks/                # React custom hooks
  useQuestActions.ts  # Quest action handlers (claim, complete, approve, etc.)
  useFirstVisit.ts    # First-visit detection hook
lib/                  # Backend business logic (9 files, ~5000 lines)
  state.js            # Central state, Maps, JSON persistence (~1430 lines)
  helpers.js          # Utility functions, paginate() (~2380 lines)
  auth.js             # JWT, refresh tokens, API key auth
  quest-catalog.js    # Quest template seeding
  npc-engine.js       # NPC rotation & spawning
  rotation.js         # Daily quest rotation logic
  middleware.js       # Express middleware (auth, master key)
  quest-templates.js  # Quest template interpolation
  email.js            # Email utilities
routes/               # Express API routes (32 files, ~18600 lines)
  quests.js           # Quest CRUD, claim, complete (~995 lines)
  habits-inventory.js # Rituals, gear, inventory, effects (~1100 lines)
  config-admin.js     # Game config, leaderboard, /api/dashboard batch (~1000 lines)
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
  crafting.js         # Crafting professions (Schmied, Alchemist, Verzauberer, Koch) + Schmiedefieber
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
  sworn-bonds.js      # Sworn Bonds: 1-on-1 pact, weekly objectives, contribution tracking
  talent-tree.js      # Passive Talent Tree: allocate/deallocate/reset
  adventure-tome.js   # Adventure Tome: per-floor completionist tracker
  codex.js            # Codex system: knowledge entries, unlockable lore
  enchanting.js       # Enchanting: D3-style stat reroll (Mystic)
  kanais-cube.js      # Kanai's Cube: extract/equip legendary powers
  mail.js             # In-game mail system
  schmiedekunst.js    # Schmiedekunst: salvage, transmute
public/
  data/               # Game template data (56 JSON files)
  images/             # Pixel art assets (~885 files)
    portraits/        # NPC and character portraits
    companions/       # Companion icons
    npcs/             # NPC portraits
electron-quest-app/   # Electron desktop companion app (8 files)
scripts/              # Asset generation & data validation (10 files)
server.js             # Express entry point, boot sequence (~337 lines)
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

**Level determines the VALUE RANGES** of individual affixes. Higher level = higher per-affix values, but scaling is deliberately flat (small numbers matter because multipliers use a D3-style bucket system — see Multiplier Stacking Rules below).

### Affix Slot Counts by Rarity (D3-style)

| Rarity | Primary Affixes | Minor Affixes | Legendary Effect | Sockets |
|--------|----------------|---------------|------------------|---------|
| Common | 1 / 1 | 0 / 0 | — | 0 |
| Uncommon | 1 / 2 | 0 / 1 | — | 0-1 |
| Rare | 2 / 2 | 1 / 1 | — | 1 |
| Epic | 2 / 3 | 1 / 2 | Possible | 1-2 |
| Legendary | 3 / 3 | 2 / 2 | Yes | 2-3 |

Format: `"count": [min, max]`. Primary stats: kraft, weisheit, ausdauer, glueck. Minor stats: fokus, vitalitaet, charisma, tempo.

### Stat Value Ranges by Tier (per individual affix)

These ranges apply **identically regardless of rarity**. In practice, items use **tier-based** ranges (not strict reqLevel brackets). A T2 item at reqLevel 9 uses T2 ranges, not the 1–10 bracket.

| Tier | Level Range | Primary (min-max) | Minor (min-max) |
|------|------------|-------------------|-----------------|
| T1 (Abenteurer) | 1–8 | 1–3 | 1–2 |
| T2 (Veteranen) | 9–16 | 2–5 | 1–3 |
| T3 (Meister) | 17–24 | 3–6 | 2–4 |
| T4 (Legendär) | 25–50 | 4–8 | 3–6 |

**BiS ceiling (Lv50 Legendary):** 3×(5-8) primary + 2×(3-6) minor = 15-24 primary + 6-12 minor total. With kraft cap at 30, this keeps endgame powerful but not broken.

### Tier & SetId Assignment

| Level Range | Tier | SetId |
|------------|------|-------|
| 1–8 | 1 | `adventurer` |
| 9–16 | 2 | `veteran` |
| 17–24 | 3 | `master` |
| 25–50 | 4 | `legendary` |

### Legendary Effect Value Ranges

Legendary effects are **additive** with other equipment effects within their bucket, then **multiplicative** between buckets — keep values **small**.

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

- **3–4 pieces per set** (not 7 — our 7-slot system makes full sets too dominant)
- **Partial bonus at 2 pieces**, full bonus at 3–4 pieces
- Set bonuses: flat stat bonuses (+3–8 per stat) or small % multipliers (5–10%)
- Never stack with tier-based set bonuses (named sets override generic setId)

### Item Template JSON Format

```json
{
  "id": "prefix-unique-name",
  "name": "German Name",
  "slot": "weapon|shield|helm|armor|amulet|ring|boots",
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
6. Does the total stat ceiling stay below the kraft/weisheit cap of 30 for a full 7-slot build?

## Multiplier Stacking Rules (D3-Style Buckets)

Inspired by Diablo 3's damage formula: **additive within a bucket, multiplicative between buckets.** This prevents exponential scaling from stacking the same bonus type while rewarding diversification across categories.

### XP Formula

```
finalXP = xpBase × forgeBucket × gearBucket × companionBucket × equipBucket × buffBucket × situationalBucket × procMulti × hoardingMalus × dailyDR + restedBonus
```

| Bucket | Contains (additive within) | Example |
|--------|---------------------------|---------|
| **Forge** | Forge temp bonus + Kraft stat bonus | 1 + 0.25 + 0.15 = 1.40 |
| **Gear** | Gear tier XP% + Armor trait + Codex XP | 1 + 0.05 + 0.07 + 0.05 = 1.17 |
| **Companion** | Companion achievements + Bond level | 1 + 0.06 + 0.04 = 1.10 |
| **Equipment Effects** | Passive item XP% + Legendary xpBonus | 1 + 0.10 + 0.05 = 1.15 |
| **Buffs** | All active buffs (potions, feast, night, berserker, weekend) | 1 + 0.10 + 0.25 + 1.0 = 2.35 |
| **Situational** | Variety bonus + Chain bonus + Nth bonus | 1 + 0.15 + 0.10 + 0.05 = 1.30 |
| **Procs** | Crit (2x) × Double-quest (2x) × Gamble (2x/0.5x) | Each is its own multiplier (binary) |
| **Penalties** | Hoarding malus × Daily DR | Multiplicative debuffs |

### Gold Formula

Same bucket pattern. Forge bucket (forge + weisheit + workshop) is additive within, then multiplicative with streak gold and legendary gold bonuses.

### Key Rule

When adding a new XP/Gold modifier: **identify which bucket it belongs to and ADD it** (`+= bonus`), don't multiply. Only create a NEW bucket if the bonus comes from a genuinely different game system.

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

### Icons & Emojis
- **NO EMOJIS on the site.** Use custom SVG symbols or PNG icons instead. Emojis look inconsistent across platforms and cheapen the aesthetic.
- **Very rare exceptions:** The streak flame (🔥) works because it's thematically perfect. Default to custom icons for everything else.
- **Tooltip icons** in GameTooltip registry entries are the ONLY place where emoji-style symbols are acceptable (they render inside controlled tooltip containers, not in the main UI).
- **When in doubt:** Generate a custom icon or use a Unicode symbol (◆, ★, ●) over an emoji.

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
| `JWT_SECRET` | JWT signing secret (auto-generated if not set) |
| `JWT_REFRESH_SECRET` | JWT refresh token secret (auto-generated if not set) |
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | `production` or `development` |
| `GITHUB_WEBHOOK_SECRET` | Webhook HMAC-SHA256 verification |
| `AGENTMAIL_API_KEY` | AgentMail API key for password reset & verification |
| `AGENTMAIL_FROM` | AgentMail sender address |
| `BASE_URL` | Public base URL for email links |

Template: `.env.example`

## Key Game Systems

Quest system (pool of ~10 open + ~25 max in-progress per player), XP/leveling (50 levels with 20 new prestige levels 31-50 each with unique titles), gear/inventory with Diablo-3-style affix rolling (primary + minor stats with ranges), gem/socket system (6 gem types — Ruby(kraft)/Sapphire(weisheit)/Emerald(glueck)/Topaz(ausdauer)/Amethyst(vitalitaet)/Diamond(fokus), 5 tiers Chipped→Flawed→[Name]→Flawless→Royal, socket gear then upgrade gems in-place; gem stat bonuses scale by tier; salvage gems to recover lower tier), set bonuses and legendary effects (15 types including gameplay-changers: night gold, every-5th bonus, auto streak shield, material double, variety bonus), **Unique Named Items** (handcrafted legendary items with fixed stats, unique flavor text, and lore — not randomly rolled; tracked in a collection log per player; discoverable from world bosses, Mythic Rift, and special events), companions with bond levels + ultimates at Bond 5, gacha banners with pity (soft 60, hard 75), daily rituals/streaks, campaign quest chains, multi-currency economy (gold, stardust, essenz, runensplitter, sternentaler), title system (earn and equip titles displayed in player card and leaderboard), **achievement points** (common=5, uncommon=10, rare=25, epic=50, legendary=100 pts; cosmetic frame unlocks at milestones), **Artisan's Quarter** (crafting hub with 8 profession NPCs: Blacksmith/Grimvar, Tailor/Selina, Leatherworker/Roderic, Weaponsmith/Varn, Jewelcrafter/Selindra, Alchemist/Ysolde, Enchanter/Eldric, Cook/Bruna; WoW-style 2-panel crafting modal (left=recipe list color-coded by skill-up, right=detail with materials+create); 2-profession limit per player (Koch+Verzauberer are secondary, don't use slots); 300 max skill with 4 ranks Apprentice→Journeyman→Expert→Artisan; ~866 recipes total; daily bonus 2x XP on first craft; batch crafting x1-x10; per-recipe cooldowns; 13 materials common→legendary from quest drops; WoW-style skill-up colors orange/yellow/green/gray; profession synergy system with detailed pairing explanations), **Schmiedekunst** (dismantle items → essenz + materials with D3-style Salvage All per rarity, transmute 3 same-slot epics + 500g → 1 legendary; slot-locked selection UI), **Workshop Tools** (4-tier permanent XP upgrades: Sturdy→Masterwork→Legendary→Mythic, 2-10% XP bonus), **Sternenpfad** (solo weekly challenge: 3 stages with star ratings 1-3 per stage, max 9 stars; weekly modifiers +50%/-25% per quest type; speed bonus +1★ if stage completed within 2 days; star-scaled rewards +15% at 2★, +33% at 3★; exclusive sternentaler currency), **Expedition** (cooperative weekly challenge: guild-wide shared progress toward 3+bonus checkpoints; scales with registered player count; no per-player cap so active players compensate for inactive ones; bonus checkpoint awards rotating titles), **Bazaar shop** (two categories: self-care rewards like gaming/movie/spa + gameplay boosts with temporary buff effects like XP scrolls, luck coins, streak shields — buffs applied server-side on purchase via `applyShopEffect()`), **Social System "The Breakaway"** (friends with 3-tier online status online/idle/offline via `lastActiveAt` tracking, direct messaging with auto-read receipts and double-checkmark indicators, item+gold trading with negotiation rounds and D3-style rarity-colored item display with stat tooltips, WoW Guild News-style activity feed showing quest completions, level-ups, achievements, epic+ gacha pulls, rare drops and trades from friends with compact/detailed view toggle; friends displayed as card grid instead of list; activity log capped at 500 events; **Player Search** with debounced autocomplete for finding and adding friends; **Player Profiles** Steam/Diablo-style modal showing equipment, achievements, professions, companion, online status — accessible from leaderboard, friends list, and search results), **Daily Missions** (HSR-style daily checklist with 6 missions: login, quests, rituals, companion, crafting; 4 milestone reward tiers at 100/300/500/750 points with currency rewards), **Workshop Upgrades** (4 permanent bonus items in Artisan's Quarter: Gold-Forged Tools +2-5% gold, Loot Chance Amulet +1-3% drop, Streak Shield Charm auto-save 1x/week, Material Magnet +5-15% material chance; all additive bonuses with tiered progression), **The Hearth** (tavern/rest mode: freeze streaks + forge temp for 1-7 days; optional reason; auto-expire; 30-day cooldown; rest history; room within The Breakaway floor, inspired by Urithiru gathering halls), **The Rift** (dungeon system: timed quest chains with 3 tiers — Normal 3 quests/72h, Hard 5/48h, Legendary 7/36h; escalating difficulty 1x→3.5x; fail cooldown 3/5/7 days; completion bonuses; new room in Great Halls), **Mythic+ Endless Rift** (infinite scaling rift levels beyond Legendary; starts at Mythic+1 after Legendary clear; each level increases difficulty multiplier +0.25x and time pressure; leaderboard tracks highest Mythic+ level per player; bonus loot tiers at M+5/10/15/20; unique rewards and titles at milestone levels; no fail cooldown — retry immediately), **World Boss System** (community-wide boss encounters; boss has shared HP pool damaged by all players via quest completions; contribution tracking per player; 3 boss tiers — Champion/Titan/Colossus with escalating HP and reward tiers; unique boss-only drops including Unique Named Items; spawn cycle with downtime between bosses; damage multiplied by player level and gear score; boss enrage timer; ranked contribution rewards — top contributors earn bonus loot and exclusive titles), **Season Pass** (40-level reward track: XP from quests 10-50 by rarity, rituals 8, vow clean days 5, daily mission milestones; rewards include gold, essenz, runensplitter, stardust, exclusive titles, cosmetic frames; claim per level), **Die Vier Zirkel** (faction system: 4 factions — Orden der Klinge/combat, Zirkel der Sterne/knowledge, Pakt der Wildnis/nature, Bund der Schatten/stealth; 6 rep tiers Neutral→Friendly→Honored→Revered→Exalted→Paragon; auto-rep +10-30 from quest completion based on quest type; tier rewards: titles, recipes, frames, shop discounts, legendary effects; claimable per tier), **GameTooltip System** (rich tooltip framework with 50+ registry entries covering all stats, currencies, and systems; cross-reference sub-tooltips via GTRef; 800ms hover delay; pin-on-complete; close via click-outside or ESC; absolute positioning with scroll tracking), **Dungeon System "The Undercroft"** (async cooperative group dungeons for 2-4 friends; 3 tiers: Sunken Archive Normal Lv10/GS100, Shattered Spire Hard Lv20/GS250, Hollow Core Legendary Lv35/GS500; create run → invite friends → auto-start at minPlayers → 8h idle timer → collect individual rewards; success determined once per run based on combined gear score + bond bonus vs scaled threshold; rewards include gold, essenz, materials, gems, actual gear items, unique named items; 7-day cooldown per dungeon; bonus title + frame on first clear; persistence in data/dungeonState.json), **Companion Expeditions** (idle mechanic: send companion on timed expeditions for rewards; 4 tiers: Quick Forage 4h, Deep Woods 8h, Mountain Pass 12h, Ancient Ruins 24h; bond level multiplier 1+bondLevel×0.1 scales gold; rewards: gold, essenz, runensplitter, materials, gems, rare items; 1h cooldown between expeditions; no bond XP while companion is away; full UI in CompanionsWidget.tsx with tier selection, countdown timer, reward collection), **Passive Talent Tree "Schicksalsbaum"** (Wolcen Gate-of-Fates-inspired circular skill tree; 44 nodes in 3 concentric rings — Inner/Grundstein 12 foundational nodes, Middle/Zwielicht 18 specialization nodes with tradeoffs, Outer/Aszension 14 capstone nodes; unlocks at Level 5, 1 point per 2 levels, max 23 points; mutually exclusive choice groups — Blutzoll vs Gierige Flamme, Stille Wasser vs Traumwandler; multi-rank nodes; 5 build archetypes; respec costs 500g + 50 essenz; effects include forge decay reduction, streak grace period, quest pool expansion, companion bond boost, variety chain bonus, rift stage skip, friend XP echo, tavern passive gold, codex permanent XP), **Adventure Tome "Abenteuerbuch"** (Lost Ark-inspired per-floor completionist tracker; 5 floors with 8-12 objectives each tracking quests, rifts, dungeons, crafts, companions, streaks, factions; milestone rewards at 25%/50%/75%/100% per floor — gold, currencies, exclusive titles, cosmetic frames; total completion percentage across all floors), **Sworn Bonds** (1-on-1 friendship pact: propose → accept → shared weekly objectives; 4 objective types — combined quests, combined XP, individual quests, type variety; Bond Level 1-10 Bekannte→Ewiger Bund with scaling chest rewards; Duo Streak for consecutive completed weeks; Bond Chest awards gold + essenz + 5-15% Duo Frame chance; 7-day break cooldown; per-banner pity in gacha; auto-break on unfriend; 3 achievements; codex entry; Adventure Tome objective; activity feed events; Battle Pass XP on claim; routes/sworn-bonds.js), **Daily Diminishing Returns** (smooth 6-tier curve: 1-5 quests = 100%, 6-7 = 90%, 8-10 = 75%, 11-15 = 60%, 16-20 = 50%, 21+ = 25%; prevents instant-completing mass quests for full value), **Rested XP Pool** (WoW Classic-style: accumulates 5% of level XP per 8h offline, cap 150% of level, doubles XP until depleted; shown as blue zone in XP bar).

### Zwielichtmarkt (PLANNED — NOT YET IMPLEMENTED)

> **Status:** Design phase. No code yet.

**Spieler-Erklärung:** Einmal pro Tag öffnet ein mysteriöser Händler seinen Stand im Trading District — aber nur für 2 Stunden, zu einer zufälligen Uhrzeit. Wer den Markt verpasst, muss bis morgen warten. Das Sortiment wechselt täglich: seltene Materialien zu Sonderpreisen, Mystery-Boxen, gelegentlich vergünstigte Gacha-Tokens. Pro Erscheinung kann jeder Spieler nur begrenzt einkaufen (1-3 Stück pro Item). Ein Banner im UI zeigt an, wenn der Markt aktiv ist, mit Countdown bis zum Verschwinden.

**Concept:** Once per day, at a random hour, a mysterious vendor ("Der Zwielichtmarkt") appears for exactly 2 hours in the Trading District. Offers 3-5 exclusive items: rare materials at discount, mystery scroll boxes, occasional gacha tokens at reduced cost, time-limited consumables. Inspired by WoW rare vendors + HSR Liben's Gift Box.

**Key Design Decisions:**
- **Spawn:** Random hour each day (e.g., between 08:00-22:00 Berlin time). Stored in state, visible to all players simultaneously.
- **Duration:** Exactly 2 hours. Missing it = gone until tomorrow.
- **Inventory:** 3-5 items from a curated rotating pool. Each item has limited stock (e.g., 1-3 per player per appearance).
- **Prices:** Mix of gold, essenz, runensplitter. Generally 20-40% below normal shop prices, but only available during the window.
- **Item Pool Categories:** Discounted crafting materials (common-epic), Mystery Boxes (random consumable/gem), Gacha Tokens (1-2 runensplitter discount on single pulls), Exclusive consumables (only from Zwielichtmarkt), Rare recipes (very low rotation chance).
- **UI:** Notification banner when market is active. Countdown timer. Items show stock remaining. Missed-market indicator ("Der Markt war heute um 14:00. Du hast ihn verpasst.").
- **Backend:** `routes/twilight-market.js`. Daily spawn time calculated at midnight rotation. State in `data/twilightMarket.json`. Stock tracked per player per appearance.
- **Lore:** "Im Schatten zwischen den Stockwerken, wo das Licht nicht ganz hinreicht, baut jemand einen Stand auf. Niemand weiß wer. Niemand fragt. Die Preise sind gut und die Ware... interessant."

### Schmiedefieber / Forge Fever (IMPLEMENTED)

> **Status:** Fully implemented. Backend in `routes/crafting.js`, UI in `components/ForgeView.tsx`, state persisted via `appState.json`, rotation in `lib/rotation.js`.

**Spieler-Erklärung:** Alle 48 Stunden bricht in einer zufälligen Profession das Schmiedefieber aus — ein 4-stündiges Zeitfenster, in dem die Werkstatt überhitzt läuft. Während des Fiebers: Materialkosten halbiert (-50%) und doppelte Skill-XP (2x). Wer es schafft, innerhalb des Fensters 5 oder mehr Rezepte zu craften, bekommt zusätzlich einen Bonus-Cache mit seltenen Materialien. Das Fieber wird im Artisan's Quarter durch ein pulsierendes Banner angezeigt — mit Countdown, betroffener Profession und aktuellem Craft-Zähler.

**Concept:** Every 48 hours, a random profession enters a "Fever" state for exactly 4 hours. During Fever: 50% material cost reduction, 2x skill XP gain. Completing 5+ crafts during the window awards a bonus material cache. Inspired by HSR double-reward events and WoW Darkmoon Faire profession buffs.

**Key Design Decisions:**
- **Rotation:** Every 48h at midnight Berlin time, one profession is randomly selected. Cannot repeat the same profession consecutively.
- **Duration:** Exactly 4 hours from activation (midnight → 04:00, or first craft → +4h if delayed start).
- **Material Discount:** All material costs for that profession's recipes are halved (rounded up). Gold costs unchanged.
- **XP Bonus:** Skill XP from crafting doubled (stacks with daily first-craft bonus).
- **Bonus Cache:** 5+ crafts during the fever window → reward cache with 2-4 random materials (uncommon-rare tier) for that profession.
- **Per-Player Tracking:** Craft count tracked per player per fever event. Cache claimable once per event.
- **UI:** Pulsing "Schmiedefieber" banner in ForgeView with profession icon, countdown timer, craft counter (X/5), and claim button when cache is earned.
- **Backend:** Logic in `routes/crafting.js`. State in `state.forgeFever` (persisted via saveData). Rotation triggered in midnight rotation (`lib/rotation.js`).
- **Lore:** "Manchmal überhitzt die Schmiede ohne Vorwarnung. Grimvar nennt es 'Inspiration'. Ysolde nennt es 'gefährlich'. Beide haben Recht."

### Class System "Pfad der Meisterschaft" (PLANNED — NOT YET IMPLEMENTED)

> **Status:** Infrastructure exists (data model, registration flow, pending→active pipeline, quest gating). Gameplay impact is ZERO — no class-specific quests, no tier rewards, no passive bonuses. Full design notes live in `routes/game.js` header comment.

**Core Concept:** Each class = a real-world career specialization, gamified. "Network Sage" for IT/networking, "Switch Architect" for switching/WLAN, etc. Classes are GRANULAR — two people in similar fields get separate classes, not branches of one.

**Key Design Decisions:**
- **Tier system SEPARATE from player level.** Class tiers advance by completing class-specific quests, not global XP. Prevents generic quest grinding from advancing your specialization.
- **~30-50 class-specific quests per class.** Real learning tasks: "Configure a Fortinet firewall rule", "Complete NSE4 certification", "Set up a VLAN". These are the main content.
- **One passive bonus per class** (small). Network Sage: "+15% XP for Learning quests". Nudge, not dominance.
- **Per-quest feedback system.** Every class quest: "Relevant" / "Not relevant" / freetext. Plus general class feedback panel. This is the INPUT for updating/expanding classes.
- **Custom class pipeline.** User describes their field → pending → admin/AI builds fantasy name, tiers, quests, passive, icon → activate → notification.
- **Minimal gear.** Maybe 1 cosmetic emblem per tier. No stat items. The item system is complex enough.

**Existing infrastructure:** `public/data/classes.json`, `routes/game.js` (GET/POST/PATCH), `routes/players.js` (profile class select), `routes/users.js` (registration with classId), `components/OnboardingWizard.tsx` (step 2 class picker), `app/page.tsx` (class activation modal).

## Important Files

| File | Role |
|------|------|
| `app/page.tsx` | Main dashboard UI (~3300 lines) |
| `app/types.ts` | All TypeScript interfaces (~764 lines) |
| `app/utils.ts` | Fetch helpers, `fetchDashboard()` batch, level system |
| `app/globals.css` | CSS utility classes + animations (~2150 lines) |
| `lib/state.js` | State management, Maps, persistence (~1430 lines) |
| `lib/helpers.js` | Shared utilities, `paginate()` (~2380 lines) |
| `lib/auth.js` | JWT auth, refresh tokens, API key resolution |
| `server.js` | Express entry, boot sequence, memory pruning |
| `routes/quests.js` | Core quest API (~995 lines) |
| `routes/config-admin.js` | Game config, leaderboard, `/api/dashboard` batch (~1000 lines) |
| `routes/habits-inventory.js` | Rituals, gear, inventory (~1100 lines) |
| `public/data/*.json` | Game data templates (56 files) |
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
| `routes/talent-tree.js` | Passive Talent Tree: allocate/deallocate/reset, getUserTalentEffects() |
| `routes/adventure-tome.js` | Adventure Tome: per-floor completionist tracker with milestone claims |
| `components/TalentTreeView.tsx` | Schicksalsbaum UI: 3-ring circular SVG tree with node selection |
| `components/AdventureTomeView.tsx` | Abenteuerbuch UI: floor cards, objectives, milestone claims |
| `routes/sworn-bonds.js` | Sworn Bonds: 1-on-1 pact, weekly objectives, chest claims, contribution tracking |
| `public/data/talentTree.json` | 44 talent nodes, 3 rings, connections, choice groups, archetypes |
| `components/HighstormVFX.tsx` | Stormlight-inspired storm VFX on boss/rift events |
| `components/ToastStack.tsx` | Toast notification system with item hover support |
| `components/ItemTooltip.tsx` | Item tooltips (exports ItemHoverCard + ItemTooltipBody) |
| `routes/codex.js` | Codex system: knowledge entries, unlockable lore |
| `routes/enchanting.js` | Enchanting: D3-style stat reroll (Mystic) |
| `routes/kanais-cube.js` | Kanai's Cube: extract/equip legendary powers |
| `routes/schmiedekunst.js` | Schmiedekunst: salvage, transmute |
| `routes/mail.js` | In-game mail system |

## Pixellab Asset Generation Rules

All pixel art assets are generated via the Pixellab API v2 (`https://api.pixellab.ai/v2`). API key: stored in session, not in repo.

### API & Endpoint

- **Docs:** `https://api.pixellab.ai/v2/llms.txt` (REST) / `https://api.pixellab.ai/mcp/docs` (MCP)
- **Primary endpoint:** `POST /generate-with-style-v2` — generates pixel art matching a style reference image
- **Style reference:** Always use `public/images/icons/gacha-heiltrank.png` (128×128) for item/icon consistency
- **NPC style reference:** Use `public/images/npcs/rogar-amboss.png` (128×128) for NPC portrait consistency
- **Background removal:** Always pass `"no_background": true` — Pixellab handles this natively, no post-processing needed
- **Jobs are async:** All generation endpoints return a `background_job_id`, poll via `GET /background-jobs/{id}`

### Concurrency & Timing (CRITICAL)

- **Tier:** Pixel Architect — supports up to 20 concurrent jobs
- **Job duration:** 2–5 minutes per generation. **NEVER poll before 3 minutes.**
- **Polling interval:** Every 15 seconds after initial 3-minute wait
- **Batch strategy:** Submit up to 10 jobs at once, wait 3 min, then poll all. Scale up to 15–20 once confirmed stable.
- **Rate limit (429):** Means too many concurrent jobs OR polling too aggressively. The "failed" status from premature polling still consumes generation tokens.
- **Token waste prevention:** A failed job = wasted tokens. Always wait long enough. When in doubt, wait longer.

### Image Sizes (established standards from existing assets)

| Asset Type | Size | Style Reference |
|---|---|---|
| NPC Portraits | 128×128px | `rogar-amboss.png` |
| Item/Gear Icons | 128×128px | `gacha-heiltrank.png` |
| Achievement Icons | 128×128px | `gacha-heiltrank.png` |
| Shop/Material/Misc Icons | 128×128px | `gacha-heiltrank.png` |
| Profession Icons | 128×128px | `gacha-heiltrank.png` |
| World Boss Portraits | 256×256px | `rogar-amboss.png` |
| Floor Banners | 792×200px | No style ref (use `generate-image-v2`) |
| Companion Portraits | 256×256px | Existing companion style |

**Rule: Generate at native resolution. Never downscale pixel art with Lanczos/bilinear — it destroys the pixel grid. If smaller display size needed, CSS handles it.**

### Prompt Guidelines

- Always end prompts with `fantasy RPG icon` or `fantasy RPG character portrait, dark background`
- Be specific about materials, colors, and mood — vague prompts produce generic results
- For items: describe the single object, centered, no scene context
- For NPCs: describe personality, clothing, key props, expression
- For bosses: describe creature form, material composition, atmosphere, cosmic/horror tone per Aethermoor lore
- Reference the Creative Bible (LYRA-PLAYBOOK.md) for tone: Aethermoor, Urithiru, Stormlight Archive aesthetic

### Workflow Checklist (before generating)

1. **Check if asset already exists** — `ls public/images/icons/{name}.png` or equivalent. Never regenerate existing assets.
2. **Verify exact filename** from ASSET_BACKLOG.md or the JSON that references it
3. **Confirm size** matches the established standard (see table above)
4. **Ask the user** if anything is unclear — do NOT guess
5. **Submit batch** (up to 10), wait 3 min, poll
6. **Verify output** — check file exists and dimensions are correct
7. **Commit & push** only confirmed-good assets

### Asset Tracking

- `ASSET_BACKLOG.md` — Master list of all missing assets with paths, sizes, and context
- `LYRA-PLAYBOOK.md` § "Fehlende Assets" — Older list, may be outdated vs ASSET_BACKLOG.md
- After generating assets, the backlog should be updated (but verify first what's actually still missing)

## Documentation

- `CLAUDE.md` — THIS FILE. Primary reference. Read first. Tech stack, code rules, UI design guidelines, game systems.
- `ARCHITECTURE.md` — Technical architecture: data flow, component tree, route structure, state management.
- `LYRA-PLAYBOOK.md` — Content creation schemas + **Lore Bible**. Read when adding content to `public/data/*.json`. Contains JSON field schemas for all content types + backend formulas. **IMPORTANT: The "Lore Bible" section at the end is READ-ONLY — do NOT modify it unless the user explicitly asks. It defines world-building, tone, NPC personalities, easter egg rules, and flavor guidelines.**
- `.audit-markers.json` — **Audit Tracker.** Tracks which files have been audited, how many times, when, and what was found. **MUST read before any audit session.** Audit "unaudited" files first, then lowest auditCount. Increment auditCount after each audit pass. Format: `{ filepath: { auditCount, lastAuditDate, findings, status } }`.
- `AUDIT_REPORT.md` — Fix history + Appendix A (verified non-issues, features that exist, agent traps). MUST read Appendix A before any audit.
- `AUDIT_PROMPT.md` — Reusable audit prompt. User pastes this to start audit sessions.
- `README.md` — Project overview, quick start, tech stack, game systems summary.
- `BACKLOG.md` — Planned features, known bugs, tech debt.
- `ITEM-SYSTEM-SPEC.md` — Gear/equipment design spec (affix pools, rarity, slots).
- `WOW-PROFESSION-REFACTOR.md` — **Definitive Profession Refactor Plan.** WoW Classic style: 300 max skill, 6 professions (incl. Lederverarbeiter), ~150 recipes per gear prof / ~80-100 per consumable prof (~850 total), every recipe = unique named item template, intermediate materials (bars/bolts/cured leather), material specialization, BoE trading, WoW source distribution (40/30/20/10). Contains all design decisions + session-based implementation order. **READ THIS before any profession/crafting work.**
- `TEMPLATES.md` — Quest template format reference.
- `AUTOPILOT_AUDIT.md` — Autonomous audit protocol. Endlosschleife mit Scope/Fokus-Rotation. Sag "Lies AUTOPILOT_AUDIT.md" um den Autopilot zu starten.
- `REJECTED.md` — **Feature-Blocklist.** Alles hier wurde vorgeschlagen und abgelehnt. MUSS vor jedem Feature-Vorschlag gelesen werden. Nicht erneut vorschlagen.
- `FEATURE_IDEAS.md` — 65 Feature-Vorschlaege aus Autopilot-Audit. Nicht implementiert — nur Diskussionsgrundlage. Mit Quelle (WoW/D3/HSR), Aufwand (S/M/L/XL) und Begruendung.
- `BALANCE_CONTENT_AUDIT.md` — Content-Dichte-Analyse + technische Scalability-Notes. Zeigt wo Content fehlt und wo das System stark ist.
- `ASSET_BACKLOG.md` — Master-Liste aller fehlenden Pixel-Art-Assets mit Pfaden, Groessen und Kontext. Wird von Pixellab-Generierung referenziert.
- `REFACTOR-TASK.md` — Offene Data-Consolidation-Tasks (redundante Datenquellen zusammenfuehren). Von 2026-03-14, teilweise erledigt.
- `docs/archive/` — Archivierte Specs: GEAR-CONTENT-EXPANSION.md (1074 Items, 6 Phasen komplett), ITEM-SYSTEM-EXPANSION.md (BoP/BoE/Kanai implementiert).
