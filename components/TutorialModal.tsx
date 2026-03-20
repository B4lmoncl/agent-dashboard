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
  const [tab, setTab] = useState<"start" | "quests" | "npcs" | "character" | "gacha" | "crafting" | "rituals" | "challenges" | "social" | "progression" | "honors">("start");
  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b overflow-x-auto mb-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {([
          { key: "start",       label: "Start" },
          { key: "quests",      label: "Quests" },
          { key: "npcs",        label: "NPCs" },
          { key: "character",   label: "Character" },
          { key: "gacha",       label: "Gacha" },
          { key: "crafting",    label: "Crafting" },
          { key: "rituals",     label: "Rituals" },
          { key: "challenges",  label: "Challenges" },
          { key: "social",      label: "Social" },
          { key: "progression", label: "Progression" },
          { key: "honors",      label: "Honors" },
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
              <GuideSection title="Registration">
                Klicke auf <strong>Login → Register</strong> in der Kopfleiste. Der <strong>Charakter-Creator</strong> führt dich in 6 Schritten durch die Erstellung deines Helden:
                <ol className="space-y-1 mt-1 ml-2" style={{ listStyleType: "decimal" }}>
                  <li><span style={{ color: "#f0f0f0" }}>Name & Passwort</span> — Wähle deinen Heldennamen und ein sicheres Passwort (min. 6 Zeichen).</li>
                  <li><span style={{ color: "#f0f0f0" }}>Über dich</span> — Optionales Alter, Pronomen und Ziele.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Klasse</span> — Wähle deinen Berufspfad oder reiche eine eigene Klasse ein.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Beziehungsstatus</span> — Optional: Partner-Name für Coop-Quests.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Begleiter</span> — Haustier oder virtueller Begleiter (Pflicht).</li>
                  <li><span style={{ color: "#f0f0f0" }}>Zusammenfassung</span> — Übersicht und Bestätigung.</li>
                </ol>
              </GuideSection>
              <GuideSection title="Classes">
                Klassen definieren deinen Berufspfad und geben dir passende Quests.
                <ul className="space-y-1 mt-1">
                  <li>• Wähle eine <span style={{ color: "#a78bfa" }}>aktive Klasse</span> aus der Liste — sie ist sofort verfügbar.</li>
                  <li>• Keine passende Klasse? <span style={{ color: "#f59e0b" }}>Eigene Klasse einreichen</span> — ein Admin schmiedet sie für dich.</li>
                  <li>• Klassen haben <span style={{ color: "#c4b5fd" }}>Tier-Stufen</span> die mit XP automatisch freigeschaltet werden.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Navigation (5 Stockwerke)">
                Die Quest Hall ist in 5 Stockwerke aufgeteilt — inspiriert von Urithiru:
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#fbbf24" }}>The Pinnacle</span> — Prestige: Observatory (Kampagnen), Proving Grounds (Leaderboard), Hall of Honors, Season</li>
                  <li><span style={{ color: "#f97316" }}>The Great Halls</span> — Abenteuer: Quest Board, Wanderer&apos;s Rest (NPCs), Weekly Challenges</li>
                  <li><span style={{ color: "#a855f7" }}>The Trade Quarter</span> — Handel: Bazaar (Shop), Artisan&apos;s Quarter (Crafting), Vault of Fate (Gacha)</li>
                  <li><span style={{ color: "#3b82f6" }}>The Inner Sanctum</span> — Persönlich: Character, Arcanum, Ritual Chamber, Vow Shrine</li>
                  <li><span style={{ color: "#ec4899" }}>The Breakaway</span> — Sozial: Friends, Messages, Trading</li>
                </ul>
              </GuideSection>
              <GuideSection title="Companions">
                Dein Begleiter erscheint auf deiner Spielerkarte, gibt dir Quests und motiviert dich. Wähle zwischen deinem echten Haustier oder einem virtuellen Begleiter:
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#f0f0f0" }}>Haustier</span> — Dein echtes Tier (Katze, Hund, Hamster, ...) bekommt artgerechte Pflege-Quests.</li>
                  <li><span style={{ color: "#f97316" }}>Drache</span> — Feuriger Motivations-Begleiter (fordernd).</li>
                  <li><span style={{ color: "#a78bfa" }}>Eule</span> — Weiser Lern-Begleiter.</li>
                  <li><span style={{ color: "#ef4444" }}>Phoenix</span> — Steht nach jeder Niederlage wieder auf (resilient).</li>
                  <li><span style={{ color: "#6b7280" }}>Wolf</span> — Treuer Begleiter an deiner Seite (loyal).</li>
                  <li><span style={{ color: "#f59e0b" }}>Fuchs</span> — Cleverer Trickster.</li>
                  <li><span style={{ color: "#92400e" }}>Bär</span> — Starker Beschützer.</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "quests" && (
            <>
              <GuideSection title="Quest Board">
                Das Quest Board ist dein Auftragszettel — The Great Hall. Drei Bereiche:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Aufträge</span> — Offene Quests die du annehmen kannst.</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>In Bearbeitung</span> — Quests die du gerade machst (max ~25).</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Abgeschlossen</span> — Erledigte Quests (bleiben 24h sichtbar).</li>
                </ul>
                <p className="mt-1.5">Dein Quest-Pool wird automatisch aufgefüllt (~10 offene Quests). Klicke auf das Scroll-Icon um neue Quests zu laden (Cooldown: 6h).</p>
              </GuideSection>
              <GuideSection title="Quest Types">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#22c55e" }}>Personal (grün)</span> — Haushalt, Alltag, persönliche Ziele</li>
                  <li><span style={{ color: "#3b82f6" }}>Learning (blau)</span> — Lernen, Lesen, Weiterbildung</li>
                  <li><span style={{ color: "#f97316" }}>Fitness (orange)</span> — Training, Sport, Gesundheit</li>
                  <li><span style={{ color: "#ec4899" }}>Social (pink)</span> — Freunde treffen, Kontakte pflegen (+5 Gildentaler)</li>
                  <li><span style={{ color: "#f43f5e" }}>Coop (rot)</span> — Gemeinsam mit Partner erledigen (+5 Gildentaler)</li>
                  <li><span style={{ color: "#ff6b9d" }}>Companion (rosa)</span> — Quests von deinem Begleiter</li>
                  <li><span style={{ color: "#f59e0b" }}>Boss</span> — Besonders schwer, garantierter Loot-Drop</li>
                </ul>
              </GuideSection>
              <GuideSection title="Rarity & Rewards">
                Quests haben eine Seltenheit die ihre Belohnungen bestimmt:
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#9ca3af" }}>Common</span> — 10 XP, 5-10 Gold, 1 Runensplitter</li>
                  <li><span style={{ color: "#22c55e" }}>Uncommon</span> — 18 XP, 10-18 Gold, 1 Runensplitter</li>
                  <li><span style={{ color: "#3b82f6" }}>Rare</span> — 30 XP, 18-30 Gold, 2 Runensplitter</li>
                  <li><span style={{ color: "#a855f7" }}>Epic</span> — 50 XP, 30-50 Gold, 3 Runensplitter</li>
                  <li><span style={{ color: "#FFD700" }}>Legendary</span> — 80 XP, 50-80 Gold, 5 Runensplitter</li>
                </ul>
                <p className="mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Zusätzlich: Chance auf Loot-Drops (25% Basis) und Crafting-Materialien bei jeder Quest.</p>
              </GuideSection>
              <GuideSection title="Coop Quests & Quest Chains">
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Coop-Quests</span>: Beide Partner müssen ihren Teil abschließen. Die Quest wird erst als erledigt markiert wenn alle fertig sind.</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Quest-Ketten</span>: Aufeinander aufbauende Quests — die nächste wird erst freigeschaltet wenn die vorherige erledigt ist.</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Wiederkehrende Quests</span>: Manche Quests wiederholen sich täglich, wöchentlich oder monatlich.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Quest Hoarding Penalty">
                <p>Zu viele aktive Quests gleichzeitig? Ab <strong style={{ color: "#ef4444" }}>20 aktiven Quests</strong> gibt es eine XP-Strafe:</p>
                <ul className="space-y-1 mt-1">
                  <li>• 21-29 Quests: bis zu <span style={{ color: "#ef4444" }}>-50% XP</span></li>
                  <li>• 30+ Quests: <span style={{ color: "#ef4444" }}>-80% XP</span></li>
                </ul>
              </GuideSection>
              <GuideSection title="The Observatory (Campaigns)">
                Im <strong>Observatory</strong> (The Pinnacle) erstellst und verfolgst du Kampagnen — zusammenhängende Quest-Ketten mit eigener Story:
                <ul className="space-y-1 mt-1">
                  <li>• Erstelle Kampagnen mit Titel, Beschreibung und verknüpften Quests.</li>
                  <li>• Quests in einer Kampagne werden der Reihe nach freigeschaltet.</li>
                  <li>• Fortschrittsbalken zeigt den Gesamtfortschritt jeder Kampagne.</li>
                </ul>
              </GuideSection>
              <GuideSection title="The Arcanum (Class & Roadmap)">
                Im <strong>Arcanum</strong> (Inner Sanctum) findest du klassenspezifische Inhalte und die Feature-Roadmap:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#a78bfa" }}>Klassenquests</span> — Spezielle Quests basierend auf deiner gewählten Klasse.</li>
                  <li>• <span style={{ color: "#f59e0b" }}>Roadmap</span> — Übersicht geplanter Features und Updates.</li>
                  <li>• <span style={{ color: "#3b82f6" }}>CV Builder</span> — Erstelle einen Lebenslauf basierend auf deinen Quest-Erfolgen.</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "npcs" && (
            <>
              <GuideSection title="Wanderer's Rest">
                Im Wanderer&apos;s Rest tauchen reisende NPCs auf — jeder mit eigenen Quest-Ketten und Persönlichkeit. Bis zu <strong>7 NPCs</strong> können gleichzeitig aktiv sein.
              </GuideSection>
              <GuideSection title="How it Works">
                <ul className="space-y-1 mt-1">
                  <li>• NPCs kommen und gehen — sie bleiben <strong>2-4 Tage</strong>, dann ziehen sie weiter.</li>
                  <li>• Jeder NPC hat Quest-Ketten mit aufeinander aufbauenden Aufgaben — du musst sie <strong>der Reihe nach</strong> abschließen.</li>
                  <li>• Die letzte Quest einer Kette gibt ein <strong>einzigartiges Item</strong> als Belohnung.</li>
                  <li>• Wenn ein NPC abreist, werden <strong>laufende Quests</strong> als gescheitert markiert.</li>
                  <li>• Nach der Abreise hat ein NPC einen <strong>Cooldown</strong> (meist 48h) bevor er wiederkommen kann.</li>
                </ul>
              </GuideSection>
              <GuideSection title="NPC Rarities">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#9ca3af" }}>Common</span> — 2-3 Ketten, einfache Aufgaben, gemütliches Tempo</li>
                  <li><span style={{ color: "#3b82f6" }}>Rare</span> — 3 Ketten, 6-8 Quests, anspruchsvoller</li>
                  <li><span style={{ color: "#a855f7" }}>Epic</span> — 3 Ketten, 8-10 Quests, starke Belohnungen</li>
                  <li><span style={{ color: "#f59e0b" }}>Legendary</span> — 3 Ketten, 10-12 Quests, epische Story und Legendary Items</li>
                </ul>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Tipp: Schließe NPC-Quests ab bevor der NPC aufbricht! Die verbleibende Zeit wird direkt am NPC-Portrait angezeigt.</p>
              </GuideSection>
            </>
          )}
          {tab === "character" && (
            <>
              <GuideSection title="Character Screen">
                Auf dem Charakter-Screen siehst du dein Inventar, deine Ausrüstung, Stats und deinen Begleiter. Erreichbar über den <strong>Character</strong>-Tab (nur eingeloggt).
              </GuideSection>
              <GuideSection title="Equipment (6 Slots)">
                Rüste Items aus dem Inventar aus. Jeder Slot kann ein Item tragen:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Helm, Rüstung, Waffe, Schild, Amulett, Stiefel</span></li>
                  <li>• Items haben <strong>Primary Stats</strong> (Kraft, Ausdauer, Weisheit, Glück) und <strong>Minor Stats</strong> (Fokus, Vitalität, Charisma, Tempo)</li>
                  <li>• Stats werden zufällig gewürfelt (Diablo-3-Stil) — bessere Seltenheit = höhere Werte</li>
                </ul>
              </GuideSection>
              <GuideSection title="Stats & Effects">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#ef4444" }}>Kraft</span> — Bis zu +30% XP-Bonus</li>
                  <li><span style={{ color: "#3b82f6" }}>Ausdauer</span> — Verlangsamt Forge-Temperatur-Verfall</li>
                  <li><span style={{ color: "#f59e0b" }}>Weisheit</span> — Bis zu +30% Gold-Bonus</li>
                  <li><span style={{ color: "#22c55e" }}>Glück</span> — Bis zu +20% Loot-Drop-Chance</li>
                  <li style={{ color: "rgba(255,255,255,0.4)" }}><span style={{ color: "#9ca3af" }}>Fokus</span> — Flacher XP-Bonus pro Quest (bis +50)</li>
                  <li style={{ color: "rgba(255,255,255,0.4)" }}><span style={{ color: "#9ca3af" }}>Vitalität</span> — +1% Streak-Recovery-Chance pro Punkt</li>
                  <li style={{ color: "rgba(255,255,255,0.4)" }}><span style={{ color: "#9ca3af" }}>Charisma</span> — +5% Bond-XP pro Companion-Quest</li>
                  <li style={{ color: "rgba(255,255,255,0.4)" }}><span style={{ color: "#9ca3af" }}>Tempo</span> — +1% Forge-Temp-Recovery pro Punkt</li>
                </ul>
              </GuideSection>
              <GuideSection title="Set Bonuses & Legendary Effects">
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Set-Bonus</span>: 3 Teile eines Sets = +5% Primary Stats, 6 Teile = +10%</li>
                  <li>• <span style={{ color: "#FFD700" }}>Legendary Effects</span>: Besondere Effekte auf Legendary-Gear — z.B. XP-Bonus, Gold-Bonus, Nacht-Gold-Verdopplung, Auto-Streak-Schutz, Material-Verdopplung und mehr.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Companions & Bond System">
                Dein Begleiter hat ein <strong>Bond-Level</strong> (1-10). Höherer Bond = mehr Boni:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Streicheln</span> — 2× pro Tag für +0.5 Bond-XP</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Companion-Quests</span> — Erledige Begleiter-Quests für Bond-XP</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Streak halten</span> — +0.25 Bond-XP pro Tag</li>
                  <li>• Ab <strong style={{ color: "#ec4899" }}>Bond Lv. 5</strong> schaltest du <strong>Ultimate-Fähigkeiten</strong> frei (7-Tage-Cooldown):</li>
                  <li style={{ marginLeft: 12 }}>⚡ Quest sofort abschließen · ✨ 2× Loot · 🔥 +3 Streak-Tage</li>
                </ul>
                <p className="mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Bond-Stufen: Stranger → Acquaintance → Friend → Close Friend → Best Friend → Soulmate → Legendary I-IV</p>
              </GuideSection>
              <GuideSection title="Inventory">
                Items aus Gacha, Loot-Drops und Quests landen hier. Du kannst sie:
                <ul className="space-y-1 mt-1">
                  <li>• <strong>Ausrüsten</strong> — Gear in Slots anlegen</li>
                  <li>• <strong>Benutzen</strong> — Consumables wie Tränke, Streak-Shields, XP-Boosts</li>
                  <li>• <strong>Zerlegen</strong> — Im Artisan&apos;s Quarter zu Essenz + Materialien</li>
                  <li>• <strong>Wegwerfen</strong> — Items dauerhaft entfernen</li>
                </ul>
                <p className="mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Passive Items (z.B. Glücksklee, Mitleids-Katalysator) wirken automatisch solange sie im Inventar sind.</p>
              </GuideSection>
              <GuideSection title="Titles">
                Titel werden durch Meilensteine freigeschaltet (Level, Quests, Streaks, Gold, ...). Rüste einen Titel im Charakter-Screen aus — er wird auf deiner Spielerkarte und im Leaderboard angezeigt.
              </GuideSection>
            </>
          )}
          {tab === "gacha" && (
            <>
              <GuideSection title="Vault of Fate">
                Im Vault of Fate kannst du Items ziehen — Ausrüstung, Tränke und seltene Artefakte. Es gibt zwei Banner:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#a78bfa" }}>Wheel of Stars</span> (Standard) — Kostet <strong>Runensplitter</strong> (10 pro Pull, 90 für 10×)</li>
                  <li>• <span style={{ color: "#818cf8" }}>Astral Radiance</span> (Featured) — Kostet <strong>Stardust</strong> (10 pro Pull, 90 für 10×)</li>
                </ul>
              </GuideSection>
              <GuideSection title="Drop Rates">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#FFD700" }}>Legendary</span> — 0.8% Basis-Chance</li>
                  <li><span style={{ color: "#a855f7" }}>Epic</span> — 13%</li>
                  <li><span style={{ color: "#3b82f6" }}>Rare</span> — 35%</li>
                  <li><span style={{ color: "#22c55e" }}>Uncommon</span> — 40%</li>
                  <li><span style={{ color: "#9ca3af" }}>Common</span> — ~11%</li>
                </ul>
              </GuideSection>
              <GuideSection title="Pity-System">
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f59e0b" }}>Soft Pity</span> ab Pull <strong>55</strong>: Legendary-Chance steigt um +2.5% pro Pull</li>
                  <li>• <span style={{ color: "#ef4444" }}>Hard Pity</span> bei Pull <strong>75</strong>: Garantiertes Legendary</li>
                  <li>• <span style={{ color: "#a855f7" }}>Epic Pity</span>: Alle <strong>10</strong> Pulls garantiert mindestens Epic</li>
                  <li>• <strong>10×-Pull Bonus</strong>: Garantiert mindestens ein Epic-Item im 10er-Pull</li>
                </ul>
              </GuideSection>
              <GuideSection title="50/50-System (Featured Banner)">
                Wenn du ein Legendary auf dem Featured-Banner ziehst:
                <ul className="space-y-1 mt-1">
                  <li>• <strong>50% Chance</strong> auf das Featured-Item</li>
                  <li>• Verlierst du das 50/50, ist das <strong>nächste Legendary garantiert</strong> das Featured-Item</li>
                </ul>
              </GuideSection>
              <GuideSection title="Duplicates">
                Doppelte Items werden automatisch zu <span style={{ color: "#a78bfa" }}>Runensplittern</span> umgewandelt: Common 1, Uncommon 3, Rare 8, Epic 20, Legendary 50.
              </GuideSection>
            </>
          )}
          {tab === "crafting" && (
            <>
              <GuideSection title="Artisan's Quarter">
                Das Crafting-Hub im <strong>Trade Quarter</strong> mit 4 Berufs-NPCs. Erreichbar über den <strong>Artisan&apos;s Quarter</strong>-Tab (nur eingeloggt). Jeder Beruf hat ein eigenes Mindest-Level.
              </GuideSection>
              <GuideSection title="Professions (4)">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#f59e0b" }}>Schmied (Grimvar)</span> — Gear rerolling, Stats verbessern, Rarity upgraden. Ab Lv5.</li>
                  <li><span style={{ color: "#22c55e" }}>Alchemist (Ysolde)</span> — XP-, Gold- und Loot-Tränke, Streak-Shields. Ab Lv5.</li>
                  <li><span style={{ color: "#a78bfa" }}>Verzauberer (Eldric)</span> — Gear verzaubern, permanente Stat-Boni. Ab Lv8.</li>
                  <li><span style={{ color: "#e87b35" }}>Koch (Bruna)</span> — Mahlzeiten mit XP/Gold-Buffs, Streak-Shields. Ab Lv3.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Profession Slots & Ranks">
                <ul className="space-y-1 mt-1">
                  <li>• Berufs-Slots: <strong>1</strong> ab Lv5, <strong>2</strong> ab Lv15, <strong>3</strong> ab Lv20, <strong>4</strong> ab Lv25</li>
                  <li>• Jeder Beruf hat <strong>10 Level</strong> mit WoW-Stil-Rängen: <span style={{ color: "#6b7280" }}>Novice</span> → <span style={{ color: "#22c55e" }}>Apprentice</span> → <span style={{ color: "#3b82f6" }}>Journeyman</span> → <span style={{ color: "#a855f7" }}>Expert</span> → <span style={{ color: "#f59e0b" }}>Artisan</span> → <span style={{ color: "#ef4444" }}>Master</span></li>
                  <li>• Berufswechsel kostet <strong style={{ color: "#ef4444" }}>200 Essenz</strong> — gesamter Fortschritt geht verloren!</li>
                  <li>• <span style={{ color: "#facc15" }}>Daily Bonus</span>: Erstes Crafting am Tag gibt <strong>2× Berufs-XP</strong></li>
                </ul>
              </GuideSection>
              <GuideSection title="Skill-Up Colors">
                Ob ein Rezept XP gibt, siehst du an der Farbe:
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#f97316" }}>●</span> Orange — Garantierte XP (100%)</li>
                  <li><span style={{ color: "#eab308" }}>●</span> Gelb — Wahrscheinlich XP (75%)</li>
                  <li><span style={{ color: "#22c55e" }}>●</span> Grün — Seltene XP (25%)</li>
                  <li><span style={{ color: "#6b7280" }}>●</span> Grau — Keine XP mehr (zu niedrig)</li>
                </ul>
              </GuideSection>
              <GuideSection title="Salvaging & Transmutation">
                Neben Rezepten haben Schmied und Verzauberer jeweils ein spezielles Feature:
                <ul className="space-y-1 mt-1">
                  <li>• <strong style={{ color: "#f59e0b" }}>Schmiedekunst</strong> (beim Schmied) — Items <strong>zerlegen</strong> in <span style={{ color: "#ff8c00" }}>Essenz</span> + <span style={{ color: "#22c55e" }}>Materialien</span>. &quot;Salvage All&quot; für Massenzerlegung (nicht für Legendary).</li>
                  <li>• <strong style={{ color: "#a78bfa" }}>Transmutation</strong> (beim Verzauberer) — 3 Epic-Items gleichen Slots + 500 Gold → 1 Legendary-Item.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Workshop Tools">
                Permanente XP-Upgrades in 4 Stufen: <span style={{ color: "#9ca3af" }}>Sturdy (+2%)</span> → <span style={{ color: "#3b82f6" }}>Masterwork (+4%)</span> → <span style={{ color: "#FFD700" }}>Legendary (+7%)</span> → <span style={{ color: "#a855f7" }}>Mythic (+10%)</span>
              </GuideSection>
            </>
          )}
          {tab === "rituals" && (
            <>
              <GuideSection title="Daily Rituals">
                Rituale sind wiederkehrende Aufgaben die du jeden Tag erledigst. Sie bauen Streaks auf und geben tägliche XP und Gold. Erreichbar über die <strong>Ritual Chamber</strong> im Quest Board.
              </GuideSection>
              <GuideSection title="Creating Rituals">
                Klicke auf &quot;Neues Ritual&quot; und gib einen Namen, Schwierigkeit und optional eine Beschreibung ein. Rituale tracken automatisch deinen Streak.
                <p className="mt-1">Verpasste Tage kosten Streak-Punkte: 1 Tag = -3, 2 Tage = -7, 3+ Tage = Reset auf 0!</p>
              </GuideSection>
              <GuideSection title="Streak-Badges">
                Je länger dein Streak, desto besser dein Badge und dein XP-Bonus:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#cd7f32" }}>Bronze</span> (7 Tage, +5% XP)</li>
                  <li>• <span style={{ color: "#9ca3af" }}>2 Wochen</span> (14 Tage, Uncommon Loot)</li>
                  <li>• <span style={{ color: "#c0c0c0" }}>Silber</span> (21 Tage, +10% XP)</li>
                  <li>• <span style={{ color: "#3b82f6" }}>Monat</span> (30 Tage, Rare Loot)</li>
                  <li>• <span style={{ color: "#f59e0b" }}>Gold</span> (60 Tage, +15% XP)</li>
                  <li>• <span style={{ color: "#6b7280" }}>Titan</span> (90 Tage, Epic Loot)</li>
                  <li>• <span style={{ color: "#67e8f9" }}>Diamond</span> (180 Tage, +25% XP)</li>
                  <li>• <span style={{ color: "#a855f7" }}>Legend</span> (365 Tage, Legendary Loot)</li>
                </ul>
                <p className="mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Bei bestimmten Meilensteinen (14, 30, 90, 365 Tage) gibt es zusätzlich Loot-Drops.</p>
              </GuideSection>
              <GuideSection title="Aetherbond (Commitment)">
                Wähle einen Aetherbond um zusätzliche Gold- und XP-Boni zu bekommen:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#9ca3af" }}>Spark</span> → <span style={{ color: "#22c55e" }}>Flame</span> → <span style={{ color: "#f59e0b" }}>Ember</span> → <span style={{ color: "#ef4444" }}>Crucible</span> → <span style={{ color: "#a855f7" }}>Eternity</span></li>
                  <li>• Höhere Stufen = mehr Bonus-Gold und XP pro Ritual-Abschluss</li>
                  <li>• Boni skalieren mit Schwierigkeit (Easy ×0.5, Medium ×1, Hard ×1.5, Legendary ×2)</li>
                </ul>
              </GuideSection>
              <GuideSection title="Blood Pact">
                Der Blood Pact multipliziert Belohnungen massiv, aber bei Versagen (Streak bricht) verfällt alles:
                <ul className="space-y-1 mt-1">
                  <li>• Spark/Flame: ×3 · Ember: ×7 · Crucible: ×16 · Eternity: ×30</li>
                  <li>• Payout nur einmal, wenn Streak ≥ Commitment-Tage erreicht</li>
                  <li>• Blood Oaths können <strong>nicht verlängert</strong> werden!</li>
                </ul>
              </GuideSection>
              <GuideSection title="Vow Shrine">
                Im Vow Shrine (Anti-Rituale-Tab) legst du langfristige Gelübde ab — Versprechen an dich selbst, Dinge <strong>nicht</strong> zu tun. Jeder Tag ohne Verstoß zählt als &quot;Clean Day&quot;. Ein Verstoß setzt den Zähler zurück.
              </GuideSection>
            </>
          )}
          {tab === "challenges" && (
            <>
              <GuideSection title="Weekly Challenges">
                Jede Woche gibt es zwei Herausforderungen: den <strong>Sternenpfad</strong> (Solo) und die <strong>Expedition</strong> (Kooperativ). Erreichbar über den <strong>Challenges</strong>-Tab in den Great Halls. Reset jeden Montag.
              </GuideSection>
              <GuideSection title="Sternenpfad (Solo)">
                Eine persönliche 3-stufige Challenge mit Sternbewertung:
                <ul className="space-y-1 mt-1">
                  <li>• <strong>3 Stufen</strong> mit aufsteigender Schwierigkeit — z.B. bestimmte Quest-Typen abschließen, Gesamtquests, Streak halten</li>
                  <li>• Jede Stufe gibt <span style={{ color: "#fbbf24" }}>1-3 Sterne</span> basierend auf deinem Fortschritt (max 9 Sterne)</li>
                  <li>• <span style={{ color: "#22c55e" }}>Speed Bonus</span>: Stufe innerhalb von 2 Tagen abschließen = +1 Stern (max 3)</li>
                  <li>• Sterne skalieren Belohnungen: 2★ = <span style={{ color: "#f0f0f0" }}>+15%</span>, 3★ = <span style={{ color: "#f0f0f0" }}>+33%</span></li>
                </ul>
              </GuideSection>
              <GuideSection title="Weekly Modifiers">
                Jede Woche gibt es einen <strong>Modifier</strong> der bestimmte Quest-Typen beeinflusst:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#22c55e" }}>Bonus-Typ</span>: Ein Quest-Typ gibt <strong>+50%</strong> Fortschritt</li>
                  <li>• Andere Typen geben <span style={{ color: "#ef4444" }}>-25%</span> Fortschritt</li>
                  <li>• Der Modifier wird oben im Challenges-Tab angezeigt</li>
                </ul>
              </GuideSection>
              <GuideSection title="Expedition (Cooperative)">
                Eine gildenweite Herausforderung bei der alle Spieler gemeinsam Fortschritt erarbeiten:
                <ul className="space-y-1 mt-1">
                  <li>• <strong>4 Checkpoints</strong> mit geteiltem Fortschrittsbalken</li>
                  <li>• Benötigte Quests skalieren mit der <strong>Spieleranzahl</strong> (z.B. 8/12/18/25 Quests pro Spieler)</li>
                  <li>• Kein Pro-Spieler-Limit — aktive Spieler können für inaktive kompensieren</li>
                  <li>• <strong>Checkpoint 4 (Bonus)</strong>: Exklusiver rotierender <span style={{ color: "#fbbf24" }}>Titel</span> als Belohnung</li>
                </ul>
              </GuideSection>
              <GuideSection title="Challenge Rewards">
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f59e0b" }}>Gold</span>, <span style={{ color: "#a78bfa" }}>Runensplitter</span>, <span style={{ color: "#ef4444" }}>Essenz</span> und <span style={{ color: "#818cf8" }}>XP</span> pro Stufe/Checkpoint</li>
                  <li>• <span style={{ color: "#fbbf24" }}>Sternentaler</span> — exklusive Währung nur aus Weekly Challenges</li>
                  <li>• Belohnungen werden manuell beansprucht (Claim-Button pro Stufe/Checkpoint)</li>
                  <li>• Expedition erfordert mindestens <strong>1 Quest-Beitrag</strong> zum Claimen</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "social" && (
            <>
              <GuideSection title="The Breakaway">
                Der soziale Hub der Quest Hall. Hier findest du Freunde, Nachrichten und das Handelssystem. Erreichbar über den <strong>5. Stock (The Breakaway)</strong> — nur eingeloggt.
              </GuideSection>
              <GuideSection title="Friends">
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Freund hinzufügen</span> — Gib den Spielernamen ein und sende eine Anfrage.</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Anfragen</span> — Eingehende Anfragen annehmen oder ablehnen. Ausgehende Anfragen sehen bis der andere antwortet.</li>
                  <li>• Freundesliste zeigt <span style={{ color: "#22c55e" }}>Online-Status</span>, Level und Klasse jedes Freundes.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Messages">
                <ul className="space-y-1 mt-1">
                  <li>• Sende Nachrichten an Freunde (max 500 Zeichen).</li>
                  <li>• Unterhaltungen zeigen <span style={{ color: "#a855f7" }}>ungelesene Nachrichten</span> mit Zähler.</li>
                  <li>• Nachrichten werden automatisch als gelesen markiert wenn du die Unterhaltung öffnest.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Trading">
                Handle Items und Gold mit Freunden über ein Verhandlungssystem:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Trade vorschlagen</span> — Wähle einen Freund, biete Gold und/oder Items an.</li>
                  <li>• <span style={{ color: "#fbbf24" }}>Verhandlung</span> — Trades gehen hin und her. Jede Seite kann ein Gegenangebot machen.</li>
                  <li>• <span style={{ color: "#22c55e" }}>Annahme</span> — Beide Spieler müssen akzeptieren. Items und Gold werden atomar getauscht.</li>
                  <li>• <span style={{ color: "#ef4444" }}>Absicherung</span> — Ausgerüstete Items können nicht gehandelt werden. Gold wird bei Angebot überprüft.</li>
                  <li>• Nur ein aktiver Trade pro Spielerpaar gleichzeitig erlaubt.</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "progression" && (
            <>
              <GuideSection title="XP & Level">
                Jede abgeschlossene Quest gibt XP. Dein XP-Ertrag wird von vielen Faktoren beeinflusst: Forge-Temperatur, Stats (Kraft), Gear, Companion-Bond, Streaks und aktive Buffs.
                <p className="mt-1">Max-Level: 30. Bei jedem Level-Up erhältst du <span style={{ color: "#818cf8" }}>5 + Level Stardust</span>.</p>
              </GuideSection>
              <GuideSection title="Forge Temperature">
                Deine Forge-Temperatur (0-100%) zeigt wie aktiv du bist und beeinflusst XP und Gold:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#e0f0ff" }}>100% (White-hot)</span>: ×1.5 XP, ×1.5 Gold</li>
                  <li>• <span style={{ color: "#f97316" }}>80%+ (Blazing)</span>: ×1.25 XP, ×1.3 Gold</li>
                  <li>• <span style={{ color: "#ea580c" }}>60%+ (Burning)</span>: ×1.15 XP, ×1.15 Gold</li>
                  <li>• <span style={{ color: "#b45309" }}>40%+ (Warming)</span>: ×1.0 XP</li>
                  <li>• <span style={{ color: "#78716c" }}>20%+ (Smoldering)</span>: <span style={{ color: "#ef4444" }}>×0.8 XP</span></li>
                  <li>• <span style={{ color: "#4b5563" }}>&lt;20% (Cold)</span>: <span style={{ color: "#ef4444" }}>×0.5 XP</span></li>
                </ul>
                <p className="mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Die Temperatur verfällt mit 2%/Stunde (Ausdauer-Stat verlangsamt das). Jede Quest gibt +10 zurück.</p>
              </GuideSection>
              <GuideSection title="Streaks & Gold">
                Erledige jeden Tag mindestens eine Quest oder ein Ritual um deinen Streak zu halten.
                <ul className="space-y-1 mt-1">
                  <li>• Gold-Multiplikator: bis zu <strong>+45%</strong> bei 30+ Tagen Streak</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Streak-Schutz</span>: Streak-Shields (aus Shop, Crafting oder Legendary-Gear) verhindern den Streak-Reset</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Auto-Recovery</span>: Vitalität-Stat + passive Items geben bis zu 75% Chance den Streak automatisch zu retten</li>
                </ul>
              </GuideSection>
              <GuideSection title="Currencies (7)">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#f59e0b" }}>Gold</span> — Hauptwährung. Quests, Rituale, NPC-Aufträge. Für Bazaar, Crafting und Gacha.</li>
                  <li><span style={{ color: "#818cf8" }}>Stardust</span> — Featured-Banner-Pulls, Level-Ups.</li>
                  <li><span style={{ color: "#ef4444" }}>Essenz</span> — Crafting, Berufs-Wechsel, Zerlegung von Items.</li>
                  <li><span style={{ color: "#a78bfa" }}>Runensplitter</span> — Standard-Banner-Pulls, Quest-Rewards, Duplikat-Refund.</li>
                  <li><span style={{ color: "#10b981" }}>Gildentaler</span> — Social- und Coop-Quests (+5 pro Quest).</li>
                  <li><span style={{ color: "#c084fc" }}>Mondstaub</span> — Seltene Events und Achievements.</li>
                  <li><span style={{ color: "#fbbf24" }}>Sternentaler</span> — Exklusiv aus Weekly Challenges.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Daily Login Bonus">
                Einmal pro Tag abholen: <strong>3 Essenz + 2 Runensplitter</strong>. Bei längeren Streaks gibt es Bonus-Essenz und Runensplitter (7d: +1/+1, 14d: +2/+2, 30d+: +3/+5).
              </GuideSection>
              <GuideSection title="The Bazaar (Shop)">
                Im Bazaar gibt es zwei Kategorien:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Self-Care Rewards</span> — Echte Belohnungen für Gold: Gaming-Zeit, Movie Night, Spa-Tag, Hobby-Zeit, etc.</li>
                  <li>• <span style={{ color: "#a855f7" }}>Boosts</span> — Gameplay-Buffs: XP-Schriftrollen (+10% für 5 Quests), Streak-Shields, Luck Coins, Stardust-Phiolen, Essenz-Kristalle.</li>
                </ul>
              </GuideSection>
              <GuideSection title="Season (Saisonales Event)">
                Jeden Monat gibt es ein neues <strong>Saison-Thema</strong> mit besonderen Boni. Das aktuelle Saison-Thema wird im <strong>Season</strong>-Tab (The Pinnacle) angezeigt und beeinflusst bestimmte Quest-Typen mit Bonus-Modifiern.
              </GuideSection>
            </>
          )}
          {tab === "honors" && (
            <>
              <GuideSection title="Hall of Honors">
                Im Honors-Tab findest du alle <strong>55+ Achievements</strong>. Sie werden automatisch freigeschaltet wenn du Meilensteine erreichst.
              </GuideSection>
              <GuideSection title="Achievement Points">
                Jedes Achievement gibt Punkte basierend auf Seltenheit:
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#9ca3af" }}>Common</span> — 5 Punkte</li>
                  <li><span style={{ color: "#22c55e" }}>Uncommon</span> — 10 Punkte</li>
                  <li><span style={{ color: "#3b82f6" }}>Rare</span> — 25 Punkte</li>
                  <li><span style={{ color: "#a855f7" }}>Epic</span> — 50 Punkte</li>
                  <li><span style={{ color: "#FFD700" }}>Legendary</span> — 100 Punkte</li>
                </ul>
              </GuideSection>
              <GuideSection title="Categories">
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#f0f0f0" }}>Quest-Meilensteine</span> — Erste Quest, 10, 50, 100, 200, 500 Quests</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Streak</span> — 7, 14, 30, 90 Tage</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Quest-Typen</span> — Spezialisierungen (Dev, Learning, Fitness, Social, Boss)</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Speed & Zeit</span> — Nachteulen, Frühaufsteher, Speed-Runs</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Coop & Ketten</span> — Gemeinsame Quests, Quest-Ketten, Kampagnen</li>
                  <li>• <span style={{ color: "#f0f0f0" }}>Versteckte</span> — Easter Eggs und geheime Achievements</li>
                </ul>
              </GuideSection>
              <GuideSection title="Point Milestones (Frames & Titles)">
                Gesammelte Punkte schalten kosmetische <strong>Portrait-Rahmen</strong> und <strong>Titel</strong> frei:
                <ul className="space-y-1 mt-1">
                  <li>• <span style={{ color: "#cd7f32" }}>50 Pkt</span> — Bronzener Rahmen</li>
                  <li>• <span style={{ color: "#c0c0c0" }}>200 Pkt</span> — Silberner Rahmen</li>
                  <li>• <span style={{ color: "#ffd700" }}>350 Pkt</span> — Goldener Rahmen</li>
                  <li>• <span style={{ color: "#a78bfa" }}>750 Pkt</span> — Arkaner Rahmen</li>
                  <li>• <span style={{ color: "#ff8c00" }}>1000 Pkt</span> — Legendärer Rahmen (mit Glow)</li>
                  <li>• <span style={{ color: "#00bfff" }}>2000 Pkt</span> — Himmlischer Rahmen (mit Glow)</li>
                </ul>
              </GuideSection>
              <GuideSection title="Proving Grounds (Leaderboard)">
                Im Proving Grounds siehst du die Rangliste aller Spieler, sortiert nach XP. Zeigt Level, Quests, Klasse und ausgerüsteten Titel. Top 3 bekommen Podium-Plätze mit Gold/Silber/Bronze-Medaillen.
              </GuideSection>
              <GuideSection title="Forge Companions">
                Spezielle Achievements schalten <strong>Forge-Begleiter</strong> frei, die +2% XP-Bonus geben: <span style={{ color: "#f97316" }}>Ember Sprite</span> (10 Dev-Quests), <span style={{ color: "#a78bfa" }}>Lore Owl</span> (5 Learning-Quests) und <span style={{ color: "#9ca3af" }}>Gear Golem</span> (300 XP). Bis zu +6% XP-Bonus insgesamt.
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
    desc: "Ziehe Items mit Runensplittern oder Stardust — Ausrüstung, Tränke und seltene Artefakte. Pity-System garantiert seltene Drops!",
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
    desc: "Quests geben XP und Gold. Runensplitter und Stardust fürs Gacha, Essenz und Materialien fürs Crafting.",
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
