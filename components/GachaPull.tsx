"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { GachaPullResult, GachaItem } from "@/app/types";
import { ModalPortal } from "./ModalPortal";

// ─── Rarity config ────────────────────────────────────────────────────────────
const RARITY_CONFIG: Record<string, { color: string; glow: string; bg: string; label: string; border: string }> = {
  common:    { color: "#9ca3af", glow: "rgba(156,163,175,0.3)", bg: "rgba(156,163,175,0.08)", label: "Common", border: "rgba(156,163,175,0.3)" },
  uncommon:  { color: "#22c55e", glow: "rgba(34,197,94,0.4)",   bg: "rgba(34,197,94,0.08)",  label: "Uncommon", border: "rgba(34,197,94,0.4)" },
  rare:      { color: "#3b82f6", glow: "rgba(59,130,246,0.5)",  bg: "rgba(59,130,246,0.10)", label: "Rare", border: "rgba(59,130,246,0.5)" },
  epic:      { color: "#a855f7", glow: "rgba(168,85,247,0.6)",  bg: "rgba(168,85,247,0.12)", label: "Epic", border: "rgba(168,85,247,0.6)" },
  legendary: { color: "#f97316", glow: "rgba(249,115,22,0.7)",  bg: "rgba(249,115,22,0.15)", label: "Legendary", border: "rgba(249,115,22,0.7)" },
};

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

// ─── Fisher-Yates shuffle ────────────────────────────────────────────────────
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Screen shake for legendary ──────────────────────────────────────────────
function useScreenShake(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const el = document.body;
    el.style.animation = "gacha-shake 0.5s ease-in-out";
    const timer = setTimeout(() => { el.style.animation = ""; }, 500);
    return () => { clearTimeout(timer); el.style.animation = ""; };
  }, [active]);
}

// ─── Charge Orb with 12 inward energy particles (neutral color) ─────────────
function ChargeOrb({ durationMs }: { durationMs: number }) {
  const particles = useMemo(() =>
    Array.from({ length: 48 }, (_, i) => {
      const angle = Math.random() * 360;
      const startDist = 180 + Math.random() * 140;
      const size = 2 + Math.random() * 4;
      
      const phase = i < 16 ? 0 : i < 32 ? 1 : 2;
      const baseDelay = phase === 0 ? (i / 16) * 2.0 : phase === 1 ? 1.5 + ((i - 16) / 16) * 1.5 : 2.5 + ((i - 32) / 16) * 1.0; const delay = baseDelay + Math.random() * 0.4;
      const dur = phase === 0 ? 1.5 + Math.random() * 0.5 : phase === 1 ? 1.0 + Math.random() * 0.4 : 0.6 + Math.random() * 0.3;
      return { angle, startDist, size, delay, dur, id: i };
    }), []);

  const chargeSec = durationMs / 1000;

  return (
    <div className="relative">
      {/* Central orb — neutral white-blue */}
      <div
        className="w-24 h-24 rounded-full"
        style={{
          background: "radial-gradient(circle, #e0e7ff 0%, #818cf8 40%, transparent 70%)",
          animation: `gacha-charge-neutral ${chargeSec}s ease-in-out forwards`,
          boxShadow: "0 0 40px rgba(129,140,248,0.5), 0 0 80px rgba(224,231,255,0.3)",
        }}
      />
      {/* 12 energy particles flowing inward */}
      <div className="absolute inset-0">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: "50%",
              top: "50%",
              width: p.size,
              height: p.size,
              background: "#c7d2fe",
              boxShadow: "0 0 6px rgba(199,210,254,0.6)",
              animation: `gacha-energy-in ${p.dur}s ${p.delay}s ease-in infinite`,
              ["--startX" as string]: `${Math.cos(p.angle * Math.PI / 180) * p.startDist}px`,
              ["--startY" as string]: `${Math.sin(p.angle * Math.PI / 180) * p.startDist}px`,
              opacity: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Burst Particles (on flash/reveal) ──────────────────────────────────────
function BurstParticles({ rarity, count = 20 }: { rarity: string; count?: number }) {
  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 360;
      const distance = 100 + Math.random() * 180;
      const size = 2 + Math.random() * 4;
      const delay = Math.random() * 0.3;
      const duration = 0.6 + Math.random() * 0.8;
      return { angle, distance, size, delay, duration, id: i };
    }), [count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: "50%",
            top: "50%",
            width: p.size,
            height: p.size,
            background: cfg.color,
            boxShadow: `0 0 ${p.size * 2}px ${cfg.glow}`,
            animation: `gacha-particle ${p.duration}s ${p.delay}s ease-out forwards`,
            transform: "translate(-50%, -50%)",
            ["--px" as string]: `${Math.cos(p.angle * Math.PI / 180) * p.distance}px`,
            ["--py" as string]: `${Math.sin(p.angle * Math.PI / 180) * p.distance}px`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

// ─── Item Reveal Card (bigger + prominent rarity label) ─────────────────────
function ItemRevealCard({ result }: { result: GachaPullResult }) {
  const rarity = result.item.rarity;
  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const isLegendary = rarity === "legendary";

  return (
    <div
      className="relative rounded-2xl p-8 flex flex-col items-center gap-4 min-w-[260px] max-w-[340px]"
      style={{
        background: `linear-gradient(135deg, #1a1a1a 0%, ${cfg.bg} 100%)`,
        border: `2px solid ${cfg.border}`,
        boxShadow: `0 0 40px ${cfg.glow}, 0 0 80px ${cfg.glow}, inset 0 0 20px ${cfg.bg}`,
        animation: "gacha-card-glow-pulse 2.5s ease-in-out infinite alternate",
      }}
    >
      {/* Prominent rarity label */}
      <span
        className="text-xs font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full"
        style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        {cfg.label}
      </span>

      {/* Item emoji — bigger */}
      <span className="text-7xl" style={{
        filter: `drop-shadow(0 0 16px ${cfg.glow})`,
        animation: isLegendary ? "gacha-legendary-glow 2s ease-in-out infinite" : undefined,
      }}>
        {result.item.emoji}
      </span>

      {/* Item name — bigger */}
      <p className="text-base font-bold text-center" style={{ color: cfg.color }}>
        {result.item.name}
      </p>

      {/* Item type */}
      <span className="text-[11px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
        {result.item.type === "weapon" ? "Waffe" : result.item.type === "armor" ? "Rüstung" : result.item.type === "consumable" ? "Verbrauchbar" : "Gacha"}
      </span>

      {/* Stats */}
      {result.item.stats && Object.keys(result.item.stats).length > 0 && (
        <div className="flex gap-3 flex-wrap justify-center">
          {Object.entries(result.item.stats).filter(([, v]) => v > 0).map(([stat, val]) => (
            <span key={stat} className="text-[11px] font-mono px-2 py-0.5 rounded"
              style={{ color: "#e8e8e8", background: "rgba(255,255,255,0.06)" }}>
              +{val} {stat.charAt(0).toUpperCase() + stat.slice(1)}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      <p className="text-xs text-center italic" style={{ color: "rgba(255,255,255,0.35)" }}>
        {result.item.desc}
      </p>

      {/* Duplicate notice */}
      {result.isDuplicate && (
        <div className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
          Duplikat → +{result.duplicateRefund} × Runensplitter
        </div>
      )}

      {/* NEW badge */}
      {result.isNew && (
        <div className="absolute -top-2 -right-2 text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: "#22c55e", color: "#000" }}>
          NEU!
        </div>
      )}
    </div>
  );
}

// ─── Single Pull Animation ───────────────────────────────────────────────────
// ALL rarities: 7s total — charge 5.5s, flash 0.3s, reveal 1.2s
function SinglePullReveal({ result, onDone }: { result: GachaPullResult; onDone: () => void; onCollect?: (item: string) => void }) {
  const [phase, setPhase] = useState<"charge" | "flash" | "reveal">("charge");
  const rarity = result.item.rarity;
  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const isLegendary = rarity === "legendary";

  useScreenShake(phase === "flash" && isLegendary);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("flash"), 5500);
    const t2 = setTimeout(() => setPhase("reveal"), 5800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ESC or click-outside during reveal → collect and close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "reveal") onDone();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={() => { if (phase === "reveal") onDone(); }}
    >
      {/* Skip button */}
      <button
        onClick={onDone}
        className="absolute top-4 right-4 text-xs px-3 py-1.5 rounded-lg z-[110]"
        style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        Überspringen
      </button>

      {/* Charge phase — neutral white-blue orb */}
      {phase === "charge" && <ChargeOrb durationMs={5500} />}

      {/* Flash phase — rarity color revealed HERE */}
      {phase === "flash" && (
        <div className="absolute inset-0 z-[105] flex items-center justify-center" style={{
          background: `radial-gradient(circle, ${cfg.color} 0%, ${cfg.glow} 40%, transparent 70%)`,
          animation: "gacha-flash 0.3s ease-out forwards",
        }}>
          <BurstParticles rarity={rarity} count={isLegendary ? 40 : rarity === "epic" ? 25 : 15} />
        </div>
      )}

      {/* Reveal phase — item card */}
      {phase === "reveal" && (
        <div
          className="relative flex flex-col items-center gap-4"
          style={{ animation: "gacha-reveal-card 0.5s ease-out forwards" }}
          onClick={(e) => e.stopPropagation()}
        >
          <BurstParticles rarity={rarity} count={isLegendary ? 30 : 12} />
          <ItemRevealCard result={result} />

          {/* Nehmen button with pulse */}
          <button
            onClick={onDone}
            className="text-sm px-6 py-2.5 rounded-lg font-semibold mt-2 transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, rgba(129,140,248,0.25) 0%, rgba(167,139,250,0.2) 100%)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(129,140,248,0.4)",
              boxShadow: "0 0 15px rgba(129,140,248,0.15)",
              animation: "gacha-weiter-pulse 2s ease-in-out infinite",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(129,140,248,0.4) 0%, rgba(167,139,250,0.35) 100%)"; e.currentTarget.style.boxShadow = "0 0 25px rgba(129,140,248,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(129,140,248,0.25) 0%, rgba(167,139,250,0.2) 100%)"; e.currentTarget.style.boxShadow = "0 0 15px rgba(129,140,248,0.15)"; }}
          >
            Nehmen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Multi Pull (10×) — Sequential HSR-style reveals ────────────────────────
// 8s charge, flash shows BEST rarity, then sequential item reveals
function MultiPullReveal({ results, onDone }: { results: GachaPullResult[]; onDone: () => void; onCollect?: (item: string) => void }) {
  const [phase, setPhase] = useState<"charge" | "flash" | "sequential" | "black" | "summary">("charge");
  const [currentIdx, setCurrentIdx] = useState(0);

  // Fisher-Yates shuffle order
  const shuffledResults = useMemo(() => fisherYatesShuffle(results), [results]);

  // Best rarity in batch (for flash color)
  const bestRarity = useMemo(() => {
    let best = 0;
    for (const r of results) {
      const idx = RARITY_ORDER.indexOf(r.item.rarity);
      if (idx > best) best = idx;
    }
    return RARITY_ORDER[best];
  }, [results]);

  const bestCfg = RARITY_CONFIG[bestRarity] || RARITY_CONFIG.common;
  const isLegendaryBest = bestRarity === "legendary";

  useScreenShake(phase === "flash" && isLegendaryBest);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("flash"), 8000);
    const t2 = setTimeout(() => setPhase("sequential"), 8300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ESC = skip to summary (sequential), or close (summary)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase === "sequential") setPhase("summary");
        else if (phase === "summary") onDone();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, onDone]);

  const handleNehmen = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx < shuffledResults.length) {
      setCurrentIdx(nextIdx);
    } else {
      setPhase("black");
      setTimeout(() => setPhase("summary"), 500);
    }
  }, [currentIdx, shuffledResults.length]);

  const currentResult = shuffledResults[currentIdx];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.9)" }}
      onClick={() => {
        if (phase === "sequential") handleNehmen();
        else if (phase === "summary") onDone();
      }}
    >
      {/* Skip button */}
      <button
        onClick={onDone}
        className="absolute top-4 right-4 text-xs px-3 py-1.5 rounded-lg z-[110]"
        style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        Überspringen
      </button>

      {/* Charge phase — 8s neutral */}
      {phase === "charge" && <ChargeOrb durationMs={8000} />}

      {/* Flash — best rarity color */}
      {phase === "flash" && (
        <div className="absolute inset-0 z-[105] flex items-center justify-center" style={{
          background: `radial-gradient(circle, ${bestCfg.color} 0%, ${bestCfg.glow} 40%, transparent 70%)`,
          animation: "gacha-flash 0.3s ease-out forwards",
        }}>
          <BurstParticles rarity={bestRarity} count={isLegendaryBest ? 40 : 25} />
        </div>
      )}

      {/* Sequential item reveals */}
      {phase === "sequential" && currentResult && (
        <div
          key={currentIdx}
          className="relative flex flex-col items-center gap-4"
          style={{ animation: "gacha-reveal-card 0.5s ease-out forwards" }}
        >
          <BurstParticles rarity={currentResult.item.rarity} count={currentResult.item.rarity === "legendary" ? 30 : 12} />

          {/* Progress indicator */}
          <span className="text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
            {currentIdx + 1} / {shuffledResults.length}
          </span>

          <ItemRevealCard result={currentResult} />

          {/* Nehmen button */}
          <button
            onClick={handleNehmen}
            className="text-sm px-6 py-2.5 rounded-lg font-semibold mt-2 transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, rgba(129,140,248,0.25) 0%, rgba(167,139,250,0.2) 100%)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(129,140,248,0.4)",
              boxShadow: "0 0 15px rgba(129,140,248,0.15)",
              animation: "gacha-weiter-pulse 2s ease-in-out infinite",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(129,140,248,0.4) 0%, rgba(167,139,250,0.35) 100%)"; e.currentTarget.style.boxShadow = "0 0 25px rgba(129,140,248,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(129,140,248,0.25) 0%, rgba(167,139,250,0.2) 100%)"; e.currentTarget.style.boxShadow = "0 0 15px rgba(129,140,248,0.15)"; }}
          >
            Nehmen
          </button>
        </div>
      )}

      {/* Brief black screen before summary */}
      {phase === "black" && <div className="absolute inset-0" style={{ background: "#000" }} />}

      {/* Summary after all items revealed */}
      {phase === "summary" && (
        <div className="flex flex-col items-center gap-5 w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
            10× Arcane Pull — Zusammenfassung
          </h2>

          {/* Card grid */}
          <div className="grid grid-cols-5 gap-4 w-full max-w-3xl">
            {shuffledResults.map((result, i) => {
              const cfg = RARITY_CONFIG[result.item.rarity] || RARITY_CONFIG.common;
              const isLeg = result.item.rarity === "legendary";
              return (
                <div
                  key={i}
                  className="relative flex flex-col items-center gap-1.5 rounded-xl p-3 min-h-[120px] justify-center"
                  style={{
                    background: `linear-gradient(135deg, #1a1a1a 0%, ${cfg.bg} 100%)`,
                    border: `1px solid ${cfg.border}`,
                    boxShadow: isLeg ? `0 0 20px ${cfg.glow}` : `0 0 8px ${cfg.glow}`,
                    animation: `gacha-card-flip 0.4s ${i * 0.08}s ease-out both`,
                    opacity: 0,
                  }}
                >
                  <span className="text-3xl sm:text-4xl" style={{
                    filter: isLeg ? `drop-shadow(0 0 8px ${cfg.glow})` : undefined,
                  }}>
                    {result.item.emoji}
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-center leading-tight" style={{ color: cfg.color }}>
                    {result.item.name}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {cfg.label}
                  </span>
                  {result.isDuplicate && (
                    <span className="text-[10px] font-mono" style={{ color: "#a78bfa" }}>DUP +{result.duplicateRefund}×</span>
                  )}
                  {result.isNew && (
                    <div className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "#22c55e", color: "#000" }}>
                      NEU
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Rarity summary */}
          <div className="flex gap-3 flex-wrap justify-center">
            {RARITY_ORDER.slice().reverse().map(r => {
              const count = results.filter(res => res.item.rarity === r).length;
              if (count === 0) return null;
              const cfg = RARITY_CONFIG[r];
              return (
                <span key={r} className="text-sm font-mono px-3 py-1 rounded" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  {cfg.label}: {count}
                </span>
              );
            })}
          </div>

          <button
            onClick={onDone}
            className="text-sm px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, rgba(129,140,248,0.25) 0%, rgba(167,139,250,0.2) 100%)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(129,140,248,0.4)",
              boxShadow: "0 0 15px rgba(129,140,248,0.15)",
              animation: "gacha-weiter-pulse 2s ease-in-out infinite",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 25px rgba(129,140,248,0.3)"; e.currentTarget.style.background = "linear-gradient(135deg, rgba(129,140,248,0.4) 0%, rgba(167,139,250,0.35) 100%)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 15px rgba(129,140,248,0.15)"; e.currentTarget.style.background = "linear-gradient(135deg, rgba(129,140,248,0.25) 0%, rgba(167,139,250,0.2) 100%)"; }}
          >
            Nehmen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CSS Keyframes (injected once) ───────────────────────────────────────────
const GACHA_STYLES = `
@keyframes gacha-charge-neutral {
  0% { transform: scale(0.6); opacity: 0.4; box-shadow: 0 0 20px rgba(129,140,248,0.3); }
  50% { transform: scale(1.1); opacity: 0.85; box-shadow: 0 0 60px rgba(129,140,248,0.6), 0 0 120px rgba(224,231,255,0.3); }
  80% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 80px rgba(129,140,248,0.8), 0 0 160px rgba(224,231,255,0.4); }
  100% { transform: scale(1.5); opacity: 1; box-shadow: 0 0 100px rgba(255,255,255,0.9), 0 0 200px rgba(129,140,248,0.6); }
}

@keyframes gacha-energy-in {
  0% { transform: translate(var(--startX), var(--startY)); opacity: 0.8; }
  80% { opacity: 0.6; }
  100% { transform: translate(-50%, -50%); opacity: 0; }
}

@keyframes gacha-flash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes gacha-particle {
  0% { transform: translate(-50%, -50%) translate(0, 0); opacity: 1; }
  100% { transform: translate(-50%, -50%) translate(var(--px), var(--py)); opacity: 0; }
}

@keyframes gacha-reveal-card {
  0% { transform: scale(0.3) rotateY(90deg); opacity: 0; }
  60% { transform: scale(1.05) rotateY(0deg); opacity: 1; }
  100% { transform: scale(1) rotateY(0deg); opacity: 1; }
}

@keyframes gacha-card-flip {
  0% { transform: scale(0.5) rotateY(180deg); opacity: 0; }
  60% { transform: scale(1.05) rotateY(0deg); opacity: 1; }
  100% { transform: scale(1) rotateY(0deg); opacity: 1; }
}

@keyframes gacha-legendary-glow {
  0%, 100% { filter: drop-shadow(0 0 12px rgba(249,115,22,0.7)); }
  50% { filter: drop-shadow(0 0 24px rgba(249,115,22,1)) drop-shadow(0 0 40px rgba(249,115,22,0.5)); }
}

@keyframes gacha-shake {
  0%, 100% { transform: translateX(0); }
  10%, 50%, 90% { transform: translateX(-4px) translateY(2px); }
  30%, 70% { transform: translateX(4px) translateY(-2px); }
}

@keyframes gacha-card-glow-pulse {
  0% { filter: brightness(1) drop-shadow(0 0 0px transparent); transform: scale(1); }
  100% { filter: brightness(1.12) drop-shadow(0 0 15px rgba(255,255,255,0.1)); transform: scale(1.01); }
}
@keyframes gacha-weiter-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.15); }
  50% { box-shadow: 0 0 12px 2px rgba(255,255,255,0.1); }
}
`;

function GachaStyleInjector() {
  useEffect(() => {
    const id = "gacha-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = GACHA_STYLES;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);
  return null;
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function GachaPull({
  results,
  mode,
  onClose,
  onCollect,
}: {
  results: GachaPullResult[];
  mode: "single" | "multi";
  onClose: () => void;
  onCollect?: (name: string) => void;
}) {
  return (
    <ModalPortal>
      <GachaStyleInjector />
      {mode === "single" && results.length > 0 && (
        <SinglePullReveal result={results[0]} onDone={onClose} />
      )}
      {mode === "multi" && results.length > 0 && (
        <MultiPullReveal results={results} onDone={onClose} />
      )}
    </ModalPortal>
  );
}

export { RARITY_CONFIG };
