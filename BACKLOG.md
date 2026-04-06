# Quest Hall — Backlog
<!-- Last updated: 2026-04-02 — cleaned up after Autopilot Audit -->

## Open Bugs

*(none currently known — last audit: 2026-04-05)*

## Open Features

### Near-Term
- ForgeView: BoE badge, gem-cut/gem-merge recipe display
- Mail system: decide keep or remove (overlaps messaging + trading, but enables NPC/system mail)

### Resolved (from previous backlog)
- ~~Character Screen: Background image clipped at top~~ → Fixed (backgroundSize: cover)
- ~~CharacterView: Ring slot~~ → Already exists in EQUIP_SLOT_LABELS
- ~~Profession synergy hints~~ → professions.json has synergies field, ForgeView shows them

### Medium-Term (Phase 2)
- Season System v2 — Battle Pass expanded rewards
- Campaign v2 — The Observatory quest chains
- Starweaver Special Quests — LLM Chat integration
- The Arcanum — Class system expansion
- Custom Character Avatar
- Coop-Rituals with invitation system
- User-Generated Quests (suggest system exists, full UGC pending)

## Tech Debt

- [x] **REMOVE PRIORITY SYSTEM** — Completed 2026-04-02. ~139 refs in 30+ files replaced with rarity.
- [ ] page.tsx monolith (~2350 lines) — extract into feature modules
- [ ] Missing JSON Schema validation for template files

## Completed (archived)

> 20 bugs, 7 quick wins, 34 features, 8 tech debt items completed in Sessions 1-40+.
> See AUDIT_REPORT.md for full fix history.
