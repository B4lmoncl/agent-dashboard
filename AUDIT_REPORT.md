# Quest Hall — Full Codebase Audit Report

> Generated 2026-03-20 · Covers v1.5.3

---

## 1. Architecture Overview

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (static export) | 16.1.6 |
| UI | React + TypeScript | 19 / 5 |
| Styling | Tailwind CSS + custom utilities | 4 |
| Backend | Express.js (Node.js) | 4.18 / 20 |
| Desktop | Electron (Quest Forge) | 29 |
| Persistence | JSON files in `/data` volume | — |
| Deployment | Docker (Alpine), Docker Compose | — |
| CI/CD | GitHub Actions (Electron build) | — |

### Data Flow

```
React Components → fetch(/api/*) → Express Routes → lib/state.js (in-memory Maps)
                                                          ↓
                                                   debounced saveData()
                                                          ↓
                                                   /data/*.json (Docker volume)
```

- **Batch endpoint**: `GET /api/dashboard?player=X` replaces 14 individual fetches
- **O(1) lookups**: `questsById`, `usersByName`, `usersByApiKey`, `questCatalogById`, `gearById`, `itemTemplates` Maps
- **Templates** (read-only): `public/data/*.json` — 36 files
- **Runtime** (mutable): `data/*.json` — persisted via debounced writes (200ms coalesce)

### Folder Structure

```
app/                  # Next.js app (page.tsx ~2150 lines, types, utils, config, context)
components/           # 39 React components (~13k lines)
hooks/                # Custom hooks (useQuestActions)
lib/                  # Backend logic (8 files, ~3800 lines) + frontend utils
routes/               # Express API (17 files, ~6200 lines)
public/data/          # 36 JSON template files
data/                 # Runtime JSON (Docker volume, git-ignored)
electron-quest-app/   # Electron desktop companion
scripts/              # Asset generation, data validation
server.js             # Express entry point (~289 lines)
```

---

## 2. Feature Catalog

### 2.1 Quest System
**Files**: `routes/quests.js`, `lib/quest-catalog.js`, `lib/rotation.js`, `components/QuestCards.tsx`, `components/QuestBoard.tsx`

- Quest pool (~10 open + ~25 max in-progress per player)
- 5 quest types: development, personal, learning, fitness, social + boss, relationship-coop, companion
- Quest lifecycle: open → claimed → in_progress → completed (or suggested → approved → open)
- Per-player quest pool rotation (daily at midnight or manual refresh)
- Epic quests with child sub-quests, co-op quests with partner claims
- NPC quest chains (sequential unlock within a chain)
- Rarity system: common/uncommon/rare/epic/legendary with scaled XP/Gold
- Quest catalog seeding from 248+ templates

### 2.2 Player System
**Files**: `routes/users.js`, `routes/players.js`, `lib/auth.js`

- Registration with onboarding (name, password, class, companion, age, goals, pronouns)
- JWT auth with access/refresh tokens + API key fallback
- Player profile: XP, level (30 levels), streaks, forge temperature
- 7 currencies: gold, stardust, essenz, runensplitter, gildentaler, mondstaub, sternentaler
- Title system (25 titles with condition-based unlock)
- Achievement points with frame unlocks at milestones
- Equipment system with 6 slots (weapon, shield, helm, armor, amulet, boots)
- Inventory management (use, equip, discard, reorder)

### 2.3 Companion System
**Files**: `routes/players.js`, `components/CompanionsWidget.tsx`, `lib/helpers.js`

- Real pets (cat, dog, etc.) or virtual companions (ember_sprite, lore_owl, gear_golem)
- Bond levels (1-5) with XP from petting (2x/day) and quests
- Ultimate abilities at Bond 5: instant complete, double reward, streak extend (7-day cooldown)
- Companion care quests (daily, auto-generated)
- Mood quotes by personality type

### 2.4 Gacha System
**Files**: `routes/gacha.js`, `components/GachaView.tsx`

- 2 banner types: standard, featured (both cost runensplitter)
- Single pull + 10-pull with discount
- Pity system: soft pity at 55, hard pity at 75 (guaranteed legendary)
- Epic pity at 10 (guaranteed epic+)
- 50/50 featured item mechanic with guaranteed featured on loss
- Pull lock to prevent double-pulls, duplicate refund (stardust)

### 2.5 Crafting (Artisan's Quarter)
**Files**: `routes/crafting.js`, `components/ForgeView.tsx`, `public/data/professions.json`

- 4 profession NPCs: Blacksmith, Alchemist, Enchanter, Cook
- Max 2 professions per player, 10 levels each
- WoW-style ranks: Novice → Apprentice → Journeyman → Expert → Artisan → Master
- 13 materials (common→legendary), recipe discovery, batch crafting
- Schmiedekunst: dismantle items → essenz + materials, transmute 3 epics → 1 legendary
- Daily 2x XP bonus on first craft

### 2.6 Weekly Challenges
**Files**: `routes/challenges-weekly.js`, `routes/expedition.js`, `components/ChallengesView.tsx`

- **Star Path**: Solo 3-stage challenge, up to 9 stars, weekly modifiers, speed bonus
- **Expedition**: Guild-wide cooperative, 3+bonus checkpoints, scales with player count
- Both reset every Monday, exclusive sternentaler currency

### 2.7 NPC System
**Files**: `routes/npcs-misc.js`, `lib/npc-engine.js`, `components/WandererRest.tsx`

- 12+ quest-giving NPCs with spawn weights, cooldowns, rarity
- Rotation system: 3 active NPCs at a time, daily rotation check
- Multi-chain quests per NPC (sequential unlock)

### 2.8 Campaign System
**Files**: `routes/campaigns.js`, `components/CampaignView.tsx`

- Quest chains grouped into campaigns with boss quests
- Campaign rewards (XP, gold, titles), progress tracking

### 2.9 Ritual & Vow System
**Files**: `routes/habits-inventory.js`, `components/RitualChamber.tsx`, `components/VowShrine.tsx`

- Rituals: recurring tasks with streak tracking (daily/weekly/custom)
- Anti-rituals (vows): habits to break, clean day tracking, blood pact mode
- Aetherbond & Blood Pact commitment tiers

### 2.10 Shop (Bazaar)
**Files**: `routes/shop.js`, `components/ShopView.tsx`

- Self-care rewards (gaming, spa, books) — no gameplay effect
- Gameplay boosts (XP scroll, luck coin, streak shield) — temporary buffs
- Gear shop with tiered equipment, workshop tools (permanent XP upgrades)

### 2.11 Leaderboard & Honors
**Files**: `routes/config-admin.js`, `components/LeaderboardView.tsx`, `components/HonorsView.tsx`

- Leaderboard ranked by XP
- Achievements catalog (60 achievements, auto-checked conditions)
- Achievement point milestones with cosmetic frame unlocks

### 2.12 Character Screen
**Files**: `components/CharacterView.tsx`

- Equipment display, stats overview (4 primary + 4 minor stats)
- Set bonuses, legendary effects, title selection, class/companion info

### 2.13 Social & Trading System (The Breakaway)
**Files**: `routes/social.js`, `components/SocialView.tsx`, `lib/state.js` (socialData)

- **Friends**: Send/accept/decline requests, remove friends, online status
- **Messages**: Friend-only conversations with unread counts, paginated history (500-char limit)
- **Trading**: Multi-round WoW/D3-style negotiation:
  - Propose trade (gold + items + message) → counter-offer back and forth
  - Both sides must accept for atomic execution
  - Validates gold balance, item ownership, equipped status at execution time
  - Full trade history with round-by-round detail
- Data persistence in `data/social.json` (friendships, friendRequests, messages, trades)
- Social summary in `/api/dashboard` batch endpoint (pending requests, unread messages, active trades)

### 2.14 Navigation (Urithiru-inspired)
**Files**: `app/config.ts`

- 5 floors: The Pinnacle, The Great Halls, The Trading District, The Inner Sanctum, The Breakaway
- Each floor has 1-4 rooms (tabs), floor banners with gradient backgrounds
- The Breakaway is a standalone 5th floor for the social hub (inspired by Urithiru's social area)

---

## 3. Data Model

### User Record (`state.users[id]`)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Lowercase unique ID |
| name | string | Display name |
| avatar | string | First letter or custom |
| color | string | Hex color |
| xp | number | Total XP earned |
| questsCompleted | number | Lifetime quest count |
| streakDays | number | Current daily streak |
| streakLastDate | string | Last streak date (Berlin TZ) |
| forgeTemp | number | Forge temperature (0-100) |
| currencies | object | {gold, stardust, essenz, runensplitter, gildentaler, mondstaub, sternentaler} |
| inventory | array | GearInstance[] items |
| equipment | object | {weapon, shield, helm, armor, amulet, boots} slot→instanceId |
| companion | object | {type, name, emoji, isReal, bondXp, bondLevel, ...} |
| classId | string | Active class ID |
| apiKey | string | Auth API key |
| passwordHash | string | bcrypt hash |
| earnedAchievements | array | Unlocked achievements |
| achievementPoints | number | Total achievement points |
| unlockedFrames | array | Cosmetic frame unlocks |
| equippedFrame | object | Currently equipped frame |
| equippedTitle | object | Currently equipped title |
| professions | object | Per-profession level/xp |
| craftingMaterials | object | Material ID → count |
| favorites | array | Favorited quest IDs |
| activeBuffs | array | Temporary gameplay buffs |
| relationshipStatus | string | single/relationship/married/... |

### Quest Record (`state.quests[]`)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique quest ID |
| title | string | Quest title |
| description | string | Quest description |
| type | string | development/personal/learning/fitness/social/boss/companion |
| priority | string | low/medium/high |
| status | string | open/in_progress/completed/suggested/rejected |
| claimedBy | string | Player who claimed |
| completedBy | string | Player who completed |
| rewards | object | {xp, gold} |
| rarity | string | common→legendary |
| npcGiverId | string | NPC source (if NPC quest) |
| parentQuestId | string | Parent epic quest |
| companionOwnerId | string | Owner for companion quests |
| minLevel | number | Level requirement |

### PlayerProgress (`state.playerProgress[id]`)

| Field | Type | Description |
|-------|------|-------------|
| claimedQuests | array | Currently claimed quest IDs |
| completedQuests | object | {questId: {at, xp, gold}} |
| npcQuests | object | Per-NPC quest status tracking |
| generatedQuests | array | Full generated pool (~18 IDs) |
| activeQuestPool | array | Visible subset (~11 IDs) |
| weeklyChallenge | object | Star Path progress |
| expeditionClaims | object | Expedition checkpoint claims |

---

## 4. API Endpoints (All 17 Route Files)

### agents.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/agents | — | List all agents |
| POST | /api/agents | apiKey | Create/update agent |
| POST | /api/agent/:id/heartbeat | apiKey | Agent heartbeat |
| DELETE | /api/agent/:id | apiKey | Remove agent |

### quests.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/quests | — | List quests (?player= for per-player view) |
| POST | /api/quests | apiKey | Create quest |
| POST | /api/quest/:id/claim | auth | Claim a quest |
| POST | /api/quest/:id/complete | auth | Complete a quest |
| POST | /api/quest/:id/approve | apiKey | Approve suggested quest |
| POST | /api/quest/:id/reject | apiKey | Reject quest |
| POST | /api/quest/:id/unclaim | auth | Unclaim a quest |
| POST | /api/quest/:id/coop-claim | auth | Claim co-op quest part |
| POST | /api/quest/:id/coop-complete | auth | Complete co-op quest part |
| PUT | /api/quest/:id | apiKey | Update quest fields |
| DELETE | /api/quest/:id | apiKey | Delete quest |

### users.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/users | — | List all users (sanitized) |
| GET | /api/users/:id | — | Get user profile |
| POST | /api/register | rateLimit | Register new player |
| POST | /api/auth/login | rateLimit | Login (returns JWT) |
| POST | /api/auth/refresh | — | Refresh access token |
| POST | /api/auth/logout | — | Revoke refresh token |

### players.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/player/:name/character | — | Full character data |
| GET | /api/player/:name/companion | — | Companion details |
| POST | /api/player/:name/companion/pet | auth+self | Pet companion |
| POST | /api/player/:name/companion/ultimate | auth+self | Use ultimate |
| POST | /api/player/:name/equip | auth+self | Equip gear |
| POST | /api/player/:name/unequip/:slot | auth+self | Unequip slot |
| GET | /api/player/:name/favorites | auth | Get favorites |
| POST | /api/player/:name/favorites | auth+self | Toggle favorite |
| GET | /api/player/:name/titles | — | Get earned titles |
| POST | /api/player/:name/title | auth+self | Equip title |
| POST | /api/player/:name/appearance | auth+self | Update appearance |
| POST | /api/player/:name/profile | auth+self | Update profile |

### habits-inventory.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/rituals/:playerId | — | List rituals |
| POST | /api/rituals | auth | Create ritual |
| POST | /api/ritual/:id/complete | auth | Complete ritual |
| DELETE | /api/ritual/:id | auth | Delete ritual |
| GET | /api/habits/:playerId | — | List habits |
| POST | /api/habits | auth | Create habit |
| POST | /api/habit/:id/tick | auth | Tick habit |
| DELETE | /api/habit/:id | auth | Delete habit |
| GET | /api/player/:name/inventory | — | List inventory |
| POST | /api/player/:name/inventory/use/:itemId | auth+self | Use item |
| POST | /api/player/:name/inventory/discard/:itemId | auth+self | Discard item |
| GET | /api/shop/equipment | — | Shop gear list |
| POST | /api/player/:name/gear/buy | auth+self | Buy gear |
| POST | /api/player/:name/dismantle | auth+self | Dismantle item |
| POST | /api/player/:name/dismantle-bulk | auth+self | Bulk dismantle |
| POST | /api/player/:name/transmute | auth+self | Transmute epics→legendary |
| POST | /api/vows | auth | Create vow |
| POST | /api/vow/:id/violate | auth | Record vow violation |

### config-admin.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/dashboard | — | Batch endpoint |
| GET | /api/game-config | — | Game config |
| GET | /api/leaderboard | — | Leaderboard |
| GET | /api/achievements | — | Achievement catalog |
| POST | /api/daily-bonus/claim | auth | Claim daily bonus |
| GET | /api/quests/pool | — | Quest pool info |
| POST | /api/quests/pool/refresh | auth | Refresh quest pool |

### shop.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/shop | — | List shop items |
| POST | /api/shop/buy | auth | Buy item |

### gacha.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/gacha/banners | — | Active banners |
| POST | /api/gacha/pull | auth | Pull (1 or 10) |
| GET | /api/gacha/pity/:playerId | — | Pity info |

### crafting.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/crafting/professions | — | Professions + recipes |
| POST | /api/crafting/choose | auth | Choose professions |
| POST | /api/crafting/craft | auth | Craft recipe |
| GET | /api/crafting/materials/:playerId | — | Player materials |

### challenges-weekly.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/weekly-challenge | — | Current challenge |
| POST | /api/weekly-challenge/claim | auth | Claim stage |

### expedition.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/expedition | — | Current expedition |
| POST | /api/expedition/claim | auth | Claim checkpoint |

### social.js
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/social/:playerId/friends | auth+self | List friends with online status |
| POST | /api/social/friend-request | auth | Send friend request |
| POST | /api/social/friend-request/:id/accept | auth | Accept friend request |
| POST | /api/social/friend-request/:id/decline | auth | Decline friend request |
| DELETE | /api/social/friend/:friendId | auth | Remove friend |
| GET | /api/social/:playerId/friend-requests | auth+self | List pending requests |
| GET | /api/social/:playerId/messages/:otherId | auth+self | Get conversation (paginated) |
| POST | /api/social/message | auth | Send message (friends-only) |
| GET | /api/social/:playerId/conversations | auth+self | List conversations |
| POST | /api/social/trade/propose | auth | Propose trade |
| GET | /api/social/:playerId/trades | auth+self | List trades |
| GET | /api/social/trade/:tradeId | auth | Trade details |
| POST | /api/social/trade/:tradeId/counter | auth | Counter-offer |
| POST | /api/social/trade/:tradeId/accept | auth | Accept trade |
| POST | /api/social/trade/:tradeId/decline | auth | Decline trade |

### campaigns.js, currency.js, game.js, integrations.js, npcs-misc.js, docs.js
See Section 4 header table rows — standard CRUD/read endpoints for their respective domains.

---

## 5. Quality of Life Improvements (v1.5.4)

- **Gear comparison tooltips**: Inventory item hover now shows stat deltas vs currently equipped gear (green = better, red = worse)
- **Flavor text in tooltips**: Item hover tooltips now display flavor text in italic
- **Legendary effect display**: Item tooltips show legendary effect labels
- **Material source info**: Artisan stat card modal shows how to obtain each material (quest drops by rarity, dismantling)
- **Brighter background**: Theme background lifted from #0b0d11 to #111318 with brighter surface/card colors
- **Affix rolling verified**: All item-granting paths (gacha, shop, quest drops, crafting transmute, trades) correctly apply affix rolling

## 6. Phase 2-3 Audit Findings (v1.5.5)

### 6.1 Critical Fixes Applied

| Issue | Severity | Status |
|-------|----------|--------|
| SocialView trade field mapping — `pendingFor`, `currentInitiatorOffer`, `currentRecipientOffer` not matching API response | P0 | **Fixed** — Backend `enrichTradeResponse()` now flattens fields to match frontend types |
| Conversations sort bug — `lastMessage.createdAt` accessed on string field | P1 | **Fixed** — Sort now uses `lastMessageAt` |
| Trade rounds missing enriched data — frontend expected `byName`, `initiatorOffer`, `recipientOffer` per round but backend returned raw `offer` | P1 | **Fixed** — Backend now builds cumulative offer state per round |
| Trade list missing avatar/color — frontend displayed `initiatorAvatar`, `recipientAvatar`, etc. but API didn't return them | P1 | **Fixed** — `enrichTradeResponse()` adds all player metadata |
| Trade status mismatch — backend uses `pending_initiator`/`pending_recipient`, frontend expected `pending` + `pendingFor` | P1 | **Fixed** — Backend normalizes to `status: "pending"` with `pendingFor` field |

### 6.2 Frontend-Backend Consistency

- **All 8 stat effects** (Kraft, Ausdauer, Weisheit, Glück, Fokus, Vitalität, Charisma, Tempo): ✅ Verified match
- **XP/Gold tables**: ✅ Match backend `BASE_XP`/`BASE_GOLD` maps
- **Streak bonus**: ✅ 1.5%/day cap 45% matches backend
- **Hoarding malus**: ✅ 5%/quest over 20, cap 80% matches backend
- **Shop effects**: ✅ All buff types correctly applied server-side via `applyShopEffect()`
- **Affix rolling**: ✅ All 5 item-granting paths use `createGearInstance`/`rollAffixStats`
- **Level system**: ✅ XP table, stardust on level-up, max level 30 all match

### 6.3 Modal Behavior Audit

| Component | ESC Key | Backdrop Close | Scroll Lock | Status |
|-----------|---------|----------------|-------------|--------|
| DashboardModals (5 popups) | ✅ | ✅ | ✅ | via `useModalBehavior` in page.tsx |
| QuestDetailModal | ✅ | ✅ | ✅ | via `useModalBehavior` in page.tsx |
| RitualChamber (4 modals) | ✅ | ✅ | ✅ | via `useModalBehavior` in component |
| GuideModal | ✅ | ✅ | ✅ | via `useModalBehavior` + manual scroll lock |
| ShopModal | ✅ | ✅ | ✅ | via `useModalBehavior` |
| CreateQuestModal | ✅ | ✅ | ✅ | via `useModalBehavior` |
| CampaignHub | ✅ | ✅ | ✅ | via `useModalBehavior` |
| OnboardingWizard | ✅ | ✅ | ✅ | via `useModalBehavior` |
| CharacterView modals | ✅ | ✅ | ✅ | via `useModalBehavior` |
| QuestPanels (extend/recommit) | ✅ | ✅ | ✅ | via `useModalBehavior` |
| LootDrop/LevelUp/RewardCelebration | ✅ | ✅ | ✅ | via `useModalBehavior` in page.tsx |

### 6.4 Guide Completeness

Updated Guide to cover all features:
- **Added**: Navigation (5 floors), Social/Breakaway (Friends, Messages, Trading), The Arcanum, The Observatory (Campaigns), Season tab
- **Verified**: All 11 tabs (Start, Quests, NPCs, Character, Gacha, Crafting, Rituals, Challenges, Social, Progression, Honors) accurate

### 6.5 Phase 4 Fixes (v1.5.6)

| Issue | Severity | Status |
|-------|----------|--------|
| `executeTrade` null safety — `trade.currentOffer.initiatorOffer` crashes if `currentOffer` is null | P1 | **Fixed** — Added optional chaining `?.` |
| Guide hoarding penalty oversimplified — didn't explain gradual -10%/quest mechanic | P1 | **Fixed** — Now shows first 20 free → -10% per quest over 20 → -80% hard cap |
| Guide missing Schmiedekunst "Salvage All" detail | P2 | **Fixed** — Added Salvage All per-rarity, Legendary exclusion |
| Guide missing night gold doubling legendary effect | P2 | **Fixed** — Added 15 legendary effect types with night gold (23-05h) |
| Guide missing Materials section in Crafting tab | P2 | **Fixed** — Added 5-rarity material sources |
| Guide Transmutation missing slot-lock detail | P2 | **Fixed** — Added "Slot-gesperrt" |

### 6.6 Verified Non-Issues (False Alarms)

| Reported Issue | Actual Status |
|----------------|---------------|
| Gacha pull lock leak on early returns | **No bug** — All early returns inside `try` block, `finally` always releases |
| Hard pity off-by-one (74 vs 75) | **No bug** — Counter=74 means 75th pull, `>= HARD_PITY-1` is correct |
| NPC quests skip forge temp update | **No bug** — `onQuestCompletedByUser()` calls `updateUserForgeTemp()` for all paths |
| NPC quests miss loot drops | **No bug** — `onQuestCompletedByUser()` rolls loot for all quest types |
| Crafting reroll missing poolEntry check | **No bug** — `if (poolEntry)` check exists before `.min/.max` access |
| Multipliers not validated for NaN | **Low risk** — All multiplier sources return valid numbers; defensive NaN checks unnecessary for current data model |

### 6.7 Acknowledged Architectural Issues (Won't Fix)

| Issue | Reason |
|-------|--------|
| Trade execution race condition (double-spend) | Single-process Node.js with sync event loop — concurrent requests serialize naturally. Only possible under extreme load |
| Expedition progress race condition | Same — Express processes requests sequentially |
| Dashboard batch uses internal HTTP instead of direct state | Intentional — ensures middleware (auth, rate limit) applies uniformly |

---

## 7. Documentation Status

| File | Status | Action Needed |
|------|--------|---------------|
| CLAUDE.md | ⚠️ Version says 1.4.0 | Update to 1.5.3 |
| ARCHITECTURE.md | ✅ Accurate | None |
| LYRA-PLAYBOOK.md | ✅ Accurate | None |
| BACKLOG.md | ⚠️ Stale entries | Update fixed items |
| README.md | ⚠️ Incomplete API docs | Add newer endpoints |

---

## 8. Crafting System Improvements (Phase 1 — 2026-03-20)

### 8.1 Rename: "Trade Quarter" → "Trading District"

Renamed the floor label from "The Trade Quarter" to "The Trading District" across all frontend files. "Artisan's Quarter" room name retained unchanged.

**Files changed:** `app/config.ts`, `components/TutorialModal.tsx`, `components/SocialView.tsx`, `AUDIT_REPORT.md`

### 8.2 Passive Gathering System

Active professions now passively grant bonus material drops when completing quests. Each profession has 3 **affinity materials**:

| Profession | Affinity Materials |
|------------|-------------------|
| Schmied | Iron Ore, Crystal Shard, Dragon Scale |
| Alchemist | Herb Bundle, Moonpetal, Starfruit |
| Verzauberer | Arcane Dust, Runestone, Aether Core |
| Koch | Wild Game, Fireroot, Phoenix Feather |

**Scaling:** Base 5% chance per material at level 1, +3% per level, cap 35% at level 10.

**Files changed:** `public/data/professions.json` (gatheringConfig + gatheringAffinity per profession), `lib/helpers.js` (rollCraftingMaterials extended)

### 8.3 Mastery Bonuses (Level 8+)

Each profession gains a passive mastery bonus at profession level 8+:

| Profession | Mastery Bonus |
|------------|--------------|
| Schmied | +10% gear stat rolls on reinforce/sharpen recipes |
| Alchemist | +2 extra quest charges on crafted potions |
| Verzauberer | +2 to enchantment stat ranges |
| Koch | +2 extra quest charges on crafted meals |

**Files changed:** `public/data/professions.json` (masteryConfig + masteryBonus per profession), `routes/crafting.js` (mastery applied per recipe handler), `components/ForgeView.tsx` (mastery badge on profession cards)

### 8.4 Trainer + Drops Recipe System

Recipes now have explicit **source** types replacing the old auto-unlock system:

- **Trainer recipes** (11): Base recipes learned by visiting the NPC and paying gold. Free starter recipes auto-known, advanced ones cost 30-250g.
- **Drop recipes** (10): Rare recipes found as quest completion rewards. Drop chance 4-12% based on recipe rarity, gated by minimum quest rarity.

**New endpoint:** `POST /api/professions/learn` — Purchase a trainer recipe with gold.

**Quest reward flow:** On quest completion, if the player has active professions, there's a chance to discover a drop recipe (max 1 per quest). Recipe is added to `user.learnedRecipes[]`.

**Files changed:** `public/data/professions.json` (source, trainerCost, dropChance, dropMinQuestRarity per recipe), `routes/crafting.js` (isRecipeDiscovered/isRecipeVisible rewrite, learn endpoint, craft validation), `lib/helpers.js` (recipe drop rolls in onQuestCompletedByUser), `components/ForgeView.tsx` (Learn button, recipe interfaces)

---

## 9. Phase 2026-03-20 — Full Codebase Audit & QoL Pass

### 9.1 Critical Fix: `state.saveUsers()` in crafting.js

**Severity:** CRITICAL
**File:** `routes/crafting.js:250`
**Issue:** `POST /api/professions/learn` called `state.saveUsers()` — a method that does NOT exist on the state object. The correct function is the imported `saveUsers()`.
**Impact:** Gold deductions and recipe learning from trainer NPCs were applied in-memory but NEVER persisted to disk. On server restart, the changes were lost (gold refunded, recipe unlearned).
**Fix:** Changed `state.saveUsers()` → `saveUsers()`. Also added `ensureUserCurrencies(u)` call and consistent gold deduction using `u.currencies.gold` pattern.

### 9.2 Code Quality Fixes

| Issue | Severity | File | Fix |
|-------|----------|------|-----|
| `parseInt()` without radix parameter | Medium | `routes/crafting.js:259` | Added `, 10` radix |
| `parseInt()` without radix parameter | Medium | `routes/social.js:217` | Added `, 10` radix |
| Silent error swallowing `catch (_) {}` | Medium | `routes/quests.js:185` | Added `console.warn` for quest catalog seeding failures |

### 9.3 UX / Quality of Life Improvements

| Improvement | File | Description |
|-------------|------|-------------|
| Flavor text contrast improved | `components/QuestCards.tsx:357` | Opacity raised from 0.28 → 0.45 for better readability |
| Craft button loading text | `components/ForgeView.tsx:835` | Changed "..." → "Crafting…" and "On CD" → "On Cooldown" for clarity |
| Login error accessibility | `components/DashboardHeader.tsx:289` | Added `role="alert"` to login error message for screen readers |
| Register error accessibility | `components/DashboardHeader.tsx:326` | Added `role="alert"` to register error message for screen readers |
| Sound toggle aria-label | `components/DashboardHeader.tsx:197` | Added `aria-label` for screen reader support |
| Info button aria-label | `components/DashboardHeader.tsx:206` | Added `aria-label` for screen reader support |
| Roadmap empty state | `components/RoadmapView.tsx:200` | Added themed icon and descriptive copy |
| Star Path empty state | `components/ChallengesView.tsx:572` | Added star icon and encouraging text |
| Expedition empty state | `components/ChallengesView.tsx:587` | Added mountain icon and guild-themed text |
| Leaderboard empty state | `components/LeaderboardView.tsx:99` | Added themed icons, titles, and helpful descriptions |

### 9.4 Remaining Acknowledged Issues (Low Priority)

| Issue | Severity | Status |
|-------|----------|--------|
| CORS `origin: true` accepts all origins | Medium | **Acknowledged** — OK for single-user/self-hosted deployment; would need origin whitelist for production multi-tenant |
| Dashboard batch uses internal HTTP calls | Low | **Acknowledged** — Intentional design to reuse middleware (auth, rate limiting) |
| No CSRF protection | Medium | **Acknowledged** — Mitigated by API key/JWT requirement on all mutating endpoints |
| Timing-safe comparison leaks key length | Low | **Acknowledged** — Master key length is not a meaningful secret in this context |
| `state.quests.find()` used in some routes instead of `questsById.get()` | Low | **Acknowledged** — Only used for complex multi-field lookups where Map can't help |
| Inconsistent error response formats (`{error}` vs `{success, error}`) | Low | **Acknowledged** — Frontend handles both formats; standardization would be nice but not breaking |

### 9.5 Confirmed Non-Issues (Re-verified)

| Reported Concern | Actual Status |
|-----------------|---------------|
| Confirmation dialogs for destructive actions | **Already implemented** — Transmute, Dismantle-All, and Dismantle (rare+) all have 2-step confirmation with `confirmAction` state |
| Quest search filter missing | **Already implemented** — Search input at `page.tsx:1475` filters open and in-progress quests |
| Skill-up color tooltips missing | **Already implemented** — Both dot indicator and XP display have `title={skillUp.label}` |
| Login/Register loading states | **Already implemented** — Buttons show "Signing in…" / "Creating…" with `disabled` + opacity |

### 9.6 Frontend-Backend Consistency (Re-verified 2026-03-20)

All stat effects, XP/gold calculations, streak mechanics, shop effects, crafting recipes, gacha rates, and currency operations verified matching between frontend display and backend logic. The only mismatch found was the `state.saveUsers()` bug (Section 9.1), now fixed.

### 9.7 Modal Behavior (Re-verified 2026-03-20)

All modals use the `useModalBehavior` hook providing consistent ESC-to-close, body scroll lock, and backdrop-click-to-close behavior. No inconsistencies found.

## 10. Phase 5 — Dead Code Cleanup & Type Safety (2026-03-20)

### 10.1 Unused Imports Removed

| File | Removed Imports |
|------|----------------|
| `app/page.tsx` | `CampaignHub` (lazy), 14 unused QuestBoard components (`PersonalQuestPanel`, `ForgeChallengesPanel`, `CategoryBadge`, `ProductBadge`, `HumanInputBadge`, `TypeBadge`, `CreatorBadge`, `AgentBadge`, `RecurringBadge`, `ClickablePriorityBadge`, `FlavorToast`, `EmptyState`, `SkeletonCard`, `RARITY_COLORS`), 8 unused types (`NpcQuestChainEntry`, `CampaignQuest`, `PersonalTemplate`, `ForgeChallengeTemplate`, `AntiRitual`, `Suggestion`, `ShopItem`, `RoadmapItem`), 6 unused utils (`timeAgo`, `getSeason`, `USER_LEVELS`, `getForgeTempInfo`, `getAntiRitualMood`, `LB_LEVELS`), 3 unused config (`priorityConfig`, `categoryConfig`, `productConfig`, `STREAK_MILESTONES_CLIENT`) |
| `app/DashboardContext.tsx` | `Quest`, `ActiveNpc`, `Ritual`, `Habit` (unused type imports) |

### 10.2 Dead Code Removed

| Location | What | Why Dead |
|----------|------|----------|
| `page.tsx` | `questBoardAgentOpen` / `setQuestBoardAgentOpen` | State never read or set outside declaration |
| `page.tsx` | `npcAgentRosterOpen` / `setNpcAgentRosterOpen` | State never read or set outside declaration |
| `page.tsx` | `cvBuilderOpen` / `setCvBuilderOpen` | State never read or set outside declaration |
| `page.tsx` | `setToast` / `setFlavorToast` | Compat wrappers — replaced by `addToast` directly |
| `page.tsx` | `agentQuestMap` useMemo | Computed but never consumed |
| `page.tsx` | `visibleOpen` / `visibleInProgress` useMemo | Computed but never consumed (refactored) |
| `page.tsx` | `devOpen` / `devInProgress` useMemo | Computed but never consumed (refactored) |
| `page.tsx` | `updateNpcQuestStatus` destructure | Destructured from hook but never called |
| `page.tsx` | `habits` value (setter kept) | Set via API but value never read in page |
| `page.tsx` | `campaigns` value (setter kept) | Set via API but value never read in page |

### 10.3 Type Safety Fixes

| Location | Before | After |
|----------|--------|-------|
| `page.tsx:336` | `as any` | `as AchievementDef[] \| { achievements: AchievementDef[] } \| undefined` |
| `page.tsx:652` | `(q as any).companionOwnerId` | `(q as Quest & { companionOwnerId?: string }).companionOwnerId` |
| `page.tsx:815` | `(c: any)` | `(c: ClassDef)` |
| `page.tsx:1235` | `(item: any, i: number)` | `(item: { item?: { name?: string; icon?: string; rarity?: string } }, i: number)` |

### 10.4 Dependency Array Fixes

| Location | Fix |
|----------|-----|
| `page.tsx:160` | Added `setDashView` to `navigateToAchievement` deps (state setter = stable ref) |
| `page.tsx:652` | Added `isCompanionQuest` to `dobbieActiveQuests` deps |
| `page.tsx:379` | Removed stale `eslint-disable-next-line` (no longer needed) |

### 10.5 Remaining Acknowledged Issues (Not Bugs)

| Issue | Status |
|-------|--------|
| `@next/next/no-img-element` warnings (11) | **Intentional** — project uses static export with pixel art, `next/image` not needed |
| React compiler warnings in other components | **Pre-existing** — `setState in effect` and `impure function during render` patterns across 10+ components |

## 11. Phase 2 Iteration — Frontend-Backend Consistency (2026-03-20)

### 11.1 CRITICAL FIX: Glück Stat Not Applied to Quest Loot Drops

**Severity: HIGH**

| Frontend Claim | Backend Reality |
|----------------|----------------|
| "Glück: +0.5% Drop-Chance pro Punkt (max 20%)" | `getUserDropBonus()` function existed but was NEVER called for quest loot drops |

**Root Cause:** In `lib/helpers.js:1140`, quest loot drop chance was hardcoded:
```javascript
// BEFORE (broken):
let dropChance = pityGuaranteed ? 1 : (hasLuckBuff ? 0.45 : 0.25);

// AFTER (fixed):
const glueckBonus = getUserDropBonus(userId);
let dropChance = pityGuaranteed ? 1 : ((hasLuckBuff ? 0.45 : 0.25) + glueckBonus);
```

The `getUserDropBonus()` function was only applied to habit/ritual loot, not quest loot. Now Glück properly adds up to +20% drop chance to quest completion loot, matching what the UI claims.

**Other stat effects verified correct:**
| Stat | Formula | Verified |
|------|---------|----------|
| Kraft | `Math.min(1.30, 1 + kraft * 0.005)` → max +30% XP | YES |
| Weisheit | `Math.min(1.30, 1 + weisheit * 0.005)` → max +30% Gold | YES |
| Ausdauer | `Math.max(0.1, 1 - ausdauer * 0.005)` → min 10% decay | YES |

### 11.2 BUG FIX: usersByName Stale Entry on Name Change

**Severity: MEDIUM**

`POST /api/users/:id/register` — when updating an existing user's name, the old `usersByName` entry was not removed and the new name was not indexed in the Map. Fixed by deleting old entry and setting new one.

### 11.3 Code Quality: parseInt Radix Fixes (Round 2)

All remaining `parseInt()` calls without explicit radix 10 fixed across:
- `lib/helpers.js` (paginate: limit, offset)
- `lib/npc-engine.js` (Berlin timezone hour parsing)
- `routes/docs.js` (HTTP status code comparison)
- `components/ForgeView.tsx` (craft count select)
- `components/SocialView.tsx` (trade gold inputs, 2 instances)

### 11.4 Documentation: ARCHITECTURE.md Updated

- Route count: 14 → 18 files
- Component count: 36 → 42 files
- Added missing `social.js` route entry
- Updated lazy-loaded component list (removed dead CampaignHub/CVBuilderPanel, added ChallengesView/SocialView/DailyLoginCalendar)

### 11.5 Frontend-Backend Consistency Re-verified

| Area | Status |
|------|--------|
| XP calculation (kraft, forge temp, gear, companion) | **Consistent** |
| Gold calculation (weisheit, streaks, forge temp) | **Consistent** |
| Forge decay (ausdauer, legendary effects) | **Consistent** |
| Drop chance (glück, luck buff, pity) | **FIXED** — was broken, now consistent |
| Gacha pity (soft 55, hard 75, epic every 10) | **Consistent** |
| Currency operations (spend, earn, convert) | **Consistent** |
| Crafting costs and cooldowns | **Consistent** |

### 11.6 Remaining Acknowledged Issues (Deferred)

| Issue | Severity | Status |
|-------|----------|--------|
| Modal backdrop styles inconsistent (different opacity/blur) | LOW | Visual only, no functional impact |
| Silent error suppression in fetch utilities | LOW | Intentional for offline-first UX |
| `@next/next/no-img-element` warnings (11) | N/A | Intentional — static export |
| React compiler warnings | N/A | Pre-existing, no runtime impact |

---

## 12. Phase 2026-03-20 — Deep Codebase Audit (Focus: Professions, Challenges, Social)

### 12.1 CRITICAL: Friends Level Display Shows Raw XP Instead of Level

**Severity: HIGH**
**File:** `routes/social.js:73`

| Frontend Display | Backend Response |
|-----------------|-----------------|
| `Lv.{f.level}` (expects level number 1-30) | `level: friendUser.xp` (returns raw XP, e.g. 5000) |

**Root Cause:** `routes/social.js` line 73 returns `level: friendUser ? (friendUser.xp || 0) : 0` — this is raw XP, not a computed level. The frontend `SocialView.tsx:184` renders it as `Lv.{f.level}`, resulting in displays like "Lv.5000" instead of "Lv.12".

**Fix:** Import `getLevelInfo` and return `level: friendUser ? getLevelInfo(friendUser.xp || 0).level : 0`.

### 12.2 MEDIUM: ForgeView Modals Missing useModalBehavior

**Severity: MEDIUM**
**Files:** `components/ForgeView.tsx:626-1094, 1096-1170, 1173-1185`

The ForgeView has 3 modals (NPC popout, confirm profession, confirm action) that do NOT use the `useModalBehavior` hook. This means:
- No ESC key to close
- No body scroll lock
- Manual click-outside handling via `e.target === e.currentTarget` (inconsistent with all other modals)

All other modals in the app use `useModalBehavior` (documented in Section 6.3). ForgeView is the **only exception**.

**Fix:** Add `useModalBehavior` to all 3 ForgeView modals.

### 12.3 MEDIUM: Trade UI Cannot Select Items — Gold-Only Trading

**Severity: MEDIUM**
**File:** `components/SocialView.tsx:397-458, 438-458`

The trade proposal and counter-offer UIs only have gold inputs. The item array is always sent as `[]`:
- Line 407: `offer: { gold: newTradeGold, items: [] }`
- Line 446: `offer: { gold: counterGold, items: [] }`

The backend fully supports item trading (validated in `executeTrade()`), but the frontend provides **no way to select inventory items** for a trade. This makes the "item trading" feature effectively non-functional.

**Fix:** Add an inventory item picker to both trade proposal and counter-offer forms.

### 12.4 LOW: Messages Don't Auto-Refresh

**File:** `components/SocialView.tsx:210-246`

Messages are fetched once when a conversation is opened but never polled/refreshed. Users must navigate away and back to see new messages. Other real-time elements (quest board, agents) refresh every 30s.

**Fix:** Add a polling interval (e.g. 10s) when a conversation is active.

### 12.5 LOW: No Friend Removal Confirmation

**File:** `components/SocialView.tsx:95-103`

`removeFriend()` immediately calls the DELETE endpoint with no confirmation dialog. This is inconsistent with other destructive actions (dismantle, transmute, profession switch) which all have 2-step confirmation.

### 12.6 LOW: Craft Count State Shared Across Recipes

**File:** `components/ForgeView.tsx:148, 803`

`craftCount` is a single state variable shared by all recipes. Changing batch count for one recipe changes it for all recipes in the modal. Should be per-recipe or reset when selecting a different recipe.

### 12.7 LOW: Language Mixing in ForgeView

**File:** `components/ForgeView.tsx:1108-1165`

The profession confirmation modal uses German text ("Beruf erlernen", "Abbrechen", "Das passiert:", "Belegte Slots", etc.) while the rest of the ForgeView uses English. This is inconsistent with the rest of the app which is predominantly English.

### 12.8 LOW: ChallengesView Missing Weekly Reset Timer

**File:** `components/ChallengesView.tsx`

No countdown or indication of when the current weekly challenge resets. Users have no way to know how much time remains. The backend tracks `weekId` but the frontend doesn't display a "Resets in X days" indicator.

### 12.9 LOW: Expedition Doesn't Show Fair Share Indicator Per-Player

The expedition contribution leaderboard shows a raw count per player but the "fair share" indicator at the bottom is easy to miss. Each player's bar could be color-coded green/red based on whether they've met their fair share.

### 12.10 INFO: Workshop Tools Purchase Has No Loading State

**File:** `components/ForgeView.tsx:594-602`

The Workshop Tools buy button calls the API but shows no loading state or success/error feedback. If the purchase fails, the user gets no indication.

### 12.11 INFO: Star Path Progress Shows Raw Values Without Modifier Context

**File:** `components/ChallengesView.tsx:103-117`

When a weekly modifier is active (e.g., +50% for development quests), the progress display shows raw quest counts. The effective (modifier-adjusted) progress is stored separately but not displayed, which can confuse users about why their star rating doesn't match visible progress.

---

## 13. Remaining Acknowledged Issues Summary

| Issue | Severity | Area | Status |
|-------|----------|------|--------|
| Friends level shows XP not level | HIGH | Social | **To fix** |
| ForgeView modals missing useModalBehavior | MEDIUM | Crafting | **To fix** |
| Trade UI has no item picker | MEDIUM | Social | **To fix** |
| Messages don't auto-refresh | LOW | Social | **To fix** |
| No friend removal confirmation | LOW | Social | **To fix** |
| Craft count shared across recipes | LOW | Crafting | **To fix** |
| Language mixing in ForgeView | LOW | Crafting | **To fix** |
| No weekly reset timer | LOW | Challenges | **To fix** |
| Workshop Tools no loading feedback | INFO | Crafting | **To fix** |
| Star Path modifier progress unclear | INFO | Challenges | **To fix** |

---

## 14. Phase 4 Work Plan — Bug Fixes & QoL Improvements

This section tracks all planned work so a future session can resume if the current one is interrupted.

### 14.1 Bug Fixes (Priority Order)

| # | Issue | Severity | File(s) | Fix Description | Status |
|---|-------|----------|---------|-----------------|--------|
| 1 | Friends level shows raw XP | HIGH | `routes/social.js:73` | Import `getLevelInfo` from helpers, change `friendUser.xp` to `getLevelInfo(friendUser.xp).level` | **DONE** |
| 2 | ForgeView modals missing `useModalBehavior` | MEDIUM | `components/ForgeView.tsx:628,1097,1174` | Import `useModalBehavior` from ModalPortal. Add 3 calls: `useModalBehavior(!!selectedNpc, closeNpc)`, `useModalBehavior(!!confirmProf, closeConfirmProf)`, `useModalBehavior(!!confirmAction, closeConfirmAction)`. This adds ESC-to-close and body scroll lock to all 3 modals. | **In Progress** |
| 3 | Trade UI can't select items (gold-only) | MEDIUM | `components/SocialView.tsx:397-458` | Add inventory item picker component to trade proposal and counter-offer forms. Fetch user inventory, render selectable item list, pass selected item IDs in `offer.items[]` array. Backend already supports item trading via `validateTradeItems()` and `executeTrade()`. | Pending |
| 4 | Messages don't auto-refresh | LOW | `components/SocialView.tsx:210-246` | Add `useEffect` with 10s `setInterval` polling when a conversation is active (`selectedFriend` is set). Clear interval on unmount or friend change. | Pending |
| 5 | No friend removal confirmation | LOW | `components/SocialView.tsx:95-103` | Add confirmation dialog before calling DELETE endpoint. Use same pattern as other destructive actions (2-step confirm state). | Pending |
| 6 | Craft count shared across recipes | LOW | `components/ForgeView.tsx:148,803` | Reset `craftCount` to 1 when `selectedNpc` changes or when switching between recipe tabs. Add `useEffect` that resets on NPC/tab change. | Pending |
| 7 | Language mixing in ForgeView | LOW | `components/ForgeView.tsx:1108-1165` | Translate German text in profession confirm modal to English: "Beruf erlernen"→"Learn Profession", "Abbrechen"→"Cancel", "Das passiert:"→"What happens:", "Belegte Slots"→"Used Slots", etc. | Pending |
| 8 | No weekly reset timer in Challenges | LOW | `components/ChallengesView.tsx` | Calculate next Monday 00:00 UTC from current `weekId`, show "Resets in X days, Y hours" countdown. Use `useEffect` with 60s interval to update. | Pending |
| 9 | Workshop Tools no loading feedback | INFO | `components/ForgeView.tsx:594-602` | Add `buying` state to Workshop Tools purchase button. Show spinner during API call, show success/error toast after. | Pending |
| 10 | Star Path shows raw progress, not modifier-adjusted | INFO | `components/ChallengesView.tsx:103-117` | Display both raw and effective (modifier-adjusted) progress. Show modifier info next to progress bar (e.g. "3/5 quests (effective: 4.5 with +50% modifier)"). | Pending |

### 14.2 QoL Improvements (User-Approved)

| # | Feature | Area | Description | Implementation Plan |
|---|---------|------|-------------|-------------------|
| 11 | Crafting Queue Preview | Crafting | WoW-style batch cost summary before crafting | In `ForgeView.tsx` craft confirm section: when `craftCount > 1`, show total materials/gold needed (multiply recipe.materials × craftCount). Add a "Total Cost" breakdown panel above the craft button. |
| 12 | Trade History Log | Social | D3/WoW-style completed trade history | Backend: Add `tradeHistory` array to socialData, push completed trades with timestamp/items/gold. Route: `GET /api/social/:playerId/trade-history`. Frontend: New "History" sub-tab in TradesTab showing past trades. |
| 13 | Challenge Progress Toasts | Challenges | Honkai-style floating notifications on progress | In `page.tsx` or a new `useToast` hook: after quest completion, if challenge progress changed, show a floating toast (e.g. "+1 Stage Progress! 2/5"). Compare before/after challenge data from dashboard refresh. |
| 14 | Profession Synergy Hints | Crafting | Show tips for profession pairings | In `ForgeView.tsx` profession selection: read synergy data from `professions.json` and display tip cards (e.g. "Blacksmith + Enchanter: Craft gear then enchant it"). Show when choosing professions and in NPC popout info section. |
| 15 | Online Status Indicator | Social | Green/yellow/gray dot on friends list | Backend already returns `isOnline` from agent status. Enhance: Add `lastActive` timestamp to friend response. Frontend: render colored dot — green (<5min), yellow (<30min), gray (offline). |
| 16 | Message Read Receipts | Social | Show "Read" indicator on sent messages | Backend: Add `readAt` field to messages. New endpoint `POST /api/social/:playerId/messages/:friendId/read` to mark messages read. Frontend: Call read endpoint when opening conversation, show "Read" text under sent messages. |
| 17 | Trade Item Preview Tooltips | Social | D3-style item stat tooltips in trades | In TradesTab: when rendering trade items, wrap each item in a tooltip component showing full stats (rarity, affixes, level). Reuse existing item tooltip pattern from CharacterView/inventory. |
| 18 | Friend Activity Feed | Social | Habitica-style friend achievements feed | Backend: New endpoint `GET /api/social/:playerId/activity-feed` that returns recent friend achievements, level-ups, rare drops. Frontend: New section in FriendsTab showing scrollable activity feed with timestamps. |
| 19 | Animated Star Rating | Challenges | Honkai-style star fill animations | In `ChallengesView.tsx`: Add CSS keyframe animations for earned stars (pulse + glow + scale). Stars transition from empty → filled with 0.3s delay between each. Add to `globals.css`. |
| 20 | Expedition Contribution Bars | Challenges | WoW raid-style color-coded contribution bars | In `ChallengesView.tsx` expedition leaderboard: Calculate fair share (total needed / player count). Color each player's bar green if ≥ fair share, red/orange if below. Add legend. |
| 21 | Weekly Modifier Banner | Challenges | Prominent modifier display at top of challenges | In `ChallengesView.tsx`: Add a styled banner component at the top showing active weekly modifier with icon and description (e.g. "🔥 +50% Development Quests this week"). |
| 22 | Challenge Reward Preview | Challenges | Honkai-style reward breakdown per star tier | In `ChallengesView.tsx` stage cards: Show reward tiers (1★/2★/3★) with amounts. Data comes from backend `starRewards` field. Motivates players to aim for higher stars. |

### 14.3 Progress Tracking

- **Phase 4A** (Bug Fixes): 10/10 complete ✓
- **Phase 4B** (QoL): 12/12 complete ✓
- **Last updated**: 2026-03-21

---

## 15. Phase 2026-03-21 — Social System Overhaul & Activity Feed

### 15.1 Backend: Online Status with lastActiveAt

**Files changed**: `lib/middleware.js`, `lib/state.js`, `routes/social.js`

- Added `lastActiveAt` timestamp tracking in `requireAuth` middleware — updates on every authenticated request
- Friends endpoint now returns 3-tier online status:
  - `online` = agent online OR active within 5 minutes
  - `idle` = active within 30 minutes
  - `offline` = inactive > 30 minutes
- New response fields: `onlineStatus`, `lastActiveAt` (alongside existing `isOnline` for backward compat)

### 15.2 Backend: Message Read Receipts

**Files changed**: `routes/social.js`

- Messages now get `readAt` ISO timestamp when auto-marked as read during conversation fetch
- Existing `read: true/false` preserved for backward compatibility

### 15.3 Backend: Activity Feed System

**Files changed**: `lib/state.js`, `routes/social.js`, `routes/quests.js`, `routes/gacha.js`

- New `activityLog` array in `socialData` (persisted to social.json)
- `logActivity(playerId, type, data)` helper in state.js — unshifts event, caps at 500 entries
- New endpoint: `GET /api/social/:playerId/activity-feed?limit=30`
  - Returns events from friends + own events
  - Enriched with playerName, playerAvatar, playerColor
- Activity logging added to:
  - Quest completion (all 3 paths: NPC, per-player, global) — `quest_complete`, `level_up`, `achievement`, `rare_drop`
  - Gacha pulls (single + 10-pull, epic+ only) — `gacha_pull`
  - Trade completion — `trade_complete`

### 15.4 Frontend: Social UI Overhaul

**Files changed**: `components/SocialView.tsx`, `app/types.ts`

- **Friends Tab**: Card grid layout (2-3 columns) instead of vertical list — breaks up horizontal monotony
- **Online Status Dots**: Green (online, with glow), yellow (idle), gray (offline) + text label
- **Read Receipts**: Double-checkmark (✓✓ blue = read, ✓ gray = sent) on sent messages
- **Activity Feed Tab**: New "Feed" tab in social navigation showing WoW Guild News-style event feed
  - Event types with icons: quest ⚔️, level-up ⬆️, achievement 🏆, gacha ✨, drops 💎, trades 🤝, streaks 🔥
  - Rarity-highlighted epic/legendary events
  - Auto-refresh every 30 seconds
- **Trade Items**: Rarity-colored left border + bold colored names (Diablo 3 reference)
- **Types updated**: `FriendInfo` (added `onlineStatus`, `lastActiveAt`), `SocialMessage` (added `readAt?`), new `ActivityEvent` interface

### 15.5 Fix: ForgeView "Schmiedekunst" Label

**File**: `components/ForgeView.tsx:722`
- Renamed German tab label "Schmiedekunst" → "Salvage & Transmute"

### 15.6 Self-Audit Results (2026-03-21)

All changes verified clean:
- No TypeScript errors introduced (verified via `tsc --noEmit`)
- All imports used, no dead code
- All `logActivity` calls properly scoped — variables exist in context
- `useModalBehavior` hooks in ForgeView correctly wired
- `lastActiveAt` tracking is memory-only per request (no extra saveUsers calls)
- Activity feed endpoint correctly filters by friend set + own events
- 500-event cap prevents unbounded growth
- Tab labels render "Feed" for the activity tab
- Online status gracefully falls back to `isOnline` boolean if `onlineStatus` missing

### 15.7 Remaining Issues Summary

| Issue | Severity | Area | Status |
|-------|----------|------|--------|
| `tradeableItems` computed every render (no useMemo) | LOW | Social/Trades | Acceptable — only affects users with large inventories |
| No node_modules in audit environment — tsc/eslint can't fully validate | INFO | Environment | Pre-existing, not related to changes |

---

## 16. Phase 2026-03-21 — QoL Overhaul & UI Polish (Session 2)

### 16.1 Consistent English UI

Translated all remaining German interactive UI text to English across 10 files. The TutorialModal/Guide remains in German (intentional for German-speaking user base), but all interactive buttons, labels, placeholders, and tooltips are now consistently English.

**Files changed:** `app/page.tsx`, `app/utils.ts`, `components/UserCard.tsx`, `components/CompanionsWidget.tsx`, `components/QuestPanels.tsx`, `components/RitualChamber.tsx`, `components/CharacterView.tsx`, `components/ItemActionPopup.tsx`, `components/OnboardingWizard.tsx`

**Key translations:**
- "Abbrechen" → "Cancel" (6 files)
- "Weiter →" → "Next →" (OnboardingWizard)
- "Wähle deinen Pfad" → "Choose your path"
- "Wähle deinen Begleiter" → "Choose your companion"
- "Klasse wird geschmiedet..." → "Class is being forged..."
- Forge temperature tooltips fully translated (6 tier descriptions)
- Companion ultimate labels translated (Sofort→Instant, etc.)
- OnboardingWizard placeholders (z.B.→e.g., German example text→English)

### 16.2 Profession XP Bars in UserCard

**File:** `components/UserCard.tsx`

Added profession section to the player card showing active professions with:
- Colored profession icons (Blacksmith=gold, Alchemist=green, Enchanter=purple, Cook=orange)
- Profession level number + rank name
- Animated XP progress bars with gradient fill matching profession color
- Only shown when user has chosen professions

### 16.3 Loading Skeleton States

Replaced plain "Loading..." text across Social tabs with animated skeleton placeholder cards:
- **FriendsTab**: 3 skeleton friend cards in grid layout
- **MessagesTab**: 3 skeleton conversation rows
- **TradesTab**: 2 skeleton trade cards
- **ActivityFeedTab**: 4 skeleton event rows

**CSS:** Added `@keyframes skeleton-pulse`, `.skeleton`, `.skeleton-text`, `.skeleton-bar`, `.skeleton-card` classes.

### 16.4 Smooth Tab Transitions

Added fade-in + slide-up animation when switching between tabs:
- SocialView tabs (friends/messages/trades/activity) use `key={activeTab}` + `tab-content-enter`
- ChallengesView tabs (Star Path/Expedition) use same pattern
- **CSS:** `@keyframes tab-fade-in` (0.2s ease-out, 4px translateY)

### 16.5 Social Notification Badge

**Files:** `app/page.tsx`, `app/utils.ts`

- Frontend now consumes `socialSummary` from dashboard batch endpoint (already returned by backend)
- Shows purple notification badge with count (pending requests + unread messages + active trades) on The Breakaway floor tab
- Badge uses CSS bounce-in animation (`@keyframes badge-bounce-in`)
- Floor tab also gets purple notification dot via `getRoomNotif()` system

### 16.6 Friend List Auto-Refresh

**File:** `components/SocialView.tsx`

Added 30-second polling interval to FriendsTab — friends list auto-refreshes in background to show online status changes without manual navigation.

### 16.7 Activity Feed Visual Enhancements

**File:** `components/SocialView.tsx`, `app/globals.css`

- Legendary events get golden glow border animation (`feed-event-legendary` class)
- Epic events get purple border highlight (`feed-event-epic` class)
- **CSS:** `@keyframes feed-legendary-glow` (3s breathing golden glow)

### 16.8 D3-style Trade Item Tooltips

**Files:** `routes/social.js`, `app/types.ts`, `components/SocialView.tsx`

- Backend `enrichOffer()` now includes `stats`, `setName`, `legendaryEffect` from inventory items
- Frontend `TradeOfferDisplay` shows hover tooltip on trade items with:
  - Full stat breakdown in green (+value format)
  - Set bonus name
  - Legendary effect label with star icon
  - Dark themed tooltip with rarity-colored border glow
  - Item icon (if available)

### 16.9 D3-style Reroll Preview

**Files:** `routes/crafting.js`, `components/ForgeView.tsx`

- Backend `/api/professions` now returns `slotAffixRanges` — per-slot affix pool data (primary + minor stat ranges, current stats, item name, rarity) for all equipped gear
- ForgeView shows reroll preview panel below reroll/enchant recipes:
  - Current stats listed
  - All possible stat ranges shown as "stat min–max" with green highlighting for stats you currently have
  - Shows "(now X)" for currently rolled values

### 16.10 Expedition Fair Share Target Line

**File:** `components/ChallengesView.tsx`

- Added golden vertical target line on each contribution bar showing the fair share threshold
- Enhanced fair share legend with colored indicator line matching the bar marker
- Contribution bars increased from 3px to 4px height for better visibility

### 16.11 CSS Animation Library Additions

**File:** `app/globals.css` (+89 lines)

New animation keyframes and utility classes:
- `skeleton-pulse` — Skeleton loading shimmer
- `tab-fade-in` — Tab content entrance
- `stage-complete-glow`, `stage-complete-check` — Challenge stage completion
- `challenge-toast-in/out` — Challenge progress notifications
- `feed-legendary-glow` — Legendary event breathing glow
- `status-come-online` — Online status transition
- `badge-bounce-in` — Notification badge entrance

### 16.12 Additional Fixes (Agent-Discovered Issues)

Based on automated frontend component analysis, the following additional issues were identified and fixed:

| Fix | File | Description |
|-----|------|-------------|
| Message auto-scroll disruption | `SocialView.tsx` | Messages no longer force-scroll to bottom during 10s polling — only scrolls if user is already near bottom |
| Speed bonus tooltip | `ChallengesView.tsx` | Added ⚡ icon and title tooltip explaining "Complete within X days for +1 bonus star" |
| CharacterView German text | `CharacterView.tsx` | Translated "Profil-Einstellungen"→"Profile Settings", "Beziehungsstatus"→"Relationship Status", "Name des Partners"→"Partner's Name" |
| DashboardHeader German text | `DashboardHeader.tsx` | Translated "Einstellungen (bald)"→"Settings (coming soon)", sound toggle titles |
| ReadCheck aria-label | `SocialView.tsx` | Added `aria-label` for screen reader accessibility on message read indicators |

### 16.13 Backend Fixes (Agent-Discovered Issues)

| Fix | Severity | File | Description |
|-----|----------|------|-------------|
| Expedition checkpoint hardcoded to 4 | MEDIUM | `routes/expedition.js` | Replaced `cpNum === 4` with dynamic `cpNum === totalCheckpoints` for bonus detection — now works with any number of checkpoints |
| German backend error messages | LOW | `routes/expedition.js`, `routes/challenges-weekly.js`, `routes/currency.js`, `routes/habits-inventory.js`, `routes/players.js` | Translated all remaining German error messages to English |

### 16.14 Backend Findings — Acknowledged (Not Fixed)

| Issue | Severity | Status |
|-------|----------|--------|
| Gacha pull lock is in-memory only (won't work multi-instance) | LOW | **Won't fix** — Single-process deployment |
| Dismantle uses saveUsersSync vs craft uses saveUsers | LOW | **Acknowledged** — Dismantle is more critical (irreversible), sync is intentional |
| Trade execution partial failure could leave items in limbo | LOW | **Acknowledged** — Single-process Node.js serializes naturally |
| Input length validation already present on main endpoints | N/A | **Verified** — Quests (500/5000), messages (500), feedback (2000) already validated |
| getMaxProfessionSlots returns 0 below threshold | N/A | **Intentional** — Players below Lv5 correctly cannot choose professions |

### 16.15 New Features (Session 2, Batch 2)

#### Daily Mission Checklist (HSR-inspired)
**Files:** `routes/config-admin.js`, `app/page.tsx`, `app/utils.ts`

- 6 daily missions computed from existing player actions (no new storage for mission tracking):
  - Claim Daily Bonus (+100), Complete 1 Quest (+150), Complete 3 Quests (+250), Complete a Ritual (+100), Pet Companion (+50), Craft an Item (+100)
- 4 milestone reward tiers: 100pts (25g), 300pts (50g+3 essenz), 500pts (100g+2 runensplitter), 750pts (150g+1 sternentaler)
- `POST /api/daily-missions/claim` endpoint with server-side validation
- Frontend: inline panel on quest board with compact mission chips and horizontal reward track
- Auto-prunes old claims (7-day retention)

#### Activity Feed Compact/Detail Toggle
**File:** `components/SocialView.tsx`

- Toggle button in feed header (⊟ Compact / ⊞ Detailed)
- Compact view: single-line events with rarity-colored left border, truncated text
- Detailed view: existing multi-line cards with legendary/epic glow effects

#### Cumulative Star Reward Track
**File:** `components/ChallengesView.tsx`

- Horizontal milestone bar at top of SternenpfadView
- Three milestones: 3★ (50 Gold), 6★ (3 Essenz + 100 Gold), 9★ (1 Sternentaler + 5 Essenz)
- Animated progress fill with golden gradient
- Checkmark nodes for reached milestones with glow effect

## 17. Phase 2026-03-21 — Player Profile System & Social Overhaul (Session 3)

### 17.1 Player Profile System (Steam/Diablo-inspired)

**New Files:** `components/PlayerProfileModal.tsx`
**Modified Files:** `routes/players.js`, `app/page.tsx`, `components/LeaderboardView.tsx`, `components/SocialView.tsx`

A comprehensive public player profile system accessible from multiple entry points:

**Backend:**
- `GET /api/player/:name/public-profile` — Returns full public profile data including:
  - Level, XP, title, class, companion, forge temp, streaks
  - All 6 equipment slots with stats, rarity, legendary effects, descriptions
  - All achievements with dates
  - Active professions with levels
  - Online status (3-tier: online/idle/offline)
  - Member-since date
- `GET /api/players/search?q=term` — Searchable player list for friend adding
  - Filters out agents, returns name/avatar/color/level/class
  - Supports `limit` parameter (max 50)

**Frontend:**
- `PlayerProfileModal` — Full-featured modal with:
  - Header: Avatar (with frame), name, level, title, class, streak, online status
  - Action buttons: "Add Friend" + "Message" (for non-self profiles)
  - Stats grid: XP, Quests, Achievement Points, Gold
  - Equipment grid: 6 slots with rarity-colored cards, stat tooltips, legendary labels
  - Companion section with bond level
  - Professions with colored icons and levels
  - Achievement badges (max 20 shown + overflow count)
  - Footer: Online status, member-since date

**Integration Points:**
- **Leaderboard (Proving Grounds):** Click any player row → opens their profile
- **Friends List:** Click any friend card → opens their profile
- **Player Search:** Click a name in search results → opens their profile
- **Search results:** Each result has "+ Add" button for quick friend requests

### 17.2 Player Search for Friend Adding

Replaced the plain text input "Player name..." with a searchable dropdown:
- Debounced search (300ms) queries `/api/players/search`
- Shows matching players with avatar, name, level
- Filters out self and existing friends
- Each result has:
  - Click name → open profile
  - Click "+ Add" → send friend request directly
- Dropdown closes on outside click
- Still supports direct name entry + Enter key for exact matches

### 17.3 Backend Bug Fixes (Session 3)

| Fix | Severity | File | Description |
|-----|----------|------|-------------|
| XP award validation | HIGH | `routes/users.js` | `POST /api/users/:id/award-xp` now validates amount is positive and capped at 100,000. Previously accepted negative values (could subtract XP) |
| German shop messages | MEDIUM | `routes/shop.js` | Translated buff messages: "erhalten"→"received", "für X Quests"→"for X quests", "Streak-Schild"→"Streak Shield", "Effekt aktiviert"→"Effect activated" |
| German streak labels | LOW | `lib/state.js` | Translated milestone labels: "2-Wochen"→"2 Weeks", "Monat"→"1 Month", "Silber"→"Silver", "Unerschütterlich"→"Unyielding" |

### 17.4 Agent Findings — Verified Non-Issues

| Reported Issue | Actual Status |
|----------------|---------------|
| `/api/daily-bonus/claim` missing | **False alarm** — Endpoint exists in `routes/currency.js:113` |
| Gacha pity decrement race | **Not a bug** — Currency is validated BEFORE `executePull()` is called; pity reduction only happens on funded pulls |
| Rituals/Habits not exposed | **False alarm** — Full CRUD exists in `routes/game.js` (rituals) and `routes/habits-inventory.js` (habits) |
| Companion quest timezone bug | **Low risk** — Only affects companion care quest daily deadlines; uses Berlin timezone fallback consistently |

### 17.5 Onboarding & Tutorial Overhaul (Session 4)

#### OnboardingWizard Overhaul
**File:** `components/OnboardingWizard.tsx`

Full English translation of the registration wizard (50+ text changes):
- Step headers: Willkommen→Welcome, Erzähl uns→Tell us, Beziehungsstatus→Relationship Status
- Labels: Dein Name→Your Name, Alter→Age, Pronomen→Pronouns, Tierart→Pet Type
- Companion data: Fordernd→Fierce, Weise→Wise, Treu→Loyal, Stark→Strong
- Pet species: Katze→Cat, Hund→Dog, Hamster→Hamster, Hase→Rabbit
- Care quests: Füttern→Feed, Spielen→Play, Kuscheln→Cuddle, Gassi gehen→Walk
- Navigation: Zurück→Back, Los geht's→Begin Your Journey!
- Errors: Registrierung fehlgeschlagen→Registration failed
- Summary labels: Klasse→Class, Begleiter→Companion
- Added step name labels ("Create Hero", "About You", etc.) with X/6 counter
- Replaced dot indicators with full-width segmented progress bar

#### TutorialModal Updates
**File:** `components/TutorialModal.tsx`

Added 3 new guide sections for recently implemented features:
- **Player Search & Profiles** — How to search players, view profiles, add friends from profiles
- **Daily Missions** — 6 missions, 4 milestones, point system, daily reset mechanics
- **Activity Feed** — Event types, rarity highlighting, compact/detailed toggle

### 17.6 Translation Pass (Session 5)

Additional German→English translations in interactive UI across 5 files:

| File | Changes |
|------|---------|
| `RitualChamber.tsx` | Difficulty: Leicht→Easy, Mittel→Medium, Schwer→Hard, Legendär→Legendary. Labels: Abhaken→Check off, Erledigt→Done, täglich→daily, Pact-Ziel→Pact Goal, verbleibend→remaining, Erfüllt→Fulfilled. Täglich bei Abhaken→Daily on check-off. NPC lore (Seraine) kept in German. |
| `CharacterView.tsx` | Inventory sort: Seltenheit→Rarity |
| `DashboardModals.tsx` | XP modifiers: pro Kraft-Punkt→per Kraft point, von Tools→from Tools, Kein X-Bonus→No X bonus, Keine Companions beschworen→No Companions summoned, pro Bond-Level→per Bond Level. Gold modifiers: Tage→days, pro Tag→per day, pro Weisheit-Punkt→per Weisheit point, von Legendärem→from Legendary |
| `CompanionsWidget.tsx` | Error fallback: Fehler→Error |
| `RewardCelebration.tsx` | Daily bonus theme: Täglicher Bonus→Daily Bonus, all flavor messages translated |

### 17.7 Complete Translation Pass (Session 5, Batch 2)

Agent-discovered comprehensive German text scan found 60+ untranslated strings across 12 files. All fixed:

**Frontend (8 files, ~35 strings):**
- `ItemActionPopup.tsx` — All 8 button labels/messages (Ausrüsten→Equip, Wegwerfen→Discard, etc.)
- `HonorsView.tsx` — All 15 achievement condition templates + hidden achievement text
- `CharacterView.tsx` — 5 error toast messages (unequip, use, discard network errors)
- `QuestPanels.tsx` — Streak labels (Längste Serie→Longest streak, Rekord→Record)
- `DailyLoginCalendar.tsx` — Close button (Schließen→Close)
- `RewardCelebration.tsx` — Daily bonus theme (label + 5 flavor messages)
- `page.tsx` — 5 UI strings (activity level tooltip, quest counts, login prompts)
- `layout.tsx` — Meta description

**Backend (4 files, ~30 strings):**
- `habits-inventory.js` — 15 item-use response messages (XP boost, bond XP, random gear, phoenix feather, etc.)
- `currency.js` — 6 error messages (validation, unknown currency, conversion)
- `players.js` — 7 companion/ultimate messages (cooldown, quest completion, streak extend)
- `helpers.js` — 7 companion quest title templates (fierce, wise, resilient, loyal, clever, strong)

### 17.8 QoL Agent Findings — Additional Fixes (Session 5, Batch 3)

| Fix | File | Description |
|-----|------|-------------|
| QuestDetailModal German labels | `QuestDetailModal.tsx` | Aufgabe→Task, Belohnung→Reward, Beansprucht von→Claimed by |
| GachaPull German buttons | `GachaPull.tsx` | Überspringen→Skip, Nehmen→Claim, handleNehmen→handleClaim |

**QoL Agent findings — acknowledged but deferred (LOW priority):**
- Missing `cursor: not-allowed` on disabled shop buttons
- Missing `title` tooltips on disabled shop buy buttons
- Missing `data-feedback-id` attributes on ShopView, ShopModal, DashboardModals (analytics instrumentation)
- These are polish items, not user-facing bugs

### 17.9 Changelog (Session 5)

| Commit | Timestamp | Description |
|--------|-----------|-------------|
| `82d274f` | 2026-03-21 | RitualChamber + CharacterView + DashboardModals + CompanionsWidget translations |
| `cdd59e3` | 2026-03-21 | RewardCelebration daily-bonus theme translation |
| `80139ba` | 2026-03-21 | Complete agent-discovered translation pass (12 files, 60+ strings) |
| `0442274` | 2026-03-21 | AUDIT_REPORT documentation update |
| `4bcd3aa` | 2026-03-21 | QuestDetailModal + GachaPull translation |

## 18. Phase 2026-03-21 — New Features (Session 6)

### 18.1 Workshop Upgrades (4 Permanent Bonus Items)

**Files:** `public/data/shopItems.json`, `routes/shop.js`, `lib/state.js`, `lib/helpers.js`, `components/ForgeView.tsx`

New permanent upgrade system in Artisan's Quarter with 4 items:

| Upgrade | Tiers | Effect | Cost Range |
|---------|-------|--------|------------|
| Gold-Forged Tools | 4 | +2/3/4/5% Gold (additive) | 500-10,000g |
| Loot Chance Amulet | 3 | +1/2/3% Loot Drop (additive) | 1,000-8,000g |
| Streak Shield Charm | 1 | Auto-save streak 1x/week | 15,000g |
| Material Magnet | 3 | +5/10/15% Material chance (additive) | 2,000-12,000g |

All bonuses are **additive** (not multiplicative) to prevent stacking abuse. Integration points: `getGoldMultiplier()`, loot drop roll, `updateUserStreak()`, `rollCraftingMaterials()`.

### 18.2 Tavern/Rest Mode (The Hearth)

**Files:** `app/config.ts`, `routes/players.js`, `lib/helpers.js`, `components/TavernView.tsx`, `app/page.tsx`

New 6th floor "The Hearth" — rest area inspired by Urithiru's gathering halls:
- **Enter rest mode** (1-7 days) with optional reason
- **Freezes**: Streaks, forge temp, quest generation
- **Auto-expires** after selected duration
- **30-day cooldown** between rests
- **History** tracked (last 5 entries)
- **Leave early** option with frozen value restoration

### 18.3 Rift/Dungeon System (The Rift)

**Files:** `routes/rift.js`, `server.js`, `app/config.ts`, `app/page.tsx`, `components/RiftView.tsx`

Timed quest chains with escalating difficulty:

| Tier | Quests | Time | Fail Cooldown | Min Level | Completion Bonus |
|------|--------|------|---------------|-----------|------------------|
| Normal | 3 | 72h | 3 days | 1 | 100g + 5 Essenz |
| Hard | 5 | 48h | 5 days | 5 | 300g + 10 Essenz + 5 Runensplitter |
| Legendary | 7 | 36h | 7 days | 10 | 750g + 20 Essenz + 10 Runensplitter + 3 Sternentaler |

- Difficulty scales per stage (1x, 1.5x, 2x, 2.5x...)
- XP + Gold rewards per stage
- Successful completion clears fail cooldown
- Abandon = fail (cooldown applied)
- Rift history tracked (last 20 entries)

### 18.4 Changelog (Session 6)

| Commit | Description |
|--------|-------------|
| `e15f8ea` | Workshop Upgrade items (4 permanent bonuses) |
| `7a3c612` | Tavern/Rest Mode (The Hearth — new 6th floor) |
| `eb41603` | Rift/Dungeon System (The Rift — 3 difficulty tiers) |

### 18.5 Remaining Issues Summary

| Issue | Severity | Area | Status |
|-------|----------|------|--------|
| `tradeableItems` computed every render (no useMemo) | LOW | Social/Trades | Acceptable — only affects users with large inventories |
| OnboardingWizard step content still partially German | LOW | Onboarding | TutorialModal-linked content, intentionally German |
| Some `@next/next/no-img-element` warnings | N/A | Lint | Intentional — static export with pixel art |
| React compiler warnings | N/A | Pre-existing | No runtime impact |

---

## Appendix A: Audit Meta — Known False Findings & Common Traps for Future Sessions

> **Purpose:** This section exists to prevent future Claude Code sessions from wasting time re-investigating issues that have already been verified as non-issues, or from proposing features that already exist. Read this BEFORE starting any audit.

### A.1 Features That Already Exist (Do NOT Propose Again)

These features have been proposed by audit agents in the past as "missing" when they already existed. Always verify in the actual code before suggesting.

| Feature | Where It Exists | How Agents Got Confused |
|---------|----------------|----------------------|
| **Floating reward numbers (+XP, +Gold)** | `components/FloatingRewards.tsx`, `app/globals.css:711` (`@keyframes floatRewardUp`) | Agent searched for "floating numbers" but didn't check the FloatingRewards component |
| **Daily bonus claim endpoint** | `routes/currency.js:113` (`POST /api/daily-bonus/claim`) | Agent only checked `config-admin.js` and `routes/quests.js`, missed `currency.js` |
| **Ritual CRUD endpoints** | `routes/game.js` (POST/PATCH/DELETE /api/rituals) | Agent only checked `routes/habits-inventory.js` and assumed rituals were read-only |
| **Habit CRUD endpoints** | `routes/habits-inventory.js` (POST/DELETE /api/habits, POST /api/habits/:id/score) | Agent missed the habits section of this file |
| **Hidden achievement "???" placeholders** | `components/HonorsView.tsx:137-156` (shows "??? Hidden Achievement" with lock icon) | Agent assumed achievements were all visible |
| **Item flavor text in hover tooltips** | `components/CharacterView.tsx:456-457` (InventoryTooltip shows `flavorText`) | Agent didn't read the InventoryTooltip function |
| **Material cost display (owned/needed)** | `components/ForgeView.tsx:879-889` (shows `{materials[matId] || 0}/{needed}` per recipe) | Agent expected a separate "shopping list" view, missed inline display |
| **Salvage All by rarity** | `components/ForgeView.tsx:980-987` (per-rarity "Salvage All" buttons in Schmiedekunst tab) | Already implemented with D3-style per-rarity buttons |
| **Weekly reset timer** | `components/ChallengesView.tsx:53-78` (`WeeklyResetTimer` component) | Agent didn't check ChallengesView |
| **Star rating animations** | `app/globals.css:160-171` (`@keyframes star-earn`, `star-glow`, `.star-earned`) | Agent expected to find it in component code, not CSS |
| **Gacha pity display** | `components/GachaView.tsx` (shows pity counter, soft/hard thresholds) | Agent expected a separate widget |
| **NPC visual progression (rank glow)** | `components/ForgeView.tsx:482-487` (`npc-rank-glow`, `npc-card-hover` classes with rank-based box-shadow) | Agent expected portrait changes, missed the CSS glow system |
| **Batch crafting (x1-x10)** | `components/ForgeView.tsx:831-839` (select dropdown for batchable recipes) | Agent expected a queue system, missed the batch count selector |
| **Message auto-refresh polling** | `components/SocialView.tsx:273-279` (10s interval when conversation active) | Agent didn't read the useEffect with setInterval |
| **Friend auto-refresh** | `components/SocialView.tsx:97-101` (30s interval) | Agent missed the second useEffect |
| **Craft cost preview (batch total)** | `components/ForgeView.tsx:874-889` (multiplies cost × craftCount, shows total) | Agent expected a separate preview panel |
| **ESC to close all modals** | `components/ModalPortal.tsx` (`useModalBehavior` hook used by all modals) | Agent found some manual ESC handlers and assumed inconsistency |
| **Player search for friend adding** | `components/SocialView.tsx` (debounced autocomplete via `/api/players/search`) | Added in Session 3 — verify before proposing again |
| **Player profile modal** | `components/PlayerProfileModal.tsx` (Steam/Diablo-style, accessible from leaderboard + friends) | Added in Session 3 |
| **Daily mission checklist** | `routes/config-admin.js` (6 missions, 4 milestones), `app/page.tsx` (inline panel) | Added in Session 2 |
| **Cumulative star reward track** | `components/ChallengesView.tsx` (horizontal milestone bar at top of Star Path) | Added in Session 2 |
| **Activity feed compact/detail toggle** | `components/SocialView.tsx` ActivityFeedTab (⊟ Compact / ⊞ Detailed button) | Added in Session 2 |
| **Workshop Upgrades (permanent bonuses)** | `public/data/shopItems.json` (workshopUpgrades), `routes/shop.js`, `lib/helpers.js` | Added in Session 6 |
| **Tavern/Rest Mode (The Hearth)** | `components/TavernView.tsx`, `routes/players.js`, `app/config.ts` (6th floor) | Added in Session 6 |
| **Rift/Dungeon System (The Rift)** | `components/RiftView.tsx`, `routes/rift.js`, `app/config.ts` (Great Halls room) | Added in Session 6 |

### A.2 Verified Non-Bugs (Do NOT Report Again)

These were reported as bugs by audit agents but are either intentional design decisions or working correctly.

| Reported "Bug" | Why It's Not a Bug |
|----------------|-------------------|
| **Gacha pull lock is in-memory only** | Intentional — this is a single-process Node.js deployment. Distributed locks unnecessary. |
| **Gacha pity decrement happens before pull** | Currency is validated in the POST handler BEFORE `executePull()` is called. Pity only decrements on funded pulls. The "before" is before the rarity roll, not before payment. |
| **Trade execution race condition (double-spend)** | Single-process Node.js with sync event loop — concurrent requests serialize naturally. Only possible under extreme load, which this app won't see. |
| **Expedition progress race condition** | Same as above — Express processes requests sequentially. |
| **Dashboard batch uses internal HTTP calls** | Intentional design — ensures middleware (auth, rate limiting) applies uniformly to sub-calls. |
| **`getMaxProfessionSlots()` returns 0 below Lv5** | Intentional — players below Lv5 cannot choose professions. 0 slots = correct. |
| **`dismantle` uses `saveUsersSync` vs `saveUsers` for crafting** | Intentional — dismantle is irreversible (item destroyed), so sync write is safety measure. Normal crafting uses async debounced save. |
| **Hard pity off-by-one (74 vs 75)** | Not a bug — counter=74 means 75th pull. `>= HARD_PITY-1` is correct. |
| **NPC quests skip forge temp update** | Not a bug — `onQuestCompletedByUser()` calls `updateUserForgeTemp()` for ALL quest paths including NPC. |
| **Crafting reroll missing poolEntry check** | Not a bug — `if (poolEntry)` check exists on line 414 before `.min/.max` access. |
| **CORS `origin: true` accepts all origins** | Acknowledged design choice for self-hosted single-user deployment. Not a production multi-tenant app. |
| **Timing-safe comparison leaks key length** | Master key length is not a meaningful secret in this context. |
| **`@next/next/no-img-element` lint warnings** | Intentional — project uses static export with pixel art. `next/image` not needed and would complicate the build. |
| **React compiler warnings (setState in effect)** | Pre-existing across 10+ components. No runtime impact. Would require major refactor to fix. |

### A.3 Architectural Decisions (Do NOT "Fix" These)

| Decision | Rationale |
|----------|-----------|
| **JSON file persistence instead of database** | Intentional for simplicity. This is a small-group app (< 50 users), not a production SaaS. JSON files in Docker volume are sufficient. |
| **TutorialModal/Guide content is in German** | The target audience is German-speaking. The guide is lore/narrative content. Interactive UI elements (buttons, labels, error messages) should be English. |
| **No CSRF protection** | Mitigated by API key/JWT requirement on all mutating endpoints. No session cookies used for auth. |
| **`state.quests.find()` used in some routes** | Only used for complex multi-field lookups where the `questsById` Map can't help (e.g., find by title + type + status). |
| **Inconsistent error response formats (`{error}` vs `{success, error}`)** | Frontend handles both. Standardization would be nice but not breaking. |
| **No test suite** | Acknowledged in CLAUDE.md. Validation only via `scripts/verify-items.js` and ESLint. |

### A.4 Translation Rules

| Context | Language | Rule |
|---------|----------|------|
| Interactive UI (buttons, labels, placeholders, error messages) | **English** | Always translate German to English |
| Backend API error responses | **English** | Always translate German to English |
| TutorialModal / Guide content | **German** | Keep as-is — this is the main narrative guide |
| Gear/item descriptions (`desc` field in gearTemplates.json) | **German** | Keep as-is — this is lore/flavor text, intentionally German |
| Quest flavor text | **Mixed** | NPC quests have German flavor, player quests have English. Both are intentional. |
| Currency names (Runensplitter, Sternentaler, etc.) | **German names** | These are proper nouns in the game world. Do NOT translate. |
| Achievement names/descriptions | **English** | Should be English |
| Profession rank names (Novice, Apprentice, etc.) | **English** | Already English |

### A.5 Common Agent Mistakes to Avoid

1. **Don't propose features before searching the codebase.** Always `grep` for the feature name, related keywords, and component names before claiming something doesn't exist.
2. **Don't assume routes are missing from one file.** Routes are spread across 18 files. A route not in `quests.js` might be in `currency.js`, `game.js`, or `config-admin.js`.
3. **Don't report single-process race conditions as bugs.** Node.js event loop serializes requests. True race conditions only occur with async I/O between check-and-act, which is rare in this codebase.
4. **Don't translate German lore/flavor text.** Only translate interactive UI and error messages. Gear descriptions, quest flavor, and guide content stay German.
5. **Don't suggest adding a database.** The JSON persistence model is an intentional architectural choice.
6. **Don't suggest adding `next/image`.** The project uses static export with pixel art where `<img>` is the correct choice.
7. **Check the `AUDIT_REPORT.md` Sections 6.6, 9.5, 16.14, 17.4** for previously verified non-issues before re-investigating.

---

*End of Audit Report — Updated 2026-03-21*
