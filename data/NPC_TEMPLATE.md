# NPC Quest Giver Template

This file documents how to add new wandering NPC quest givers to `npcQuestGivers.json`.

---

## Required Fields

```json
{
  "id": "unique-kebab-case-id",
  "name": "Display Name",
  "title": "Short subtitle shown under the name",
  "emoji": "🧙",
  "portrait": "/images/npcs/your-npc-portrait.png",
  "rarity": "common",
  "greeting": "Spoken intro line shown in the speech bubble.",
  "description": "Longer backstory (optional, for internal reference).",
  "stayDays": 3,
  "cooldownDays": 14,
  "questChain": [ ... ],
  "finalReward": { ... }
}
```

---

## Rarity Levels

| Rarity    | Stars | Glow Color | Suggested stayDays | Suggested cooldownDays |
|-----------|-------|------------|---------------------|------------------------|
| common    | ★     | #9ca3af    | 2–3                 | 10–16                  |
| uncommon  | ★★    | #22c55e    | 3–4                 | 14–18                  |
| rare      | ★★★   | #60a5fa    | 2–3                 | 18–21                  |
| epic      | ★★★★  | #a78bfa    | 3–4                 | 18–25                  |
| legendary | ★★★★★ | #f59e0b    | 1–2                 | 28–35                  |

- **stayDays**: how many days the NPC stays after spawning.
- **cooldownDays**: how many days before they can spawn again after departing.

---

## Quest Chain Structure

Each item in `questChain` is unlocked in order — the player must complete quest N before quest N+1 becomes available.

```json
"questChain": [
  {
    "title": "📦 Quest Title",
    "description": "What the player needs to do in real life. Be specific and fun.",
    "type": "personal",
    "priority": "low",
    "rewards": { "xp": 20, "gold": 10 }
  },
  {
    "title": "🗺️ Second Quest",
    "description": "Follow-up task. Escalate difficulty slightly.",
    "type": "social",
    "priority": "medium",
    "rewards": { "xp": 30, "gold": 15 }
  }
]
```

### Quest Types

| type        | Emoji | Description                          |
|-------------|-------|--------------------------------------|
| personal    | 🧘    | Self-improvement, habits, reflection |
| learning    | 📚    | Study, research, skill-building      |
| fitness     | 💪    | Exercise, movement, health           |
| social      | 🤝    | Connection, communication, giving    |
| development | ⚙     | Technical / coding tasks             |
| boss        | 🐉    | Major challenge (used sparingly)     |

### XP / Gold Guidelines

| Priority | Base XP | Base Gold |
|----------|---------|-----------|
| low      | 15–25   | 8–15      |
| medium   | 25–40   | 12–20     |
| high     | 40–60   | 20–30     |

---

## Final Reward

Awarded when the player completes the entire quest chain.

```json
"finalReward": {
  "type": "unique_item",
  "item": {
    "id": "unique-item-id",
    "name": "Item Display Name",
    "emoji": "🗡️",
    "rarity": "rare",
    "slot": "weapon",
    "stats": { "kraft": 3, "glueck": 2 },
    "desc": "Flavour text. Keep it short and evocative."
  }
}
```

### Item Slots: `weapon`, `helm`, `amulet`, `ring`
### Stat Keys: `kraft` (strength), `ausdauer` (endurance), `glueck` (luck), `weisheit` (wisdom)

---

## Full Example — Adding a New NPC

```json
{
  "id": "tinker-vera",
  "portrait": "/images/npcs/tinker-vera.png",
  "rarity": "uncommon",
  "greeting": "Oh! You startled me. I was just fixing... everything.",
  "name": "Tinker Vera",
  "emoji": "🔧",
  "title": "Wandering Inventor",
  "description": "An eccentric engineer who travels with a cart full of half-finished gadgets.",
  "stayDays": 3,
  "cooldownDays": 16,
  "questChain": [
    {
      "title": "🔩 Screw Loose",
      "description": "Vera needs a hand. (Tidy your workspace or fix one small thing that's been broken for a while)",
      "type": "personal",
      "priority": "low",
      "rewards": { "xp": 20, "gold": 12 }
    },
    {
      "title": "💡 The Prototype",
      "description": "'Every great invention starts with a sketch.' (Brainstorm or plan a project for 20 minutes)",
      "type": "learning",
      "priority": "medium",
      "rewards": { "xp": 35, "gold": 18 }
    }
  ],
  "finalReward": {
    "type": "unique_item",
    "item": {
      "id": "vera-wrench",
      "name": "Vera's Lucky Wrench",
      "emoji": "🔧",
      "rarity": "uncommon",
      "slot": "weapon",
      "stats": { "kraft": 2, "weisheit": 3 },
      "desc": "Still has grease on it. Smells faintly of possibility."
    }
  }
}
```

---

## Notes

- Portraits should be pixel-art style, 148×148px PNG, placed in `/public/images/npcs/`.
- The `greeting` is shown in the speech bubble — keep it in character and under ~100 chars.
- Chain length of 2–3 quests is ideal; avoid more than 4.
- NPCs are spawned by the server (`server.js`) based on rarity weights and cooldowns — no code changes needed to add a new NPC, just add to this JSON file and restart the server.
