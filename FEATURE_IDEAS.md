# Feature Ideas — Autopilot Generated

> Gesammelt waehrend des Autopilot Audits. Markiert mit Quelle (WoW/D3/HSR/Original) und geschaetztem Aufwand.
> **Nichts hier ist implementiert** — nur Vorschlaege zur Diskussion.

---

## Format

```
### [FEATURE_ID] Feature Name
- **Quelle:** WoW Classic / Diablo 3 / HSR / Original
- **Aufwand:** S (1h) / M (2-4h) / L (4-8h) / XL (8h+)
- **Bereich:** Backend / Frontend / Both / Data
- **Beschreibung:** Was genau
- **Warum:** Welches Problem loest es / welchen Spass bringt es
```

---

### [FI-001] Feature Unlock Roadmap
- **Quelle:** Original (inspiriert von HSR Trailblaze)
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** Sichtbare Timeline im Dashboard die zeigt welche Features bei welchem Level freischalten. "Lv5: Gacha + Berufe, Lv8: Leaderboard, Lv10: Factions..."
- **Warum:** Player Journey Audit: Neue Spieler wissen nicht was kommt. Level-Gates sind silent.

### [FI-002] NPC Quest Decline Button
- **Quelle:** WoW Classic (NPC Quest Decline)
- **Aufwand:** S (1h)
- **Bereich:** Both
- **Beschreibung:** Expliziter "Ablehnen" Button fuer NPC-Quest-Ketten im WandererRest Modal.
- **Warum:** WoW hat immer Accept + Decline. Unclaim ist nicht das Gleiche wie Decline.

### [FI-003] Stardust Earn Path Tooltip
- **Quelle:** HSR (Stellar Jade sources)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** Im Gacha-View wenn Stardust nicht reicht: Tooltip zeigt alle Quellen.
- **Warum:** Neue Spieler unlocken Gacha bei Lv5 mit 0 Stardust und keinem Hinweis.

### [FI-004] Daily Diminishing Returns Warning
- **Quelle:** Original
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** Vorwarnung bei Quest 4/5 bevor Diminishing Returns einsetzen.
- **Warum:** Spieler erfahren erst bei Quest 6 von den Reduced Rewards.

### [FI-005] Bolstering Rift Affix Implementation
- **Quelle:** WoW Mythic+ (Bolstering)
- **Aufwand:** M (2-4h)
- **Bereich:** Backend
- **Beschreibung:** Bolstering-Affix mechanisch implementieren (Timer -1h pro Stage).
- **Warum:** Affix ist definiert und angezeigt aber hat keinen Effekt.

### [FI-006] Campaign Reward Tracking
- **Quelle:** WoW Classic
- **Aufwand:** M (2-4h)
- **Bereich:** Backend
- **Beschreibung:** campaigns.js braucht claimedRewards + Claim-Endpoint + Double-Claim-Guard.
- **Warum:** Kein Reward-Tracking existiert. Potentieller Double-Claim.

### [FI-007] Onboarding System Explanations
- **Quelle:** HSR (Pom-Pom Tutorial)
- **Aufwand:** L (4-8h)
- **Bereich:** Frontend
- **Beschreibung:** OnboardingWizard: Core Systems erklaeren (XP, Tower, Quests, Streaks).
- **Warum:** Neue Spieler bekommen null Erklaerung der Kern-Mechaniken.


### [FI-008] State Management Refactor (page.tsx)
- **Quelle:** Original (React Best Practices)
- **Aufwand:** XL (8h+)
- **Bereich:** Frontend
- **Beschreibung:** page.tsx hat 90 useState Calls. State in Context/Reducer aufteilen (Dashboard, Player, UI). Reduziert Re-Renders.
- **Warum:** Performance: Jeder State-Update rendert den gesamten Component Tree neu. Splitting wuerde nur betroffene Subtrees re-rendern.

### [FI-009] Unique Named Items Content
- **Quelle:** Diablo 3 (Set Items / Uniques)
- **Aufwand:** L (4-8h)
- **Bereich:** Data
- **Beschreibung:** uniqueItems.json ist leer. Braucht 15-30 handgefertigte Items mit fixen Stats, Lore, und Flavor-Text. Quellen: World Boss, Mythic Rift, Special Events.
- **Warum:** D3 Uniques sind der Endgame-Antrieb. Aktuell gibts keine — Collection Log ist leer.

### [FI-010] Companion Pet Limit UX Feedback
- **Quelle:** Original
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** CompanionsWidget: Wenn Pet-Limit (2x/Tag) erreicht, Button zeigt "Tomorrow!" statt nur disabled.
- **Warum:** Spieler klickt Pet-Button, passiert nichts, kein Feedback warum.

### [FI-011] NPC Quest Double-Click Protection
- **Quelle:** Original (UX Best Practice)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** WandererRest Accept/Complete Buttons haben kein disabled-State waehrend API-Call. Kann doppelt geklickt werden.
- **Warum:** Audit Fund: Buttons spammbar ohne Loading-Guard.

### [FI-012] Tavern Leave Countdown Display Fix
- **Quelle:** Original (UX)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** TavernView zeigt "3d left" UND "3d 2h remaining" gleichzeitig. Redundant. Nur timeLeft() behalten.
- **Warum:** Audit Fund: Doppelte Anzeige desselben Werts.

### [FI-013] Rift Bolstering Affix Implementation
- **Quelle:** WoW Mythic+ (Bolstering)
- **Aufwand:** S (1h)
- **Bereich:** Backend
- **Beschreibung:** rift.js hat Bolstering-Affix definiert aber nie implementiert. Timer sollte -1h pro Stage reduziert werden.
- **Warum:** Affix verspricht Mechanik die nicht existiert. Bricht Spielervertrauen.

### [FI-014] Agents Command Queue Auth
- **Quelle:** Original (Security)
- **Aufwand:** S (1h)
- **Bereich:** Backend
- **Beschreibung:** GET /api/agent/:name/commands hat kein requireApiKey. Command Queue ist public lesbar.
- **Warum:** Security Audit: Command-Inhalte koennten sensibel sein.

### [FI-015] Campaign Quest Ordering
- **Quelle:** WoW Classic (Campaign Quest Chains)
- **Aufwand:** M (2-4h)
- **Bereich:** Backend
- **Beschreibung:** campaigns.js erzwingt keine Quest-Reihenfolge. Quest N kann vor N-1 abgeschlossen werden.
- **Warum:** Campaigns sollen sequentiell sein. Ohne Ordering ist die Story-Reihenfolge beliebig.
