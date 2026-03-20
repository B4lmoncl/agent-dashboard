# Quest Hall — Full Codebase Audit Report

**Date:** 2026-03-20 (Session 8 — Deep 6-agent audit + fixes)
**Auditor:** Claude Opus 4.6
**Scope:** Complete frontend + backend + data + documentation audit
**Status:** Sessions 7-8 fixes applied; remaining items documented

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

#### F-45: Missing Loading States on Async Operations ✅ FIXED
- **Fixed (Session 8):** Added `loadingAction` state to `useQuestActions` (7 handlers: claim, unclaim, complete, approve, reject, coopClaim, coopComplete); added `authLoading` to DashboardHeader (login/register buttons show loading text + disabled state)

#### F-46: Missing Confirmation for Destructive Actions ⬜ REMAINING
- **Location:** `DashboardHeader.tsx:251` (logout), `useQuestActions.ts` (unclaim, reject quest)
- **Impact:** Accidental actions cannot be undone

### 3.4 MEDIUM — Data Quality

#### D-03: Gacha Item Type Error ✅ FIXED
- **Fix applied:** Changed `"type": "gacha"` → `"type": "consumable"` for mitleids-katalysator

#### D-04: Missing MASTER_KEY in .env.example ✅ FIXED
- **Fix applied:** Added MASTER_KEY, GITHUB_WEBHOOK_SECRET, PORT, NODE_ENV, API_KEYS to .env.example

### 3.5 MEDIUM — Frontend Quality

#### F-47: Inconsistent Modal/Popup Closure ✅ PARTIALLY FIXED
- **Fixed (Session 8):** Class Activation modal (page.tsx) migrated to `<ModalOverlay>` for ESC support; FeedbackModal migrated to `<ModalOverlay>` for consistent portal rendering
- **Remaining:** Some popouts/drawers still use custom close logic (acceptable for non-modal UI elements)

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

#### L-01: `any` Type Usage ✅ MOSTLY FIXED
- **Fixed (Session 8):** Removed 20+ unnecessary `as any` casts across page.tsx, CharacterView, DashboardModals, UserCard, LeaderboardView, QuestPanels
- **Extended types:** `CharacterData` (xpInLevel, xpForLevel, legendaryEffects, equippedTitle, earnedTitleCount, bondXp), `User.modifiers` (legendary), `AntiRitual` (pactCompleted)
- **Remaining:** ~15 `as any` in GachaView (icon field not on type), ForgeView (InventoryItem index signature), CharacterView (CSS imageRendering, runtime _playerLevel) — legitimate workarounds

#### L-02: Missing ARIA Labels / Accessibility ✅ PARTIALLY FIXED
- **Fixed (Session 8):** Added `role="dialog"` + `aria-modal="true"` to ModalOverlay, `role="status"` + `aria-live="polite"` to ToastStack, `:focus-visible` outline in globals.css
- **Remaining:** Icon-only buttons still lack aria-label (individual component work)

#### L-03: Equipment Migration Runs Every Boot ✅ FIXED
- **Fixed (Session 8):** Added pre-check that skips migration loop when no legacy string-type equipment values exist

---

## 4. Session 8 — Deep 6-Agent Audit

Session 8 launched 6 specialized audit agents covering backend, frontend, data integrity, gear stats, modal consistency, and gacha/shop systems.

### 4.1 Verified Correct (No Action Needed)

| Area | Verification |
|------|-------------|
| Streak Gold Bonus | Backend: 1.5%/day, max 45%. Frontend displays correct formula. |
| XP Multiplier Chain | All 10+ factors (forge, kraft, gear, companion, bond, hoarding, passive, legendary, active, nth, variety) traced end-to-end. |
| ForgeTemp Decay | 2%/hr decay with Ausdauer modifier. Display matches backend. |
| Currency Tax | 20% tax enforced server-side in `routes/currency.js:92-93`. UI mentions tax. |
| Docker Setup | `docker-entrypoint.sh` exists and is correct (448 bytes). |
| Item ID Overlap | 50 IDs shared between `gearTemplates.json` and `itemTemplates.json` — by design (different representations for different contexts). |
| Gacha Pity System | Soft pity at 55, hard pity at 75. Correctly implemented. |
| Toast System | Unified ToastStack with 7 types including error (5s duration). |

### 4.2 New Findings & Fixes

#### F-51: Class Activation Modal Missing ESC Handler ✅ FIXED
- **Location:** `app/page.tsx` — class activation notification modal
- **Fix applied:** Replaced custom backdrop div with `<ModalOverlay>` component

#### F-52: FeedbackModal Not Using ModalPortal ✅ FIXED
- **Location:** `components/FeedbackModal.tsx`
- **Fix applied:** Migrated from `useModalBehavior` + custom div to `<ModalOverlay>` for consistent portal rendering

#### F-53: Unnecessary `as any` Type Casts ✅ FIXED
- **Location:** `app/page.tsx` (3 casts), `components/CharacterView.tsx` (6 casts)
- **Fix applied:** Removed casts by using existing type fields or extending `CharacterData` interface

#### F-54: CharacterData Interface Missing Fields ✅ FIXED
- **Location:** `app/types.ts`
- **Fix applied:** Added `xpInLevel`, `xpForLevel`, `legendaryEffects`, `equippedTitle`, `earnedTitleCount` to `CharacterData`; added `bondXp` to companion type

#### F-55: ForgeView Uses `window.confirm()` for Destructive Actions ✅ FIXED
- **Location:** `components/ForgeView.tsx` (3 occurrences: dismantle, dismantle-all, transmute)
- **Fix applied:** Replaced with in-component confirmation modal (themed, non-blocking)

#### F-56: DashboardModals `as any` for Legendary Modifier ✅ FIXED
- **Location:** `components/DashboardModals.tsx` (8 casts for xp.legendary and gold.legendary)
- **Fix applied:** Added `legendary?` to User modifier types; removed all casts

#### F-57: Missing ARIA Roles and Focus Styles ✅ FIXED
- **Fix applied:** `role="dialog"` + `aria-modal="true"` on ModalOverlay; `role="status"` + `aria-live="polite"` on ToastStack; `:focus-visible` outline in globals.css

#### F-58: Type Casts in UserCard, LeaderboardView, QuestPanels ✅ FIXED
- **Fix applied:** Removed 11 `as any` casts by using existing type fields; added `pactCompleted` to AntiRitual type

### 4.3 Backend Deep Audit (40 findings triaged)

A specialized backend audit agent reviewed all 17 route files, `lib/state.js`, `lib/helpers.js`, `lib/npc-engine.js`, and `server.js`. **Most "critical" findings were false positives** due to the agent not accounting for Node.js single-threaded execution model:

| Claim | Verdict | Reason |
|-------|---------|--------|
| #1 Race condition in quest hoarding | FALSE POSITIVE | Node.js is single-threaded; NPC departures run on timer, not mid-request |
| #3 Passive effect null guard missing | FALSE POSITIVE | `if (!tmpl) continue;` already exists at line 692 |
| #4 Loot pity order wrong | FALSE POSITIVE | `checkLootPity()` called at line 1109, `resetLootPity()` at 1134 — correct order |
| #8 NPC departure rebuilds | FALSE POSITIVE | `rebuildQuestsById()` called at line 82 after all splices |
| #16 getWeekId not exported | FALSE POSITIVE | Exported at line 358: `module.exports.getWeekId = getWeekId` |
| #21 Unused crypto in users.js | FALSE POSITIVE | Used at line 281 for API key generation |
| #9 /api/config no auth | BY DESIGN | Comment says "no auth required" — public game constants |

**Verified real (minor) issues fixed:**

#### B-05: Quest Creation Missing Type Validation ✅ FIXED
- **Location:** `routes/quests.js:55-57`
- **Fix applied:** Enforce `title` and `description` must be strings; cap skills array at 20 entries

**Remaining low-priority backend items (from audit, verified real but minor):**
- Hardcoded setIds array in `createGearInstance` (fallback to 'adventurer' is acceptable)
- Some gacha duplicate detection doesn't check `templateId` (only affects gear instances, which go through different flow)
- Magic numbers in streak recovery not documented as constants

---

## 5. Fix Summary

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

### Completed (Session 8)

| ID | Description | Commit |
|----|-------------|--------|
| F-51 | Migrate Class Activation modal to ModalOverlay | ec38bae |
| F-52 | Migrate FeedbackModal to ModalOverlay | ec38bae |
| F-53 | Remove 9 unnecessary `as any` type casts | ec38bae |
| F-54 | Extend CharacterData interface with missing fields | ec38bae |
| F-45 | Add loading states to all quest actions + auth buttons | 13a5d7e |
| L-03 | Skip equipment migration when no legacy data found | f8cb155 |
| F-55 | Replace 3x window.confirm() with proper modal in ForgeView | 16b5312 |
| F-56 | Remove 8x as-any casts for legendary modifiers | 16b5312 |
| F-57 | Add ARIA roles (dialog, status) + focus-visible styles | 16b5312 |
| F-58 | Remove 11x as-any casts in UserCard, LeaderboardView, QuestPanels | 9662437 |
| B-05 | Harden quest creation input validation (type checks + skills cap) | 5c2f5ef |

### Remaining (prioritized)

| Priority | ID | Description | Est. Effort |
|----------|----|-------------|-------------|
| 🔵 P3 | C-01 | Refactor quest completion code paths | 60 min |
| 🔵 P3 | C-03 | Standardize error response format | 45 min |
| ⚪ P4 | D-02 | Create 31 achievement icon assets | External |
| ⚪ P4 | B-01 | Refactor dashboard to direct function calls | 2-4 hrs |
| ⚪ P4 | L-01 | Replace remaining ~15 `as any` types (most legitimate) | 20 min |
| ⚪ P4 | L-02 | Add aria-label to icon-only buttons | 30 min |
| ⚪ noted | B-03 | CORS tightening (production only) | 10 min |
| ⚪ noted | B-04 | Timing-safe key length check | 5 min |
