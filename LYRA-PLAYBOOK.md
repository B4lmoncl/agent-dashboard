# Lyra Playbook — Content Creation Guide

> Mechanisches Handbuch für LLMs, die neuen Content (NPCs, Quests, Items, Gear etc.) ins System einspeisen. Dieses Dokument beschreibt WO und WIE — nicht WAS. Den Content selbst bestimmst du.

## Goldene Regeln

1. **Nur JSON-Dateien in `public/data/` editieren** — niemals `data/` (Runtime-Daten der User)
2. **IDs müssen einzigartig sein** — kebab-case, keine Leerzeichen: `mein-neuer-npc`
3. **Bilder unter `public/images/`** ablegen, Pfad als `/images/...` referenzieren
4. **Nach Änderungen**: Server-Neustart nötig (Templates werden beim Boot geladen)
5. **Validierung**: `node scripts/verify-items.js` prüft Item-Referenzen
6. **Quest-Lookup im Code**: Immer `state.questsById.get(id)` statt `state.quests.find()` — und nach `state.quests.push(q)` immer `state.questsById.set(q.id, q)` aufrufen
7. **User-Lookup im Code**: Immer `state.usersByName.get(name)` statt `Object.values(state.users).find()`

---

## 1. Neuen NPC erstellen

**Datei**: `public/data/npcQuestGivers.json`
**Array**: `givers[]`

### Schema

```json
{
  "id": "dein-npc-id",
  "portrait": "/images/npcs/dein-npc.png",
  "name": "NPC Name",
  "emoji": null,
  "title": "Der Titel",
  "description": "Kurze Beschreibung des NPCs.",
  "rarity": "common",
  "spawnWeight": 50,
  "cooldownHours": 48,
  "cooldownDays": 14,
  "departureDurationHours": 72,
  "stayDays": 3,
  "maxChainsPerVisit": 1,
  "greeting": "Begrüßungstext wenn der NPC erscheint...",
  "questChains": [
    [
      {
        "template": "npc-quest",
        "title": "Quest Titel Chain 1, Teil 1",
        "type": "social",
        "priority": "medium",
        "lore": "Quest von NPC Name · Kette 1/1 · 1/2",
        "rewards": { "xp": 25, "gold": 10 },
        "vars": {
          "quote": "Flavor-Text des NPCs",
          "task": "Was der Spieler tun soll",
          "realWorldTask": "Reale Aufgabe dahinter",
          "difficulty": "medium"
        }
      },
      {
        "template": "npc-quest",
        "title": "Quest Titel Chain 1, Teil 2",
        "type": "social",
        "priority": "medium",
        "lore": "Quest von NPC Name · Kette 1/1 · 2/2",
        "rewards": { "xp": 35, "gold": 15 },
        "vars": {
          "quote": "Flavor-Text Teil 2",
          "task": "Aufgabe Teil 2",
          "realWorldTask": "Reale Aufgabe Teil 2",
          "difficulty": "medium"
        }
      }
    ]
  ]
}
```

### Felder erklärt

| Feld | Beschreibung | Gültige Werte |
|------|-------------|---------------|
| `rarity` | Wie selten der NPC erscheint | `common`, `uncommon`, `rare`, `epic`, `legendary` |
| `spawnWeight` | Gewichtung im Rotationssystem | 10-100 (höher = häufiger) |
| `cooldownDays` | Tage bevor NPC wieder spawnen kann | 7-30 |
| `stayDays` | Wie lange der NPC bleibt | 1-7 |
| `maxChainsPerVisit` | Wie viele Quest-Ketten pro Besuch | 1-3 |
| `questChains` | Array von Arrays — jedes innere Array ist eine Quest-Kette | Quests werden sequenziell freigeschaltet |
| `type` | Quest-Typ | `development`, `personal`, `learning`, `fitness`, `social`, `boss` |
| `priority` | Schwierigkeit & Belohnung | `low`, `medium`, `high` |

### Portrait

- Lege das Bild unter `public/images/npcs/dein-npc.png` ab
- Empfohlene Größe: 128×128px oder 256×256px
- Transparenter Hintergrund (PNG)

### Permanente NPCs

Für NPCs die nie verschwinden sollen, trage die ID zusätzlich in `lib/state.js` → `NPC_PERMANENT_IDS` ein. Normalerweise nicht nötig.

---

## 2. Quest-Templates erstellen

**Datei**: `public/data/questCatalog.json`
**Array**: `templates[]`

### Schema

```json
{
  "id": "p-dein-quest-id",
  "template": "board-quest",
  "title": "Quest Titel",
  "type": "personal",
  "category": "personal",
  "vars": {
    "description": "Was der Spieler tun soll",
    "flavor": "Flavor-Text / Lore",
    "difficulty": "medium"
  },
  "rewards": { "xp": 25, "gold": 15 }
}
```

### ID-Konventionen

- `p-*` = Personal Quest
- `d-*` = Development Quest
- `l-*` = Learning Quest
- `f-*` = Fitness Quest
- `s-*` = Social Quest

### Categories (für Katalog-Filter)

`generic`, `classQuest`, `chainQuest`, `companionQuest`

### Template-Typen (template-Feld)

| Template | Verwendung |
|----------|------------|
| `board-quest` | Standard Quest-Board Quest |
| `npc-quest` | NPC-generierte Quest |
| `class-quest` | Klassen-spezifische Quest |
| `companion-quest` | Companion-Pflege-Quest |

---

## 3. Gear / Equipment erstellen (Diablo-3-Style Affix Rolling)

**Datei**: `public/data/gearTemplates.json`
**Array**: `items[]`

Items haben **keine festen Stats** mehr. Stattdessen definiert jedes Item einen **Affix-Pool** mit Ranges. Beim Droppen/Kaufen werden Stats zufällig gerollt — wie bei Diablo 3.

### Schema

```json
{
  "id": "t2-neues-schwert",
  "name": "Feuerschwert",
  "slot": "weapon",
  "tier": 2,
  "reqLevel": 9,
  "rarity": "rare",
  "price": 300,
  "desc": "Ein Schwert, das in Flammen gehüllt ist.",
  "affixes": {
    "primary": {
      "count": [2, 3],
      "pool": [
        { "stat": "kraft", "min": 3, "max": 6 },
        { "stat": "weisheit", "min": 2, "max": 4 },
        { "stat": "ausdauer", "min": 2, "max": 4 }
      ]
    },
    "minor": {
      "count": [1, 1],
      "pool": [
        { "stat": "fokus", "min": 1, "max": 3 },
        { "stat": "tempo", "min": 1, "max": 3 }
      ]
    }
  }
}
```

**Wie es funktioniert:**
1. `count: [min, max]` — Wie viele Affixes aus dem Pool gerollt werden
2. `pool` — Welche Stats möglich sind, mit min/max Range pro Stat
3. Es werden `count` zufällige Stats aus dem Pool gewählt (keine Duplikate)
4. Jeder Stat rollt einen Wert zwischen `min` und `max`
5. Ein "Godroll" = maximale Anzahl Affixes + alle auf Max-Wert

### Affix-Counts nach Rarity

| Rarity | Primary Affixes | Minor Affixes |
|--------|----------------|---------------|
| common | 1 | 0 |
| uncommon | 1-2 | 0-1 |
| rare | 2-3 | 1 |
| epic | 2-3 | 1-2 |
| legendary | 3-4 | 1-2 + Legendary Effect |

### Stat-Ranges nach Tier

| Tier | Primary Range | Minor Range |
|------|--------------|-------------|
| T1 (Abenteurer) | 1-3 | 1-2 |
| T2 (Veteranen) | 2-6 | 1-3 |
| T3 (Meister) | 4-10 | 2-4 |
| T4 (Legendär) | 6-15 | 2-5 |

### Slots & empfohlene Affix-Pools

| Slot | Primary Pool (Hauptstat zuerst) | Minor Pool |
|------|-------------------------------|-----------|
| weapon | kraft, weisheit, ausdauer | fokus, tempo |
| shield | ausdauer, kraft, weisheit | vitalitaet, tempo |
| helm | weisheit, glueck, kraft | fokus, charisma |
| armor | ausdauer, kraft, weisheit | vitalitaet, tempo |
| amulet | glueck, weisheit, ausdauer | charisma, fokus |
| boots | glueck, kraft, ausdauer | tempo, charisma |

### Primary Stats (Haupt-Power)

| Stat | Effekt | Bonus pro Punkt |
|------|--------|----------------|
| `kraft` | Quest-XP Multiplikator | +0.5% |
| `ausdauer` | Forge-Decay Reduktion | -0.5% |
| `weisheit` | Gold-Multiplikator | +0.5% |
| `glueck` | Loot-Drop-Chance | +0.5% |

### Minor Stats (Sekundär-Utility)

| Stat | Effekt | Bonus pro Punkt |
|------|--------|----------------|
| `fokus` | Flat Bonus-XP pro Quest | +1 XP |
| `vitalitaet` | Streak-Schutz-Chance | +1% |
| `charisma` | Companion Bond-XP | +5% |
| `tempo` | Forge-Temp Recovery | +1 Temp |

### Tiers

| Tier | Name | Level-Range |
|------|------|-------------|
| 1 | Abenteurer | 1-8 |
| 2 | Veteranen | 9-16 |
| 3 | Meister | 17-24 |
| 4 | Legendär | 25-30 |

### Set-Boni

Set-Boni werden in `gearTemplates.json` → `namedSets` definiert.

### Legendary Effects (mit Ranges)

Legendäre Items haben ein `legendaryEffect` mit min/max Range. Der Wert wird beim Droppen gerollt.

```json
{
  "legendaryEffect": {
    "type": "xp_bonus",
    "min": 2,
    "max": 5,
    "label": "Flamme der Erkenntnis: +{value}% Quest-XP"
  }
}
```

**`{value}` im Label wird durch den gerollten Wert ersetzt.**

Für feste Effekte (z.B. streak_protection) verwende `"value": 1` ohne min/max.

**Verfügbare Effekt-Typen:**

| Type | Range | Wirkung |
|------|-------|---------|
| `xp_bonus` | 2-8% | Multipliziert Quest-XP |
| `gold_bonus` | 2-7% | Multipliziert Gold-Rewards |
| `drop_bonus` | 1-4% | Addiert Drop-Chance |
| `decay_reduction` | 8-12% | Reduziert Forge-Decay |
| `streak_protection` | 1 (fix) | Streak-Schilde pro Woche |

---

## 3b. Titel erstellen

**Datei**: `public/data/titles.json`
**Array**: `titles[]`

### Schema

```json
{
  "id": "unique-title-id",
  "name": "Der Unaufhaltsame",
  "description": "30-Tage-Streak erreicht.",
  "rarity": "rare",
  "condition": { "type": "streak", "value": 30 }
}
```

### Condition Types

| Type | Value | Prüfung |
|------|-------|---------|
| `level` | Zahl | Player-Level >= value |
| `quests_completed` | Zahl | Abgeschlossene Quests >= value |
| `streak` | Zahl | Aktiver Streak >= value |
| `inventory_count` | Zahl | Items im Inventar >= value |
| `gold` | Zahl | Gold-Balance >= value |
| `npc_chains` | Zahl | Abgeschlossene NPC-Quests >= value |
| `forge_temp` | Zahl | Forge-Temperatur >= value |
| `gacha_legendary` | Zahl | Legendäre Gacha-Pulls >= value |
| `full_equipment` | 1 | Alle 6 Slots gefüllt |

Titel werden automatisch bei Quest-Abschluss geprüft und vergeben. Spieler können sie im Character-Screen auswählen.

---

## 4. Gacha-Pool Items erstellen

**Datei**: `public/data/gachaPool.json`
**Array**: `standardPool[]`

### Schema

```json
{
  "id": "neues-gacha-item",
  "name": "Mondlicht-Amulett",
  "rarity": "epic",
  "type": "armor",
  "emoji": null,
  "stats": { "weisheit": 10, "glueck": 5 },
  "effect": "gold_boost_10",
  "desc": "Ein Amulett, das im Mondlicht schimmert.",
  "icon": "/images/icons/gacha-mondlicht-amulett.png"
}
```

### Effekte (effect-Feld)

| Effekt | Beschreibung |
|--------|-------------|
| `xp_boost_10` | +10% XP für 3 Quests |
| `gold_boost_10` | +10% Gold für 3 Quests |
| `streak_recovery_100` | Streak wird bei Verfehlung zu 100% wiederhergestellt |
| `forge_temp_boost` | Forge-Temperatur +10 |
| `bond_boost` | Companion-Bond +5 XP |

### Drop-Raten (vom Banner bestimmt)

| Rarity | Standard-Rate |
|--------|---------------|
| legendary | 1.6% |
| epic | 13% |
| rare | 35% |
| uncommon | 40% |
| common | 10.4% |

---

## 5. Gacha-Banner erstellen

**Datei**: `public/data/bannerTemplates.json`
**Root**: Array `[]`

### Schema

```json
{
  "id": "neuer-banner",
  "name": "Banner Name",
  "type": "featured",
  "currency": "runensplitter",
  "costSingle": 10,
  "cost10": 90,
  "featuredItems": ["id-des-featured-items"],
  "active": true,
  "icon": "/images/icons/banner-icon.png",
  "lore": "Flavor-Text zum Banner.",
  "dropRates": {
    "legendary": "1.6%",
    "epic": "13%",
    "rare": "35%",
    "uncommon": "40%",
    "common": "10.4%"
  }
}
```

### Banner-Typen

| Type | Beschreibung |
|------|-------------|
| `standard` | Permanenter Standard-Banner |
| `featured` | Zeitlich begrenzter Feature-Banner mit erhöhter Rate für bestimmte Items |

### Featured Items

Items in `featuredItems[]` haben eine erhöhte Drop-Chance wenn Legendary/Epic gerollt wird. Die IDs müssen in `gachaPool.json` → `standardPool` existieren.

---

## 6. Consumable Items (Shop/Loot) erstellen

**Datei**: `public/data/itemTemplates.json`
**Array**: `items[]`

### Schema

```json
{
  "id": "neues-consumable",
  "name": "Heiltrank",
  "cost": 50,
  "icon": "/images/icons/shop-heiltrank.png",
  "desc": "Stellt etwas wieder her."
}
```

### Effekt-Handling

Item-Effekte werden in `routes/habits-inventory.js` im Switch-Statement behandelt. Um einen neuen Effekt hinzuzufügen:

1. Item in `itemTemplates.json` anlegen
2. Effekt-Case in `routes/habits-inventory.js` ab Zeile ~134 hinzufügen:

```js
case 'dein_neuer_effekt':
  // Effekt-Logik hier
  effectMsg = 'Beschreibung was passiert ist';
  break;
```

**Achtung**: Das ist aktuell der einzige Content-Typ der eine Code-Änderung erfordert.

---

## 7. Loot-Table Einträge erstellen

**Datei**: `public/data/lootTables.json`
**Objekt**: `{ common: [], uncommon: [], rare: [], epic: [], legendary: [] }`

### Schema

```json
{
  "id": "neuer-loot",
  "templateId": "neuer-loot",
  "name": "Glücksstein",
  "emoji": null,
  "minLevel": 1,
  "effect": {
    "type": "gold",
    "amount": 25
  }
}
```

### Effekt-Typen für Loot

| Type | Zusätzliche Felder | Beschreibung |
|------|-------------------|-------------|
| `gold` | `amount` | Gold-Belohnung |
| `xp` | `amount` | XP-Belohnung |
| `bond` | `amount` | Companion-Bond XP |
| `forge_temp` | `amount` | Forge-Temperatur |
| `xp_boost` | `amount`, `duration` | XP-Boost für X Tasks |
| `streak_shield` | — | Schützt Streak bei Verfehlung |
| `random_gear` | — | Zufälliges Gear-Item |
| `random_gear_epic` | — | Zufälliges Epic Gear |
| `named_gear` | `gearId` | Spezifisches Gear-Item |
| `cosmetic` | `cosmetic` | Kosmetisches Item |
| `title` | `title` | Titel-Unlock |
| `companion_egg` | — | Companion-Ei |

### In welchen Rarity-Pool?

| Pool | Drop-Kontext |
|------|-------------|
| `common` | Basis-Belohnungen, häufige Drops |
| `uncommon` | Leicht bessere Drops |
| `rare` | Seltene, wertvolle Drops |
| `epic` | Sehr seltene, mächtige Drops |
| `legendary` | Ultra-selten, game-changing |

---

## 8. Achievements erstellen

**Datei**: `public/data/achievementTemplates.json`
**Array**: `achievements[]`

### Schema

```json
{
  "id": "neues-achievement",
  "name": "Achievement Name",
  "description": "Was der Spieler tun muss",
  "icon": "/images/icons/ach-neues.png",
  "condition": { "type": "quests_completed", "count": 10 },
  "rewards": { "xp": 50, "gold": 25 },
  "rarity": "rare",
  "points": 25,
  "category": "milestone",
  "hidden": false
}
```

**WICHTIG:** Das `points`-Feld bestimmt, wie viele Achievement-Punkte vergeben werden. Standard nach Rarity: common=5, uncommon=10, rare=25, epic=50, legendary=100. Punkte sammeln sich und schalten kosmetische Rahmen + Titel frei (definiert in `pointMilestones` am Ende der Datei).

### Automatisch geprüfte Conditions

Achievements werden **rein datengetrieben** geprüft — die `condition` im JSON reicht aus, es muss kein Code geändert werden. Verfügbare Condition-Types:

| Condition Type | Felder | Beispiel |
|---------------|--------|----------|
| `quests_completed` | `count` | `{ "type": "quests_completed", "count": 50 }` |
| `streak_days` | `count` | `{ "type": "streak_days", "count": 30 }` |
| `xp_threshold` | `count` | `{ "type": "xp_threshold", "count": 500 }` |
| `gold_threshold` | `count` | `{ "type": "gold_threshold", "count": 1000 }` |
| `quests_today` | `count` | `{ "type": "quests_today", "count": 3 }` |
| `completed_types` | `count` | `{ "type": "completed_types", "count": 5 }` |
| `boss_defeated` | — | `{ "type": "boss_defeated" }` |
| `quest_type_count` | `questType`, `count` | `{ "type": "quest_type_count", "questType": "learning", "count": 10 }` |
| `challenge_completed` | `challengeId` | `{ "type": "challenge_completed", "challengeId": "code_sprint" }` |
| `inventory_count` | `count` | `{ "type": "inventory_count", "count": 20 }` |
| `gacha_pulls` | `count` | `{ "type": "gacha_pulls", "count": 10 }` |
| `all_agents_online` | `count` | `{ "type": "all_agents_online", "count": 3 }` |

Neue Achievements können direkt in `achievementTemplates.json` hinzugefügt werden — kein Code nötig.

---

## 9. Klassen erstellen

**Datei**: `public/data/classes.json` (wird beim Boot nach `data/classes.json` kopiert)
**Array**: `classes[]`

### Schema

```json
{
  "id": "neue-klasse",
  "name": "Path of the ...",
  "icon": null,
  "fantasy": "Fantasy-Name",
  "description": "Was diese Klasse ausmacht",
  "realWorld": "Reales Berufsfeld",
  "tiers": [
    { "level": 1,  "title": "Stufe 1", "minXp": 0 },
    { "level": 5,  "title": "Stufe 2", "minXp": 500 },
    { "level": 10, "title": "Stufe 3", "minXp": 1500 },
    { "level": 15, "title": "Stufe 4", "minXp": 3500 },
    { "level": 20, "title": "Stufe 5", "minXp": 7000 },
    { "level": 25, "title": "Stufe 6", "minXp": 12000 }
  ],
  "skillTree": [
    { "id": "skill-1", "name": "Skill Name", "icon": null, "maxLevel": 5 }
  ],
  "achievements": [
    { "id": "klasse-ach-1", "name": "Achievement", "icon": null, "hidden": false, "desc": "Beschreibung" }
  ],
  "status": "active",
  "createdBy": "lyra",
  "createdAt": "2026-03-18T12:00:00Z",
  "playerCount": 0
}
```

---

## 10. Companion-Quests hinzufügen

**Datei**: `public/data/companionProfiles.json`
**Objekte**: `real_pet`, `dobbie`, `dragon`

### Quest innerhalb eines Profils

```json
{
  "id": "neue-companion-quest",
  "title": "{name} verwöhnen",
  "description": "Tu etwas Nettes für deinen Companion.",
  "priority": "medium"
}
```

`{name}` wird zur Laufzeit durch den Companion-Namen ersetzt.

---

## 11. Crafting-Rezepte & Materialien erstellen

**Datei**: `public/data/professions.json`

### Profession-NPCs

3 Berufe mit je eigenem NPC:
- **Schmied** (Thorin): Gear-Stats rerolln, Rarität upgraden
- **Alchemist** (Mirael): Buff-Tränke brauen (XP, Gold, Glück, Streak-Shield)
- **Verzauberer** (Eldric): Gear-Enchants (temporär + permanent)

### Neues Material hinzufügen

In `professions.json → materials[]`:

```json
{
  "id": "neues-material",
  "name": "Neues Material",
  "icon": "/images/icons/mat-neues.png",
  "rarity": "rare",
  "desc": "Beschreibung des Materials."
}
```

Dann in `materialDropRates` die Drop-Chance pro Quest-Rarity eintragen:
```json
"materialDropRates": {
  "rare": { "neues-material": 0.15 }
}
```

### Neues Rezept hinzufügen

In `professions.json → recipes[]`:

```json
{
  "id": "neues-rezept",
  "profession": "alchemist",
  "name": "Neuer Trank",
  "desc": "Effekt-Beschreibung",
  "reqProfLevel": 3,
  "cost": { "gold": 100 },
  "materials": { "kraeuterbuendel": 2, "neues-material": 1 },
  "result": { "type": "buff", "buffType": "xp_boost_10", "duration": "3_quests" },
  "cooldownMinutes": 0
}
```

**WICHTIG:** Neue Rezept-IDs mit neuen Effekten brauchen Code-Änderungen im `switch` in `routes/crafting.js`.

### Profession-Level

Jede Profession hat 10 Level mit steigenden XP-Schwellen (definiert in `levelThresholds`). +10 XP pro Craft.

---

## Checkliste für neuen Content

- [ ] ID ist einzigartig (prüfe mit `grep -r "deine-id" public/data/`)
- [ ] Rarity ist gültig: `common`, `uncommon`, `rare`, `epic`, `legendary`
- [ ] Bild existiert unter dem referenzierten Pfad
- [ ] JSON ist valide (teste mit `node -e "JSON.parse(require('fs').readFileSync('public/data/DATEI.json'))"`)
- [ ] `node scripts/verify-items.js` läuft ohne Fehler
- [ ] Server startet ohne Fehler nach der Änderung

## Dateien-Übersicht

| Was | Datei | Braucht Code-Änderung? |
|-----|-------|----------------------|
| NPCs | `public/data/npcQuestGivers.json` | Nein |
| Quest-Templates | `public/data/questCatalog.json` | Nein |
| Gear/Equipment | `public/data/gearTemplates.json` | Nein |
| Titel | `public/data/titles.json` | Nein |
| Gacha-Items | `public/data/gachaPool.json` | Nein |
| Gacha-Banner | `public/data/bannerTemplates.json` | Nein |
| Consumables | `public/data/itemTemplates.json` | Ja (Effekt in habits-inventory.js) |
| Loot-Tables | `public/data/lootTables.json` | Nein |
| Achievements | `public/data/achievementTemplates.json` | Ggf. Trigger in state.js |
| Klassen | `public/data/classes.json` | Nein |
| Companions | `public/data/companionProfiles.json` | Nein |
| Crafting/Berufe | `public/data/professions.json` | Nur für neue Rezept-Effekte |
