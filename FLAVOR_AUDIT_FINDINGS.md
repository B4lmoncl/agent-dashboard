# AAA Polish Audit — Findings

Gesammelt während des Autopilot-Audits. **Nichts wird ohne Absprache geändert.**

## Fokus
UI/UX Improvements, AAA-Feinschliff, Polishing

---

## UI/UX Findings

### QuestCards.tsx
1. **[Click Target]** :348 — Checkbox-Button nur 14px (`w-3.5 h-3.5`), unter 32px Minimum für Touch-Targets
2. **[Hover State]** :487 — Unclaim-Button hat keine Hover-Transition auf Background-Farbe
3. **[Disabled State]** :490 — Complete-Button nutzt nur `opacity: 0.5` wenn disabled, kein `cursor: not-allowed`

### DashboardHeader.tsx
4. **[Accessibility]** :273 — Volume-Slider hat keinen `:focus-visible` Ring für Keyboard-Navigation
5. **[Hover Flash]** :324 & 342 — Settings-Popup-Items nutzen inline `onMouseEnter` für Background — flasht bei schnellem Hovern statt CSS transitions
6. **[Disabled State]** :383 — Login-Button nutzt nur opacity bei loading, kein `cursor: not-allowed`

### TodayDrawer.tsx
7. **[Close Animation]** :446 — Drawer schließt auf ESC ohne Close-Transition (kein exit-animation, nur sofortiges Verschwinden)

### UserCard.tsx
8. **[Inconsistency]** :277, 289, 300 — Mischt inline `fontSize: 12` mit Tailwind `text-xs` in verschiedenen Sections — inkonsistentes Pattern
9. **[Emoji Size]** :369 — Companion-Emoji `fontSize: 14` während andere Icons `size={16}` nutzen

### CompanionsWidget.tsx
10. **[Disabled State]** :787 — Ultimate-Button: disabled-State nur Cursor, keine Opacity/Saturation-Anpassung
11. **[Disabled State]** :1029 & 1079 — Expedition-Buttons: `cursor: not-allowed` aber keine Opacity-Reduktion
12. **[Interactive Feedback]** :880 — Quest-Completion-Button nutzt scale(0.95) ohne Spring/Bounce, fühlt sich starr an

### CharacterView.tsx
13. **[Hover State]** :2219 — ESC-Close-Button (w-8 h-8) hat kein Hover-/Active-Feedback
14. **[Click Target]** :357 — Online-Status-Indicator nur 16px (w-4 h-4), zu klein falls interaktiv

### ForgeView.tsx
15. **[Transition]** :953 — Material-Storage-Toggle hat keine `transition-` Class, State wechselt hart
16. **[Click Target]** :2365 — Increment/Decrement Buttons nur 24px (w-6 h-6), unter 32px Touch-Minimum
17. **[Disabled State]** :2130 — Crafting-Button bei Loading: opacity-Wechsel aber kein `cursor: not-allowed`

### GachaView.tsx
18. **[Affordance]** :820 — "Vault of Fate" Heading ist klickbar (`onClick`), aber optisch kein Hinweis darauf
19. **[Hover State]** :874 — History-Einträge haben keinen Hover-Background trotz Klickbarkeit

### SocialView.tsx
20. **[Hover Transition]** :327 — Remove-Friend-Button erscheint sofort bei group-hover, keine `transition-opacity`
21. **[Hover State]** :639 — Trade-Items haben `cursor: pointer` aber kein Hover-Background

### ShopView.tsx
22. **[Empty State]** :301 — "No items available" nutzt `text-w20`, zu subtil für wichtige Statusmeldung
23. **[Disabled State]** :338 — Currency-Buy-Buttons: opacity-Wechsel aber kein `cursor: not-allowed` bei `!canAfford`

### Cross-Component
24. **[Disabled Inconsistency]** — Verschiedene Files handhaben disabled-States unterschiedlich: manche nur opacity, manche opacity+cursor, manche nur cursor. Sollte standardisiert werden.
25. **[Layout Shift]** — Kein Skeleton-Placeholder für Image-Fallbacks (Portraits, Companion-Portraits). `onError` blendet aus, zeigt aber keinen Placeholder.
26. **[Hover Transitions]** — Viele interaktive Elemente nutzen inline `onMouseEnter`/`onMouseLeave` statt CSS `hover:` mit Transitions. Erzeugt harte State-Wechsel.

### RiftView.tsx
27. **[Click Target]** :615 — Level-Selector +/− Buttons nur 28px (w-7 h-7), unter 32px Minimum. Kritische Gameplay-Controls.
28. **[Empty State]** :650 — Mythic-Leaderboard zeigt nur "No entries" ohne Kontext. Besser: "Complete any Mythic+ to appear here."
29. **[Loading State]** :707 — Leaderboard hat keinen Skeleton beim ersten Laden. Sieht kaputt aus.

### DungeonView.tsx
30. **[Click Target]** :506 — Teilnehmer-Avatare 32px mit 2px Border = effektiv 28px Click-Area
31. **[Layout Shift]** :639 — Confirm-Cancel-Buttons erscheinen ohne reservierte Höhe, erzeugt Layout-Sprung

### WorldBossView.tsx
32. **[Disabled State]** :333 — Boost-Button: opacity 0.5 aber kein `cursor: not-allowed`

### BattlePassView.tsx
33. **[Disabled State]** :368 — Claim-Button bei disabled: nur opacity, kein cursor-Feedback

### ChallengesView.tsx
34. **[Disabled State]** :148 — Milestone-Buttons: `disabled=true` aber kein `cursor: not-allowed`
35. **[Missing Tooltip]** :281 — Speed-Bonus Badge "★" hat kein Tooltip/Help-Cursor

### FactionsView.tsx
36. **[Hover State]** :350 — Standing-Roadmap-Dots haben kein Hover-Feedback
37. **[Disabled State]** :383 — Reward-Navigation zeigt nicht disabled-State wenn Reward unavailable

### TalentTreeView.tsx
38. **[Layout Shift]** :286 — Retry-Button bei Error erscheint ohne reservierten Platz

### CodexView.tsx
39. **[Empty State]** :287 — Undiscovered Entries zeigen nur "???" ohne Tooltip/Erklärung was man tun muss zum Freischalten
40. **[Affordance]** :317 — Collapsible-Sections ohne Chevron-Rotation-Animation, minimal visuell

### AdventureTomeView.tsx
41. **[Layout Shift]** :163 — Progress-Ring SVG (80x80) ohne reservierten Container, erzeugt Shift beim Laden
42. **[Disabled State]** :516 — Unclaimed-Milestone "◇" ohne Tooltip und ohne Cursor-Style

### TavernView.tsx
43. **[Hover Transition]** :249 — Duration-Selector-Buttons ohne Hover- und Transitions-Effekte

### LeaderboardView.tsx
44. **[Hover State]** :162 — Podium-Cards klickbar aber ohne Hover-Styling (kein Background/Scale/Shadow)
45. **[Hover Transition]** :247 — Leaderboard-Rows haben `hover:bg` aber keine Transition-Duration

### HonorsView.tsx
46. **[Click Target]** :234 — Filter-Buttons nur ~20px hoch (text-xs, px-2 py-0.5), weit unter 32px
47. **[Disabled State]** :303 — Locked-Hidden-Achievements opacity 0.5 aber kein `cursor: not-allowed`
48. **[Missing Tooltip]** :370 — Category-Headers ohne Tooltips, "Secret Achievements" Formatierung unklar

### RitualChamber.tsx / WandererRest.tsx
*(Keine kritischen AAA-Issues gefunden)*

---

## Zusammenfassung nach Kategorie

| Kategorie | Anzahl | Priorität |
|-----------|--------|-----------|
| Missing Hover/Transition | 12 | Medium |
| Disabled State ohne Cursor/Tooltip | 10 | High |
| Click Targets < 32px | 5 | High |
| Missing Tooltips | 4 | Medium |
| Layout Shift | 3 | Medium |
| Empty State verbesserbar | 2 | Low |
| Missing Loading/Skeleton | 1 | Low |
| Inkonsistente Patterns | 2 | Low |

**Top-Priorität Fixes:**
1. Disabled-States standardisieren (alle: opacity + cursor + tooltip)
2. Click-Targets auf min 32px bringen
3. Hover-Transitions auf interaktive Elemente

---

## Flavor Text Findings

*(Keine neuen Text-Issues. 4400+ Texte geprüft, alles clean.)*

---

## Bereits gefixt (diese Session)
- Companion Level-Up RewardCelebration
- Wanderer's Rest Tutorial hinzugefügt
- Challenges Tutorial Text gefixt
- Bazaar Tutorial Bug gefixt (nur im Loading-State)
- Material Storage Redundanz entfernt
- Companion Tutorial von Character→Companion verschoben
- Artisan's Quarter Button aus Character Screen entfernt
- Talent Tree Tutorial Text gefixt
- Codex Unlock Requirements erhöht (83→15 easy unlocks + Revalidierung)
- Sworn Bonds Proposal-Modal mit 3 Dauern
- Text-Opacity Boost (text-w10 bis text-w35)
- Flavor-Texte von text-xs auf text-sm in Modalen/Views
