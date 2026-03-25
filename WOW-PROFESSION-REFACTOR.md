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

### 2.2 — WoW-Classic-Style Recipe Design

**Kernprinzip:** Jedes Rezept craftet ein **einzigartig benanntes Item** mit eigenem Gear-Template.
Kein "Common Helm → Uncommon Helm" — stattdessen "Eiserne Sturmhaube", "Kristall-Visier", "Drachenzahn-Helm" etc.

**Recipe density per skill bracket (WoW-Classic-treu):**

| Skill Bracket | Rank | Recipes | Items | Mat Tiers |
|--------------|------|---------|-------|-----------|
| 1-75 | Apprentice | 25-35 | ~70% Filler (grün), ~30% Ziel (blau) | T1 (common) |
| 75-150 | Journeyman | 30-40 | ~70% Filler, ~30% Ziel | T1-T2 (common+uncommon) |
| 150-225 | Expert | 35-45 | ~60% Filler, ~40% Ziel (blau/lila) | T2-T3 (uncommon+rare) |
| 225-300 | Artisan | 40-50 | ~50% Filler, ~50% Ziel (lila/legendär) | T3-T5 (rare+epic+legendary) |

**Item-Qualität:**
- **Filler-Items (~70%):** Grüne Qualität (common/uncommon). Feste Stats, kein Affix-Rolling. Existieren primär zum Skill-Up. Handelbar (BoE).
- **Ziel-Items (~30%):** Blaue/Lila Qualität (rare/epic/legendary). Volles Affix-Rolling per CLAUDE.md Regeln. Spieler craften diese gezielt. Handelbar (BoE).

**Naming Convention:** Material-basiert (WoW-Style)
```
Skill 1-75:    Eiserne [Slot]      → "Eiserne Sturmhaube", "Eiserner Brustpanzer"
Skill 75-150:  Kristall-[Slot]     → "Kristall-Visier", "Kristall-Kettenhemd"
Skill 150-225: Drachenschuppen-[Slot] → "Drachenzahn-Helm", "Drachenschuppen-Harnisch"
Skill 225-275: Aether-[Slot]       → "Aetherkern-Krone", "Aether-Prunkrüstung"
Skill 275-300: Seelen-[Slot]       → "Seelenbrecher-Helm", "Seelengeschmiedeter Panzer"
```

#### Schmied (Blacksmith) — ~150 Rezepte

```
Unique Gear Items (~100):
  Jedes ein eigenes benanntes Template mit eigenem Flavor-Text.
  Verteilt über alle 6 Slots (helm, armor, boots, weapon, shield, amulet).
  Skill 1-75:   ~20 Items (Eiserne Serie, einfache Waffen/Rüstungen)
  Skill 75-150:  ~25 Items (Kristall-Serie, verstärkte Platten)
  Skill 150-225: ~25 Items (Drachenschuppen-Serie, Elite-Rüstungen)
  Skill 225-300: ~30 Items (Aether/Seelen-Serie, legendäre Schmiedekunst)

Zwischenprodukte (~15):
  Eisenbarren (3× Eisenerz)
  Kristallbarren (2× Eisenerz + 2× Kristallsplitter)
  Gehärteter Stahl (4× Eisenerz + 1× Kristallsplitter)
  Drachenstahl (3× Kristallsplitter + 2× Drachenschuppe)
  Aetherlegierung (2× Drachenschuppe + 1× Aetherkern)
  Seelenlegierung (2× Aetherkern + 1× Seelensplitter) — 24h CD
  + weitere Zwischen-Legierungen für Skill-Lücken

Utility (~20):
  Schärfsteine (5 Tiers: Grob → Rau → Schwer → Dicht → Elementar)
  Gewichtsteine (4 Tiers)
  Schilddornen (3 Tiers)
  Panzerverstärkungen (3 Tiers)
  Schmiedetemperatur-Rezepte (2 Tiers)
  Streak-Schilde (2 Tiers)

Service (~15):
  Klinge schärfen, Rüstung verstärken, Seltenheit aufwerten
  Waffe temperieren, Schild polieren
  Meisterwerk-Verstärkung (Skill 275+, 24h CD)
```

#### Schneider (Tailor) — ~150 Rezepte

```
Unique Gear Items (~100):
  Skill 1-75:   ~20 Items (Leinen-Serie: Hüte, Roben, Schleier)
  Skill 75-150:  ~25 Items (Woll-Serie: verstärkte Gewänder)
  Skill 150-225: ~25 Items (Seiden-Serie: Mondschein-Roben, Seidenschleier)
  Skill 225-300: ~30 Items (Magie/Runen-Serie: arkane Gewänder)

Zwischenprodukte (~12):
  Leinenballen, Wollballen, Seidenballen, Magiestoff-Ballen, Runenstoff-Ballen
  Sternenlicht-Farbe, Arkaner Faden, Runenfaden
  + weitere Stoffverarbeitungen

Utility (~20):
  Zauberfäden (5 Tiers: +weisheit temp buff)
  Glücksfäden (3 Tiers: +glueck temp buff)
  Konzentrationsfäden (3 Tiers: +fokus temp buff)
  Bezaubernde Fäden (2 Tiers: +charisma temp buff)
  Gewänder der Erleuchtung (2 Tiers: +XP temp buff)

Service (~15+):
  Streak-Schilde, Schmiedetemperatur, Stoffveredelung, Stoffverstärkung
```

#### Lederverarbeiter (Leatherworker) — ~150 Rezepte (komplett neu)

```
Unique Gear Items (~100):
  Skill 1-75:   ~20 Items (Leichtleder-Serie: Kappen, Wämser, Stiefel)
  Skill 75-150:  ~25 Items (Mittleres-Leder-Serie: verstärkte Jagdkleidung)
  Skill 150-225: ~25 Items (Schwerleder-Serie: Jäger-Rüstungen)
  Skill 225-300: ~30 Items (Bestien/Urzeit-Serie: legendäre Pelze)

Zwischenprodukte (~12):
  Geheiltes Leichtleder, Geheiltes Mittleres Leder, Gehärtetes Schwerleder
  Bestien-Lederballen, Urzeitleder-Ballen
  Klauenöl, Salzgerbung, Uraltes Gerbmittel
  + weitere Lederverarbeitungen

Utility (~20):
  Leder-Kits (5 Tiers: +ausdauer temp buff)
  Glücksflicken (3 Tiers: +glueck temp buff)
  Köcher (3 Tiers: +tempo temp buff)
  Gold-Beutel (4 Tiers: +gold% temp buff) — Leder-Spezialität
  Schmiedetemperatur-Rezepte (2 Tiers)

Service (~15+):
  Leder verstärken, Lederveredelung, Streak-Schilde
```

#### Alchemist — ~80-100 Rezepte

```
Potions (~30): 6 Tiers × 5 Buff-Typen (XP/Gold/Luck/Kraft/Weisheit)
  Schwacher → Geringer → Normaler → Großer → Überlegener → Mächtiger Trank

Flasks (~6): Endgame Multi-Buffs (Skill 225+)
  Flakon des Ehrgeizes, des Schicksals, der Weisheit, der Titanen etc.

Transmutes (~12): Material-Tier-Upgrades + Cross-Profession
  Eisen→Kristall, Kristall→Drache, Drache→Aether, Aether→Seele
  Leinen→Wolle, Wolle→Seide, Seide→Magiestoff
  Leicht→Mittel Leder, Mittel→Schwer Leder
  24-48h Cooldowns auf hohe Transmutes

Utility (~15): Gegengift-Tiers, Manaöle, Schattenöle
  Streak-Schilde, Schmiedekatalysatoren

Elixirs (~15): Single-Stat Buffs
```

#### Koch (Cook) — ~80-100 Rezepte

```
Meals (~40): 6 Tiers × Buff-Typen (XP, Gold, Luck, Forge Temp, Combined)
  Einfache Mahlzeit → Deftige Mahlzeit → Feine Mahlzeit → Meistermenü

Drinks (~15): Kurze Stat-Buffs (Tee, Wein, Met)

Feasts (~6): Gruppen-Buffs (Skill 200+)

Snacks (~10): Sofort-Effekte (Studentenfutter, Trockenobst)

Intermediate (~8): Gewürzmischung, Kräuterbutter, Marinaden
  Streak-Schilde, Schmiedetemperatur
```

#### Verzauberer (Enchanter) — ~80-100 Rezepte

```
Temporary Enchants (~25): Stat-Buffs für 24-48h
  6 Tiers pro Stat (Kraft, Weisheit, Ausdauer, Glueck)

Permanent Enchants (~15): +Stat permanent auf Gear-Slot
  Pro Slot pro Tier (weapon/armor/boots/helm/shield/amulet)

Wards/Glyphs (~15): Quest-Dauer-Buffs (Schutz, Tempo, Macht)

Scrolls (~15): Handelbare Buff-Items (Schriftrolle der Kraft etc.)

Oils (~10): Waffen-/Rüstungs-Beschichtungen
  Brillantes Öl (+weisheit), Wildes Öl (+kraft) etc.
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

### 2.6 — Gear Template Structure (WoW-Classic-Style)

**Kernprinzip:** Jedes Rezept erzeugt ein **eigenes, einzigartig benanntes Gear-Template**.
Keine generischen "Tier × Slot × Rarity"-Matrizen mehr.

**Pro Gear-Profession (Schmied, Schneider, Lederverarbeiter):**

| Skill-Bereich | Anzahl Items | Typische Rarity | Affix-System |
|--------------|-------------|-----------------|--------------|
| 1-75 | ~20 | common/uncommon | Feste Stats (kein Rolling) |
| 75-150 | ~25 | uncommon/rare | Feste Stats / teilweise Rolling |
| 150-225 | ~25 | rare/epic | Mix (Filler fest, Ziel-Items Rolling) |
| 225-300 | ~30 | epic/legendary | Überwiegend Affix-Rolling |

= ~100 unique gear templates per profession × 3 gear professions = **~300 gear templates**
Plus Utility/Intermediate = **~450 Rezepte total** für die 3 Gear-Professions.

**Filler-Items (feste Stats):**
```json
{
  "id": "craft-schmied-eiserne-sturmhaube",
  "name": "Eiserne Sturmhaube",
  "slot": "helm",
  "rarity": "common",
  "armorType": "heavy",
  "fixedStats": { "kraft": 2, "ausdauer": 1 },
  "reqLevel": 1,
  "tier": 1,
  "setId": "adventurer",
  "flavorText": "Schwer, aber zuverlässig."
}
```

**Ziel-Items (Affix-Rolling per CLAUDE.md):**
```json
{
  "id": "craft-schmied-drachenzahn-helm",
  "name": "Drachenzahn-Helm",
  "slot": "helm",
  "rarity": "rare",
  "armorType": "heavy",
  "affixes": {
    "primary": { "count": [2, 2], "pool": [{ "stat": "kraft", "min": 3, "max": 6 }, ...] },
    "minor": { "count": [1, 1], "pool": [{ "stat": "vitalitaet", "min": 2, "max": 4 }, ...] }
  },
  "reqLevel": 17,
  "tier": 3,
  "setId": "master",
  "flavorText": "Er brennt nicht. Aber wer ihn trägt, fühlt die Hitze."
}
```

**Armor-Type Traits (Passive Boni pro ausgerüstetem Teil):**
- Heavy: `eiserne_haut` — +1 Ausdauer pro Teil
- Cloth: `arkanes_weben` — +1% XP pro Teil
- Leather: `geschmeidige_haut` — +1% Gold pro Teil

---

## Design-Entscheidungen (Final)

Diese Entscheidungen sind verbindlich für alle zukünftigen Implementierungs-Sessions.

| Thema | Entscheidung | Begründung |
|-------|-------------|------------|
| Professions | 6 total: Schmied, Schneider, Lederverarbeiter (neu), Alchemist, Koch, Verzauberer | WoW Classic hat mehr, aber 6 passt zu unserem 2-Slot-System |
| Profession-Slots | Fix 2 pro Spieler | Zwingt Spieler zum Traden und spezialisieren |
| Equipment-Slots | 6 bestehende: helm, armor, boots, weapon, shield, amulet | Keine Erweiterung nötig |
| Spezialisierungen | Keine | Weniger Komplexität, alle Rezepte für jeden zugänglich |
| Rezeptdichte Gear-Prof | ~150 pro Profession (WoW-treu) | Genug Filler für flüssiges 1-300 Leveln |
| Rezeptdichte Consumable-Prof | ~80-100 pro Profession | Consumables brauchen weniger Variety |
| Item-Templates | Jedes Rezept = eigenes unique benanntes Template | WoW-Classic-treu: "Eiserne Sturmhaube", nicht "Common Helm" |
| Naming Convention | Material-basiert (Eisen→Kristall→Drachen→Aether→Seelen) | Wie WoW: Kupfer→Bronze→Eisen→Mithril→Thorium |
| Filler vs Ziel-Items | ~70% Filler (feste Stats), ~30% Ziel-Items (Affix-Rolling) | Filler zum Skillen, Ziel-Items als Motivation |
| Zwischenprodukte | Ja (Barren, Ballen, Gehärtetes Leder) | WoW-treu: Rohmaterial → Verarbeitung → Item |
| BoE | Alles handelbar | Wirtschaft und Trading fördern |
| Crafted Sets | Später (Backlog) | Erstmal Basis-System fertig |
| Material-Abhängigkeiten | Material-Spezialisierung (eigene Mats höhere Drop-Rate) | Zwingt zum Cross-Profession-Trading |
| Profession-Perks | Nur über Items/Rezepte (keine Sonder-Abilities) | Einfacher, konsistenter |
| Grind-Länge | Sehr lang (WoW-treu, Wochen für 1-300) | Langzeit-Motivation |
| Rezept-Quellen | WoW-Verteilung: 40% Trainer / 30% Drop / 20% Faction / 10% Dungeon | Exploration und Progression belohnen |
| Implementierung | Eine Profession pro Session | Gründlich, jede Profession wird perfekt |
| Bestehende Daten | Clean Slate (alles Neue von Phase 2 löschen, Phase 1 behalten) | Sauberer Neustart mit richtigem WoW-Ansatz |

---

## Implementation Order

### Session 0: Clean Slate ✅
- Keine Phase-2 Rezepte/Templates vorhanden (waren nie erstellt)
- Lederverarbeiter-Profession-Definition + Materialien korrekt
- Backend-Änderungen korrekt (reqSkill-Support, meetsSkillReq(), leather_stat_boost)
- ForgeView-Änderungen korrekt (NPC_LOCATIONS, SYNERGY_HINTS)

### Session 1: Schmied ✅ (2026-03-25)
- 100 unique benannte Heavy-Gear-Templates (T1:20, T2:25, T3:25, T4:30)
- 10 Zwischenprodukt-Rezepte (Eisenbarren → Seelenstahl)
- 100 Gear-Rezepte (1 pro Template, reqSkill 1-298)
- 19 Utility-Rezepte (Schärfsteine 5T, Gewichtsteine 4T, Schilddornen 3T, Panzerverstärkungen 3T, Streak-Schilde 2T, Forge-Temp 2T)
- 15 Service-Rezepte (Klinge schärfen 5T, Rüstung verstärken 4T, Schild polieren 3T, Amulett segnen 3T)
- Source: 84 Trainer / 40 Drop / 21 Faction
- 10 Intermediate Materials (eisenbarren bis seelenstahl)

### Session 2: Schneider (~150 Rezepte + ~100 Gear-Templates)
- ~100 unique benannte Cloth-Gear-Templates erstellen
- ~12 Zwischenprodukte (Stoff-Ballen-Chain)
- ~100 Gear-Rezepte
- ~20 Utility-Rezepte (Zauberfäden, Glücksfäden etc.)
- ~15 Service-Rezepte
- Balance-Check

### Session 3: Lederverarbeiter (~150 Rezepte + ~100 Gear-Templates)
- ~100 unique benannte Leather-Gear-Templates erstellen
- ~12 Zwischenprodukte (Leder-Verarbeitungs-Chain)
- ~100 Gear-Rezepte
- ~20 Utility-Rezepte (Leder-Kits, Köcher, Gold-Beutel)
- ~15 Service-Rezepte
- Balance-Check

### Session 4: Alchemist (~80-100 Rezepte)
- ~30 Potions (6 Tiers × 5 Buff-Typen)
- ~6 Flasks (Endgame Multi-Buffs)
- ~12 Transmutes (Material-Upgrades + Cross-Profession)
- ~15 Elixirs (Single-Stat Buffs)
- ~15 Utility (Gegengifte, Öle, Streak-Schilde)
- Balance-Check

### Session 5: Koch (~80-100 Rezepte)
- ~40 Meals (6 Tiers × Buff-Typen)
- ~15 Drinks (Tee, Wein, Met)
- ~6 Feasts (Gruppen-Buffs)
- ~10 Snacks (Sofort-Effekte)
- ~8 Intermediate (Gewürze, Marinaden)
- Balance-Check

### Session 6: Verzauberer (~80-100 Rezepte)
- ~25 Temporary Enchants
- ~15 Permanent Enchants
- ~15 Wards/Glyphs
- ~15 Scrolls
- ~10 Oils
- Balance-Check

### Session 7: Final Balance Pass + Frontend
- Gesamter Balance-Audit über alle 6 Professions
- Frontend-Anpassungen (BoE-Badge, neue Rezepttypen-Display)
- CLAUDE.md updaten (neues Profession-System dokumentieren)
- Material-Spezialisierung Gathering-Raten finalisieren

---

## Quick Reference: Files to Modify

| File | Changes |
|------|---------|
| `professions.json` | +5 materials (done), +1 profession (done), +~750 recipes, adjusted drop rates |
| `gearTemplates.json` | +~300 new unique gear templates (replace generic ones) |
| `crafting.js` | reqSkill support (done), `fixedStats` handling for Filler-Items (new) |
| `ForgeView.tsx` | NPC_LOCATIONS + SYNERGY_HINTS (done), BoE badge (Session 7) |
| `lib/helpers.js` | leather armor trait (done), possible `fixedStats` gear instance creation |
| `CLAUDE.md` | Update profession count, skill system docs (Session 7) |
