# Quest Hall — Backlog
<!-- Last updated: 2026-04-02 — cleaned up after Autopilot Audit -->

## Open Bugs

1. Character Screen: Background image clipped at top

## Open Features

### Near-Term
- CharacterView: Ring slot in equipment UI (from WOW-PROFESSION-REFACTOR Session 9)
- ForgeView: BoE badge, gem-cut/gem-merge recipe display
- Profession synergy hints for 8 professions (FI-045)
- Mail system: decide keep or remove (overlaps messaging + trading, but enables NPC/system mail)

### Medium-Term (Phase 2)
- Season System v2 — Battle Pass expanded rewards
- Campaign v2 — The Observatory quest chains
- Starweaver Special Quests — LLM Chat integration
- The Arcanum — Class system expansion
- Custom Character Avatar
- Coop-Rituals with invitation system
- User-Generated Quests (suggest system exists, full UGC pending)

## Tech Debt

- [ ] **REMOVE PRIORITY SYSTEM** — Quest priority (Low/Med/High) replaced by Rarity. ~139 refs in 30 files.
- [ ] page.tsx monolith (~2350 lines) — extract into feature modules
- [ ] Missing JSON Schema validation for template files

## Completed (archived)

> 20 bugs, 7 quick wins, 34 features, 8 tech debt items completed in Sessions 1-40+.
> See AUDIT_REPORT.md for full fix history.
