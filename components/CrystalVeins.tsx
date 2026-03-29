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
  const mainCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < mainCount; i++) {
    // Start from edges
    const edge = Math.floor(rng() * 4); // 0=left, 1=right, 2=top, 3=bottom
    let sx: number, sy: number, angle: number;
    if (edge === 0) { sx = 0; sy = rng() * h; angle = -0.3 + rng() * 0.6; }
    else if (edge === 1) { sx = w; sy = rng() * h; angle = Math.PI - 0.3 + rng() * 0.6; }
    else if (edge === 2) { sx = rng() * w; sy = 0; angle = Math.PI / 2 - 0.3 + rng() * 0.6; }
    else { sx = rng() * w; sy = h; angle = -Math.PI / 2 - 0.3 + rng() * 0.6; }

    const length = Math.max(w, h) * (0.5 + rng() * 0.6);
    const points = generateVein(sx, sy, angle, length, rng, 25 + rng() * 15);

    veins.push({
      points,
      width: 1.5 + rng() * 1.5,
      opacity: 0.15 + rng() * 0.15,
      speed: 0.8 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
    });

    // Branch veins from main vein points
    const branchCount = 2 + Math.floor(rng() * 4);
    for (let b = 0; b < branchCount; b++) {
      const branchIdx = Math.floor(rng() * (points.length - 2)) + 1;
      const bp = points[branchIdx];
      // Branch angle deviates from parent
      const parentAngle = Math.atan2(
        points[branchIdx + 1]?.y - bp.y || 0,
        points[branchIdx + 1]?.x - bp.x || 1,
      );
      const branchAngle = parentAngle + (rng() > 0.5 ? 1 : -1) * (0.4 + rng() * 0.8);
      const branchLen = length * (0.15 + rng() * 0.25);
      const branchPoints = generateVein(bp.x, bp.y, branchAngle, branchLen, rng, 15 + rng() * 10);

      veins.push({
        points: branchPoints,
        width: 0.8 + rng() * 0.8,
        opacity: 0.08 + rng() * 0.12,
        speed: 1 + rng() * 0.5,
        phase: rng() * Math.PI * 2,
      });

      // Sub-branches (smaller tendrils)
      if (rng() > 0.4 && branchPoints.length > 3) {
        const subIdx = Math.floor(rng() * (branchPoints.length - 2)) + 1;
        const sp = branchPoints[subIdx];
        const subAngle = branchAngle + (rng() - 0.5) * 1.2;
        const subLen = branchLen * (0.2 + rng() * 0.3);
        const subPoints = generateVein(sp.x, sp.y, subAngle, subLen, rng, 10 + rng() * 8);
        veins.push({
          points: subPoints,
          width: 0.5 + rng() * 0.5,
          opacity: 0.05 + rng() * 0.08,
          speed: 1.2 + rng() * 0.6,
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

export default function CrystalVeins({ floorColor = "#818cf8", moonIntensity = 1 }: { floorColor?: string; moonIntensity?: number }) {
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

    ctx.clearRect(0, 0, w, h);

    const [r, g, b] = hexToRgb(floorColor);

    for (const vein of veinsRef.current) {
      if (vein.points.length < 2) continue;

      // Pulsing opacity
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.001 * vein.speed + vein.phase);
      const baseOpacity = vein.opacity * moonIntensity * (0.6 + 0.4 * pulse);

      // Draw glow layer (wider, more transparent)
      ctx.beginPath();
      ctx.moveTo(vein.points[0].x, vein.points[0].y);
      for (let i = 1; i < vein.points.length; i++) {
        ctx.lineTo(vein.points[i].x, vein.points[i].y);
      }
      ctx.strokeStyle = `rgba(${r},${g},${b},${baseOpacity * 0.3})`;
      ctx.lineWidth = vein.width * 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // Draw mid glow
      ctx.beginPath();
      ctx.moveTo(vein.points[0].x, vein.points[0].y);
      for (let i = 1; i < vein.points.length; i++) {
        ctx.lineTo(vein.points[i].x, vein.points[i].y);
      }
      ctx.strokeStyle = `rgba(${r},${g},${b},${baseOpacity * 0.6})`;
      ctx.lineWidth = vein.width * 2.5;
      ctx.stroke();

      // Draw core line (bright, thin)
      ctx.beginPath();
      ctx.moveTo(vein.points[0].x, vein.points[0].y);
      for (let i = 1; i < vein.points.length; i++) {
        ctx.lineTo(vein.points[i].x, vein.points[i].y);
      }
      // Core is brighter — mix toward white
      const coreR = Math.min(255, r + 80);
      const coreG = Math.min(255, g + 80);
      const coreB = Math.min(255, b + 80);
      ctx.strokeStyle = `rgba(${coreR},${coreG},${coreB},${baseOpacity})`;
      ctx.lineWidth = vein.width;
      ctx.stroke();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [floorColor, moonIntensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;

    const resize = () => {
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.scrollHeight; // full scrollable height, not just visible
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      sizeRef.current = { w, h };
      veinsRef.current = generateVeinNetwork(w, h, Math.floor(w * 7 + h * 13));
    };

    resize();
    animRef.current = requestAnimationFrame(draw);

    // Observe parent size changes (content loading, view switches)
    const ro = new ResizeObserver(resize);
    ro.observe(parent!);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
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
