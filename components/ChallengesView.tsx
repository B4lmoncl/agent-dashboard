"use client";

import { useState, useCallback } from "react";
import { useDashboard } from "@/app/DashboardContext";
import type { WeeklyChallenge, Expedition, ExpeditionCheckpoint } from "@/app/types";

// ─── Currency icons ──────────────────────────────────────────────────────────
const CURRENCY_ICONS: Record<string, { label: string; color: string }> = {
  gold: { label: "Gold", color: "#f59e0b" },
  runensplitter: { label: "Runensplitter", color: "#a855f7" },
  essenz: { label: "Essenz", color: "#3b82f6" },
  sternentaler: { label: "Sternentaler", color: "#fbbf24" },
  xp: { label: "XP", color: "#22c55e" },
};

function CurrencyBadge({ type, amount }: { type: string; amount: number }) {
  const info = CURRENCY_ICONS[type] || { label: type, color: "#888" };
  return (
    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: `${info.color}15`, color: info.color }}>
      {amount} {info.label}
    </span>
  );
}

// ─── Star display ────────────────────────────────────────────────────────────
function Stars({ earned, max = 3 }: { earned: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: i < earned ? "#fbbf24" : "rgba(255,255,255,0.12)", fontSize: 16 }}>
          ★
        </span>
      ))}
    </span>
  );
}

// ─── Sternenpfad (Solo) ─────────────────────────────────────────────────────
function SternenpfadView({
  challenge,
  onClaim,
  claiming,
}: {
  challenge: WeeklyChallenge;
  onClaim: () => void;
  claiming: boolean;
}) {
  const totalStars = challenge.totalStars;
  const modifier = challenge.modifier;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {challenge.icon && (
            <img src={challenge.icon} alt="" width={32} height={32} className="img-render-auto" onError={e => (e.currentTarget.style.display = "none")} />
          )}
          <div>
            <h3 className="text-sm font-bold" style={{ color: "#e8e8e8" }}>{challenge.name}</h3>
            <p className="text-xs text-w30">Kalenderwoche {challenge.weekId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <Stars earned={totalStars} max={9} />
          <span className="text-xs font-bold ml-1" style={{ color: "#fbbf24" }}>{totalStars}/9</span>
        </div>
      </div>

      {/* Weekly Modifier Banner */}
      {modifier && (
        <div className="rounded-lg px-4 py-3" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#a855f7" }}>Wochenmodifikator</span>
          </div>
          <p className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>{modifier.name}</p>
          <p className="text-xs text-w30 mt-0.5">{modifier.description}</p>
        </div>
      )}

      {/* Stages */}
      <div className="space-y-3">
        {challenge.stages.map((stage, i) => {
          const isActive = stage.current && !stage.completed;
          const isCompleted = stage.completed;
          const stageColor = isCompleted ? "#22c55e" : isActive ? "#fbbf24" : "rgba(255,255,255,0.1)";

          // Progress calculation for active stage
          let progressValue = 0;
          const progressMax = stage.requirement.count;
          if (isActive && challenge.progress) {
            const req = stage.requirement;
            if (req.type === "quest_type") {
              progressValue = challenge.progress[`type_${req.questType}`] || 0;
            } else if (req.type === "total_quests") {
              progressValue = challenge.progress.totalQuests || 0;
            } else if (req.type === "unique_types") {
              const types = challenge.progress.types;
              progressValue = types ? Object.keys(types).length : 0;
            } else if (req.type === "streak_maintained") {
              progressValue = challenge.streakDays || 0;
            }
          }
          if (isCompleted) progressValue = progressMax;

          const progressPct = progressMax > 0 ? Math.min(100, Math.round((progressValue / progressMax) * 100)) : 0;

          // Speed bonus: check if stage was started within speedBonusDays
          const stageStart = challenge.stageStartedAt[i];
          const speedBonusActive = isActive && !!stageStart &&
            ((new Date().getTime() - new Date(stageStart).getTime()) / (1000 * 60 * 60 * 24)) <= challenge.speedBonusDays;

          return (
            <div
              key={i}
              className="rounded-xl p-4 transition-all"
              style={{
                background: isActive ? "rgba(251,191,36,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isActive ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.06)"}`,
                opacity: !isActive && !isCompleted ? 0.5 : 1,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: stageColor }}>
                      Stufe {stage.stage}
                    </span>
                    <Stars earned={stage.earnedStars} />
                    {speedBonusActive && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                        Speed-Bonus aktiv
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-w40">{stage.desc}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-w30">{progressValue}/{progressMax}</span>
                  <span className="text-w20">{progressPct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progressPct}%`,
                      background: isCompleted ? "#22c55e" : `linear-gradient(90deg, ${stageColor}, ${stageColor}80)`,
                    }}
                  />
                </div>
              </div>

              {/* Star thresholds */}
              {(isActive || isCompleted) && stage.starThresholds && (
                <div className="flex gap-3 text-xs text-w20 mt-1">
                  {stage.starThresholds.map((t: number, si: number) => (
                    <span key={si} style={{ color: progressValue >= t ? "#fbbf24" : undefined }}>
                      ★{si + 1}: {t}{stage.requirement.type === "quest_type" ? ` ${stage.requirement.questType}` : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* Rewards preview */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(stage.rewards).map(([type, amount]) => (
                  <CurrencyBadge key={type} type={type} amount={amount as number} />
                ))}
                {stage.earnedStars >= 2 && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
                    +{stage.earnedStars === 3 ? "33" : "15"}% Bonus
                  </span>
                )}
              </div>

              {/* Claim button */}
              {isActive && challenge.canAdvance && (
                <button
                  onClick={onClaim}
                  disabled={claiming}
                  className="btn-interactive mt-3 w-full text-xs font-bold py-2 px-4 rounded-lg transition-all"
                  style={{
                    background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                    color: "#000",
                    opacity: claiming ? 0.5 : 1,
                  }}
                >
                  {claiming ? "Wird beansprucht..." : `Stufe ${stage.stage} abschließen`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* All complete message */}
      {challenge.currentStage >= 3 && (
        <div className="text-center py-4 rounded-xl" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <p className="text-sm font-bold" style={{ color: "#22c55e" }}>Sternenpfad abgeschlossen!</p>
          <p className="text-xs text-w30 mt-1">{totalStars}/9 Sterne gesammelt</p>
        </div>
      )}
    </div>
  );
}

// ─── Expedition (Coop) ──────────────────────────────────────────────────────
function ExpeditionView({
  expedition,
  onClaim,
  claiming,
}: {
  expedition: Expedition;
  onClaim: (checkpoint: number) => void;
  claiming: number | null;
}) {
  const maxRequired = expedition.checkpoints[expedition.checkpoints.length - 1]?.required || 1;
  const overallPct = Math.min(100, Math.round((expedition.progress / maxRequired) * 100));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        {expedition.icon && (
          <img src={expedition.icon} alt="" width={40} height={40} className="img-render-auto rounded-lg mt-0.5" onError={e => (e.currentTarget.style.display = "none")} />
        )}
        <div className="flex-1">
          <h3 className="text-sm font-bold" style={{ color: "#e8e8e8" }}>{expedition.name}</h3>
          <p className="text-xs text-w30 mt-0.5">{expedition.description}</p>
          <p className="text-xs text-w20 mt-1">{expedition.playerCount} Spieler · Kalenderwoche {expedition.weekId}</p>
        </div>
      </div>

      {/* Global progress */}
      <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-w50">Gilden-Fortschritt</span>
          <span className="font-bold" style={{ color: "#4ade80" }}>{expedition.progress} Quests</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${overallPct}%`,
              background: "linear-gradient(90deg, #22c55e, #4ade80)",
            }}
          />
        </div>
        {/* Checkpoint markers on progress bar */}
        <div className="relative h-3 mt-1">
          {expedition.checkpoints.map((cp, i) => {
            const pct = Math.round((cp.required / maxRequired) * 100);
            return (
              <div
                key={i}
                className="absolute -top-0.5 transform -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: cp.reached ? (cp.isBonus ? "#fbbf24" : "#22c55e") : "rgba(255,255,255,0.15)",
                    boxShadow: cp.reached ? `0 0 6px ${cp.isBonus ? "#fbbf24" : "#22c55e"}40` : "none",
                  }}
                />
                <span className="text-xs text-w20 absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ fontSize: 9 }}>
                  {cp.required}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checkpoints */}
      <div className="space-y-2">
        {expedition.checkpoints.map((cp: ExpeditionCheckpoint) => {
          const isCurrent = !cp.reached && (cp.number === 1 || expedition.checkpoints[cp.number - 2]?.reached);
          const canClaim = cp.reached && !cp.claimedByPlayer;

          return (
            <div
              key={cp.number}
              className="rounded-lg p-3 transition-all"
              style={{
                background: cp.isBonus
                  ? "rgba(251,191,36,0.04)"
                  : cp.reached
                  ? "rgba(34,197,94,0.04)"
                  : isCurrent
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(255,255,255,0.01)",
                border: `1px solid ${
                  cp.isBonus
                    ? "rgba(251,191,36,0.2)"
                    : cp.reached
                    ? "rgba(34,197,94,0.15)"
                    : isCurrent
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.04)"
                }`,
                opacity: !cp.reached && !isCurrent ? 0.5 : 1,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: cp.reached
                        ? cp.isBonus ? "#fbbf24" : "#22c55e"
                        : "rgba(255,255,255,0.08)",
                      color: cp.reached ? "#000" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {cp.reached ? "✓" : cp.number}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: cp.isBonus ? "#fbbf24" : cp.reached ? "#4ade80" : "#e8e8e8" }}>
                      {cp.name}
                      {cp.isBonus && <span className="ml-1 text-xs text-w20">(Bonus)</span>}
                    </p>
                    <p className="text-xs text-w20">
                      {cp.required} Quests benötigt
                      {cp.claimedByPlayer && <span style={{ color: "#22c55e" }}> · Beansprucht</span>}
                    </p>
                  </div>
                </div>

                {/* Rewards */}
                <div className="flex flex-wrap gap-1 justify-end">
                  {Object.entries(cp.rewards).map(([type, amount]) => (
                    <CurrencyBadge key={type} type={type} amount={amount as number} />
                  ))}
                  {cp.bonusTitle && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>
                      Titel: {cp.bonusTitle.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Claim button */}
              {canClaim && (
                <button
                  onClick={() => onClaim(cp.number)}
                  disabled={claiming === cp.number}
                  className="btn-interactive mt-2 w-full text-xs font-bold py-1.5 px-4 rounded-lg transition-all"
                  style={{
                    background: cp.isBonus
                      ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
                      : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    color: "#000",
                    opacity: claiming === cp.number ? 0.5 : 1,
                  }}
                >
                  {claiming === cp.number ? "Wird beansprucht..." : "Belohnung einfordern"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Player contribution + leaderboard */}
      <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-w35">Beiträge</span>
          <span className="text-xs font-bold" style={{ color: "#4ade80" }}>
            Dein Beitrag: {expedition.playerContribution} Quests
          </span>
        </div>
        {expedition.contributions.length > 0 ? (
          <div className="space-y-1">
            {expedition.contributions.map((c, i) => (
              <div key={c.userId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-w20 w-4 text-right">{i + 1}.</span>
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: c.color + "20", color: c.color }}
                  >
                    {c.avatar.slice(0, 2)}
                  </span>
                  <span className="text-w50">{c.name}</span>
                </div>
                <span className="font-semibold text-w40">{c.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-w20 text-center py-2">Noch keine Beiträge diese Woche</p>
        )}
      </div>
    </div>
  );
}

// ─── Main ChallengesView ────────────────────────────────────────────────────
export default function ChallengesView({
  weeklyChallenge,
  expedition,
  onRefresh,
}: {
  weeklyChallenge: WeeklyChallenge | null;
  expedition: Expedition | null;
  onRefresh: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"sternenpfad" | "expedition">("sternenpfad");
  const [claimingStage, setClaimingStage] = useState(false);
  const [claimingCheckpoint, setClaimingCheckpoint] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const { reviewApiKey, playerName } = useDashboard();

  const handleClaimStage = useCallback(async () => {
    if (!reviewApiKey) return;
    setClaimingStage(true);
    setClaimError(null);
    try {
      const { getAuthHeaders } = await import("@/lib/auth-client");
      const headers = getAuthHeaders(reviewApiKey);
      const resp = await fetch("/api/weekly-challenge/claim", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      });
      if (resp.ok) {
        await onRefresh();
      } else {
        const data = await resp.json().catch(() => ({}));
        setClaimError(data.error || "Fehler beim Beanspruchen");
      }
    } catch (e) {
      console.error("[challenges] claim stage failed:", e);
      setClaimError("Netzwerkfehler");
    } finally {
      setClaimingStage(false);
    }
  }, [reviewApiKey, onRefresh]);

  const handleClaimCheckpoint = useCallback(async (checkpoint: number) => {
    if (!reviewApiKey) return;
    setClaimingCheckpoint(checkpoint);
    setClaimError(null);
    try {
      const { getAuthHeaders } = await import("@/lib/auth-client");
      const headers = getAuthHeaders(reviewApiKey);
      const resp = await fetch("/api/expedition/claim", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ checkpoint }),
      });
      if (resp.ok) {
        await onRefresh();
      } else {
        const data = await resp.json().catch(() => ({}));
        setClaimError(data.error || "Fehler beim Beanspruchen");
      }
    } catch (e) {
      console.error("[challenges] claim checkpoint failed:", e);
      setClaimError("Netzwerkfehler");
    } finally {
      setClaimingCheckpoint(null);
    }
  }, [reviewApiKey, onRefresh]);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-w35">Challenges</span>
      </div>

      {/* Toggle buttons */}
      <div className="inline-flex rounded-lg p-0.5" style={{ background: "#111" }}>
        <button
          onClick={() => setActiveTab("sternenpfad")}
          className="btn-interactive text-xs font-semibold px-4 py-2 rounded-md transition-all"
          style={{
            background: activeTab === "sternenpfad" ? "#252525" : "transparent",
            color: activeTab === "sternenpfad" ? "#fbbf24" : "rgba(255,255,255,0.3)",
          }}
        >
          ★ Sternenpfad
        </button>
        <button
          onClick={() => setActiveTab("expedition")}
          className="btn-interactive text-xs font-semibold px-4 py-2 rounded-md transition-all"
          style={{
            background: activeTab === "expedition" ? "#252525" : "transparent",
            color: activeTab === "expedition" ? "#4ade80" : "rgba(255,255,255,0.3)",
          }}
        >
          Expedition
        </button>
      </div>

      {/* Error toast */}
      {claimError && (
        <div className="rounded-lg px-4 py-2 flex items-center justify-between" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <span className="text-xs" style={{ color: "#ef4444" }}>{claimError}</span>
          <button onClick={() => setClaimError(null)} className="text-xs text-w30 ml-2 hover:text-w50">✕</button>
        </div>
      )}

      {/* Content */}
      {activeTab === "sternenpfad" && (
        weeklyChallenge ? (
          <SternenpfadView
            challenge={weeklyChallenge}
            onClaim={handleClaimStage}
            claiming={claimingStage}
          />
        ) : (
          <div className="rounded-xl px-6 py-12 text-center border-w6" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-sm font-bold mb-1 text-w25">Kein Sternenpfad aktiv</p>
            <p className="text-xs text-w15">{playerName ? "Der Sternenpfad wird montags zurückgesetzt." : "Melde dich an, um den Sternenpfad zu sehen."}</p>
          </div>
        )
      )}

      {activeTab === "expedition" && (
        expedition ? (
          <ExpeditionView
            expedition={expedition}
            onClaim={handleClaimCheckpoint}
            claiming={claimingCheckpoint}
          />
        ) : (
          <div className="rounded-xl px-6 py-12 text-center border-w6" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-sm font-bold mb-1 text-w25">Keine Expedition aktiv</p>
            <p className="text-xs text-w15">Die Expedition wird montags zurückgesetzt.</p>
          </div>
        )
      )}
    </div>
  );
}
