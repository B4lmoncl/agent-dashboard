"use client";

import { useState, useEffect, useCallback } from "react";
import FirstVisitBanner from "@/components/FirstVisitBanner";
import { TutorialMomentBanner } from "@/components/ContextualTutorial";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";
import type { RewardCelebrationData } from "@/components/RewardCelebration";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FactionStanding {
  id: string;
  name: string;
  minRep: number;
  color: string;
}

interface FactionReward {
  title?: string;
  titleRarity?: string;
  recipe?: string;
  recipeDesc?: string;
  frame?: string;
  frameDesc?: string;
  shopDiscount?: number;
  legendaryEffect?: string;
  effectDesc?: string;
}

interface FactionDaily {
  id: string;
  name: string;
  desc: string;
  req: { type: string; questType?: string; count: number };
  repReward: number;
  goldReward: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

interface Faction {
  id: string;
  name: string;
  icon: string;
  accent: string;
  motto: string;
  description: string;
  questTypes: string[];
  symbol: string;
  rewards: Record<string, FactionReward>;
  playerRep: number;
  standing: string;
  standingName: string;
  standingColor: string;
  nextStanding: { name: string; minRep: number; color: string } | null;
  progress: number;
  weeklyBonusUsed: number;
  weeklyBonusMax: number;
  claimedRewards: string[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FactionsView({ onRewardCelebration, onNavigate }: { onRewardCelebration?: (data: RewardCelebrationData) => void; onNavigate?: (view: string) => void } = {}) {
  const { playerName, reviewApiKey } = useDashboard();
  const [factions, setFactions] = useState<Faction[]>([]);
  const [standings, setStandings] = useState<FactionStanding[]>([]);
  const [dailyQuests, setDailyQuests] = useState<Record<string, FactionDaily[]>>({});
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimingDaily, setClaimingDaily] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchFactions = useCallback(async () => {
    try {
      const r = await fetch("/api/factions", { headers: getAuthHeaders(reviewApiKey) });
      if (r.ok) {
        const data = await r.json();
        setFactions(data.factions || []);
        setStandings(data.standings || []);
        setDailyQuests(data.dailyQuests || {});
      }
    } catch { setMessage({ type: "error", text: "Failed to load faction data" }); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFactions(); }, [fetchFactions]);

  const claimDaily = async (factionId: string, dailyId: string) => {
    setClaimingDaily(dailyId);
    try {
      const r = await fetch(`/api/factions/${factionId}/claim-daily/${dailyId}`, {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      const data = await r.json();
      if (r.ok) {
        fetchFactions();
        if (onRewardCelebration) {
          const faction = factions.find(f => f.id === factionId);
          onRewardCelebration({
            type: "faction",
            title: `${faction?.name || "Faction"} Daily`,
            xpEarned: 0,
            goldEarned: data.goldGained || 0,
            flavor: `+${data.repGained || 0} Rep`,
          });
        }
      } else {
        setMessage({ text: data.error || "Failed to claim", type: "error" });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {
      setMessage({ text: "Network error", type: "error" });
      setTimeout(() => setMessage(null), 3000);
    }
    setClaimingDaily(null);
  };

  const claimReward = async (factionId: string) => {
    setClaiming(factionId);
    try {
      const r = await fetch(`/api/factions/${factionId}/claim`, {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      const data = await r.json();
      if (r.ok) {
        const grantedNames = data.granted?.map((g: { type: string; name?: string }) => g.name || g.type).join(", ") || "Reward";
        setMessage({ text: `Reward claimed: ${grantedNames}`, type: "success" });
        fetchFactions();
        if (onRewardCelebration) {
          const faction = factions.find(f => f.id === factionId);
          onRewardCelebration({
            type: "faction",
            title: `${faction?.name || "Faction"} — ${faction?.standingName || "Reward"}`,
            xpEarned: 0,
            goldEarned: 0,
            flavor: grantedNames,
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
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Log in to view faction standings.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="space-y-3 tab-content-enter">
      <div className="skeleton-card h-32" />
      <div className="skeleton-card h-32" />
    </div>
  );

  const QUEST_TYPE_LABELS: Record<string, string> = {
    fitness: "Fitness", learning: "Learning", development: "Development",
    personal: "Personal", social: "Social", creative: "Creative",
  };

  return (
    <div className="space-y-5 tab-content-enter">
      <TutorialMomentBanner viewId="factions" playerLevel={1} />
      <FirstVisitBanner
        viewId="factions"
        title="Die Vier Zirkel"
        description="Vier Zirkel. Jeder will etwas anderes von dir. Deine Quests verdienen Reputation beim passenden Zirkel. Die Ränge bringen Titel, Rezepte und Rabatte. Loyalität hat ihren Preis. Und ihren Lohn."
        accentColor="#22c55e"
      />
      {/* Header */}
      <div className="text-center space-y-2">
        <img src="/images/icons/nav-factions.png" alt="" width={96} height={96} className="mx-auto img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} />
        <Tip k="factions" heading>
          <h2 className="text-lg font-bold" style={{ color: "#e8e8e8" }}>The Four Circles</h2>
        </Tip>
        <p className="text-xs text-w35" style={{ maxWidth: "min(440px, 100%)", margin: "0 auto" }}>
          Secret orders of the tower. Earn reputation through quests and unlock exclusive rewards.
        </p>
        <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.25)", maxWidth: "min(440px, 100%)", margin: "4px auto 0" }}>Alte Orden, erwacht aus dem langen Schlaf des Turms. Vier Philosophien. Vier Aspekte des Aetherstroms.</p>
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

      {/* Faction cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {factions.map(f => {
          const canClaim = f.standing !== "neutral" && !f.claimedRewards.includes(f.standing);
          const reward = f.rewards[f.standing];
          const weeklyBonusLeft = f.weeklyBonusMax - f.weeklyBonusUsed;

          return (
            <div
              key={f.id}
              className="rounded-xl overflow-hidden crystal-breathe card-hover-lift"
              style={{
                background: `linear-gradient(135deg, ${f.accent}08 0%, rgba(14,14,18,0.95) 100%)`,
                border: `1px solid ${f.accent}30`,
                ["--glow-color" as string]: `${f.accent}25`,
              }}
            >
              {/* Accent bar */}
              <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${f.accent}aa, transparent)` }} />

              {/* Header */}
              <div className="p-4 pb-3">
                <div className="flex items-center gap-3">
                  {f.icon?.startsWith("/") ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${f.accent}30`, boxShadow: `0 0 8px ${f.accent}10` }}>
                      <img src={f.icon} alt="" className="w-full h-full object-cover img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} />
                    </div>
                  ) : <span className="text-2xl">{f.icon}</span>}
                  <div className="flex-1 min-w-0">
                    <TipCustom title={f.name} icon={f.icon} accent={f.accent} body={<p>{f.description}</p>}>
                      <p className="text-sm font-bold" style={{ color: f.accent, cursor: "help" }}>{f.name}</p>
                    </TipCustom>
                    <p className="text-xs italic" style={{ color: `${f.accent}80` }}>{f.motto}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold" style={{ color: f.standingColor }}>{f.standingName}</p>
                    <TipCustom title="Reputation" icon="◆" accent={f.accent} body={<p>Ruf wird automatisch durch passende Quests verdient (+5-35 je nach Quest-Rarit&auml;t). Weekly Bonus verdoppelt den Ruf-Gewinn.</p>}>
                      <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)", cursor: "help" }}>{f.playerRep} Rep</p>
                    </TipCustom>
                  </div>
                </div>

                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>{f.description}</p>

                {/* Quest types */}
                <div className="flex gap-1.5 mt-2">
                  {f.questTypes.map(t => (
                    <TipCustom key={t} title={QUEST_TYPE_LABELS[t] || t} icon="▣" accent={f.accent} body={<p>Quests vom Typ &quot;{QUEST_TYPE_LABELS[t] || t}&quot; geben Ruf bei {f.name}.</p>}>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${f.accent}12`, color: `${f.accent}cc`, border: `1px solid ${f.accent}25`, cursor: "help" }}>
                        {QUEST_TYPE_LABELS[t] || t}
                      </span>
                    </TipCustom>
                  ))}
                  {weeklyBonusLeft > 0 && (
                    <TipCustom title="Weekly Bonus" icon="★" accent={f.accent} body={<p>Your next {weeklyBonusLeft} quest{weeklyBonusLeft > 1 ? "s" : ""} for this faction grant 2× reputation. Resets weekly.</p>}>
                      <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.2)" }}>
                        ★ {weeklyBonusLeft}× Bonus
                      </span>
                    </TipCustom>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <TipCustom title={f.standingName} icon="◆" accent={f.standingColor} body={<p>Aktuelle Rufstufe bei {f.name}. H&ouml;here Stufen schalten exklusive Belohnungen frei.</p>}>
                    <span className="text-xs" style={{ color: f.standingColor, cursor: "help" }}>{f.standingName}</span>
                  </TipCustom>
                  {f.nextStanding && (
                    <TipCustom title="Rufpunkte" icon="◆" accent={f.accent} body={<p>Fortschritt zur n&auml;chsten Stufe. Ruf wird durch passende Quests verdient (+5-35 je nach Rarit&auml;t).</p>}>
                      <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)", cursor: "help" }}>
                        {f.playerRep} / {f.nextStanding.minRep}
                      </span>
                    </TipCustom>
                  )}
                </div>
                <div className={`progress-bar-diablo${f.progress > 0.9 ? " progress-bar-nearly-full" : ""}`}>
                  <div
                    className={`progress-bar-diablo-fill progress-shimmer${f.progress > 0.8 ? " bar-pulse" : ""}`}
                    style={{
                      width: `${Math.round(f.progress * 100)}%`,
                      background: `linear-gradient(90deg, ${f.accent}88, ${f.accent}, ${f.accent}cc)`,
                    }}
                  />
                </div>
                {f.nextStanding && (
                  <TipCustom title={f.nextStanding.name} icon="▲" accent={f.nextStanding.color} body={<p>N&auml;chste Stufe bei {f.nextStanding.minRep} Rep. Schaltet neue Belohnungen frei.</p>}>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)", cursor: "help" }}>
                      {f.nextStanding.minRep - f.playerRep} Rep until {f.nextStanding.name}
                    </p>
                  </TipCustom>
                )}
              </div>

              {/* Daily Quests */}
              {(dailyQuests[f.id] || []).length > 0 && (
                <div className="px-4 pb-3" style={{ borderTop: `1px solid ${f.accent}15` }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mt-2 mb-1.5" style={{ color: `${f.accent}80` }}>Daily Quests</p>
                  <div className="space-y-1">
                    {(dailyQuests[f.id] || []).map(dq => {
                      const done = dq.completed;
                      const claimed = dq.claimed;
                      return (
                        <div
                          key={dq.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded"
                          style={{
                            background: claimed ? `${f.accent}08` : done ? `${f.accent}12` : "rgba(255,255,255,0.02)",
                            border: `1px solid ${done && !claimed ? `${f.accent}35` : "rgba(255,255,255,0.05)"}`,
                          }}
                        >
                          <span className="text-xs flex-shrink-0" style={{ color: claimed ? "rgba(255,255,255,0.2)" : done ? "#22c55e" : "rgba(255,255,255,0.25)", width: 14, textAlign: "center" }}>
                            {claimed ? "✓" : done ? "●" : `${dq.progress}/${dq.req.count}`}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: claimed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.6)", textDecoration: claimed ? "line-through" : "none" }}>{dq.name}</p>
                            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.2)" }}>{dq.desc}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xs font-mono" style={{ color: `${f.accent}88` }}>+{dq.repReward}</span>
                            <span className="text-xs font-mono" style={{ color: "#f59e0b88" }}>+{dq.goldReward}g</span>
                            {done && !claimed && (
                              <button
                                onClick={() => claimDaily(f.id, dq.id)}
                                disabled={claimingDaily === dq.id}
                                title="Claim daily quest reward"
                                className="text-xs px-2 py-0.5 rounded font-bold claimable-breathe"
                                style={{
                                  background: `${f.accent}20`,
                                  color: f.accent,
                                  border: `1px solid ${f.accent}50`,
                                  cursor: claimingDaily === dq.id ? "not-allowed" : "pointer",
                                  opacity: claimingDaily === dq.id ? 0.5 : 1,
                                  ["--claim-color" as string]: `${f.accent}40`,
                                }}
                              >
                                {claimingDaily === dq.id ? "..." : "Claim"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Standing rewards roadmap */}
              <div className="px-4 pb-3" style={{ borderTop: `1px solid ${f.accent}15` }}>
                <div className="flex gap-1 mt-2">
                  {standings.filter(s => s.id !== "neutral").map(s => {
                    const isReached = f.playerRep >= s.minRep;
                    const isClaimed = (f.claimedRewards || []).includes(s.id);
                    const isCurrent = f.standing === s.id;
                    const sReward = f.rewards?.[s.id];
                    const rewardDesc = sReward ? (sReward.title || sReward.recipeDesc || sReward.frameDesc || sReward.effectDesc || "") : "";
                    return (
                      <TipCustom key={s.id} title={s.name} icon={isClaimed ? "✓" : "◆"} accent={s.color} body={<p>{s.minRep} Rep{rewardDesc ? ` — ${rewardDesc}` : ""}{isClaimed ? " (Claimed)" : isReached ? " (Ready)" : ""}</p>}>
                        <div
                          className="flex-1 text-center py-1.5 rounded-lg cursor-help"
                          style={{
                            background: isClaimed ? `${s.color}20` : isReached ? `${s.color}12` : "rgba(255,255,255,0.02)",
                            color: isReached ? s.color : "rgba(255,255,255,0.12)",
                            border: `1px solid ${isCurrent ? `${s.color}50` : isReached ? `${s.color}20` : "rgba(255,255,255,0.04)"}`,
                            fontWeight: isCurrent ? 700 : 400,
                            fontSize: 12,
                            boxShadow: isClaimed ? `0 0 6px ${s.color}15` : "none",
                          }}
                        >
                          <span style={{ display: "block", fontSize: 12 }}>{isClaimed ? "✓" : isReached ? "●" : "○"}</span>
                          <span style={{ opacity: 0.7 }}>{s.name.split(" ").pop()}</span>
                        </div>
                      </TipCustom>
                    );
                  })}
                </div>
              </div>

              {/* Reward navigation links */}
              {onNavigate && reward && (
                <div className="px-4 pb-1 flex gap-3">
                  {reward.recipe && (
                    <button onClick={(e) => { e.stopPropagation(); onNavigate("forge"); }} className="text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.25)" }} onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}>
                      Unlock in Forge {"\u2192"}
                    </button>
                  )}
                  {reward.frame && (
                    <button onClick={(e) => { e.stopPropagation(); onNavigate("character"); }} className="text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.25)" }} onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}>
                      View in Character {"\u2192"}
                    </button>
                  )}
                </div>
              )}

              {/* Claim button */}
              {canClaim && reward && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => claimReward(f.id)}
                    disabled={claiming === f.id}
                    title={claiming === f.id ? "Claiming reward..." : "Claim faction reward"}
                    className={`btn-interactive w-full text-xs font-bold py-2 rounded-lg${claiming !== f.id ? " claimable-breathe" : ""}`}
                    style={{
                      background: `${f.accent}15`,
                      color: f.accent,
                      border: `1px solid ${f.accent}40`,
                      opacity: claiming === f.id ? 0.5 : 1,
                      cursor: claiming === f.id ? "not-allowed" : "pointer",
                      ["--claim-color" as string]: `${f.accent}40`,
                    }}
                  >
                    {claiming === f.id ? "..." : `Claim: ${reward.title || reward.recipeDesc || reward.frameDesc || reward.effectDesc || "Reward"}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
