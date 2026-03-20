# Quest Hall — Full Codebase Audit Report

**Date:** 2026-03-20 (Session 7 — Fresh full audit after main merge)
**Auditor:** Claude Opus 4.6
**Scope:** Complete frontend + backend + data + documentation audit
**Status:** In progress — findings documented, fixes pending

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

#### D-01: Stat Name Inconsistency (`vitalität` vs `vitalitaet`) ⬜
- **Location:** `public/data/gachaPool.json` lines 48, 86, 189, 276, 352
- **Issue:** Uses `"vitalität"` (umlaut) while ALL other files (`gearTemplates.json`, `professions.json`, backend helpers) use `"vitalitaet"` (ASCII). When gacha items are rolled with stat `vitalität`, the stat won't match gear template affix lookups or modifier calculations.
- **Impact:** Gacha items with vitalität stat have broken stat bonuses
- **Fix:** Replace all `vitalität` with `vitalitaet` in gachaPool.json

#### D-02: 31 Achievement Icons Are Placeholders ⬜
- **Location:** `public/data/achievementTemplates.json` — 31 entries with `"icon": "?"`
- **Impact:** Frontend renders broken icon images for ~50% of achievements. `onError` handler hides the img, so achievements show without icons.
- **Fix:** These need actual pixel art assets (not a code fix — needs asset creation)
- **Note:** Non-blocking since `onError` gracefully hides missing images

### 3.2 HIGH — Backend Logic

#### B-01: Dashboard Batch Endpoint Uses Internal HTTP Self-Calls ⬜
- **Location:** `routes/config-admin.js:35-114`
- **Issue:** `/api/dashboard` makes 14 `http.get('http://localhost:PORT/api/...')` calls to itself instead of calling business logic directly. This is fragile (fails if internal routing changes), slow (14 round-trips through the network stack), and creates unnecessary overhead.
- **Impact:** Performance: ~50-100ms overhead per dashboard load. Fragility: breaks if middleware changes.
- **Note:** This is design debt, not a runtime bug. Works correctly today.

#### B-02: Missing Rate Limiting on Mutation Endpoints ⬜
- **Location:** `routes/quests.js`, `routes/crafting.js`, `routes/gacha.js`
- **Issue:** Global limit is 2000 req/15min. Auth endpoints have 10 req/min. But quest creation, crafting, and most mutation endpoints have NO specific rate limits.
- **Impact:** Abuse: automated scripts could spam quest creation, craft infinitely, etc.
- **Fix:** Add per-endpoint rate limits for mutation operations

#### B-03: CORS Origin Wildcard ⬜
- **Location:** `server.js:41` — `cors({ credentials: true, origin: true })`
- **Issue:** Allows requests from ANY origin with credentials.
- **Impact:** CSRF risk in multiplayer context
- **Note:** Acceptable for development/single-user, but should be tightened for production

#### B-04: Timing Attack on Master Key Length Check ⬜
- **Location:** `lib/auth.js` — master key comparison
- **Issue:** If key lengths differ, `crypto.timingSafeEqual()` is skipped, potentially leaking master key length info via timing.
- **Impact:** Low practical risk (attacker needs sub-ms timing precision)

### 3.3 HIGH — Frontend UX

#### F-44: Silent Error Suppression (74+ occurrences) ⬜
- **Location:** `hooks/useQuestActions.ts` (14 catches), `app/page.tsx` (15+), `app/utils.ts` (10+), `lib/auth-client.ts`, many components
- **Issue:** Pervasive `catch { /* ignore */ }` pattern swallows ALL errors — network failures, auth failures, API errors — without any user feedback.
- **Impact:** Users have no way to know when actions fail. Actions appear to "do nothing".
- **Fix:** Add toast notifications for failed actions, console.warn for non-critical errors

#### F-45: Missing Loading States on Async Operations ⬜
- **Location:** `DashboardHeader.tsx` (login/register), `hooks/useQuestActions.ts` (claim/unclaim/complete)
- **Issue:** Many async operations don't disable buttons or show loading spinners.
- **Impact:** Users may double-click, causing duplicate requests

#### F-46: Missing Confirmation for Destructive Actions ⬜
- **Location:** `DashboardHeader.tsx:251` (logout), `useQuestActions.ts` (unclaim, reject quest)
- **Issue:** No confirmation dialog before logout, quest unclaim, or quest rejection
- **Impact:** Accidental actions cannot be undone

### 3.4 MEDIUM — Data Quality

#### D-03: Gacha Item Type Error ⬜
- **Location:** `public/data/gachaPool.json` — `"mitleids-katalysator"` has `"type": "gacha"`
- **Issue:** Should be `"type": "consumable"` to match the item type system
- **Fix:** Change type field

#### D-04: Missing MASTER_KEY in .env.example ⬜
- **Location:** `.env.example`
- **Issue:** Only `API_KEY` is documented. `MASTER_KEY`, `JWT_SECRET`, `GITHUB_WEBHOOK_SECRET` are missing.
- **Fix:** Add all env vars to .env.example

### 3.5 MEDIUM — Frontend Quality

#### F-47: Inconsistent Modal/Popup Closure ⬜
- **Location:** Various modals across page.tsx and components
- **Issue:** Some modals close on backdrop click via `ModalOverlay`, others use custom `onClick` handlers, some use `e.stopPropagation()` inconsistently
- **Impact:** Inconsistent user experience

#### F-48: Hardcoded Reward Fallbacks ⬜
- **Location:** `QuestCards.tsx:223-224` — `{ high: 25, medium: 15, low: 9 }[quest.priority]`
- **Issue:** If `quest.rewards.gold` is 0 or null, card shows hardcoded fallback values instead of actual reward. Could display wrong amounts if backend formula changes.
- **Impact:** UI may show different gold/XP than what players actually receive

#### F-49: No Offline Mode Indication ⬜
- **Location:** `app/page.tsx` — `apiLive` state exists but isn't prominently displayed
- **Issue:** When API is down, the app silently fails. No banner or indicator tells users they're disconnected.
- **Fix:** Show connection status banner when `!apiLive`

#### F-50: Dead Code / Commented Features ⬜
- **Location:** `app/page.tsx:1186` (BattlePassView commented out), various unused imports
- **Issue:** Commented-out code and unused imports add noise
- **Fix:** Clean up dead code; git history preserves removed code

### 3.6 MEDIUM — Code Quality

#### C-01: Quest Completion Has 3 Near-Identical Code Paths ⬜
- **Location:** `routes/quests.js:289-400` — NPC quests, player quests, dev quests
- **Issue:** Each path duplicates level-up, loot, and achievement logic
- **Impact:** Bugs must be fixed 3x; easy to miss one path

#### C-02: Achievement Lookup Uses O(n) find() ⬜
- **Location:** `lib/helpers.js:906` — `state.ACHIEVEMENT_CATALOGUE.find(t => t.id === a.id)`
- **Issue:** Linear search through 60+ achievements on every check
- **Fix:** Build achievement Map at boot (like questsById pattern)

#### C-03: Inconsistent Error Response Format ⬜
- **Location:** Various routes
- **Issue:** Some return `{ error: 'msg' }`, others `{ ok: false, error: 'msg' }`, others just status codes
- **Impact:** Frontend must handle multiple formats

### 3.7 LOW

#### L-01: `any` Type Usage (42 occurrences) ⬜
- Across LeaderboardView, GachaView, CharacterView, ForgeView, DashboardModals
- Non-blocking but reduces type safety

#### L-02: Missing ARIA Labels / Accessibility ⬜
- Icon-only buttons lack aria-label
- No visible focus indicators on many interactive elements

#### L-03: Equipment Migration Runs Every Boot ⬜
- `server.js:186-206` — Migration logic runs on every restart even if all users are already migrated

---

## 4. Fix Priority Queue

| Priority | ID | Description | Est. Effort |
|----------|----|-------------|-------------|
| 🔴 P0 | D-01 | Fix `vitalität` → `vitalitaet` in gachaPool.json | 5 min |
| 🔴 P0 | D-03 | Fix gacha item type `"gacha"` → `"consumable"` | 2 min |
| 🟠 P1 | F-44 | Add error toasts to useQuestActions.ts (14 silent catches) | 30 min |
| 🟠 P1 | D-04 | Complete .env.example with all env vars | 5 min |
| 🟡 P2 | F-45 | Add loading states to async operations | 45 min |
| 🟡 P2 | F-49 | Add offline mode indicator | 15 min |
| 🟡 P2 | B-02 | Add rate limiting to mutation endpoints | 30 min |
| 🟡 P2 | C-02 | Build achievement Map for O(1) lookups | 15 min |
| 🔵 P3 | F-46 | Add confirmation dialogs for destructive actions | 30 min |
| 🔵 P3 | F-47 | Standardize modal closure behavior | 45 min |
| 🔵 P3 | C-01 | Refactor quest completion code paths | 60 min |
| 🔵 P3 | C-03 | Standardize error response format | 45 min |
| ⚪ P4 | D-02 | Create 31 achievement icon assets | External |
| ⚪ P4 | B-01 | Refactor dashboard to direct function calls | 2-4 hrs |
| ⚪ P4 | F-50 | Clean up dead code | 15 min |
| ⚪ P4 | L-01 | Replace `any` types | 60 min |
| ⚪ P4 | L-02 | Add ARIA labels | 45 min |
| ⚪ P4 | L-03 | Add boot migration skip flag | 10 min |
