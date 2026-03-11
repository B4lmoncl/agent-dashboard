"use client";

import { useEffect, useRef } from "react";

type TOD = "dawn" | "day" | "sunset" | "night";
type Season = "spring" | "summer" | "autumn" | "winter";

function getTOD(): TOD {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return "dawn";
  if (h >= 10 && h < 17) return "day";
  if (h >= 17 && h < 20) return "sunset";
  return "night";
}

function getSeason(): Season {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

// Sky gradient [top, upper-mid, lower-mid, horizon]
const SKY: Record<TOD, [string, string, string, string]> = {
  dawn:   ["#07040e", "#2a0e28", "#6e2b18", "#d4582a"],
  day:    ["#060f1c", "#0c2038", "#183e62", "#246a96"],
  sunset: ["#07040e", "#1e0820", "#5c180a", "#c2400a"],
  night:  ["#010306", "#030815", "#071028", "#0f1c3e"],
};

// ─── Particles ────────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; opacity: number; maxOpacity: number;
  rotation: number; rotSpeed: number;
  swayAmp: number; swayFreq: number; swayPhase: number;
  colorBase: string;
  pulsePhase: number;
}

const SEASON_COLORS: Record<Season, string[]> = {
  spring: ["rgba(255,185,205,", "rgba(255,210,225,", "rgba(245,155,185,"],
  summer: ["rgba(255,255,100,", "rgba(200,255,110,", "rgba(150,240,70,"],
  autumn: ["rgba(215,95,25,",   "rgba(185,60,15,",   "rgba(245,145,20,", "rgba(165,50,8,"],
  winter: ["rgba(225,240,255,", "rgba(205,225,255,", "rgba(245,250,255,"],
};

function mkParticle(w: number, h: number, season: Season, scatter = false): Particle {
  const colors = SEASON_COLORS[season];
  const colorBase = colors[Math.floor(Math.random() * colors.length)];
  const isSummer = season === "summer";
  return {
    x: Math.random() * w,
    y: scatter ? Math.random() * h : -10 - Math.random() * 80,
    vx: (Math.random() - 0.5) * (isSummer ? 0.25 : 0.65),
    vy: isSummer ? Math.random() * 0.35 + 0.1 : Math.random() * 0.75 + 0.22,
    size: isSummer ? Math.random() * 2 + 1.5 : Math.random() * 4 + 1.8,
    opacity: scatter ? Math.random() * 0.3 : 0,
    maxOpacity: Math.random() * 0.42 + 0.22,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.04,
    swayAmp: Math.random() * 1.4 + 0.4,
    swayFreq: Math.random() * 0.014 + 0.004,
    swayPhase: Math.random() * Math.PI * 2,
    pulsePhase: Math.random() * Math.PI * 2,
    colorBase,
  };
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, season: Season, t: number) {
  if (p.opacity <= 0.01) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.globalAlpha = p.opacity;

  if (season === "spring") {
    ctx.fillStyle = p.colorBase + "1)";
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.75, p.size * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.colorBase + "0.55)";
    ctx.beginPath();
    ctx.ellipse(0, p.size * 0.85, p.size * 0.28, p.size * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (season === "summer") {
    const pulse = Math.sin(t * 0.003 + p.pulsePhase) * 0.45 + 0.55;
    ctx.globalAlpha = p.opacity * pulse;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 3.5);
    glow.addColorStop(0,   p.colorBase + "0.85)");
    glow.addColorStop(0.3, p.colorBase + "0.35)");
    glow.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.colorBase + "1)";
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (season === "autumn") {
    ctx.fillStyle = p.colorBase + "1)";
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.65, p.size * 1.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.colorBase + "0.45)";
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, -p.size * 1.55);
    ctx.lineTo(0, p.size * 1.55);
    ctx.stroke();
  } else {
    // Snowflake
    ctx.strokeStyle = p.colorBase + "0.82)";
    ctx.lineWidth = 0.65;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const ex = Math.cos(a) * p.size * 1.5;
      const ey = Math.sin(a) * p.size * 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ex, ey); ctx.stroke();
      const mx = ex * 0.5, my = ey * 0.5;
      const px = Math.cos(a + Math.PI / 2) * p.size * 0.4;
      const py = Math.sin(a + Math.PI / 2) * p.size * 0.4;
      ctx.beginPath(); ctx.moveTo(mx - px, my - py); ctx.lineTo(mx + px, my + py); ctx.stroke();
    }
    ctx.fillStyle = p.colorBase + "0.9)";
    ctx.beginPath(); ctx.arc(0, 0, p.size * 0.28, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ─── Window helper ────────────────────────────────────────────────────────────
function drawWin(ctx: CanvasRenderingContext2D, x: number, y: number, ww: number, wh: number,
  r: number, g: number, b: number, alpha: number) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 20);
  glow.addColorStop(0, `rgba(${r},${g},${b},${(alpha * 0.28).toFixed(3)})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.fillRect(x - ww / 2, y - wh / 2, ww, wh);
}

// ─── Guild Hall silhouette ────────────────────────────────────────────────────
function drawGuildHall(ctx: CanvasRenderingContext2D, w: number, h: number, tod: TOD, scrollY: number) {
  const parallax = scrollY * 0.016;
  const baseAlpha = tod === "night" ? 0.13 : tod === "dawn" || tod === "sunset" ? 0.09 : 0.06;

  const silW = Math.min(w * 0.96, 1320);
  const ox = (w - silW) / 2;
  const base = h + parallax;
  const wallH = h * 0.10;
  const wallTop = base - wallH;

  ctx.save();
  ctx.fillStyle = "#050210";
  ctx.globalAlpha = baseAlpha;

  // Base wall spanning full width
  ctx.fillRect(0, wallTop, w, base - wallTop + 2);

  // Helper: tower body + battlements (or pointed roof)
  const tower = (cx: number, topY: number, tw: number, mc: number, pointed = false) => {
    const tx = cx - tw / 2;
    ctx.fillRect(tx, topY, tw, base - topY);
    if (pointed) {
      ctx.beginPath();
      ctx.moveTo(tx, topY);
      ctx.lineTo(cx - tw * 0.08, topY - h * 0.058);
      ctx.lineTo(cx,             topY - h * 0.072);
      ctx.lineTo(cx + tw * 0.08, topY - h * 0.058);
      ctx.lineTo(tx + tw, topY);
      ctx.closePath();
      ctx.fill();
    } else {
      const step = tw / mc;
      const mh = h * 0.015;
      const mw = step * 0.62;
      const gap = (step - mw) / 2;
      for (let i = 0; i < mc; i++) {
        ctx.fillRect(tx + i * step + gap, topY - mh, mw, mh);
      }
    }
  };

  // Left & right edge extensions (taper to edges)
  ctx.fillRect(0, wallTop - h * 0.045, ox * 0.55, h);
  ctx.fillRect(w - ox * 0.55, wallTop - h * 0.045, ox * 0.55, h);

  // Far-left mini turret
  tower(ox + silW * 0.055, wallTop - h * 0.125, silW * 0.035, 3);

  // Left main tower
  const lt = ox + silW * 0.215;
  tower(lt, wallTop - h * 0.235, silW * 0.068, 4);

  // Central gate arch (portcullis shape protruding above wall)
  const gx = ox + silW * 0.50;
  const gw = silW * 0.062;
  const gh = wallH * 1.12;
  ctx.beginPath();
  ctx.moveTo(gx - gw, wallTop);
  ctx.lineTo(gx - gw, wallTop - gh);
  ctx.quadraticCurveTo(gx, wallTop - gh - wallH * 0.20, gx + gw, wallTop - gh);
  ctx.lineTo(gx + gw, wallTop);
  ctx.closePath();
  ctx.fill();

  // Right mid tower
  const rt = ox + silW * 0.695;
  tower(rt, wallTop - h * 0.175, silW * 0.058, 3);

  // Starweaver Tower — tallest, pointed roof
  const sw = ox + silW * 0.865;
  const swH = h * 0.305;
  tower(sw, wallTop - swH, silW * 0.080, 4, true);

  ctx.globalAlpha = 1;

  // ── Windows (only at night/dawn) ─────────────────────────────────────────
  if (tod === "night" || tod === "dawn") {
    const wa = tod === "night" ? 0.78 : 0.38;
    // Left main tower — warm
    drawWin(ctx, lt,           wallTop - h * 0.14,  5, 9,  255, 195, 68, wa);
    drawWin(ctx, lt - silW * 0.013, wallTop - h * 0.20,  4, 7,  255, 210, 88, wa * 0.65);
    // Right mid tower — warm
    drawWin(ctx, rt,           wallTop - h * 0.105, 5, 8,  255, 188, 62, wa);
    // Gate lamp
    drawWin(ctx, gx,           wallTop - gh * 0.7,  4, 4,  255, 200, 78, wa * 0.55);
    // Starweaver tower — purple
    drawWin(ctx, sw,           wallTop - swH * 0.52, 5, 9, 175, 98,  255, wa * 1.1);
    drawWin(ctx, sw + silW * 0.011, wallTop - swH * 0.33, 4, 7, 155, 85, 245, wa * 0.68);
    // Starweaver ambient glow
    const swGlow = ctx.createRadialGradient(sw, wallTop - swH * 0.52, 3, sw, wallTop - swH * 0.52, 36);
    swGlow.addColorStop(0, `rgba(155,80,255,${(wa * 0.32).toFixed(3)})`);
    swGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = swGlow;
    ctx.beginPath(); ctx.arc(sw, wallTop - swH * 0.52, 36, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GuildHallBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tod = getTOD();
    const season = getSeason();
    const mobile = () => canvas.width < 768;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const onScroll = () => { scrollYRef.current = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Deterministic stars seeded by index
    const STAR_COUNT = 115;
    const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
      x: ((i * 7919 + 1234) % 9973) / 9973,
      y: ((i * 6271 + 4321) % 8191) / 8191 * 0.64,
      s: ((i * 3571) % 100) / 100 * 1.15 + 0.22,
      to: ((i * 2341) % 628) / 100,
      ts: 0.0006 + ((i * 1231) % 100) / 100 * 0.0012,
    }));

    // Seasonal particles
    const showParticles = season !== "summer" || tod === "night" || tod === "dawn" || tod === "sunset";
    const maxP = mobile() ? 12 : 26;
    const particles: Particle[] = showParticles
      ? Array.from({ length: maxP }, (_, i) => mkParticle(canvas.width, canvas.height, season, i < maxP * 0.6))
      : [];

    let animId: number;
    let t = 0;

    const frame = () => {
      t++;
      const w = canvas.width;
      const h = canvas.height;
      const scrollY = scrollYRef.current;

      // ── Sky gradient ───────────────────────────────────────────────────────
      const [c0, c1, c2, c3] = SKY[tod];
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0,    c0);
      skyGrad.addColorStop(0.33, c1);
      skyGrad.addColorStop(0.70, c2);
      skyGrad.addColorStop(1,    c3);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // ── Stars ──────────────────────────────────────────────────────────────
      if (tod !== "day") {
        const sa = tod === "night" ? 0.62 : tod === "dawn" ? 0.32 : 0.14;
        const starLimit = mobile() ? 55 : STAR_COUNT;
        ctx.fillStyle = "#d6e2ff";
        for (let i = 0; i < starLimit; i++) {
          const s = stars[i];
          const tw = Math.sin(t * s.ts + s.to) * 0.26 + 0.74;
          ctx.globalAlpha = sa * tw;
          ctx.beginPath();
          ctx.arc(s.x * w, s.y * h, s.s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // ── Moon / sun ─────────────────────────────────────────────────────────
      if (tod === "night" || tod === "dawn") {
        const mx = w * 0.74, my = h * 0.17, mr = mobile() ? 19 : 29;
        const ma = tod === "night" ? 0.86 : 0.40;
        // Glow halo
        const mg = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.8);
        mg.addColorStop(0, `rgba(195,210,255,${(ma * 0.11).toFixed(3)})`);
        mg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr * 3.8, 0, Math.PI * 2); ctx.fill();
        // Disc
        ctx.fillStyle = `rgba(230,237,255,${ma})`;
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
        // Crescent shadow
        ctx.fillStyle = tod === "night" ? "rgba(3,7,20,0.92)" : "rgba(18,7,28,0.52)";
        ctx.beginPath(); ctx.arc(mx + mr * 0.27, my - mr * 0.07, mr * 0.82, 0, Math.PI * 2); ctx.fill();
      } else if (tod === "day") {
        const sg = ctx.createRadialGradient(w * 0.62, h * 0.17, 0, w * 0.62, h * 0.17, h * 0.5);
        sg.addColorStop(0, "rgba(255,222,130,0.12)"); sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
      } else {
        // Sunset: horizon glow
        const sg = ctx.createRadialGradient(w * 0.28, h * 0.82, 0, w * 0.28, h * 0.82, h * 0.55);
        sg.addColorStop(0, "rgba(255,88,18,0.30)"); sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
      }

      if (tod === "dawn") {
        const dg = ctx.createRadialGradient(w * 0.3, h * 0.85, 0, w * 0.3, h * 0.85, h * 0.52);
        dg.addColorStop(0, "rgba(255,130,42,0.26)"); dg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = dg; ctx.fillRect(0, 0, w, h);
      }

      // ── Fog layer ──────────────────────────────────────────────────────────
      if (tod !== "day") {
        const fy = h * 0.63 + Math.sin(t * 0.00038) * 7;
        const fc: Record<TOD, string> = {
          dawn: "rgba(255,136,62,0.055)", day: "rgba(0,0,0,0)",
          sunset: "rgba(195,65,20,0.055)", night: "rgba(28,48,108,0.065)",
        };
        const fg = ctx.createLinearGradient(0, fy, 0, fy + h * 0.20);
        fg.addColorStop(0, "rgba(0,0,0,0)");
        fg.addColorStop(0.5, fc[tod]);
        fg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fg; ctx.fillRect(0, fy, w, h * 0.20);
      }

      // ── Seasonal particles (behind silhouette) ─────────────────────────────
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx + Math.sin(t * p.swayFreq + p.swayPhase) * p.swayAmp * 0.055;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        if (p.y < 50) p.opacity = Math.min(p.maxOpacity, p.opacity + 0.012);
        else if (p.y > h - 70) p.opacity = Math.max(0, p.opacity - 0.018);
        else p.opacity = Math.min(p.maxOpacity, p.opacity + 0.008);
        if (p.y > h + 15) particles[i] = mkParticle(w, h, season);
        drawParticle(ctx, p, season, t);
      }

      // ── Guild Hall silhouette ──────────────────────────────────────────────
      drawGuildHall(ctx, w, h, tod, scrollY);

      animId = requestAnimationFrame(frame);
    };

    frame();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
