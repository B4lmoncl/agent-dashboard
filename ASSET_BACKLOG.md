# Asset Backlog — Fehlende Bilder

> Stand: 2026-04-10 (post-generation audit)
> **WoW Classic Icon-Sharing Modell:** ~15 Items teilen sich 1 Icon.
> Aktuell: 40 gacha-Icons + 7 equip-Placeholder. **13 Boots-Icons fehlen auf Platte.**

---

## Standardgrößen (verbindlich)

| Asset-Typ | Größe | Style Reference | Endpoint |
|---|---|---|---|
| Gear Icons | 128×128 | `gacha-heiltrank.png` | `generate-with-style-v2` |
| NPC Portraits | 128×128 | `rogar-amboss.png` | `generate-with-style-v2` |
| Achievement Icons | 128×128 | `gacha-heiltrank.png` | `generate-with-style-v2` |
| Material Icons | 128×128 | `gacha-heiltrank.png` | `generate-with-style-v2` |
| World Boss Portraits | 256×256 | `rogar-amboss.png` | `generate-with-style-v2` |
| Floor Banners | 792×200 | keine | `generate-image-v2` |

---

## Aktuelle Slot-Verteilung (verifiziert 2026-04-10)

| Slot | Items | Icons | Placeholder | Files Missing | Status |
|------|-------|-------|-------------|---------------|--------|
| Weapon | 245 | 5 gacha | 0 | 0 | ✅ Fertig |
| Shield | 159 | 1 gacha + 1 equip | 72 | 0 | ⬜ Braucht ~9 neue Icons |
| Helm | 217 | 10 gacha | 0 | 0 | ✅ Fertig |
| Armor | 265 | 5 gacha | 0 | 0 | ✅ Fertig |
| Amulet | 194 | 0 gacha + 1 equip | 194 | 0 | ⬜ Braucht ~13 neue Icons |
| Boots | 217 | 14 (Mapping fertig) | 0 | **13 Files fehlen** | ⚠️ Mapping done, Files ausstehend |
| Ring | 161 | 0 gacha + 1 equip | 160 | 0 | ⬜ Braucht ~10 neue Icons |

---

## ✅ Bereits erledigt (NICHT nochmal generieren)

- ✅ 85 Achievement Icons — `public/images/icons/ach-*.png`
- ✅ 5 Floor Banner — `public/images/banners/*.png`
- ✅ 5 Weapon Icons — `public/images/icons/gacha-{name}.png`
- ✅ 5 Armor Icons — `public/images/icons/gacha-{name}.png` + `gacha-armor-obsidian-warplate.png`
- ✅ 10 Helm Icons — `public/images/icons/gacha-helm-*.png`
- ✅ 1 Shield Icon — `public/images/icons/gacha-schild-eiserner-wille.png`
- ✅ 1 Boots Icon — `public/images/icons/gacha-boots-ethereal-walkers.png`
- ✅ 16 Shop Icons — `public/images/icons/shop-*.png`
- ✅ 8 Profession NPC Portraits — `public/images/npcs/{grimvar,ysolde,...}.png`
- ✅ 8 Profession Icons — `public/images/icons/prof-*.png`
- ✅ 4 Rift Icons — `public/images/icons/rift-*.png`
- ✅ 4 Faction Icons — `public/images/icons/faction-*.png`
- ✅ 15 World Boss Portraits — `public/images/bosses/*.png`
- ✅ 64 Material Icons — `public/images/icons/mat-*.png`
- ✅ 19 Nav Icons — `public/images/icons/nav-*.png`
- ✅ 8 Expedition Location Icons — `public/images/icons/exp-*.png`
- ✅ 9 Weekly Challenge Icons — `public/images/icons/wc-*.png`
- ✅ 4 Workshop Icons — `public/images/icons/workshop-*.png`
- ✅ 3 Ultimate Icons — `public/images/icons/ult-*.png`
- ✅ **100 NPC Portraits** — `public/images/npcs/*.png` (ALLE 100 NPCs!)

---

## Fehlende Assets — Priorisiert

### PRIO 1: Boots Icons (13 fehlend, 128×128) ⚠️ MAPPING DONE, NUR FILES FEHLEN

**Pfad:** `public/images/icons/gacha-boots-{name}.png`
**Das JSON-Mapping ist bereits fertig.** Die Items referenzieren diese Pfade. Sobald die Files auf der Platte liegen, funktioniert alles.

| Icon | Datei | Prompt |
|------|-------|--------|
| Celestial Walkers | `gacha-boots-celestial-walkers.png` | Ethereal floating boots with starlight particles, celestial glow, dark background, fantasy RPG icon |
| Desert Wraps | `gacha-boots-desert-wraps.png` | Wrapped leather foot wraps with desert sand texture, simple, dark background, fantasy RPG icon |
| Dragon Greaves | `gacha-boots-dragon-greaves.png` | Heavy dragon-scale greaves with red accents, ornate, dark background, fantasy RPG icon |
| Frost Treads | `gacha-boots-frost-treads.png` | Ice-encrusted boots with frozen crystal soles, blue glow, dark background, fantasy RPG icon |
| Iron Greaves | `gacha-boots-iron-greaves.png` | Iron plate greaves, functional military style, dark background, fantasy RPG icon |
| Leather Boots | `gacha-boots-leather-boots.png` | Sturdy brown leather boots, adventurer style, worn but reliable, dark background, fantasy RPG icon |
| Mage Slippers | `gacha-boots-mage-slippers.png` | Enchanted cloth slippers with arcane runes, soft purple glow, dark background, fantasy RPG icon |
| Plate Sabatons | `gacha-boots-plate-sabatons.png` | Heavy plate armor boots, knight style, steel shine, dark background, fantasy RPG icon |
| Rangers Boots | `gacha-boots-rangers-boots.png` | Green-brown ranger boots, forest camouflage, practical buckles, dark background, fantasy RPG icon |
| Sandals | `gacha-boots-sandals.png` | Simple rope sandals, peasant/monk style, humble, dark background, fantasy RPG icon |
| Shadow Steps | `gacha-boots-shadow-steps.png` | Dark assassin boots with shadow wisps, barely visible, dark background, fantasy RPG icon |
| Spiked Boots | `gacha-boots-spiked-boots.png` | Metal boots with spikes, aggressive warrior style, dark background, fantasy RPG icon |
| Tribal Fur | `gacha-boots-tribal-fur.png` | Fur-lined tribal boots, bone decorations, primitive, dark background, fantasy RPG icon |

### PRIO 2: Shield Icons (~9 neue, 128×128)

**Pfad:** `public/images/icons/gacha-shield-{name}.png`
72 Items auf Placeholder. Brauchen ~9 Icons für round-robin.

### PRIO 3: Amulet Icons (~13 neue, 128×128)

**Pfad:** `public/images/icons/gacha-amulet-{name}.png`
194 Items auf Placeholder. Brauchen ~13 Icons.

### PRIO 4: Ring Icons (~10 neue, 128×128)

**Pfad:** `public/images/icons/gacha-ring-{name}.png`
160 Items auf Placeholder. Brauchen ~10 Icons.

### PRIO 5: Achievement Icons (55 fehlend, 128×128)

**Pfad:** `public/images/icons/ach-{name}.png`
55 Achievements referenzieren Icons die nicht existieren. UI zeigt Fallback.

### PRIO 6: NPC Reward Item Icons (87 neue, 128×128)

**Pfad:** `public/images/icons/unique-npc-{npc-id}-reward.png`
Alle 87 neuen NPC-Reward-Items brauchen eigene Icons.

### PRIO 7: Shop/Loot/Misc Icons (70 fehlend, 128×128)

Diverse Icons für Shop-Items, Loot-Rarity-Badges, Currency-Icons etc. die referenziert aber nicht vorhanden sind.
