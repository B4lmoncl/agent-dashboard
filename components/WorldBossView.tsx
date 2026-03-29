"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";
import { formatLegendaryLabel } from "@/app/utils";
import type { RewardCelebrationData } from "@/components/RewardCelebration";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BossTemplate {
  id: string;
  name: string;
  title: string;
  icon: string;
  accent: string;
  description: string;
  titleReward?: string;
  frameReward?: { id: string; name: string; color: string; glow?: boolean };
  uniqueDrops?: string[];
}

interface LeaderboardEntry {
  playerId: string;
  name: string;
  damage: number;
  quests: number;
}

interface PlayerContribution {
  damage: number;
  quests: number;
}

interface ClaimReward {
  type: string;
  amount?: number;
  name?: string;
  itemId?: string;
  slot?: string;
  materialId?: string;
  rarity?: string;
}

interface UniqueItemPreview {
  id: string;
  name: string;
  slot: string;
  desc: string;
  flavorText?: string;
  legendaryEffect?: { type: string; label?: string; min?: number; max?: number };
  icon: string | null;
}

interface ActiveBossData {
  active: true;
  boss: BossTemplate & {
    spawnedAt: string;
    expiresAt: string;
    maxHp: number;
    currentHp: number;
    defeated: boolean;
    defeatedAt: string | null;
    contributorCount: number;
    totalDamageDealt: number;
    uniqueItemDetails?: UniqueItemPreview[];
  };
  leaderboard: LeaderboardEntry[];
  playerContribution: PlayerContribution | null;
  canClaim: boolean;
  projectedDamage?: { gearScore: number; gsMultiplier: number; perQuest: Record<string, number> } | null;
}

interface InactiveBossData {
  active: false;
  nextSpawnEstimate: string | null;
  lastBoss: {
    bossId: string;
    defeatedAt?: string;
    expiresAt?: string;
    defeated?: boolean;
    expired?: boolean;
    maxHp?: number;
    contributions?: Record<string, PlayerContribution>;
  } | null;
}

interface HistoryEntry {
  bossId: string;
  spawnedAt: string;
  defeatedAt?: string;
  expiresAt?: string;
  defeated?: boolean;
  expired?: boolean;
  maxHp?: number;
  contributions?: Record<string, PlayerContribution>;
}

type BossData = ActiveBossData | InactiveBossData;

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysRemaining(dateStr: string): string {
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function daysUntil(dateStr: string): string {
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return "Soon";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `${days} day${days !== 1 ? "s" : ""}`;
}

function hpBarColor(percent: number): string {
  if (percent > 0.5) return "#22c55e";
  if (percent > 0.25) return "#eab308";
  return "#ef4444";
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function rewardLabel(r: ClaimReward): string {
  switch (r.type) {
    case "gold": return `${r.amount} Gold`;
    case "essenz": return `${r.amount} Essenz`;
    case "stardust": return `${r.amount} Stardust`;
    case "title": return `Title: ${r.name}`;
    case "frame": return `Frame: ${r.name}`;
    case "unique-drop": return `${r.name} (${r.slot})`;
    case "legendary-drop": return `Legendary: ${r.itemId}`;
    case "material": return `${r.amount || 1}x ${r.name || "Material"}`;
    case "gear-drop": return `${r.name} (${r.slot || "Gear"})`;
    default: return r.type;
  }
}

function rewardColor(r: ClaimReward): string {
  switch (r.type) {
    case "gold": return "#fbbf24";
    case "essenz": return "#ef4444";
    case "stardust": return "#818cf8";
    case "title": return "#a855f7";
    case "frame": return "#22d3ee";
    case "unique-drop":
    case "legendary-drop": return "#f97316";
    case "material": return "#f59e0b";
    case "gear-drop": return "#a855f7";
    default: return "#e8e8e8";
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function WorldBossView({ onRefresh, onRewardCelebration, onNavigate }: { onRefresh?: () => void; onRewardCelebration?: (data: RewardCelebrationData) => void; onNavigate?: (view: string) => void }) {
  const { playerName, reviewApiKey } = useDashboard();
  const [data, setData] = useState<BossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ rewards: ClaimReward[]; rank: number; contributionPercent: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bossHistory, setBossHistory] = useState<HistoryEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [damageBurst, setDamageBurst] = useState(false);
  const prevHpRef = useRef<number | null>(null);

  const fetchBoss = useCallback(async () => {
    try {
      const url = playerName
        ? `/api/world-boss?player=${encodeURIComponent(playerName)}`
        : "/api/world-boss";
      const r = await fetch(url);
      if (r.ok) {
        const d = await r.json();
        setData(d);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [playerName]);

  useEffect(() => { fetchBoss(); }, [fetchBoss]);

  // Detect HP changes for damage burst effect
  useEffect(() => {
    if (!data || !("boss" in data) || !data.boss) return;
    const currentHp = data.boss.currentHp;
    if (prevHpRef.current !== null && currentHp < prevHpRef.current) {
      setDamageBurst(true);
      setTimeout(() => setDamageBurst(false), 600);
    }
    prevHpRef.current = currentHp;
  }, [data]);

  // Fetch boss history when section is opened
  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/world-boss/history");
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.history)) {
          setBossHistory(d.history.slice(-5).reverse());
        }
      }
    } catch { /* endpoint may not exist yet */ }
  }, []);

  useEffect(() => {
    if (historyOpen && bossHistory.length === 0) fetchHistory();
  }, [historyOpen, bossHistory.length, fetchHistory]);

  // Update clock + auto-refresh every 60s when boss is active and not defeated
  useEffect(() => {
    if (!data || !data.active) return;
    if (data.active && data.boss.defeated) return;
    const interval = setInterval(() => {
      setNow(Date.now());
      fetchBoss();
    }, 60000);
    return () => clearInterval(interval);
  }, [data, fetchBoss]);

  const claimRewards = useCallback(async () => {
    if (!reviewApiKey || claiming) return;
    setClaiming(true);
    setMessage(null);
    try {
      const r = await fetch("/api/world-boss/claim", {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      const d = await r.json();
      if (!r.ok) {
        setMessage({ text: d.error || "Failed to claim rewards", type: "error" });
      } else {
        setClaimResult(d);
        setMessage({ text: "Rewards claimed!", type: "success" });
        fetchBoss();
        onRefresh?.();
        if (onRewardCelebration && d.rewards) {
          const currencies: { name: string; amount: number; color: string }[] = [];
          for (const rw of d.rewards) {
            if (rw.type === "essenz" && rw.amount) currencies.push({ name: "Essenz", amount: rw.amount, color: "#ef4444" });
            if (rw.type === "stardust" && rw.amount) currencies.push({ name: "Stardust", amount: rw.amount, color: "#818cf8" });
          }
          const goldReward = d.rewards.find((rw: ClaimReward) => rw.type === "gold");
          const lootReward = d.rewards.find((rw: ClaimReward) => rw.type === "unique-drop" || rw.type === "legendary-drop" || rw.type === "gear-drop");
          onRewardCelebration({
            type: "world-boss",
            title: "World Boss Rewards!",
            xpEarned: 0,
            goldEarned: goldReward?.amount || 0,
            loot: lootReward ? { name: lootReward.name || "Loot Drop", emoji: "◆", rarity: lootReward.rarity || "legendary", rarityColor: lootReward.type === "gear-drop" ? "#a855f7" : "#ff8c00" } : undefined,
            currencies: currencies.length > 0 ? currencies : undefined,
            flavor: d.rank ? `Rank #${d.rank} · ${d.contributionPercent}% contribution` : undefined,
          });
        }
      }
    } catch {
      setMessage({ text: "Network error", type: "error" });
    }
    setClaiming(false);
  }, [reviewApiKey, claiming, fetchBoss, onRefresh, onRewardCelebration]);

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="space-y-3 tab-content-enter">
      <div className="skeleton-card h-24" />
      <div className="skeleton-card h-40" />
      <div className="skeleton-card h-32" />
    </div>
  );

  // ─── No Active Boss ─────────────────────────────────────────────────────────

  if (!data || !data.active) {
    const inactive = data as InactiveBossData | null;
    return (
      <div className="space-y-5 tab-content-enter">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-3xl">💀</p>
          <Tip k="world_boss" heading>
            <h2 className="text-lg font-bold" style={{ color: "#e8e8e8", cursor: "help" }}>World Boss</h2>
          </Tip>
        </div>

        <div className="rounded-xl p-8 text-center space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-4xl" style={{ opacity: 0.3 }}>🏔️</p>
          <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>No World Boss Active</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)", maxWidth: "min(360px, 100%)", margin: "0 auto" }}>
            The land rests in uneasy peace. A new threat will emerge from the darkness when the time is right.
          </p>
          {inactive?.nextSpawnEstimate && (
            <div className="rounded-lg px-4 py-2 inline-block" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Next spawn in <span className="font-mono font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{daysUntil(inactive.nextSpawnEstimate)}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Active / Defeated Boss ─────────────────────────────────────────────────

  const { boss, leaderboard, playerContribution, canClaim, projectedDamage } = data as ActiveBossData;
  const hpPercent = boss.maxHp > 0 ? boss.currentHp / boss.maxHp : 0;
  const hpColor = hpBarColor(hpPercent);
  const expiresIn = new Date(boss.expiresAt).getTime() - now;
  const isUrgent = expiresIn < 24 * 60 * 60 * 1000;
  const isWarning = !isUrgent && expiresIn < 72 * 60 * 60 * 1000;
  const playerRank = playerContribution
    ? leaderboard.findIndex(e => e.name?.toLowerCase() === playerName?.toLowerCase()) + 1
    : 0;

  return (
    <div className="space-y-5 tab-content-enter relative">
      {/* Red/orange chaos embers — only when boss is active */}
      {!boss.defeated && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={`chaos-ember-${i}`} className="absolute rounded-full" style={{
              width: 2 + (i % 2),
              height: 2 + (i % 2),
              left: `${8 + (i * 14) % 80}%`,
              top: `${15 + (i * 19) % 65}%`,
              background: i % 3 === 0 ? "rgba(239,68,68,0.6)" : i % 3 === 1 ? "rgba(234,88,12,0.55)" : "rgba(249,115,22,0.5)",
              boxShadow: `0 0 ${3 + i % 2}px ${i % 3 === 0 ? "rgba(239,68,68,0.4)" : "rgba(234,88,12,0.35)"}`,
              animation: `ember-float ${3.5 + (i % 3) * 0.8}s ease-in-out ${i * 0.6}s infinite`,
              opacity: 0,
            }} />
          ))}
        </div>
      )}
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-3xl">💀</p>
        <Tip k="world_boss" heading>
          <h2 className="text-lg font-bold" style={{ color: "#e8e8e8", cursor: "help" }}>World Boss</h2>
        </Tip>
        <p className="text-xs text-w35" style={{ maxWidth: "min(440px, 100%)", margin: "0 auto" }}>
          A community-wide threat. Deal damage by completing quests. Claim rewards when defeated.
        </p>
        <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.25)", maxWidth: "min(440px, 100%)", margin: "4px auto 0" }}>Der Turm bebt. Etwas Uraltes ist erwacht.</p>
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

      {/* Boss Card */}
      <div className="rounded-xl overflow-hidden crystal-breathe" style={{
        background: `linear-gradient(135deg, ${boss.accent}08 0%, rgba(14,14,18,0.95) 100%)`,
        border: `1px solid ${boss.accent}30`,
        ["--glow-color" as string]: `${boss.accent}40`,
      }}>
        {/* Accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${boss.accent}aa, transparent)` }} />

        {/* Boss Portrait — large, prominent */}
        {boss.icon?.startsWith("/") && (
          <div className="relative" style={{ height: 160, overflow: "hidden" }}>
            <img src={boss.icon} alt={boss.name} className="w-full h-full object-cover" style={{ imageRendering: "auto", objectPosition: "center top" }} onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
            {/* Gradient overlay for readability */}
            <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, ${boss.accent}20 60%, #141418 100%)` }} />
            {/* Timer overlay */}
            <div className="absolute top-3 right-3">
              {boss.defeated ? (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(34,197,94,0.9)", color: "#fff" }}>Defeated!</span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold" style={{ background: "rgba(0,0,0,0.7)", color: isUrgent ? "#ef4444" : isWarning ? "#eab308" : boss.accent, border: `1px solid ${isUrgent ? "rgba(239,68,68,0.4)" : `${boss.accent}40`}` }}>
                  {daysRemaining(boss.expiresAt)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Boss Info */}
        <div className="p-5 pb-4">
          <div>
            <p className="text-lg font-bold" style={{ color: boss.accent }}>{boss.name}</p>
            <p className="text-xs italic" style={{ color: `${boss.accent}80` }}>{boss.title}</p>
            <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>{boss.description}</p>
          </div>
        </div>

        {/* HP Bar */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: boss.defeated ? "#22c55e" : hpColor }}>
              {boss.defeated ? "Vanquished" : "HP"}
            </span>
            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
              {formatNumber(boss.currentHp)} / {formatNumber(boss.maxHp)}
            </span>
          </div>
          {/* Damage burst particles (outside overflow-hidden bar) */}
          <div className="relative" style={{ height: 0 }}>
            {damageBurst && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="absolute pointer-events-none" style={{
                width: 3, height: 6, borderRadius: 1,
                background: `linear-gradient(180deg, ${hpColor}, transparent)`,
                bottom: 4, left: `${15 + i * 13}%`,
                animation: `crystal-particle-rise 0.6s ease-out ${i * 0.05}s forwards`,
                boxShadow: `0 0 4px ${hpColor}80`,
              }} />
            ))}
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 12, background: "rgba(255,255,255,0.06)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)" }}>
            <div
              className={`h-full rounded-full transition-all duration-700${!boss.defeated ? " bar-pulse" : ""}${hpPercent < 0.25 && !boss.defeated ? " rift-urgent" : ""}`}
              style={{
                width: `${Math.max(hpPercent * 100, boss.defeated ? 0 : 0.5)}%`,
                background: boss.defeated
                  ? "linear-gradient(90deg, #22c55e88, #22c55e)"
                  : `linear-gradient(90deg, ${hpColor}66, ${hpColor}, ${hpColor}cc)`,
                boxShadow: `0 0 12px ${boss.defeated ? "#22c55e" : hpColor}60, inset 0 1px 0 rgba(255,255,255,0.15)`,
                animationDuration: hpPercent < 0.25 ? "1s" : "3s",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            {/* Boss phase indicator */}
            {!boss.defeated && (
              <span className="text-xs font-semibold" style={{ color: hpColor, opacity: 0.7 }}>
                {hpPercent > 0.66 ? "Phase 1" : hpPercent > 0.33 ? "Phase 2: Weakened" : "Phase 3: Enraged"}
              </span>
            )}
            {boss.defeated && <span className="text-xs font-semibold" style={{ color: "#22c55e" }}>Defeated</span>}
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              {boss.contributorCount} contributor{boss.contributorCount !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
              {Math.round((1 - hpPercent) * 100)}% dealt
            </span>
          </div>
        </div>

        {/* Unique Loot Preview */}
        {boss.uniqueItemDetails && boss.uniqueItemDetails.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: `${boss.accent}90` }}>Unique Drops</p>
            <div className="space-y-1.5">
              {boss.uniqueItemDetails.map(item => (
                <TipCustom
                  key={item.id}
                  title={item.name}
                  accent="#ff8c00"
                  hoverDelay={300}
                  body={<>
                    <p className="text-xs" style={{ color: "#ff8c00" }}>Legendary {item.slot}</p>
                    {item.desc && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>}
                    {item.flavorText && <p className="text-xs italic mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>&ldquo;{item.flavorText}&rdquo;</p>}
                    {item.legendaryEffect?.label && <p className="text-xs mt-1 font-semibold" style={{ color: "#f59e0b" }}>{formatLegendaryLabel(item.legendaryEffect)}</p>}
                  </>}
                >
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-help" style={{ background: "rgba(255,140,0,0.04)", border: "1px solid rgba(255,140,0,0.12)", borderLeft: "2px solid #ff8c00" }}>
                    <span className="text-sm" style={{ color: "#ff8c00" }}>{"\u2726"}</span>
                    <span className="text-xs font-semibold" style={{ color: "#ff8c00" }}>{item.name}</span>
                    <span className="text-xs text-w20 ml-auto capitalize">{item.slot}</span>
                  </div>
                </TipCustom>
              ))}
            </div>
            {onNavigate && (
              <button onClick={() => onNavigate("character")} className="btn-interactive text-xs mt-1.5" style={{ color: `${boss.accent}80`, cursor: "pointer" }}>
                View Collection →
              </button>
            )}
          </div>
        )}

        {/* Mondstaub Boost — only when boss is alive */}
        {!boss.defeated && reviewApiKey && (
          <div className="px-5 pb-4">
            <button
              onClick={async () => {
                setMessage(null);
                try {
                  const r = await fetch("/api/world-boss/boost", {
                    method: "POST",
                    headers: getAuthHeaders(),
                  });
                  const d = await r.json();
                  if (r.ok) {
                    setMessage({ text: d.message || "Boost activated!", type: "success" });
                    fetchBoss();
                  } else {
                    setMessage({ text: d.error || "Boost failed", type: "error" });
                  }
                } catch { setMessage({ text: "Network error", type: "error" }); }
                setTimeout(() => setMessage(null), 4000);
              }}
              title="Spend 50 Mondstaub for +25% boss damage on next 10 quests"
              className="btn-interactive w-full text-xs font-semibold py-2 rounded-lg"
              style={{
                background: "rgba(192,132,252,0.1)",
                color: "#c084fc",
                border: "1px solid rgba(192,132,252,0.25)",
                cursor: "pointer",
              }}
            >
              Mondstaub Boost (+25% damage, 50 Mondstaub)
            </button>
          </div>
        )}

        {/* Defeated — Claim Rewards */}
        {boss.defeated && canClaim && !claimResult && (
          <div className="px-5 pb-4">
            <Tip k="wb_claim_tiers"><p className="text-xs mb-2 cursor-help" style={{ color: "rgba(255,255,255,0.25)" }}>Rewards scale with your contribution rank</p></Tip>
            <button
              onClick={claimRewards}
              disabled={claiming}
              className={`btn-interactive w-full text-sm font-bold py-3 rounded-lg${!claiming ? " claimable-breathe" : ""}`}
              style={{
                background: `linear-gradient(135deg, ${boss.accent}, ${boss.accent}cc)`,
                color: "#000",
                opacity: claiming ? 0.5 : 1,
                cursor: claiming ? "not-allowed" : "pointer",
                boxShadow: `0 0 16px ${boss.accent}40`,
                ["--claim-color" as string]: `${boss.accent}60`,
              }}
            >
              {claiming ? "Claiming..." : "Claim Rewards"}
            </button>
          </div>
        )}

        {/* Claim Result */}
        {claimResult && (
          <div className="px-5 pb-4">
            <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#22c55e" }}>Rewards Received</p>
              <div className="flex flex-wrap gap-2">
                {claimResult.rewards.map((r, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-lg font-semibold" style={{
                    background: "rgba(255,255,255,0.04)",
                    color: rewardColor(r),
                    border: `1px solid ${rewardColor(r)}30`,
                  }}>
                    {rewardLabel(r)}
                  </span>
                ))}
              </div>
              <div className="flex gap-4 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                <span>Rank #{claimResult.rank}</span>
                <span>{claimResult.contributionPercent}% contribution</span>
              </div>
              {onNavigate && (
                <div className="flex gap-3 mt-1">
                  {claimResult.rewards.some(r => r.type === "unique-drop" || r.type === "legendary-drop") && (
                    <button onClick={() => onNavigate("character")} className="btn-interactive text-xs" style={{ color: "#f59e0b", cursor: "pointer" }}>View in Character →</button>
                  )}
                  <button onClick={() => onNavigate("forge")} className="btn-interactive text-xs" style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>View in Forge →</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Your Contribution */}
      {playerContribution && (
        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-w25 mb-3">Your Contribution</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold font-mono" style={{ color: "#ef4444" }}>{formatNumber(playerContribution.damage)}</p>
              <TipCustom title="Damage Dealt" icon="⚔️" accent="#ef4444" body={<p>Damage is calculated from quest completions. Higher rarity quests deal more damage.</p>}>
                <p className="text-xs text-w20 cursor-help">Damage Dealt</p>
              </TipCustom>
            </div>
            <div>
              <p className="text-lg font-bold font-mono" style={{ color: "#a855f7" }}>{playerContribution.quests}</p>
              <p className="text-xs text-w20">Quests Completed</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono" style={{ color: "#fbbf24" }}>
                {playerRank > 0 ? `#${playerRank}` : "-"}
              </p>
              <p className="text-xs text-w20">Rank</p>
            </div>
          </div>
        </div>
      )}

      {/* Projected Damage */}
      {projectedDamage && !boss.defeated && (
        <div className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.1)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(239,68,68,0.6)" }}>Damage per Quest</p>
            <TipCustom title="Damage Calculation" icon="⚔️" accent="#ef4444" body={<><p>Base damage depends on quest rarity. Your Gear Score adds a multiplier: +10% per 50 GS (max +100%).</p><p style={{ marginTop: 4, opacity: 0.7 }}>Your GS: {projectedDamage.gearScore} → ×{projectedDamage.gsMultiplier.toFixed(1)}</p></>}>
              <span className="text-xs cursor-help" style={{ color: "rgba(255,255,255,0.3)" }}>GS {projectedDamage.gearScore} · ×{projectedDamage.gsMultiplier.toFixed(1)}</span>
            </TipCustom>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["common", "uncommon", "rare", "epic", "legendary"] as const).map(rarity => {
              const dmg = projectedDamage.perQuest[rarity];
              if (!dmg) return null;
              const RARITY_CLR: Record<string, string> = { common: "#9ca3af", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f97316" };
              return (
                <div key={rarity} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: RARITY_CLR[rarity] }} />
                  <span className="text-xs font-mono font-bold" style={{ color: RARITY_CLR[rarity] }}>{dmg}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contribution Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-w25">Contribution Leaderboard</p>
          </div>
          <div>
            {leaderboard.slice(0, 10).map((entry, i) => {
              const isPlayer = entry.name?.toLowerCase() === playerName?.toLowerCase();
              const rankColor = i === 0 ? "#fbbf24" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.3)";
              return (
                <div
                  key={entry.playerId}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    background: isPlayer ? "rgba(255,255,255,0.03)" : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  <span className="text-xs font-bold font-mono w-6 text-right" style={{ color: rankColor }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-xs font-semibold truncate" style={{ color: isPlayer ? "#e8e8e8" : "rgba(255,255,255,0.5)" }}>
                    {entry.name}
                    {isPlayer && <span className="text-xs ml-1" style={{ color: boss.accent }}>(you)</span>}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#ef4444" }}>
                    {formatNumber(entry.damage)} dmg
                  </span>
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)", minWidth: 40, textAlign: "right" }}>
                    {entry.quests}q
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Boss History */}
      {bossHistory.length > 0 && (
        <div>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="btn-interactive flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-w25"
          >
            <span style={{ transform: historyOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>
              ▸
            </span>
            Past World Bosses ({bossHistory.length})
          </button>
          {historyOpen && (
            <div className="mt-2 space-y-1 tab-content-enter">
              {bossHistory.map((h, i) => {
                const contributorCount = h.contributions ? Object.keys(h.contributions).length : 0;
                return (
                  <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: h.defeated ? "#22c55e" : "#ef4444" }}>{h.defeated ? "Slain" : "Escaped"}</span>
                      <span className="text-w40">{h.bossId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                      {contributorCount > 0 && (
                        <span className="text-w20">{contributorCount} contributors</span>
                      )}
                    </div>
                    <span className="text-w15">
                      {new Date(h.defeatedAt || h.expiresAt || h.spawnedAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
