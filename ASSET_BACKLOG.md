# Asset Backlog — Fehlende Bilder

> Stand: 2026-04-15 (verified: achievement, shop, loot, currency, material icons)
> **Gear Icon System: KOMPLETT.** Alle 7 Slots haben 25 Icons, round-robin verteilt, 0 Placeholder.
> **NPC Portraits: KOMPLETT.** Alle 100 NPCs haben Portraits und können spawnen.
> **Boss Portraits: KOMPLETT.** Alle 15 Bosse haben Portraits.
> **Material Icons (Basis): KOMPLETT.** Alle 64 Basis-Materialien haben Icons.
> **Companion Portraits: KOMPLETT.** Alle 15 Companions haben Portraits.
> **Loot Rarity Icons: KOMPLETT.** loot-common bis loot-legendary existieren.
> **Currency Icons: KOMPLETT.** currency-sternentaler existiert.

---

## ✅ KOMPLETT — Nicht nochmal generieren

| Kategorie | Anzahl | Pfad |
|-----------|--------|------|
| Gear Icons (Weapon) | 25 | `gacha-weapon-*.png` |
| Gear Icons (Shield) | 25 | `gacha-shield-*.png` |
| Gear Icons (Helm) | 25 | `gacha-helm-*.png` |
| Gear Icons (Armor) | 25 | `gacha-armor-*.png` |
| Gear Icons (Amulet) | 25 | `gacha-amulet-*.png` |
| Gear Icons (Boots) | 25 | `gacha-boots-*.png` |
| Gear Icons (Ring) | 25 | `gacha-ring-*.png` |
| NPC Portraits | 100 | `npcs/*.png` |
| Boss Portraits | 15 | `bosses/*.png` |
| Material Icons (Basis) | 64 | `mat-*.png` |
| Companion Portraits | 15 | `companions/*.png` |
| Achievement Icons (Batch 1) | 93 | `ach-*.png` (inkl. 8 seit April 10 generierte) |
| Shop Icons | 17 | `shop-*.png` (inkl. shop-detox) |
| Profession Icons | 8 | `prof-*.png` |
| Floor Banners | 5 | `banners/*.png` |
| Nav Icons | 19 | `nav-*.png` |
| Expedition Icons | 8 | `exp-*.png` |
| Weekly Challenge Icons | 9 | `wc-*.png` |
| Workshop Icons | 4 | `workshop-*.png` |
| Ultimate Icons | 3 | `ult-*.png` |
| Rift Icons | 4 | `rift-*.png` |
| Faction Icons | 4 | `faction-*.png` |
| Loot Rarity Icons | 5 | `loot-*.png` |
| Currency Icons | 1 | `currency-sternentaler.png` |

---

## Fehlende Assets — Priorisiert

### PRIO 1: Achievement Icons (47 fehlend, 128×128)

**Pfad:** `public/images/icons/ach-{name}.png`
93 existieren bereits. 47 neuere Achievements referenzieren Icons die nicht generiert wurden.

Fehlend: `ach-10-day`, `ach-100-rituals`, `ach-1000`, `ach-20-npcs`, `ach-200`, `ach-3-day`, `ach-300`, `ach-5-npcs`, `ach-500`, `ach-all-bosses`, `ach-all-prof`, `ach-bond-legend`, `ach-bond`, `ach-bp`, `ach-collector`, `ach-convert`, `ach-craft-100`, `ach-craft-500`, `ach-dungeon-all`, `ach-dungeon`, `ach-enchant-10`, `ach-enchant`, `ach-expedition-10`, `ach-expedition-ancient`, `ach-expedition`, `ach-faction-all`, `ach-friends-10`, `ach-friends`, `ach-gacha-pity`, `ach-kanai-full`, `ach-kanai`, `ach-mail-10`, `ach-mail-50`, `ach-mail`, `ach-mythic-10`, `ach-mythic-5`, `ach-perfect-week`, `ach-recipe`, `ach-rift-legendary`, `ach-royal-gem`, `ach-talent-10`, `ach-talent-respec`, `ach-talent`, `ach-tome-50`, `ach-tome-floor`, `ach-tome`, `ach-trade`, `ach-universalist`

Bereits seit letztem Audit generiert (NICHT nochmal generieren): `ach-artisan`, `ach-daily-sweep`, `ach-diplomat`, `ach-dual-prof`, `ach-faction`, `ach-moonlight`, `ach-rift`

### PRIO 2: Shop Icons (13 fehlend, 128×128)

**Pfad:** `public/images/icons/shop-{name}.png`
17 existieren (inkl. shop-detox). 13 neuere Shop-Items referenzieren fehlende Icons.

Fehlend: `shop-boss-boost`, `shop-companion-glow`, `shop-frame-diplomat`, `shop-frame-eclipse`, `shop-frame-guild`, `shop-frame-moon`, `shop-frame-star`, `shop-rested-boost`, `shop-shield-double`, `shop-title-flame`, `shop-title-sage`, `shop-title-shadow`, `shop-title-warrior`

### PRIO 3: NPC Reward Item Icons (87 neue, 128×128)

**Pfad:** `public/images/icons/unique-npc-{npc-id}-reward.png`
Alle 87 NPC-Quest-Chain-Reward-Items haben `icon: null`. Brauchen individuelle Icons.

### PRIO 4: Old Item Template Icons (50 fehlend, 128×128)

**Pfad:** `public/images/icons/{name}.png`
`itemTemplates.json` referenziert 50 Icons im alten Format (`t1-axe.png`, `t2-helm.png` etc.) die nicht existieren. Diese sind Consumables/Loot-Items, nicht Gear.

### PRIO 5: Crafting Recipe Icons — Consumable-Berufe (aktuell Placeholder, 128×128)

**Status:** Aktuell nutzen diese Rezepte generische Fallback-Icons (Heiltrank, Mahlzeit, Rune, Gem). Pro Beruf brauchen wir individuelle Icons für bessere Unterscheidbarkeit.

| Beruf | Rezepttyp | Anzahl | Aktueller Placeholder | Benötigt |
|-------|-----------|--------|----------------------|----------|
| Alchemist | Buff-Potions (XP, Gold, Luck, Streak) | 67 | `gacha-heiltrank.png` | 6-8 Trank-Varianten (XP=blau, Gold=gelb, Luck=grün, Streak=rot, Flask=groß) |
| Koch | Buff-Mahlzeiten (XP, Gold, Forge Temp) | 64 | `shop-meal.png` | 6-8 Food-Varianten (Suppe, Braten, Kuchen, Eintopf nach Tier) |
| Verzauberer | Gear Enhance + Vellums | 73 | `ui-ritual-rune.png` | 4-5 Enchant-Varianten (Glow-Rune, Scroll, Permanent-Siegel) |
| Juwelier | Gem Cut + Gem Merge | 34 | `gacha-amulet-soul-gem.png` | 6 Gem-Icons pro Typ (Ruby, Sapphire, Emerald, Topaz, Amethyst, Diamond) |
| **Alle Gear-Berufe** | gear_enhance (Sharpen, Reinforce, Polish) | 73 | `loot-gear-upgrade.png` | 3-4 Enhance-Varianten (Schleifstein, Verstärkung, Politur) |

**Gesamt: ~25-35 neue Icons** für volle Abdeckung aller Consumable/Enhance-Rezepte.

### PRIO 6: Intermediate Crafting Material Icons (21 fehlend, 128×128)

**Status:** Diese Materialien existieren in professions.json aber haben kein Icon. Sie werden von Rezepten als Output erzeugt (Barren, Ballen, verarbeitetes Leder).

**Pfad:** `public/images/icons/mat-{name}.png`

| Beruf | Material | Dateiname |
|-------|----------|-----------|
| Schmied | Eisenbarren | `mat-eisenbarren.png` |
| Schmied | Kristallbarren | `mat-kristallbarren.png` |
| Schmied | Verstärkter Stahl | `mat-verstaerkterstahl.png` |
| Schmied | Drachenstahl | `mat-drachenstahl.png` |
| Schmied | Drachenkern | `mat-drachenkern.png` |
| Schmied | Aetherlegierung | `mat-aetherlegierung.png` |
| Schmied | Aetherbarren | `mat-aetherbarren.png` |
| Schmied | Seelenlegierung | `mat-seelenlegierung.png` |
| Schmied | Seelenstahl | `mat-seelenstahl.png` |
| Schneider | Magiestoff-Ballen | `mat-magiestoffballen.png` |
| Schneider | Runenstoff-Ballen | `mat-runenstoffballen.png` |
| Schneider | Sternenlicht-Farbe | `mat-sternenlichtfarbe.png` |
| Schneider | Arkaner Faden | `mat-arkanerfaden.png` |
| Lederverarbeiter | Geheiltes Leichtleder | `mat-geheiltesleichtleder.png` |
| Lederverarbeiter | Geheiltes Mittleres Leder | `mat-geheiltesmittleresleder.png` |
| Lederverarbeiter | Gehärtetes Schwerleder | `mat-gehaertetesschwerleder.png` |
| Lederverarbeiter | Bestien-Lederballen | `mat-bestienlederballen.png` |
| Lederverarbeiter | Urzeitleder-Ballen | `mat-urzeitleder.png` |
| Lederverarbeiter | Klauenöl | `mat-klauenoel.png` |
| Lederverarbeiter | Salzgerbung | `mat-salzgerbung.png` |
| Lederverarbeiter | Uraltes Gerbmittel | `mat-uraltesgerbmittel.png` |

**Gesamt: 21 neue Material-Icons** (+ 3 Transmute-Varianten die dieselben Materialien referenzieren).

**Prompt-Hinweise:** Metallbarren = glühender Barren auf Amboss, Stoffballen = gerollter Stoff mit Muster, Leder = gestapelte Lederstücke mit Textur. Alle 128×128px, style ref `gacha-heiltrank.png`, `no_background: true`.

---

## Zusammenfassung

| Prio | Kategorie | Fehlend | Größe |
|------|-----------|---------|-------|
| 1 | Achievement Icons | 47 | 128×128 |
| 2 | Shop Icons | 13 | 128×128 |
| 3 | NPC Reward Item Icons | 87 | 128×128 |
| 4 | Old Item Template Icons | 50 | 128×128 |
| 5 | Crafting Recipe Icons | ~30 | 128×128 |
| 6 | Intermediate Material Icons | 21 | 128×128 |
| **Total** | | **~248** | |
