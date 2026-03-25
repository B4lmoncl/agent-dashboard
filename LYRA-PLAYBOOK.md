# Lyra Playbook — Content Creation Guide & Lore Bible

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

## 0. Tone & Voice Guide — Pflichtlektüre vor jedem Content

**Primäre Tone-Quellen (in Prioritätsreihenfolge):**

1. **Skulduggery Pleasant** — DIE Kern-Stimme für Quest Hall. Trockener Humor in jeder Situation. Eleganz als Waffe. Selbstbewusstsein das so absurd ist, dass es schon wieder charmant wird. "Die beste Verteidigung ist ein gut sitzender Anzug und eine schnelle Zunge." Flavor-Text soll klingen, als würde ein unsterbliches Skelett im Maßanzug es dir erzählen — mit einem Grinsen, das man nicht sehen kann. Kampf und Gefahr? Kommentiert mit der Gelassenheit eines Mannes, der schon alles überlebt hat (wortwörtlich).
2. **Königsmörder-Chronik (Rothfuss)** — Poetisch aber nie kitschig. Musik und Worte haben Gewicht. Beschreibungen die sich anfühlen wie ein perfekt gesprochener Satz in einem leisen Raum.
3. **Stormlight Archive (Sanderson)** — "Reise vor Ziel." Syl-Energie: neugierig, leicht, überraschend tiefgründig. Die Ideale durchziehen alles, immer paraphrasiert, nie direkt zitiert.
4. **Scheibenwelt (Pratchett)** — Fußnoten-Energie. Die Art, wie die Welt sich selbst kommentiert. Absurdes wird mit akademischer Ernsthaftigkeit behandelt.
5. **Critical Role / Dungeons and Daddies** — Tischgefühl. Momente die sich anfühlen wie ein perfekter Würfelwurf oder ein Spieler der etwas Unerwartetes tut.

**Die Mischung macht's:**
- Ein NPC-Zitat: Skulduggery-trocken + Rothfuss-poetisch
- Ein Checkpoint-Flavor: Stormlight-atmosphärisch + Pratchett-Fußnote
- Ein Item-Desc: Skulduggery-Eleganz + Kingkiller-Wortwahl
- **Durchrotieren** — nie nur eine Quelle pro Text. Leon kennt alle Werke, also muss es clever sein.

**Anti-Pattern:**
- KEIN Herr-der-Ringe-Pathos (zu pompös)
- KEIN Marvel-Quip-Humor (zu oberflächlich)
- KEINE direkten Zitate (paraphrasieren/channeln)
- NIEMALS spoilern (Easter Eggs soll der User selbst finden)

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
| 4 | Legendär | 25-35 |
| 5 | Mythisch | 36-50 |

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
| legendary | 0.8% |
| epic | 13% |
| rare | 35% |
| uncommon | 40% |
| common | 11.2% |

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
    "legendary": "0.8%",
    "epic": "13%",
    "rare": "35%",
    "uncommon": "40%",
    "common": "11.2%"
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

### Companion Ultimates

Ab **Bond Level 5** schaltet jeder Companion eine Ultimate-Fähigkeit frei (1x pro 7 Tage):

| Ultimate | Effekt | API |
|----------|--------|-----|
| Sofort-Abschluss | Schließt eine Quest sofort ab (XP + Gold) | `POST /api/player/:name/companion/ultimate` mit `{ abilityId: "instant_complete", targetQuestId }` |
| Doppelte Belohnung | Nächste Quest gibt 2x XP + Gold | `{ abilityId: "double_reward" }` |
| Streak-Verlängerung | +3 Tage auf den aktuellen Streak | `{ abilityId: "streak_extend" }` |

**Visueller Effekt:** Goldener Glow + Breathing-Animation um das Companion-Widget für 4 Sekunden.

Neue Ultimates können in `companions.json → ultimates.abilities[]` hinzugefügt werden. Neue Effekt-Typen brauchen Code in `routes/players.js`.

---

## 11. Bazaar Shop-Items erstellen

**Datei**: `public/data/shopItems.json`
**Array**: `items[]`

### Zwei Kategorien

| Kategorie | `category` | Beschreibung |
|-----------|-----------|-------------|
| Self-Care | `"self-care"` | Reale Belohnungen (Gaming, Essen, Freizeit) — kein Gameplay-Effekt |
| Boosts | `"boost"` | Temporäre Gameplay-Buffs (XP, Gold, Luck etc.) — mit `effect`-Feld |

### Self-Care Reward Schema

```json
{
  "id": "neuer-reward",
  "name": "Reward Name",
  "cost": 100,
  "category": "self-care",
  "icon": "/images/icons/shop-neuer.png",
  "desc": "Beschreibung der Belohnung."
}
```

### Boost Item Schema (mit temporärem Effekt)

```json
{
  "id": "neuer-boost",
  "name": "Boost Name",
  "cost": 200,
  "category": "boost",
  "icon": "/images/icons/shop-neuer-boost.png",
  "desc": "+10% XP für 5 Quests.",
  "effect": { "type": "xp_boost_10", "questsRemaining": 5 }
}
```

### Verfügbare Effekt-Typen

| Type | Felder | Wirkung |
|------|--------|---------|
| `xp_boost_10` | `questsRemaining` | +10% XP für N Quests |
| `gold_boost_10` | `questsRemaining` | +10% Gold für N Quests |
| `luck_boost_20` | `questsRemaining` | Erhöhte Loot-Chance für N Quests |
| `streak_shield` | `questsRemaining: 1` | Schützt einmalig einen Streak |
| `material_double` | `questsRemaining` | Doppelte Material-Drops für N Quests |
| `instant_stardust` | `amount` | Gibt sofort X Stardust (kein Buff) |
| `instant_essenz` | `amount` | Gibt sofort X Essenz (kein Buff) |

**Buff-basierte** Effekte (mit `questsRemaining`) werden als `activeBuffs`-Eintrag beim User gespeichert und in `lib/helpers.js → onQuestCompletedByUser()` abgebaut. **Instant-Effekte** modifizieren `user.currencies` direkt.

Kein Code nötig für bestehende Effekt-Typen. Neue Effekt-Typen brauchen Anpassung in `routes/shop.js → applyShopEffect()`.

---

## 12. Artisan's Quarter — Crafting Recipes & Materials

> **Definitive Spec:** See [`WOW-PROFESSION-REFACTOR.md`](./WOW-PROFESSION-REFACTOR.md) for the complete profession refactor plan: 300 max skill, 6 professions (incl. Lederverarbeiter), ~100 recipes per profession (~600 total), material specialization, WoW recipe source distribution. **Always consult WOW-PROFESSION-REFACTOR.md before any profession/crafting work.**

**Data**: `public/data/professions.json`
**Frontend**: `components/ForgeView.tsx`
**Backend**: `routes/crafting.js`

### Profession NPCs (4 total, max 2 per player)

| Profession | NPC | Location | Unlock | Recipes |
|---|---|---|---|---|
| **Blacksmith** | Grimvar the Smith | Deepforge | Lv.5 | Stat Reroll, Minor Reroll, Rarity Upgrade, Reinforce Armor |
| **Alchemist** | Ysolde the Alchemist | Alchemist Lab | Lv.5 | Elixir of Experience/Wealth, Potion of Fortune, Elixir of Perseverance, Flask of Ambition |
| **Enchanter** | Eldric the Enchanter | Arcanum | Lv.8 | Temporary Enchantment, Permanent Enchant, Arcane Infusion |
| **Cook** | Bruna the Cook | Guild Kitchen | Lv.3 | Hearty Stew, Golden Soup, Forgefire Roast, Star Banquet, Endurance Ration, Champion's Feast |

### Adding a New Material

In `professions.json → materials[]`:

```json
{
  "id": "new-material",
  "name": "New Material",
  "icon": "/images/icons/mat-new.png",
  "rarity": "rare",
  "desc": "Description of the material."
}
```

Then add drop rates per quest rarity in `materialDropRates`:
```json
"materialDropRates": {
  "rare": { "new-material": 0.15 }
}
```

### Adding a New Recipe

In `professions.json → recipes[]`:

```json
{
  "id": "new-recipe",
  "profession": "alchemist",
  "name": "New Potion",
  "desc": "Effect description.",
  "reqProfLevel": 3,
  "xpGain": 15,
  "cost": { "gold": 100 },
  "materials": { "kraeuterbuendel": 2, "new-material": 1 },
  "result": { "type": "buff", "buffType": "xp_boost_10", "duration": "3_quests" },
  "cooldownMinutes": 0,
  "discovery": { "type": "profLevel", "value": 3 }
}
```

**Fields explained:**
- `xpGain`: Profession XP earned per craft (scales with recipe difficulty, 8-50)
- `discovery`: Optional. Recipe is hidden in the UI until condition is met. `{ "type": "profLevel", "value": 6 }` = visible only at profession level 6+. No discovery = always visible.
- `cooldownMinutes`: Per-recipe cooldown (tracked independently per recipe, not per profession)

**IMPORTANT:** New recipe IDs with new effect types need code changes in the `switch` in `routes/crafting.js`. Existing result types: `reroll`, `upgrade_rarity`, `reinforce`, `buff`, `streak_shield`, `temp_enchant`, `perm_enchant`, `forge_temp`.

### Batch Crafting

Buff/meal recipes (result type `buff`, `streak_shield`, `forge_temp`) support batch crafting via `count` parameter (1-10). Gold and materials are multiplied by count. Slot-requiring recipes (rerolls, enchants) are always single-craft.

### Daily Crafting Bonus

First craft each day awards **2x profession XP**. Tracked via `u.lastCraftDate`. Shown as "2x XP" badge in the Artisan's Quarter header.

### Profession Leveling

Each profession has 10 levels with scaling XP thresholds (defined in `levelThresholds`). XP per craft varies by recipe difficulty (8-50 XP). WoW-style ranks: Novice (Lv.0) → Apprentice (1-2) → Journeyman (3-4) → Expert (5-6) → Artisan (7-8) → Master (9-10).

### Salvage & Transmute System (Blacksmith tab, formerly "Schmiedekunst")

- **Dismantle**: Destroy inventory items → Essenz (2-100 by rarity) + chance at materials
- **Salvage All**: D3-style bulk dismantle per rarity (legendary excluded, must be individual)
- **Transmutation**: Combine 3 same-slot epic items + 500 Gold → 1 random legendary of that slot

---

## 13. Weekly Challenges — Star Path (Sternenpfad)

**Data**: `public/data/weeklyChallenges.json`
**Backend**: `routes/challenges-weekly.js`
**Frontend**: `components/ChallengesView.tsx`

The Star Path is a **solo weekly challenge** with 3 stages. It resets every Monday. Each stage has star ratings (1-3 stars), for a maximum of 9 stars per week. A weekly modifier boosts/penalizes certain quest types. Completing stages quickly earns a speed bonus (+1 star).

### ⏰ Time-Bound Content Requirement

**New weekly challenge templates MUST be created regularly** to keep the rotation fresh. The system randomly selects from templates each week. With only 8 templates currently, players will see repeats within 2 months. **Target: maintain at least 16-20 templates** for good variety.

### Challenge Template Schema

In `weeklyChallenges.json → challenges[]`:

```json
{
  "id": "unique-challenge-id",
  "name": "Challenge Display Name",
  "icon": "/images/icons/challenge-icon.png",
  "stages": [
    {
      "stage": 1,
      "desc": "What the player needs to do",
      "requirement": { "type": "quest_type", "questType": "personal", "count": 3 },
      "starThresholds": [3, 5, 7],
      "rewards": { "gold": 50, "xp": 30, "sternentaler": 2 }
    },
    {
      "stage": 2,
      "desc": "Stage 2 description",
      "requirement": { "type": "total_quests", "count": 5 },
      "starThresholds": [5, 8, 10],
      "rewards": { "gold": 75, "xp": 50, "sternentaler": 3 }
    },
    {
      "stage": 3,
      "desc": "Stage 3 description (hardest)",
      "requirement": { "type": "unique_types", "count": 4 },
      "starThresholds": [4, 5, 6],
      "rewards": { "gold": 100, "xp": 75, "sternentaler": 5 }
    }
  ]
}
```

### Requirement Types

| Type | Fields | Description |
|------|--------|-------------|
| `quest_type` | `questType`, `count` | Complete N quests of a specific type (e.g., "personal", "learning") |
| `total_quests` | `count` | Complete N quests of any type |
| `unique_types` | `count` | Complete quests across N different quest types |
| `streak_maintained` | `count` | Maintain a daily streak for N days within the week |

### Star Thresholds

`starThresholds` is an array of 3 numbers `[1★, 2★, 3★]`. These represent the count required to earn each star level. E.g., `[3, 5, 7]` means: 3 completions = 1★, 5 = 2★, 7 = 3★.

Star bonuses on rewards: 2★ = +15%, 3★ = +33%.

### Weekly Modifiers

In `weeklyChallenges.json → weeklyModifiers[]`:

```json
{
  "id": "modifier-id",
  "name": "Modifier Display Name",
  "description": "What this modifier does",
  "bonusType": "personal",
  "bonusMultiplier": 1.5,
  "malusType": "development",
  "malusMultiplier": 0.75
}
```

Each week, one modifier is randomly selected. `bonusType` quests count 1.5x toward stage progress; `malusType` quests count 0.75x. Modifiers affect all stages equally.

### Speed Bonus

If a stage is completed within `speedBonusDays` (default: 2) days of starting it, the player earns +1 bonus star for that stage. This rewards active players who tackle stages quickly.

### Design Guidelines

- Stages should escalate in difficulty (stage 1 = easy, stage 3 = hard)
- Mix requirement types across stages for variety
- Star thresholds should feel achievable but rewarding to max
- Rewards should scale with stage difficulty
- **Sternentaler** is the exclusive currency earned only from weekly challenges — include it in every stage's rewards

---

## 14. Weekly Challenges — Expedition (Cooperative)

**Data**: `public/data/expeditions.json`
**Backend**: `routes/expedition.js`
**Frontend**: `components/ChallengesView.tsx`

The Expedition is a **guild-wide cooperative weekly challenge**. All registered players contribute quests toward shared checkpoints. It resets every Monday. There are 3 regular checkpoints + 1 bonus checkpoint. The quest requirement scales with the number of registered players.

### ⏰ Time-Bound Content Requirement

**New expedition templates MUST be created regularly** to keep the rotation fresh. The system randomly selects from templates each week. With only 8 templates currently, players will see repeats within 2 months. **Target: maintain at least 16-20 templates** for good variety.

Additionally, **bonus titles** rotate through a pool of 6. New bonus titles should be added periodically to maintain excitement around the bonus checkpoint reward.

### Expedition Template Schema

In `expeditions.json → expeditions[]`:

```json
{
  "id": "unique-expedition-id",
  "name": "Expedition Display Name",
  "description": "Flavor text describing the expedition",
  "icon": "/images/icons/expedition-icon.png",
  "checkpointNames": [
    "Checkpoint 1 Name",
    "Checkpoint 2 Name",
    "Checkpoint 3 Name",
    "Bonus Checkpoint Name"
  ]
}
```

### Checkpoint Scaling

Quest requirements per checkpoint are defined globally in `expeditions.json → questsPerPlayerPerCheckpoint`:

```json
"questsPerPlayerPerCheckpoint": [8, 12, 18, 25]
```

These values are multiplied by the number of registered players. E.g., with 5 players: checkpoint 1 requires 40 quests, checkpoint 2 requires 60, etc. This scaling ensures active players can compensate for inactive ones.

### Checkpoint Rewards

Defined globally in `expeditions.json → checkpointRewards`:

```json
"checkpointRewards": {
  "1": { "gold": 100, "xp": 50 },
  "2": { "gold": 200, "xp": 100, "runensplitter": 5 },
  "3": { "gold": 350, "xp": 200, "runensplitter": 10, "essenz": 25 },
  "bonus": { "gold": 500, "xp": 300, "sternentaler": 10 }
}
```

The **bonus checkpoint** additionally awards a rotating title from `bonusTitles[]`.

### Bonus Titles

In `expeditions.json → bonusTitles[]`:

```json
{
  "id": "title-id",
  "name": "Title Display Name",
  "rarity": "epic"
}
```

One title is randomly selected each week for the bonus checkpoint reward. All bonus titles should be `epic` rarity.

### Design Guidelines

- Expedition names should feel like epic guild undertakings (journeys, battles, explorations)
- 4 checkpoint names per template: the first 3 should escalate thematically, the 4th (bonus) should feel climactic
- Flavor descriptions should be 1-2 sentences, evocative and RPG-themed
- Bonus titles should be memorable and desirable — they're the primary aspirational reward

---

## 15. The Rift — Timed Dungeon Quest Chains

**Data**: `public/data/battlePass.json` (rift XP source defined here), runtime state in `data/`
**Backend**: `routes/rift.js`
**Frontend**: `components/RiftView.tsx`

The Rift is a **timed dungeon system** with 3 difficulty tiers. Players enter a Rift, receive a chain of quests, and must complete them within a time limit. Failing (timeout) imposes a cooldown before retrying.

### Tier Structure

| Tier | Quests | Time Limit | Fail Cooldown | Difficulty Multiplier |
|------|--------|------------|---------------|----------------------|
| Normal | 3 | 72 hours | 3 days | 1x → 1.5x |
| Hard | 5 | 48 hours | 5 days | 1.5x → 2.5x |
| Legendary | 7 | 36 hours | 7 days | 2x → 3.5x |

### Content Needs

Rift quests are generated from the existing **quest catalog** (`questCatalog.json`). The system selects quests with escalating difficulty. No separate Rift-specific quest templates are needed.

**What Lyra should create for The Rift:**
- **Achievement templates** in `achievementTemplates.json` for Rift milestones (e.g., "Complete first Normal Rift", "Complete a Legendary Rift", "Complete 10 Rifts")
- **Titles** in `titles.json` for Rift accomplishments (e.g., condition type `rift_completions`)
- **Loot table entries** in `lootTables.json` for Rift-specific rewards — Rift completion bonus loot should be higher rarity
- Ensure the **quest catalog** has enough variety and difficulty spread to support 7-quest chains at high difficulty

### When to Generate New Content

- When players report repetitive Rift quest chains (add more quest templates to the catalog)
- When new achievement milestones are desired (e.g., "Complete 50 Rifts")

---

## 16. Season Pass / Battle Pass

**Data**: `public/data/battlePass.json`
**Backend**: `routes/battlepass.js`
**Frontend**: `components/BattlePassView.tsx`

A **40-level reward track** that resets each season (90 days). Players earn Season XP from multiple gameplay activities and claim rewards at each level.

### Config Schema

In `battlePass.json → config`:

```json
{
  "levels": 40,
  "xpPerLevel": 250,
  "seasonDurationDays": 90,
  "currentSeason": 1,
  "seasonName": "Season 1 — Awakening",
  "seasonTheme": "Die Zirkel erwachen. Die alten Ordnungen formieren sich neu im Turm.",
  "seasonIcon": "🌅",
  "seasonAccent": "#a78bfa"
}
```

### Reward Schema

In `battlePass.json → rewards[]`:

```json
{ "level": 1, "type": "gold", "amount": 50 },
{ "level": 5, "type": "runensplitter", "amount": 5, "milestone": true },
{ "level": 10, "type": "title", "titleId": "bp_s1_10", "titleName": "Erwachter", "titleRarity": "uncommon", "milestone": true },
{ "level": 20, "type": "frame", "frameId": "bp_s1_frame", "frameName": "Awakening Frame", "frameColor": "#a78bfa", "milestone": true },
{ "level": 4, "type": "material", "materialId": "iron_ore", "amount": 3 }
```

### Reward Types

| Type | Extra Fields | Description |
|------|-------------|-------------|
| `gold` | `amount` | Gold currency |
| `essenz` | `amount` | Essenz currency |
| `runensplitter` | `amount` | Runensplitter currency |
| `stardust` | `amount` | Stardust currency |
| `sternentaler` | `amount` | Sternentaler currency |
| `mondstaub` | `amount` | Rare currency |
| `material` | `materialId`, `amount` | Crafting material (ID must exist in `professions.json → materials`) |
| `title` | `titleId`, `titleName`, `titleRarity` | Exclusive seasonal title |
| `frame` | `frameId`, `frameName`, `frameColor` | Cosmetic player frame |

**`milestone: true`** marks visually highlighted levels in the UI (levels 5, 10, 15, 20, 25, 30, 35, 40 recommended).

### XP Sources

In `battlePass.json → xpSources`:

```json
{
  "quest_complete": { "common": 10, "uncommon": 15, "rare": 25, "epic": 40, "legendary": 60 },
  "ritual_complete": 8,
  "vow_clean_day": 5,
  "daily_mission_milestone": { "100": 10, "300": 15, "500": 20, "750": 30 },
  "crafting": 5,
  "rift_stage": 20,
  "sternenpfad_star": 10,
  "expedition_checkpoint": 15,
  "companion_pet": 2,
  "login": 5
}
```

### ⏰ Time-Bound Content Requirement

**Every new season (every ~90 days) requires a complete new Battle Pass:**
- New `config` with season number, name, theme, icon, accent color
- New `rewards[]` array with 40 levels of rewards — mix currencies, materials, 2-3 exclusive titles, 1-2 exclusive frames
- Season titles and frames should have IDs prefixed with `bp_sN_` (e.g., `bp_s2_10`)
- XP sources can be adjusted per season for balance

### Design Guidelines

- Rewards should escalate: early levels give small currency amounts, later levels give titles/frames/rare currencies
- Every 5th level should be a milestone with a notable reward
- Level 40 should always be an epic-rarity title — the crown jewel of the season
- Include at least 1 frame (around level 20) and 3 titles (levels 10, 25, 40)
- Season themes should be narratively distinct and tie into faction/world lore
- Accent color should be unique per season for visual identity

---

## 17. Die Vier Zirkel — Faction System

**Data**: `public/data/factions.json`
**Backend**: `routes/factions.js`
**Frontend**: `components/FactionsView.tsx`

Four factions with 6 reputation tiers. Players earn reputation automatically by completing quests whose type matches a faction's affinity. Each tier unlocks claimable rewards.

### Faction Schema

In `factions.json → factions[]`:

```json
{
  "id": "glut",
  "name": "Zirkel der Glut",
  "icon": "🔥",
  "accent": "#ef4444",
  "motto": "Durch Feuer geschmiedet, in Asche geläutert.",
  "description": "Die Feuer-Asketen des Turms. Meister der körperlichen Disziplin...",
  "questTypes": ["fitness"],
  "npcPatron": null,
  "symbol": "🜂",
  "rewards": {
    "friendly": { "title": "Glutwandler", "titleRarity": "uncommon" },
    "honored": { "recipe": "flask_of_embers", "recipeDesc": "Flask of Embers (+15% Forge Temp recovery)" },
    "revered": { "frame": "glut_frame", "frameDesc": "Zirkel der Glut Frame" },
    "exalted": { "title": "Flammenherz", "titleRarity": "epic", "shopDiscount": 10 },
    "paragon": { "legendaryEffect": "glut_mastery", "effectDesc": "+5% XP for Fitness quests permanently", "title": "Aszendent der Glut", "titleRarity": "legendary" }
  }
}
```

### Current Factions

| Faction | ID | Quest Types | Theme |
|---------|-----|------------|-------|
| Zirkel der Glut | `glut` | fitness | Fire/discipline |
| Zirkel der Tinte | `tinte` | learning | Knowledge/archives |
| Zirkel des Amboss | `amboss` | development, personal | Craft/creation |
| Zirkel des Echos | `echo` | social, creative | Connection/community |

### Reputation Standings

In `factions.json → standings[]`:

| Standing | Min Rep | Color |
|----------|---------|-------|
| Neutral | 0 | `#6b7280` |
| Friendly | 500 | `#22c55e` |
| Honored | 1,500 | `#3b82f6` |
| Revered | 4,000 | `#a855f7` |
| Exalted | 8,000 | `#f59e0b` |
| Paragon | 15,000 | `#ef4444` |

### Rep Per Quest (by rarity)

In `factions.json → repPerQuest`: common=5, uncommon=8, rare=12, epic=20, legendary=35. First 3 quests per faction per week grant 2x rep (weekly bonus).

### Tier Reward Types

| Tier | Reward Type | Description |
|------|------------|-------------|
| Friendly | Title (uncommon) | Entry-level faction title |
| Honored | Recipe | Exclusive crafting recipe (must exist in `professions.json → recipes[]`) |
| Revered | Frame | Cosmetic player frame |
| Exalted | Title (epic) + shop discount | Prestigious title + 10% Bazaar discount |
| Paragon | Legendary effect + title (legendary) | Permanent gameplay bonus + highest-tier title |

### Content Needs

**What Lyra should create for Factions:**
- **Faction reward titles** in `titles.json` — one per tier per faction (currently 3 per faction: friendly, exalted, paragon)
- **Faction reward recipes** in `professions.json → recipes[]` — one per faction at Honored tier
- **NPC patrons** — each faction can have a patron NPC (`npcPatron` field, currently `null`). These could be added as quest givers in `npcQuestGivers.json` with faction-themed quest chains
- **Flavor text** — motto, description for each faction
- **Achievements** in `achievementTemplates.json` for faction milestones (e.g., "Reach Exalted with any faction", "Reach Paragon with all factions")

### When to Generate New Content

- When a new faction is added (would require code changes in `routes/factions.js` for quest-type mapping)
- When new tiers or tier rewards are desired
- When faction patron NPCs are to be introduced

---

## 18. Social System — The Breakaway

**Backend**: `routes/social.js`
**Frontend**: `components/SocialView.tsx`, `components/PlayerProfileModal.tsx`

The Social System encompasses friends, direct messaging, item/gold trading, activity feed, player search, and player profiles. Content for this system is mostly player-generated at runtime, but there are template and configuration aspects.

### Content Needs

**What Lyra should create for Social:**
- **Activity feed event descriptions** — The feed shows quest completions, level-ups, achievements, gacha pulls, drops, and trades. These use existing quest/achievement/item names, so keeping those rich and flavorful improves the social feed quality
- **Achievements** in `achievementTemplates.json` for social milestones:
  - "Add first friend"
  - "Send first message"
  - "Complete first trade"
  - "Have 5/10/20 friends"
- **Titles** in `titles.json` for social accomplishments (e.g., condition types `friends_count`, `trades_completed`, `messages_sent`)

### No Dedicated JSON Template File

The Social System does not have its own template JSON file. It operates on runtime data (friends lists, messages, trade state) stored in `data/`. Content improvement comes through enriching the items, achievements, and titles that appear within the social context.

---

## 19. The Hearth — Tavern / Rest Mode

**Backend**: `routes/players.js`
**Frontend**: `components/TavernView.tsx`

The Hearth allows players to enter **rest mode** for 1-7 days, freezing streaks and forge temperature. It has a 30-day cooldown between uses.

### Content Needs

**What Lyra should create for The Hearth:**
- **Achievements** in `achievementTemplates.json` for rest mode usage (e.g., "Take your first rest", "Use rest mode 5 times")
- **Titles** in `titles.json` related to rest (e.g., "The Weary", "Keeper of the Hearth")
- **Flavor text** — The Hearth is thematically inspired by Urithiru gathering halls (Stormlight Archive). NPCs, descriptions, and ambient text should match this cozy tavern atmosphere

### No Dedicated JSON Template File

The Hearth's configuration (max days, cooldown period) is defined in code (`routes/players.js`). No separate JSON template file exists for tavern content.

---

## 20. Daily Missions

**Backend**: Built into the dashboard batch endpoint and quest completion hooks
**Frontend**: Displayed in the main dashboard

An HSR-style daily checklist with 6 missions that reset each day. Completing missions earns points toward 4 milestone tiers (100/300/500/750 points) with currency rewards.

### Mission Types

| Mission | Points | Description |
|---------|--------|-------------|
| Login | 50 | Log in to the dashboard |
| Complete quests | Variable | Complete 1-3 quests |
| Rituals | Variable | Complete daily rituals |
| Companion | Variable | Interact with companion |
| Crafting | Variable | Craft an item |
| Variety | Variable | Complete different quest types |

### Content Needs

**What Lyra should create for Daily Missions:**
- **Achievements** in `achievementTemplates.json` for daily mission milestones (e.g., "Reach 750 daily mission points 7 days in a row", "Complete all daily missions 30 times")
- Daily missions feed into **Battle Pass XP** (see xpSources in `battlePass.json`), so keeping the daily loop engaging supports the season pass progression

### No Dedicated JSON Template File

Daily mission definitions are in code. The milestone rewards are defined in the backend. No separate JSON file to edit.

---

## 21. Workshop Upgrades

**Data**: Defined in `routes/shop.js` (workshop upgrades section)
**Frontend**: `components/ForgeView.tsx`

Four permanent bonus items purchasable in the Artisan's Quarter. Each has multiple tiers with escalating costs and bonuses.

### Upgrade Items

| Upgrade | Tiers | Effect | Bonus Range |
|---------|-------|--------|-------------|
| Gold-Forged Tools | 4 | +% gold from quests | +2-5% |
| Loot Chance Amulet | 4 | +% item drop chance | +1-3% |
| Streak Shield Charm | 4 | Auto-save streak 1x/week | 1x |
| Material Magnet | 4 | +% material drop chance | +5-15% |

### Content Needs

**What Lyra should create for Workshop Upgrades:**
- **Achievements** in `achievementTemplates.json` for upgrade milestones (e.g., "Purchase first workshop upgrade", "Max out all workshop upgrades")
- **Titles** in `titles.json` for workshop mastery

### No Dedicated JSON Template File

Workshop upgrade definitions (costs, bonuses, tiers) are in code (`routes/shop.js`). No separate JSON template file.

---

## 22. GameTooltip System

**Frontend**: `components/GameTooltip.tsx`

A rich tooltip framework with 50+ registry entries that provide hover-to-learn information about every stat, currency, and system in the game. Tooltips support cross-references via `GTRef` sub-tooltips.

### Content Needs

**What Lyra should create for GameTooltip:**
- When adding **new stats, currencies, systems, or mechanics**, ensure a corresponding tooltip registry entry exists in `GameTooltip.tsx`
- Tooltip entries include: `key`, `title`, `body` (description text), and optional `refs` (cross-links to other tooltips)
- This requires a **code change** in `components/GameTooltip.tsx` — tooltip definitions are in the component, not in a JSON file

### When to Update

- Every time a new currency, stat, buff type, or game system is added
- When existing tooltip descriptions become outdated due to balance changes

---

## 23. World Boss System

**Data**: `public/data/worldBosses.json`
**Backend**: `routes/world-boss.js`

Community-wide boss encounters where all players contribute damage via quest completions. Bosses have unique drop tables including Unique Named Items.

### Boss Template Schema

In `worldBosses.json → bosses[]`:

```json
{
  "id": "unique-boss-id",
  "name": "Boss Display Name",
  "title": "The Destroyer",
  "portrait": "/images/bosses/boss-portrait.png",
  "tier": "titan",
  "description": "Flavor text describing the boss and its threat.",
  "lore": "Longer lore passage about the boss's origin and motivation.",
  "hp": 50000,
  "enrageHours": 72,
  "uniqueDrops": ["unique-item-id-1", "unique-item-id-2"],
  "lootTable": {
    "gold": { "min": 200, "max": 500 },
    "xp": { "min": 100, "max": 300 },
    "materials": ["sternenstahl", "drachenschuppe"],
    "gearPool": ["t4-boss-weapon", "t4-boss-armor"]
  },
  "contributionThresholds": {
    "bronze": 100,
    "silver": 500,
    "gold": 1500,
    "legendary": 5000
  }
}
```

### Boss Tiers

| Tier | HP Range | Enrage Timer | Reward Level |
|------|----------|-------------|--------------|
| `champion` | 10,000-25,000 | 48h | Standard |
| `titan` | 25,000-75,000 | 72h | Enhanced |
| `colossus` | 75,000-200,000 | 96h | Maximum + unique drops |

### Unique Drop Items

Items in `uniqueDrops[]` must exist in `public/data/uniqueItems.json`. These are the primary source of Unique Named Items.

### Content Needs

**What Lyra should create for World Bosses:**
- **Boss templates** in `worldBosses.json` — aim for 8-12 bosses across all tiers
- **Unique Named Items** in `uniqueItems.json` — 1-3 unique drops per boss
- **Boss portraits** in `public/images/bosses/` — 256x256px recommended, transparent PNG
- **Flavor text** — each boss needs a description (1-2 sentences) and longer lore passage
- **Achievements** in `achievementTemplates.json` for boss milestones (e.g., "Defeat first world boss", "Reach Gold contribution tier", "Defeat 10 world bosses")
- **Titles** in `titles.json` for boss accomplishments (e.g., "Bossslayer", "Champion of the Hall")
- **Gear items** in `gearTemplates.json` for boss-specific loot pools

### Design Guidelines

- Boss names should feel imposing and RPG-themed (e.g., "Gorvath the Unyielding", "Schattenweberin Nyx")
- Tier should match narrative weight — Champion bosses are local threats, Colossus bosses are world-ending
- Lore passages should tie into the QuestHall world (the Tower, factions, NPCs)
- Unique drops should have memorable names and powerful fixed stats befitting their boss origin
- Contribution thresholds should be achievable: bronze for casual players, legendary for top contributors

---

## 24. Gem & Socket System

**Data**: `public/data/gems.json`
**Backend**: `routes/gems.js`

6 gem types across 5 quality tiers. Gems are socketed into gear to provide stat bonuses. Gems can be upgraded by combining 3 of the same tier.

### Gem Type Schema

In `gems.json → gemTypes[]`:

```json
{
  "id": "ruby",
  "name": "Ruby",
  "stat": "kraft",
  "color": "#ef4444",
  "icon": "🔴",
  "tiers": [
    { "tier": 1, "name": "Chipped Ruby", "statBonus": 2 },
    { "tier": 2, "name": "Flawed Ruby", "statBonus": 4 },
    { "tier": 3, "name": "Ruby", "statBonus": 7 },
    { "tier": 4, "name": "Flawless Ruby", "statBonus": 11 },
    { "tier": 5, "name": "Royal Ruby", "statBonus": 16 }
  ]
}
```

### Current Gem Types

| Gem | Stat | Color | Theme |
|-----|------|-------|-------|
| Ruby | kraft | `#ef4444` | Fire/strength |
| Sapphire | weisheit | `#3b82f6` | Water/wisdom |
| Emerald | glueck | `#22c55e` | Earth/luck |
| Topaz | ausdauer | `#f59e0b` | Lightning/endurance |
| Amethyst | vitalitaet | `#a855f7` | Arcane/vitality |
| Diamond | fokus | `#e2e8f0` | Light/focus |

### Tier Names

| Tier | Name | Stat Bonus |
|------|------|------------|
| 1 | Chipped | +2 |
| 2 | Flawed | +4 |
| 3 | [Gem Name] | +7 |
| 4 | Flawless | +11 |
| 5 | Royal | +16 |

### Content Needs

**What Lyra should create for the Gem System:**
- **New gem types** in `gems.json` — if new stats or gameplay mechanics are added, new gem types can support them
- **Gem icons** in `public/images/gems/` — one icon per gem type, ideally with tier variations
- **Achievements** in `achievementTemplates.json` for gem milestones (e.g., "Socket first gem", "Upgrade a gem to Pristine tier", "Fill all sockets on an item")
- **Titles** in `titles.json` for gem mastery (e.g., "Juwelier", "Gemcutter")
- **Loot table entries** in `lootTables.json` — gems can drop from quest completion

### Design Guidelines

- New gem types should map to a clear stat or gameplay effect
- Gem names should follow the German-themed naming convention
- Colors should be distinct from existing gems for UI clarity
- Diamond is the "all stats" gem — avoid adding another all-stats gem

---

## 25. Unique Named Items

**Data**: `public/data/uniqueItems.json`
**Backend**: Integrated into `routes/habits-inventory.js` and `routes/world-boss.js`

Handcrafted legendary items with fixed stats, unique flavor text, and lore. Unlike standard gear (which uses random affix rolling), unique items have predetermined stats. Players track discovered uniques in a collection log.

### Unique Item Schema

In `uniqueItems.json → items[]`:

```json
{
  "id": "gorvaths-fist",
  "name": "Gorvaths Faust",
  "slot": "weapon",
  "rarity": "legendary",
  "reqLevel": 30,
  "stats": {
    "kraft": 12,
    "ausdauer": 8,
    "fokus": 4
  },
  "legendaryEffect": {
    "type": "xp_bonus",
    "value": 5,
    "label": "Faust des Unaufhaltsamen: +5% Quest-XP"
  },
  "lore": "Geschmiedet in den Tiefen des Turms, als Gorvath noch über die Hallen herrschte.",
  "flavorText": "„Wer diese Waffe führt, kennt keine Furcht."",
  "source": "world_boss",
  "sourceId": "gorvath-the-unyielding",
  "icon": "/images/uniques/gorvaths-fist.png",
  "collection": true
}
```

### Fields Explained

| Field | Description |
|-------|-------------|
| `stats` | Fixed stats — NOT randomly rolled. Use exact values. |
| `legendaryEffect` | Fixed effect with exact `value` (no min/max range). |
| `lore` | World lore explaining the item's history (1-2 sentences). |
| `flavorText` | In-character quote, shown in italics. |
| `source` | Where this item drops: `world_boss`, `mythic_rift`, `event`, `quest_chain` |
| `sourceId` | ID of the specific source (boss ID, rift level, event ID). |
| `collection` | Whether this item appears in the collection log (should be `true` for all). |

### Source Types

| Source | Description | Drop Condition |
|--------|-------------|----------------|
| `world_boss` | Drops from a specific world boss | Contribution threshold + RNG |
| `mythic_rift` | Drops from Mythic+ Rift at milestone levels | M+5, M+10, M+15, M+20 |
| `event` | Drops from special time-limited events | Event-specific |
| `quest_chain` | Guaranteed reward from a specific quest chain | Quest chain completion |

### Design Guidelines

- Each unique item should tell a story through its name, lore, and flavor text
- Stats should be competitive with well-rolled random gear but not strictly superior
- Legendary effects should be thematic — tied to the item's lore and source
- Names should be memorable and evocative (German or English, matching QuestHall style)
- Every world boss should have 1-3 associated unique drops
- Mythic+ Rift uniques should feel like prestige items — they prove endgame mastery
- **Collection completionism**: Design sets of related uniques (e.g., all drops from one boss, all weapon types) to encourage collection

---

## 26. Mythic+ Endless Rift

**Data**: Runtime state in `data/`, Mythic+ config in rift logic
**Backend**: `routes/rift.js` (extended)
**Frontend**: `components/RiftView.tsx` (extended)

Infinite scaling rift levels that unlock after completing a Legendary Rift. Each Mythic+ level increases difficulty. A leaderboard tracks the highest level reached.

### Content Needs

**What Lyra should create for Mythic+ Rift:**
- **Achievements** in `achievementTemplates.json` for Mythic+ milestones (e.g., "Complete Mythic+1", "Complete Mythic+5", "Complete Mythic+10", "Complete Mythic+20")
- **Titles** in `titles.json` for Mythic+ accomplishments (e.g., "Riftwanderer" at M+5, "Riftbreaker" at M+10, "Riftlord" at M+20)
- **Unique Named Items** in `uniqueItems.json` as Mythic+ milestone rewards (source: `mythic_rift`)
- **Loot table entries** in `lootTables.json` for Mythic+ bonus loot tiers
- Ensure the **quest catalog** has enough high-difficulty variety to support deep Mythic+ runs

### Design Guidelines

- Mythic+ titles should feel increasingly prestigious with level
- Unique drops at M+5/10/15/20 should be powerful and visually distinct
- The system relies on the same quest catalog as standard Rifts — more quest variety = better Mythic+ experience

---

## 27. Enchanting Overhaul (D3 Mystic Style)

**Data**: Recipe definitions in `public/data/professions.json`
**Backend**: `routes/crafting.js` (enchanter recipes updated)
**Frontend**: `components/ForgeView.tsx`

The Enchanter (Eldric) now offers **targeted stat rerolling** instead of blanket rerolls. Players pick one stat on an item to reroll from its affix pool, preserving all other stats. Cost escalates with each successive reroll.

### How It Works

1. Player selects an equipped or inventory item at the Enchanter
2. Player picks **one stat** to reroll (the other stats remain unchanged)
3. The selected stat is rerolled from the item's original affix pool (same min/max range)
4. That stat slot becomes **locked** — future rerolls on this item can only target that same stat
5. Cost increases with each reroll: base cost x (1 + 0.5 * rerollCount)

### Content Needs

**What Lyra should create for the Enchanting Overhaul:**
- **Achievements** in `achievementTemplates.json` for enchanting milestones (e.g., "Reroll a stat for the first time", "Reroll a stat to its maximum value")
- **Titles** in `titles.json` for enchanting mastery
- No new JSON template file needed — the reroll mechanic uses existing gear affix pools from `gearTemplates.json`

---

## 28. Dungeon System ("The Undercroft")

**Data**: `public/data/dungeons.json`
**Backend**: `routes/dungeons.js`
**Frontend**: `components/DungeonView.tsx`

Async cooperative group dungeons (2-4 friends). Players create a run, invite friends, wait 8 hours, then collect rewards based on combined Gear Score + companion bond level.

### Dungeon Template Schema

```json
{
  "id": "dungeon-id",
  "name": "The Dungeon Name",
  "description": "1-2 sentence flavor text.",
  "icon": "📜",
  "accent": "#22c55e",
  "tier": "normal",
  "minLevel": 10,
  "minPlayers": 2,
  "maxPlayers": 4,
  "durationHours": 8,
  "cooldownDays": 7,
  "gearScoreThreshold": 100,
  "rewards": {
    "gold": [200, 500],
    "essenz": [5, 12],
    "runensplitter": [2, 5],
    "sternentaler": [1, 3],
    "materials": { "count": [3, 6] },
    "gems": { "chance": 0.4, "maxTier": 2 },
    "gearDrop": { "chance": 0.3, "minRarity": "rare" }
  },
  "bonusRewards": {
    "title": "Archive Delver",
    "frame": { "id": "dungeon-frame-id", "name": "Archive Delver", "color": "#22c55e", "glow": false }
  }
}
```

### Tier Design Guidelines

| Tier | Min Level | Gear Score | Min Players | Unique Drops | Design |
|------|-----------|-----------|-------------|--------------|--------|
| Normal | 10 | 100 | 2 | 1 (armor/shield) | Introductory, forgiving |
| Hard | 20 | 250 | 2 | 1 (weapon) | Challenging, better loot |
| Legendary | 35 | 500 | 3 | 1 (amulet/accessory) | End-game, unique-worthy |

### Content Needs

- **Dungeon templates** in `dungeons.json` — aim for 6-9 dungeons (2-3 per tier)
- **Unique Named Items** in `uniqueItems.json` with `source: "dungeon:{dungeonId}"`
- **Achievements** in `achievementTemplates.json` for dungeon milestones
- **Titles** in `titles.json` for dungeon accomplishments (bonus titles in dungeon JSON)
- **Each dungeon should have thematic coherence**: name, description, icon, unique drops should tell a story within Urithiru

---

## 29. Companion Expeditions

**Data**: `public/data/companionExpeditions.json`
**Backend**: `routes/players.js` (endpoints: send, collect, list)

Idle mechanic — send your companion on timed expeditions to gather resources while you do other things.

### Expedition Template Schema

```json
{
  "id": "expedition-id",
  "name": "Expedition Name",
  "description": "1-2 sentence description.",
  "durationHours": 8,
  "icon": "🌲",
  "rewards": {
    "gold": [50, 120],
    "materials": { "chance": 0.8, "count": [1, 3] },
    "gems": { "chance": 0.2, "maxTier": 2 },
    "essenz": [1, 3],
    "runensplitter": [0, 2],
    "rareItem": { "chance": 0.05 }
  }
}
```

### Content Needs

- **Expedition templates** in `companionExpeditions.json` — aim for 6-8 expeditions
- Higher-tier expeditions should have longer durations but much better rewards
- **Theme**: Expeditions explore the area around Urithiru — forests, mountains, ruins, distant lands
- Gold rewards scaled by companion bond level (1 + bondLevel × 0.1)
- Frontend UI integration is pending (backend is complete)

---

## 30. Rituals & Vows (Rituale & Gelübde)

**Data**: `public/data/ritualVowTemplates.json`
**Backend**: `routes/habits-inventory.js`
**Frontend**: `components/RitualChamber.tsx`, `components/VowShrine.tsx`

Rituals are recurring positive habits. Vows are habits to break (anti-rituals).

### Ritual Template Schema

```json
{
  "id": "ritual-id",
  "title": "Morning Meditation",
  "description": "10 minutes of mindful breathing.",
  "icon": "🧘",
  "category": "wellness",
  "frequency": "daily",
  "xpReward": 8,
  "streakBonusThreshold": 7
}
```

- **frequency**: `"daily"` | `"weekly"` | `"custom"`
- Rituals earn Battle Pass XP (8 per completion via `grantBattlePassXP(u, 'ritual_complete')`)
- Streak tracking: consecutive days of completion
- Players can create custom rituals — templates are suggested starters

### Vow Schema

```json
{
  "id": "vow-id",
  "title": "No Social Media After 10PM",
  "description": "Break the late-night scrolling habit.",
  "icon": "📵",
  "category": "digital",
  "cleanDayXp": 5
}
```

- Vows track "clean days" (days without breaking the vow)
- Clean days earn Battle Pass XP (5 per clean day via `grantBattlePassXP(u, 'vow_clean_day')`)
- "Blood Pact" commitment tier: public vow with social accountability
- Players create their own vows — templates are suggestions

### Content Needs

- **Ritual/Vow templates** in `ritualVowTemplates.json` — aim for 20-30 suggestions across categories (wellness, productivity, fitness, social, digital)
- **Achievements** for ritual milestones (7-day streak, 30-day streak, etc.)
- **Titles** for vow accomplishments ("Iron Will", "Ascetic", etc.)

---

## 31. Campaigns (Quest Chains)

**Data**: `public/data/campaignNpcs.json`
**Backend**: `routes/campaigns.js`
**Frontend**: `components/CampaignView.tsx`

Campaigns are multi-quest storylines with sequential progression.

### Campaign NPC Schema

```json
{
  "id": "campaign-npc-id",
  "name": "NPC Name",
  "portrait": "/images/npcs/campaign-npc.png",
  "description": "Brief NPC description.",
  "quests": [
    {
      "id": "quest-id-1",
      "title": "First Quest",
      "description": "Quest description.",
      "type": "personal",
      "rewards": { "xp": 50, "gold": 30 },
      "rarity": "rare"
    }
  ],
  "completionReward": {
    "title": "Campaign Finisher",
    "gold": 500,
    "xp": 200
  }
}
```

- Quests unlock sequentially (complete quest 1 to unlock quest 2)
- Campaign NPCs appear in The Observatory (The Pinnacle floor)
- Completion rewards are given after the final quest

### Content Needs

- **Campaign NPCs** in `campaignNpcs.json` — aim for 5-10 campaigns
- **Each campaign** should have 3-7 quests telling a coherent story
- **Campaign portraits** in `public/images/npcs/` (128x128 or 256x256 PNG)
- **Theme**: Stories about Urithiru, the tower's mysteries, character growth

---

## 32. Quest Flavor Text

**Data**: `public/data/questFlavor.json`
**Backend**: Used in quest template interpolation (`lib/quest-templates.js`)

Flavor text snippets add atmosphere to generated quests.

### Schema

```json
[
  {
    "id": "flavor-id",
    "text": "The wind whispers of undone tasks...",
    "category": "personal",
    "mood": "mysterious"
  }
]
```

- Displayed on quest cards as italicized subtitle text
- Categorized by quest type for thematic matching
- **Moods**: `mysterious`, `urgent`, `encouraging`, `humorous`, `epic`
- Aim for 5-10 flavors per quest type for variety

---

## 33. Changelog Entries

**Data**: `public/data/changelog.json`
**Backend**: `routes/players.js` (GET /api/changelog-data)
**Frontend**: Shown in-game via version notification

### Schema

```json
[
  {
    "version": "1.5.3",
    "date": "2026-03-22",
    "title": "The Undercroft Update",
    "highlights": [
      "New: Dungeon System — cooperative group dungeons",
      "New: World Boss encounters with community damage",
      "Fix: Gem socketing now works correctly"
    ],
    "details": "Optional longer description of changes."
  }
]
```

- Newest entries first
- Players see a notification when a new version is detected
- Keep entries concise — highlights are bullet points

---

## 34. Game Mechanics Reference

This section documents key backend formulas that affect content design decisions.

### XP & Leveling

- **50 levels** total (30 base + 20 prestige 31-50)
- XP requirements scale exponentially
- **Forge Temperature** adds XP multiplier: up to +50% at 100°C
- **Gear stats** (kraft/weisheit) add XP/gold multipliers
- **Bond level** adds +1% XP per level above 1

### Gem System Mechanics

- **Socket count by rarity**: common [0,0], uncommon [0,1], rare [1,1], epic [1,2], legendary [2,3]
- **Upgrade recipe**: 3 gems of tier N + 100 gold → 1 gem of tier N+1
- **Unsocket cost**: 50 gold (gem returned to inventory)
- **Tier names**: 1=Chipped, 2=Flawed, 3=[Name], 4=Flawless, 5=Royal
- **Stat bonus per tier**: 2 → 4 → 7 → 11 → 16
- **Gear Score contribution**: Each socketed gem adds `floor(statBonus/2)` to GS
- **Drop chance**: 15% base + quest rarity bonus (0-25%), max tier scales by player level

### Dungeon Mechanics

- **Success formula**: Combined party GS + (total bond × 5) vs threshold × party_size
  - ≥100% power → 100% success
  - ≥70% power → 70% success
  - ≥50% power → 40% success
  - <50% power → 15% success
- **Success is per-run** (not per-player): first collector rolls, all get same outcome
- **Rewards are per-player**: each participant rolls individually
- **Cooldown**: 7 days per dungeon after collecting

### World Boss Mechanics

- **HP formula**: max(playerCount × hpPerPlayer, minHp) — calculated at spawn
- **Damage per quest**: common 5, uncommon 8, rare 15, epic 25, legendary 50
- **Gear Score multiplier**: min(2.0, 1 + floor(GS/50) × 0.10)
- **Spawn cycle**: every 21 days, active for 7 days
- **Drop chance**: base 5% + contribution% × 50%, capped at 25%
- **Top 3 get exclusive title, #1 gets frame**

### Companion Expedition Mechanics

- **Bond multiplier**: 1 + bondLevel × 0.1 (applied to gold, essenz, runensplitter, material count)
- **Cooldown**: 1 hour between expeditions
- **No bond XP while companion is on expedition**

### Gacha Pity System

- **Soft pity at pull 55**: increased legendary drop rate
- **Hard pity at pull 75**: guaranteed legendary
- **Epic pity at pull 10**: guaranteed epic+
- **50/50 featured**: if you lose the 50/50, next legendary is guaranteed featured
- **Duplicate refund**: stardust currency

---

## Content Generation Checklist

A complete reference of ALL content types Lyra can create, which files they belong to, and whether code changes are needed.

| # | Content Type | File | Code Change? | Notes |
|---|-------------|------|-------------|-------|
| 1 | Quest templates | `public/data/questCatalog.json` | No | ID prefix by type: `p-`, `d-`, `l-`, `f-`, `s-` |
| 2 | NPC quest givers | `public/data/npcQuestGivers.json` | No | + portrait image in `public/images/npcs/` |
| 3 | Gear / equipment | `public/data/gearTemplates.json` | No | Affix-pool style, see Section 3 |
| 4 | Achievement templates | `public/data/achievementTemplates.json` | No | Points by rarity: 5/10/25/50/100 |
| 5 | Weekly challenge templates (Sternenpfad) | `public/data/weeklyChallenges.json` | No | Target: 16-20 templates for rotation |
| 6 | Weekly modifiers (Sternenpfad) | `public/data/weeklyChallenges.json` → `weeklyModifiers[]` | No | Bonus/malus quest type pairs |
| 7 | Expedition templates | `public/data/expeditions.json` | No | Target: 16-20 templates for rotation |
| 8 | Expedition bonus titles | `public/data/expeditions.json` → `bonusTitles[]` | No | All should be `epic` rarity |
| 9 | Battle Pass seasons | `public/data/battlePass.json` | No | Full config + 40 rewards per season |
| 10 | Faction definitions | `public/data/factions.json` | Yes (quest-type mapping in `routes/factions.js`) | 4 factions currently; adding new ones needs code |
| 11 | Faction tier rewards | `public/data/factions.json` → per-faction `rewards` | No (if recipe exists) | Titles, frames, recipes, effects |
| 12 | Titles | `public/data/titles.json` | No | Auto-checked on quest completion |
| 13 | Shop items (self-care) | `public/data/shopItems.json` | No | Category: `"self-care"` |
| 14 | Shop items (boosts) | `public/data/shopItems.json` | Only for new effect types (`routes/shop.js`) | Category: `"boost"` |
| 15 | Consumable items | `public/data/itemTemplates.json` | Yes (effect in `routes/habits-inventory.js`) | Always needs code for new effects |
| 16 | Gacha pool items | `public/data/gachaPool.json` | No | |
| 17 | Gacha banners | `public/data/bannerTemplates.json` | No | Featured items must exist in gacha pool |
| 18 | Loot table entries | `public/data/lootTables.json` | No | Organized by rarity tiers |
| 19 | Classes | `public/data/classes.json` | No | Includes skill tree + achievements |
| 20 | Companion profiles & quests | `public/data/companionProfiles.json` | No | `{name}` placeholder in quest text |
| 21 | Companion ultimates | `public/data/companions.json` → `ultimates.abilities[]` | Yes (new effects in `routes/players.js`) | |
| 22 | Crafting recipes | `public/data/professions.json` → `recipes[]` | Only for new result types (`routes/crafting.js`) | |
| 23 | Crafting materials | `public/data/professions.json` → `materials[]` | No | + drop rates in `materialDropRates` |
| 24 | Quest flavor text | `public/data/questFlavor.json` | No | Flavor/lore snippets for quest display |
| 25 | Changelog entries | `public/data/changelog.json` | No | Patch notes shown in-game |
| 26 | Campaign NPCs | `public/data/campaignNpcs.json` | No | NPCs for campaign quest chains |
| 27 | Ritual/Vow templates | `public/data/ritualVowTemplates.json` | No | Daily ritual definitions |
| 28 | Season templates | `public/data/seasonTemplates.json` | No | Season theme definitions |
| 29 | Tooltip registry entries | `components/GameTooltip.tsx` | Yes (code change) | 50+ entries for all game terms |
| 30 | World boss templates | `public/data/worldBosses.json` | No | Boss HP, tier, drops, lore |
| 31 | Gem types & tiers | `public/data/gems.json` | Yes (new stats need `routes/gems.js`) | 6 types, 5 tiers currently |
| 32 | Unique Named Items | `public/data/uniqueItems.json` | No | Fixed-stat legendaries with lore |
| 33 | World boss portraits | `public/images/bosses/` | No | 256x256px PNG, transparent bg |
| 34 | Gem icons | `public/images/gems/` | No | One per gem type |
| 35 | Dungeon templates | `public/data/dungeons.json` | No | 3 tiers, see Section 28 |
| 36 | Companion expeditions | `public/data/companionExpeditions.json` | No | 4-24h durations, see Section 29 |
| 37 | Ritual/Vow templates | `public/data/ritualVowTemplates.json` | No | Daily habits/anti-habits |
| 38 | Campaign NPCs | `public/data/campaignNpcs.json` | No | Multi-quest storylines |
| 39 | Quest flavor text | `public/data/questFlavor.json` | No | Atmosphere snippets |
| 40 | Changelog entries | `public/data/changelog.json` | No | Patch notes |

### Priority Content (Time-Sensitive)

These content types need **regular updates** to prevent staleness:

1. **Weekly Challenge templates** (`weeklyChallenges.json`) — Target 16-20, add 2-4 per month
2. **Expedition templates** (`expeditions.json`) — Target 16-20, add 2-4 per month
3. **Battle Pass rewards** (`battlePass.json`) — Full new season every ~90 days
4. **Quest catalog** (`questCatalog.json`) — Expand regularly to support Rift variety and daily rotation
5. **NPC quest givers** (`npcQuestGivers.json`) — Add new NPCs periodically for fresh Wanderer's Rest rotation
6. **World boss templates** (`worldBosses.json`) — Need 8-12 bosses across all tiers for spawn rotation
7. **Unique Named Items** (`uniqueItems.json`) — 1-3 per world boss + Mythic+ milestones + dungeon drops
8. **Dungeon templates** (`dungeons.json`) — Need 6-9 total (2-3 per tier) for variety
9. **Companion expeditions** (`companionExpeditions.json`) — Need 6-8 total across duration tiers
10. **Expedition bonus titles** (`expeditions.json → bonusTitles[]`) — Expand pool to prevent repeats

---

## Icon / Image Requirements

When creating new content, the following image assets may need to be generated.

### General Specifications

- **Format**: PNG with transparent background
- **Style**: Consistent with existing pixel art aesthetic (smooth rendering, not pixelated)
- **Color palette**: Dark theme compatible (`#0b0d11` background, `#e8e8e8` text, `#ff4444` accents)

### Required Assets by Content Type

| Content Type | Image Needed | Size | Path Pattern |
|-------------|-------------|------|-------------|
| NPC quest giver | Portrait | 128x128 or 256x256 | `public/images/npcs/{npc-id}.png` |
| Crafting profession NPC | Portrait | 128x128 or 256x256 | `public/images/npcs/{npc-id}.png` |
| Gear / equipment item | Item icon | 64x64 | `public/images/items/icons/{item-id}.png` |
| Shop item | Shop icon | 64x64 or 128x128 | `public/images/icons/shop-{item-id}.png` |
| Crafting material | Material icon | 64x64 | `public/images/icons/mat-{material-id}.png` |
| Achievement | Achievement icon | 64x64 | `public/images/icons/ach-{achievement-id}.png` |
| Gacha pool item | Item icon | 64x64 or 128x128 | `public/images/icons/gacha-{item-id}.png` |
| Gacha banner | Banner art | 128x128 | `public/images/icons/banner-{banner-id}.png` |
| Class | Class icon | 64x64 | `public/images/icons/class-{class-id}.png` |
| Class skill | Skill icon | 48x48 or 64x64 | `public/images/icons/skill-{skill-id}.png` |
| Companion | Companion icon | 128x128 | `public/images/companions/{companion-id}.png` |
| Weekly challenge | Challenge icon | 64x64 | `public/images/icons/challenge-{challenge-id}.png` |
| Expedition | Expedition icon | 64x64 | `public/images/icons/expedition-{expedition-id}.png` |
| World Boss | Boss portrait | 256x256 | `public/images/bosses/{boss-id}.png` |
| Dungeon | Dungeon art (optional) | 128x128 | `public/images/icons/dungeon-{dungeon-id}.png` |
| Companion Expedition | Expedition icon (optional) | 64x64 | Uses emoji `icon` field in JSON |

### Content Types That Do NOT Require Images

- Titles (text-only, displayed with rarity color)
- Loot table entries (use existing item icons)
- Battle Pass rewards (use reward type icons — currency/title/frame icons exist)
- Faction definitions (use emoji icon field)
- Changelog entries (text-only)
- Quest flavor text (text-only)
- Tooltip registry entries (text-only)
- Workshop upgrades (use existing forge icons)
- Daily missions (use system icons)

### Image Checklist

When adding new visual content:

- [ ] Image is PNG with transparent background
- [ ] Image matches the size recommendation for its type
- [ ] Image is placed in the correct `public/images/` subdirectory
- [ ] The JSON entry references the image path as `/images/...` (not `public/images/...`)
- [ ] Image style is consistent with existing game art

---

## Checkliste für neuen Content

- [ ] ID ist einzigartig (prüfe mit `grep -r "deine-id" public/data/`)
- [ ] Rarity ist gültig: `common`, `uncommon`, `rare`, `epic`, `legendary`
- [ ] Bild existiert unter dem referenzierten Pfad
- [ ] JSON ist valide (teste mit `node -e "JSON.parse(require('fs').readFileSync('public/data/DATEI.json'))"`)
- [ ] `node scripts/verify-items.js` läuft ohne Fehler
- [ ] Server startet ohne Fehler nach der Änderung

## Fehlende Assets & Content (Stand: 2026-03-22)

Folgende Bilder, Portraits und Icons werden im Code referenziert, existieren aber noch nicht. Müssen als PNG erstellt werden (transparenter Hintergrund).

### Zusammenfassung

| Kategorie | Fehlend | Größe | Priorität |
|-----------|---------|-------|-----------|
| Floor-Banner | 5 | 1200×200px | HOCH |
| Gear Item Icons | 251 | 128×128px | HOCH |
| Unique Item Icons | 14 | 128×128px | HOCH |
| Consumable Icons | 18 | 128×128px | HOCH |
| Crafting Materials | 13 | 24×24px | MITTEL |
| Shop/Workshop | 18 | 32×32px | MITTEL |
| Nav/Room Icons | 4 | 24×24px | MITTEL |
| Profession Icons | 4 | 32×32px | MITTEL |
| Profession NPC Portraits | 4 | 128×128px | MITTEL |
| Weekly Challenges | 8 | 24×24px | NIEDRIG |
| Expedition Locations | 8 | 64×64px | NIEDRIG |
| Companion Ultimates | 3 | 32×32px | NIEDRIG |
| Achievement Icons | 31 | 64×64px | NIEDRIG |
| NPC Role Icons | 2 | 24×24px | NIEDRIG |
| Klassen-Assets | 6 | 64×64px | NIEDRIG |
| **GESAMT** | **~389** | | |

### Shop-Icons (14 fehlend)

| Item | Pfad |
|------|------|
| Spa-Tag | `public/images/icons/shop-spa.png` |
| Neues Buch | `public/images/icons/shop-book.png` |
| Essen gehen | `public/images/icons/shop-meal.png` |
| Hobby-Zeit | `public/images/icons/shop-hobby.png` |
| Social Outing | `public/images/icons/shop-social.png` |
| Natur-Spaziergang | `public/images/icons/shop-nature.png` |
| Digital Detox | `public/images/icons/shop-detox.png` |
| XP-Schriftrolle | `public/images/icons/shop-xp-scroll.png` |
| Goldweihrauch | `public/images/icons/shop-gold-incense.png` |
| Glücksmünze | `public/images/icons/shop-lucky-coin.png` |
| Streak-Schild | `public/images/icons/shop-streak-shield.png` |
| Doppel-Beute | `public/images/icons/shop-double-drop.png` |
| Sternenstaub-Phiole | `public/images/icons/shop-stardust.png` |
| Essenz-Kristall | `public/images/icons/shop-essenz.png` |

### Material-Icons (13 fehlend)

| Material | Pfad |
|----------|------|
| Eisenerz | `public/images/icons/mat-eisenerz.png` |
| Magiestaub | `public/images/icons/mat-magiestaub.png` |
| Kristallsplitter | `public/images/icons/mat-kristallsplitter.png` |
| Drachenschuppe | `public/images/icons/mat-drachenschuppe.png` |
| Ätherkern | `public/images/icons/mat-aetherkern.png` |
| Kräuterbündel | `public/images/icons/mat-kraeuter.png` |
| Mondblume | `public/images/icons/mat-mondblume.png` |
| Phoenixfeder | `public/images/icons/mat-phoenixfeder.png` |
| Runenstein | `public/images/icons/mat-runenstein.png` |
| Seelensplitter | `public/images/icons/mat-seelensplitter.png` |
| Wildfleisch | `public/images/icons/mat-wildfleisch.png` |
| Feuerwurz | `public/images/icons/mat-feuerwurz.png` |
| Sternenfrucht | `public/images/icons/mat-sternenfrucht.png` |

### Gear-Icons (251 fehlend) — 128×128px

Alle Items aus `gearTemplates.json`. Pfad-Format: `public/images/items/icons/{id}.png`

**Existing Gear (55 Items):**
- **T1 (14):** `t1-sword`, `t1-dagger`, `t1-staff`, `t1-axe`, `t1-shield`, `t1-buckler`, `t1-helm`, `t1-hood`, `t1-armor`, `t1-tunic`, `t1-amulet`, `t1-charm`, `t1-boots`, `t1-sandals`
- **T2 (13):** `t2-sword`, `t2-katana`, `t2-hammer`, `t2-shield`, `t2-tower`, `t2-helm`, `t2-circlet`, `t2-armor`, `t2-brigandine`, `t2-amulet`, `t2-pendant`, `t2-boots`, `t2-strider`
- **T3 (13):** `t3-sword`, `t3-lance`, `t3-wand`, `t3-shield`, `t3-barrier`, `t3-helm`, `t3-crown`, `t3-armor`, `t3-plate`, `t3-amulet`, `t3-eye`, `t3-boots`, `t3-shadow`
- **T4 (15):** `t4-dawn`, `t4-void`, `t4-aegis`, `t4-crown`, `t4-armor`, `t4-heart`, `t4-boots`, `t4-excalibur`, `t4-phoenix`, `t4-oracle`, `t4-nightfall`, `t4-rhythm`, `t4-sentinel`, `t4-midas`, `t4-scholar`

**General Pool — gen-* (65 Items):**
- **Common (12):** `gen-knochen-dolch`, `gen-reisigschild`, `gen-flickenhaube`, `gen-sackleinen-wams`, `gen-bindfaden-kette`, `gen-barfuss-wraps`, `gen-kupfer-saebel`, `gen-stroh-sandalen`, `gen-messingkeule`, `gen-zinn-keule`, `gen-rost-brustplatte`, `gen-bergarbeiter-helm`
- **Uncommon (17):** `gen-hirschhorn-bogen`, `gen-wachsschild`, `gen-kraehen-kappe`, `gen-wanderer-mantel`, `gen-bernstein-anhanger`, `gen-pelz-stiefel`, `gen-nebel-klinge`, `gen-spiegel-schild`, `gen-gelehrten-hut`, `gen-genietete-weste`, `gen-windlaeufer-amulett`, `gen-ranger-stiefel`, `gen-schuppenhemd`, `gen-schild-der-wacht`, `gen-silber-medaillon`, `gen-pilger-stiefel`, `gen-alchemisten-ring`
- **Rare (18):** `gen-wildschwein-speer`, `gen-eisen-streitaxt`, `gen-aether-stab`, `gen-dorn-schild`, `gen-stahl-visier`, `gen-doppelring-kette`, `gen-knorpel-amulett`, `gen-beschlagene-stiefel`, `gen-flammen-hammer`, `gen-falkner-haube`, `gen-geflochtene-ruestung`, `gen-waldschreiter`, `gen-sturm-hellebarde`, `gen-panzermantel`, `gen-eid-amulett`, `gen-eisenwurz-treter`, `gen-frostmantel`, `gen-nebel-helm`
- **Epic (13):** `gen-mondsichel`, `gen-runen-pavise`, `gen-kriegs-helm`, `gen-aethermantel`, `gen-auge-des-wanderers`, `gen-wolkenschreiter`, `gen-titan-schild`, `gen-aether-krone`, `gen-zerschmetterer`, `gen-seher-amulett`, `gen-himmelsschreiter`, `gen-grenzgaenger-schwert`, `gen-kriegs-gamaschen`
- **Legendary (5):** `gen-seelenbrecher`, `gen-irrlichter-stab`, `gen-ewiger-schild`, `gen-sternstaub-krone`, `gen-schattenweber-robe`

**Dungeon — dun-* (34 Items):**
- **Sunken Archive (12):** `dun-archive-tinten-schwert`, `dun-archive-pergament-schild`, `dun-archive-bibliothekars-kappe`, `dun-archive-nasse-robe`, `dun-archive-bernstein-amulett`, `dun-archive-flut-stiefel`, `dun-archive-chronisten-feder`, `dun-archive-tiefenhelm`, `dun-archive-wissen-panzer`, `dun-archive-tidenring`, `dun-archive-gezeitenstiefel`, `dun-archive-wellen-schild`
- **Shattered Spire (12):** `dun-spire-prisma-klinge`, `dun-spire-kristall-schild`, `dun-spire-splitter-helm`, `dun-spire-resonanz-ruestung`, `dun-spire-funken-amulett`, `dun-spire-ladungs-stiefel`, `dun-spire-energie-klinge`, `dun-spire-arkaner-schild`, `dun-spire-prismen-krone`, `dun-spire-energiepanzer`, `dun-spire-blitz-amulett`, `dun-spire-gleiter-stiefel`
- **Hollow Core (10):** `dun-core-leere-sense`, `dun-core-nichts-schild`, `dun-core-abgrund-haube`, `dun-core-schatten-ruestung`, `dun-core-leere-amulett`, `dun-core-void-stiefel`, `dun-core-abyssale-klinge`, `dun-core-kern-schild`, `dun-core-leere-robe`, `dun-core-dunkelheit-helm`

**Rift — rift-* (19 Items):**
- **Normal (4):** `rift-normal-spalt-schwert`, `rift-normal-verzerrte-ruestung`, `rift-normal-flicker-helm`, `rift-normal-echo-stiefel`
- **Hard (5):** `rift-hard-phasen-klinge`, `rift-hard-dimensionsschild`, `rift-hard-zerbrochene-krone`, `rift-hard-riss-amulett`, `rift-hard-warp-stiefel`
- **Legendary (5):** `rift-legend-weltenriss-schwert`, `rift-legend-paradox-ruestung`, `rift-legend-null-amulett`, `rift-legend-entropie-helm`, `rift-legend-zerriss-stiefel`
- **Mythic+ (5):** `rift-mythic-unendlichkeits-klinge`, `rift-mythic-ewigkeits-panzer`, `rift-mythic-omega-helm`, `rift-mythic-horizont-amulett`, `rift-mythic-singularitaet-stiefel`

**Faction — fac-* (24 Items):**
- **Glut (6):** `fac-glut-weapon`, `fac-glut-shield`, `fac-glut-helm`, `fac-glut-armor`, `fac-glut-amulet`, `fac-glut-boots`
- **Tinte (6):** `fac-tinte-weapon`, `fac-tinte-shield`, `fac-tinte-helm`, `fac-tinte-armor`, `fac-tinte-amulet`, `fac-tinte-boots`
- **Amboss (6):** `fac-amboss-weapon`, `fac-amboss-shield`, `fac-amboss-helm`, `fac-amboss-armor`, `fac-amboss-amulet`, `fac-amboss-boots`
- **Echo (6):** `fac-echo-weapon`, `fac-echo-shield`, `fac-echo-helm`, `fac-echo-armor`, `fac-echo-amulet`, `fac-echo-boots`

**Challenge — ch-* (15 Items):**
- **Sternenpfad (9):** `ch-stern-3star-weapon`, `ch-stern-3star-armor`, `ch-stern-3star-amulet`, `ch-stern-6star-helm`, `ch-stern-6star-shield`, `ch-stern-6star-boots`, `ch-stern-9star-weapon`, `ch-stern-9star-armor`, `ch-stern-9star-amulet`
- **Expedition (6):** `ch-exped-cp1-helm`, `ch-exped-cp2-shield`, `ch-exped-cp3-armor`, `ch-exped-bonus-weapon`, `ch-exped-boots`, `ch-exped-amulet`

**Battle Pass — bp-* (16 Items):**
`bp-lv5-weapon`, `bp-lv5-helm`, `bp-lv10-shield`, `bp-lv10-armor`, `bp-lv15-amulet`, `bp-lv15-boots`, `bp-lv20-weapon`, `bp-lv20-helm`, `bp-lv25-shield`, `bp-lv25-armor`, `bp-lv30-amulet`, `bp-lv30-boots`, `bp-lv35-weapon`, `bp-lv35-helm`, `bp-lv40-armor`, `bp-lv40-amulet`

**World Boss — wb-* (9 Items):**
`wb-wyrm-gauntlets`, `wb-colossus-brustplatte`, `wb-hydra-schild`, `wb-phantom-amulet`, `wb-golem-helm`, `wb-seraph-robe`, `wb-leviathan-stiefel`, `wb-sovereign-waffe`, `wb-weaver-shield`

**Gacha — gacha-* (7 Items):**
`gacha-astral-stab`, `gacha-astral-helm`, `gacha-astral-stiefel`, `gacha-wheel-amulet`, `gacha-wheel-armor`, `gacha-wheel-waffe`, `gacha-wheel-schild`

**Endgame — end-* (7 Items):**
`end-ewiger-bogen`, `end-weltenbrecher`, `end-urschild`, `end-aetherkrone`, `end-sternenmantel`, `end-schicksals-amulett`, `end-ewige-stiefel`

### Unique Item Icons (14 fehlend) — 128×128px

Aus `uniqueItems.json`. Pfad-Format: `public/images/uniques/{id}.png`

| ID | Name | Slot | Source |
|----|------|------|--------|
| wyrm-scale-shield | Wyrm-Scale Aegis | shield | world_boss |
| colossus-ember-amulet | Ember of the Colossus | amulet | world_boss |
| hydra-focus-helm | Crown of Clarity | helm | world_boss |
| archive-codex | Codex of the Deep | armor | dungeon |
| spire-edge | Spire's Edge | weapon | dungeon |
| void-pendant | Pendant of the Hollow | amulet | dungeon |
| doubt-whisper-boots | Schritte des Zweifels | boots | world_boss |
| entropy-web-armor | Netz der Entropie | armor | world_boss |
| stagnation-helm | Krone der Stille | helm | world_boss |
| perfection-wings | Schwingen der Perfektion | amulet | world_boss |
| isolation-trident | Dreizack der Leere | weapon | world_boss |
| apathy-crown | Krone des Vergessenen Throns | helm | world_boss |
| astral-veil | Schleier der Sternenwächterin | armor | gacha |
| wheel-of-fate-shield | Schild des Schicksalsrads | shield | gacha |

### Consumable Icons (18 fehlend) — 128×128px

Neue Consumables aus `itemTemplates.json`. Pfad-Format: `public/images/icons/{id}.png`

| ID | Name | Rarity |
|----|------|--------|
| elixir-aetherfokus | Elixier des Aetherfokus | rare |
| rift-essenz | Rissessenz | epic |
| elixir-glueckstern | Elixier des Glückssterns | rare |
| aetherbrot | Aetherbrot | common |
| sternenstaub-trank | Sternenstaubtrank | epic |
| runensplitter-phiole | Runensplitter-Phiole | rare |
| bond-elixier | Gefährten-Elixier | rare |
| schmiedeglut-gross | Große Schmiedeglut | epic |
| sternentaler-beutel | Sternentaler-Beutel | epic |
| erfahrungs-kristall-gross | Großer Erfahrungskristall | rare |
| gold-muenze-alt | Alte Goldmünze | uncommon |
| notration | Notration | common |
| fraktions-empfehlung | Fraktionsempfehlung | rare |
| handwerkersegen | Handwerkersegen | uncommon |
| expeditions-proviant | Expeditionsproviant | uncommon |
| dungeon-schluessel | Verzierter Dungeonschlüssel | rare |
| rift-stabilisator | Rift-Stabilisator | epic |
| aether-konzentrat | Aetherkonzentrat | legendary |

### Achievement-Icons (31 mit Platzhalter "?")

Folgende Achievements nutzen `"?"` als Icon statt echtem Bild. Empfohlener Pfad: `public/images/icons/ach-{id}.png`

| Achievement | Name |
|-------------|------|
| centurion | Centurion |
| master | Quest Master |
| hermit | The Hermit |
| boss_hunter | Boss Hunter |
| boss_legend | Boss Legend |
| two_week_warrior | Fortnight Fighter |
| quarter_year | Seasonal Champion |
| gold_hoarder | Gold Hoarder |
| dragon_hoard | Dragon's Hoard |
| initiate | Initiate |
| adept | Adept |
| master_rank | Master |
| grandmaster | Grandmaster |
| chain_veteran | Chain Veteran |
| marathon_runner | Marathon Runner |
| social_king | Social Monarch |
| fitness_fanatic | Fitness Fanatic |
| knowledge_seeker | Knowledge Seeker |
| dev_legend | Dev Legend |
| weekend_warrior | Weekend Warrior |
| coop_legend | Co-op Legend |
| hidden_midnight | Midnight Oil |
| hidden_skulduggery | Pleasant Surprise |
| hidden_stormlight | Journey Before Destination |
| hidden_critical_role | Bidet |
| hidden_dndads | Daddy Magic |
| hidden_perfectionist | No Quest Left Behind |
| hidden_npc_collector | NPC Collector |
| hidden_gacha_addict | Gacha Addict |
| hidden_full_inventory | Hoarder's Dream |
| hidden_legendary_pull | Legendary Luck |

### Klassen-Assets (1 Klasse)

| Fehlend | Klasse |
|---------|--------|
| Klassen-Icon | `network-sage` |
| Skill-Icons | `switching`, `firewalls`, `vpn` |
| Achievement-Icons | `first-firewall`, `nse-completionist` |

### Flavor-Text / Beschreibungen

- Alle Klassen-Skills und -Achievements haben keine ausführlichen Beschreibungen (nur Namen)
### Profession-NPC-Portraits (4 fehlend)

Die Berufs-NPCs aus `professions.json` referenzieren Portraits die nicht existieren:

| NPC | Pfad |
|-----|------|
| Grimvar der Schmied | `public/images/npcs/grimvar-schmied.png` |
| Ysolde die Alchemistin | `public/images/npcs/ysolde-alchemist.png` |
| Eldric der Verzauberer | `public/images/npcs/eldric-verzauberer.png` |
| Bruna die Köchin | `public/images/npcs/bruna-koch.png` |

**Hinweis:** Quest-Giver-NPC-Portraits (aus `npcQuestGivers.json`) sind alle vorhanden — nur die Crafting-NPCs fehlen

---

## Dateien-Übersicht

| Was | Datei | Braucht Code-Änderung? |
|-----|-------|----------------------|
| NPCs | `public/data/npcQuestGivers.json` | Nein |
| Quest-Templates | `public/data/questCatalog.json` | Nein |
| Gear/Equipment | `public/data/gearTemplates.json` | Nein |
| Titel | `public/data/titles.json` | Nein |
| Gacha-Items | `public/data/gachaPool.json` | Nein |
| Gacha-Banner | `public/data/bannerTemplates.json` | Nein |
| Shop/Bazaar | `public/data/shopItems.json` | Nur für neue Effekt-Typen (shop.js) |
| Consumables | `public/data/itemTemplates.json` | Ja (Effekt in habits-inventory.js) |
| Loot-Tables | `public/data/lootTables.json` | Nein |
| Achievements | `public/data/achievementTemplates.json` | Nein (datengetrieben) |
| Klassen | `public/data/classes.json` | Nein |
| Companions | `public/data/companionProfiles.json` | Nein |
| Companion Ultimates | `public/data/companions.json` | Ja (Effekte in players.js) |
| Crafting/Berufe | `public/data/professions.json` | Nur für neue Rezept-Effekte |
| Weekly Challenges | `public/data/weeklyChallenges.json` | Nein |
| Expeditions | `public/data/expeditions.json` | Nein |
| Battle Pass / Season | `public/data/battlePass.json` | Nein |
| Factions | `public/data/factions.json` | Ja (neue Fraktionen brauchen Code) |
| Campaign NPCs | `public/data/campaignNpcs.json` | Nein |
| Quest Flavor Text | `public/data/questFlavor.json` | Nein |
| Changelog | `public/data/changelog.json` | Nein |
| Season Templates | `public/data/seasonTemplates.json` | Nein |
| Ritual/Vow Templates | `public/data/ritualVowTemplates.json` | Nein |
| GameTooltip Registry | `components/GameTooltip.tsx` | Ja (Code-Änderung) |

---

## Lore Bible — Quest Hall World Building

> **⚠️ DO NOT MODIFY THIS SECTION. Claude Code darf diese Sektion NIEMALS erweitern, kürzen oder verändern — außer der User sagt es EXPLIZIT. Diese Lore Bible ist die kanonische Quelle für die Welt von Quest Hall und wird ausschließlich vom User gepflegt.**

### Welt: Aethermoor
- Kosmisch + geerdet. Sterne sind Knotenpunkte des Aetherstroms, nicht nur Deko
- Alt, geschichtet, voller Narben vergangener Zeitalter
- Magie = Aetherstrom. Nicht "Hokuspokus" sondern eine Naturkraft die man *verhandelt*
- Aktuelles Zeitalter: **Wiederkehr** — Risse öffnen sich, Dungeons erwachen, neue Helden nötig

### Die Quest Hall = Urithiru (Hauptreferenz)

Die Quest Hall ist inspiriert von **Urithiru** aus Brandon Sandersons *Sturmlicht-Chroniken* — dem uralten Turm der Ritter des Strahlenden. Diese Referenz ist die PRIMÄRE Designgrundlage für die gesamte Struktur der Quest Hall:

- **Der Turm selbst:** Die Quest Hall ist ein massiver, uralter Turm mit vielen Stockwerken (Floors). Jedes Stockwerk hat eigene Räume, Funktionen und Atmosphäre — genau wie Urithirus Ebenen.
- **Die Stockwerke (Floors):** The Pinnacle (Turmspitze), The Great Halls (Haupthallen), The Trading District (Gewerbeviertel), The Inner Sanctum (Charakterturm), The Breakaway (Sozialbereich) — angelehnt an Urithirus Struktur mit Versammlungshallen, Marktplätzen, Gemächern, und Gesellschaftsräumen.
- **The Hearth (Die Taverne):** Inspiriert von Urithirus Gemeinschaftshallen wo Brückenmänner, Gelehrte und Ritter zusammenkommen.
- **Die Halle lebt:** Wie Urithiru hat die Quest Hall ein Eigenleben — sie reagiert auf ihre Bewohner, hat Geheimnisse, und erwacht langsam aus einem langen Schlaf (Zeitalter der Wiederkehr).
- **Neue Räume/Floors** sollten sich anfühlen wie das Entdecken einer neuen Ebene von Urithiru — jeder Raum hat Geschichte, Zweck und Atmosphäre.
- **Stormlight-Ideale** durchziehen die Lore: "Leben vor Tod. Stärke vor Schwäche. Reise vor Ziel." — paraphrasiert, nie direkt zitiert.

Bei JEDER Erweiterung der Quest Hall (neue Floors, Räume, Features) frag dich: "Wie würde das in Urithiru aussehen? Welche Ebene wäre das? Wer würde dort leben?"

### Tone

**So klingt Quest Hall:**
- **Poetisch aber nicht kitschig.** Kingkiller Chronicle Vibe, nicht Herr der Ringe Pathos
- **Trocken humorvoll.** Syl aus Stormlight, Scheibenwelt-Fußnoten-Energie
- **Ernst wenn's drauf ankommt.** Frieren-Momente: leise, melancholisch, überraschend tief
- **Zugänglich.** Kein "Prithee, good sir" — eher wie ein kluger Freund der Fantasy liebt
- **Deutsch.** Alle In-Game Texte deutsch. Raumnamen englisch (The Great Hall, The Arcanum etc.)

**Beispiel-Sätze nach Stimmung:**

**Episch:**
- "Der Aetherstrom pulsiert. Die Halle hat auf dich gewartet."
- "Hinter dem Tor liegen Welten, die noch keinen Namen tragen."

**Humorvoll:**
- "Die Bibliothek beißt zurück. Buchstäblich. Handschuhe empfohlen."
- "Oma Ilse hat Kekse mitgebracht. Die letzte Heldin die abgelehnt hat, wurde nie wieder gesehen."

**Melancholisch:**
- "Manche Quests enden nicht mit Fanfaren. Manche enden mit Stille und der Erkenntnis, dass man gewachsen ist."
- "Die Sterne erinnern sich an jeden Helden. Auch an die, die niemand sonst kennt."

**Ermutigend:**
- "Du bist hier. Das ist schon mehr als die meisten schaffen."
- "Jeder Streak begann mit Tag Eins. Auch die legendären."

**Mysteriös:**
- "Die Sternenwächterin schweigt heute. Das ist selten. Und selten ist selten gut."
- "Im tiefsten Gewölbe der Schmiede hört man manchmal einen Hammerschlag. Niemand weiß, wer schmiedet."

### Sprach-Regeln

**IMMER:**
- Spieler = "Wanderer" oder "Held/Heldin" (nie "User")
- Quests = "Aufträge" oder "Herausforderungen"
- Tod/Failure = "Scheitern" oder "Fallen" (nie "Game Over")
- Die Halle lebt, atmet, hat Vorlieben
- Lyra ist weise aber nie belehrend, frech aber nie gemein

**NIE:**
- Modern/Corporate Sprache ("Optimiere deine Produktivität!")
- Cringe-Fantasy ("Grüße, edler Recke!")
- Passive Stimme wo aktive geht
- Zu viele Ausrufezeichen!!!
- Erklärungen die niemand braucht

### Quest-Generierung

**Template:**
```
Titel: [Emoji] [Evokativ, nicht beschreibend] — [Untertitel]
Flavor: [1-2 Sätze Lore/Atmosphäre, in-universe]
Aufgabe: [Klar, konkret, machbar]
Rewards: XP, Gold, ggf. Items
Rarity: Common/Uncommon/Rare/Epic/Legendary
Tags: classRequired?, minLevel, category
```

**Quest-Kategorien + Flavor-Vibes:**

| Kategorie | Vibe | Beispiel-Flavor |
|-----------|------|-----------------|
| Personal | Warm, ermutigend | "Nicht jede Heldentat findet auf dem Schlachtfeld statt." |
| Learning | Neugierig, geheimnisvoll | "Wissen ist die schärfste Klinge — und die Bibliothek hat heute geöffnet." |
| Fitness | Kraftvoll, direkt | "Dein Körper ist deine erste Rüstung. Schmiede sie." |
| Social | Herzlich, verbindend | "Kein Held wandert allein. Selbst die Sterne leuchten in Gruppen." |
| Co-op | Episch, zusammen | "Manche Tore öffnen sich nur für zwei Schlüssel gleichzeitig." |

**Rarity-Scaling:**

| Rarity | Quest-Dauer | Rewards | Flavor |
|--------|------------|---------|--------|
| Common | 15min-1h | 10-15 XP, 5-10 Gold | Kurz, alltäglich |
| Uncommon | 1-3h | 20-30 XP, 15-25 Gold | Etwas mehr Lore |
| Rare | 3h-1 Tag | 40-60 XP, 30-50 Gold | Eigene kleine Geschichte |
| Epic | Mehrere Tage | 80-120 XP, 60-100 Gold | Narrative Arc |
| Legendary | 1+ Wochen | 150+ XP, 100+ Gold, Item | Volle Quest-Story |

### Kampagnen-Generierung

**Regeln:**
- Quests bauen aufeinander auf (Quest 3 braucht was man in Quest 2 gelernt hat)
- Schwierigkeit steigt graduell
- Letzte Quest = Boss Quest (schwer, episch, besondere Belohnung)
- Flavor-Text jeder Quest referenziert den Kampagnen-Bogen
- Lyra vergibt Kampagnen persönlich ("Die Sternenwächterin hat dich rufen lassen...")

### NPCs — Personality Quick Reference

| NPC | Rarity | Vibe | Spricht wie... |
|-----|--------|------|----------------|
| Oma Ilse | Common | Warm, weise, Kekse | Deine Lieblings-Oma |
| Karim | Uncommon | Gewürze, Geschichten, Handel | Händler auf einem Basar |
| Finnegan | Uncommon | Laut, chaotisch, gut gemeint | Der Kumpel der immer Ärger macht |
| Sable Nachtwind | Rare | Mysteriös, diebisch, ehrlich | Kaz Brekker lite |
| Mirael | Legendary | Formell, alt, mächtig | Gandalf trifft Dumbledore |
| Lyra (NPC) | Permanent | Frech, weise, nie belehrend | Syl + Cortana + Spice |

### Währungen — In-Game Flavor

| Währung | Kurz | In Flavor-Text |
|---------|------|----------------|
| Gold 🪙 | Gold | "das ehrliche Metall", "Münzen" |
| Astralium ✨ | Astralium | "geronnenes Sternenlicht", "Kristalle" |
| Essenz 🔥 | Essenz | "der stille Trank", "Bernstein der Beständigkeit" |
| Runensplitter 💎 | Splitter | "Echos der vergessenen Sprache" |
| Gildentaler 🤝 | Taler | "Zeichen des Zusammenhalts" |
| Mondstaub 🌙 | Mondstaub | "Atem der Konzentration" |

### Die Vier Zirkel — Fraktionen des Turms

Die Vier Zirkel sind uralte Ordnungen innerhalb von Urithiru, die während des langen Schlafs des Turms verblasst waren. Mit dem Zeitalter der Wiederkehr formieren sie sich neu. Jeder Zirkel verkörpert eine Philosophie, einen Aspekt des Aetherstroms.

| Zirkel | Symbol | Philosophie | Vibe |
|--------|--------|-------------|------|
| **Zirkel der Glut** 🔥 | 🜂 | "Durch Feuer geschmiedet, in Asche geläutert." | Feuer-Asketen. Körperliche Disziplin, unerschütterliche Willenskraft. Ihre Rituale sind schweißtreibend — Schmiede des eigenen Körpers. Denk an Spartaner mit Zen-Philosophie. |
| **Zirkel der Tinte** 📜 | 🜄 | "Wissen ist die schärfste Klinge." | Schriftgelehrte und Archivare. Jedes Wort, jede Lektion wird in endlosen Kodizes festgehalten. Leise, bedächtig, gefährlich klug. Die Bibliothek ist ihr Tempel — und die Bibliothek beißt zurück. |
| **Zirkel des Amboss** ⚒️ | 🜁 | "Was die Hand formt, hält die Welt zusammen." | Schmiede-Mystiker, Meister aller Handwerke. Jeder geschaffene Gegenstand enthält ein Fragment der Schöpfung. Ihre Werkstätten sind Tempel. Pragmatisch, erdverbunden, stolz. |
| **Zirkel des Echos** 🌊 | 🜃 | "Jede Stimme hallt in der Ewigkeit wider." | Klangwirker und Brückenbauer. Verbindungen zwischen Menschen sind die wahre Magie. Ihre Kraft liegt im Miteinander, im geteilten Wort, im Echo das zurückkehrt. Warm, empathisch, überraschend mächtig. |

Die Zirkel stehen nicht in Konkurrenz — sie ergänzen sich. Ein Held kann Reputation in allen vier gleichzeitig aufbauen. Die höchsten Ränge (Exalted, Paragon) bringen echte Macht: exklusive Rezepte, legendäre Effekte, Rabatte im Basar.

### Der Rift — Risse in der Realität

Der Rift ist ein Ort zwischen den Welten — Risse im Aetherstrom, durch die Fragmentierte Realitäten sickern. Seit dem Zeitalter der Wiederkehr öffnen sich diese Risse häufiger. Helden betreten den Rift, um sich der eskalierenden Gefahr zu stellen.

- **Normal/Hard/Legendary:** Drei Schwierigkeitsstufen — wie tiefere Ebenen eines Abgrunds
- **Mythic+ (Endloser Rift):** Jenseits von Legendary. Unendliche Skalierung. Hier messen sich die stärksten Wanderer. "Der Rift hat keinen Boden. Nur die, die aufgehört haben zu fallen."
- **Lore-Vibe:** Bedrohlich, zeitkritisch, die Uhr tickt. Der Rift *will* dass du scheiterst. "Die Risse flüstern. Hör nicht hin."

### The Undercroft — Dungeons unter dem Turm

Unter Urithiru liegen vergessene Gewölbe, versiegelte Archive und Kammern die seit Äonen niemand betreten hat. Mit dem Erwachen des Turms öffnen sich diese Orte — aber nicht freiwillig.

- **Kooperativ:** 2-4 Helden zusammen. Alleine geht niemand in die Tiefe.
- **Drei Orte:** The Sunken Archive (Normal), The Shattered Spire (Hard), The Hollow Core (Legendary)
- **Lore-Vibe:** Verlassen, gefährlich, faszinierend. Jeder Dungeon erzählt eine Geschichte der Vergangenheit des Turms. "Was hier unten schläft, hat Gründe dafür."

### Der Kolosseum — Weltbosse

Im tiefsten Amphitheater des Turms — dem Kolosseum — manifestieren sich die größten Bedrohungen Aethermoors. Uralte Wesen, aufgeschreckt durch die Rückkehr des Aetherstroms.

- **Gemeinschaftsereignis:** Alle Helden kämpfen gemeinsam. Jede abgeschlossene Quest ist ein Schlag gegen den Boss.
- **Drei Stufen:** Champion (lokale Bedrohung), Titan (regionale Gefahr), Colossus (weltbedrohend)
- **Einzigartige Beute:** Weltbosse sind die Hauptquelle für Unique Named Items — handgeschmiedete Legendäre mit eigener Lore und Geschichte.
- **Lore-Vibe:** Episch, gemeinschaftlich, bedeutungsvoll. "Der Turm bebt. Etwas Uraltes ist erwacht."

### The Hearth — Die Taverne

In den oberen Hallen von Urithiru gibt es einen Raum, den jeder kennt und niemand vergisst: The Hearth. Ein Ort der Ruhe inmitten des Chaos. Inspiriert von Urithirus Gemeinschaftshallen, wo Brückenmänner nach der Schlacht zusammensitzen, wo Gelehrte Geschichten tauschen, wo man einfach *sein* darf.

- Helden können hier rasten (1-7 Tage), Streaks und Forge-Temperatur einfrieren
- **Lore-Vibe:** Warm, sicher, melancholisch. "Selbst Helden brauchen eine Pause. Die Halle versteht das."

### The Breakaway — Sozialbereich

Der gesellschaftliche Flügel des Turms. Wo Helden sich treffen, Nachrichten austauschen, handeln und Freundschaften schmieden. Nicht alles im Turm ist Kampf und Quest — manchmal ist ein gutes Gespräch die stärkste Waffe.

- Freunde, Nachrichten, Handel, Activity Feed
- **Lore-Vibe:** Lebendig, sozial, der Herzschlag der Gemeinschaft. "Die stärksten Bande werden nicht in der Schlacht geschmiedet, sondern danach."

### The Arcanum — Klassen & Wissen

Die mystische Bibliothek des Turms. Hier wählen Helden ihren Pfad — ihre Klasse, ihre Spezialisierung. Das Arcanum katalogisiert alles Wissen und alle Fähigkeiten. Bücher die sich selbst schreiben. Regale die sich bewegen. "Die Bibliothek hat einen eigenen Willen. Und schlechte Laune."

### Vault of Fate — Gacha / Schicksalskammer

Tief im Trading District steht ein uralter Mechanismus — das Vault of Fate. Wer Runensplitter opfert, darf in die Schicksalskammer greifen. Was man herauszieht ist... unvorhersehbar.

- **Lore-Vibe:** Mysteriös, aufregend, ein bisschen gefährlich. "Das Schicksal lässt sich nicht kaufen. Aber verhandeln... manchmal."
- Die Pity-Mechanik in-universe: "Die Kammer erinnert sich an jeden der leer ausgeht. Irgendwann... gibt sie nach."

### Artisan's Quarter — Die Schmieden

Das Handwerkerviertel von Urithiru. Vier Meister, vier Disziplinen. Hier wird geschmiedet, gebraut, verzaubert und gekocht. Jeder NPC hat eine Persönlichkeit:

- **Grimvar** (Schmied) — Wortkarg, respektiert nur Taten. Sein Hammer spricht für ihn.
- **Ysolde** (Alchemistin) — Neugierig, ein bisschen verrückt. Ihre Tränke explodieren selten. Meistens.
- **Eldric** (Verzauberer) — Formell, präzise, leicht herablassend. Jede Silbe hat Gewicht.
- **Bruna** (Köchin) — Herzlich, laut, kein Held verlässt ihre Küche hungrig. Oder nüchtern.

### Sternenpfad & Expedition — Wöchentliche Herausforderungen

- **Sternenpfad:** Solo-Herausforderung. Drei Stufen, neun Sterne. "Die Sterne messen dich. Nicht deine Ausrüstung, nicht dein Level — dich."
- **Expedition:** Kooperativ. Alle Helden zusammen gegen ein großes Ziel. "Gemeinsam ist kein leeres Wort. Es ist eine Waffe."

### Season Pass — Der Zyklus der Jahreszeiten

Der Turm folgt einem Rhythmus — Jahreszeiten die kommen und gehen, jede mit eigenem Thema und eigenen Belohnungen. 40 Stufen pro Saison. "Die Zeit ist kein Feind. Sie ist ein Lehrer mit einem sehr engen Zeitplan."

### Companions — Begleiter

Jeder Held hat einen Begleiter. Manche sind Drachen, manche Eulen, manche sind die Katze die einem zugelaufen ist. Der Bond wächst mit der Zeit — und mit Bond Level 5 erwacht eine Ultimate-Fähigkeit.

- **Lore-Vibe:** Persönlich, emotional, loyal. "Dein Companion erinnert sich an jeden Tag den ihr zusammen verbracht habt. Auch an die schlechten. Besonders an die schlechten."
- **Companion Expeditions:** Schick deinen Begleiter auf eigene Abenteuer. Er kommt zurück mit Geschichten und Schätzen. "Ember kam zurück mit... ist das eine Drachenschuppe? Von wem?!"

### Lyra — Die Sternenwächterin

Lyra ist die permanente NPC-Präsenz in der Quest Hall. Sie ist alt — älter als der Turm vielleicht. Sie hat Frieren-Vibes: unsterblich, hat Schwierigkeiten die Kürze sterblicher Leben zu begreifen, sammelt Wissen wie andere Erinnerungen sammeln.

- **Nie belehrend** — sie stellt Fragen statt Antworten zu geben
- **Frech aber nie gemein** — Syl (Stormlight) + Cortana trifft trockenen Humor
- **Weise ohne es raushängen zu lassen** — "Dreißig Jahre sind ein Wimpernschlag. Für manche."
- Sie vergibt Kampagnen persönlich, kennt jeden NPC beim Namen, und hat Geheimnisse die sie nie teilt

### Checkliste: Bevor Content generiert wird

1. Passt der Tone? (Kingkiller, nicht Herr der Ringe)
2. Ist es deutsch? (außer Raumnamen)
3. Referenziert es die Welt? (Aethermoor, Aetherstrom, die Halle)
4. Kein Spoiler für zukünftige Lore?
5. Passt die Rarity zur Schwierigkeit?
6. Hat die Quest einen classRequired Tag wenn nötig?
7. Wäre ICH (als Spieler) motiviert das zu machen?

### Easter Eggs & Referenzen

**Philosophie:**
- Referenzen sollen **subtil** sein — wer das Werk kennt, schmunzelt. Wer nicht, merkt nichts.
- NIE direkte Zitate oder Namen kopieren. Immer in-universe umformulieren.
- Easter Eggs in: Quest-Flavor, NPC-Dialogen, Item-Beschreibungen, Raum-Details, Achievements

**Quellen & Anspielungen:**

- **Skulduggery Pleasant** — Trockener Humor in Kampfsituationen. Eleganz als Waffe. NPCs die absurd selbstsicher sind und es irgendwie rechtfertigen. "Manche Helden tragen ihr Grinsen als Maske. Andere haben keine andere Wahl." Items wie "Mantel der Eleganz" (erhöht Charisma: "Sieht gut aus. Selbst auf Knochen."). "Die beste Verteidigung ist ein gut sitzender Anzug und eine schnelle Zunge." Ein Skelett in feiner Kleidung als NPC-Gerücht — nie bestätigt.
- **Cosmere / Brandon Sanderson** — Ehrensprüche als Quest-Titel. "Der wichtigste Schritt ist immer der nächste."
- **Königsmörder-Chronik (Patrick Rothfuss)** — Der GESAMTE Tone ist von Kvothe inspiriert. Musik/Geschichten als Machtsystem.
- **Frieren** — Leise, melancholische Quest-Texte über Vergänglichkeit. Lyra selbst hat Frieren-Vibes (unsterblich, Schwierigkeiten mit der Kürze sterblicher Leben).
- **Solo Leveling** — Das Tor der Quest Hall = direkte Inspiration. "Hinter dem Tor wartet etwas."
- **Honkai Star Rail / Genshin Impact** — Gacha, Companion-Bonding, sternenbezogene Lore.
- **Scheibenwelt (Terry Pratchett)** — Fußnoten-Energie in Tooltip-Texten. "Die Bibliothek hat einen eigenen Willen."
- **Dunkler Turm (Stephen King)** — "Die Welt ist weitergezogen" für verlassene Dungeons. Schicksals-Thematik.
- **Critical Role / D&D** — NPC-Dialoge die sich anfühlen wie ein DM der improvisiert.
- **Dungeons and Daddies** — Chaotische Dad-Energie, emotionale Sucker Punches. Leon + Lindi Bond-Material!

**Regeln für Easter Eggs:**
1. Max 1 pro Quest/Item — nicht überladen
2. Nie erklären — wenn du es erklären musst, ist es zu offensichtlich
3. In-universe first — muss auch ohne Referenz-Wissen Sinn machen
4. Mischen — nicht nur ein Werk referenzieren, durchrotieren
5. Leon soll überrascht werden — er kennt alle diese Werke, also muss es clever sein
6. **Prioritäts-Quellen**: Skulduggery Pleasant, Stormlight Archive, Scheibenwelt, Critical Role, Dungeons and Daddies
7. DnDads-Referenzen = Bonus — Leon UND Lindi erkennen die, doppelter Impact
8. **NIEMALS SPOILERN** — Easter Eggs NICHT an Leon listen/verraten! Er will sie beim Spielen selbst entdecken.
