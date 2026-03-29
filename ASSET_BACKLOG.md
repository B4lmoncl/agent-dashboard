# Asset Backlog — Fehlende Bilder

> Stand: 2026-03-29 (aktualisiert). **~842 fehlende Assets**, gruppiert nach Kategorie.

---

## Standardgrößen (verbindlich)

| Asset-Typ | Größe | Style Reference | Endpoint |
|---|---|---|---|
| Gear Icons | 128×128 | `gacha-heiltrank.png` | `generate-with-style-v2` |
| NPC Portraits | 128×128 | `rogar-amboss.png` | `generate-with-style-v2` |
| Achievement Icons | 128×128 | `gacha-heiltrank.png` | `generate-with-style-v2` |
| Shop/Currency/Misc Icons | 128×128 | `gacha-heiltrank.png` | `generate-with-style-v2` |
| Profession Icons | 128×128 | `gacha-heiltrank.png` | `generate-with-style-v2` |
| Material Icons | 128×128 | `gacha-heiltrank.png` | `generate-with-style-v2` |
| World Boss Portraits | 256×256 | `rogar-amboss.png` | `generate-with-style-v2` |
| Floor Banners | 792×200 | keine | `generate-image-v2` |
| Item Detail Images | 128×128 | `gacha-heiltrank.png` | `generate-with-style-v2` |

---

## ✅ Bereits erledigt (NICHT nochmal generieren)

- ✅ 85 Achievement Icons — `public/images/icons/ach-*.png`
- ✅ 5 Floor Banner — `public/images/banners/*.png`
- ✅ 30 Gear Icons (13 T1 + 17 neu) — `public/images/items/icons/`
- ✅ 16 Shop Icons — `public/images/icons/shop-*.png`
- ✅ 8 Profession NPC Portraits — `public/images/npcs/{grimvar,ysolde,eldric,bruna,selina,roderic,varn,mirael}-*.png`
- ✅ 8 Profession Icons — `public/images/icons/prof-*.png`
- ✅ 4 Rift Icons — `public/images/icons/rift-*.png`
- ✅ 4 Faction Icons — `public/images/icons/faction-*.png`
- ✅ 9 World Boss Portraits — `public/images/bosses/*.png`
- ✅ 23 Material Icons — `public/images/icons/mat-*.png`
- ✅ 19 Nav Icons — `public/images/icons/nav-*.png`
- ✅ 8 Expedition Location Icons — `public/images/icons/exp-*.png`
- ✅ 9 Weekly Challenge Icons — `public/images/icons/wc-*.png`
- ✅ 4 Workshop Icons — `public/images/icons/workshop-*.png`
- ✅ 3 Ultimate Icons — `public/images/icons/ult-*.png`
- ✅ 1 Expedition Generic — `public/images/icons/expedition-generic.png`
- ✅ 2 NPC Item Icons — `npc-flint-compass.png`, `npc-lumi-lantern.png`
- ✅ 1 Equipment Slot Icon — `equip-ring.png`
- ✅ 2 Ritual Portraits — `public/images/portraits/npc-seraine.png`, `npc-vael.png`
- ✅ 22 NPC Portraits (existierend) — `public/images/npcs/`

---

## Fehlende Assets

### 1. Gear Icons (689 fehlend) — PRIO 1
- **Pfad:** `public/images/items/icons/{id}.png`
- **Größe:** 128×128
- **Style Ref:** `gacha-heiltrank.png`

Aufschlüsselung nach Tier:
- T1: 121 fehlend (common/uncommon, `gen-*` prefix)
- T2: 151 fehlend (uncommon/rare, `gen-*` prefix)
- T3: 178 fehlend (rare/epic, `t3-*` und `gen-*`)
- T4: 239 fehlend (epic/legendary, `t4-*` und diverse)

Fehlende Items dynamisch ermitteln:
```python
import json, os
with open('public/data/gearTemplates.json') as f:
    data = json.load(f)
items = data.get('items', data)
if isinstance(items, dict): items = items.get('items', [])
existing = set(f.replace('.png','') for f in os.listdir('public/images/items/icons/') if f.endswith('.png'))
missing = [i for i in items if i['id'] not in existing]
```

Prompt-Template:
```python
TIER_STYLE = {
    1: 'simple worn basic wooden leather',
    2: 'iron steel polished military grade',
    3: 'ornate magical glowing rune-inscribed masterwork',
    4: 'legendary radiant ancient powerful mythical divine'
}
RARITY_GLOW = {
    'common': '',
    'uncommon': 'with faint green shimmer',
    'rare': 'with blue magical glow',
    'epic': 'with purple arcane energy aura',
    'legendary': 'with brilliant golden-orange legendary glow'
}
prompt = f"pixel art {TIER_STYLE[tier]} {slot} {name}, single item centered, {RARITY_GLOW[rarity]}, fantasy RPG item icon"
```

### 2. NPC Quest Giver Portraits (87 fehlend) — PRIO 2
- **Pfad:** `public/images/npcs/{npc-id}.png`
- **Größe:** 128×128
- **Style Ref:** `rogar-amboss.png`
- **WICHTIG:** NPCs spawnen ERST wenn portrait gesetzt ist (Engine-Filter in npc-engine.js)
- Prompt-Basis: Name + Title + Description aus `npcQuestGivers.json`

Fehlende IDs:
`sable-nachtwind`, `professor-quill`, `eiserne-mara`, `koch-giovanni`, `meisterin-sera`, `pip-zahnrad`, `alte-martha`, `hans-holzfuss`, `brieftraeger-emil`, `gaertnerin-rose`, `schneider-lin`, `wachmann-kurt`, `putzfrau-helga`, `geschichtenerzaehlerin-nadia`, `zahlmeister-otto`, `laufbursche-felix`, `bibliothekarin-ada`, `trainer-rex`, `apothekerin-yara`, `kartograph-werner`, `uhrmacher-tick`, `netzwerkerin-luna`, `imker-boris`, `schreiberin-mei`, `schlosser-grim`, `astrologe-celes`, `schmuggler-dante`, `astronomin-stella`, `tavernenbesitzer-gus`, `bergsteigerin-kaya`, `antiquar-simon`, `fechtmeisterin-ines`, `heiler-kaspar`, `puppenspieler-marco`, `navigatorin-compass`, `spieleerfinderin-nora`, `kriegsmeisterin-valka`, `alchemist-faye`, `diplomat-aurelius`, `schmiedin-ignis`, `geisterjagerin-raven`, `chronist-aeon`, `tod-der-hoefliche`, `meisterin-der-stille`, `bauer-ernst`, `tanzlehrerin-vivienne`, `detektiv-ash`, `philosophin-helen`, `tierpfleger-finn`, `maler-claude`, `spion-echo`, `musikerin-aria`, `handwerkerin-petra`, `coach-dominik`, `braumeister-bjorn`, `postmeisterin-clara`, `gaertner-thorn`, `bote-swift`, `waescherin-agnes`, `schmied-vulkan`, `sterndeuterin-nova`, `sammler-magpie`, `botanikerin-fern`, `erfinder-tesla`, `richterin-justina`, `leuchtturmwaerter-sol`, `puppenmacherin-elara`, `wanderer-nobody`, `baecker-fritz`, `haushalterin-magda`, `laternenanzuender-pip`, `architektin-iris`, `gaukler-jest`, `mentor-grau`, `jongleurin-luna`, `alchemist-gold`, `traumdeuterin-morphea`, `steinmetz-granite`, `kartografin-mappe`, `strategin-athena`, `geschichtsschreiber-chronos`, `heilerin-grace`, `zeitungsjunge-max`, `mutter-erde`, `meisterkoch-umami`, `bergmann-gruber`, `geschuetzt-erin`

### 3. Shop & Currency Icons (15 fehlend) — PRIO 3
- **Pfad:** `public/images/icons/{name}.png`
- **Größe:** 128×128
- **Style Ref:** `gacha-heiltrank.png`

Fehlend:
- `currency-sternentaler` — Star Coins Currency Icon (#fbbf24, sternenförmig)
- `shop-boss-boost` — Colosseum War Cry Boost Item
- `shop-rift-extend` — Temporal Anchor (Rift Timer Extension)
- `shop-companion-glow` — Companion Starlight Aura (Cosmetic)
- `shop-frame-star` — Starweaver Frame Vorschau
- `shop-frame-eclipse` — Eclipse Frame Vorschau
- `shop-frame-guild` — Guildmaster Frame Vorschau
- `shop-frame-diplomat` — Diplomat Frame Vorschau
- `shop-frame-moon` — Moonlit Frame Vorschau
- `shop-title-star` — Sternkind Title Icon
- `shop-title-guild` — Gildenherz Title Icon
- `shop-title-moon` — Mondgeborener Title Icon
- `shop-social` — Social Outing Icon
- `shop-nature` — Nature Walk Icon
- `shop-detox` — Digital Detox Icon

### 4. Achievement Icons (1 fehlend)
- `public/images/icons/ach-variety.png` — Alle Quest-Typen completed (rare)
- **Größe:** 128×128

### 5. Item Detail Images (~50 fehlend) — PRIO 5
- **Pfad:** `public/images/items/detail/{id}.png`
- **Größe:** 128×128
- **Style Ref:** `gacha-heiltrank.png`
- **Hinweis:** Verzeichnis existiert noch nicht. Nur für Tier-Items (t1-t4), nicht für gen-* Items.

T1 (14): `t1-amulet`, `t1-armor`, `t1-axe`, `t1-boots`, `t1-buckler`, `t1-charm`, `t1-dagger`, `t1-helm`, `t1-hood`, `t1-sandals`, `t1-shield`, `t1-staff`, `t1-sword`, `t1-tunic`

T2 (13): `t2-amulet`, `t2-armor`, `t2-boots`, `t2-brigandine`, `t2-circlet`, `t2-hammer`, `t2-helm`, `t2-katana`, `t2-pendant`, `t2-shield`, `t2-strider`, `t2-sword`, `t2-tower`

T3 (13): `t3-amulet`, `t3-armor`, `t3-barrier`, `t3-boots`, `t3-crown`, `t3-eye`, `t3-helm`, `t3-lance`, `t3-plate`, `t3-shadow`, `t3-shield`, `t3-sword`, `t3-wand`

T4 (10): `t4-aegis`, `t4-armor`, `t4-boots`, `t4-crown`, `t4-dawn`, `t4-excalibur`, `t4-heart`, `t4-oracle`, `t4-phoenix`, `t4-void`

---

## Zusammenfassung

| Kategorie | Fehlend | Größe | Prio |
|---|---|---|---|
| Gear Icons | 689 | 128×128 | 1 |
| NPC Portraits | 87 | 128×128 | 2 |
| Shop/Currency Icons | 15 | 128×128 | 3 |
| Achievement Icons | 1 | 128×128 | 4 |
| Item Detail Images | ~50 | 128×128 | 5 |
| **Gesamt** | **~842** | | |
