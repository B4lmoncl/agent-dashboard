# Gear Content Expansion — Complete Implementation Plan

> **Ziel:** 1000+ neue Gear Items, inspiriert von WoW Classic (Source-Exclusive Drops, Dungeon Loot Tables) und Diablo 3 (Named Sets, Legendary Powers, Affix System). Die Seite soll sich anfühlen wie ein echtes Loot-Game mit endlosem Grind-Potential.

## Referenzen

- **WoW Classic:** Source-Exclusive Drops (jeder Dungeon hat eigene Items), World Drops, Reputation Vendor Items, Random Suffixes ("des Adlers", "des Bären"), Crafted = Pre-Raid BiS (Lionheart Helm Prinzip)
- **Diablo 3:** Named Sets (2/4-Piece Boni), Legendary Powers als Build-Changer, Loot 2.0 ("weniger aber besser"), Smart Loot, Additive-Kategorie-Stacking

---

## Verbindliche Design-Entscheidungen

### Modifier Stacking (Diablo 3 Style)
**Gleiche Kategorie = ADDITIV untereinander. Verschiedene Kategorien = MULTIPLIKATIV.**

Beispiel: Zwei xp_bonus Items (5% + 3%) = +8% total (additiv), NICHT 1.05×1.03.
Aber: xp_bonus (8%) × forge_temp_multi (1.25) × kraft_bonus (1.05) = multiplikativ.

**Kategorien:**
| Kategorie | Beispiele | Stacking |
|-----------|-----------|----------|
| XP-Boni (Gear) | xp_bonus, variety_bonus | Additiv untereinander |
| Gold-Boni (Gear) | gold_bonus, night_double_gold | Additiv untereinander |
| Drop-Boni (Gear) | drop_bonus, material_double | Additiv untereinander |
| Base-Multiplikatoren | Forge Temp, Kraft-Stat, Streak | Multiplikativ (eigene Kategorie) |
| Aktive Buffs | Potions, Feasts, Scrolls | Additiv untereinander |
| Set-Boni | Named Set 2/4-Piece | Eigener Multiplikator |

→ **Backend-Change nötig:** `onQuestCompletedByUser()` in helpers.js muss umgebaut werden.

### Item Power Hierarchie (Linear, klar definiert)
```
Quest Drops (common-rare)
  < Normal Rift (uncommon-rare) — solo, schnell
    < Crafted Gear (Skill 275+, Tier 4 Legendary) — langer Grind, Pre-Content BiS
      < Hard Rift (rare-epic) — solo, mittelschwer
        < Dungeon Normal (uncommon-epic) — Gruppe, aufwendig
          < Dungeon Hard (rare-legendary) — Gruppe, schwer
            < Legendary Rift (epic-legendary) — solo, sehr schwer
              < World Boss Drops (epic-legendary) — Community, Contribution-gated
                < Dungeon Legendary (epic-legendary) — Gruppe, Endgame
                  < Named Sets (vollständig, mit Set-Bonus)
                    < Mythic+ Drops (legendary only) — endlos skalierend
                      < Unique Named Items (Tier 5, handcrafted)
```

**Prinzip:** Gruppeninhalt (Dungeons, WB) gibt IMMER besseres Gear als vergleichbarer Solo-Inhalt (Rifts). Nur Mythic+ (extrem schwer, endlos) übertrifft alles außer Uniques.

**Crafted = Pre-Content BiS (WoW Classic Lionheart Helm Prinzip):**
- Crafted Skill 275-300 Items sind BESSER als Normal-Dungeon-Drops
- Crafted Items werden ÜBERHOLT durch Hard-Dungeon und höher
- Motivation: Berufe-Grind lohnt sich für den Einstieg ins Endgame
- Langfristig: Drops ersetzen Crafted, aber Crafted bleibt relevant für Alts/Twinks

### Random Suffix System
- **30% Chance** bei JEDEM Drop (Quest, Dungeon, Rift, WB)
- Suffix addiert **Flat-Stats** (~30-50% eines normalen Affix-Rolls)
- 10 Suffixes (des Adlers, des Bären, des Tigers etc.)
- Suffix-Stats skalieren mit Item-Level
- Crafted Items haben KEINE Suffixes (nur Drops)

### Set Acquisition (WoW Classic Source-Locked)
- Set-Pieces droppen NUR aus ihrer spezifischen Quelle
- Man muss den Content wiederholt spielen
- Kein Cross-Contamination

### Flavor-Text
- Alle Items: Deutsch, Skulduggery/Kingkiller Tone
- Per Script generiert mit thematischen Templates pro Source
- Dungeon = mysteriös, Rift = kosmisch, WB = episch, Crafted = handwerklich

## Aktuelle Lage

| Kategorie | Anzahl | Status |
|-----------|--------|--------|
| General Gear (gen-*, dun-*, rift-*, wb-*, fac-*, ch-*, bp-*) | 251 | Existiert |
| Crafted Gear (8 Professions) | 467 | Existiert |
| Unique Named Items | 14 | Existiert |
| Gacha Pool | 19 | Existiert |
| **Total Gear** | **751** | |

## Ziel: 1750+ Gear Items (1000+ neue) — STATUS: ✅ PHASE 1-6 COMPLETE

**Aktueller Stand nach Session A-F:**
- Gear Templates: 1074
- Unique Items: 14
- Suffix Types: 10
- Legendary Effect Types: 37
- **Total: 1088 Gear Items + ~322 Suffix-Varianten = ~1410 effektive Items**

---

## Phase 1: Dungeon-Exclusive Loot Tables (~200 Items)

### Konzept (WoW Classic Style)
Jeder Dungeon bekommt eine eigene Loot-Tabelle mit exklusiven Items die NUR dort droppen. Wie in WoW: "Deadmines Van Cleef's Dagger" droppt nur in den Deadmines.

### Implementation

**Sunken Archive (Normal, Lv10, GS100) — 30 Items:**
- 5 Items pro Slot (helm, armor, boots, weapon, shield, ring)
- Raritäten: 15 Uncommon, 10 Rare, 5 Epic
- Naming: "Archiv-[X]" / "Versunkene [X]" Serie
- ArmorType: Mix (heavy/cloth/leather — Smart Loot nach Spieler-Klasse/Profession)
- reqLevel: 8-14
- All `shopHidden: true`, `source: "dungeon:sunken-archive"`

**Shattered Spire (Hard, Lv20, GS250) — 40 Items:**
- 6 Items pro Slot + 4 Extras
- Raritäten: 10 Uncommon, 18 Rare, 10 Epic, 2 Legendary
- Naming: "Turm-[X]" / "Zerbrochene [X]" Serie
- reqLevel: 16-24
- 2 Legendaries mit Build-Changing Effects

**Hollow Core (Legendary, Lv35, GS500) — 50 Items:**
- 7 Items pro Slot + 1 Extra
- Raritäten: 15 Rare, 25 Epic, 10 Legendary
- Naming: "Leeren-[X]" / "Kern-[X]" Serie
- reqLevel: 28-45
- 10 Legendaries mit starken Effects
- Includes 2 Set Items (Teil eines Dungeon-Sets)

**Neue Dateien:**
- `gearTemplates-dungeon-archive.json` (30 Items)
- `gearTemplates-dungeon-spire.json` (40 Items)
- `gearTemplates-dungeon-core.json` (50 Items)

**Backend-Änderung:**
- `routes/dungeons.js`: Loot-Roll bei Dungeon-Completion zieht aus dungeon-spezifischem Pool statt globalem Pool
- Neue Funktion: `rollDungeonLoot(dungeonId, playerLevel, gearScore)`
- Drop-Chance: 1 guaranteed item per run + chance for bonus items

**Dateien:** 3 neue gearTemplates JSON + dungeons.js Anpassung

---

## Phase 2: World Boss Exclusive Drops (~80 Items)

### Konzept
Jeder der 9 World Bosses bekommt 8-10 exklusive Items (neben den Unique Named Items). Contribution-Tier bestimmt Qualität.

### Implementation

**Pro Boss (9 Bosse × ~9 Items = ~80 Items):**
- 1-2 Items pro Slot (nicht alle Slots bei jedem Boss)
- Top-Contributor-Tier: Guaranteed Epic+
- Mid-Tier: Rare+
- Participation-Tier: Uncommon+
- Naming: Boss-thematisch ("Wyrm-[X]", "Koloss-[X]", "Hydra-[X]" etc.)

**Neue Dateien:**
- `gearTemplates-worldboss.json` (80 Items, gruppiert nach Boss-ID)

**Backend-Änderung:**
- `routes/world-boss.js`: Reward-Claim zieht aus boss-spezifischem Pool
- Contribution-Rank beeinflusst Rarity-Floor

---

## Phase 3: Rift-Tier Loot Pools (~150 Items)

### Konzept
Rift-Tiers haben eigene Item-Pools. Höherer Tier = bessere Items. Mythic+ hat exklusive Legendaries.

### Implementation

**Normal Rift (3 Quests, 72h) — 20 Items:**
- reqLevel 5-15, Uncommon/Rare
- Naming: "Riss-[X]" Serie

**Hard Rift (5 Quests, 48h) — 30 Items:**
- reqLevel 15-25, Rare/Epic
- Naming: "Kluft-[X]" Serie

**Legendary Rift (7 Quests, 36h) — 40 Items:**
- reqLevel 25-40, Epic/Legendary
- Naming: "Abyss-[X]" Serie
- 5 Legendaries mit Rift-spezifischen Effects

**Mythic+ Pool — 60 Items:**
- reqLevel 35-50, Epic/Legendary only
- Naming: "Mythisch-[X]" / "Jenseits-[X]" Serie
- 15 Legendaries mit den stärksten Build-Changing Effects im Spiel
- Items skalieren mit Mythic+ Level (höhere Level = bessere Stat-Ranges)
- Mythic+10 exclusive items, Mythic+20 exclusive items

**Neue Dateien:**
- `gearTemplates-rift.json` (150 Items, gruppiert nach Tier)

**Backend-Änderung:**
- `routes/rift.js`: Stage-Completion und Rift-Completion ziehen aus tier-spezifischem Pool

---

## Phase 4: Named Gear Sets (Diablo 3 Style) — ~60 Items

### Konzept
5-8 thematische Sets mit 4-6 Teilen pro Set. 2-Piece und 4-Piece Set-Boni. Sets droppen aus spezifischen Quellen.

### Set-Design-Regeln (aus CLAUDE.md)
- 3-4 Pieces pro Set (nicht 6 — unser 7-Slot-System macht Full-Sets zu dominant)
- Partial Bonus bei 2 Pieces, Full Bonus bei 3-4 Pieces
- Set-Boni: Flat Stats (+3-8 pro Stat) oder kleine % Multiplikatoren (5-10%)
- Named Sets überschreiben generische setId-Boni

### Geplante Sets

**1. Archivars-Garnitur (Dungeon: Sunken Archive)**
- 3 Pieces: Helm + Armor + Boots
- 2-Piece: +5 Weisheit, +5 Fokus
- 3-Piece: +10% Quest-XP, -5% Forge Decay
- Lore: "Getragen von den letzten Archivaren des Versunkenen Archivs."

**2. Turmbrecher-Rüstung (Dungeon: Shattered Spire)**
- 3 Pieces: Weapon + Shield + Helm
- 2-Piece: +5 Kraft, +5 Ausdauer
- 3-Piece: +15% Boss-Damage, +1 Streak Shield
- Lore: "Geschmiedet aus den Trümmern des Zerbrochenen Turms."

**3. Leerengewand (Dungeon: Hollow Core)**
- 4 Pieces: Helm + Armor + Boots + Amulet
- 2-Piece: +8 Glueck, +5 Charisma
- 4-Piece: +20% Drop-Chance, +10% Gold
- Lore: "Gewoben aus der Essenz der Leere selbst."

**4. Drachentöter-Arsenal (World Boss Pool)**
- 3 Pieces: Weapon + Armor + Ring
- 2-Piece: +8 Kraft, +3 Tempo
- 3-Piece: +25% World Boss Damage, +5% Crit Chance
- Lore: "Jedes Stück erinnert sich an einen anderen Drachen."

**5. Sternenwächter-Tracht (Rift: Legendary+)**
- 4 Pieces: Helm + Armor + Boots + Shield
- 2-Piece: +5 alle Primary Stats
- 4-Piece: +15% XP + Gold, -10% Forge Decay
- Lore: "Lyra selbst soll diese Tracht einst getragen haben. Lyra bestreitet das."

**6. Aetherwandler-Gewand (Mythic+ Pool)**
- 3 Pieces: Weapon + Amulet + Ring
- 2-Piece: +10 Weisheit
- 3-Piece: +20% XP, +10% alle Currencies
- Lore: "Für jene die zwischen den Rissen wandeln — und immer wiederkehren."

**7. Schattenjäger-Ausrüstung (Faction: Bund der Schatten)**
- 3 Pieces: Helm + Boots + Weapon
- 2-Piece: +8 Glueck, +5 Tempo
- 3-Piece: +15% Craft Cooldown Reduction, +10% Material Double Chance
- Lore: "Die Schatten nehmen. Aber manchmal geben sie auch."

**8. Flammenherz-Panzer (Faction: Orden der Klinge)**
- 3 Pieces: Armor + Shield + Ring
- 2-Piece: +8 Ausdauer, +5 Vitalitaet
- 3-Piece: +20% Streak Protection, +10% Forge Temp Recovery
- Lore: "Das Feuer prüft. Wer besteht, wird stärker."

**Neue Dateien:**
- Set-Definitionen in bestehende `gearTemplates.json` namedSets Array
- Set-Items verteilt auf die jeweiligen Source-Dateien (Dungeon/Rift/WB/Faction)

---

## Phase 5: Random Suffix System (WoW Classic Style) — ~300 Varianten

### Konzept
Items können mit zufälligen Suffixen droppen die zusätzliche Stats geben. Gleicher Base-Item, verschiedene Rolls. "Eisernes Schwert des Adlers" (+Weisheit) vs "Eisernes Schwert des Bären" (+Ausdauer).

### Suffix-Liste (WoW-Classic-inspiriert, deutsche Namen)

| Suffix | Bonus | Farbe |
|--------|-------|-------|
| des Adlers | +Weisheit | Blau |
| des Bären | +Ausdauer | Grün |
| des Tigers | +Kraft + Tempo | Orange |
| des Falken | +Glueck | Gold |
| der Eule | +Fokus | Lila |
| des Gorillas | +Ausdauer + Kraft | Rot |
| der Schlange | +Charisma | Pink |
| des Wolfes | +Tempo + Vitalitaet | Silber |
| des Affen | +Glueck + Tempo | Gelb |
| des Wals | +Vitalitaet | Türkis |

### Implementation

**Backend:**
- `lib/helpers.js`: Beim Loot-Roll/Gear-Creation: 30% Chance auf Suffix
- Suffix wird dem Item-Namen angehängt und Stats addiert
- Suffix-Stats skalieren mit Item-Level (wie base Stats)
- Suffix-System gilt für ALLE Drop-Items (Dungeon, Rift, WB, Quest), NICHT für Crafted oder Shop

**Datei:**
- `public/data/suffixes.json`: Suffix-Definitionen mit Stat-Boni pro Level-Bracket

**Kein eigenes gearTemplate nötig** — Suffixes werden dynamisch beim Drop-Roll generiert und dem Instanz-Objekt hinzugefügt.

---

## Phase 6: Erweiterte Legendary Powers (~30 neue Effects)

### Konzept
Aktuell 24 Legendary Effect Types. Erweitern auf 50+ mit Build-Changing Gameplay-Effekten (Diablo 3 Style).

### Neue Effect-Types

**Offensive:**
- `double_quest_chance` — X% Chance dass eine Quest doppelt abgeschlossen wird (2x Rewards)
- `chain_lightning` — Jede 3. Quest-Completion triggert Bonus auf die nächste
- `berserker` — +X% XP wenn Forge Temp > 80%
- `overkill` — Überschüssige Quest-XP (über Level-Threshold) wird als Gold konvertiert
- `vampiric` — X% der verdienten XP werden als Bond-XP an Companion weitergegeben

**Defensive:**
- `fortify` — +X flat Ausdauer wenn alle 7 Slots equipped
- `second_wind` — Wenn Streak bricht, 50% Chance auf halben Streak-Wert statt 0
- `resilience` — -X% XP-Penalty bei Hoarding (Quest-Stacking)
- `guardian` — Streak-Shield regeneriert sich alle X Tage automatisch

**Utility:**
- `prospector` — +X% Chance auf doppelte Gem-Drops
- `scavenger` — +X% Chance auf Bonus-Material bei Salvage
- `mentor` — +X% Profession Skill-Up Chance
- `diplomat` — +X% Faction Rep Gain
- `cartographer` — +X% Expedition Speed
- `scholar` — +X% Battle Pass XP

**Social:**
- `generous` — Trades mit dir geben dem Partner +X% Bonus-Gold
- `inspiring` — +X% Guild Feast Buff Duration
- `legendary_aura` — Nearby friends (in same dungeon) get +X% XP

### Implementation
- `lib/helpers.js`: getLegendaryModifiers() erweitern
- Neue Effects in bestehende Legendary-Item-Templates + neue Items einbauen
- Frontend: GameTooltip Registry erweitern für neue Effect-Typen

---

## Implementation Order

### Session A: Dungeon Loot (Phase 1) — ~200 Items
1. 3 Dungeon-spezifische gearTemplate-Dateien erstellen
2. Backend: `rollDungeonLoot()` Funktion
3. Dungeon-Completion Reward-Flow anpassen
4. Balance-Check

### Session B: World Boss + Rift Loot (Phase 2+3) — ~230 Items
1. World Boss gearTemplate-Datei
2. Rift gearTemplate-Datei (4 Tier-Pools)
3. Backend: Boss/Rift Reward-Flow anpassen
4. Mythic+ exclusive Items

### Session C: Named Sets (Phase 4) — ~60 Items
1. 8 Set-Definitionen in namedSets
2. Set-Items erstellen und in Source-Dateien verteilen
3. Backend: Set-Bonus-Berechnung verifizieren
4. Frontend: Set-Tracker im Character View

### Session D: Random Suffix System (Phase 5) — Backend + Data
1. `suffixes.json` erstellen
2. Backend: Suffix-Roll bei Loot-Drop
3. Frontend: Suffix-Anzeige in Item-Tooltips
4. Name-Display: "[Item] des [Suffix]"

### Session E: Legendary Powers (Phase 6) — Backend + Data
1. 30 neue Effect-Types definieren
2. getLegendaryModifiers() erweitern
3. Effects in Game-Logic verdrahten (quest completion, rift, dungeons etc.)
4. GameTooltip Registry erweitern
5. Neue Legendary Items mit den Effects erstellen

### Session F: Balance Pass + Frontend Polish
1. Gesamter Item-Balance-Audit
2. Drop-Rate-Kalibrierung
3. Frontend: Dungeon/Rift/WB Loot-Preview
4. Frontend: Set-Collection-Tracker
5. CLAUDE.md + AUDIT_REPORT.md aktualisieren

---

## Ziel-Ergebnis

| Kategorie | Aktuell | Neu | Total |
|-----------|---------|-----|-------|
| General Gear | 251 | — | 251 |
| Crafted Gear (8 Profs) | 467 | — | 467 |
| Dungeon Exclusive | ~34 | +86 | 120 |
| World Boss Exclusive | 14 | +80 | 94 |
| Rift Exclusive | ~20 | +130 | 150 |
| Named Set Items | ~20 | +40 | 60 |
| Gacha Pool | 19 | — | 19 |
| Random Suffixes | 0 | ~300 Varianten | dynamisch |
| Legendary Powers | 24 types | +30 types | 54 types |
| **Total Gear** | **751** | **+336 Items** | **~1100 Items** |
| **+ Suffix-Varianten** | — | **~300** | **~1400 effektive Items** |

---

## Quick Reference: Neue Dateien

| Datei | Inhalt | Phase |
|-------|--------|-------|
| `gearTemplates-dungeon-archive.json` | 30 Sunken Archive Items | A |
| `gearTemplates-dungeon-spire.json` | 40 Shattered Spire Items | A |
| `gearTemplates-dungeon-core.json` | 50 Hollow Core Items | A |
| `gearTemplates-worldboss.json` | 80 World Boss Items | B |
| `gearTemplates-rift.json` | 150 Rift Items (4 Tier-Pools) | B |
| `suffixes.json` | 10 Suffix-Definitionen | D |
| Erweiterte `namedSets` in gearTemplates.json | 8 Set-Definitionen | C |

---

## Design-Prinzipien

1. **Source Exclusivity (WoW):** Jedes Item hat EINE Quelle. Dungeon-Items droppen NUR dort. Kein Cross-Contamination.
2. **Loot 2.0 (Diablo):** Weniger Drops, aber bessere. Jeder Drop soll spannend sein.
3. **Build Diversity (Diablo):** Legendary Powers sollen verschiedene Playstyles ermöglichen (XP-Farmer, Gold-Farmer, Streak-Tank, Social-Buffer).
4. **Endgame-Grind (WoW):** Mythic+ Items als ultimatives Ziel. Sets als Collection-Motivation. Perfekte Rolls als Long-Term-Goal.
5. **Fair Gearing (Diablo Smart Loot):** Random Suffixes und Level-Bracket-Scaling sorgen dafür dass Drops immer relevant sind.
