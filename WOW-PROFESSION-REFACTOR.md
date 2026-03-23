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

- [x] professions.json: maxSkill 300, removed levelThresholds
- [x] professions.json: masteryConfig.unlockSkill: 225
- [x] professions.json: Cooldowns removed from normal recipes (only 9 rare/legendary keep CDs)
- [x] ForgeView.tsx: Skill X/300 display, WoW ranks, sliding % chance
- [x] Gear template audit: 3 violations fixed (stat ranges, legendary effects)
- [x] 27 new recipes (Alchemist 8, Koch 6, Verzauberer 5, Schmied 4, Schneider 4)
- [x] 8 new gear templates for new crafting recipes
- [x] Generic craft handlers (buff, temp_enchant, perm_enchant, transmute_material, forge_temp, streak_shield)

### Remaining TODO — Phase 2 (User-Approved Decisions from Deep Audit #2)

#### Recipe Density: ~100-150 Rezepte pro Beruf (WoW-treu)
- [ ] Schmied: 19 → ~100 Rezepte (heavy gear für alle 6 Slots × 5 Tiers + Utility)
- [ ] Schneider: 18 → ~100 Rezepte (cloth gear + Spellthreads + Bags)
- [ ] Alchemist: 14 → ~100 Rezepte (potions + flasks + transmutes + elixirs)
- [ ] Koch: 12 → ~100 Rezepte (meals + drinks + feast buffs)
- [ ] Verzauberer: 12 → ~100 Rezepte (enchants + temp buffs + wards)
- [ ] **NEU: Lederverarbeiter**: 0 → ~100 Rezepte (leather/medium armor, neuer Beruf)

#### Trade System: Alles BoE (handelbar)
- [ ] Add `tradeable: true` flag to all crafted items (gear + consumables)
- [ ] Trading UI already exists via Social System — verify compatibility
- [ ] Crafted items can be listed in trade window

#### Material-Spezialisierung (Trade-Anreiz)
- [ ] Each profession drops its own materials with HIGHER rates
- [ ] Cross-profession materials have LOWER drop rates
- [ ] Forces players to trade materials they can't farm efficiently
- [ ] Adjust `gatheringAffinity` and `materialDropRates` in professions.json

#### Neuer Beruf: Lederverarbeiter (Leatherworker)
- [ ] New profession: "Gerber" / "Tannin the Leatherworker"
- [ ] New armor type: "leather" (between cloth/heavy)
- [ ] New material chain: Leichtes Leder → Mittleres Leder → Schweres Leder → Dickes Leder → Raues Leder
- [ ] ~100 recipes covering leather helm/armor/boots/weapon/amulet across 5 tiers
- [ ] New gear templates in gearTemplates.json
- [ ] Leather armor trait: e.g., +1% Crit or +1% Dodge per piece

#### Drop-Raten: Sehr lang (WoW-treu)
- [ ] Reduce base gathering chance from 5% → 2-3%
- [ ] Per-level bonus from 3% → 1-2%
- [ ] Max gathering chance from 35% → 15-20%
- [ ] Target: 1-300 takes several weeks of daily play

#### Rezept-Quellen: WoW-Verteilung
- [ ] ~40% Trainer recipes (buy from NPC)
- [ ] ~30% Quest/World Drops (quest completion rewards)
- [ ] ~20% Faction/Reputation gated
- [ ] ~10% Dungeon/Rift exclusive drops

#### Profession Perks: Nur über Items/Rezepte
- Each profession's unique value comes from what it can MAKE, not special abilities
- Schmied: Only source of heavy gear
- Schneider: Only source of cloth gear
- Lederverarbeiter: Only source of leather gear
- Alchemist: Only source of potions/flasks/transmutes
- Koch: Only source of food buffs
- Verzauberer: Only source of enchants + stat rerolling

#### Craftable Sets: Backlog (later)
- Good D3-inspired idea, not now
- 2-3 sets per gear profession (Schmied, Schneider, Lederverarbeiter)

## Trade System Vision
Each profession produces things OTHERS need:
- **Schmied**: Heavy Gear (BoE) — tanks/fighters need this
- **Schneider**: Cloth Gear (BoE) — casters/scholars need this
- **Lederverarbeiter**: Leather Gear (BoE) — rogues/rangers need this
- **Alchemist**: Potions/Flasks (tradeable consumables) — everyone needs XP/Gold/Luck buffs
- **Koch**: Meals (tradeable consumables) — everyone needs food buffs
- **Verzauberer**: Enchant services + temp buffs — everyone wants enchants on their gear

With only 2 slots, a Schmied+Alchemist player needs to BUY meals from a Koch and cloth gear from a Schneider.
