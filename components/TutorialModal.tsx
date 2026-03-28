"use client";

import { useState, useEffect } from "react";
import { useModalBehavior } from "./ModalPortal";

// ─── GuideSection (section card with optional icon) ─────────────────────────

export function GuideSection({ title, icon, children, accent }: { title: string; icon?: string; children: React.ReactNode; accent?: string }) {
  const borderColor = accent || "rgba(255,255,255,0.06)";
  return (
    <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${borderColor}`, borderLeft: `3px solid ${borderColor}` }}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-base flex-shrink-0">{icon}</span>}
        <p className="font-bold text-[13px] tracking-wide" style={{ color: accent || "#f0f0f0" }}>{title}</p>
      </div>
      <div style={{ color: "rgba(255,255,255,0.6)" }}>{children}</div>
    </div>
  );
}

/** tip box — yellow border, italic text */
function GuideTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2 mt-2 flex items-start gap-2" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
      <span className="text-xs flex-shrink-0" style={{ color: "#fbbf24" }}>●</span>
      <p className="text-xs italic" style={{ color: "rgba(251,191,36,0.8)" }}>{children}</p>
    </div>
  );
}

/** rarity-colored inline label */
function Rarity({ r, children }: { r: string; children: React.ReactNode }) {
  const colors: Record<string, string> = { common: "#9ca3af", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f97316", unique: "#e6cc80" };
  return <span style={{ color: colors[r] || "#f0f0f0", fontWeight: 600 }}>{children}</span>;
}

/** Stat label with color */
function Stat({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ color, fontWeight: 600 }}>{children}</span>;
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
              <GuideSection title="Registrierung" icon="▣" accent="rgba(255,140,68,0.4)">
                Klicke auf <strong>Login → Register</strong> in der Kopfleiste. Der Charakter-Creator führt dich in 6 Schritten:
                <ol className="space-y-1.5 mt-2 ml-3" style={{ listStyleType: "decimal" }}>
                  <li><Stat color="#f0f0f0">Name &amp; Passwort</Stat> — Wähle deinen Heldennamen (min. 6 Zeichen Passwort).</li>
                  <li><Stat color="#f0f0f0">Über dich</Stat> — Optional: Alter, Pronomen, persönliche Ziele.</li>
                  <li><Stat color="#a78bfa">Klasse wählen</Stat> — Dein Berufspfad. Bestimmt Klassen-Quests und Tier-Stufen.</li>
                  <li><Stat color="#ec4899">Beziehungsstatus</Stat> — Optional: Partner-Name schaltet Coop-Quests frei.</li>
                  <li><Stat color="#f97316">Begleiter</Stat> — Haustier oder virtueller Companion (Pflicht).</li>
                  <li><Stat color="#22c55e">Zusammenfassung</Stat> — Prüfe alles und starte dein Abenteuer.</li>
                </ol>
              </GuideSection>

              <GuideSection title="Die 5 Stockwerke von Urithiru" icon="◆" accent="rgba(251,191,36,0.3)">
                Die Quest Hall ist wie der Turm Urithiru in Stockwerke gegliedert:
                <div className="grid gap-1.5 mt-2">
                  <div className="rounded-lg px-2.5 py-1.5 flex items-center gap-2" style={{ background: "rgba(251,191,36,0.06)" }}>
                    <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: 12, width: 14, textAlign: "center" }}>▲</span>
                    <div><Stat color="#fbbf24">The Pinnacle</Stat> — Observatory, Proving Grounds, Hall of Honors, Season</div>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5 flex items-center gap-2" style={{ background: "rgba(249,115,22,0.06)" }}>
                    <span style={{ color: "#f97316", fontWeight: 800, fontSize: 12, width: 14, textAlign: "center" }}>●</span>
                    <div><Stat color="#f97316">The Great Halls</Stat> — Quest Board, Wanderer&apos;s Rest, Challenges, The Rift</div>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5 flex items-center gap-2" style={{ background: "rgba(168,85,247,0.06)" }}>
                    <span style={{ color: "#a855f7", fontWeight: 800, fontSize: 12, width: 14, textAlign: "center" }}>■</span>
                    <div><Stat color="#a855f7">The Trading District</Stat> — Bazaar, Artisan&apos;s Quarter, Vault of Fate</div>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5 flex items-center gap-2" style={{ background: "rgba(59,130,246,0.06)" }}>
                    <span style={{ color: "#3b82f6", fontWeight: 800, fontSize: 12, width: 14, textAlign: "center" }}>✦</span>
                    <div><Stat color="#3b82f6">The Inner Sanctum</Stat> — Character, Arcanum, Ritual Chamber, Vow Shrine</div>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5 flex items-center gap-2" style={{ background: "rgba(236,72,153,0.06)" }}>
                    <span style={{ color: "#ec4899", fontWeight: 800, fontSize: 12, width: 14, textAlign: "center" }}>⬡</span>
                    <div><Stat color="#ec4899">The Breakaway</Stat> — Freunde, Nachrichten, Handel, The Hearth</div>
                  </div>
                </div>
              </GuideSection>

              <GuideSection title="Klassen" icon="⚔️" accent="rgba(167,139,250,0.3)">
                Klassen definieren deinen Berufspfad und schalten passende Quests frei.
                <ul className="space-y-1 mt-2">
                  <li>• Wähle eine <Stat color="#a78bfa">aktive Klasse</Stat> aus der Liste — sofort verfügbar.</li>
                  <li>• Keine passende? <Stat color="#f59e0b">Eigene Klasse einreichen</Stat> — ein Admin schmiedet sie.</li>
                  <li>• Klassen haben <Stat color="#c4b5fd">Tier-Stufen</Stat> die mit XP automatisch aufsteigen.</li>
                </ul>
              </GuideSection>

              <GuideSection title="Begleiter (Companions)" icon="🐾" accent="rgba(249,115,22,0.3)">
                Dein Begleiter erscheint auf deiner Spielerkarte, gibt dir Quests und motiviert dich:
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <div className="rounded-lg px-2 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>● <Stat color="#f0f0f0">Echtes Haustier</Stat> — Pflege-Quests</div>
                  <div className="rounded-lg px-2 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>● <Stat color="#f97316">Drache</Stat> — Fordernd</div>
                  <div className="rounded-lg px-2 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>● <Stat color="#a78bfa">Eule</Stat> — Weise</div>
                  <div className="rounded-lg px-2 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>🔥 <Stat color="#ef4444">Phoenix</Stat> — Resilient</div>
                  <div className="rounded-lg px-2 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>● <Stat color="#6b7280">Wolf</Stat> — Loyal</div>
                  <div className="rounded-lg px-2 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>● <Stat color="#f59e0b">Fuchs</Stat> — Clever</div>
                </div>
                <GuideTip>Ab Bond Lv. 5 schaltest du Ultimate-Fähigkeiten frei: Sofort-Abschluss, 2× Loot oder +3 Streak-Tage (7d Cooldown).</GuideTip>
              </GuideSection>
            </>
          )}
          {tab === "quests" && (
            <>
              <GuideSection title="Quest Board (The Great Hall)" icon="▣" accent="rgba(249,115,22,0.4)">
                Dein Auftragsboard. Drei Bereiche:
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#22c55e">Aufträge</Stat> — Offene Quests zum Annehmen (~10 im täglichen Pool).</li>
                  <li>• <Stat color="#f59e0b">In Bearbeitung</Stat> — Deine aktiven Quests (max ~25).</li>
                  <li>• <Stat color="#9ca3af">Abgeschlossen</Stat> — Erledigte Quests (24h sichtbar).</li>
                </ul>
                <GuideTip>Klicke das Scroll-Icon um deinen Quest-Pool manuell aufzufüllen (6h Cooldown). Automatische Auffüllung um Mitternacht.</GuideTip>
              </GuideSection>

              <GuideSection title="Quest-Typen" icon="◆">
                <div className="grid grid-cols-2 gap-1 mt-2">
                  <div className="rounded px-2 py-1" style={{ background: "rgba(34,197,94,0.06)" }}><Stat color="#22c55e">Personal</Stat> — Alltag, Haushalt</div>
                  <div className="rounded px-2 py-1" style={{ background: "rgba(59,130,246,0.06)" }}><Stat color="#3b82f6">Learning</Stat> — Lernen, Lesen</div>
                  <div className="rounded px-2 py-1" style={{ background: "rgba(249,115,22,0.06)" }}><Stat color="#f97316">Fitness</Stat> — Sport, Gesundheit</div>
                  <div className="rounded px-2 py-1" style={{ background: "rgba(236,72,153,0.06)" }}><Stat color="#ec4899">Social</Stat> — Freunde (+5 Gildentaler)</div>
                  <div className="rounded px-2 py-1" style={{ background: "rgba(244,63,94,0.06)" }}><Stat color="#f43f5e">Coop</Stat> — Zu zweit (+5 Gildentaler)</div>
                  <div className="rounded px-2 py-1" style={{ background: "rgba(249,115,22,0.06)" }}><Stat color="#f59e0b">Boss</Stat> — Schwer, garantierter Loot</div>
                </div>
              </GuideSection>

              <GuideSection title="Seltenheit & Belohnungen" icon="✨" accent="rgba(168,85,247,0.3)">
                Quests haben eine Seltenheitsstufe die Belohnungen bestimmt:
                <div className="mt-2 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 text-center text-xs font-bold py-1" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}>
                    <span>Rarity</span><span>XP</span><span>Gold</span><span>Runen</span>
                  </div>
                  {([["common","Common","10","5-10","1"],["uncommon","Uncommon","18","10-18","1"],["rare","Rare","30","18-30","2"],["epic","Epic","50","30-50","3"],["legendary","Legendary","80","50-80","5"]] as const).map(([r,name,xp,gold,rune]) => (
                    <div key={r} className="grid grid-cols-2 sm:grid-cols-4 gap-0 text-center text-xs py-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <Rarity r={r}>{name}</Rarity><span>{xp}</span><span>{gold}</span><span>{rune}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>+ 25% Basis-Chance auf Loot-Drops und Crafting-Materialien bei jeder Quest.</p>
              </GuideSection>

              <GuideSection title="Quest-Mechaniken" icon="◆">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f43f5e">Coop-Quests</Stat> — Beide Partner müssen ihren Teil abschließen.</li>
                  <li>• <Stat color="#a78bfa">Quest-Ketten</Stat> — Sequenziell: nächste Quest erst nach Abschluss der vorherigen.</li>
                  <li>• <Stat color="#3b82f6">Wiederkehrend</Stat> — Manche Quests wiederholen sich täglich/wöchentlich.</li>
                </ul>
              </GuideSection>

              <GuideSection title="Hoarding-Malus" icon="▲" accent="rgba(239,68,68,0.3)">
                Zu viele aktive Quests? Ab <strong style={{ color: "#ef4444" }}>20 Quests</strong> sinkt dein XP-Ertrag:
                <ul className="space-y-0.5 mt-2">
                  <li>• 1-20 Quests: <Stat color="#22c55e">Kein Malus</Stat></li>
                  <li>• Ab 21: <Stat color="#ef4444">-10% XP pro Quest</Stat> über dem Limit</li>
                  <li>• Hard-Cap: <Stat color="#ef4444">-80% XP</Stat> (ab 28+ Quests)</li>
                </ul>
                <GuideTip>Schließe Quests ab oder gib sie zurück bevor du neue annimmst!</GuideTip>
              </GuideSection>

              <GuideSection title="Kampagnen & Arcanum" icon="◆">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#fbbf24">Observatory</Stat> (The Pinnacle) — Erstelle Kampagnen: zusammenhängende Quest-Ketten mit Story und Boss.</li>
                  <li>• <Stat color="#a78bfa">Arcanum</Stat> (Inner Sanctum) — Klassenquests, Feature-Roadmap, CV Builder.</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "npcs" && (
            <>
              <GuideSection title="Wanderer's Rest" icon="◆" accent="rgba(249,115,22,0.4)">
                Im Wanderer&apos;s Rest tauchen reisende NPCs auf — jeder mit eigenen Quest-Ketten und Persönlichkeit. Bis zu <strong>7 NPCs</strong> gleichzeitig aktiv.
              </GuideSection>

              <GuideSection title="So funktioniert es" icon="◆">
                <ul className="space-y-1.5 mt-2">
                  <li>• NPCs bleiben <Stat color="#f59e0b">2-4 Tage</Stat>, dann ziehen sie weiter.</li>
                  <li>• Jeder NPC hat <Stat color="#a78bfa">Quest-Ketten</Stat> — sequenziell abschließen.</li>
                  <li>• Letzte Quest einer Kette → <Stat color="#f97316">einzigartiges Item</Stat>.</li>
                  <li>• Abreise = laufende Quests <Stat color="#ef4444">gescheitert</Stat>.</li>
                  <li>• Nach Abreise: <Stat color="#9ca3af">Cooldown</Stat> (meist 48h) bevor Rückkehr möglich.</li>
                </ul>
              </GuideSection>

              <GuideSection title="NPC-Seltenheiten" icon="⭐">
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-2"><Rarity r="common">Common</Rarity> <span style={{ color: "rgba(255,255,255,0.4)" }}>— 2-3 Ketten, einfach, gemütlich</span></div>
                  <div className="flex items-center gap-2"><Rarity r="rare">Rare</Rarity> <span style={{ color: "rgba(255,255,255,0.4)" }}>— 3 Ketten, 6-8 Quests, anspruchsvoll</span></div>
                  <div className="flex items-center gap-2"><Rarity r="epic">Epic</Rarity> <span style={{ color: "rgba(255,255,255,0.4)" }}>— 3 Ketten, 8-10 Quests, starke Belohnungen</span></div>
                  <div className="flex items-center gap-2"><Rarity r="legendary">Legendary</Rarity> <span style={{ color: "rgba(255,255,255,0.4)" }}>— 3 Ketten, 10-12 Quests, epische Story + Legendary Items</span></div>
                </div>
                <GuideTip>Schließe NPC-Quests ab bevor der NPC aufbricht! Die verbleibende Zeit steht am NPC-Portrait.</GuideTip>
              </GuideSection>
            </>
          )}
          {tab === "character" && (
            <>
              <GuideSection title="Character Screen" icon="◆" accent="rgba(59,130,246,0.4)">
                Dein Inventar, Ausrüstung, Stats und Begleiter auf einen Blick. Erreichbar über <Stat color="#3b82f6">Character</Stat> im Inner Sanctum (nur eingeloggt).
              </GuideSection>

              <GuideSection title="Ausrüstung (7 Slots)" icon="⚔️">
                Rüste Items aus dem Inventar aus. Stats werden beim Drop zufällig gewürfelt:
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-2 text-center text-xs">
                  {(["Helm", "Weapon", "Shield", "Armor", "Amulet", "Ring", "Boots"] as const).map(s => (
                    <div key={s} className="rounded px-1 py-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>{s}</div>
                  ))}
                </div>
              </GuideSection>

              <GuideSection title="Stats & Effekte" icon="◆" accent="rgba(168,85,247,0.3)">
                <p className="mb-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>PRIMARY STATS</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><Stat color="#ef4444">Kraft</Stat> <span>+0.5% XP/Punkt (max +30%)</span></div>
                  <div className="flex justify-between"><Stat color="#3b82f6">Ausdauer</Stat> <span>-0.5% Forge-Decay/Punkt</span></div>
                  <div className="flex justify-between"><Stat color="#f59e0b">Weisheit</Stat> <span>+0.5% Gold/Punkt (max +30%)</span></div>
                  <div className="flex justify-between"><Stat color="#22c55e">Glück</Stat> <span>+0.5% Loot-Chance/Punkt (max 20%)</span></div>
                </div>
                <p className="mt-2 mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>MINOR STATS</p>
                <div className="space-y-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                  <div className="flex justify-between"><Stat color="#9ca3af">Fokus</Stat> <span>+1 Flat-XP/Quest (max +50)</span></div>
                  <div className="flex justify-between"><Stat color="#9ca3af">Vitalität</Stat> <span>+1% Streak-Schutz/Punkt</span></div>
                  <div className="flex justify-between"><Stat color="#9ca3af">Charisma</Stat> <span>+5% Companion Bond-XP</span></div>
                  <div className="flex justify-between"><Stat color="#9ca3af">Tempo</Stat> <span>+1% Forge-Temp-Recovery</span></div>
                </div>
              </GuideSection>

              <GuideSection title="Set-Boni & Legendary Effects" icon="◇" accent="rgba(255,215,0,0.3)">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f0f0f0">Tier-Set</Stat>: 3/6 Teile = +5%, 6/6 = +10% Primary Stats</li>
                  <li>• <Rarity r="legendary">Legendary Effects</Rarity> (15 Typen):</li>
                </ul>
                <div className="grid grid-cols-2 gap-1 mt-1 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <span>XP-Bonus · Gold-Bonus</span>
                  <span>Nacht-Gold ×2 (23-05h)</span>
                  <span>Jede-5.-Quest-Bonus</span>
                  <span>Auto-Streak-Schutz</span>
                  <span>Material-Verdopplung</span>
                  <span>Varianten-Bonus</span>
                </div>
              </GuideSection>

              <GuideSection title="Companion & Bond-System" icon="🐾" accent="rgba(236,72,153,0.3)">
                Bond-Level 1-10. Höherer Bond = mehr Boni:
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f0f0f0">Streicheln</Stat> — 2×/Tag, +0.5 Bond-XP</li>
                  <li>• <Stat color="#f0f0f0">Companion-Quests</Stat> — Begleiter-Quests für Bond-XP</li>
                  <li>• Ab <Stat color="#ec4899">Bond Lv. 5</Stat> → <strong>Ultimates</strong> (7d Cooldown):</li>
                </ul>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1.5 text-center text-xs">
                  <div className="rounded px-1 py-1.5" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>◆ Sofort-Abschluss</div>
                  <div className="rounded px-1 py-1.5" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>✨ 2× Loot</div>
                  <div className="rounded px-1 py-1.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>🔥 +3 Streak-Tage</div>
                </div>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Stranger → Acquaintance → Friend → Close Friend → Best Friend → Soulmate → Legendary I-IV</p>
              </GuideSection>

              <GuideSection title="Inventar & Titel" icon="◆">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#22c55e">Ausrüsten</Stat> — Gear in Slots anlegen</li>
                  <li>• <Stat color="#3b82f6">Benutzen</Stat> — Tränke, Streak-Shields, XP-Boosts</li>
                  <li>• <Stat color="#f59e0b">Zerlegen</Stat> — Im Artisan&apos;s Quarter → Essenz + Materialien</li>
                  <li>• <Stat color="#ef4444">Wegwerfen</Stat> — Items dauerhaft entfernen</li>
                </ul>
                <GuideTip>Passive Items (Glücksklee etc.) wirken automatisch solange sie im Inventar sind. Titel werden durch Meilensteine freigeschaltet und auf Spielerkarte + Leaderboard angezeigt.</GuideTip>
              </GuideSection>

              <GuideSection title="Gems & Sockets" icon="◆" accent="rgba(168,85,247,0.3)">
                <ul className="space-y-1 mt-2">
                  <li>• 6 Gem-Typen: Ruby (Kraft), Sapphire (Weisheit), Emerald (Glück), Topaz (Ausdauer), Amethyst (Vitalität), Diamond (Fokus)</li>
                  <li>• 5 Tiers: Chipped → Flawed → Perfect → Flawless → Royal</li>
                  <li>• Sockel abhängig von Item-Rarität (0 bei Common, bis 3 bei Legendary)</li>
                  <li>• Gems upgraden: 3 gleiche → nächste Stufe</li>
                </ul>
              </GuideSection>

              <GuideSection title="Item Binding & Lock" icon="⛓" accent="rgba(239,68,68,0.3)">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#22c55e">BoE (Bind on Equip)</Stat> — Frei handelbar bis zum Anlegen. Crafted + Shop Items.</li>
                  <li>• <Stat color="#f97316">BoP (Bind on Pickup)</Stat> — Sofort gebunden. Dungeon, Rift, WB, Unique Drops.</li>
                  <li>• <Stat color="#fbbf24">Item Lock</Stat> — Sperre Items gegen versehentliches Salvage/Trade/Discard. Goldenes ⦿ Symbol.</li>
                </ul>
              </GuideSection>

              <GuideSection title="Ätherwürfel" icon="⬡" accent="rgba(249,115,22,0.3)">
                Opfere Legendary Items um ihre Effekte dauerhaft zu extrahieren. Im Artisan&apos;s Quarter.
                <ul className="space-y-1 mt-2">
                  <li>• 3 Slots: <Stat color="#ef4444">Offensive</Stat>, <Stat color="#3b82f6">Defensive</Stat>, <Stat color="#22c55e">Utility</Stat></li>
                  <li>• Kosten: 500 Essenz pro Extraktion</li>
                  <li>• Effekte stacken additiv mit Gear-Effekten</li>
                </ul>
              </GuideSection>

              <GuideSection title="Hero Numbers & Roll Quality" icon="◆" accent="rgba(129,140,248,0.3)">
                Im Stats-Tab siehst du drei abgeleitete Kampfwerte:
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#ef4444">Offense</Stat> — Kraft + Gear Score + Fokus</li>
                  <li>• <Stat color="#3b82f6">Defense</Stat> — Ausdauer + Vitalität + Gear Score</li>
                  <li>• <Stat color="#22c55e">Utility</Stat> — Weisheit + Glück + Charisma + Tempo</li>
                  <li>• <Stat color="#eab308">Roll Quality</Stat> — zeigt ob ein Item gute Stat-Rolls hat (Perfect 90%+, Good 70%+, Average 50%+, Low &lt;50%)</li>
                  <li>• Klicke auf einen Stat → zeigt dir woher jeder Punkt kommt (Gear, Gems, Set Boni)</li>
                  <li>• <Stat color="#60a5fa">Compare Mode</Stat> — pinne ein Item und vergleiche alle anderen dagegen</li>
                </ul>
              </GuideSection>

              <GuideSection title="Companion Fähigkeiten" icon="◆" accent="rgba(245,158,11,0.3)">
                <ul className="space-y-1 mt-2">
                  <li>• Ab <Stat color="#f59e0b">Bond Level 5</Stat>: Ultimate Ability freigeschaltet</li>
                  <li>• <Stat color="#f0f0f0">Instant Complete</Stat> — Schließt nächste Quest sofort ab</li>
                  <li>• <Stat color="#f0f0f0">Double Reward</Stat> — 2x XP + Gold auf nächste Quest</li>
                  <li>• <Stat color="#f0f0f0">Streak Extend</Stat> — +3 Tage auf deinen Streak</li>
                  <li>• <Stat color="#22c55e">Expeditionen</Stat> — Schicke deinen Companion auf 4-24h Missionen für passive Rewards (Gold, Mats, Gems)</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "gacha" && (
            <>
              <GuideSection title="Vault of Fate" icon="◇" accent="rgba(167,139,250,0.4)">
                Ziehe Items — Ausrüstung, Tränke und seltene Artefakte. Zwei Banner:
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="rounded-lg p-2 text-center" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                    <p className="font-bold text-xs" style={{ color: "#a78bfa" }}>Wheel of Stars</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Standard · Runensplitter</p>
                    <p className="text-xs mt-0.5">10/Pull · 90/10×</p>
                  </div>
                  <div className="rounded-lg p-2 text-center" style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.2)" }}>
                    <p className="font-bold text-xs" style={{ color: "#818cf8" }}>Astral Radiance</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Featured · Stardust</p>
                    <p className="text-xs mt-0.5">10/Pull · 90/10×</p>
                  </div>
                </div>
              </GuideSection>

              <GuideSection title="Drop Rates" icon="◆">
                <div className="mt-2 space-y-0.5">
                  {([["legendary","Legendary","0.8%","#f97316"],["epic","Epic","3%","#a855f7"],["rare","Rare","25%","#3b82f6"],["uncommon","Uncommon","45%","#22c55e"],["common","Common","~26%","#9ca3af"]] as const).map(([,name,rate,color]) => (
                    <div key={name} className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full" style={{ background: color, width: name === "Legendary" ? "8%" : name === "Epic" ? "26%" : name === "Rare" ? "70%" : name === "Uncommon" ? "80%" : "22%", minWidth: 6 }} />
                      <span className="flex-shrink-0 w-20" style={{ color, fontWeight: 600 }}>{name}</span>
                      <span className="font-mono text-xs">{rate}</span>
                    </div>
                  ))}
                </div>
              </GuideSection>

              <GuideSection title="Pity-System" icon="◆" accent="rgba(251,191,36,0.3)">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f59e0b">Soft Pity</Stat> ab Pull 55 → Legendary-Chance steigt +2.5%/Pull</li>
                  <li>• <Stat color="#ef4444">Hard Pity</Stat> bei Pull 75 → <strong>Garantiertes Legendary</strong></li>
                  <li>• <Stat color="#a855f7">Epic Pity</Stat> → Alle 10 Pulls mindestens Epic</li>
                </ul>
              </GuideSection>

              <GuideSection title="50/50 & Duplikate" icon="◆">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#818cf8">Featured Banner</Stat>: 50% auf Featured-Item. Verloren? Nächstes Legendary = garantiert Featured.</li>
                  <li>• <Stat color="#a78bfa">Duplikate</Stat> → Runensplitter-Refund: Common 1, Uncommon 3, Rare 8, Epic 20, Legendary 50.</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "crafting" && (
            <>
              <GuideSection title="Artisan's Quarter" icon="▪" accent="rgba(168,85,247,0.4)">
                Crafting-Hub im Trading District mit 8 Berufen — wähle 2 (nur eingeloggt):
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <div className="rounded-lg p-2" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <p className="font-bold text-xs" style={{ color: "#f59e0b" }}>▪ Grimvar (Schmied)</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Heavy Armor</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
                    <p className="font-bold text-xs" style={{ color: "#a855f7" }}>▪ Selina (Schneider)</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Cloth Armor</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.15)" }}>
                    <p className="font-bold text-xs" style={{ color: "#b45309" }}>▪ Roderic (Lederverarbeiter)</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Leather Armor</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}>
                    <p className="font-bold text-xs" style={{ color: "#dc2626" }}>▪ Varn (Waffenschmied)</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Weapons + Shields</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.15)" }}>
                    <p className="font-bold text-xs" style={{ color: "#ec4899" }}>◈ Mirael (Juwelier)</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Rings + Amulets + Gems</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <p className="font-bold text-xs" style={{ color: "#22c55e" }}>◈ Ysolde (Alchemist)</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Potions + Transmutes</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "rgba(232,123,53,0.06)", border: "1px solid rgba(232,123,53,0.15)" }}>
                    <p className="font-bold text-xs" style={{ color: "#e87b35" }}>● Bruna (Koch)</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Meals + Feasts</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                    <p className="font-bold text-xs" style={{ color: "#6366f1" }}>✨ Eldric (Verzauberer)</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Enchants + Scrolls</p>
                  </div>
                </div>
              </GuideSection>

              <GuideSection title="Berufs-Slots & Ränge" icon="▲">
                <ul className="space-y-1 mt-2">
                  <li>• <strong>2 Berufs-Slots</strong> — immer verfügbar, kostenlos wechselbar</li>
                  <li>• 300 Max Skill. 4 Ränge: <Stat color="#22c55e">Apprentice</Stat> (75) → <Stat color="#3b82f6">Journeyman</Stat> (150) → <Stat color="#a855f7">Expert</Stat> (225) → <Stat color="#f59e0b">Artisan</Stat> (300)</li>
                  <li>• <Stat color="#ef4444">Wechsel</Stat>: Kostenlos — aber Skill + Rezepte gehen verloren</li>
                  <li>• <Stat color="#facc15">Daily Bonus</Stat>: Erstes Crafting/Tag = 2× Berufs-XP</li>
                </ul>
              </GuideSection>

              <GuideSection title="Skill-Up Farben" icon="◆">
                <div className="flex gap-3 mt-2 flex-wrap">
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f97316" }} /> <span>garantiert</span></div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#eab308" }} /> <span>wahrscheinlich</span></div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#22c55e" }} /> <span>selten</span></div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#6b7280" }} /> <span>unmöglich</span></div>
                </div>
              </GuideSection>

              <GuideSection title="Schmiedekunst & Transmutation" icon="◈" accent="rgba(245,158,11,0.3)">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f59e0b">Salvage</Stat> — Items zerlegen → Essenz + Materialien. &quot;Salvage All&quot; per Seltenheit. Legendary nur einzeln.</li>
                  <li>• <Stat color="#a78bfa">Transmute</Stat> — 3 Epic-Items (gleicher Slot) + 500g → 1 Legendary (Slot-gesperrt).</li>
                </ul>
              </GuideSection>

              <GuideSection title="Materialien & Rezepte" icon="◆">
                5 Seltenheitsstufen: <Rarity r="common">Common</Rarity> bis <Rarity r="legendary">Legendary</Rarity>. Quellen: Quest-Drops + Zerlegung.
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f59e0b">Affinity-System</Stat> — Materialien droppen NUR wenn du einen Beruf gewählt hast</li>
                  <li>• <Stat color="#f0f0f0">Trainer-Rezepte</Stat> — Beim NPC kaufen (Gold). Basis gratis.</li>
                  <li>• <Stat color="#a78bfa">Drop-Rezepte</Stat> — Seltene Quest-Drops, abhängig von Quest-Seltenheit.</li>
                  <li>• <Stat color="#3b82f6">Faction-Rezepte</Stat> — Freigeschaltet durch Fraktions-Reputation.</li>
                  <li>• <Stat color="#ef4444">Dungeon-Rezepte</Stat> — Seltene Drops aus The Undercroft.</li>
                </ul>
              </GuideSection>

              <GuideSection title="Upgrades & Mastery" icon="◆" accent="rgba(251,191,36,0.3)">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f0f0f0">Workshop Tools</Stat>: <Stat color="#9ca3af">Sturdy +2%</Stat> → <Stat color="#3b82f6">Masterwork +4%</Stat> → <Rarity r="legendary">Legendary +7%</Rarity> → <Stat color="#a855f7">Mythic +10%</Stat> permanenter XP-Bonus</li>
                  <li>• <Stat color="#facc15">Gathering</Stat>: Nur für gewählte Berufe — Affinity-Materialien droppen bei Quests</li>
                  <li>• <Stat color="#facc15">Mastery (Skill 225+)</Stat>: +10% Stat-Rolls beim Craften</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "rituals" && (
            <>
              <GuideSection title="Tägliche Rituale" icon="◆" accent="rgba(168,85,247,0.4)">
                Wiederkehrende Aufgaben die Streaks aufbauen. Erreichbar über <Stat color="#a855f7">Ritual Chamber</Stat> im Inner Sanctum.
                <ul className="space-y-1 mt-2">
                  <li>• Erstelle Rituale mit Name, Schwierigkeit und optionaler Beschreibung.</li>
                  <li>• <Stat color="#ef4444">Verpasste Tage</Stat>: 1 Tag = -3 Streak, 2 Tage = -7, 3+ = Reset auf 0!</li>
                </ul>
              </GuideSection>

              <GuideSection title="Streak-Badges" icon="🔥" accent="rgba(249,115,22,0.3)">
                <div className="grid grid-cols-2 gap-1 mt-2">
                  <div className="rounded px-2 py-0.5"><Stat color="#cd7f32">Bronze</Stat> <span style={{ color: "rgba(255,255,255,0.3)" }}>7d · +5% XP</span></div>
                  <div className="rounded px-2 py-0.5"><Stat color="#c0c0c0">Silber</Stat> <span style={{ color: "rgba(255,255,255,0.3)" }}>21d · +10% XP</span></div>
                  <div className="rounded px-2 py-0.5"><Stat color="#f59e0b">Gold</Stat> <span style={{ color: "rgba(255,255,255,0.3)" }}>60d · +15% XP</span></div>
                  <div className="rounded px-2 py-0.5"><Stat color="#67e8f9">Diamond</Stat> <span style={{ color: "rgba(255,255,255,0.3)" }}>180d · +25% XP</span></div>
                  <div className="rounded px-2 py-0.5"><Stat color="#6b7280">Titan</Stat> <span style={{ color: "rgba(255,255,255,0.3)" }}>90d · Epic Loot</span></div>
                  <div className="rounded px-2 py-0.5"><Stat color="#a855f7">Legend</Stat> <span style={{ color: "rgba(255,255,255,0.3)" }}>365d · Leg. Loot</span></div>
                </div>
              </GuideSection>

              <GuideSection title="Aetherbond & Blood Pact" icon="◆">
                <Stat color="#f0f0f0">Aetherbond</Stat> — Commitment-Stufen für Bonus-Gold/XP:
                <div className="flex gap-1 mt-1 text-xs">
                  <Stat color="#9ca3af">Spark</Stat><span>→</span><Stat color="#22c55e">Flame</Stat><span>→</span><Stat color="#f59e0b">Ember</Stat><span>→</span><Stat color="#ef4444">Crucible</Stat><span>→</span><Stat color="#a855f7">Eternity</Stat>
                </div>
                <div className="mt-2">
                  <Stat color="#ef4444">Blood Pact</Stat> — Massiver Multiplikator (×3 bis ×30), aber Streak-Bruch = alles verloren!
                </div>
                <GuideTip>Blood Oaths können nicht verlängert werden. Payout nur wenn Streak ≥ Commitment-Tage.</GuideTip>
              </GuideSection>

              <GuideSection title="Vow Shrine (Gelübde)" icon="⚔️">
                Langfristige Versprechen, Dinge <strong>nicht</strong> zu tun. Jeder Tag ohne Verstoß = &quot;Clean Day&quot;. Verstoß = Reset.
              </GuideSection>
            </>
          )}
          {tab === "challenges" && (
            <>
              <GuideSection title="Wöchentliche Challenges" icon="⭐" accent="rgba(251,191,36,0.4)">
                Zwei wöchentliche Herausforderungen in den <Stat color="#f97316">Great Halls</Stat>. Reset jeden Montag.
              </GuideSection>

              <GuideSection title="Sternenpfad (Solo)" icon="⭐">
                Persönliche 3-stufige Challenge mit Sternbewertung:
                <ul className="space-y-1 mt-2">
                  <li>• <strong>3 Stufen</strong> mit aufsteigender Schwierigkeit</li>
                  <li>• Jede Stufe: <Stat color="#fbbf24">1-3 Sterne</Stat> (max 9 insgesamt)</li>
                  <li>• <Stat color="#22c55e">Speed Bonus</Stat>: Stufe in 2 Tagen = +1★</li>
                  <li>• Sterne-Scaling: 2★ = +15%, 3★ = +33% Belohnungen</li>
                </ul>
                <GuideTip>Weekly Modifier: Ein Quest-Typ gibt +50% Fortschritt, andere -25%. Passe deine Strategie an!</GuideTip>
              </GuideSection>

              <GuideSection title="Expedition (Kooperativ)" icon="▲" accent="rgba(34,197,94,0.3)">
                Gildenweite Herausforderung — alle Spieler arbeiten am gemeinsamen Fortschritt:
                <ul className="space-y-1 mt-2">
                  <li>• <strong>4 Checkpoints</strong> (3 regulär + 1 Bonus)</li>
                  <li>• Quests skalieren mit <Stat color="#f0f0f0">Spieleranzahl</Stat></li>
                  <li>• Kein Pro-Spieler-Limit — aktive kompensieren für inaktive</li>
                  <li>• <Stat color="#fbbf24">Bonus-Checkpoint</Stat>: Exklusiver rotierender Titel</li>
                </ul>
              </GuideSection>

              <GuideSection title="The Rift (Dungeons)" icon="◆" accent="rgba(168,85,247,0.4)">
                Zeitlich begrenzte Quest-Ketten mit eskalierender Schwierigkeit:
                <div className="mt-2 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 text-center text-xs font-bold py-1" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}>
                    <span>Tier</span><span>Stages</span><span>Zeit</span><span>Min Lv</span><span>Cooldown</span>
                  </div>
                  {([["Normal","3","72h","1","3d","#22c55e"],["Hard","5","48h","5","5d","#a855f7"],["Legendary","7","36h","10","7d","#f59e0b"]] as const).map(([name,stages,time,lv,cd,color]) => (
                    <div key={name} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 text-center text-xs py-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <Stat color={color}>{name}</Stat><span>{stages}</span><span>{time}</span><span>Lv{lv}</span><span>{cd}</span>
                    </div>
                  ))}
                </div>
                <ul className="space-y-1 mt-2">
                  <li>• Schwierigkeit steigt pro Stage (1×, 1.5×, 2×, 2.5×...)</li>
                  <li>• Vollständiger Abschluss gibt <Stat color="#fbbf24">Completion Bonus</Stat> (Gold, Essenz, Runensplitter)</li>
                  <li>• Abbruch/Timeout = Fail-Cooldown. Erfolg löscht den Cooldown.</li>
                </ul>
                <GuideTip>Rift-Stages geben volle Belohnungen: XP-Multiplikatoren, Loot-Drops, Materialien, Streak + Forge-Temp!</GuideTip>
              </GuideSection>

              <GuideSection title="Mythic+ Endless Rift" icon="☠" accent="rgba(255,68,68,0.3)">
                Nach dem ersten Legendary-Rift-Clear: unendlich skalierende Mythic+ Stufen.
                <ul className="space-y-1 mt-2">
                  <li>• Schwierigkeit steigt pro Level (+0.3× pro M+ Stufe)</li>
                  <li>• Ab <Stat color="#ff4444">M+2</Stat>: 2 wöchentlich rotierende <Stat color="#f97316">Affixe</Stat> (z.B. Tyrannisch, Nekrotisch, Rasend)</li>
                  <li>• Kein Fail-Cooldown — sofort erneut versuchen</li>
                  <li>• Leaderboard trackt deine höchste Stufe</li>
                </ul>
              </GuideSection>

              <GuideSection title="World Boss (Kolosseum)" icon="◆" accent="rgba(239,68,68,0.3)">
                Community-weite Bosskämpfe. Alle Spieler tragen per Quest-Completion zum Schaden bei.
                <ul className="space-y-1 mt-2">
                  <li>• 9 Bosse mit einzigartiger Lore und Unique Drops</li>
                  <li>• Contribution-Ranking: Bronze, Silver, Gold, Legendary</li>
                  <li>• Ab <Stat color="#22c55e">Level 15</Stat> verfügbar</li>
                </ul>
              </GuideSection>

              <GuideSection title="The Undercroft (Dungeons)" icon="◆" accent="rgba(99,102,241,0.3)">
                Kooperative Gruppen-Dungeons für 2-4 Spieler.
                <ul className="space-y-1 mt-2">
                  <li>• 3 Tiers: Sunken Archive (Lv10), Shattered Spire (Lv20), Hollow Core (Lv35)</li>
                  <li>• Gear Score bestimmt Erfolgswahrscheinlichkeit</li>
                  <li>• Einzigartiger Loot pro Dungeon (BoP-Items)</li>
                  <li>• 7-Tage Cooldown pro Dungeon</li>
                  <li>• Ab <Stat color="#22c55e">Level 12</Stat> verfügbar</li>
                </ul>
              </GuideSection>

              <GuideSection title="Challenge-Belohnungen" icon="◇">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f59e0b">Gold</Stat>, <Stat color="#a78bfa">Runensplitter</Stat>, <Stat color="#ef4444">Essenz</Stat> pro Stufe/Checkpoint</li>
                  <li>• <Stat color="#fbbf24">Sternentaler</Stat> — exklusive Währung nur aus Weekly Challenges</li>
                  <li>• Belohnungen manuell claimen (Button pro Stufe/Checkpoint)</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "social" && (
            <>
              <GuideSection title="The Breakaway" icon="◆" accent="rgba(236,72,153,0.4)">
                Sozialer Hub im 5. Stock. Freunde, Nachrichten, Handel und Activity Feed — nur eingeloggt.
              </GuideSection>

              <GuideSection title="Spieler suchen & Profile" icon="◆">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f0f0f0">Suche</Stat> — Autocomplete-Spielersuche nach Name.</li>
                  <li>• <Stat color="#a855f7">Profil</Stat> — Klicke auf Spieler (Leaderboard, Freundesliste, Suche) → Profil: Gear, Achievements, Berufe, Companion.</li>
                  <li>• Direkt aus dem Profil: <strong>Freund hinzufügen</strong> oder <strong>Nachricht senden</strong>.</li>
                </ul>
              </GuideSection>

              <GuideSection title="Freunde & Online-Status" icon="◆">
                <ul className="space-y-1 mt-2">
                  <li>• Freund hinzufügen via Suche oder direkter Namenseingabe.</li>
                  <li>• <Stat color="#22c55e">●</Stat> Online · <Stat color="#eab308">●</Stat> Idle · <Stat color="#6b7280">●</Stat> Offline</li>
                  <li>• Auto-Refresh alle 30 Sekunden.</li>
                </ul>
              </GuideSection>

              <GuideSection title="Nachrichten, Handel & Mail" icon="◈">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#3b82f6">Nachrichten</Stat> — DM an Freunde (500 Zeichen). Read-Receipts (✓✓).</li>
                  <li>• <Stat color="#fbbf24">Trading</Stat> — Gold + Items handeln. Mehrere Verhandlungsrunden möglich.</li>
                  <li>• Beide müssen akzeptieren → atomarer Tausch. Ausgerüstete/BoP/gesperrte Items nicht handelbar.</li>
                  <li>• <Stat color="#a855f7">Mail</Stat> — Sende Gold + bis zu 6 Items an jeden Spieler. 5g Portogebühr. 30 Tage Ablauf. Collect All Button.</li>
                </ul>
              </GuideSection>

              <GuideSection title="Activity Feed" icon="◆" accent="rgba(129,140,248,0.3)">
                Feed mit Aktivitäten deiner Freunde:
                <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                  <span className="rounded px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>⚔️ Quests</span>
                  <span className="rounded px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>▲ Level-Ups</span>
                  <span className="rounded px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>◆ Achievements</span>
                  <span className="rounded px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>✨ Gacha (Epic+)</span>
                  <span className="rounded px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>◇ Rare Drops</span>
                  <span className="rounded px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>◈ Trades</span>
                </div>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}><Rarity r="legendary">Legendary</Rarity>-Events leuchten golden, <Rarity r="epic">Epic</Rarity> lila. Umschaltbar: Kompakt/Detailliert.</p>
              </GuideSection>
            </>
          )}
          {tab === "progression" && (
            <>
              <GuideSection title="XP & Level (Max 30)" icon="▲" accent="rgba(168,85,247,0.4)">
                Jede Quest gibt XP, beeinflusst von: Forge-Temp, Kraft-Stat, Gear, Companion-Bond, Streaks, Buffs.
                <p className="mt-1">Bei Level-Up: <Stat color="#818cf8">5 + Level Stardust</Stat>.</p>
              </GuideSection>

              <GuideSection title="Forge-Temperatur" icon="🔥" accent="rgba(249,115,22,0.3)">
                Aktivitätsmeter (0-100%) — beeinflusst XP und Gold:
                <div className="mt-2 space-y-0.5 text-xs">
                  <div className="flex justify-between"><Stat color="#e0f0ff">100% White-hot</Stat><span>×1.5 XP · ×1.5 Gold</span></div>
                  <div className="flex justify-between"><Stat color="#f97316">80%+ Blazing</Stat><span>×1.25 XP · ×1.3 Gold</span></div>
                  <div className="flex justify-between"><Stat color="#ea580c">60%+ Burning</Stat><span>×1.15 XP · ×1.15 Gold</span></div>
                  <div className="flex justify-between"><Stat color="#b45309">40%+ Warming</Stat><span>×1.0 XP</span></div>
                  <div className="flex justify-between"><Stat color="#78716c">20%+ Smoldering</Stat><Stat color="#ef4444">×0.8 XP</Stat></div>
                  <div className="flex justify-between"><Stat color="#4b5563">&lt;20% Cold</Stat><Stat color="#ef4444">×0.5 XP</Stat></div>
                </div>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Verfall: 2%/h (Ausdauer verlangsamt). Jede Quest: +10 Temp.</p>
              </GuideSection>

              <GuideSection title="Streaks & Gold" icon="◆">
                Täglich mindestens 1 Quest oder Ritual = Streak halten.
                <ul className="space-y-1 mt-2">
                  <li>• Gold-Multi: bis <Stat color="#fbbf24">+45%</Stat> bei 30+ Tagen</li>
                  <li>• <Stat color="#f0f0f0">Streak-Shields</Stat>: Shop, Crafting, Legendary-Gear</li>
                  <li>• <Stat color="#f0f0f0">Auto-Recovery</Stat>: Vitalität-Stat (bis 75% Rettungschance)</li>
                </ul>
              </GuideSection>

              <GuideSection title="Währungen (7)" icon="◆">
                <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                  <div><Stat color="#f59e0b">Gold</Stat> — Hauptwährung</div>
                  <div><Stat color="#818cf8">Stardust</Stat> — Featured Gacha</div>
                  <div><Stat color="#ef4444">Essenz</Stat> — Crafting</div>
                  <div><Stat color="#a78bfa">Runensplitter</Stat> — Standard Gacha</div>
                  <div><Stat color="#10b981">Gildentaler</Stat> — Social/Coop</div>
                  <div><Stat color="#c084fc">Mondstaub</Stat> — Events</div>
                  <div><Stat color="#fbbf24">Sternentaler</Stat> — Weekly Challenges</div>
                </div>
              </GuideSection>

              <GuideSection title="Daily Missions" icon="✓" accent="rgba(34,197,94,0.3)">
                6 tägliche Aufgaben mit Belohnungstrack auf dem Quest Board:
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-2 text-center text-xs">
                  <div className="rounded px-1 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>Login +100</div>
                  <div className="rounded px-1 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>1 Quest +150</div>
                  <div className="rounded px-1 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>3 Quests +250</div>
                  <div className="rounded px-1 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>Ritual +100</div>
                  <div className="rounded px-1 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>Pet +50</div>
                  <div className="rounded px-1 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>Craft +100</div>
                </div>
                <p className="mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>4 Meilensteine bei 100/300/500/750 Punkten → Gold, Essenz, Runensplitter, Sternentaler.</p>
              </GuideSection>

              <GuideSection title="Bazaar & Shop" icon="◆">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#f0f0f0">Self-Care</Stat> — Echte Belohnungen: Gaming, Movie Night, Spa-Tag</li>
                  <li>• <Stat color="#a855f7">Boosts</Stat> — XP-Scrolls, Luck Coins, Streak-Shields, Stardust-Phiolen</li>
                </ul>
              </GuideSection>

              <GuideSection title="The Hearth (Ruhemodus)" icon="🔥" accent="rgba(217,119,6,0.3)">
                Ruhemodus im Breakaway — für Urlaub, Pausen, Mental Health:
                <ul className="space-y-1 mt-2">
                  <li>• Dauer wählen: <Stat color="#d97706">1-7 Tage</Stat></li>
                  <li>• <Stat color="#22c55e">Frozen</Stat>: Streaks + Forge-Temp eingefroren</li>
                  <li>• Keine Quest-Rotation, kein Hoarding-Malus</li>
                  <li>• <Stat color="#ef4444">30-Tage-Cooldown</Stat> nach Ruhephase</li>
                </ul>
                <GuideTip>Jederzeit vorzeitig verlassen möglich — eingefrorene Werte werden wiederhergestellt.</GuideTip>
              </GuideSection>

              <GuideSection title="Season Pass" icon="◆" accent="rgba(167,139,250,0.3)">
                Saisonaler Fortschrittstrack mit 40 Stufen. Verdiene Pass-XP durch Quests, Rituale, Rift, Crafting und Daily Missions.
                <ul className="space-y-1 mt-2">
                  <li>• 250 XP pro Level</li>
                  <li>• Belohnungen: Gold, Essenz, Runensplitter, Sternentaler, Titel, Frames</li>
                  <li>• 3 Seasons: Awakening, Aschenstrom, Sternensturm</li>
                  <li>• Claim All Button für mehrere Stufen gleichzeitig</li>
                  <li>• Ab <Stat color="#22c55e">Level 10</Stat> verfügbar</li>
                </ul>
              </GuideSection>

              <GuideSection title="Die Vier Zirkel (Factions)" icon="◆" accent="rgba(129,140,248,0.3)">
                4 Fraktionen mit Reputations-System. Auto-Rep durch Quest-Completion basierend auf Quest-Typ.
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#ef4444">Orden der Klinge</Stat> — Fitness</li>
                  <li>• <Stat color="#3b82f6">Zirkel der Sterne</Stat> — Learning</li>
                  <li>• <Stat color="#22c55e">Pakt der Wildnis</Stat> — Personal/Creative</li>
                  <li>• <Stat color="#a855f7">Bund der Schatten</Stat> — Social/Development</li>
                  <li>• 6 Rep-Stufen: Neutral → Friendly → Honored → Revered → Exalted → Paragon</li>
                  <li>• Belohnungen pro Stufe: Titel, Rezepte, Frames, Shop-Rabatte, Legendary-Effekte</li>
                  <li>• Ab <Stat color="#22c55e">Level 10</Stat> verfügbar</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "honors" && (
            <>
              <GuideSection title="Hall of Honors" icon="◆" accent="rgba(251,191,36,0.4)">
                55+ Achievements — automatisch freigeschaltet bei Meilensteinen.
              </GuideSection>

              <GuideSection title="Achievement Points" icon="⭐">
                Punkte nach Seltenheit:
                <div className="flex gap-2 mt-2 text-xs">
                  <span><Rarity r="common">Common</Rarity> 5</span>
                  <span><Rarity r="uncommon">Uncommon</Rarity> 10</span>
                  <span><Rarity r="rare">Rare</Rarity> 25</span>
                  <span><Rarity r="epic">Epic</Rarity> 50</span>
                  <span><Rarity r="legendary">Leg.</Rarity> 100</span>
                </div>
              </GuideSection>

              <GuideSection title="Kategorien" icon="◆">
                <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                  <span>▣ Quest-Meilensteine (1-500)</span>
                  <span>🔥 Streak (7-365 Tage)</span>
                  <span>◆ Quest-Typ-Spezialisierungen</span>
                  <span>● Speed & Nachteulen</span>
                  <span>◈ Coop & Quest-Ketten</span>
                  <span>● Versteckte Easter Eggs</span>
                </div>
              </GuideSection>

              <GuideSection title="Portrait-Rahmen (Punkte-Meilensteine)" icon="▣" accent="rgba(167,139,250,0.3)">
                <div className="space-y-0.5 mt-2 text-xs">
                  <div className="flex justify-between"><Stat color="#cd7f32">50 Pkt</Stat><span>Bronzener Rahmen</span></div>
                  <div className="flex justify-between"><Stat color="#c0c0c0">200 Pkt</Stat><span>Silberner Rahmen</span></div>
                  <div className="flex justify-between"><Stat color="#ffd700">350 Pkt</Stat><span>Goldener Rahmen</span></div>
                  <div className="flex justify-between"><Stat color="#a78bfa">750 Pkt</Stat><span>Arkaner Rahmen</span></div>
                  <div className="flex justify-between"><Stat color="#ff8c00">1000 Pkt</Stat><span>Legendärer Rahmen ✦</span></div>
                  <div className="flex justify-between"><Stat color="#00bfff">2000 Pkt</Stat><span>Himmlischer Rahmen ✦</span></div>
                </div>
              </GuideSection>

              <GuideSection title="Proving Grounds & Forge Companions" icon="◆">
                <ul className="space-y-1 mt-2">
                  <li>• <Stat color="#fbbf24">Leaderboard</Stat> — Rangliste nach XP. Top 3: Gold/Silber/Bronze-Podium.</li>
                  <li>• <Stat color="#f97316">Forge Companions</Stat> — Achievement-Unlocks: Ember Sprite, Lore Owl, Gear Golem → je +2% XP (bis +6%).</li>
                </ul>
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

// ─── Tutorial Overlay ────────────────────────────────────────────────────────

export const TUTORIAL_STEPS = [
  {
    key: "welcome",
    title: "Willkommen in der Quest Hall!",
    desc: "Dein persönliches Abenteuer beginnt hier. Ich zeige dir die wichtigsten Bereiche des Turms — Schritt für Schritt.",
    target: null,
    position: "center" as const,
    navigateTo: null,
  },
  {
    key: "stat-cards",
    title: "Dein Fortschritt",
    desc: "Forge-Temperatur, Streak und Quest-Zähler — deine wichtigsten Stats auf einen Blick. Halte die Forge heiß für XP- und Gold-Boni!",
    target: "stat-cards",
    position: "bottom" as const,
    navigateTo: null,
  },
  {
    key: "login-btn",
    title: "Einloggen oder Registrieren",
    desc: "Erstelle deinen Helden mit Klasse, Companion und Berufspfad. Oder logge dich mit Name und Passwort ein.",
    target: "login-btn",
    position: "bottom" as const,
    navigateTo: null,
  },
  {
    key: "nav-overview",
    title: "6 Stockwerke von Urithiru",
    desc: "Die Quest Hall ist in Stockwerke gegliedert: The Pinnacle (oben), Great Halls, Trading District, Inner Sanctum, Breakaway und The Hearth.",
    target: "nav-bar",
    position: "bottom" as const,
    navigateTo: null,
  },
  {
    key: "quest-board",
    title: "The Great Hall — Dein Quest Board",
    desc: "Hier findest du deine Aufträge. Offene Quests annehmen → bearbeiten → abschließen. Jede Quest gibt XP, Gold und Loot-Chancen!",
    target: "quest-board-tab",
    position: "bottom" as const,
    navigateTo: "questBoard",
  },
  {
    key: "first-quest",
    title: "Deine erste Quest",
    desc: "Klick auf eine Quest und dann auf 'Claim'. Probier es gleich aus — deine Starter-Quests warten schon auf dich!",
    target: "quest-list-first",
    position: "bottom" as const,
    navigateTo: "questBoard",
  },
  {
    key: "wanderers-rest",
    title: "Wanderer's Rest — Reisende NPCs",
    desc: "NPCs kommen und gehen (2-4 Tage). Jeder hat eigene Quest-Ketten mit einzigartigen Items als Belohnung.",
    target: "npc-board-tab",
    position: "bottom" as const,
    navigateTo: "npcBoard",
  },
  {
    key: "vault-of-fate",
    title: "Vault of Fate — Gacha-System",
    desc: "Ziehe Items mit Runensplittern. Pity-System: Legendary garantiert bei Pull 75. Epic alle 10 Pulls.",
    target: "vault-tab",
    position: "bottom" as const,
    navigateTo: "gacha",
  },
  {
    key: "bazaar",
    title: "The Bazaar — Belohnungen & Boosts",
    desc: "Tausche Gold gegen echte Belohnungen (Gaming-Zeit, Spa-Tag) oder temporäre Gameplay-Boosts (XP-Scrolls, Streak-Shields).",
    target: "bazaar-tab",
    position: "bottom" as const,
    navigateTo: "shop",
  },
  {
    key: "leaderboard",
    title: "The Proving Grounds",
    desc: "Die Rangliste aller Spieler. Klicke auf einen Spieler um sein Profil zu sehen — mit Gear, Achievements und mehr.",
    target: "leaderboard-tab",
    position: "bottom" as const,
    navigateTo: "leaderboard",
  },
  {
    key: "forge-streak",
    title: "Forge-Temperatur & Streak",
    desc: "Erledige täglich Quests oder Rituale um deinen Streak zu halten und die Forge heiß zu halten. Höhere Temp = mehr XP und Gold. Längerer Streak = bis +45% Gold!",
    target: null,
    position: "center" as const,
    navigateTo: null,
  },
  {
    key: "character",
    title: "Dein Charakter & Ausrüstung",
    desc: "Im Inner Sanctum findest du deinen Character Screen mit 7 Equipment-Slots, Stats (Affix-Rolling), Rituale und Gelübde.",
    target: null,
    position: "center" as const,
    navigateTo: null,
  },
  {
    key: "done",
    title: "Bereit, Wanderer!",
    desc: "Die Halle wartet. Nimm deine erste Quest an, halte deinen Streak und schmiedet deinen Weg nach oben. Öffne den Guide jederzeit für Details!",
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
