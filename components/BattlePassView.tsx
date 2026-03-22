"use client";

import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip } from "@/components/GameTooltip";
import type { RewardCelebrationData } from "@/components/RewardCelebration";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BPReward {
  level: number;
  type: string;
  amount?: number;
  materialId?: string;
  titleId?: string;
  titleName?: string;
  titleRarity?: string;
  frameId?: string;
  frameName?: string;
  frameColor?: string;
  milestone?: boolean;
}

interface BPConfig {
  levels: number;
  xpPerLevel: number;
  seasonDurationDays: number;
  currentSeason: number;
  seasonName: string;
  seasonTheme: string;
  seasonIcon: string;
  seasonAccent: string;
}

interface BPPlayer {
  xp: number;
  level: number;
  xpInLevel: number;
  xpPerLevel: number;
  progress: number;
  claimedLevels: number[];
  seasonEnd: string;
}

// ─── Reward Type Config ─────────────────────────────────────────────────────

const REWARD_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  gold: { icon: "🪙", color: "#f59e0b", label: "Gold" },
  essenz: { icon: "🔴", color: "#ef4444", label: "Essenz" },
  runensplitter: { icon: "💎", color: "#a78bfa", label: "Rune Shards" },
  stardust: { icon: "⭐", color: "#818cf8", label: "Stardust" },
  sternentaler: { icon: "🌟", color: "#fbbf24", label: "Sternentaler" },
  mondstaub: { icon: "🌙", color: "#c084fc", label: "Mondstaub" },
  material: { icon: "🧱", color: "#f59e0b", label: "Material" },
  title: { icon: "👑", color: "#fbbf24", label: "Title" },
  frame: { icon: "🖼️", color: "#a78bfa", label: "Frame" },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function BattlePassView({ onRewardCelebration }: { onRewardCelebration?: (data: RewardCelebrationData) => void } = {}) {
  const { playerName } = useDashboard();
  const [config, setConfig] = useState<BPConfig | null>(null);
  const [rewards, setRewards] = useState<BPReward[]>([]);
  const [player, setPlayer] = useState<BPPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchBP = useCallback(async () => {
    try {
      const r = await fetch("/api/battlepass", { headers: getAuthHeaders() });
      if (r.ok) {
        const data = await r.json();
        setConfig(data.config);
        setRewards(data.rewards || []);
        setPlayer(data.player);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBP(); }, [fetchBP]);

  const claimLevel = async (level: number) => {
    setClaiming(level);
    try {
      const r = await fetch(`/api/battlepass/claim/${level}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await r.json();
      if (r.ok) {
        setMessage({ text: `Level ${level} reward claimed!`, type: "success" });
        fetchBP();
        if (onRewardCelebration && data.granted) {
          const g = data.granted;
          const currencies: { name: string; amount: number; color: string }[] = [];
          if (g.type === "essenz" && g.amount) currencies.push({ name: "Essenz", amount: g.amount, color: "#ef4444" });
          if (g.type === "runensplitter" && g.amount) currencies.push({ name: "Runensplitter", amount: g.amount, color: "#a78bfa" });
          if (g.type === "stardust" && g.amount) currencies.push({ name: "Stardust", amount: g.amount, color: "#818cf8" });
          if (g.type === "sternentaler" && g.amount) currencies.push({ name: "Sternentaler", amount: g.amount, color: "#fbbf24" });
          if (g.type === "mondstaub" && g.amount) currencies.push({ name: "Mondstaub", amount: g.amount, color: "#c084fc" });
          onRewardCelebration({
            type: "battlepass",
            title: g.type === "title" ? `Title: ${g.titleName}` : g.type === "frame" ? `Frame: ${g.frameName}` : `Level ${level} Reward`,
            xpEarned: 0,
            goldEarned: g.type === "gold" ? (g.amount || 0) : 0,
            currencies: currencies.length > 0 ? currencies : undefined,
          });
        }
      } else {
        setMessage({ text: data.error || "Failed to claim", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error", type: "error" });
    }
    setClaiming(null);
    setTimeout(() => setMessage(null), 3000);
  };

  if (!playerName) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Log in to view the Season Pass.</p>
      </div>
    );
  }

  if (loading || !config || !player) return (
    <div className="space-y-3 tab-content-enter">
      <div className="skeleton-card h-24" />
      <div className="skeleton-card h-64" />
    </div>
  );

  const daysLeft = Math.max(0, Math.ceil((new Date(player.seasonEnd).getTime() - Date.now()) / 86400000));
  const unclaimedCount = rewards.filter(r => player.level >= r.level && !player.claimedLevels.includes(r.level)).length;

  return (
    <div className="space-y-5 tab-content-enter">
      {/* Header */}
      <div className="rounded-xl p-5" style={{
        background: `linear-gradient(135deg, ${config.seasonAccent}12 0%, rgba(14,14,18,0.95) 100%)`,
        border: `1px solid ${config.seasonAccent}30`,
      }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.seasonIcon}</span>
            <div>
              <Tip k="battle_pass" heading>
                <h2 className="text-lg font-bold" style={{ color: config.seasonAccent }}>{config.seasonName}</h2>
              </Tip>
              <p className="text-xs" style={{ color: `${config.seasonAccent}60` }}>{config.seasonTheme}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-mono font-bold" style={{ color: config.seasonAccent }}>
              Level {player.level} / {config.levels}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {daysLeft}d remaining
            </p>
          </div>
        </div>

        {/* XP progress */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Season XP</span>
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
            {player.xpInLevel} / {player.xpPerLevel}
          </span>
        </div>
        <div className={`progress-bar-diablo${player.progress > 0.9 ? " progress-bar-nearly-full" : ""}`}>
          <div
            className="progress-bar-diablo-fill"
            style={{
              width: `${Math.round(player.progress * 100)}%`,
              background: `linear-gradient(90deg, ${config.seasonAccent}88, ${config.seasonAccent}, ${config.seasonAccent}cc)`,
            }}
          />
        </div>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
          Total: {player.xp} XP · {config.xpPerLevel} per level
          {unclaimedCount > 0 && <span style={{ color: "#22c55e", fontWeight: 600 }}> · {unclaimedCount} unclaimed</span>}
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div className="rounded-lg px-4 py-2 text-xs font-semibold tab-content-enter" style={{
          background: message.type === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
          color: message.type === "success" ? "#22c55e" : "#ef4444",
          border: `1px solid ${message.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
          {message.text}
        </div>
      )}

      {/* Reward track */}
      <div className="space-y-1">
        {rewards.map(r => {
          const rc = REWARD_CONFIG[r.type] || { icon: "🎁", color: "#888", label: r.type };
          const isReached = player.level >= r.level;
          const isClaimed = player.claimedLevels.includes(r.level);
          const canClaim = isReached && !isClaimed;
          const isMilestone = r.milestone;

          return (
            <div
              key={r.level}
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all"
              style={{
                background: isMilestone
                  ? isReached ? `${config.seasonAccent}0a` : "rgba(255,255,255,0.02)"
                  : isReached ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
                border: isMilestone
                  ? `1px solid ${isReached ? `${config.seasonAccent}30` : "rgba(255,255,255,0.06)"}`
                  : "1px solid transparent",
                opacity: isReached ? 1 : 0.4,
              }}
            >
              {/* Level number */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background: isClaimed ? "#22c55e20" : isReached ? `${config.seasonAccent}15` : "rgba(255,255,255,0.04)",
                  color: isClaimed ? "#22c55e" : isReached ? config.seasonAccent : "rgba(255,255,255,0.2)",
                  border: `1px solid ${isClaimed ? "#22c55e30" : isReached ? `${config.seasonAccent}30` : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {isClaimed ? "✓" : r.level}
              </div>

              {/* Reward icon + description */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span style={{ fontSize: 18 }}>{rc.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: isReached ? rc.color : "rgba(255,255,255,0.3)" }}>
                    {r.type === "title" ? r.titleName : r.type === "frame" ? r.frameName : `${r.amount} ${rc.label}`}
                  </p>
                  {r.type === "title" && r.titleRarity && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                      {r.titleRarity.charAt(0).toUpperCase() + r.titleRarity.slice(1)} Title
                    </p>
                  )}
                </div>
              </div>

              {/* Claim button */}
              {canClaim && (
                <button
                  onClick={() => claimLevel(r.level)}
                  disabled={claiming === r.level}
                  className="btn-interactive text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
                  style={{
                    background: `${config.seasonAccent}20`,
                    color: config.seasonAccent,
                    border: `1px solid ${config.seasonAccent}40`,
                    opacity: claiming === r.level ? 0.5 : 1,
                  }}
                >
                  {claiming === r.level ? "..." : "Claim"}
                </button>
              )}
              {isClaimed && (
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#22c55e" }}>Claimed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
