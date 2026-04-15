"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";
import type { RewardCelebrationData } from "@/components/RewardCelebration";
import { TutorialMomentBanner } from "@/components/ContextualTutorial";

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
  gold: { icon: "/images/icons/currency-gold.png", color: "#f59e0b", label: "Gold" },
  essenz: { icon: "/images/icons/currency-essenz.png", color: "#ef4444", label: "Essenz" },
  runensplitter: { icon: "/images/icons/currency-runensplitter.png", color: "#a78bfa", label: "Runensplitter" },
  stardust: { icon: "/images/icons/currency-stardust.png", color: "#818cf8", label: "Stardust" },
  sternentaler: { icon: "/images/icons/nav-challenges.png", color: "#fbbf24", label: "Sternentaler" },
  mondstaub: { icon: "/images/icons/currency-mondstaub.png", color: "#c084fc", label: "Mondstaub" },
  material: { icon: "/images/icons/mat-eisenerz.png", color: "#f59e0b", label: "Material" },
  title: { icon: "/images/icons/nav-proving.png", color: "#fbbf24", label: "Titel" },
  frame: { icon: "/images/icons/nav-character.png", color: "#a78bfa", label: "Rahmen" },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function BattlePassView({ onRewardCelebration, onNavigate }: { onRewardCelebration?: (data: RewardCelebrationData) => void; onNavigate?: (view: string) => void } = {}) {
  const { playerName, reviewApiKey } = useDashboard();
  const [config, setConfig] = useState<BPConfig | null>(null);
  const [rewards, setRewards] = useState<BPReward[]>([]);
  const [player, setPlayer] = useState<BPPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const firstUnclaimedRef = useRef<HTMLDivElement | null>(null);
  const didScrollRef = useRef(false);
  // Auto-scroll to first unclaimed reward — must be before early return (Rules of Hooks)
  useEffect(() => {
    if (loading || !config || !player) return;
    if (didScrollRef.current) return;
    const unclaimed = rewards.filter(r => (player?.level ?? 0) >= r.level && !(player?.claimedLevels ?? []).includes(r.level));
    if (unclaimed.length > 0 && firstUnclaimedRef.current) {
      didScrollRef.current = true;
      setTimeout(() => {
        firstUnclaimedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [loading, config, player, rewards]);

  const fetchBP = useCallback(async () => {
    try {
      const r = await fetch("/api/battlepass", { headers: getAuthHeaders(reviewApiKey) });
      if (r.ok) {
        const data = await r.json();
        setConfig(data.config);
        setRewards(data.rewards || []);
        setPlayer(data.player);
      }
    } catch (e) { console.error("[battlepass]", e); setMessage({ type: "error", text: "Failed to load Season Pass data" }); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBP(); }, [fetchBP]);

  const claimLevel = async (level: number) => {
    setClaiming(level);
    try {
      const r = await fetch(`/api/battlepass/claim/${level}`, {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      const data = await r.json();
      if (r.ok) {
        setMessage({ text: `Level ${level} reward claimed.`, type: "success" });
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
            title: g.type === "title" ? `Title: ${g.titleName}` : g.type === "frame" ? `Frame: ${g.frameName}` : g.type === "material" ? `${g.amount || 1}x ${g.materialId || "Material"}` : g.type === "gold" ? `+${g.amount || 0} Gold` : `Level ${level} Reward`,
            xpEarned: 0,
            goldEarned: g.type === "gold" ? (g.amount || 0) : 0,
            currencies: currencies.length > 0 ? currencies : undefined,
            flavor: g.type === "material" ? "Crafting materials from the Season Pass." : undefined,
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
    <div className="space-y-3 tab-content-enter" style={{ minHeight: 400 }}>
      <div className="skeleton-card h-24" />
      <div className="skeleton-card h-64" />
    </div>
  );

  const daysLeft = player.seasonEnd ? Math.max(0, Math.ceil((new Date(player.seasonEnd).getTime() - Date.now()) / 86400000)) : 0;
  const unclaimedCount = rewards.filter(r => player.level >= r.level && !(player.claimedLevels || []).includes(r.level)).length;


  return (
    <div data-feedback-id="battlepass-view" className="space-y-5 tab-content-enter">
      <TutorialMomentBanner viewId="season" playerLevel={1} />
      {/* Header */}
      <div className="rounded-xl p-5" style={{
        background: `linear-gradient(135deg, ${config.seasonAccent}12 0%, rgba(14,14,18,0.95) 100%)`,
        border: `1px solid ${config.seasonAccent}30`,
      }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {config.seasonIcon?.startsWith("/") ? <img src={config.seasonIcon} alt="" width={96} height={96} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-3xl">{config.seasonIcon}</span>}
            <div>
              <Tip k="battle_pass" heading>
                <h2 className="text-lg font-bold" style={{ color: config.seasonAccent }}>{config.seasonName}</h2>
              </Tip>
              <p className="text-xs" style={{ color: `${config.seasonAccent}60` }}>{config.seasonTheme}</p>
              <p className="text-xs italic mt-0.5" style={{ color: `${config.seasonAccent}30` }}>Die Zeit ist kein Feind. Sie ist ein Lehrer mit einem sehr engen Zeitplan.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-mono font-bold crystal-breathe" style={{ color: config.seasonAccent, ["--glow-color" as string]: `${config.seasonAccent}30`, borderRadius: 6, padding: "2px 6px" }}>
              Level {player.level} / {config.levels}
            </p>
            <TipCustom title="Saisonende" icon="◆" accent={config.seasonAccent} body={<p>Verbleibende Tage bis zum Ende der aktuellen Saison. Nicht beanspruchte Belohnungen verfallen.</p>}>
              <p className="text-xs font-mono" style={{ color: daysLeft <= 3 ? "#ef4444" : daysLeft <= 7 ? "#f59e0b" : "rgba(255,255,255,0.3)", cursor: "help" }}>
                {daysLeft <= 3 ? `${daysLeft}d left` : daysLeft <= 7 ? `${daysLeft}d remaining` : `${daysLeft}d remaining`}
              </p>
            </TipCustom>
          </div>
        </div>

        {/* XP progress */}
        <div className="flex items-center justify-between mb-1">
          <Tip k="bp_xp_sources"><span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", cursor: "help" }}>Season XP</span></Tip>
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
            {player.xpInLevel} / {player.xpPerLevel}
          </span>
        </div>
        <div className={`progress-bar-diablo${player.progress > 0.9 ? " progress-bar-nearly-full" : ""}`}>
          <div
            className="progress-bar-diablo-fill bar-pulse progress-shimmer"
            style={{
              width: `${Math.round(player.progress * 100)}%`,
              background: `linear-gradient(90deg, ${config.seasonAccent}88, ${config.seasonAccent}, ${config.seasonAccent}cc)`,
            }}
          />
        </div>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
          <Tip k="bp_xp_sources"><span style={{ cursor: "help" }}>Total: {player.xp} XP · {config.xpPerLevel} per level</span></Tip>
          {unclaimedCount > 0 && <span style={{ color: "#22c55e", fontWeight: 600 }}> · {unclaimedCount} unclaimed</span>}
        </p>
        {unclaimedCount >= 2 && (
          <button
            disabled={claimingAll}
            title={claimingAll ? "Claiming rewards..." : undefined}
            onClick={async () => {
              setClaimingAll(true);
              try {
                const r = await fetch("/api/battlepass/claim-all", { method: "POST", headers: getAuthHeaders(reviewApiKey) });
                const data = await r.json();
                if (r.ok) {
                  setMessage({ type: "success", text: `${data.count} rewards claimed.` });
                  if (onRewardCelebration) {
                    // Aggregate rewards for meaningful celebration
                    let totalGold = 0;
                    const currMap: Record<string, number> = {};
                    const titles: string[] = [];
                    for (const g of (data.granted || [])) {
                      if (g.type === "gold") totalGold += g.amount || 0;
                      else if (g.type === "title") titles.push(g.titleName || "Title");
                      else if (g.type === "frame") titles.push(`Frame: ${g.frameName || "?"}`);
                      else if (g.amount) currMap[g.type] = (currMap[g.type] || 0) + g.amount;
                    }
                    const currencies = Object.entries(currMap).map(([type, amount]) => ({
                      name: type.charAt(0).toUpperCase() + type.slice(1),
                      amount,
                      color: type === "essenz" ? "#ef4444" : type === "runensplitter" ? "#a78bfa" : type === "stardust" ? "#818cf8" : type === "sternentaler" ? "#fbbf24" : "#c084fc",
                    }));
                    const parts = [`${data.count} Rewards`];
                    if (titles.length > 0) parts.push(titles.join(", "));
                    onRewardCelebration({ type: "battlepass", title: parts.join(" — "), xpEarned: 0, goldEarned: totalGold, currencies: currencies.length > 0 ? currencies : undefined });
                  }
                  fetchBP();
                } else {
                  setMessage({ type: "error", text: data.error || "Claim failed" });
                }
                setTimeout(() => setMessage(null), 5000);
              } catch { setMessage({ type: "error", text: "Network error" }); }
              setClaimingAll(false);
            }}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold mt-2 btn-press"
            style={{ background: claimingAll ? "rgba(255,255,255,0.03)" : "rgba(34,197,94,0.1)", color: claimingAll ? "rgba(255,255,255,0.2)" : "#22c55e", border: `1px solid ${claimingAll ? "rgba(255,255,255,0.06)" : "rgba(34,197,94,0.25)"}`, cursor: claimingAll ? "not-allowed" : "pointer" }}
          >
            {claimingAll ? "Claiming..." : `Claim All (${unclaimedCount})`}
          </button>
        )}
      </div>

      {/* Season end warning */}
      {daysLeft <= 7 && daysLeft > 0 && (
        <div className="rounded-lg px-4 py-3 flex items-center gap-3 tab-content-enter" style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <p className="text-xs font-bold" style={{ color: "#ef4444" }}>Season ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}.</p>
            <p className="text-xs" style={{ color: "rgba(239,68,68,0.6)" }}>Unclaimed rewards will be lost. Claim them before the season resets.</p>
          </div>
        </div>
      )}
      {daysLeft === 0 && (
        <div className="rounded-lg px-4 py-3 flex items-center gap-3 tab-content-enter" style={{
          background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.35)",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p className="text-xs font-bold" style={{ color: "#ef4444" }}>Season ends today. Claim remaining rewards before the reset.</p>
        </div>
      )}

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
          const rc = REWARD_CONFIG[r.type] || { icon: "/images/icons/currency-gold.png", color: "#888", label: r.type };
          const isReached = player.level >= r.level;
          const isClaimed = (player.claimedLevels || []).includes(r.level);
          const canClaim = isReached && !isClaimed;
          const isMilestone = r.milestone;

          return (
            <div
              key={r.level}
              ref={canClaim ? (el) => { if (el && !firstUnclaimedRef.current) firstUnclaimedRef.current = el; } : undefined}
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all"
              style={{
                background: isMilestone
                  ? isReached ? `linear-gradient(135deg, ${config.seasonAccent}10 0%, rgba(17,19,24,0.95) 100%)` : "rgba(255,255,255,0.02)"
                  : isReached ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
                border: isMilestone
                  ? `1px solid ${isReached ? `${config.seasonAccent}35` : "rgba(255,255,255,0.06)"}`
                  : "1px solid transparent",
                borderLeft: isMilestone && isReached ? `3px solid ${config.seasonAccent}60` : undefined,
                opacity: isClaimed ? 0.55 : isReached ? 1 : 0.4,
                boxShadow: isMilestone && canClaim ? `0 0 12px ${config.seasonAccent}10` : "none",
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
                {rc.icon.startsWith("/") ? (
                  <img src={rc.icon} alt="" width={28} height={28} className="img-render-auto flex-shrink-0" onError={e => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <span style={{ fontSize: 18 }}>{rc.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: isReached ? rc.color : "rgba(255,255,255,0.3)" }}>
                    {r.type === "title" ? <TipCustom title={r.titleName || "Title"} icon="◆" accent={rc.color} body={<p>{r.titleRarity ? r.titleRarity.charAt(0).toUpperCase() + r.titleRarity.slice(1) : "Exklusiver"} Titel aus dem Season Pass.</p>}><span style={{ cursor: "help" }}>{r.titleName}</span></TipCustom> : r.type === "frame" ? <TipCustom title={r.frameName || "Frame"} icon="◆" accent={rc.color} body={<p>Kosmetischer Rahmen f&uuml;r dein Spielerprofil.</p>}><span style={{ cursor: "help" }}>{r.frameName}</span></TipCustom> : (
                      ["gold", "essenz", "runensplitter", "stardust", "sternentaler", "mondstaub"].includes(r.type)
                        ? <Tip k={r.type}><span style={{ cursor: "help" }}>{r.amount} {rc.label}</span></Tip>
                        : `${r.amount} ${rc.label}`
                    )}
                  </p>
                  {r.type === "title" && r.titleRarity && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                      {r.titleRarity.charAt(0).toUpperCase() + r.titleRarity.slice(1)} Title
                    </p>
                  )}
                  {onNavigate && (r.type === "title" || r.type === "frame") && (
                    <button onClick={(e) => { e.stopPropagation(); onNavigate("character"); }} className="text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.25)" }} onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}>
                      View in Character {"\u2192"}
                    </button>
                  )}
                  {onNavigate && r.type === "material" && (
                    <button onClick={(e) => { e.stopPropagation(); onNavigate("forge"); }} className="text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.25)" }} onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}>
                      View in Forge {"\u2192"}
                    </button>
                  )}
                </div>
              </div>

              {/* Claim button */}
              {canClaim && (
                <button
                  onClick={() => claimLevel(r.level)}
                  disabled={claiming === r.level}
                  title={claiming === r.level ? "Claiming reward..." : "Claim this reward"}
                  className={`btn-interactive text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0${claiming !== r.level ? " claimable-breathe" : ""}`}
                  style={{
                    background: `${config.seasonAccent}20`,
                    color: config.seasonAccent,
                    border: `1px solid ${config.seasonAccent}40`,
                    opacity: claiming === r.level ? 0.5 : 1,
                    cursor: claiming === r.level ? "not-allowed" : "pointer",
                    ["--claim-color" as string]: `${config.seasonAccent}50`,
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
