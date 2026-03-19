# Quest Hall — Full Codebase Audit Report

**Date:** 2026-03-19
**Auditor:** Claude Opus 4.6
**Scope:** Complete frontend + backend + data consistency audit

---

## 1. Architecture Overview

| Layer | Stack | Entry Point |
|-------|-------|-------------|
| Frontend | Next.js 16.1.6, React 19, TypeScript 5, Tailwind CSS 4 | `app/page.tsx` (~2126 lines) |
| Backend | Express 4.18, Node.js 20, CommonJS | `server.js` → `routes/*.js` (14 files) |
| Desktop | Electron 29 (Quest Forge v1.5.0) | `electron-quest-app/` |
| Persistence | JSON files in `/data/` directory | `lib/state.js` (debounced writes) |
| Auth | JWT (15min access + 7d refresh) + API Key | `lib/auth.js` |

**Data Flow:** React components → `fetchDashboard()` batch → Express API → `lib/state.js` Maps → debounced `writeFileSync` → `/data/*.json`

---

## 2. Frontend-Backend Mismatches

### CRITICAL

#### M-01: Gacha Pity Thresholds — Frontend Outdated
- **Frontend:** `components/GachaView.tsx` — Shows "Soft Pity at 35, Hard Pity at 50"
- **Backend:** `routes/gacha.js:36-37` — Uses `SOFT_PITY_START = 55`, `HARD_PITY = 75`
- **Impact:** Players see wrong pity info. They think guaranteed legendary at 50 pulls but it's actually 75.
- **Fix:** Update frontend to show 55/75

#### M-02: Gacha Legendary Drop Rate — Frontend Shows 2x Actual Rate
- **Frontend:** `components/GachaView.tsx` + `public/data/bannerTemplates.json` — Shows "1.6%"
- **Backend:** `routes/gacha.js:35` — `BASE_RATE = 0.008` (0.8%, comment: "nerfed from 1.6%")
- **Impact:** Players think legendaries are twice as likely as they actually are.
- **Fix:** Update frontend and bannerTemplates.json to show 0.8%

#### M-03: Gacha 10-Pull Guarantee — Wrong Rarity Shown
- **Frontend:** `components/GachaView.tsx` — "guarantees at least one Rare or better"
- **Backend:** `routes/gacha.js:316-319` — Guarantees at least 1 **Epic** (not Rare)
- **Impact:** Misleading — the actual guarantee is BETTER than advertised.
- **Fix:** Update text to "Epic or better"

#### M-04: Kraft Stat Description — Wrong Percentage
- **Frontend:** `components/DashboardModals.tsx:128` — "+1% pro Kraft-Punkt"
- **Backend:** `lib/helpers.js:272` — `0.005` = **+0.5% per kraft point**
- **Impact:** Players think kraft gives double the actual bonus.
- **Fix:** Change to "0.5% pro Kraft-Punkt"

#### M-05: Weisheit Stat Description — Wrong Percentage
- **Frontend:** `components/DashboardModals.tsx:153` — "+1% pro Weisheit-Punkt"
- **Backend:** `lib/helpers.js:289` — `0.005` = **+0.5% per weisheit point**
- **Impact:** Same as M-04 but for gold multiplier.
- **Fix:** Change to "0.5% pro Weisheit-Punkt"

### HIGH

#### M-06: Stardust Currency Description — False Earn Method
- **Frontend:** `components/DashboardModals.tsx:46` — Claims stardust from "täglichen Login"
- **Backend:** `routes/currency.js:128-152` — Daily bonus does NOT award stardust (only essenz + runensplitter)
- **Fix:** Remove "täglichen Login" from stardust description

#### M-07: Unreachable Achievements — 3 Achievements Can Never Trigger
- `hidden_midnight` (night_completions) — `_nightCompletions` never set anywhere in backend
- `weekend_warrior` (weekend_completions) — `_weekendCompletions` never set anywhere
- `hidden_npc_collector` (all_npcs_unlocked) — `_npcsUnlocked` never set anywhere
- **Fix:** Implement counter tracking in `onQuestCompletedByUser()`

### MEDIUM

#### M-08: XP Modifier Modal — Missing Factors
- **Frontend modal shows:** forge, kraft, gear, companions, bond, hoarding, legendary
- **Backend also applies:** passiveXpBonus, activeXpBuf, nthBonus (every-5th), varietyBonus, fokus stat
- **Impact:** Users don't see all active modifiers
- **Fix:** Add missing modifier rows when active (non-cosmetic, informational issue)

---

## 3. Code Quality Issues

### BUGS

#### B-01: StatBar value2 crash on non-string value
- **File:** `components/StatBar.tsx:27`
- **Issue:** `value2.startsWith("◆")` crashes if value2 is a number
- **Fix:** Add type guard: `typeof value2 === 'string' && value2.startsWith(...)`

#### B-02: bannerTemplates.json has stale drop rates
- **File:** `public/data/bannerTemplates.json`
- **Issue:** Drop rates in JSON say 1.6% legendary but backend uses 0.8%
- **Fix:** Update JSON to match actual rates

### POTENTIAL ISSUES

#### P-01: No write queue for concurrent saves
- **Files:** `lib/state.js` — All `writeFileSync` calls unprotected by locks
- **Risk:** Concurrent API requests can overwrite each other (quest claim race, XP loss)
- **Severity:** Medium (single-player mostly, but multi-user capable)
- **Note:** Out of scope for this audit (requires architectural change)

---

## 4. Fix Manifest

All fixes applied in this audit session, tracked below:

| Fix ID | Description | File(s) | Status |
|--------|-------------|---------|--------|
| F-01 | Kraft description: 1% → 0.5% | DashboardModals.tsx | Pending |
| F-02 | Weisheit description: 1% → 0.5% | DashboardModals.tsx | Pending |
| F-03 | Gacha pity: 35/50 → 55/75 | GachaView.tsx | Pending |
| F-04 | Gacha drop rate: 1.6% → 0.8% | GachaView.tsx, bannerTemplates.json | Pending |
| F-05 | Gacha 10-pull: "Rare" → "Epic" | GachaView.tsx | Pending |
| F-06 | Stardust description: remove "täglichen Login" | DashboardModals.tsx | Pending |
| F-07 | Achievement tracking: implement missing counters | lib/helpers.js | Pending |
| F-08 | StatBar type guard for value2 | components/StatBar.tsx | Pending |

---

*This document is updated as fixes are applied.*
