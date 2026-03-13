"use client";

import { useState } from "react";
import type { User, ShopItem } from "@/app/types";

const GEAR_TIERS_CLIENT = [
  { id: "worn",       name: "Worn Tools",       cost: 0,    tier: 0, xpBonus: 0,  icon: "x", desc: "Starting gear. No bonus." },
  { id: "sturdy",     name: "Sturdy Tools",     cost: 100,  tier: 1, xpBonus: 5,  icon: "x",  desc: "+5% XP on all quests" },
  { id: "masterwork", name: "Masterwork Tools", cost: 300,  tier: 2, xpBonus: 10, icon: "x",  desc: "+10% XP on all quests" },
  { id: "legendary",  name: "Legendary Tools",  cost: 700,  tier: 3, xpBonus: 15, icon: "x",  desc: "+15% XP on all quests" },
  { id: "mythic",     name: "Mythic Forge",     cost: 1500, tier: 4, xpBonus: 25, icon: "x", desc: "+25% XP on all quests" },
];

const SHOP_ITEMS_LIST: ShopItem[] = [
  { id: "gaming_1h",   name: "1h Gaming",    cost: 100, icon: "x", desc: "1 hour of guilt-free gaming" },
  { id: "snack_break", name: "Snack Break",   cost: 25,  icon: "x", desc: "Treat yourself to a snack" },
  { id: "day_off",     name: "Day Off Quest", cost: 500, icon: "x", desc: "Skip one day of recurring quests" },
  { id: "movie_night", name: "Movie Night",   cost: 150, icon: "x", desc: "Evening off for a movie" },
  { id: "sleep_in",    name: "Sleep In",      cost: 75,  icon: "x", desc: "Extra hour of sleep, guilt-free" },
];

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
        <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Forge Shop</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Login to access the shop and spend your hard-earned gold!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>x Forge Shop</span>
        <span className="text-xs font-mono font-bold" style={{ color: "#f59e0b" }}>x {gold} gold</span>
        <span className="text-xs px-2 py-0.5 rounded" style={{ color: "#a78bfa", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)" }}>x {user.name}</span>
      </div>

      {/* Rewards */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>x Rewards</p>
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

      {/* Workshop Tools / Gear */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(99,102,241,0.7)" }}>⚒ Workshop Tools</p>
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
                    {gear.name} {owned && "✓"}
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
