"use client";

import { useEffect } from "react";
import type { EarnedAchievement } from "@/app/types";
import { typeConfig } from "@/app/config";

// ─── Chain Quest Toast ────────────────────────────────────────────────────────
export function ChainQuestToast({ parentTitle, template, onAccept, onDismiss }: {
  parentTitle: string;
  template: { title: string; description?: string | null; type?: string; priority?: string };
  onAccept: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  const typeCfg = template.type ? (typeConfig[template.type] ?? null) : null;
  return (
    <div
      className="fixed bottom-36 right-6 z-50 rounded-xl px-4 py-3 shadow-2xl"
      style={{ background: "#252525", border: "1px solid rgba(139,92,246,0.5)", boxShadow: "0 8px 32px rgba(139,92,246,0.2)", maxWidth: 320 }}
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
              onClick={onAccept}
              className="flex-1 text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}
            >
              Accept Quest
            </button>
            <button
              onClick={onDismiss}
              className="text-xs px-2 py-1.5 rounded"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Skip
            </button>
          </div>
        </div>
        <button onClick={onDismiss} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>×</button>
      </div>
    </div>
  );
}

// ─── Achievement Toast ────────────────────────────────────────────────────────
export function AchievementToast({ achievement, onClose }: { achievement: EarnedAchievement; onClose: () => void }) {
  // Scroll lock while toast is visible
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", pointerEvents: "auto" }} onClick={onClose}>
    <div
      className="rounded-xl px-6 py-5 flex items-center gap-4 shadow-2xl"
      style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.5)", boxShadow: "0 8px 48px rgba(245,158,11,0.3)", maxWidth: 360, pointerEvents: "auto" }}
      onClick={e => e.stopPropagation()}
    >
      {achievement.icon && achievement.icon.startsWith("/")
        ? <img src={achievement.icon} alt="" width={32} height={32} className="flex-shrink-0 img-render-auto" style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
        : <span className="text-2xl flex-shrink-0">{achievement.icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: "#f59e0b" }}>Achievement Unlocked!</p>
        <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{achievement.name}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{achievement.desc}</p>
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }}>×</button>
    </div>
    </div>
  );
}

// ─── Flavor Toast ─────────────────────────────────────────────────────────────
export function FlavorToast({ toast, onClose }: { toast: { message: string; icon: string; sub?: string }; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className="fixed bottom-6 right-6 z-[110] rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ background: "#1e2a1e", border: "1px solid rgba(34,197,94,0.4)", boxShadow: "0 8px 32px rgba(34,197,94,0.15)", maxWidth: 280 }}
    >
      {toast.icon.startsWith("/") ? <img src={toast.icon} alt="" style={{width:28,height:28,imageRendering:"auto"}} className="flex-shrink-0" onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-2xl flex-shrink-0">{toast.icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: "#22c55e" }}>{toast.message}</p>
        {toast.sub && <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{toast.sub}</p>}
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>×</button>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>{message}</p>
      {sub && <p className="text-xs mt-2 font-mono" style={{ color: "rgba(255,68,68,0.3)" }}>{sub}</p>}
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div
      className="rounded-xl animate-pulse"
      style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.05)", height: 260 }}
    />
  );
}
