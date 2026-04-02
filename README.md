# Quest Hall

> Gamified quest management system with RPG mechanics. Real-world tasks become quests in an ancient tower.

## What is this?

Quest Hall turns daily tasks into an RPG adventure. Complete quests, earn XP, level up, craft gear, pull gacha, challenge world bosses, and climb the leaderboard. Built as a self-hosted web app with an optional Electron desktop companion.

**Design References:** WoW Classic (professions, grind), Diablo 3 (loot, affixes, Kanai's Cube), Honkai Star Rail (gacha, daily missions), Habitica (real tasks as quests).

## Quick Start

```bash
# Install
npm install

# Run (two terminals)
npm run dev          # Frontend: http://localhost:3000
npm run server       # Backend:  http://localhost:3001

# Or via Docker
docker compose up -d # Both at http://localhost:3001
```

Set `API_KEY=your-secret` in `.env` (see `.env.example`).

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| Backend | Express.js 4.18, Node.js 20 |
| Desktop | Electron 29 (Quest Forge companion app) |
| Storage | JSON files in `/data` (no database) |
| Deploy | Docker (Node 20 Alpine), Docker Compose |

## Game Systems

- **50 Levels** with prestige titles (31-50)
- **Quest Board** with pool rotation, rarity tiers, daily diminishing returns
- **8 Crafting Professions** (WoW Classic 300-skill system)
- **Diablo 3 Loot** — affix rolling, legendary effects, set bonuses, Kanai's Cube
- **Gacha** with soft pity (55) and hard pity (75)
- **World Bosses** — community-wide HP pool, contribution tracking
- **Dungeons** — async cooperative 2-4 player, 3 tiers
- **The Rift** — timed quest chains, Normal/Hard/Legendary + Mythic+
- **Season Pass** — 40-level reward track
- **4 Factions** with 6 reputation tiers
- **Talent Tree** — 44-node circular skill tree (Wolcen-inspired)
- **Adventure Tome** — per-floor completionist tracker
- **Social** — friends, messaging, trading, activity feed
- **Companions** with bond levels, ultimates, expeditions
- **6 Gem types** with 5 tiers, socketing, upgrading

## Project Structure

```
app/            # Next.js frontend (page.tsx, types, config)
components/     # 55 React components
hooks/          # Custom React hooks
lib/            # Backend core (state, helpers, auth, NPC engine)
routes/         # 31 Express API route files
public/data/    # 56 JSON game data files
public/images/  # Pixel art assets
electron-quest-app/  # Desktop companion
```

## API

All endpoints under `/api/`. Auth via JWT Bearer token or `X-API-Key` header.

Key endpoints:
- `GET /api/dashboard?player=X` — batch endpoint (replaces 14 individual fetches)
- `POST /api/quest/:id/complete` — complete a quest (awards XP, gold, materials, gems)
- `GET /api/player/:name/character` — full character data
- `POST /api/professions/craft` — craft recipes (WoW-style skill-up)
- `POST /api/gacha/pull` — gacha pull with pity tracking

Full API docs: `GET /api/docs` (OpenAPI/Swagger).

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `API_KEY` | API authentication key |
| `API_KEYS` | Multiple keys (comma-separated) |
| `MASTER_KEY` | Admin operations |
| `PORT` | Server port (default: 3001) |
| `GITHUB_WEBHOOK_SECRET` | Webhook HMAC verification |

## Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Primary reference — tech stack, code rules, UI guidelines, balancing |
| `LYRA-PLAYBOOK.md` | Content creation guide + Lore Bible |
| `ARCHITECTURE.md` | Technical architecture deep-dive |
| `WOW-PROFESSION-REFACTOR.md` | Profession system design spec |
| `AUTOPILOT_AUDIT.md` | Autonomous audit protocol |
| `FEATURE_IDEAS.md` | Proposed features (not implemented) |
| `REJECTED.md` | Feature blocklist |

## License

Private project.
