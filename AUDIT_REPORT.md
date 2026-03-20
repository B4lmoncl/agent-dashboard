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

*End of Audit Report — Updated 2026-03-20*
