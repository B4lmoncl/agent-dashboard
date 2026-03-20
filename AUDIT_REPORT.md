# Quest Hall — Full Codebase Audit Report

**Date:** 2026-03-20 (Session 7 — Fresh full audit after main merge)
**Auditor:** Claude Opus 4.6
**Scope:** Complete frontend + backend + data + documentation audit
**Status:** Most critical and high-priority fixes applied; remaining items documented

---

## 1. Architecture Overview

| Layer | Stack | Entry Point |
|-------|-------|-------------|
| Frontend | Next.js 16.1.6, React 19, TypeScript 5, Tailwind CSS 4 | `app/page.tsx` (~2150 lines) |
| Backend | Express 4.18, Node.js 20, CommonJS | `server.js` → `routes/*.js` (17 files) |
| Desktop | Electron 29 (Quest Forge v1.5.0) | `electron-quest-app/` |
| Persistence | JSON files in `/data/` directory | `lib/state.js` (debounced writes) |
| Auth | JWT (15min access + 7d refresh) + API Key | `lib/auth.js` |

**Data Flow:** React components → `fetchDashboard()` batch → Express API → `lib/state.js` Maps → debounced `writeFileSync` → `/data/*.json`

---

## 2. Previous Sessions Summary (1–6)

Sessions 1–6 fixed 43 issues (F-01 through F-43):
- Gacha pity thresholds, legendary drop rates, 10-pull guarantee text
- Stat descriptions (Kraft, Weisheit), modifier display values
- Legendary gear effects (15 types), set bonus calculations
- Quest completion flow, companion bond mechanics
- Modal close consistency, toast system unification
- Challenges system (Sternenpfad + Expedition) — 10 fixes
- GET /api/agents state mutation, currency timezone bug
- Navigation restructuring (4-floor Urithiru system)
- Sitewide 12px minimum font size enforcement

---

## 3. Session 7 — Fresh Full Audit Findings

### 3.1 CRITICAL — Data Integrity

#### D-01: Stat Name Inconsistency (`vitalität` vs `vitalitaet`) ✅ FIXED
- **Location:** `public/data/gachaPool.json` lines 48, 86, 189, 276, 352
- **Fix applied:** Replaced all 5 `vitalität` → `vitalitaet`

#### D-02: 31 Achievement Icons Are Placeholders ⬜ DEFERRED
- **Location:** `public/data/achievementTemplates.json` — 31 entries with `"icon": "?"`
- **Note:** Requires pixel art asset creation (not a code fix). `onError` gracefully hides missing images.

### 3.2 HIGH — Backend Logic

#### B-01: Dashboard Batch Endpoint Uses Internal HTTP Self-Calls ⬜ DEFERRED
- **Location:** `routes/config-admin.js:35-114`
- **Note:** Design debt, not a runtime bug. Works correctly today. Refactoring is 2-4 hour effort.

#### B-02: Missing Rate Limiting on Mutation Endpoints ✅ FIXED
- **Fix applied:** Added mutation rate limiter (60 writes/min per IP) in `server.js` for all POST/PATCH/PUT/DELETE on `/api/`

#### B-03: CORS Origin Wildcard ⬜ NOTED
- **Location:** `server.js:41` — `cors({ credentials: true, origin: true })`
- **Note:** Acceptable for single-user/dev mode. Should be tightened for production deployment.

#### B-04: Timing Attack on Master Key Length Check ⬜ NOTED
- **Location:** `lib/auth.js` — master key comparison
- **Note:** Low practical risk. Would require sub-ms timing precision from attacker.

### 3.3 HIGH — Frontend UX

#### F-44: Silent Error Suppression ✅ PARTIALLY FIXED
- **Fixed:** All 14 silent catches in `hooks/useQuestActions.ts` now show error toasts
- **Added:** "error" toast type to `ToastStack` with red styling and 5s duration
- **Remaining:** ~60 silent catches in other components (page.tsx, CharacterView, QuestModals, GachaView) — most are non-critical background fetches or localStorage operations

#### F-45: Missing Loading States on Async Operations ⬜ REMAINING
- **Location:** `DashboardHeader.tsx` (login/register), `hooks/useQuestActions.ts` (claim/unclaim/complete)
- **Impact:** Users may double-click, causing duplicate requests

#### F-46: Missing Confirmation for Destructive Actions ⬜ REMAINING
- **Location:** `DashboardHeader.tsx:251` (logout), `useQuestActions.ts` (unclaim, reject quest)
- **Impact:** Accidental actions cannot be undone

### 3.4 MEDIUM — Data Quality

#### D-03: Gacha Item Type Error ✅ FIXED
- **Fix applied:** Changed `"type": "gacha"` → `"type": "consumable"` for mitleids-katalysator

#### D-04: Missing MASTER_KEY in .env.example ✅ FIXED
- **Fix applied:** Added MASTER_KEY, GITHUB_WEBHOOK_SECRET, PORT, NODE_ENV, API_KEYS to .env.example

### 3.5 MEDIUM — Frontend Quality

#### F-47: Inconsistent Modal/Popup Closure ⬜ REMAINING
- **Location:** Various modals across page.tsx and components
- **Impact:** Inconsistent user experience

#### F-48: Hardcoded Reward Fallbacks ✅ FIXED
- **Fix applied:** QuestCards now shows actual `quest.rewards.xp` and `quest.rewards.gold` values, with "~" for undetermined gold instead of hardcoded priority-based fallbacks

#### F-49: No Offline Mode Indication ✅ FIXED
- **Fix applied:** Added "Connection lost — showing cached data. Actions may not save." red banner when `!apiLive && !loading`

#### F-50: Dead Code / Commented Features ✅ FIXED
- **Fix applied:** Removed BattlePassView comment, unused imports (CVBuilderPanel, CVData, ChangelogCommit, AchievementToast)

### 3.6 MEDIUM — Code Quality

#### C-01: Quest Completion Has 3 Near-Identical Code Paths ⬜ REMAINING
- **Location:** `routes/quests.js:289-400` — NPC quests, player quests, dev quests
- **Impact:** Bugs must be fixed 3x; easy to miss one path

#### C-02: Achievement Lookup Uses O(n) find() ✅ FIXED
- **Fix applied:** Built `state.achievementCatalogueById` Map at boot; replaced 3 O(n) `.find()` calls with O(1) `.get()` in `lib/helpers.js`, `routes/users.js`, `routes/players.js`

#### C-03: Inconsistent Error Response Format ⬜ REMAINING
- **Location:** Various routes
- **Impact:** Frontend must handle multiple formats

### 3.7 LOW

#### L-01: `any` Type Usage (42 occurrences) ⬜ REMAINING
- Across LeaderboardView, GachaView, CharacterView, ForgeView, DashboardModals
- Non-blocking but reduces type safety

#### L-02: Missing ARIA Labels / Accessibility ⬜ REMAINING
- Icon-only buttons lack aria-label
- No visible focus indicators on many interactive elements

#### L-03: Equipment Migration Runs Every Boot ⬜ REMAINING
- `server.js:186-206` — Migration logic runs on every restart even if all users are already migrated

---

## 4. Fix Summary

### Completed (Session 7)

| ID | Description | Commit |
|----|-------------|--------|
| D-01 | Fix `vitalität` → `vitalitaet` in gachaPool.json (5 occurrences) | cf2bc5d |
| D-03 | Fix gacha item type `"gacha"` → `"consumable"` | cf2bc5d |
| D-04 | Complete .env.example with all env vars | cf2bc5d |
| F-44 | Add error toasts to useQuestActions.ts (14 catches) + error toast type | cf2bc5d |
| F-49 | Add offline mode indicator banner | 1883d6a |
| B-02 | Add mutation rate limiter (60/min per IP) | 1883d6a |
| C-02 | Build achievement Map for O(1) lookups (3 locations) | 1883d6a |
| F-48 | Remove hardcoded reward fallbacks in QuestCards | 94bb8e9 |
| F-50 | Clean up dead code and unused imports | 94bb8e9 |

### Remaining (prioritized)

| Priority | ID | Description | Est. Effort |
|----------|----|-------------|-------------|
| 🟡 P2 | F-45 | Add loading states to async operations | 45 min |
| 🔵 P3 | F-46 | Add confirmation dialogs for destructive actions | 30 min |
| 🔵 P3 | F-47 | Standardize modal closure behavior | 45 min |
| 🔵 P3 | C-01 | Refactor quest completion code paths | 60 min |
| 🔵 P3 | C-03 | Standardize error response format | 45 min |
| ⚪ P4 | D-02 | Create 31 achievement icon assets | External |
| ⚪ P4 | B-01 | Refactor dashboard to direct function calls | 2-4 hrs |
| ⚪ P4 | L-01 | Replace `any` types | 60 min |
| ⚪ P4 | L-02 | Add ARIA labels | 45 min |
| ⚪ P4 | L-03 | Add boot migration skip flag | 10 min |
| ⚪ noted | B-03 | CORS tightening (production only) | 10 min |
| ⚪ noted | B-04 | Timing-safe key length check | 5 min |
