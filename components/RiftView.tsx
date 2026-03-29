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
  mythicLevel?: number;
  extended?: boolean;
  affixes?: { id: string; name: string; desc: string; color: string; effect: { type: string; value: number | string } }[];
}

interface RiftAffix {
  id: string;
  name: string;
  desc: string;
  color: string;
  minLevel: number;
}

interface MythicLeaderboardEntry {
  name: string;
  level: number;
  highestMythicCleared: number;
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
const TYPE_ICONS: Record<string, string> = { personal: "●", learning: "●", fitness: "●", social: "●", boss: "◆" };
const TYPE_ICON_IMAGES: Record<string, string> = { personal: "/images/icons/cat-personal.png", learning: "/images/icons/cat-learning.png", fitness: "/images/icons/cat-fitness.png", social: "/images/icons/cat-social.png" };

// ─── Component ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RiftView({ onRefresh, onRewardCelebration }: { onRefresh?: () => void; onRewardCelebration?: (data: any) => void }) {
  const { playerName, reviewApiKey } = useDashboard();
  const [tiers, setTiers] = useState<Record<string, RiftTier>>({});
  const [activeRift, setActiveRift] = useState<ActiveRift | null>(null);
  const [history, setHistory] = useState<RiftHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [mythicUnlocked, setMythicUnlocked] = useState(false);
  const [highestMythicCleared, setHighestMythicCleared] = useState(0);
  const [nextMythicLevel, setNextMythicLevel] = useState(1);
  const [mythicLeaderboard, setMythicLeaderboard] = useState<MythicLeaderboardEntry[]>([]);
  const [selectedMythicLevel, setSelectedMythicLevel] = useState(1);
  const [weeklyAffixes, setWeeklyAffixes] = useState<RiftAffix[]>([]);

  const fetchRift = useCallback(async () => {
    if (!playerName) return;
    try {
      const r = await fetch(`/api/rift?player=${encodeURIComponent(playerName)}`);
      if (r.ok) {
        const data = await r.json();
        setTiers(data.tiers || {});
        setActiveRift(data.activeRift || null);
        setHistory(data.history || []);
        setMythicUnlocked(data.mythicUnlocked || false);
        setHighestMythicCleared(data.highestMythicCleared || 0);
        setNextMythicLevel(data.nextMythicLevel || 1);
        setMythicLeaderboard(data.mythicLeaderboard || []);
        setWeeklyAffixes(data.weeklyAffixes || []);
      }
    } catch (e) { console.error("[rift]", e); }
    setLoading(false);
  }, [playerName]);

  useEffect(() => { fetchRift(); }, [fetchRift]);

  // Auto-refresh timer
  useEffect(() => {
    if (!activeRift || activeRift.completed || activeRift.failed) return;
    const interval = setInterval(fetchRift, 60000);
    return () => clearInterval(interval);
  }, [activeRift, fetchRift]);

  const enterRift = async (tierId: string, mythicLevel?: number) => {
    if (!reviewApiKey || actionLoading) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { tier: tierId };
      if (mythicLevel != null) body.mythicLevel = mythicLevel;
      const r = await fetch("/api/rift/enter", {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) setMessage({ text: d.error || "Something went wrong. Please try again.", type: "error" });
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
      if (!r.ok) setMessage({ text: d.error || "Something went wrong. Please try again.", type: "error" });
      else {
        setMessage({ text: d.message, type: "success" });
        if (onRewardCelebration && d.rewards) {
          onRewardCelebration({
            type: "rift",
            title: d.riftCompleted ? "Rift Complete!" : "Stage Complete!",
            xpEarned: d.rewards.xp || 0,
            goldEarned: d.rewards.gold || 0,
            loot: d.rewards.loot ? { name: d.rewards.loot.name, emoji: "⚔️", rarity: d.rewards.loot.rarity || "rare" } : null,
          });
        }
        fetchRift(); onRefresh?.();
      }
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
      if (!r.ok) setMessage({ text: d.error || "Something went wrong. Please try again.", type: "error" });
      else { setMessage({ text: d.message, type: "success" }); fetchRift(); onRefresh?.(); }
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  if (!playerName || !reviewApiKey) {
    return (
      <div className="rounded-xl px-6 py-12 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <img src="/images/icons/rift-normal.png" alt="" width={32} height={32} className="img-render-auto mx-auto mb-2" />
        <p className="text-sm font-bold mb-1 text-w25">The Rift</p>
        <p className="text-xs text-w15">Log in to enter The Rift.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="space-y-3 tab-content-enter">
      <div className="skeleton-card h-20" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="skeleton-card h-40" />)}</div>
    </div>
  );

  return (
    <div className="space-y-5 tab-content-enter relative">
      {/* Purple rift energy fragments */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={`rift-frag-${i}`} className="absolute rounded-full" style={{
            width: 2 + (i % 2),
            height: 2 + (i % 2),
            left: `${10 + (i * 17) % 75}%`,
            top: `${18 + (i * 23) % 55}%`,
            background: i % 3 === 0 ? "rgba(192,132,252,0.6)" : i % 3 === 1 ? "rgba(168,85,247,0.55)" : "rgba(139,92,246,0.5)",
            boxShadow: `0 0 ${3 + i % 2}px ${i % 3 === 0 ? "rgba(192,132,252,0.4)" : "rgba(168,85,247,0.35)"}`,
            animation: `ember-float ${3.5 + (i % 3) * 0.8}s ease-in-out ${i * 0.7}s infinite`,
            opacity: 0,
          }} />
        ))}
      </div>
      {/* Header */}
      <div className="flex items-center gap-3">
        <img src="/images/icons/rift-normal.png" alt="" width={32} height={32} className="img-render-auto" />
        <div>
          <Tip k="rift" heading><h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)", cursor: "help" }}>The Rift</h2></Tip>
          <p className="text-xs text-w25">Timed quest chains with escalating difficulty. Complete all stages before time runs out.</p>
        </div>
      </div>
      <div className="rounded-lg px-4 py-2.5" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.06) 0%, transparent 80%)", borderLeft: "2px solid rgba(168,85,247,0.2)" }}>
        <p className="text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.3)", maxWidth: 520 }}>Die Risse flüstern. Hör nicht hin. Seit der Wiederkehr öffnen sich die Risse im Aetherstrom häufiger — fragmentierte Realitäten sickern hindurch.</p>
      </div>

      {/* Messages */}
      {message && (
        <div className="rounded-lg px-4 py-2 text-xs font-semibold tab-content-enter" style={{ background: message.type === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", color: message.type === "success" ? "#22c55e" : "#ef4444", border: `1px solid ${message.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          {message.text}
        </div>
      )}

      {/* Active Rift */}
      {activeRift && !activeRift.failed && (
        <div className={`rounded-xl p-5 space-y-4${!activeRift.completed && (new Date(activeRift.expiresAt).getTime() - Date.now()) < (new Date(activeRift.expiresAt).getTime() - new Date(activeRift.startedAt).getTime()) * 0.25 && (new Date(activeRift.expiresAt).getTime() - Date.now()) > 0 ? " rift-urgent" : ""}`} style={{ background: `${activeRift.tierColor}08`, border: `1px solid ${activeRift.tierColor}30` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeRift.tierIcon?.startsWith("/") ? <img src={activeRift.tierIcon} alt="" width={28} height={28} className="img-render-auto" /> : <span className="text-xl">{activeRift.tierIcon}</span>}
              <div>
                <p className="text-sm font-bold" style={{ color: activeRift.tierColor }}>
                  {activeRift.tier === "mythic" && activeRift.mythicLevel ? `${activeRift.tierName} +${activeRift.mythicLevel}` : activeRift.tierName}
                </p>
                <p className="text-xs text-w30">Stage {activeRift.currentStage}/{activeRift.totalStages}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-mono font-bold${!activeRift.completed && new Date(activeRift.expiresAt).getTime() - Date.now() < (new Date(activeRift.expiresAt).getTime() - new Date(activeRift.startedAt).getTime()) * 0.25 ? " bar-pulse" : ""}`} style={{ color: activeRift.completed ? "#22c55e" : new Date(activeRift.expiresAt).getTime() - Date.now() < 3600000 ? "#ef4444" : new Date(activeRift.expiresAt).getTime() - Date.now() < 24 * 3600000 ? "#eab308" : activeRift.tierColor }}>
                {activeRift.completed ? "✓ Complete!" : timeLeft(new Date(activeRift.expiresAt).getTime() - Date.now())}
              </p>
              <p className="text-xs text-w20">{activeRift.completed ? "All stages cleared" : "Time remaining"}</p>
            </div>
          </div>

          {/* Active affixes */}
          {activeRift.affixes && activeRift.affixes.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {activeRift.affixes.map(a => (
                <TipCustom key={a.id} title={a.name} accent={a.color} body={<p className="text-xs">{a.desc}</p>}>
                  <span className="text-xs font-semibold px-2 py-1 rounded-lg cursor-help" style={{ background: `${a.color}12`, color: a.color, border: `1px solid ${a.color}30` }}>
                    {a.name}
                  </span>
                </TipCustom>
              ))}
            </div>
          )}

          {/* Extend timer button (Mondstaub) */}
          {!activeRift.completed && !activeRift.failed && !activeRift.extended && reviewApiKey && (
            <button
              onClick={async () => {
                try {
                  const r = await fetch("/api/rift/extend", {
                    method: "POST",
                    headers: getAuthHeaders(),
                  });
                  const d = await r.json();
                  if (r.ok) {
                    setMessage({ text: d.message || "Timer extended!", type: "success" });
                    fetchRift();
                  } else {
                    setMessage({ text: d.error || "Failed to extend", type: "error" });
                  }
                } catch { setMessage({ text: "Network error", type: "error" }); }
                setTimeout(() => setMessage(null), 4000);
              }}
              title="Spend 30 Mondstaub to add 6 hours to the rift timer (once per run)"
              className="btn-interactive w-full text-xs font-semibold py-2 rounded-lg"
              style={{
                background: "rgba(192,132,252,0.08)",
                color: "#c084fc",
                border: "1px solid rgba(192,132,252,0.2)",
                cursor: "pointer",
              }}
            >
              Extend Timer +6h (30 Mondstaub)
            </button>
          )}

          {/* Quest chain visualization */}
          <div className="relative" style={{ paddingLeft: 20 }}>
            <div className="absolute" style={{ left: 8, top: 8, bottom: 8, width: 2, background: `linear-gradient(180deg, ${activeRift.tierColor}40, rgba(255,255,255,0.06))` }} />
            {activeRift.quests.map((q, i) => {
              const isCurrent = !q.completed && i === activeRift.currentStage - 1;
              const isLocked = !q.completed && i > activeRift.currentStage - 1;
              return (
                <div key={i} className="relative flex items-center gap-3 mb-3" style={{ opacity: isLocked ? 0.4 : 1 }}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center z-10 flex-shrink-0${q.completed ? " resonance-ripple" : ""}`} style={{
                    background: q.completed ? "#22c55e" : isCurrent ? activeRift.tierColor : "rgba(255,255,255,0.08)",
                    border: `2px solid ${q.completed ? "#22c55e" : isCurrent ? activeRift.tierColor : "rgba(255,255,255,0.1)"}`,
                    boxShadow: q.completed ? "0 0 8px rgba(34,197,94,0.4)" : isCurrent ? `0 0 8px ${activeRift.tierColor}40` : "none",
                    ["--ripple-color" as string]: "rgba(34,197,94,0.4)",
                  }}>
                    {q.completed && <span style={{ color: "#000", fontSize: 12, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div className="flex-1 rounded-lg p-3" style={{
                    background: isCurrent ? `${activeRift.tierColor}08` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isCurrent ? `${activeRift.tierColor}25` : "rgba(255,255,255,0.04)"}`,
                  }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {TYPE_ICON_IMAGES[q.type] ? <img src={TYPE_ICON_IMAGES[q.type]} alt="" width={18} height={18} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-sm">{TYPE_ICONS[q.type] || "◆"}</span>}
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
                style={{ background: `linear-gradient(135deg, ${activeRift.tierColor}, ${activeRift.tierColor}cc)`, color: "#000", opacity: actionLoading ? 0.5 : 1, cursor: actionLoading ? "not-allowed" : "pointer" }}
                title={actionLoading ? "Action in progress..." : undefined}
              >
                {actionLoading ? "..." : `Complete Stage ${activeRift.currentStage}`}
              </button>
            )}
            {!activeRift.completed && !confirmAbandon && (
              <button
                onClick={() => setConfirmAbandon(true)}
                disabled={actionLoading}
                className="btn-interactive text-xs px-4 py-2.5 rounded-lg"
                style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: actionLoading ? "not-allowed" : "pointer" }}
                title={actionLoading ? "Action in progress..." : undefined}
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
                  title={actionLoading ? "Action in progress..." : "Confirm abandon"}
                  className="btn-interactive text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: actionLoading ? "not-allowed" : "pointer" }}
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
              <div key={id} className={`rounded-xl p-4 space-y-3${!locked ? " crystal-breathe" : ""}`} style={{
                background: locked ? "rgba(255,255,255,0.02)" : `${tier.color}06`,
                border: `1px solid ${locked ? "rgba(255,255,255,0.05)" : `${tier.color}25`}`,
                opacity: locked ? 0.5 : 1,
                ...(!locked ? { ["--glow-color" as string]: `${tier.color}30` } : {}),
              }}>
                <div className="text-center">
                  {tier.icon?.startsWith("/") ? (
                    <div className="w-16 h-16 mx-auto rounded-xl overflow-hidden mb-1" style={{ border: `1px solid ${tier.color}30`, boxShadow: `0 0 12px ${tier.color}15` }}>
                      <img src={tier.icon} alt="" className="w-full h-full object-cover img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} />
                    </div>
                  ) : <span className="text-2xl">{tier.icon}</span>}
                  <TipCustom
                    title={tier.name}
                    icon={tier.icon}
                    accent={tier.color}
                    body={<p>{tier.questCount} quests in {tier.timeLimitHours}h. Base difficulty scales up to {1 + (tier.questCount - 1) * 0.5}×. Failing triggers a {tier.failCooldownDays}-day cooldown.</p>}
                  >
                    <p className="text-sm font-bold mt-1 cursor-help" style={{ color: tier.color }}>{tier.name}</p>
                  </TipCustom>
                  {locked && <p className="text-xs text-w20">Requires Lv.{tier.minLevel}</p>}
                </div>
                <div className="space-y-1 text-xs text-w35">
                  <TipCustom title="Rift Stages" icon="⚔️" accent={tier.color} body={<p>Complete {tier.questCount} quests sequentially with escalating difficulty (1× to {1 + (tier.questCount - 1) * 0.5}×). Each stage grants full XP, Gold, and loot rewards.</p>}>
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
                {/* Rift-exclusive loot preview */}
                {((tier as unknown as { lootPreview?: { id: string; name: string; slot: string; rarity: string; desc?: string; legendaryEffect?: { type: string; label?: string } }[] }).lootPreview || []).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-w20">Exclusive Drops:</p>
                    {((tier as unknown as { lootPreview: { id: string; name: string; slot: string; rarity: string; desc?: string; legendaryEffect?: { type: string; label?: string } }[] }).lootPreview || []).slice(0, 3).map(item => (
                      <TipCustom key={item.id} title={item.name} accent={tier.color} body={<>{item.desc && <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>}{item.legendaryEffect?.label && <p className="text-xs mt-1 font-semibold" style={{ color: "#f59e0b" }}>{item.legendaryEffect.label}</p>}</>}>
                        <div className="flex items-center gap-1.5 text-xs cursor-help" style={{ color: "rgba(255,255,255,0.35)" }}>
                          <span style={{ color: tier.color }}>◆</span>
                          <span>{item.name}</span>
                          <span className="text-w15 ml-auto capitalize">{item.slot}</span>
                        </div>
                      </TipCustom>
                    ))}
                  </div>
                )}
                {onCd && tier.cooldownEndsAt && (
                  <p className="text-xs text-center" style={{ color: "#ef4444" }}>
                    Cooldown: {timeLeft(new Date(tier.cooldownEndsAt).getTime() - Date.now())} remaining
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
                  title={locked ? `Requires higher level to unlock this tier` : onCd ? "On cooldown — wait for it to expire" : "Enter the Rift"}
                >
                  {locked ? "Locked" : onCd ? "On Cooldown" : actionLoading ? "..." : "Enter Rift"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Mythic Tier — unlocked after legendary clear */}
      {!activeRift && mythicUnlocked && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: "rgba(255,68,68,0.04)", border: "1px solid rgba(255,68,68,0.2)" }}>
          <div className="flex items-center gap-3">
            <img src="/images/icons/rift-mythic.png" alt="" width={32} height={32} className="img-render-auto" />
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: "#ff4444" }}>Mythic Rift</p>
              <p className="text-xs text-w25">Endless scaling difficulty. How deep can you go?</p>
            </div>
            {highestMythicCleared > 0 && (
              <div className="text-right">
                <p className="text-xs text-w25">Highest Cleared</p>
                <p className="text-sm font-mono font-bold" style={{ color: "#ff4444" }}>+{highestMythicCleared}</p>
              </div>
            )}
          </div>

          {/* Level selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-w40">Select Level:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedMythicLevel(l => Math.max(1, l - 1))}
                disabled={selectedMythicLevel <= 1}
                title={selectedMythicLevel <= 1 ? "Already at minimum level" : "Decrease Mythic level"}
                className="btn-interactive w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center"
                style={{
                  background: "rgba(255,68,68,0.08)",
                  border: "1px solid rgba(255,68,68,0.25)",
                  color: selectedMythicLevel <= 1 ? "rgba(255,255,255,0.15)" : "#ff4444",
                  cursor: selectedMythicLevel <= 1 ? "not-allowed" : "pointer",
                }}
              >
                −
              </button>
              <span className="text-sm font-mono font-bold px-3 py-1 rounded-lg crystal-breathe" style={{ background: "rgba(255,68,68,0.08)", color: "#ff4444", minWidth: 48, textAlign: "center", border: "1px solid rgba(255,68,68,0.15)", ["--glow-color" as string]: "rgba(255,68,68,0.25)" }}>
                +{selectedMythicLevel}
              </span>
              <button
                onClick={() => setSelectedMythicLevel(l => Math.min(nextMythicLevel, l + 1))}
                disabled={selectedMythicLevel >= nextMythicLevel}
                title={selectedMythicLevel >= nextMythicLevel ? "Already at maximum level" : "Increase Mythic level"}
                className="btn-interactive w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center"
                style={{
                  background: "rgba(255,68,68,0.08)",
                  border: "1px solid rgba(255,68,68,0.25)",
                  color: selectedMythicLevel >= nextMythicLevel ? "rgba(255,255,255,0.15)" : "#ff4444",
                  cursor: selectedMythicLevel >= nextMythicLevel ? "not-allowed" : "pointer",
                }}
              >
                +
              </button>
            </div>
            <span className="text-xs text-w20">(max +{nextMythicLevel})</span>
          </div>

          {/* Mythic tier stats */}
          {tiers.mythic && (
            <div className="space-y-1 text-xs text-w35">
              <div className="flex justify-between"><span>Stages</span><span className="font-mono text-w50">{tiers.mythic.questCount}</span></div>
              <TipCustom title="Mythic Time Scaling" icon="⏱️" accent="#ff4444" body={<p>Time limit decreases by 1.5h per Mythic level (minimum 18h). Higher levels demand faster completion.</p>}>
                <div className="flex justify-between cursor-help"><span>Time Limit</span><span className="font-mono text-w50">{Math.max(18, 30 - selectedMythicLevel * 1.5)}h</span></div>
              </TipCustom>
              <TipCustom title="Mythic Difficulty" icon="⚔️" accent="#ff4444" body={<p>Each Mythic level adds +0.3× base difficulty, stages escalate +0.5× each. At M+{selectedMythicLevel}: base difficulty {(1 + selectedMythicLevel * 0.3).toFixed(1)}× → {(1 + 6 * 0.5 + selectedMythicLevel * 0.3).toFixed(1)}× on final stage. No fail cooldown — retry immediately.</p>}>
                <div className="flex justify-between cursor-help"><span>Difficulty</span><span className="font-mono text-w50">{(1 + selectedMythicLevel * 0.3).toFixed(1)}× – {(1 + 6 * 0.5 + selectedMythicLevel * 0.3).toFixed(1)}×</span></div>
              </TipCustom>
              <div className="flex justify-between"><span>Fail Cooldown</span><span className="font-mono text-w50">None</span></div>
            </div>
          )}

          {/* Weekly Affixes (M+2 and above) */}
          {selectedMythicLevel >= 2 && weeklyAffixes.length > 0 && (
            <div className="rounded-lg px-3 py-2 space-y-1.5" style={{ background: "rgba(255,68,68,0.04)", border: "1px solid rgba(255,68,68,0.12)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,68,68,0.5)" }}>Weekly Affixes</p>
              {weeklyAffixes.map(affix => (
                <div key={affix.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: affix.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold" style={{ color: affix.color }}>{affix.name}</span>
                    {selectedMythicLevel >= affix.minLevel ? (
                      <span className="text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>{affix.desc}</span>
                    ) : (
                      <span className="text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.15)" }}>Activates at M+{affix.minLevel}</span>
                    )}
                  </div>
                  {selectedMythicLevel >= affix.minLevel && (
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#ef4444" }}>Active</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Enter button */}
          <button
            onClick={() => enterRift("mythic", selectedMythicLevel)}
            disabled={actionLoading || (tiers.mythic?.onCooldown ?? false)}
            title={tiers.mythic?.onCooldown ? "On cooldown — wait for it to expire" : actionLoading ? "Action in progress..." : `Enter Mythic +${selectedMythicLevel}`}
            className="btn-interactive w-full text-xs font-bold py-2.5 rounded-lg"
            style={{
              background: tiers.mythic?.onCooldown ? "rgba(255,255,255,0.03)" : "rgba(255,68,68,0.12)",
              color: tiers.mythic?.onCooldown ? "rgba(255,255,255,0.2)" : "#ff4444",
              border: `1px solid ${tiers.mythic?.onCooldown ? "rgba(255,255,255,0.06)" : "rgba(255,68,68,0.35)"}`,
              cursor: (actionLoading || tiers.mythic?.onCooldown) ? "not-allowed" : "pointer",
            }}
          >
            {tiers.mythic?.onCooldown ? "On Cooldown" : actionLoading ? "..." : <><img src="/images/icons/rift-mythic.png" alt="" width={16} height={16} className="img-render-auto inline-block mr-1 -mt-0.5" /> Enter Mythic +{selectedMythicLevel}</>}
          </button>
          {tiers.mythic?.onCooldown && tiers.mythic.cooldownEndsAt && (
            <p className="text-xs text-center" style={{ color: "#ef4444" }}>
              Cooldown: {timeLeft(new Date(tiers.mythic.cooldownEndsAt).getTime() - Date.now())} remaining
            </p>
          )}

          {/* Mythic Leaderboard */}
          {mythicLeaderboard.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-w25 mb-2 flex items-center gap-1"><img src="/images/icons/rift-mythic.png" alt="" width={14} height={14} className="img-render-auto" /> Mythic Leaderboard</p>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,68,68,0.12)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(255,68,68,0.06)" }}>
                      <th className="text-left px-2.5 py-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>#</th>
                      <th className="text-left px-2.5 py-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Player</th>
                      <th className="text-center px-2.5 py-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Lv.</th>
                      <th className="text-right px-2.5 py-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Highest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mythicLeaderboard.slice(0, 10).map((entry, i) => (
                      <tr key={entry.name} style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                        <td className="px-2.5 py-1.5 font-mono" style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : i === 2 ? "#d97706" : "rgba(255,255,255,0.3)" }}>{i + 1}</td>
                        <td className="px-2.5 py-1.5 font-semibold" style={{ color: entry.name === playerName ? "#ff4444" : "rgba(255,255,255,0.6)" }}>{entry.name}</td>
                        <td className="px-2.5 py-1.5 text-center font-mono text-w30">{entry.level}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono font-bold" style={{ color: "#ff4444" }}>+{entry.highestMythicCleared}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
