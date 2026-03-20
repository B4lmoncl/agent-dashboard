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

- 5 floors: The Pinnacle, The Great Halls, The Trade Quarter, The Inner Sanctum, The Breakaway
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
- **Verified**: All 10 existing tabs (Start, Quests, NPCs, Character, Gacha, Crafting, Rituals, Challenges, Progression, Honors) accurate

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

*End of Audit Report*
