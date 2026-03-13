# Template System — Data-Driven Content Guide

All game content (quests, NPCs, gear, shop items, achievements, etc.) is driven by JSON files.
**Adding new content = editing JSON files. No code changes required.**

## JSON Data Files

All data files live in `public/data/`. The backend loads them on startup via `lib/state.js`.

### Quest Content

| File | Purpose | Key Fields |
|------|---------|------------|
| `questCatalog.json` | Quest templates for rotation/pool system | `id`, `title`, `description`, `type`, `priority`, `category`, `product`, `tags` |
| `questFlavor.json` | Flavor text shown on quest board | Array of strings |
| `npcQuestGivers.json` | NPC quest givers with full quest chains | `id`, `name`, `emoji`, `title`, `questChains[]`, `spawnWeight`, `cooldownHours` |
| `dobbieCompanion.json` | Dobbie companion quests and mood quotes | `quests[]`, `moodQuotes{}` |

**To add 50 new quests:** Edit `questCatalog.json` — add entries to the array. Each entry needs at minimum:
```json
{
  "id": "unique-quest-id",
  "title": "Quest Title",
  "description": "What to do",
  "type": "personal",
  "priority": "medium",
  "category": "general",
  "xp": 20,
  "gold": 5
}
```

**To add a new NPC quest giver:** Edit `npcQuestGivers.json` — add to the `givers` array:
```json
{
  "id": "new-npc",
  "name": "NPC Name",
  "emoji": "x",
  "title": "The Title",
  "description": "NPC description",
  "rarity": "uncommon",
  "spawnWeight": 30,
  "cooldownHours": 48,
  "departureDurationHours": 72,
  "greeting": "Hello adventurer...",
  "questChains": [
    {
      "id": "chain-1",
      "title": "Chain Title",
      "quests": [
        { "title": "Step 1", "description": "Do this", "xp": 25, "gold": 10 }
      ]
    }
  ]
}
```

### Equipment & Shop

| File | Purpose |
|------|---------|
| `gearTemplates.json` | Full gear catalog (70+ items, 4 tiers) |
| `shopItems.json` | Shop reward items + gear tier summary (used by frontend) |
| `lootTables.json` | Loot drop tables by rarity |
| `itemTemplates.json` | Item system schema (slots, types, tiers, stats) |

**To add a new shop reward:** Edit `shopItems.json` → `items` array.
**To add new gear:** Edit `gearTemplates.json` (backend) and `shopItems.json` → `gearTiers` (frontend display).

### Player Progression

| File | Purpose |
|------|---------|
| `achievementTemplates.json` | Achievement definitions (category, threshold, rewards) |
| `levels.json` | XP thresholds per level |
| `classes.json` | Character class definitions |
| `companions.json` | Companion types and bonuses |
| `ritualVowTemplates.json` | Ritual/Vow commitment templates |
| `seasonTemplates.json` | Seasonal event definitions |

### Game Economy

| File | Purpose |
|------|---------|
| `gameConfig.json` | Core constants: XP/gold by priority, streak milestones, rarity weights/colors, forge temp settings |

**To adjust XP rewards:** Edit `gameConfig.json` — change values in `xpByPriority`, `goldByPriority`, etc.

### Runtime State (auto-managed, don't edit manually)

| File | Purpose |
|------|---------|
| `quests.json` | Active quest instances |
| `users.json` | Player accounts and progress |
| `agents.json` | Agent roster and status |
| `playerProgress.json` | Per-player tracking |
| `npcState.json` | Active NPC state |
| `rotationState.json` | Daily rotation state |
| `habits.json` | Habit tracking |
| `rituals.json` | Active rituals |
| `appState.json` | App-level state |
| `achievementTemplates.json` | Earned achievements |

## Frontend Config

`app/config.ts` contains visual styling config (colors, icons) for quest types, categories, products, and priorities. To add a new quest type that renders correctly, add an entry to `typeConfig` in this file.

## Architecture Overview

```
public/data/*.json          ← Content lives here (edit these)
  ↓
lib/state.js                ← Loads all JSON at startup
  ↓
routes/*.js (12 files)      ← REST API serves loaded data
  ↓
components/*.tsx             ← UI renders from API responses + JSON imports
```

The frontend also imports some JSON files directly for client-side rendering:
- `components/QuestPanels.tsx` ← `dobbieCompanion.json`
- `components/ShopView.tsx` ← `shopItems.json`
- `components/ShopModal.tsx` ← `shopItems.json`
- `components/UserCard.tsx` ← `shopItems.json` (gear icons)
