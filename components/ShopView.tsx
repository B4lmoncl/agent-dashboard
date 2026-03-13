"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, ShopItem, GachaPullResult, GachaBanner, GachaPityInfo } from "@/app/types";
import shopData from "../public/data/shopItems.json";
import GachaPull, { RARITY_CONFIG } from "./GachaPull";

const GEAR_TIERS_CLIENT = shopData.gearTiers;
const SHOP_ITEMS_LIST: ShopItem[] = shopData.items as ShopItem[];

// ─── Gacha Sub-Tab ──────────────────────────────────────────────────────────
function GachaTab({ user, apiKey, onRefresh }: { user: User; apiKey: string; onRefresh: () => void }) {
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  const [selectedBanner, setSelectedBanner] = useState<string | null>(null);
  const [pity, setPity] = useState<GachaPityInfo | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullResults, setPullResults] = useState<GachaPullResult[] | null>(null);
  const [pullMode, setPullMode] = useState<"single" | "multi">("single");
  const [history, setHistory] = useState<Array<{ name: string; rarity: string; emoji: string; pulledAt: string; isDuplicate: boolean }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [poolInfo, setPoolInfo] = useState<Record<string, Array<{ id: string; name: string; emoji: string; type: string; desc: string }>> | null>(null);
  const [poolOpen, setPoolOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencies = user.currencies || { gold: user.gold || 0, stardust: 0, essenz: 0, runensplitter: 0, gildentaler: 0, mondstaub: 0 };

  // Load banners
  useEffect(() => {
    fetch("/api/gacha/banners").then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setBanners(data);
        if (data.length > 0 && !selectedBanner) setSelectedBanner(data[0].id);
      }
    }).catch(() => {});
  }, []);

  // Load pity when banner selected
  useEffect(() => {
    if (!user.id) return;
    fetch(`/api/gacha/pity/${user.id}`).then(r => r.json()).then(data => {
      if (data.pityCounter !== undefined) setPity(data);
    }).catch(() => {});
  }, [user.id, pullResults]);

  const banner = banners.find(b => b.id === selectedBanner);
  const bannerCurrency = banner?.currency || "runensplitter";
  const bannerCurrencyEmoji = bannerCurrency === "stardust" ? "⭐" : "💎";
  const bannerCurrencyName = bannerCurrency === "stardust" ? "Sternenstaub" : "Runensplitter";
  const costSingle = banner?.costSingle || 10;
  const cost10 = banner?.cost10 || 90;
  const balance = currencies[bannerCurrency as keyof typeof currencies] || 0;
  const canPull1 = balance >= costSingle;
  const canPull10 = balance >= cost10;

  const doPull = useCallback(async (count: 1 | 10) => {
    if (!banner || pulling) return;
    setError(null);
    setPulling(true);
    try {
      const endpoint = count === 1 ? "/api/gacha/pull" : "/api/gacha/pull10";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ playerId: user.id, bannerId: banner.id }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Pull fehlgeschlagen");
        setPulling(false);
        return;
      }
      setPullResults(data.results);
      setPullMode(count === 1 ? "single" : "multi");
      onRefresh();
    } catch (e) {
      setError("Netzwerkfehler beim Pull");
    }
    setPulling(false);
  }, [banner, pulling, apiKey, user.id, onRefresh]);

  const loadHistory = useCallback(() => {
    fetch(`/api/gacha/history/${user.id}`).then(r => r.json()).then(data => {
      if (data.history) setHistory(data.history);
    }).catch(() => {});
    setHistoryOpen(true);
  }, [user.id]);

  const loadPool = useCallback(() => {
    fetch("/api/gacha/pool").then(r => r.json()).then(data => {
      if (data.pool) setPoolInfo(data.pool);
    }).catch(() => {});
    setPoolOpen(true);
  }, []);

  const pullsTilLegendary = pity ? (50 - pity.pityCounter) : 50;
  const pullsTilEpic = pity ? (10 - pity.epicPityCounter) : 10;
  const inSoftPity = pity ? pity.pityCounter >= 35 : false;

  return (
    <div className="space-y-4">
      {/* Pull animation overlay */}
      {pullResults && (
        <GachaPull
          results={pullResults}
          mode={pullMode}
          onClose={() => setPullResults(null)}
        />
      )}

      {/* Banner selector */}
      <div className="flex gap-2">
        {banners.map(b => (
          <button
            key={b.id}
            onClick={() => setSelectedBanner(b.id)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
            style={{
              background: selectedBanner === b.id ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
              color: selectedBanner === b.id ? "#a78bfa" : "rgba(255,255,255,0.35)",
              border: `1px solid ${selectedBanner === b.id ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {b.icon} {b.name}
          </button>
        ))}
      </div>

      {/* Banner display */}
      {banner && (
        <div className="rounded-2xl p-4 space-y-4" style={{
          background: "linear-gradient(135deg, #1a1020 0%, #0f0f1a 100%)",
          border: "1px solid rgba(167,139,250,0.2)",
          boxShadow: "0 0 30px rgba(167,139,250,0.05)",
        }}>
          {/* Banner header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "#e8e8e8" }}>
                {banner.icon} {banner.name}
              </h3>
              <p className="text-[11px] italic mt-1 max-w-md" style={{ color: "rgba(255,255,255,0.3)" }}>
                {banner.lore}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-lg">{bannerCurrencyEmoji}</span>
              <span className="text-sm font-mono font-bold" style={{ color: bannerCurrency === "stardust" ? "#818cf8" : "#a78bfa" }}>
                {balance}
              </span>
            </div>
          </div>

          {/* Pity info */}
          {pity && (
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Legendary Pity</span>
                <span className="text-xs font-mono font-bold" style={{ color: inSoftPity ? "#f97316" : "rgba(255,255,255,0.5)" }}>
                  {pity.pityCounter}/50
                </span>
                {inSoftPity && <span className="text-[9px] px-1 rounded" style={{ background: "rgba(249,115,22,0.2)", color: "#f97316" }}>SOFT PITY!</span>}
              </div>
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Epic Pity</span>
                <span className="text-xs font-mono font-bold" style={{ color: "#a855f7" }}>
                  {pity.epicPityCounter}/10
                </span>
              </div>
              {pity.guaranteed5050 && (
                <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <span className="text-[10px]" style={{ color: "#22c55e" }}>Nächster Legendary = Featured garantiert!</span>
                </div>
              )}
            </div>
          )}

          {/* Pull buttons */}
          <div className="flex gap-3 items-center flex-wrap">
            <button
              onClick={() => doPull(1)}
              disabled={!canPull1 || pulling}
              className="text-sm px-5 py-2.5 rounded-xl font-bold transition-all"
              style={{
                background: canPull1 ? "linear-gradient(135deg, rgba(167,139,250,0.3) 0%, rgba(139,92,246,0.2) 100%)" : "rgba(255,255,255,0.04)",
                color: canPull1 ? "#d4c4fb" : "rgba(255,255,255,0.2)",
                border: `1px solid ${canPull1 ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
                boxShadow: canPull1 ? "0 0 15px rgba(167,139,250,0.15)" : "none",
              }}
            >
              {pulling ? "..." : `1× Ziehen — ${costSingle} ${bannerCurrencyEmoji}`}
            </button>
            <button
              onClick={() => doPull(10)}
              disabled={!canPull10 || pulling}
              className="text-sm px-5 py-2.5 rounded-xl font-bold transition-all"
              style={{
                background: canPull10 ? "linear-gradient(135deg, rgba(249,115,22,0.3) 0%, rgba(245,158,11,0.2) 100%)" : "rgba(255,255,255,0.04)",
                color: canPull10 ? "#fbd38d" : "rgba(255,255,255,0.2)",
                border: `1px solid ${canPull10 ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.08)"}`,
                boxShadow: canPull10 ? "0 0 15px rgba(249,115,22,0.15)" : "none",
              }}
            >
              {pulling ? "..." : `10× Ziehen — ${cost10} ${bannerCurrencyEmoji}`}
            </button>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              Noch {pullsTilLegendary} bis garantiert Legendary
            </span>
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </p>
          )}

          {/* Drop rates */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Legendary", rate: "1.6%", color: "#f97316" },
              { label: "Epic", rate: "13%", color: "#a855f7" },
              { label: "Rare", rate: "35%", color: "#3b82f6" },
              { label: "Uncommon", rate: "40%", color: "#22c55e" },
              { label: "Common", rate: "10.4%", color: "#9ca3af" },
            ].map(r => (
              <span key={r.label} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: r.color, background: `${r.color}15`, border: `1px solid ${r.color}30` }}>
                {r.label} {r.rate}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={loadHistory}
              className="text-[10px] px-2.5 py-1 rounded-lg"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Pull-History
            </button>
            <button
              onClick={loadPool}
              className="text-[10px] px-2.5 py-1 rounded-lg"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Pool anzeigen
            </button>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setHistoryOpen(false)}>
          <div className="w-full max-w-md max-h-[70vh] rounded-2xl p-4 overflow-y-auto" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Pull-History (letzte 50)</h3>
              <button onClick={() => setHistoryOpen(false)} style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Noch keine Pulls.</p>
            ) : (
              <div className="space-y-1">
                {history.slice(0, 50).map((h, i) => {
                  const cfg = RARITY_CONFIG[h.rarity] || RARITY_CONFIG.common;
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <span className="text-sm">{h.emoji}</span>
                      <span className="text-[11px] font-semibold flex-1" style={{ color: cfg.color }}>{h.name}</span>
                      <span className="text-[9px] uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>{cfg.label}</span>
                      {h.isDuplicate && <span className="text-[8px]" style={{ color: "#a78bfa" }}>DUP</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pool info modal */}
      {poolOpen && poolInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setPoolOpen(false)}>
          <div className="w-full max-w-lg max-h-[70vh] rounded-2xl p-4 overflow-y-auto" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Item-Pool</h3>
              <button onClick={() => setPoolOpen(false)} style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            <div className="space-y-3">
              {["legendary", "epic", "rare", "uncommon", "common"].map(rarity => {
                const items = poolInfo[rarity] || [];
                if (items.length === 0) return null;
                const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
                return (
                  <div key={rarity}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cfg.color }}>{cfg.label} ({items.length})</p>
                    <div className="space-y-1">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ background: cfg.bg }}>
                          <span className="text-sm">{item.emoji}</span>
                          <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{item.name}</span>
                          <span className="text-[9px] ml-auto" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {item.type === "weapon" ? "Waffe" : item.type === "armor" ? "Rüstung" : item.type === "consumable" ? "Verbrauchbar" : "Gacha"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ShopView ──────────────────────────────────────────────────────────
export default function ShopView({ users, playerName, reviewApiKey, onBuy, onGearBuy, onRefresh }: {
  users: User[];
  playerName: string;
  reviewApiKey: string;
  onBuy: (userId: string, itemId: string) => void;
  onGearBuy: (userId: string, gearId: string) => void;
  onRefresh?: () => void;
}) {
  const [shopTab, setShopTab] = useState<"rewards" | "gacha">("rewards");
  const loggedIn = playerName && reviewApiKey;
  const user = loggedIn ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;
  const gold = user?.gold ?? 0;
  const currentGear = user?.gear;
  const currentTier = GEAR_TIERS_CLIENT.find(g => g.id === (currentGear || "worn"))?.tier ?? 0;

  if (!loggedIn || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <span className="text-4xl">🔮</span>
        <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Der Basar</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Melde dich an, um den Basar zu betreten und dein verdientes Gold auszugeben!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with currency wallet */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>🏪 Der Basar</span>
        <span className="text-xs px-2 py-0.5 rounded" style={{ color: "#a78bfa", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)" }}>
          {user.name}
        </span>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {[
            { emoji: "🪙", key: "gold" as const, color: "#f59e0b" },
            { emoji: "⭐", key: "stardust" as const, color: "#818cf8" },
            { emoji: "💎", key: "runensplitter" as const, color: "#a78bfa" },
            { emoji: "🔥", key: "essenz" as const, color: "#ef4444" },
            { emoji: "🤝", key: "gildentaler" as const, color: "#10b981" },
            { emoji: "🌙", key: "mondstaub" as const, color: "#c084fc" },
          ].map(c => {
            const val = user.currencies?.[c.key] ?? (c.key === "gold" ? gold : 0);
            return (
              <span key={c.key} className="text-[10px] font-mono font-bold flex items-center gap-0.5"
                style={{ color: val > 0 ? c.color : "rgba(255,255,255,0.15)" }}
                title={c.key}>
                {c.emoji} {val}
              </span>
            );
          })}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1" style={{ background: "#111", borderRadius: 8, padding: 3, display: "inline-flex" }}>
        {[
          { key: "rewards" as const, label: "🛒 Belohnungen & Ausrüstung" },
          { key: "gacha" as const, label: "🔮 Arkanes Schicksal" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setShopTab(t.key)}
            className="text-xs font-semibold px-3 py-1.5 rounded transition-all"
            style={{
              background: shopTab === t.key ? "#252525" : "transparent",
              color: shopTab === t.key ? "#f0f0f0" : "rgba(255,255,255,0.3)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rewards tab */}
      {shopTab === "rewards" && (
        <div className="space-y-4">
          {/* Rewards */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>🎁 Belohnungen</p>
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
                      🪙 {item.cost}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workshop Tools / Gear */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(99,102,241,0.7)" }}>⚒ Werkstatt</p>
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
                        🪙 {gear.cost}
                      </button>
                    )}
                    {owned && <span className="text-xs px-2.5 py-1" style={{ color: "rgba(99,102,241,0.5)" }}>Besitzt</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Gacha tab */}
      {shopTab === "gacha" && (
        <GachaTab user={user} apiKey={reviewApiKey} onRefresh={onRefresh || (() => {})} />
      )}
    </div>
  );
}
