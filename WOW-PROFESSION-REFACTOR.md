# WoW Classic Profession Refactor — Implementation Plan

## Decisions Made (User-Approved)

### Core System Changes
1. **300 Max Skill** (not 10 levels) — WoW Classic style
2. **1 Point per Craft** with sliding probability (WoW formula)
3. **4 Ranks** scaled to our Lv50: Apprentice(75/Lv5), Journeyman(150/Lv15), Expert(225/Lv25), Artisan(300/Lv40)
4. **Fix 2 Profession Slots** (strategic choice, forces trading)
5. **No Cooldowns** on normal recipes (WoW-style). Only rare/legendary transmutes have CDs (24-48h)
6. **BoE Gear + Consumables** — items are tradeable → trade incentive between players
7. **Gathering stays passive** (no separate gathering professions, materials drop on quest completion)
8. **Daily Bonus stays** (2x skill points on first craft of the day)
9. **Enchanting Essenz cost constant** at 2 (D3-style, only gold escalates)
10. **Reroll Gold cap stays** at 50,000g
11. **Affix Pool Preview** added to Enchanting tab (D3-style)
12. **Reforge Legendary** added (D3 Kanai's Cube "Law of Kulle" style)
13. **Long grind** — gathering rates tuned so leveling a profession takes weeks, not hours

### WoW Sliding Probability Formula
```
chance = (grayThreshold - playerSkill) / (grayThreshold - yellowThreshold)
```
- Orange (below yellow threshold): 100% guaranteed
- Yellow → Green: slides linearly from 100% → 0%
- Gray (above gray threshold): 0%

### Per-Recipe Breakpoints (derived from reqSkill)
- reqSkill = recipe learn point
- yellow = reqSkill + 25
- green = reqSkill + 50
- gray = reqSkill + 75

### reqProfLevel → reqSkill Mapping
| reqProfLevel | reqSkill |
|-------------|---------|
| 1 | 1 |
| 2 | 30 |
| 3 | 60 |
| 4 | 90 |
| 5 | 120 |
| 6 | 150 |
| 7 | 180 |
| 8 | 210 |
| 9 | 250 |
| 10 | 280 |

## Status: In Progress

### Done
- [x] crafting.js: 300 skill system, WoW ranks, sliding probability, skill-up logic
- [x] crafting.js: GET /api/professions returns skill/maxSkill/skillCap/rank
- [x] crafting.js: Craft handler uses WoW formula for skill-up
- [x] crafting.js: learnedRecipes cleared on profession drop
- [x] crafting.js: Faction recipe handlers
- [x] crafting.js: Reforge Legendary endpoint
- [x] crafting.js: Per-item caps on permanent enchants
- [x] professions.json: professionSlots reduced to 2

### TODO
- [ ] professions.json: Remove `levelThresholds` from professions
- [ ] professions.json: Add `maxSkill: 300` to each profession
- [ ] professions.json: Update `masteryConfig.unlockSkill: 225`
- [ ] professions.json: Remove cooldowns from normal recipes (set to 0)
- [ ] professions.json: Keep cooldowns only on rare/legendary recipes
- [ ] ForgeView.tsx: Display Skill X/300 instead of Level X/10
- [ ] ForgeView.tsx: Show rank name (Apprentice/Journeyman/Expert/Artisan)
- [ ] ForgeView.tsx: Show sliding % chance on recipes instead of fixed colors
- [ ] ForgeView.tsx: Show skill cap from current rank
- [ ] Audit 25 gear templates against CLAUDE.md balancing rules
- [ ] Design new recipes to fill skill gaps (need ~50+ recipes per profession for WoW-like progression)

## Trade System Vision
Each profession produces things OTHERS need:
- **Schmied**: Heavy Gear (BoE) — warriors/tanks need this
- **Schneider**: Cloth Gear (BoE) — casters/healers need this
- **Alchemist**: Potions/Flasks (tradeable consumables) — everyone needs XP/Gold buffs
- **Koch**: Meals (tradeable consumables) — everyone needs food buffs
- **Verzauberer**: Enchant services + temp buffs — everyone wants enchants on their gear

With only 2 slots, a Schmied+Alchemist player needs to BUY meals from a Koch and cloth gear from a Schneider.
