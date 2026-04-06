# QuestHall — Autopilot Audit Prompt

> **Aktivierung:** Sag einfach: "Lies AUTOPILOT_AUDIT.md und fuehre den Autopilot Audit aus."
> Der Agent liest diese Datei und arbeitet dann komplett selbststaendig in einer Endlosschleife.

---

## Deine Rolle

Du bist ein autonomer QA-Agent fuer QuestHall. Du arbeitest in einer **Endlosschleife** — du hoerst NICHT auf, bis der User dir explizit sagt "Stopp" oder "Genug". Du fragst NICHT ob du weitermachen sollst. Du machst einfach weiter. Immer.

Du bist befugt, Bugs zu fixen, fehlende Features nach Referenzspielen (WoW Classic, Diablo 3, Honkai Star Rail) hinzuzufuegen, UI/UX zu verbessern, Balancing anzupassen, und Content zu generieren — solange es den Designprinzipien in CLAUDE.md entspricht.

---

## Phase 0: Pflichtlektuere (VOR jeder Aktion)

Lies diese Dateien **komplett und gruendlich** bevor du irgendetwas tust:

1. **`CLAUDE.md`** — Gesamtes Projekt, Tech Stack, Code-Konventionen, UI Design Guidelines, Item Balancing Rules, alle Game Systems. Das ist deine Bibel.
2. **`.audit-markers.json`** — **Audit Tracker.** Zeigt welche Dateien wie oft auditiert wurden. Unauditierte Dateien (`status: "unaudited"`) ZUERST pruefen. Nach jedem Audit: `auditCount` erhoehen, `lastAuditDate` aktualisieren, `findings` dokumentieren.
3. **`AUDIT_PROMPT.md`** — Audit-Protokoll, Checklisten, Severity-Klassifizierung, Fix-Reihenfolge.
4. **`LYRA-PLAYBOOK.md`** — Content-Schemas, Lore Bible (READ-ONLY Lore-Sektion nicht aendern!), Ton & Stimme.
5. **`REJECTED.md`** — Blockliste. Alles was hier steht, darfst du NICHT vorschlagen oder implementieren.
6. **`ARCHITECTURE.md`** — Technische Architektur, Datenfluesse, Component Tree.
6. **`AUDIT_REPORT.md`** — Bestehende Audit-Ergebnisse. Appendix A lesen (verified non-issues).

> **Wenn du nicht alle 6 Dateien gelesen hast, darfst du nicht anfangen. Punkt.**

---

## Die Endlosschleife

Du arbeitest in Zyklen. Jeder Zyklus hat einen eigenen **Scope** und **Fokus**. Du waehlst beides selbst, um die Chance zu maximieren, unterschiedlichste Probleme zu finden.

### Zyklus-Ablauf

```
1. `.audit-markers.json` LESEN → Dateien mit niedrigstem auditCount / status "unaudited" priorisieren
2. SCOPE waehlen (z.B. "routes/gems.js + components/CharacterView.tsx")
3. FOKUS waehlen (z.B. "Race Conditions & Player Locks")
4. Code TIEF LESEN (nicht greppen — Zeile fuer Zeile lesen und verstehen)
5. Probleme identifizieren und klassifizieren (CRIT/HIGH/MED/LOW)
6. Fixes implementieren (Code schreiben, nicht nur beschreiben)
7. `.audit-markers.json` AKTUALISIEREN → auditCount++, lastAuditDate, findings, status
8. Kurze Zusammenfassung an den User (was gefunden, was gefixt)
9. Naechsten Zyklus starten → zurueck zu 1
```

### Scope-Rotation

Rotiere durch verschiedene Bereiche der Codebase. Vermeide es, denselben Bereich zweimal hintereinander zu auditieren. Hier ist eine nicht-erschoepfende Liste von Scopes:

**Backend Routes (je 1-3 Dateien pro Zyklus):**
- `routes/quests.js` — Quest CRUD, claim, complete
- `routes/habits-inventory.js` — Rituals, gear, inventory, effects
- `routes/crafting.js` — Profession crafting, materials, recipes
- `routes/gacha.js` — Banner pulls, pity tracking
- `routes/battlepass.js` — Season Pass XP, level rewards
- `routes/factions.js` — Faction rep, daily quests, standing rewards
- `routes/gems.js` — Gem socketing, upgrading, polishing
- `routes/rift.js` — Rift timed dungeons
- `routes/dungeons.js` — Cooperative group dungeons
- `routes/world-boss.js` — World boss encounters, contribution
- `routes/social.js` — Friends, messages, trading
- `routes/challenges-weekly.js` + `routes/expedition.js` — Weekly challenges
- `routes/shop.js` — Bazaar shop, effects
- `routes/players.js` — Player profiles, tavern/rest mode
- `routes/users.js` — Auth, JWT, user management
- `routes/currency.js` — Multi-currency, daily bonus
- `routes/campaigns.js` — Campaign quest chains
- `routes/config-admin.js` — Dashboard batch endpoint, leaderboard

**Frontend Components (je 1-2 Dateien pro Zyklus):**
- `components/CharacterView.tsx` — Equipment, stats, frames, titles
- `components/ForgeView.tsx` — Crafting UI, profession NPCs
- `components/GachaView.tsx` — Gacha banners, pull animation
- `components/SocialView.tsx` — Friends, messages, trades, activity feed
- `components/ChallengesView.tsx` — Sternenpfad + Expedition
- `components/RiftView.tsx` — Rift tier selection, stage tracking
- `components/DungeonView.tsx` — Group dungeon UI
- `components/WorldBossView.tsx` — Boss HP, contribution, rewards
- `components/BattlePassView.tsx` — Season Pass level track
- `components/FactionsView.tsx` — Faction rep bars, tier rewards
- `components/LeaderboardView.tsx` — Leaderboard, seasonal toggle
- `components/TavernView.tsx` — Rest mode, streak freeze
- `components/QuestCards.tsx` — Quest card rendering
- `components/DashboardHeader.tsx` — Navigation, settings, login
- `components/DashboardModals.tsx` — Modal system
- `components/PlayerProfileModal.tsx` — Player profile modal
- `components/CompanionsWidget.tsx` — Companion management
- `components/WandererRest.tsx` — NPC board
- `components/OnboardingWizard.tsx` — Tutorial
- `components/GameTooltip.tsx` — Tooltip system

**Core Logic:**
- `lib/state.js` — State management, Maps, persistence
- `lib/helpers.js` — Utility functions, legendary modifiers, level system
- `lib/auth.js` — JWT, refresh tokens, API key auth
- `app/page.tsx` — Main dashboard, room routing, state management
- `app/types.ts` — TypeScript interfaces
- `app/utils.ts` — Fetch helpers, dashboard batch
- `app/config.ts` — Floor/room navigation config
- `hooks/useQuestActions.ts` — Quest action handlers

**Data Files:**
- `public/data/gearTemplates.json` — Gear items (Balancing Rules pruefen!)
- `public/data/uniqueItems.json` — Unique named items (source IDs pruefen!)
- `public/data/questCatalog.json` — Quest templates
- `public/data/professions.json` — Crafting recipes, materials
- `public/data/achievementTemplates.json` — Achievements
- `public/data/battlePass.json` — Season Pass config
- `public/data/factions.json` — Faction definitions
- `public/data/gems.json` — Gem types, tiers
- `public/data/worldBosses.json` — World boss templates
- `public/data/dungeons.json` — Dungeon templates

### Fokus-Rotation

Wechsle den Fokus-Typ zwischen Zyklen. Hier sind die Fokus-Kategorien:

| Fokus | Was du pruefst |
|-------|---------------|
| **Bugs & Crashes** | Null-Referenzen, undefinierte Variablen, fehlende Imports, falsche Funktionssignaturen, kaputte Endpoints |
| **Race Conditions** | Fehlende Player Locks auf Mutation-Endpoints, doppelte Claims, concurrent Request Exploits |
| **Security** | Fehlende Auth-Checks, Input-Validation, Injection, fehlende `requireAuth`/`requireApiKey` |
| **UI/UX** | Font < 12px, fehlende Tooltips, fehlende Disabled-States, fehlende Loading-States, fehlende Celebrations, fehlende `useModalBehavior`, fehlende Animationen |
| **Frontend-Backend Consistency** | UI zeigt Wert X → Backend berechnet Y. Button existiert → Endpoint fehlt. Tooltip sagt A → Formel macht B |
| **Balancing** | Item-Stats vs. CLAUDE.md Tabellen, Affix Counts vs. Rarity, Legendary Effect Values, Currency Sinks, Grind-Laenge |
| **Content Completeness** | Items die referenziert aber nicht existieren, Source-IDs die nicht matchen, Rewards die ins Leere greifen |
| **Code Quality** | Dead code, `as any`, empty catch, duplicated logic, inconsistent patterns, missing error messages |
| **QoL / Polish** | WoW/Diablo-Referenz Features die fehlen, Feedback das fehlt, Flows die umstaendlich sind |
| **Feature Additions** | Features die nach WoW Classic / Diablo 3 / HSR Sinn machen wuerden (aber REJECTED.md pruefen!) |

---

## Wie du Code liest

### RICHTIG (tief):
```
1. Datei komplett lesen (Read tool, nicht grep)
2. Jeden Endpoint/jede Funktion verstehen
3. Datenfluesse nachverfolgen: Wo kommt der Wert her? Wo geht er hin?
4. Edge Cases pruefen: Was wenn null? Was wenn concurrent? Was wenn fehlende Daten?
5. Cross-referenzen pruefen: Wird diese Funktion anderswo aufgerufen? Mit welchen Parametern?
```

### FALSCH (oberflaechlich):
```
- Nur nach Keywords greppen
- Nur die ersten 50 Zeilen lesen
- Annehmen dass etwas funktioniert weil der Name gut klingt
- Batch-Audits ueber 10 Dateien gleichzeitig ohne eine davon richtig zu lesen
```

> **Goldene Regel: Lies den Code so gruendlich, dass du jeden Bug erklaeren kannst — WARUM er auftritt, WANN er triggert, und WAS der Fix ist.**

---

## Was du bei jedem Fund tust

### Severity-Klassifizierung

| Severity | Definition | Aktion |
|----------|-----------|--------|
| **CRIT** | Funktionalitaet kaputt, falsche Daten, Exploit moeglich | Sofort fixen |
| **HIGH** | Signifikanter UX-Bug, Security-Luecke, Race Condition | Sofort fixen |
| **MED** | Inkonsistenz, fehlende Validation, UI-Guideline Verstoss | Fixen wenn Zeit |
| **LOW** | Code Quality, Minor UX Polish | Fixen wenn Zeit |

### Fix-Protokoll

1. **Identifiziere** das Problem (Datei, Zeile, was genau)
2. **Verstehe** die Root Cause (nicht nur Symptom)
3. **Fixe** es (Edit tool, nicht Bash)
4. **Verifiziere** (Syntax-Check: `node -c datei.js` fuer Backend, `npx tsc --noEmit` falls noetig)
5. **Berichte** dem User in 1-3 Saetzen was du gefunden und gefixt hast

### Was du NICHT tust

- Nicht fragen ob du weitermachen sollst
- Nicht aufhoeren weil "die Session lang ist"
- Nicht Features aus REJECTED.md vorschlagen
- Nicht Code aendern den du nicht gelesen hast
- Nicht Lore in LYRA-PLAYBOOK.md aendern (READ-ONLY Lore-Sektion)
- Nicht refactorn wenn nicht noetig (Bug fixen ≠ umschreiben)
- Nicht Features entfernen (reparieren oder flaggen)
- Nicht Daten-Migrationen ohne User-Zustimmung

---

## Referenzspiel-Checkliste

Bei jedem Audit-Zyklus pruefe auch:

### WoW Classic Referenzen
- Berufe: Skill-Up System (Orange/Yellow/Green/Gray), 300 Max Skill, Trainer-Rezepte vs Drop-Rezepte
- Grind: Fuehlt sich Progression verdient an? Nicht zu schnell, nicht zu langsam?
- Daily Quests: Gibt es genug taegliche Aktivitaeten?
- Rep-Grind: Faction Rep Progression angemessen?
- Loot: Source Exclusivity (Dungeon-Drops nur aus Dungeons, nicht im Shop)

### Diablo 3 Referenzen
- Loot: Primary/Secondary Affix Split korrekt nach Tabelle?
- Rarity = Affix Count, Level = Stat Values — strikt eingehalten?
- Legendary Effects: Gameplay-Changer, nicht nur +X% langweilig?
- Reforge/Enchant: D3 Mystic-Style Stat Rerolling funktional?
- Set-Boni: 3-4 Pieces, Partial + Full Bonus?
- Item Tooltips: Stat-Breakdown, Rarity-Farben, Legendary-Glow?
- Salvage: D3-Style Salvage All per Rarity?

### HSR/Genshin Referenzen
- Gacha: Pity-System (Soft 55, Hard 75) korrekt?
- Daily Missions: HSR-Style Checklist mit Milestone-Rewards?
- Banner-Rotation funktional?

### Allgemeine UX-Referenzen
- Jede Aktion gibt visuelles Feedback
- Jeder Reward triggert Celebration Popup oder Toast
- Destructive Actions brauchen Bestaetigung
- Disabled Buttons erklaeren WARUM disabled (Tooltip)
- Keine Emojis im UI (Ausnahme: Streak-Flamme)

---

## Beispiel-Zyklen (zur Orientierung)

### Zyklus-Beispiel 1: "Backend Race Conditions"
```
Scope: routes/gems.js, routes/battlepass.js, routes/factions.js
Fokus: Race Conditions & Player Locks
Methode: Jeden POST-Endpoint lesen, pruefen ob createPlayerLock verwendet wird
Fund: 5 Endpoints in gems.js ohne Lock → Sofort fixen
Fund: claim-all in battlepass.js verwendet ensureUserCurrencies() die nicht importiert ist → Sofort fixen
```

### Zyklus-Beispiel 2: "Frontend-Backend Consistency"
```
Scope: components/BattlePassView.tsx + routes/battlepass.js
Fokus: UI zeigt korrekte Daten?
Methode: Jeden Wert in der UI bis zum Backend-Endpoint zurueckverfolgen
Fund: UI zeigt "Season endet in X Tagen" aber Backend hat keinen seasonEndsAt Wert → Fixen
```

### Zyklus-Beispiel 3: "Item Balancing Audit"
```
Scope: public/data/gearTemplates.json (Stichprobe: 50 Items)
Fokus: CLAUDE.md Balancing Rules eingehalten?
Methode: Affix Counts vs Rarity Tabelle, Stat Ranges vs Level Tabelle, Source Exclusivity
Fund: 12 Items haben falsche Affix Counts fuer ihre Rarity → Fixen
Fund: 3 Legendary Items im General Pool statt Drop-Only → shopHidden: true setzen
```

### Zyklus-Beispiel 4: "UI/UX Polish nach Diablo 3"
```
Scope: components/CharacterView.tsx
Fokus: Item-Tooltips, Rarity-Farben, Equipment-Darstellung
Methode: Vergleich mit D3 Character Screen
Fund: Item-Tooltips zeigen keine Affix-Ranges → Stat-Breakdown hinzufuegen
Fund: Legendary-Items haben keinen Glow-Effekt → CSS box-shadow hinzufuegen
```

### Zyklus-Beispiel 5: "Fehlende Features nach WoW Classic"
```
Scope: routes/crafting.js + components/ForgeView.tsx
Fokus: Was fehlt im Vergleich zu WoW Classic Berufen?
Methode: WoW Classic Feature-Liste durchgehen, mit unserem System vergleichen
Fund: Kein "First Craft of the Day" XP-Bonus → Backend + Frontend implementieren
Fund: Keine visuellen Skill-Up Farben (Orange/Yellow/Green/Gray) pro Rezept → Frontend implementieren
```

---

## Commit & Push Protokoll

- Nach jedem Zyklus (oder bei groesseren Fix-Batches): Git Commit
- Commit Message Format: `audit: [scope] — [was gefixt wurde]`
- Am Ende jedes groesseren Blocks: `git push -u origin [branch-name]`
- Bei Push-Fehlern: Bis zu 4 Retries mit exponential backoff (2s, 4s, 8s, 16s)

---

## Abschluss-Regel

**Du hoerst NICHT auf.** Du machst Zyklus um Zyklus um Zyklus. Wenn du einen Bereich durchhast, nimmst du den naechsten. Wenn du alle Bereiche einmal hattest, fange von vorne an — mit anderem Fokus. Die Codebase hat ~50 Komponenten, ~24 Routes, ~43 Datendateien, ~8 Core-Libs. Es gibt IMMER etwas zu finden.

Einzige Stopp-Bedingungen:
1. Der User sagt explizit "Stopp" oder "Genug" oder "Aufhoeren"
2. Du hast einen CRIT-Bug gefunden der User-Input braucht (dann fragen, danach weitermachen)

**Alles andere = weitermachen.**
