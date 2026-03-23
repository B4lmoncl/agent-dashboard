# WoW Classic Profession Refactor — Complete Implementation Plan

## Phase 1: Done ✅

### System Changes (Implemented)
1. **300 Max Skill** with WoW sliding probability formula
2. **4 Ranks**: Apprentice(75/Lv5), Journeyman(150/Lv15), Expert(225/Lv25), Artisan(300/Lv40)
3. **Fix 2 Profession Slots**
4. **No Cooldowns** on normal recipes (only rare/legendary transmutes)
5. **All items BoE** (tradeable)
6. **Passive Gathering** (materials drop on quest completion)
7. **Daily Bonus** (2x skill on first craft)
8. **D3 Enchanting**: constant Essenz cost (2), Gold escalates (cap 50k), Affix Pool Preview
9. **Reforge Legendary** (D3 Kanai's Cube style)
10. **Per-item caps** on permanent enchants/reinforce/sharpen
11. **learnedRecipes cleared** on profession drop
12. **Gear template audit**: 3 violations fixed
13. **27 new recipes** + **8 new gear templates** + generic craft handlers
14. **4 broken faction recipes** fixed
15. **Dead code** removed (old reroll system)

---

## Phase 2: Content Expansion

### 2.1 — Neuer Beruf: Lederverarbeiter (Leatherworker)

**NPC:** Roderic the Tanner
**Location:** Gerberei (Tannery)
**Color:** `#b45309` (amber/leather brown)
**Unlock:** Player Level 5
**Armor Type:** `leather` (new, between cloth and heavy)
**Trait:** `geschmeidige_haut` — +1% Gold per leather piece equipped
**Mastery (Skill 225+):** `leather_stat_boost` — +10% leather armor stat rolls

**Material Chain (5 tiers, matching WoW leather progression):**

| Material | Rarity | Drop Source | WoW Equivalent |
|----------|--------|-------------|----------------|
| Leichtes Leder (Light Leather) | common | Common/Uncommon quests | Light Leather |
| Mittleres Leder (Medium Leather) | uncommon | Uncommon/Rare quests | Medium Leather |
| Schweres Leder (Heavy Leather) | rare | Rare quests | Heavy Leather |
| Dickes Leder (Thick Leather) | epic | Epic quests | Thick Leather |
| Raues Leder (Rugged Leather) | legendary | Epic/Legendary quests | Rugged Leather |

**Gathering Affinity:** `leichtesleder`, `mittleresleder`, `schweresleder`

**Files to create/modify:**
- `professions.json`: Add profession definition + ~100 recipes
- `gearTemplates.json`: Add ~25-30 leather gear templates (6 slots × 5 tiers)
- `crafting.js`: No changes needed (generic handlers already support all recipe types)
- `ForgeView.tsx`: Add NPC_LOCATIONS entry + SYNERGY_HINTS
- `globals.css`: Possibly add leather-themed color variables

### 2.2 — Recipe Density: ~100 Rezepte pro Beruf

**WoW Classic recipe density per skill bracket:**

| Skill Bracket | Rank | Recipes | Mat Count per Craft | Mat Tiers Used |
|--------------|------|---------|--------------------|-|
| 1-75 | Apprentice | 15-20 | 1-4 mats | T1 (common) |
| 75-150 | Journeyman | 20-25 | 3-6 mats | T1-T2 (common+uncommon) |
| 150-225 | Expert | 25-30 | 5-10 mats | T2-T3 (uncommon+rare) |
| 225-300 | Artisan | 35-40 | 8-16 mats | T3-T5 (rare+epic+legendary) |

**Recipe types per profession:**

#### Schmied (Blacksmith) — 19 → ~100
```
Gear recipes (6 slots × 5 rarity tiers = 30 base):
  Helm:     Common, Uncommon, Rare, Epic, Legendary
  Armor:    Common, Uncommon, Rare, Epic, Legendary
  Boots:    Common, Uncommon, Rare, Epic, Legendary
  Weapon:   Common, Uncommon, Rare, Epic, Legendary
  Shield:   Common, Uncommon, Rare, Epic, Legendary
  Amulet:   Common, Uncommon, Rare, Epic, Legendary

Utility recipes (~20):
  Sharpening Stones (Lv1-10, weapon temp buff: +kraft for N quests)
  Weightstones (Lv3-8, weapon temp buff: +ausdauer for N quests)
  Shield Spikes (Lv5-9, shield temp buff: +vitalitaet)
  Armor Reinforcements (Lv4-8, armor temp buff: +ausdauer)

Service recipes (~10):
  Sharpen Blade, Reinforce Armor, Upgrade Rarity (existing)
  + new: Temper Weapon, Polish Shield, Repair Kit

Intermediate materials (~10):
  Bronze Bar (2 eisenerz + 1 magiestaub)
  Steel Bar (3 eisenerz + 1 kristallsplitter)
  Mithril Bar (4 kristallsplitter + 1 drachenschuppe)
  Arcanite Bar (1 drachenschuppe + 1 aetherkern) — 24h CD, WoW homage

Trainer-learnable variants (~30):
  Duplicate slot recipes with different stat pools at same tier
  E.g., "Eiserner Helm des Kriegers" (kraft/ausdauer) vs
        "Eiserner Helm des Wächters" (ausdauer/vitalitaet)
```

#### Schneider (Tailor) — 18 → ~100
```
Same structure as Schmied but cloth:
  30 base gear (6 slots × 5 tiers)
  20 utility (Spellthreads: leg enchants, Bags: inventory expansion)
  10 service (existing enchant recipes stay at Verzauberer)
  10 intermediate cloth (combine lower cloth → higher)
  30 trainer variants (different stat pools)
```

#### Lederverarbeiter (Leatherworker) — NEW → ~100
```
Same structure but leather:
  30 base gear (6 slots × 5 tiers)
  20 utility (Armor Kits: +ausdauer temp buff, Leg Patches)
  10 intermediate leather (combine lower leather → higher)
  10 special (Quivers, Ammo Pouches → tempo buffs)
  30 trainer variants
```

#### Alchemist — 14 → ~100
```
Potions (40): XP/Gold/Luck/Streak buffs at every 15 skill levels
  Minor → Lesser → Standard → Greater → Superior → Major versions
  Each buff type has 6 tiers scaling in potency

Flasks (10): Endgame multi-buff consumables (skill 200+)
  Flask of Ambition, Flask of Fortune, Flask of Wisdom, etc.

Transmutes (15): Material upgrades, 24-48h CD
  Transmute: Iron Ore → Crystal Shard
  Transmute: Crystal → Dragon Scale
  Transmute: Dragon → Aether Core
  Transmute: Cloth tier upgrades (leinenstoff → wollstoff etc.)
  Transmute: Leather tier upgrades

Elixirs (20): Single-stat buff consumables
  Elixir of Kraft, Elixir of Weisheit, etc.

Utility (15): Resistance potions, antidotes, mana oils
```

#### Koch (Cook) — 12 → ~100
```
Meals (50): Food buffs at every 10 skill levels
  6 tiers × 8 meal types (XP, Gold, Luck, Forge Temp, Streak Shield,
  combined XP+Gold, combined XP+Luck, full feast)

Drinks (20): Minor stat buffs, short duration
  Tea, Wine, Mead, etc.

Feasts (10): Group-wide buffs (skill 200+)
  Shared buff that affects all party/guild members

Snacks (15): Instant-use minor effects
  Trail mix, dried fruit, etc.

Intermediate (5): Prepare ingredients
  Spice Blend, Herb Butter, etc.
```

#### Verzauberer (Enchanter) — 12 → ~100
```
Temporary Enchants (30): Stat buffs for 24-48h
  One for each stat at 6 tiers: Minor → Lesser → Standard →
  Greater → Superior → Major

Permanent Enchants (15): +stat to gear slot (existing, expand)
  One per slot per tier (weapon/armor/boots/helm/shield/amulet)

Wards/Glyphs (20): Quest-duration buffs
  Protection, Speed, Power, etc.

Scrolls (20): Tradeable buff items
  Scroll of Kraft, Scroll of Weisheit, etc.
  Consumable items that grant temp buffs (like WoW scrolls)

Oils (15): Weapon/Armor coatings
  Brilliant Oil (+weisheit), Savage Oil (+kraft), etc.
```

### 2.3 — Recipe Source Distribution

| Source | % | Implementation |
|--------|---|---------------|
| **Trainer** | 40% (~40 per prof) | `source: "trainer"`, available at NPC, some with `trainerCost` |
| **Quest Drops** | 30% (~30 per prof) | `source: "drop"`, `dropChance: 0.03-0.15`, `dropMinQuestRarity` |
| **Faction/Rep** | 20% (~20 per prof) | `source: "faction"`, `factionId`, requires rep tier |
| **Dungeon/Rift** | 10% (~10 per prof) | `source: "drop"`, very low chance, `dropMinQuestRarity: "epic"` |

### 2.4 — Material Scaling (WoW-treu)

**Cost per craft scales with skill:**

| Skill Range | Primary Mats | Secondary Mats | Gold Cost |
|------------|-------------|----------------|-----------|
| 1-30 | 1-3 | 0 | 10-30g |
| 30-75 | 2-4 | 0-1 | 20-60g |
| 75-120 | 3-6 | 1-2 | 50-120g |
| 120-180 | 5-8 | 2-3 | 100-250g |
| 180-225 | 6-12 | 2-4 | 200-500g |
| 225-270 | 8-16 | 3-5 | 400-800g |
| 270-300 | 12-24 | 4-6 | 600-1500g |

### 2.5 — Material Spezialisierung

**Each profession's gatheringAffinity gets HIGHER drop rates for its own materials.**
Other materials drop at reduced rates, forcing trade.

```
Current base chance: 5% + 3% per prof level
New system:
  Affinity materials:   3% + 2% per skill/30 (max 23% at skill 300)
  Non-affinity:         1% + 0.5% per skill/30 (max 6% at skill 300)
```

This means a Schmied gets ~23% chance for eisenerz but only ~6% for kraeuterbuendel.
To get kraeuterbuendel efficiently, they need to trade with an Alchemist.

### 2.6 — Gear Template Structure

**Per gear-crafting profession (Schmied, Schneider, Lederverarbeiter):**

| Tier | Rarity | reqLevel | Slots | Templates | Material Tier |
|------|--------|----------|-------|-----------|---------------|
| T1 | Common | 1-5 | 6 | 6 | T1 (common) |
| T2 | Uncommon | 9-12 | 6 | 6 | T1+T2 |
| T3 | Rare | 17-20 | 6 | 6 | T2+T3 |
| T4 | Epic | 25-28 | 6 | 6 | T3+T4 |
| T5 | Legendary | 30-35 | 6 | 6 | T4+T5 |

= 30 templates per profession × 3 gear professions = **90 gear templates**
Currently: 33 → need ~57 new templates

### 2.7 — New Leather Gear Templates

**Leather trait: `geschmeidige_haut` (+1% Gold per piece)**
**Stat focus:** Balanced (glueck, ausdauer, kraft as primary; tempo, fokus as minor)

Templates follow exact same CLAUDE.md balancing rules:
- Affix counts match rarity table
- Stat ranges match level table
- Tier/SetId assignment matches level ranges

---

## Implementation Order

### Step 1: New Materials + Profession Definition
- Add 5 leather materials to professions.json
- Add Lederverarbeiter profession definition
- Update materialDropRates for all professions
- Adjust gathering rates for long grind

### Step 2: Gear Templates
- Create missing heavy gear templates (fill all 6 slots × 5 tiers)
- Create missing cloth gear templates (fill all 6 slots × 5 tiers)
- Create all leather gear templates (6 slots × 5 tiers = 30 new)

### Step 3: Recipes — Gear Professions
- Schmied: Add ~80 new recipes (gear variants + utility + intermediates)
- Schneider: Add ~80 new recipes
- Lederverarbeiter: Add ~100 new recipes (all new)

### Step 4: Recipes — Consumable Professions
- Alchemist: Add ~85 new recipes (potions + flasks + transmutes + elixirs)
- Koch: Add ~88 new recipes (meals + drinks + feasts + snacks)
- Verzauberer: Add ~88 new recipes (enchants + wards + scrolls + oils)

### Step 5: Frontend
- Add Lederverarbeiter to ForgeView (NPC card, location, synergy)
- Update recipe display for new recipe types (scrolls, oils, etc.)
- BoE badge on tradeable items

### Step 6: Balance Pass
- Verify all new recipes follow skill-up color spacing
- Verify material costs scale correctly
- Verify gathering rates produce weeks-long grind
- Full CLAUDE.md balancing rules audit on all new gear templates

---

## Quick Reference: Files to Modify

| File | Changes |
|------|---------|
| `professions.json` | +5 materials, +1 profession, +~500 recipes, adjusted drop rates |
| `gearTemplates.json` | +~57 new gear templates |
| `crafting.js` | Minimal — generic handlers already cover all recipe types |
| `ForgeView.tsx` | +1 NPC location, +1 synergy hint, BoE badge |
| `CLAUDE.md` | Update profession count, skill system docs |
