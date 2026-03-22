# Quest Hall — Codebase Audit Report

> Last updated: 2026-03-22 · v1.5.3 · Sessions 1–24

---

## 1. Architecture Overview

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (static export) | 16.1.6 |
| UI | React + TypeScript | 19 / 5 |
| Styling | Tailwind CSS 4 + custom utilities | 4 |
| Backend | Express.js (Node.js) | 4.18 / 20 |
| Desktop | Electron (Quest Forge) | 29 |
| Persistence | JSON files in `/data` volume | — |
| Deployment | Docker (Alpine), Docker Compose | — |

### Data Flow

```
React → fetch(/api/*) → Express Routes → lib/state.js (in-memory Maps)
                                                ↓
                                         debounced saveData() → /data/*.json
```

- **Batch endpoint**: `GET /api/dashboard?player=X` replaces 14 fetches
- **O(1) lookups**: `questsById`, `usersByName`, `usersByApiKey`, `questCatalogById`, `gearById`, `itemTemplates`
- **Templates** (read-only): `public/data/*.json` — 43 files
- **Runtime** (mutable): `data/*.json` — debounced writes (200ms)
- **Atomic writes**: Critical files (users, quests) use write-tmp-then-rename

### Folder Structure

```
app/                  # Next.js (page.tsx ~2350 lines, types ~725, utils ~350, config, context)
components/           # 49 React components (~23k lines)
hooks/                # useQuestActions
lib/                  # 8 backend files (~3950 lines) + frontend auth-client
routes/               # 24 Express route files (~11,400 lines)
public/data/          # 43 JSON template files
data/                 # Runtime JSON (Docker volume, git-ignored)
electron-quest-app/   # Electron desktop companion
scripts/              # Asset generation, data validation
server.js             # Express entry point (~322 lines)
```

---

## 2. Feature Catalog

| # | Feature | Key Files | Summary |
|---|---------|-----------|---------|
| 1 | **Quest System** | `routes/quests.js`, `lib/quest-catalog.js`, `lib/rotation.js`, `QuestCards.tsx` | ~10 open pool + ~25 in-progress cap, 5 types, rarity scaling, NPC chains, co-op |
| 2 | **Player System** | `routes/users.js`, `routes/players.js`, `lib/auth.js` | JWT + API key auth, 50 levels, 7 currencies, titles, achievements, equipment |
| 3 | **Companion System** | `routes/players.js`, `CompanionsWidget.tsx` | Real/virtual companions, bond levels 1-5, ultimates, companion expeditions (backend-only) |
| 4 | **Gacha** | `routes/gacha.js`, `GachaView.tsx` | Standard/featured banners, pity (soft 55, hard 75), pull lock, duplicate refund |
| 5 | **Crafting** | `routes/crafting.js`, `ForgeView.tsx`, `professions.json` | 4 NPCs, 2-profession limit, 10 levels, trainer/drop recipes, Schmiedekunst |
| 6 | **Weekly Challenges** | `routes/challenges-weekly.js`, `routes/expedition.js`, `ChallengesView.tsx` | Star Path (solo, 9 stars), Expedition (cooperative, shared progress) |
| 7 | **NPC System** | `routes/npcs-misc.js`, `lib/npc-engine.js`, `WandererRest.tsx` | 12+ NPCs, rotation, multi-chain quests |
| 8 | **Campaigns** | `routes/campaigns.js`, `CampaignHub.tsx` | Quest chains with boss quests |
| 9 | **Rituals & Vows** | `routes/habits-inventory.js`, `RitualChamber.tsx`, `QuestPanels.tsx` | Recurring tasks with streaks, anti-rituals, blood pact mode |
| 10 | **Shop (Bazaar)** | `routes/shop.js`, `ShopView.tsx` | Self-care rewards, gameplay boosts, workshop upgrades |
| 11 | **Leaderboard** | `routes/config-admin.js`, `LeaderboardView.tsx`, `HonorsView.tsx` | XP-ranked, 60+ achievements, point milestones, frame unlocks |
| 12 | **Character Screen** | `CharacterView.tsx` | Equipment, stats, gem sockets, collection log, inventory grid |
| 13 | **Social (The Breakaway)** | `routes/social.js`, `SocialView.tsx`, `PlayerProfileModal.tsx` | Friends, messages, trading, activity feed, player search/profiles |
| 14 | **Rift / Mythic+** | `routes/rift.js`, `RiftView.tsx` | Timed quest chains (3 tiers + endless Mythic+), escalating difficulty |
| 15 | **World Boss** | `routes/world-boss.js`, `WorldBossView.tsx` | Community bosses, contribution tracking, unique drops |
| 16 | **Dungeons** | `routes/dungeons.js`, `DungeonView.tsx` | Async co-op (2-4 players), gear/unique drops, group success |
| 17 | **Gem/Socket** | `routes/gems.js`, `CharacterView.tsx` | 6 types, 5 tiers, socket/unsocket/upgrade |
| 18 | **Battle Pass** | `routes/battlepass.js`, `BattlePassView.tsx` | 40-level reward track, 10 XP sources |
| 19 | **Factions** | `routes/factions.js`, `FactionsView.tsx` | 4 factions, 6 rep tiers, auto-rep from quests, shop discounts |
| 20 | **Tavern (The Hearth)** | `routes/players.js`, `TavernView.tsx` | Rest mode (1-7 days), freeze streaks/forge, 30-day cooldown |
| 21 | **Daily Missions** | `routes/config-admin.js`, `page.tsx` | 6 missions, 4 milestone tiers, HSR-inspired |
| 22 | **Navigation** | `app/config.ts` | 5 floors (Urithiru-inspired), floor banners with particles |
| 23 | **Tooltip System** | `GameTooltip.tsx` | 50+ registry entries, cross-references, heading/inline modes |

---

## 3. Current Status — All Systems Verified

### Frontend-Backend Consistency (Verified ✓)

| Area | Status |
|------|--------|
| XP multipliers (Kraft, forge temp, companion, gear, hoarding) | ✓ Match |
| Gold multipliers (Weisheit, streak, forge temp, legendary) | ✓ Match |
| Drop chance (Glück, luck buff, pity, workshop) | ✓ Match |
| Gacha pity (soft 55, hard 75, +2.5%/pull) | ✓ Match |
| Quest XP/Gold tables by rarity | ✓ Match |
| Streak bonus (+1.5%/day, cap 45%) | ✓ Match |
| Hoarding penalty (-10%/quest over 20, soft -50% at 25, hard -80% at 30) | ✓ Match |
| Forge temp XP/Gold tiers | ✓ Match |
| Vow difficulty multipliers | ✓ Match |
| Daily mission thresholds/rewards | ✓ Match |
| Rift difficulty scaling per tier | ✓ Match |
| All 8 stat effects | ✓ Match |
| Currency operations | ✓ Match |
| Crafting costs/cooldowns | ✓ Match |

### Modal Behavior (All Consistent ✓)

All modals use `useModalBehavior` hook: ESC key, body scroll lock, backdrop-click-to-close.

### Reward Celebration Coverage (All ✓)

Quest completion, daily bonus, rituals, vows, battle pass, factions, world boss, dungeons, companions, challenges (Star Path + Expedition), gacha (own animation).

---

## 4. Remaining Acknowledged Issues

| Issue | Severity | Status |
|-------|----------|--------|
| Companion Expeditions have no frontend UI | MEDIUM | Backend complete; needs CompanionsWidget integration |
| Gem socket UI auto-picks first available gem | LOW | Should have picker modal |
| `var changelogInterval` in server.js | LOW | Cosmetic |
| Gold stored in both `u.gold` and `u.currencies.gold` | LOW | Historical, backend handles both |
| `selectDailyQuests` dead code in rotation.js | INFO | Exported but never called |
| Modal backdrop opacity varies by modal type | LOW | Visual hierarchy by importance |
| Some `@next/next/no-img-element` lint warnings | N/A | Intentional — static export |
| React compiler warnings | N/A | Pre-existing, no runtime impact |
| CORS `origin: true` | MEDIUM | By design for single-user/self-hosted |

---

## 5. Fix History (Sessions 1–24)

### Critical Fixes

| Commit | Date | Fix |
|--------|------|-----|
| `e9e40e9` | 03-22 | Battlepass + factions `req.playerName` → `req.auth.userId` (routes 404'd for all users) |
| `e9e40e9` | 03-22 | Factions `saveData()` → `saveUsers()` (rewards lost on restart) |
| `77c52c2` | 03-21 | Rift bypassed entire reward pipeline (no XP multipliers, no loot) |
| `c75889b` | 03-21 | Battle Pass claim called `saveData()` instead of `saveUsers()` |
| `c75889b` | 03-21 | `.find().value` without null safety in timezone helpers |
| `8471133` | 03-21 | 3 missing imports crashed daily mission + workshop upgrade endpoints |
| `03c5c3a` | 03-22 | Dungeon success calculated independently per player (should be group-wide) |
| `03c5c3a` | 03-22 | Dungeon gear drops not actually rolled |
| `03c5c3a` | 03-22 | Dungeon material IDs invalid (English instead of German) |
| `03c5c3a` | 03-22 | Companion expedition gem key format wrong (`_t1` → `_1`) |
| `03c5c3a` | 03-22 | World boss frames stored in wrong field (`frames` → `unlockedFrames`) |
| `123168a` | 03-22 | Gem socket/unsocket/upgrade sent wrong params (never worked) |
| `d214cd6` | 03-22 | World boss double-claim race condition |
| `d214cd6` | 03-22 | Dungeon uid not lowercased (friendship checks failed) |
| `e3e573c` | 03-22 | World boss claim race + Mythic rift level uncapped + dungeon collect race |
| `1ad69ef` | 03-22 | BattlePass material IDs English→German, 3 missing BP titles, 4 missing faction recipes |
| `0db9592` | 03-22 | Factions: legendaryEffect + recipe rewards not claimable, shop discount dead |
| `35d6370` | 03-22 | Collection log crash (API field name mismatch) |

### High Fixes

| Commit | Date | Fix |
|--------|------|-----|
| `c75889b` | 03-21 | Habit score/delete missing ownership check |
| `c63420a` | 03-22 | Quest approve/reject no admin check |
| `c63420a` | 03-22 | Dungeon loot rarity relabeled but stats unchanged |
| `c63420a` | 03-22 | Habit XP/loot farming unlimited daily |
| `f935bca` | 03-22 | JSON corruption risk (non-atomic writes → write-tmp-rename) |
| `f935bca` | 03-22 | Timing attack in master key comparison |
| `2e8a5b1` | 03-22 | InventoryTooltip level req always gray (`_playerLevel` never set) |
| `2e8a5b1` | 03-22 | Unequip button invisible for GearInstance objects |
| `71e28f4` | 03-22 | Tooltip z-index (9950) behind modals (10000+) → raised to 10100+ |

### Medium Fixes

| Commit | Date | Fix |
|--------|------|-----|
| Various | 03-20–22 | Trade field mapping, conversations sort, friend level shows XP, ForgeView modals missing useModalBehavior, NPC departures not processed, MASTER_KEY env never read, getBondLevel fallback wrong key, forge temp hardcoded decay, trade item dedup, gacha pity_minus_5 applied 10x in pull10, crafting reroll negative index |

### QoL Improvements (Sessions 1–24)

| Category | Improvements |
|----------|-------------|
| **Visual** | Quest card emboss + grain, Diablo progress bars, stat card depth, atmospheric modal backdrops, reward burst animation, enhanced tab transitions |
| **Tooltips** | 50+ GameTooltip registry entries, cross-references, heading/inline modes, disabled button deficit tooltips |
| **Social** | Online status (3-tier), read receipts, activity feed, player profiles, player search, new message button, trade item grid |
| **Challenges** | Weekly reset timer, cumulative star rewards, expedition fair share bars, modifier banners |
| **Feedback** | Reward celebrations on all claim flows, claim error auto-dismiss, "Clear Search" buttons |
| **Translation** | 200+ German→English interactive UI strings across 30+ files |
| **Polish** | 12px min font size, skeleton loading states, smooth tab transitions, disabled button cursor:not-allowed |

---

## Appendix A: Known Non-Issues & Agent Traps

> **CRITICAL: Read this BEFORE any audit.** These have been verified multiple times.

### A.1 Features That Already Exist

| Feature | Location |
|---------|----------|
| Floating reward numbers | `FloatingRewards.tsx`, `globals.css @keyframes floatRewardUp` |
| Daily bonus claim | `routes/currency.js:113` |
| Ritual/Habit CRUD | `routes/game.js` (rituals), `routes/habits-inventory.js` (habits) |
| Hidden achievement placeholders | `HonorsView.tsx:137-156` |
| Item flavor text in tooltips | `CharacterView.tsx:456-457` |
| Material cost owned/needed | `ForgeView.tsx:879-889` |
| Salvage All by rarity | `ForgeView.tsx:980-987` |
| Weekly reset timer | `ChallengesView.tsx:53-78` |
| Star rating animations | `globals.css @keyframes star-earn` |
| Gacha pity display | `GachaView.tsx` |
| NPC rank glow | `ForgeView.tsx:482-487` |
| Batch crafting x1-x10 | `ForgeView.tsx:831-839` |
| Message auto-refresh 10s | `SocialView.tsx:273-279` |
| Friend auto-refresh 30s | `SocialView.tsx:97-101` |
| Craft cost batch preview | `ForgeView.tsx:874-889` |
| ESC close all modals | `ModalPortal.tsx useModalBehavior` |
| Player search | `SocialView.tsx` debounced `/api/players/search` |
| Player profile modal | `PlayerProfileModal.tsx` |
| Daily mission checklist | `routes/config-admin.js`, `page.tsx` |
| Workshop upgrades | `shopItems.json`, `routes/shop.js`, `lib/helpers.js` |
| Tavern/rest mode | `TavernView.tsx`, `routes/players.js` |
| Rift system | `RiftView.tsx`, `routes/rift.js` |
| Rift abandon confirmation | `RiftView.tsx` 2-step confirm |

### A.2 Verified Non-Bugs

| "Bug" | Why It's Not |
|-------|-------------|
| Gacha pull lock in-memory only | Single-process Node.js — distributed locks unnecessary |
| Hard pity off-by-one (74 vs 75) | Counter=74 means 75th pull, `>= HARD_PITY-1` correct |
| Trade execution race condition | Single-threaded + trade locks added |
| NPC quests skip forge temp | `onQuestCompletedByUser()` calls `updateUserForgeTemp()` for all paths |
| Crafting reroll missing poolEntry check | `if (poolEntry)` check exists |
| German stat names (Kraft etc.) | Intentional game-world proper nouns |
| Gold in both `u.gold` and `u.currencies.gold` | Historical migration, backend handles both |
| `var changelogInterval` | Cosmetic — hoisting needed for clearInterval |
| `selectDailyQuests` dead code | May be useful for future rotation changes |
| Hearth enter no confirmation | UI shows comprehensive consequences panel |
| `loadingAction` blocks all quest actions | Single-quest interaction pattern is typical |

### A.3 Architectural Decisions (Do NOT "Fix")

| Decision | Rationale |
|----------|-----------|
| JSON file persistence | Intentional for <50 user app |
| TutorialModal in German | Target audience is German-speaking |
| No CSRF protection | JWT/API key on all mutating endpoints |
| No test suite | Validation via `verify-items.js` + ESLint |
| `@next/next/no-img-element` | Static export with pixel art |

### A.4 Translation Rules

| Context | Language |
|---------|----------|
| Interactive UI (buttons, labels, errors) | **English** |
| Backend API errors | **English** |
| TutorialModal / Guide | **German** (keep) |
| Gear descriptions / flavor text | **German** (keep) |
| Currency names (Runensplitter etc.) | **German** (game proper nouns) |
| Stat names (Kraft, Weisheit etc.) | **German** (game proper nouns) |

### A.5 Agent Mistakes to Avoid

1. Always search codebase before claiming a feature is missing
2. Routes span 24 files — check all before reporting missing endpoints
3. Don't report single-process race conditions as bugs
4. Don't translate German lore/flavor text
5. Don't suggest adding a database or `next/image`
6. Use `req.auth?.userId` — NOT `req.playerName` (doesn't exist)
7. Use `saveUsers()` for user data — NOT `saveData()` (agents only)
8. Check Appendix A before re-investigating

---

## 6. Session 24 — Visual Overhaul & UI Consistency (2026-03-22)

### Visual Changes Applied

| Change | Files | Description |
|--------|-------|-------------|
| Quest card emboss | `QuestCards.tsx`, `globals.css` | Inset shadows, grain overlay, 4px rarity accent with glow |
| Diablo progress bars | `globals.css`, `UserCard.tsx`, `FactionsView.tsx`, `BattlePassView.tsx`, `CampaignHub.tsx` | 7px, beveled, segment marks, pulse at >90% |
| Stat card depth | `StatBar.tsx`, `globals.css` | Radial gradient highlight + inset shadows |
| Atmospheric modal backdrops | `ModalPortal.tsx`, `globals.css` | Radial gradient vignette + blur (system-wide via ModalPortal) |
| Reward burst animation | `RewardCelebration.tsx`, `globals.css` | Scale bounce-in + atmospheric backdrop |
| Enhanced tab transitions | `globals.css` | 10px translateY, 0.3s cubic-bezier |

### Tooltip Registry Completed

Added 3 missing entries: `gear_score`, `collection_log`, `mythic_rift`. All displayed game mechanics now have tooltip coverage.

### UI Design Guidelines

Added comprehensive design rules to `CLAUDE.md`: typography, colors, interactions, feedback, tooltips, modals, visual depth, animations, 8-point consistency checklist.

### Changelog

| Commit | Description |
|--------|-------------|
| `4ef0663` | Visual overhaul: quest emboss, Diablo bars, stat depth, atmospheric modals |
| `0db1930` | UI Design Guidelines in CLAUDE.md |
| `e6a60f9` | Compress AUDIT_REPORT.md (2938 → 270 lines) |
| `be52d3e` | System-wide atmospheric modals + Diablo bars on factions/battlepass/campaigns |
| `4ddacac` | Missing tooltip registry entries: gear_score, collection_log, mythic_rift |

---

*End of Audit Report*
