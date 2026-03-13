"use client";

import { useState } from "react";
import type { User, ShopItem } from "@/app/types";
import shopData from "../public/data/shopItems.json";

const GEAR_TIERS_CLIENT = shopData.gearTiers;
const SHOP_ITEMS_LIST: ShopItem[] = shopData.items as ShopItem[];

// ─── Main ShopView (no Gacha — moved to GachaView) ─────────────────────────
export default function ShopView({ users, playerName, reviewApiKey, onBuy, onGearBuy }: {
  users: User[];
  playerName: string;
  reviewApiKey: string;
  onBuy: (userId: string, itemId: string) => void;
  onGearBuy: (userId: string, gearId: string) => void;
}) {
  const loggedIn = playerName && reviewApiKey;
  const user = loggedIn ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;
  const gold = user?.gold ?? 0;
  const currentGear = user?.gear;
  const currentTier = GEAR_TIERS_CLIENT.find(g => g.id === (currentGear || "worn"))?.tier ?? 0;

  if (!loggedIn || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <span className="text-4xl">x</span>
        <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>The Bazaar</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Sign in to enter the Bazaar and spend your hard-earned gold!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>The Bazaar</span>
        <div className="flex items-center gap-2 ml-auto">
          <span style={{ fontSize: 18 }}>x</span>
          <span className="text-base font-mono font-bold" style={{ color: "#f59e0b" }}>{gold}</span>
        </div>
      </div>

      {/* Rewards */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Rewards</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {SHOP_ITEMS_LIST.map(item => {
            const canAfford = gold >= item.cost;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{item.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{item.desc}</p>
                </div>
                <button
                  onClick={() => canAfford && onBuy(user.id, item.id)}
                  disabled={!canAfford}
                  className="shop-buy-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                  style={{
                    background: canAfford ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                    color: canAfford ? "#f59e0b" : "rgba(255,255,255,0.2)",
                    border: `1px solid ${canAfford ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  x {item.cost}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workshop / Gear */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(99,102,241,0.7)" }}>Workshop</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {GEAR_TIERS_CLIENT.filter(g => g.tier > 0).map(gear => {
            const owned = gear.tier <= currentTier;
            const canBuy = !owned && gear.tier === currentTier + 1 && gold >= gear.cost;
            return (
              <div
                key={gear.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "#1e1e1e", border: `1px solid ${owned ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.07)"}` }}
              >
                <span className="text-2xl flex-shrink-0">{gear.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: owned ? "#a78bfa" : "#f0f0f0" }}>
                    {gear.name} {owned && "x"}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{gear.desc}</p>
                </div>
                {!owned && (
                  <button
                    onClick={() => canBuy && onGearBuy(user.id, gear.id)}
                    disabled={!canBuy}
                    className="shop-buy-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                    style={{
                      background: canBuy ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                      color: canBuy ? "#a78bfa" : "rgba(255,255,255,0.2)",
                      border: `1px solid ${canBuy ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    x {gear.cost}
                  </button>
                )}
                {owned && <span className="text-xs px-2.5 py-1" style={{ color: "rgba(99,102,241,0.5)" }}>Owned</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
