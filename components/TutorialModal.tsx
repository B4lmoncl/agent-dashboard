"use client";

import { useState, useEffect } from "react";
import { useModalBehavior } from "./ModalPortal";

// ─── GuideSection ─────────────────────────────────────────────────────────────

export function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="font-semibold mb-1.5" style={{ color: "#f0f0f0" }}>{title}</p>
      <div style={{ color: "rgba(255,255,255,0.55)" }}>{children}</div>
    </div>
  );
}

// ─── GuideContent ─────────────────────────────────────────────────────────────

export function GuideContent({ onRestartTutorial }: { onRestartTutorial?: () => void }) {
  const [tab, setTab] = useState<"start" | "quests" | "npcs" | "gacha" | "rituale" | "xpgold" | "achievements">("start");
  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b overflow-x-auto mb-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {([
          { key: "start",        label: "Start" },
          { key: "quests",       label: "Quests" },
          { key: "npcs",         label: "NPCs" },
          { key: "gacha",        label: "Gacha" },
          { key: "rituale",      label: "Rituale" },
          { key: "xpgold",       label: "XP & Gold" },
          { key: "achievements", label: "Achievements" },
        ] as { key: typeof tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-2.5 text-xs font-semibold transition-colors"
            style={{
              color: tab === t.key ? "#ff8c44" : "rgba(255,255,255,0.3)",
              background: tab === t.key ? "rgba(255,140,68,0.08)" : "transparent",
              borderBottom: tab === t.key ? "2px solid #ff8c44" : "2px solid transparent",
              border: "none", cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {onRestartTutorial && (
        <div className="flex justify-end pt-2 pb-0">
          <button
            onClick={onRestartTutorial}
            className="text-xs px-2 py-0.5 rounded"
            style={{ color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}
          >
            Restart Tutorial
          </button>
        </div>
      )}

      <div className="p-5 space-y-4 text-xs" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
          {tab === "start" && (
            <>
              <GuideSection title="Registrierung">
                Klicke auf <strong>Login → Register</strong> in der Kopfleiste. Der <strong>Charakter-Creator</strong> führt dich in 5 Schritten durch die Erstellung deines Helden:
                <ol className="space-y-1 mt-1 ml-2" style={{ listStyleType: "decimal" }}>
                  <li><span style={{ color: "#f0f0f0" }}>Name</span> — Wähle deinen Heldennamen.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Über dich</span> — Optionales Alter und Ziele (helfen bei Quest-Vorschlägen).</li>
                  <li><span style={{ color: "#f0f0f0" }}>Klasse</span> — Wähle deinen Berufspfad oder reiche eine neue Klasse ein.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Begleiter</span> — Haustier oder virtueller Begleiter.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Passwort</span> — Wähle ein sicheres Passwort. Damit loggst du dich ein.</li>
                </ol>
              </GuideSection>
              <GuideSection title="Klassen">
                Klassen definieren deinen Berufspfad und geben dir passende Quests.
                <ul className="space-y-1 mt-1">
                  <li>• Wähle eine <span style={{ color: "#a78bfa" }}>aktive Klasse</span> aus der Liste — sie ist sofort verfügbar.</li>
                  <li>• Keine passende Klasse? <span style={{ color: "#f59e0b" }}>Eigene Klasse einreichen</span> — ein Admin schmiedet sie für dich.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Begleiter">
                Dein Begleiter erscheint auf deiner Spielerkarte und motiviert dich.
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#f0f0f0" }}>Haustier</span> — Dein echtes Tier bekommt Pflege-Quests.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Drache</span> — Feuriger Motivations-Begleiter.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Eule</span> — Weiser Lern-Begleiter.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Phoenix</span> — Steht nach jeder Niederlage wieder auf.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Wolf</span> — Treuer Begleiter an deiner Seite.</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "quests" && (
            <>
              <GuideSection title="Quest Board">
                Das Quest Board ist dein Auftragszettel. Quests werden nach Schwierigkeit und Typ sortiert.
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Aufträge</span> — Offene Quests die du annehmen kannst.</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>In Bearbeitung</span> — Quests die du gerade machst.</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Abgeschlossen</span> — Erledigte Quests (bleiben 24h sichtbar).</li>
                </ul>
              </GuideSection>
              <GuideSection title="Quest-Typen">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#22c55e" }}>Personal (grün)</span> — Haushalt, Alltag, persönliche Ziele</li>
                  <li><span style={{ color: "#3b82f6" }}>Learning (blau)</span> — Lernen, Lesen, Weiterbildung</li>
                  <li><span style={{ color: "#f97316" }}>Fitness (orange)</span> — Training, Sport, Gesundheit</li>
                  <li><span style={{ color: "#ec4899" }}>Social (pink)</span> — Freunde treffen, Kontakte pflegen</li>
                  <li><span style={{ color: "#f43f5e" }}>Coop (rot)</span> — Gemeinsam mit Partner oder Freund</li>
                </ul>
              </GuideSection>
              <GuideSection title="Schwierigkeit & Rarity">
                Quests haben eine Schwierigkeit die ihrer Rarity entspricht:
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#9ca3af" }}>Common (grau)</span> — Starter-Quests, schnell erledigt</li>
                  <li><span style={{ color: "#22c55e" }}>Uncommon (grün)</span> — Mittlere Herausforderung</li>
                  <li><span style={{ color: "#3b82f6" }}>Rare (blau)</span> — Anspruchsvoll, bessere Belohnungen</li>
                  <li><span style={{ color: "#a855f7" }}>Epic (lila)</span> — Mehrtägige Aufgaben, starke Rewards</li>
                </ul>
              </GuideSection>
              <GuideSection title="Quest annehmen">
                Klicke auf eine Quest → &quot;Annehmen&quot;. Nach Abschluss → &quot;Abschließen&quot;. XP und Gold werden sofort gutgeschrieben.
                <p className="mt-1.5">Dein Quest-Pool wird automatisch aufgefüllt. Klicke auf das Scroll-Icon um neue Quests zu laden.</p>
              </GuideSection>
            </>
          )}
          {tab === "npcs" && (
            <>
              <GuideSection title="Wanderer's Rest">
                Im Wanderer&apos;s Rest tauchen reisende NPCs auf — jeder mit eigenen Quest-Ketten und Persönlichkeit.
              </GuideSection>
              <GuideSection title="Wie es funktioniert">
                <ul className="space-y-1 mt-1">
                  <li>• NPCs kommen und gehen — sie bleiben 2-4 Tage, dann ziehen sie weiter.</li>
                  <li>• Jeder NPC hat mehrere Quest-Ketten mit aufeinander aufbauenden Aufgaben.</li>
                  <li>• Quest-Ketten werden schwieriger und die Belohnungen besser.</li>
                  <li>• Der letzte Quest einer Kette gibt ein einzigartiges Item als Belohnung.</li>
                </ul>
              </GuideSection>
              <GuideSection title="NPC Raritäten">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#9ca3af" }}>Common</span> — 2-3 Ketten, einfache Aufgaben, gemütliches Tempo</li>
                  <li><span style={{ color: "#3b82f6" }}>Rare</span> — 3 Ketten, 6-8 Quests, anspruchsvoller</li>
                  <li><span style={{ color: "#a855f7" }}>Epic</span> — 3 Ketten, 8-10 Quests, starke Belohnungen</li>
                  <li><span style={{ color: "#f59e0b" }}>Legendary</span> — 3 Ketten, 10-12 Quests, epische Story und Legendary Items</li>
                </ul>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Tipp: Schließe NPC-Quests ab bevor der NPC wieder aufbricht! Verpasste Quests kommen erst zurück wenn der NPC erneut vorbeischaut.</p>
              </GuideSection>
            </>
          )}
          {tab === "gacha" && (
            <>
              <GuideSection title="Vault of Fate">
                Im Vault of Fate kannst du Items ziehen — Ausrüstung, Tränke und seltene Artefakte.
              </GuideSection>
              <GuideSection title="Wie es funktioniert">
                <ul className="space-y-1 mt-1">
                  <li>• Ein Pull kostet 100 Stardust.</li>
                  <li>• Jedes Item hat eine Rarity: Common, Uncommon, Rare, Epic oder Legendary.</li>
                  <li>• Das Pity-System garantiert nach einer bestimmten Anzahl Pulls ein seltenes Item.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Item Pool">
                Klicke auf &quot;Item Pool&quot; um alle verfügbaren Items zu sehen, sortiert nach Rarity. Epic und Legendary Items leuchten besonders.
              </GuideSection>
              <GuideSection title="Inventar">
                Gezogene Items landen in deinem Inventar auf dem Charakter-Screen.
              </GuideSection>
              <GuideSection title="Währungen">
                Gold, Stardust, Rune Shards und weitere Währungen bekommst du durch Quests und Rituale.
              </GuideSection>
            </>
          )}
          {tab === "rituale" && (
            <>
              <GuideSection title="Tägliche Rituale">
                Rituale sind wiederkehrende Aufgaben die du jeden Tag erledigst. Sie bauen Streaks auf und geben tägliche XP und Gold.
              </GuideSection>
              <GuideSection title="Rituale erstellen">
                Klicke auf &quot;Neues Ritual&quot; und gib einen Namen und optional eine Beschreibung ein. Rituale tracken automatisch deinen Streak.
              </GuideSection>
              <GuideSection title="Streak-Badges">
                Je länger dein Streak, desto besser dein Badge:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#cd7f32" }}>Bronze</span> (7 Tage)</li>
                  <li>• <span style={{ color: "#9ca3af" }}>Silber</span> (21 Tage)</li>
                  <li>• <span style={{ color: "#f59e0b" }}>Gold</span> (60 Tage)</li>
                  <li>• <span style={{ color: "#6b7280" }}>Titan</span> (90 Tage)</li>
                  <li>• <span style={{ color: "#67e8f9" }}>Diamond</span> (180 Tage)</li>
                  <li>• <span style={{ color: "#a855f7" }}>Legend</span> (365 Tage)</li>
                </ul>
              </GuideSection>
              <GuideSection title="Aetherbond">
                Wähle einen Aetherbond (Spark bis Eternity) um dein Ritual zu verlängern und bessere Boni zu bekommen.
              </GuideSection>
              <GuideSection title="Blood Pact">
                Der Blood Pact verdreifacht Belohnungen, aber bei Versagen verfallen alle Rewards.
              </GuideSection>
              <GuideSection title="Vow Shrine">
                Im Vow Shrine legst du langfristige Gelübde ab — Versprechen an dich selbst.
              </GuideSection>
            </>
          )}
          {tab === "xpgold" && (
            <>
              <GuideSection title="XP & Level">
                Jede abgeschlossene Quest gibt XP. Mit genug XP steigst du im Level auf.
              </GuideSection>
              <GuideSection title="Gold">
                Gold bekommst du für Quests, Rituale und NPC-Aufträge. Ausgeben kannst du es:
                <ul className="space-y-1 mt-1">
                  <li>• Im The Bazaar — echte Belohnungen einlösen</li>
                  <li>• Im Vault of Fate — Gacha Pulls</li>
                </ul>
              </GuideSection>
              <GuideSection title="Deepforge">
                Deine Deepforge zeigt wie aktiv du bist (0-100%). Erledige Quests um sie hochzuhalten. Bei 0% bekommst du eine <span style={{ color: "#ef4444" }}>XP-Strafe</span>.
                <p className="mt-1">Die Deepforge zeigt wie aktiv du bist.</p>
              </GuideSection>
              <GuideSection title="Währungen">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#f59e0b" }}>Gold</span> — Hauptwährung für Belohnungen und Gacha</li>
                  <li><span style={{ color: "#67e8f9" }}>Stardust</span> — Gacha-Währung für Vault of Fate Pulls</li>
                  <li><span style={{ color: "#34d399" }}>Essenz</span> — Crafting-Ressource für besondere Items</li>
                  <li><span style={{ color: "#a855f7" }}>Rune Shards</span> — Seltene Währung für Rune-Upgrades</li>
                  <li><span style={{ color: "#3b82f6" }}>Guild Coins</span> — Gildenwährung für Guild-Shop</li>
                  <li><span style={{ color: "#c084fc" }}>Moondust</span> — Mondphasen-Währung für Mondrituale</li>
                </ul>
              </GuideSection>
              <GuideSection title="Streaks">
                Erledige jeden Tag mindestens eine Quest oder ein Ritual um deinen Streak zu halten. Längere Streaks erhöhen deinen Gold-Multiplikator.
              </GuideSection>
            </>
          )}
          {tab === "achievements" && (
            <>
              <GuideSection title="Honors">
                Im Honors-Tab findest du alle Achievements. Sie werden automatisch freigeschaltet wenn du Meilensteine erreichst.
              </GuideSection>
              <GuideSection title="Kategorien">
                <ul className="space-y-1 mt-1">
                  <li>• Quest-Meilensteine (erste Quest, 10, 50, 100...)</li>
                  <li>• Streak-Achievements (7 Tage, 30 Tage, 90 Tage...)</li>
                  <li>• Spezial-Achievements (alle Quest-Typen, Speed-Runs, Easter Eggs...)</li>
                </ul>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Eingeloggt siehst du welche Achievements du schon hast (goldener Rahmen).</p>
              </GuideSection>
              <GuideSection title="Begleiter-Achievements">
                Spezielle Achievements für deine Begleiter: <span style={{ color: "#f97316" }}>Ember Sprite</span>, <span style={{ color: "#a78bfa" }}>Lore Owl</span> und <span style={{ color: "#9ca3af" }}>Gear Golem</span> schalten eigene Meilensteine frei.
              </GuideSection>
            </>
          )}
        </div>
    </div>
  );
}

// ─── GuideModal ───────────────────────────────────────────────────────────────

export function GuideModal({ onClose, onRestartTutorial }: { onClose: () => void; onRestartTutorial?: () => void }) {
  useModalBehavior(true, onClose);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", touchAction: "none", overscrollBehavior: "contain" }}
      onClick={onClose}
      onWheel={e => e.stopPropagation()}
    >
      <div
        className="rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ background: "#1a1a1a", border: "1px solid rgba(255,140,68,0.3)", boxShadow: "0 0 60px rgba(255,100,0,0.15)", maxHeight: "90vh", overflowY: "auto", overscrollBehavior: "contain" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>Player Guide</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Everything you need to know</p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", fontSize: 16, background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>
        <GuideContent onRestartTutorial={onRestartTutorial} />
      </div>
    </div>
  );
}

// ─── Tutorial Overlay (Honkai Star Rail style) ───────────────────────────────

export const TUTORIAL_STEPS = [
  {
    key: "welcome",
    title: "Willkommen in der Quest Hall!",
    desc: "Lass mich dir kurz zeigen wie alles funktioniert.",
    target: null,
    position: "center" as const,
    navigateTo: null,
  },
  {
    key: "stat-cards",
    title: "Deine Stats",
    desc: "Forge Streak, aktive Quests und abgeschlossene Quests — dein Fortschritt auf einen Blick.",
    target: "stat-cards",
    position: "bottom" as const,
    navigateTo: null,
  },
  {
    key: "login-btn",
    title: "Einloggen",
    desc: "Logge dich mit Name und Passwort ein um Quests anzunehmen. Noch kein Account? Klick auf Register!",
    target: "login-btn",
    position: "bottom" as const,
    navigateTo: null,
  },
  {
    key: "nav-overview",
    title: "Navigation",
    desc: "Oben findest du alle Bereiche der Quest Hall. Lass uns sie der Reihe nach durchgehen.",
    target: "nav-bar",
    position: "bottom" as const,
    navigateTo: null,
  },
  {
    key: "quest-board",
    title: "The Great Hall — Quest Board",
    desc: "Dein Auftragsboard. Hier findest du Quests sortiert nach Typ und Schwierigkeit.",
    target: "quest-board-tab",
    position: "bottom" as const,
    navigateTo: "questBoard",
  },
  {
    key: "quest-filters",
    title: "Filter & Suche",
    desc: "Filtere Quests nach Typ (Personal, Learning, Fitness, Social, Coop) oder suche nach Stichwörtern.",
    target: "quest-filters",
    position: "bottom" as const,
    navigateTo: "questBoard",
  },
  {
    key: "first-quest",
    title: "Deine erste Quest",
    desc: "Klick auf eine Quest und dann auf 'Annehmen'. Probier es gleich aus — deine erste Quest wartet schon!",
    target: "quest-list-first",
    position: "bottom" as const,
    navigateTo: "questBoard",
  },
  {
    key: "wanderers-rest",
    title: "The Wanderer's Rest — NPCs",
    desc: "Reisende NPCs bringen eigene Quest-Ketten mit. Schließe sie ab bevor der NPC weiterzieht!",
    target: "npc-board-tab",
    position: "bottom" as const,
    navigateTo: "npcBoard",
  },
  {
    key: "rituals",
    title: "Tägliche Rituale & Gelübde",
    desc: "Rituale sind tägliche Aufgaben die Streaks aufbauen. Im Vow Shrine legst du langfristige Ziele fest.",
    target: "rituals-tab",
    position: "bottom" as const,
    navigateTo: "rituals",
  },
  {
    key: "vault-of-fate",
    title: "Vault of Fate — Gacha",
    desc: "Ziehe Items mit Stardust — Ausrüstung, Tränke und seltene Artefakte. Pity-System garantiert seltene Drops!",
    target: "vault-tab",
    position: "bottom" as const,
    navigateTo: "gacha",
  },
  {
    key: "bazaar",
    title: "The Bazaar",
    desc: "Im Bazaar löst du Gold gegen echte Belohnungen ein. Die Deepforge-Temperatur zeigt wie aktiv du bist.",
    target: "bazaar-tab",
    position: "bottom" as const,
    navigateTo: "shop",
  },
  {
    key: "leaderboard",
    title: "The Proving Grounds",
    desc: "Wer hat die meisten Quests? Die längsten Streaks? Schau in die Rangliste!",
    target: "leaderboard-tab",
    position: "bottom" as const,
    navigateTo: "leaderboard",
  },
  {
    key: "honors",
    title: "Hall of Honors",
    desc: "Schalte Achievements frei indem du Meilensteine erreichst. Deine Trophäensammlung!",
    target: "honors-tab",
    position: "bottom" as const,
    navigateTo: "honors",
  },
  {
    key: "season",
    title: "Saisonale Events",
    desc: "Jeden Monat gibt es ein neues Saison-Thema mit besonderen Boni und Herausforderungen.",
    target: "season-tab",
    position: "bottom" as const,
    navigateTo: "season",
  },
  {
    key: "xp-gold",
    title: "XP, Gold & Währungen",
    desc: "Quests geben XP und Gold. Stardust fürs Gacha, Rune Shards für Crafting. Alles auf deinem Character Screen.",
    target: null,
    position: "center" as const,
    navigateTo: null,
  },
  {
    key: "forge-streak",
    title: "Forge Streak",
    desc: "Erledige jeden Tag mindestens eine Quest um deinen Streak zu halten. Längere Streaks = bessere Boni!",
    target: null,
    position: "center" as const,
    navigateTo: null,
  },
  {
    key: "character",
    title: "Dein Charakter",
    desc: "Auf dem Character Screen siehst du dein Inventar, Gear und Stats. Items aus dem Vault landen hier.",
    target: null,
    position: "center" as const,
    navigateTo: null,
  },
  {
    key: "done",
    title: "Bereit, Wanderer!",
    desc: "Die Halle wartet auf dich. Nimm deine erste Quest an und zeig was du kannst!",
    target: null,
    position: "center" as const,
    navigateTo: null,
  },
];

export function TutorialOverlay({ step, onNext, onSkip, onNavigate }: { step: number; onNext: () => void; onSkip: () => void; onNavigate?: (tabKey: string) => void }) {
  const stepDef = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; arrowDir: "up" | "down" | "none" } | null>(null);
  const [confetti, setConfetti] = useState<{ x: number; y: number; color: string; id: number }[]>([]);

  // ESC key to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onSkip(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onSkip]);

  useEffect(() => {
    if (isLast) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const pieces = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: cx + (Math.random() - 0.5) * 300,
        y: cy + (Math.random() - 0.5) * 200,
        color: ["#ff4444","#f59e0b","#22c55e","#3b82f6","#a855f7","#ec4899"][i % 6],
      }));
      setConfetti(pieces);
      const t = setTimeout(() => setConfetti([]), 1800);
      return () => clearTimeout(t);
    }
  }, [isLast]);

  // Navigate to tab when step changes
  useEffect(() => {
    if (stepDef.navigateTo && onNavigate) {
      onNavigate(stepDef.navigateTo);
    }
  }, [stepDef, onNavigate]);

  useEffect(() => {
    if (!stepDef.target) { setPopupPos(null); return; }
    const el = document.querySelector(`[data-tutorial="${stepDef.target}"]`);
    if (!el) { setPopupPos(null); return; }

    const rect = el.getBoundingClientRect();
    const POPUP_W = 300;
    const POPUP_H = 130;
    const GAP = 14;

    let top: number;
    let arrowDir: "up" | "down" | "none" = "none";

    if (stepDef.position === "bottom") {
      top = rect.bottom + GAP;
      arrowDir = "up";
      if (top + POPUP_H > window.innerHeight - 20) {
        top = rect.top - POPUP_H - GAP;
        arrowDir = "down";
      }
    } else {
      top = rect.top - POPUP_H - GAP;
      arrowDir = "down";
      if (top < 20) {
        top = rect.bottom + GAP;
        arrowDir = "up";
      }
    }

    let left = rect.left + rect.width / 2 - POPUP_W / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - POPUP_W - 12));

    setPopupPos({ top, left, arrowDir });

    // Elevate target element
    (el as HTMLElement).classList.add("tutorial-spotlight");
    return () => (el as HTMLElement).classList.remove("tutorial-spotlight");
  }, [stepDef]);

  const isCentered = !stepDef.target || !popupPos;

  return (
    <>
      {isCentered && (
        <div
          className="fixed inset-0"
          style={{ background: "rgba(0,0,0,0.35)", zIndex: 9998, transition: "opacity 0.4s ease" }}
          onClick={onNext}
        />
      )}
      {!isCentered && (
        <div className="fixed inset-0" style={{ zIndex: 9998, pointerEvents: "none", transition: "opacity 0.4s ease" }} />
      )}

      {/* Confetti */}
      {confetti.map(c => (
        <div
          key={c.id}
          className="fixed pointer-events-none"
          style={{
            top: c.y,
            left: c.x,
            width: 10,
            height: 10,
            background: c.color,
            borderRadius: 2,
            zIndex: 10003,
            animation: "tutorial-confetti-burst 1.5s ease forwards",
          }}
        />
      ))}

      {/* Popup */}
      <div
        className="tutorial-popup fixed"
        style={{
          zIndex: 10002,
          ...(isCentered
            ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
            : { top: popupPos!.top, left: popupPos!.left }),
          width: isCentered ? 340 : 300,
          background: "#1a1a1a",
          border: "1px solid rgba(255,200,50,0.4)",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 0 30px rgba(255,200,50,0.12)",
          padding: "16px 18px 14px",
        }}
      >
        {!isCentered && popupPos?.arrowDir === "up" && (
          <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: "8px solid rgba(255,200,50,0.4)" }} />
        )}
        {!isCentered && popupPos?.arrowDir === "down" && (
          <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "8px solid rgba(255,200,50,0.4)" }} />
        )}

        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,200,50,0.12)", color: "#fbbf24", border: "1px solid rgba(255,200,50,0.25)" }}>
              {step + 1}/{TUTORIAL_STEPS.length}
            </span>
            <h3 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>{stepDef.title}</h3>
          </div>
          <button
            onClick={onSkip}
            className="action-btn text-xs px-2 py-0.5 rounded font-medium"
            style={{ color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }}
            title="Skip tutorial (ESC)"
          >Skip</button>
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>{stepDef.desc}</p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onNext}
            className="action-btn btn-primary text-xs px-4 py-1.5 rounded-lg font-semibold"
            style={{ background: "rgba(251,191,36,0.18)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)" }}
          >
            {isLast ? "Let's Go!" : "Next →"}
          </button>
        </div>
      </div>
    </>
  );
}
