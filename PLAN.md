# Navigation Restructuring Plan — Gildenhallen-Stockwerke

## Konzept

Die bisherige flache Tab-Leiste (14 Tabs in einer Reihe) wird in eine **Stockwerk-Navigation** umgebaut, inspiriert von Urithiru aus den Sturmlicht-Chroniken. Die Gildenhalle hat 4 Ebenen, jede mit 3-4 Räumen.

**Alles oberhalb der Navigation (Stat Cards, Player Card, Header) bleibt unverändert.**

## Finale Stockwerk-Zuordnung

### Ebene 4: Turmspitze (Prestige & Ruhm)
| Raum | Aktueller Key | Aktuelles Label |
|------|--------------|----------------|
| Sternwarte | `campaign` | The Observatory |
| Prüfungsarena | `leaderboard` | The Proving Grounds |
| Halle der Ehre | `honors` | Hall of Honors |
| Saisonhalle | `season` | Season |

### Ebene 3: Haupthalle (Abenteuer)
| Raum | Aktueller Key | Aktuelles Label |
|------|--------------|----------------|
| Große Halle | `questBoard` | The Great Hall |
| Rasthof des Wanderers | `npcBoard` | The Wanderer's Rest |
| Herausforderungen | `challenges` | Challenges |

### Ebene 2: Gewerbeviertel (Handel & Handwerk)
| Raum | Aktueller Key | Aktuelles Label |
|------|--------------|----------------|
| Der Basar | `shop` | The Bazaar |
| Handwerkerviertel | `forge` | Artisan's Quarter |
| Schicksalsgruft | `gacha` | Vault of Fate |

### Ebene 1: Charakter-Turm (Persönlich)
| Raum | Aktueller Key | Aktuelles Label |
|------|--------------|----------------|
| Charakterbogen | `character` | Character |
| Das Arcanum | `klassenquests` | The Arcanum |
| Ritualkammer | `rituals` | Ritual Chamber (NEU: eigener Tab) |
| Schrein der Schwüre | `vows` | Vow Shrine (NEU: eigener Tab) |

## UI-Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Header + Stat Cards + Player Card — UNVERÄNDERT]      │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │ ▲ Turmspitze │ ● Haupthalle │ ■ Gewerbe │ ✦ Char │  │  ← Stockwerk-Tabs
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ [Banner-Bild des aktiven Stockwerks]              │  │  ← Stockwerk-Header (Pixel-Art, nachgeliefert)
│  │ "Haupthalle — Das Herz der Gildenhalle"           │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌─────────┬──────────────┬───────────────────┐         │
│  │ ● Große │ ● Rasthof    │ ● Herausforderung │         │  ← Raum-Tabs (Icons + Labels)
│  │  Halle  │ des Wanderers│                   │         │
│  └─────────┴──────────────┴───────────────────┘         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  │  [CONTENT: Aktueller Raum-View]                   │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Implementierungs-Schritte

### Schritt 1: Stockwerk-Datenstruktur
- Definiere `FLOORS` Array in `app/page.tsx` oder `app/config.ts`
- Jedes Stockwerk: `{ id, name, subtitle, icon, color, banner?, rooms: [...] }`
- Jeder Raum: `{ key, label, icon, requiresLogin?, tutorialKey? }`

### Schritt 2: Ritual Chamber & Vow Shrine als eigene Views
- Extrahiere Ritual Chamber aus dem Quest Board Sub-Tab-System
- Extrahiere Vow Shrine aus dem Quest Board Sub-Tab-System
- Neue dashView Keys: `rituals`, `vows`
- Inhalt bleibt identisch, nur die Navigation ändert sich

### Schritt 3: Navigation-UI umbauen
- Ersetze die flache Tab-Leiste durch 2-Ebenen-Navigation:
  - **Stockwerk-Leiste**: 4 Buttons (Turmspitze, Haupthalle, Gewerbeviertel, Charakter-Turm)
  - **Raum-Leiste**: 3-4 Buttons pro Stockwerk (dynamisch je nach aktivem Stockwerk)
- Stockwerk-Header: Platzhalter-Gradient mit Text (Banner-Bilder werden nachgeliefert)

### Schritt 4: Transitions & Polish
- CSS-Transition beim Stockwerkwechsel (fade oder slide)
- Aktives Stockwerk visuell hervorgehoben
- Aktiver Raum visuell hervorgehoben
- Responsive: Auf kleinen Screens Stockwerk-Tabs als Dropdown

### Schritt 5: Banner-Platzhalter
- 4 Gradient-basierte Header als Platzhalter
- Jedes Stockwerk hat eine eigene Farbpalette:
  - Turmspitze: Gold/Sternenhimmel (#fbbf24 → #1a1a3a)
  - Haupthalle: Warmes Feuer (#f97316 → #1a0f0a)
  - Gewerbeviertel: Markt/Lila (#a855f7 → #1a0a2e)
  - Charakter-Turm: Ruhiges Blau (#3b82f6 → #0a1a2e)

## Benötigte Bilder (nachzuliefern)

4 Stockwerk-Banner-Bilder (ca. 600×80px, Pixel-Art-Stil):
1. **turmspitze-banner.png** — Sternenhimmel, offene Plattform, Teleskop, Siegesfackeln, goldene Verzierungen
2. **haupthalle-banner.png** — Großer Saal mit Questbrett an der Wand, Kamin/Feuer, Tische mit Karten
3. **gewerbeviertel-banner.png** — Marktstände, Amboss mit Funken, mystisches Gewölbe mit Runen
4. **charakter-turm-banner.png** — Private Gemächer, Bücherregal, Runen-Kreis am Boden, Kerzenlicht

Außerdem fehlt: **nav-challenges.png** (existiert nicht, wird als Icon für "Herausforderungen" benötigt)

## Nicht ändern
- Header, Stat Cards, Player Card (alles über der Navigation)
- Inhalte der einzelnen Views (nur Navigation drumherum ändert sich)
- Bestehende API-Endpunkte
- DashboardContext, Datenfluss, State Management
