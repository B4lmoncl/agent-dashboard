# Asset Backlog — Fehlende Bilder

> Stand: 2026-04-10 (verifiziert)
> **WoW Classic Icon-Sharing Modell:** ~15 Items teilen sich 1 Icon.
> Ziel: ~97 einzigartige Gear-Icons für 1458 Items.
> Aktuell: 26 Icons (7 equip-* + 19 gacha-*). **~71 neue Gear Icons benötigt.**

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
| Weapon | 245 | 5 | 17 | **12** |
| Shield | 159 | 2 | 11 | **9** |
| Helm | 217 | 1 | 15 | **14** |
| Armor | 265 | 5 | 18 | **13** |
| Amulet | 194 | 1 | 13 | **12** |
| Boots | 217 | 1 | 15 | **14** |
| Ring | 161 | 1 | 11 | **10** |
| **Total** | **1458** | **16** | **~100** | **~84** |

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
- ✅ 26 Gear Icons (7 equip-* + 19 gacha-*) — `public/images/icons/gacha-*.png`, `equip-*.png`
- ✅ 16 Shop Icons — `public/images/icons/shop-*.png`
- ✅ 8 Profession NPC Portraits — `public/images/npcs/{grimvar,ysolde,eldric,bruna,...}*.png`
- ✅ 8 Profession Icons — `public/images/icons/prof-*.png`
- ✅ 4 Rift Icons — `public/images/icons/rift-*.png`
- ✅ 4 Faction Icons — `public/images/icons/faction-*.png`
- ✅ 9 World Boss Portraits — `public/images/bosses/*.png`
- ✅ 23 Material Icons — `public/images/icons/mat-*.png`
- ⬜ 22 Vendor Reagent Icons — `public/images/icons/mat-{reagent}.png` (see PRIO 9 below)
- ✅ 19 Nav Icons — `public/images/icons/nav-*.png`
- ✅ 8 Expedition Location Icons — `public/images/icons/exp-*.png`
- ✅ 9 Weekly Challenge Icons — `public/images/icons/wc-*.png`
- ✅ 4 Workshop Icons — `public/images/icons/workshop-*.png`
- ✅ 3 Ultimate Icons — `public/images/icons/ult-*.png`
- ✅ 22+ NPC Portraits — `public/images/npcs/`

---

## Fehlende Assets — Priorisiert

### PRIO 1: Gear Icons (~84 neue, 128×128)

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

### PRIO 3: Neue Companion Portraits (3 fehlend, 256×256)

**Pfad:** `public/images/companions/companion-{type}.png`

| Companion | Datei | Prompt |
|-----------|-------|--------|
| Basalt (Turtle) | `companion-turtle.png` | Ancient stone turtle with glowing rune cracks on shell, calm eyes, dark background, fantasy RPG |
| Nyx (Raven) | `companion-raven.png` | Sleek black raven with one glowing purple eye, holding stolen gem in beak, dark background, fantasy RPG |
| Flint (Salamander) | `companion-salamander.png` | Bright orange salamander with small flames on back, quick dynamic pose, dark background, fantasy RPG |

> Note: `companion-cat.png` already exists.

### PRIO 4: Gacha Banner NPC Portraits (3 fehlend, 128×128)

Gacha-Banner brauchen NPC-Bilder als Featured Character.
**Pfad:** `public/images/npcs/{banner-npc}.png`

| Banner | NPC | Datei | Prompt |
|--------|-----|-------|--------|
| Waffenkammer | Varn der Klingenmeister | `varn-klingenmeister.png` | Grizzled weaponsmith with scarred hands holding a glowing blade, forge sparks, dark background, fantasy RPG portrait |
| Rüstkammer | Selina die Weberin | `selina-weberin.png` | Elegant weaver woman with silver threads floating around her, enchanted loom in background, fantasy RPG portrait |
| Saisonales Schicksal | Lyra die Archivarin | `lyra-archivarin.png` | Young woman with star-map eyes holding an ancient glowing book, constellation patterns, fantasy RPG portrait |

### PRIO 5: Unique Item Icons (31 + 87 NPC rewards = 118 fehlend, 128×128)

Jedes Unique Named Item verdient ein eigenes Icon (sie sind handcrafted).
**Pfad:** `public/images/icons/unique-{id}.png`

**87 neue NPC-Reward-Items (Stand 2026-04-10):**
Alle 87 NPCs ohne Portrait haben jetzt individuelle Skulduggery-Humor-Items als Quest-Chain-Belohnung. Jedes Item braucht ein 128×128 Icon.
Namensbeispiele für Prompt-Generierung:
- `npc-professor-quill-reward`: "Quills Vergessene Brille" (Helm, rare)
- `npc-schmuggler-dante-reward`: "Dantes Doppelbodenbeutel" (Armor, rare)
- `npc-kriegsmeisterin-valka-reward`: "Valkas Zerbrochener Befehlsstab" (Weapon, epic)
- `npc-tod-der-hoefliche-reward`: "Visitenkarte des Höflichen Besuchers" (Amulet, epic)
- `npc-geisterjagerin-raven-reward`: "Ravens Kalter Spiegel" (Shield, epic)

Pfad-Konvention: `public/images/icons/unique-npc-{npc-id}-reward.png`
Prompt-Suffix: `fantasy RPG icon, dark background, centered, single object`

### PRIO 6: Companion Portraits — Real Animals (6 fehlend, 256×256)

Cat, Dog, Hamster, Bird, Fish, Rabbit — fehlen noch als richtige Portraits.
**Pfad:** `public/images/portraits/companion-{type}.png`

### PRIO 7: NPC Portraits (87 fehlend von 100 NPCs, 128×128)

13 NPCs haben Portraits, 87 fehlen. NPCs ohne Portrait spawnen NICHT (blockiert in npc-engine.js).
**Pfad:** `public/images/npcs/{npc-id}.png`

NPCs MIT Portrait (spawnen):
`oma-ilse`, `wandering-merchant`, `dojo-master`, `forest-witch`, `bard`, `bruder-tomas`, `zara-funkenwind`, `alter-henrik`, `lumi`, `rogar-amboss`, `skelett-gentleman`, `archivarin-vex`, `captain-flint`

### PRIO 8: Nav Icons für neue Rooms (2 Placeholder, 128×128)

| Icon | Aktuell | Prompt |
|------|---------|--------|
| `nav-talents.png` | Kopie von nav-arcanum | Circular skill tree with 3 concentric glowing rings, nodes connected by lines, dark background, fantasy RPG icon |
| `nav-tome.png` | Kopie von nav-codex | Open ancient book with progress bar overlay, golden glow, completion percentage visible, dark background, fantasy RPG icon |

### PRIO 9: Vendor Reagent Icons (22 fehlend, 128×128)

**Pfad:** `public/images/icons/mat-{reagent}.png`

| Reagent | Datei | Profession | Prompt |
|---------|-------|------------|--------|
| Kohlestück | `mat-kohle.png` | Schmied T1 | Small dark charcoal piece, glowing ember edge, dark background, fantasy RPG icon |
| Eisenfluss | `mat-eisenfluss.png` | Schmied T2 | Small iron flux powder, metallic sheen, dark background, fantasy RPG icon |
| Schmelztiegel | `mat-schmelz.png` | Schmied T3 | Stone crucible with molten metal, orange glow, dark background, fantasy RPG icon |
| Ätherflux | `mat-aetherflux.png` | Schmied T4 | Glowing purple-gold flux crystal, arcane sparks, dark background, fantasy RPG icon |
| Grober Faden | `mat-faden-grob.png` | Schneider T1 | Rough hemp thread spool, simple, dark background, fantasy RPG icon |
| Feiner Nähfaden | `mat-faden.png` | Schneider T2 | Fine silver thread spool, slight glow, dark background, fantasy RPG icon |
| Seidenfaden | `mat-faden-seide.png` | Schneider T3 | Shimmering silk thread spool, iridescent, dark background, fantasy RPG icon |
| Runenfaden | `mat-faden-rune.png` | Schneider T4 | Glowing rune-inscribed thread spool, magical aura, dark background, fantasy RPG icon |
| Färbemittel | `mat-farbe.png` | Schneider | Small bottle of purple dye, dripping stopper, dark background, fantasy RPG icon |
| Rohes Lederöl | `mat-oel.png` | Leder T1 | Brown leather oil bottle, amber liquid, dark background, fantasy RPG icon |
| Feines Lederöl | `mat-oel-fein.png` | Leder T2 | Refined golden leather oil, ornate bottle, dark background, fantasy RPG icon |
| Leere Phiole | `mat-phiole.png` | Alchemist T1 | Empty glass vial with cork, clear glass, dark background, fantasy RPG icon |
| Bleiphiole | `mat-phiole-blei.png` | Alchemist T2 | Leaded glass vial, darker tint, reinforced stopper, dark background, fantasy RPG icon |
| Kristallphiole | `mat-kristallphiole.png` | Alchemist T3 | Crystal vial with prismatic reflections, ornate stopper, dark background, fantasy RPG icon |
| Milde Gewürze | `mat-gewuerz-mild.png` | Koch T1 | Small herb pouch, gentle green herbs, dark background, fantasy RPG icon |
| Scharfe Gewürze | `mat-gewuerz-scharf.png` | Koch T2 | Red spice pouch with chili peppers, warm glow, dark background, fantasy RPG icon |
| Beruhigende Gewürze | `mat-gewuerz-beruh.png` | Koch T3 | Blue-tinted healing herb pouch, calming aura, dark background, fantasy RPG icon |
| Verzauberungstinte | `mat-tinte.png` | Verzauberer T1 | Inkwell with glowing purple ink, rune-etched bottle, dark background, fantasy RPG icon |
| Äthertinte | `mat-tinte-aether.png` | Verzauberer T2 | Ethereal blue-gold ink, floating runes above bottle, dark background, fantasy RPG icon |
| Grobes Schleifpulver | `mat-schliff.png` | Juwelier T1 | Pile of sparkling polishing powder, dark background, fantasy RPG icon |
| Feines Schleifpulver | `mat-schliff-fein.png` | Juwelier T2 | Fine diamond dust pile, prismatic sparkle, dark background, fantasy RPG icon |
| Ätherschliff | `mat-schliff-aether.png` | Juwelier T3 | Glowing ethereal polishing compound, arcane particles, dark background, fantasy RPG icon |
