"use client";

import type { ShopItem } from "@/app/types";
import { useModalBehavior } from "./ModalPortal";
import shopData from "../public/data/shopItems.json";

const ITEMS_CLIENT: ShopItem[] = shopData.items as ShopItem[];
const GEAR_TIERS_CLIENT = shopData.gearTiers;

export function ShopModal({ userId, userName, gold, currentGear, onClose, onBuy, onGearBuy }: {
  userId: string;
  userName: string;
  gold: number;
  currentGear?: string;
  onClose: () => void;
  onBuy: (userId: string, itemId: string) => void;
  onGearBuy?: (userId: string, gearId: string) => void;
}) {
  useModalBehavior(true, onClose);
  const ITEMS = ITEMS_CLIENT;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-5 w-full max-w-sm"
        style={{ background: "#1e1e1e", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 40px rgba(245,158,11,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>Forge Shop</h3>
            <p className="text-xs inline-flex items-center gap-1" style={{ color: "rgba(255,255,255,0.3)" }}>{userName} · <img src="/images/icons/currency-gold.png" alt="" width={20} height={20} style={{ imageRendering: "smooth" }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> {gold} gold</p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }}>×</button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
          {ITEMS.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <img src={item.icon} alt={item.name} className="w-6 h-6 flex-shrink-0" style={{ imageRendering: "smooth" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{item.name}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{item.desc}</p>
              </div>
              <button
                onClick={() => gold >= item.cost && onBuy(userId, item.id)}
                disabled={gold < item.cost}
                className="shop-buy-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                style={{
                  background: gold >= item.cost ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                  color: gold >= item.cost ? "#f59e0b" : "rgba(255,255,255,0.2)",
                  border: `1px solid ${gold >= item.cost ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <img src="/images/icons/currency-gold.png" alt="" width={20} height={20} style={{ imageRendering: "smooth", display: "inline", verticalAlign: "middle", marginRight: 2 }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> {item.cost}
              </button>
            </div>
          ))}

          {/* Gear upgrade section */}
          {onGearBuy && (
            <>
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(99,102,241,0.7)" }}>Workshop Tools</p>
              </div>
              {GEAR_TIERS_CLIENT.filter(g => g.tier > 0).map(gear => {
                const currentTier = GEAR_TIERS_CLIENT.find(g => g.id === (currentGear || "worn"))?.tier ?? 0;
                const owned = gear.tier <= currentTier;
                const canBuy = !owned && gear.tier === currentTier + 1 && gold >= gear.cost;
                return (
                  <div
                    key={gear.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: owned ? "rgba(99,102,241,0.1)" : "#252525",
                      border: `1px solid ${owned ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)"}`,
                      opacity: owned || canBuy || gear.tier === currentTier + 1 ? 1 : 0.4,
                    }}
                  >
                    <img src={gear.icon} alt={gear.name} className="w-6 h-6 flex-shrink-0" style={{ imageRendering: "smooth" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: owned ? "#818cf8" : "#f0f0f0" }}>
                        {gear.name} {owned ? "✓" : ""}
                      </p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{gear.desc}</p>
                    </div>
                    {!owned && (
                      <button
                        onClick={() => canBuy && onGearBuy(userId, gear.id)}
                        disabled={!canBuy}
                        className="shop-buy-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                        style={{
                          background: canBuy ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                          color: canBuy ? "#818cf8" : "rgba(255,255,255,0.2)",
                          border: `1px solid ${canBuy ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                        }}
                      >
                        <img src="/images/icons/currency-gold.png" alt="" width={20} height={20} style={{ imageRendering: "smooth", display: "inline", verticalAlign: "middle", marginRight: 2 }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> {gear.cost}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
