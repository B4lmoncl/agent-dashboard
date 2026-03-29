"use client";

import { useState, useCallback, useEffect } from "react";
import { ModalPortal, useModalBehavior } from "@/components/ModalPortal";
import { fetchRituals } from "@/app/utils";
import { getAuthHeaders } from "@/lib/auth-client";
import { STREAK_MILESTONES_CLIENT } from "@/app/config";
import { useDashboard } from "@/app/DashboardContext";
import type { Ritual } from "@/app/types";
import type { RewardCelebrationData } from "@/components/RewardCelebration";
import { Tip } from "@/components/GameTooltip";

// ─── Ritual / Vow Commitment Tiers ───────────────────────────────────────────
const COMMITMENT_TIERS = [
  { id: "none",     label: "None",     days: 0,   color: "rgba(255,255,255,0.25)", bonusGold: 0,  bonusXp: 0,  flavorShort: "No commitment" },
  { id: "spark",    label: "Spark",    days: 7,   color: "#94a3b8",                bonusGold: 3,  bonusXp: 5,  flavorShort: "First spark" },
  { id: "flame",    label: "Flame",    days: 21,  color: "#cd7f32",                bonusGold: 7,  bonusXp: 10, flavorShort: "Habit forms" },
  { id: "ember",    label: "Ember",    days: 60,  color: "#f59e0b",                bonusGold: 13, bonusXp: 20, flavorShort: "Deeply anchored" },
  { id: "crucible", label: "Crucible", days: 180, color: "#e2e8f0",                bonusGold: 20, bonusXp: 35, flavorShort: "Refined in fire" },
  { id: "eternity", label: "Eternity", days: 365, color: "#a78bfa",                bonusGold: 30, bonusXp: 50, flavorShort: "For eternity" },
];

const DIFFICULTY_TIERS = [
  { id: "easy",      label: "Easy",       color: "#4ade80", gold: 3,  xp: 8,  icon: "I",   flavor: "A gentle start",   bondScale: 0.5 },
  { id: "medium",    label: "Medium",     color: "#f59e0b", gold: 5,  xp: 15, icon: "II",  flavor: "Steady effort",    bondScale: 1.0 },
  { id: "hard",      label: "Hard",       color: "#ef4444", gold: 8,  xp: 25, icon: "III", flavor: "True discipline",  bondScale: 1.5 },
  { id: "legendary", label: "Legendary",  color: "#a78bfa", gold: 12, xp: 40, icon: "IV",  flavor: "Forged in will",   bondScale: 2.0 },
];

const BLOOD_PACT_MULTIPLIER: Record<string, number> = {
  none: 1, spark: 3, flame: 3, ember: 7, crucible: 16, eternity: 30,
};

function getSeraineSpeech(commitment: string, bloodPact: boolean): string {
  if (bloodPact) return "Den Blutknoten also. Ich werde dich nicht davon abhalten. Aber die letzte Person die hier einen Blutknoten geschworen hat, stand drei Monate später weinend vor meiner Tür. Tee?";
  if (commitment === "eternity") return "Ein Jahr. Es gibt Kriege, die kürzer dauern. Königreiche, die weniger Bestand haben. Bist du sicher?";
  if (commitment === "none") return "Kein Ziel? Mutig. Oder feige. Manchmal ist das dasselbe.";
  return "Ein neues Ritual? Gut. Sag mir nicht, warum es dir wichtig ist. Zeig es mir. Morgen. Und übermorgen.";
}

interface RitualChamberProps {
  rituals: Ritual[];
  setRituals: (rituals: Ritual[]) => void;
  setRewardCelebration: (data: RewardCelebrationData | null) => void;
}

export default function RitualChamber({ rituals, setRituals, setRewardCelebration }: RitualChamberProps) {
  const { playerName, reviewApiKey, refresh } = useDashboard();
  const [createRitualOpen, setCreateRitualOpen] = useState(false);
  const [newRitualTitle, setNewRitualTitle] = useState("");
  const [ritualNameError, setRitualNameError] = useState(false);
  const [ritualCommitmentError, setRitualCommitmentError] = useState(false);
  const [newRitualSchedule, setNewRitualSchedule] = useState("daily");
  const [newRitualCategory, setNewRitualCategory] = useState("personal");
  const [newRitualCommitment, setNewRitualCommitment] = useState("none");
  const [newRitualBloodPact, setNewRitualBloodPact] = useState(false);
  const [newRitualDifficulty, setNewRitualDifficulty] = useState("medium");
  const [deleteRitualConfirmId, setDeleteRitualConfirmId] = useState<string | null>(null);
  const [extendRitualId, setExtendRitualId] = useState<string | null>(null);
  const [extendRitualCommitment, setExtendRitualCommitment] = useState("none");
  const [recommitRitualId, setRecommitRitualId] = useState<string | null>(null);

  // ─── Habit System ─────────────────────────────────────────────────────────
  interface Habit { id: string; title: string; positive: boolean; negative: boolean; color: string; score: number; playerId: string; createdAt: string; }
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitsOpen, setHabitsOpen] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [habitScoring, setHabitScoring] = useState<string | null>(null);

  const fetchHabits = useCallback(async () => {
    if (!playerName) return;
    try {
      const r = await fetch(`/api/habits?player=${encodeURIComponent(playerName)}`);
      if (r.ok) setHabits(await r.json());
    } catch { /* ignore */ }
  }, [playerName]);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const createHabit = async () => {
    if (!newHabitTitle.trim() || !reviewApiKey || !playerName) return;
    try {
      const r = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ title: newHabitTitle.trim(), positive: true, negative: true, playerId: playerName }),
      });
      if (r.ok) { setNewHabitTitle(""); fetchHabits(); }
    } catch { /* network error — habit not created */ }
  };

  const [habitFlash, setHabitFlash] = useState<{ id: string; dir: "up" | "down" } | null>(null);
  const scoreHabit = async (habitId: string, direction: "up" | "down") => {
    if (!reviewApiKey || !playerName || habitScoring) return;
    setHabitScoring(habitId);
    setHabitFlash({ id: habitId, dir: direction });
    setTimeout(() => setHabitFlash(null), 800);
    try {
      const r = await fetch(`/api/habits/${habitId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ direction, playerId: playerName }),
      });
      if (r.ok) fetchHabits();
    } catch { /* ignore */ }
    setHabitScoring(null);
  };

  const deleteHabit = async (habitId: string) => {
    if (!reviewApiKey) return;
    try {
      await fetch(`/api/habits/${habitId}`, { method: "DELETE", headers: getAuthHeaders(reviewApiKey) });
      fetchHabits();
    } catch { /* ignore */ }
  };

  const HABIT_COLORS: Record<string, string> = { red: "#ef4444", orange: "#f97316", gray: "#6b7280", yellow: "#eab308", green: "#22c55e", blue: "#3b82f6" };

  const closeRitualModal = useCallback(() => {
    setCreateRitualOpen(false); setNewRitualTitle(""); setNewRitualCommitment("none"); setNewRitualBloodPact(false); setNewRitualDifficulty("medium");
  }, []);
  useModalBehavior(createRitualOpen, closeRitualModal);

  const closeDeleteRitualConfirm = useCallback(() => setDeleteRitualConfirmId(null), []);
  useModalBehavior(!!deleteRitualConfirmId, closeDeleteRitualConfirm);

  const closeExtendRitual = useCallback(() => { setExtendRitualId(null); setExtendRitualCommitment("none"); }, []);
  useModalBehavior(!!extendRitualId, closeExtendRitual);

  const closeRecommitRitual = useCallback(() => setRecommitRitualId(null), []);
  useModalBehavior(!!recommitRitualId, closeRecommitRitual);

  const playerRituals = rituals.filter(r => r.playerId === playerName?.toLowerCase());
  const renderRitualCard = (ritual: Ritual) => {
    const today = new Date().toISOString().slice(0, 10);
    const doneToday = ritual.lastCompleted === today;
    const isBroken = ritual.status === "broken";
    const milestone = STREAK_MILESTONES_CLIENT.reduce<{days:number;badge:string;label:string;icon?:string}|null>((acc, m) => ritual.streak >= m.days ? m : acc, null);
    const commitGoal = ritual.commitmentDays && ritual.commitmentDays > 0 ? ritual.commitmentDays : null;
    const nextMilestone = commitGoal
      ? (ritual.streak < commitGoal ? { days: commitGoal, badge: "\uD83C\uDFC6", label: "Commitment" } : null)
      : STREAK_MILESTONES_CLIENT.find(m => ritual.streak < m.days);
    const progress = nextMilestone ? (ritual.streak / nextMilestone.days) * 100 : 100;
    const longestStreak = ritual.longestStreak ?? ritual.streak;
    const lastCompletedFormatted = ritual.lastCompleted
      ? new Date(ritual.lastCompleted + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "short" })
      : null;
    // Flame intensity based on streak
    const flameColor = isBroken ? "#ef4444" : ritual.streak >= 30 ? "#f59e0b" : ritual.streak >= 14 ? "#f97316" : ritual.streak >= 7 ? "#ef4444" : "rgba(255,255,255,0.25)";
    const flameGlow = isBroken ? "0 0 8px rgba(239,68,68,0.3)" : ritual.streak >= 7 ? `0 0 8px ${flameColor}44` : "none";
    return (
      <div key={ritual.id} className={`rounded-xl p-3${!isBroken && !doneToday && ritual.streak >= 7 ? " crystal-breathe" : ""}`} style={{
        background: isBroken ? "rgba(239,68,68,0.04)" : doneToday ? "rgba(34,197,94,0.06)" : "#252525",
        border: `1px solid ${isBroken ? "rgba(239,68,68,0.3)" : doneToday ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)"}`,
        opacity: doneToday ? 0.8 : 1,
        ...(!isBroken && !doneToday && ritual.streak >= 7 ? { ["--glow-color" as string]: ritual.streak >= 30 ? "rgba(245,158,11,0.15)" : "rgba(168,85,247,0.15)" } : {}),
      }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Streak flame counter */}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ color: flameColor, background: `${flameColor}12`, border: `1px solid ${flameColor}30`, boxShadow: flameGlow, fontSize: 12 }}>
                <span style={{ fontSize: 13 }}>{ritual.streak >= 7 ? "★" : "●"}</span>
                {ritual.streak}
              </span>
              <span className="text-sm font-medium truncate" style={{ color: doneToday ? "rgba(255,255,255,0.4)" : "#e8e8e8", textDecoration: doneToday ? "line-through" : "none" }}>{ritual.title}</span>
              {doneToday && <span style={{ color: "#22c55e", fontSize: 14, fontWeight: 700 }}>{"\u2713"}</span>}
              {ritual.bloodPact && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold" style={{ color: "#ef4444", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 12, letterSpacing: "0.04em" }}>
                  <Tip k="blood_pact">Blood Pact</Tip>
                </span>
              )}
              {milestone && (milestone.icon ? <img src={milestone.icon} alt={milestone.badge} width={20} height={20} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-xs">{milestone.badge}</span>)}
            </div>
            <div className="flex items-center gap-3 text-xs flex-wrap text-w35">
              <span style={{ color: ritual.streak >= 21 ? "#818cf8" : ritual.streak >= 7 ? "#f97316" : "rgba(255,255,255,0.35)" }}>
                <Tip k="streak">{ritual.streak} Day Streak</Tip>
              </span>
              {longestStreak > 0 && (
                <span title="Longest streak" style={{ color: "rgba(245,158,11,0.5)" }}>
                  Best: {longestStreak}
                </span>
              )}
              {lastCompletedFormatted && (
                <span title="Last completed" className="text-w20">
                  {doneToday ? "Today" : lastCompletedFormatted}
                </span>
              )}
              <span>{ritual.schedule.type === 'daily' ? 'daily' : ritual.schedule.days?.join(', ')}</span>
              <span>{ritual.rewards.xp} XP · {ritual.rewards.gold} Gold</span>
            </div>
            {ritual.bloodPact && commitGoal && !ritual.pactCompleted && (
              <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: "rgba(239,68,68,0.6)" }}>
                <span style={{ fontSize: 12 }}>⬥</span>
                <span>Pact Goal: <span style={{ color: "#ef4444", fontWeight: 600 }}>{commitGoal}d</span></span>
                <span>·</span>
                <span style={{ color: ritual.streak >= commitGoal ? "#22c55e" : "rgba(239,68,68,0.8)", fontWeight: 600 }}>
                  {ritual.streak >= commitGoal ? "Fulfilled!" : `${commitGoal - ritual.streak}d remaining`}
                </span>
              </div>
            )}
            {ritual.bloodPact && ritual.pactCompleted && (
              <div className="flex items-center gap-1.5 mt-1 text-xs" style={{ color: "rgba(34,197,94,0.7)" }}>
                <span style={{ fontSize: 12 }}>✦</span>
                <span style={{ fontWeight: 600 }}>Blood Pact fulfilled</span>
              </div>
            )}
            {nextMilestone && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1 text-w25">
                  <span>Next goal in {nextMilestone.days - ritual.streak}d: <span style={{ color: nextMilestone.label === "Bronze" ? "#cd7f32" : nextMilestone.label === "Silber" ? "#c0c0c0" : nextMilestone.label === "Gold" ? "#ffd700" : nextMilestone.label === "Diamond" ? "#b9f2ff" : "#a78bfa", fontWeight: 700 }}>{nextMilestone.label}</span></span>
                  <span>{ritual.streak}/{nextMilestone.days}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-w8">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "rgba(167,139,250,0.6)" }} />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isBroken ? (
              <>
                <button
                  onClick={() => setRecommitRitualId(ritual.id)}
                  disabled={!reviewApiKey}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
                  style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.4)", cursor: !reviewApiKey ? "not-allowed" : "pointer", boxShadow: "0 0 10px rgba(167,139,250,0.1)", opacity: !reviewApiKey ? 0.5 : 1 }}
                  title={!reviewApiKey ? "Log in to rise again" : "Recommit to this ritual"}
                >
                  Rise Again
                </button>
                {reviewApiKey && (
                  <button onClick={() => setDeleteRitualConfirmId(ritual.id)} className="text-xs px-2 py-1.5 rounded-lg transition-all" style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.5)", border: "1px solid rgba(239,68,68,0.15)", cursor: 'pointer' }} title="Delete ritual">×</button>
                )}
              </>
            ) : (
              <>
                <button
                  disabled={doneToday || !reviewApiKey}
                  onClick={async () => {
                    if (!reviewApiKey || !playerName) return;
                    try {
                      const r = await fetch(`/api/rituals/${ritual.id}/complete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(reviewApiKey) },
                        body: JSON.stringify({ playerId: playerName }),
                      });
                      const data = await r.json();
                      if (data.ok) {
                        fetchRituals(playerName).then(setRituals);
                        // Show reward celebration for ritual completion
                        setRewardCelebration({
                          type: ritual.isAntiRitual ? "vow" : "ritual",
                          title: ritual.title,
                          xpEarned: data.xpEarned || 0,
                          goldEarned: data.goldEarned || 0,
                          loot: data.lootDrop || data.milestoneDrop || null,
                          streak: data.ritual?.streak || ritual.streak,
                          pactBonus: data.pactCompletion || null,
                        });
                        refresh();
                      }
                    } catch { /* network error — retry silently */ }
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all"
                  style={{
                    background: doneToday ? "rgba(34,197,94,0.08)" : "rgba(167,139,250,0.15)",
                    color: doneToday ? "rgba(34,197,94,0.5)" : "#a78bfa",
                    border: `1px solid ${doneToday ? "rgba(34,197,94,0.2)" : "rgba(167,139,250,0.3)"}`,
                    cursor: doneToday ? 'default' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!doneToday) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(167,139,250,0.28)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(167,139,250,0.55)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 10px rgba(167,139,250,0.2)"; } }}
                  onMouseLeave={e => { if (!doneToday) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(167,139,250,0.15)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(167,139,250,0.3)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; } }}
                >
                  {doneToday ? "✓ Done" : "Check off"}
                </button>
                {reviewApiKey && !ritual.bloodPact && (
                  <button
                    onClick={() => { setExtendRitualId(ritual.id); setExtendRitualCommitment(ritual.commitment ?? "none"); }}
                    className="text-xs px-2 py-1.5 rounded-lg transition-all"
                    style={{ background: "rgba(245,158,11,0.06)", color: "rgba(245,158,11,0.5)", border: "1px solid rgba(245,158,11,0.15)", cursor: 'pointer' }}
                    title="Extend ritual duration"
                  >
                    Extend
                  </button>
                )}
                {reviewApiKey && (
                  <button onClick={() => setDeleteRitualConfirmId(ritual.id)} className="text-xs px-2 py-1.5 rounded-lg transition-all" style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.5)", border: "1px solid rgba(239,68,68,0.15)", cursor: 'pointer' }} title="Delete ritual">×</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div data-feedback-id="ritual-chamber" className="section-ritual tab-content-enter">
        {/* ── Top flex row: Portrait left, content right ── */}
        <div className="flex gap-4 mb-4" style={{ alignItems: "flex-start" }}>
          {/* Portrait column with speech bubble */}
          <div className="flex-none" style={{ width: 195, overflow: "visible" }}>
            <img src="/images/portraits/npc-seraine.png?v=3" alt="Seraine Ashwell" width={256} height={384} className="img-render-auto" style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.35))", borderRadius: "4px 4px 0 0", pointerEvents: "none" }} onError={e => { e.currentTarget.style.display = "none"; }} />
            <div style={{ background: "rgba(25,17,5,0.88)", border: "1px solid rgba(245,158,11,0.3)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "8px 10px" }}>
              <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>„Jedes Feuer beginnt mit einem Funken. Deins auch."</p>
            </div>
          </div>
          {/* Right: title + create button + first 2 cards */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold uppercase tracking-widest" style={{ color: "#f59e0b", fontSize: "1rem" }}><Tip k="rituals" heading>Ritual Chamber</Tip></h3>
                <p style={{ color: "rgba(245,158,11,0.6)", fontSize: "1rem", fontWeight: 600, marginTop: 2 }}>Seraine Ashwell</p>
                <p className="text-xs italic" style={{ color: "rgba(245,158,11,0.3)", marginTop: 2 }}>Wo tägliche Hingabe zu außergewöhnlicher Kraft wird.</p>
              </div>
              {playerName && reviewApiKey && (
                <button onClick={() => setCreateRitualOpen(true)} className="action-btn text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.35)", boxShadow: "0 0 10px rgba(245,158,11,0.08)" }}>
                  ＋ Create Ritual
                </button>
              )}
            </div>
            {playerRituals.length === 0 ? (
              <div className="rounded-xl p-5 text-center bg-card border-w6">
                <p className="text-xs mb-2 text-w25">No rituals. Create your first daily ritual!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {playerRituals.slice(0, 2).map(renderRitualCard)}
              </div>
            )}
          </div>
        </div>
        {/* Remaining cards (3+) at full width */}
        {playerRituals.length > 2 && (
          <div className="space-y-2">
            {playerRituals.slice(2).map(renderRitualCard)}
          </div>
        )}
        {/* ─── Habits Section ─── */}
        {playerName && reviewApiKey && (
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => setHabitsOpen(!habitsOpen)}
              className="flex items-center justify-between w-full mb-3"
              style={{ cursor: "pointer" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Habits</span>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{habits.length}</span>
              </div>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{habitsOpen ? "▲" : "▼"}</span>
            </button>

            {habitsOpen && (
              <div className="space-y-2 tab-content-enter">
                {/* Create habit */}
                <div className="flex gap-2">
                  <input
                    value={newHabitTitle}
                    onChange={e => setNewHabitTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && createHabit()}
                    placeholder="New habit..."
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg input-dark"
                  />
                  <button
                    onClick={createHabit}
                    disabled={!newHabitTitle.trim()}
                    title={!newHabitTitle.trim() ? "Enter a habit name" : "Create habit"}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{
                      background: newHabitTitle.trim() ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                      color: newHabitTitle.trim() ? "#22c55e" : "rgba(255,255,255,0.2)",
                      border: `1px solid ${newHabitTitle.trim() ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                      cursor: newHabitTitle.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    + Add
                  </button>
                </div>

                {/* Habit list */}
                {habits.length === 0 && (
                  <p className="text-xs text-w20 text-center py-2">No habits yet. Habits track recurring behaviors with + / - scoring.</p>
                )}
                {habits.map(h => {
                  const color = HABIT_COLORS[h.color] || HABIT_COLORS.gray;
                  return (
                    <div
                      key={h.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}25` }}
                    >
                      <button
                        onClick={() => scoreHabit(h.id, "up")}
                        disabled={habitScoring === h.id}
                        title="+1 (good)"
                        className="text-xs w-7 h-7 rounded flex items-center justify-center font-bold"
                        style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", cursor: habitScoring === h.id ? "not-allowed" : "pointer" }}
                      >+</button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{h.title}</p>
                      </div>
                      <span className={`text-sm font-mono font-bold${habitFlash?.id === h.id ? (habitFlash.dir === "up" ? " stat-flash-up" : " stat-flash-down") : ""}`} style={{ color, minWidth: 24, textAlign: "center" }}>{h.score}</span>
                      <button
                        onClick={() => scoreHabit(h.id, "down")}
                        disabled={habitScoring === h.id}
                        title="-1 (bad)"
                        className="text-xs w-7 h-7 rounded flex items-center justify-center font-bold"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: habitScoring === h.id ? "not-allowed" : "pointer" }}
                      >-</button>
                      <button
                        onClick={() => deleteHabit(h.id)}
                        title="Delete habit"
                        className="text-xs w-7 h-7 rounded flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
                      >x</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create Ritual Modal — simplified, no portrait */}
        {createRitualOpen && (() => {
          const closeRitualModal = () => { setCreateRitualOpen(false); setNewRitualTitle(""); setRitualNameError(false); setRitualCommitmentError(false); setNewRitualCommitment("none"); setNewRitualBloodPact(false); setNewRitualDifficulty("medium"); };
          const submitRitual = async () => {
            if (!newRitualTitle.trim()) { setRitualNameError(true); return; }
            if (newRitualCommitment === "none") { setRitualCommitmentError(true); return; }
            if (!reviewApiKey || !playerName) return;
            const tier = COMMITMENT_TIERS.find(t => t.id === newRitualCommitment) ?? COMMITMENT_TIERS[0];
            const diff = DIFFICULTY_TIERS.find(d => d.id === newRitualDifficulty) ?? DIFFICULTY_TIERS[1];
            await fetch('/api/rituals', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders(reviewApiKey) }, body: JSON.stringify({ title: newRitualTitle.trim(), schedule: { type: newRitualSchedule }, playerId: playerName, createdBy: playerName, category: newRitualCategory, commitment: newRitualCommitment, commitmentDays: tier.days, bloodPact: newRitualBloodPact, difficulty: newRitualDifficulty, rewards: { xp: diff.xp, gold: diff.gold } }) });
            closeRitualModal();
            fetchRituals(playerName).then(setRituals);
          };
          const tierData = COMMITMENT_TIERS.find(t => t.id === newRitualCommitment) ?? COMMITMENT_TIERS[0];
          const diffData = DIFFICULTY_TIERS.find(d => d.id === newRitualDifficulty) ?? DIFFICULTY_TIERS[1];
          const pactMulti = newRitualBloodPact ? (BLOOD_PACT_MULTIPLIER[newRitualCommitment] || 3) : 1;
          const bonusGold = Math.round(tierData.bonusGold * diffData.bondScale);
          const bonusXp = Math.round(tierData.bonusXp * diffData.bondScale);
          const pactCompletionGold = newRitualBloodPact ? Math.round(tierData.bonusGold * diffData.bondScale * pactMulti) : 0;
          const pactCompletionXp = newRitualBloodPact ? Math.round(tierData.bonusXp * diffData.bondScale * pactMulti) : 0;
          return (
            <ModalPortal>
            <div data-feedback-id="ritual-chamber.create-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={closeRitualModal}>
              <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                {/* NPC Portrait — absolute left of modal, hidden on mobile */}
                <div className="hidden md:flex flex-col" style={{ position: "absolute", right: "calc(100% + 4px)", top: "50%", transform: "translateY(-50%)", width: 200, overflow: "visible" }}>
                  <img src="/images/portraits/npc-seraine.png?v=3" alt="Seraine Ashwell" width={256} height={384} className="img-render-auto" style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.4))", borderRadius: "8px 8px 0 0", pointerEvents: "none" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                  <div style={{ background: "rgba(25,17,5,0.92)", border: "1px solid rgba(245,158,11,0.4)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                    <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>{getSeraineSpeech(newRitualCommitment, newRitualBloodPact)}</p>
                  </div>
                </div>
              <div style={{ maxWidth: 1000, width: "100%", borderRadius: "1rem", background: newRitualBloodPact ? "linear-gradient(160deg, #2c1a1a 0%, #1e1010 100%)" : "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: `1px solid ${newRitualBloodPact ? "rgba(239,68,68,0.45)" : "rgba(245,158,11,0.3)"}`, boxShadow: newRitualBloodPact ? "0 0 60px rgba(239,68,68,0.12)" : "0 0 40px rgba(167,139,250,0.08)", transition: "all 0.4s ease" }}>
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b" style={{ borderColor: "rgba(245,158,11,0.12)" }}>
                  <img src="/images/icons/ui-ritual-rune.png" alt="" width={28} height={28} className="img-render-auto" onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: "#e8d5a3" }}>Forge a New Rite</h3>
                    <p className="text-xs" style={{ color: "rgba(200,170,100,0.4)" }}>Seraine Ashwell — Ritual Chamber</p>
                  </div>
                  <button onClick={closeRitualModal} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.6)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ""; }}>×</button>
                </div>
                {/* Mobile-only speech */}
                <div className="md:hidden px-5 py-2.5" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)", background: "rgba(25,17,5,0.4)" }}>
                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>{getSeraineSpeech(newRitualCommitment, newRitualBloodPact)}</p>
                </div>
                {/* Form */}
                <div className="p-5 space-y-4" style={{ paddingBottom: "1.75rem" }}>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(200,170,100,0.55)" }}>Ritual Name</label>
                    <input value={newRitualTitle} onChange={e => { setNewRitualTitle(e.target.value); if (ritualNameError) setRitualNameError(false); }} placeholder="Name your ritual..." className="w-full text-sm px-3 py-2.5 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: ritualNameError ? "1px solid #ef4444" : "1px solid rgba(245,158,11,0.25)", color: "#e8d5a3", outline: "none" }} onKeyDown={e => e.key === "Enter" && submitRitual()} autoFocus />
                    {ritualNameError && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 4 }}>Please enter a ritual name</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(200,170,100,0.55)" }}>Category</label>
                      <select value={newRitualCategory} onChange={e => setNewRitualCategory(e.target.value)} className="w-full text-sm rounded-lg text-bright" style={{ background: "#1a1a2e", border: "1px solid rgba(245,158,11,0.3)", outline: "none", padding: "8px 12px", borderRadius: 8, appearance: "none", cursor: "pointer" }}>
                        <option value="fitness">Fitness</option>
                        <option value="learning">Learning</option>
                        <option value="personal">Personal</option>
                        <option value="social">Social</option>
                        <option value="creative">Creative</option>
                        <option value="wellness">Wellness</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(200,170,100,0.55)" }}>Frequency</label>
                      <div className="flex gap-1.5">
                        {[{ v: "daily", label: "Daily" }, { v: "weekly", label: "Weekly" }].map(({ v, label }) => (
                          <button key={v} onClick={() => setNewRitualSchedule(v)} className="ritual-freq-btn flex-1 text-xs py-2 rounded-lg font-medium" style={{ background: newRitualSchedule === v ? "rgba(245,158,11,0.2)" : "rgba(0,0,0,0.25)", color: newRitualSchedule === v ? "#f59e0b" : "rgba(200,170,100,0.4)", border: `1px solid ${newRitualSchedule === v ? "rgba(245,158,11,0.45)" : "rgba(245,158,11,0.1)"}` }}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(200,170,100,0.55)" }}>Difficulty</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {DIFFICULTY_TIERS.map(d => (
                        <button key={d.id} onClick={() => setNewRitualDifficulty(d.id)} className="ritual-tier-btn text-center p-2 rounded-lg" style={{ background: newRitualDifficulty === d.id ? `${d.color}22` : "rgba(0,0,0,0.2)", border: `1px solid ${newRitualDifficulty === d.id ? d.color : "rgba(255,255,255,0.07)"}`, boxShadow: newRitualDifficulty === d.id ? `0 0 12px ${d.color}44` : "none" }}>
                          <div className="text-xs font-bold" style={{ color: newRitualDifficulty === d.id ? d.color : "rgba(255,255,255,0.55)" }}>{d.label}</div>
                          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{d.icon}</div>
                          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.22)", lineHeight: 1.3 }}>{d.flavor}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(200,170,100,0.55)" }}><Tip k="aetherbond">Aetherbond</Tip></label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" style={ritualCommitmentError ? { border: "1px solid #ef4444", borderRadius: 8, padding: 2 } : {}}>
                      {COMMITMENT_TIERS.map(tier => (
                        <button key={tier.id} onClick={() => { setNewRitualCommitment(tier.id); if (ritualCommitmentError) setRitualCommitmentError(false); }} className="ritual-tier-btn text-left p-2 rounded-lg" style={{ background: newRitualCommitment === tier.id ? `${tier.color}22` : "rgba(0,0,0,0.2)", border: `1px solid ${newRitualCommitment === tier.id ? tier.color : "rgba(255,255,255,0.07)"}`, boxShadow: newRitualCommitment === tier.id ? `0 0 12px ${tier.color}55` : "none" }}>
                          <div className="text-xs font-bold" style={{ color: newRitualCommitment === tier.id ? tier.color : "rgba(255,255,255,0.55)" }}>{tier.label}</div>
                          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{tier.days > 0 ? `${tier.days}d` : "—"}</div>
                          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.22)", lineHeight: 1.3 }}>{tier.flavorShort}</div>
                        </button>
                      ))}
                    </div>
                    {ritualCommitmentError && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 4 }}>Choose a commitment duration</p>}
                  </div>
                  <div>
                    <button onClick={() => setNewRitualBloodPact(p => !p)} className={`action-btn w-full py-2.5 px-4 rounded-xl font-semibold text-sm ${newRitualBloodPact ? "blood-pact-active" : ""}`} style={{ background: newRitualBloodPact ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.04)", color: newRitualBloodPact ? "#ef4444" : "rgba(255,255,255,0.28)", border: `1px solid ${newRitualBloodPact ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`, transition: "color 0.3s, background 0.3s, border 0.3s" }}>
                      {newRitualBloodPact ? <Tip k="blood_pact">Blood Pact Sealed</Tip> : <Tip k="blood_pact">Seal Blood Pact</Tip>}
                    </button>
                    {newRitualBloodPact && <p className="text-xs mt-1.5 text-center" style={{ color: "rgba(239,68,68,0.7)" }}>! Blood Pact: Failure = all rewards forfeit.</p>}
                  </div>
                  <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(245,158,11,0.1)" }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(200,170,100,0.45)" }}>Reward Preview</p>
                    <p className="text-xs mb-1" style={{ color: "rgba(200,170,100,0.35)", fontStyle: "italic", letterSpacing: "0.03em" }}>Daily on check-off:</p>
                    <p className="text-xs" style={{ color: "rgba(200,170,100,0.65)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>Base <span style={{ color: diffData.color, fontSize: "0.75rem" }}>({diffData.label})</span>: <span style={{ color: "#f59e0b", display: "inline-flex", alignItems: "center", gap: 2 }}>{diffData.gold} <img src="/images/icons/reward-gold.png" width={20} height={20} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /></span> <span style={{ color: "#a78bfa" }}>{diffData.xp} XP</span></p>
                    {tierData.id !== "none" && <p className="text-xs mt-0.5" style={{ color: "rgba(200,170,100,0.65)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>Bond Bonus{diffData.bondScale !== 1 && <span style={{ color: diffData.color, fontSize: "0.75rem" }}> ×{diffData.bondScale}</span>}: <span style={{ color: "#f59e0b", display: "inline-flex", alignItems: "center", gap: 2 }}>+{bonusGold} <img src="/images/icons/reward-gold.png" width={20} height={20} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /></span> <span style={{ color: "#a78bfa" }}>+{bonusXp} XP</span></p>}
                    {(bonusGold > 0 || bonusXp > 0) && <p className="text-xs mt-1" style={{ color: "rgba(200,170,100,0.85)", display: "flex", alignItems: "center", gap: 4, fontWeight: 600, flexWrap: "wrap" }}>= Täglich: <span style={{ color: "#f59e0b", display: "inline-flex", alignItems: "center", gap: 2 }}>{diffData.gold + bonusGold} <img src="/images/icons/reward-gold.png" width={20} height={20} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /></span> <span style={{ color: "#a78bfa" }}>{diffData.xp + bonusXp} XP</span></p>}
                    {newRitualBloodPact && pactCompletionXp > 0 && <>
                      <div style={{ borderTop: "1px solid rgba(239,68,68,0.15)", margin: "8px 0 6px" }} />
                      <p className="text-xs mb-0.5" style={{ color: "rgba(239,68,68,0.5)", fontStyle: "italic", letterSpacing: "0.03em" }}>Einmalig nach {tierData.days}d Abschluss <span style={{ fontWeight: 600 }}>(Pact ×{pactMulti})</span>:</p>
                      <p className="text-xs" style={{ color: "rgba(239,68,68,0.8)", display: "flex", alignItems: "center", gap: 4, fontWeight: 600, flexWrap: "wrap" }}><span style={{ color: "#f59e0b", display: "inline-flex", alignItems: "center", gap: 2 }}>{pactCompletionGold} <img src="/images/icons/reward-gold.png" width={20} height={20} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /></span> <span style={{ color: "#a78bfa" }}>{pactCompletionXp} XP</span></p>
                    </>}
                    <p className="text-xs mt-2 mb-0.5" style={{ color: "rgba(200,170,100,0.35)", fontStyle: "italic", letterSpacing: "0.03em" }}>Bei Streak-Meilenstein:</p>
                    <p className="text-xs" style={{ color: "rgba(200,170,100,0.5)" }}>Loot-Drops bei 3, 7, 14, 30, 60, 90 Tagen</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={closeRitualModal} className="action-btn text-sm py-2.5 px-5 rounded-xl bg-w4 border-w8" style={{ color: "rgba(200,170,100,0.38)" }}>Cancel</button>
                    <button onClick={submitRitual} className="action-btn flex-1 text-sm py-2.5 rounded-xl font-bold" style={{ background: "rgba(245,158,11,0.22)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.55)", boxShadow: "0 0 16px rgba(245,158,11,0.12)" }}>Forge Ritual</button>
                  </div>
                </div>
              </div>
              </div>
            </div>
            </ModalPortal>
          );
        })()}
      </div>

      {/* Delete Ritual Confirm Modal */}
      {deleteRitualConfirmId && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setDeleteRitualConfirmId(null)}>
          <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: "1px solid rgba(239,68,68,0.35)", boxShadow: "0 0 40px rgba(239,68,68,0.1)" }} onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center">
              <p className="text-2xl mb-3">×</p>
              <p className="text-sm font-bold mb-1" style={{ color: "#e8d5a3" }}>Break this Ritual?</p>
              <p className="text-xs mb-5" style={{ color: "rgba(200,170,100,0.45)" }}>Are you sure you want to shatter this daily rite?</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteRitualConfirmId(null)} className="flex-1 text-sm py-2 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(200,170,100,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>Keep It</button>
                <button
                  onClick={async () => {
                    const id = deleteRitualConfirmId;
                    setDeleteRitualConfirmId(null);
                    try {
                      await fetch(`/api/rituals/${id}`, { method: 'DELETE', headers: { ...getAuthHeaders(reviewApiKey) } });
                      if (playerName) fetchRituals(playerName).then(setRituals);
                    } catch { /* ignore */ }
                  }}
                  className="flex-1 text-sm py-2 rounded-lg font-semibold"
                  style={{ background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}
                >
                  Break Ritual
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Extend Ritual Modal */}
      {extendRitualId && (() => {
        const ritualToExtend = rituals.find(r => r.id === extendRitualId);
        if (!ritualToExtend) return null;
        const currentDays = ritualToExtend.commitmentDays ?? 0;
        const selectedTier = COMMITMENT_TIERS.find(t => t.id === extendRitualCommitment);
        const canExtend = selectedTier && selectedTier.days > currentDays;
        const closeExtend = () => { setExtendRitualId(null); setExtendRitualCommitment("none"); };

        return (
          <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={closeExtend}>
            <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
              <div className="hidden md:flex flex-col" style={{ position: "absolute", right: "calc(100% + 4px)", top: "50%", transform: "translateY(-50%)", width: 200, overflow: "visible" }}>
                <img src="/images/portraits/npc-seraine.png?v=3" alt="Seraine Ashwell" width={256} height={384} className="img-render-auto" style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.4))", borderRadius: "8px 8px 0 0", pointerEvents: "none" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                <div style={{ background: "rgba(25,17,5,0.92)", border: "1px solid rgba(245,158,11,0.4)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>&ldquo;Das Feuer wächst. Gut. Nähre es.&rdquo;</p>
                </div>
              </div>
              <div style={{ maxWidth: 480, width: "100%", borderRadius: "1rem", background: "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 40px rgba(245,158,11,0.07)" }}>
                <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b" style={{ borderColor: "rgba(245,158,11,0.12)" }}>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: "#e8d5a3" }}>Ritual verlängern: {ritualToExtend.title}</h3>
                    <p className="text-xs" style={{ color: "rgba(200,170,100,0.4)" }}>Aktuell: {COMMITMENT_TIERS.find(t => t.id === (ritualToExtend.commitment ?? "none"))?.label ?? "Keine"} ({currentDays}d)</p>
                  </div>
                  <button onClick={closeExtend} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(200,170,100,0.55)" }}>Neuer Ätherbund (muss länger sein)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {COMMITMENT_TIERS.filter(tier => tier.days > currentDays).map(tier => (
                        <button key={tier.id} onClick={() => setExtendRitualCommitment(tier.id)} className="text-left p-2 rounded-lg" style={{ background: extendRitualCommitment === tier.id ? `${tier.color}1a` : "rgba(0,0,0,0.2)", border: `1px solid ${extendRitualCommitment === tier.id ? tier.color : "rgba(255,255,255,0.07)"}`, boxShadow: extendRitualCommitment === tier.id ? `0 0 12px ${tier.color}55` : "none" }}>
                          <div className="text-xs font-bold" style={{ color: extendRitualCommitment === tier.id ? tier.color : "rgba(255,255,255,0.5)" }}>{tier.label}</div>
                          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{tier.days}d</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={closeExtend} className="text-sm py-2.5 px-5 rounded-xl bg-w4 border-w8" style={{ color: "rgba(200,170,100,0.35)" }}>Cancel</button>
                    <button
                      disabled={!canExtend}
                      onClick={async () => {
                        if (!canExtend || !selectedTier) return;
                        try {
                          await fetch(`/api/rituals/${extendRitualId}/extend`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                            body: JSON.stringify({ newCommitment: selectedTier.id, newCommitmentDays: selectedTier.days }),
                          });
                          closeExtend();
                          if (playerName) { const updated = await fetchRituals(playerName); setRituals(updated); }
                        } catch { /* ignore */ }
                      }}
                      className="flex-1 text-sm py-2.5 rounded-xl font-bold"
                      style={{ background: canExtend ? "rgba(180,130,50,0.32)" : "rgba(255,255,255,0.04)", color: canExtend ? "#e8d5a3" : "rgba(255,255,255,0.2)", border: `1px solid ${canExtend ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.08)"}`, cursor: canExtend ? "pointer" : "not-allowed" }}
                    >
                      Ritual verlängern
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}

      {/* Rise Again / Recommit Ritual Modal */}
      {recommitRitualId && (() => {
        const ritualToRecommit = rituals.find(r => r.id === recommitRitualId);
        if (!ritualToRecommit) return null;
        return (
          <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={() => setRecommitRitualId(null)}>
            <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
              <div className="hidden md:flex flex-col" style={{ position: "absolute", right: "calc(100% + 4px)", top: "50%", transform: "translateY(-50%)", width: 200, overflow: "visible" }}>
                <img src="/images/portraits/npc-seraine.png?v=3" alt="Seraine Ashwell" width={256} height={384} className="img-render-auto" style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.4))", borderRadius: "8px 8px 0 0", pointerEvents: "none" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                <div style={{ background: "rgba(25,17,5,0.92)", border: "1px solid rgba(245,158,11,0.4)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>&ldquo;The flame went out. But the ember remembers. Do you?&rdquo;</p>
                </div>
              </div>
              <div style={{ maxWidth: 420, width: "100%", borderRadius: "1rem", background: "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: "1px solid rgba(167,139,250,0.35)", boxShadow: "0 0 40px rgba(167,139,250,0.08)" }}>
                <div className="px-5 pt-5 pb-3 text-center" style={{ borderBottom: "1px solid rgba(245,158,11,0.12)" }}>
                  <p className="text-3xl mb-2">—</p>
                  <h3 className="text-base font-bold" style={{ color: "#e8d5a3" }}>Rise Again</h3>
                  <p className="text-xs mt-1" style={{ color: "rgba(200,170,100,0.5)" }}>{ritualToRecommit.title}</p>
                </div>
                <div className="md:hidden px-5 py-2.5" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)", background: "rgba(25,17,5,0.4)" }}>
                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>&ldquo;The flame went out. But the ember remembers. Do you?&rdquo;</p>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-sm leading-relaxed text-w50">
                    Your streak was broken, but the rite endures. Recommit and begin anew — your longest streak of <span style={{ color: "#f59e0b", fontWeight: 600 }}>{ritualToRecommit.longestStreak ?? 0} days</span> is etched in the records.
                  </p>
                  <p className="text-xs italic" style={{ color: "rgba(200,170,100,0.35)" }}>
                    &ldquo;Every forge has cooled. Every flame has flickered. What matters is the next spark.&rdquo;
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setRecommitRitualId(null)} className="text-sm py-2.5 px-5 rounded-xl bg-w4 border-w8" style={{ color: "rgba(200,170,100,0.35)" }}>Not Yet</button>
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`/api/rituals/${recommitRitualId}/recommit`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                            body: JSON.stringify({ playerId: playerName }),
                          });
                          setRecommitRitualId(null);
                          if (playerName) fetchRituals(playerName).then(setRituals);
                        } catch { /* ignore */ }
                      }}
                      className="flex-1 text-sm py-2.5 rounded-xl font-bold"
                      style={{ background: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.5)", boxShadow: "0 0 16px rgba(167,139,250,0.12)", cursor: "pointer" }}
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
    </>
  );
}
