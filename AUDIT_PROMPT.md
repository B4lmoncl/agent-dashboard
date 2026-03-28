# Codebase Audit & Fix — Full Site Analysis

## Kontext
Lies zuerst `CLAUDE.md` (inkl. UI Design Guidelines), `AUDIT_REPORT.md` (Appendix A ist Pflicht!) und `ARCHITECTURE.md`. Diese Dateien definieren Architektur, Regeln, bekannte Non-Issues und Design-Standards. Rate NICHT — frag mich per Multiple Choice bei Unsicherheiten.

## Phase 1: Analyse & Audit (keine Änderungen)
Lies die gesamte Codebase. Prüfe systematisch:

**Frontend-Backend-Konsistenz (KRITISCH):**
- Zeigt das UI einen Wert → kommt er aus echten Backend-Daten oder ist er hardcoded?
- Suggeriert ein Button/Feature Funktionalität die im Backend nicht existiert?
- Stimmen Tooltip-Texte mit Backend-Formeln überein?

**UI/UX-Konsistenz (nach UI Design Guidelines in CLAUDE.md):**
- Folgen alle Komponenten den definierten Regeln? (min 12px Font, disabled=not-allowed+tooltip, Celebrations bei Rewards, useModalBehavior, progress-bar-diablo, stat-card-depth, quest-card-emboss etc.)
- Gibt es Stellen die gegen die Guidelines verstoßen?
- Quality-of-Life-Verbesserungen die Spielern auffallen würden?

**Code-Qualität:**
- Bugs, fehlende null-safety, Race Conditions, fehlende Auth-Checks
- Tote Code-Pfade, duplizierter Code, `as any` Casts
- Fehlende Validierung an API-Grenzen

Dokumentiere alles in `AUDIT_REPORT.md`.

## Phase 2: Fixes (iterativ)
1. Fixe nach Priority: Critical → High → Medium → Low → QoL
2. Atomare Commits mit klaren Messages
3. KEINE Breaking Changes an User-Daten, KEINE Feature-Entfernung
4. Nach jedem Fix-Batch: Self-Audit auf Regressions, Build prüfen
5. Loop bis alles clean ist

## Phase 3: Dokumentation
- `AUDIT_REPORT.md` — Changelog mit Commit-IDs aktualisieren
- `CLAUDE.md`, `ARCHITECTURE.md`, `LYRA-PLAYBOOK.md` — nur updaten wenn Daten veraltet sind
- `AUDIT_REPORT.md` kompakt halten (< 400 Zeilen) — Fakten statt Session-Logs

## Regeln
- NIEMALS raten — bei fehlendem Kontext fragen
- NIEMALS User-Daten gefährden
- NIEMALS Features entfernen — reparieren oder verbessern
- Multiple Choice bei größeren Änderungen/Feature-Ideen
- Spielereferenzen: WoW Classic, Diablo, Honkai Star Rail, Habitica
- Guild Hall Referenz: Urithiru (Stormlight Archive, Brandon Sanderson)

**Starte jetzt.**

---

## Bereits vorgeschlagen & abgelehnt (NICHT erneut vorschlagen)

### Session 30 — Content/Economy Runde
- Auction House (WoW AH)
- Companion Equipment (D3 Follower Gear)
- Primal / Ancient Items (D3 ultra-rare tier)
- Great Vault (WoW Weekly Vault)
- Caldesann's Despair (D3 gem augment)
- Work Orders (WoW Dragonflight craft orders)

### Session 30 — QoL/UI Runde 1
- Gear Loadouts / Armory (D3 Armory)
- Junk-Markierung + Salvage All Junk
- Inventar Slot-Filter (nach Waffen/Rüstung etc.)
- Stat-Aufschlüsselung (Klick auf Stat → Quellen)
- Rift Timer Urgency + Post-Rift Summary
- Nav-Notification Badges (rote Zahlen auf Tabs)
- Pinned Objective Tracker (Floating Widget)
- Activity Log / Event Feed
- Weekly Statistics Page
- Achievement Kategorien mit Sub-Tabs
- Keyboard Shortcuts (I/C/P/R/M)
- Companion Expedition History Log

### Session 30 — QoL/UI Runde 2
- Stat-Aufschlüsselung (Klick auf Stat → Quellen)
- Gear Loadouts / Armory (D3 Armory)
- Achievement Fast-Fertig Section (>75% complete)
- Watched Faction Rep (Pin im Header)
- Failure Recap (Rift/Dungeon Post-Mortem)

### Session 30 — Implementiert (NICHT erneut vorschlagen)
- NEW Badge auf Inventar-Items ✓
- Rezept-Craftability Icons (●/◐/○) ✓
- What's New Splash Modal ✓
- Batch Craft Sequential Animation ✓
- Nav-Notification Badges (rote Zahlen auf Tabs) ✓
- Calendar/Reset Widget (Timers im Today Drawer) ✓
- Recipe Discovery Log (??? + Counter) ✓
- Floor Level-Gating (streng, gear-hierarchy-aligned) ✓
- Tab-Namen Cleanup (alle "The" entfernt) ✓
- Mail "Collect All" Button ✓
- Battle Pass "Claim All" Button ✓
- Material Storage Tab ✓
- Mail System (WoW-Mailbox) ✓
- Enchant Vellums (handelbare Enchant Scrolls) ✓
- Mythic+ Affixes (10 Weekly-Affixes) ✓
- Item Lock System ✓
- Auto-Salvage Preview Modal ✓
- Kanai's Cube ✓
- BoP/BoE Binding System ✓
- 6 Race Condition Locks (Mail, Rift, BP, Factions, Dungeon, WB) ✓
- 9 Empty Catch Blocks → Error Logging ✓
- Rarity Color Standardisierung (#f97316 für Legendary) ✓
- Gold-Formatierung mit toLocaleString() ✓
- Scrollbar thin auf alle Container ✓
- CSS craft-cast-fill → GPU-composited transform ✓
