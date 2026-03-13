"use client";

import { useState, useEffect, useCallback, useRef, useId, useMemo } from "react";
import type { User, GachaPullResult, GachaBanner, GachaPityInfo } from "@/app/types";
import GachaPull, { RARITY_CONFIG } from "./GachaPull";
import { ModalOverlay } from "./ModalPortal";

// ─── Currency helpers ────────────────────────────────────────────────────────
const CURRENCY_META: Record<string, { emoji: string; label: string; color: string; iconSrc?: string }> = {
  runensplitter: { emoji: "", label: "Rune Shards", color: "#818cf8", iconSrc: "/images/icons/currency-runensplitter.png" },
  stardust:      { emoji: "", label: "Stardust",    color: "#a78bfa", iconSrc: "/images/icons/currency-stardust.png" },
  gold:          { emoji: "", label: "Gold",        color: "#f59e0b", iconSrc: "/images/icons/currency-gold.png" },
  essenz:        { emoji: "", label: "Essence",     color: "#ef4444", iconSrc: "/images/icons/currency-essenz.png" },
  gildentaler:   { emoji: "", label: "Guild Coins", color: "#10b981", iconSrc: "/images/icons/currency-gildentaler.png" },
  mondstaub:     { emoji: "", label: "Moondust",    color: "#c084fc", iconSrc: "/images/icons/currency-mondstaub.png" },
};

function getCurrencyInfo(key: string) {
  return CURRENCY_META[key] || { emoji: "", label: key, color: "#ccc", iconSrc: undefined };
}

// ─── Info Modal ──────────────────────────────────────────────────────────────
function GachaInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalOverlay isOpen onClose={onClose} zIndex={60}>
      <div className="w-full max-w-lg max-h-[80vh] rounded-2xl p-6 overflow-y-auto" style={{ background: "linear-gradient(180deg, #1a1020 0%, #12121c 100%)", border: "1px solid rgba(167,139,250,0.25)", boxShadow: "0 0 60px rgba(167,139,250,0.1)", overscrollBehavior: "contain" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "#e8e8e8" }}>
            <span style={{ fontSize: 20 }}>x</span> How the Wheel of Stars Works
          </h3>
          <button onClick={onClose} className="text-xl" style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}>x</button>
        </div>

        <div className="space-y-4 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
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

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#a855f7" }}>Pity System</h4>
            <p>Every pull without a Legendary increases your <span style={{ color: "#f97316" }}>pity counter</span>. The Wheel remembers your devotion.</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><span style={{ color: "#f97316" }}>Soft Pity</span> begins at <strong>35 pulls</strong> — your Legendary drop rate increases significantly with each subsequent pull.</li>
              <li><span style={{ color: "#ef4444" }}>Hard Pity</span> at <strong>50 pulls</strong> — you are <em>guaranteed</em> a Legendary item.</li>
              <li><span style={{ color: "#a855f7" }}>Epic Pity</span> guarantees an Epic every <strong>10 pulls</strong>.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#22c55e" }}>The 50/50 (Featured Banners)</h4>
            <p>When you pull a Legendary on a <span style={{ color: "#818cf8" }}>Featured Banner</span>, there is a <strong>50% chance</strong> it will be the featured item.</p>
            <p className="mt-1">If you <em>lose</em> the 50/50, your <strong>next Legendary is guaranteed</strong> to be the featured item. The stars align in your favor.</p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#a78bfa" }}>Duplicates &amp; Rune Shards</h4>
            <p>Already own an item? Duplicates are automatically converted into <span style={{ color: "#a78bfa" }}>Rune Shards</span>, scaling with rarity. Nothing is truly wasted in the Vault.</p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#3b82f6" }}>10-Pull Bonus</h4>
            <p>A 10-pull costs only <strong>90</strong> instead of 100 — a 10% discount. Plus, every 10-pull guarantees <em>at least one Rare or better</em>.</p>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Banner Preview Card (premium, atmospheric) ─────────────────────────────
const BANNER_PORTRAITS: Record<string, string> = {
  standard: "/images/portraits/banner-thalos.png",
  featured: "/images/portraits/banner-nyxara.png",
};

function BannerPreviewCard({
  banner,
  onClick,
}: {
  banner: GachaBanner;
  onClick: () => void;
}) {
  const isFeatured = banner.type === "featured";
  const accentColor = isFeatured ? "#a78bfa" : "#818cf8";
  const glowColor = isFeatured ? "rgba(167,139,250,0.15)" : "rgba(129,140,248,0.12)";
  const portraitSrc = BANNER_PORTRAITS[banner.type];

  // Rune symbols for Thalos (standard banner) — lots of floating runes
  const runeSymbols = ["ᚱ", "ᛏ", "ᚨ", "ᛉ", "ᚹ", "ᛗ", "ᚲ", "ᛊ", "ᛃ", "ᛈ", "ᛚ", "ᛞ", "ᚦ", "ᚷ", "ᛒ"];
  const runePositions = [
    "6%,8%", "78%,5%", "12%,35%", "85%,40%", "3%,65%", "72%,75%", "42%,4%", "55%,90%",
    "25%,18%", "62%,22%", "35%,55%", "90%,15%", "18%,82%", "50%,42%", "68%,60%",
  ];

  // Nebula wisps for Nyxara (featured banner) — elongated fog shapes
  // SVG fog filter IDs (unique per banner instance)
  const reactId = useId();
  const fogId = `fog-${reactId.replace(/:/g, "")}`;

  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-[280px] rounded-2xl p-6 text-left transition-all duration-300 group relative overflow-hidden"
      style={{
        background: `linear-gradient(160deg, ${isFeatured ? "#1c1328" : "#16123a"} 0%, #0c0c18 70%, ${isFeatured ? "#120e1e" : "#0e0e2a"} 100%)`,
        border: `1px solid ${isFeatured ? "rgba(167,139,250,0.3)" : "rgba(129,140,248,0.35)"}`,
        boxShadow: `0 0 50px ${glowColor}, 0 0 20px ${isFeatured ? "rgba(167,139,250,0.06)" : "rgba(129,140,248,0.08)"}, inset 0 1px 0 rgba(255,255,255,0.03)`,
        cursor: "pointer",
      }}
    >
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
        boxShadow: `inset 0 0 30px ${isFeatured ? "rgba(167,139,250,0.05)" : "rgba(129,140,248,0.06)"}, 0 0 40px ${isFeatured ? "rgba(167,139,250,0.08)" : "rgba(129,140,248,0.1)"}`,
        animation: "banner-glow-pulse 4s ease-in-out infinite",
      }} />

      {/* Floating particles — Runes for Standard, Nebula for Featured */}
      {!isFeatured && runePositions.map((pos, i) => (
        <span key={`rune-${i}`} style={{
          position: "absolute",
          left: pos.split(",")[0],
          top: pos.split(",")[1],
          fontSize: i % 2 === 0 ? 14 : 11,
          opacity: 0.2,
          animation: `rune-drift-${i % 3} ${3 + i * 0.5}s ease-in-out infinite`,
          animationDelay: `${i * 0.4}s`,
          pointerEvents: "none",
          color: "#818cf8",
          zIndex: 0,
          textShadow: "0 0 6px rgba(129,140,248,0.4)",
        }}>{runeSymbols[i]}</span>
      ))}
      {isFeatured && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none" style={{ zIndex: 3 }}>
          {/* Static SVG noise texture rendered once as background-image */}
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
              <filter id={`${fogId}-a`} x="0%" y="0%" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves={2} seed={42} stitchTiles="stitch" result="noise" />
                <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.18  0 0 0 0 0.55  0 0 0 0.55 0" />
                <feGaussianBlur stdDeviation="12" />
              </filter>
              <filter id={`${fogId}-b`} x="0%" y="0%" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.012 0.006" numOctaves={2} seed={137} stitchTiles="stitch" result="noise" />
                <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.28  0 0 0 0 0.15  0 0 0 0 0.6  0 0 0 0.45 0" />
                <feGaussianBlur stdDeviation="10" />
              </filter>
            </defs>
          </svg>
          {/* Layer 1: GPU-accelerated transform only (filter is static) */}
          <svg style={{
            position: "absolute", left: "-100%", bottom: "-5%", width: "300%", height: "105%",
            opacity: 0.7,
            maskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.2) 80%, transparent 95%)",
            animation: "fogDrift1 40s ease-in-out infinite alternate",
            willChange: "transform",
          }}>
            <rect width="100%" height="100%" filter={`url(#${fogId}-a)`} />
          </svg>
          {/* Layer 2 */}
          <svg style={{
            position: "absolute", left: "-80%", bottom: "-5%", width: "260%", height: "100%",
            opacity: 0.5,
            maskImage: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.15) 75%, transparent 90%)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.15) 75%, transparent 90%)",
            animation: "fogDrift2 50s ease-in-out infinite alternate-reverse",
            willChange: "transform",
          }}>
            <rect width="100%" height="100%" filter={`url(#${fogId}-b)`} />
          </svg>
        </div>
      )}

      {/* Subtle animated glow overlay on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
        background: `radial-gradient(ellipse at 50% 30%, ${glowColor} 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Gold accent line at top */}
      <div className="absolute top-0 left-[10%] right-[10%] h-px" style={{
        background: `linear-gradient(90deg, transparent, ${isFeatured ? "rgba(212,196,251,0.3)" : "rgba(129,140,248,0.4)"}, transparent)`,
      }} />

      {/* Character portrait with arch frame — bottom right */}
      {portraitSrc && (
        <div className="absolute -bottom-1 -right-4 pointer-events-none" style={{ width: 170, height: 225, zIndex: 2 }}>
          {/* Glow behind frame */}
          <div style={{
            position: "absolute", inset: -6,
            borderRadius: "45% 45% 4px 4px",
            background: `radial-gradient(ellipse at 50% 40%, ${accentColor}45, transparent 70%)`,
            animation: "banner-glow-pulse 3s ease-in-out infinite",
          }} />
          {/* Arch frame border */}
          <div style={{
            position: "absolute", inset: -2,
            borderRadius: "45% 45% 4px 4px",
            border: `2px solid ${accentColor}80`,
            boxShadow: `0 0 8px ${accentColor}50`,
          }} />
          {/* Full image clipped to arch shape */}
          <div style={{
            width: "100%", height: "100%",
            borderRadius: "45% 45% 4px 4px",
            overflow: "hidden",
          }}>
            <img
              src={portraitSrc}
              alt=""
              style={{
                width: isFeatured ? "100%" : "115%",
                height: isFeatured ? "100%" : "115%",
                objectFit: "cover",
                objectPosition: isFeatured ? "top center" : "15% 10%",
                display: "block",
                marginLeft: isFeatured ? 0 : "-7%",
              }}
            />
          </div>
        </div>
      )}

      <div className="relative space-y-4" style={{ zIndex: 1 }}>
        {/* Banner type badge */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.2em] font-semibold px-2 py-1 rounded" style={{
            color: accentColor,
            background: `${accentColor}35`,
            border: `1px solid ${accentColor}30`,
            letterSpacing: "0.15em",
          }}>
            {isFeatured ? "Featured Banner" : "Standard Banner"}
          </span>
        </div>

        {/* Banner name — large, dramatic */}
        <div>
          <h3 className="text-xl font-bold tracking-wide" style={{ color: "#f0ece4" }}>
            {banner.name}
          </h3>
          <div className="mt-1 h-px w-16" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
        </div>

        {/* Lore text */}
        <p className="text-xs italic leading-relaxed pr-32" style={{ color: "rgba(255,255,255,0.25)" }}>
          {banner.lore}
        </p>

        {/* Currency cost hint */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: getCurrencyInfo(banner.currency).color }}>
            {banner.costSingle} {getCurrencyInfo(banner.currency).label} per draw
          </span>
        </div>

        {/* Enter prompt */}
        <div className="flex items-center gap-2 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider group-hover:tracking-widest transition-all duration-500" style={{ color: `${accentColor}99` }}>
            Enter the Chamber
          </span>
          <span className="text-xs transition-transform duration-300 group-hover:translate-x-1" style={{ color: `${accentColor}60` }}>&rarr;</span>
        </div>
      </div>
    </button>
  );
}

// ─── Banner Pull Modal (full interface) ─────────────────────────────────────
function BannerPullModal({
  banner,
  user,
  pity,
  onPull,
  pulling,
  onClose,
  pool,
}: {
  banner: GachaBanner;
  user: User;
  pity: GachaPityInfo | null;
  onPull: (bannerId: string, count: 1 | 10) => void;
  pulling: boolean;
  onClose: () => void;
  pool: Record<string, Array<{ id: string; name: string; emoji: string; type: string; desc: string }>> | null;
}) {
  const currencies = user.currencies || { gold: user.gold || 0, stardust: 0, essenz: 0, runensplitter: 0, gildentaler: 0, mondstaub: 0 };
  const ci = getCurrencyInfo(banner.currency);
  const balance = currencies[banner.currency as keyof typeof currencies] || 0;
  const canPull1 = balance >= banner.costSingle;
  const canPull10 = balance >= banner.cost10;
  const isFeatured = banner.type === "featured";
  const accentColor = isFeatured ? "#a78bfa" : "#818cf8";
  const [showInfo, setShowInfo] = useState(false);

  // Unique fog filter IDs
  const reactId = useId();
  const fogId = `pull-fog-${reactId.replace(/:/g, "")}`;

  // Rune data for standard banner floating runes
  const runeSymbols = ["ᚱ", "ᛏ", "ᚨ", "ᛉ", "ᚹ", "ᛗ", "ᚲ", "ᛊ", "ᛃ", "ᛈ", "ᛚ", "ᛞ", "ᚦ", "ᚷ", "ᛒ"];
  const runePositions = useMemo(() => [
    { left: "3%", top: "5%" }, { left: "82%", top: "3%" }, { left: "8%", top: "30%" },
    { left: "90%", top: "35%" }, { left: "-2%", top: "60%" }, { left: "75%", top: "70%" },
    { left: "40%", top: "2%" }, { left: "55%", top: "92%" }, { left: "20%", top: "15%" },
    { left: "65%", top: "20%" }, { left: "30%", top: "50%" }, { left: "95%", top: "12%" },
    { left: "15%", top: "85%" }, { left: "50%", top: "40%" }, { left: "70%", top: "55%" },
  ], []);

  const runeAnimations = ["gacha-rune-up", "gacha-rune-up-left", "gacha-rune-up-right", "gacha-rune-drift"];

  // Resolve featured item names from pool
  const featuredItemNames = (banner.featuredItems || []).map(itemId => {
    if (!pool) return itemId;
    for (const rarity of Object.keys(pool)) {
      const found = pool[rarity]?.find(it => it.id === itemId);
      if (found) return found.name;
    }
    return itemId;
  });

  const portraitSrc = BANNER_PORTRAITS[banner.type];

  // Fog SVG for buttons
  const ButtonFog = ({ seed1, seed2 }: { seed1: number; seed2: number }) => {
    const btnFogId = `btn-fog-${fogId}-${seed1}`;
    return (
      <>
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            <filter id={`${btnFogId}-a`} x="-25%" y="-25%" width="150%" height="150%">
              <feTurbulence type="fractalNoise" baseFrequency="0.006 0.01" numOctaves={1} seed={seed1} stitchTiles="stitch" result="noise" />
              <feColorMatrix in="noise" type="matrix" values={`0 0 0 0 ${isFeatured ? "0.35" : "0.28"}  0 0 0 0 ${isFeatured ? "0.18" : "0.22"}  0 0 0 0 ${isFeatured ? "0.55" : "0.6"}  0 0 0 0.35 0`} />
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <filter id={`${btnFogId}-b`} x="-25%" y="-25%" width="150%" height="150%">
              <feTurbulence type="fractalNoise" baseFrequency="0.008 0.005" numOctaves={1} seed={seed2} stitchTiles="stitch" result="noise" />
              <feColorMatrix in="noise" type="matrix" values={`0 0 0 0 ${isFeatured ? "0.3" : "0.22"}  0 0 0 0 ${isFeatured ? "0.15" : "0.2"}  0 0 0 0 ${isFeatured ? "0.6" : "0.65"}  0 0 0 0.25 0`} />
              <feGaussianBlur stdDeviation="12" />
            </filter>
          </defs>
        </svg>
        <svg style={{
          position: "absolute", left: "-80%", top: "-40%", width: "260%", height: "180%",
          opacity: 0.35, zIndex: 0, pointerEvents: "none",
          animation: "fogDrift1 12s ease-in-out infinite alternate",
          willChange: "transform",
        }}>
          <rect width="100%" height="100%" filter={`url(#${btnFogId}-a)`} />
        </svg>
        <svg style={{
          position: "absolute", left: "-80%", top: "-40%", width: "260%", height: "180%",
          opacity: 0.28, zIndex: 0, pointerEvents: "none",
          animation: "fogDrift2 15s ease-in-out infinite alternate-reverse",
          willChange: "transform",
        }}>
          <rect width="100%" height="100%" filter={`url(#${btnFogId}-b)`} />
        </svg>
      </>
    );
  };

  // Pity info panel (click-toggle)
  const inSoftPity = pity ? pity.pityCounter >= 35 : false;
  const pullsTilLegendary = pity ? (50 - pity.pityCounter) : 50;

  return (
    <ModalOverlay isOpen onClose={onClose} zIndex={55}>
      <div className="w-full max-w-lg rounded-2xl relative" style={{
        overflow: "visible",
        background: `linear-gradient(160deg, ${isFeatured ? "#1c1328" : "#16123a"} 0%, #0f0f1a 100%)`,
        border: `1px solid ${isFeatured ? "rgba(167,139,250,0.2)" : "rgba(129,140,248,0.25)"}`,
        boxShadow: `0 0 80px ${isFeatured ? "rgba(167,139,250,0.08)" : "rgba(129,140,248,0.1)"}`,
      }}>
        {/* Floating runes (standard banner) — overflow beyond modal edges */}
        {!isFeatured && runePositions.map((pos, i) => (
          <span key={`modal-rune-${i}`} style={{
            position: "absolute",
            left: pos.left,
            top: pos.top,
            fontSize: i % 2 === 0 ? 16 : 12,
            color: "#818cf8",
            textShadow: "0 0 8px rgba(129,140,248,0.5)",
            pointerEvents: "none",
            zIndex: 0,
            opacity: 0, animation: `${runeAnimations[i % runeAnimations.length]} ${4 + i * 0.6}s ease-in-out infinite both`,
            animationDelay: `${i < 5 ? 0 : (i - 5) * 0.15}s`,
          }}>{runeSymbols[i]}</span>
        ))}

        {/* Nyxara fog wisps (featured banner) — like runes for Thalos */}
        {isFeatured && (
          <div className="pointer-events-none" style={{
            position: "absolute",
            left: "-70%",
            top: "-60%",
            width: "240%",
            height: "220%",
            zIndex: 0,
            maskImage: "radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.12) 72%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.12) 72%, transparent 90%)",
          }}>
            <svg width="0" height="0" style={{ position: "absolute" }}>
              <defs>
                <filter id={`${fogId}-modal-a`} x="-25%" y="-25%" width="150%" height="150%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.012 0.015" numOctaves={1} seed={77} stitchTiles="stitch" result="noise" />
                  <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.18  0 0 0 0 0.55  0 0 0 0.55 0" />
                  <feGaussianBlur stdDeviation="14" />
                </filter>
                <filter id={`${fogId}-modal-b`} x="-25%" y="-25%" width="150%" height="150%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.015 0.008" numOctaves={1} seed={199} stitchTiles="stitch" result="noise" />
                  <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.28  0 0 0 0 0.15  0 0 0 0 0.6  0 0 0 0.45 0" />
                  <feGaussianBlur stdDeviation="18" />
                </filter>
              </defs>
            </svg>
            <svg style={{
              position: "absolute", left: "-80%", top: "-40%", width: "260%", height: "180%",
              opacity: 0.8,
              animation: "fogDrift1 18s ease-in-out infinite alternate",
              willChange: "transform",
            }}>
              <rect width="100%" height="100%" filter={`url(#${fogId}-modal-a)`} />
            </svg>
            <svg style={{
              position: "absolute", left: "-70%", top: "-35%", width: "240%", height: "170%",
              opacity: 0.65,
              animation: "fogDrift2 24s ease-in-out infinite alternate-reverse",
              willChange: "transform",
            }}>
              <rect width="100%" height="100%" filter={`url(#${fogId}-modal-b)`} />
            </svg>
          </div>
        )}

        {/* Header with character portrait */}
        <div className="relative overflow-hidden" style={{ minHeight: portraitSrc ? 200 : undefined }}>
          {portraitSrc && (
            <div className="absolute right-4 top-3 pointer-events-none" style={{ width: 140, height: 185, zIndex: 0 }}>
              <div style={{
                position: "absolute", inset: -8,
                borderRadius: "45% 45% 4px 4px",
                background: `radial-gradient(ellipse at 50% 40%, ${accentColor}45, transparent 70%)`,
                animation: "banner-glow-pulse 3s ease-in-out infinite",
              }} />
              <div style={{
                position: "absolute", inset: -2,
                borderRadius: "45% 45% 4px 4px",
                border: `2px solid ${accentColor}80`,
                boxShadow: `0 0 12px ${accentColor}50`,
              }} />
              <div style={{
                width: "100%", height: "100%",
                borderRadius: "45% 45% 4px 4px",
                overflow: "hidden",
              }}>
                <img
                  src={portraitSrc}
                  alt=""
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "top center", display: "block",
                  }}
                />
              </div>
            </div>
          )}

          <div className="p-5 pb-0 relative" style={{ zIndex: 1 }}>
            <div className="flex items-start justify-between mb-1">
              <div style={{ maxWidth: portraitSrc ? "60%" : undefined }}>
                <span className="text-[9px] uppercase tracking-[0.15em] font-semibold px-2 py-0.5 rounded" style={{
                  color: accentColor, background: `${accentColor}35`, border: `1px solid ${accentColor}30`,
                }}>
                  {isFeatured ? "Featured Banner" : "Standard Banner"}
                </span>
                <h3 className="text-lg font-bold mt-2" style={{ color: "#f0ece4" }}>{banner.name}</h3>
              </div>
              {/* Close button - absolute top right */}
                <button onClick={onClose} className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ color: "rgba(255,255,255,0.5)", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", zIndex: 10 }}>✕</button>
            </div>
            <p className="text-xs italic leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.25)", maxWidth: portraitSrc ? "55%" : undefined }}>
              {banner.lore}
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Cost / Balance */}
          <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Cost per pull</p>
              <p className="text-sm font-mono font-bold" style={{ color: ci.color }}>{banner.costSingle} {ci.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Your Balance</p>
                <p className="text-sm font-mono font-bold" style={{ color: balance > 0 ? ci.color : "rgba(255,255,255,0.2)" }}>{balance}</p>
              </div>
              <button
                onClick={() => setShowInfo(v => !v)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  color: showInfo ? "#fff" : "rgba(255,255,255,0.45)",
                  background: showInfo ? accentColor + "40" : "rgba(255,255,255,0.06)",
                  border: "1px solid " + (showInfo ? accentColor + "60" : "rgba(255,255,255,0.12)"),
                  cursor: "pointer",
                }}
              >?</button>
            </div>
          </div>

          {/* Featured items */}
          {isFeatured && featuredItemNames.length > 0 && (
            <div className="rounded-xl px-3 py-2" style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)" }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#818cf8" }}>Featured Items</p>
              <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                {featuredItemNames.join(", ")}
              </p>
            </div>
          )}

          {/* Click-toggle info panel (pity + drop rates) */}
          {showInfo && (
            <div className="rounded-xl px-4 py-3 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <p className="text-xs font-bold mb-1.5" style={{ color: "#e0e0e0" }}>Pity System</p>
                {pity ? (
                  <>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                      <span className="font-semibold" style={{ color: "#f97316" }}>Legendary: {pity.pityCounter}/50</span>
                      {"  "}
                      <span className="font-semibold" style={{ color: "#a855f7" }}>Epic: {pity.epicPityCounter}/10</span>
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {50 - pity.pityCounter} pulls until guaranteed Legendary
                      {pity.pityCounter >= 35 && <span style={{ color: "#f97316" }}> — Soft Pity active!</span>}
                      {pity.guaranteed5050 && <span style={{ color: "#22c55e" }}> — Next Legendary = Featured!</span>}
                    </p>
                  </>
                ) : (
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Pull to start tracking pity</p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold mb-1.5" style={{ color: "#e0e0e0" }}>Drop Rates</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <span style={{ color: "#f97316" }}>Legendary 1.6%</span>{" · "}<span style={{ color: "#a855f7" }}>Epic 13%</span>{" · "}<span style={{ color: "#3b82f6" }}>Rare 35%</span>{" · "}<span style={{ color: "#22c55e" }}>Uncommon 40%</span>{" · "}<span style={{ color: "#9ca3af" }}>Common 10.4%</span>
                </p>
                <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Soft pity starts at pull 35 — legendary chance increases with each pull. Hard pity at 50 guarantees a legendary item.
                </p>
              </div>
            </div>
          )}

          {/* Pull buttons with fog */}
          <div className="flex gap-3 items-stretch flex-wrap">
            {/* 1× Pull */}
            <button
              onClick={() => onPull(banner.id, 1)}
              disabled={!canPull1 || pulling}
              className="rounded-xl flex-1 min-w-[140px] transition-all group/btn"
              style={{
                position: "relative",
                overflow: "hidden",
                padding: "12px 20px",
                background: canPull1
                  ? `linear-gradient(135deg, ${isFeatured ? "rgba(167,139,250,0.25)" : "rgba(129,140,248,0.25)"} 0%, ${isFeatured ? "rgba(139,92,246,0.15)" : "rgba(99,102,241,0.15)"} 100%)`
                  : "rgba(255,255,255,0.04)",
                color: canPull1 ? (isFeatured ? "#d4c4fb" : "#c7d2fe") : "rgba(255,255,255,0.2)",
                border: `1px solid ${canPull1 ? (isFeatured ? "rgba(167,139,250,0.5)" : "rgba(129,140,248,0.5)") : "rgba(255,255,255,0.08)"}`,
                boxShadow: canPull1 ? `0 0 20px ${isFeatured ? "rgba(167,139,250,0.2)" : "rgba(129,140,248,0.2)"}` : "none",
                cursor: canPull1 && !pulling ? "pointer" : "default",
                transform: "scale(1)",
                transition: "transform 0.15s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={e => { if (canPull1) e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              onMouseDown={e => { if (canPull1) e.currentTarget.style.transform = "scale(0.95)"; }}
              onMouseUp={e => { if (canPull1) e.currentTarget.style.transform = "scale(1.05)"; }}
            >
              {canPull1 && <ButtonFog seed1={42} seed2={91} />}
              <div style={{ position: "relative", zIndex: 10 }}>
                <div className="text-sm font-bold">{pulling ? "..." : "1× Arcane Pull"}</div>
                <div className="text-[11px] mt-0.5" style={{ opacity: 0.65, fontWeight: 400 }}>{banner.costSingle} {ci.label}</div>
              </div>
            </button>
            {/* 10× Pull */}
            <button
              onClick={() => onPull(banner.id, 10)}
              disabled={!canPull10 || pulling}
              className="rounded-xl flex-1 min-w-[140px] transition-all group/btn"
              style={{
                position: "relative",
                overflow: "hidden",
                padding: "12px 20px",
                background: canPull10
                  ? `linear-gradient(135deg, ${isFeatured ? "rgba(139,92,246,0.3)" : "rgba(99,102,241,0.3)"} 0%, ${isFeatured ? "rgba(124,58,237,0.2)" : "rgba(79,70,229,0.2)"} 100%)`
                  : "rgba(255,255,255,0.04)",
                color: canPull10 ? (isFeatured ? "#d4c4fb" : "#c7d2fe") : "rgba(255,255,255,0.2)",
                border: `2px solid ${canPull10 ? (isFeatured ? "rgba(167,139,250,0.8)" : "rgba(129,140,248,0.8)") : "rgba(255,255,255,0.08)"}`,
                boxShadow: canPull10 ? `0 0 15px ${isFeatured ? "rgba(167,139,250,0.4)" : "rgba(129,140,248,0.4)"}, 0 0 35px ${isFeatured ? "rgba(167,139,250,0.25)" : "rgba(129,140,248,0.25)"}, inset 0 0 15px ${isFeatured ? "rgba(167,139,250,0.1)" : "rgba(129,140,248,0.1)"}` : "none",
                cursor: canPull10 && !pulling ? "pointer" : "default",
                transform: "scale(1)",
                transition: "transform 0.15s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={e => { if (canPull10) e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              onMouseDown={e => { if (canPull10) e.currentTarget.style.transform = "scale(0.95)"; }}
              onMouseUp={e => { if (canPull10) e.currentTarget.style.transform = "scale(1.05)"; }}
            >
              {canPull10 && <ButtonFog seed1={137} seed2={200} />}
              <div style={{ position: "relative", zIndex: 10 }}>
                <div className="text-sm font-bold">{pulling ? "..." : "10× Arcane Pull"}</div>
                <div className="text-[11px] mt-0.5" style={{ opacity: 0.65, fontWeight: 400 }}>{banner.cost10} {ci.label}</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Main GachaView ──────────────────────────────────────────────────────────
export default function GachaView({ users, playerName, reviewApiKey, onRefresh, onPullComplete }: {
  users: User[];
  playerName: string;
  reviewApiKey: string;
  onRefresh?: () => void;
  onPullComplete?: (items: any[]) => void;
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
  const [selectedBanner, setSelectedBanner] = useState<GachaBanner | null>(null);
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

  // Pre-load pool for item name resolution
  useEffect(() => {
    fetch("/api/gacha/pool").then(r => r.json()).then(data => {
      if (data.pool) setPoolInfo(data.pool);
    }).catch(() => {});
  }, []);

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
      setSelectedBanner(null); // close pull modal before animation
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

  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const closePool = useCallback(() => setPoolOpen(false), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const closeBanner = useCallback(() => setSelectedBanner(null), []);

  if (!loggedIn || !user) {
    return (
      <div className="space-y-4">
        <div className="text-center py-16 space-y-3">
          <img src="/images/icons/vault-of-fate.png" alt="" style={{ width: 96, height: 96, imageRendering: "auto", margin: "0 auto", display: "block", filter: "drop-shadow(0 0 12px rgba(167,139,250,0.6)) drop-shadow(0 0 30px rgba(167,139,250,0.3))" }} />
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
          onClose={() => { if (pullResults && onPullComplete) onPullComplete(pullResults); setPullResults(null); }}
          onCollect={(name) => {}}
        />
      )}

      {/* Info modal */}
      {infoOpen && <GachaInfoModal onClose={closeInfo} />}

      {/* Lore Header — icon left, buttons top-right */}
      <div className="rounded-2xl p-5 relative" style={{
        background: "linear-gradient(135deg, rgba(20,16,42,0.8) 0%, rgba(15,15,26,0.9) 100%)",
        border: "1px solid rgba(167,139,250,0.15)",
        boxShadow: "0 0 60px rgba(167,139,250,0.05)",
      }}>
        {/* Top-right buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
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
            onClick={() => setPoolOpen(true)}
            className="btn-interactive text-xs px-3 py-1.5 rounded-lg"
            style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Item Pool
          </button>
        </div>
        {/* Icon + Title vertically centered, Flavor below */}
        <div className="flex items-center gap-5 mb-3">
          <div className="flex-shrink-0" style={{ animation: "vault-fate-glow 5s ease-in-out infinite alternate" }}>
            <img src="/images/icons/vault-of-fate.png" alt="" style={{
              width: 128, height: 128, imageRendering: "auto", display: "block",
              filter: "drop-shadow(0 0 12px rgba(167,139,250,0.5)) drop-shadow(0 0 30px rgba(167,139,250,0.25))",
            }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: "#e8e8e8" }}>The Vault of Fate</h2>
        </div>
        <p className="text-xs italic leading-relaxed max-w-2xl" style={{ color: "rgba(255,255,255,0.3)" }}>
          A circular chamber with a single, floating astrolabe structure at its center: the Wheel of Stars. Here, heroes draw items, companions, and artifacts from the Aetherstream. The Vault remembers every pull — and rewards persistence.
        </p>
      </div>

      {/* Banner Preview Cards — atmospheric, click to open */}
      <div className="flex gap-4 flex-wrap">
        {banners.map(b => (
          <BannerPreviewCard
            key={b.id}
            banner={b}
            onClick={() => setSelectedBanner(b)}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </p>
      )}

      {/* Banner Pull Modal */}
      {selectedBanner && (
        <BannerPullModal
          banner={selectedBanner}
          user={user}
          pity={pity}
          onPull={doPull}
          pulling={pulling}
          onClose={closeBanner}
          pool={poolInfo}
        />
      )}

      {/* History modal */}
      <ModalOverlay isOpen={historyOpen} onClose={closeHistory}>
        <div className="w-full max-w-2xl max-h-[70vh] rounded-2xl p-5 overflow-y-auto" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", overscrollBehavior: "contain" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Pull History (last 50)</h3>
            <button onClick={closeHistory} style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No pulls yet.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 50).map((h, i) => {
                const cfg = RARITY_CONFIG[h.rarity] || RARITY_CONFIG.common;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <span className="text-base">{h.emoji || "?"}</span>
                    <span className="text-xs font-semibold flex-1" style={{ color: cfg.color }}>{h.name}</span>
                    <span className="text-[9px] uppercase font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>{cfg.label}</span>
                    {h.isDuplicate && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: "#a78bfa", background: "rgba(167,139,250,0.15)" }}>DUP</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalOverlay>

      {/* Pool info modal */}
      <ModalOverlay isOpen={poolOpen && !!poolInfo} onClose={closePool}>
        <div className="w-full max-w-2xl max-h-[70vh] rounded-2xl p-5 overflow-y-auto" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", overscrollBehavior: "contain" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Item Pool</h3>
            <button onClick={closePool} style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          {poolInfo && (
            <div className="space-y-5">
              {["legendary", "epic", "rare", "uncommon", "common"].map(rarity => {
                const items = poolInfo[rarity] || [];
                if (items.length === 0) return null;
                const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
                return (
                  <div key={rarity}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: cfg.color }}>{cfg.label} ({items.length})</p>
                    <div className="space-y-1.5">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                          <span className="text-base">{item.emoji || "?"}</span>
                          <span className="text-xs font-semibold" style={{ color: cfg.color }}>{item.name}</span>
                          <span className="text-[9px] ml-auto font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {item.type === "weapon" ? "Weapon" : item.type === "armor" ? "Armor" : item.type === "consumable" ? "Consumable" : "Artifact"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalOverlay>
    </div>
  );
}
