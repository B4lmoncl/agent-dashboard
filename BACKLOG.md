# Quest Hall — Backlog
<!-- Last updated: 2026-03-17 — merged from Leon's Liste + API Feedback -->

## 🐛 BUGS

1. Character Screen: Hintergrundbild oben abgeschnitten
2. Lindi Klasse "Network Sage" noch in Proving Grounds Stat Card
3. Item-Icons im Inventar/Gear verpixelt (CSS Fix deployed, Verifikation ausstehend)

## ⚡ QUICK WINS

4. LVL Up: Animation + Belohnung (Gold Glow, Cheer)
5. Companion Quest: Visuelles Feedback beim Abschließen
6. Locked Quests entfernen (keinen Zweck)
7. Flavor Text in Items (Inventar)
8. Gear: Hover Tooltip bei ausgerüstetem Gear
9. Companion: Bond Level/XP Infos im Character Screen
10. Stats: Tooltips wie genau sie funktionieren
11. NPC Items doppelt → gegen wertvollen Kram eintauschen
12. Passive Items unterm Gear anzeigen (selten)

## ⭐ FEATURES (Mittelfristig)

13. Companion wechseln + Bond bleibt (Lindi)
14. Steam-Style Spielerprofile ansehen (Lindi)
15. Vow Rework: positive Langzeitziele, nicht nur Verzicht (Lilly) — GUTER Punkt
16. Ritual Schwierigkeitsgrad + Rewards anpassbar (Lilly)
17. Bond + Mood Split (Leon approved)
18. Tab Notification System — gelber Glow bei neuem Content [Roadmap: planned]
19. Level-Locked Sections (Tabs locked by Level)
20. Quests im Spieler-Menü — Mini-Übersicht aktive Quests + Rituale (Lilly)
21. Legendary Item Effects — z.B. Forge-Decay-Reduktion (Leon)
22. Bloodbond Bonus 180/365 Tage massiv erhöhen + Premium-Währung (Leon)
23. Pet Bild + Fellfarbe auswürfeln + Streichel-Animation (Lilly)
24. Background v2 — Tag/Nacht-Wechsel Himmel
25. Mini Companions: Eigener Name + Bild (nicht "Pets")
26. NPC Alchemistengilde — Currency tauschen
27. Bazaar → "Deepforge" Tab + Tools schwerer erarbeiten
28. Bazaar Händler NPC [Roadmap: planned]
29. NPC als Preis im Gacha Banner [Roadmap: planned]
30. Economy Balancing [Roadmap: planned]

## 🔧 TECH DEBT
- [ ] Backend Cleanup: Doppelte Werte / Formeln aufspüren und zentralisieren
  - Streak-Formel war 4x definiert (helpers.js 2x, players.js, users.js)
  - Level-Tabelle war 3x definiert (levels.json, utils.ts, page.tsx inline)
  - Forge-Multiplier hatte Stat-Bonus reingebacken statt separat
  - → Alles mit grep -rn durchforsten, Single Source of Truth erzwingen
  - → Shared constants Datei für Formeln die Backend + Frontend brauchen

## 🚀 PHASE 2 (Große Features)

31. Season System v2 [Roadmap: planned]
32. Campaign v2 — lange Quest-Chains / The Observatory [Roadmap: planned]
33. Starweaver Special Quests — LLM Chat [Roadmap: planned]
34. The Arcanum — Klassen-System [Roadmap: planned]
35. Sound Effects & Music [Roadmap: planned]
36. Onboarding Rework (Fantasy-Wizard)
37. Login Redesign (Passwort statt API Key)
38. Custom Character Avatar (Lilly)
39. Friendship System — anfreunden, anstupsen (Lilly)
40. Coop-Rituale mit Einladungssystem (Lindi)
41. Eigene Quests vorschlagen / User-Generated (Lilly)
42. Navigation: Raum-zu-Raum statt Tabs
43. Grund-Lore etablieren
