"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useModalBehavior } from "@/components/ModalPortal";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { getUserLevel } from "@/app/utils";
import { Tip, TipCustom } from "@/components/GameTooltip";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  name: string;
  avatar: string;
  color: string;
  level: number;
  levelTitle: string;
  xp: number;
  questsCompleted: number;
  streakDays: number;
  forgeTemp: number;
  gold: number;
  achievementPoints: number;
  equippedTitle: { id: string; name: string; rarity: string } | null;
  equippedFrame: { id: string; name: string; color: string; glow?: boolean } | null;
  classInfo: { id: string; name: string; icon: string; tier: string | null } | null;
  companion: { name: string; type: string; emoji: string; isReal: boolean; bondLevel: number } | null;
  equipped: Record<string, { name: string; rarity: string; icon: string | null; stats: Record<string, number>; slot: string; setId: string | null; legendaryEffect: { type: string; label: string } | null; desc: string }>;
  achievements: { id: string; name: string; desc: string; icon: string; rarity: string; points: number; earnedAt: string }[];
  professions: { id: string; level: number; xp: number }[];
  friendshipStatus?: "friends" | "pending_sent" | "pending_received" | "none";
  gearScore?: number;
  onlineStatus: string;
  lastActiveAt: string | null;
  memberSince: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, string> = { common: "#9ca3af", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#ff8c00", unique: "#e6cc80" };
const SLOT_LABELS: Record<string, string> = { weapon: "Weapon", shield: "Shield", helm: "Helm", armor: "Armor", amulet: "Amulet", boots: "Boots" };
const PROF_META: Record<string, { name: string; color: string; icon: string }> = {
  schmied: { name: "Blacksmith", color: "#f59e0b", icon: "/images/icons/prof-schmied.png" },
  alchemist: { name: "Alchemist", color: "#22c55e", icon: "/images/icons/prof-alchemist.png" },
  verzauberer: { name: "Enchanter", color: "#a78bfa", icon: "/images/icons/prof-verzauberer.png" },
  koch: { name: "Cook", color: "#e87b35", icon: "/images/icons/prof-koch.png" },
};
const ONLINE_COLORS: Record<string, string> = { online: "#22c55e", idle: "#eab308", offline: "#555" };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; };

// ─── Component ──────────────────────────────────────────────────────────────

export default function PlayerProfileModal({ playerId, onClose, onAddFriend, onMessage }: {
  playerId: string;
  onClose: () => void;
  onAddFriend?: (playerId: string) => void;
  onMessage?: (playerId: string) => void;
}) {
  const { playerName, reviewApiKey } = useDashboard();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useModalBehavior(true, onClose);

  const fetchProfile = useCallback(async () => {
    try {
      const headers = reviewApiKey ? getAuthHeaders(reviewApiKey) : {};
      const r = await fetch(`/api/player/${encodeURIComponent(playerId)}/public-profile`, { headers });
      if (r.ok) {
        setProfile(await r.json());
      } else {
        setError("Player not found");
      }
    } catch {
      setError("Failed to load profile");
    }
    setLoading(false);
  }, [playerId, reviewApiKey]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const isSelf = playerName?.toLowerCase() === playerId.toLowerCase();

  const handleAddFriend = async () => {
    if (!reviewApiKey || !playerName || isSelf) return;
    try {
      const r = await fetch("/api/social/friend-request", {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayer: playerId }),
      });
      if (r.ok) {
        setFriendRequestSent(true);
        onAddFriend?.(playerId);
      }
    } catch { /* ignore */ }
  };

  const handleRemoveFriend = async () => {
    if (!reviewApiKey || !playerName) return;
    setRemovingFriend(true);
    try {
      const r = await fetch(`/api/social/friend/${encodeURIComponent(playerId)}`, {
        method: "DELETE",
        headers: getAuthHeaders(reviewApiKey),
      });
      if (r.ok) {
        fetchProfile(); // Refresh to update friendshipStatus
        setConfirmRemove(false);
      }
    } catch { /* ignore */ }
    setRemovingFriend(false);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.82)" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "#141418", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Close button */}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <span className="text-white text-sm">&#10005;</span>
        </button>

        {loading ? (
          <div className="p-8 space-y-4 tab-content-enter">
            <div className="flex items-center gap-4"><div className="skeleton w-16 h-16 rounded-2xl" /><div className="space-y-2 flex-1"><div className="skeleton skeleton-text w-32" /><div className="skeleton skeleton-text w-20" /></div></div>
            <div className="skeleton-card h-20" /><div className="skeleton-card h-32" />
          </div>
        ) : error ? (
          <div className="p-8 text-center"><p className="text-sm" style={{ color: "#ef4444" }}>{error}</p></div>
        ) : profile ? (
          <div className="tab-content-enter">
            {/* Header — name, level, title, online status */}
            <div className="p-6 pb-4" style={{ background: `linear-gradient(180deg, ${profile.color}15 0%, transparent 100%)`, borderBottom: `1px solid ${profile.color}20` }}>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl flex-shrink-0" style={{ background: `linear-gradient(135deg, ${profile.color}, ${profile.color}88)`, color: "#fff", boxShadow: `0 6px 20px ${profile.color}40`, border: profile.equippedFrame ? `2px solid ${profile.equippedFrame.color}` : "none" }}>
                    {profile.avatar?.slice(0, 2) || profile.name[0]}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#141418]" style={{ background: ONLINE_COLORS[profile.onlineStatus] || "#555", boxShadow: profile.onlineStatus === "online" ? "0 0 6px #22c55e" : "none" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold" style={{ color: "#f5f5f5" }}>{profile.name}</h2>
                    {profile.streakDays > 0 && <Tip k="streak"><span className="text-xs font-bold cursor-help" style={{ color: profile.streakDays >= 30 ? "#ef4444" : "#f59e0b" }}>🔥{profile.streakDays}</span></Tip>}
                  </div>
                  <Tip k="player_level">
                    <p className="text-sm font-semibold cursor-help" style={{ color: `${profile.color}cc` }}>
                      Lv.{profile.level} · {profile.levelTitle}
                    </p>
                  </Tip>
                  {profile.equippedTitle && (
                    <Tip k="titles">
                      <p className="text-xs font-medium cursor-help" style={{ color: RARITY_COLORS[profile.equippedTitle.rarity] || "#9ca3af" }}>
                        &laquo; {profile.equippedTitle.name} &raquo;
                      </p>
                    </Tip>
                  )}
                  {profile.classInfo && (
                    <Tip k="classes">
                      <p className="text-xs cursor-help" style={{ color: "rgba(167,139,250,0.7)" }}>
                        {profile.classInfo.icon} {profile.classInfo.name}{profile.classInfo.tier ? ` · ${profile.classInfo.tier}` : ""}
                      </p>
                    </Tip>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {!isSelf && reviewApiKey && (
                <div className="flex gap-2 mt-4">
                  {profile.friendshipStatus === "friends" ? (
                    confirmRemove ? (
                      <div className="flex gap-2 flex-1">
                        <button onClick={handleRemoveFriend} disabled={removingFriend} className="btn-interactive flex-1 text-xs font-semibold py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                          {removingFriend ? "..." : "Confirm Remove"}
                        </button>
                        <button onClick={() => setConfirmRemove(false)} className="btn-interactive flex-1 text-xs font-semibold py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmRemove(true)} className="btn-interactive flex-1 text-xs font-semibold py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.6)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        Remove Friend
                      </button>
                    )
                  ) : profile.friendshipStatus === "pending_sent" || friendRequestSent ? (
                    <button disabled className="btn-interactive flex-1 text-xs font-semibold py-2 rounded-lg" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
                      ✓ Request Sent
                    </button>
                  ) : (
                    <button onClick={handleAddFriend} className="btn-interactive flex-1 text-xs font-semibold py-2 rounded-lg" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}>
                      Add Friend
                    </button>
                  )}
                  {onMessage && profile.friendshipStatus === "friends" && (
                    <button onClick={() => { onMessage(playerId); onClose(); }} className="btn-interactive flex-1 text-xs font-semibold py-2 rounded-lg" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                      Message
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-5 gap-px" style={{ background: "rgba(255,255,255,0.04)" }}>
              {[
                { label: "XP", value: profile.xp.toLocaleString(), color: "#a855f7", tip: "xp" as const },
                { label: "Quests", value: profile.questsCompleted.toLocaleString(), color: "#8b5cf6", tip: "quest_board" as const },
                { label: "GS", value: (profile.gearScore ?? 0).toLocaleString(), color: "#fbbf24", tip: "gear_score" as const },
                { label: "Ach. Pts", value: profile.achievementPoints.toLocaleString(), color: "#d4a64a", tip: "achievements" as const },
                { label: "Gold", value: profile.gold.toLocaleString(), color: "#f59e0b", tip: "gold" as const },
              ].map(s => (
                <Tip key={s.label} k={s.tip}>
                  <div className="text-center py-3 cursor-help" style={{ background: "#141418" }}>
                    <p className="text-sm font-mono font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-w25">{s.label}</p>
                  </div>
                </Tip>
              ))}
            </div>

            {/* Equipment section */}
            {profile.equipped && Object.keys(profile.equipped).length > 0 && (
              <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3 text-w35">Equipment</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["weapon", "shield", "helm", "armor", "amulet", "boots"] as const).map(slot => {
                    const item = profile.equipped[slot];
                    if (!item) return (
                      <div key={slot} className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <p className="text-xs text-w15">{SLOT_LABELS[slot]}</p>
                        <p className="text-xs text-w10">Empty</p>
                      </div>
                    );
                    const rc = RARITY_COLORS[item.rarity] || "#888";
                    const statLines = Object.entries(item.stats).map(([k, v]) => (
                      <span key={k} className="block text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>+{v} {k}</span>
                    ));
                    const tooltipBody = (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold" style={{ color: rc }}>{item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)} · {SLOT_LABELS[slot]}</p>
                        {statLines.length > 0 && <div>{statLines}</div>}
                        {item.setId && <p className="text-xs" style={{ color: "#22c55e" }}>Set: {item.setId}</p>}
                        {item.legendaryEffect && <p className="text-xs" style={{ color: "#f59e0b" }}>★ {item.legendaryEffect.label}</p>}
                        {item.desc && <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.3)" }}>&quot;{item.desc}&quot;</p>}
                      </div>
                    );
                    return (
                      <TipCustom key={slot} title={item.name} icon={item.icon ?? "⚔️"} accent={rc} body={tooltipBody}>
                        <div className="rounded-lg p-2 cursor-help" style={{ background: `${rc}08`, border: `1px solid ${rc}25` }}>
                          <div className="flex items-center gap-1.5">
                            {item.icon && <img src={item.icon} alt="" width={24} height={24} style={{ imageRendering: "auto" }} onError={hideOnError} />}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: rc }}>{item.name}</p>
                              <p className="text-xs text-w20">{SLOT_LABELS[slot]}</p>
                            </div>
                          </div>
                          {item.legendaryEffect && (
                            <p className="text-xs mt-1 truncate" style={{ color: "#f59e0b", fontSize: 12 }}>★ {item.legendaryEffect.label}</p>
                          )}
                        </div>
                      </TipCustom>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Companion */}
            {profile.companion && (
              <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <Tip k="companions">
                  <div className="flex items-center gap-2 cursor-help">
                    <span className="text-lg">{profile.companion.emoji || "🐾"}</span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "#e8e8e8" }}>{profile.companion.name}</p>
                      <Tip k="bond_level">
                        <p className="text-xs text-w30 cursor-help">Bond Level {profile.companion.bondLevel} · {profile.companion.isReal ? "Real pet" : "Virtual"}</p>
                      </Tip>
                    </div>
                  </div>
                </Tip>
              </div>
            )}

            {/* Professions */}
            {profile.professions.length > 0 && (
              <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <Tip k="professions" heading>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 text-w35 cursor-help">Professions</p>
                </Tip>
                <div className="flex gap-2">
                  {profile.professions.map(p => {
                    const meta = PROF_META[p.id];
                    if (!meta) return null;
                    return (
                      <Tip k="professions" key={p.id}>
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-help" style={{ background: `${meta.color}10`, border: `1px solid ${meta.color}25` }}>
                          <img src={meta.icon} alt="" width={18} height={18} style={{ imageRendering: "auto" }} onError={hideOnError} />
                          <div>
                            <p className="text-xs font-semibold" style={{ color: meta.color }}>{meta.name}</p>
                            <p className="text-xs text-w25">Lv.{p.level}</p>
                          </div>
                        </div>
                      </Tip>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Achievements */}
            {profile.achievements.length > 0 && (
              <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <Tip k="achievements" heading>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 text-w35 cursor-help">
                    Achievements ({profile.achievements.length})
                  </p>
                </Tip>
                <div className="flex flex-wrap gap-1.5">
                  {profile.achievements.slice(0, 20).map(a => {
                    const achColor = RARITY_COLORS[a.rarity] || "#fbbf24";
                    return (
                      <TipCustom key={a.id} title={a.name} icon={a.icon?.startsWith("/") ? undefined : a.icon || "🏆"} accent={achColor} body={
                        <div>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{a.desc}</p>
                          <p className="text-xs mt-1" style={{ color: achColor }}>{a.rarity.charAt(0).toUpperCase() + a.rarity.slice(1)} · {a.points} pts</p>
                        </div>
                      }>
                        <span className="inline-flex cursor-help">
                          {a.icon ? <img src={a.icon} alt={a.name} width={22} height={22} style={{ imageRendering: "auto" }} onError={hideOnError} /> : <span className="text-sm">🏆</span>}
                        </span>
                      </TipCustom>
                    );
                  })}
                  {profile.achievements.length > 20 && (
                    <span className="text-xs self-center text-w20">+{profile.achievements.length - 20} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-xs text-w15">
                {profile.onlineStatus === "online" ? "Online now" : profile.lastActiveAt ? `Last seen ${timeAgo(profile.lastActiveAt)}` : "Offline"}
              </span>
              {profile.memberSince && (
                <span className="text-xs text-w15">Member since {new Date(profile.memberSince).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
