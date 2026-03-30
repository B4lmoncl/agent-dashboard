# Asset Backlog — Fehlende Bilder

> Stand: 2026-03-30 (aktualisiert nach Gear-System Overhaul)
> **WoW Classic Icon-Sharing Modell:** ~15 Items teilen sich 1 Icon.
> Ziel: ~96 einzigartige Gear-Icons für 1431 Items.
> Aktuell: 16 Icons. **~80 neue Gear Icons benötigt.**

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

## WoW Classic Icon-Sharing Modell

In WoW Classic teilen sich ~15-20 Items dasselbe Icon. Ein "Eisenschwert" und ein "Stählernes Breitschwert" haben das gleiche Schwert-Icon, aber unterschiedliche Stats. So vermeiden wir 1400 einzigartige Icons und brauchen nur ~96.

### Aktuelle Slot-Verteilung + Icon-Bedarf

| Slot | Items | Icons aktuell | Icons Ziel (~15/Icon) | Noch zu generieren |
|------|-------|---------------|----------------------|-------------------|
| Weapon | 241 | 5 | 17 | **12** |
| Shield | 156 | 2 | 11 | **9** |
| Helm | 213 | 1 | 15 | **14** |
| Armor | 261 | 5 | 18 | **13** |
| Amulet | 211 | 1 | 15 | **14** |
| Boots | 213 | 1 | 15 | **14** |
| Ring | 136 | 1 | 10 | **9** |
| **Total** | **1431** | **16** | **~101** | **~85** |

### Icon-Prompts pro Slot

**Weapon (12 new):** Various fantasy swords, axes, daggers, maces, staves, spears — mix of rusty/simple (common) to ornate/glowing (epic). Dark background, centered.

**Shield (9 new):** Round shields, kite shields, tower shields, bucklers — wood/iron/steel/obsidian/crystal progression. Some with emblems.

**Helm (14 new):** Cloth hoods, leather caps, iron helms, plate helms, ornate crowns, mystical diadems. Mix of practical to regal.

**Armor (13 new):** Cloth robes, leather vests, chain shirts, plate breastplates, ornate cloaks, enchanted mantles. Common → legendary visual progression.

**Amulet (14 new):** Simple pendants, gemstone necklaces, crystal amulets, golden medallions, arcane talismans. Mix of subtle to radiant.

**Boots (14 new):** Sandals, leather boots, iron-shod boots, plate greaves, enchanted treads, ghostly steps. Practical → magical progression.

**Ring (9 new):** Simple bands, copper rings, silver rings, gold rings, gemmed rings, runic bands, glowing spirit rings.

---

## ✅ Bereits erledigt (NICHT nochmal generieren)

- ✅ 85 Achievement Icons — `public/images/icons/ach-*.png`
- ✅ 5 Floor Banner — `public/images/banners/*.png`
- ✅ 16 Gear Icons (Gacha + Equip slot icons) — `public/images/icons/gacha-*.png`, `equip-*.png`
- ✅ 16 Shop Icons — `public/images/icons/shop-*.png`
- ✅ 8 Profession NPC Portraits — `public/images/npcs/{grimvar,ysolde,eldric,bruna,...}*.png`
- ✅ 8 Profession Icons — `public/images/icons/prof-*.png`
- ✅ 4 Rift Icons — `public/images/icons/rift-*.png`
- ✅ 4 Faction Icons — `public/images/icons/faction-*.png`
- ✅ 9 World Boss Portraits — `public/images/bosses/*.png`
- ✅ 23 Material Icons — `public/images/icons/mat-*.png`
- ✅ 19 Nav Icons — `public/images/icons/nav-*.png`
- ✅ 8 Expedition Location Icons — `public/images/icons/exp-*.png`
- ✅ 9 Weekly Challenge Icons — `public/images/icons/wc-*.png`
- ✅ 4 Workshop Icons — `public/images/icons/workshop-*.png`
- ✅ 3 Ultimate Icons — `public/images/icons/ult-*.png`
- ✅ 22+ NPC Portraits — `public/images/npcs/`

---

## Fehlende Assets — Priorisiert

### PRIO 1: Gear Icons (~85 neue, 128×128)

**Pfad:** `public/images/icons/gear-{slot}-{n}.png`
**Bsp:** `gear-weapon-01.png`, `gear-helm-05.png`

Nach Generierung: Items in gearTemplates.json automatisch per Slot + Hash zuweisen (Script existiert bereits).

### PRIO 2: Neue World Boss Portraits (6 fehlend, 256×256)

**Pfad:** `public/images/bosses/{boss-id}.png`

| Boss | Datei | Prompt |
|------|-------|--------|
| Der Aufschub-Kraken | `aufschub-kraken.png` | Giant kraken with tentacles wrapped around clocks and calendars, dark underwater background, fantasy RPG character portrait |
| Die Routine-Sphinx | `routine-sphinx.png` | Stone sphinx with glowing hieroglyphs, sitting on pile of scrolls, desert night, fantasy RPG portrait |
| Der Vergleichs-Spiegel | `vergleichs-spiegel.png` | Ornate magical mirror with malevolent face in glass, golden cracked frame, dark background, fantasy RPG |
| Das Imposter-Phantom | `imposter-phantom.png` | Shadowy figure wearing stolen hero armor that doesn't fit, translucent, dark purple mist, fantasy RPG |
| Die Komfortzone | `komfortzone.png` | Massive cozy creature made of pillows and blankets with sleepy eyes, deceptively warm glow, fantasy RPG |
| Der Deadline-Drache | `deadline-drache.png` | Dragon made of burning papers and scrolls, hourglass embedded in chest, flames intensifying, fantasy RPG |

### PRIO 3: Neue Companion Portraits (4 fehlend, 256×256)

**Pfad:** `public/images/companions/companion-{type}.png`

| Companion | Datei | Prompt |
|-----------|-------|--------|
| Basalt (Turtle) | `companion-turtle.png` | Ancient stone turtle with glowing rune cracks on shell, calm eyes, dark background, fantasy RPG |
| Nyx (Raven) | `companion-raven.png` | Sleek black raven with one glowing purple eye, holding stolen gem in beak, dark background, fantasy RPG |
| Whisper (Cat) | `companion-cat.png` | Elegant dark cat with piercing green eyes, sitting judgmentally, slight magical aura, dark background, fantasy RPG |
| Flint (Salamander) | `companion-salamander.png` | Bright orange salamander with small flames on back, quick dynamic pose, dark background, fantasy RPG |

### PRIO 4: Gacha Banner NPC Portraits (3 fehlend, 128×128)

Gacha-Banner brauchen NPC-Bilder als Featured Character.
**Pfad:** `public/images/npcs/{banner-npc}.png`

| Banner | NPC | Datei | Prompt |
|--------|-----|-------|--------|
| Waffenkammer | Varn der Klingenmeister | `varn-klingenmeister.png` | Grizzled weaponsmith with scarred hands holding a glowing blade, forge sparks, dark background, fantasy RPG portrait |
| Rüstkammer | Selina die Weberin | `selina-weberin.png` | Elegant weaver woman with silver threads floating around her, enchanted loom in background, fantasy RPG portrait |
| Saisonales Schicksal | Lyra die Archivarin | `lyra-archivarin.png` | Young woman with star-map eyes holding an ancient glowing book, constellation patterns, fantasy RPG portrait |

### PRIO 5: Unique Item Icons (31 fehlend, 128×128)

Jedes Unique Named Item verdient ein eigenes Icon (sie sind handcrafted).
**Pfad:** `public/images/icons/unique-{id}.png`

### PRIO 6: Companion Portraits — Real Animals (6 fehlend, 256×256)

Cat, Dog, Hamster, Bird, Fish, Rabbit — fehlen noch als richtige Portraits.
**Pfad:** `public/images/portraits/companion-{type}.png`

### PRIO 7: NPC Portraits (78 fehlend von 100 NPCs, 128×128)

22 NPCs haben Portraits, 78 fehlen.
**Pfad:** `public/images/npcs/{npc-id}.png`

### PRIO 8: Nav Icons für neue Rooms (2 Placeholder, 128×128)

| Icon | Aktuell | Prompt |
|------|---------|--------|
| `nav-talents.png` | Kopie von nav-arcanum | Circular skill tree with 3 concentric glowing rings, nodes connected by lines, dark background, fantasy RPG icon |
| `nav-tome.png` | Kopie von nav-codex | Open ancient book with progress bar overlay, golden glow, completion percentage visible, dark background, fantasy RPG icon |
