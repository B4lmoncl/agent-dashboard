"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useDashboard } from "@/app/DashboardContext";
import type { WeeklyChallenge, Expedition, ExpeditionCheckpoint } from "@/app/types";
import { InfoTooltip } from "@/components/InfoTooltip";
import { Tip } from "@/components/GameTooltip";

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
  // Wrap with Tip if the currency has a tooltip entry
  const tipKey = type === "runensplitter" || type === "sternentaler" || type === "essenz" || type === "gold" || type === "stardust" || type === "gildentaler" ? type : null;
  const badge = (
    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: `${info.color}15`, color: info.color, cursor: tipKey ? "help" : undefined }}>
      {amount} {info.label}
    </span>
  );
  return tipKey ? <Tip k={tipKey}>{badge}</Tip> : badge;
}

// ─── Star display ────────────────────────────────────────────────────────────
function Stars({ earned, max = 3, animated = false }: { earned: number; max?: number; animated?: boolean }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const isEarned = i < earned;
        return (
          <span
            key={i}
            className={isEarned && animated ? "star-earned" : ""}
            style={{
              color: isEarned ? "#fbbf24" : "rgba(255,255,255,0.12)",
              fontSize: 16,
              display: "inline-block",
              animationDelay: animated && isEarned ? `${i * 0.15}s` : undefined,
              textShadow: isEarned ? "0 0 8px rgba(251,191,36,0.5)" : "none",
            }}
          >
            ★
          </span>
        );
      })}
    </span>
  );
}

// ─── Weekly Reset Timer ──────────────────────────────────────────────────────
function WeeklyResetTimer() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calcTimeLeft = () => {
      const now = new Date();
      // Next Monday 00:00 UTC
      const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
      const diff = next.getTime() - now.getTime();
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${d}d ${h}h ${m}m`);
    };
    calcTimeLeft();
    const interval = setInterval(calcTimeLeft, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }}>
      Resets in {timeLeft}
    </span>
  );
}

// ─── Star Path (Solo) ────────────────────────────────────────────────────────
function SternenpfadView({
  challenge,
  onClaim,
  claiming,
  onClaimMilestone,
  claimingMilestone,
}: {
  challenge: WeeklyChallenge;
  onClaim: () => void;
  claiming: boolean;
  onClaimMilestone: (stars: number) => void;
  claimingMilestone: number | null;
}) {
  const totalStars = challenge.totalStars;
  const modifier = challenge.modifier;
  const claimedMilestones: number[] = (challenge as WeeklyChallenge & { claimedMilestones?: number[] }).claimedMilestones || [];

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
            <p className="text-xs text-w30">Week {challenge.weekId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <Stars earned={totalStars} max={9} animated />
          <span className="text-xs font-bold ml-1" style={{ color: "#fbbf24" }}>{totalStars}/9</span>
        </div>
      </div>

      {/* Cumulative Star Milestone Track */}
      <div className="rounded-lg px-4 py-3" style={{ background: "rgba(251,191,36,0.03)", border: "1px solid rgba(251,191,36,0.1)" }}>
        <div className="relative">
          <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (totalStars / 9) * 100)}%`, background: "linear-gradient(90deg, #fbbf24, #f59e0b)" }} />
          </div>
          <div className="flex justify-between mt-2">
            {[
              { stars: 3, label: "3★", reward: "50 Gold" },
              { stars: 6, label: "6★", reward: "3 Essenz + 100 Gold" },
              { stars: 9, label: "9★", reward: "1 Sternentaler + 5 Essenz" },
            ].map(ms => {
              const reached = totalStars >= ms.stars;
              const claimed = claimedMilestones.includes(ms.stars);
              const canClaim = reached && !claimed;
              return (
                <div key={ms.stars} className="flex flex-col items-center gap-0.5">
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    disabled={!canClaim || claimingMilestone !== null}
                    onClick={() => canClaim && onClaimMilestone(ms.stars)}
                    style={{
                      background: claimed ? "#fbbf24" : canClaim ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)",
                      color: claimed ? "#000" : canClaim ? "#fbbf24" : "rgba(255,255,255,0.2)",
                      boxShadow: claimed ? "0 0 8px rgba(251,191,36,0.3)" : canClaim ? "0 0 12px rgba(251,191,36,0.2)" : "none",
                      cursor: canClaim ? "pointer" : "default",
                      animation: canClaim ? "pulse 2s infinite" : "none",
                    }}
                  >
                    {claimed ? "✓" : claimingMilestone === ms.stars ? "…" : ms.stars}
                  </button>
                  <span className="text-xs font-bold" style={{ color: reached ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>{ms.label}</span>
                  <span className="text-xs" style={{ color: reached ? "rgba(251,191,36,0.6)" : "rgba(255,255,255,0.12)", fontSize: 9 }}>{ms.reward}</span>
                  {canClaim && <span className="text-xs font-semibold" style={{ color: "#fbbf24", fontSize: 9 }}>Claim!</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weekly Modifier Banner */}
      {modifier && (
        <div className="rounded-lg px-4 py-3 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(99,102,241,0.06) 100%)", border: "1px solid rgba(168,85,247,0.25)", boxShadow: "0 0 20px rgba(168,85,247,0.06)" }}>
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm" style={{ lineHeight: 1 }}>&#9889;</span>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#a855f7" }}>Weekly Modifier Active</span>
            {modifier.bonusMultiplier && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: modifier.bonusMultiplier > 1 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: modifier.bonusMultiplier > 1 ? "#22c55e" : "#ef4444" }}>
                {modifier.bonusMultiplier > 1 ? "+" : ""}{Math.round((modifier.bonusMultiplier - 1) * 100)}%
              </span>
            )}
          </div>
          <p className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>{modifier.name}</p>
          <p className="text-xs text-w30 mt-0.5">{modifier.description}</p>
        </div>
      )}

      {/* Journey Path */}
      <div className="relative" style={{ paddingLeft: 28 }}>
        {/* Vertical connecting line */}
        <div
          className="absolute"
          style={{
            left: 11,
            top: 12,
            bottom: 12,
            width: 2,
            background: "linear-gradient(180deg, rgba(251,191,36,0.3) 0%, rgba(34,197,94,0.3) 50%, rgba(255,255,255,0.06) 100%)",
          }}
        />

        {challenge.stages.map((stage, i) => {
          const isActive = stage.current && !stage.completed;
          const isCompleted = stage.completed;
          const stageColor = isCompleted ? "#22c55e" : isActive ? "#fbbf24" : "rgba(255,255,255,0.2)";
          const isLast = i === challenge.stages.length - 1;

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

          // Speed bonus
          const stageStart = challenge.stageStartedAt[i];
          const speedBonusActive = isActive && !!stageStart &&
            ((new Date().getTime() - new Date(stageStart).getTime()) / (1000 * 60 * 60 * 24)) <= challenge.speedBonusDays;

          return (
            <div key={i} className="relative" style={{ marginBottom: isLast ? 0 : 16 }}>
              {/* Waypoint node */}
              <div
                className="absolute flex items-center justify-center"
                style={{
                  left: -28,
                  top: 14,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: isCompleted ? "#22c55e" : isActive ? "#fbbf24" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${stageColor}`,
                  boxShadow: isActive ? `0 0 12px ${stageColor}50, 0 0 4px ${stageColor}30` : isCompleted ? `0 0 8px ${stageColor}30` : "none",
                  zIndex: 2,
                }}
              >
                {isCompleted ? (
                  <span style={{ color: "#000", fontSize: 12, fontWeight: 800 }}>✓</span>
                ) : (
                  <span style={{ color: isActive ? "#000" : "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700 }}>{i + 1}</span>
                )}
              </div>

              {/* Stage card */}
              <div
                className="rounded-xl transition-all"
                style={{
                  padding: "14px 16px",
                  background: isActive ? "rgba(251,191,36,0.04)" : isCompleted ? "rgba(34,197,94,0.03)" : "rgba(255,255,255,0.015)",
                  border: `1px solid ${isActive ? "rgba(251,191,36,0.2)" : isCompleted ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)"}`,
                  opacity: !isActive && !isCompleted ? 0.5 : 1,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: stageColor }}>
                    Stage {stage.stage}
                  </span>
                  <Stars earned={stage.earnedStars} animated />
                  {speedBonusActive && (
                    <span className="text-xs px-1.5 py-0.5 rounded cursor-help" title={`Complete this stage within ${challenge.speedBonusDays} days for +1 bonus star!`} style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                      ⚡ Speed Bonus
                    </span>
                  )}
                </div>
                <p className="text-xs text-w40 mb-2">{stage.desc}</p>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-w30">
                      {progressValue}/{progressMax}
                      {isActive && modifier && modifier.bonusMultiplier && modifier.bonusMultiplier !== 1 && (
                        <span className="ml-1.5" style={{ color: modifier.bonusMultiplier > 1 ? "#22c55e" : "#ef4444" }}>
                          (effective: {Math.round(progressValue * modifier.bonusMultiplier * 10) / 10})
                        </span>
                      )}
                    </span>
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
                  <div className="flex gap-3 text-xs text-w20 mb-2">
                    {stage.starThresholds.map((t: number, si: number) => (
                      <span key={si} style={{ color: progressValue >= t ? "#fbbf24" : undefined }}>
                        ★{si + 1}: {t}{stage.requirement.type === "quest_type" ? ` ${stage.requirement.questType}` : ""}
                      </span>
                    ))}
                  </div>
                )}

                {/* Reward tiers by star rating */}
                <div className="space-y-1">
                  {[1, 2, 3].map(stars => {
                    const multiplier = stars === 3 ? 1.33 : stars === 2 ? 1.15 : 1;
                    const isCurrentTier = stage.earnedStars === stars;
                    return (
                      <div key={stars} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{
                        background: isCurrentTier ? "rgba(251,191,36,0.06)" : "transparent",
                        border: isCurrentTier ? "1px solid rgba(251,191,36,0.15)" : "1px solid transparent",
                        opacity: stage.earnedStars >= stars ? 1 : 0.45,
                      }}>
                        <span style={{ color: stage.earnedStars >= stars ? "#fbbf24" : "rgba(255,255,255,0.2)", width: 36 }}>
                          {"★".repeat(stars)}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(stage.rewards).map(([type, base]) => (
                            <CurrencyBadge key={type} type={type} amount={Math.round((base as number) * multiplier)} />
                          ))}
                        </div>
                        {stars > 1 && <span className="text-w15 ml-auto">+{stars === 3 ? "33" : "15"}%</span>}
                      </div>
                    );
                  })}
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
                    {claiming ? "Claiming..." : `Claim Stage ${stage.stage}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Finish flag at bottom */}
        {challenge.currentStage >= 3 && (
          <div className="relative" style={{ marginTop: 16 }}>
            <div
              className="absolute flex items-center justify-center"
              style={{
                left: -28,
                top: 8,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#22c55e",
                border: "2px solid #22c55e",
                boxShadow: "0 0 12px rgba(34,197,94,0.4)",
                zIndex: 2,
              }}
            >
              <span style={{ fontSize: 12 }}>⚑</span>
            </div>
            <div className="text-center py-4 rounded-xl" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p className="text-sm font-bold" style={{ color: "#22c55e" }}>Star Path Complete!</p>
              <p className="text-xs text-w30 mt-1">{totalStars}/9 Stars earned</p>
            </div>
          </div>
        )}
      </div>
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        {expedition.icon && (
          <img src={expedition.icon} alt="" width={40} height={40} className="img-render-auto rounded-lg mt-0.5" onError={e => (e.currentTarget.style.display = "none")} />
        )}
        <div className="flex-1">
          <h3 className="text-sm font-bold" style={{ color: "#e8e8e8" }}>{expedition.name}</h3>
          <p className="text-xs text-w30 mt-0.5">{expedition.description}</p>
          <p className="text-xs text-w20 mt-1">{expedition.playerCount} Players · Week {expedition.weekId}</p>
        </div>
      </div>

      {/* Global progress */}
      <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-w50">Guild Progress</span>
          <span className="font-bold" style={{ color: "#4ade80" }}>{expedition.progress} Quests</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${overallPct}%`,
              background: "linear-gradient(90deg, #22c55e, #4ade80)",
            }}
          />
        </div>
        {/* Checkpoint markers on progress bar */}
        <div className="relative h-4 mt-1.5">
          {expedition.checkpoints.map((cp, i) => {
            const pct = Math.round((cp.required / maxRequired) * 100);
            return (
              <div
                key={i}
                className="absolute -top-0.5 transform -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: cp.reached ? (cp.isBonus ? "#fbbf24" : "#22c55e") : "rgba(255,255,255,0.15)",
                    boxShadow: cp.reached ? `0 0 6px ${cp.isBonus ? "#fbbf24" : "#22c55e"}40` : "none",
                  }}
                />
                <span className="text-xs text-w20 absolute -bottom-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  {cp.required}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checkpoints */}
      <div className="space-y-3">
        {expedition.checkpoints.map((cp: ExpeditionCheckpoint) => {
          const isCurrent = !cp.reached && (cp.number === 1 || expedition.checkpoints[cp.number - 2]?.reached);
          const canClaim = cp.reached && !cp.claimedByPlayer;

          return (
            <div
              key={cp.number}
              className="rounded-xl p-4 transition-all"
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: cp.reached
                        ? cp.isBonus ? "#fbbf24" : "#22c55e"
                        : "rgba(255,255,255,0.08)",
                      color: cp.reached ? "#000" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {cp.reached ? "✓" : cp.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: cp.isBonus ? "#fbbf24" : cp.reached ? "#4ade80" : "#e8e8e8" }}>
                      {cp.name}
                      {cp.isBonus && <span className="ml-1 text-xs text-w20">(Bonus)</span>}
                    </p>
                    <p className="text-xs text-w20 mt-0.5">
                      {cp.required} quests required
                      {cp.claimedByPlayer && <span style={{ color: "#22c55e" }}> · Claimed</span>}
                    </p>
                  </div>
                </div>

                {/* Rewards */}
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {Object.entries(cp.rewards).map(([type, amount]) => (
                    <CurrencyBadge key={type} type={type} amount={amount as number} />
                  ))}
                  {cp.bonusTitle && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>
                      Title: {cp.bonusTitle.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Claim button */}
              {canClaim && (
                <button
                  onClick={() => onClaim(cp.number)}
                  disabled={claiming === cp.number}
                  className="btn-interactive mt-3 w-full text-xs font-bold py-2 px-4 rounded-lg transition-all"
                  style={{
                    background: cp.isBonus
                      ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
                      : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    color: "#000",
                    opacity: claiming === cp.number ? 0.5 : 1,
                  }}
                >
                  {claiming === cp.number ? "Claiming..." : "Claim Reward"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Player contribution + leaderboard */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-w35">Contributions</span>
          <span className="text-xs font-bold" style={{ color: "#4ade80" }}>
            Your contribution: {expedition.playerContribution} Quests
          </span>
        </div>
        {expedition.contributions.length > 0 ? (() => {
          const topCount = expedition.contributions[0]?.count || 1;
          const fairShare = expedition.playerCount > 0 ? Math.ceil(maxRequired / expedition.playerCount) : 1;
          return (
            <div className="space-y-1.5">
              {expedition.contributions.map((c, i) => {
                const pct = Math.min(100, Math.round((c.count / topCount) * 100));
                const aboveFair = c.count >= fairShare;
                return (
                  <div key={c.userId} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
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
                      <span className="font-semibold" style={{ color: aboveFair ? "#4ade80" : "#f87171" }}>{c.count}</span>
                      {aboveFair ? (
                        <span className="text-xs ml-1" style={{ color: "#4ade80", fontSize: 9 }}>&#9650;</span>
                      ) : (
                        <span className="text-xs ml-1" style={{ color: "#f87171", fontSize: 9 }}>&#9660;</span>
                      )}
                    </div>
                    <div className="ml-6 rounded-full overflow-hidden relative" style={{ height: 4, background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: aboveFair ? "#4ade80" : "#f8717180" }} />
                      {/* Fair share target line */}
                      <div className="absolute top-0 bottom-0" style={{ left: `${Math.min(100, Math.round((fairShare / topCount) * 100))}%`, width: 1, background: "rgba(251,191,36,0.5)" }} title={`Fair share: ${fairShare}`} />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 mt-2">
                <div className="w-3 h-0.5" style={{ background: "rgba(251,191,36,0.5)" }} />
                <p className="text-xs" style={{ color: "rgba(251,191,36,0.4)", fontSize: 10 }}>Fair share: ~{fairShare} quests per player</p>
              </div>
            </div>
          );
        })() : (
          <p className="text-xs text-w20 text-center py-3">No contributions this week yet</p>
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
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);
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
        setClaimError(data.error || "Failed to claim reward");
      }
    } catch (e) {
      console.error("[challenges] claim stage failed:", e);
      setClaimError("Network error");
    } finally {
      setClaimingStage(false);
    }
  }, [reviewApiKey, onRefresh]);

  const handleClaimMilestone = useCallback(async (stars: number) => {
    if (!reviewApiKey) return;
    setClaimingMilestone(stars);
    setClaimError(null);
    try {
      const { getAuthHeaders } = await import("@/lib/auth-client");
      const headers = getAuthHeaders(reviewApiKey);
      const resp = await fetch("/api/weekly-challenge/claim-milestone", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ stars }),
      });
      if (resp.ok) {
        await onRefresh();
      } else {
        const data = await resp.json().catch(() => ({}));
        setClaimError(data.error || "Failed to claim milestone");
      }
    } catch (e) {
      console.error("[challenges] claim milestone failed:", e);
      setClaimError("Network error");
    } finally {
      setClaimingMilestone(null);
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
        setClaimError(data.error || "Failed to claim reward");
      }
    } catch (e) {
      console.error("[challenges] claim checkpoint failed:", e);
      setClaimError("Network error");
    } finally {
      setClaimingCheckpoint(null);
    }
  }, [reviewApiKey, onRefresh]);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-w35">Weekly Challenges</span>
          <InfoTooltip text="Two weekly challenges reset every Monday. Star Path is a solo 3-stage challenge — earn up to 9 stars with speed bonuses. Expedition is a guild-wide cooperative challenge — all players contribute quests toward shared checkpoints. Rewards include Gold, Rune Shards, Essenz and the exclusive Sternentaler currency." />
        </div>
        <WeeklyResetTimer />
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
          ★ Star Path
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
      <div key={activeTab} className="tab-content-enter">
      {activeTab === "sternenpfad" && (
        weeklyChallenge ? (
          <SternenpfadView
            challenge={weeklyChallenge}
            onClaim={handleClaimStage}
            claiming={claimingStage}
            onClaimMilestone={handleClaimMilestone}
            claimingMilestone={claimingMilestone}
          />
        ) : (
          <div className="rounded-xl px-6 py-12 text-center border-w6" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-2xl mb-2">⭐</p>
            <p className="text-sm font-bold mb-1 text-w25">No Star Path active</p>
            <p className="text-xs text-w15">{playerName ? "The Star Path resets every Monday. A new challenge awaits!" : "Log in to view the Star Path."}</p>
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
            <p className="text-2xl mb-2">🏔️</p>
            <p className="text-sm font-bold mb-1 text-w25">No Expedition active</p>
            <p className="text-xs text-w15">The Expedition resets every Monday. Rally your guild!</p>
          </div>
        )
      )}
      </div>
    </div>
  );
}
