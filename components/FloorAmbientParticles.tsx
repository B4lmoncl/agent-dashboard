"use client";

import { useMemo } from "react";

// ─── Floor ambient particle configs ──────────────────────────────────────────
// Each floor gets unique particle types, colors, and motion patterns
// that float across the entire page content area (not just the banner)

interface ParticleConfig {
  count: number;
  colors: string[];
  glowColors: string[];
  sizeRange: [number, number];
  opacityRange: [number, number];
  animClass: string;
  /** Extra CSS per particle (for custom shapes etc.) */
  extraStyle?: (i: number) => React.CSSProperties;
}

const FLOOR_PARTICLES: Record<string, ParticleConfig> = {
  // Great Halls — rising embers and warm sparks
  haupthalle: {
    count: 16,
    colors: ["#ff6a00", "#ffa040", "#ff8c20", "#d45e00"],
    glowColors: ["rgba(255,106,0,0.3)", "rgba(255,160,64,0.2)", "rgba(255,140,32,0.25)"],
    sizeRange: [2, 4],
    opacityRange: [0.15, 0.4],
    animClass: "floor-ember",
  },
  // Breakaway — soft pink/rose petals drifting
  breakaway: {
    count: 12,
    colors: ["#f9a8d4", "#f472b6", "#fda4af", "#e879a0"],
    glowColors: ["rgba(244,114,182,0.15)", "rgba(253,164,175,0.12)"],
    sizeRange: [3, 6],
    opacityRange: [0.08, 0.2],
    animClass: "floor-petal",
    extraStyle: (i) => ({
      borderRadius: i % 3 === 0 ? "50% 0 50% 0" : "50%",
      transform: `rotate(${i * 37}deg)`,
    }),
  },
  // Inner Sanctum — blue arcane runes/motes
  charakterturm: {
    count: 14,
    colors: ["#60a5fa", "#93c5fd", "#3b82f6", "#818cf8"],
    glowColors: ["rgba(59,130,246,0.2)", "rgba(129,140,248,0.15)"],
    sizeRange: [2, 5],
    opacityRange: [0.1, 0.3],
    animClass: "floor-rune",
  },
  // Trading District — purple forge sparks
  gewerbeviertel: {
    count: 14,
    colors: ["#c084fc", "#a855f7", "#d8b4fe", "#7c3aed"],
    glowColors: ["rgba(168,85,247,0.2)", "rgba(192,132,252,0.15)"],
    sizeRange: [2, 4],
    opacityRange: [0.12, 0.3],
    animClass: "floor-spark",
  },
  // Pinnacle — golden stardust
  turmspitze: {
    count: 18,
    colors: ["#fbbf24", "#fde68a", "#f59e0b", "#fff8dc"],
    glowColors: ["rgba(251,191,36,0.25)", "rgba(253,230,138,0.15)"],
    sizeRange: [1.5, 4],
    opacityRange: [0.1, 0.35],
    animClass: "floor-stardust",
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function FloorAmbientParticles({ floorId }: { floorId: string }) {
  const config = FLOOR_PARTICLES[floorId];

  const particles = useMemo(() => {
    if (!config) return [];
    return Array.from({ length: config.count }, (_, i) => {
      // Deterministic pseudo-random distribution using golden ratio
      const phi = i * 137.508;
      const x = (phi * 1.3) % 100;
      const y = (phi * 2.7 + i * 17) % 100;
      const size = config.sizeRange[0] + ((phi * 0.7) % 1) * (config.sizeRange[1] - config.sizeRange[0]);
      const color = config.colors[i % config.colors.length]!;
      const glow = config.glowColors[i % config.glowColors.length]!;
      const opacity = config.opacityRange[0] + ((phi * 0.3) % 1) * (config.opacityRange[1] - config.opacityRange[0]);
      const delay = (i * 0.8) % 8;
      const duration = 8 + (i % 5) * 2;
      // Random drift direction
      const dx = Math.cos(phi * 0.01745) * (30 + (i % 4) * 15);
      const dy = Math.sin(phi * 0.01745) * -1 * (20 + (i % 3) * 10) - 15;
      return { x, y, size, color, glow, opacity, delay, duration, dx, dy, i };
    });
  }, [config]);

  if (!config) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {particles.map(p => (
        <div
          key={p.i}
          className={`absolute rounded-full ${config.animClass}`}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.glow}`,
            opacity: 0,
            willChange: "transform, opacity",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            "--drift-x": `${p.dx}px`,
            "--drift-y": `${p.dy}px`,
            "--max-opacity": `${p.opacity}`,
            ...(config.extraStyle ? config.extraStyle(p.i) : {}),
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
