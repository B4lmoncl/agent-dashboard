"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import ItemTooltip from "@/components/ItemTooltip";
import FirstVisitBanner from "@/components/FirstVisitBanner";
import { TutorialMomentBanner } from "@/components/ContextualTutorial";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";
import { formatLegendaryLabel } from "@/app/utils";
import { RARITY_COLORS } from "@/app/constants";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import type { RewardCelebrationData } from "@/components/RewardCelebration";
import type {
  FriendInfo, FriendRequest, Conversation, SocialMessage,
  Trade, TradeOffer, ActivityEvent, SwornBond,
} from "@/app/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function PlayerBadge({ name, avatar, color, size = 24 }: { name: string; avatar: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(size * 0.4, 12), background: color + "20", color, border: `1px solid ${color}40` }}
    >
      {avatar?.slice(0, 2) || name?.[0] || "?"}
    </span>
  );
}

const ONLINE_COLORS: Record<string, string> = { online: "#22c55e", idle: "#eab308", offline: "#555" };
const ONLINE_LABELS: Record<string, string> = { online: "Online", idle: "Idle", offline: "Offline" };
const RARITY_SORT: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
const SLOT_SORT: Record<string, number> = { weapon: 0, shield: 1, helm: 2, armor: 3, amulet: 4, boots: 5 };
type TradeSortKey = "rarity" | "name" | "slot";

function OnlineDot({ status, lastActiveAt }: { status: string; lastActiveAt?: string | null }) {
  const label = status === "offline" && lastActiveAt ? `${timeAgo(lastActiveAt)}` : ONLINE_LABELS[status] || "Offline";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full flex-shrink-0${status === "online" ? " online-pulse" : ""}`} style={{ background: ONLINE_COLORS[status] || "#555", boxShadow: status === "online" ? "0 0 6px #22c55e" : "none" }} />
      <span className="text-xs" style={{ color: ONLINE_COLORS[status] || "#555" }}>{label}</span>
    </span>
  );
}

function ReadCheck({ read }: { read: boolean }) {
  return (
    <span className="text-xs ml-1" style={{ color: read ? "#60a5fa" : "#555" }} title={read ? "Read" : "Sent"} aria-label={read ? "Message read" : "Message sent"}>
      {read ? "✓✓" : "✓"}
    </span>
  );
}

// Activity event icons — image paths for visual consistency with game UI
const EVENT_ICON_SRCS: Record<string, string> = {
  quest_complete: "/images/icons/nav-great-hall.png",
  level_up: "/images/icons/reward-xp.png",
  achievement: "/images/icons/nav-honors.png",
  gacha_pull: "/images/icons/vault-of-fate.png",
  rare_drop: "/images/icons/equip-weapon.png",
  trade_complete: "/images/icons/currency-gold.png",
  streak_milestone: "/images/icons/ui-ritual-rune.png",
  world_boss_spawn: "/images/icons/nav-worldboss.png",
  world_boss_defeat: "/images/icons/nav-worldboss.png",
  dungeon_complete: "/images/icons/nav-dungeons.png",
  rift_complete: "/images/icons/nav-rift.png",
  expedition_complete: "/images/icons/currency-essenz.png",
  sworn_bond_formed: "/images/icons/nav-breakaway.png",
  sworn_bond_chest: "/images/icons/currency-gildentaler.png",
};
// Fallback unicode for missing images
const EVENT_ICONS: Record<string, string> = {
  quest_complete: "◆", level_up: "▲", achievement: "★",
  gacha_pull: "◇", rare_drop: "◈", trade_complete: "●", streak_milestone: "◇",
  world_boss_spawn: "◆", world_boss_defeat: "◆", dungeon_complete: "▼",
  rift_complete: "◈", expedition_complete: "↗",
  sworn_bond_formed: "◆", sworn_bond_chest: "◆",
};

// ─── Sub-tab navigation ──────────────────────────────────────────────────────

type SocialTab = "friends" | "messages" | "trades" | "activity" | "mail" | "challenges" | "bonds";

// ─── Friends Tab ────────────────────────────────────────────────────────────

function FriendsTab({ apiKey, playerName, onOpenProfile }: { apiKey: string; playerName: string; onOpenProfile?: (id: string) => void }) {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [addInput, setAddInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; avatar: string; color: string; level: number; classId: string | null }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      const headers = getAuthHeaders(apiKey);
      const [fRes, rRes] = await Promise.all([
        fetch(`/api/social/${encodeURIComponent(playerName)}/friends`, { headers }),
        fetch(`/api/social/${encodeURIComponent(playerName)}/friend-requests`, { headers }),
      ]);
      if (fRes.ok) setFriends((await fRes.json()).friends || []);
      if (rRes.ok) {
        const data = await rRes.json();
        setIncomingRequests(data.incoming || []);
        setOutgoingRequests(data.outgoing || []);
      }
    } catch (e) { console.error('[social]', e); }
    setLoading(false);
  }, [apiKey, playerName]);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);

  // Auto-refresh friends list every 30s
  useEffect(() => {
    const interval = setInterval(fetchFriends, 30000);
    return () => clearInterval(interval);
  }, [fetchFriends]);

  // Player search with debounce
  useEffect(() => {
    if (!addInput.trim() || addInput.trim().length < 1) { setSearchResults([]); setSearchOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/players/search?q=${encodeURIComponent(addInput.trim())}&limit=8`);
        if (r.ok) {
          const data = await r.json();
          // Filter out self and existing friends
          const friendIds = new Set(friends.map(f => f.id));
          const filtered = (data.players || []).filter((p: { id: string }) => p.id !== playerName.toLowerCase() && !friendIds.has(p.id));
          setSearchResults(filtered);
          setSearchOpen(filtered.length > 0);
        }
      } catch (e) { console.error('[social]', e); }
    }, 300);
    return () => clearTimeout(timer);
  }, [addInput, playerName, friends]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sendRequest = async (target?: string) => {
    const name = target || addInput.trim();
    if (!name) return;
    setError(null);
    try {
      const r = await fetch("/api/social/friend-request", {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayer: name }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Something went wrong. Please try again."); return; }
      setAddInput("");
      setSearchOpen(false);
      setSearchResults([]);
      setError(null);
      setSuccessMsg(`Friend request sent to ${name}!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchFriends();
    } catch { setError("Network error"); }
  };

  const handleRequest = async (reqId: string, action: "accept" | "decline") => {
    setProcessingReqId(reqId);
    try {
      await fetch(`/api/social/friend-request/${reqId}/${action}`, {
        method: "POST",
        headers: getAuthHeaders(apiKey),
      });
      fetchFriends();
    } catch (e) { console.error('[social]', e); }
    setProcessingReqId(null);
  };

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const removeFriend = async (friendId: string) => {
    try {
      await fetch(`/api/social/friend/${friendId}`, {
        method: "DELETE",
        headers: getAuthHeaders(apiKey),
      });
      setConfirmRemove(null);
      fetchFriends();
    } catch (e) { console.error('[social]', e); }
  };

  const incoming = incomingRequests;
  const outgoing = outgoingRequests;

  if (loading) return (
    <div className="space-y-3 tab-content-enter">
      <div className="skeleton-card"><div className="flex gap-2"><div className="skeleton skeleton-text flex-1" /><div className="skeleton w-20 h-8 rounded-lg" /></div></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {[1,2,3].map(i => <div key={i} className="skeleton-card flex flex-col items-center gap-2 py-4"><div className="skeleton w-9 h-9 rounded-full" /><div className="skeleton skeleton-text w-16" /><div className="skeleton skeleton-text w-10" /></div>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 tab-content-enter">
      {/* Add friend — with player search */}
      <div ref={searchRef} className="relative">
        <div className="flex gap-2">
          <input
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendRequest(); }}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
            placeholder="Search players..."
            maxLength={50}
            className="input-dark flex-1 text-xs px-3 py-2 rounded-lg"
          />
          <button
            onClick={() => sendRequest()}
            className="btn-interactive text-xs font-semibold px-4 py-2 rounded-lg"
            style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}
          >
            Add Friend
          </button>
        </div>
        {/* Search dropdown */}
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg shadow-xl overflow-hidden" style={{ background: "#1a1a1f", border: "1px solid rgba(255,255,255,0.1)", maxHeight: 280, overflowY: "auto" }}>
            {searchResults.map(p => (
              <div key={p.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.04] transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <button onClick={() => onOpenProfile?.(p.id)} className="flex items-center gap-2.5 flex-1 text-left min-w-0" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <PlayerBadge name={p.name} avatar={p.avatar} color={p.color} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate" style={{ color: "#e8e8e8" }}>{p.name}</p>
                    <p className="text-xs text-w25">Lv.{p.level}</p>
                  </div>
                </button>
                <button
                  onClick={() => sendRequest(p.name)}
                  className="btn-interactive text-xs px-2.5 py-1 rounded font-semibold flex-shrink-0"
                  style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)" }}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
      {successMsg && <p className="text-xs tab-content-enter" style={{ color: "#22c55e" }}>{successMsg}</p>}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w35 mb-2">Incoming Requests</p>
          <div className="space-y-2">
            {incoming.map(req => (
              <div key={req.id} className="flex items-center justify-between rounded-lg p-3" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <div className="flex items-center gap-2">
                  <PlayerBadge name={req.fromName} avatar={req.fromAvatar || req.fromName[0]} color={req.fromColor || "#a78bfa"} />
                  <span className="text-xs font-semibold" style={{ color: "#e8e8e8" }}>{req.fromName}</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => handleRequest(req.id, "accept")} disabled={processingReqId === req.id} className="btn-interactive text-xs px-3 py-1 rounded" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", opacity: processingReqId === req.id ? 0.5 : 1, cursor: processingReqId === req.id ? "not-allowed" : "pointer" }} title={processingReqId === req.id ? "Processing..." : "Accept friend request"}>{processingReqId === req.id ? "..." : "Accept"}</button>
                  <button onClick={() => handleRequest(req.id, "decline")} disabled={processingReqId === req.id} className="btn-interactive text-xs px-3 py-1 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", opacity: processingReqId === req.id ? 0.5 : 1, cursor: processingReqId === req.id ? "not-allowed" : "pointer" }} title={processingReqId === req.id ? "Processing..." : "Decline friend request"}>{processingReqId === req.id ? "..." : "Decline"}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w35 mb-2">Pending Requests</p>
          <div className="space-y-1">
            {outgoing.map(req => (
              <div key={req.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-w40">Sent to <span className="font-semibold text-w60">{req.toName}</span></span>
                <span className="text-w20">{timeAgo(req.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends grid — card layout for visual variety */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-w35 mb-2">Friends ({friends.length})</p>
        {friends.length === 0 ? (
          <p className="text-xs text-w20 text-center py-6">No friends yet. Send a request above!</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {[...friends].sort((a, b) => {
              const order: Record<string, number> = { online: 0, idle: 1, offline: 2 };
              const aStatus = a.onlineStatus || (a.isOnline ? "online" : "offline");
              const bStatus = b.onlineStatus || (b.isOnline ? "online" : "offline");
              return (order[aStatus] ?? 2) - (order[bStatus] ?? 2);
            }).map(f => (
              <div key={f.id} className="relative rounded-xl p-3 flex flex-col items-center text-center group transition-all cursor-pointer card-hover-lift" onClick={() => onOpenProfile?.(f.id)} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${f.isOnline ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                {/* Remove button — top right, visible on hover */}
                {confirmRemove === f.id ? (
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button onClick={() => removeFriend(f.id)} className="btn-interactive text-xs px-2 py-1 rounded font-semibold" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: 12 }}>Yes</button>
                    <button onClick={() => setConfirmRemove(null)} className="btn-interactive text-xs px-2 py-1 rounded text-w30" style={{ fontSize: 12 }}>No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmRemove(f.id)} className="btn-interactive absolute top-1.5 right-1.5 text-xs px-1.5 py-1 rounded text-w15 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove friend">✕</button>
                )}
                <div className="relative mb-1.5">
                  <PlayerBadge name={f.name} avatar={f.avatar} color={f.color} size={36} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0b0d11]" style={{ background: ONLINE_COLORS[f.onlineStatus || (f.isOnline ? "online" : "offline")] }} />
                </div>
                <span className="text-xs font-semibold truncate w-full" style={{ color: "#e8e8e8" }}>{f.name}</span>
                <span className="text-xs text-w25">Lv.{f.level}</span>
                <OnlineDot status={f.onlineStatus || (f.isOnline ? "online" : "offline")} lastActiveAt={f.lastActiveAt} />
                {/* Challenge button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    (async () => {
                      try {
                        const r = await fetch("/api/social/challenge", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
                          body: JSON.stringify({ targetId: f.id, type: "quests_week", wager: 100 }),
                        });
                        const d = await r.json();
                        if (r.ok) setSuccessMsg("Challenge sent to " + f.name);
                        else setSuccessMsg(d.error || "Failed");
                        setTimeout(() => setSuccessMsg(null), 4000);
                      } catch { setSuccessMsg("Network error"); }
                    })();
                  }}
                  className="text-xs px-2 py-0.5 rounded mt-1"
                  style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)", cursor: "pointer", fontSize: 12 }}
                  title="Challenge this friend — who completes more quests this week? 100g wager"
                >
                  Challenge
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Messages Tab ───────────────────────────────────────────────────────────

function MessagesTab({ apiKey, playerName, autoOpenWith, onAutoOpened }: { apiKey: string; playerName: string; autoOpenWith?: string | null; onAutoOpened?: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [sendError, setSendError] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [friendsList, setFriendsList] = useState<{ id: string; name: string; avatar: string; color: string }[]>([]);

  const fetchConversations = useCallback(async () => {
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/conversations`, { headers: getAuthHeaders(apiKey) });
      if (r.ok) setConversations((await r.json()).conversations || []);
    } catch (e) { console.error('[social]', e); }
    setLoading(false);
  }, [apiKey, playerName]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Auto-open conversation when navigated from profile "Message" button
  useEffect(() => {
    if (autoOpenWith && !loading) {
      openConvo(autoOpenWith);
      onAutoOpened?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenWith, loading]);

  const openConvo = async (otherPlayerId: string) => {
    setActiveConvo(otherPlayerId);
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/messages/${encodeURIComponent(otherPlayerId)}`, { headers: getAuthHeaders(apiKey) });
      if (r.ok) setMessages((await r.json()).messages || []);
    } catch (e) { console.error('[social]', e); }
  };

  // Auto-refresh messages every 10s when a conversation is active
  useEffect(() => {
    if (!activeConvo) return;
    const interval = setInterval(() => { openConvo(activeConvo); }, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvo, apiKey, playerName]);

  // Only auto-scroll to bottom if user is already near the bottom (not reading old messages)
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); return; }
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    if (isNearBottom) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeConvo || sendingMsg) return;
    setSendingMsg(true);
    try {
      const r = await fetch("/api/social/message", {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ to: activeConvo, text: msgInput.trim() }),
      });
      if (r.ok) {
        setMsgInput("");
        openConvo(activeConvo);
        fetchConversations();
      } else {
        const data = await r.json().catch(() => null);
        setSendError(data?.error || "Failed to send message");
      }
    } catch (e) { console.error('[social]', e); }
    setSendingMsg(false);
  };

  if (loading) return (
    <div className="space-y-2 tab-content-enter">
      {[1,2,3].map(i => <div key={i} className="skeleton-card flex items-center gap-3"><div className="skeleton w-8 h-8 rounded-full flex-shrink-0" /><div className="flex-1 space-y-1.5"><div className="skeleton skeleton-text w-24" /><div className="skeleton skeleton-text w-40" /></div></div>)}
    </div>
  );

  if (activeConvo) {
    const convo = conversations.find(c => c.playerId === activeConvo);
    return (
      <div className="space-y-3">
        <button onClick={() => setActiveConvo(null)} className="btn-interactive text-xs text-w30 hover:text-w60">← Back to conversations</button>
        <div className="flex items-center gap-2 mb-2">
          {convo && <PlayerBadge name={convo.playerName} avatar={convo.playerAvatar} color={convo.playerColor} />}
          <span className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>{convo?.playerName || activeConvo}</span>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-rpg" style={{ scrollbarWidth: "thin" }}>
          {messages.map(msg => {
            const isMine = msg.from.toLowerCase() === playerName.toLowerCase();
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className="rounded-xl px-3 py-2 max-w-[75%]"
                  style={{
                    background: isMine ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isMine ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <p className="text-xs" style={{ color: "#e8e8e8" }}>{msg.text}</p>
                  <p className="text-xs text-w15 mt-0.5 text-right" title={new Date(msg.createdAt).toLocaleString("de-DE")}>
                    {timeAgo(msg.createdAt)}
                    {isMine && <ReadCheck read={msg.read} />}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={msgInput}
            onChange={e => { setMsgInput(e.target.value); if (sendError) setSendError(""); }}
            onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
            placeholder="Type a message..."
            maxLength={500}
            className="input-dark flex-1 text-xs px-3 py-2 rounded-lg"
          />
          <button
            onClick={sendMessage}
            disabled={!msgInput.trim() || sendingMsg}
            title={sendingMsg ? "Sending..." : !msgInput.trim() ? "Type a message first" : undefined}
            className="btn-interactive text-xs font-semibold px-4 py-2 rounded-lg"
            style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)", opacity: (msgInput.trim() && !sendingMsg) ? 1 : 0.4, cursor: (msgInput.trim() && !sendingMsg) ? "pointer" : "not-allowed" }}
          >
            Send
          </button>
        </div>
        {sendError && <p className="text-xs mt-1" style={{ color: "#f87171" }}>{sendError}</p>}
      </div>
    );
  }

  const startNewConvo = async () => {
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/friends`, { headers: getAuthHeaders(apiKey) });
      if (r.ok) {
        const data = await r.json();
        const existing = new Set(conversations.map(c => c.playerId));
        setFriendsList((data.friends || []).filter((f: { id: string }) => !existing.has(f.id)));
      }
    } catch (e) { console.error('[social]', e); }
    setShowNewMsg(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-w35">Messages</p>
        <button
          onClick={startNewConvo}
          className="btn-interactive text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)" }}
        >
          + New Message
        </button>
      </div>
      {showNewMsg && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.15)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: "#a855f7" }}>Start conversation with:</p>
            <button onClick={() => setShowNewMsg(false)} className="text-xs text-w30 btn-interactive px-1">✕</button>
          </div>
          {friendsList.length === 0 ? (
            <p className="text-xs text-w20 py-2">No friends available to message.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {friendsList.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setShowNewMsg(false); openConvo(f.id); }}
                  className="btn-interactive flex items-center gap-2 rounded-lg px-2.5 py-2 text-left"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <PlayerBadge name={f.name} avatar={f.avatar} color={f.color} size={24} />
                  <span className="text-xs font-semibold truncate" style={{ color: "#e8e8e8" }}>{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {conversations.length === 0 && !showNewMsg ? (
        <p className="text-xs text-w20 text-center py-8">No conversations yet. Add friends and start chatting!</p>
      ) : (
        conversations.map(c => (
          <button
            key={c.playerId}
            onClick={() => openConvo(c.playerId)}
            className="btn-interactive w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-all"
            style={{ background: c.unreadCount > 0 ? "rgba(168,85,247,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${c.unreadCount > 0 ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.05)"}` }}
          >
            <PlayerBadge name={c.playerName} avatar={c.playerAvatar} color={c.playerColor} size={32} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "#e8e8e8" }}>{c.playerName}</span>
                <span className="text-xs text-w20">{timeAgo(c.lastMessageAt)}</span>
              </div>
              <p className="text-xs text-w30 truncate mt-0.5">{c.lastMessage}</p>
            </div>
            {c.unreadCount > 0 && (
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#a855f7", color: "#fff", fontSize: 12 }}>
                {c.unreadCount}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
}

// ─── Trade Item Display ─────────────────────────────────────────────────────

function TradeOfferDisplay({ offer, label, color, onItemClick }: { offer: TradeOffer; label: string; color: string; onItemClick?: (item: TradeOffer["items"][number]) => void }) {
  return (
    <div className="rounded-lg p-3" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color }}>{label}</p>
      {offer.gold > 0 && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Tip k="gold">
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", cursor: "help" }}>
              {offer.gold} Gold
            </span>
          </Tip>
        </div>
      )}
      {offer.items.length > 0 ? (
        <div className="space-y-1">
          {offer.items.map(item => {
            const rc = RARITY_COLORS[item.rarity] || "#888";
            return (
              <TipCustom
                key={item.instanceId}
                title={item.name}
                accent={rc}
                hoverDelay={300}
                body={<>
                  <p className="text-xs capitalize" style={{ color: rc }}>{item.rarity}{item.slot ? ` \u00b7 ${item.slot}` : ""}</p>
                  {item.bound ? (
                    <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>Soulbound</p>
                  ) : item.binding === "boe" ? (
                    <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>Bind on Equip</p>
                  ) : null}
                  {item.legendaryEffect && <p className="text-xs mt-1 font-semibold" style={{ color: "#f59e0b" }}>{formatLegendaryLabel(item.legendaryEffect)}</p>}
                  {item.stats && Object.keys(item.stats).length > 0 && (
                    <div className="mt-1 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 4 }}>
                      {Object.entries(item.stats).map(([stat, val]) => (
                        <div key={stat} className="flex items-center justify-between text-xs">
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>{stat}</span>
                          <span className="font-mono" style={{ color: "#4ade80" }}>+{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.setName && <p className="text-xs mt-1" style={{ color: "#22c55e" }}>Set: {item.setName}</p>}
                </>}
              >
                <button onClick={() => onItemClick?.(item)} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded w-full text-left" style={{ background: "rgba(255,255,255,0.03)", borderLeft: `2px solid ${rc}`, cursor: "pointer" }}>
                  {item.icon && <img src={item.icon} alt="" width={20} height={20} style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                  <span className="font-semibold truncate" style={{ color: rc }}>{item.name}</span>
                  <span className="text-w20 capitalize ml-auto flex-shrink-0">{item.rarity}</span>
                </button>
              </TipCustom>
            );
          })}
        </div>
      ) : offer.gold === 0 ? (
        <p className="text-xs text-w15 italic">Nothing offered</p>
      ) : null}
    </div>
  );
}

// ─── Trades Tab ─────────────────────────────────────────────────────────────

// ─── Trade Item Grid (inventory-style) ────────────────────────────────────────

function TradeItemGrid({ items, selectedIds, onToggle, sortKey, onSortChange }: {
  items: { id: string; name: string; rarity: string; slot?: string; icon?: string; emoji?: string; stats?: Record<string, number>; desc?: string; flavorText?: string; legendaryEffect?: { type: string; label?: string; value?: number } | null; setId?: string; binding?: "boe" | "bop" | null; bound?: boolean }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  sortKey?: TradeSortKey;
  onSortChange?: (key: TradeSortKey) => void;
}) {
  const sorted = [...items].sort((a, b) => {
    if (sortKey === "rarity") return (RARITY_SORT[a.rarity] ?? 5) - (RARITY_SORT[b.rarity] ?? 5);
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "slot") return (SLOT_SORT[a.slot ?? ""] ?? 99) - (SLOT_SORT[b.slot ?? ""] ?? 99);
    return 0;
  });
  return (
    <div>
      {/* Sort controls */}
      {onSortChange && (
        <div className="flex gap-1 mb-1.5">
          {(["rarity", "name", "slot"] as TradeSortKey[]).map(k => (
            <button
              key={k}
              onClick={() => onSortChange(k)}
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: sortKey === k ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                color: sortKey === k ? "#a855f7" : "rgba(255,255,255,0.3)",
                border: `1px solid ${sortKey === k ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer",
              }}
            >
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-lg p-2 max-h-[240px] overflow-y-auto" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", scrollbarWidth: "thin" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 52px)", gap: 3 }}>
          {sorted.map(item => {
            const selected = selectedIds.includes(item.id);
            const rc = RARITY_COLORS[item.rarity] || "#888";
            return (
              <TipCustom
                key={item.id}
                title={item.name}
                accent={rc}
                hoverDelay={300}
                body={<>
                  <p className="text-xs capitalize" style={{ color: rc }}>{item.rarity}{item.slot ? ` \u00b7 ${item.slot}` : ""}</p>
                  {item.bound ? (
                    <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>Soulbound — cannot be traded</p>
                  ) : item.binding === "boe" ? (
                    <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>Bind on Equip</p>
                  ) : item.binding === "bop" ? (
                    <p className="text-xs font-semibold" style={{ color: "#f97316" }}>Bind on Pickup — cannot be traded</p>
                  ) : null}
                  {item.desc && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{item.desc}</p>}
                  {item.flavorText && <p className="text-xs italic mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>&ldquo;{item.flavorText}&rdquo;</p>}
                  {item.legendaryEffect && <p className="text-xs mt-1 font-semibold" style={{ color: "#f59e0b" }}>{formatLegendaryLabel(item.legendaryEffect)}</p>}
                  {item.stats && Object.entries(item.stats).filter(([, v]) => v > 0).length > 0 && (
                    <div className="mt-1 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 4 }}>
                      {Object.entries(item.stats).filter(([, v]) => v > 0).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-xs">
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>{k}</span>
                          <span className="font-mono" style={{ color: "#4ade80" }}>+{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.setId && <p className="text-xs mt-1" style={{ color: "#22c55e" }}>Set: {item.setId}</p>}
                </>}
              >
                <button
                  onClick={() => { if (!item.bound && item.binding !== 'bop') onToggle(item.id); }}
                  className="relative flex items-center justify-center rounded-lg transition-all"
                  title={(item.bound || item.binding === 'bop') ? "Soulbound — cannot be traded" : undefined}
                  style={{
                    width: 52, height: 52,
                    background: selected ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
                    border: `2px solid ${selected ? "#a855f7" : `${rc}30`}`,
                    cursor: (item.bound || item.binding === 'bop') ? "not-allowed" : "pointer",
                    opacity: (item.bound || item.binding === 'bop') ? 0.35 : 1,
                  }}
                >
                  {item.icon ? (
                    <img src={item.icon} alt={item.name} width={36} height={36} style={{ imageRendering: "auto", objectFit: "contain" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                  ) : (
                    <span className="text-2xl" style={{ color: rc }}>{"\u25C6"}</span>
                  )}
                  {/* Rarity dot */}
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: rc }} />
                  {/* Selection checkmark */}
                  {selected && (
                    <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#a855f7", fontSize: 12, color: "#fff", lineHeight: 1 }}>{"\u2713"}</span>
                  )}
                </button>
              </TipCustom>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TradesTab({ apiKey, playerName, onRewardCelebration }: { apiKey: string; playerName: string; onRewardCelebration?: (data: RewardCelebrationData) => void }) {
  const { users, loggedInUser } = useDashboard();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tooltipItem, setTooltipItem] = useState<{ name: string; rarity?: string; icon?: string | null; slot?: string | null; stats?: Record<string, number> | null; legendaryEffect?: { type: string; label?: string; value?: number } | null; desc?: string | null; binding?: string | null; bound?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New trade form
  const [showNewTrade, setShowNewTrade] = useState(false);
  const [newTradeTarget, setNewTradeTarget] = useState("");
  const [newTradeGold, setNewTradeGold] = useState(0);
  const [newTradeMsg, setNewTradeMsg] = useState("");
  const [newTradeItems, setNewTradeItems] = useState<string[]>([]);
  const [newTradeMaterials, setNewTradeMaterials] = useState<Record<string, number>>({});

  // Counter-offer form
  const [counterGold, setCounterGold] = useState(0);
  const [counterMsg, setCounterMsg] = useState("");
  const [counterItems, setCounterItems] = useState<string[]>([]);
  const [counterMaterials, setCounterMaterials] = useState<Record<string, number>>({});

  // Item sort
  const [tradeSort, setTradeSort] = useState<TradeSortKey>("rarity");

  // Get unequipped inventory items for trade
  const tradeableItems = (loggedInUser?.inventory || []).filter(item => {
    // Exclude equipped items
    if (loggedInUser?.equipment) {
      const eq = loggedInUser.equipment;
      for (const slot of Object.keys(eq)) {
        const eqItem = eq[slot as keyof typeof eq];
        if (typeof eqItem === "object" && eqItem && ("instanceId" in eqItem ? eqItem.instanceId === item.id : (eqItem as { id?: string }).id === item.id)) return false;
        if (typeof eqItem === "string" && eqItem === item.id) return false;
      }
    }
    // Exclude soulbound items (BoP or bound BoE)
    const ext = item as unknown as Record<string, unknown>;
    if (ext.bound || ext.binding === "bop") return false;
    // Exclude locked items
    if (ext.locked) return false;
    return true;
  });

  const toggleTradeItem = (itemId: string, target: "new" | "counter") => {
    const setter = target === "new" ? setNewTradeItems : setCounterItems;
    setter(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };

  const fetchTrades = useCallback(async () => {
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/trades`, { headers: getAuthHeaders(apiKey) });
      if (r.ok) setTrades((await r.json()).trades || []);
    } catch (e) { console.error('[social]', e); }
    setLoading(false);
  }, [apiKey, playerName]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const proposeTrade = async () => {
    if (!newTradeTarget.trim()) return;
    setError(null);

    // FI-052: Validate selected items still exist in inventory before sending
    if (newTradeItems.length > 0) {
      const inventoryIds = new Set((loggedInUser?.inventory || []).map(item => item.id));
      const missingItems = newTradeItems.filter(id => !inventoryIds.has(id));
      if (missingItems.length > 0) {
        setError(`${missingItems.length === 1 ? "An item" : `${missingItems.length} items`} you selected no longer exist${missingItems.length === 1 ? "s" : ""} in your inventory. Please refresh and try again.`);
        return;
      }
    }

    setActionLoading(true);
    try {
      const r = await fetch("/api/social/trade/propose", {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({
          to: newTradeTarget.trim(),
          offer: { gold: newTradeGold, items: newTradeItems, materials: Object.keys(newTradeMaterials).length > 0 ? newTradeMaterials : undefined },
          message: newTradeMsg.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Something went wrong. Please try again."); setActionLoading(false); return; }
      setShowNewTrade(false);
      setNewTradeTarget("");
      setNewTradeGold(0);
      setNewTradeMsg("");
      setNewTradeItems([]);
      fetchTrades();
    } catch { setError("Network error"); }
    setActionLoading(false);
  };

  const handleTradeAction = async (tradeId: string, action: "accept" | "decline") => {
    setActionLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/social/trade/${tradeId}/${action}`, {
        method: "POST",
        headers: getAuthHeaders(apiKey),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Something went wrong. Please try again."); setActionLoading(false); return; }
      if (action === "accept" && d.executed && onRewardCelebration) {
        onRewardCelebration({
          type: "daily-bonus" as const,
          title: "Trade Complete",
          xpEarned: 0,
          goldEarned: d.trade?.recipientOffer?.gold || d.trade?.initiatorOffer?.gold || 0,
          loot: d.summary ? { name: d.summary, emoji: "", rarity: "rare" } : null,
        });
      }
      fetchTrades();
      setSelectedTrade(null);
    } catch { setError("Network error"); }
    setActionLoading(false);
  };

  const sendCounter = async (tradeId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/social/trade/${tradeId}/counter`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({
          offer: { gold: counterGold, items: counterItems, materials: Object.keys(counterMaterials).length > 0 ? counterMaterials : undefined },
          message: counterMsg.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Something went wrong. Please try again."); setActionLoading(false); return; }
      setCounterGold(0);
      setCounterMsg("");
      setCounterItems([]);
      fetchTrades();
      setSelectedTrade(null);
    } catch { setError("Network error"); }
    setActionLoading(false);
  };

  if (loading) return (
    <div className="space-y-2 tab-content-enter">
      <div className="skeleton-card"><div className="skeleton skeleton-text w-32 mb-2" /><div className="skeleton skeleton-text w-48" /></div>
      <div className="skeleton-card"><div className="skeleton skeleton-text w-28 mb-2" /><div className="skeleton skeleton-text w-44" /></div>
    </div>
  );

  // Trade detail view
  if (selectedTrade) {
    const t = selectedTrade;
    const isMyTurn = t.pendingFor?.toLowerCase() === playerName.toLowerCase();
    const amInitiator = t.initiator.toLowerCase() === playerName.toLowerCase();
    const otherName = amInitiator ? t.recipientName : t.initiatorName;
    const otherColor = amInitiator ? t.recipientColor : t.initiatorColor;

    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedTrade(null)} className="btn-interactive text-xs text-w30 hover:text-w60">← Back to trades</button>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: "#e8e8e8" }}>Trade with {otherName}</p>
            <p className="text-xs text-w20">{timeAgo(t.createdAt)} · {t.rounds.length} round{t.rounds.length !== 1 ? "s" : ""}</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{
            background: t.status === "completed" ? "rgba(34,197,94,0.12)" : t.status === "declined" ? "rgba(239,68,68,0.12)" : "rgba(251,191,36,0.12)",
            color: t.status === "completed" ? "#22c55e" : t.status === "declined" ? "#ef4444" : "#fbbf24",
          }}>
            {t.status === "pending" ? (isMyTurn ? "Your turn" : "Waiting...") : t.status}
          </span>
        </div>

        {/* Current offers side by side */}
        <div className="grid grid-cols-2 gap-3">
          <TradeOfferDisplay
            offer={t.currentInitiatorOffer}
            label={amInitiator ? "Your offer" : `${t.initiatorName}'s offer`}
            color={amInitiator ? "#a855f7" : otherColor}
            onItemClick={item => setTooltipItem({ name: item.name, rarity: item.rarity, icon: item.icon, slot: item.slot, stats: item.stats, legendaryEffect: item.legendaryEffect, binding: item.binding, bound: item.bound })}
          />
          <TradeOfferDisplay
            offer={t.currentRecipientOffer}
            label={amInitiator ? `${t.recipientName}'s offer` : "Your offer"}
            color={amInitiator ? otherColor : "#a855f7"}
            onItemClick={item => setTooltipItem({ name: item.name, rarity: item.rarity, icon: item.icon, slot: item.slot, stats: item.stats, legendaryEffect: item.legendaryEffect, binding: item.binding, bound: item.bound })}
          />
        </div>

        {/* Actions — counter-offer first, then accept/decline at the bottom */}
        {t.status === "pending" && isMyTurn && (
          <div className="space-y-3 pt-2">
            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

            {/* Counter-offer (shown first so player can adjust before deciding) */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-w35 mb-3">Counter-Offer</p>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <Tip k="gold"><label className="text-xs text-w25 block mb-1" style={{ cursor: "help" }}>Your gold offer</label></Tip>
                  <input
                    type="number"
                    min={0}
                    value={counterGold}
                    onChange={e => setCounterGold(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="input-dark w-full text-xs px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
              {/* Counter-offer item picker — inventory grid */}
              {tradeableItems.length > 0 && (
                <div className="mb-3">
                  <label className="text-xs text-w25 block mb-1">Items to offer ({counterItems.length} selected)</label>
                  <TradeItemGrid items={tradeableItems} selectedIds={counterItems} onToggle={id => toggleTradeItem(id, "counter")} sortKey={tradeSort} onSortChange={setTradeSort} />
                </div>
              )}
              {/* Counter-offer materials */}
              {(() => {
                const mats = loggedInUser?.craftingMaterials || {};
                const matEntries = Object.entries(mats).filter(([, count]) => (count as number) > 0);
                if (matEntries.length === 0) return null;
                return (
                  <div className="mb-2">
                    <label className="text-xs text-w25 block mb-1">Materials</label>
                    <div className="flex flex-wrap gap-1">
                      {matEntries.slice(0, 12).map(([id, count]) => {
                        const offered = counterMaterials[id] || 0;
                        return (
                          <button key={id} onClick={() => setCounterMaterials(prev => {
                            const next = { ...prev };
                            if (!next[id]) next[id] = 1;
                            else if (next[id] >= (count as number)) delete next[id];
                            else next[id]++;
                            return next;
                          })} className="text-xs px-1.5 py-0.5 rounded" style={{
                            background: offered > 0 ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.04)",
                            color: offered > 0 ? "#fbbf24" : "rgba(255,255,255,0.35)",
                            border: `1px solid ${offered > 0 ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
                            cursor: "pointer",
                          }} title={`${count} available`}>
                            {id.replace(/-/g, " ")} {offered > 0 ? `×${offered}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <label className="text-xs text-w25 block mb-1">Message</label>
              <input
                value={counterMsg}
                onChange={e => setCounterMsg(e.target.value)}
                placeholder="Your counter-offer message..."
                maxLength={300}
                className="input-dark w-full text-xs px-3 py-2 rounded-lg mb-3"
              />
              <button
                onClick={() => sendCounter(t.id)}
                disabled={actionLoading}
                className="btn-interactive w-full text-xs font-bold py-2 rounded-lg"
                style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", opacity: actionLoading ? 0.5 : 1, cursor: actionLoading ? "not-allowed" : "pointer" }}
                title={actionLoading ? "Processing..." : undefined}
              >
                Send Counter-Offer
              </button>
            </div>

            {/* Accept / Decline — at the bottom after reviewing offers + items */}
            <div className="flex gap-2">
              <button
                onClick={() => handleTradeAction(t.id, "accept")}
                disabled={actionLoading}
                className="btn-interactive flex-1 text-xs font-bold py-2.5 rounded-lg"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#000", opacity: actionLoading ? 0.5 : 1, cursor: actionLoading ? "not-allowed" : "pointer" }}
                title={actionLoading ? "Processing..." : undefined}
              >
                Accept Trade
              </button>
              <button
                onClick={() => handleTradeAction(t.id, "decline")}
                disabled={actionLoading}
                className="btn-interactive text-xs font-semibold py-2.5 px-4 rounded-lg"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", opacity: actionLoading ? 0.5 : 1, cursor: actionLoading ? "not-allowed" : "pointer" }}
                title={actionLoading ? "Processing..." : undefined}
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {t.status === "pending" && !isMyTurn && (
          <div className="text-center py-3">
            <p className="text-xs text-w30">Waiting for {otherName} to respond...</p>
            <button
              onClick={() => handleTradeAction(t.id, "decline")}
              disabled={actionLoading}
              className="btn-interactive mt-2 text-xs px-4 py-1.5 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.5 : 1 }}
              title={actionLoading ? "Processing..." : undefined}
            >
              Cancel Trade
            </button>
          </div>
        )}

        {/* Negotiation history — below actions */}
        {t.rounds.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-w35 mb-2">Negotiation History</p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {t.rounds.map((round, i) => {
                const isMe = round.by.toLowerCase() === playerName.toLowerCase();
                return (
                  <div key={i} className="rounded-lg px-3 py-2" style={{ background: isMe ? "rgba(168,85,247,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${isMe ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.04)"}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: isMe ? "#a855f7" : "#e8e8e8" }}>{round.byName}</span>
                      <span className="text-xs text-w15">{timeAgo(round.at)}</span>
                    </div>
                    {round.message && <p className="text-xs text-w40 italic">&ldquo;{round.message}&rdquo;</p>}
                    <div className="flex gap-3 mt-1 text-xs text-w20 flex-wrap">
                      {round.initiatorOffer.gold > 0 && <span>{t.initiatorName}: {round.initiatorOffer.gold}g</span>}
                      {round.recipientOffer.gold > 0 && <span>{t.recipientName}: {round.recipientOffer.gold}g</span>}
                      {round.initiatorOffer.items.length > 0 && (() => {
                        const names = round.initiatorOffer.items.map(it => it.name);
                        const preview = names.slice(0, 2).join(", ");
                        const overflow = names.length - 2;
                        return <span>{preview}{overflow > 0 ? ` +${overflow} more` : ""}</span>;
                      })()}
                      {round.recipientOffer.items.length > 0 && (() => {
                        const names = round.recipientOffer.items.map(it => it.name);
                        const preview = names.slice(0, 2).join(", ");
                        const overflow = names.length - 2;
                        return <span>{preview}{overflow > 0 ? ` +${overflow} more` : ""}</span>;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New trade button */}
      {!showNewTrade ? (
        <button
          onClick={() => setShowNewTrade(true)}
          className="btn-interactive w-full text-xs font-semibold py-2.5 rounded-lg"
          style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)" }}
        >
          + Propose a Trade
        </button>
      ) : (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.15)" }}>
          <TipCustom title="Handelsangebot" icon="◈" accent="#a855f7" body={<p>Biete Gold und Gegenst&auml;nde an. Der Handelspartner kann annehmen, ablehnen oder ein Gegenangebot machen.</p>}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a855f7", cursor: "help" }}>New Trade Proposal</p>
          </TipCustom>
          <input
            value={newTradeTarget}
            onChange={e => setNewTradeTarget(e.target.value)}
            placeholder="Trade with player..."
            className="input-dark w-full text-xs px-3 py-2 rounded-lg"
          />
          <div>
            <Tip k="gold"><label className="text-xs text-w25 block mb-1" style={{ cursor: "help" }}>Gold to offer</label></Tip>
            <input
              type="number"
              min={0}
              value={newTradeGold}
              onChange={e => setNewTradeGold(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="input-dark w-full text-xs px-3 py-2 rounded-lg"
            />
          </div>
          {/* Item picker — inventory grid */}
          {tradeableItems.length > 0 && (
            <div>
              <label className="text-xs text-w25 block mb-1">Items to offer ({newTradeItems.length} selected)</label>
              <TradeItemGrid items={tradeableItems} selectedIds={newTradeItems} onToggle={id => toggleTradeItem(id, "new")} sortKey={tradeSort} onSortChange={setTradeSort} />
            </div>
          )}
          <div>
            <label className="text-xs text-w25 block mb-1">Message</label>
            <input
              value={newTradeMsg}
              onChange={e => setNewTradeMsg(e.target.value)}
              placeholder="e.g., 200 gold for your epic sword..."
              maxLength={300}
              className="input-dark w-full text-xs px-3 py-2 rounded-lg"
            />
          </div>
          {/* Materials offer */}
          {(() => {
            const mats = loggedInUser?.craftingMaterials || {};
            const matEntries = Object.entries(mats).filter(([, count]) => (count as number) > 0);
            if (matEntries.length === 0) return null;
            return (
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Materials</p>
                <div className="flex flex-wrap gap-1">
                  {matEntries.slice(0, 12).map(([id, count]) => {
                    const offered = newTradeMaterials[id] || 0;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setNewTradeMaterials(prev => {
                            const next = { ...prev };
                            if (!next[id]) next[id] = 1;
                            else if (next[id] >= (count as number)) delete next[id];
                            else next[id]++;
                            return next;
                          });
                        }}
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: offered > 0 ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                          color: offered > 0 ? "#a78bfa" : "rgba(255,255,255,0.4)",
                          border: `1px solid ${offered > 0 ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`,
                          cursor: "pointer",
                        }}
                        title={`Click to add/increase. ${count} available.`}
                      >
                        {id.replace(/-/g, " ")} {offered > 0 ? `×${offered}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={proposeTrade}
              disabled={actionLoading || !newTradeTarget.trim()}
              className="btn-interactive flex-1 text-xs font-bold py-2 rounded-lg"
              style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", opacity: actionLoading || !newTradeTarget.trim() ? 0.5 : 1, cursor: actionLoading || !newTradeTarget.trim() ? "not-allowed" : "pointer" }}
              title={!newTradeTarget.trim() ? "Select a trade partner first" : actionLoading ? "Processing..." : undefined}
            >
              Send Proposal
            </button>
            <button onClick={() => { setShowNewTrade(false); setError(null); setNewTradeItems([]); setNewTradeMaterials({}); }} className="btn-interactive text-xs px-4 py-2 rounded-lg text-w30">Cancel</button>
          </div>
        </div>
      )}

      {/* Active trades */}
      {trades.filter(t => t.status === "pending").length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w35 mb-2">Active Trades</p>
          <div className="space-y-2">
            {trades.filter(t => t.status === "pending").map(t => {
              const amInitiator = t.initiator.toLowerCase() === playerName.toLowerCase();
              const otherName = amInitiator ? t.recipientName : t.initiatorName;
              const otherColor = amInitiator ? t.recipientColor : t.initiatorColor;
              const otherAvatar = amInitiator ? t.recipientAvatar : t.initiatorAvatar;
              const isMyTurn = t.pendingFor?.toLowerCase() === playerName.toLowerCase();

              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTrade(t)}
                  className="btn-interactive w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left"
                  style={{
                    background: isMyTurn ? "rgba(251,191,36,0.04)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isMyTurn ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)"}`,
                  }}
                >
                  <PlayerBadge name={otherName} avatar={otherAvatar} color={otherColor} size={28} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold" style={{ color: "#e8e8e8" }}>{otherName}</span>
                    <p className="text-xs text-w25 truncate mt-0.5">
                      {t.rounds.length > 0 ? t.rounds[t.rounds.length - 1].message || "No message" : "Trade proposed"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-semibold" style={{ color: isMyTurn ? "#fbbf24" : "#555" }}>
                      {isMyTurn ? "Your turn" : "Waiting"}
                    </span>
                    <p className="text-xs text-w15">{t.rounds.length} rounds</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Past trades */}
      {trades.filter(t => t.status !== "pending").length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w35 mb-2">Trade History</p>
          <div className="space-y-1.5">
            {trades.filter(t => t.status !== "pending").map(t => {
              const amInitiator = t.initiator.toLowerCase() === playerName.toLowerCase();
              const otherName = amInitiator ? t.recipientName : t.initiatorName;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTrade(t)}
                  className="btn-interactive w-full flex items-center justify-between rounded-lg px-3 py-2 text-left"
                  style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <span className="text-xs text-w40">{otherName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: t.status === "completed" ? "#22c55e" : "#ef4444" }}>
                      {t.status}
                    </span>
                    <span className="text-xs text-w15">{timeAgo(t.completedAt || t.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {trades.length === 0 && !showNewTrade && (
        <p className="text-xs text-w20 text-center py-8">No trades yet. Propose a trade to get started!</p>
      )}
      {tooltipItem && <ItemTooltip item={tooltipItem} onClose={() => setTooltipItem(null)} />}
    </div>
  );
}

// ─── Activity Feed Tab ───────────────────────────────────────────────────────

// Navigation targets for activity feed events
const EVENT_NAV: Record<string, { view: string; tooltip: string }> = {
  quest_complete: { view: "questBoard", tooltip: "View Quest Board" },
  level_up: { view: "character", tooltip: "View Character" },
  achievement: { view: "honors", tooltip: "View Honors" },
  gacha_pull: { view: "gacha", tooltip: "View Vault of Fate" },
  rare_drop: { view: "character", tooltip: "View Character" },
  world_boss_spawn: { view: "worldBoss", tooltip: "View World Boss" },
  world_boss_defeat: { view: "worldBoss", tooltip: "View World Boss" },
  dungeon_complete: { view: "dungeons", tooltip: "View Dungeons" },
  rift_complete: { view: "rift", tooltip: "View The Rift" },
  streak_milestone: { view: "rituals", tooltip: "View Rituals" },
  sworn_bond_formed: { view: "social", tooltip: "View Sworn Bond" },
  sworn_bond_chest: { view: "social", tooltip: "View Sworn Bond" },
};

function ActivityFeedTab({ apiKey, playerName, onNavigate, onNavigateToAchievement }: { apiKey: string; playerName: string; onNavigate?: (view: string) => void; onNavigateToAchievement?: (achievementId: string) => void }) {
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [compactView, setCompactView] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/activity-feed?limit=30`, { headers: getAuthHeaders(apiKey) });
      if (r.ok) setFeed((await r.json()).feed || []);
    } catch (e) { console.error('[social]', e); }
    setLoading(false);
  }, [apiKey, playerName]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  if (loading) return (
    <div className="space-y-2 tab-content-enter">
      {[1,2,3,4].map(i => <div key={i} className="skeleton-card flex items-start gap-2.5"><div className="skeleton w-5 h-5 rounded flex-shrink-0" /><div className="flex-1 space-y-1"><div className="skeleton skeleton-text w-36" /><div className="skeleton skeleton-text w-20" /></div></div>)}
    </div>
  );

  if (feed.length === 0) {
    return <p className="text-xs text-w20 text-center py-8">No activity yet. Complete quests, pull gacha, and earn achievements to see them here!</p>;
  }

  return (
    <div className="space-y-2">
      {/* Compact / Detail toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setCompactView(v => !v)}
          className="btn-interactive text-xs px-2 py-1 rounded"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
          title={compactView ? "Switch to detailed view" : "Switch to compact view"}
        >
          {compactView ? "⊞ Detailed" : "⊟ Compact"}
        </button>
      </div>
      {feed.map(event => {
        const iconSrc = EVENT_ICON_SRCS[event.type];
        const icon = EVENT_ICONS[event.type] || "●";
        const isOwn = event.player === playerName.toLowerCase();
        const name = isOwn ? "You" : event.playerName;
        const d = event.data as Record<string, string>;
        const rarityColor = d.rarity ? (RARITY_COLORS[d.rarity] || "#e8e8e8") : "#e8e8e8";
        const nav = onNavigate ? EVENT_NAV[event.type] : undefined;

        // Build description as JSX with tooltips for items/achievements
        let descriptionNode: ReactNode;
        switch (event.type) {
          case "quest_complete":
            descriptionNode = <>completed <TipCustom title={d.quest || "Quest"} icon="▣" accent={rarityColor} body={<><p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{d.rarity || "common"} quest</p>{d.xp && <p className="text-xs" style={{ color: "#fbbf24" }}>+{d.xp} XP</p>}{d.gold && <p className="text-xs" style={{ color: "#f59e0b" }}>+{d.gold} Gold</p>}</>}><span className="gt-ref" style={{ color: rarityColor }}>{d.quest || "a quest"}</span></TipCustom></>;
            break;
          case "level_up":
            descriptionNode = <>reached <TipCustom title={`Level ${d.level ?? "?"}`} icon="▲" accent="#fbbf24" body={<p className="text-xs" style={{ color: "#fbbf24" }}>{d.title || ""}</p>}><span className="gt-ref" style={{ color: "#fbbf24" }}>Level {d.level ?? "?"}</span></TipCustom>{d.title ? <> — {d.title}</> : ""}</>;
            break;
          case "achievement":
            descriptionNode = <>unlocked <TipCustom title={d.name || "Achievement"} icon="◆" accent={rarityColor} body={<><p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{d.rarity || "common"} achievement</p>{d.points && <p className="text-xs" style={{ color: "#fbbf24" }}>+{d.points} AP</p>}</>}><span className="gt-ref" style={{ color: rarityColor }}>{d.name || "an achievement"}</span></TipCustom></>;
            break;
          case "gacha_pull":
            descriptionNode = <>pulled <TipCustom title={d.item || "Item"} icon="◇" accent={rarityColor} body={<><p className="text-xs" style={{ color: rarityColor }}>{d.rarity || "common"}</p>{d.banner && <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>from {d.banner}</p>}</>}><span className="gt-ref" style={{ color: rarityColor }}>{d.item || "an item"}</span></TipCustom></>;
            break;
          case "rare_drop":
            descriptionNode = <>found <TipCustom title={d.item || "Item"} icon="◇" accent={rarityColor} body={<p className="text-xs" style={{ color: rarityColor }}>{d.rarity || "rare"} drop</p>}><span className="gt-ref" style={{ color: rarityColor }}>{d.item || "an item"}</span></TipCustom></>;
            break;
          case "trade_complete":
            descriptionNode = <>completed a trade with <span className="text-w50">{d.partner || "someone"}</span></>;
            break;
          case "streak_milestone":
            descriptionNode = <>hit a <span className="font-semibold" style={{ color: "#f59e0b" }}>{d.days ?? "?"}-day</span> streak{d.label ? <> — <span className="text-w30">{d.label}</span></> : ""}</>;
            break;
          case "world_boss_spawn":
            descriptionNode = <><span className="font-semibold" style={{ color: "#ff4444" }}>{d.boss || "A World Boss"}</span> has appeared!</>;
            break;
          case "world_boss_defeat":
            descriptionNode = <>helped defeat <span className="font-semibold" style={{ color: "#ff4444" }}>{d.boss || "a World Boss"}</span>{d.contributors ? <> with <span className="text-w40">{d.contributors}</span> others</> : ""}</>;
            break;
          case "dungeon_complete":
            descriptionNode = <>{String(d.success) === "true" ? "conquered" : "survived"} <span className="font-semibold" style={{ color: rarityColor }}>{d.dungeon || "a dungeon"}</span>{d.tier ? <> <span className="text-w30">({d.tier})</span></> : ""}</>;
            break;
          case "rift_complete":
            descriptionNode = <>cleared <span className="font-semibold" style={{ color: rarityColor }}>{d.label || `${d.tier || "a"} Rift`}</span>{d.stages ? <> — <span className="text-w30">{d.stages} stages</span></> : ""}</>;
            break;
          case "expedition_complete":
            descriptionNode = <><span className="text-w40">{d.companion || "Companion"}</span> returned from <span className="font-semibold" style={{ color: "#22c55e" }}>{d.expedition || "an expedition"}</span></>;
            break;
          case "sworn_bond_formed":
            descriptionNode = <>forged a <span className="font-semibold" style={{ color: "#f59e0b" }}>Sworn Bond</span> with <span className="text-w50">{d.partner || "someone"}</span></>;
            break;
          case "sworn_bond_chest":
            descriptionNode = <>opened a <span className="font-semibold" style={{ color: "#f59e0b" }}>Bond Chest</span> with <span className="text-w50">{d.partner || "their partner"}</span>{d.streak ? <> — <span className="text-w30">{d.streak}w streak</span></> : ""}</>;
            break;
          default:
            descriptionNode = <>{(event.type as string).replace(/_/g, " ")}</>;
        }

        if (compactView) {
          return (
            <div key={event.id} className="cv-auto flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: d.rarity === "legendary" ? "rgba(255,140,0,0.04)" : "rgba(255,255,255,0.015)", borderLeft: `2px solid ${d.rarity ? (RARITY_COLORS[d.rarity] || "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.06)"}` }}>
              {iconSrc ? <img src={iconSrc} alt="" width={14} height={14} className="img-render-auto flex-shrink-0" onError={e => { e.currentTarget.style.display = "none"; const next = e.currentTarget.nextElementSibling as HTMLElement; if (next) next.style.display = "inline"; }} /> : null}
              <span style={{ fontSize: 12, display: iconSrc ? "none" : "inline" }}>{icon}</span>
              <span className="font-semibold truncate" style={{ color: isOwn ? "#a855f7" : (event.playerColor || "#e8e8e8") }}>{name}</span>
              <span className="text-w30 truncate flex-1">{descriptionNode}</span>
              <span className="text-w15 flex-shrink-0">{timeAgo(event.at)}</span>
              {nav && <button onClick={() => { if (event.type === "achievement" && d.achievementId && onNavigateToAchievement) { onNavigateToAchievement(d.achievementId as string); } else { onNavigate!(nav.view); } }} title={nav.tooltip} className="flex-shrink-0 cursor-pointer text-w15 hover:text-w40 transition-colors" style={{ fontSize: 12 }}>→</button>}
            </div>
          );
        }

        return (
          <div key={event.id} className={`cv-auto flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${d.rarity === "legendary" ? "feed-event-legendary" : d.rarity === "epic" ? "feed-event-epic" : ""}`} style={{ background: d.rarity === "legendary" ? "rgba(255,140,0,0.04)" : d.rarity === "epic" ? "rgba(168,85,247,0.03)" : "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {iconSrc ? <img src={iconSrc} alt="" width={18} height={18} className="img-render-auto flex-shrink-0 mt-0.5" onError={e => { e.currentTarget.style.display = "none"; const next = e.currentTarget.nextElementSibling as HTMLElement; if (next) next.style.display = "inline"; }} /> : null}
            <span className="text-sm flex-shrink-0 mt-0.5" style={{ display: iconSrc ? "none" : "inline" }}>{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs">
                <span className="font-semibold" style={{ color: isOwn ? "#a855f7" : (event.playerColor || "#e8e8e8") }}>{name}</span>
                {" "}
                <span className="text-w40">{descriptionNode}</span>
                {d.rarity && ["epic", "legendary"].includes(d.rarity) && (
                  <span className="ml-1 text-xs font-semibold uppercase" style={{ color: rarityColor }}>{d.rarity}</span>
                )}
              </p>
              <p className="text-xs text-w15 mt-0.5">{timeAgo(event.at)}</p>
            </div>
            {!isOwn && (
              <PlayerBadge name={event.playerName || "?"} avatar={event.playerAvatar} color={event.playerColor || "#a78bfa"} size={22} />
            )}
            {nav && <button onClick={() => { if (event.type === "achievement" && d.achievementId && onNavigateToAchievement) { onNavigateToAchievement(d.achievementId as string); } else { onNavigate!(nav.view); } }} title={nav.tooltip} className="flex-shrink-0 self-center cursor-pointer text-w15 hover:text-w40 transition-colors ml-1" style={{ fontSize: 13 }}>→</button>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Mail Tab ───────────────────────────────────────────────────────────────

interface MailItem {
  id: string;
  from: string;
  subject: string;
  body: string;
  gold: number;
  items: { id: string; name: string; rarity: string; icon?: string | null; slot?: string | null }[];
  sentAt: string;
  read: boolean;
  collected: boolean;
}

function MailTab({ apiKey, playerName, onRewardCelebration }: { apiKey: string; playerName: string; onRewardCelebration?: (data: RewardCelebrationData) => void }) {
  const { users } = useDashboard();
  const [inbox, setInbox] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null);
  const [composing, setComposing] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendGold, setSendGold] = useState(0);
  const [sending, setSending] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchMail = useCallback(async () => {
    try {
      const r = await fetch("/api/mail", { headers: getAuthHeaders(apiKey) });
      if (r.ok) {
        const data = await r.json();
        setInbox(data.inbox || []);
      }
    } catch (e) { console.error("[mail]", e); }
    setLoading(false);
  }, [apiKey]);

  useEffect(() => { fetchMail(); }, [fetchMail]);

  const handleCollect = async (mailId: string) => {
    try {
      const r = await fetch(`/api/mail/${mailId}/collect`, {
        method: "POST",
        headers: getAuthHeaders(apiKey),
      });
      const data = await r.json();
      if (r.ok && onRewardCelebration && (data.goldCollected > 0 || data.itemsCollected?.length > 0)) {
        const currencies: { name: string; amount: number; color: string }[] = [];
        if (data.goldCollected) currencies.push({ name: "Gold", amount: data.goldCollected, color: "#fbbf24" });
        onRewardCelebration({
          type: "daily-bonus",
          title: "Mail collected.",
          xpEarned: 0,
          goldEarned: data.goldCollected || 0,
          loot: data.itemsCollected?.length ? { name: `${data.itemsCollected.length} item${data.itemsCollected.length > 1 ? "s" : ""}`, emoji: "◆", rarity: "rare" } : undefined,
          currencies: currencies.length > 0 ? currencies : undefined,
        });
      }
      setActionMsg(data.message || data.error || "Done");
      setTimeout(() => setActionMsg(null), 4000);
      fetchMail();
    } catch { setActionMsg("Network error"); }
  };

  const handleDelete = async (mailId: string) => {
    try {
      await fetch(`/api/mail/${mailId}/delete`, {
        method: "POST",
        headers: getAuthHeaders(apiKey),
      });
      setSelectedMail(null);
      fetchMail();
    } catch { setActionMsg("Network error"); }
  };

  const handleSend = async () => {
    if (!sendTo || !sendSubject) return;
    setSending(true);
    try {
      const r = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
        body: JSON.stringify({ to: sendTo, subject: sendSubject, body: sendBody, gold: sendGold, items: [] }),
      });
      const data = await r.json();
      if (r.ok) {
        setActionMsg(data.message || "Sent.");
        setComposing(false);
        setSendTo(""); setSendSubject(""); setSendBody(""); setSendGold(0);
        fetchMail();
      } else {
        setActionMsg(data.error || "Error");
      }
      setTimeout(() => setActionMsg(null), 4000);
    } catch { setActionMsg("Network error"); }
    setSending(false);
  };

  const unread = inbox.filter(m => !m.read).length;
  const hasAttachments = inbox.filter(m => !m.collected && ((m.gold || 0) > 0 || m.items.length > 0)).length;

  return (
    <div className="space-y-3">
      {/* Header + Compose */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Mailbox</p>
          {unread > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>{unread}</span>}
          {hasAttachments > 0 && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>{hasAttachments} uncollected</span>}
        </div>
        <div className="flex items-center gap-2">
          {hasAttachments > 0 && (
            <button
              onClick={async () => {
                try {
                  const r = await fetch("/api/mail/collect-all", { method: "POST", headers: getAuthHeaders(apiKey) });
                  const data = await r.json();
                  if (r.ok && onRewardCelebration && (data.goldCollected > 0 || data.itemsCollected > 0)) {
                    const currencies: { name: string; amount: number; color: string }[] = [];
                    if (data.goldCollected) currencies.push({ name: "Gold", amount: data.goldCollected, color: "#fbbf24" });
                    onRewardCelebration({
                      type: "daily-bonus",
                      title: `${data.mailsCollected} Mail${data.mailsCollected > 1 ? "s" : ""} Collected`,
                      xpEarned: 0,
                      goldEarned: data.goldCollected || 0,
                      loot: data.itemsCollected > 0 ? { name: `${data.itemsCollected} item${data.itemsCollected > 1 ? "s" : ""}`, emoji: "◆", rarity: "rare" } : undefined,
                      currencies: currencies.length > 0 ? currencies : undefined,
                    });
                  }
                  setActionMsg(data.message || data.error || "Done");
                  setTimeout(() => setActionMsg(null), 4000);
                  fetchMail();
                } catch { setActionMsg("Network error"); }
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", cursor: "pointer" }}
            >
              Collect All
            </button>
          )}
          <button
            onClick={() => setComposing(c => !c)}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
          style={{ background: composing ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.08)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)", cursor: "pointer" }}
        >
          {composing ? "Cancel" : "New Mail"}
        </button>
        </div>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", color: "#a855f7" }}>
          {actionMsg}
        </div>
      )}

      {/* Compose form */}
      {composing && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.15)" }}>
          <input
            type="text"
            placeholder="To (player name)"
            value={sendTo}
            onChange={e => setSendTo(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-lg input-dark"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8" }}
          />
          <input
            type="text"
            placeholder="Subject"
            value={sendSubject}
            onChange={e => setSendSubject(e.target.value)}
            maxLength={100}
            className="w-full text-xs px-3 py-1.5 rounded-lg input-dark"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8" }}
          />
          <textarea
            placeholder="Message (optional)"
            value={sendBody}
            onChange={e => setSendBody(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full text-xs px-3 py-1.5 rounded-lg input-dark resize-none"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", scrollbarWidth: "thin" }}
          />
          <div className="flex items-center gap-3">
            <Tip k="gold"><label className="text-xs text-w40" style={{ cursor: "help" }}>Gold:</label></Tip>
            <input
              type="number"
              min={0}
              value={sendGold}
              onChange={e => setSendGold(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 text-xs px-2 py-1 rounded-lg input-dark font-mono"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#f59e0b" }}
            />
            <span className="text-xs text-w20">(+5g postage)</span>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !sendTo || !sendSubject}
            className="w-full text-xs py-2 rounded-lg font-semibold"
            style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)", cursor: (sending || !sendTo || !sendSubject) ? "not-allowed" : "pointer", opacity: (sending || !sendTo || !sendSubject) ? 0.5 : 1 }}
          >
            {sending ? "Sending..." : "Send Mail"}
          </button>
        </div>
      )}

      {/* Inbox list */}
      {loading ? (
        <p className="text-xs text-center py-6 text-w20">Loading...</p>
      ) : inbox.length === 0 ? (
        <p className="text-xs text-center py-8 text-w15">No mail.</p>
      ) : (
        <div className="space-y-1.5">
          {inbox.map(mail => {
            const isSelected = selectedMail?.id === mail.id;
            const hasLoot = !mail.collected && ((mail.gold || 0) > 0 || mail.items.length > 0);
            return (
              <div key={mail.id}>
                <button
                  onClick={() => {
                    if (isSelected) { setSelectedMail(null); return; }
                    setSelectedMail(mail);
                    if (!mail.read) {
                      fetch(`/api/mail/${mail.id}/read`, { method: "POST", headers: getAuthHeaders(apiKey) })
                        .then(() => fetchMail())
                        .catch(() => {});
                    }
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    background: isSelected ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isSelected ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.05)"}`,
                    cursor: "pointer",
                  }}
                >
                  {/* Unread dot */}
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: !mail.read ? "#a855f7" : "transparent" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold truncate" style={{ color: !mail.read ? "#e8e8e8" : "rgba(255,255,255,0.4)" }}>{mail.subject}</span>
                      {hasLoot && <span className="text-xs flex-shrink-0 px-1 rounded" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>{mail.gold > 0 ? `${mail.gold}g` : ""}{mail.items.length > 0 ? ` +${mail.items.length}` : ""}</span>}
                    </div>
                    <p className="text-xs text-w20">from {mail.from} · {new Date(mail.sentAt).toLocaleDateString()}</p>
                  </div>
                </button>
                {/* Expanded mail */}
                {isSelected && (
                  <div className="tab-content-enter rounded-lg p-3 mt-1 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {mail.body && <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{mail.body}</p>}
                    {/* Attachments */}
                    {(mail.gold > 0 || mail.items.length > 0) && (
                      <div className="rounded-lg px-3 py-2" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: "rgba(245,158,11,0.6)" }}>Attachments</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {mail.gold > 0 && <Tip k="gold"><span className="text-xs font-semibold" style={{ color: "#f59e0b", cursor: "help" }}>{mail.gold} Gold</span></Tip>}
                          {mail.items.map(item => (
                            <span key={item.id} className="text-xs font-semibold" style={{ color: RARITY_COLORS[item.rarity] || "#888" }}>{item.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Actions */}
                    <div className="flex gap-2">
                      {!mail.collected && (mail.gold > 0 || mail.items.length > 0) && (
                        <button
                          onClick={() => handleCollect(mail.id)}
                          className="flex-1 text-xs py-1.5 rounded-lg font-semibold"
                          style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", cursor: "pointer" }}
                        >
                          Collect
                        </button>
                      )}
                      {confirmDeleteId === mail.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { handleDelete(mail.id); setConfirmDeleteId(null); }}
                            className="text-xs py-1.5 px-2 rounded-lg font-semibold"
                            style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", cursor: "pointer" }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs py-1.5 px-2 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(mail.id)}
                          className="text-xs py-1.5 px-3 rounded-lg"
                          style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Challenges Tab ─────────────────────────────────────────────────────────

interface PlayerChallenge {
  id: string;
  challengerId: string;
  challengerName: string;
  targetId: string;
  targetName: string;
  type: string;
  wager: number;
  rules: string | null;
  duration: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  forfeitedBy?: string | null;
  expiresAt: string | null;
  challengerScore: number;
  targetScore: number;
  winner: string | null;
}

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  quests_week: "Most Quests This Week",
  xp_week: "Most XP This Week",
  streak_week: "Longest Streak This Week",
  custom: "Custom Rules",
};

// ─── Sworn Bond Tab ─────────────────────────────────────────────────────────

function SwornBondTab({ apiKey, playerName, onRewardCelebration }: { apiKey: string; playerName: string; onRewardCelebration?: (d: RewardCelebrationData) => void }) {
  const [bond, setBond] = useState<SwornBond | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [confirmBreak, setConfirmBreak] = useState(false);

  const fetchBond = useCallback(async () => {
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/sworn-bond`, { headers: getAuthHeaders(apiKey) });
      if (r.ok) {
        const d = await r.json();
        setBond(d.bond);
        setCooldownUntil(d.cooldownUntil);
      }
    } catch { setMessage({ text: "Failed to load bond data", type: "error" }); }
    setLoading(false);
  }, [apiKey, playerName]);

  useEffect(() => { fetchBond(); }, [fetchBond]);

  // Load friends list for bond proposal
  useEffect(() => {
    if (bond) return; // Don't load friends if bond exists
    (async () => {
      try {
        const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/friends`, { headers: getAuthHeaders(apiKey) });
        if (r.ok) { const d = await r.json(); setFriends(d.friends || []); }
      } catch { /* ignore */ }
    })();
  }, [apiKey, playerName, bond]);

  const propose = async (targetId: string) => {
    if (actionLoading) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const r = await fetch("/api/social/sworn-bond/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
        body: JSON.stringify({ targetPlayer: targetId }),
      });
      const d = await r.json();
      if (r.ok) { setMessage({ text: d.message || "Bond proposed", type: "success" }); fetchBond(); }
      else setMessage({ text: d.error || "Failed to propose", type: "error" });
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  const respond = async (action: "accept" | "decline") => {
    if (!bond || actionLoading) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/social/sworn-bond/${bond.id}/${action}`, {
        method: "POST",
        headers: getAuthHeaders(apiKey),
      });
      const d = await r.json();
      if (r.ok) { setMessage({ text: d.message, type: "success" }); fetchBond(); }
      else setMessage({ text: d.error || `Failed to ${action}`, type: "error" });
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  const breakBond = async () => {
    if (!bond || actionLoading) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/social/sworn-bond/${bond.id}/break`, {
        method: "POST",
        headers: getAuthHeaders(apiKey),
      });
      const d = await r.json();
      if (r.ok) { setMessage({ text: d.message, type: "success" }); setBond(null); setConfirmBreak(false); fetchBond(); }
      else setMessage({ text: d.error || "Failed to break bond", type: "error" });
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  const claimChest = async () => {
    if (!bond || actionLoading) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/social/sworn-bond/${bond.id}/claim-chest`, {
        method: "POST",
        headers: getAuthHeaders(apiKey),
      });
      const d = await r.json();
      if (r.ok) {
        if (onRewardCelebration) {
          const currencies: { name: string; amount: number; color: string }[] = [];
          if (d.rewards.essenz) currencies.push({ name: "Essenz", amount: d.rewards.essenz, color: "#ef4444" });
          onRewardCelebration({
            type: "daily-bonus",
            title: "Bond Chest",
            xpEarned: 0,
            goldEarned: d.rewards.gold || 0,
            currencies: currencies.length > 0 ? currencies : undefined,
            flavor: d.rewards.frame ? `Duo Frame earned: "${d.rewards.frame}"` : `Bond Level ${d.newBondLevel}: ${d.newBondTitle}. Streak: ${d.streak} weeks.`,
          });
        }
        fetchBond();
      } else setMessage({ text: d.error || "Failed to claim", type: "error" });
    } catch { setMessage({ text: "Network error", type: "error" }); }
    setActionLoading(false);
  };

  if (loading) return <div className="space-y-3 tab-content-enter"><div className="skeleton-card h-24" /><div className="skeleton-card h-16" /></div>;

  // ── No bond: propose view ──
  if (!bond) {
    return (
      <div className="tab-content-enter space-y-4">
        <div className="text-center py-4">
          <p className="text-sm font-bold" style={{ color: "#f59e0b" }}>Sworn Bonds</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            Wähle einen Freund. Schwört einen Pakt. Erfüllt gemeinsame Ziele. Die stärksten Bande halten länger als Stahl.
          </p>
        </div>
        {cooldownUntil && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.06)", color: "rgba(239,68,68,0.6)", border: "1px solid rgba(239,68,68,0.15)" }}>
            Bond cooldown active until {new Date(cooldownUntil).toLocaleDateString()}. You recently broke a bond.
          </div>
        )}
        {message && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: message.type === "success" ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", color: message.type === "success" ? "#22c55e" : "#ef4444", border: `1px solid ${message.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}` }}>
            {message.text}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {friends.length === 0 && <p className="col-span-full text-xs text-center text-w25">No friends yet. Add friends first.</p>}
          {friends.map(f => (
            <button
              key={f.id}
              disabled={actionLoading || !!cooldownUntil}
              onClick={() => propose(f.id)}
              title={cooldownUntil ? "Bond cooldown active" : actionLoading ? "Action in progress" : `Propose bond to ${f.name}`}
              className="rounded-lg p-3 text-left transition-all hover:brightness-125"
              style={{
                background: "rgba(245,158,11,0.04)",
                border: "1px solid rgba(245,158,11,0.15)",
                cursor: actionLoading || cooldownUntil ? "not-allowed" : "pointer",
                opacity: actionLoading || cooldownUntil ? 0.5 : 1,
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${f.color || '#666666'}40`, color: f.color || '#666666' }}>
                  {f.avatar || f.name?.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#e8e8e8" }}>{f.name}</p>
                  <p className="text-xs text-w25">Lv {f.level || "?"}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Pending bond ──
  if (bond.status === "pending") {
    return (
      <div className="tab-content-enter space-y-4">
        <div className="rounded-xl p-5 text-center" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-lg font-bold" style={{ background: `${bond.partner.color}30`, color: bond.partner.color }}>
            {bond.partner.avatar?.slice(0, 2) || bond.partner.name.slice(0, 2).toUpperCase()}
          </div>
          <p className="text-sm font-bold" style={{ color: "#f59e0b" }}>{bond.isInitiator ? "Bond Proposed" : "Bond Invitation"}</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            {bond.isInitiator
              ? `Waiting for ${bond.partner.name} to accept the pact.`
              : `${bond.partner.name} wants to forge a Sworn Bond with you.`
            }
          </p>
          {bond.isInitiator && (
            <button disabled={actionLoading} onClick={async () => {
              if (actionLoading) return;
              setActionLoading(true);
              try {
                const r = await fetch(`/api/social/sworn-bond/${bond.id}/cancel`, { method: "POST", headers: getAuthHeaders(apiKey) });
                const d = await r.json();
                if (r.ok) { setMessage({ text: d.message || "Cancelled", type: "success" }); fetchBond(); }
                else setMessage({ text: d.error || "Failed", type: "error" });
              } catch { setMessage({ text: "Network error", type: "error" }); }
              setActionLoading(false);
            }} className="btn-interactive text-xs px-3 py-1.5 rounded-lg font-semibold mt-3" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: actionLoading ? "not-allowed" : "pointer" }}>
              {actionLoading ? "..." : "Cancel Proposal"}
            </button>
          )}
          {!bond.isInitiator && (
            <div className="flex gap-2 justify-center mt-4">
              <button disabled={actionLoading} onClick={() => respond("accept")} className="btn-interactive text-xs px-4 py-2 rounded-lg font-semibold" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", cursor: actionLoading ? "not-allowed" : "pointer" }}>
                {actionLoading ? "..." : "Accept"}
              </button>
              <button disabled={actionLoading} onClick={() => respond("decline")} className="btn-interactive text-xs px-4 py-2 rounded-lg font-semibold" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: actionLoading ? "not-allowed" : "pointer" }}>
                {actionLoading ? "..." : "Decline"}
              </button>
            </div>
          )}
        </div>
        {message && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: message.type === "success" ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", color: message.type === "success" ? "#22c55e" : "#ef4444" }}>{message.text}</div>}
      </div>
    );
  }

  // ── Active bond ──
  const obj = bond.weeklyObjective;
  const totalProgress = obj ? (obj.progress.mine + obj.progress.partner) : 0;
  const progressPct = obj ? Math.min(100, Math.round((totalProgress / obj.target) * 100)) : 0;
  const bondXpPct = bond.bondXpToNext > 0 ? Math.min(100, Math.round((bond.bondXp / bond.bondXpToNext) * 100)) : 100;

  return (
    <div className="tab-content-enter space-y-4">
      {message && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: message.type === "success" ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", color: message.type === "success" ? "#22c55e" : "#ef4444", border: `1px solid ${message.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}` }}>{message.text}</div>}

      {/* Bond Header */}
      <div className="rounded-xl p-5" style={{
        background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(217,119,6,0.03) 100%)",
        border: "1px solid rgba(245,158,11,0.2)",
        boxShadow: "0 0 20px rgba(245,158,11,0.04)",
      }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Partner avatar */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: `${bond.partner.color}30`, color: bond.partner.color, border: `1px solid ${bond.partner.color}40` }}>
              {bond.partner.avatar?.slice(0, 2) || bond.partner.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#e8e8e8" }}>{bond.partner.name}</p>
              <p className="text-xs" style={{ color: "rgba(245,158,11,0.6)" }}>Level {bond.partner.level}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#f59e0b" }}>Bond Lv {bond.bondLevel}</p>
            <p className="text-xs" style={{ color: "rgba(245,158,11,0.5)" }}>{bond.bondLevelTitle}</p>
          </div>
        </div>

        {/* Streak + Bond XP */}
        <div className="flex items-center gap-4 mb-1">
          <TipCustom title="Duo Streak" icon="◆" accent="#f59e0b" body={<p>Consecutive weeks of completing the bond objective. Higher streak = better chest rewards. Current: {bond.streak} weeks. Longest: {bond.longestStreak}.</p>}>
            <span className="text-xs font-mono font-bold cursor-help" style={{ color: bond.streak > 0 ? "#f59e0b" : "rgba(255,255,255,0.25)" }}>
              {bond.streak > 0 ? `${bond.streak}w streak` : "No streak"}
            </span>
          </TipCustom>
          <div className="flex-1">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(245,158,11,0.1)" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${bondXpPct}%`, background: "linear-gradient(90deg, #f59e0b, #d97706)" }} />
            </div>
          </div>
          <span className="text-xs font-mono text-w25">{bond.bondXp}/{bond.bondXpToNext} XP</span>
        </div>
      </div>

      {/* Weekly Objective */}
      {obj && (
        <div className="rounded-xl p-4" style={{
          background: obj.completed ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${obj.completed ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`,
        }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: obj.completed ? "#22c55e" : "rgba(255,255,255,0.4)" }}>
              {obj.completed ? "Objective Complete" : "Weekly Objective"}
            </p>
            <span className="text-xs text-w20">{obj.weekId}</span>
          </div>
          <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.65)" }}>{obj.description}</p>

          {/* Progress display */}
          {obj.targetPerPlayer ? (
            // Individual objectives: show two separate bars
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs w-12 text-right truncate" style={{ color: "#818cf8" }}>You</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${Math.min(100, Math.round((obj.progress.mine / obj.targetPerPlayer) * 100))}%`,
                    background: obj.progress.mine >= obj.targetPerPlayer ? "linear-gradient(90deg, #22c55e, #4ade80)" : "linear-gradient(90deg, #818cf8, #6366f1)",
                  }} />
                </div>
                <span className="text-xs font-mono font-bold w-12" style={{ color: obj.progress.mine >= obj.targetPerPlayer ? "#22c55e" : "#818cf8" }}>{obj.progress.mine}/{obj.targetPerPlayer}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-12 text-right truncate" style={{ color: bond.partner.color }}>{bond.partner.name.slice(0, 6)}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${Math.min(100, Math.round((obj.progress.partner / obj.targetPerPlayer) * 100))}%`,
                    background: obj.progress.partner >= obj.targetPerPlayer ? "linear-gradient(90deg, #22c55e, #4ade80)" : `linear-gradient(90deg, ${bond.partner.color}, ${bond.partner.color})`,
                  }} />
                </div>
                <span className="text-xs font-mono font-bold w-12" style={{ color: obj.progress.partner >= obj.targetPerPlayer ? "#22c55e" : bond.partner.color }}>{obj.progress.partner}/{obj.targetPerPlayer}</span>
              </div>
            </div>
          ) : (
            // Combined objectives: single bar with dual contribution
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold w-8 text-right" style={{ color: "#818cf8" }}>{obj.progress.mine}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${progressPct}%`,
                    background: obj.completed
                      ? "linear-gradient(90deg, #22c55e, #4ade80)"
                      : `linear-gradient(90deg, #818cf8 0%, #818cf8 ${obj.target > 0 ? Math.round((obj.progress.mine / obj.target) * 100) : 0}%, ${bond.partner.color} ${obj.target > 0 ? Math.round((obj.progress.mine / obj.target) * 100) : 0}%, ${bond.partner.color} 100%)`,
                  }} />
                </div>
                <span className="text-xs font-mono font-bold w-8" style={{ color: bond.partner.color }}>{obj.progress.partner}</span>
              </div>
              <p className="text-xs text-center text-w30">{totalProgress} / {obj.target}</p>
            </>
          )}

          {/* Claim button */}
          {obj.completed && !obj.chestClaimed && (
            <button
              onClick={claimChest}
              disabled={actionLoading}
              className="w-full mt-3 py-2.5 rounded-lg text-sm font-bold transition-all claimable-breathe"
              style={{
                background: "rgba(245,158,11,0.12)",
                color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.35)",
                cursor: actionLoading ? "not-allowed" : "pointer",
                opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? "Opening..." : "Open Bond Chest"}
            </button>
          )}
          {obj.completed && obj.chestClaimed && (
            <p className="text-xs text-center mt-2" style={{ color: "rgba(34,197,94,0.5)" }}>Chest claimed this week</p>
          )}
        </div>
      )}

      {/* Break bond */}
      <div className="text-center">
        {!confirmBreak ? (
          <button onClick={() => setConfirmBreak(true)} className="text-xs transition-opacity hover:opacity-70" style={{ color: "rgba(239,68,68,0.3)", cursor: "pointer" }}>
            Break Bond
          </button>
        ) : (
          <div className="rounded-lg px-4 py-3 inline-flex items-center gap-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="text-xs" style={{ color: "rgba(239,68,68,0.6)" }}>7-day cooldown. Streak lost. Sure?</span>
            <button disabled={actionLoading} onClick={breakBond} className="text-xs font-semibold px-3 py-1 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", cursor: actionLoading ? "not-allowed" : "pointer" }}>
              {actionLoading ? "..." : "Confirm"}
            </button>
            <button onClick={() => setConfirmBreak(false)} className="text-xs px-2 py-1 rounded" style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengesTab({ apiKey, playerName }: { apiKey: string; playerName: string }) {
  const [challenges, setChallenges] = useState<PlayerChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/social/challenges", { headers: getAuthHeaders(apiKey) });
        if (r.ok) { const d = await r.json(); setChallenges(d.challenges || []); }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [apiKey]);

  const acceptChallenge = async (challengeId: string) => {
    try {
      const r = await fetch(`/api/social/challenge/${challengeId}/accept`, {
        method: "POST",
        headers: getAuthHeaders(apiKey),
      });
      const d = await r.json();
      if (r.ok) {
        setActionMsg("Challenge accepted.");
        setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, status: "active", startedAt: new Date().toISOString(), expiresAt: d.challenge?.expiresAt || null } : c));
      } else {
        setActionMsg(d.error || "Failed to accept");
      }
      setTimeout(() => setActionMsg(null), 3000);
    } catch { setActionMsg("Network error"); }
  };

  if (loading) return <div className="skeleton-card h-32" />;

  const pending = challenges.filter(c => c.status === "pending");
  const active = challenges.filter(c => c.status === "active");
  const completed = challenges.filter(c => c.status === "completed").slice(0, 5);
  const uid = (playerName || "").toLowerCase();

  return (
    <div className="space-y-4">
      {actionMsg && (
        <div className="text-xs px-3 py-2 rounded-lg tab-content-enter" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
          {actionMsg}
        </div>
      )}

      {/* Pending challenges (incoming) */}
      {pending.filter(c => c.targetId === uid).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w25 mb-2">Incoming Challenges</p>
          <div className="space-y-2">
            {pending.filter(c => c.targetId === uid).map(c => (
              <div key={c.id} className="rounded-lg p-3" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold" style={{ color: "#fbbf24" }}>{c.challengerName} challenges you!</p>
                    <p className="text-xs text-w30 mt-0.5">{CHALLENGE_TYPE_LABELS[c.type] || c.type} · {c.wager}g wager</p>
                  </div>
                  <button
                    onClick={() => acceptChallenge(c.id)}
                    className="btn-interactive text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", cursor: "pointer" }}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending (outgoing) */}
      {pending.filter(c => c.challengerId === uid).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w25 mb-2">Sent Challenges</p>
          <div className="space-y-2">
            {pending.filter(c => c.challengerId === uid).map(c => (
              <div key={c.id} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-xs text-w40">Waiting for <span className="font-semibold text-w60">{c.targetName}</span> to accept</p>
                <p className="text-xs text-w20 mt-0.5">{CHALLENGE_TYPE_LABELS[c.type] || c.type} · {c.wager}g wager</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active challenges */}
      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w25 mb-2">Active Challenges</p>
          <div className="space-y-2">
            {active.map(c => {
              const isChallenger = c.challengerId === uid;
              const opponentName = isChallenger ? c.targetName : c.challengerName;
              const myScore = isChallenger ? c.challengerScore : c.targetScore;
              const theirScore = isChallenger ? c.targetScore : c.challengerScore;
              const timeLeft = c.expiresAt ? Math.max(0, Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
              return (
                <div key={c.id} className="rounded-lg p-3" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold" style={{ color: "#a855f7" }}>vs {opponentName}</p>
                    <span className="text-xs text-w20">{timeLeft}d left</span>
                  </div>
                  <p className="text-xs text-w30">{CHALLENGE_TYPE_LABELS[c.type] || c.type} · {c.wager}g wager</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs font-mono font-bold" style={{ color: myScore >= theirScore ? "#22c55e" : "#ef4444" }}>You: {myScore}</span>
                    <span className="text-xs text-w20">vs</span>
                    <span className="text-xs font-mono font-bold text-w40">{opponentName}: {theirScore}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-w25 mb-2">Recent Results</p>
          <div className="space-y-1">
            {completed.map(c => {
              const won = c.winner === uid;
              const opponentName = c.challengerId === uid ? c.targetName : c.challengerName;
              return (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span className="text-xs font-bold" style={{ color: won ? "#22c55e" : "#ef4444" }}>{won ? "W" : "L"}</span>
                  <span className="text-xs text-w40">vs {opponentName}</span>
                  <span className="text-xs text-w20 ml-auto">{c.wager}g</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {challenges.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm font-bold text-w25 mb-1">No Challenges</p>
          <p className="text-xs text-w15">Challenge friends from their profile card in the Friends tab.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main SocialView ────────────────────────────────────────────────────────

export default function SocialView({ onNavigate, onNavigateToAchievement, onRewardCelebration }: { onNavigate?: (view: string) => void; onNavigateToAchievement?: (achievementId: string) => void; onRewardCelebration?: (data: RewardCelebrationData) => void } = {}) {
  const { playerName, reviewApiKey } = useDashboard();
  const [activeTab, setActiveTab] = useState<SocialTab>("friends");
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [pendingMessageTarget, setPendingMessageTarget] = useState<string | null>(null);

  if (!playerName || !reviewApiKey) {
    return (
      <div className="rounded-xl px-6 py-12 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-sm font-bold mb-1 text-w25">Log in to enter The Breakaway</p>
        <p className="text-xs text-w15">Connect with other adventurers, send messages, and trade items.</p>
      </div>
    );
  }

  return (
    <div data-feedback-id="social-view" className="space-y-4">
      {/* Section header */}
      <div>
        <div className="flex items-center gap-2">
          <Tip k="breakaway" heading><span className="text-xs font-semibold uppercase tracking-widest text-w35">The Breakaway</span></Tip>
        </div>
        <p className="text-xs italic mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Die stärksten Bande werden nicht in der Schlacht geschmiedet, sondern danach.</p>
      </div>

      {/* Tab navigation */}
      <div className="inline-flex rounded-lg p-0.5 flex-wrap" style={{ background: "#111" }}>
        {(["friends", "bonds", "messages", "trades", "challenges", "activity"] as SocialTab[]).map(tab => {
          const tipKey = tab === "trades" ? "trading" : tab === "activity" ? "activity_feed" : tab === "bonds" ? "sworn_bonds" : tab;
          const unreadDot = false; // Per-tab unread counts require lifting state — deferred
          return (
            <Tip key={tab} k={tipKey}>
              <button
                onClick={() => setActiveTab(tab)}
                className="btn-interactive text-xs font-semibold px-4 py-2 rounded-md transition-all capitalize relative"
                style={{
                  background: activeTab === tab ? "#252525" : "transparent",
                  color: activeTab === tab ? "#a855f7" : "rgba(255,255,255,0.3)",
                }}
              >
                {tab === "activity" ? "Feed" : tab === "bonds" ? "Sworn Bond" : tab}
                {unreadDot && activeTab !== tab && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: "#a855f7", boxShadow: "0 0 4px rgba(168,85,247,0.5)" }} />
                )}
              </button>
            </Tip>
          );
        })}
      </div>

      <TutorialMomentBanner viewId="social" playerLevel={1} />
      <FirstVisitBanner
        viewId="social"
        title="The Breakaway"
        description="Freunde finden. Items tauschen. Nachrichten senden. Beobachten was die anderen so treiben. Das Übliche. Nur mit besseren Belohnungen."
        accentColor="#a855f7"
      />

      {/* Tab content */}
      <div key={activeTab} className="tab-content-enter">
        {activeTab === "friends" && <FriendsTab apiKey={reviewApiKey} playerName={playerName} onOpenProfile={id => setProfilePlayerId(id)} />}
        {activeTab === "bonds" && <SwornBondTab apiKey={reviewApiKey} playerName={playerName} onRewardCelebration={onRewardCelebration} />}
        {activeTab === "messages" && <MessagesTab apiKey={reviewApiKey} playerName={playerName} autoOpenWith={pendingMessageTarget} onAutoOpened={() => setPendingMessageTarget(null)} />}
        {activeTab === "trades" && <TradesTab apiKey={reviewApiKey} playerName={playerName} onRewardCelebration={onRewardCelebration} />}
        {activeTab === "activity" && <ActivityFeedTab apiKey={reviewApiKey} playerName={playerName} onNavigate={onNavigate} onNavigateToAchievement={onNavigateToAchievement} />}
        {activeTab === "mail" && <MailTab apiKey={reviewApiKey} playerName={playerName} onRewardCelebration={onRewardCelebration} />}
        {activeTab === "challenges" && <ChallengesTab apiKey={reviewApiKey} playerName={playerName} />}
      </div>

      {/* Player Profile Modal */}
      {profilePlayerId && (
        <PlayerProfileModal
          playerId={profilePlayerId}
          onClose={() => setProfilePlayerId(null)}
          onMessage={(id) => { setProfilePlayerId(null); setPendingMessageTarget(id); setActiveTab("messages"); }}
        />
      )}
    </div>
  );
}
