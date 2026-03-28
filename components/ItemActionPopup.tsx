"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { CharacterData } from "@/app/types";
import { RARITY_COLORS, STAT_LABELS } from "@/app/constants";

type InventoryItem = CharacterData["inventory"][number];

const RARITY_BG: Record<string, string> = {
  common: "rgba(156,163,175,0.08)",
  uncommon: "rgba(34,197,94,0.1)",
  rare: "rgba(59,130,246,0.12)",
  epic: "rgba(168,85,247,0.15)",
  legendary: "rgba(249,115,22,0.18)",
};

interface ItemActionPopupProps {
  item: InventoryItem;
  anchorRect: { x: number; y: number; width: number; height: number };
  playerLevel: number;
  isEquipped: boolean;
  equippedSlot?: string;
  onEquip: (itemId: string) => Promise<void>;
  onUnequip: (slot: string) => Promise<void>;
  onUse: (itemId: string) => Promise<void>;
  onDiscard: (itemId: string) => Promise<void>;
  onLock?: (itemId: string) => Promise<void>;
  onClose: () => void;
}

export default function ItemActionPopup({
  item, anchorRect, playerLevel, isEquipped, equippedSlot,
  onEquip, onUnequip, onUse, onDiscard, onLock, onClose,
}: ItemActionPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);

  const itemType = item.type || "consumable";
  const rarityColor = RARITY_COLORS[item.rarity] || "#9ca3af";
  const hasStats = item.stats && Object.keys(item.stats).length > 0;
  const meetsLevel = !item.minLevel || playerLevel >= item.minLevel;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [onClose]);

  // Position popup near the clicked item
  const popupStyle: React.CSSProperties = (() => {
    const pw = Math.min(280, window.innerWidth - 40);
    const ph = 400;
    let left = anchorRect.x + anchorRect.width + 8;
    let top = anchorRect.y;
    if (left + pw > window.innerWidth - 8) left = anchorRect.x - pw - 8;
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
    if (top < 4) top = 4;
    if (left < 4) left = 4;
    return { position: "fixed" as const, left, top, width: pw, zIndex: 200 };
  })();

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const content = (
    <div ref={ref} style={popupStyle}>
      <div
        className="rounded-xl p-3 space-y-2.5"
        style={{
          background: "#1a1a1a",
          border: `1px solid ${rarityColor}50`,
          borderTop: `3px solid ${rarityColor}`,
          boxShadow: `0 12px 40px rgba(0,0,0,0.8), 0 0 20px ${rarityColor}15`,
        }}
      >
        {/* Header: Icon + Name */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: 56, height: 56, background: RARITY_BG[item.rarity] || "rgba(255,255,255,0.04)", borderRadius: 8, border: `1px solid ${rarityColor}40` }}
          >
            {item.icon
              ? <img src={item.icon} alt={item.name} width={48} height={48} style={{ imageRendering: "auto", objectFit: "contain" }} onError={e => { e.currentTarget.style.display = "none"; }} />
              : <span className="text-2xl" style={{ color: rarityColor }}>◆</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold truncate" style={{ color: "#fff" }}>{item.name}</p>
              {item.locked && <span title="Locked" style={{ color: "#fbbf24", fontSize: 12, flexShrink: 0 }}>{"\u29BF"}</span>}
            </div>
            <p className="text-xs font-semibold" style={{ color: rarityColor }}>
              {item.rarity?.charAt(0).toUpperCase() + item.rarity?.slice(1)}
              {itemType === "equipment" && item.slot ? ` · ${item.slot}` : ""}
            </p>
            {item.minLevel > 0 && (
              <p className="text-xs" style={{ color: meetsLevel ? "rgba(255,255,255,0.3)" : "#ef4444" }}>
                Lv. {item.minLevel}{!meetsLevel ? " (too low)" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Binding badge */}
        {item.bound ? (
          <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>Soulbound</p>
        ) : item.binding === "boe" ? (
          <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>Bind on Equip</p>
        ) : item.binding === "bop" ? (
          <p className="text-xs font-semibold" style={{ color: "#f97316" }}>Bind on Pickup</p>
        ) : null}

        {/* Description */}
        {item.desc && (
          <p className="text-xs leading-relaxed break-words overflow-hidden" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>
        )}

        {/* Flavor text */}
        {item.flavorText && (
          <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.3)" }}>{item.flavorText}</p>
        )}

        {/* Stats */}
        {hasStats && (
          <div className="space-y-0.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {Object.entries(item.stats).map(([stat, val]) => (
              <div key={stat} className="flex items-center justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{STAT_LABELS[stat] || stat}</span>
                <span className="font-mono font-semibold" style={{ color: "#4ade80" }}>+{val as number}</span>
              </div>
            ))}
          </div>
        )}

        {/* Passive badge */}
        {itemType === "passive" && (
          <div className="px-2 py-1 rounded-lg text-xs font-semibold text-center" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
            Active while in inventory
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-1.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Equipment actions */}
          {itemType === "equipment" && !isEquipped && meetsLevel && (
            <button
              onClick={() => wrap(() => onEquip(item.id))}
              disabled={busy}
              className="w-full py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", cursor: busy ? "not-allowed" : "pointer" }}
              title={busy ? "Action in progress\u2026" : "Equip this item"}
            >{busy ? "…" : "Equip"}</button>
          )}
          {itemType === "equipment" && !isEquipped && !meetsLevel && (
            <button
              disabled
              className="w-full py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.06)", cursor: "not-allowed" }}
              title={`Level ${item.minLevel} required to equip`}
            >Lv. {item.minLevel} required</button>
          )}
          {itemType === "equipment" && isEquipped && equippedSlot && (
            <button
              onClick={() => wrap(() => onUnequip(equippedSlot))}
              disabled={busy}
              className="w-full py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", cursor: busy ? "not-allowed" : "pointer" }}
              title={busy ? "Action in progress\u2026" : "Unequip this item"}
            >{busy ? "…" : "Unequip"}</button>
          )}

          {/* Consumable actions */}
          {itemType === "consumable" && (
            <button
              onClick={() => wrap(() => onUse(item.id))}
              disabled={busy}
              className="w-full py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)", cursor: busy ? "not-allowed" : "pointer" }}
              title={busy ? "Action in progress\u2026" : "Use this item"}
            >{busy ? "…" : "Use"}</button>
          )}

          {/* Lock toggle */}
          {!isEquipped && onLock && (
            <button
              onClick={() => wrap(() => onLock(item.id))}
              disabled={busy}
              className="w-full py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: item.locked ? "rgba(250,204,21,0.12)" : "rgba(255,255,255,0.03)",
                color: item.locked ? "#fbbf24" : "rgba(255,255,255,0.35)",
                border: `1px solid ${item.locked ? "rgba(250,204,21,0.3)" : "rgba(255,255,255,0.06)"}`,
                cursor: busy ? "not-allowed" : "pointer",
              }}
              title={item.locked ? "Unlock this item (allows discard/salvage/trade)" : "Lock this item (prevents discard/salvage/trade)"}
            >{item.locked ? "Unlock" : "Lock"}</button>
          )}

          {/* Discard */}
          {!isEquipped && !item.locked && !confirmDiscard && (
            <button
              onClick={() => setConfirmDiscard(true)}
              className="w-full py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
              title="Permanently destroy this item"
            >Discard</button>
          )}
          {confirmDiscard && (
            <div className="space-y-1">
              <p className="text-xs text-center" style={{ color: "#f87171" }}>
                Are you sure you want to discard {item.name}?
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => wrap(() => onDiscard(item.id))}
                  disabled={busy}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", cursor: busy ? "not-allowed" : "pointer" }}
                  title={busy ? "Action in progress\u2026" : "Confirm discard"}
                >{busy ? "…" : "Discard"}</button>
                <button
                  onClick={() => setConfirmDiscard(false)}
                  className="flex-1 py-1.5 rounded-lg text-xs"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
                >Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
