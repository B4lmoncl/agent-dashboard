"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * CrystalVeins — Canvas-based organic crystal vein network
 * Inspired by the glowing aether veins in the Quest Hall header art.
 * Procedurally generates branching, jagged vein paths that pulse with floor color.
 */

interface Vein {
  points: { x: number; y: number }[];
  width: number;
  opacity: number;
  speed: number; // pulse speed multiplier
  phase: number; // starting phase offset
}

// Seeded pseudo-random for deterministic vein layout per viewport size
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateVein(
  startX: number, startY: number,
  angle: number, length: number,
  rng: () => number,
  segmentLen: number = 20,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [{ x: startX, y: startY }];
  let x = startX;
  let y = startY;
  let a = angle;
  const segments = Math.floor(length / segmentLen);

  for (let i = 0; i < segments; i++) {
    // Jagged deviation — organic, not straight
    a += (rng() - 0.5) * 0.8; // up to ~23° deviation per segment
    x += Math.cos(a) * segmentLen;
    y += Math.sin(a) * segmentLen;
    points.push({ x, y });
  }
  return points;
}

function generateVeinNetwork(w: number, h: number, seed: number): Vein[] {
  const rng = seededRandom(seed);
  const veins: Vein[] = [];

  // Main veins: 3-5 large veins crossing the screen diagonally
  // More main veins (5-8) with wider thickness range for variety
  const mainCount = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < mainCount; i++) {
    // Start from all edges, distributed
    const edge = Math.floor(rng() * 4);
    let sx: number, sy: number, angle: number;
    if (edge === 0) { sx = -5; sy = rng() * h; angle = -0.4 + rng() * 0.8; }
    else if (edge === 1) { sx = w + 5; sy = rng() * h; angle = Math.PI - 0.4 + rng() * 0.8; }
    else if (edge === 2) { sx = rng() * w; sy = -5; angle = Math.PI / 2 - 0.4 + rng() * 0.8; }
    else { sx = rng() * w; sy = h + 5; angle = -Math.PI / 2 - 0.4 + rng() * 0.8; }

    const length = Math.max(w, h) * (0.4 + rng() * 0.7);
    const points = generateVein(sx, sy, angle, length, rng, 18 + rng() * 14);

    // Wide thickness variation: some veins thin (0.8), some thick (3.5)
    const mainWidth = i < 2 ? 2.5 + rng() * 1.5 : 0.8 + rng() * 2;

    veins.push({
      points,
      width: mainWidth,
      opacity: mainWidth > 2 ? 0.18 + rng() * 0.12 : 0.1 + rng() * 0.12,
      speed: 0.6 + rng() * 0.6,
      phase: rng() * Math.PI * 2,
    });

    // More branches (3-6) for denser network
    const branchCount = 3 + Math.floor(rng() * 4);
    for (let b = 0; b < branchCount; b++) {
      const branchIdx = Math.floor(rng() * (points.length - 2)) + 1;
      const bp = points[branchIdx];
      const parentAngle = Math.atan2(
        points[branchIdx + 1]?.y - bp.y || 0,
        points[branchIdx + 1]?.x - bp.x || 1,
      );
      const branchAngle = parentAngle + (rng() > 0.5 ? 1 : -1) * (0.3 + rng() * 1.0);
      const branchLen = length * (0.12 + rng() * 0.3);
      const branchPoints = generateVein(bp.x, bp.y, branchAngle, branchLen, rng, 12 + rng() * 10);

      veins.push({
        points: branchPoints,
        width: mainWidth * (0.3 + rng() * 0.4),
        opacity: 0.06 + rng() * 0.1,
        speed: 0.8 + rng() * 0.6,
        phase: rng() * Math.PI * 2,
      });

      // More sub-branches (70% chance instead of 60%)
      if (rng() > 0.3 && branchPoints.length > 3) {
        const subIdx = Math.floor(rng() * (branchPoints.length - 2)) + 1;
        const sp = branchPoints[subIdx];
        const subAngle = branchAngle + (rng() - 0.5) * 1.4;
        const subLen = branchLen * (0.15 + rng() * 0.35);
        const subPoints = generateVein(sp.x, sp.y, subAngle, subLen, rng, 8 + rng() * 8);
        veins.push({
          points: subPoints,
          width: mainWidth * (0.15 + rng() * 0.2),
          opacity: 0.04 + rng() * 0.06,
          speed: 1 + rng() * 0.8,
          phase: rng() * Math.PI * 2,
        });
      }
    }
  }

  return veins;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export default function CrystalVeins({ floorColor = "#818cf8", moonIntensity = 1, seed = 0 }: { floorColor?: string; moonIntensity?: number; seed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const veinsRef = useRef<Vein[]>([]);
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) { animRef.current = requestAnimationFrame(draw); return; }

    ctx.clearRect(0, 0, w, h);

    const [r, g, b] = hexToRgb(floorColor);

    for (const vein of veinsRef.current) {
      if (vein.points.length < 2) continue;

      // Breathe effect: opacity AND glow width pulse together
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.0008 * vein.speed + vein.phase);
      const baseOpacity = vein.opacity * moonIntensity * (0.4 + 0.6 * pulse);
      const glowScale = 0.7 + 0.3 * pulse; // glow width breathes 70%-100%

      const drawPath = () => {
        ctx.beginPath();
        ctx.moveTo(vein.points[0].x, vein.points[0].y);
        for (let i = 1; i < vein.points.length; i++) {
          ctx.lineTo(vein.points[i].x, vein.points[i].y);
        }
      };

      // Outer glow (wide, faint — breathes with pulse)
      drawPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},${baseOpacity * 0.2})`;
      ctx.lineWidth = vein.width * 8 * glowScale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // Mid glow
      drawPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},${baseOpacity * 0.5})`;
      ctx.lineWidth = vein.width * 3 * glowScale;
      ctx.stroke();

      // Core line (bright, thin — constant width for stability)
      drawPath();
      const coreR = Math.min(255, r + 100);
      const coreG = Math.min(255, g + 100);
      const coreB = Math.min(255, b + 100);
      ctx.strokeStyle = `rgba(${coreR},${coreG},${coreB},${baseOpacity * 1.2})`;
      ctx.lineWidth = vein.width;
      ctx.stroke();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [floorColor, moonIntensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;

    // Generate veins once based on a stable reference size (width-only seed).
    // Only regenerate if width changes (e.g. window resize), NOT on height/content changes.
    let generatedForWidth = 0;

    let lastCanvasH = 0;

    const resize = () => {
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.scrollHeight;

      // Only resize canvas if width changed OR height grew significantly (>20%)
      // This prevents flicker from minor scrollHeight changes
      const heightChanged = h > lastCanvasH * 1.2 || lastCanvasH === 0;
      const widthChanged = w !== generatedForWidth;

      if (widthChanged || heightChanged) {
        const stableH = Math.max(h, 4000);
        canvas.width = w * dpr;
        canvas.height = stableH * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${stableH}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
        sizeRef.current = { w, h: stableH };
        lastCanvasH = stableH;
      }

      if (widthChanged) {
        generatedForWidth = w;
        const refH = Math.max(h, 4000);
        veinsRef.current = generateVeinNetwork(w, refH, Math.floor(w * 7919 + seed * 13337));
      }
    };

    resize();
    animRef.current = requestAnimationFrame(draw);

    // Observe parent size changes (content loading, view switches)
    const ro = new ResizeObserver(() => {
      // Debounce resize to let DOM settle after view switches
      requestAnimationFrame(resize);
    });
    ro.observe(parent!);

    // Also re-check after a short delay (catches view transitions where scrollHeight is initially 0)
    const fallbackTimer = setTimeout(resize, 300);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      clearTimeout(fallbackTimer);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.6, borderRadius: "inherit" }}
    />
  );
}
