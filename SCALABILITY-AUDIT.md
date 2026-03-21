# Scalability Audit — Quest Hall Dashboard
**Date:** 2026-03-11 | **Task:** #10 | **Codebase:** Next.js 16 + Express

---

## Executive Summary

The app has solid bones. Since the initial audit, `server.js` was reduced from ~5200 to ~310 lines (routes extracted to 19 files), and `app/page.tsx` from ~7900 to ~2150 lines (views lazy-loaded). Most hardcoded data was extracted to JSON templates. Race conditions remain theoretical in the single-process deployment model.

---

## 1. Template System

### Quest Templates
🟡 **Okay**

- Runtime quests have: `title`, `description`, `priority`, `type`, `categories`, `lore`, `chapter`, `skills`, `minLevel`, `classRequired`, `recurrence`, `rewards`, `nextQuestTemplate`, `checklist`
- `flavor` field existed only as an intent — **added to bulk import endpoint** (Quick Win ✅)
- `questCatalog.json` starts empty, seeded at runtime; catalog is NOT persisted across restarts without manual save
- Quest catalog schema differs from runtime quest schema (loose coupling)

**Recommendations:**
- P1: Persist `questCatalog.json` on every seed to survive restarts
- P2: Unify catalog template schema with runtime quest schema (or add a migration layer)
- P3: Add JSON Schema validation for imported quests

### NPCs
🟡 **Okay**

- NPC Quest Givers: fully data-driven via `npcQuestGivers.json` ✅
- Campaign NPCs: were hardcoded — **extracted to `campaignNpcs.json`** (Quick Win ✅)
- NPC dialogue / flavor text: embedded inline in `npcQuestGivers.json` ✅

### Items / Gear
🔴 **Problem**

- `gearTemplates.json` has 60+ items (rich, with descriptions)
- `server.js` ALSO has 24 gear items hardcoded as `FULL_GEAR_ITEMS` with different IDs (`wood-sword` vs `t1-sword`)
- Merge logic in `loadGearTemplates()` skips duplicates by ID — so both sets coexist as two parallel gear catalogs
- **Two sources of truth for gear; neither is authoritative**

**Recommendations:**
- P1: Canonicalize IDs — migrate `FULL_GEAR_ITEMS` inline items into `gearTemplates.json` with matching IDs, then remove the inline block
- P2: Add `POST /api/admin/gear/import` endpoint to add new gear without code changes

### Classes & Specializations
🟡 **Okay**

- `classes.json` is data-driven ✅
- Currently only 1 class (Network Sage) — adding more requires only editing the JSON
- No specialization sub-system yet (future feature)

---

## 2. Data Architecture

### Config vs Runtime State
🔴 **Problem** (partially addressed by Quick Wins)

| Data | Before | After Quick Win |
|------|--------|-----------------|
| Level progression | Hardcoded in server.js | `levels.json` ✅ |
| Quest flavor text | Hardcoded in server.js | `questFlavor.json` ✅ |
| Campaign NPCs | Hardcoded in server.js | `campaignNpcs.json` ✅ |
| Economy (XP/Gold/Temp) | Hardcoded | `gameConfig.json` ✅ |
| Streak milestones | Hardcoded | `gameConfig.json` ✅ |
| Loot/Rarity weights | Hardcoded | `gameConfig.json` ✅ |
| Equipment slots | Hardcoded | `gameConfig.json` ✅ |
| Bond levels | Duplicated (server.js + companions.json) | `companions.json` only ✅ |
| Achievement catalog | Hardcoded (28 entries) | Still in server.js 🔴 |
| FULL_GEAR_ITEMS (24) | Hardcoded | Still in server.js 🔴 |

**Remaining P1 items:**
- Extract `ACHIEVEMENT_CATALOGUE` to `public/data/achievementTemplates.json`
- Extract `FULL_GEAR_ITEMS` inline block into `gearTemplates.json` (consolidate IDs)

### Seasons & Campaigns
🟡 **Okay**

- `campaigns.json` is data-driven, persisted ✅
- No Season concept exists yet — currently the entire app is one perpetual season
- Adding new campaigns: edit `campaigns.json` or POST via API ✅

**Recommendations:**
- P2: Add a `seasons.json` schema with `startDate`, `endDate`, `activeQuestTypes`, `bonusMultiplier`
- P3: Season rotation endpoint `POST /api/admin/seasons/rotate`

---

## 3. Multi-Player

### Isolation
🟡 **Okay**

- `playerProgress.json` tracks per-player quest completion ✅
- `PLAYER_QUEST_TYPES` separates personal quests from shared dev quests ✅
- Inventory, companions, gear, gold, XP — all per-user ✅
- Player login via API key ✅

### Race Conditions
🔴 **Problem**

All save functions (`saveQuests`, `saveUsers`, `saveCampaigns`, etc.) use synchronous `fs.writeFileSync` with no write locking:

```js
// Example pattern — all saves are unprotected
function saveQuests() {
  fs.writeFileSync(QUESTS_FILE, JSON.stringify(quests, null, 2));
}
```

**Concrete risk scenarios:**
1. Player A completes quest at the same moment Player B completes a different quest → `saveUsers()` called simultaneously → one write overwrites the other → XP/gold lost
2. Quest claim by two players at the same time → both see `claimedBy: null`, both set themselves as claimer → last write wins → wrong claimer stored
3. `buildQuestPool()` has no atomic guard → concurrent requests trigger duplicate pool adds

**Recommendations:**
- P1: Add a simple write-queue (async queue that serializes saves per file)
- P1: Add claim check: `if (quest.claimedBy && quest.claimedBy !== userId) return 409`
- P2: Replace flat JSON files with SQLite (better-sqlite3) for atomic writes
- P3: Redis or similar for session-level locking at scale

---

## 4. Frontend Scalability

### page.tsx Monolith
🔴 **Problem**

`app/page.tsx` is ~7900 lines. Everything lives in one component tree:

| Section | Estimated Lines | Should Be |
|---------|----------------|-----------|
| Quest Board + filters | ~1500 | `components/QuestBoard.tsx` |
| Player cards + progression | ~800 | `components/PlayerSection.tsx` |
| Agent roster | ~600 | `components/AgentRoster.tsx` |
| Campaign / D&D view | ~700 | `components/CampaignView.tsx` |
| Leaderboard | ~400 | `components/Leaderboard.tsx` |
| Honors / Achievements | ~500 | `components/HonorsView.tsx` |
| Changelog | ~300 | `components/ChangelogView.tsx` |
| Tutorial modal | ~400 | `components/TutorialModal.tsx` |
| Shop / Gear | ~600 | `components/ShopView.tsx` |

**Recommendation:** P2 — Component splitting. No behavior change needed, just extract. Start with the largest independent sections.

### Hardcoded Config in Frontend
🟡 **Okay** (partially)

- `priorityConfig`, `categoryConfig`, `productConfig`, `typeConfig` — hardcoded color maps in `page.tsx`
- `streakMilestones` — hardcoded client-side, duplicates server constants
- **Quick Win available:** fetch from new `GET /api/config` endpoint (added ✅) instead of duplicating

**Recommendations:**
- P1: Replace client-side `streakMilestones` with data from `GET /api/config`
- P2: Replace `typeConfig` colors with data from `GET /api/config` (add type metadata to gameConfig.json)
- P3: Full i18n — labels like `"2-Wochen"`, `"Unerschütterlich"` hardcoded in both server and client

### Localization
🔴 **Problem**

- German labels hardcoded in both server.js (`streakMilestones`) and page.tsx
- No i18n infrastructure (no next-i18next, no translation keys)
- All flavor text and NPC dialogue is German

**Recommendation:** P3 — Add locale field to `gameConfig.json`, wrap labels in a `t()` function, add `locales/de.json`

---

## 5. Content Pipeline

### Batch API Integration
🟡 **Okay** (improved by Quick Wins)

| Capability | Before | After Quick Win |
|------------|--------|-----------------|
| Bulk quest creation | ❌ (100 API calls) | `POST /api/quests/import` ✅ |
| Bulk quest status update | ✅ existing | — |
| Bulk NPC import | ❌ | Still missing 🔴 |
| Bulk gear import | ❌ | Still missing 🔴 |
| Bulk achievement award | ❌ | Still missing 🔴 |
| Config live-reload | ❌ | Still missing 🟡 |
| Flavor text hot-update | ❌ (restart needed) | Edit `questFlavor.json` + restart 🟡 |

**New `POST /api/quests/import` features:**
- Dedup guard (skips title+type duplicates that are open/in_progress)
- Supports `flavor`, `lore`, `rewards`, `classRequired`, `checklist` fields
- Returns `{ created, skipped, errors }` for batch feedback

**Recommendations:**
- P1: Add `POST /api/admin/config/reload` endpoint to hot-reload JSON config files without restart
- P2: Add `POST /api/npcs/import` for NPC batch creation
- P2: Add `POST /api/admin/achievements/import` for achievement batch creation
- P3: Webhook or file-watcher for `questFlavor.json` live updates

---

## Quick Wins — Summary

All implemented in this session (no behavioral changes, pure extraction):

| # | Change | Files |
|---|--------|-------|
| 1 | Extract level progression | `public/data/levels.json` → server.js load |
| 2 | Extract quest flavor text | `public/data/questFlavor.json` → server.js load |
| 3 | Extract campaign NPCs | `public/data/campaignNpcs.json` → server.js load |
| 4 | Extract economy constants | `public/data/gameConfig.json` → XP/Gold/Temp/Streak/Rarity/Slots |
| 5 | Fix BOND_LEVELS duplication | `companions.json` is now sole source; server.js reads from it |
| 6 | Add bulk quest import API | `POST /api/quests/import` with dedup guard + full field support |
| 7 | Add config API endpoint | `GET /api/config` exposes constants to frontend |

---

## Remaining Backlog

### P1 — Do Soon
- [ ] Extract `ACHIEVEMENT_CATALOGUE` (28 entries) to `public/data/achievementTemplates.json`
- [ ] Consolidate `FULL_GEAR_ITEMS` inline block into `gearTemplates.json`
- [ ] Add write-queue / claim-lock to prevent race conditions
- [ ] Add `POST /api/admin/config/reload` for hot-reload without restart
- [ ] Frontend: fetch streak milestones from `GET /api/config` instead of hardcoding

### P2 — Next Sprint
- [ ] Split `app/page.tsx` into component files (start with QuestBoard, PlayerSection)
- [ ] Add `POST /api/npcs/import` bulk NPC creation
- [ ] Add seasons system (`seasons.json`, season rotation endpoint)
- [ ] Move from flat JSON files to SQLite for atomic writes

### P3 — Future
- [ ] i18n infrastructure (next-i18next + `locales/de.json`)
- [ ] OpenAPI spec + auto-generated TypeScript types for frontend
- [ ] `POST /api/admin/gear/import` for gear batch creation
- [ ] Specialization sub-system for classes
- [ ] Live lore editor (edit `questFlavor.json` via UI without restart)
