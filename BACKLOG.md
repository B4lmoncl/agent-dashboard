# Quest Hall — Backlog
<!-- Last updated: 2026-03-21 — merged from Leon's Liste + API Feedback + Audit Sessions -->

## 🐛 BUGS

1. Character Screen: Background image clipped at top
2. ~~Lindi class "Network Sage" in Proving Grounds Stat Card~~ → Verified OK (classes shown correctly)
3. ~~Item icons pixelated~~ → Fixed (CSS `image-rendering: auto`)

## ⚡ QUICK WINS (Done in previous audit sessions)

- ~~LVL Up: Animation + Gold Glow~~ → ✅ Implemented (levelup-* CSS animations + RewardCelebration)
- ~~Companion Quest: Visual feedback~~ → ✅ Implemented (CompanionsWidget toast)
- ~~Flavor Text in Items~~ → ✅ Implemented (inventory tooltips with flavorText)
- ~~Gear: Hover Tooltip~~ → ✅ Implemented (stat comparison tooltips, green/red deltas)
- ~~Companion: Bond Level/XP in Character Screen~~ → ✅ Implemented (CharacterView)
- ~~Stats: Tooltips~~ → ✅ Implemented (DashboardModals modifier breakdown)
- ~~Passive Items display~~ → ✅ Implemented (inventory passive items shown)

## ⭐ FEATURES (Implemented)

- ~~Steam-Style Player Profiles~~ → ✅ PlayerProfileModal (Session 3)
- ~~Friendship System~~ → ✅ SocialView with friends, messages, trades, activity feed (Sessions 2-4)
- ~~Tab Notification System~~ → ✅ getRoomNotif() with colored dots (Session 2)
- ~~Legendary Item Effects~~ → ✅ 15 legendary effect types in helpers.js
- ~~Background Tag/Nacht-Wechsel~~ → ✅ GuildHallBackground with TOD cycle
- ~~NPC Alchemistengilde (Currency)~~ → ✅ Currency conversion in currency.js
- ~~Economy Balancing~~ → ✅ Comprehensive analysis in Session 7

## ⭐ FEATURES (Remaining — Mittelfristig)

4. Companion swap + retain bond
5. Vow Rework: positive long-term goals, not just abstinence
6. Ritual difficulty customization + reward scaling
7. Bond + Mood system split (bond progression separate from mood state)
8. Level-Locked Sections (tabs locked by level)
9. Mini quest overview (active quests + rituals in player menu)
10. Blood Pact 180/365 day bonuses → premium currency reward
11. Pet image + fur color randomization + petting animation
12. Mini Companions: custom name + image (not "Pets")
13. Bazaar → "Deepforge" tab with harder tool progression
14. NPC as Gacha Banner prize
15. Locked quests removal (currently no useful purpose)

## 🚀 PHASE 2 (Große Features)

16. Season System v2 — Battle Pass Click-to-Claim [Roadmap: planned]
17. Campaign v2 — The Observatory quest chains [Roadmap: planned]
18. Starweaver Special Quests — LLM Chat [Roadmap: planned]
19. The Arcanum — Class system expansion [Roadmap: planned]
20. Sound Effects & Music [Roadmap: planned]
21. Onboarding Rework (Fantasy Wizard) → ✅ Partially done (OnboardingWizard overhaul Session 4)
22. Login Redesign (Password instead of API Key) → ✅ Implemented (JWT auth + password login)
23. Custom Character Avatar
24. Coop-Rituals with invitation system
25. User-Generated Quests (suggest system exists, full UGC pending)
26. Room-to-Room navigation (instead of tabs)
27. Core Lore establishment (Urithiru reference partially established)

## 🔧 TECH DEBT

- [x] Streak formula centralized (single source in helpers.js)
- [x] Level table centralized (levels.json as single source)
- [x] Forge multiplier separated from stat bonus
- [x] Achievement catalog → achievementTemplates.json
- [x] Gear items → gearTemplates.json (FULL_GEAR_ITEMS loaded from JSON)
- [ ] page.tsx monolith (~2150 lines) — extract into feature modules
- [ ] No write-queue/claim-lock for concurrent saves (single-process mitigates)
- [ ] Missing JSON Schema validation for template files

## 📋 PLANNED FEATURES (from 2026-03-29 audit)

### ✅ Seasonal Leaderboards (DONE)
- Needs `seasonXp` field on users (XP gained during current season only)
- Backend: reset seasonXp on season change, filter leaderboard by season
- Frontend: toggle "Season X" vs "All-Time" on LeaderboardView
- Reference: Diablo 3 seasonal leaderboards

### ✅ Spieler-Challenges (Backend DONE, Frontend pending)
- Players challenge each other: "Who completes more quests this week?"
- Backend: POST /api/challenges/create, accept, resolve
- Frontend: Challenge toast notification, accept/decline UI, result display
- Loser pays 100g to winner
- Reference: WoW guild challenges

### ✅ Companion-Galerie (DONE)
- Overview of all 6 virtual + 7 real companion types
- Shows: artwork, lore text, personality, bond level progression
- Accessible from CompanionsWidget or Codex
- Frontend-only (data already in companions.json)
- Reference: HSR companion gallery

### Tower Map Visualization
- 2D cross-section of all 5 tower floors with rooms as clickable nodes
- "You are here" marker on current room
- Locked rooms grayed out with level requirement
- Replaces/supplements current floor navigation
- Reference: Urithiru tower (Stormlight Archive)
