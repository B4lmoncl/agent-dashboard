"use client";

import { useState } from "react";
import type { User, ShopItem } from "@/app/types";
import { useDashboard } from "@/app/DashboardContext";
import { Tip } from "@/components/GameTooltip";
import shopData from "../public/data/shopItems.json";

const GEAR_TIERS_CLIENT = shopData.gearTiers;
const SHOP_ITEMS_LIST: ShopItem[] = shopData.items as ShopItem[];

// ─── Main ShopView (no Gacha — moved to GachaView) ─────────────────────────
export default function ShopView({ onBuy, onGearBuy }: {
  onBuy: (userId: string, itemId: string) => void;
  onGearBuy: (userId: string, gearId: string) => void;
}) {
  const { users, playerName, reviewApiKey } = useDashboard();
  const loggedIn = playerName && reviewApiKey;
  const user = loggedIn ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;
  const gold = user?.gold ?? 0;
  const currentGear = user?.gear;
  const currentTier = GEAR_TIERS_CLIENT.find(g => g.id === (currentGear || "worn"))?.tier ?? 0;

  if (!loggedIn || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <span className="text-4xl">○</span>
        <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>The Bazaar</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Sign in to enter the Bazaar and spend your hard-earned gold!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 tab-content-enter">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <Tip k="bazaar" heading><span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>The Bazaar</span></Tip>
          <p className="text-xs italic mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Handel und Komfort. Jeder Held braucht eine Pause zwischen den Quests.</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <img src="/images/icons/currency-gold.png" alt="" width={24} height={24} style={{ imageRendering: "auto" }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />
          <span className="text-base font-mono font-bold" style={{ color: "#f59e0b" }}>{gold.toLocaleString()}</span>
        </div>
      </div>

      {/* Boosts & Buffs */}
      {SHOP_ITEMS_LIST.filter(i => i.category === "boost").length > 0 && (
        <div>
          <Tip k="bazaar"><p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(139,92,246,0.6)", cursor: "help" }}>Boosts &amp; Buffs</p></Tip>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {SHOP_ITEMS_LIST.filter(i => i.category === "boost").map(item => {
              const canAfford = gold >= item.cost;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}
                >
                  {item.icon && item.icon.startsWith("/") ? <img src={item.icon} alt="" style={{ width: 40, height: 40, imageRendering: "auto" }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> : <span className="text-2xl flex-shrink-0">{item.icon}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>{item.name}</p>
                    <p className="text-xs" style={{ color: "rgba(196,181,253,0.5)" }}>{item.desc}</p>
                  </div>
                  <button
                    onClick={() => canAfford && onBuy(user.id, item.id)}
                    disabled={!canAfford}
                    className="shop-buy-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                    title={canAfford ? `Buy for ${item.cost} gold` : `Insufficient gold (need ${item.cost}, have ${gold})`}
                    style={{
                      background: canAfford ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                      color: canAfford ? "#a78bfa" : "rgba(255,255,255,0.2)",
                      border: `1px solid ${canAfford ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                      cursor: canAfford ? "pointer" : "not-allowed",
                    }}
                  >
                    <img src="/images/icons/currency-gold.png" alt="" width={20} height={20} style={{ imageRendering: "auto", display: "inline", verticalAlign: "middle", marginRight: 2 }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> {item.cost}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Self-Care Rewards */}
      <div>
        <Tip k="bazaar"><p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)", cursor: "help" }}>Self-Care Rewards</p></Tip>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {SHOP_ITEMS_LIST.filter(i => !i.category || i.category === "self-care").map(item => {
            const canAfford = gold >= item.cost;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                {item.icon && item.icon.startsWith("/") ? <img src={item.icon} alt="" style={{ width: 40, height: 40, imageRendering: "auto" }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> : <span className="text-2xl flex-shrink-0">{item.icon}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{item.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{item.desc}</p>
                </div>
                <button
                  onClick={() => canAfford && onBuy(user.id, item.id)}
                  disabled={!canAfford}
                  className="shop-buy-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                  title={canAfford ? `Buy for ${item.cost} gold` : `Insufficient gold (need ${item.cost}, have ${gold})`}
                  style={{
                    background: canAfford ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                    color: canAfford ? "#f59e0b" : "rgba(255,255,255,0.2)",
                    border: `1px solid ${canAfford ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
                    cursor: canAfford ? "pointer" : "not-allowed",
                  }}
                >
                  <img src="/images/icons/currency-gold.png" alt="" width={20} height={20} style={{ imageRendering: "auto", display: "inline", verticalAlign: "middle", marginRight: 2 }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> {item.cost}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workshop Tools moved to Artisan's Quarter */}
    </div>
  );
}
