"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { InfoTooltip } from "@/components/InfoTooltip";
import type {
  FriendInfo, FriendRequest, Conversation, SocialMessage,
  Trade, TradeOffer,
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
      style={{ width: size, height: size, fontSize: size * 0.4, background: color + "20", color, border: `1px solid ${color}40` }}
    >
      {avatar?.slice(0, 2) || name[0]}
    </span>
  );
}

// ─── Sub-tab navigation ──────────────────────────────────────────────────────

type SocialTab = "friends" | "messages" | "trades";

// ─── Friends Tab ────────────────────────────────────────────────────────────

function FriendsTab({ apiKey, playerName }: { apiKey: string; playerName: string }) {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [addInput, setAddInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch { /* ignore */ }
    setLoading(false);
  }, [apiKey, playerName]);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);

  const sendRequest = async () => {
    if (!addInput.trim()) return;
    setError(null);
    try {
      const r = await fetch("/api/social/friend-request", {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayer: addInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Failed"); return; }
      setAddInput("");
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
    } catch { /* ignore */ }
  };

  const removeFriend = async (friendId: string) => {
    try {
      await fetch(`/api/social/friend/${friendId}`, {
        method: "DELETE",
        headers: getAuthHeaders(apiKey),
      });
      fetchFriends();
    } catch { /* ignore */ }
  };

  const incoming = incomingRequests;
  const outgoing = outgoingRequests;

  if (loading) return <p className="text-xs text-w20 text-center py-8">Loading...</p>;

  return (
    <div className="space-y-4">
      {/* Add friend */}
      <div className="flex gap-2">
        <input
          value={addInput}
          onChange={e => setAddInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") sendRequest(); }}
          placeholder="Player name..."
          className="input-dark flex-1 text-xs px-3 py-2 rounded-lg"
        />
        <button
          onClick={sendRequest}
          className="btn-interactive text-xs font-semibold px-4 py-2 rounded-lg"
          style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}
        >
          Add Friend
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

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

      {/* Friends list */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-w35 mb-2">Friends ({friends.length})</p>
        {friends.length === 0 ? (
          <p className="text-xs text-w20 text-center py-6">No friends yet. Send a request above!</p>
        ) : (
          <div className="space-y-1.5">
            {friends.map(f => (
              <div key={f.id} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <PlayerBadge name={f.name} avatar={f.avatar} color={f.color} size={28} />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black" style={{ background: f.isOnline ? "#22c55e" : "#555" }} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold" style={{ color: "#e8e8e8" }}>{f.name}</span>
                    <span className="text-xs text-w20 ml-2">Lv.{f.level}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeFriend(f.id)}
                  className="btn-interactive text-xs px-2 py-1 rounded text-w20 hover:text-w50"
                  title="Remove friend"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Messages Tab ───────────────────────────────────────────────────────────

function MessagesTab({ apiKey, playerName }: { apiKey: string; playerName: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/conversations`, { headers: getAuthHeaders(apiKey) });
      if (r.ok) setConversations((await r.json()).conversations || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [apiKey, playerName]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConvo = async (otherPlayerId: string) => {
    setActiveConvo(otherPlayerId);
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/messages/${encodeURIComponent(otherPlayerId)}`, { headers: getAuthHeaders(apiKey) });
      if (r.ok) setMessages((await r.json()).messages || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      }
    } catch { /* ignore */ }
  };

  if (loading) return <p className="text-xs text-w20 text-center py-8">Loading...</p>;

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
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
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
                  <p className="text-xs text-w15 mt-0.5 text-right">{timeAgo(msg.createdAt)}</p>
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
            onChange={e => setMsgInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
            placeholder="Type a message..."
            maxLength={500}
            className="input-dark flex-1 text-xs px-3 py-2 rounded-lg"
          />
          <button
            onClick={sendMessage}
            disabled={!msgInput.trim()}
            className="btn-interactive text-xs font-semibold px-4 py-2 rounded-lg"
            style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)", opacity: msgInput.trim() ? 1 : 0.4 }}
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.length === 0 ? (
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
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#a855f7", color: "#fff", fontSize: 9 }}>
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
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
            {offer.gold} Gold
          </span>
        </div>
      )}
      {offer.items.length > 0 ? (
        <div className="space-y-1">
          {offer.items.map(item => (
            <div key={item.instanceId} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="text-w50">{item.name}</span>
              <span className="text-w20 capitalize">{item.rarity}</span>
              {item.slot && <span className="text-w15">({item.slot})</span>}
            </div>
          ))}
        </div>
      ) : offer.gold === 0 ? (
        <p className="text-xs text-w15 italic">Nothing offered</p>
      ) : null}
    </div>
  );
}

// ─── Trades Tab ─────────────────────────────────────────────────────────────

function TradesTab({ apiKey, playerName }: { apiKey: string; playerName: string }) {
  const { users } = useDashboard();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New trade form
  const [showNewTrade, setShowNewTrade] = useState(false);
  const [newTradeTarget, setNewTradeTarget] = useState("");
  const [newTradeGold, setNewTradeGold] = useState(0);
  const [newTradeMsg, setNewTradeMsg] = useState("");

  // Counter-offer form
  const [counterGold, setCounterGold] = useState(0);
  const [counterMsg, setCounterMsg] = useState("");

  const fetchTrades = useCallback(async () => {
    try {
      const r = await fetch(`/api/social/${encodeURIComponent(playerName)}/trades`, { headers: getAuthHeaders(apiKey) });
      if (r.ok) setTrades((await r.json()).trades || []);
    } catch { /* ignore */ }
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
          offer: { gold: newTradeGold, items: [] },
          message: newTradeMsg.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Failed"); setActionLoading(false); return; }
      setShowNewTrade(false);
      setNewTradeTarget("");
      setNewTradeGold(0);
      setNewTradeMsg("");
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
      if (!r.ok) { setError(d.error || "Failed"); setActionLoading(false); return; }
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
          offer: { gold: counterGold, items: [] },
          message: counterMsg.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Failed"); setActionLoading(false); return; }
      setCounterGold(0);
      setCounterMsg("");
      fetchTrades();
      setSelectedTrade(null);
    } catch { setError("Network error"); }
    setActionLoading(false);
  };

  if (loading) return <p className="text-xs text-w20 text-center py-8">Loading...</p>;

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

        {/* Negotiation history */}
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
                    {round.message && <p className="text-xs text-w40 italic">"{round.message}"</p>}
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

        {/* Actions */}
        {t.status === "pending" && isMyTurn && (
          <div className="space-y-3 pt-2">
            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

            {/* Accept / Decline */}
            <div className="flex gap-2">
              <button
                onClick={() => handleTradeAction(t.id, "accept")}
                disabled={actionLoading}
                className="btn-interactive flex-1 text-xs font-bold py-2.5 rounded-lg"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#000", opacity: actionLoading ? 0.5 : 1 }}
              >
                Accept Trade
              </button>
              <button
                onClick={() => handleTradeAction(t.id, "decline")}
                disabled={actionLoading}
                className="btn-interactive text-xs font-semibold py-2.5 px-4 rounded-lg"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", opacity: actionLoading ? 0.5 : 1 }}
              >
                Decline
              </button>
            </div>

            {/* Counter-offer */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-w35 mb-3">Counter-Offer</p>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-w25 block mb-1">Your gold offer</label>
                  <input
                    type="number"
                    min={0}
                    value={counterGold}
                    onChange={e => setCounterGold(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-dark w-full text-xs px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
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
                style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", opacity: actionLoading ? 0.5 : 1 }}
              >
                Send Counter-Offer
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
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}
            >
              Cancel Trade
            </button>
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
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a855f7" }}>New Trade Proposal</p>
          <input
            value={newTradeTarget}
            onChange={e => setNewTradeTarget(e.target.value)}
            placeholder="Trade with player..."
            className="input-dark w-full text-xs px-3 py-2 rounded-lg"
          />
          <div>
            <label className="text-xs text-w25 block mb-1">Gold to offer</label>
            <input
              type="number"
              min={0}
              value={newTradeGold}
              onChange={e => setNewTradeGold(Math.max(0, parseInt(e.target.value) || 0))}
              className="input-dark w-full text-xs px-3 py-2 rounded-lg"
            />
          </div>
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
              style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", opacity: actionLoading || !newTradeTarget.trim() ? 0.5 : 1 }}
            >
              Send Proposal
            </button>
            <button onClick={() => { setShowNewTrade(false); setError(null); }} className="btn-interactive text-xs px-4 py-2 rounded-lg text-w30">Cancel</button>
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

// ─── Main SocialView ────────────────────────────────────────────────────────

export default function SocialView() {
  const { playerName, reviewApiKey } = useDashboard();
  const [activeTab, setActiveTab] = useState<SocialTab>("friends");

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
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-w35">The Breakaway</span>
        <InfoTooltip text="The social hub of the Trade Quarter. Add friends, send messages, and propose trades. Trades are negotiated back and forth — both players must agree before items and gold are exchanged." />
      </div>

      {/* Tab navigation */}
      <div className="inline-flex rounded-lg p-0.5" style={{ background: "#111" }}>
        {(["friends", "messages", "trades"] as SocialTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="btn-interactive text-xs font-semibold px-4 py-2 rounded-md transition-all capitalize"
            style={{
              background: activeTab === tab ? "#252525" : "transparent",
              color: activeTab === tab ? "#a855f7" : "rgba(255,255,255,0.3)",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "friends" && <FriendsTab apiKey={reviewApiKey} playerName={playerName} />}
      {activeTab === "messages" && <MessagesTab apiKey={reviewApiKey} playerName={playerName} />}
      {activeTab === "trades" && <TradesTab apiKey={reviewApiKey} playerName={playerName} />}
    </div>
  );
}
