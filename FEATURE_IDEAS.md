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

