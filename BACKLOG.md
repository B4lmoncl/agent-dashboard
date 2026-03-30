# Quest Hall — Backlog
<!-- Last updated: 2026-03-30 — updated after Autopilot Audit Sessions -->

## 🐛 BUGS

1. Character Screen: Background image clipped at top
2. ~~Lindi class "Network Sage" in Proving Grounds Stat Card~~ → Verified OK
3. ~~Item icons pixelated~~ → Fixed (CSS `image-rendering: auto`)
4. ~~Equipped items appeared in inventory grid~~ → Fixed (Session 30+: backend stopped pushing equipped items into inventory response + frontend ID matching fixed)
5. ~~85 achievement descriptions showed "undefined"~~ → Fixed (template interpolation used condition.value but data stored condition.count)
6. ~~New players started at 0% forge temp (40% XP penalty on first quests)~~ → Fixed (now starts at 50%)
7. ~~Gacha pool "Schild des Eisernen Willens" slotted as armor instead of shield~~ → Fixed (added slot fields to all gacha equipment items)
8. ~~6 tooltip formula mismatches (Forge Temp tiers, Kraft/Weisheit/Glück "diminishing returns", Streak Gold)~~ → Fixed (all now match backend)
9. ~~Banner dropRates JSON stale (epic 8%→3%, rare 38%→25%)~~ → Fixed
10. ~~Gacha rare rate tooltip 35%→25%~~ → Fixed
11. ~~GameTooltip vault_of_fate rates stale (epic 13%→3%, rare 35%→25%)~~ → Fixed
12. ~~TutorialModal Forge Temp tiers completely wrong (×1.5 instead of ×1.25 etc.)~~ → Fixed
13. ~~DashboardModals Weisheit formula 0.5%→0.4%~~ → Fixed
14. ~~CharacterView stat tooltips said "diminishing returns" (all linear)~~ → Fixed
15. ~~Missing requireSelf on /api/player/:name/frame endpoint~~ → Fixed (security)
16. ~~Social messages had no growth cap~~ → Fixed (capped at 5000)
17. ~~Social trades had no cleanup~~ → Fixed (pruned at 200)
18. ~~Non-atomic writes for world-boss, dungeons, expedition, appState, npcState~~ → Fixed
19. ~~Profession drop didn't reset trainedRanks/skill/recipeCooldowns~~ → Fixed
20. ~~Currency transaction had no amount cap~~ → Fixed (capped at 1M)

## ⚡ QUICK WINS (Done)

- ~~LVL Up: Animation + Gold Glow~~ → ✅
- ~~Companion Quest: Visual feedback~~ → ✅
- ~~Flavor Text in Items~~ → ✅
- ~~Gear: Hover Tooltip~~ → ✅
- ~~Companion: Bond Level/XP in Character Screen~~ → ✅
- ~~Stats: Tooltips~~ → ✅
- ~~Passive Items display~~ → ✅

## ⭐ FEATURES (Implemented)

- ~~Steam-Style Player Profiles~~ → ✅ PlayerProfileModal
- ~~Friendship System~~ → ✅ SocialView (friends, messages, trades, activity feed)
- ~~Tab Notification System~~ → ✅ getRoomNotif()
- ~~Legendary Item Effects~~ → ✅ 35+ legendary effect types
- ~~Background Tag/Nacht-Wechsel~~ → ✅ GuildHallBackground TOD cycle
- ~~NPC Alchemistengilde (Currency)~~ → ✅ Currency conversion
- ~~Economy Balancing~~ → ✅
- ~~Seasonal Leaderboards~~ → ✅ seasonXp + toggle in LeaderboardView
- ~~Companion-Galerie~~ → ✅ CompanionsWidget + Codex
- ~~Login Redesign~~ → ✅ JWT auth + password login
- ~~Onboarding Rework~~ → ✅ OnboardingWizard overhaul
- ~~Sound Effects~~ → ✅ 8-bit SFX engine (lib/sounds.ts, 16 sound types)
- ~~Sound Volume Slider~~ → ✅ Header range slider + localStorage persistence
- ~~Favorite Recipe System~~ → ✅ ★ toggle, max 20, sorted to top in Forge
- ~~Item Tooltip Stat Ranges~~ → ✅ D3-style [min-max] per stat in CharacterView
- ~~Craft Queue Progress Bar~~ → ✅ Text progress bar (███░░) for batch crafts
- ~~Profession Mastery Glow~~ → ✅ Golden breathing NPC portrait at Skill 225+
- ~~Materials Tab in Inventory~~ → ✅ CharacterView "Materials" filter tab
- ~~Material Trading (Backend)~~ → ✅ Trade offers support materials field
- ~~Material Trading (Frontend)~~ → ✅ SocialView material picker chips
- ~~Active Buffs Indicator~~ → ✅ Colored dots under forge bar in header
- ~~Companion Expedition Send Again~~ → ✅ Shortcut button after collect
- ~~Blood Pact 180/365 Milestones~~ → ✅ Stardust + Essenz + Title rewards
- ~~D3 Paper Doll~~ → ✅ Item names, rarity glow, compact layout
- ~~Inventory Polish~~ → ✅ Thicker rarity borders, slot counter, empty slot pulse
- ~~Gear Slot List Removal~~ → ✅ Paper Doll is now sole equipment view
- ~~Balance Config Endpoint~~ → ✅ /api/config returns balance constants
- ~~Faction Lore Codex~~ → ✅ 4 faction lore entries (Skulduggery tone)
- ~~Edge-Case Test Scripts~~ → ✅ 5 scripts, 50 tests

## ⭐ FEATURES (Remaining — Mittelfristig)

4. ~~Companion swap + retain bond~~ → ✅ POST /api/player/:name/companion/swap (7-day cooldown)
5. ~~Vow Rework~~ → ✅ Already implemented (commitment levels, blood pact, anti-rituals)
6. ~~Ritual difficulty customization + reward scaling~~ → ✅ Already implemented (easy/medium/hard/legendary with DIFFICULTY_BOND_SCALE)
7. ~~Bond + Mood system split~~ → ✅ Already implemented (bondXp/bondLevel separate from petCountToday)
8. ~~Level-Locked Sections~~ → ✅ Floor Level-Gating (DONE-008)
9. ~~Mini quest overview~~ → ✅ TodayDrawer covers this
10. ~~Blood Pact 180/365 day bonuses~~ → ✅ Implemented
11. ~~Pet image + petting animation~~ → ✅ Already exists (heartAnim, companion portraits for all types)
12. Mini Companions: custom name + image (not "Pets")
13. ~~Bazaar → "Deepforge" tab~~ → ✅ Already exists (Schmied = "Deepforge" label + workshop upgrades)
14. ~~NPC as Gacha Banner prize~~ → ✅ Implemented (3 NPC-visit items in gacha pool, guaranteed spawn)
15. ~~Locked quests removal~~ → NOT NEEDED (serves NPC chain gating + level teasers)
16. ~~Frontend dynamic balance config~~ → ✅ Implemented (lib/balance-cache.ts + /api/config balance endpoint)
17. ~~Material picker in trade counter-offers~~ → ✅ Implemented (SocialView counter-offer UI)
18. Mail system: decide keep/remove (overlaps with messages + trading, but provides one-way gifts + future NPC/system mail capability)

## 🚀 PHASE 2 (Große Features)

16. Season System v2 — Battle Pass Click-to-Claim [Roadmap: planned]
17. Campaign v2 — The Observatory quest chains [Roadmap: planned]
18. Starweaver Special Quests — LLM Chat [Roadmap: planned]
19. The Arcanum — Class system expansion [Roadmap: planned]
20. ~~Sound Effects & Music~~ → ✅ 8-bit SFX implemented
21. ~~Onboarding Rework~~ → ✅
22. ~~Login Redesign~~ → ✅
23. Custom Character Avatar
24. Coop-Rituals with invitation system
25. User-Generated Quests (suggest system exists, full UGC pending)
26. ~~Room-to-Room navigation~~ → ✅ TowerMap with floor rooms
27. ~~Core Lore establishment~~ → ✅ Codex with 95 entries, LYRA-PLAYBOOK lore bible

## 🔧 TECH DEBT

- [x] Streak formula centralized (single source in helpers.js)
- [x] Level table centralized (levels.json as single source)
- [x] Forge multiplier separated from stat bonus
- [x] Achievement catalog → achievementTemplates.json
- [x] Gear items → gearTemplates.json (FULL_GEAR_ITEMS loaded from JSON)
- [x] Atomic writes for all critical state files (users, quests, social, world-boss, dungeons, expedition, appState, npcState)
- [x] Concurrency locks on all mutation endpoints (createPlayerLock pattern)
- [x] All tooltip formulas verified against backend (Forge Temp, stats, streak, hoarding, gacha)
- [ ] page.tsx monolith (~2350 lines) — extract into feature modules
- [x] Frontend tooltips consume /api/config balance data via getBalance() (GameTooltip, GachaView, TutorialModal, DashboardModals, ChallengesView)
- [ ] Missing JSON Schema validation for template files

## 📋 PLANNED FEATURES (from audits)

### ✅ Seasonal Leaderboards (DONE)
### ✅ Spieler-Challenges (Backend DONE, Frontend pending)
### ✅ Companion-Galerie (DONE)
### ✅ Tower Map Visualization (DONE — TowerMap.tsx)
