"use client";

import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { RARITY_COLORS, STAT_LABELS } from "@/app/constants";
import { formatLegendaryLabel } from "@/app/utils";
import { Tip } from "@/components/GameTooltip";

const RARITY_BG: Record<string, string> = {
  common: "rgba(156,163,175,0.08)",
  uncommon: "rgba(34,197,94,0.1)",
  rare: "rgba(59,130,246,0.12)",
  epic: "rgba(168,85,247,0.15)",
  legendary: "rgba(249,115,22,0.18)",
  unique: "rgba(230,204,128,0.12)",
};

/**
 * Minimal item shape — works for gear instances, inventory items, gacha pulls,
 * crafting recipes, loot drops, trade items. Each field is optional so any
 * view can pass whatever data it has.
 */
export interface TooltipItem {
  name: string;
  rarity?: string;
  icon?: string | null;
  slot?: string | null;
  stats?: Record<string, number> | null;
  desc?: string | null;
  flavorText?: string | null;
  legendaryEffect?: { type: string; label?: string; value?: number } | null;
  sockets?: (string | null)[] | null;
  setId?: string | null;
  binding?: string | null;
  bound?: boolean;
  locked?: boolean;
  minLevel?: number;
  tier?: number;
  suffix?: { name: string; color?: string; stats?: Record<string, number> } | null;
  passiveEffect?: string | null;
  passiveDesc?: string | null;
}

interface Props {
  item: TooltipItem;
  onClose: () => void;
  /** If provided, positions near the anchor. Otherwise centered as modal. */
  anchorRect?: { x: number; y: number; width: number; height: number } | null;
  /** Extra content rendered below the item info (e.g. action buttons) */
  children?: React.ReactNode;
}

const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; };

export default function ItemTooltip({ item, onClose, anchorRect, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [onClose]);

  const rarityColor = RARITY_COLORS[item.rarity || "common"] || "#9ca3af";
  const hasStats = item.stats && Object.keys(item.stats).length > 0;
  const sockets = item.sockets && Array.isArray(item.sockets) ? item.sockets : null;
  const filledSockets = sockets ? sockets.filter(Boolean).length : 0;

  // Position: near anchor if provided, otherwise centered modal
  const popupStyle: React.CSSProperties = anchorRect ? (() => {
    const pw = Math.min(280, window.innerWidth - 40);
    const ph = 420;
    let left = anchorRect.x + anchorRect.width + 8;
    let top = anchorRect.y;
    if (left + pw > window.innerWidth - 8) left = anchorRect.x - pw - 8;
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
    if (top < 4) top = 4;
    if (left < 4) left = 4;
    return { position: "fixed" as const, left, top, width: pw, zIndex: 250 };
  })() : { position: "fixed" as const, top: "50%", left: "50%", transform: "translateX(-50%) translateY(-50%)", width: Math.min(300, (typeof window !== "undefined" ? window.innerWidth : 400) - 40), zIndex: 250 };

  const content = (
    <div
      className={anchorRect ? "" : "fixed inset-0 z-[100]"}
      style={anchorRect ? undefined : { background: "rgba(0,0,0,0.5)" }}
      onClick={anchorRect ? undefined : (e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} style={popupStyle}>
        <div
          className="rounded-xl p-3.5 space-y-2.5 tab-content-enter"
          style={{
            background: "#1a1a1a",
            border: `1px solid ${rarityColor}50`,
            borderTop: `3px solid ${rarityColor}`,
            boxShadow: `0 12px 40px rgba(0,0,0,0.8), 0 0 20px ${rarityColor}15`,
          }}
        >
          {/* Header: Icon + Name + Rarity */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 56, height: 56, background: RARITY_BG[item.rarity || "common"], borderRadius: 8, border: `1px solid ${rarityColor}40` }}
            >
              {item.icon
                ? <img src={item.icon} alt={item.name} width={48} height={48} style={{ imageRendering: "auto", objectFit: "contain" }} onError={hideOnError} />
                : <span className="text-2xl" style={{ color: rarityColor }}>◆</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold truncate" style={{ color: "#fff" }}>{item.name}</p>
                {item.locked && <span title="Locked" style={{ color: "#fbbf24", fontSize: 12, flexShrink: 0 }}>{"\u29BF"}</span>}
              </div>
              <p className="text-xs font-semibold" style={{ color: rarityColor }}>
                {(item.rarity || "common").charAt(0).toUpperCase() + (item.rarity || "common").slice(1)}
                {item.slot ? ` · ${item.slot.charAt(0).toUpperCase() + item.slot.slice(1)}` : ""}
              </p>
              {item.minLevel && item.minLevel > 0 && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Req. Level {item.minLevel}</p>
              )}
            </div>
          </div>

          {/* Binding */}
          {item.bound ? (
            <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>Soulbound</p>
          ) : item.binding === "boe" ? (
            <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>Bind on Equip</p>
          ) : item.binding === "bop" ? (
            <p className="text-xs font-semibold" style={{ color: "#f97316" }}>Bind on Pickup</p>
          ) : null}

          {/* Stats */}
          {hasStats && (
            <div className="space-y-0.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              {Object.entries(item.stats!).map(([stat, val]) => {
                const statKey = stat.toLowerCase().replace("ä", "ae").replace("ü", "ue");
                return (
                  <div key={stat} className="flex items-center justify-between text-xs">
                    <Tip k={statKey}><span style={{ color: "rgba(255,255,255,0.55)", cursor: "help" }}>{STAT_LABELS[stat] || stat}</span></Tip>
                    <span className="font-mono font-semibold" style={{ color: "#4ade80" }}>+{val}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sockets */}
          {sockets && sockets.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Sockets</span>
              <div className="flex gap-1 ml-auto">
                {sockets.map((s, i) => (
                  <span key={i} className="w-3 h-3 rounded-full" style={{
                    background: s ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.06)",
                    border: `1.5px solid ${s ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.15)"}`,
                  }} title={s || "Empty"} />
                ))}
              </div>
              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>{filledSockets}/{sockets.length}</span>
            </div>
          )}

          {/* Legendary Effect */}
          {item.legendaryEffect && (
            <div className="pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs font-semibold" style={{ color: "#f97316" }}>
                {item.legendaryEffect.label || formatLegendaryLabel(item.legendaryEffect)}
                {item.legendaryEffect.value ? ` (${item.legendaryEffect.value}%)` : ""}
              </p>
            </div>
          )}

          {/* Set ID */}
          {item.setId && (
            <p className="text-xs" style={{ color: "#a78bfa" }}>Set: {item.setId}</p>
          )}

          {/* Passive */}
          {item.passiveEffect && (
            <div className="px-2 py-1 rounded-lg text-xs text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" }}>
              {item.passiveDesc || item.passiveEffect}
            </div>
          )}

          {/* Description */}
          {item.desc && (
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{item.desc}</p>
          )}

          {/* Flavor Text */}
          {item.flavorText && (
            <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.25)" }}>&ldquo;{item.flavorText}&rdquo;</p>
          )}

          {/* Suffix */}
          {item.suffix && (
            <p className="text-xs" style={{ color: item.suffix.color || "#818cf8" }}>
              {item.suffix.name}: {Object.entries(item.suffix.stats || {}).map(([s, v]) => `+${v} ${STAT_LABELS[s] || s}`).join(", ")}
            </p>
          )}

          {/* Children (action buttons etc.) */}
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}
