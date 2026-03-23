# Profession System — Definitive Specification

> **Referenz-Inspiration:** WoW Classic Crafting (Vanilla 1.12), Diablo 3 Artisan System
> **Version:** 1.0 — Erstellt 2026-03-23
> **Zweck:** Verbindliches Zieldokument für alle Profession-Arbeiten über mehrere Sessions hinweg.

---

## Inhaltsverzeichnis

1. [Ist-Stand (Aktuell)](#1-ist-stand-aktuell)
2. [Endziel-Übersicht](#2-endziel-übersicht)
3. [Profession-Design im Detail](#3-profession-design-im-detail)
4. [Material-System](#4-material-system)
5. [Rezept-System (WoW-Referenz)](#5-rezept-system-wow-referenz)
6. [Gear-Template-Abdeckung](#6-gear-template-abdeckung)
7. [Skill-Up-System (WoW Classic Referenz)](#7-skill-up-system-wow-classic-referenz)
8. [Rezept-Quellen (WoW Classic Referenz)](#8-rezept-quellen-wow-classic-referenz)
9. [Cooldown- & Economy-Balance](#9-cooldown--economy-balance)
10. [Offene Lücken & Priorisierte Arbeitspakete](#10-offene-lücken--priorisierte-arbeitspakete)
11. [Checkliste für neue Rezepte](#11-checkliste-für-neue-rezepte)

---

## 1. Ist-Stand (Aktuell)

### 1.1 Professionen

| # | Profession | NPC | Typ | Rezepte | Status |
|---|-----------|-----|-----|---------|--------|
| 1 | **Schmied** (Blacksmith) | Grimvar | Gear-Crafter | 19 | Aktiv |
| 2 | **Schneider** (Tailor) | Fayra | Gear-Crafter | 18 | Aktiv |
| 3 | **Alchemist** | Ysolde | Buff-Crafter | 14 | Aktiv |
| 4 | **Verzauberer** (Enchanter) | Eldric | Buff/Enchant | 12 | Aktiv |
| 5 | **Koch** (Cook) | Bruna | Buff-Crafter | 12 | Aktiv |

**Gesamt: 5 Professionen, 75 Rezepte, 18 Materialien**

### 1.2 Rezepte pro Profession (Detail)

#### Schmied (Grimvar) — 19 Rezepte
| Quelle | Anzahl |
|--------|--------|
| Trainer | 11 |
| Drop | 7 |
| Faction | 1 |

| Typ | Anzahl |
|-----|--------|
| Gear | 15 |
| Buff | 1 |
| Sonstige (Reinforce/Reroll) | 3 |

| reqProfLevel | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-------------|---|---|---|---|---|---|---|---|---|---|
| Anzahl | 3 | 1 | 2 | 2 | 3 | 2 | 3 | 1 | 2 | 0 |

#### Schneider (Fayra) — 18 Rezepte
| Quelle | Anzahl |
|--------|--------|
| Trainer | 12 |
| Drop | 6 |
| Faction | 0 |

| Typ | Anzahl |
|-----|--------|
| Gear | 18 |

| reqProfLevel | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-------------|---|---|---|---|---|---|---|---|---|---|
| Anzahl | 3 | 1 | 3 | 1 | 3 | 2 | 1 | 2 | 1 | 1 |

#### Alchemist (Ysolde) — 14 Rezepte
| Quelle | Anzahl |
|--------|--------|
| Trainer | 9 |
| Drop | 4 |
| Faction | 1 |

| Typ | Anzahl |
|-----|--------|
| Buff (Potions/Flasks) | 12 |
| Sonstige (Transmute) | 2 |

| reqProfLevel | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-------------|---|---|---|---|---|---|---|---|---|---|
| Anzahl | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 0 |

#### Verzauberer (Eldric) — 12 Rezepte
| Quelle | Anzahl |
|--------|--------|
| Trainer | 5 |
| Drop | 5 |
| Faction | 2 |

| Typ | Anzahl |
|-----|--------|
| Buff (Enchants/Infusions) | 9 |
| Sonstige (Reroll/Extract) | 3 |

| reqProfLevel | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-------------|---|---|---|---|---|---|---|---|---|---|
| Anzahl | 2 | 1 | 1 | 3 | 1 | 1 | 1 | 1 | 1 | 0 |

#### Koch (Bruna) — 12 Rezepte
| Quelle | Anzahl |
|--------|--------|
| Trainer | 7 |
| Drop | 5 |
| Faction | 0 |

| Typ | Anzahl |
|-----|--------|
| Buff (Mahlzeiten) | 12 |

| reqProfLevel | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-------------|---|---|---|---|---|---|---|---|---|---|
| Anzahl | 2 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

### 1.3 Materialien (18 Stück)

| ID | Name | Rarity | Primär für |
|----|------|--------|-----------|
| `eisenerz` | Iron Ore | Common | Schmied |
| `magiestaub` | Arcane Dust | Common | Verzauberer |
| `kristallsplitter` | Crystal Shard | Uncommon | Verzauberer, Schmied |
| `drachenschuppe` | Dragon Scale | Rare | Schmied |
| `aetherkern` | Aether Core | Epic | Schmied, Verzauberer |
| `kraeuterbuendel` | Herb Bundle | Common | Alchemist |
| `mondblume` | Moonpetal | Uncommon | Alchemist |
| `phoenixfeder` | Phoenix Feather | Epic | Alchemist |
| `runenstein` | Runestone | Uncommon | Verzauberer |
| `seelensplitter` | Soul Fragment | Legendary | Schmied, Verzauberer |
| `leinenstoff` | Leinenstoff | Common | Schneider |
| `wollstoff` | Wollstoff | Uncommon | Schneider |
| `seidenstoff` | Seidenstoff | Rare | Schneider |
| `magiestoff` | Magiestoff | Epic | Schneider |
| `runenstoff` | Runenstoff | Legendary | Schneider |
| `wildfleisch` | Wild Game | Common | Koch |
| `feuerwurz` | Fireroot | Uncommon | Koch |
| `sternenfrucht` | Starfruit | Rare | Koch |

### 1.4 Gear-Template-Abdeckung (Ist-Stand)

**Heavy Armor (Schmied) — 15 Templates:**

| Slot | Common | Uncommon | Rare | Epic | Legendary |
|------|--------|----------|------|------|-----------|
| Helm | YES | --- | YES | YES | --- |
| Armor | YES | YES | YES | YES | --- |
| Boots | YES | --- | YES | --- | --- |
| Weapon | YES | --- | --- | YES | YES |
| Shield | --- | YES | YES | --- | --- |
| Amulet | --- | YES | --- | --- | --- |

**Cloth Armor (Schneider) — 18 Templates:**

| Slot | Common | Uncommon | Rare | Epic | Legendary |
|------|--------|----------|------|------|-----------|
| Helm | YES | YES | YES | YES | --- |
| Armor | YES | YES | YES | YES | YES |
| Boots | YES | YES | YES | --- | --- |
| Weapon | YES | --- | YES | YES | YES |
| Shield | --- | --- | --- | --- | --- |
| Amulet | --- | YES | YES | --- | --- |

---

## 2. Endziel-Übersicht

### 2.1 Zielzahlen

| Kategorie | Ist | Ziel | Delta |
|-----------|-----|------|-------|
| **Professionen** | 5 | 5 | 0 (komplett) |
| **Materialien** | 18 | 26 | +8 neue |
| **Rezepte gesamt** | 75 | ~130 | +~55 neue |
| **— Schmied** | 19 | 28 | +9 |
| **— Schneider** | 18 | 26 | +8 |
| **— Alchemist** | 14 | 26 | +12 |
| **— Verzauberer** | 12 | 24 | +12 |
| **— Koch** | 12 | 26 | +14 |
| **Gear Templates (Heavy)** | 15 | 30 | +15 (6 Slots × 5 Rarities) |
| **Gear Templates (Cloth)** | 18 | 30 | +12 (6 Slots × 5 Rarities) |
| **Profession-Ränge** | 10 | 10 | 0 (komplett) |

### 2.2 Design-Philosophie (WoW Classic Referenz)

In WoW Classic hatte jede Profession **~300 Rezepte** über 300 Skill-Punkte. Unser System hat **10 Stufen** statt 300 Skill-Punkte, also skalieren wir proportional:

- **WoW Classic:** ~300 Rezepte / 300 Skillpunkte ≈ 1 Rezept pro Skillpunkt
- **Quest Hall:** ~26 Rezepte / 10 Stufen ≈ 2–3 Rezepte pro Stufe

Das ist dichter als WoW und fühlt sich belohnend an, weil jeder Level-Up 2-3 neue Rezepte freischaltet.

**WoW Classic Profession-Struktur (als Vorbild):**

| WoW Rank | Skill | Unser Equivalent | ProfLevel |
|----------|-------|-----------------|-----------|
| Apprentice | 1–75 | Novize | 1–2 |
| Journeyman | 75–150 | Lehrling (Apprentice) | 3–4 |
| Expert | 150–225 | Geselle (Journeyman) | 5–6 |
| Artisan | 225–300 | Experte (Expert) | 7–8 |
| — | — | Handwerker (Artisan) | 9 |
| — | — | Meister (Master) | 10 |

### 2.3 Profession-Verteilung nach Rolle

| Profession | Primär-Output | Sekundär-Output | WoW-Äquivalent |
|-----------|--------------|-----------------|----------------|
| **Schmied** | Heavy Gear (Waffen, Rüstung, Schilde) | Reinforcement, Whetstone | Blacksmithing + Weaponsmithing |
| **Schneider** | Cloth Gear (Roben, Hüte, Stäbe) | Taschen (inv. slots), Patches | Tailoring |
| **Alchemist** | Potions, Flasks, Elixirs | Transmutationen (Mat-Umwandlung) | Alchemy |
| **Verzauberer** | Enchants auf Gear, Infusions | Stat-Reroll (D3 Mystic), Extrakt | Enchanting |
| **Koch** | Mahlzeiten (Buff-Food) | Snacks (schwächere kurze Buffs) | Cooking |

---

## 3. Profession-Design im Detail

### 3.1 Schmied (Grimvar) — Heavy Gear Crafter

**WoW Classic Referenz:** Blacksmithing hatte ~75 Waffen, ~80 Rüstungsteile, ~20 Steine/Gewichte, Spezialisierung in Waffen- oder Rüstungsschmied ab Skill 200.

**Unser Ziel: 28 Rezepte**

| Stufe | Rang | Rezepte (Ziel) | Rezept-Typ | Quelle |
|-------|------|---------------|------------|--------|
| 1 | Novize | 3 | Common Helm, Armor, Weapon | Trainer |
| 2 | Novize | 2 | Common Boots, Shield + Whetstone (temp buff) | Trainer |
| 3 | Lehrling | 3 | Uncommon Helm, Armor, Boots | Trainer |
| 4 | Lehrling | 2 | Uncommon Weapon, Shield | Trainer |
| 5 | Geselle | 3 | Rare Armor, Boots, Amulet + Reinforcement | Trainer/Drop |
| 6 | Geselle | 2 | Rare Helm, Shield | Drop |
| 7 | Experte | 3 | Epic Helm, Armor, Weapon | Drop |
| 8 | Experte | 2 | Epic Boots, Shield | Drop/Faction |
| 9 | Handwerker | 3 | Epic Amulet + Legendary Helm, Armor | Drop |
| 10 | Meister | 2 | Legendary Boots, Amulet + Meister-Reinforcement | Drop |

**Rezept-Kategorien:**
- **Gear-Crafting** (22): Alle 6 Slots × relevante Rarities
- **Whetstone** (2): Temp weapon buff (+Kraft, Novize + Experte Variante)
- **Reinforcement** (2): Permanent gear stat boost (Novize + Meister)
- **Reroll** (2): Affix-Reroll auf eigene Heavy-Gear

### 3.2 Schneider (Fayra) — Cloth Gear Crafter

**WoW Classic Referenz:** Tailoring hatte ~65 Rüstungsteile, ~15 Taschen, ~10 Hemden (kosmetisch). Keine Waffen, aber Stäbe sind unser Cloth-Weapon-Äquivalent (wie Tailoring + Wand-Crafting).

**Unser Ziel: 26 Rezepte**

| Stufe | Rang | Rezepte (Ziel) | Rezept-Typ | Quelle |
|-------|------|---------------|------------|--------|
| 1 | Novize | 3 | Common Helm, Armor, Weapon | Trainer |
| 2 | Novize | 2 | Common Boots, Amulet | Trainer |
| 3 | Lehrling | 3 | Uncommon Helm, Armor, Weapon | Trainer |
| 4 | Lehrling | 2 | Uncommon Boots, Amulet | Trainer |
| 5 | Geselle | 3 | Rare Boots, Shield + Patch (temp armor buff) | Trainer/Drop |
| 6 | Geselle | 2 | Rare Amulet + Uncommon Shield | Drop |
| 7 | Experte | 3 | Epic Helm, Boots, Shield | Drop |
| 8 | Experte | 2 | Epic Amulet + Rare Shield | Drop |
| 9 | Handwerker | 2 | Legendary Helm, Boots | Drop |
| 10 | Meister | 2 | Legendary Amulet, Shield + Meister-Patch | Drop |

**Rezept-Kategorien:**
- **Gear-Crafting** (22): Alle 6 Slots × relevante Rarities (Shield = Ward/Fokus-Kristall)
- **Patch** (2): Temp armor buff (+Ausdauer, Novize + Experte)
- **Reroll** (2): Affix-Reroll auf eigene Cloth-Gear

### 3.3 Alchemist (Ysolde) — Potions & Transmutation

**WoW Classic Referenz:** Alchemy hatte ~75 Tränke, ~15 Elixiere, ~10 Flasks (Endgame, z.B. Flask of the Titans, Flask of Distilled Wisdom — Raid-BiS), ~5 Transmutationen (z.B. Transmute: Arcanite Bar, 48h CD). Flasks erforderten Schattenlabor (Black Morass Alchemy Lab). Transmute-Spezialisierung in TBC.

**Unser Ziel: 26 Rezepte**

| Stufe | Rang | Rezepte (Ziel) | Rezept-Typ | Quelle |
|-------|------|---------------|------------|--------|
| 1 | Novize | 3 | Minor Healing Potion, Minor XP Elixir, Herb Paste (fokus) | Trainer |
| 2 | Novize | 2 | Minor Gold Elixir, Minor Luck Potion | Trainer |
| 3 | Lehrling | 3 | Healing Potion, XP Elixir, Streakshield Potion | Trainer |
| 4 | Lehrling | 2 | Transmute: Eisenerz→Kristallsplitter, Gold Elixir | Trainer |
| 5 | Geselle | 3 | Greater Healing, Luck Potion, Ausdauer Elixir | Trainer/Drop |
| 6 | Geselle | 2 | Transmute: Kristall→Drachenschuppe, Fokus Flask | Drop |
| 7 | Experte | 3 | Major XP Flask, Major Luck Flask, Forge Temp Potion | Drop |
| 8 | Experte | 2 | Transmute: Drache→Aetherkern, Combat Elixir | Drop/Faction |
| 9 | Handwerker | 3 | Supreme Flask (all stats), Night Owl Elixir, Streak Mega Shield | Drop |
| 10 | Meister | 3 | Transmute: Epic→Legendary Mats, Meister-Flask (24h), Elixir of Insight | Drop |

**Rezept-Kategorien nach WoW-Vorbild:**
- **Potions** (8): Sofort-Effekte (Healing=Streak-Save, Luck, Streakshield)
- **Elixirs** (8): Temporäre Buffs (XP, Gold, Fokus, Ausdauer, Kraft — stacken nicht untereinander)
- **Flasks** (5): Stärkere lang-anhaltende Buffs (stacken NICHT mit Elixirs — WoW Classic Regel)
- **Transmutationen** (5): Material-Umwandlung mit Cooldown (WoW: 24h CD pro Transmute)

**WoW-Buff-Stacking-Regel (übernommen):**
- Ein Spieler kann **1 Elixir** ODER **1 Flask** aktiv haben (nicht beides)
- Flasks sind stärker aber teurer → Endgame-Rezepte
- Food-Buffs (Koch) stacken mit Alchemie-Buffs, solange verschiedene Stats

### 3.4 Verzauberer (Eldric) — Enchants & Mystic Reroll

**WoW Classic Referenz:** Enchanting hatte ~120 Enchants auf Gear-Slots (z.B. Enchant Weapon: Crusader, Enchant Chest: Greater Stats), Disenchant (Gear→Mats), Öle (Wizard Oil, Mana Oil — temp weapon buffs). D3 Mystic: Reroll eines Stats auf Gear, wird teurer pro Reroll.

**Unser Ziel: 24 Rezepte**

| Stufe | Rang | Rezepte (Ziel) | Rezept-Typ | Quelle |
|-------|------|---------------|------------|--------|
| 1 | Novize | 3 | Minor Kraft Enchant, Minor Weisheit Enchant, Disenchant | Trainer |
| 2 | Novize | 2 | Minor Ausdauer Enchant, Minor Glueck Enchant | Trainer |
| 3 | Lehrling | 3 | Kraft Enchant, Weisheit Enchant, Stat Reroll (D3 Mystic) | Trainer |
| 4 | Lehrling | 2 | Ausdauer Enchant, Infusion: XP Boost | Trainer/Drop |
| 5 | Geselle | 3 | Greater Kraft, Greater Weisheit, Glueck Enchant | Drop |
| 6 | Geselle | 2 | Infusion: Gold Boost, Infusion: Drop Boost | Drop/Faction |
| 7 | Experte | 2 | Major Enchants (Kraft, Weisheit) | Drop |
| 8 | Experte | 2 | Major Enchants (Ausdauer, Glueck) + Advanced Reroll | Drop/Faction |
| 9 | Handwerker | 2 | Supreme Enchant (all primary), Legendary Infusion | Drop |
| 10 | Meister | 3 | Meister-Enchant (BiS), Socket Adding, Soul Extraction | Drop |

**Rezept-Kategorien:**
- **Enchants** (14): Permanente Stat-Boosts auf Gear (WoW: Enchant Weapon/Chest/Boots etc.)
- **Infusions** (4): Temporäre Gear-Buffs (wie WoW Wizard Oil / Mana Oil)
- **Utility** (4): Stat Reroll (D3 Mystic), Disenchant, Socket Adding
- **Special** (2): Supreme Enchant, Soul Extraction (Legendary-Effekt transferieren)

**D3 Mystic Reroll-Regeln (bereits implementiert):**
- Wähle 1 Stat auf dem Item zum Reroll
- Neuer Wert aus dem Affix-Pool des Items
- Kosten steigen pro Reroll: 100g → 200g → 400g → 800g → ...
- Einmal gewählter Stat bleibt "locked" für Rerolls (andere Stats fixiert)
- Visuell markiert welcher Stat rerolled wurde

### 3.5 Koch (Bruna) — Buff Food

**WoW Classic Referenz:** Cooking hatte ~60 Rezepte: Gewürztes Wolfsfleisch (+Stamina/Spirit), Nightfin Soup (+MP5), Dirge's Kickin' Chimaerok Chops (+25 Stamina, BiS). Buff Food gab 1 Stat-Buff für 15-30 Min. Nur 1 Food-Buff gleichzeitig. Ab 300 Cooking: Endgame-Buffood das Raids brauchten.

**Unser Ziel: 26 Rezepte**

| Stufe | Rang | Rezepte (Ziel) | Rezept-Typ | Quelle |
|-------|------|---------------|------------|--------|
| 1 | Novize | 3 | Gegrilltes Wild (+Kraft), Kräutersuppe (+Ausdauer), Brot (kleiner Heal) | Trainer |
| 2 | Novize | 2 | Gewürzfisch (+Weisheit), Beeren-Snack (+Glueck) | Trainer |
| 3 | Lehrling | 3 | Wildgulasch (+Kraft), Mondlichtsuppe (+Weisheit), Kräutertee (+Fokus) | Trainer |
| 4 | Lehrling | 2 | Feuerwurz-Braten (+Ausdauer), Glückskeks (+Glueck) | Trainer |
| 5 | Geselle | 3 | Jäger-Festmahl (+Kraft,+Ausdauer), Sternensuppe (+XP), Energieriegel (+Tempo) | Trainer/Drop |
| 6 | Geselle | 2 | Drachenfleisch (+Kraft++), Magier-Pudding (+Weisheit++) | Drop |
| 7 | Experte | 3 | Phönix-Braten (+all primary), Himmelskuchen (+Glueck++), Kampfration (+Forge Temp) | Drop |
| 8 | Experte | 2 | Sternenfrucht-Dessert (+XP++), Nachtmahl (+Night Gold) | Drop |
| 9 | Handwerker | 3 | Heldenfestmahl (Party Buff), Drachenblut-Suppe (+Crit), Wanderer-Proviant (+Streak) | Drop |
| 10 | Meister | 3 | Göttermahl (BiS all stats), Elixier-Suppe (Flask-equivalent), Ewiges Brot (24h buff) | Drop |

**Rezept-Kategorien:**
- **Mahlzeiten** (16): Standard Buff-Food (+1 Stat, skaliert mit Rezept-Level)
- **Snacks** (4): Schwächere, kürzere Buffs (2h statt 8h), günstiger herzustellen
- **Festmahle** (3): Multi-Stat oder Party-Buff (teurer, seltener — wie WoW Great Feast)
- **Spezial** (3): Utility-Buffs (Forge Temp, Night Gold, Streak Protection)

**WoW-Regel: Food Buff**
- Max 1 Food-Buff gleichzeitig (neuer überschreibt alten)
- Food-Buffs + Alchemie-Buffs verschiedener Stats stacken (WoW-Regel)
- Food-Buffs + Alchemie-Buffs desselben Stats: Stärkerer gewinnt

---

## 4. Material-System

### 4.1 Bestehende Materialien (18)

Siehe Abschnitt 1.3 für die vollständige Liste.

### 4.2 Fehlende Materialien (8 neue, Ziel: 26 gesamt)

| ID | Name (DE) | Rarity | Primär für | WoW-Äquivalent | Beschreibung |
|----|-----------|--------|-----------|----------------|-------------|
| `tierknochen` | Tierknochen | Common | Koch, Schmied | Light Leather / Bone | Grundmaterial für Suppen und Knochenwaffen |
| `silbererz` | Silbererz | Uncommon | Schmied | Silver Bar | Selteneres Erz für bessere Schmiedearbeiten |
| `elementarkern` | Elementarkern | Rare | Alchemist, Verzauberer | Elemental Earth/Fire | Essenz der Elemente für Flasks und Enchants |
| `uralteessenz` | Uralte Essenz | Rare | Verzauberer | Greater Eternal Essence | Für stärkere Enchants (WoW DE analog) |
| `sternstaub` | Sternstaub | Rare | Koch, Alchemist | Dreamfoil/Ghost Mushroom | Seltene Zutat für Endgame-Rezepte |
| `dunklerstaub` | Dunkler Staub | Uncommon | Verzauberer | Soul Dust | Basis-Enchanting-Material |
| `himmelsgarn` | Himmelsgarn | Rare | Schneider | Mooncloth | Seltener Stoff für epische Cloth-Gear |
| `drachenatem` | Drachenatem | Epic | Koch, Alchemist | Black Lotus | Ultra-seltenes Endgame-Material |

### 4.3 Material-Verteilung pro Rarity (Ziel)

| Rarity | Ist | Ziel | Materials |
|--------|-----|------|----------|
| Common | 5 | 6 | +tierknochen |
| Uncommon | 5 | 7 | +silbererz, +dunklerstaub |
| Rare | 3 | 6 | +elementarkern, +uralteessenz, +sternstaub, +himmelsgarn |
| Epic | 3 | 4 | +drachenatem |
| Legendary | 2 | 3 | (seelensplitter, runenstoff + ggf. 1 weiteres wenn nötig) |

### 4.4 Material-Drop-Quellen (WoW-Referenz)

In WoW kamen Materialien aus spezifischen Quellen. Unser System:

| Material-Rarity | Quest-Rarity-Drop | Drop-Rate | Alternative Quelle |
|----------------|-------------------|-----------|-------------------|
| Common | Common/Uncommon Quests | ~60% | Shop (günstig) |
| Uncommon | Uncommon/Rare Quests | ~35% | Shop (mittel) |
| Rare | Rare/Epic Quests | ~20% | Rift, World Boss |
| Epic | Epic/Legendary Quests | ~10% | Rift (Hard+), Dungeons |
| Legendary | Legendary Quests only | ~5% | Rift (Legendary), World Boss |

---

## 5. Rezept-System (WoW-Referenz)

### 5.1 Rezept-JSON-Format (Referenz)

```json
{
  "id": "schmied-uncommon-helm",
  "profession": "schmied",
  "name": "Eisenguss-Helm",
  "desc": "Ein solider Helm aus gehämmertem Eisen.",
  "reqProfLevel": 3,
  "xp": 15,
  "cooldown": 0,
  "source": "trainer",
  "materials": [
    { "id": "eisenerz", "qty": 4 },
    { "id": "silbererz", "qty": 2 }
  ],
  "result": {
    "type": "craft_gear",
    "templateId": "heavy-uncommon-helm"
  },
  "skillUpColors": {
    "orange": 3,
    "yellow": 5,
    "green": 7,
    "gray": 9
  }
}
```

### 5.2 Rezept-Quell-Verteilung (WoW-Referenz)

In WoW Classic kamen Rezepte aus 4 Quellen. Unser Zielverhältnis:

| Quelle | Anteil | Beschreibung | WoW-Äquivalent |
|--------|--------|-------------|----------------|
| **Trainer** | ~50% | Automatisch verfügbar bei Level-Up | Trainer in jeder Stadt |
| **Drop** | ~30% | Zufälliger Drop aus Quests/Rift/Dungeons | World Drop Recipes |
| **Faction** | ~15% | Kaufbar bei Faction-Vendor ab Rep-Tier | Vendor recipes (Thorium Brotherhood etc.) |
| **Special** | ~5% | Events, Achievements, Spezial-Quests | Quest-reward recipes |

### 5.3 Rezept-Verteilung pro Profession (Ziel)

| Profession | Trainer | Drop | Faction | Special | Gesamt |
|-----------|---------|------|---------|---------|--------|
| Schmied | 14 | 9 | 3 | 2 | 28 |
| Schneider | 13 | 8 | 3 | 2 | 26 |
| Alchemist | 12 | 9 | 3 | 2 | 26 |
| Verzauberer | 10 | 8 | 4 | 2 | 24 |
| Koch | 12 | 9 | 3 | 2 | 26 |
| **Gesamt** | **61** | **43** | **16** | **10** | **130** |

---

## 6. Gear-Template-Abdeckung

### 6.1 Fehlende Heavy Gear Templates (Schmied)

Ziel: Volle 6×5 Matrix = 30 Templates (aktuell 15, fehlen 15)

| Slot | Fehlende Rarities |
|------|------------------|
| Helm | Uncommon, Legendary |
| Armor | Legendary |
| Boots | Uncommon, Epic, Legendary |
| Weapon | Uncommon, Rare |
| Shield | Common, Epic, Legendary |
| Amulet | Common, Rare, Epic, Legendary |

### 6.2 Fehlende Cloth Gear Templates (Schneider)

Ziel: Volle 6×5 Matrix = 30 Templates (aktuell 18, fehlen 12)

| Slot | Fehlende Rarities |
|------|------------------|
| Helm | Legendary |
| Armor | (vollständig) |
| Boots | Epic, Legendary |
| Weapon | Uncommon |
| Shield | Common, Uncommon, Rare, Epic, Legendary |
| Amulet | Common, Epic, Legendary |

### 6.3 Template-Naming-Convention

```
{armorType}-{rarity}-{slot}
```
Beispiele: `heavy-uncommon-helm`, `cloth-legendary-boots`, `heavy-common-shield`

Jedes Template folgt den **Affix-Regeln aus CLAUDE.md** (Rarity = Affix Count, Level = Stat Values).

---

## 7. Skill-Up-System (WoW Classic Referenz)

### 7.1 WoW Classic Skill-Up-Farben

In WoW Classic hatte jedes Rezept 4 Schwellenwerte die bestimmten ob ein Skill-Up garantiert war:

| Farbe | Bedeutung | Skill-Up-Chance |
|-------|-----------|----------------|
| **Orange** | Garantierter Skill-Up | 100% |
| **Yellow** | Wahrscheinlicher Skill-Up | ~50-75% |
| **Green** | Seltener Skill-Up | ~15-25% |
| **Gray** | Kein Skill-Up möglich | 0% |

### 7.2 Unsere Umsetzung

Jedes Rezept hat ein `skillUpColors` Objekt das definiert, AB welchem profLevel die Farbe wechselt:

```json
"skillUpColors": {
  "orange": 3,   // Orange bei profLevel 3 (100% XP)
  "yellow": 5,   // Yellow bei profLevel 5 (~75% XP)
  "green": 7,    // Green bei profLevel 7 (~25% XP)
  "gray": 9      // Gray bei profLevel 9 (0 XP)
}
```

**XP-Skalierung nach Farbe:**
| Farbe | XP-Multiplikator | Rezept-Basis-XP |
|-------|-----------------|----------------|
| Orange | 100% | 8–50 XP (nach Rezept) |
| Yellow | 75% | 6–37 XP |
| Green | 25% | 2–12 XP |
| Gray | 0% | 0 XP |

### 7.3 Profession-XP pro Level

| ProfLevel | XP benötigt | Kumulativ | WoW-Equivalent |
|-----------|------------|-----------|----------------|
| 1→2 | 50 | 50 | Apprentice 1-75 |
| 2→3 | 75 | 125 | |
| 3→4 | 100 | 225 | Journeyman 75-150 |
| 4→5 | 150 | 375 | |
| 5→6 | 200 | 575 | Expert 150-225 |
| 6→7 | 275 | 850 | |
| 7→8 | 350 | 1200 | Artisan 225-300 |
| 8→9 | 450 | 1650 | |
| 9→10 | 600 | 2250 | Master |

### 7.4 Skill-Up-Farben-Formel (Faustregel)

Für ein Rezept mit `reqProfLevel = N`:
```
orange = N          (100% bei Lern-Level)
yellow = N + 2      (wird yellow 2 Stufen später)
green  = N + 4      (wird green 4 Stufen später)
gray   = N + 6      (wird gray 6 Stufen später, max 10)
```

Ausnahme: Meister-Rezepte (reqProfLevel 9-10) bleiben länger orange weil es kein höheres Level gibt.

---

## 8. Rezept-Quellen (WoW Classic Referenz)

### 8.1 Trainer-Rezepte

- Automatisch verfügbar wenn `profLevel >= reqProfLevel`
- Kein Kaufpreis, keine Suche nötig
- **WoW-Äquivalent:** Der Berufstrainer in jeder Stadt hatte ~40-50% aller Rezepte

### 8.2 Drop-Rezepte

- Zufälliger Drop bei Quest-Completion, Rift-Runs, Dungeon-Clears
- Drop-Rate skaliert mit Quest/Content-Difficulty
- **WoW-Äquivalent:** World Drop Recipes (z.B. Plans: Arcanite Reaper, Pattern: Truefaith Vestments)

| Content-Source | Drop-Chance für Rezept |
|---------------|----------------------|
| Normal Quest Complete | 3% |
| Rare+ Quest Complete | 5% |
| Rift (Normal) | 8% |
| Rift (Hard) | 12% |
| Rift (Legendary) | 18% |
| Dungeon Clear | 15% |
| World Boss Kill | 10% |

### 8.3 Faction-Rezepte

- Kaufbar bei Faction-Vendor ab bestimmtem Rep-Tier
- **WoW-Äquivalent:** Thorium Brotherhood (Blacksmithing), Timbermaw Hold (Enchanting), Cenarion Circle (Alchemy)

| Rep-Tier Required | Typische Rezept-Rarity | Preis |
|------------------|----------------------|-------|
| Friendly | Uncommon/Rare | 500g |
| Honored | Rare | 1000g |
| Revered | Rare/Epic | 2500g |
| Exalted | Epic/Legendary | 5000g |

### 8.4 Special-Rezepte

- Aus Achievements, limitierten Events, speziellen Quest-Chains
- **WoW-Äquivalent:** Quest Reward Recipes (z.B. Enchant Weapon: Crusader aus Scarlet Monastery)

---

## 9. Cooldown- & Economy-Balance

### 9.1 Craft-Cooldowns (WoW-Referenz)

In WoW Classic hatten mächtige Rezepte Cooldowns:
- Transmute: Arcanite Bar → 48h CD
- Mooncloth → 4 Tage CD
- Saltshaker → 3 Tage CD

**Unsere Cooldowns:**

| Rezept-Kategorie | Cooldown | WoW-Vergleich |
|-----------------|----------|---------------|
| Common/Uncommon Gear | 0 | — |
| Rare Gear | 30 min | — |
| Epic Gear | 2h | — |
| Legendary Gear | 8h | Mooncloth (4d) |
| Transmutationen | 12h | Arcanite (48h) |
| Flasks | 1h | — |
| Enchants (Major+) | 30 min | — |
| Meister-Rezepte | 24h | — |

### 9.2 Material-Kosten-Staffelung

| Gear Rarity | Common Mats | Uncommon Mats | Rare Mats | Epic Mats | Legendary Mats | Gold |
|------------|-------------|---------------|-----------|-----------|---------------|------|
| Common | 3-5 | — | — | — | — | 0 |
| Uncommon | 4-6 | 2-3 | — | — | — | 50 |
| Rare | 5-8 | 3-5 | 1-2 | — | — | 200 |
| Epic | 6-10 | 4-6 | 2-3 | 1 | — | 500 |
| Legendary | 8-12 | 5-8 | 3-5 | 2-3 | 1 | 1500 |

### 9.3 Buff-Stacking-Regeln (Zusammenfassung)

| Buff-Quelle | Stackt mit | Stackt NICHT mit |
|------------|-----------|-----------------|
| **Elixir** (Alchemist) | Food, Enchant, Infusion | Flask, anderer Elixir |
| **Flask** (Alchemist) | Food, Enchant, Infusion | Elixir, anderer Flask |
| **Food** (Koch) | Elixir/Flask, Enchant | anderes Food |
| **Enchant** (Verzauberer) | Alles (permanent auf Gear) | Neuer Enchant desselben Slots |
| **Infusion** (Verzauberer) | Food, Elixir/Flask | andere Infusion |

---

## 10. Offene Lücken & Priorisierte Arbeitspakete

### Priorität 1 — Gear-Template-Lücken schließen (27 neue Templates)

**Warum zuerst:** Ohne Templates können Gear-Craft-Rezepte nicht funktionieren.

| # | Arbeitspaket | Dateien | Aufwand |
|---|-------------|---------|--------|
| 1a | 15 fehlende Heavy Gear Templates | `gearTemplates.json` | Mittel |
| 1b | 12 fehlende Cloth Gear Templates | `gearTemplates.json` | Mittel |

### Priorität 2 — Neue Materialien hinzufügen (8 neue)

| # | Arbeitspaket | Dateien | Aufwand |
|---|-------------|---------|--------|
| 2a | 8 neue Materialien in professions.json | `professions.json` | Klein |
| 2b | Material-Drop-Tabellen in Quests/Rift | `routes/quests.js`, `routes/rift.js` | Mittel |

### Priorität 3 — Fehlende Rezepte erstellen (~55 neue)

| # | Arbeitspaket | Dateien | Aufwand |
|---|-------------|---------|--------|
| 3a | +9 Schmied-Rezepte | `professions.json` | Mittel |
| 3b | +8 Schneider-Rezepte | `professions.json` | Mittel |
| 3c | +12 Alchemist-Rezepte | `professions.json` | Mittel |
| 3d | +12 Verzauberer-Rezepte | `professions.json` | Mittel |
| 3e | +14 Koch-Rezepte | `professions.json` | Groß |

### Priorität 4 — Backend-Logik

| # | Arbeitspaket | Dateien | Aufwand |
|---|-------------|---------|--------|
| 4a | Buff-Stacking-System (nur 1 Elixir/Flask + 1 Food) | `routes/crafting.js`, `lib/helpers.js` | Mittel |
| 4b | Transmutation-Cooldowns | `routes/crafting.js` | Klein |
| 4c | Skill-Up-Farben-Logik (XP-Multiplikator) | `routes/crafting.js` | Klein |
| 4d | Rezept-Drop-System bei Quests/Rift | `routes/quests.js`, `routes/rift.js` | Mittel |
| 4e | Faction-Vendor-Rezepte | `routes/factions.js` | Klein |

### Priorität 5 — Frontend-UI

| # | Arbeitspaket | Dateien | Aufwand |
|---|-------------|---------|--------|
| 5a | Skill-Up-Farben in ForgeView anzeigen | `components/ForgeView.tsx` | Klein |
| 5b | Rezept-Quellen-Indikator (Trainer/Drop/Faction/Special) | `components/ForgeView.tsx` | Klein |
| 5c | Buff-Management-UI (aktive Buffs sehen/entfernen) | `components/ForgeView.tsx` oder eigene Sektion | Mittel |
| 5d | Transmutation-Cooldown-Timer | `components/ForgeView.tsx` | Klein |

---

## 11. Checkliste für neue Rezepte

Vor dem Hinzufügen jedes neuen Rezepts diese Punkte prüfen:

- [ ] `reqProfLevel` passt zum Rang (Novize=1-2, Lehrling=3-4, Geselle=5-6, Experte=7-8, Handwerker=9, Meister=10)
- [ ] `skillUpColors` folgt der Formel: orange=N, yellow=N+2, green=N+4, gray=N+6
- [ ] `xp` ist angemessen (8-15 für einfache, 20-35 für mittlere, 40-50 für Endgame)
- [ ] `materials` nutzen nur existierende Material-IDs aus professions.json
- [ ] Material-Kosten passen zur Rarity-Staffelung (Abschnitt 9.2)
- [ ] `source` ist korrekt (trainer/drop/faction/special)
- [ ] `cooldown` passt zur Kategorie (Abschnitt 9.1)
- [ ] Gear-Rezepte: `templateId` existiert in gearTemplates.json
- [ ] Buff-Rezepte: Effekt-Typ und Dauer sind konsistent mit Stacking-Regeln
- [ ] Transmutationen: Input-Material < Output-Material in Rarity
- [ ] Keine Duplikate (gleicher Output existiert nicht schon)
- [ ] Deutsche Namen im Kingkiller-Chronicle-Ton (siehe LYRA-PLAYBOOK.md)
