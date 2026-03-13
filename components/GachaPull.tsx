"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GachaPullResult, GachaItem } from "@/app/types";

// ─── Rarity config ────────────────────────────────────────────────────────────
const RARITY_CONFIG: Record<string, { color: string; glow: string; bg: string; label: string; border: string }> = {
  common:    { color: "#9ca3af", glow: "rgba(156,163,175,0.3)", bg: "rgba(156,163,175,0.08)", label: "Common", border: "rgba(156,163,175,0.3)" },
  uncommon:  { color: "#22c55e", glow: "rgba(34,197,94,0.4)",   bg: "rgba(34,197,94,0.08)",  label: "Uncommon", border: "rgba(34,197,94,0.4)" },
  rare:      { color: "#3b82f6", glow: "rgba(59,130,246,0.5)",  bg: "rgba(59,130,246,0.10)", label: "Rare", border: "rgba(59,130,246,0.5)" },
  epic:      { color: "#a855f7", glow: "rgba(168,85,247,0.6)",  bg: "rgba(168,85,247,0.12)", label: "Epic", border: "rgba(168,85,247,0.6)" },
  legendary: { color: "#f97316", glow: "rgba(249,115,22,0.7)",  bg: "rgba(249,115,22,0.15)", label: "Legendary", border: "rgba(249,115,22,0.7)" },
};

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

// ─── Particle system (pure CSS/JS) ───────────────────────────────────────────
function Particles({ rarity, count = 20 }: { rarity: string; count?: number }) {
  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 360;
    const distance = 60 + Math.random() * 100;
    const size = 2 + Math.random() * 4;
    const delay = Math.random() * 0.3;
    const duration = 0.6 + Math.random() * 0.8;
    return { angle, distance, size, delay, duration, id: i };
  });

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
            transform: `translate(-50%, -50%)`,
            ["--px" as string]: `${Math.cos(p.angle * Math.PI / 180) * p.distance}px`,
            ["--py" as string]: `${Math.sin(p.angle * Math.PI / 180) * p.distance}px`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
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

// ─── Single Pull Animation ───────────────────────────────────────────────────
function SinglePullReveal({ result, onDone }: { result: GachaPullResult; onDone: () => void }) {
  const [phase, setPhase] = useState<"charge" | "flash" | "reveal" | "done">("charge");
  const rarity = result.item.rarity;
  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  const isLegendary = rarity === "legendary";
  const isEpic = rarity === "epic";
  const isRare = rarity === "rare";

  useScreenShake(phase === "flash" && isLegendary);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("flash"), isLegendary ? 1200 : isEpic ? 800 : 500);
    const t2 = setTimeout(() => setPhase("reveal"), isLegendary ? 1800 : isEpic ? 1200 : 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isLegendary, isEpic]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
      {/* Skip button */}
      <button
        onClick={onDone}
        className="absolute top-4 right-4 text-xs px-3 py-1.5 rounded-lg z-[110]"
        style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        Überspringen
      </button>

      {/* Charge phase — glowing orb */}
      {phase === "charge" && (
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full"
            style={{
              background: `radial-gradient(circle, ${cfg.color} 0%, transparent 70%)`,
              animation: "gacha-charge 1s ease-in-out infinite",
              boxShadow: `0 0 40px ${cfg.glow}, 0 0 80px ${cfg.glow}`,
            }}
          />
          {/* Currency flying in */}
          <div className="absolute inset-0">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="absolute text-lg"
                style={{
                  left: "50%",
                  top: "50%",
                  animation: `gacha-fly-in 0.8s ${i * 0.1}s ease-in forwards`,
                  ["--startX" as string]: `${Math.cos(i * 60 * Math.PI / 180) * 120}px`,
                  ["--startY" as string]: `${Math.sin(i * 60 * Math.PI / 180) * 120}px`,
                  opacity: 0,
                }}
              >
                💎
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flash phase */}
      {phase === "flash" && (
        <div className="absolute inset-0 z-[105]" style={{
          background: isLegendary
            ? `radial-gradient(circle, ${cfg.color} 0%, rgba(249,115,22,0.3) 40%, transparent 70%)`
            : isEpic
            ? `radial-gradient(circle, ${cfg.color} 0%, rgba(168,85,247,0.2) 50%, transparent 80%)`
            : isRare
            ? `radial-gradient(circle, ${cfg.color} 0%, transparent 60%)`
            : "transparent",
          animation: "gacha-flash 0.6s ease-out forwards",
        }}>
          <Particles rarity={rarity} count={isLegendary ? 40 : isEpic ? 25 : 15} />
        </div>
      )}

      {/* Reveal phase — item card */}
      {(phase === "reveal" || phase === "done") && (
        <div
          className="relative flex flex-col items-center gap-4"
          style={{ animation: "gacha-reveal-card 0.5s ease-out forwards" }}
        >
          <Particles rarity={rarity} count={isLegendary ? 30 : 12} />

          {/* Card */}
          <div
            className="relative rounded-2xl p-6 flex flex-col items-center gap-3 min-w-[200px] max-w-[280px]"
            style={{
              background: `linear-gradient(135deg, #1a1a1a 0%, ${cfg.bg} 100%)`,
              border: `2px solid ${cfg.border}`,
              boxShadow: `0 0 30px ${cfg.glow}, inset 0 0 20px ${cfg.bg}`,
            }}
          >
            {/* Rarity label */}
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
              style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              {cfg.label}
            </span>

            {/* Item emoji */}
            <span className="text-5xl" style={{
              filter: `drop-shadow(0 0 12px ${cfg.glow})`,
              animation: isLegendary ? "gacha-legendary-glow 2s ease-in-out infinite" : undefined,
            }}>
              {result.item.emoji}
            </span>

            {/* Item name */}
            <p className="text-sm font-bold text-center" style={{ color: cfg.color }}>
              {result.item.name}
            </p>

            {/* Item type */}
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
              {result.item.type === "weapon" ? "Waffe" : result.item.type === "armor" ? "Rüstung" : result.item.type === "consumable" ? "Verbrauchbar" : "Gacha"}
            </span>

            {/* Stats */}
            {result.item.stats && Object.keys(result.item.stats).length > 0 && (
              <div className="flex gap-2 flex-wrap justify-center">
                {Object.entries(result.item.stats).filter(([, v]) => v > 0).map(([stat, val]) => (
                  <span key={stat} className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ color: "#e8e8e8", background: "rgba(255,255,255,0.06)" }}>
                    +{val} {stat.charAt(0).toUpperCase() + stat.slice(1)}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-[11px] text-center italic" style={{ color: "rgba(255,255,255,0.35)" }}>
              {result.item.desc}
            </p>

            {/* Duplicate notice */}
            {result.isDuplicate && (
              <div className="text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
                Duplikat → +{result.duplicateRefund} 💎 Runensplitter
              </div>
            )}

            {/* NEW badge */}
            {result.isNew && (
              <div className="absolute -top-2 -right-2 text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#22c55e", color: "#000" }}>
                NEU!
              </div>
            )}
          </div>

          {/* Continue button */}
          <button
            onClick={onDone}
            className="text-xs px-4 py-2 rounded-lg font-semibold mt-2"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            Weiter
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Multi Pull (10x) Summary ────────────────────────────────────────────────
function MultiPullReveal({ results, onDone }: { results: GachaPullResult[]; onDone: () => void }) {
  const [revealed, setRevealed] = useState(false);

  // Sort: legendaries last for drama
  const sorted = [...results].sort((a, b) => {
    return RARITY_ORDER.indexOf(a.item.rarity) - RARITY_ORDER.indexOf(b.item.rarity);
  });

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.9)" }}>
      {/* Skip button */}
      <button
        onClick={onDone}
        className="absolute top-4 right-4 text-xs px-3 py-1.5 rounded-lg z-[110]"
        style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        Überspringen
      </button>

      <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
          10× Arkaner Zug
        </h2>

        {/* Card grid */}
        <div className="grid grid-cols-5 gap-2 w-full">
          {sorted.map((result, i) => {
            const cfg = RARITY_CONFIG[result.item.rarity] || RARITY_CONFIG.common;
            const isLegendary = result.item.rarity === "legendary";
            return (
              <div
                key={i}
                className="relative flex flex-col items-center gap-1 rounded-xl p-2"
                style={{
                  background: `linear-gradient(135deg, #1a1a1a 0%, ${cfg.bg} 100%)`,
                  border: `1px solid ${cfg.border}`,
                  boxShadow: isLegendary ? `0 0 20px ${cfg.glow}` : `0 0 8px ${cfg.glow}`,
                  animation: revealed ? `gacha-card-flip 0.4s ${i * 0.08}s ease-out both` : "none",
                  opacity: 0,
                }}
              >
                <span className="text-2xl sm:text-3xl" style={{
                  filter: isLegendary ? `drop-shadow(0 0 8px ${cfg.glow})` : undefined,
                }}>
                  {result.item.emoji}
                </span>
                <p className="text-[9px] sm:text-[10px] font-semibold text-center leading-tight" style={{ color: cfg.color }}>
                  {result.item.name}
                </p>
                <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {cfg.label}
                </span>
                {result.isDuplicate && (
                  <span className="text-[7px]" style={{ color: "#a78bfa" }}>DUP +{result.duplicateRefund}💎</span>
                )}
                {result.isNew && (
                  <div className="absolute -top-1 -right-1 text-[7px] font-bold px-1 rounded-full"
                    style={{ background: "#22c55e", color: "#000" }}>
                    NEU
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex gap-3 flex-wrap justify-center">
          {RARITY_ORDER.slice().reverse().map(r => {
            const count = results.filter(res => res.item.rarity === r).length;
            if (count === 0) return null;
            const cfg = RARITY_CONFIG[r];
            return (
              <span key={r} className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                {cfg.label}: {count}
              </span>
            );
          })}
        </div>

        <button
          onClick={onDone}
          className="text-xs px-5 py-2 rounded-lg font-semibold"
          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          Schließen
        </button>
      </div>
    </div>
  );
}

// ─── CSS Keyframes (injected once) ───────────────────────────────────────────
const GACHA_STYLES = `
@keyframes gacha-charge {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.3); opacity: 1; }
}

@keyframes gacha-flash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes gacha-particle {
  0% { transform: translate(-50%, -50%) translate(0, 0); opacity: 1; }
  100% { transform: translate(-50%, -50%) translate(var(--px), var(--py)); opacity: 0; }
}

@keyframes gacha-fly-in {
  0% { transform: translate(var(--startX), var(--startY)); opacity: 1; }
  100% { transform: translate(-50%, -50%); opacity: 0; }
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
}: {
  results: GachaPullResult[];
  mode: "single" | "multi";
  onClose: () => void;
}) {
  return (
    <>
      <GachaStyleInjector />
      {mode === "single" && results.length > 0 && (
        <SinglePullReveal result={results[0]} onDone={onClose} />
      )}
      {mode === "multi" && results.length > 0 && (
        <MultiPullReveal results={results} onDone={onClose} />
      )}
    </>
  );
}

export { RARITY_CONFIG };
