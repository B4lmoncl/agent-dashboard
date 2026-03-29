"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";
import { formatLegendaryLabel } from "@/app/utils";
import { RARITY_COLORS } from "@/app/constants";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import type { RewardCelebrationData } from "@/components/RewardCelebration";
import type {
  FriendInfo, FriendRequest, Conversation, SocialMessage,
  Trade, TradeOffer, ActivityEvent,
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

// Activity event icons
const EVENT_ICONS: Record<string, string> = {
  quest_complete: "⚔️", level_up: "▲", achievement: "◆",
  gacha_pull: "✨", rare_drop: "◇", trade_complete: "◈", streak_milestone: "🔥",
};

// ─── Sub-tab navigation ──────────────────────────────────────────────────────

type SocialTab = "friends" | "messages" | "trades" | "activity" | "mail";

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
    try {
      await fetch(`/api/social/friend-request/${reqId}/${action}`, {
        method: "POST",
        headers: getAuthHeaders(apiKey),
      });
      fetchFriends();
    } catch (e) { console.error('[social]', e); }
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
                  <button onClick={() => handleRequest(req.id, "accept")} className="btn-interactive text-xs px-3 py-1 rounded" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>Accept</button>
                  <button onClick={() => handleRequest(req.id, "decline")} className="btn-interactive text-xs px-3 py-1 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Decline</button>
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
            {friends.map(f => (
              <div key={f.id} className="relative rounded-xl p-3 flex flex-col items-center text-center group transition-all cursor-pointer" onClick={() => onOpenProfile?.(f.id)} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${f.isOnline ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)"}` }}>
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
    if (!msgInput.trim() || !activeConvo) return;
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
        <div ref={messagesContainerRef} className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
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
                  <p className="text-xs text-w15 mt-0.5 text-right">
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
            disabled={!msgInput.trim()}
            className="btn-interactive text-xs font-semibold px-4 py-2 rounded-lg"
            style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)", opacity: msgInput.trim() ? 1 : 0.4, cursor: msgInput.trim() ? "pointer" : "not-allowed" }}
            title={!msgInput.trim() ? "Type a message first" : undefined}
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

function TradeOfferDisplay({ offer, label, color }: { offer: TradeOffer; label: string; color: string }) {
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
                <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded cursor-default" style={{ background: "rgba(255,255,255,0.03)", borderLeft: `2px solid ${rc}` }}>
                  {item.icon && <img src={item.icon} alt="" width={20} height={20} style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                  <span className="font-semibold truncate" style={{ color: rc }}>{item.name}</span>
                  <span className="text-w20 capitalize ml-auto flex-shrink-0">{item.rarity}</span>
                </div>
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

  // Counter-offer form
  const [counterGold, setCounterGold] = useState(0);
  const [counterMsg, setCounterMsg] = useState("");
  const [counterItems, setCounterItems] = useState<string[]>([]);

  // Item sort
  const [tradeSort, setTradeSort] = useState<TradeSortKey>("rarity");

  // Get unequipped inventory items for trade
  const tradeableItems = (loggedInUser?.inventory || []).filter(item => {
    if (!loggedInUser?.equipment) return true;
    const eq = loggedInUser.equipment;
    for (const slot of Object.keys(eq)) {
      const eqItem = eq[slot as keyof typeof eq];
      if (typeof eqItem === "object" && eqItem && ("instanceId" in eqItem ? eqItem.instanceId === item.id : (eqItem as { id?: string }).id === item.id)) return false;
      if (typeof eqItem === "string" && eqItem === item.id) return false;
    }
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
    setActionLoading(true);
    try {
      const r = await fetch("/api/social/trade/propose", {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({
          to: newTradeTarget.trim(),
          offer: { gold: newTradeGold, items: newTradeItems },
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
          offer: { gold: counterGold, items: counterItems },
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
          />
          <TradeOfferDisplay
            offer={t.currentRecipientOffer}
            label={amInitiator ? `${t.recipientName}'s offer` : "Your offer"}
            color={amInitiator ? otherColor : "#a855f7"}
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
                    <div className="flex gap-3 mt-1 text-xs text-w20">
                      {round.initiatorOffer.gold > 0 && <span>{t.initiatorName}: {round.initiatorOffer.gold}g</span>}
                      {round.recipientOffer.gold > 0 && <span>{t.recipientName}: {round.recipientOffer.gold}g</span>}
                      {round.initiatorOffer.items.length > 0 && <span>+{round.initiatorOffer.items.length} items</span>}
                      {round.recipientOffer.items.length > 0 && <span>+{round.recipientOffer.items.length} items</span>}
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
            <button onClick={() => { setShowNewTrade(false); setError(null); setNewTradeItems([]); }} className="btn-interactive text-xs px-4 py-2 rounded-lg text-w30">Cancel</button>
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
  streak_milestone: { view: "rituals", tooltip: "View Rituals" },
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
            descriptionNode = <>pulled <TipCustom title={d.item || "Item"} icon="✨" accent={rarityColor} body={<><p className="text-xs" style={{ color: rarityColor }}>{d.rarity || "common"}</p>{d.banner && <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>from {d.banner}</p>}</>}><span className="gt-ref" style={{ color: rarityColor }}>{d.item || "an item"}</span></TipCustom></>;
            break;
          case "rare_drop":
            descriptionNode = <>found <TipCustom title={d.item || "Item"} icon="◇" accent={rarityColor} body={<p className="text-xs" style={{ color: rarityColor }}>{d.rarity || "rare"} drop</p>}><span className="gt-ref" style={{ color: rarityColor }}>{d.item || "an item"}</span></TipCustom></>;
            break;
          case "trade_complete":
            descriptionNode = <>completed a trade{d.summary && <> — <span className="text-w30">{d.summary}</span></>}</>;
            break;
          case "streak_milestone":
            descriptionNode = <>hit a <span className="font-semibold" style={{ color: "#f59e0b" }}>{d.days ?? "?"}-day</span> streak</>;
            break;
          default:
            descriptionNode = <>{(event.type as string).replace(/_/g, " ")}</>;
        }

        if (compactView) {
          return (
            <div key={event.id} className="cv-auto flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: d.rarity === "legendary" ? "rgba(255,140,0,0.04)" : "rgba(255,255,255,0.015)", borderLeft: `2px solid ${d.rarity ? (RARITY_COLORS[d.rarity] || "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.06)"}` }}>
              <span style={{ fontSize: 12 }}>{icon}</span>
              <span className="font-semibold truncate" style={{ color: isOwn ? "#a855f7" : (event.playerColor || "#e8e8e8") }}>{name}</span>
              <span className="text-w30 truncate flex-1">{descriptionNode}</span>
              <span className="text-w15 flex-shrink-0">{timeAgo(event.at)}</span>
              {nav && <button onClick={() => { if (event.type === "achievement" && d.achievementId && onNavigateToAchievement) { onNavigateToAchievement(d.achievementId as string); } else { onNavigate!(nav.view); } }} title={nav.tooltip} className="flex-shrink-0 cursor-pointer text-w15 hover:text-w40 transition-colors" style={{ fontSize: 12 }}>→</button>}
            </div>
          );
        }

        return (
          <div key={event.id} className={`cv-auto flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${d.rarity === "legendary" ? "feed-event-legendary" : d.rarity === "epic" ? "feed-event-epic" : ""}`} style={{ background: d.rarity === "legendary" ? "rgba(255,140,0,0.04)" : d.rarity === "epic" ? "rgba(168,85,247,0.03)" : "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-sm flex-shrink-0 mt-0.5">{icon}</span>
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

function MailTab({ apiKey, playerName }: { apiKey: string; playerName: string }) {
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
        setActionMsg(data.message || "Sent!");
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
                        .then(() => { mail.read = true; fetchMail(); })
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
    <div className="space-y-4">
      {/* Section header */}
      <div>
        <div className="flex items-center gap-2">
          <Tip k="breakaway" heading><span className="text-xs font-semibold uppercase tracking-widest text-w35">The Breakaway</span></Tip>
        </div>
        <p className="text-xs italic mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Die stärksten Bande werden nicht in der Schlacht geschmiedet, sondern danach.</p>
      </div>

      {/* Tab navigation */}
      <div className="inline-flex rounded-lg p-0.5" style={{ background: "#111" }}>
        {(["friends", "messages", "trades", "mail", "activity"] as SocialTab[]).map(tab => {
          const tipKey = tab === "trades" ? "trading" : tab === "activity" ? "activity_feed" : tab;
          return (
            <Tip key={tab} k={tipKey}>
              <button
                onClick={() => setActiveTab(tab)}
                className="btn-interactive text-xs font-semibold px-4 py-2 rounded-md transition-all capitalize"
                style={{
                  background: activeTab === tab ? "#252525" : "transparent",
                  color: activeTab === tab ? "#a855f7" : "rgba(255,255,255,0.3)",
                }}
              >
                {tab === "activity" ? "Feed" : tab}
              </button>
            </Tip>
          );
        })}
      </div>

      {/* Tab content */}
      <div key={activeTab} className="tab-content-enter">
        {activeTab === "friends" && <FriendsTab apiKey={reviewApiKey} playerName={playerName} onOpenProfile={id => setProfilePlayerId(id)} />}
        {activeTab === "messages" && <MessagesTab apiKey={reviewApiKey} playerName={playerName} autoOpenWith={pendingMessageTarget} onAutoOpened={() => setPendingMessageTarget(null)} />}
        {activeTab === "trades" && <TradesTab apiKey={reviewApiKey} playerName={playerName} onRewardCelebration={onRewardCelebration} />}
        {activeTab === "activity" && <ActivityFeedTab apiKey={reviewApiKey} playerName={playerName} onNavigate={onNavigate} onNavigateToAchievement={onNavigateToAchievement} />}
        {activeTab === "mail" && <MailTab apiKey={reviewApiKey} playerName={playerName} />}
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
