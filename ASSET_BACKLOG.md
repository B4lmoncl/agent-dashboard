# Asset Backlog — Fehlende Bilder

> Stand: 2026-03-29. 196 fehlende Bilder, gruppiert nach Kategorie.

---

## Bildkategorien & Kontext

### 1. NPC Portraits (87 fehlend)
- **Wo sichtbar:** Wanderer's Rest NPC-Karten (56×56px), NPC-Modal Header (80×80px), Player Profile wenn NPC aktiv
- **Format:** 256×256px PNG, transparenter Hintergrund
- **Stil:** Pixel Art Halbkörper-Portrait, konsistent mit bestehenden NPCs (Oma Ilse, Karim, etc.)
- **Rahmen:** Abgerundetes Quadrat mit 2px Border in Berufsfarbe, Rank-basierte Border-Intensität
- **Vibe:** Jeder NPC hat eine eigene Persönlichkeit — siehe `npcQuestGivers.json` für `description` und `title`
- **Pfad:** `/images/npcs/{npc-id}.png`
- **WICHTIG:** NPCs spawnen ERST wenn portrait gesetzt ist (Engine-Filter in npc-engine.js)

**Fehlende NPC Portrait IDs:**
- `sable-nachtwind` — Sable Nachtwind (rare) — Die Schattenhändlerin
- `professor-quill` — Professor Quill (uncommon) — Der Zerstreute Gelehrte
- `eiserne-mara` — Eiserne Mara (uncommon) — Die Drill-Meisterin
- `koch-giovanni` — Giovanni Salzkruste (common) — Der Wanderkoch
- `meisterin-sera` — Meisterin Sera (epic) — Die Zeitlose
- `pip-zahnrad` — Pip Zahnrad (common) — Der Tüftler
- `alte-martha` — Alte Martha (common) — Die Kräutersammlerin
- `hans-holzfuss` — Hans Holzfuß (common) — Der Hausmeister
- `brieftraeger-emil` — Briefträger Emil (common) — Der Nachrichtenbote
- `gaertnerin-rose` — Gärtnerin Rose (common) — Die Pflanzenhüterin
- `schneider-lin` — Schneider Lin (common) — Der Stoffmeister
- `wachmann-kurt` — Wachmann Kurt (common) — Der Torwächter
- `putzfrau-helga` — Helga Saubermann (common) — Die Reinigungsmeisterin
- `geschichtenerzaehlerin-nadia` — Nadia Silberzunge (common) — Die Geschichtenerzählerin
- `zahlmeister-otto` — Zahlmeister Otto (common) — Der Schatzmeister
- `laufbursche-felix` — Laufbursche Felix (common) — Der Eilbote
- `bibliothekarin-ada` — Bibliothekarin Ada (uncommon) — Die Hüterin der Worte
- `trainer-rex` — Trainer Rex (uncommon) — Der Athletenflüsterer
- `apothekerin-yara` — Apothekerin Yara (uncommon) — Die Kräutermischerin
- `kartograph-werner` — Kartograph Werner (uncommon) — Der Wegebauer
- `uhrmacher-tick` — Uhrmacher Tick (uncommon) — Der Zeitwächter
- `netzwerkerin-luna` — Netzwerkerin Luna (uncommon) — Die Verbinderin
- `imker-boris` — Imker Boris (uncommon) — Der Bienenflüsterer
- `schreiberin-mei` — Schreiberin Mei (uncommon) — Die Chronistin
- `schlosser-grim` — Schlosser Grim (uncommon) — Der Schlüsselmeister
- `astrologe-celes` — Astrologe Celes (uncommon) — Der Sternendeuter
- `schmuggler-dante` — Schmuggler Dante (rare) — Der Grenzgänger
- `astronomin-stella` — Astronomin Stella (rare) — Die Sternenrechnerin
- `tavernenbesitzer-gus` — Wirt Gus (rare) — Der Reisende Wirt
- `bergsteigerin-kaya` — Bergsteigerin Kaya (rare) — Die Gipfelstürmerin
- `antiquar-simon` — Antiquar Simon (rare) — Der Zeitsammler
- `fechtmeisterin-ines` — Fechtmeisterin Ines (rare) — Die Klingenmeisterin
- `heiler-kaspar` — Heiler Kaspar (rare) — Der Körperleser
- `puppenspieler-marco` — Puppenspieler Marco (rare) — Der Maskenmacher
- `navigatorin-compass` — Navigatorin Compass (rare) — Die Wegfinderin
- `spieleerfinderin-nora` — Spieleerfinderin Nora (rare) — Die Regelschreiberin
- `kriegsmeisterin-valka` — Kriegsmeisterin Valka (epic) — Die Veteranin
- `alchemist-faye` — Alchemistin Faye (epic) — Die Experimentierfreudige
- `diplomat-aurelius` — Diplomat Aurelius (epic) — Der Goldene Vermittler
- `schmiedin-ignis` — Schmiedin Ignis (epic) — Die Flammengeborene
- `geisterjagerin-raven` — Geisterjägerin Raven (epic) — Die Schattensammlerin
- `chronist-aeon` — Chronist Aeon (legendary) — Der Zeitlose Archivar
- `tod-der-hoefliche` — Der Höfliche Besucher (legendary) — Der Unvermeidliche
- `meisterin-der-stille` — Die Stille (legendary) — Meisterin der drei Schweigen
- `bauer-ernst` — Bauer Ernst (common) — Der Erdverbundene
- `tanzlehrerin-vivienne` — Tanzlehrerin Vivienne (uncommon) — Die Rhythmusfinderin
- `detektiv-ash` — Detektiv Ash (rare) — Der Wahrheitsfinder
- `philosophin-helen` — Philosophin Helen (uncommon) — Die Fragensteller
- `tierpfleger-finn` — Tierpfleger Finn (common) — Der Tierflüsterer
- `maler-claude` — Maler Claude (uncommon) — Der Farbenseher
- `spion-echo` — Agent Echo (rare) — Der Schattenbeobachter
- `musikerin-aria` — Musikerin Aria (rare) — Die Klangweberin
- `handwerkerin-petra` — Handwerkerin Petra (common) — Die Macherin
- `coach-dominik` — Coach Dominik (uncommon) — Der Klardenker
- `braumeister-bjorn` — Braumeister Björn (common) — Der Hopfenphilosoph
- `postmeisterin-clara` — Postmeisterin Clara (common) — Die Nachrichtenwächterin
- `gaertner-thorn` — Gärtner Thorn (common) — Der Wurzelmeister
- `bote-swift` — Bote Swift (common) — Der Windläufer
- `waescherin-agnes` — Wäscherin Agnes (common) — Die Reinliche
- `schmied-vulkan` — Schmied Vulkan (uncommon) — Der Flammenträger
- `sterndeuterin-nova` — Sterndeuterin Nova (uncommon) — Die Anti-Astrologin
- `sammler-magpie` — Sammler Magpie (uncommon) — Der Kuriositätenjäger
- `botanikerin-fern` — Botanikerin Fern (rare) — Die Grüne Weisheit
- `erfinder-tesla` — Erfinder Tesla (rare) — Der Visionär
- `richterin-justina` — Richterin Justina (rare) — Die Waagschale
- `leuchtturmwaerter-sol` — Leuchtturmwärter Sol (epic) — Der Lichtbewahrer
- `puppenmacherin-elara` — Puppenmacherin Elara (epic) — Die Fadenzieherin
- `wanderer-nobody` — Der Namenlose (legendary) — Der Wanderer ohne Geschichte
- `baecker-fritz` — Bäcker Fritz (common) — Der Teigmeister
- `haushalterin-magda` — Haushälterin Magda (common) — Die Ordnungsgeberin
- `laternenanzuender-pip` — Laternenanzünder Pip (common) — Der kleine Lichtbringer
- `architektin-iris` — Architektin Iris (uncommon) — Die Strukturgeberin
- `gaukler-jest` — Gaukler Jest (uncommon) — Der Spaßmacher
- `mentor-grau` — Mentor Grau (uncommon) — Der Erfahrene
- `jongleurin-luna` — Jongleurin Luna (uncommon) — Die Gleichgewichtskünstlerin
- `alchemist-gold` — Alchemist Gold (rare) — Der Wandlungskünstler
- `traumdeuterin-morphea` — Traumdeuterin Morphea (rare) — Die Nachtwandlerin
- `steinmetz-granite` — Steinmetz Granite (rare) — Der Formgeber
- `kartografin-mappe` — Kartografin Mappe (rare) — Die Zukunftszeichnerin
- `strategin-athena` — Strategin Athena (epic) — Die Schlachtenkdenkerin
- `geschichtsschreiber-chronos` — Geschichtsschreiber Chronos (epic) — Der Musterseher
- `heilerin-grace` — Heilerin Grace (epic) — Die Sanfte Kraft
- `zeitungsjunge-max` — Zeitungsjunge Max (common) — Der Nachrichtenträger
- `mutter-erde` — Mutter Erde (legendary) — Die Urmutter
- `meisterkoch-umami` — Meisterkoch Umami (uncommon) — Der Geschmackskünstler
- `bergmann-gruber` — Bergmann Gruber (common) — Der Tiefgräber
- `geschuetzt-erin` — Grenzwächterin Erin (epic) — Die Hüterin der Grenzen


### 2. Profession NPC Portraits (8 fehlend)
- **Wo sichtbar:** Artisan's Quarter NPC-Karten (56×56px), NPC-Modal Header (80×80px mit Glow), Craft-Ergebnis Celebration
- **Format:** 256×256px PNG, transparenter Hintergrund
- **Stil:** Wie bestehende NPCs, Handwerker-Atmosphäre, Werkstatt-Setting
- **Rahmen:** Runder Rahmen mit Rank-farbiger Border (Novice grau → Artisan gold), Profession-Farbe als Accent
- **Vibe:** Jeder Crafting-NPC hat eigene Persönlichkeit laut Lore Bible (Grimvar=wortkarg, Ysolde=verrückt, etc.)

Fehlend:
- `/images/npcs/grimvar-schmied.png` — Grimvar der Schmied (wortkarg, Hammer, Amboss-Farbe #f59e0b)
- `/images/npcs/ysolde-alchemist.png` — Ysolde die Alchemistin (neugierig, Tränke, grün #22c55e)
- `/images/npcs/eldric-verzauberer.png` — Eldric der Verzauberer (formell, präzise, lila #a78bfa)
- `/images/npcs/bruna-koch.png` — Bruna die Köchin (herzlich, laut, orange #e87b35)
- `/images/npcs/selina-schneider.png` — Selina die Schneiderin (elegant, Nadel+Faden, lila #c084fc)
- `/images/npcs/roderic-lederverarbeiter.png` — Roderic der Lederverarbeiter (robust, braun #b45309)
- `/images/npcs/varn-waffenschmied.png` — Varn der Waffenschmied (kriegerisch, rot #dc2626)
- `/images/npcs/mirael-juwelier.png` — Mirael die Juwelierin (filigran, pink #ec4899)

### 3. Ritual NPC Portraits (2 fehlend)
- **Wo sichtbar:** Ritual Chamber Header (195px breit, volle Höhe), Vow Shrine
- **Format:** 256×384px PNG (Hochformat), transparenter Hintergrund
- **Stil:** Größer als Standard-NPCs, mehr Detail, atmosphärisch
- **Rahmen:** Kein Rahmen, Drop-Shadow, Glow-Filter bei aktiver Mondlicht-Schmiede

Fehlend:
- `/images/portraits/npc-seraine.png` — Seraine Ashwell, Ritual-Meisterin (warm, feurig, Streaks)
- `/images/portraits/npc-vael.png` — Vael, Vow-Meister (ernst, dunkel, Blood Pact Thema)

### 4. Achievement Icons (23 fehlend)
- **Wo sichtbar:** Hall of Honors Achievement-Grid (48×48px), Achievement-Toast (28×28px), Player Profile
- **Format:** 64×64px PNG, transparenter Hintergrund
- **Stil:** Pixel Art Icons, Medaillen/Abzeichen-Style, Rarity-Farbe als Accent
- **Rahmen:** Runder oder hexagonaler Rahmen mit Rarity-Glow (common=grau, epic=lila, legendary=orange)
- **Vibe:** Jedes Achievement ist ein kleines Abzeichen das Stolz vermitteln soll

Fehlend:
- `/images/icons/ach-artisan.png` — Artisan Rank erreicht (Profession, legendary)
- `/images/icons/ach-dual-prof.png` — Zwei Berufe auf 150+ (epic)
- `/images/icons/ach-recipes.png` — 100 Rezepte gelernt (epic)
- `/images/icons/ach-moonlight.png` — 10 Nacht-Crafts (rare, hidden)
- `/images/icons/ach-faction.png` — Friendly bei einer Fraktion (uncommon)
- `/images/icons/ach-faction-exalted.png` — Exalted bei einer Fraktion (epic)
- `/images/icons/ach-diplomat.png` — Alle Fraktionen Friendly (rare)
- `/images/icons/ach-daily-sweep.png` — Alle 12 Faction Dailies an einem Tag (rare, hidden)
- `/images/icons/ach-rift.png` — Erster Rift Clear (uncommon)
- `/images/icons/ach-rift-legend.png` — Legendary Rift Clear (epic)
- `/images/icons/ach-mythic.png` — Mythic+5 erreicht (legendary)
- `/images/icons/ach-dungeon.png` — Erster Dungeon Run (uncommon)
- `/images/icons/ach-dungeon-all.png` — Alle 3 Dungeon Tiers (epic)
- `/images/icons/ach-wb.png` — World Boss Beitrag (uncommon)
- `/images/icons/ach-wb-champ.png` — Top 3 beim World Boss (legendary)
- `/images/icons/ach-bond.png` — Bond Level 5 (epic)
- `/images/icons/ach-bond-legend.png` — Bond Level 10 (legendary)
- `/images/icons/ach-expedition.png` — 20 Companion Expeditions (rare)
- `/images/icons/ach-bp.png` — Season Pass Level 40 (legendary)
- `/images/icons/ach-gem.png` — Royal Gem (epic)
- `/images/icons/ach-gacha.png` — Hard Pity Hit (rare, hidden)
- `/images/icons/ach-convert.png` — 10 Currency Conversions (uncommon, hidden)
- `/images/icons/ach-variety.png` — Alle Quest-Typen completed (rare)
- `/images/icons/ach-500.png` — 500 Quests (legendary)
- `/images/icons/ach-1000.png` — 1000 Quests (legendary)


### 5. Material Icons (20 fehlend)
- **Wo sichtbar:** Forge Rezeptliste Material-Kosten (16×16px), Material Storage Grid (24×24px), Dismantle-Ergebnis
- **Format:** 32×32px PNG, transparenter Hintergrund
- **Stil:** Pixel Art, kleine Items, Rarity-Farbton (common=grau, uncommon=grün, rare=blau, epic=lila, legendary=orange)
- **Fallback:** Wenn Icon fehlt, wird ein farbiger Kreis in Rarity-Farbe angezeigt
- **Vibe:** WoW-Classic Material Icons — Erze, Stoffe, Leder, Kräuter, Edelsteine

Fehlend:
- `/images/icons/mat-eisenerz.png` — Eisenerz (common, Erz)
- `/images/icons/mat-magiestaub.png` — Magiestaub (uncommon)
- `/images/icons/mat-kristallsplitter.png` — Kristallsplitter (rare, Kristall)
- `/images/icons/mat-drachenschuppe.png` — Drachenschuppe (epic)
- `/images/icons/mat-aetherkern.png` — Aetherkern (legendary)
- `/images/icons/mat-seelensplitter.png` — Seelensplitter (legendary, leuchtend)
- `/images/icons/mat-kraeuter.png` — Kräuterbündel (common, Kräuter)
- `/images/icons/mat-mondblume.png` — Mondblume (rare, leuchtende Blume)
- `/images/icons/mat-phoenixfeder.png` — Phönixfeder (epic, feurig)
- `/images/icons/mat-sternenfrucht.png` — Sternenfrucht (legendary)
- `/images/icons/mat-leinenstoff.png` — Leinenstoff (common, Stoff)
- `/images/icons/mat-wollstoff.png` — Wollstoff (uncommon)
- `/images/icons/mat-seidenstoff.png` — Seidenstoff (rare)
- `/images/icons/mat-magiestoff.png` — Magiestoff (epic)
- `/images/icons/mat-runenstoff.png` — Runenstoff (legendary)
- `/images/icons/mat-leichtesleder.png` — Leichtes Leder (common)
- `/images/icons/mat-mittleresleder.png` — Mittleres Leder (uncommon)
- `/images/icons/mat-schweresleder.png` — Schweres Leder (rare)
- `/images/icons/mat-dickesleder.png` — Dickes Leder (epic)
- `/images/icons/mat-rauesleder.png` — Raues Leder (legendary)
- `/images/icons/mat-wildfleisch.png` — Wildfleisch (common, Koch-Material)
- `/images/icons/mat-feuerwurz.png` — Feuerwurz (uncommon, Koch)
- `/images/icons/mat-runenstein.png` — Runenstein (rare)

### 6. Profession Icons (8 fehlend)
- **Wo sichtbar:** Profession Info Modal (28×28px), Daily Mission Profession Icon
- **Format:** 48×48px PNG, transparenter Hintergrund
- **Stil:** Werkzeug/Symbol das den Beruf repräsentiert (Hammer für Schmied, Flasche für Alchemist, etc.)

Fehlend:
- `/images/icons/prof-schmied.png` — Hammer/Amboss (#f59e0b)
- `/images/icons/prof-alchemist.png` — Flasche/Kessel (#22c55e)
- `/images/icons/prof-verzauberer.png` — Runenstab/Kristall (#a78bfa)
- `/images/icons/prof-koch.png` — Pfanne/Messer (#e87b35)
- `/images/icons/prof-schneider.png` — Nadel/Schere (#c084fc)
- `/images/icons/prof-lederverarbeiter.png` — Lederstück/Ahle (#b45309)
- `/images/icons/prof-waffenschmied.png` — Schwert/Schild (#dc2626)
- `/images/icons/prof-juwelier.png` — Edelstein/Lupe (#ec4899)

### 7. Shop & Currency Icons (13 fehlend)
- **Wo sichtbar:** Bazaar Shop Items (40×40px), Currency Shop Tabs (16×16px), Item Tooltips
- **Format:** 48×48px PNG, transparenter Hintergrund
- **Stil:** Pixel Art, passend zum Item-Typ (Frames=dekorativ, Boosts=magisch leuchtend)

Fehlend:
- `/images/icons/currency-sternentaler.png` — Star Coins Currency Icon (#fbbf24, sternenförmig)
- `/images/icons/shop-boss-boost.png` — Colosseum War Cry Boost Item
- `/images/icons/shop-rift-extend.png` — Temporal Anchor (Rift Timer Extension)
- `/images/icons/shop-companion-glow.png` — Companion Starlight Aura (Cosmetic)
- `/images/icons/shop-frame-star.png` — Starweaver Frame Vorschau
- `/images/icons/shop-frame-eclipse.png` — Eclipse Frame Vorschau
- `/images/icons/shop-frame-guild.png` — Guildmaster Frame Vorschau
- `/images/icons/shop-frame-diplomat.png` — Diplomat Frame Vorschau
- `/images/icons/shop-frame-moon.png` — Moonlit Frame Vorschau
- `/images/icons/shop-title-star.png` — Sternkind Title Icon
- `/images/icons/shop-title-guild.png` — Gildenherz Title Icon
- `/images/icons/shop-title-moon.png` — Mondgeborener Title Icon
- `/images/icons/shop-social.png` — Social Outing / Trade Charm Icon
- `/images/icons/shop-nature.png` — Nature Walk Icon
- `/images/icons/shop-detox.png` — Digital Detox Icon

### 8. Equipment Slot Icons (1 fehlend)
- **Wo sichtbar:** Character View Equipment Grid (48×48px Slot), Enchanting Slot Picker
- **Format:** 48×48px PNG, transparenter Hintergrund

Fehlend:
- `/images/icons/equip-ring.png` — Ring Equipment Slot Icon

### 9. Item Detail Images (~40 fehlend)
- **Wo sichtbar:** Item Action Popup Detail View (full width ~280px), Crafted Item Celebration
- **Format:** 128×128px PNG, transparenter Hintergrund
- **Stil:** Größere, detailliertere Version des Item Icons, Tier-farbig (T1=braun, T2=grau, T3=gold, T4=lila)
- **Pfad:** `/images/items/detail/{item-id}.png` UND `/images/items/icons/{item-id}.png` (kleiner)

(Vollständige Liste der fehlenden Item-Bilder: siehe `/tmp/missing_images.txt` auf dem Server — ~80 Einträge für items/detail + items/icons)

### 10. Misc Icons (15 fehlend)
- **Wo sichtbar:** Verschiedene UI-Elemente

Fehlend:
- `/images/icons/ult-double.png` — Companion Ultimate: Double Reward (CompanionsWidget, 24×24px)
- `/images/icons/ult-instant.png` — Companion Ultimate: Instant Complete (24×24px)
- `/images/icons/ult-streak.png` — Companion Ultimate: Streak Shield (24×24px)
- `/images/icons/expedition-generic.png` — Companion Expedition fallback (40×40px)
- `/images/icons/exp-*.png` — 8 Expedition Location Icons (cave, coast, desert, forest, mountain, ruins, swamp, temple) (32×32px)
- `/images/icons/wc-*.png` — 9 Weekly Challenge Type Icons (allrounder, code, companion, fitness, generic, learning, social, speedrun, streak) (32×32px)
- `/images/icons/workshop-*.png` — 4 Workshop Upgrade Icons (gold-tools, loot-amulet, material-magnet, streak-charm) (40×40px)
- `/images/icons/npc-flint-compass.png` — Captain Flint NPC Reward Item Icon (32×32px)
- `/images/icons/npc-lumi-lantern.png` — Lumi NPC Reward Item Icon (32×32px)

