# QuestHall — Agent Rules & Audit Protocol

## Required Reading (BEFORE any action)
Read these files completely before starting work:
1. `CLAUDE.md` (inkl. UI Design Guidelines)
2. `ARCHITECTURE.md`
3. `AUDIT_REPORT.md` (Appendix A is mandatory)
4. `REJECTED.md` (blocklist — never propose items listed there)
5. `LYRA-PLAYBOOK.md` (Content creation schemas, Tone & Voice Guide, Lore Bible)
6. UI Design Guidelines section below

> **If you have not read all 5 files, you are not ready to work. Stop.**

---

## Core Rules (apply ALWAYS — re-read after every area)

### R1 — Never Guess
If you lack context, ASK via multiple choice. Do not infer, assume, or hallucinate.
A wrong fix is worse than no fix.

### R2 — Never Break User Data
No migrations that risk data loss. No schema changes without explicit approval.

### R3 — Never Remove Features
Broken features get repaired, not deleted. Missing features get flagged, not invented.

### R4 — Check REJECTED.md Before Proposing
Before suggesting ANY new feature or improvement, search `REJECTED.md`.
If it's listed → do not propose it. No rephrasing, no "similar but different" variants.

### R5 — Phase Gate
Phase 1 (Analyse) and Phase 2 (Fix) are strictly separated.
**Do not fix anything during Phase 1. Do not skip Phase 1.**

### R6 — Scope Discipline
I tell you which area to audit. Audit ONLY that area.
Do not wander into unrelated files. Do not propose cross-cutting refactors unless asked.

---

## Phase 1: Deep Analysis (NO changes to code)

### What "deep" means
You must understand the code well enough to explain:
- What each function does and WHY
- How data flows from backend → API → frontend for every visible value
- What edge cases exist and whether they're handled

**If you can't explain it, you haven't read it well enough. Read again.**

### Audit Checklist per Area
For each area I assign you, check ALL of the following:

#### Frontend-Backend Consistency (CRITICAL)
- [ ] Every value shown in UI → trace to backend source. Is it real data or hardcoded?
- [ ] Every button/action in UI → does the backend endpoint exist and work?
- [ ] Every tooltip/label → does it match the actual backend formula/logic?
- [ ] Every stat displayed → is the calculation correct end-to-end?

#### UI/UX Consistency (per UI Design Guidelines)
- [ ] Font sizes ≥ 12px everywhere
- [ ] Disabled elements have `cursor: not-allowed` + tooltip explaining why
- [ ] Celebrations/animations on reward moments
- [ ] `useModalBehavior` on all modals
- [ ] Correct CSS classes: `progress-bar-diablo`, `stat-card-depth`, `quest-card-emboss`
- [ ] Component patterns match guidelines

#### Code Quality
- [ ] Null safety on all data access paths
- [ ] Auth checks on all protected endpoints
- [ ] Input validation at API boundaries
- [ ] No race conditions (check async flows, concurrent requests)
- [ ] No dead code paths
- [ ] No `as any` casts without justification
- [ ] No duplicated logic that should be shared
- [ ] Error handling (no empty catch blocks)

### Area Report Format
After completing an area, write findings in `AUDIT_REPORT.md` using this structure:

```markdown
## [Area Name] — Audit [YYYY-MM-DD]

### Critical (breaks functionality / wrong data shown)
- CRIT-001: [file:line] Description of issue

### High (significant UX bug / security gap)
- HIGH-001: [file:line] Description of issue

### Medium (inconsistency / missing validation)
- MED-001: [file:line] Description of issue

### Low (code quality / minor UX)
- LOW-001: [file:line] Description of issue

### Verified OK
- [List of things explicitly checked and found correct]
```

> **"Verified OK" is mandatory.** If you only list problems, I can't tell if you actually checked the rest or just skimmed.

### ✅ Checkpoint (after EVERY area)
After writing the area report, re-read these rules and confirm:
1. Did I check ALL items in the audit checklist?
2. Did I trace UI values to their backend source (not just grepped for the component)?
3. Did I list "Verified OK" items?
4. Did I avoid proposing anything from `REJECTED.md`?
5. Am I suggesting fixes that already exist in the codebase? (If unsure → search first)

**Post the checkpoint answers before moving on.**

---

## Phase 2: Fixes (only after Phase 1 approval)

### Entry Gate
**Do NOT start Phase 2 until I explicitly say: "Start fixing."**
If I haven't said it, stay in Phase 1.

### Pre-Fix Checklist (before EVERY fix)
Before writing any code change, answer these internally:
- [ ] Is this issue documented in AUDIT_REPORT.md? (If no → document first)
- [ ] Does this fix touch user data? (If yes → ask me first)
- [ ] Does this fix change an API contract? (If yes → ask me first)
- [ ] Could this fix break existing functionality? (If yes → describe impact first)
- [ ] Is this fix in scope for the current area? (If no → flag, don't fix)
- [ ] Am I accidentally implementing a feature from REJECTED.md? (If yes → stop)

### Fix Order
1. **Critical** — wrong data shown, broken features, security issues
2. **High** — significant UX bugs, missing auth checks
3. **Medium** — inconsistencies, missing validation
4. **Low** — code quality, minor UX polish

### Fix Protocol
- Atomic commits with clear messages: `fix(area): CRIT-001 — description`
- After each fix batch: build + self-audit for regressions
- Update AUDIT_REPORT.md with fix status: `✅ Fixed [commit-hash]`
- Loop until area is clean

### ✅ Checkpoint (after every fix batch)
1. Does the build pass?
2. Did any fix introduce a regression?
3. Is AUDIT_REPORT.md updated?
4. Re-read Core Rules R1–R6 — did I violate any?

---

## Phase 3: Documentation
- Update `AUDIT_REPORT.md` — compact changelog with commit IDs (< 400 Zeilen)
- Update `CLAUDE.md` / `ARCHITECTURE.md` / `LYRA-PLAYBOOK.md` only if data is stale
- Facts, not session logs

---

## UI Design Guidelines
<!-- Paste your existing UI Design Guidelines section here -->
<!-- (min 12px font, disabled states, celebrations, modal behavior, CSS classes etc.) -->

---

## Spielreferenzen
- WoW Classic, Diablo, Honkai Star Rail, Habitica
- Guild Hall Referenz: Urithiru (Stormlight Archive, Brandon Sanderson)

---

## Quick Reference Card (re-read when in doubt)
```
NEVER guess    → ask me (multiple choice)
NEVER remove   → repair or flag
NEVER skip     → Phase 1 before Phase 2
NEVER propose  → without checking REJECTED.md
ALWAYS trace   → UI value → backend source
ALWAYS report  → "Verified OK" + problems
ALWAYS check   → checkpoint after every area/batch
```
