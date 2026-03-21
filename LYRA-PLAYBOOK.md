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

## Checkliste für neuen Content

- [ ] ID ist einzigartig (prüfe mit `grep -r "deine-id" public/data/`)
- [ ] Rarity ist gültig: `common`, `uncommon`, `rare`, `epic`, `legendary`
- [ ] Bild existiert unter dem referenzierten Pfad
- [ ] JSON ist valide (teste mit `node -e "JSON.parse(require('fs').readFileSync('public/data/DATEI.json'))"`)
- [ ] `node scripts/verify-items.js` läuft ohne Fehler
- [ ] Server startet ohne Fehler nach der Änderung

## Fehlende Assets & Content (Stand: 2026-03-19)

Folgende Bilder, Portraits und Icons werden im Code referenziert, existieren aber noch nicht. Müssen als PNG erstellt werden (empfohlen: 64×64 oder 128×128, transparenter Hintergrund).

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

### Item-Template-Icons (50 fehlend)

Icons aus `itemTemplates.json` unter `public/images/items/icons/` — betrifft Gear-Items die als Loot/Inventar-Items referenziert werden:
- **T1 (14 Items):** `t1-sword`, `t1-dagger`, `t1-staff`, `t1-axe`, `t1-shield`, `t1-buckler`, `t1-helm`, `t1-hood`, `t1-armor`, `t1-tunic`, `t1-amulet`, `t1-charm`, `t1-boots`, `t1-sandals`
- **T2 (13 Items):** `t2-sword`, `t2-katana`, `t2-hammer`, `t2-shield`, `t2-tower`, `t2-helm`, `t2-circlet`, `t2-armor`, `t2-brigandine`, `t2-amulet`, `t2-pendant`, `t2-boots`, `t2-strider`
- **T3 (12 Items):** `t3-sword`, `t3-lance`, `t3-wand`, `t3-shield`, `t3-barrier`, `t3-helm`, `t3-crown`, `t3-armor`, `t3-plate`, `t3-amulet`, `t3-eye`, `t3-boots`, `t3-shadow`
- **T4 (10 Items):** `t4-dawn`, `t4-void`, `t4-aegis`, `t4-crown`, `t4-armor`, `t4-heart`, `t4-boots`, `t4-excalibur`, `t4-phoenix`, `t4-oracle`

Pfad-Format: `public/images/items/icons/{id}.png`

**Hinweis:** `gearTemplates.json` (Affix-Definitions) hat kein `icon`-Feld — nur `itemTemplates.json` (Inventar-Items) referenziert diese Icons.

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
| Achievements | `public/data/achievementTemplates.json` | Ggf. Trigger in state.js |
| Klassen | `public/data/classes.json` | Nein |
| Companions | `public/data/companionProfiles.json` | Nein |
| Crafting/Berufe | `public/data/professions.json` | Nur für neue Rezept-Effekte |
