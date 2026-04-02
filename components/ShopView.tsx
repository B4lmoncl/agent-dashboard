"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, ShopItem } from "@/app/types";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip } from "@/components/GameTooltip";
import type { RewardCelebrationData } from "@/components/RewardCelebration";
import shopData from "../public/data/shopItems.json";

const GEAR_TIERS_CLIENT = shopData.gearTiers;
const SHOP_ITEMS_LIST: ShopItem[] = shopData.items as ShopItem[];

const RARITY_GLOW: Record<string, string> = {
  rare: "rgba(59,130,246,0.12)",
  epic: "rgba(168,85,247,0.15)",
  legendary: "rgba(249,115,22,0.15)",
};
function getItemGlowColor(item: ShopItem): string | null {
  const r = (item as unknown as Record<string, unknown>).rarity as string | undefined;
  if (r && RARITY_GLOW[r]) return RARITY_GLOW[r];
  if (item.cost >= 500) return RARITY_GLOW.epic;
  if (item.cost >= 200) return RARITY_GLOW.rare;
  return null;
}

// ─── Main ShopView (no Gacha — moved to GachaView) ─────────────────────────
// Boost → navigation hint mapping
const BOOST_HINTS: Record<string, { label: string; view?: string }> = {
  xp_boost_10:      { label: "Works on Quest Board \u2192", view: "questBoard" },
  gold_boost_10:    { label: "Works on Quest Board \u2192", view: "questBoard" },
  luck_boost_20:    { label: "Improves drops" },
  streak_shield:    { label: "Protects Rituals \u2192", view: "rituals" },
  material_double:  { label: "Works in Forge \u2192", view: "forge" },
};

// ─── Currency Shop Types ────────────────────────────────────────────────────
interface CurrencyShopItem {
  id: string;
  name: string;
  cost: number;
  currency: string;
  type: string;
  icon?: string;
  desc?: string;
  frameId?: string;
  frameName?: string;
  frameColor?: string;
  frameGlow?: boolean;
  titleId?: string;
  titleName?: string;
  titleRarity?: string;
  effect?: Record<string, unknown>;
}

const CURRENCY_SHOPS: { key: string; label: string; color: string; iconPath: string }[] = [
  { key: "sternentaler", label: "Star Coins", color: "#fbbf24", iconPath: "/images/icons/currency-sternentaler.png" },
  { key: "gildentaler", label: "Guild Coins", color: "#10b981", iconPath: "/images/icons/currency-gildentaler.png" },
  { key: "mondstaub", label: "Moondust", color: "#c084fc", iconPath: "/images/icons/currency-mondstaub.png" },
];

export default function ShopView({ onBuy, onNavigate, onRewardCelebration }: {
  onBuy: (userId: string, itemId: string) => void;
  onNavigate?: (view: string) => void;
  onRewardCelebration?: (data: RewardCelebrationData) => void;
}) {
  const { users, playerName, reviewApiKey } = useDashboard();
  const loggedIn = playerName && reviewApiKey;
  const user = loggedIn ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;
  const gold = user?.gold ?? 0;
  const currentGear = user?.gear;
  const currentTier = GEAR_TIERS_CLIENT.find(g => g.id === (currentGear || "worn"))?.tier ?? 0;

  // Currency shop state
  const [currencyItems, setCurrencyItems] = useState<Record<string, CurrencyShopItem[]>>({});
  const [currencyBalances, setCurrencyBalances] = useState<Record<string, number>>({});
  const [currencyBuying, setCurrencyBuying] = useState<string | null>(null);
  const [goldBuying, setGoldBuying] = useState<string | null>(null);
  const [currencyMsg, setCurrencyMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [activeCurrencyTab, setActiveCurrencyTab] = useState<string>("sternentaler");

  const fetchCurrencyShop = useCallback(async () => {
    try {
      const [itemsR, balR] = await Promise.all([
        fetch("/api/shop/currency-items"),
        playerName ? fetch(`/api/currency/${playerName}`, { headers: getAuthHeaders() }) : null,
      ]);
      if (itemsR.ok) setCurrencyItems(await itemsR.json());
      if (balR?.ok) {
        const d = await balR.json();
        setCurrencyBalances(d.currencies || {});
      }
    } catch { /* ignore */ }
  }, [playerName]);

  useEffect(() => { if (loggedIn) fetchCurrencyShop(); }, [loggedIn, fetchCurrencyShop]);

  const buyCurrencyItem = async (itemId: string, shopType: string) => {
    if (!user || currencyBuying) return;
    setCurrencyBuying(itemId);
    try {
      const r = await fetch("/api/shop/currency-buy", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, itemId, shopType }),
      });
      const d = await r.json();
      if (r.ok) {
        setCurrencyMsg({ text: d.resultMsg || "Purchased!", type: "success" });
        fetchCurrencyShop();
        if (onRewardCelebration) {
          onRewardCelebration({ type: "quest", title: "Purchase Complete", xpEarned: 0, goldEarned: 0, flavor: d.resultMsg || "Item acquired!" });
        }
      } else {
        setCurrencyMsg({ text: d.error || "Purchase failed", type: "error" });
      }
    } catch {
      setCurrencyMsg({ text: "Network error", type: "error" });
    }
    setCurrencyBuying(null);
    setTimeout(() => setCurrencyMsg(null), 3000);
  };

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
        <div className="flex items-center gap-2 ml-auto" style={{ textShadow: "0 0 8px rgba(245,158,11,0.3)" }}>
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
              const glowColor = getItemGlowColor(item);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl${glowColor ? " crystal-breathe" : ""}`}
                  style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", ...(glowColor ? { ["--glow-color" as string]: glowColor } : {}) }}
                >
                  {item.icon && item.icon.startsWith("/") ? <img src={item.icon} alt="" style={{ width: 40, height: 40, imageRendering: "auto" }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> : <span className="text-2xl flex-shrink-0">{item.icon}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>{item.name}</p>
                    <p className="text-xs" style={{ color: "rgba(196,181,253,0.5)" }}>{item.desc}</p>
                    {(() => {
                      const hint = item.effect?.type ? BOOST_HINTS[item.effect.type] : undefined;
                      if (!hint) return null;
                      if (hint.view && onNavigate) return (
                        <button onClick={() => onNavigate(hint.view!)} className="btn-interactive text-xs mt-0.5 block" style={{ color: "rgba(196,181,253,0.3)", cursor: "pointer" }}>{hint.label}</button>
                      );
                      return <p className="text-xs mt-0.5" style={{ color: "rgba(196,181,253,0.25)" }}>{hint.label}</p>;
                    })()}
                  </div>
                  <button
                    onClick={() => { if (canAfford && !goldBuying) { setGoldBuying(item.id); Promise.resolve(onBuy(user.id, item.id)).finally(() => setGoldBuying(null)); } }}
                    disabled={!canAfford || goldBuying === item.id}
                    className="shop-buy-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                    title={canAfford ? `Buy for ${item.cost} gold` : `Insufficient gold (need ${item.cost}, have ${gold})`}
                    style={{
                      background: canAfford && goldBuying !== item.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                      color: canAfford && goldBuying !== item.id ? "#a78bfa" : "rgba(255,255,255,0.2)",
                      border: `1px solid ${canAfford && goldBuying !== item.id ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                      cursor: canAfford && goldBuying !== item.id ? "pointer" : "not-allowed",
                      opacity: goldBuying === item.id ? 0.5 : 1,
                    }}
                  >
                    {goldBuying === item.id ? "..." : <><img src="/images/icons/currency-gold.png" alt="" width={20} height={20} style={{ imageRendering: "auto", display: "inline", verticalAlign: "middle", marginRight: 2 }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> {item.cost.toLocaleString()}</>}
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
            const glowColor = getItemGlowColor(item);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-xl${glowColor ? " crystal-breathe" : ""}`}
                style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.07)", ...(glowColor ? { ["--glow-color" as string]: glowColor } : {}) }}
              >
                {item.icon && item.icon.startsWith("/") ? <img src={item.icon} alt="" style={{ width: 40, height: 40, imageRendering: "auto" }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> : <span className="text-2xl flex-shrink-0">{item.icon}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{item.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{item.desc}</p>
                </div>
                <button
                  onClick={() => { if (canAfford && !goldBuying) { setGoldBuying(item.id); Promise.resolve(onBuy(user.id, item.id)).finally(() => setGoldBuying(null)); } }}
                  disabled={!canAfford || goldBuying === item.id}
                  className="shop-buy-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                  title={canAfford ? `Buy for ${item.cost} gold` : `Insufficient gold (need ${item.cost}, have ${gold})`}
                  style={{
                    background: canAfford && goldBuying !== item.id ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                    color: canAfford && goldBuying !== item.id ? "#f59e0b" : "rgba(255,255,255,0.2)",
                    border: `1px solid ${canAfford && goldBuying !== item.id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
                    cursor: canAfford && goldBuying !== item.id ? "pointer" : "not-allowed",
                    opacity: goldBuying === item.id ? 0.5 : 1,
                  }}
                >
                  {goldBuying === item.id ? "..." : <><img src="/images/icons/currency-gold.png" alt="" width={20} height={20} style={{ imageRendering: "auto", display: "inline", verticalAlign: "middle", marginRight: 2 }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> {item.cost.toLocaleString()}</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Currency Shops (Sternentaler, Gildentaler, Mondstaub) ─── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Specialty Shops</p>
        {/* Tab bar */}
        <div className="flex gap-1 mb-3">
          {CURRENCY_SHOPS.map(shop => {
            const active = activeCurrencyTab === shop.key;
            const bal = currencyBalances[shop.key] ?? 0;
            return (
              <button
                key={shop.key}
                onClick={() => setActiveCurrencyTab(shop.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: active ? `${shop.color}15` : "rgba(255,255,255,0.03)",
                  color: active ? shop.color : "rgba(255,255,255,0.3)",
                  border: `1px solid ${active ? `${shop.color}40` : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer",
                }}
              >
                <img src={shop.iconPath} alt="" width={16} height={16} style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                {shop.label}
                <span className="font-mono" style={{ opacity: 0.6 }}>{bal}</span>
              </button>
            );
          })}
        </div>

        {/* Currency message */}
        {currencyMsg && (
          <div className="rounded-lg px-3 py-1.5 text-xs font-semibold mb-2 tab-content-enter" style={{
            background: currencyMsg.type === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            color: currencyMsg.type === "success" ? "#22c55e" : "#ef4444",
            border: `1px solid ${currencyMsg.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}>
            {currencyMsg.text}
          </div>
        )}

        {/* Items grid */}
        {(() => {
          const shopConf = CURRENCY_SHOPS.find(s => s.key === activeCurrencyTab);
          const items = currencyItems[activeCurrencyTab] || [];
          if (!shopConf) return null;
          if (items.length === 0) return <p className="text-xs text-w20">No items available in this shop.</p>;
          const bal = currencyBalances[activeCurrencyTab] ?? 0;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map(item => {
                const canAfford = bal >= item.cost;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: `${shopConf.color}06`, border: `1px solid ${shopConf.color}18` }}
                  >
                    {item.icon && item.icon.startsWith("/") ? <img src={item.icon} alt="" style={{ width: 36, height: 36, imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-xl flex-shrink-0" style={{ color: shopConf.color }}>◆</span>}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: shopConf.color }}>{item.name}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{item.desc}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>
                        {item.type === "frame" ? "Frame" : item.type === "title" ? "Title" : item.type === "boost" ? "Boost" : item.type === "cosmetic" ? "Cosmetic" : "Item"}
                      </p>
                    </div>
                    <button
                      onClick={() => canAfford && buyCurrencyItem(item.id, activeCurrencyTab)}
                      disabled={!canAfford || currencyBuying === item.id}
                      title={canAfford ? `Buy for ${item.cost} ${shopConf.label}` : `Need ${item.cost} ${shopConf.label}, have ${bal}`}
                      className="text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                      style={{
                        background: canAfford ? `${shopConf.color}20` : "rgba(255,255,255,0.04)",
                        color: canAfford ? shopConf.color : "rgba(255,255,255,0.2)",
                        border: `1px solid ${canAfford ? `${shopConf.color}40` : "rgba(255,255,255,0.08)"}`,
                        cursor: canAfford && currencyBuying !== item.id ? "pointer" : "not-allowed",
                        opacity: currencyBuying === item.id ? 0.5 : 1,
                      }}
                    >
                      {currencyBuying === item.id ? "..." : item.cost}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Workshop Tools moved to Artisan's Quarter */}
    </div>
  );
}
