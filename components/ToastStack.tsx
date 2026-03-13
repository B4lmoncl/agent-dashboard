"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { EarnedAchievement } from "@/app/types";
import { typeConfig } from "@/app/config";

// ─── Toast Types ─────────────────────────────────────────────────────────────
export type ToastItem =
  | { type: "flavor"; id: string; message: string; icon: string; sub?: string }
  | { type: "achievement"; id: string; achievement: EarnedAchievement }
  | { type: "chain"; id: string; parentTitle: string; template: { title: string; description?: string | null; type?: string; priority?: string }; onAccept: () => void }
  | { type: "purchase"; id: string; message: string };

export type ToastInput =
  | { type: "flavor"; message: string; icon: string; sub?: string }
  | { type: "achievement"; achievement: EarnedAchievement }
  | { type: "chain"; parentTitle: string; template: { title: string; description?: string | null; type?: string; priority?: string }; onAccept: () => void }
  | { type: "purchase"; message: string };

const TOAST_DURATION: Record<ToastItem["type"], number> = {
  flavor: 4000,
  achievement: 5000,
  chain: 8000,
  purchase: 3000,
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

function FlavorToastContent({ toast, onClose }: { toast: { message: string; icon: string; sub?: string }; onClose: () => void }) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ background: "#1e2a1e", border: "1px solid rgba(34,197,94,0.4)", boxShadow: "0 8px 32px rgba(34,197,94,0.15)", maxWidth: 320, width: "100%" }}
    >
      <span className="text-2xl flex-shrink-0">{toast.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: "#22c55e" }}>{toast.message}</p>
        {toast.sub && <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{toast.sub}</p>}
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>x</button>
    </div>
  );
}

function AchievementToastContent({ achievement, onClose }: { achievement: EarnedAchievement; onClose: () => void }) {
  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center gap-4 shadow-2xl"
      style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.5)", boxShadow: "0 8px 48px rgba(245,158,11,0.3)", maxWidth: 360, width: "100%" }}
    >
      <span className="text-2xl flex-shrink-0">{achievement.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: "#f59e0b" }}>Achievement Unlocked!</p>
        <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{achievement.name}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{achievement.desc}</p>
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }}>x</button>
    </div>
  );
}

function ChainToastContent({ parentTitle, template, onAccept, onClose }: {
  parentTitle: string;
  template: { title: string; description?: string | null; type?: string; priority?: string };
  onAccept: () => void;
  onClose: () => void;
}) {
  const typeCfg = template.type ? (typeConfig[template.type] ?? null) : null;
  return (
    <div
      className="rounded-xl px-4 py-3 shadow-2xl"
      style={{ background: "#252525", border: "1px solid rgba(139,92,246,0.5)", boxShadow: "0 8px 32px rgba(139,92,246,0.2)", maxWidth: 320, width: "100%" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">x</span>
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
                {typeCfg.icon} {typeCfg.label}
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
        <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>x</button>
      </div>
    </div>
  );
}

function PurchaseToastContent({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-2 shadow-2xl"
      style={{ background: "#1a1a1a", border: "1px solid rgba(245,158,11,0.5)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", maxWidth: 280, width: "100%" }}
    >
      <span style={{ fontSize: "16px" }}>x</span>
      <span className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{message}</span>
      <button onClick={onClose} className="ml-auto" style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>x</button>
    </div>
  );
}

// ─── Single Toast Wrapper with auto-dismiss + slide animation ────────────────
function ToastWrapper({ toast, index, onRemove }: { toast: ToastItem; index: number; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 20);
    // Auto-dismiss
    const duration = TOAST_DURATION[toast.type];
    const dismissTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);
    return () => { clearTimeout(enterTimer); clearTimeout(dismissTimer); };
  }, [toast.id, toast.type, onRemove]);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  }, [toast.id, onRemove]);

  return (
    <div
      style={{
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: visible && !exiting ? 1 : 0,
        transform: visible && !exiting ? "translateX(0)" : "translateX(40px)",
        marginBottom: 8,
        pointerEvents: "auto",
      }}
    >
      {toast.type === "flavor" && <FlavorToastContent toast={toast} onClose={handleClose} />}
      {toast.type === "achievement" && <AchievementToastContent achievement={toast.achievement} onClose={handleClose} />}
      {toast.type === "chain" && <ChainToastContent parentTitle={toast.parentTitle} template={toast.template} onAccept={toast.onAccept} onClose={handleClose} />}
      {toast.type === "purchase" && <PurchaseToastContent message={toast.message} onClose={handleClose} />}
    </div>
  );
}

// ─── Toast Stack Container ───────────────────────────────────────────────────
export function ToastStack({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[150] flex flex-col-reverse items-end"
      style={{
        bottom: 24,
        right: 24,
        pointerEvents: "none",
        maxWidth: 380,
      }}
    >
      {toasts.map((toast, i) => (
        <ToastWrapper key={toast.id} toast={toast} index={i} onRemove={onRemove} />
      ))}
    </div>
  );
}
