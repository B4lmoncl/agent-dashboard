# Crafting Rework: Schneider + Schmied Gear Crafting + D3 Reroll

## Overview

Three major changes:
1. **New "Schneider" (Tailor) profession** — crafts cloth armor from fabric materials
2. **Schmied rework** — becomes a gear-crafting profession (heavy armor from ores), stat reroll removed from profession
3. **D3-style Stat Reroll** — standalone system (new Schmied tab, no profession needed), with item-locked stats and escalating costs

---

## Phase 1: Data & Backend Foundation

### 1.1 New Materials — `public/data/professions.json`

Add 5 new cloth materials to the `materials` array:

| ID | Name | Rarity | Icon | Source |
|----|------|--------|------|--------|
| `leinenstoff` | Leinenstoff | common | new icon | Common quest drops, low-tier rifts |
| `wollstoff` | Wollstoff | uncommon | new icon | Mid-tier quests, dungeon drops |
| `seidenstoff` | Seidenstoff | rare | new icon | Rifts (Normal+), dungeon drops |
| `magiestoff` | Magiestoff | epic | new icon | Hard/Legendary Rift, World Boss |
| `runenstoff` | Runenstoff | legendary | new icon | Legendary Rift, Mythic+, World Boss |

Update `materialDropRates` in professions.json to include cloth drops alongside existing ore drops.

### 1.2 Schneider Profession Definition — `public/data/professions.json`

Add new profession entry:
```json
{
  "id": "schneider",
  "name": "Tailor",
  "npcName": "Selina die Weberin",
  "npcPortrait": null,
  "color": "#c084fc",
  "desc": "Craft cloth armor with arcane properties",
  "unlockLevel": 5,
  "maxLevel": 10,
  "gatheringAffinity": ["leinenstoff", "wollstoff", "seidenstoff"],
  "masteryBonus": { "type": "cloth_stat_boost", "value": 10, "label": "+10% cloth armor stat rolls" }
}
```

Synergy pair: `schneider ↔ verzauberer` ("Arcane Mastery")

### 1.3 Schneider Recipes — Cloth Armor Crafting

~15-20 recipes organized by profession level and output rarity:

**Trainer recipes (buy with gold):**
- Lv1: Common Cloth Helm/Armor/Boots (leinenstoff × 3-5, 50-100g)
- Lv2: Common Cloth Weapon (staff) / Shield (leinenstoff × 4-6, 75-120g)
- Lv3: Uncommon Cloth Armor (leinenstoff + wollstoff, 150g)
- Lv5: Rare Cloth pieces (wollstoff + seidenstoff, 250g)

**Drop recipes (from Rifts, Dungeons, World Boss):**
- Lv6: Rare Cloth Set pieces (seidenstoff + magiestoff, 400g)
- Lv8: Epic Cloth pieces (magiestoff + runenstoff, 600g)

**Gacha/Mythic+ recipes:**
- Lv9: Legendary Cloth pieces (runenstoff + aetherkern + seelensplitter, 1000g)
- Lv10: Unique Cloth item recipes

Each recipe produces a gear item using `createGearInstance()` with a cloth-specific template.

### 1.4 Schmied Rework — Heavy Armor Crafting Recipes

Add ~15-20 new heavy armor crafting recipes to Schmied (same structure as Schneider but with ore materials):

**Trainer recipes:**
- Lv1: Common Heavy Helm/Armor/Boots (eisenerz × 3-5, 50-100g)
- Lv3: Uncommon Heavy pieces (eisenerz + kristallsplitter, 150g)
- Lv5: Rare Heavy pieces (kristallsplitter + drachenschuppe, 250g)

**Drop recipes:**
- Lv7: Epic Heavy pieces (drachenschuppe + aetherkern, 500g)

**Gacha/Boss recipes:**
- Lv9: Legendary Heavy pieces (aetherkern + seelensplitter, 1000g)

**Keep existing Schmied recipes:** sharpen_blade, reinforce_armor, upgrade_rarity (these are utility, not gear-crafting).

**Remove from Schmied:** reroll_stat, reroll_minor → moved to standalone reroll system.

### 1.5 Gear Templates — Cloth & Heavy Armor

Add new gear templates to `public/data/gearTemplates.json`:

**Cloth Armor templates** (prefix `cloth-`):
- `cloth-helm-t1` through `cloth-helm-t4`
- `cloth-armor-t1` through `cloth-armor-t4`
- `cloth-boots-t1` through `cloth-boots-t4`
- `cloth-amulet-t2`, `cloth-amulet-t3`
- `cloth-weapon-t1` through `cloth-weapon-t4` (staves, wands)

Each with:
- `armorType: "cloth"`
- `trait: { type: "arkane_resonanz", value: 1, label: "+1% XP" }`
- Affix pools weighted toward weisheit, glueck (primary) and fokus, charisma (minor)
- Exclusive legendary effects: `pity_reduction`, `ritual_streak_bonus`, `companion_bond_boost`

**Heavy Armor templates** (prefix `heavy-`):
- Same slot coverage as cloth
- `armorType: "heavy"`
- `trait: { type: "eiserne_haut", value: 1, label: "+1 Ausdauer" }`
- Affix pools weighted toward kraft, ausdauer (primary) and vitalitaet, tempo (minor)
- Exclusive legendary effects: `forge_temp_flat`, `material_double`, `streak_protection`

**Existing gear** (from drops/shop) remains `armorType: "neutral"` or undefined → no trait.

### 1.6 Armor Type Trait System — `lib/helpers.js`

Add to `getLegendaryModifiers()` or create new `getArmorTraitBonus(user)`:

```javascript
function getArmorTraitBonus(user) {
  const equipment = user.equipment || {};
  let clothCount = 0, heavyCount = 0;
  for (const slot of VALID_SLOTS) {
    const item = equipment[slot];
    if (!item || typeof item !== 'object') continue;
    const template = state.gearById.get(item.templateId);
    if (template?.armorType === 'cloth') clothCount++;
    else if (template?.armorType === 'heavy') heavyCount++;
  }
  return {
    xpBonus: clothCount * 0.01,        // Arkane Resonanz: +1% XP per cloth piece
    flatAusdauer: heavyCount * 1,       // Eiserne Haut: +1 Ausdauer per heavy piece
  };
}
```

Apply `xpBonus` wherever XP is awarded (quest completion, rituals, etc.)
Apply `flatAusdauer` in gear score / stat calculation.

---

## Phase 2: D3-Style Stat Reroll System

### 2.1 New Backend Endpoint — `routes/crafting.js`

`POST /api/reroll/enchant`

**Request:**
```json
{
  "slot": "weapon",
  "statToLock": "kraft",      // first reroll: pick stat to lock
  "chosenOption": 0           // 0, 1, or 2 (keep old / option A / option B)
}
```

**Logic:**
1. Look up equipped item in `slot`
2. If item has no `rerollLocked` field → this is the first reroll, set `rerollLocked = statToLock`
3. If item already has `rerollLocked` → can only reroll that stat (reject if different stat chosen)
4. Calculate cost: `baseCost × 1.5^(rerollCount)` for gold, `2 + floor(rerollCount/3)` for essenz
5. Roll 2 new options from the affix pool (guaranteed different from each other; at least one different from current)
6. Return `{ options: [currentValue, optionA, optionB], cost: { gold, essenz }, rerollCount }`
7. If `chosenOption` provided: apply the selected option, increment `rerollCount`, deduct cost

**Item state tracking** (added to gear instance):
```json
{
  "rerollLocked": "kraft",     // null until first reroll
  "rerollCount": 3,            // escalates cost
}
```

**Cost formula:**
| Reroll # | Gold | Essenz |
|----------|------|--------|
| 1 | 100 | 2 |
| 2 | 150 | 2 |
| 3 | 225 | 3 |
| 4 | 338 | 3 |
| 5 | 506 | 4 |
| 10 | 3,844 | 5 |
| 15 | 29,192 | 7 |
| Cap | 50,000 | 10 |

### 2.2 Reroll UI — New Tab in Schmied NPC Modal

Add "Enchanting" tab to Schmied NPC (visible to ALL players, no profession required):

**UI Flow:**
1. Show 6 equipment slots → click to select item
2. Display item stats with each stat as a clickable row
3. If item has `rerollLocked`: only that stat is clickable (others show lock icon)
4. Click stat → show cost preview + "Enchant" button
5. After enchanting: show 3 options (old value, option A, option B) as cards
6. Player picks one → stat updated, UI refreshes
7. Show escalating cost warning after 5+ rerolls

---

## Phase 3: Frontend Changes

### 3.1 ForgeView.tsx Updates

1. **Add Schneider NPC** to the NPC grid (Selina die Weberin, purple theme)
2. **Schmied NPC tabs:** Add "Enchanting" tab (available to all, no profession check)
3. **Remove** `reroll_stat` and `reroll_minor` from Schmied recipes list
4. **New recipe rendering** for gear-crafting recipes: show output item preview with expected stats
5. **Gear-craft result:** When crafting produces gear, show item in RewardCelebration popup

### 3.2 Enchanting Tab UI (new component or section in ForgeView)

- 6 slot grid showing equipped items
- Selected item shows all stats as rows
- Locked stat highlighted with purple glow, others grayed out
- Cost display with gold + essenz icons
- "Enchant" button with cost
- Result overlay: 3 option cards (keep / option A / option B)
- Reroll counter badge on item

### 3.3 Recipe Book UI for Gear Crafting

For Schneider & Schmied gear recipes:
- Show output item name, rarity, slot
- Preview: stat ranges from template affix pool
- Material cost list
- "Craft" button → creates gear instance → celebration popup

---

## Phase 4: Drop Integration

### 4.1 Material Drops — `lib/helpers.js`

Update `rollCraftingMaterials()`:
- Add cloth drops to the drop rate table
- Cloth drops from same sources as ore (quests, rifts, dungeons, world boss)
- Schneider gathering affinity: bonus cloth drops

### 4.2 Recipe Drops

Update drop tables in:
- `routes/rift.js` — Rift completion rewards can include recipe items
- `routes/dungeons.js` — Dungeon rewards can include recipe items
- `routes/world-boss.js` — World Boss drops can include recipe items
- `routes/gacha.js` — Add recipe items to gacha banner pools

Recipe item format in inventory:
```json
{
  "id": "recipe-cloth-armor-t3",
  "type": "recipe",
  "profession": "schneider",
  "recipeId": "craft_cloth_armor_rare",
  "name": "Pattern: Seidene Gelehrtenrobe",
  "rarity": "rare"
}
```

"Use" recipe item → adds to `learnedRecipes`, removes from inventory.

---

## Phase 5: Synergy & Profession Slot Updates

### 5.1 Profession Slots

Current: max 4 profession slots (unlocked at Lv5/15/20/25)
With 5 professions (schmied, schneider, alchemist, verzauberer, koch), players must choose 4 of 5.

### 5.2 Synergy Pairs Update

```
schmied ↔ verzauberer  → "Gear Mastery" (existing)
schneider ↔ verzauberer → "Arcane Mastery" (new)
alchemist ↔ koch → "Sustenance" (existing)
```

Schneider gets 2 synergy options, making verzauberer the "universal enhancer."

---

## Implementation Order

1. **Data layer** (professions.json: schneider + materials + recipes, gearTemplates.json: cloth + heavy templates)
2. **Backend** (crafting.js: schneider craft endpoint, gear-crafting logic, reroll endpoint)
3. **Helpers** (armor trait system, cloth material drops, recipe drop integration)
4. **Frontend** (ForgeView: schneider NPC, enchanting tab, gear-craft UI)
5. **Drop integration** (rift, dungeon, world-boss, gacha recipe drops)
6. **Polish** (tooltips, celebration popups, cost previews, icons)
