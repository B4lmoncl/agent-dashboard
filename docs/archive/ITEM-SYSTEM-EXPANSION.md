# Item System Expansion — BoP/BoE, Auto-Salvage, Kanai's Cube

## 1. Binding System (BoP + BoE)

### Design (WoW Classic Style)

| Binding | Bedeutung | Quellen |
|---------|-----------|---------|
| **BoE** (Bind on Equip) | Handelbar bis man es ausrüstet. Danach gebunden. | Crafted Items, Quest Drops, Shop Items |
| **BoP** (Bind on Pickup) | Sofort gebunden, nie handelbar. | Dungeon Drops, Rift Drops, World Boss Drops, Unique Items |
| **Unbound** | Immer handelbar. | Materials, Consumables, Gems |

### Implementation

**Data:** Neues Feld `binding: "boe" | "bop" | null` auf jedem Gear-Template.
- `gearTemplates.json` (General): binding = "boe" (default)
- `gearTemplates-schmied/schneider/leder/waffen/juwelier.json` (Crafted): binding = "boe"
- `gearTemplates-dungeon-*.json`: binding = "bop"
- `gearTemplates-rift.json`: binding = "bop"
- `gearTemplates-worldboss.json`: binding = "bop"
- `uniqueItems.json`: binding = "bop"

**Backend:**
- `createGearInstance()`: Kopiere `binding` vom Template auf die Instanz
- `rollSuffix()`: Suffix ändert Binding nicht
- Equip-Endpoint: Wenn `binding === "boe"`, setze `instance.bound = true` beim Equip
- Trade-Endpoint: Blocke Trade wenn `instance.bound === true` oder `binding === "bop"`

**Frontend:**
- Item-Tooltip: Zeige "Bind on Equip" (grün) oder "Soulbound" (rot) oder "Bind on Pickup" (orange)
- Trade-UI: BoP/Bound Items ausgegraut + Tooltip "Soulbound — cannot be traded"
- Inventory: Binding-Badge auf Item-Card

---

## 2. Auto-Salvage mit Preview-Grid

### Design

Ein "Salvage" Button im Artisan's Quarter der:
1. Ein Modal öffnet mit Rarity-Filter (Common / Uncommon / Rare / Epic)
2. Alle Items der gewählten Rarity in einem Grid mit Icons + Namen zeigt
3. "Salvage All [X Items]" Button mit 2-Step Confirmation
4. Zeigt Preview: "Du erhältst: ~50 Essenz, ~12 Eisenerz, ~8 Kristallsplitter"

### Implementation

**Backend:** `/api/schmiedekunst/dismantle-all` existiert schon. Erweitern mit:
- Neuer Endpoint: `POST /api/schmiedekunst/dismantle-preview` — gibt Preview zurück OHNE zu zerstören
  - Body: `{ rarity: "common" }`
  - Response: `{ items: [...], estimatedEssenz: 50, estimatedMaterials: {...} }`
- Existierender Endpoint: `POST /api/schmiedekunst/dismantle-all` — führt aus

**Frontend:**
- Neuer "Auto-Salvage" Button im ForgeView (neben Salvage-Section)
- Modal: Rarity-Tabs (Common/Uncommon/Rare/Epic — NICHT Legendary)
- Grid: Alle Items als Karten mit Icon, Name, Rarity-Border
- Equipped + BoP Items automatisch ausgeschlossen
- Preview-Zeile: "→ ~50 Essenz, ~12 Eisenerz"
- Confirm-Button: "Salvage 23 Items" → 2-Step Bestätigung

---

## 3. Kanai's Cube — Legendary Effect Extraction

### Design (Diablo 3 Style)

**Konzept:** Opfere ein Legendary Item um dessen Legendary Effect permanent zu "lernen". Gelernte Effects werden in einer "Effect Library" gespeichert. Man kann pro Kategorie (Offensive/Defensive/Utility) EINEN gelernten Effect aktiv haben — ohne das Item tragen zu müssen.

### Regeln
- Nur Legendary Items mit `legendaryEffect` können extrahiert werden
- Das Item wird ZERSTÖRT bei Extraktion
- Der Effect wird permanent in `u.kanaisCube` gespeichert
- 3 Slots: Offensive / Defensive / Utility (wie D3)
- Effekt-Wert wird auf den MINIMALEN Roll fixiert (Anreiz, bessere Items zu behalten statt zu extrahieren)
- Kosten: 500 Essenz + Item

### Effect-Kategorien
| Kategorie | Effects |
|-----------|---------|
| Offensive | xp_bonus, gold_bonus, crit_chance, double_quest_chance, berserker, vampiric |
| Defensive | decay_reduction, streak_protection, auto_streak_shield, second_wind, resilience, fortify, guardian |
| Utility | drop_bonus, material_double, cooldown_reduction, salvage_bonus, mentor, prospector, scavenger, diplomat, cartographer, scholar, gem_preserve |

### Implementation

**Data:** `u.kanaisCube = { offensive: { type, value } | null, defensive: { type, value } | null, utility: { type, value } | null, library: [{ type, value, extractedFrom, extractedAt }] }`

**Backend:**
- `POST /api/kanais-cube/extract` — Body: `{ inventoryItemId }` → Destroy item, add to library
- `POST /api/kanais-cube/equip` — Body: `{ slot: "offensive"|"defensive"|"utility", effectType }` → Set active
- `POST /api/kanais-cube/unequip` — Body: `{ slot }` → Remove active
- `GET /api/kanais-cube` — Return library + active effects
- `getLegendaryModifiers()`: Include Kanai's Cube active effects ON TOP of gear effects

**Frontend:**
- New section in Artisan's Quarter or Character View: "Kanai's Cube"
- 3 hex slots (Offensive/Defensive/Utility) showing active effect
- Library grid showing all extracted effects
- Extract modal: confirm item destruction + preview extracted effect

---

## Implementation Order

### Session 1: BoP/BoE Binding System
1. Add `binding` field to all gear template files
2. Backend: copy binding to instance, block trades on bound items
3. Frontend: binding badge on tooltips + trade UI

### Session 2: Auto-Salvage Preview
1. Backend: preview endpoint
2. Frontend: modal with grid + rarity tabs + preview
3. 2-step confirmation

### Session 3: Kanai's Cube
1. Backend: extract/equip/unequip endpoints
2. Backend: integrate cube effects into getLegendaryModifiers
3. Frontend: cube UI in Artisan's Quarter
4. Effect categorization

### Session 4: Polish + Balance
1. Verify BoP items don't break trading economy
2. Verify cube doesn't make gear effects too powerful (additive within category)
3. UI polish on all new modals
