"use client";

import { useState, useEffect } from "react";
import { useModalBehavior } from "./ModalPortal";
import { CURRENT_SEASON } from "@/app/utils";

// ─── GuideSection ─────────────────────────────────────────────────────────────

export function GuideSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="font-semibold mb-1.5" style={{ color: "#f0f0f0" }}>{icon} {title}</p>
      <div style={{ color: "rgba(255,255,255,0.55)" }}>{children}</div>
    </div>
  );
}

// ─── GuideContent ─────────────────────────────────────────────────────────────

export function GuideContent({ onRestartTutorial }: { onRestartTutorial?: () => void }) {
  const [tab, setTab] = useState<"quests" | "xp" | "forge" | "achievements" | "start">("start");
  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b overflow-x-auto mb-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {([
          { key: "start", label: "x Start" },
          { key: "quests", label: "x Quests" },
          { key: "xp", label: "x XP & Levels" },
          { key: "forge", label: "x Forge" },
          { key: "achievements", label: "x Achievements" },
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
            x Restart Tutorial
          </button>
        </div>
      )}

      <div className="p-5 space-y-4 text-xs" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
          {tab === "start" && (
            <>
              <GuideSection icon="" title="Registrierung">
                Klicke auf <strong>Login → Register</strong> in der Kopfleiste. Der <strong>Charakter-Creator</strong> führt dich in 5 Schritten durch die Erstellung deines Helden:
                <ol className="space-y-1 mt-1 ml-2" style={{ listStyleType: "decimal" }}>
                  <li><span style={{ color: "#f0f0f0" }}>Name</span> — Wähle deinen Heldennamen.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Über dich</span> — Optionales Alter und Ziele (helfen bei Quest-Vorschlägen).</li>
                  <li><span style={{ color: "#f0f0f0" }}>Klasse</span> — Wähle deinen Berufspfad oder reiche eine neue Klasse ein.</li>
                  <li><span style={{ color: "#f0f0f0" }}>Begleiter</span> — Haustier oder virtueller Begleiter.</li>
                  <li><span style={{ color: "#f0f0f0" }}>API-Key</span> — Dein einzigartiger Login-Schlüssel. Sicher aufbewahren!</li>
                </ol>
              </GuideSection>
              <GuideSection icon="" title="Klassen">
                Klassen definieren deinen Berufspfad und geben dir passende Quests.
                <ul className="space-y-1 mt-1">
                  <li>• Wähle eine <span style={{ color: "#a78bfa" }}>aktive Klasse</span> aus der Liste — sie ist sofort verfügbar.</li>
                  <li>• Keine passende Klasse? <span style={{ color: "#f59e0b" }}>Eigene Klasse einreichen</span> — ein Admin schmiedet sie für dich.</li>
                  <li>• Während deine Klasse geschmiedet wird, siehst du <span style={{ color: "#f59e0b" }}>⚒️ Klasse wird geschmiedet...</span> auf deiner Spielerkarte.</li>
                  <li>• Sobald die Klasse fertig ist, erhältst du beim nächsten Login eine Benachrichtigung.</li>
                </ul>
              </GuideSection>
              <GuideSection icon="" title="Begleiter">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#f0f0f0" }}>🐾 Haustier</span> — Gib deinem echten Tier einen Platz in der Quest Hall. Es bekommt Pflege-Quests (Füttern, Spielen, etc.).</li>
                  <li><span style={{ color: "#f0f0f0" }}>🐉 Drache</span> — Feuriger Motivations-Begleiter.</li>
                  <li><span style={{ color: "#f0f0f0" }}>🦉 Eule</span> — Weiser Lern-Begleiter.</li>
                  <li><span style={{ color: "#f0f0f0" }}>🔥 Phoenix</span> — Steht nach jeder Niederlage wieder auf.</li>
                  <li><span style={{ color: "#f0f0f0" }}>🐺 Wolf</span> — Treuer Begleiter der immer an deiner Seite steht.</li>
                </ul>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Dein Begleiter erscheint auf deiner Spielerkarte und motiviert dich durch Quests.</p>
              </GuideSection>
            </>
          )}
          {tab === "quests" && (
            <>
              <GuideSection icon="" title="Quest Hall Structure">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#f0f0f0" }}>📋 Quest Board</span> — Player quests (personal, learning, fitness, social, co-op). Claim and complete directly — no review needed.</li>
                  <li><span style={{ color: "#a78bfa" }}>🗺️ NPC Quest Board</span> — Development quests created and completed by agents. Includes Review Board for approving agent suggestions.</li>
                  <li><span style={{ color: "#f59e0b" }}>🏆 Leaderboard</span> — Ranks players and agents separately with an Agent/Player toggle.</li>
                  <li><span style={{ color: "#f59e0b" }}>🎖️ Honors</span> — Your personal achievements. Log in to see your progress highlighted.</li>
                  <li><span style={{ color: "#8b5cf6" }}>⚔️ Campaign</span> — Fantasy RPG overlay with agents as NPCs and quests as adventures.</li>
                  <li><span style={{ color: CURRENT_SEASON.color }}>{CURRENT_SEASON.icon} Season</span> — Battle Pass rewards track for the current season.</li>
                </ul>
              </GuideSection>
              <GuideSection icon="" title="Player Quest Types">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#22c55e" }}>🟢 Personal</span> — Household chores, errands, life admin</li>
                  <li><span style={{ color: "#3b82f6" }}>🔵 Learning</span> — Study, courses, reading (requires proof)</li>
                  <li><span style={{ color: "#f97316" }}>🟠 Fitness</span> — Workouts, sports, health goals</li>
                  <li><span style={{ color: "#ec4899" }}>🩷 Social</span> — Thoughtful gestures, dates, quality time</li>
                  <li><span style={{ color: "#f43f5e" }}>❤️ Co-op</span> — Partner quests requiring both to complete</li>
                </ul>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Player quests go directly open → claimed → done. No agent review required.</p>
              </GuideSection>
              <GuideSection icon="" title="NPC / Development Quests">
                <p>Development quests are created by agents (or Leon) and implemented exclusively by agents. They appear in the NPC Quest Board tab.</p>
                <p className="mt-1">The Review Board (in NPC tab) lets logged-in users approve or reject agent-suggested quests before they become active.</p>
              </GuideSection>
              <GuideSection icon="" title="Login">
                Click <strong>Login</strong> in the header. Enter your name and API key. Once logged in, the stat cards show YOUR stats, and the Quest Board shows Claim / Complete buttons. Your achievements in Honors are highlighted.
              </GuideSection>
              <GuideSection icon="" title="Quest Priorities">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#ef4444" }}>High</span> — 30 XP · 50 Gold</li>
                  <li><span style={{ color: "#eab308" }}>Medium</span> — 20 XP · 25 Gold</li>
                  <li><span style={{ color: "#22c55e" }}>Low</span> — 10 XP · 10 Gold</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "xp" && (
            <>
              <GuideSection icon="" title="XP & Levels">
                <div className="space-y-2 mt-1">
                  {[
                    { name: "Novice",     range: "0 – 99 XP",     color: "#9ca3af" },
                    { name: "Apprentice", range: "100 – 299 XP",  color: "#22c55e" },
                    { name: "Knight",     range: "300 – 599 XP",  color: "#3b82f6" },
                    { name: "Archmage",   range: "600+ XP",       color: "#a855f7" },
                  ].map(l => (
                    <div key={l.name} className="flex items-center gap-2">
                      <span className="w-16 text-xs font-semibold" style={{ color: l.color }}>{l.name}</span>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>{l.range}</span>
                    </div>
                  ))}
                </div>
              </GuideSection>
              <GuideSection icon="" title="Gold">
                Earn gold by completing quests. Gold is multiplied by your streak (up to 3×). Spend it in the Forge Shop on rewards like Gaming time, Snack breaks, or Days Off.
              </GuideSection>
              <GuideSection icon="" title="Workshop Gear">
                <p>Upgrade your Workshop Tools to earn more XP per quest:</p>
                <div className="space-y-1 mt-1">
                  {[
                    { icon: "", name: "Worn Tools",       bonus: "+0%",  cost: "Free" },
                    { icon: "",  name: "Sturdy Tools",     bonus: "+5%",  cost: "100g" },
                    { icon: "",  name: "Masterwork Tools", bonus: "+10%", cost: "300g" },
                    { icon: "",  name: "Legendary Tools",  bonus: "+15%", cost: "700g" },
                    { icon: "", name: "Mythic Forge",     bonus: "+25%", cost: "1500g" },
                  ].map(g => (
                    <div key={g.name} className="flex items-center gap-2">
                      <span>{g.icon}</span>
                      <span className="flex-1">{g.name}</span>
                      <span style={{ color: "#22c55e" }}>{g.bonus}</span>
                      <span style={{ color: "#f59e0b" }}>{g.cost}</span>
                    </div>
                  ))}
                </div>
              </GuideSection>
            </>
          )}
          {tab === "forge" && (
            <>
              <GuideSection icon="" title="Forge Temperature">
                Your Forge Temperature (0–100%) shows how active you are. Complete quests to heat it up. If it drops to 0%, you suffer a <span style={{ color: "#ef4444" }}>50% XP penalty</span>. Keep the forge burning!
              </GuideSection>
              <GuideSection icon="" title="Streaks">
                Complete at least one quest each day to maintain your streak. Longer streaks increase your Gold multiplier (up to 3× at 20+ days). Streak milestones unlock achievements.
                <div className="space-y-1 mt-1">
                  <div>🔥 <span style={{ color: "#fb923c" }}>Active</span> — 1–6 days</div>
                  <div>🔥 <span style={{ color: "#f59e0b" }}>Hot</span> — 7–29 days</div>
                  <div>🔥 <span style={{ color: "#ef4444" }}>Blazing</span> — 30+ days</div>
                </div>
              </GuideSection>
              <GuideSection icon="" title="Forge Shop">
                Spend your gold on real-world rewards. Open the Shop from your Player Card (requires API key). All purchases are tracked so you can redeem them.
              </GuideSection>
            </>
          )}
          {tab === "achievements" && (
            <>
              <GuideSection icon="" title="Achievements">
                Achievements are automatically awarded when you hit milestones. They are <strong>per-player</strong> — tied to your login name. Check the <strong>🎖️ Honors</strong> tab to see all achievements; when logged in, your earned achievements are highlighted with a gold border.
              </GuideSection>
              <GuideSection icon="" title="Achievement List">
                <div className="space-y-1 mt-1">
                  {[
                    { icon: "", name: "First Quest",         desc: "Complete your first quest" },
                    { icon: "", name: "Apprentice",           desc: "Complete 10 quests" },
                    { icon: "", name: "Knight",               desc: "Complete 50 quests" },
                    { icon: "", name: "Legend",               desc: "Complete 100 quests" },
                    { icon: "", name: "Week Warrior",         desc: "7-day quest streak" },
                    { icon: "", name: "Monthly Champion",     desc: "30-day quest streak" },
                    { icon: "", name: "Lightning Hands",      desc: "Complete 3 quests in one day" },
                    { icon: "", name: "Jack of All Trades",   desc: "Complete all 5 quest types" },
                  ].map(a => (
                    <div key={a.name} className="flex items-center gap-2">
                      <span className="text-base w-5 flex-shrink-0">{a.icon}</span>
                      <div>
                        <span className="font-semibold" style={{ color: "#f0f0f0" }}>{a.name}</span>
                        <span className="ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>{a.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
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
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", fontSize: 16, background: "none", border: "none", cursor: "pointer" }}>x</button>
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
    title: "Welcome to Quest Hall!",
    desc: "Let me show you around. It'll only take a minute.",
    target: null,
    position: "center" as const,
  },
  {
    key: "stat-cards",
    title: "Your Stats",
    desc: "These are your stats — Forge Streak, Active Quests, Quests Completed, and Gold. Log in to see your personal numbers.",
    target: "stat-cards",
    position: "bottom" as const,
  },
  {
    key: "quest-board-tab",
    title: "Quest Board",
    desc: "This is YOUR quest board. Personal quests, learning, fitness, social — all yours to claim and complete.",
    target: "quest-board-tab",
    position: "bottom" as const,
  },
  {
    key: "npc-board-tab",
    title: "NPC Quest Board",
    desc: "Agent quests live here. The NPCs (AI agents) work on development tasks — you can review their work too.",
    target: "npc-board-tab",
    position: "bottom" as const,
  },
  {
    key: "quest-filters",
    title: "Quest Filters",
    desc: "Filter quests by type — Personal, Learning, Fitness, Social, or Co-op. Find what you need fast.",
    target: "quest-filters",
    position: "bottom" as const,
  },
  {
    key: "claim-hint",
    title: "Claim Quests",
    desc: "See a quest you want? Click x Claim to take it on! Complete it when done to earn XP and Gold.",
    target: null,
    position: "center" as const,
  },
  {
    key: "login-btn",
    title: "Log In",
    desc: "Log in with your name and API key to claim quests, earn XP, and track your personal stats. Don't have a key yet? No worries — click Register to create a free account!",
    target: "login-btn",
    position: "bottom" as const,
  },
  {
    key: "companions",
    title: "Companions",
    desc: "Companions join your journey and grant XP bonuses. Keep your streak going to keep them happy!",
    target: "companions-widget",
    position: "top" as const,
  },
  {
    key: "leaderboard-tab",
    title: "Leaderboard",
    desc: "Compete with other players and agents. Rise through the ranks to claim the top spot!",
    target: "leaderboard-tab",
    position: "bottom" as const,
  },
  {
    key: "campaign-tab",
    title: "Campaign",
    desc: "Long quest chains and story arcs live here. Embark on epic adventures with your party.",
    target: "campaign-tab",
    position: "bottom" as const,
  },
  {
    key: "season-tab",
    title: "Season & Battle Pass",
    desc: "Each season brings a Battle Pass with exclusive rewards. Complete quests to level it up!",
    target: "season-tab",
    position: "bottom" as const,
  },
  {
    key: "done",
    title: "You're Ready, Adventurer! x",
    desc: "The Forge awaits. Go forth, complete quests, and earn glory for the Guild!",
    target: null,
    position: "center" as const,
  },
];

export function TutorialOverlay({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
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
          style={{ background: "rgba(0,0,0,0.78)", zIndex: 9998 }}
          onClick={onNext}
        />
      )}
      {!isCentered && (
        <div className="fixed inset-0" style={{ zIndex: 9998, pointerEvents: "none" }} />
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
            {isLast ? "Let's Go! x" : "Next →"}
          </button>
        </div>
      </div>
    </>
  );
}
