"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { EarnedAchievement } from "@/app/types";
import { typeConfig } from "@/app/config";

// ─── Toast Types ─────────────────────────────────────────────────────────────
export type ToastItem =
  | { type: "flavor"; id: string; message: string; icon: string; sub?: string }
  | { type: "achievement"; id: string; achievement: EarnedAchievement }
  | { type: "chain"; id: string; parentTitle: string; template: { title: string; description?: string | null; type?: string }; onAccept: () => void }
  | { type: "purchase"; id: string; message: string }
  | { type: "item"; id: string; itemName: string; message: string; icon?: string; rarity: string }
  | { type: "companionBond"; id: string; companionName: string; companionEmoji: string; bondXpGained: number; newBondXp: number; bondTitle: string; bondLevelUp: boolean }
  | { type: "error"; id: string; message: string; onRetry?: () => void };

export type ToastInput =
  | { type: "flavor"; message: string; icon: string; sub?: string }
  | { type: "achievement"; achievement: EarnedAchievement }
  | { type: "chain"; parentTitle: string; template: { title: string; description?: string | null; type?: string }; onAccept: () => void }
  | { type: "purchase"; message: string }
  | { type: "item"; itemName: string; message: string; icon?: string; rarity: string }
  | { type: "companionBond"; companionName: string; companionEmoji: string; bondXpGained: number; newBondXp: number; bondTitle: string; bondLevelUp: boolean }
  | { type: "error"; message: string; onRetry?: () => void };

const TOAST_DURATION: Record<ToastItem["type"], number> = {
  flavor: 4000,
  achievement: 5000,
  chain: 8000,
  purchase: 3000,
  item: 3000,
  companionBond: 5500,
  error: 5000,
};

const MAX_VISIBLE = 4;

// ─── Toast Stack Manager ─────────────────────────────────────────────────────
export function useToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((toast: ToastInput) => {
    const id = `toast-${Date.now()}-${counterRef.current++}`;
    const newToast = { ...toast, id } as ToastItem;
    setToasts(prev => {
      const next = [...prev, newToast];
      // evict oldest if over max
      if (next.length > MAX_VISIBLE) return next.slice(next.length - MAX_VISIBLE);
      return next;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

// ─── Individual Toast Renderers ──────────────────────────────────────────────

const RARITY_TOAST_STYLE: Record<string, { bg: string; border: string; shadow: string; color: string; label: string }> = {
  unique:    { bg: "#2a2510", border: "rgba(230,204,128,0.5)", shadow: "rgba(230,204,128,0.2)", color: "#e6cc80", label: "Unique" },
  legendary: { bg: "#2a1e0e", border: "rgba(249,115,22,0.5)", shadow: "rgba(249,115,22,0.2)", color: "#f97316", label: "Legendary" },
  epic:      { bg: "#1e1a2e", border: "rgba(168,85,247,0.5)", shadow: "rgba(168,85,247,0.2)", color: "#a855f7", label: "Epic" },
  rare:      { bg: "#0e1e2a", border: "rgba(59,130,246,0.5)", shadow: "rgba(59,130,246,0.2)", color: "#3b82f6", label: "Rare" },
  uncommon:  { bg: "#0e2a1e", border: "rgba(34,197,94,0.5)",  shadow: "rgba(34,197,94,0.2)",  color: "#22c55e", label: "Uncommon" },
  common:    { bg: "#1e2a1e", border: "rgba(156,163,175,0.4)", shadow: "rgba(156,163,175,0.15)", color: "#9ca3af", label: "Common" },
};

function FlavorToastContent({ toast, onClose }: { toast: { message: string; icon: string; sub?: string }; onClose: () => void }) {
  const rs = (toast.sub && RARITY_TOAST_STYLE[toast.sub]) || null;
  const bg = rs?.bg || "#1e2a1e";
  const border = rs?.border || "rgba(34,197,94,0.4)";
  const shadow = rs?.shadow || "rgba(34,197,94,0.15)";
  const color = rs?.color || "#22c55e";
  const label = rs?.label || toast.sub;

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ background: bg, border: `1px solid ${border}`, boxShadow: `0 8px 32px ${shadow}`, maxWidth: "100%", width: "100%" }}
    >
      {toast.icon && toast.icon.startsWith("/") ? <img src={toast.icon} alt="" width={28} height={28} style={{ imageRendering: "auto", flexShrink: 0 }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-2xl flex-shrink-0">{toast.icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color }}>{toast.message}</p>
        {label && <p className="text-xs mt-0.5 truncate font-medium" style={{ color }}>{label}</p>}
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>×</button>
    </div>
  );
}

function AchievementToastContent({ achievement, onClose, onAchievementClick }: { achievement: EarnedAchievement; onClose: () => void; onAchievementClick?: (id: string) => void }) {
  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center gap-4 shadow-2xl relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #252525, #1a1a08)", border: "1px solid rgba(245,158,11,0.5)", boxShadow: "0 8px 48px rgba(245,158,11,0.3), 0 0 20px rgba(245,158,11,0.1)", maxWidth: "100%", width: "100%", cursor: onAchievementClick ? "pointer" : undefined }}
      onClick={() => { if (onAchievementClick && achievement.id) { onAchievementClick(achievement.id); onClose(); } }}
    >
      {/* Achievement shimmer sweep */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg, transparent 35%, rgba(251,191,36,0.08) 45%, rgba(251,191,36,0.15) 50%, rgba(251,191,36,0.08) 55%, transparent 65%)", backgroundSize: "200% 100%", animation: "legendary-shimmer 2.5s ease-in-out infinite" }} />
      {achievement.icon && achievement.icon.startsWith("/") ? <img src={achievement.icon} alt="" width={28} height={28} style={{ imageRendering: "auto", flexShrink: 0 }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-2xl flex-shrink-0">{achievement.icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: "#f59e0b" }}>Achievement Unlocked!</p>
        <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{achievement.name}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{achievement.desc}</p>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ color: "rgba(255,255,255,0.3)" }}>×</button>
    </div>
  );
}

function ChainToastContent({ parentTitle, template, onAccept, onClose }: {
  parentTitle: string;
  template: { title: string; description?: string | null; type?: string };
  onAccept: () => void;
  onClose: () => void;
}) {
  const typeCfg = template.type ? (typeConfig[template.type] ?? null) : null;
  return (
    <div
      className="rounded-xl px-4 py-3 shadow-2xl"
      style={{ background: "#252525", border: "1px solid rgba(139,92,246,0.5)", boxShadow: "0 8px 32px rgba(139,92,246,0.2)", maxWidth: "100%", width: "100%" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">—</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold mb-0.5" style={{ color: "#a78bfa" }}>Quest Chain Available!</p>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Completed: <span style={{ color: "rgba(255,255,255,0.6)" }}>{parentTitle}</span>
          </p>
          <p className="text-sm font-semibold mb-1" style={{ color: "#e8e8e8" }}>{template.title}</p>
          {template.description && (
            <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>{template.description}</p>
          )}
          <div className="flex items-center gap-1 mb-3">
            {typeCfg && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: typeCfg.bg, color: typeCfg.color, border: `1px solid ${typeCfg.border}` }}>
                {typeCfg.icon?.startsWith("/") ? <img src={typeCfg.icon} alt="" width={14} height={14} style={{ imageRendering: "auto", display: "inline", verticalAlign: "middle" }} onError={(e) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> : typeCfg.icon} {typeCfg.label}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { onAccept(); onClose(); }}
              className="flex-1 text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}
            >
              Accept Quest
            </button>
            <button
              onClick={onClose}
              className="text-xs px-2 py-1.5 rounded"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Skip
            </button>
          </div>
        </div>
        <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>×</button>
      </div>
    </div>
  );
}

function ItemToastContent({ toast, onClose }: { toast: { itemName: string; message: string; icon?: string; rarity: string }; onClose: () => void }) {
  const rs = RARITY_TOAST_STYLE[toast.rarity] || RARITY_TOAST_STYLE.common;
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ background: rs.bg, border: `1px solid ${rs.border}`, boxShadow: `0 8px 32px ${rs.shadow}`, maxWidth: "100%", width: "100%" }}
    >
      {toast.icon && toast.icon.startsWith("/")
        ? <img src={toast.icon} alt="" width={32} height={32} style={{ imageRendering: "auto", flexShrink: 0 }} onError={e => { e.currentTarget.style.display = "none"; }} />
        : <span className="text-2xl flex-shrink-0" style={{ color: rs.color }}>◆</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: rs.color }}>{toast.itemName}</p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{toast.message}</p>
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>×</button>
    </div>
  );
}

function PurchaseToastContent({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-2 shadow-2xl"
      style={{ background: "#1a1a1a", border: "1px solid rgba(245,158,11,0.5)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", maxWidth: "100%", width: "100%" }}
    >
      <span style={{ fontSize: "16px" }}>—</span>
      <span className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{message}</span>
      <button onClick={onClose} className="ml-auto" style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>×</button>
    </div>
  );
}

function CompanionBondToastContent({ toast, onClose }: { toast: { companionName: string; companionEmoji: string; bondXpGained: number; newBondXp: number; bondTitle: string; bondLevelUp: boolean }; onClose: () => void }) {
  if (toast.bondLevelUp) {
    // Dramatic bond level-up toast — larger, animated, celebration feel
    return (
      <div
        className="rounded-xl px-5 py-4 flex items-center gap-4 shadow-2xl relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #2a1028 0%, #1e0a20 50%, #2a1028 100%)",
          border: "1px solid rgba(255,107,157,0.6)",
          boxShadow: "0 0 24px rgba(255,107,157,0.35), 0 8px 32px rgba(255,107,157,0.2), inset 0 0 20px rgba(255,107,157,0.05)",
          maxWidth: "100%",
          width: "100%",
          animation: "reward-burst-enter 0.4s ease-out",
        }}
      >
        {/* Subtle pulse glow behind emoji */}
        <div className="relative flex-shrink-0">
          <span className="absolute inset-0 rounded-full" style={{ background: "rgba(255,107,157,0.2)", filter: "blur(12px)", animation: "pulse 2s ease-in-out infinite" }} />
          <span className="text-3xl relative" style={{ filter: "drop-shadow(0 0 8px rgba(255,107,157,0.5))" }}>{toast.companionEmoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tracking-wide" style={{ color: "#ff6b9d", textShadow: "0 0 10px rgba(255,107,157,0.3)" }}>Bond Level Up!</p>
          <p className="text-base font-bold" style={{ color: "#f0f0f0" }}>{toast.companionName}</p>
          <p className="text-xs font-semibold" style={{ color: "rgba(255,107,157,0.7)" }}>{toast.bondTitle}</p>
        </div>
        <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>×</button>
      </div>
    );
  }
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ background: "#1e1a2e", border: "1px solid rgba(255,107,157,0.3)", boxShadow: "0 8px 32px rgba(255,107,157,0.1)", maxWidth: "100%", width: "100%" }}
    >
      <span className="text-2xl flex-shrink-0">{toast.companionEmoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: "#ff6b9d" }}>+{toast.bondXpGained} Bond XP</p>
        <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{toast.companionName}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{toast.bondTitle}</p>
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>×</button>
    </div>
  );
}

function ErrorToastContent({ message, onClose, onRetry }: { message: string; onClose: () => void; onRetry?: () => void }) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ background: "#2a1010", border: "1px solid rgba(239,68,68,0.5)", boxShadow: "0 8px 32px rgba(239,68,68,0.15)", maxWidth: "100%", width: "100%" }}
    >
      <span className="text-lg flex-shrink-0" style={{ color: "#ef4444" }}>!</span>
      <p className="text-sm font-medium flex-1" style={{ color: "#fca5a5" }}>{message}</p>
      {onRetry && (
        <button onClick={() => { onRetry(); onClose(); }} className="text-xs px-2 py-1 rounded font-semibold flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}>
          Retry
        </button>
      )}
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>×</button>
    </div>
  );
}

// ─── Single Toast Wrapper with auto-dismiss + slide animation ────────────────
function ToastWrapper({ toast, index, onRemove, onAchievementClick }: { toast: ToastItem; index: number; onRemove: (id: string) => void; onAchievementClick?: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 20);
    const duration = TOAST_DURATION[toast.type];
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);
    return () => { clearTimeout(enterTimer); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id, toast.type, onRemove]);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  }, [toast.id, onRemove]);

  const handleExpand = useCallback(() => {
    setExpanded(e => !e);
    // Pause auto-dismiss when expanded
    if (!expanded && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [expanded]);

  return (
    <div
      onClick={handleExpand}
      style={{
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: visible && !exiting ? 1 : 0,
        transform: visible && !exiting ? "translateX(0)" : "translateX(40px)",
        marginBottom: 8,
        pointerEvents: "auto",
        cursor: "pointer",
        maxWidth: expanded ? "min(480px, calc(100vw - 48px))" : undefined,
      }}
      title={expanded ? "Click to collapse" : "Click to expand"}
    >
      {toast.type === "flavor" && <FlavorToastContent toast={toast} onClose={handleClose} />}
      {toast.type === "achievement" && <AchievementToastContent achievement={toast.achievement} onClose={handleClose} onAchievementClick={onAchievementClick} />}
      {toast.type === "chain" && <ChainToastContent parentTitle={toast.parentTitle} template={toast.template} onAccept={toast.onAccept} onClose={handleClose} />}
      {toast.type === "purchase" && <PurchaseToastContent message={toast.message} onClose={handleClose} />}
      {toast.type === "item" && <ItemToastContent toast={toast} onClose={handleClose} />}
      {toast.type === "companionBond" && <CompanionBondToastContent toast={toast} onClose={handleClose} />}
      {toast.type === "error" && <ErrorToastContent message={toast.message} onClose={handleClose} onRetry={toast.onRetry} />}
    </div>
  );
}

// ─── Toast Stack Container ───────────────────────────────────────────────────
export function ToastStack({ toasts, onRemove, onAchievementClick }: { toasts: ToastItem[]; onRemove: (id: string) => void; onAchievementClick?: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[150] flex flex-col-reverse items-end"
      role="status"
      aria-live="polite"
      style={{
        bottom: 24,
        right: 24,
        pointerEvents: "none",
        maxWidth: "100%",
      }}
    >
      {toasts.map((toast, i) => (
        <ToastWrapper key={toast.id} toast={toast} index={i} onRemove={onRemove} onAchievementClick={onAchievementClick} />
      ))}
    </div>
  );
}
