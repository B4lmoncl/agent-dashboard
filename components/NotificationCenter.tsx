"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAuthHeaders } from "@/lib/auth-client";
import { useDashboard } from "@/app/DashboardContext";
import { useModalBehavior } from "@/components/ModalPortal";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  at: string;
  read: boolean;
}

// ─── Time formatting ────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  if (ms < 60000) return "just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

// ─── Icon mapping ───────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  level_up:          { icon: "/images/icons/reward-xp.png",          color: "#fbbf24", label: "Level Up" },
  achievement:       { icon: "/images/icons/nav-honors.png",         color: "#a855f7", label: "Achievement" },
  quest_milestone:   { icon: "/images/icons/nav-great-hall.png",     color: "#22c55e", label: "Quest Milestone" },
  world_boss_spawn:  { icon: "/images/icons/nav-worldboss.png",      color: "#ef4444", label: "World Boss" },
  world_boss_defeat: { icon: "/images/icons/nav-worldboss.png",      color: "#22c55e", label: "World Boss Defeated" },
  rift_cooldown:     { icon: "/images/icons/nav-rift.png",           color: "#818cf8", label: "Rift Ready" },
  dungeon_complete:  { icon: "/images/icons/nav-dungeons.png",       color: "#22d3ee", label: "Dungeon Complete" },
  npc_quest:         { icon: "/images/icons/nav-wanderer.png",       color: "#e879f9", label: "NPC Quest" },
  season_reset:      { icon: "/images/icons/nav-season.png",         color: "#f97316", label: "Season" },
  bond_level_up:     { icon: "/images/icons/currency-essenz.png",    color: "#ff6b9d", label: "Bond Level Up" },
  faction_tier:      { icon: "/images/icons/nav-factions.png",       color: "#10b981", label: "Faction" },
  daily_reset:       { icon: "/images/icons/currency-gold.png",      color: "#f59e0b", label: "Daily Reset" },
  class_activated:   { icon: "/images/icons/nav-character.png",      color: "#818cf8", label: "Class" },
  system:            { icon: "/images/icons/nav-great-hall.png",     color: "#9ca3af", label: "System" },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function NotificationCenter({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { playerName, reviewApiKey } = useDashboard();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalBehavior(open, useCallback(() => setOpen(false), []));

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!playerName || !reviewApiKey) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/notification-center`, {
        headers: getAuthHeaders(reviewApiKey),
      });
      if (r.ok) {
        const data = await r.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [playerName, reviewApiKey]);

  // Fetch on mount and every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Mark all as read when opened
  const markAllRead = useCallback(async () => {
    if (!playerName || !reviewApiKey || unreadCount === 0) return;
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/notification-center/read`, {
        method: "POST",
        headers: getAuthHeaders(reviewApiKey),
      });
      if (r.ok) {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch { /* ignore */ }
  }, [playerName, reviewApiKey, unreadCount]);

  const handleOpen = useCallback(() => {
    setOpen(v => !v);
    if (!open && unreadCount > 0) {
      // Mark as read after a short delay so the user sees the unread state briefly
      setTimeout(markAllRead, 1500);
    }
  }, [open, unreadCount, markAllRead]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!playerName) return null;

  return (
    <div ref={panelRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="btn-interactive relative flex items-center justify-center"
        style={{
          width: 36, height: 36, borderRadius: 8,
          background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${open ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
          cursor: "pointer",
        }}
        title="Notification Center"
      >
        <img src="/images/icons/nav-great-hall.png" alt="Notifications" width={18} height={18} className="img-render-auto" style={{ opacity: open ? 0.8 : 0.4 }} onError={e => { e.currentTarget.style.display = "none"; }} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-xs font-bold badge-enter" style={{
            background: "#ef4444", color: "#fff", fontSize: 12, padding: "0 4px",
            boxShadow: "0 0 6px rgba(239,68,68,0.4)",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-h-[480px] rounded-xl overflow-hidden tab-content-enter"
          style={{
            background: "linear-gradient(180deg, #1a1a22 0%, #141418 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3)",
            zIndex: 150,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs" style={{ color: "rgba(96,165,250,0.6)", cursor: "pointer", background: "none", border: "none" }}>
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto scrollbar-rpg" style={{ maxHeight: 420, overscrollBehavior: "contain" }}>
            {loading && notifications.length === 0 ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="skeleton-pulse rounded-lg" style={{ height: 48 }} />)}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-w20">No notifications yet</p>
                <p className="text-xs text-w20 mt-1 italic">Complete quests, defeat bosses, and level up to see events here.</p>
              </div>
            ) : (
              <div>
                {notifications.map(n => {
                  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                  return (
                    <button
                      key={n.id}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                      style={{
                        background: n.read ? "transparent" : "rgba(96,165,250,0.04)",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = n.read ? "transparent" : "rgba(96,165,250,0.04)"; }}
                      onClick={() => {
                        // Navigate based on notification type
                        const navMap: Record<string, string> = {
                          level_up: "character", achievement: "honors", world_boss_spawn: "worldboss",
                          world_boss_defeat: "worldboss", rift_cooldown: "rift", dungeon_complete: "dungeons",
                          npc_quest: "npcBoard", faction_tier: "factions", bond_level_up: "character",
                        };
                        const target = navMap[n.type];
                        if (target && onNavigate) { onNavigate(target); setOpen(false); }
                      }}
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {n.icon?.startsWith("/") ? (
                          <img src={n.icon} alt="" width={24} height={24} className="img-render-auto" style={{ filter: `drop-shadow(0 0 4px ${n.color || cfg.color}40)` }} onError={e => { e.currentTarget.style.display = "none"; }} />
                        ) : (
                          <span style={{ fontSize: 18, color: n.color || cfg.color }}>{n.icon || "◆"}</span>
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: n.read ? "rgba(255,255,255,0.5)" : "#e8e8e8" }}>{n.title}</p>
                        <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.25)" }}>{n.message}</p>
                      </div>
                      {/* Time */}
                      <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{timeAgo(n.at)}</span>
                      {/* Unread dot */}
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#60a5fa", boxShadow: "0 0 4px #60a5fa" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
