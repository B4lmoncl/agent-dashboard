"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth-client";
import { useDashboard } from "@/app/DashboardContext";
import { Tip } from "@/components/GameTooltip";
import type { RewardCelebrationData } from "@/components/RewardCelebration";
import type { ToastInput } from "@/components/ToastStack";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TomeObjective {
  id: string;
  label: string;
  current: number;
  target: number;
  completed: boolean;
}

interface TomeMilestone {
  pct: number;
  label: string;
  reward: Record<string, number | string>;
  reached: boolean;
  claimed: boolean;
}

interface TomeFloor {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  objectives: TomeObjective[];
  completed: number;
  total: number;
  percentage: number;
  milestones: TomeMilestone[];
}

interface TomeData {
  floors: TomeFloor[];
  totalPercentage: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdventureTomeView({
  onRewardCelebration,
  addToast,
}: {
  onRewardCelebration?: (data: RewardCelebrationData) => void;
  addToast?: (t: ToastInput) => void;
} = {}) {
  const _toast = addToast || (() => {});
  const { reviewApiKey } = useDashboard();
  const [data, setData] = useState<TomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [expandedFloor, setExpandedFloor] = useState<string | null>(null);

  const fetchTome = useCallback(async () => {
    try {
      const r = await fetch("/api/adventure-tome", { headers: getAuthHeaders(reviewApiKey) });
      if (r.ok) {
        const d = await r.json();
        setData(d);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTome();
  }, [fetchTome]);

  const claimMilestone = async (floorId: string, pct: number, label: string) => {
    const claimKey = `${floorId}_${pct}`;
    setClaiming(claimKey);
    try {
      const r = await fetch("/api/adventure-tome/claim", {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ floorId, pct }),
      });
      const result = await r.json();
      if (r.ok) {
        _toast({ type: "flavor", message: `Milestone claimed: ${label}`, icon: "◆" });
        fetchTome();
        if (onRewardCelebration) {
          const floor = data?.floors.find(f => f.id === floorId);
          onRewardCelebration({
            type: "quest",
            title: `${floor?.name || "Floor"} — ${pct}%`,
            xpEarned: 0,
            goldEarned: result.granted?.find((g: string) => g.includes("Gold"))
              ? parseInt(result.granted.find((g: string) => g.includes("Gold")).replace(/\D/g, ""), 10) || 0
              : 0,
            flavor: result.granted?.join(", ") || "Milestone reward",
          });
        }
      } else {
        _toast({ type: "error", message: result.error || "Failed to claim" });
      }
    } catch {
      _toast({ type: "error", message: "Network error" });
    }
    setClaiming(null);
  };

  if (loading) {
    return (
      <div className="space-y-3 tab-content-enter">
        <div className="skeleton-card h-20" />
        <div className="skeleton-card h-40" />
        <div className="skeleton-card h-40" />
        <div className="skeleton-card h-40" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="text-center py-12 tab-content-enter">
        <p className="text-sm" style={{ color: "#ef4444" }}>Failed to load Adventure Tome data</p>
        <button onClick={() => { setLoadError(false); setLoading(true); fetchTome(); }} className="text-xs mt-2 px-3 py-1 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>Retry</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
          Could not load Adventure Tome data.
        </p>
      </div>
    );
  }

  const { floors, totalPercentage } = data;

  return (
    <div className="space-y-5 tab-content-enter">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <Tip k="adventure_tome" heading>
          <h2 className="text-lg font-bold" style={{ color: "#e8e8e8" }}>
            Abenteuerbuch
          </h2>
        </Tip>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)", maxWidth: "min(480px, 100%)", margin: "0 auto" }}>
          Track your completionist progress across every floor of the tower. Reach milestones to claim exclusive rewards.
        </p>

        {/* Total completion circle */}
        <div className="flex items-center justify-center mt-3">
          <div
            className="relative flex items-center justify-center"
            style={{ width: 80, height: 80 }}
          >
            <svg viewBox="0 0 80 80" width={80} height={80} style={{ position: "absolute", top: 0, left: 0 }}>
              {/* Background ring */}
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="5"
              />
              {/* Progress ring */}
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke="#f97316"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - totalPercentage / 100)}`}
                transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <span className="text-2xl font-bold font-mono" style={{ color: "#f97316" }}>
              {totalPercentage}%
            </span>
          </div>
        </div>
        <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.2)" }}>
          Gesamtfortschritt durch den Turm
        </p>
      </div>

      {/* ─── Floor Cards ───────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {floors.map((floor) => {
          const isExpanded = expandedFloor === floor.id;
          const claimableMilestones = floor.milestones.filter(m => m.reached && !m.claimed);

          return (
            <div
              key={floor.id}
              className="rounded-xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${floor.color}06 0%, rgba(14,14,18,0.95) 100%)`,
                border: `1px solid ${floor.color}25`,
              }}
            >
              {/* Color accent bar top */}
              <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${floor.color}aa, transparent)` }} />

              {/* Floor header — clickable to expand */}
              <button
                className="w-full text-left p-4 pb-3 flex items-center gap-4 cursor-pointer"
                onClick={() => setExpandedFloor(isExpanded ? null : floor.id)}
                style={{ background: "transparent", border: "none" }}
              >
                {/* Left: color accent bar */}
                <div
                  className="flex-shrink-0 rounded"
                  style={{
                    width: 4,
                    height: 48,
                    background: `linear-gradient(180deg, ${floor.color}, ${floor.color}44)`,
                  }}
                />

                {/* Floor info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: floor.color }}>
                    {floor.name}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {floor.subtitle} — {floor.completed}/{floor.total} objectives
                  </p>
                </div>

                {/* Percentage */}
                <div className="flex-shrink-0 text-right">
                  <span className="text-2xl font-bold font-mono" style={{ color: floor.color }}>
                    {floor.percentage}%
                  </span>
                  {claimableMilestones.length > 0 && (
                    <p className="text-xs font-bold" style={{ color: "#facc15" }}>
                      {claimableMilestones.length} claimable
                    </p>
                  )}
                </div>

                {/* Expand chevron */}
                <span
                  className="text-xs flex-shrink-0"
                  style={{
                    color: "rgba(255,255,255,0.2)",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                    display: "inline-block",
                  }}
                >
                  ▼
                </span>
              </button>

              {/* Progress bar with milestone markers */}
              <div className="px-4 pb-3">
                <div className="relative">
                  <div className={`progress-bar-diablo${floor.percentage > 90 ? " progress-bar-nearly-full" : ""}`}>
                    <div
                      className={`progress-bar-diablo-fill${floor.percentage > 80 ? " bar-pulse" : ""}`}
                      style={{
                        width: `${floor.percentage}%`,
                        background: `linear-gradient(90deg, ${floor.color}88, ${floor.color}, ${floor.color}cc)`,
                      }}
                    />
                  </div>

                  {/* Milestone markers on top of progress bar */}
                  <div className="relative" style={{ height: 20, marginTop: 4 }}>
                    {floor.milestones.map((m) => (
                      <div
                        key={m.pct}
                        className="absolute flex flex-col items-center"
                        style={{
                          left: `${m.pct}%`,
                          transform: "translateX(-50%)",
                          top: 0,
                        }}
                      >
                        {/* Marker dot */}
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: m.claimed
                              ? "#22c55e"
                              : m.reached
                                ? "#facc15"
                                : "rgba(255,255,255,0.1)",
                            border: m.claimed
                              ? "2px solid #22c55e"
                              : m.reached
                                ? "2px solid #facc15"
                                : "2px solid rgba(255,255,255,0.15)",
                            boxShadow: m.reached && !m.claimed
                              ? "0 0 8px rgba(250,204,21,0.5)"
                              : "none",
                          }}
                        />
                        <span
                          className="text-xs font-mono"
                          style={{
                            color: m.claimed
                              ? "rgba(34,197,94,0.6)"
                              : m.reached
                                ? "rgba(250,204,21,0.8)"
                                : "rgba(255,255,255,0.15)",
                            fontSize: 12,
                            marginTop: 1,
                          }}
                        >
                          {m.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─── Expanded content ────────────────────────────────────────── */}
              {isExpanded && (
                <div className="tab-content-enter" style={{ borderTop: `1px solid ${floor.color}15` }}>
                  {/* Objectives checklist */}
                  <div className="px-4 py-3">
                    <p
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: `${floor.color}80` }}
                    >
                      Objectives
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {floor.objectives.map((obj) => (
                        <div
                          key={obj.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded"
                          style={{
                            background: obj.completed
                              ? "rgba(34,197,94,0.05)"
                              : "rgba(255,255,255,0.02)",
                            border: `1px solid ${obj.completed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)"}`,
                          }}
                        >
                          {/* Status icon */}
                          <span
                            className="flex-shrink-0"
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              background: obj.completed
                                ? "rgba(34,197,94,0.15)"
                                : "rgba(255,255,255,0.04)",
                              color: obj.completed ? "#22c55e" : "rgba(255,255,255,0.15)",
                              border: `1px solid ${obj.completed ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                            }}
                          >
                            {obj.completed ? "✓" : ""}
                          </span>

                          {/* Label + progress */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-xs truncate"
                              style={{
                                color: obj.completed
                                  ? "rgba(34,197,94,0.7)"
                                  : "rgba(255,255,255,0.5)",
                              }}
                            >
                              {obj.label}
                            </p>
                          </div>

                          {/* Counter */}
                          {!obj.completed && (
                            <span
                              className="text-xs font-mono flex-shrink-0"
                              style={{ color: "rgba(255,255,255,0.2)" }}
                            >
                              {obj.current}/{obj.target}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Milestone rewards */}
                  <div className="px-4 pb-4" style={{ borderTop: `1px solid ${floor.color}10` }}>
                    <p
                      className="text-xs font-semibold uppercase tracking-wider mt-3 mb-2"
                      style={{ color: `${floor.color}80` }}
                    >
                      Milestone Rewards
                    </p>
                    <div className="space-y-2">
                      {floor.milestones.map((m) => {
                        const claimKey = `${floor.id}_${m.pct}`;
                        const isClaiming = claiming === claimKey;
                        const canClaim = m.reached && !m.claimed;

                        return (
                          <div
                            key={m.pct}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg${canClaim ? " claimable-breathe" : ""}`}
                            style={{
                              background: m.claimed
                                ? "rgba(34,197,94,0.05)"
                                : m.reached
                                  ? "rgba(250,204,21,0.06)"
                                  : "rgba(255,255,255,0.02)",
                              border: `1px solid ${
                                m.claimed
                                  ? "rgba(34,197,94,0.2)"
                                  : m.reached
                                    ? "rgba(250,204,21,0.25)"
                                    : "rgba(255,255,255,0.05)"
                              }`,
                              ["--claim-color" as string]: m.reached && !m.claimed ? "rgba(250,204,21,0.3)" : "transparent",
                            }}
                          >
                            {/* Percentage badge */}
                            <div
                              className="flex-shrink-0 flex items-center justify-center rounded font-bold font-mono"
                              style={{
                                width: 40,
                                height: 28,
                                fontSize: 12,
                                background: m.claimed
                                  ? "rgba(34,197,94,0.12)"
                                  : m.reached
                                    ? "rgba(250,204,21,0.12)"
                                    : "rgba(255,255,255,0.04)",
                                color: m.claimed
                                  ? "#22c55e"
                                  : m.reached
                                    ? "#facc15"
                                    : "rgba(255,255,255,0.15)",
                                border: `1px solid ${
                                  m.claimed
                                    ? "rgba(34,197,94,0.25)"
                                    : m.reached
                                      ? "rgba(250,204,21,0.3)"
                                      : "rgba(255,255,255,0.06)"
                                }`,
                              }}
                            >
                              {m.pct}%
                            </div>

                            {/* Reward label */}
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-xs font-semibold truncate"
                                style={{
                                  color: m.claimed
                                    ? "rgba(255,255,255,0.25)"
                                    : m.reached
                                      ? "rgba(250,204,21,0.9)"
                                      : "rgba(255,255,255,0.3)",
                                  textDecoration: m.claimed ? "line-through" : "none",
                                }}
                              >
                                {m.label}
                              </p>
                            </div>

                            {/* Status / Claim button */}
                            <div className="flex-shrink-0">
                              {m.claimed ? (
                                <span
                                  className="text-xs font-bold"
                                  style={{ color: "rgba(34,197,94,0.5)" }}
                                >
                                  ✓
                                </span>
                              ) : canClaim ? (
                                <button
                                  onClick={() => claimMilestone(floor.id, m.pct, m.label)}
                                  disabled={isClaiming}
                                  title={isClaiming ? "Claiming..." : `Claim ${m.label}`}
                                  className="text-xs px-3 py-1 rounded font-bold"
                                  style={{
                                    background: "rgba(250,204,21,0.15)",
                                    color: "#facc15",
                                    border: "1px solid rgba(250,204,21,0.4)",
                                    cursor: isClaiming ? "not-allowed" : "pointer",
                                    opacity: isClaiming ? 0.5 : 1,
                                    boxShadow: "0 0 10px rgba(250,204,21,0.15)",
                                  }}
                                >
                                  {isClaiming ? "..." : "Claim"}
                                </button>
                              ) : (
                                <span
                                  className="text-xs"
                                  style={{ color: "rgba(255,255,255,0.1)" }}
                                >
                                  ◇
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
