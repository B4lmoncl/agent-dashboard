"use client";

import { useState, useEffect, useCallback } from "react";
import FirstVisitBanner from "@/components/FirstVisitBanner";
import ItemTooltip from "@/components/ItemTooltip";
import type { TooltipItem } from "@/components/ItemTooltip";
import { useDashboard } from "@/app/DashboardContext";
import { getUserLevel, formatLegendaryLabel } from "@/app/utils";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";
import { useModalBehavior } from "@/components/ModalPortal";
import type { RewardCelebrationData } from "@/components/RewardCelebration";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DungeonTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  tier: string;
  minLevel: number;
  minPlayers: number;
  maxPlayers: number;
  durationHours: number;
  cooldownDays: number;
  gearScoreThreshold: number;
  rewards: {
    gold: [number, number];
    essenz: [number, number];
    runensplitter: [number, number];
    sternentaler?: [number, number];
    materials: { count: [number, number] };
    gems: { chance: number; maxTier: number };
    gearDrop: { chance: number; minRarity: string };
  };
  bonusRewards: {
    title: string;
    frame: { id: string; name: string; color: string; glow: boolean };
  };
  unlocked: boolean;
  cooldown: { onCooldown: boolean; endsAt?: string; remainingMs?: number };
  uniqueItemDetails?: { id: string; name: string; slot: string; desc: string; flavorText?: string; legendaryEffect?: { type: string; label?: string }; icon: string | null }[];
}

interface Participant {
  name: string;
  avatar: string;
  color: string;
  gearScore: number;
  bondLevel: number;
}

interface InvitedPlayer {
  name: string;
  avatar: string;
  color: string;
}

interface ActiveRun {
  runId: string;
  dungeonId: string;
  dungeonName: string;
  dungeonIcon: string;
  dungeonAccent: string;
  tier: string;
  createdBy: string;
  createdAt: string;
  status: "forming" | "active";
  participants: Participant[];
  invitedPlayers: InvitedPlayer[];
  startedAt: string | null;
  completesAt: string | null;
  collected: string[];
  minPlayers: number;
  maxPlayers: number;
  gearScoreThreshold: number;
}

interface DungeonHistory {
  runId: string;
  dungeonId: string;
  dungeonName: string;
  tier: string;
  participants: string[];
  startedAt: string;
  completedAt: string;
  success: boolean;
  effectivePower: number;
  threshold: number;
  successChance: number;
}

interface FriendInfo {
  id: string;
  name: string;
  avatar: string;
  color: string;
  level: number;
  isOnline: boolean;
  onlineStatus: string;
  lastActiveAt: string | null;
}

interface CollectResult {
  success: boolean;
  successChance: number;
  effectivePower: number;
  threshold: number;
  rewards: { gold: number; essenz: number; runensplitter: number; sternentaler?: number; materialCount?: number; gearDropItem?: { name: string; rarity: string }; gemDrop?: { key: string; name: string; type: string; tier: number; color: string } };
  bonusAwarded: { title?: string; frame?: string } | null;
  uniqueDrop: { name: string; slot: string; id: string } | null;
  message: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeLeft(ms: number): string {
  if (ms <= 0) return "Complete!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

const TIER_COLORS: Record<string, string> = {
  normal: "#22c55e",
  hard: "#3b82f6",
  legendary: "#ef4444",
};

const TIER_LABELS: Record<string, string> = {
  normal: "Normal",
  hard: "Hard",
  legendary: "Legendary",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function DungeonView({ onRefresh, onRewardCelebration, onNavigate }: { onRefresh?: () => void; onRewardCelebration?: (data: RewardCelebrationData) => void; onNavigate?: (view: string) => void }) {
  const { playerName, reviewApiKey, loggedInUser } = useDashboard();
  const [dungeons, setDungeons] = useState<DungeonTemplate[]>([]);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [history, setHistory] = useState<DungeonHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDungeon, setSelectedDungeon] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Collect result
  const [collectResult, setCollectResult] = useState<CollectResult | null>(null);
  const [tooltipItem, setTooltipItem] = useState<TooltipItem | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Reset confirmation when active run changes
  useEffect(() => { setConfirmCancel(false); }, [activeRun?.runId]);

  const fetchDungeons = useCallback(async () => {
    if (!playerName) return;
    try {
      const r = await fetch(`/api/dungeons?player=${encodeURIComponent(playerName)}`);
      if (r.ok) {
        const data = await r.json();
        setDungeons(data.dungeons || []);
        setActiveRun(data.activeRun || null);
        setHistory(data.history || []);
      }
    } catch (e) { console.error('[dungeon]', e); }
    setLoading(false);
  }, [playerName]);

  useEffect(() => { fetchDungeons(); }, [fetchDungeons]);

  // Modal behavior: ESC to close + body scroll lock
  const closeCreate = useCallback(() => setShowCreate(false), []);
  useModalBehavior(showCreate, closeCreate);

  // Auto-refresh for active runs
  useEffect(() => {
    if (!activeRun) return;
    const interval = setInterval(fetchDungeons, 30000);
    return () => clearInterval(interval);
  }, [activeRun, fetchDungeons]);

  const fetchFriends = useCallback(async () => {
    if (!playerName || !reviewApiKey) return;
    setFriendsLoading(true);
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/friends`, {
        headers: getAuthHeaders(reviewApiKey),
      });
      if (r.ok) {
        const data = await r.json();
        setFriends(data.friends || []);
      }
    } catch (e) { console.error('[dungeon]', e); }
    setFriendsLoading(false);
  }, [playerName, reviewApiKey]);

  const openCreateModal = (dungeonId: string) => {
    setSelectedDungeon(dungeonId);
    setSelectedFriends([]);
    setShowCreate(true);
    fetchFriends();
  };

  const toggleFriend = (name: string) => {
    setSelectedFriends(prev =>
      prev.includes(name)
        ? prev.filter(f => f !== name)
        : [...prev, name]
    );
  };

  const createRun = async () => {
    if (!reviewApiKey || !selectedDungeon || actionLoading) return;
    if (selectedFriends.length === 0) {
      setMessage({ text: "Select at least 1 friend to invite", type: "error" });
      return;
    }
    setActionLoading(true);
    setMessage(null);
    try {
      const r = await fetch("/api/dungeons/create", {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ dungeonId: selectedDungeon, invitePlayers: selectedFriends }),
      });
      const d = await r.json();
      if (!r.ok) setMessage({ text: d.error || "Failed to create run", type: "error" });
      else {
        setMessage({ text: d.message, type: "success" });
        setShowCreate(false);
        fetchDungeons();
        onRefresh?.();
      }
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  const joinRun = async (runId: string) => {
    if (!reviewApiKey || actionLoading) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/dungeons/${runId}/join`, {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      const d = await r.json();
      if (!r.ok) setMessage({ text: d.error || "Failed to join", type: "error" });
      else { setMessage({ text: d.message, type: "success" }); fetchDungeons(); onRefresh?.(); }
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  const collectRewards = async (runId: string) => {
    if (!reviewApiKey || actionLoading) return;
    setActionLoading(true);
    setMessage(null);
    setCollectResult(null);
    try {
      const r = await fetch(`/api/dungeons/${runId}/collect`, {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      const d = await r.json();
      if (!r.ok) setMessage({ text: d.error || "Failed to collect", type: "error" });
      else {
        setCollectResult(d);
        setMessage({ text: d.message, type: d.success ? "success" : "error" });
        fetchDungeons();
        onRefresh?.();
        if (onRewardCelebration && d.rewards) {
          const rw = d.rewards;
          const currencies: { name: string; amount: number; color: string }[] = [];
          if (rw.essenz) currencies.push({ name: "Essenz", amount: rw.essenz, color: "#ef4444" });
          if (rw.runensplitter) currencies.push({ name: "Runensplitter", amount: rw.runensplitter, color: "#a78bfa" });
          if (rw.sternentaler) currencies.push({ name: "Sternentaler", amount: rw.sternentaler, color: "#fbbf24" });
          const loot = d.uniqueDrop
            ? { name: d.uniqueDrop.name, emoji: "◆", rarity: "legendary", rarityColor: "#ff8c00", icon: d.uniqueDrop.icon }
            : rw.gearDropItem
              ? { name: rw.gearDropItem.name, emoji: "◆", rarity: rw.gearDropItem.rarity || "rare", icon: rw.gearDropItem.icon }
              : rw.gemDrop
                ? { name: rw.gemDrop.name, emoji: "◆", rarity: "rare", rarityColor: rw.gemDrop.color || "#a855f7" }
                : undefined;
          onRewardCelebration({
            type: "dungeon",
            title: d.success ? "Dungeon Cleared!" : "Dungeon Survived",
            xpEarned: 0,
            goldEarned: rw.gold || 0,
            loot: loot || undefined,
            currencies: currencies.length > 0 ? currencies : undefined,
          });
        }
      }
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  // ─── Login gate ─────────────────────────────────────────────────────────

  if (!playerName || !reviewApiKey) {
    return (
      <div className="rounded-xl px-6 py-12 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <img src="/images/icons/nav-dungeons.png" alt="" width={48} height={48} className="img-render-auto mx-auto mb-2" style={{ opacity: 0.3 }} onError={e => { e.currentTarget.style.display = "none"; }} />
        <p className="text-sm font-bold mb-1 text-w25">The Undercroft</p>
        <p className="text-xs text-w15">Log in to enter the dungeons.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="space-y-3 tab-content-enter" style={{ minHeight: 400 }}>
      <div className="skeleton-card h-20" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="skeleton-card h-48" />)}</div>
    </div>
  );

  const selectedDungeonData = dungeons.find(d => d.id === selectedDungeon);
  const maxInvites = selectedDungeonData ? selectedDungeonData.maxPlayers - 1 : 3;

  return (
    <div className="space-y-5 tab-content-enter relative">
      <FirstVisitBanner
        viewId="dungeons"
        title="Das Untergewölbe"
        description="Lade 1-3 Freunde ein, um gemeinsam Dungeons zu bestreiten. Der Run läuft 8 Stunden im Hintergrund — sammle danach deine Belohnungen. Erfolg basiert auf eurer kombinierten Gear Score + Companion Bond."
        accentColor="#3b82f6"
      />
      {/* Dust motes in torchlight */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={`dust-mote-${i}`} className="absolute rounded-full" style={{
            width: 2 + (i % 2),
            height: 2 + (i % 2),
            left: `${12 + (i * 18) % 70}%`,
            top: `${20 + (i * 21) % 55}%`,
            background: i % 2 === 0 ? "rgba(251,191,36,0.5)" : "rgba(217,170,78,0.45)",
            boxShadow: `0 0 ${3 + i % 2}px ${i % 2 === 0 ? "rgba(251,191,36,0.35)" : "rgba(217,170,78,0.3)"}`,
            animation: `ember-float ${4 + (i % 3) * 0.9}s ease-in-out ${i * 0.8}s infinite`,
            opacity: 0,
          }} />
        ))}
      </div>
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">◆</span>
        <div>
          <Tip k="dungeons" heading><h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)", cursor: "help" }}>The Undercroft</h2></Tip>
          <p className="text-xs text-w25">Cooperative group dungeons. Invite friends, wait 8 hours, and collect rewards based on your combined power.</p>
        </div>
      </div>
      <div className="rounded-lg px-4 py-2.5" style={{ background: "linear-gradient(135deg, rgba(129,140,248,0.06) 0%, transparent 80%)", borderLeft: "2px solid rgba(129,140,248,0.2)" }}>
        <p className="text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.3)", maxWidth: 520 }}>Was hier unten schläft, hat Gründe dafür. Unter dem Turm liegen vergessene Gewölbe, versiegelte Archive und Kammern, die seit Äonen niemand betreten hat.</p>
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

      {/* Collect Result */}
      {collectResult && (
        <div className={`rounded-xl p-5 space-y-3 relative overflow-hidden${collectResult.success ? " reward-burst-enter" : " tab-content-enter"}`} style={{
          background: collectResult.success ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
          border: `1px solid ${collectResult.success ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
          boxShadow: collectResult.success ? "0 0 30px rgba(34,197,94,0.1)" : "none",
        }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl" style={collectResult.success ? { filter: "drop-shadow(0 0 6px rgba(34,197,94,0.5))" } : undefined}>{collectResult.success ? "★" : "—"}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: collectResult.success ? "#22c55e" : "#ef4444" }}>
                {collectResult.success ? "Dungeon Cleared!" : "Dungeon Failed"}
              </p>
              <p className="text-xs text-w30">
                Success chance: {collectResult.successChance}% | Power: {collectResult.effectivePower}/{collectResult.threshold}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {collectResult.rewards.gold > 0 && (
              <Tip k="gold"><span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}>
                +{collectResult.rewards.gold} Gold
              </span></Tip>
            )}
            {collectResult.rewards.essenz > 0 && (
              <Tip k="essenz"><span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                +{collectResult.rewards.essenz} Essenz
              </span></Tip>
            )}
            {collectResult.rewards.runensplitter > 0 && (
              <Tip k="runensplitter"><span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(129,140,248,0.08)", color: "#818cf8" }}>
                +{collectResult.rewards.runensplitter} Runensplitter
              </span></Tip>
            )}
            {(collectResult.rewards.sternentaler || 0) > 0 && (
              <Tip k="sternentaler"><span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}>
                +{collectResult.rewards.sternentaler} Sternentaler
              </span></Tip>
            )}
            {(collectResult.rewards.materialCount || 0) > 0 && (
              <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}>
                +{collectResult.rewards.materialCount} Materials
              </span>
            )}
            {collectResult.rewards.gemDrop && (
              <span className="text-xs px-2 py-1 rounded font-semibold" style={{ background: `${collectResult.rewards.gemDrop.color || '#a855f7'}12`, color: collectResult.rewards.gemDrop.color || '#a855f7' }}>
                ◆ {collectResult.rewards.gemDrop.name} (T{collectResult.rewards.gemDrop.tier})
              </span>
            )}
            {collectResult.rewards.gearDropItem && (
              <button onClick={() => { const g = collectResult.rewards.gearDropItem as Record<string, unknown>; setTooltipItem({ name: (g.name as string) || "Gear", rarity: (g.rarity as string) || "common", icon: (g.icon as string) || null, slot: (g.slot as string) || null, stats: (g.stats as Record<string, number>) || null }); }} className="text-xs px-2 py-1 rounded font-semibold" style={{ background: "rgba(168,85,247,0.08)", color: "#a855f7", cursor: "pointer" }}>
                {(collectResult.rewards.gearDropItem as { name?: string; rarity?: string }).name ?? "Gear"} ({(collectResult.rewards.gearDropItem as { rarity?: string }).rarity ?? "common"})
              </button>
            )}
          </div>

          {collectResult.uniqueDrop && (
            <button onClick={() => { const u = collectResult.uniqueDrop as Record<string, unknown>; setTooltipItem({ name: (u.name as string) || "Unique", rarity: "unique", icon: (u.icon as string) || null, slot: (u.slot as string) || null, stats: (u.stats as Record<string, number>) || null, desc: (u.desc as string) || null, flavorText: (u.flavorText as string) || null }); }} className="text-xs mt-1 px-3 py-2 rounded-lg font-semibold w-full text-left" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24", cursor: "pointer" }}>
              Unique Item Found: <strong>{collectResult.uniqueDrop.name}</strong> ({collectResult.uniqueDrop.slot})
            </button>
          )}

          {collectResult.bonusAwarded && (
            <div className="text-xs mt-1" style={{ color: "#fbbf24" }}>
              {collectResult.bonusAwarded.title && <span>Title earned: <strong>{collectResult.bonusAwarded.title}</strong></span>}
              {collectResult.bonusAwarded.frame && <span className="ml-2">Frame: <strong>{collectResult.bonusAwarded.frame}</strong></span>}
            </div>
          )}

          {onNavigate && (
            <div className="flex gap-3">
              {(collectResult.rewards.gearDropItem || collectResult.uniqueDrop) && (
                <button onClick={() => onNavigate("character")} className="btn-interactive text-xs" style={{ color: "#a855f7", cursor: "pointer" }}>View in Character →</button>
              )}
              {(collectResult.rewards.materialCount || 0) > 0 && (
                <button onClick={() => onNavigate("forge")} className="btn-interactive text-xs" style={{ color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>View in Forge →</button>
              )}
            </div>
          )}

          <button onClick={() => setCollectResult(null)} className="btn-interactive text-xs px-3 py-1.5 rounded-lg" style={{ color: "rgba(255,255,255,0.4)" }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Active Run */}
      {activeRun && (
        <div className="rounded-xl p-5 space-y-4" style={{
          background: `${activeRun.dungeonAccent}08`,
          border: `1px solid ${activeRun.dungeonAccent}30`,
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeRun.dungeonIcon?.startsWith("/") ? <img src={activeRun.dungeonIcon} alt="" width={32} height={32} className="img-render-auto rounded" onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-xl">{activeRun.dungeonIcon}</span>}
              <div>
                <p className="text-sm font-bold" style={{ color: activeRun.dungeonAccent }}>
                  {activeRun.dungeonName}
                </p>
                <p className="text-xs text-w30">
                  {activeRun.status === "forming" ? "Forming group..." : "In progress"}
                </p>
              </div>
            </div>
            <div className="text-right">
              {activeRun.status === "active" && activeRun.completesAt && (
                <>
                  <p className={`text-sm font-mono font-bold${new Date(activeRun.completesAt).getTime() - Date.now() <= 0 ? " bar-pulse" : ""}`} style={{
                    color: new Date(activeRun.completesAt).getTime() - Date.now() <= 0 ? "#22c55e" : activeRun.dungeonAccent,
                  }}>
                    {timeLeft(new Date(activeRun.completesAt).getTime() - Date.now())}
                  </p>
                  <p className="text-xs text-w20">
                    {new Date(activeRun.completesAt).getTime() - Date.now() <= 0 ? "Ready to collect!" : "Time remaining"}
                  </p>
                </>
              )}
              {activeRun.status === "forming" && (
                <p className="text-xs" style={{ color: "#fbbf24" }}>
                  {activeRun.participants.length}/{activeRun.minPlayers} min
                </p>
              )}
            </div>
          </div>

          {/* Participants */}
          <div>
            <p className="text-xs text-w25 mb-2 font-semibold">Party ({activeRun.participants.length}/{activeRun.maxPlayers})</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {activeRun.participants.map(p => (
                <div key={p.name} className="rounded-lg p-2.5 text-center" style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${p.color}30`,
                }}>
                  <div className="w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-sm font-bold" style={{
                    background: `${p.color}20`,
                    border: `2px solid ${p.color}40`,
                    color: p.color,
                  }}>
                    {p.avatar || p.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-xs font-semibold truncate" style={{ color: p.color }}>{p.name}</p>
                  <p className="text-xs" style={{ color: p.gearScore >= activeRun.gearScoreThreshold ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.6)" }}>GS: {p.gearScore}{p.gearScore < activeRun.gearScoreThreshold ? " !" : ""}</p>
                  {p.bondLevel > 0 && <p className="text-xs text-w15">Bond: {p.bondLevel}</p>}
                </div>
              ))}
              {/* Pending invites */}
              {activeRun.invitedPlayers.map(p => (
                <div key={p.name} className="rounded-lg p-2.5 text-center" style={{
                  background: "rgba(245,158,11,0.04)",
                  border: "1px dashed rgba(245,158,11,0.2)",
                }}>
                  <div className="w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-sm" style={{
                    background: "rgba(245,158,11,0.08)", color: "#f59e0b",
                  }}>
                    ?
                  </div>
                  <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{p.name}</p>
                  <p className="text-xs font-semibold" style={{ color: "#f59e0b" }}>Pending</p>
                </div>
              ))}
            </div>
          </div>

          {/* Combined Power Stats */}
          {activeRun.status === "active" && (
            <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <TipCustom title="Success Formula" icon="◆" accent="#3b82f6" body={<p>Effective Power = total Gear Score + Bond Bonus (+5 per bond level). If power ≥ threshold: 100%. At 70%: 70%, 50%: 40%, below: 15%.</p>}>
                <p className="text-xs text-w25 mb-1 cursor-help">Group Power</p>
              </TipCustom>
              {(() => {
                const totalGS = activeRun.participants.reduce((sum, p) => sum + p.gearScore, 0);
                const totalBond = activeRun.participants.reduce((sum, p) => sum + p.bondLevel, 0);
                const bondBonus = totalBond * 5;
                const effective = totalGS + bondBonus;
                const threshold = activeRun.gearScoreThreshold * activeRun.participants.length;
                const ratio = effective / threshold;
                let chanceLabel = "15%";
                let chanceColor = "#ef4444";
                if (ratio >= 1) { chanceLabel = "100%"; chanceColor = "#22c55e"; }
                else if (ratio >= 0.7) { chanceLabel = "70%"; chanceColor = "#eab308"; }
                else if (ratio >= 0.5) { chanceLabel = "40%"; chanceColor = "#f97316"; }
                return (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-w35">Gear Score</span><span className="font-mono text-w50">{totalGS}</span></div>
                    <div className="flex justify-between"><span className="text-w35">Bond Bonus</span><span className="font-mono text-w50">+{bondBonus}</span></div>
                    <div className="flex justify-between"><span className="text-w35">Effective Power</span><span className="font-mono font-bold" style={{ color: effective >= threshold ? "#22c55e" : "#fbbf24" }}>{effective}</span></div>
                    <div className="flex justify-between"><span className="text-w35">Threshold</span><span className="font-mono text-w50">{threshold}</span></div>
                    <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <div className="flex justify-between"><span className="text-w35 font-semibold">Success Chance</span><span className="font-mono font-bold" style={{ color: chanceColor }}>{chanceLabel}</span></div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {/* Join button — for invited players who haven't joined */}
            {activeRun.status === "forming" && activeRun.invitedPlayers.some(p => (p.name || "").toLowerCase() === playerName?.toLowerCase()) && (
              <button
                onClick={() => joinRun(activeRun.runId)}
                disabled={actionLoading}
                className="btn-interactive flex-1 text-xs font-bold py-2.5 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${activeRun.dungeonAccent}, ${activeRun.dungeonAccent}cc)`,
                  color: "#000",
                  opacity: actionLoading ? 0.5 : 1,
                  cursor: actionLoading ? "not-allowed" : "pointer",
                }}
                title={actionLoading ? "Action in progress..." : undefined}
              >
                {actionLoading ? "..." : "Join Dungeon"}
              </button>
            )}

            {/* Collect button — when dungeon is done */}
            {activeRun.status === "active" && activeRun.completesAt &&
              new Date(activeRun.completesAt).getTime() - Date.now() <= 0 &&
              !activeRun.collected.some(c => (c || "").toLowerCase() === playerName?.toLowerCase()) && (
              <button
                onClick={() => collectRewards(activeRun.runId)}
                disabled={actionLoading}
                className="btn-interactive flex-1 text-xs font-bold py-2.5 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${activeRun.dungeonAccent}, ${activeRun.dungeonAccent}cc)`,
                  color: "#000",
                  opacity: actionLoading ? 0.5 : 1,
                  cursor: actionLoading ? "not-allowed" : "pointer",
                }}
                title={actionLoading ? "Action in progress..." : undefined}
              >
                {actionLoading ? "..." : "Collect Rewards"}
              </button>
            )}

            {/* Already collected */}
            {activeRun.collected.some(c => (c || "").toLowerCase() === playerName?.toLowerCase()) && (
              <div className="py-2.5">
                <p className="text-xs text-w25">Rewards collected. Waiting for party members:</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {activeRun.participants.map(p => {
                    const hasCollected = activeRun.collected.some(c => (c || "").toLowerCase() === (p.name || "").toLowerCase());
                    return (
                      <span key={p.name} className="text-xs px-2 py-0.5 rounded" style={{
                        background: hasCollected ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                        color: hasCollected ? "#22c55e" : "rgba(255,255,255,0.3)",
                        border: `1px solid ${hasCollected ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`,
                      }}>
                        {hasCollected ? "✓" : "..."} {p.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Waiting status */}
            {activeRun.status === "active" && activeRun.completesAt &&
              new Date(activeRun.completesAt).getTime() - Date.now() > 0 && (
              <p className="text-xs text-w25 py-2.5">Your party is in the dungeon. Come back when the timer completes.</p>
            )}

            {activeRun.status === "forming" && activeRun.createdBy?.toLowerCase() === playerName?.toLowerCase() && (
              <div className="flex items-center gap-3 py-2.5">
                <p className="text-xs text-w20 flex-1">Waiting for invited friends to join. Dungeon starts when minimum players join.</p>
                {!confirmCancel ? (
                  <button
                    onClick={() => setConfirmCancel(true)}
                    disabled={actionLoading}
                    className="btn-interactive text-xs font-semibold px-3 py-2 rounded-lg shrink-0"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.5 : 1 }}
                    title={actionLoading ? "Action in progress..." : "Cancel this dungeon run"}
                  >
                    Cancel Run
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-w30">Cancel run?</span>
                    <button
                      onClick={async () => {
                        if (!reviewApiKey || actionLoading) return;
                        setActionLoading(true);
                        try {
                          const r = await fetch("/api/dungeons/cancel", {
                            method: "POST",
                            headers: { ...getAuthHeaders(reviewApiKey), "Content-Type": "application/json" },
                            body: JSON.stringify({ runId: activeRun.runId }),
                          });
                          const d = await r.json();
                          if (!r.ok) setMessage({ text: d.error || "Failed to cancel", type: "error" });
                          else { setMessage({ text: d.message || "Run cancelled", type: "success" }); fetchDungeons(); onRefresh?.(); }
                        } catch { setMessage({ text: "Network error", type: "error" }); }
                        setActionLoading(false);
                        setConfirmCancel(false);
                      }}
                      disabled={actionLoading}
                      title={actionLoading ? "Action in progress..." : "Confirm cancel run"}
                      className="btn-interactive text-xs font-bold px-3 py-2 rounded-lg"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: actionLoading ? "not-allowed" : "pointer" }}
                    >
                      {actionLoading ? "..." : "Yes"}
                    </button>
                    <button
                      onClick={() => setConfirmCancel(false)}
                      className="btn-interactive text-xs px-3 py-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dungeon Selection — shown when no active run */}
      {!activeRun && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {dungeons.map(d => {
            const locked = !d.unlocked;
            const onCd = d.cooldown.onCooldown;
            const canEnter = !locked && !onCd;
            return (
              <div key={d.id} className={`rounded-xl p-4 space-y-3${!locked ? " crystal-breathe" : ""}`} style={{
                background: locked ? "rgba(255,255,255,0.02)" : `${d.accent}06`,
                border: `1px solid ${locked ? "rgba(255,255,255,0.05)" : `${d.accent}25`}`,
                opacity: locked ? 0.5 : 1,
                ...(!locked ? { ["--glow-color" as string]: `${d.accent}25` } : {}),
              }}>
                <div className="text-center">
                  {d.icon?.startsWith("/") ? (
                    <div className="w-14 h-14 mx-auto rounded-xl overflow-hidden" style={{ border: `1px solid ${d.accent}30`, boxShadow: `0 0 12px ${d.accent}12` }}>
                      <img src={d.icon} alt="" className="w-full h-full object-cover img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} />
                    </div>
                  ) : <span className="text-2xl">{d.icon}</span>}
                  <p className="text-sm font-bold mt-1" style={{ color: d.accent }}>{d.name}</p>
                  <p className="text-xs text-w25 mt-0.5 px-2">{d.description}</p>
                  {locked && <p className="text-xs text-w20 mt-1">Requires Lv.{d.minLevel}</p>}
                  {!locked && (() => {
                    const playerLevel = getUserLevel(loggedInUser?.xp ?? 0).level;
                    const meetsLevel = playerLevel >= d.minLevel;
                    return (
                      <p className="text-xs mt-1.5 font-semibold" style={{ color: meetsLevel ? "#22c55e" : "#fbbf24" }}>
                        {meetsLevel ? "\u2713 Ready" : `Lv.${playerLevel}/${d.minLevel}`} {"\u00b7"} GS {d.gearScoreThreshold}/player
                      </p>
                    );
                  })()}
                </div>

                <div className="space-y-1 text-xs text-w35">
                  <div className="flex justify-between">
                    <span>Tier</span>
                    <span className="font-semibold" style={{ color: TIER_COLORS[d.tier] || "#888" }}>{TIER_LABELS[d.tier] || d.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Players</span>
                    <span className="font-mono text-w50">{d.minPlayers}-{d.maxPlayers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <span className="font-mono text-w50">{d.durationHours}h</span>
                  </div>
                  <TipCustom title="Gear Score Threshold" icon="◆" accent="#fbbf24" body={<p>Combined gear score of all party members vs. the dungeon&apos;s threshold determines success chance.</p>}>
                    <div className="flex justify-between cursor-help">
                      <span>Gear Score</span>
                      <span className="font-mono text-w50">{d.gearScoreThreshold}/player</span>
                    </div>
                  </TipCustom>
                  <div className="flex justify-between">
                    <span>Cooldown</span>
                    <span className="font-mono text-w50">{d.cooldownDays}d</span>
                  </div>
                </div>

                {/* Reward preview */}
                <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="text-xs text-w25 mb-1">Rewards:</p>
                  <div className="flex flex-wrap gap-1">
                    <Tip k="gold"><span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#fbbf24" }}>
                      {d.rewards.gold[0]}-{d.rewards.gold[1]}g
                    </span></Tip>
                    <Tip k="essenz"><span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#ef4444" }}>
                      {d.rewards.essenz[0]}-{d.rewards.essenz[1]} Ess
                    </span></Tip>
                    {d.rewards.gearDrop && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#a855f7" }}>
                        {Math.round(d.rewards.gearDrop.chance * 100)}% {d.rewards.gearDrop.minRarity}+ gear
                      </span>
                    )}
                  </div>
                  {d.bonusRewards && (
                    <p className="text-xs text-w15 mt-1">Bonus: <span style={{ color: d.accent }}>{d.bonusRewards.title}</span> title + frame</p>
                  )}
                </div>

                {/* Unique drops */}
                {d.uniqueItemDetails && d.uniqueItemDetails.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-w25">Unique Drops:</p>
                    {d.uniqueItemDetails.map(item => (
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
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded cursor-help" style={{ background: "rgba(255,140,0,0.04)", border: "1px solid rgba(255,140,0,0.1)", borderLeft: "2px solid #ff8c00" }}>
                          <span className="text-xs" style={{ color: "#ff8c00" }}>{"\u2726"}</span>
                          <span className="text-xs font-semibold" style={{ color: "#ff8c00" }}>{item.name}</span>
                          <span className="text-xs text-w15 ml-auto capitalize">{item.slot}</span>
                        </div>
                      </TipCustom>
                    ))}
                  </div>
                )}

                {onNavigate && (
                  <div className="flex gap-3 mt-1">
                    {d.rewards.gearDrop && <button onClick={() => onNavigate("character")} className="btn-interactive text-xs" style={{ color: "rgba(255,255,255,0.25)", cursor: "pointer" }}>View in Character →</button>}
                    <button onClick={() => onNavigate("forge")} className="btn-interactive text-xs" style={{ color: "rgba(255,255,255,0.25)", cursor: "pointer" }}>View in Forge →</button>
                  </div>
                )}

                {onCd && d.cooldown.endsAt && (
                  <p className="text-xs text-center" style={{ color: "#ef4444" }}>
                    Cooldown: {timeLeft(d.cooldown.remainingMs || 0)}
                  </p>
                )}

                <button
                  onClick={() => canEnter && openCreateModal(d.id)}
                  disabled={!canEnter || actionLoading}
                  className="btn-interactive w-full text-xs font-bold py-2 rounded-lg"
                  style={{
                    background: canEnter ? `${d.accent}15` : "rgba(255,255,255,0.03)",
                    color: canEnter ? d.accent : "rgba(255,255,255,0.2)",
                    border: `1px solid ${canEnter ? `${d.accent}40` : "rgba(255,255,255,0.06)"}`,
                    cursor: canEnter ? "pointer" : "not-allowed",
                  }}
                  title={locked ? `Requires Level ${d.minLevel}` : onCd ? `Cooldown: ${timeLeft(d.cooldown.remainingMs || 0)}` : "Create a dungeon run"}
                >
                  {locked ? "Locked" : onCd ? "On Cooldown" : "Create Run"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Run Modal */}
      {showCreate && selectedDungeonData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 modal-backdrop" />
          <div
            className="relative rounded-xl p-6 w-full max-w-md space-y-4 tab-content-enter"
            style={{
              background: "#12141a",
              border: `1px solid ${selectedDungeonData.accent}30`,
              boxShadow: `0 0 40px ${selectedDungeonData.accent}10`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedDungeonData.icon}</span>
              <div>
                <p className="text-sm font-bold" style={{ color: selectedDungeonData.accent }}>{selectedDungeonData.name}</p>
                <p className="text-xs text-w25">Invite {selectedDungeonData.minPlayers - 1}-{maxInvites} friends</p>
              </div>
            </div>

            {/* Friends list */}
            <div>
              <p className="text-xs font-semibold text-w40 mb-1">Select Friends ({selectedFriends.length}/{maxInvites})</p>
              <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>Need at least {selectedDungeonData.minPlayers - 1} friend{selectedDungeonData.minPlayers - 1 !== 1 ? "s" : ""} to start the dungeon</p>
              {friendsLoading ? (
                <div className="space-y-1.5 py-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-pulse rounded-lg" style={{ height: 42, background: "rgba(255,255,255,0.03)" }} />
                  ))}
                </div>
              ) : friends.length === 0 ? (
                <div className="text-xs text-w20 py-4 text-center">No friends found. Add friends in The Breakaway first.</div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                  {friends.map(f => {
                    const selected = selectedFriends.includes(f.name);
                    const disabled = !selected && selectedFriends.length >= maxInvites;
                    return (
                      <button
                        key={f.id}
                        onClick={() => !disabled && toggleFriend(f.name)}
                        disabled={disabled}
                        title={disabled ? "Maximum invites reached" : selected ? "Remove from party" : "Add to party"}
                        className="btn-interactive w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left"
                        style={{
                          background: selected ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${selected ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.06)"}`,
                          boxShadow: selected ? "0 0 8px rgba(34,197,94,0.1)" : "none",
                          opacity: disabled ? 0.4 : 1,
                          cursor: disabled ? "not-allowed" : "pointer",
                        }}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{
                          background: `${f.color}20`,
                          color: f.color,
                          border: `1px solid ${f.color}40`,
                        }}>
                          {f.avatar || f.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold flex items-center gap-1" style={{ color: selected ? "#22c55e" : "rgba(255,255,255,0.6)" }}>
                            <span className="inline-block w-2 h-2 rounded-full" style={{ background: f.onlineStatus === "online" ? "#22c55e" : f.onlineStatus === "idle" ? "#eab308" : "#6b7280" }} />
                            {f.name}
                          </p>
                          <p className="text-xs text-w20">Lv.{f.level} {f.onlineStatus === "online" ? "Online" : f.onlineStatus === "idle" ? "Idle" : f.lastActiveAt ? (() => { const h = Math.floor((Date.now() - new Date(f.lastActiveAt).getTime()) / 3600000); return h < 1 ? "vor <1h" : h < 24 ? `vor ${h}h` : `vor ${Math.floor(h / 24)}d`; })() : "Offline"}</p>
                        </div>
                        <div className="w-4 h-4 rounded border flex items-center justify-center" style={{
                          background: selected ? "#22c55e" : "transparent",
                          borderColor: selected ? "#22c55e" : "rgba(255,255,255,0.15)",
                        }}>
                          {selected && <span style={{ color: "#000", fontSize: 12, fontWeight: 800 }}>&#10003;</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={createRun}
                disabled={actionLoading || selectedFriends.length === 0}
                title={actionLoading ? "Action in progress..." : selectedFriends.length === 0 ? "Select at least one friend to invite" : "Create dungeon run"}
                className="btn-interactive flex-1 text-xs font-bold py-2.5 rounded-lg"
                style={{
                  background: selectedFriends.length > 0 ? `${selectedDungeonData.accent}18` : "rgba(255,255,255,0.03)",
                  color: selectedFriends.length > 0 ? selectedDungeonData.accent : "rgba(255,255,255,0.2)",
                  border: `1px solid ${selectedFriends.length > 0 ? `${selectedDungeonData.accent}40` : "rgba(255,255,255,0.06)"}`,
                  opacity: actionLoading ? 0.5 : 1,
                  cursor: (actionLoading || selectedFriends.length === 0) ? "not-allowed" : "pointer",
                }}
              >
                {actionLoading ? "Creating..." : `Create Run (${selectedFriends.length} invited)`}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="btn-interactive text-xs px-4 py-2.5 rounded-lg"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w25 mb-2">Dungeon History</p>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: h.success ? "#22c55e" : "#ef4444" }}>{h.success ? "✓" : "✕"}</span>
                  <span className="text-w50 font-semibold">{h.dungeonName}</span>
                  <span className="capitalize px-1.5 py-0.5 rounded" style={{
                    background: `${TIER_COLORS[h.tier] || "#888"}10`,
                    color: TIER_COLORS[h.tier] || "#888",
                    fontSize: 12,
                  }}>
                    {TIER_LABELS[h.tier] || h.tier}
                  </span>
                  <span className="text-w20">{h.participants.length} players</span>
                </div>
                <span className="text-w15">{new Date(h.completedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tooltipItem && <ItemTooltip item={tooltipItem} onClose={() => setTooltipItem(null)} />}
    </div>
  );
}
