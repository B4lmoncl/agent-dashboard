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

### [FI-016] TodayDrawer Midnight Refresh
- **Quelle:** Original (UX)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** TodayDrawer.tsx: today-Variable und timeInfo sind einmal beim Mount berechnet und werden nie aktualisiert. Ritual/Pet-Resets, Tagesgruesse und Daily-Status gehen bei langen Sessions stale.
- **Warum:** Spieler die den Drawer ueber Mitternacht offen haben sehen veraltete Daten.

### [FI-017] Public Profile Gold Privacy
- **Quelle:** Diablo 3 (Profile Privacy)
- **Aufwand:** S (fertig — gefixt in Runde 85)
- **Bereich:** Backend
- **Beschreibung:** Gold-Balance war im Public Profile sichtbar. Entfernt.
- **Warum:** Spieler-Vermoegen ist privat. D3 zeigt nur Paragon Level, nicht Gold.

### [FI-018] Custom Class Onboarding Fix
- **Quelle:** Original (Bug Fix)
- **Aufwand:** S (fertig — gefixt in Runde 85)
- **Bereich:** Frontend
- **Beschreibung:** Custom Class ID wurde beim Onboarding verworfen.
- **Warum:** Spieler die eine Custom-Klasse erstellen hatten danach keine Klasse zugewiesen.

### [FI-019] World Boss in Active Content Section
- **Quelle:** Original (UX Completeness)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** TodayDrawer zeigt World Boss nur in "Urgent", nicht in "Active Content". Andere aktive Features (Rift, Dungeon, Expedition) erscheinen in beiden Sektionen.
- **Warum:** Inkonsistenz — Spieler koennten den World Boss verpassen wenn er nicht urgent ist.

### [FI-020] Variety Bonus Consistency
- **Quelle:** Original (Balance Fix)
- **Aufwand:** S (1h)
- **Bereich:** Backend
- **Beschreibung:** helpers.js: varietyBonus liest todayCompletions BEVOR recordUserCompletion laeuft. Der aktuelle Quest-Typ zaehlt nicht fuer den eigenen Variety-Bonus.
- **Warum:** Erste Quest eines neuen Typs bekommt 0 Stacks statt 1. Off-by-one.

### [FI-021] Shop Gold Buy Loading Guard
- **Quelle:** Original (UX)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** ShopView Gold-Buy Buttons haben keinen Loading-State. Double-Click feuert mehrere POSTs.
- **Warum:** Alle Currency-Shop Buttons haben Loading, nur Gold-Shop nicht.

### [FI-022] Currency Shop "Already Owned" State
- **Quelle:** Diablo 3 (Dye Shop)
- **Aufwand:** M (2-4h)
- **Bereich:** Both
- **Beschreibung:** Frames/Titles im Currency-Shop zeigen keinen "Owned" Status. Spieler muss kaufen um 409 zu bekommen.
- **Warum:** D3 zeigt "Already Learned" grau an. Spieler sollte vor dem Kauf wissen ob er das Item hat.

### [FI-023] NPC Chain Direct Links
- **Quelle:** WoW Classic (Quest Chain)
- **Aufwand:** M (2-4h)
- **Bereich:** Backend
- **Beschreibung:** NPC Quest Chains haben keine directen Links zwischen Steps (nextQuestId/prevQuestId). Chain Progression basiert auf chainIndex Arithmetik — fragil bei Quest-Deletion.
- **Warum:** WoW hat explizite Quest-Chain-Pointer. Robuster gegen Datenkorruption.

### [FI-024] Kanai Library Capacity Cap
- **Quelle:** Diablo 3 (Kanai's Cube)
- **Aufwand:** S (1h)
- **Bereich:** Backend
- **Beschreibung:** kanais-cube.js hat kein Library-Limit. Wächst unbegrenzt. D3 hat zwar auch kein Cap, aber ein UIUX-Display-Problem tritt auf bei 100+ Einträgen.
- **Warum:** Performance + UX. Irgendwann wird die Library-Anzeige unbrauchbar.

### [FI-025] Workshop Upgrades in UI
- **Quelle:** Diablo 3 (Artisan Upgrades)
- **Aufwand:** L (4-8h)
- **Bereich:** Frontend
- **Beschreibung:** Workshop Upgrades (Gold-Forged Tools, Loot Chance Amulet, etc.) sind im Backend komplett implementiert aber im Frontend nicht erreichbar. ShopView.tsx hat sie auskommentiert mit "moved to Artisan's Quarter" — aber es gibt keinen Artisan's Quarter View.
- **Warum:** Audit Fund: 4 permanente Upgrade-Trees komplett unerreichbar fuer Spieler.

### [FI-026] Image Alt Text Sweep
- **Quelle:** A11y (WCAG 2.1)
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** 22 von 152 img-Tags haben kein alt-Attribut. CLAUDE.md: "Alt text: Required for meaningful images; empty alt='' for decorative icons."
- **Warum:** Accessibility + CLAUDE.md Compliance.

### [FI-027] Expired Boss Claim Window
- **Quelle:** Original (Bug Fix — bereits gefixt)
- **Aufwand:** S (fertig)
- **Bereich:** Backend
- **Beschreibung:** World Boss Claim Endpoint rief getActiveBoss() nicht auf — abgelaufene Bosse konnten noch claimed werden.
- **Warum:** Gefixt in Runde 85+.

### [FI-028] Systematic Fetch Error Handling
- **Quelle:** Original (UX Robustness)
- **Aufwand:** L (4-8h)
- **Bereich:** Frontend
- **Beschreibung:** 15+ POST-Fetch-Calls in Frontend-Komponenten prüfen nicht r.ok und zeigen keinen Error-Toast bei Fehler. Betrifft: CampaignHub, CharacterView (inventory reorder), DashboardHeader (login/register/forgot-pw), FeedbackModal, ForgeView (craft/learn), OnboardingWizard (class/register), QuestModals (create/spawn). Pattern: fetch → .then(refresh) ohne Error-Check.
- **Warum:** Spieler-Aktionen die fehlschlagen geben kein Feedback. Sieht aus als wäre nichts passiert.

### [FI-029] Modal ESC Stack — Only Close Topmost
- **Quelle:** Original (UX Architecture)
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** Alle useModalBehavior-Instanzen registrieren ESC auf document-Level. Bei gestapelten Modals (z.B. RewardCelebration über einem anderen Modal) schliessen alle gleichzeitig statt nur das oberste. Braucht globalen Modal-Stack oder Event-Flag.
- **Warum:** ESC sollte nur das oberste Modal schliessen. Aktuell schliesst es alle gestapelten Modals auf einmal.

### [FI-030] Level-Up Reward Type
- **Quelle:** Diablo 3 (Level-Up Celebration)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** RewardCelebration hat keinen "levelUp" Typ — Level-Ups fallen auf den Quest-Theme zurueck. Eigener Theme mit dediziertem Sound/Visual waere besser.
- **Warum:** Level-Ups sind der wichtigste Progressions-Moment. Sollte sich besonders anfuehlen.

### [FI-031] Electron Security Hardening
- **Quelle:** Electron Security Best Practices
- **Aufwand:** M (2-4h)
- **Bereich:** Electron
- **Beschreibung:** electron-quest-app hat nodeIntegration: true + contextIsolation: false. Sollte auf contextIsolation: true + preload script umgestellt werden.
- **Warum:** Electron Security Guideline. Aktuell nicht kritisch (lokale App), aber Best Practice.

### [FI-032] Dependency Security Updates
- **Quelle:** npm audit
- **Aufwand:** S (1h)
- **Bereich:** DevOps
- **Beschreibung:** 2 Vulnerabilities: Next.js (HTTP smuggling, CSRF bypass, disk cache DoS) + path-to-regexp (ReDoS). Fix via npm audit fix (--force fuer Next.js Update 16.1.6 → 16.2.2).
- **Warum:** 1 High severity (ReDoS), 4 Moderate (Next.js). Should be updated in a dedicated PR with full testing.

### [FI-033] Missing World Boss Portraits (6)
- **Quelle:** Content Scan
- **Aufwand:** M (2-4h) — Pixellab Asset Generation
- **Bereich:** Data/Assets
- **Beschreibung:** 6 von 15 World Bosses haben fehlende Portrait-PNGs: aufschub-kraken, routine-sphinx, vergleichs-spiegel, imposter-phantom, komfortzone, deadline-drache. Alle 256x256px.
- **Warum:** Content Scan: Bosses ohne Portrait zeigen Fallback/broken Image im WorldBossView.

### [FI-034] Gap Recipes Missing Descriptions (3)
- **Quelle:** Content Scan
- **Aufwand:** S (1h)
- **Bereich:** Data
- **Beschreibung:** recipe-koch-gap-130, recipe-koch-gap-140, recipe-vz-gap-135 haben keine description. Brauchen Skulduggery Pleasant Humor.
- **Warum:** Content Completeness: 878/881 Recipes haben Descriptions.

### [FI-035] Missing Image onError Handlers (6)
- **Quelle:** CLAUDE.md UI Guidelines
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** 6 von 152 img-Tags haben keinen onError Handler. CLAUDE.md: "Always add onError handler to hide broken images gracefully."
- **Warum:** Broken Images zeigen das Browser-Default-Broken-Icon statt graceful zu verschwinden.

### [FI-036] Loading Skeletons for 14 Components
- **Quelle:** CLAUDE.md UI Guidelines
- **Aufwand:** L (4-8h)
- **Bereich:** Frontend
- **Beschreibung:** 14 Komponenten fetchen Daten on mount aber zeigen kein Loading-Skeleton: GachaView (3 parallele Fetches!), LeaderboardView, QuestModals, TalentTreeView, AdventureTomeView, ShopView, CampaignHub, CompanionsWidget, RitualChamber, QuestPanels, HonorsView, DashboardHeader, FeedbackModal, CVBuilderPanel.
- **Warum:** CLAUDE.md: "Skeleton loading: skeleton-pulse animation for placeholder cards during data fetch." User sieht leeren Screen bis alle Daten da sind.

### [FI-037] Replace window.confirm with Styled Modals
- **Quelle:** UX Consistency
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** 3 destructive actions nutzen browser-native window.confirm statt styled Modals: TavernView (leave), TalentTreeView (sacrifice), CharacterView (gem unsocket). ForgeView hat bereits ein eigenes Confirm-Modal.
- **Warum:** Native Browser-Dialoge brechen das visuelle Design und sind nicht theme-bar.

### [FI-038] CompanionsWidget setTimeout Cleanup
- **Quelle:** React Best Practices
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** CompanionsWidget hat 15 setTimeout→setState Calls ohne clearTimeout. Kann "setState on unmounted" Warnings erzeugen wenn Component vor Timeout abgebaut wird.
- **Warum:** React 19 behandelt das graceful (kein Crash), aber cleanup ist Best Practice.

### [FI-039] Achievement Filter + Search in HonorsView
- **Quelle:** Diablo 3 (Achievement Browser)
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** HonorsView hat keine Filter/Suche. 165 Achievements werden alle gleichzeitig gerendert. Braucht: Filter nach earned/unearned, Rarity-Filter, Category-Tabs, Suchfeld.
- **Warum:** D3 hat einen vollen Achievement-Browser mit Kategorie-Tabs + Fortschrittsbalken pro Kategorie. Aktuell ist alles ein langer Scroll.

### [FI-040] Achievement Points Display
- **Quelle:** CLAUDE.md (Achievement Points System)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** HonorsView rendert keine Achievement-Punkte obwohl achievementTemplates.json ein points-Feld hat und CLAUDE.md ein Punktesystem definiert (common=5, uncommon=10, rare=25, epic=50, legendary=100). Points sollten pro Achievement und als Gesamtsumme angezeigt werden.
- **Warum:** CLAUDE.md definiert cosmetic frame unlocks bei Punktemeilensteinen. Die Punkte werden nirgends angezeigt.

### [FI-041] Ritual Complete Loading State
- **Quelle:** UX Best Practice
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** RitualChamber "Check off" Button hat keinen Loading-State während des API-Calls. Double-Click möglich.
- **Warum:** Alle anderen Action-Buttons haben Loading-Guards. Rituals nicht.

### [FI-042] Quest Pool Size Display
- **Quelle:** WoW Classic (Available Quests Counter)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** Die Quest-Pool-Größe (wie viele Quests zur Auswahl stehen) wird nirgends angezeigt. Der Talent "quest_pool_size" erhöht sie aber der Spieler sieht nicht wie viele Quests im Pool sind vs. Maximum.
- **Warum:** Transparenz: Spieler weiß nicht wie sein Talent die Questauswahl beeinflusst.

### [FI-043] Crafting Material Source Hints
- **Quelle:** WoW Classic (Material Tooltip Sources)
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** Materials in der ForgeView Craft-Preview zeigen keinen Hinweis WO man sie bekommt (Quest-Drops, Vendor, Crafted). WoW zeigt "Drops from: X" auf jedem Material.
- **Warum:** Spieler weiß nicht wo er fehlende Materialien farmen soll.

### [FI-044] Tavern Rest Duration Preview
- **Quelle:** Original (UX)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** TavernView "Enter the Hearth" zeigt keine Preview wie lange Streak+Forge eingefroren werden. Der Spieler muss die Anzahl Tage erst eingeben bevor er sieht was passiert.
- **Warum:** Transparenz vor dem Commitment.

### [FI-045] Profession Synergy Display
- **Quelle:** WoW Classic (Profession Pairing)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** professions.json hat "synergies" Felder die Profession-Pairings beschreiben (z.B. Schmied+Lederverarbeiter). ForgeView zeigt diese Synergien nicht an wenn man eine zweite Profession wählt.
- **Warum:** WoW zeigt "Recommended pairing" bei der Professionswahl. Hilft Neulingen.

### [FI-046] Campaign Quest Chain Sorting
- **Quelle:** WoW Classic (Quest Chain Display)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** CampaignHub rendert Quests in API-Reihenfolge ohne Sort. Wenn Backend Quests in Insertion-Order liefert statt Chain-Order, ist die Anzeige falsch. Sollte nach chainIndex sortiert werden.
- **Warum:** Campaign Timeline zeigt Quests möglicherweise in falscher Reihenfolge.

### [FI-047] RoadmapView Loading State
- **Quelle:** UX
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** RoadmapView flasht "No roadmap items yet" bevor der Fetch auflöst. Braucht loading-State mit Skeleton.
- **Warum:** Jede View-Öffnung zeigt kurz den Empty-State bevor Daten erscheinen.

### [FI-048] Daily Diminishing Returns Proactive Warning
- **Quelle:** HSR (Trailblaze Power Warning)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** Zeige nach Quest 4 ein subtiles Banner: "Noch 1 Quest mit voller Belohnung heute." Bei Quest 6+ zeige den aktuellen DR-Multiplikator (75%/50%/25%) neben der Quest-Belohnungs-Vorschau.
- **Warum:** Spieler wissen erst bei Quest 6 von Diminishing Returns. HSR zeigt Trailblaze Power immer prominent an.

### [FI-049] Gacha Banner Expiry Countdown
- **Quelle:** HSR / Genshin (Banner Timer)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** GachaView Banner-Cards zeigen keinen Countdown bis zum nächsten Banner-Wechsel. HSR zeigt immer "Ends in X days" prominent an.
- **Warum:** FOMO-Mechanik für Engagement. Spieler weiß nicht wann der Banner wechselt.

### [FI-050] Companion Bond Progress Bar
- **Quelle:** Diablo 3 (Follower Level)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** CompanionsWidget zeigt Bond-Level als Zahl aber keinen Fortschrittsbalken zum nächsten Level. D3 zeigt immer eine XP-Bar für den Follower.
- **Warum:** Spieler sieht nicht wie nah er am nächsten Bond-Level ist.

### [FI-051] Trade Round Item Names Display
- **Quelle:** Diablo 3 (Trade Window)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** SocialView Trade-Verhandlungsrunden zeigen nur "+N items" statt Item-Namen. D3 zeigt immer die exakten Items mit Rarity-Color im Trade-Window.
- **Warum:** Spieler kann nicht nachvollziehen was in welcher Runde angeboten wurde.

### [FI-052] Stale Trade Item Validation
- **Quelle:** WoW Classic (Trade Window)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** SocialView proposeTrade validiert nicht ob Items noch im Inventar sind wenn Submit gedrückt wird. Stale loggedInUser-Snapshot kann Items referenzieren die schon weg sind.
- **Warum:** WoW re-validiert Items bei Trade-Bestätigung. Aktuell schickt Frontend blinde Item-IDs.

### [FI-053] Quest Type Icons per Card
- **Quelle:** WoW Classic (Quest Type Icons)
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** QuestCards zeigen den Quest-Typ als Text-Label. WoW zeigt ein kleines Icon pro Quest-Typ (Tägliche Quest = blaues !, Elite = Totenkopf, Gruppierung = Schwert+Schild). Eigene Icons pro Typ (development, learning, fitness, social, personal) wären besser als Text.
- **Warum:** Visuelle Differenzierung auf einen Blick. Text-Labels erfordern Lesen.

### [FI-054] Quest Time Estimate Display
- **Quelle:** Habitica (Task Duration)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** Quest-Karten zeigen keine geschätzte Dauer. questCatalog.json hat ein "estimatedMinutes" Feld auf vielen Templates. Sollte als "~15 min" angezeigt werden.
- **Warum:** Habitica zeigt Task-Duration. Hilft bei der Planung welche Quest zuerst angegangen wird.

### [FI-055] Session Stats Summary
- **Quelle:** HSR (Session End Summary)
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** HSR zeigt am Ende einer Session: "Du hast X Quests abgeschlossen, Y XP verdient, Z Gold erhalten, Level A→B." Sowas fehlt komplett. Ein TodayDrawer-Widget könnte das zeigen.
- **Warum:** Spieler bekommt kein Gesamtbild seiner Session-Leistung. Nur einzelne Quest-Rewards.

### [FI-056] Crafting Buff Effect Preview
- **Quelle:** WoW Classic (Potion Tooltip)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** ForgeView Craft-Preview zeigt für Buff-Rezepte nur "3 Quests remaining". Sollte den tatsächlichen Effekt zeigen: "+10% XP für 3 Quests" oder "+2 Kraft für 3 Quests".
- **Warum:** Spieler sieht nicht was der Buff tut bevor er craftet. WoW-Potions zeigen immer den exakten Effekt.

### [FI-057] Passive Buff Active Indicator
- **Quelle:** Diablo 3 (Active Buffs Bar)
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** Aktive Buffs (aus Crafting, Shop, Companions) werden nirgends zentral angezeigt. D3 hat eine Buff-Bar am oberen Bildschirmrand die alle aktiven Effekte mit Timer zeigt.
- **Warum:** Spieler weiß nicht welche Buffs aktiv sind oder wie viele Quests noch übrig sind.

### [FI-058] Quest Difficulty Visual Scaling
- **Quelle:** Diablo 3 (Torment Difficulty)
- **Aufwand:** M (2-4h)
- **Bereich:** Frontend
- **Beschreibung:** Quest-Rarity bestimmt Schwierigkeit und Belohnung, aber die visuelle Darstellung ist nur ein kleines Farb-Dot. D3 zeigt Difficulty prominent mit Schädelicons und farbiger Umrandung. QuestCards sollten Rarity stärker visuell kommunizieren (größerer Accent, Glow-Border, etc).
- **Warum:** Common und Legendary Quests sehen fast gleich aus bis auf einen kleinen Farbakzent.

### [FI-059] Crafting Queue (Batch Progress)
- **Quelle:** WoW Classic (Craft Queue)
- **Aufwand:** L (4-8h)
- **Bereich:** Both
- **Beschreibung:** Beim Batch-Craften (x10) zeigt ForgeView nur das Endergebnis. WoW zeigt einen Fortschrittsbalken der jeden einzelnen Craft animiert mit Skill-Up-Chance pro Craft. Jeder erfolgreiche Skill-Up wird einzeln gefeiert.
- **Warum:** Batch-Craften fühlt sich wie ein Klick an statt wie 10 individuelle Crafts. Skill-Up-Celebrations gehen unter.

### [FI-060] Quick-Navigate from Celebration Popup
- **Quelle:** HSR (Quick Actions in Popups)
- **Aufwand:** S (1h)
- **Bereich:** Frontend
- **Beschreibung:** RewardCelebration Popup zeigt nur "Nehmen" als Aktion. HSR zeigt nach Boss-Kill auch "Loot anzeigen" oder "Nochmal spielen". QH könnte "Inventar öffnen" (wenn Loot), "Nächste Quest" (wenn Chain), "Leaderboard" zeigen.
- **Warum:** Nach dem Reward-Popup muss der Spieler manuell navigieren. Quick-Actions sparen Klicks.
