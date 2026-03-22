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
