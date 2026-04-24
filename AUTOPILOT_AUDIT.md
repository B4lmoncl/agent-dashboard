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

Rotiere durch verschiedene Bereiche der Codebase. Vermeide es, denselben Bereich zweimal hintereinander zu auditieren. Hier ist eine nicht-erschoepfende Liste von Scopes — Stand 2026-04-24, 32 Routes / 58 Components / 56 Data Files:

**Backend Routes (je 1-3 Dateien pro Zyklus):**
- `routes/quests.js` — Quest CRUD, claim, complete
- `routes/habits-inventory.js` — Rituals, gear, inventory, effects
- `routes/crafting.js` — Profession crafting, materials, recipes, Schmiedefieber
- `routes/gacha.js` — Banner pulls, pity tracking
- `routes/battlepass.js` — Season Pass XP, level rewards
- `routes/factions.js` — Faction rep, daily quests, standing rewards
- `routes/gems.js` — Gem socketing, upgrading, polishing
- `routes/rift.js` — Rift timed dungeons + Mythic+ Endless
- `routes/dungeons.js` — Cooperative group dungeons
- `routes/world-boss.js` — World boss encounters, contribution, Unique drops
- `routes/social.js` — Friends, messages, trading, activity feed
- `routes/challenges-weekly.js` — Sternenpfad 3-stage solo challenges
- `routes/expedition.js` — Cooperative weekly challenge
- `routes/shop.js` — Bazaar shop, effects, workshop upgrades
- `routes/players.js` — Player profiles, companion, tavern/rest mode
- `routes/users.js` — Auth, JWT, user management, rate-limited login
- `routes/currency.js` — Multi-currency, daily bonus
- `routes/campaigns.js` — Campaign quest chains
- `routes/config-admin.js` — Dashboard batch endpoint, leaderboard
- `routes/talent-tree.js` — Passive Talent Tree (Schicksalsbaum), allocate/reset
- `routes/sworn-bonds.js` — 1-on-1 pact, weekly objectives, bond chests
- `routes/adventure-tome.js` — Abenteuerbuch per-floor completion tracker
- `routes/codex.js` — Codex knowledge entries, unlockable lore
- `routes/enchanting.js` — D3-style Mystic stat reroll
- `routes/kanais-cube.js` — Extract/equip legendary powers
- `routes/schmiedekunst.js` — Salvage, transmute
- `routes/mail.js` — In-game mail system
- `routes/game.js` — Classes, roadmap, rituals meta
- `routes/agents.js` — Agent CRUD & status
- `routes/integrations.js` — GitHub webhook (HMAC verified)
- `routes/npcs-misc.js` — NPC endpoints, feedback (admin-only), SPA fallback
- `routes/docs.js` — OpenAPI/Swagger documentation

**Frontend Components (je 1-2 Dateien pro Zyklus):**

*Hauptansichten (view-level):*
- `components/CharacterView.tsx` — Equipment, stats, frames, titles, PixelCharacter
- `components/ForgeView.tsx` — Crafting UI, profession NPCs, Schmiedefieber
- `components/GachaView.tsx` — Gacha banners, pull animation, collection log
- `components/SocialView.tsx` — Friends, messages, trades, mail tab, activity feed, bonds, challenges
- `components/ChallengesView.tsx` — Sternenpfad + Expedition
- `components/RiftView.tsx` — Rift tier selection, stage tracking, Mythic+
- `components/DungeonView.tsx` — Group dungeon UI (The Undercroft)
- `components/WorldBossView.tsx` — Boss HP, contribution, rewards
- `components/BattlePassView.tsx` — Season Pass level track
- `components/FactionsView.tsx` — Faction rep bars, tier rewards
- `components/LeaderboardView.tsx` — Leaderboard, seasonal toggle
- `components/TavernView.tsx` — Rest mode, streak freeze (The Hearth)
- `components/TalentTreeView.tsx` — Schicksalsbaum 3-ring tree
- `components/AdventureTomeView.tsx` — Abenteuerbuch objectives
- `components/CodexView.tsx` — Codex entries
- `components/HonorsView.tsx` — Hall of Honors (achievements)
- `components/ShopView.tsx` — Bazaar shop
- `components/RitualChamber.tsx` — Rituals + vows
- `components/RoadmapView.tsx` — Player roadmap

*Quest-Flow:*
- `components/QuestBoard.tsx` — Quest board barrel export
- `components/QuestCards.tsx` — Quest card rendering (React.memo)
- `components/QuestPanels.tsx` — Quest filter/sort panels
- `components/QuestBadges.tsx` — Rarity/type badges
- `components/QuestDetailModal.tsx` — Quest detail overlay
- `components/QuestModals.tsx` — Quest-related modals
- `components/QuestToasts.tsx` — Chain-quest + achievement toasts
- `hooks/useQuestActions.ts` — Quest action handlers

*Chrome / Shell:*
- `components/DashboardHeader.tsx` — Navigation, settings, login popover
- `components/DashboardModals.tsx` — Modal system (currencies, modifiers, info)
- `components/TodayDrawer.tsx` — Daily checklist drawer (navigation-only)
- `components/TowerMap.tsx` — Floor/room map
- `components/NotificationCenter.tsx` — Bell-icon notifications
- `components/TutorialModal.tsx` — Info/Guide/Tutorial content
- `components/ContextualTutorial.tsx` — In-context first-visit moments
- `components/OnboardingWizard.tsx` — 6-step registration wizard
- `components/FeedbackModal.tsx` + `FeedbackOverlay.tsx` — Beta feedback mode

*Reward / Feedback:*
- `components/RewardCelebration.tsx` — Universal reward popup (quest/ritual/levelUp etc.)
- `components/GachaPull.tsx` — Gacha pull reveal animation
- `components/ToastStack.tsx` — Toast notification stack with item hover
- `components/ItemTooltip.tsx` — Item hover card + tooltip body
- `components/ItemActionPopup.tsx` — Equip/salvage/enchant actions
- `components/GameTooltip.tsx` — Tooltip registry (50+ entries)
- `components/FloatingRewards.tsx` — +XP/+Gold floaters

*Cards / Widgets:*
- `components/UserCard.tsx` — Player card with frame/title
- `components/AgentCard.tsx` — Agent status card
- `components/StatBar.tsx` — Stats-bar row primitive
- `components/CompanionsWidget.tsx` — Companion + expeditions
- `components/WandererRest.tsx` — NPC board / Wanderer's Rest
- `components/PlayerProfileModal.tsx` — Steam/D3-style profile modal
- `components/ShopModal.tsx` — Item shop modal
- `components/DailyLoginCalendar.tsx` — 28-day login calendar

*VFX / Atmosphere:*
- `components/GuildHallBackground.tsx` — Dynamic sky + foreground
- `components/FloorAmbientParticles.tsx` — Per-floor ambient particles
- `components/CrystalVeins.tsx` — Background crystal vein streaks
- `components/HighstormVFX.tsx` — Stormlight storm on boss/rift events
- `components/PixelCharacter.tsx` *(in use via CharacterView)* — Canvas pixel sprite

*Infrastructure:*
- `components/ModalPortal.tsx` — Portal + `useModalBehavior` hook
- `components/ErrorBoundary.tsx` — Error boundary wrapper
- `components/CountUp.tsx` — Animated number counter

**Core Logic:**
- `lib/state.js` — State management, Maps, persistence (~1430 lines)
- `lib/helpers.js` — Utility functions, legendary modifiers, level system (~2380 lines)
- `lib/auth.js` — JWT, refresh tokens, API key auth
- `lib/middleware.js` — Express middleware (auth, master key)
- `lib/quest-catalog.js` — Quest template seeding
- `lib/rotation.js` — Daily/weekly rotation logic
- `lib/npc-engine.js` — NPC rotation & spawning
- `lib/email.js` — Email utilities
- `lib/quest-templates.js` — Quest template interpolation
- `lib/companion-config.ts` — Companion config
- `lib/auth-client.ts` + `lib/sounds.ts` — Frontend auth + SFX

**App / Routing:**
- `app/page.tsx` — Main dashboard, room routing, state (~3300 lines)
- `app/types.ts` — TypeScript interfaces (~764 lines)
- `app/utils.ts` — Fetch helpers, `fetchDashboard()` batch, level system
- `app/config.ts` — Floor/room navigation config
- `app/globals.css` — Tailwind + utilities + animations (~2150 lines)
- `app/layout.tsx` — Root layout wrapper
- `app/DashboardContext.tsx` — React context for shared state
- `hooks/useQuestActions.ts` — Quest action handlers
- `hooks/useFirstVisit.ts` — First-visit detection
- `server.js` — Express entry, boot sequence

**Data Files (56 total):**

*Gear + Items (balancing-kritisch):*
- `public/data/gearTemplates.json` — Generische gear items
- `public/data/gearTemplates-schmied.json` / `-schneider.json` / `-lederverarbeiter.json` / `-waffenschmied.json` / `-juwelier.json` — Prof-specific gear
- `public/data/gearTemplates-dungeon-archive.json` / `-dungeon-core.json` / `-dungeon-spire.json` — Dungeon drops
- `public/data/gearTemplates-rift.json` / `-worldboss.json` — Tier-specific drops
- `public/data/uniqueItems.json` — Handcrafted unique named items
- `public/data/itemTemplates.json` — Non-gear items (consumables etc.)
- `public/data/suffixes.json` + `lootTables.json` — Affix + loot pools

*Quest + Progression:*
- `public/data/questCatalog.json` + `questTemplates.json` + `quests.json` — Quest data
- `public/data/questFlavor.json` — Flavor text pool
- `public/data/campaignNpcs.json` — Campaign NPCs
- `public/data/professions.json` — Crafting recipes, materials
- `public/data/achievementTemplates.json` — Achievements + points
- `public/data/titles.json` — Title definitions
- `public/data/talentTree.json` — 44 talent nodes

*Endgame Systems:*
- `public/data/battlePass.json` — Season Pass config
- `public/data/factions.json` — Die Vier Zirkel
- `public/data/gems.json` — Gem types, tiers
- `public/data/worldBosses.json` — World boss templates
- `public/data/dungeons.json` — Dungeon templates
- `public/data/weeklyChallenges.json` — Sternenpfad
- `public/data/expeditions.json` — Expedition checkpoints
- `public/data/seasonTemplates.json` + `rotationState.json` — Season + rotation

*Companions + NPCs + Classes:*
- `public/data/classes.json` — Class system
- `public/data/companions.json` + `companionProfiles.json` + `dobbieCompanion.json` — Companions
- `public/data/companionExpeditions.json` — Expedition tiers
- `public/data/npcQuestGivers.json` + `npcState.json` — NPCs

*Gacha + Economy:*
- `public/data/bannerTemplates.json` + `gachaPool.json` — Gacha banners + pull pool
- `public/data/currencyTemplates.json` — Currency definitions
- `public/data/shopItems.json` — Bazaar items

*Persistence / Runtime:*
- `public/data/appState.json` — App-level state
- `public/data/playerProgress.json` — Player progression
- `public/data/agents.json` — Agents
- `public/data/habits.json` + `rituals.json` + `ritualVowTemplates.json` — Rituals + vows
- `public/data/codex.json` — Codex entries
- `public/data/levels.json` — Level curve
- `public/data/roadmap.json` — Roadmap
- `public/data/gameConfig.json` + `version.json` + `changelog.json` — Config/version

### Haeufigste Befunde (aus Waves 22-27, 2026-04-24)

Diese Muster tauchen in fast jedem Zyklus auf — zuerst danach suchen:

1. **Language Policy Verstoesse** — Deutsche UI-Shell-Strings die English sein muessen. Buttons ("Registrieren" statt "Register"), Modal-Header ("Waehrungen" statt "Currencies"), Tooltips ("Gueltige E-Mail-Adresse eingeben"), Stat-Labels ("Aktueller Streak" statt "Current Streak"). CLAUDE.md §Language Policy definiert die Grenze klar. **Ausnahmen:** Content-Texte (Lore, Quest-Flavor, Item-Descriptions, NPC-Quotes) bleiben German. Game-world proper nouns (Kraft, Runensplitter, Schmiedefieber) NICHT uebersetzen. Room names (The Rift, The Undercroft) IMMER English — auch in deutschem Content (z.B. Tutorial-Titel "Der Riss." → "The Rift.").

2. **Fehlende `role="dialog"` + `aria-modal="true"` + `aria-label`** auf Modals. Fast jedes Modal-Div hat nur einen visuellen Wrapper ohne semantische ARIA-Rolle. Screenreader sehen nur einen generischen Container. Fix: `role="dialog" aria-modal="true" aria-label="{{beschreibender Name}}"` auf die Content-Box (NICHT den Backdrop).

3. **Fehlende `aria-label` auf Action-Buttons** die nur ein Symbol oder kurzen Text zeigen ("!", "×", "★", "Verstanden"). Screenreader hoeren "button" ohne Kontext. Fix: `aria-label="Claim quest: {{quest.title}}"` etc.

4. **`title=` auf Status-Indikatoren statt `<Tip k="...">`** — rohe HTML-Title-Tooltips fuer System-Erklaerungen verstoessen gegen CLAUDE.md §Tooltips ("`title` attribute: Only for simple action buttons, NOT for system explanations"). Fix: umwickeln mit `<Tip k="registry_key">`.

5. **Loading-Text "..." statt beschreibendem Verb** — generisches "..." auf Action-Buttons waehrend API-Calls statt "Claiming…", "Converting…", "Releasing…" per UI-Guideline.

### Fokus-Rotation

Wechsle den Fokus-Typ zwischen Zyklen. Hier sind die Fokus-Kategorien:

| Fokus | Was du pruefst |
|-------|---------------|
| **Bugs & Crashes** | Null-Referenzen, undefinierte Variablen, fehlende Imports, falsche Funktionssignaturen, kaputte Endpoints |
| **Race Conditions** | Fehlende Player Locks auf Mutation-Endpoints, doppelte Claims, concurrent Request Exploits |
| **Security** | Fehlende Auth-Checks, Input-Validation, Injection, fehlende `requireAuth`/`requireApiKey` |
| **UI/UX** | Font < 12px, fehlende Tooltips, fehlende Disabled-States, fehlende Loading-States, fehlende Celebrations, fehlende `useModalBehavior`, fehlende Animationen, fehlende `prefers-reduced-motion` |
| **Language Policy** | Interactive UI muss English sein (buttons, labels, errors, toasts, API error messages). Content bleibt German (quest content, NPC quotes, item desc, lore). Game-world proper nouns (Kraft, Runensplitter, Schmiedefieber, Die Vier Zirkel) NICHT uebersetzen |
| **Frontend-Backend Consistency** | UI zeigt Wert X → Backend berechnet Y. Button existiert → Endpoint fehlt. Tooltip sagt A → Formel macht B |
| **Balancing** | Item-Stats vs. CLAUDE.md Tabellen, Affix Counts vs. Rarity, Legendary Effect Values, Currency Sinks, Grind-Laenge |
| **Content Completeness** | Items die referenziert aber nicht existieren, Source-IDs die nicht matchen, Rewards die ins Leere greifen |
| **Code Quality** | Dead code, `as any`, empty catch, duplicated logic, inconsistent patterns, missing error messages |
| **Tooltip Coverage** | Jeder Stat/Currency/System hat `<Tip k="...">`. Keine raw `title=` fuer System-Erklaerungen. Registry-Entries existieren. Keine toten Entries |
| **Accessibility** | `role="dialog"` + `aria-modal` + `aria-label` auf Modals. `aria-label` auf Action-Buttons mit Kontext. `:focus-visible` Outline. Keyboard-Navigation |
| **QoL / Polish** | WoW/Diablo-Referenz Features die fehlen, Feedback das fehlt, Flows die umstaendlich sind |
| **Feature Additions** | Features die nach WoW Classic / Diablo 3 / HSR Sinn machen wuerden (aber **REJECTED.md ZUERST pruefen**!) |

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
- Nicht mechanisch Audit-Findings abarbeiten ohne sie gegen REJECTED.md und vorhergehende Session-Entscheidungen zu filtern

---

## Human-in-the-Loop

Autopilot heisst: Du waehlst Scope, waehlst Fokus, liest tief, findest Probleme. Aber du entscheidest NICHT alleine was subjektiv ist.

### Regel: Klar vs. Subjektiv

**Klar (direkt fixen):**
- Deutsche UI-Strings die gegen Language Policy verstossen
- Fehlende `requireAuth` / `requireApiKey` auf Mutation-Endpoints
- Null-Referenz-Crashes
- Tote Tip-Registry-Keys (verweisen ins Leere)
- Font-Size < 12px
- Fehlende `useModalBehavior`
- Fehlender `aria-label` auf Action-Buttons
- Race Conditions ohne Player Lock
- `sed`-artige Massenaenderungen zuerst IMMER lokal verifizieren bevor committen (kein `sed -i` ohne anschliessendes `grep`)

**Subjektiv (ZUERST per `AskUserQuestion` fragen):**
- Microcopy-Aenderungen (Button-Labels, Tooltips, Flavor-Text) die nicht durch Language Policy erzwungen sind
- Neue Tooltip-Texte wenn mehrere Wortungen plausibel sind
- Visual-Polish-Entscheidungen (Farben, Groessen, Animations-Timings)
- Feature-Vorschlaege die neu sind (nach REJECTED.md-Check)
- Re-Labelings / Renamings
- Entscheidungen ueber Hierarchie / Gruppierung von UI-Elementen
- Entscheidungen die Content-Ton beeinflussen (Skulduggery vs. Kingkiller vs. Stormlight)

### AskUserQuestion-Pattern

Wenn du ein subjektives Finding hast:
1. Beschreibe das Problem knapp mit `file:line`
2. Stelle 2-4 konkrete Alternativen
3. Jede Option mit kurzer Begruendung (was gewinnt, was verliert)
4. Warte auf Antwort → dann fixen

Beispiel gut:
```
Step 0 im Onboarding heisst "Create Hero" — kollidiert mit dem Submit-Button
auf Step 4 der auch "Create Hero" heisst. Optionen:
- "Account" — neutral, klar was passiert
- "Sign Up" — Standard-Web-Begriff
- "The Name" — in-world Ton
- Step 0 bleibt, Step 4 umbenennen
```

Beispiel schlecht (nicht so machen):
```
Soll ich Step 0 umbenennen? ja/nein
```

### Priorisierung: Policy-Fix zuerst, dann fragen

Wenn ein Audit mehrere Findings liefert — ein CRIT-Language-Policy-Verstoss und drei subjektive Microcopy-Aenderungen — mach zuerst den Policy-Fix (direkt), dann frag zu den drei Microcopy-Entscheidungen in EINEM `AskUserQuestion` (nicht drei Einzelfragen).

### Wann du NICHT fragen musst

- Wenn die Aenderung trivial + nicht-umstrittbar ist (z.B. doppeltes Leerzeichen entfernen)
- Wenn der User dir bereits explizit gesagt hat du sollst das machen
- Wenn CLAUDE.md / LYRA-PLAYBOOK.md / Language Policy die Antwort vorgibt

### Kommunikation nach Fix-Batch

Nach jedem Zyklus: 1-3 Saetze was gefixt wurde + welche Commit-Hash. Nicht drei Paragraphen Erklaerung. Der User liest Diffs schneller als Prosa.

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
