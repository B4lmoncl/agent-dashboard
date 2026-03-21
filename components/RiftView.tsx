"use client";

import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RiftTier {
  name: string;
  questCount: number;
  timeLimitHours: number;
  failCooldownDays: number;
  color: string;
  icon: string;
  minLevel: number;
  baseXp: number;
  baseGold: number;
  completionBonus: Record<string, number>;
  unlocked: boolean;
  onCooldown: boolean;
  cooldownEndsAt: string | null;
}

interface RiftQuest {
  stage: number;
  name: string;
  type: string;
  difficulty: number;
  xpReward: number;
  goldReward: number;
  completed: boolean;
  completedAt: string | null;
}

interface ActiveRift {
  tier: string;
  tierName: string;
  tierColor: string;
  tierIcon: string;
  startedAt: string;
  expiresAt: string;
  quests: RiftQuest[];
  currentStage: number;
  totalStages: number;
  completed: boolean;
  failed?: boolean;
  failedAt?: string;
  reachedStage?: number;
}

interface RiftHistory {
  tier: string;
  startedAt: string;
  completedAt?: string;
  failedAt?: string;
  stages: number;
  totalStages?: number;
  success: boolean;
}

function timeLeft(ms: number): string {
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

const TIER_IDS = ["normal", "hard", "legendary"];
const TYPE_ICONS: Record<string, string> = { personal: "🏠", learning: "📚", fitness: "💪", social: "👥", boss: "💀" };

// ─── Component ──────────────────────────────────────────────────────────────

export default function RiftView({ onRefresh }: { onRefresh?: () => void }) {
  const { playerName, reviewApiKey } = useDashboard();
  const [tiers, setTiers] = useState<Record<string, RiftTier>>({});
  const [activeRift, setActiveRift] = useState<ActiveRift | null>(null);
  const [history, setHistory] = useState<RiftHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const fetchRift = useCallback(async () => {
    if (!playerName) return;
    try {
      const r = await fetch(`/api/rift?player=${encodeURIComponent(playerName)}`);
      if (r.ok) {
        const data = await r.json();
        setTiers(data.tiers || {});
        setActiveRift(data.activeRift || null);
        setHistory(data.history || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [playerName]);

  useEffect(() => { fetchRift(); }, [fetchRift]);

  // Auto-refresh timer
  useEffect(() => {
    if (!activeRift || activeRift.completed || activeRift.failed) return;
    const interval = setInterval(fetchRift, 60000);
    return () => clearInterval(interval);
  }, [activeRift, fetchRift]);

  const enterRift = async (tierId: string) => {
    if (!reviewApiKey || actionLoading) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const r = await fetch("/api/rift/enter", {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierId }),
      });
      const d = await r.json();
      if (!r.ok) setMessage({ text: d.error || "Failed", type: "error" });
      else { setMessage({ text: d.message, type: "success" }); fetchRift(); onRefresh?.(); }
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  const completeStage = async () => {
    if (!reviewApiKey || actionLoading) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const r = await fetch("/api/rift/complete-stage", {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      const d = await r.json();
      if (!r.ok) setMessage({ text: d.error || "Failed", type: "error" });
      else { setMessage({ text: d.message, type: "success" }); fetchRift(); onRefresh?.(); }
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  const abandonRift = async () => {
    if (!reviewApiKey || actionLoading) return;
    setConfirmAbandon(false);
    setActionLoading(true);
    try {
      const r = await fetch("/api/rift/abandon", {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      const d = await r.json();
      if (!r.ok) setMessage({ text: d.error || "Failed", type: "error" });
      else { setMessage({ text: d.message, type: "success" }); fetchRift(); onRefresh?.(); }
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  if (!playerName || !reviewApiKey) {
    return (
      <div className="rounded-xl px-6 py-12 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-2xl mb-2">🌀</p>
        <p className="text-sm font-bold mb-1 text-w25">The Rift</p>
        <p className="text-xs text-w15">Log in to enter The Rift.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="space-y-3 tab-content-enter">
      <div className="skeleton-card h-20" />
      <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="skeleton-card h-40" />)}</div>
    </div>
  );

  return (
    <div className="space-y-5 tab-content-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🌀</span>
        <div>
          <Tip k="rift"><h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)", cursor: "help" }}>The Rift</h2></Tip>
          <p className="text-xs text-w25">Timed quest chains with escalating difficulty. Complete all stages before time runs out.</p>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="rounded-lg px-4 py-2 text-xs font-semibold tab-content-enter" style={{ background: message.type === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", color: message.type === "success" ? "#22c55e" : "#ef4444", border: `1px solid ${message.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          {message.text}
        </div>
      )}

      {/* Active Rift */}
      {activeRift && !activeRift.failed && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: `${activeRift.tierColor}08`, border: `1px solid ${activeRift.tierColor}30` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{activeRift.tierIcon}</span>
              <div>
                <p className="text-sm font-bold" style={{ color: activeRift.tierColor }}>{activeRift.tierName}</p>
                <p className="text-xs text-w30">Stage {activeRift.currentStage}/{activeRift.totalStages}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono font-bold" style={{ color: activeRift.completed ? "#22c55e" : new Date(activeRift.expiresAt).getTime() - Date.now() < 3600000 ? "#ef4444" : activeRift.tierColor }}>
                {activeRift.completed ? "✓ Complete!" : timeLeft(new Date(activeRift.expiresAt).getTime() - Date.now())}
              </p>
              <p className="text-xs text-w20">{activeRift.completed ? "All stages cleared" : "Time remaining"}</p>
            </div>
          </div>

          {/* Quest chain visualization */}
          <div className="relative" style={{ paddingLeft: 20 }}>
            <div className="absolute" style={{ left: 8, top: 8, bottom: 8, width: 2, background: `linear-gradient(180deg, ${activeRift.tierColor}40, rgba(255,255,255,0.06))` }} />
            {activeRift.quests.map((q, i) => {
              const isCurrent = !q.completed && i === activeRift.currentStage - 1;
              const isLocked = !q.completed && i > activeRift.currentStage - 1;
              return (
                <div key={i} className="relative flex items-center gap-3 mb-3" style={{ opacity: isLocked ? 0.4 : 1 }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center z-10 flex-shrink-0" style={{
                    background: q.completed ? "#22c55e" : isCurrent ? activeRift.tierColor : "rgba(255,255,255,0.08)",
                    border: `2px solid ${q.completed ? "#22c55e" : isCurrent ? activeRift.tierColor : "rgba(255,255,255,0.1)"}`,
                    boxShadow: isCurrent ? `0 0 8px ${activeRift.tierColor}40` : "none",
                  }}>
                    {q.completed && <span style={{ color: "#000", fontSize: 8, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div className="flex-1 rounded-lg p-3" style={{
                    background: isCurrent ? `${activeRift.tierColor}08` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isCurrent ? `${activeRift.tierColor}25` : "rgba(255,255,255,0.04)"}`,
                  }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{TYPE_ICONS[q.type] || "⚔️"}</span>
                        <div>
                          <p className="text-xs font-bold" style={{ color: q.completed ? "#22c55e" : isCurrent ? "#e8e8e8" : "rgba(255,255,255,0.3)" }}>{q.name}</p>
                          <p className="text-xs text-w20">{q.type} · {q.difficulty}x difficulty</p>
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <Tip k="xp"><span style={{ color: "#a855f7" }}>{q.xpReward} XP</span></Tip>
                        <span className="text-w15 mx-1">·</span>
                        <Tip k="gold"><span style={{ color: "#fbbf24" }}>{q.goldReward}g</span></Tip>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {!activeRift.completed && (
              <button
                onClick={completeStage}
                disabled={actionLoading}
                className="btn-interactive flex-1 text-xs font-bold py-2.5 rounded-lg"
                style={{ background: `linear-gradient(135deg, ${activeRift.tierColor}, ${activeRift.tierColor}cc)`, color: "#000", opacity: actionLoading ? 0.5 : 1 }}
              >
                {actionLoading ? "..." : `Complete Stage ${activeRift.currentStage}`}
              </button>
            )}
            {!activeRift.completed && !confirmAbandon && (
              <button
                onClick={() => setConfirmAbandon(true)}
                disabled={actionLoading}
                className="btn-interactive text-xs px-4 py-2.5 rounded-lg"
                style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                Abandon
              </button>
            )}
            {!activeRift.completed && confirmAbandon && (
              <div className="flex gap-2 items-center">
                <span className="text-xs" style={{ color: "rgba(239,68,68,0.7)" }}>Abandon? ({tiers[activeRift.tier]?.failCooldownDays || 3}d cooldown)</span>
                <button
                  onClick={abandonRift}
                  disabled={actionLoading}
                  className="btn-interactive text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmAbandon(false)}
                  className="btn-interactive text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tier selection — shown when no active rift */}
      {!activeRift && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TIER_IDS.map(id => {
            const tier = tiers[id];
            if (!tier) return null;
            const locked = !tier.unlocked;
            const onCd = tier.onCooldown;
            const canEnter = !locked && !onCd;
            return (
              <div key={id} className="rounded-xl p-4 space-y-3" style={{
                background: locked ? "rgba(255,255,255,0.02)" : `${tier.color}06`,
                border: `1px solid ${locked ? "rgba(255,255,255,0.05)" : `${tier.color}25`}`,
                opacity: locked ? 0.5 : 1,
              }}>
                <div className="text-center">
                  <span className="text-2xl">{tier.icon}</span>
                  <p className="text-sm font-bold mt-1" style={{ color: tier.color }}>{tier.name}</p>
                  {locked && <p className="text-xs text-w20">Requires Lv.{tier.minLevel}</p>}
                </div>
                <div className="space-y-1 text-xs text-w35">
                  <TipCustom title="Rift Stages" icon="⚔️" accent={tier.color} body={<p>Complete {tier.questCount} quests sequentially with escalating difficulty (1× to {tier.questCount > 5 ? "3.5" : tier.questCount > 3 ? "2.5" : "1.5"}×). Each stage grants full XP, Gold, and loot rewards.</p>}>
                    <div className="flex justify-between"><span>Stages</span><span className="font-mono text-w50">{tier.questCount}</span></div>
                  </TipCustom>
                  <TipCustom title="Time Limit" icon="⏱️" accent={tier.color} body={<p>You have {tier.timeLimitHours} hours to complete all {tier.questCount} stages. If time runs out, the run fails and a cooldown is triggered.</p>}>
                    <div className="flex justify-between"><span>Time Limit</span><span className="font-mono text-w50">{tier.timeLimitHours}h</span></div>
                  </TipCustom>
                  <Tip k="rift_cooldown">
                    <div className="flex justify-between"><span>Fail Cooldown</span><span className="font-mono text-w50">{tier.failCooldownDays}d</span></div>
                  </Tip>
                </div>
                {tier.completionBonus && (
                  <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <p className="text-xs text-w25 mb-1">Completion Bonus:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(tier.completionBonus).map(([k, v]) => {
                        const tipKey = k === "gold" ? "gold" : k === "essenz" ? "essenz" : k === "sternentaler" ? "sternentaler" : k === "runensplitter" ? "runensplitter" : "";
                        const badge = (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: k === "gold" ? "#fbbf24" : k === "essenz" ? "#ef4444" : k === "sternentaler" ? "#fbbf24" : "#818cf8" }}>
                            {v} {k}
                          </span>
                        );
                        return tipKey ? <Tip key={k} k={tipKey}>{badge}</Tip> : <span key={k}>{badge}</span>;
                      })}
                    </div>
                  </div>
                )}
                {onCd && tier.cooldownEndsAt && (
                  <p className="text-xs text-center" style={{ color: "#ef4444" }}>
                    Cooldown until {new Date(tier.cooldownEndsAt).toLocaleDateString()}
                  </p>
                )}
                <button
                  onClick={() => canEnter && enterRift(id)}
                  disabled={!canEnter || actionLoading}
                  className="btn-interactive w-full text-xs font-bold py-2 rounded-lg"
                  style={{
                    background: canEnter ? `${tier.color}15` : "rgba(255,255,255,0.03)",
                    color: canEnter ? tier.color : "rgba(255,255,255,0.2)",
                    border: `1px solid ${canEnter ? `${tier.color}40` : "rgba(255,255,255,0.06)"}`,
                    cursor: canEnter ? "pointer" : "not-allowed",
                  }}
                >
                  {locked ? "Locked" : onCd ? "On Cooldown" : actionLoading ? "..." : "Enter Rift"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w25 mb-2">Rift History</p>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: h.success ? "#22c55e" : "#ef4444" }}>{h.success ? "✓" : "✕"}</span>
                  <span className="text-w40 capitalize">{h.tier}</span>
                  <span className="text-w20">{h.stages}/{h.totalStages || "?"} stages</span>
                </div>
                <span className="text-w15">{new Date(h.completedAt || h.failedAt || h.startedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
