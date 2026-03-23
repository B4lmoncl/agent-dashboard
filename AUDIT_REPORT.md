# Quest Hall — Codebase Audit Report

> Last updated: 2026-03-23 · v1.5.3 · Sessions 1–29

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

Also: 3 tooltip registry entries added, UI Design Guidelines added to CLAUDE.md.

---

## 7. Session 25 — Item System Expansion + Audit (2026-03-22)

### Item Content Batch

Massive item pool expansion inspired by WoW Classic (item budget, source exclusivity) and Diablo 3 (primary/secondary split, Loot 2.0):

| Batch | Items | Source |
|-------|-------|--------|
| Rebalance | 55 existing | New rules: Rarity=affix count, Level=stat values |
| General Pool | +65 | gen-* (quest drops, shop, world drops) |
| Dungeon + Rift | +53 | dun-*, rift-* (source-locked) |
| Faction + Challenge + BP | +55 | fac-*, ch-*, bp-* (rep/skill-gated) |
| Endgame + WB + Gacha | +23 | wb-*, gacha-*, end-* |
| Consumables | +18 | itemTemplates.json |
| Unique Items | +8 | uniqueItems.json (6 WB + 2 gacha) |
| Named Sets | +6 | gearTemplates.json namedSets |
| **Total** | **251 gear + 18 consumables + 14 uniques + 9 sets** | |

### Balancing Rules (documented in CLAUDE.md)

- Affix counts: Common [1,1]/[0,0] → Legendary [3,3]/[2,2]
- Stat ranges by level (identical for all rarities): Lv1-10 (1-3) → Lv41-50 (5-8)
- 12 new legendary effect types added
- BiS ceiling: Lv50 Legendary = 15-24 primary + 6-12 minor + effect

### Audit Fixes (Session 25)

| Commit | Severity | Fix |
|--------|----------|-----|
| `8887e64` | CRITICAL | 12 legendary effect types had no backend handlers in getLegendaryModifiers() |
| `8887e64` | CRITICAL | 6 world boss uniqueDrops IDs mismatched uniqueItems.json (items unobtainable) |
| `8887e64` | CRITICAL | world-boss.js:387 null crash when boss template missing |
| `fa83fde` | HIGH | Gacha unique items (astral-veil, wheel-of-fate-shield) not in gacha pool |
| `fa83fde` | HIGH | RiftView missing RewardCelebration on stage/rift completion |
| `fa83fde` | HIGH | RiftView checkmark fontSize: 8 → 10 (below 12px minimum) |
| `2dcffda` | MEDIUM | Missing cursor:not-allowed on WorldBoss, BattlePass, Factions disabled buttons |
| `2dcffda` | MEDIUM | 12 new consumable effect types had no handlers in habits-inventory.js |

## 8. Session 26 — Deep Audit: Modifier Wiring + Data Integrity (2026-03-22)

### Key Finding: "Wired but not applied" pattern

Session 25 added 12 legendary effect types to `getLegendaryModifiers()` and 12 consumable effect handlers — but the modifiers were only *extracted*, never *consumed* by game logic. Session 26 wired all of them into the correct routes.

### Audit Fixes (Session 26)

| Commit | Severity | Fix |
|--------|----------|-----|
| `156a477` | CRITICAL | Wire 6 legendary modifiers: critChance (double quest rewards), companionBondBoost (bond XP), factionRepBoost (faction rep), challengeScoreBonus (star calc), forgeTempFlat (forge temp), consumable buff `chargesRemaining` consumption |
| `156a477` | CRITICAL | Transmute filter used `g.tier === 4` (property doesn't exist on FULL_GEAR_ITEMS) — always returned empty |
| `156a477` | CRITICAL | Shop gear/buy deducted `u.gold` without syncing `u.currencies.gold` — inconsistent state |
| `156a477` | MEDIUM | Personal quest type missing from achievement evaluator (`_personalCount` never tracked) |
| `b519891` | CRITICAL | Wire remaining 6 legendary modifiers: dungeonLootBonus (dungeon rewards), pityReduction (gacha pity), gemPreserve (gem unsocket), salvageBonus (salvage materials), cooldownReduction (craft cooldowns), ritualStreakBonus (ritual XP) |
| `05b0fa9` | HIGH | Daily rotation ran on server restart (deploy caused unexpected NPC spawns) — now only runs at midnight Berlin |

### Systems Verified Clean

- JSON data file consistency (all template cross-references valid)
- State Map synchronization (questsById, usersByName, usersByApiKey all in sync)
- Level system (50 levels, XP thresholds match frontend/backend)
- Server boot sequence (proper initialization order)
- Campaign, currency, social, gacha, shop, integration routes

## 9. Session 27 — Full Codebase Audit + Today Drawer Overhaul (2026-03-22)

### Today Drawer Visual Overhaul

Complete redesign of TodayDrawer.tsx with 13 new visual features:
- 2-column mini-card grid layout (replacing flat list rows)
- Centered level ring with animated glow trail + mini companion avatar
- Streak flame SVG (CSS animated, color scales with streak days)
- Forge ember particles (rising from temp bar, intensity scales)
- Floating mote particles (time-of-day colored) + night stars
- Time-of-day ambient backgrounds (4 gradients)
- SVG progress arc with category segment dots (replacing flat bar)
- Staggered card entry animation + magic divider particles
- Reward badges with currency icons
- Custom SVG calendar icon (replacing 📅 emoji)

5 self-audit rounds cleaned: dead CSS, animation conflicts, gradient IDs, cursor guidelines, font size minimums.

### Full Codebase Audit Findings & Fixes

3 parallel agents scanned ~35k lines: frontend UI guidelines, backend routes, frontend-backend consistency.

| Commit | Severity | Fix |
|--------|----------|-----|
| `a383f8e` | CRITICAL | `factions.js:216` undefined `uid` → `user.id` (ReferenceError on every faction rep gain) |
| `a383f8e` | CRITICAL | `challenges-weekly.js:113` undefined `userId` → `u.id` (ReferenceError on star calculation) |
| `a383f8e` | HIGH | Gold desync in 5 routes: dungeons, rituals, shop-equip, crafting learn+craft — `u.gold` not synced with `u.currencies.gold` |
| `71e1bea` | CRITICAL | DungeonView Cancel Run: added 2-step confirmation (was single-click destructive action) |
| `71e1bea` | CRITICAL | ChallengesView Sternenpfad stage claim: added RewardCelebration (was silently refreshing) |
| `98a2689` | HIGH | Disabled button `cursor:not-allowed` + `title` tooltips in RiftView, TavernView, DungeonView, ChallengesView |
| `f4f8d55` | HIGH | Missing `<img>` onError handlers in CharacterView (11), GachaView, GachaPull, LeaderboardView, CompanionsWidget |
| `5d850b4` | MEDIUM | Rift tooltip difficulty values wrong (hardcoded "1x/2x/3.5x" → computed formula matching backend) |
| `5d850b4` | MEDIUM | Rift Mythic tooltip "+0.25x per level" → "+0.3x" (matches `mythicLevel * 0.3` in backend) |
| `5d850b4` | MEDIUM | Challenge 9-star milestone label missing 150 Gold from reward description |
| `5d850b4` | MEDIUM | Login error responses return 401 instead of 200 (3 auth paths) |
| `480deaf` | HIGH | Centralize gold dual-field sync: `awardUserGold` + `awardCurrency` + `addLootToInventory` now sync both `u.gold` and `u.currencies.gold` |
| `480deaf` | HIGH | Fix 3 remaining gold desync sites: consumable gold effect, multi_reward, transmute deduction |
| `480deaf` | LOW | DungeonView: reset confirmCancel state when activeRun changes |

### Known Remaining (Low/Cosmetic — Not Fixed)

| Item | Reason Not Fixed |
|------|-----------------|
| ForgeView hardcoded WORKSHOP_TIERS | Values match backend, would need API refactor to fetch |
| World Boss tooltip omits gear score multiplier | Simplified, not inaccurate |
| `npcs-misc.js` feedback endpoint no auth | Admin-only feature, 500-entry cap, text validation exists |
| `agents.js` NaN propagation on numeric inputs | Agent API is internal-only, not player-facing |
| `config-admin.js` uses UTC date instead of Berlin for daily bonus check | Edge case near midnight, dashboard is informational only |
| Small click targets in SocialView, ChallengesView star buttons | Would require layout redesign |

### Systems Verified Clean

- World Boss: all data from API, tooltips accurate
- Dungeons: success formula matches, data from API
- Battle Pass: all data from API, no mismatches
- Factions: all data from API (backend bug was the only issue, now fixed)
- Gacha: pity counters + rates from API, tooltips match
- Gems: all data from API, unsocket cost matches
- Crafting: all data from API (except workshop tiers — values match)

## 10. Session 28 — Deep Performance & Data Structure Audit (2026-03-23)

### Audit Scope

Full codebase audit focusing on:
- Backend data structure efficiency and persistence patterns
- API route performance (O(n) vs O(1) lookups)
- Frontend rendering efficiency and context patterns
- Security hardening

### Critical & High Fixes

| Severity | Fix | Files |
|----------|-----|-------|
| CRITICAL | `getActiveBuffs()` mutated user state without saving — expired buffs reappeared on restart | `lib/state.js` |
| CRITICAL | Gold desync in gem unsocket/upgrade — `u.gold` not synced after `u.currencies.gold` deduction | `routes/gems.js` |
| HIGH | GitHub webhook bypass — `verifyGitHubSignature()` returned `true` when secret not configured (fail-open → fail-closed) | `routes/integrations.js` |
| HIGH | Campaign PATCH/DELETE used `requireApiKey` — any user could modify/delete campaigns (→ `requireMasterKey`) | `routes/campaigns.js` |
| HIGH | Weekly challenge backfill (stars/stageStartedAt) never called `saveUsers()` — data lost on restart | `routes/challenges-weekly.js` |

### Performance Optimizations

| Severity | Optimization | Impact | Files |
|----------|-------------|--------|-------|
| MEDIUM | Friendship O(1) index — `areFriends()` now uses `Map<playerId, Set<friendId>>` instead of O(n) array scan | Every message, trade, friend request | `routes/social.js` |
| MEDIUM | Mythic leaderboard cache — `getMythicLeaderboard()` with 1min TTL replaces O(n) user scan on every GET /api/rift | Every rift status request | `routes/rift.js` |
| MEDIUM | `campaignsById` Map — O(1) campaign lookup replaces 6× `.find()` calls | Campaign CRUD operations | `lib/state.js`, `routes/campaigns.js` |
| MEDIUM | Dashboard sync FS I/O removed — `worldBossActive` and `dungeonActive` now use in-memory state via exported functions instead of `readFileSync()` on every `/api/dashboard` request | Every dashboard load | `routes/config-admin.js`, `routes/world-boss.js`, `routes/dungeons.js` |

### Architecture Analysis & Recommendations

#### Data Structure Assessment

| Structure | Current | Verdict |
|-----------|---------|---------|
| `state.questsById` (Map) | O(1) quest lookup | Good — correctly used |
| `state.usersByName` (Map) | O(1) user lookup | Good — correctly used |
| `state.gearById` (Map) | O(1) gear lookup | Good — correctly used |
| `state.campaignsById` (Map) | **NEW** — O(1) campaign lookup | Added this session |
| Friendship index (Map→Set) | **NEW** — O(1) friend check | Added this session |
| Mythic leaderboard (cached) | **NEW** — 1min TTL cache | Added this session |
| JSON file persistence | Debounced 200ms + atomic writes | Appropriate for <50 users |

#### Identified but NOT Fixed (Low Priority / Architectural)

| Issue | Severity | Reason Not Fixed |
|-------|----------|-----------------|
| `getLevelInfo()` linear search (50 levels) | LOW | 50 iterations is negligible; binary search gains <1ms |
| `questIdToNpc` map rebuilt per call | LOW | Small dataset (<20 NPCs); would need NPC engine refactor |
| `getStanding()` linear search (6 tiers) | LOW | 6 entries — O(1) gain negligible |
| No transactional writes across data files | MEDIUM | Architectural; would need WAL or DB migration |
| `state.users` Object vs Map | LOW | Object is fine for <10k users; Map migration is breaking |
| Activity log unbounded growth | LOW | Already capped at 500 entries |
| Boot sequence sequential loads | LOW | <2s total; parallelizing saves ~500ms but adds complexity |

#### Frontend Performance Assessment

| Pattern | Status | Notes |
|---------|--------|-------|
| Lazy-loaded views (17) | Good | Proper `React.lazy()` + `Suspense` |
| `React.memo` on QuestCards/AgentCard | Good | Correctly applied |
| `content-visibility: auto` on cards | Good | Reduces off-screen rendering |
| DashboardContext single provider | Acceptable | Splitting into 3 contexts would help at scale but adds complexity |
| 1s ticker re-renders | Known | Cosmetic "X seconds ago" — low impact |
| page.tsx monolith (2350 lines) | Known | Functional but hard to maintain; would benefit from splitting |

### Systems Verified Clean

- All O(1) Map lookups (questsById, usersByName, usersByApiKey, gearById, campaignsById) confirmed in sync
- Gold dual-field sync (`u.gold` ↔ `u.currencies.gold`) now consistent across all routes
- All mutating campaign endpoints now require admin auth
- Webhook signature verification fails closed
- Buff expiration persisted correctly

## 11. Session 29 — Item Lore, Unique Rarity Color, Full Audit + QoL Cross-Links (2026-03-23)

### Item Content

| Change | Files | Description |
|--------|-------|-------------|
| Flavor text for all gear | `gearTemplates.json` | 251 items now have `flavorText` (German, Kingkiller Chronicle tone) |
| Unique item rarity color | 10+ files | `#e6cc80` (WoW artifact gold) for `isUnique: true` items, distinct from legendary orange |

### Audit Fixes

| Commit | Severity | Fix |
|--------|----------|-----|
| `dbd5dca` | MEDIUM | GameTooltip Mythic+ scaling says +0.25× but backend uses +0.3× → fixed |
| `dbd5dca` | CRITICAL | `u.gold -= cost` without null check → NaN corruption risk (habits-inventory.js:596) |
| `dbd5dca` | HIGH | Unsafe `template.affixes.primary/minor.pool` access without null check (crafting.js:460,476) |

### QoL: Cross-Navigation Links (13 components)

WoW/Diablo/HSR-inspired cross-linking — feature cards, rewards, and stats link to their relevant views:

| Component | Links Added |
|-----------|-------------|
| TodayDrawer | Daily mission cards → Quest Board, Rituals, Character, Forge; Stat cards → detail views |
| UserCard | Forge→Forge, Quests→QuestBoard, Points→Honors, Streak→Rituals, Companion→Character |
| RewardCelebration | Currency rewards → "Spend →" links (Gold→Shop, Rune→Gacha, Essenz→Forge) |
| SocialView | Activity feed events clickable with → indicator and navigation |
| LeaderboardView | Player rows open PlayerProfileModal |
| BattlePassView | Title/frame rewards → Character, recipe rewards → Forge |
| FactionsView | Recipe/frame/effect rewards → Forge/Character links |
| WorldBossView | Unique drops → Collection Log, materials → Forge |
| DungeonView | Gear rewards → Character, materials → Forge |
| ShopView | Boost items explain where they apply (Quest Board, Rituals, Forge) |
| CompanionsWidget | Companion card clickable → Character view |
| GachaPull | Pull result → "View in Inventory →" → Character |

### Systems Verified Clean

- All 12 cross-link navigations use existing `onNavigate` / `setDashView` callback pattern
- No new props needed on page.tsx beyond wiring existing `onNavigate`
- Build passes with 0 TypeScript errors

---

## 11. Session 29 — UI/UX Consistency & Type Safety Audit (2026-03-23)

### Audit Scope

Full codebase audit: frontend-backend consistency, UI Design Guidelines compliance, code quality.

**Frontend-Backend Consistency: No issues found.** All API calls match endpoints, response fields consistent.

### Fixes

| Severity | Fix | Files |
|----------|-----|-------|
| CRITICAL | 17 font sizes below 12px minimum raised (decorative icons→10px, readable text→12px) | CharacterView, DailyLoginCalendar, QuestCards, QuestDetailModal, SocialView, TodayDrawer, RitualChamber |
| CRITICAL | 9 `as any` casts removed with proper TypeScript types | CharacterView, RitualChamber, WandererRest, GachaView, types.ts |
| HIGH | Shop gold deduction null-safety — validate `cost` is finite before arithmetic | habits-inventory.js |
| HIGH | 3 disabled buttons missing `cursor: not-allowed` + tooltip | CompanionsWidget, PlayerProfileModal, CampaignHub |
| MEDIUM | 7 silent error catches now log to console.error | RoadmapView, OnboardingWizard (2), ForgeView (4) |

Also fixed: Turbopack parse error in ForgeView (IIFE in JSX replaced with conditional render).

### Commits

| Commit | Severity | Description |
|--------|----------|-------------|
| `88dad38` | CRITICAL | Fix Turbopack parse error in ForgeView cost preview IIFE |
| `41df85a` | CRITICAL | 17 font size fixes, 9 `as any` removals, null safety, disabled buttons, silent catches |

---

*End of Audit Report*
