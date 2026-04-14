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

## Modals, Popups & Feedback-Systeme

### Close-Button Sizing
49. **[Click Target]** PlayerProfileModal.tsx:152 — Close-Button nur 8x8px, weit unter 32px Minimum
50. **[Click Target]** QuestDetailModal.tsx:132 — btn-close 18px Font, Hit-Target zu klein

### Z-Index Chaos
51. **[Z-Index]** DashboardModals.tsx:385,413,449 — Info-Overlays `zIndex: 9999` vs RewardCelebration `z-[200]`. Inkonsistente Strategie.
52. **[Z-Index]** DashboardModals.tsx:321 — Modifier-Modal-Backdrop `zIndex: 9999` während Parent-Currency-Modal nur `z-[90]`
53. **[Z-Index]** ToastStack.tsx:330 — ToastStack `z-[150]` liegt UNTER RewardCelebration `z-[200]`. Error-Toasts während Quest-Completion unsichtbar.

### Async/Loading Feedback
54. **[Loading State]** ItemActionPopup.tsx:46 — Keine Loading-Animation bei Item-Actions, nur Opacity-Change. Auf langsamen Netzen unklar ob Button funktioniert.
55. **[Loading State]** QuestDetailModal.tsx:247 — "Claiming…" Text aber kein Spinner/Cursor-Feedback. Button sieht bei opacity 0.6 noch klickbar aus.

### Backdrop/Close Verhalten
56. **[Close Animation]** DashboardModals.tsx:57 — ESC-Taste resettet mehrere States ohne Animation-Delay. Harter Unmount statt Fade-Out.
57. **[Scroll]** DashboardModals.tsx:156 — Kein `overscrollBehavior: contain` in Modals. Auf Mobile kann Scrollen Pull-to-Refresh triggern.
58. **[Backdrop]** QuestDetailModal.tsx:79 — Wenn Modal höher als Viewport (80vh), ist scrollender Backdrop-Bereich klickbar und schließt versehentlich.

### Accessibility
59. **[Focus]** OnboardingWizard.tsx:250 — Kein initialer Focus-Set auf erstes interaktives Element. Keyboard-User haben keinen Focus-Indikator.
60. **[aria]** PlayerProfileModal.tsx:149 — Fehlt `aria-modal="true"` Attribut

## Animations & Game Feel

### Performance (Layout Thrash)
61. **[Performance]** TodayDrawer.tsx:914,1037,1081 — Progress-Bars animieren `width` direkt statt `transform: scaleX()`. Erzeugt Reflow jeden Frame. Auf schwachen Geräten Jank.
62. **[Performance]** WorldBossView.tsx:757 — Damage-Leaderboard-Bar mit `transition: "width 0.3s"`, selbes Layout-Thrash-Problem

### Timing & Feel
63. **[Timing]** globals.css:636 — `reward-title-glow` Animation 1.5s, zu langsam für Celebration. WoW/Diablo pulsieren bei 1.0-1.2s.
64. **[Timing]** GachaPull.tsx:287 — Gacha-Reveal-Card 0.5s ease-out nach 5.8s Charge ist zu langsam. Genshin-Impact-Standard: 0.25-0.3s für snappy Payoff.
65. **[Timing]** globals.css:649 — Reward-Pills cascadieren mit 0.15s Intervals — zu schnell, erzeugt visual noise bei vielen Rewards

### Missing Animations
66. **[Missing Animation]** RewardCelebration.tsx:542 — "Nehmen"-Button erscheint ohne Animation (hard cut). Sollte 0.4s nach Modal-Entrance fade+scale rein.

### Overuse
67. **[Overuse]** page.tsx:1242 — Streak-Warning nutzt `animate-pulse` (2s, sanft) — zu sanft für Urgency. Sollte 1.2s mit stärkerem Opacity-Shift sein.

## Responsive & Mobile

*Aktuell nicht relevant — Mobile ist noch nicht supported. Wird übersprungen.*

## Error Handling UX

### Silent Failures (User sieht NICHTS bei Fehler)
68. **[Silent]** QuestModals.tsx:364 — Co-op Quest Creation Fehler wird nur in Console geloggt, User sieht nichts
69. **[Silent]** QuestPanels.tsx:543 — Vow-Abandonment: DELETE-Fehler komplett verschluckt mit `catch { /* ignore */ }`
70. **[Silent]** RitualChamber.tsx:543 — Vow/Habit-Deletion: `catch { /* ignore */ }` — komplett stumm bei Fehler
71. **[Silent]** CodexView.tsx:69 — Content-Loading-Fehler verschluckt: `.catch(() => {})` — kann endlose Loading-Animation erzeugen
72. **[Silent]** WorldBossView.tsx:225 — Endpoint-Fehler stumm ignoriert, kein Fallback-UI

### Generische/Zu kurze Error Messages
73. **[Auto-Dismiss]** SocialView.tsx:1527 — Mail-Deletion Error verschwindet nach 4s, zu kurz zum Lesen
74. **[Auto-Dismiss]** DailyLoginCalendar.tsx:49 — Claim-Bonus Error nach 3-5s weg, nur "Network error"
75. **[Generic]** ForgeView.tsx:619 — Dismantle-Fehler zeigt nur "Network error" ohne Kontext was schiefging
76. **[Generic]** ForgeView.tsx:654 — Dismantle-All: "Something went wrong. Try again" — keinerlei Detail

### Missing Response Validation
77. **[No .ok Check]** GachaView.tsx:735 — History-Fetch parst JSON ohne `r.ok`-Check. Bei 500er Error crasht JSON-Parse stumm.

### Pattern-Zusammenfassung
- `catch { /* ignore */ }` kommt **8+ mal** vor
- `.catch(() => {})` kommt **7 mal** vor
- Auto-Dismiss Zeiten: 3-6 Sekunden, oft zu kurz für Fehlermeldungen

## Visuelle Konsistenz

### Falsche Farben
78. **[Farbe]** ChallengesView.tsx:700 — Essenz wird als `#3b82f6` (blau) angezeigt statt `#ef4444` (orange). Falsche Currency-Farbe!

### Inkonsistente Border-Radii
79. **[Radius]** ChallengesView.tsx:80,816 — Mischt `rounded-md` (6px) mit `rounded-lg` (8px) in derselben View für gleiche Element-Typen

### Inkonsistente Section-Headers
80. **[Header]** ChallengesView.tsx:431 — Expedition-Header ist `text-lg` mit textShadow, Star-Path-Header nur `text-sm` ohne Shadow. Gleiches semantisches Level, unterschiedliches Gewicht.

### Currency-Display Inkonsistenz
81. **[Currency]** DungeonView.tsx:753 — Gold/Essenz manchmal mit Icon + Background, manchmal nur als Text. Zwei verschiedene Styles für selbe Daten.

### Button-Padding Inkonsistenz
82. **[Padding]** QuestCards.tsx:490 — Primary-Action-Buttons `px-3` während andere Views konsistent `px-4` nutzen. Quest-Buttons wirken gequetscht.

### Currency-Bar Alignment (User-Reported)
83. **[Alignment]** page.tsx:1262 — Currency-Icons und Zahlen sind horizontal versetzt. Ursache: `<Tip>` rendert ein `<span>` (inline), darin liegen Icon + Zahl als Inline-Kinder. Kein Flex-Layout innerhalb von Tip → Baseline-Alignment statt Center. **Fix:** Entweder den span in Tip als `inline-flex items-center gap-1` stylen, oder Icon und Zahl jeweils in eigene `<Tip>` wrappen und mit dem äußeren Flex-Container (`gap-1`) ausrichten.

## Data Consistency (automatisierte Prüfung)

### KRITISCH: World Boss Drops referenzieren nicht-existierende Items
84. **[Missing Items]** worldBosses.json — ALLE 35 uniqueDrops über alle 15 Bosse referenzieren Item-IDs die weder in gearTemplates.json noch uniqueItems.json existieren. Spieler die Bosse besiegen bekommen Referenzen auf Phantom-Items.

### HOCH: 32 Crafting-Items mit falschem Slot
85. **[Wrong Slot]** gearTemplates.json — 16 Juwelier-Items namens "Ring/Reif/Band" haben `slot=amulet` statt `slot=ring`. 7 Schmied-Items "Kettenhemd/Kettenpanzer" haben `slot=amulet` statt `slot=armor`. 6 Schneider-Items "Gewand" haben `slot=weapon` statt `slot=armor`. 3 "Kapuze"-Items haben `slot=armor` statt `slot=helm`.

### MITTEL: Tier/Level Mismatch bei 263 Crafted Items
86. **[Tier Mismatch]** gearTemplates.json — 263 Crafting-Items haben `tier` das nicht zum `reqLevel` passt (laut CLAUDE.md Regeln T1=1-8, T2=9-16, T3=17-24, T4=25-50). Systematisch 1 Tier zu niedrig. Möglicherweise Designentscheidung, widerspricht aber der Dokumentation.

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
