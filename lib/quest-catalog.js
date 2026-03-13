/**
 * Quest Catalog — seed templates and catalog management.
 */
const { state, saveQuestCatalog, saveQuests } = require('./state');
const { now } = require('./helpers');

function rebuildCatalogMeta() {
  const t = state.questCatalog.templates;
  state.questCatalog.meta.totalTemplates = t.length;
  state.questCatalog.meta.byCategory = { generic: 0, classQuest: 0, chainQuest: 0, companionQuest: 0 };
  state.questCatalog.meta.byClass = {};
  for (const tpl of t) {
    const cat = tpl.category || 'generic';
    state.questCatalog.meta.byCategory[cat] = (state.questCatalog.meta.byCategory[cat] || 0) + 1;
    if (tpl.classId) state.questCatalog.meta.byClass[tpl.classId] = (state.questCatalog.meta.byClass[tpl.classId] || 0) + 1;
  }
  state.questCatalog.meta.lastUpdated = new Date().toISOString();
}

function seedQuestCatalog() {
  if (state.questCatalog.templates.length > 0) return;

  const BASE = '2026-03-10T12:00:00Z';
  const at = (offset) => new Date(new Date(BASE).getTime() + offset * 1000).toISOString();

  const xp  = { starter: 15, intermediate: 25, advanced: 40, expert: 60 };
  const gld = { starter: 10, intermediate: 20, advanced: 30, expert: 50 };
  const pri = { starter: 'low', intermediate: 'medium', advanced: 'high', expert: 'high' };

  const tpl = (id, title, description, type, category, classId, minLevel, difficulty, estimatedTime, rewards, tags, chainId, chainOrder, recurrence, lore, requiresRelationship) => ({
    id, title, description, type, category,
    classId: classId || null,
    minLevel: minLevel || 1,
    chainId: chainId || null,
    chainOrder: chainOrder || null,
    difficulty,
    estimatedTime: estimatedTime || null,
    rewards: rewards || { xp: xp[difficulty], gold: gld[difficulty] },
    tags: tags || [],
    recurrence: recurrence || null,
    lore: lore || null,
    requiresRelationship: requiresRelationship || false,
    createdBy: 'system',
    createdAt: BASE,
  });

  const templates = [
    // NSE Path chain
    tpl('tpl-nse-01', 'x NSE 1 — Der Weg beginnt: Information Security Awareness', 'Erlerne die Grundlagen der Informationssicherheit. Was sind Bedrohungen, wie schützt man sich? Der erste Schritt auf dem Pfad des Network Sage.', 'learning', 'chainQuest', 'network-sage', 1, 'starter', '1h', { xp: 15, gold: 10 }, ['switching', 'firewalls'], 'nse-path', 1),
    tpl('tpl-nse-02', 'x NSE 2 — Evolution der Cybersicherheit', 'Verstehe die Geschichte und Entwicklung der Cybersicherheit. Von den ersten Viren bis zu modernen Advanced Persistent Threats — lerne, wohin sich die Bedrohungslandschaft bewegt.', 'learning', 'chainQuest', 'network-sage', 3, 'intermediate', '2h', { xp: 25, gold: 20 }, ['firewalls'], 'nse-path', 2),
    tpl('tpl-nse-03', 'xx NSE 3 — Erste Schritte mit FortiGate', 'Richte deine erste FortiGate-Firewall ein. Grundkonfiguration, Interfaces, Policies und grundlegendes Monitoring. Die Fortinet-Ära beginnt.', 'learning', 'chainQuest', 'network-sage', 5, 'intermediate', '3h', { xp: 30, gold: 25 }, ['firewalls', 'vpn'], 'nse-path', 3),
    tpl('tpl-nse-04', 'xx NSE 4 — Netzwerksicherheits-Meister: Die Prüfung', 'x BOSS QUEST: Die große Prüfung des Network Security Professional. Fortinet NSE 4-Zertifizierung ablegen und bestehen. Beweise dein Können als Hüter des Netzwerks.', 'boss', 'chainQuest', 'network-sage', 10, 'expert', '40h', { xp: 100, gold: 80 }, ['firewalls', 'vpn', 'switching'], 'nse-path', 4),
    // Switching Fundamentals chain
    tpl('tpl-sw-01', 'x Die Kunst des Weiterleitens — Was ist ein Switch?', 'Lerne, was ein Switch ist, wie er arbeitet und warum er das Rückgrat jedes Netzwerks bildet. MAC-Adressen-Tabellen, Broadcast-Domains und der Unterschied zu Hubs.', 'learning', 'chainQuest', 'network-sage', 1, 'starter', '1h', { xp: 15, gold: 10 }, ['switching'], 'switching-fundamentals', 1),
    tpl('tpl-sw-02', 'x Die Kunst der VLANs — Netzwerke teilen und herrschen', 'Verstehe VLANs und konfiguriere sie auf einem Switch. Trunk-Ports, Access-Ports, Native VLANs — lerne, wie du ein physisches Netzwerk in logische Segmente teilst.', 'learning', 'chainQuest', 'network-sage', 3, 'intermediate', '2h', { xp: 25, gold: 20 }, ['switching'], 'switching-fundamentals', 2),
    tpl('tpl-sw-03', 'x Spanning Tree — Der Wächter vor Schleifen', 'Meistere das Spanning Tree Protocol (STP/RSTP). Wie verhindert STP Broadcast-Stürme? Root-Bridge-Wahl, Port-Rollen und Konvergenz — unverzichtbar für stabile Netzwerke.', 'learning', 'chainQuest', 'network-sage', 5, 'intermediate', '3h', { xp: 30, gold: 25 }, ['switching'], 'switching-fundamentals', 3),
    tpl('tpl-sw-04', 'x Inter-VLAN Routing — Brücken zwischen Welten', 'Konfiguriere Inter-VLAN Routing mit einem Layer-3-Switch oder Router-on-a-Stick. Lass verschiedene VLANs miteinander kommunizieren, ohne die Sicherheit zu opfern.', 'learning', 'chainQuest', 'network-sage', 7, 'advanced', '3h', { xp: 40, gold: 30 }, ['switching'], 'switching-fundamentals', 4),
    tpl('tpl-sw-05', 'x Switch Security — Port Security & 802.1X: Die Festung', 'x BOSS QUEST: Härte dein Netzwerk mit Port Security, DHCP Snooping, Dynamic ARP Inspection und 802.1X-Authentifizierung. Nur bekannte Geräte dürfen eintreten.', 'boss', 'chainQuest', 'network-sage', 10, 'expert', '5h', { xp: 80, gold: 60 }, ['switching'], 'switching-fundamentals', 5),
    // Firewall Mastery chain
    tpl('tpl-fw-01', 'x Erste Firewall-Regel — Allow & Deny: Wächter am Tor', 'Erstelle deine erste Firewall-Regel. Verstehe den Unterschied zwischen Allow und Deny, Stateful vs. Stateless Inspection, und warum eine Default-Deny-Policy Gold wert ist.', 'learning', 'chainQuest', 'network-sage', 1, 'starter', '1.5h', { xp: 15, gold: 10 }, ['firewalls'], 'firewall-mastery', 1),
    tpl('tpl-fw-02', 'x NAT & PAT — Die Magie der Adressübersetzung', 'Verstehe Network Address Translation und Port Address Translation. Wie versteckt NAT dein internes Netzwerk? Konfiguriere Static NAT, Dynamic NAT und PAT auf einer FortiGate.', 'learning', 'chainQuest', 'network-sage', 3, 'intermediate', '2h', { xp: 25, gold: 20 }, ['firewalls'], 'firewall-mastery', 2),
    tpl('tpl-fw-03', 'x VPN Tunnel aufbauen — IPSec: Der sichere Tunnel', 'Konfiguriere einen Site-to-Site IPSec VPN Tunnel. Phase 1 & Phase 2, IKE, ESP — lerne die Magie hinter verschlüsselten Verbindungen zwischen Standorten.', 'learning', 'chainQuest', 'network-sage', 5, 'intermediate', '3h', { xp: 30, gold: 25 }, ['firewalls', 'vpn'], 'firewall-mastery', 3),
    tpl('tpl-fw-04', 'x SSL VPN — Fernzugriff für die Gilde', 'Richte einen SSL VPN für Remote-Mitarbeiter ein. Web-Mode, Tunnel-Mode, Split-Tunneling — gib deinen Recken sicheren Zugriff von überall auf der Welt.', 'learning', 'chainQuest', 'network-sage', 7, 'advanced', '3h', { xp: 40, gold: 30 }, ['vpn', 'firewalls'], 'firewall-mastery', 4),
    tpl('tpl-fw-05', 'x Zero Trust Network Access — Vertraue niemandem', 'Implementiere Zero Trust: Mikrosegmentierung, Identity-Based Policies, kontinuierliche Verifikation. Kein Gerät wird ohne Beweis vertraut — nicht einmal deine eigenen.', 'learning', 'chainQuest', 'network-sage', 10, 'advanced', '5h', { xp: 50, gold: 40 }, ['firewalls', 'vpn'], 'firewall-mastery', 5),
    tpl('tpl-fw-06', 'x FortiGate ATP — Fortgeschrittene Bedrohungsabwehr: Endkampf', 'x BOSS QUEST: Konfiguriere FortiGate Advanced Threat Protection: IPS, Application Control, Web Filtering, SSL Inspection, Sandboxing. Werde zum Erzmagier der Netzwerkverteidigung.', 'boss', 'chainQuest', 'network-sage', 15, 'expert', '8h', { xp: 120, gold: 100 }, ['firewalls', 'vpn', 'switching'], 'firewall-mastery', 6),
    // Network Sage single quests
    tpl('tpl-ns-eq-01', 'xx Netzwerk-Diagramm erstellen — Karte des Königreichs', 'Erstelle ein vollständiges Netzwerkdiagramm deiner Umgebung. Erfasse alle Geräte, Verbindungen, IP-Bereiche und VLANs. Eine gute Karte ist der erste Schritt zur Meisterschaft.', 'learning', 'classQuest', 'network-sage', 1, 'starter', '1h', { xp: 15, gold: 10 }, ['switching']),
    tpl('tpl-ns-eq-02', 'x Wireshark — Den ersten Traffic analysieren', 'Starte Wireshark und analysiere deinen ersten Netzwerk-Capture. Filter setzen, Protokolle erkennen, Handshakes sehen — lerne, das Netzwerk zu hören.', 'learning', 'classQuest', 'network-sage', 2, 'starter', '1.5h', { xp: 15, gold: 10 }, ['switching', 'firewalls']),
    tpl('tpl-ns-eq-03', 'x DNS & DHCP — Die unsichtbaren Diener', 'Verstehe wie DNS und DHCP funktionieren, konfiguriere einen lokalen DNS-Server, tracke DHCP-Leases und löse typische DNS-Probleme. Magie im Hintergrund sichtbar machen.', 'learning', 'classQuest', 'network-sage', 1, 'starter', '1.5h', { xp: 15, gold: 10 }, ['switching']),
    tpl('tpl-ns-eq-04', 'x Subnetting-Challenge — /24 bis /28 beherrschen', 'Löse 20 Subnetting-Aufgaben ohne Hilfsmittel. Von /24 über /26 bis /28 — berechne Netzwerkadressen, Broadcast, Host-Bereiche und CIDR-Notation. Zahlen sind deine Waffe.', 'learning', 'classQuest', 'network-sage', 3, 'intermediate', '2h', { xp: 25, gold: 20 }, ['switching']),
    tpl('tpl-ns-eq-05', 'x Troubleshooting-Toolkit — Ping, Traceroute, NSLookup', 'Meistere die Kommandozeilen-Werkzeuge des Netzwerkdiagnose. Finde Ausfälle, identifiziere Routen, erkenne DNS-Probleme — der Detektiv des Netzwerks zu werden.', 'learning', 'classQuest', 'network-sage', 2, 'starter', '1h', { xp: 15, gold: 10 }, ['switching', 'firewalls']),
    tpl('tpl-ns-eq-06', 'x Das Labor erwacht — GNS3 oder EVE-NG aufsetzen', 'Richte dein persönliches Netzwerklabor ein: GNS3 oder EVE-NG installieren, erste virtuelle Topologie erstellen. Ein Labor ist das Schwert des Network Sage — ohne Übung keine Meisterschaft.', 'learning', 'classQuest', 'network-sage', 5, 'intermediate', '3h', { xp: 30, gold: 25 }, ['switching', 'firewalls', 'vpn']),
    tpl('tpl-ns-eq-07', 'x Bandbreiten-Analyse mit FortiView', 'Analysiere den Netzwerkverkehr mit FortiView. Identifiziere Top-Talker, verdächtige Verbindungen und Bandbreiten-Fressende Anwendungen. Wissen ist Macht — nutze die Logs.', 'learning', 'classQuest', 'network-sage', 4, 'intermediate', '2h', { xp: 25, gold: 20 }, ['firewalls']),
    tpl('tpl-ns-eq-08', 'x DHCP-Failover — Redundanz für das Königreich', 'Konfiguriere DHCP-Failover zwischen zwei Servern. Keine DHCP-Ausfälle mehr — das Netzwerk lebt weiter, selbst wenn ein Server fällt. Hochverfügbarkeit ist kein Luxus.', 'learning', 'classQuest', 'network-sage', 6, 'intermediate', '2.5h', { xp: 25, gold: 20 }, ['switching']),
    tpl('tpl-ns-eq-09', 'x Port-Mirroring & Monitoring — Alles im Blick', 'Richte Port-Mirroring (SPAN) ein und verbinde ein Monitoring-System. Analysiere Traffic im Live-Betrieb ohne den Fluss zu unterbrechen. Der stille Beobachter sieht alles.', 'learning', 'classQuest', 'network-sage', 8, 'advanced', '3h', { xp: 40, gold: 30 }, ['switching', 'firewalls']),
    tpl('tpl-ns-eq-10', 'xx Routing-Protokolle — OSPF & BGP: Die Wegfinder', 'Verstehe dynamische Routing-Protokolle: OSPF für interne Netzwerke, BGP für das Internet. Konfiguriere OSPF in einer kleinen Topologie und verstehe AS-Nummern und BGP-Peering.', 'learning', 'classQuest', 'network-sage', 12, 'advanced', '5h', { xp: 45, gold: 35 }, ['switching', 'firewalls']),
    // Personal quests (15)
    tpl('tpl-per-01', 'x Morgenritual — Starte den Tag mit Energie', 'Beginne den Tag strukturiert: aufstehen, kurz dehnen, ein Glas Wasser trinken, 5 Minuten Ziele setzen. Ein guter Start macht den ganzen Tag besser.', 'personal', 'generic', null, 1, 'starter', '15min', { xp: 10, gold: 5 }, ['routine'], 'nse-path', null, 'daily'),
    tpl('tpl-per-02', 'x Abend-Winddown — Die Seele zur Ruhe bringen', 'Beende den Tag bewusst: Bildschirme aus, Tagebuch oder 3 Dankbarkeiten aufschreiben, Schlafvorbereitung. Guter Schlaf ist das mächtigste Upgrade.', 'personal', 'generic', null, 1, 'starter', '20min', { xp: 10, gold: 5 }, ['routine'], null, null, 'daily'),
    tpl('tpl-per-03', 'x Meal Prep Sonntag — Vorkochen für die Woche', 'Bereite am Sonntag Mahlzeiten für 3-5 Tage vor. Gesund essen spart Zeit und Geld — und gibt dir Energie für größere Quests in der Woche.', 'personal', 'generic', null, 2, 'starter', '2h', { xp: 20, gold: 15 }, ['organization'], null, null, 'weekly'),
    tpl('tpl-per-04', 'xx Quest: Schreibtisch aufräumen — Ordnung im Reich', 'Räume deinen Schreibtisch vollständig auf, wische ihn ab und sorge für ein aufgeräumtes Arbeitsumfeld. Ein klarer Schreibtisch = klarer Geist.', 'personal', 'generic', null, 1, 'starter', '30min', { xp: 10, gold: 5 }, ['organization']),
    tpl('tpl-per-05', 'xx Digitale Aufräumaktion — Downloads & Desktop leeren', 'Leere den Download-Ordner, räume den Desktop auf, lösche Dateien die nicht mehr gebraucht werden. Digitale Ordnung ist genauso wichtig wie physische.', 'personal', 'generic', null, 2, 'starter', '45min', { xp: 15, gold: 10 }, ['organization']),
    tpl('tpl-per-06', 'x Passwörter-Audit — Sicherheitsrunde durchführen', 'Überprüfe und aktualisiere wichtige Passwörter. Nutze einen Passwort-Manager und aktiviere 2FA wo möglich. Deine digitale Identität ist schutzwürdig.', 'personal', 'generic', null, 1, 'starter', '1h', { xp: 15, gold: 10 }, ['security']),
    tpl('tpl-per-07', 'x Backup erstellen — Das Gewölbe sichern', 'Erstelle ein vollständiges Backup aller wichtigen Daten. Externe Festplatte oder Cloud — teste anschließend die Wiederherstellung. Ein Backup das nicht getestet ist, ist keines.', 'personal', 'generic', null, 2, 'starter', '1h', { xp: 15, gold: 10 }, ['organization']),
    tpl('tpl-per-08', 'x Tagebuch schreiben — 5 Minuten täglich reflektieren', 'Schreibe täglich 5 Minuten in ein Tagebuch: Was war gut? Was war schwer? Was nimmst du mit? Reflexion ist der Weg zur Weisheit.', 'personal', 'generic', null, 1, 'starter', '5min', { xp: 8, gold: 5 }, ['mindfulness'], null, null, 'daily'),
    tpl('tpl-per-09', 'x Meditation — 10 Minuten Stille im Lärm der Welt', 'Meditiere 10 Minuten: Atemübung, Body Scan oder geführte Meditation. Regelmäßige Praxis reduziert Stress und schärft die Konzentration.', 'personal', 'generic', null, 1, 'starter', '10min', { xp: 10, gold: 5 }, ['mindfulness'], null, null, 'daily'),
    tpl('tpl-per-10', 'x Digital Detox — 2 Stunden offline sein', 'Lege alle digitalen Geräte für 2 Stunden weg. Keine Social Media, kein Scrollen, keine E-Mails. Genieße die analoge Welt bewusst und erlebe, wie sich dein Geist erholt.', 'personal', 'generic', null, 3, 'intermediate', '2h', { xp: 20, gold: 15 }, ['mindfulness']),
    tpl('tpl-per-11', 'x 30 Minuten lesen — Wissen ist Macht', 'Lese 30 Minuten in einem Buch (kein Handy, kein Social-Feed). Sachbücher, Romane oder Fachbücher — jede Seite erweitert deinen Horizont.', 'personal', 'generic', null, 1, 'starter', '30min', { xp: 10, gold: 5 }, ['learning'], null, null, 'daily'),
    tpl('tpl-per-12', 'x Inbox Zero — E-Mails auf null bringen', 'Bearbeite deinen gesamten E-Mail-Posteingang: Antworten, Archivieren oder Löschen. Inbox Zero ist ein Gefühl von Befreiung — probiere es aus.', 'personal', 'generic', null, 2, 'starter', '1h', { xp: 15, gold: 10 }, ['organization'], null, null, 'weekly'),
    tpl('tpl-per-13', 'x Monatsziele setzen — Die Quests des nächsten Monats planen', 'Setze dir 3-5 konkrete Ziele für den kommenden Monat. Schreibe sie auf, mache sie messbar und plane erste Schritte. Wer kein Ziel hat, trifft auch nichts.', 'personal', 'generic', null, 1, 'starter', '30min', { xp: 15, gold: 10 }, ['organization'], null, null, 'monthly'),
    tpl('tpl-per-14', 'x Zimmer auf Vordermann — Großreinemachen', 'Räume das Zimmer gründlich auf: staubsaugen, wischen, Klamotten sortieren, Bett frisch beziehen. Ein sauberes Umfeld schafft innere Klarheit.', 'personal', 'generic', null, 1, 'starter', '1h', { xp: 15, gold: 10 }, ['routine'], null, null, 'weekly'),
    tpl('tpl-per-15', 'x Nächsten Skill planen — Welches Kapitel kommt als nächstes?', 'Überlege dir, welchen neuen Skill du als nächstes erlernen möchtest. Recherchiere Ressourcen, schätze den Aufwand ab und erstelle einen groben Lernplan.', 'personal', 'generic', null, 2, 'starter', '30min', { xp: 15, gold: 10 }, ['learning']),
    // Fitness quests (12)
    tpl('tpl-fit-01', 'x Mittagspausen-Spaziergang — 10 Minuten frische Luft', 'Gehe in der Mittagspause 10 Minuten spazieren. Raus aus dem Büro, frische Luft schnappen, den Kopf lüften. Kleine Bewegung, große Wirkung.', 'fitness', 'generic', null, 1, 'starter', '10min', { xp: 10, gold: 5 }, ['cardio'], null, null, 'daily'),
    tpl('tpl-fit-02', 'x Morgen-Dehnen — 5 Minuten Stretch-Ritual', 'Starte den Tag mit 5 Minuten Dehnen: Hüftöffner, Schultern, Nacken, Rücken. Flexibilität ist die Basis jeder körperlichen Leistung — vernachlässige sie nicht.', 'fitness', 'generic', null, 1, 'starter', '5min', { xp: 8, gold: 5 }, ['flexibility'], null, null, 'daily'),
    tpl('tpl-fit-03', 'x Hydrations-Quest — 2 Liter Wasser trinken', 'Trinke heute mindestens 2 Liter Wasser. Kein Saft, kein Kaffee zählt. Hydration ist das einfachste und wirkungsvollste Upgrade für Körper und Geist.', 'fitness', 'generic', null, 1, 'starter', null, { xp: 8, gold: 5 }, ['health'], null, null, 'daily'),
    tpl('tpl-fit-04', 'xx Gym-Session — 45 Minuten Kraft aufbauen', 'Absolviere eine vollständige Gym-Session: Aufwärmen, 3 Hauptübungen, Cool-Down. Kraft ist nicht nur körperlich — sie gibt Selbstvertrauen.', 'fitness', 'generic', null, 2, 'intermediate', '1h', { xp: 25, gold: 20 }, ['strength']),
    tpl('tpl-fit-05', 'x 5km Lauf — Erster Schritt zum Läufer', 'Laufe 5km am Stück, egal wie langsam. Tempo ist egal — Fertigstellen ist alles. Läufer werden auf der Straße, nicht im Kopf.', 'fitness', 'generic', null, 3, 'intermediate', '30-40min', { xp: 30, gold: 25 }, ['cardio']),
    tpl('tpl-fit-06', 'x 30-Minuten-Workout — Zuhause ohne Geräte', 'Absolviere ein komplettes Bodyweight-Workout: Push-ups, Squats, Burpees, Plank. Kein Gym nötig — dein Körper ist dein Gerät.', 'fitness', 'generic', null, 2, 'intermediate', '30min', { xp: 20, gold: 15 }, ['strength', 'cardio']),
    tpl('tpl-fit-07', 'x Fitness-Challenge-Woche — 7 Tage am Stück', 'Bewege dich 7 Tage in Folge mindestens 30 Minuten täglich. Spazieren, Laufen, Gym, Yoga — alles zählt. Gewohnheiten entstehen durch Wiederholung.', 'fitness', 'generic', null, 5, 'advanced', '7 Tage', { xp: 60, gold: 50 }, ['endurance', 'consistency']),
    tpl('tpl-fit-08', 'x Neue Sportart ausprobieren — Unbekanntes betreten', 'Probiere eine Sportart aus, die du noch nie gemacht hast. Klettern, Schwimmen, Kampfsport, Tanzen — tritt aus der Komfortzone und entdecke ein neues Talent.', 'fitness', 'generic', null, 3, 'intermediate', '2h', { xp: 25, gold: 20 }, ['variety']),
    tpl('tpl-fit-09', 'x 10km Lauf — Die doppelte Herausforderung', 'Laufe 10km ohne Stop. Der mentale Kampf bei Kilometer 7 ist die eigentliche Prüfung. Wer 10km rennt, hat bewiesen: Wille überwindet Grenze.', 'fitness', 'generic', null, 7, 'advanced', '55-70min', { xp: 50, gold: 40 }, ['cardio', 'endurance']),
    tpl('tpl-fit-10', 'x Push-up-Challenge — 50 Stück täglich', 'Schaffe heute 50 Push-ups (in Sätzen ist erlaubt). Starte mit was du kannst und steigere dich. Kraft im Oberkörper ist eine der grundlegendsten körperlichen Fähigkeiten.', 'fitness', 'generic', null, 2, 'starter', '15min', { xp: 15, gold: 10 }, ['strength'], null, null, 'daily'),
    tpl('tpl-fit-11', 'x Yoga-Flow — 20 Minuten Körper & Geist verbinden', 'Absolviere eine 20-minütige Yoga-Session: Sun Salutation, Warrior-Folge, Savasana. Yoga verbindet Stärke, Flexibilität und Atemkontrolle — unterschätze es nicht.', 'fitness', 'generic', null, 1, 'starter', '20min', { xp: 15, gold: 10 }, ['flexibility', 'mindfulness']),
    tpl('tpl-fit-12', 'x Schwimmen — 1km im Becken absolvieren', 'Schwimme 1km am Stück (40 Bahnen à 25m). Schwimmen trainiert den gesamten Körper und schont die Gelenke. Für viele ein unterschätztes Ganzkörper-Erlebnis.', 'fitness', 'generic', null, 4, 'intermediate', '30-40min', { xp: 30, gold: 25 }, ['cardio', 'strength']),
    // Social quests (13)
    tpl('tpl-soc-01', 'x Einen Freund anrufen — Echte Verbindung', 'Ruf einen Freund oder ein Familienmitglied an, mit dem du schon länger nicht gesprochen hast. Nicht schreiben — sprechen. Echte Verbindung braucht Stimme.', 'social', 'generic', null, 1, 'starter', '20min', { xp: 10, gold: 5 }, ['connection']),
    tpl('tpl-soc-02', 'x Dankes-Nachricht schreiben — Dankbarkeit zeigen', 'Schreibe jemandem eine aufrichtige Dankes-Nachricht. Nicht kurz und flüchtig — wirklich. Erkläre, warum du dankbar bist. Dankbarkeit verändert Beziehungen.', 'social', 'generic', null, 1, 'starter', '15min', { xp: 10, gold: 5 }, ['connection']),
    tpl('tpl-soc-03', 'x Ausflug planen — Gemeinsame Abenteuer schmieden', 'Plane einen Ausflug mit Freunden oder Familie: Wanderung, Stadtbummel, Tagesreise. Organisiere Datum, Ort und lade mindestens 2 Leute ein.', 'social', 'generic', null, 2, 'starter', '30min', { xp: 15, gold: 10 }, ['planning']),
    tpl('tpl-soc-04', 'x Spieleabend — Die Gilde versammelt sich', 'Organisiere einen Spieleabend: Brettspiele, Kartenspiele, Konsole oder Rollenspiel. Lade mindestens 2 weitere ein und sorge für gute Stimmung.', 'social', 'generic', null, 2, 'starter', '3h', { xp: 20, gold: 15 }, ['fun']),
    tpl('tpl-soc-05', 'x‍x Gemeinsam kochen — Freunde einladen & zusammen essen', 'Koche gemeinsam mit Freunden. Jeder bringt eine Zutat mit oder übernimmt einen Gang. Essen das man teilt, schmeckt immer besser.', 'social', 'generic', null, 3, 'intermediate', '3h', { xp: 25, gold: 20 }, ['connection', 'fun']),
    tpl('tpl-soc-06', 'x Jemanden überraschen — Kleine Freude bereiten', 'Bereite jemandem eine kleine Überraschung: Ein selbstgemachtes Essen, eine Karte, ein kleines Geschenk. Die kleinen Gesten sind oft die mächtigsten.', 'social', 'generic', null, 2, 'starter', '1h', { xp: 20, gold: 15 }, ['connection']),
    tpl('tpl-soc-07', 'x Einem Kollegen helfen — Die Gilde stärkt sich gegenseitig', 'Biete einem Kollegen aktiv Hilfe an — nicht weil du gefragt wurdest, sondern weil du siehst, dass er sie braucht. Stärke durch Zusammenhalt.', 'social', 'generic', null, 1, 'starter', '30min', { xp: 10, gold: 5 }, ['teamwork']),
    tpl('tpl-soc-08', 'x Wissen weitergeben — Jemanden mentoren', 'Mentore jemanden: Erkläre ein Thema das du beherrschst, zeige wie etwas funktioniert, teile deinen Lernweg. Lehren ist die tiefste Form des Verstehens.', 'social', 'generic', null, 5, 'intermediate', '1h', { xp: 30, gold: 25 }, ['teaching', 'teamwork']),
    tpl('tpl-soc-09', 'xx Community-Event besuchen — Teil von etwas Größerem sein', 'Besuche ein lokales Community-Event, Meetup, Workshop oder Vereinstreffen. Neue Gesichter, neue Perspektiven, neues Netzwerk.', 'social', 'generic', null, 3, 'intermediate', '2h', { xp: 25, gold: 20 }, ['networking']),
    tpl('tpl-soc-10', 'x Alten Kontakt wiederbeleben — Verbindung erneuern', 'Melde dich bei jemandem den du lange nicht gesprochen hast. Eine ehrliche Nachricht — kein Smalltalk. Beziehungen brauchen Pflege.', 'social', 'generic', null, 2, 'starter', '15min', { xp: 15, gold: 10 }, ['connection']),
    tpl('tpl-soc-11', 'x Konstruktives Feedback geben — Ein Kollege wächst', 'Gib einem Kollegen oder Freund ehrliches, konstruktives Feedback. Nicht kritisieren — aufbauen. Wer Feedback gibt, zeigt, dass ihm die andere Person wichtig ist.', 'social', 'generic', null, 2, 'starter', '20min', { xp: 15, gold: 10 }, ['teamwork']),
    tpl('tpl-soc-12', 'x Kaffeepause einplanen — Qualitätszeit statt Effizienz', 'Plane bewusst eine gemeinsame Kaffeepause ein: ohne Handy, mit echter Unterhaltung. Pause ist produktiv wenn sie verbindet.', 'social', 'generic', null, 1, 'starter', '30min', { xp: 10, gold: 5 }, ['connection']),
    tpl('tpl-soc-13', 'x Neuen Menschen kennenlernen — Die Welt ist groß', 'Lerne heute bewusst einen neuen Menschen kennen: Nachbar, Kollege, Mitglied eines Vereins. Stelle echte Fragen, höre zu. Jeder Mensch hat eine Geschichte.', 'social', 'generic', null, 4, 'intermediate', '1h', { xp: 25, gold: 20 }, ['networking', 'connection']),
    // Relationship quests (5)
    tpl('tpl-rel-01', 'x Date Night planen — Ein Abend nur für euch', 'Plant und verbringt einen gemeinsamen Abend: Restaurant, Kino, Spaziergang, oder gemütlich zu Hause mit Kerzen und eurem Lieblingsessen. Qualitätszeit stärkt jede Beziehung.', 'social', 'generic', null, 1, 'starter', '3h', { xp: 20, gold: 15 }, ['connection', 'relationship'], null, null, null, null, true),
    tpl('tpl-rel-02', 'x Brief oder Karte schreiben — Worte die bleiben', 'Schreibe deinem Partner einen handgeschriebenen Brief oder eine Karte. Keine digitale Nachricht — echte Tinte auf echtem Papier. Erkläre was du an ihm/ihr schätzt.', 'social', 'generic', null, 1, 'starter', '30min', { xp: 15, gold: 10 }, ['connection', 'relationship'], null, null, null, null, true),
    tpl('tpl-rel-03', 'x Gemeinsam kochen — Paarzeit in der Küche', 'Kocht zusammen ein neues Rezept das ihr noch nie ausprobiert habt. Die Küche ist ein magischer Ort — gemeinsam kochen schafft Nähe und geteilte Erinnerungen.', 'social', 'generic', null, 1, 'starter', '1.5h', { xp: 20, gold: 15 }, ['connection', 'relationship'], null, null, 'weekly', null, true),
    tpl('tpl-rel-04', 'x Monatliches Beziehungs-Check-in — Wie geht es uns?', 'Nehmt euch 30 Minuten Zeit für ein offenes Gespräch über eure Beziehung: Was läuft gut? Was könnte besser sein? Was wünscht ihr euch? Ehrlichkeit ist das Fundament.', 'social', 'generic', null, 2, 'starter', '30min', { xp: 25, gold: 20 }, ['connection', 'relationship'], null, null, 'monthly', null, true),
    tpl('tpl-rel-05', 'x Paar-Workout — Gemeinsam stärker werden', 'Macht zusammen Sport: Joggen, Gym, Yoga, Fahrrad fahren oder Spaziergang. Gemeinsamer Sport schafft Verbindung und gegenseitige Motivation.', 'fitness', 'generic', null, 1, 'starter', '1h', { xp: 20, gold: 15 }, ['fitness', 'relationship'], null, null, 'weekly', null, true),
  ];

  state.questCatalog.templates = templates;
  rebuildCatalogMeta();
  saveQuestCatalog();

  const seedQuests = templates.map((t, i) => {
    const priorityMap = { starter: 'low', intermediate: 'medium', advanced: 'high', expert: 'high' };
    return {
      id: `quest-seed-${String(i + 1).padStart(3, '0')}`,
      title: t.title,
      description: t.description,
      priority: priorityMap[t.difficulty] || 'medium',
      type: t.type,
      categories: [],
      product: null,
      humanInputRequired: false,
      createdBy: 'system',
      status: 'open',
      createdAt: at(i),
      claimedBy: null,
      completedBy: null,
      completedAt: null,
      parentQuestId: null,
      recurrence: t.recurrence || null,
      streak: 0,
      lastCompletedAt: null,
      proof: null,
      checklist: null,
      nextQuestTemplate: null,
      coopPartners: null,
      coopClaimed: [],
      coopCompletions: [],
      skills: t.tags || [],
      lore: t.lore || null,
      chapter: t.chainId || null,
      minLevel: t.minLevel || 1,
      classRequired: t.classId || null,
      requiresRelationship: t.requiresRelationship || false,
    };
  });
  const existingIds = new Set(state.quests.map(q => q.id));
  const newSeeds = seedQuests.filter(s => !existingIds.has(s.id));
  state.quests.push(...newSeeds);
  saveQuests();

  const classCount   = templates.filter(t => t.classId).length;
  const genericCount = templates.filter(t => !t.classId).length;
  console.log(`x Seeded ${templates.length} quest templates (${classCount} class, ${genericCount} generic)`);
}

module.exports = {
  rebuildCatalogMeta,
  seedQuestCatalog,
};
