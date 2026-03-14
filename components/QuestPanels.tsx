"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ModalPortal, useModalBehavior } from "./ModalPortal";
import type {
  Quest, QuestsData, Agent, AntiRitual, Ritual, Suggestion,
} from "@/app/types";
import { typeConfig } from "@/app/config";
import { getAntiRitualMood } from "@/app/utils";

// ─── Anti-Rituale Panel ───────────────────────────────────────────────────────

const COMMITMENT_TIERS_VOW = [
  { id: "none",     label: "None",     days: 0,   color: "rgba(255,255,255,0.25)", bonusGold: 0,  bonusXp: 0,  flavorShort: "No commitment" },
  { id: "spark",    label: "Spark",    days: 7,   color: "#94a3b8",                bonusGold: 3,  bonusXp: 5,  flavorShort: "First spark" },
  { id: "flame",    label: "Flame",    days: 21,  color: "#6366f1",                bonusGold: 7,  bonusXp: 10, flavorShort: "Renunciation forms" },
  { id: "ember",    label: "Ember",    days: 60,  color: "#818cf8",                bonusGold: 13, bonusXp: 20, flavorShort: "Deep-rooted" },
  { id: "crucible", label: "Crucible", days: 180, color: "#c7d2fe",                bonusGold: 20, bonusXp: 35, flavorShort: "Steel of the soul" },
  { id: "eternity", label: "Eternity", days: 365, color: "#e0e7ff",                bonusGold: 30, bonusXp: 50, flavorShort: "Eternal renunciation" },
];

function getVaelSpeech(commitment: string, bloodPact: boolean): string {
  if (bloodPact) return "Blut. So sei es.";
  if (commitment === "eternity") return "Ein Jahr Entsagung. Wenige bestehen.";
  if (commitment === "none") return "Ein Schwur ohne Ende... mutiger Schritt, Abenteurer.";
  return "...Sprich deinen Schwur.";
}

const ANTI_RITUAL_MILESTONES = [
  { days: 7,   badge: "×", label: "1 Woche clean!" },
  { days: 14,  badge: "×", label: "2 Wochen stark!" },
  { days: 21,  badge: "×", label: "21 Tage — The Habit Breaks!" },
  { days: 30,  badge: "×", label: "1 Monat stark!" },
  { days: 60,  badge: "×", label: "60 Tage — Diamond Will!" },
  { days: 90,  badge: "×", label: "90 Tage — Unbreakable!" },
];

export function AntiRitualePanel({ playerName, reviewApiKey }: { playerName: string; reviewApiKey: string }) {
  const [antiRituals, setAntiRituals] = useState<AntiRitual[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newVowCategory, setNewVowCategory] = useState("personal");
  const [newVowCommitment, setNewVowCommitment] = useState("none");
  const [newVowBloodPact, setNewVowBloodPact] = useState(false);
  const [newVowFrequency, setNewVowFrequency] = useState("daily");
  const [vowNameError, setVowNameError] = useState(false);
  const [vowCommitmentError, setVowCommitmentError] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendCommitment, setExtendCommitment] = useState("none");
  const [recommitId, setRecommitId] = useState<string | null>(null);
  const [slipAnimId, setSlipAnimId] = useState<string | null>(null);

  const closeExtendModal = useCallback(() => { setExtendId(null); setExtendCommitment("none"); }, []);
  const closeRecommitModal = useCallback(() => setRecommitId(null), []);
  useModalBehavior(!!extendId, closeExtendModal);
  useModalBehavior(!!recommitId, closeRecommitModal);

  useEffect(() => {
    if (!createOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCreateOpen(false); setNewTitle(""); setVowNameError(false); setNewVowCommitment("none"); setNewVowBloodPact(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createOpen]);

  const loadAntiRituals = useCallback(async () => {
    if (!playerName) return;
    try {
      const r = await fetch(`/api/rituals?player=${encodeURIComponent(playerName)}&type=anti`, { cache: "no-store" });
      if (r.ok) {
        const all = await r.json() as (Ritual & { isAntiRitual?: boolean; cleanDays?: number; lastViolated?: string | null })[];
        setAntiRituals(all.filter(r => r.isAntiRitual).map(r => ({
          id: r.id, title: r.title, isAntiRitual: true,
          cleanDays: r.streak ?? r.cleanDays ?? 0,
          lastViolated: r.lastViolated ?? null,
          lastCompleted: r.lastCompleted ?? null,
          playerId: r.playerId,
          createdAt: r.lastCompleted ?? new Date().toISOString(),
          longestStreak: r.longestStreak ?? (r.streak ?? 0),
          completedDates: r.completedDates ?? [],
          commitment: (r as any).commitment ?? "none",
          commitmentDays: (r as any).commitmentDays ?? 0,
          bloodPact: (r as any).bloodPact ?? false,
          status: (r as any).status ?? "active",
        })));
      }
    } catch { /* ignore */ }
  }, [playerName]);

  useEffect(() => { loadAntiRituals(); }, [loadAntiRituals]);

  const markViolated = async (id: string) => {
    if (!reviewApiKey || !playerName) return;
    try {
      await fetch(`/api/rituals/${id}/violate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
        body: JSON.stringify({ playerId: playerName }),
      });
      loadAntiRituals();
    } catch { /* ignore */ }
  };

  const createAntiRitual = async () => {
    if (!newTitle.trim()) { setVowNameError(true); return; }
    if (newVowCommitment === "none") { setVowCommitmentError(true); return; }
    if (!reviewApiKey || !playerName) return;
    try {
      const tier = COMMITMENT_TIERS_VOW.find(t => t.id === newVowCommitment)!;
      await fetch("/api/rituals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
        body: JSON.stringify({
          title: newTitle.trim(),
          schedule: { type: "daily" },
          playerId: playerName,
          createdBy: playerName,
          isAntiRitual: true,
          category: newVowCategory,
          commitment: newVowCommitment,
          commitmentDays: tier.days,
          bloodPact: newVowBloodPact,
        }),
      });
      setNewTitle("");
      setVowNameError(false);
      setNewVowCommitment("none");
      setNewVowBloodPact(false);
      setCreateOpen(false);
      loadAntiRituals();
    } catch { /* ignore */ }
  };

  const getStreakBadge = (days: number) =>
    [...ANTI_RITUAL_MILESTONES].reverse().find(m => days >= m.days) ?? null;

  const renderVowCard = (ar: AntiRitual) => {
    const days = ar.cleanDays;
    const isBroken = ar.status === "broken";
    const vowDoneToday = ar.lastCompleted === new Date().toISOString().slice(0, 10);
    const mood = getAntiRitualMood(days);
    const badge = getStreakBadge(days);
    const nextMilestone = ANTI_RITUAL_MILESTONES.find(m => days < m.days);
    const streakBorderColor = isBroken ? "rgba(239,68,68,0.4)" : days >= 90 ? "#f59e0b" : days >= 30 ? "#a78bfa" : days >= 7 ? "#22c55e" : "rgba(255,255,255,0.1)";
    const streakGlow = isBroken ? "0 0 12px rgba(239,68,68,0.15)" : days >= 30 ? `0 0 12px ${streakBorderColor}30` : "none";
    const longestStreak = ar.longestStreak ?? days;
    // Flame intensity based on streak (same as rituals)
    const flameColor = isBroken ? "#ef4444" : days >= 30 ? "#f59e0b" : days >= 14 ? "#f97316" : days >= 7 ? "#ef4444" : "rgba(255,255,255,0.25)";
    const flameGlow = isBroken ? "0 0 8px rgba(239,68,68,0.3)" : days >= 7 ? `0 0 8px ${flameColor}44` : "none";
    return (
      <div key={ar.id} className="rounded-xl p-3" style={{
        background: "#252525",
        border: `1px solid ${streakBorderColor}`,
        boxShadow: streakGlow,
      }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Streak flame counter */}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ color: flameColor, background: `${flameColor}12`, border: `1px solid ${flameColor}30`, boxShadow: flameGlow, fontSize: 11 }}>
                <span style={{ fontSize: 13 }}>{days >= 7 ? "\uD83D\uDD25" : "\u2728"}</span>
                {days}
              </span>
              <span className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>{ar.title}</span>
              {badge && <span className="text-sm" title={badge.label}>{badge.badge}</span>}
            </div>
            <p className="text-xs mb-1.5" style={{ color: mood.color }}>{mood.msg}</p>
            <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              <span className="font-bold" style={{ color: mood.color }}>{days} days clean</span>
              {longestStreak > 0 && <span title="Longest streak" style={{ color: "rgba(245,158,11,0.5)" }}>Best: {longestStreak}</span>}
              {nextMilestone && <span>→ {nextMilestone.badge} in {nextMilestone.days - days}d</span>}
            </div>
            {nextMilestone && (
              <div className="mt-2">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${(days / nextMilestone.days) * 100}%`,
                    background: `linear-gradient(90deg, ${mood.color}80, ${mood.color})`,
                  }} />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isBroken ? (
              <>
                <button
                  onClick={() => setRecommitId(ar.id)}
                  disabled={!reviewApiKey}
                  className="text-xs px-3 py-1 rounded font-bold transition-all"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)", cursor: "pointer", boxShadow: "0 0 10px rgba(139,92,246,0.1)" }}
                >
                  Rise Again
                </button>
                {reviewApiKey && (
                  <button
                    onClick={() => setDeleteConfirmId(ar.id)}
                    className="text-xs px-2 py-1 rounded transition-all"
                    style={{ background: "rgba(239,68,68,0.06)", color: "rgba(239,68,68,0.4)", border: "1px solid rgba(239,68,68,0.12)", cursor: 'pointer' }}
                    title="Delete vow"
                  >
                    ×
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={async () => {
                    if (!reviewApiKey || !playerName || vowDoneToday) return;
                    try {
                      const r = await fetch(`/api/rituals/${ar.id}/complete`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
                        body: JSON.stringify({ playerId: playerName }),
                      });
                      const data = await r.json();
                      if (data.ok) loadAntiRituals();
                    } catch { /* ignore */ }
                  }}
                  disabled={vowDoneToday || !reviewApiKey}
                  className="text-xs px-2 py-1 rounded transition-all"
                  style={{
                    background: vowDoneToday ? "rgba(34,197,94,0.08)" : "rgba(99,102,241,0.12)",
                    color: vowDoneToday ? "rgba(34,197,94,0.5)" : "#818cf8",
                    border: `1px solid ${vowDoneToday ? "rgba(34,197,94,0.2)" : "rgba(99,102,241,0.3)"}`,
                    cursor: vowDoneToday ? "default" : "pointer",
                  }}
                  title={vowDoneToday ? "Already completed today" : "Clean day — mark complete"}
                  onMouseEnter={e => { if (!vowDoneToday) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.25)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.55)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 10px rgba(99,102,241,0.2)"; }}}
                  onMouseLeave={e => { if (!vowDoneToday) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.3)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}}
                >
                  {vowDoneToday ? "✓ Clean" : "Abhaken"}
                </button>
                <button
                  onClick={() => { setSlipAnimId(ar.id); markViolated(ar.id); setTimeout(() => setSlipAnimId(null), 400); }}
                  disabled={!reviewApiKey}
                  className="text-xs px-2 py-1 rounded transition-all"
                  style={{
                    background: slipAnimId === ar.id ? "rgba(239,68,68,0.35)" : "rgba(239,68,68,0.08)",
                    color: slipAnimId === ar.id ? "#fca5a5" : "rgba(239,68,68,0.5)",
                    border: `1px solid ${slipAnimId === ar.id ? "rgba(239,68,68,0.7)" : "rgba(239,68,68,0.2)"}`,
                    boxShadow: slipAnimId === ar.id ? "0 0 14px rgba(239,68,68,0.4)" : "none",
                    transform: slipAnimId === ar.id ? "scale(1.15)" : "scale(1)",
                    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  title="I slipped... Streak reset."
                >
                  Slip
                </button>
                {reviewApiKey && !ar.bloodPact && (
                  <button
                    onClick={() => { setExtendId(ar.id); setExtendCommitment(ar.commitment ?? "none"); }}
                    className="text-xs px-2 py-1 rounded transition-all"
                    style={{ background: "rgba(99,102,241,0.06)", color: "rgba(99,102,241,0.5)", border: "1px solid rgba(99,102,241,0.15)", cursor: 'pointer' }}
                    title="Extend vow duration"
                  >
                    Extend
                  </button>
                )}
                {reviewApiKey && (
                  <button
                    onClick={() => setDeleteConfirmId(ar.id)}
                    className="text-xs px-2 py-1 rounded transition-all"
                    style={{ background: "rgba(239,68,68,0.06)", color: "rgba(239,68,68,0.4)", border: "1px solid rgba(239,68,68,0.12)", cursor: 'pointer' }}
                    title="Delete vow"
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="section-vow">
      {/* ── Top flex row: Portrait left, content right ── */}
      <div className="flex gap-4 mb-4" style={{ alignItems: "flex-start" }}>
        {/* Portrait column with speech bubble */}
        <div className="flex-none" style={{ width: 195, overflow: "visible" }}>
          <img src="/images/portraits/npc-vael.png?v=3" alt="Vael the Silent" width={256} height={384} style={{ imageRendering: "pixelated", width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 18px rgba(99,102,241,0.5))", borderRadius: "4px 4px 0 0", pointerEvents: "none" }} />
          <div style={{ background: "rgba(8,8,20,0.9)", border: "1px solid rgba(99,102,241,0.35)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "8px 10px" }}>
            <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#a5b4fc", lineHeight: 1.5, margin: 0 }}>„Sprich. Oder schweig. Beides hat Gewicht."</p>
          </div>
        </div>
        {/* Right: title + create button + first 2 cards */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold uppercase tracking-widest" style={{ color: "#818cf8", fontSize: "1rem" }}>
                Vow Shrine
                <span className="font-normal normal-case ml-2" style={{ color: "rgba(165,180,252,0.35)", fontSize: "0.75rem" }}>— track what you don&apos;t do</span>
              </h3>
              <p style={{ color: "rgba(99,102,241,0.6)", fontSize: "1rem", fontWeight: 600, marginTop: 2 }}>Vael the Silent</p>
            </div>
            {playerName && reviewApiKey && (
              <button onClick={() => setCreateOpen(true)} className="action-btn text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: "rgba(99,102,241,0.14)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.35)", boxShadow: "0 0 10px rgba(99,102,241,0.08)" }}>
                ＋ Swear Vow
              </button>
            )}
          </div>
          {antiRituals.length === 0 ? (
            <div className="rounded-xl p-5 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-2xl mb-2">×</p>
              <p className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>No vows sworn yet</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Track how long you avoid a bad habit. Days clean = streak power.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {antiRituals.slice(0, 2).map(renderVowCard)}
            </div>
          )}
        </div>
      </div>
      {/* Remaining cards (3+) at full width */}
      {antiRituals.length > 2 && (
        <div className="space-y-2">
          {antiRituals.slice(2).map(renderVowCard)}
        </div>
      )}

      {createOpen && (() => {
        const closeVowModal = () => { setCreateOpen(false); setNewTitle(""); setNewVowCommitment("none"); setNewVowBloodPact(false); setVowCommitmentError(false); };
        const tierData = COMMITMENT_TIERS_VOW.find(t => t.id === newVowCommitment)!;
        const bonusGold = tierData.bonusGold * (newVowBloodPact ? 3 : 1);
        const bonusXp = tierData.bonusXp * (newVowBloodPact ? 3 : 1);
        return (
          <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={closeVowModal}>
            <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
              {/* NPC Portrait — absolute right of modal, hidden on mobile */}
              <div className="hidden md:flex flex-col" style={{ position: "absolute", right: -185, top: "50%", transform: "translateY(-50%)", width: 200, overflow: "visible" }}>
                <img src="/images/portraits/npc-vael.png?v=3" alt="Vael the Silent" width={256} height={384} style={{ imageRendering: "pixelated", width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 18px rgba(99,102,241,0.5))", borderRadius: "8px 8px 0 0", pointerEvents: "none" }} />
                <div style={{ background: "rgba(8,8,20,0.92)", border: "1px solid rgba(99,102,241,0.4)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#a5b4fc", lineHeight: 1.5, margin: 0 }}>{getVaelSpeech(newVowCommitment, newVowBloodPact)}</p>
                </div>
              </div>
            <div style={{ maxWidth: 1000, width: "100%", borderRadius: "1rem", background: newVowBloodPact ? "linear-gradient(160deg, #1a1a2e 0%, #0f0f1e 100%)" : "linear-gradient(160deg, #1e1c2c 0%, #141220 100%)", border: `1px solid ${newVowBloodPact ? "rgba(99,102,241,0.6)" : "rgba(99,102,241,0.3)"}`, boxShadow: newVowBloodPact ? "0 0 60px rgba(99,102,241,0.14)" : "0 0 40px rgba(99,102,241,0.07)", transition: "all 0.4s ease" }}>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b" style={{ borderColor: "rgba(99,102,241,0.12)" }}>
                <img src="/images/icons/ui-vow-sword.png" alt="" width={28} height={28} style={{ imageRendering: "pixelated" }} onError={e => (e.currentTarget.style.display = "none")} />
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>Swear a Vow</h3>
                  <p className="text-xs" style={{ color: "rgba(165,180,252,0.4)" }}>Vael the Silent — Vow Shrine</p>
                </div>
                <button onClick={closeVowModal} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.6)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ""; }}>×</button>
              </div>
              {/* Mobile-only speech */}
              <div className="md:hidden px-5 py-2.5" style={{ borderBottom: "1px solid rgba(99,102,241,0.1)", background: "rgba(8,8,20,0.4)" }}>
                <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#a5b4fc", lineHeight: 1.5, margin: 0 }}>{getVaelSpeech(newVowCommitment, newVowBloodPact)}</p>
              </div>
              {/* Form */}
              <div className="p-5 space-y-4" style={{ paddingBottom: "1.75rem" }}>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(165,180,252,0.55)" }}>What are you vowing to avoid?</label>
                  <input value={newTitle} onChange={e => { setNewTitle(e.target.value); if (vowNameError) setVowNameError(false); }} placeholder="e.g. No social media before noon..." className="w-full text-sm px-3 py-2.5 rounded-lg" style={{ background: "rgba(0,0,0,0.35)", border: vowNameError ? "1px solid #ef4444" : "1px solid rgba(99,102,241,0.3)", color: "#e2e8f0", outline: "none" }} onKeyDown={e => e.key === "Enter" && createAntiRitual()} autoFocus />
                  {vowNameError && <p style={{ color: "#ef4444", fontSize: "0.7rem", marginTop: 4 }}>Please enter a vow name</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(165,180,252,0.55)" }}>Category</label>
                    <select value={newVowCategory} onChange={e => setNewVowCategory(e.target.value)} className="w-full text-sm rounded-lg" style={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", color: "#f0f0f0", outline: "none", padding: "8px 12px", borderRadius: 8, appearance: "none", cursor: "pointer" }}>
                      <option value="fitness">Fitness</option>
                      <option value="learning">Learning</option>
                      <option value="personal">Personal</option>
                      <option value="social">Social</option>
                      <option value="creative">Creative</option>
                      <option value="wellness">Wellness</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(165,180,252,0.55)" }}>Frequency</label>
                    <div className="flex gap-1.5">
                      {[{ v: "daily", label: "Daily" }, { v: "triggered", label: "On Trigger" }].map(({ v, label }) => (
                        <button key={v} onClick={() => setNewVowFrequency(v)} className="ritual-freq-btn flex-1 text-xs py-2 rounded-lg font-medium" style={{ background: newVowFrequency === v ? "rgba(99,102,241,0.18)" : "rgba(0,0,0,0.25)", color: newVowFrequency === v ? "#818cf8" : "rgba(165,180,252,0.35)", border: `1px solid ${newVowFrequency === v ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.1)"}` }}>{label}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(165,180,252,0.55)" }}>Aetherbond</label>
                  <div className="grid grid-cols-3 gap-1.5" style={vowCommitmentError ? { border: "1px solid #ef4444", borderRadius: 8, padding: 2 } : {}}>
                    {COMMITMENT_TIERS_VOW.map(tier => (
                      <button key={tier.id} onClick={() => { setNewVowCommitment(tier.id); if (vowCommitmentError) setVowCommitmentError(false); }} className="ritual-tier-btn text-left p-2 rounded-lg" style={{ background: newVowCommitment === tier.id ? `${tier.color}1a` : "rgba(0,0,0,0.2)", border: `1px solid ${newVowCommitment === tier.id ? tier.color : "rgba(255,255,255,0.07)"}`, boxShadow: newVowCommitment === tier.id ? `0 0 12px ${tier.color}55` : "none" }}>
                        <div className="text-xs font-bold" style={{ color: newVowCommitment === tier.id ? tier.color : "rgba(255,255,255,0.5)" }}>{tier.label}</div>
                        <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{tier.days > 0 ? `${tier.days}d` : "—"}</div>
                        <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", lineHeight: 1.3 }}>{tier.flavorShort}</div>
                      </button>
                    ))}
                  </div>
                  {vowCommitmentError && <p style={{ color: "#ef4444", fontSize: "0.7rem", marginTop: 4 }}>Choose a commitment duration</p>}
                </div>
                <div>
                  <button onClick={() => setNewVowBloodPact(p => !p)} className={`action-btn w-full py-2.5 px-4 rounded-xl font-semibold text-sm ${newVowBloodPact ? "blood-pact-active-indigo" : ""}`} style={{ background: newVowBloodPact ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)", color: newVowBloodPact ? "#818cf8" : "rgba(255,255,255,0.25)", border: `1px solid ${newVowBloodPact ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`, transition: "color 0.3s, background 0.3s, border 0.3s" }}>
                    {newVowBloodPact ? "Blood Pact Sealed" : "Seal Blood Pact"}
                  </button>
                  {newVowBloodPact && <p className="text-xs mt-1.5 text-center" style={{ color: "rgba(99,102,241,0.8)" }}>! Blood Pact: Failure = all rewards forfeit.</p>}
                </div>
                <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(99,102,241,0.12)" }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(165,180,252,0.4)" }}>Reward Preview</p>
                  <p className="text-xs" style={{ color: "rgba(165,180,252,0.65)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>Daily: <span style={{ color: "#818cf8", display: "inline-flex", alignItems: "center", gap: 2 }}>5 <img src="/images/icons/reward-gold.png" width={14} height={14} style={{ imageRendering: "pixelated" }} /></span> <span style={{ color: "#a78bfa" }}>10 XP</span></p>
                  {tierData.id !== "none" && <p className="text-xs mt-0.5" style={{ color: "rgba(165,180,252,0.65)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>Bond Bonus: <span style={{ color: "#818cf8", display: "inline-flex", alignItems: "center", gap: 2 }}>+{bonusGold} <img src="/images/icons/reward-gold.png" width={14} height={14} style={{ imageRendering: "pixelated" }} /></span> <span style={{ color: "#a78bfa" }}>+{bonusXp} XP</span>{newVowBloodPact && <span style={{ color: "#6366f1", fontWeight: "bold" }}> ×3</span>}</p>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={closeVowModal} className="action-btn text-sm py-2.5 px-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(165,180,252,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
                  <button onClick={createAntiRitual} className="action-btn flex-1 text-sm py-2.5 rounded-xl font-bold" style={{ background: "rgba(67,56,202,0.32)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.6)", boxShadow: "0 0 16px rgba(99,102,241,0.12)" }}>Seal Vow</button>
                </div>
              </div>
            </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => setDeleteConfirmId(null)}>
          <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: "1px solid rgba(239,68,68,0.35)", boxShadow: "0 0 40px rgba(239,68,68,0.1)" }} onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center">
              <p className="text-2xl mb-3">×</p>
              <p className="text-sm font-bold mb-1" style={{ color: "#e8d5a3" }}>Abandon this Vow?</p>
              <p className="text-xs mb-5" style={{ color: "rgba(200,170,100,0.45)" }}>Are you sure you want to forsake this sworn vow?</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 text-sm py-2 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(200,170,100,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>Keep It</button>
                <button
                  onClick={async () => {
                    const id = deleteConfirmId;
                    setDeleteConfirmId(null);
                    try {
                      await fetch(`/api/rituals/${id}`, { method: "DELETE", headers: { "x-api-key": reviewApiKey } });
                      loadAntiRituals();
                    } catch { /* ignore */ }
                  }}
                  className="flex-1 text-sm py-2 rounded-lg font-semibold"
                  style={{ background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}
                >
                  Abandon Vow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Vow Modal */}
      {extendId && (() => {
        const vowToExtend = antiRituals.find(r => r.id === extendId);
        if (!vowToExtend) return null;
        const currentDays = vowToExtend.commitmentDays ?? 0;
        const selectedTier = COMMITMENT_TIERS_VOW.find(t => t.id === extendCommitment);
        const canExtend = selectedTier && selectedTier.days > currentDays;
        const closeExtend = () => { setExtendId(null); setExtendCommitment("none"); };

        return (
          <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={closeExtend}>
            <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
              {/* NPC Portrait */}
              <div className="hidden md:flex flex-col" style={{ position: "absolute", right: -185, top: "50%", transform: "translateY(-50%)", width: 200, overflow: "visible" }}>
                <img src="/images/portraits/npc-vael.png?v=3" alt="Vael the Silent" width={256} height={384} style={{ imageRendering: "pixelated", width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 18px rgba(99,102,241,0.5))", borderRadius: "8px 8px 0 0", pointerEvents: "none" }} />
                <div style={{ background: "rgba(8,8,20,0.92)", border: "1px solid rgba(99,102,241,0.4)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#a5b4fc", lineHeight: 1.5, margin: 0 }}>&ldquo;Dein Wille vertieft sich. Der Schwur wird stärker.&rdquo;</p>
                </div>
              </div>
              <div style={{ maxWidth: 480, width: "100%", borderRadius: "1rem", background: "linear-gradient(160deg, #1e1c2c 0%, #141220 100%)", border: "1px solid rgba(99,102,241,0.3)", boxShadow: "0 0 40px rgba(99,102,241,0.07)", overscrollBehavior: "contain" }}>
                <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b" style={{ borderColor: "rgba(99,102,241,0.12)" }}>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>Schwur verlängern: {vowToExtend.title}</h3>
                    <p className="text-xs" style={{ color: "rgba(165,180,252,0.4)" }}>Aktuell: {COMMITMENT_TIERS_VOW.find(t => t.id === (vowToExtend.commitment ?? "none"))?.label ?? "Keine"} ({currentDays}d)</p>
                  </div>
                  <button onClick={closeExtend} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(165,180,252,0.55)" }}>Neuer Ätherbund (muss länger sein)</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {COMMITMENT_TIERS_VOW.filter(tier => tier.days > currentDays).map(tier => (
                        <button key={tier.id} onClick={() => setExtendCommitment(tier.id)} className="text-left p-2 rounded-lg" style={{ background: extendCommitment === tier.id ? `${tier.color}1a` : "rgba(0,0,0,0.2)", border: `1px solid ${extendCommitment === tier.id ? tier.color : "rgba(255,255,255,0.07)"}`, boxShadow: extendCommitment === tier.id ? `0 0 12px ${tier.color}55` : "none" }}>
                          <div className="text-xs font-bold" style={{ color: extendCommitment === tier.id ? tier.color : "rgba(255,255,255,0.5)" }}>{tier.label}</div>
                          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{tier.days}d</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={closeExtend} className="text-sm py-2.5 px-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(165,180,252,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>Abbrechen</button>
                    <button
                      disabled={!canExtend}
                      onClick={async () => {
                        if (!canExtend || !selectedTier) return;
                        try {
                          await fetch(`/api/rituals/${extendId}/extend`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
                            body: JSON.stringify({ newCommitment: selectedTier.id, newCommitmentDays: selectedTier.days }),
                          });
                          closeExtend();
                          loadAntiRituals();
                        } catch { /* ignore */ }
                      }}
                      className="flex-1 text-sm py-2.5 rounded-xl font-bold"
                      style={{ background: canExtend ? "rgba(67,56,202,0.32)" : "rgba(255,255,255,0.04)", color: canExtend ? "#a5b4fc" : "rgba(255,255,255,0.2)", border: `1px solid ${canExtend ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.08)"}`, cursor: canExtend ? "pointer" : "not-allowed" }}
                    >
                      Schwur verlängern
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}

      {/* Rise Again / Recommit Modal */}
      {recommitId && (() => {
        const vowToRecommit = antiRituals.find(r => r.id === recommitId);
        if (!vowToRecommit) return null;
        return (
          <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={() => setRecommitId(null)}>
            <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
              {/* NPC Portrait */}
              <div className="hidden md:flex flex-col" style={{ position: "absolute", right: -185, top: "50%", transform: "translateY(-50%)", width: 200, overflow: "visible" }}>
                <img src="/images/portraits/npc-vael.png?v=3" alt="Vael the Silent" width={256} height={384} style={{ imageRendering: "pixelated", width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 18px rgba(99,102,241,0.5))", borderRadius: "8px 8px 0 0", pointerEvents: "none" }} />
                <div style={{ background: "rgba(8,8,20,0.92)", border: "1px solid rgba(99,102,241,0.4)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#a5b4fc", lineHeight: 1.5, margin: 0 }}>&ldquo;You fell, adventurer. But you are still here. That is not nothing.&rdquo;</p>
                </div>
              </div>
              <div style={{ maxWidth: 420, width: "100%", borderRadius: "1rem", background: "linear-gradient(160deg, #1e1c2c 0%, #141220 100%)", border: "1px solid rgba(139,92,246,0.35)", boxShadow: "0 0 40px rgba(139,92,246,0.08)", overscrollBehavior: "contain" }}>
                <div className="px-5 pt-5 pb-3 text-center" style={{ borderBottom: "1px solid rgba(139,92,246,0.12)" }}>
                  <p className="text-3xl mb-2">—</p>
                  <h3 className="text-base font-bold" style={{ color: "#e2e8f0" }}>Rise Again</h3>
                  <p className="text-xs mt-1" style={{ color: "rgba(165,180,252,0.5)" }}>{vowToRecommit.title}</p>
                </div>
                {/* Mobile NPC speech */}
                <div className="md:hidden px-5 py-2.5" style={{ borderBottom: "1px solid rgba(99,102,241,0.1)", background: "rgba(8,8,20,0.4)" }}>
                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#a5b4fc", lineHeight: 1.5, margin: 0 }}>&ldquo;You fell, adventurer. But you are still here. That is not nothing.&rdquo;</p>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Your streak was broken, but the vow endures. Recommit and begin anew — your longest streak of <span style={{ color: "#a78bfa", fontWeight: 600 }}>{vowToRecommit.longestStreak ?? 0} days</span> will forever be remembered.
                  </p>
                  <p className="text-xs italic" style={{ color: "rgba(165,180,252,0.35)" }}>
                    &ldquo;Every great warrior has tasted the dirt. The ones who matter are the ones who stood back up.&rdquo;
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setRecommitId(null)} className="text-sm py-2.5 px-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(165,180,252,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>Not Yet</button>
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`/api/rituals/${recommitId}/recommit`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
                            body: JSON.stringify({ playerId: playerName }),
                          });
                          setRecommitId(null);
                          loadAntiRituals();
                        } catch { /* ignore */ }
                      }}
                      className="flex-1 text-sm py-2.5 rounded-xl font-bold"
                      style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.5)", boxShadow: "0 0 16px rgba(139,92,246,0.12)", cursor: "pointer" }}
                    >
                      x Rise Again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}
    </div>
  );
}

// ─── Smart Suggestions Panel ──────────────────────────────────────────────────

export function buildSuggestions(quests: QuestsData, agents: Agent[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const now = Date.now();
  const DAY = 86_400_000;

  // 1. Stale epic quests — parent open but no child activity for 7+ days
  const epics = quests.open.filter(q => q.children && q.children.length > 0);
  for (const epic of epics) {
    const lastActivity = Math.max(
      new Date(epic.createdAt).getTime(),
      ...(epic.children ?? []).map(c => new Date(c.createdAt).getTime()),
    );
    const staleDays = Math.floor((now - lastActivity) / DAY);
    if (staleDays >= 7) {
      suggestions.push({
        id: `stale-${epic.id}`,
        icon: "",
        title: `Epic "${epic.title}" is stale`,
        body: `No sub-quest activity for ${staleDays} days. Consider breaking it down or reassigning.`,
        accent: "#f59e0b",
        accentBg: "rgba(245,158,11,0.08)",
      });
    }
  }

  // 2. Recurring quests not recently completed (no completion in last recurrence window)
  const recurringOpen = quests.open.filter(q => q.recurrence);
  for (const q of recurringOpen) {
    const windowDays = q.recurrence === "daily" ? 1 : q.recurrence === "weekly" ? 7 : 30;
    const age = (now - new Date(q.createdAt).getTime()) / DAY;
    if (age >= windowDays) {
      suggestions.push({
        id: `recurring-${q.id}`,
        icon: "",
        title: `Recurring quest overdue: "${q.title}"`,
        body: `Scheduled ${q.recurrence} — created ${Math.floor(age)}d ago with no completion recorded.`,
        accent: "#6366f1",
        accentBg: "rgba(99,102,241,0.08)",
      });
    }
  }

  // 3. High-priority pile — 3+ high-priority open quests unclaimed
  const highOpen = quests.open.filter(q => q.priority === "high" && !q.claimedBy);
  if (highOpen.length >= 3) {
    suggestions.push({
      id: "high-pile",
      icon: "",
      title: `${highOpen.length} high-priority quests unclaimed`,
      body: `High-value work is piling up: ${highOpen.slice(0, 2).map(q => `"${q.title}"`).join(", ")}${highOpen.length > 2 ? ` +${highOpen.length - 2} more` : ""}. Consider assigning them.`,
      accent: "#ef4444",
      accentBg: "rgba(239,68,68,0.08)",
    });
  }

  // 4. Quest type imbalance — one type dominates > 70% of open quests
  if (quests.open.length >= 5) {
    const typeCounts: Record<string, number> = {};
    for (const q of quests.open) {
      const t = q.type ?? "development";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] / quests.open.length > 0.7) {
      const cfg = typeConfig[dominant[0]];
      suggestions.push({
        id: "type-imbalance",
        icon: "",
        title: `Quest type imbalance: ${Math.round((dominant[1] / quests.open.length) * 100)}% ${cfg?.label ?? dominant[0]}`,
        body: `${dominant[1]} of ${quests.open.length} open quests are ${dominant[0]}. Consider diversifying with personal, learning, or social quests.`,
        accent: cfg?.color ?? "#9ca3af",
        accentBg: cfg?.bg ?? "rgba(156,163,175,0.08)",
      });
    }
  }

  // 5. Idle agents with open quests available
  const idleAgents = agents.filter(a => a.status === "idle");
  if (idleAgents.length > 0 && quests.open.length > 0) {
    suggestions.push({
      id: "idle-agents",
      icon: "",
      title: `${idleAgents.length} agent${idleAgents.length > 1 ? "s" : ""} idle with ${quests.open.length} open quest${quests.open.length > 1 ? "s" : ""}`,
      body: `${idleAgents.map(a => a.name).join(", ")} ${idleAgents.length > 1 ? "are" : "is"} idle. There are open quests waiting to be claimed.`,
      accent: "#22c55e",
      accentBg: "rgba(34,197,94,0.08)",
    });
  }

  // 6. No learning quests — encourage knowledge capture
  const hasLearning = [...quests.open, ...quests.inProgress].some(q => q.type === "learning");
  if (!hasLearning && quests.open.length >= 3) {
    suggestions.push({
      id: "no-learning",
      icon: "",
      title: "No learning quests active",
      body: "Knowledge capture is missing from the queue. Consider adding a learning quest to build team knowledge.",
      accent: "#3b82f6",
      accentBg: "rgba(59,130,246,0.08)",
    });
  }

  return suggestions;
}

// ─── Dobbie's Demands — NPC Quest Panel ──────────────────────────────────────

import dobbieData from "../public/data/dobbieCompanion.json";
const DOBBIE_QUESTS = dobbieData.quests as { id: string; title: string; description: string; priority: "high" | "medium" | "low" }[];
const DOBBIE_MOOD_QUOTES = dobbieData.moodQuotes as Record<string, string>;

export function computeCompanionMood(streak: number, user?: { companion?: { bondLevel?: number; lastPetted?: string | null } | null } | null): { label: string; color: string; quote: string; anim: string } {
  const hour = new Date().getHours();
  const isSleeping = hour >= 23 || hour < 7;
  const bondLevel = user?.companion?.bondLevel ?? 1;
  const lastPetted = user?.companion?.lastPetted;
  const hoursSincePet = lastPetted ? (Date.now() - new Date(lastPetted).getTime()) / 3_600_000 : Infinity;
  const petRecent = hoursSincePet < 24;

  if (isSleeping) return { label: "Sleeping", color: "#818cf8", quote: DOBBIE_MOOD_QUOTES.Sleeping, anim: "" };
  if (streak >= 7 && petRecent && bondLevel >= 5) return { label: "Ecstatic", color: "#f472b6", quote: DOBBIE_MOOD_QUOTES.Ecstatic, anim: "animate-bounce" };
  if (streak >= 7 && petRecent) return { label: "Happy", color: "#22c55e", quote: DOBBIE_MOOD_QUOTES.Happy, anim: "animate-bounce" };
  if (streak >= 3 || petRecent) return { label: "Neutral", color: "#f59e0b", quote: DOBBIE_MOOD_QUOTES.Neutral, anim: "" };
  if (!petRecent && hoursSincePet > 72) return { label: "Neglected", color: "#dc2626", quote: DOBBIE_MOOD_QUOTES.Neglected, anim: "animate-pulse" };
  return { label: "Sad", color: "#ef4444", quote: DOBBIE_MOOD_QUOTES.Sad, anim: "animate-pulse" };
}

export function DobbieQuestPanel({ reviewApiKey, onRefresh, playerName, petName, quests, streak, user }: { reviewApiKey: string; onRefresh: () => void; playerName?: string; petName?: string; quests?: { inProgress: Quest[] }; streak?: number; user?: { companion?: { bondLevel?: number; lastPetted?: string | null } | null } | null }) {
  const [creating, setCreating] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  // Map<templateId, questId> for newly accepted quests this session
  const [justAccepted, setJustAccepted] = useState<Map<string, string>>(() => new Map());
  const dobbieMood = computeCompanionMood(streak ?? 0, user);

  // Derive Map<templateId, questId> for all active Dobbie quests
  const activeQuestMap = useMemo(() => {
    const map = new Map(justAccepted);
    if (quests && playerName) {
      (quests.inProgress ?? []).forEach(aq => {
        if ((aq.createdBy ?? "").toLowerCase() !== "dobbie") return;
        if (aq.claimedBy?.toLowerCase() !== playerName.toLowerCase()) return;
        const t = DOBBIE_QUESTS.find(dt => dt.title === aq.title);
        if (t && !map.has(t.id)) map.set(t.id, aq.id);
      });
    }
    return map;
  }, [quests, playerName, justAccepted]);

  const createDobbieQuest = async (q: (typeof DOBBIE_QUESTS)[0]) => {
    if (!reviewApiKey || activeQuestMap.has(q.id)) return;
    setCreating(q.id);
    try {
      const res = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: q.title,
          description: q.description,
          priority: q.priority,
          type: "personal",
          createdBy: "dobbie",
          recurrence: "daily",
          rarity: "companion",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const questId = data.quest?.id || data.id;
        if (questId && playerName) {
          await fetch(`/api/quest/${questId}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
            body: JSON.stringify({ agentId: playerName }),
          });
        }
        if (questId) setJustAccepted(prev => new Map(prev).set(q.id, questId));
        onRefresh();
      }
    } catch { /* ignore */ } finally { setCreating(null); }
  };

  const completeDobbieQuest = async (templateId: string) => {
    const questId = activeQuestMap.get(templateId);
    if (!questId || completing) return;
    setCompleting(templateId);
    try {
      const r = await fetch(`/api/quest/${questId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({ agentId: playerName }),
      });
      if (r.ok) {
        setJustAccepted(prev => { const m = new Map(prev); m.delete(templateId); return m; });
        onRefresh();
      }
    } catch { /* ignore */ } finally { setCompleting(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold" style={{ color: "#ff6b9d" }}>{petName ?? "Companion"}&apos;s Demands</p>
        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: dobbieMood.color, background: `${dobbieMood.color}18`, border: `1px solid ${dobbieMood.color}40` }}>{dobbieMood.label}</span>
      </div>
      <p className="text-xs mb-3 italic" style={{ color: "rgba(255,255,255,0.35)" }}>&ldquo;{dobbieMood.quote}&rdquo;</p>
      <div className="grid grid-cols-2 gap-2">
        {DOBBIE_QUESTS.map(q => {
          const isCreating = creating === q.id;
          const isCompleting = completing === q.id;
          const isActive = activeQuestMap.has(q.id);
          return (
            <div key={q.id} className="p-3 flex flex-col" style={{
              background: "#0e1018",
              border: "1px solid #1a1c28",
              borderTop: "1px solid rgba(255,107,157,0.15)",
              borderRadius: "2px",
            }}>
              <p className="text-xs font-bold truncate mb-1" style={{ color: "#f0f0f0" }}>{q.title}</p>
              <p className="text-xs mb-2 leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.35)" }}>{q.description}</p>
              {isActive ? (
                <div className="flex gap-2">
                  <div className="flex-1 text-center text-xs py-1.5 rounded font-semibold" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}>
                    Active
                  </div>
                  <button
                    onClick={() => completeDobbieQuest(q.id)}
                    disabled={isCompleting}
                    className="action-btn text-xs px-3 py-1.5 rounded font-semibold"
                    style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                  >
                    {isCompleting ? "..." : "Done"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => createDobbieQuest(q)}
                  disabled={!!creating}
                  className="action-btn w-full text-xs py-1.5 rounded font-semibold"
                  style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}
                >
                  {isCreating ? "Accepting..." : "Accept Quest"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SmartSuggestionsPanel({ quests, agents }: { quests: QuestsData; agents: Agent[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dismissed_suggestions") ?? "[]")); } catch { return new Set(); }
  });
  const [open, setOpen] = useState(true);

  const allSuggestions = buildSuggestions(quests, agents);
  const visible = allSuggestions.filter(s => !dismissed.has(s.id));

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    try { localStorage.setItem("dismissed_suggestions", JSON.stringify([...next])); } catch { /* ignore */ }
  };

  if (visible.length === 0) return null;

  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#a855f7" }}>
          Smart Suggestions
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}>
          {visible.length}
        </span>
        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="space-y-2">
          {visible.map(s => (
            <div
              key={s.id}
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: s.accentBg, border: `1px solid ${s.accent}30` }}
            >
              <span className="text-lg flex-shrink-0 leading-none mt-0.5">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: s.accent }}>{s.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{s.body}</p>
              </div>
              <button
                onClick={() => dismiss(s.id)}
                className="flex-shrink-0 text-xs px-2 py-1 rounded transition-all"
                style={{ color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)" }}
                title="Dismiss"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
