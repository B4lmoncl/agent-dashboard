"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, GachaPullResult, GachaBanner, GachaPityInfo } from "@/app/types";
import GachaPull, { RARITY_CONFIG } from "./GachaPull";

// ─── Currency helpers ────────────────────────────────────────────────────────
const CURRENCY_META: Record<string, { emoji: string; label: string; color: string }> = {
  runensplitter: { emoji: "💎", label: "Rune Shards", color: "#a78bfa" },
  stardust:      { emoji: "⭐", label: "Stardust",    color: "#818cf8" },
  gold:          { emoji: "🪙", label: "Gold",        color: "#f59e0b" },
  essenz:        { emoji: "🔥", label: "Essence",     color: "#ef4444" },
  gildentaler:   { emoji: "🤝", label: "Guild Coins", color: "#10b981" },
  mondstaub:     { emoji: "🌙", label: "Moondust",    color: "#c084fc" },
};

function getCurrencyInfo(key: string) {
  return CURRENCY_META[key] || { emoji: "💰", label: key, color: "#ccc" };
}

// ─── Info Modal ──────────────────────────────────────────────────────────────
function GachaInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] rounded-2xl p-6 overflow-y-auto" style={{ background: "linear-gradient(180deg, #1a1020 0%, #12121c 100%)", border: "1px solid rgba(167,139,250,0.25)", boxShadow: "0 0 60px rgba(167,139,250,0.1)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "#e8e8e8" }}>
            <span style={{ fontSize: 20 }}>📜</span> How the Wheel of Stars Works
          </h3>
          <button onClick={onClose} className="text-xl" style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>

        <div className="space-y-4 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
          {/* Drop Rates */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#f97316" }}>Drop Rates</h4>
            <div className="space-y-1">
              {[
                { label: "Legendary", rate: "1.6%", color: "#f97316" },
                { label: "Epic", rate: "13%", color: "#a855f7" },
                { label: "Rare", rate: "35%", color: "#3b82f6" },
                { label: "Uncommon", rate: "40%", color: "#22c55e" },
                { label: "Common", rate: "10.4%", color: "#9ca3af" },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  <span style={{ color: r.color }} className="font-semibold">{r.label}</span>
                  <span className="ml-auto font-mono">{r.rate}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pity System */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#a855f7" }}>Pity System</h4>
            <p>Every pull without a Legendary increases your <span style={{ color: "#f97316" }}>pity counter</span>. The Wheel remembers your devotion.</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><span style={{ color: "#f97316" }}>Soft Pity</span> begins at <strong>35 pulls</strong> — your Legendary drop rate increases significantly with each subsequent pull.</li>
              <li><span style={{ color: "#ef4444" }}>Hard Pity</span> at <strong>50 pulls</strong> — you are <em>guaranteed</em> a Legendary item.</li>
              <li><span style={{ color: "#a855f7" }}>Epic Pity</span> guarantees an Epic every <strong>10 pulls</strong>.</li>
            </ul>
          </div>

          {/* 50/50 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#22c55e" }}>The 50/50 (Featured Banners)</h4>
            <p>When you pull a Legendary on a <span style={{ color: "#818cf8" }}>Featured Banner</span>, there is a <strong>50% chance</strong> it will be the featured item.</p>
            <p className="mt-1">If you <em>lose</em> the 50/50, your <strong>next Legendary is guaranteed</strong> to be the featured item. The stars align in your favor.</p>
          </div>

          {/* Duplicates */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#a78bfa" }}>Duplicates &amp; Rune Shards</h4>
            <p>Already own an item? Duplicates are automatically converted into <span style={{ color: "#a78bfa" }}>💎 Rune Shards</span>, scaling with rarity. Nothing is truly wasted in the Vault.</p>
          </div>

          {/* 10-pull guarantee */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#3b82f6" }}>10-Pull Bonus</h4>
            <p>A 10-pull costs only <strong>90</strong> instead of 100 — a 10% discount. Plus, every 10-pull guarantees <em>at least one Rare or better</em>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Banner Card ─────────────────────────────────────────────────────────────
function BannerCard({
  banner, user, apiKey, pity, onPull, pulling,
}: {
  banner: GachaBanner;
  user: User;
  apiKey: string;
  pity: GachaPityInfo | null;
  onPull: (bannerId: string, count: 1 | 10) => void;
  pulling: boolean;
}) {
  const currencies = user.currencies || { gold: user.gold || 0, stardust: 0, essenz: 0, runensplitter: 0, gildentaler: 0, mondstaub: 0 };
  const ci = getCurrencyInfo(banner.currency);
  const balance = currencies[banner.currency as keyof typeof currencies] || 0;
  const canPull1 = balance >= banner.costSingle;
  const canPull10 = balance >= banner.cost10;
  const isFeatured = banner.type === "featured";

  const borderColor = isFeatured ? "rgba(129,140,248,0.3)" : "rgba(167,139,250,0.2)";
  const glowColor = isFeatured ? "rgba(129,140,248,0.08)" : "rgba(167,139,250,0.05)";

  const pullsTilLegendary = pity ? (50 - pity.pityCounter) : 50;
  const inSoftPity = pity ? pity.pityCounter >= 35 : false;

  return (
    <div className="flex-1 min-w-[280px] rounded-2xl p-5 space-y-4" style={{
      background: `linear-gradient(135deg, ${isFeatured ? "#14102a" : "#1a1020"} 0%, #0f0f1a 100%)`,
      border: `1px solid ${borderColor}`,
      boxShadow: `0 0 40px ${glowColor}`,
    }}>
      {/* Banner header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: 28 }}>{banner.icon}</span>
          <div>
            <h3 className="text-base font-bold" style={{ color: "#e8e8e8" }}>{banner.name}</h3>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded" style={{
              color: isFeatured ? "#818cf8" : "#a78bfa",
              background: isFeatured ? "rgba(129,140,248,0.12)" : "rgba(167,139,250,0.1)",
              border: `1px solid ${isFeatured ? "rgba(129,140,248,0.3)" : "rgba(167,139,250,0.2)"}`,
            }}>
              {isFeatured ? "Featured Banner" : "Standard Banner"}
            </span>
          </div>
        </div>
        <p className="text-xs italic mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
          {banner.lore}
        </p>
      </div>

      {/* Cost info */}
      <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 20 }}>{ci.emoji}</span>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Cost per pull</p>
          <p className="text-sm font-mono font-bold" style={{ color: ci.color }}>{banner.costSingle} {ci.label}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Your balance</p>
          <p className="text-sm font-mono font-bold" style={{ color: balance > 0 ? ci.color : "rgba(255,255,255,0.2)" }}>{balance}</p>
        </div>
      </div>

      {/* Featured items */}
      {isFeatured && banner.featuredItems && banner.featuredItems.length > 0 && (
        <div className="rounded-xl px-3 py-2" style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)" }}>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#818cf8" }}>Featured Items</p>
          <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
            {banner.featuredItems.join(", ")}
          </p>
        </div>
      )}

      {/* Pity info */}
      {pity && (
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Pity</span>
            <span className="text-xs font-mono font-bold" style={{ color: inSoftPity ? "#f97316" : "rgba(255,255,255,0.5)" }}>
              {pity.pityCounter}/50
            </span>
            {inSoftPity && <span className="text-[9px] px-1 rounded" style={{ background: "rgba(249,115,22,0.2)", color: "#f97316" }}>SOFT PITY</span>}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Epic</span>
            <span className="text-xs font-mono font-bold" style={{ color: "#a855f7" }}>
              {pity.epicPityCounter}/10
            </span>
          </div>
          {pity.guaranteed5050 && (
            <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <span className="text-[10px] font-semibold" style={{ color: "#22c55e" }}>Next Legendary = Featured!</span>
            </div>
          )}
        </div>
      )}

      {/* Drop rate badges */}
      <div className="flex gap-1.5 flex-wrap">
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

      {/* Pull buttons */}
      <div className="flex gap-3 items-center flex-wrap">
        <button
          onClick={() => onPull(banner.id, 1)}
          disabled={!canPull1 || pulling}
          className="text-sm px-5 py-2.5 rounded-xl font-bold transition-all flex-1 min-w-[120px]"
          style={{
            background: canPull1 ? "linear-gradient(135deg, rgba(167,139,250,0.3) 0%, rgba(139,92,246,0.2) 100%)" : "rgba(255,255,255,0.04)",
            color: canPull1 ? "#d4c4fb" : "rgba(255,255,255,0.2)",
            border: `1px solid ${canPull1 ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
            boxShadow: canPull1 ? "0 0 15px rgba(167,139,250,0.15)" : "none",
          }}
        >
          {pulling ? "..." : `1× Pull — ${banner.costSingle} ${ci.emoji}`}
        </button>
        <button
          onClick={() => onPull(banner.id, 10)}
          disabled={!canPull10 || pulling}
          className="text-sm px-5 py-2.5 rounded-xl font-bold transition-all flex-1 min-w-[120px]"
          style={{
            background: canPull10 ? "linear-gradient(135deg, rgba(249,115,22,0.3) 0%, rgba(245,158,11,0.2) 100%)" : "rgba(255,255,255,0.04)",
            color: canPull10 ? "#fbd38d" : "rgba(255,255,255,0.2)",
            border: `1px solid ${canPull10 ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.08)"}`,
            boxShadow: canPull10 ? "0 0 15px rgba(249,115,22,0.15)" : "none",
          }}
        >
          {pulling ? "..." : `10× Pull — ${banner.cost10} ${ci.emoji}`}
        </button>
      </div>
      <p className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
        {pullsTilLegendary} pulls until guaranteed Legendary
      </p>
    </div>
  );
}

// ─── Main GachaView ──────────────────────────────────────────────────────────
export default function GachaView({ users, playerName, reviewApiKey, onRefresh }: {
  users: User[];
  playerName: string;
  reviewApiKey: string;
  onRefresh?: () => void;
}) {
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  const [pity, setPity] = useState<GachaPityInfo | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullResults, setPullResults] = useState<GachaPullResult[] | null>(null);
  const [pullMode, setPullMode] = useState<"single" | "multi">("single");
  const [history, setHistory] = useState<Array<{ name: string; rarity: string; emoji: string; pulledAt: string; isDuplicate: boolean }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [poolInfo, setPoolInfo] = useState<Record<string, Array<{ id: string; name: string; emoji: string; type: string; desc: string }>> | null>(null);
  const [poolOpen, setPoolOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loggedIn = playerName && reviewApiKey;
  const user = loggedIn ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;

  // Load banners
  useEffect(() => {
    fetch("/api/gacha/banners").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setBanners(data);
    }).catch(() => {});
  }, []);

  // Load pity
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/gacha/pity/${user.id}`).then(r => r.json()).then(data => {
      if (data.pityCounter !== undefined) setPity(data);
    }).catch(() => {});
  }, [user?.id, pullResults]);

  const doPull = useCallback(async (bannerId: string, count: 1 | 10) => {
    if (!user || pulling) return;
    setError(null);
    setPulling(true);
    try {
      const endpoint = count === 1 ? "/api/gacha/pull" : "/api/gacha/pull10";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({ playerId: user.id, bannerId }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Pull failed");
        setPulling(false);
        return;
      }
      setPullResults(data.results);
      setPullMode(count === 1 ? "single" : "multi");
      onRefresh?.();
    } catch {
      setError("Network error during pull");
    }
    setPulling(false);
  }, [user, pulling, reviewApiKey, onRefresh]);

  const loadHistory = useCallback(() => {
    if (!user) return;
    fetch(`/api/gacha/history/${user.id}`).then(r => r.json()).then(data => {
      if (data.history) setHistory(data.history);
    }).catch(() => {});
    setHistoryOpen(true);
  }, [user]);

  const loadPool = useCallback(() => {
    fetch("/api/gacha/pool").then(r => r.json()).then(data => {
      if (data.pool) setPoolInfo(data.pool);
    }).catch(() => {});
    setPoolOpen(true);
  }, []);

  if (!loggedIn || !user) {
    return (
      <div className="space-y-4">
        <div className="text-center py-16 space-y-3">
          <span className="text-5xl block">🔮</span>
          <p className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>The Vault of Fate</p>
          <p className="text-sm italic max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.25)" }}>
            A circular chamber with a single, floating astrolabe at its center. Sign in to step before the Wheel of Stars.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Pull animation overlay */}
      {pullResults && (
        <GachaPull
          results={pullResults}
          mode={pullMode}
          onClose={() => setPullResults(null)}
        />
      )}

      {/* Info modal */}
      {infoOpen && <GachaInfoModal onClose={() => setInfoOpen(false)} />}

      {/* Lore Header */}
      <div className="rounded-2xl p-5" style={{
        background: "linear-gradient(135deg, rgba(20,16,42,0.8) 0%, rgba(15,15,26,0.9) 100%)",
        border: "1px solid rgba(167,139,250,0.15)",
        boxShadow: "0 0 60px rgba(167,139,250,0.05)",
      }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "#e8e8e8" }}>
              <span style={{ fontSize: 24 }}>🔮</span> The Vault of Fate
            </h2>
            <p className="text-xs italic mt-2 max-w-2xl leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
              A circular chamber with a single, floating astrolabe structure at its center: the Wheel of Stars.
              Here, heroes draw items, companions, and artifacts from the Aetherstream. The Vault remembers every pull — and rewards persistence.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setInfoOpen(true)}
              className="btn-interactive text-sm w-8 h-8 rounded-full flex items-center justify-center"
              style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              title="How does the Wheel of Stars work?"
            >
              ?
            </button>
            <button
              onClick={loadHistory}
              className="btn-interactive text-xs px-3 py-1.5 rounded-lg"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Pull History
            </button>
            <button
              onClick={loadPool}
              className="btn-interactive text-xs px-3 py-1.5 rounded-lg"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Item Pool
            </button>
          </div>
        </div>
      </div>

      {/* Banner Cards — side by side */}
      <div className="flex gap-4 flex-wrap">
        {banners.map(b => (
          <BannerCard
            key={b.id}
            banner={b}
            user={user}
            apiKey={reviewApiKey}
            pity={pity}
            onPull={doPull}
            pulling={pulling}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </p>
      )}

      {/* History modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setHistoryOpen(false)}>
          <div className="w-full max-w-md max-h-[70vh] rounded-2xl p-4 overflow-y-auto" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Pull History (last 50)</h3>
              <button onClick={() => setHistoryOpen(false)} style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No pulls yet.</p>
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
              <h3 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Item Pool</h3>
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
                            {item.type === "weapon" ? "Weapon" : item.type === "armor" ? "Armor" : item.type === "consumable" ? "Consumable" : "Gacha"}
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
