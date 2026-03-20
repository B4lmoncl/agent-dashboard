"use client";

import { useEffect, useRef, useState } from "react";

type TOD = "dawn" | "day" | "sunset" | "night";
type Season = "spring" | "summer" | "autumn" | "winter";

function getTOD(): TOD {
  const h = new Date().getHours();
  if (h >= 6 && h < 9)  return "dawn";
  if (h >= 9 && h < 17) return "day";
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

// Sky gradient [top, upper-mid, lower-mid, horizon] — warm fantasy tones
// Now the canvas is the ONLY sky source (no-bg image has transparent sky)
const SKY: Record<TOD, [string, string, string, string]> = {
  dawn:   ["#07040e", "#2a0e28", "#6e2b18", "#d4582a"],
  day:    ["#0c1228", "#1a2855", "#2d4080", "#4a5a98"],
  sunset: ["#07040e", "#1e0820", "#5c180a", "#c2400a"],
  night:  ["#02010a", "#0d0b1a", "#120d22", "#1c1438"],
};

// Foreground opacity per TOD — high enough so mountains/buildings are solid,
// but the transparent sky areas still let canvas stars/effects show through.
const BG_OPACITY: Record<TOD, number> = {
  dawn:   0.85,
  day:    0.88,
  sunset: 0.85,
  night:  0.92,
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

// ─── Shooting Star ───────────────────────────────────────────────────────────
interface ShootingStar {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  length: number;
}

function mkShootingStar(w: number, h: number): ShootingStar {
  const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.25; // 15°-40° downward
  const speed = 4 + Math.random() * 6;
  const goRight = Math.random() > 0.5;
  return {
    x: goRight ? Math.random() * w * 0.6 : w * 0.4 + Math.random() * w * 0.6,
    y: Math.random() * h * 0.35,
    vx: (goRight ? 1 : -1) * Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 30 + Math.random() * 30,
    length: 40 + Math.random() * 60,
  };
}

// ─── Cloud Wisp ──────────────────────────────────────────────────────────────
interface CloudWisp {
  x: number; y: number;
  width: number; height: number;
  speed: number;
  opacity: number;
}

function mkCloud(w: number, h: number, tod: TOD, scatter = false): CloudWisp {
  return {
    x: scatter ? Math.random() * w * 1.4 - w * 0.2 : w + Math.random() * 200,
    y: h * 0.05 + Math.random() * h * 0.35,
    width: 120 + Math.random() * 220,
    height: 20 + Math.random() * 35,
    speed: 0.08 + Math.random() * 0.14,
    opacity: tod === "night" ? 0.03 + Math.random() * 0.04 : tod === "day" ? 0.04 + Math.random() * 0.05 : 0.04 + Math.random() * 0.06,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GuildHallBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tod, setTod] = useState<TOD>(getTOD);

  // Re-check TOD every 60s for live transitions
  useEffect(() => {
    const iv = setInterval(() => setTod(getTOD()), 60_000);
    return () => clearInterval(iv);
  }, []);

  // Canvas: sky gradient + stars + moon/sun + fog + clouds + shooting stars + particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const season = getSeason();
    const mobile = () => canvas.width < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width  = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Deterministic stars using hash function to avoid visible patterns
    function starHash(seed: number): number {
      let t = (seed + 0x6D2B79F5) | 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    const STAR_COUNT = 800;
    const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
      const h0 = starHash(i * 3 + 0);
      const h1 = starHash(i * 3 + 1);
      const h2 = starHash(i * 3 + 2);
      // Size distribution: most stars tiny, few medium, rare large
      // Cubic falloff so ~80% are small dust, ~15% medium, ~5% bright
      const sizeRoll = h2 * h2 * h2;
      return {
        x:  h0,
        y:  h1, // Scaled to skyMaxY at render time
        s:  sizeRoll * 2.0 + 0.18,
        to: starHash(i * 5 + 100) * Math.PI * 2,
        ts: 0.0004 + starHash(i * 5 + 200) * 0.002,
        bright: sizeRoll > 0.7,
        warmTint: starHash(i * 7 + 400) < 0.18,
        blueTint: starHash(i * 7 + 500) < 0.10,
      };
    });

    // Seasonal particles
    const showParticles = season !== "summer" || tod === "night" || tod === "dawn" || tod === "sunset";
    const maxP = mobile() ? 12 : 26;
    const particles: Particle[] = showParticles
      ? Array.from({ length: maxP }, (_, i) => mkParticle(window.innerWidth, window.innerHeight, season, i < maxP * 0.6))
      : [];

    // Cloud wisps
    const cloudCount = mobile() ? 3 : 6;
    const clouds: CloudWisp[] = Array.from({ length: cloudCount }, () =>
      mkCloud(window.innerWidth, window.innerHeight, tod, true)
    );

    // Shooting stars (night/dawn only)
    const shootingStars: ShootingStar[] = [];
    let nextShootingStarAt = 180 + Math.random() * 400; // frames until next

    let animId: number;
    let t = 0;

    const frame = () => {
      t++;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // ── Sky gradient ─────────────────────────────────────────────────────
      const [c0, c1, c2, c3] = SKY[tod];
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0,    c0);
      skyGrad.addColorStop(0.33, c1);
      skyGrad.addColorStop(0.70, c2);
      skyGrad.addColorStop(1,    c3);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // ── Animated horizon glow (dawn/sunset) ────────────────────────────
      if (tod === "dawn" || tod === "sunset") {
        const pulse = Math.sin(t * 0.006) * 0.04 + 0.96;
        const glowY = h * (tod === "sunset" ? 0.78 : 0.80);
        const glowX = tod === "sunset" ? w * 0.28 : w * 0.35;
        const glowR = h * 0.55 * pulse;
        const hg = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
        if (tod === "sunset") {
          hg.addColorStop(0, "rgba(255,88,18,0.28)");
          hg.addColorStop(0.35, "rgba(255,55,10,0.14)");
          hg.addColorStop(0.7, "rgba(180,30,5,0.06)");
          hg.addColorStop(1, "rgba(0,0,0,0)");
        } else {
          hg.addColorStop(0, "rgba(255,150,60,0.22)");
          hg.addColorStop(0.35, "rgba(255,120,40,0.10)");
          hg.addColorStop(0.7, "rgba(200,80,20,0.04)");
          hg.addColorStop(1, "rgba(0,0,0,0)");
        }
        ctx.fillStyle = hg;
        ctx.fillRect(0, 0, w, h);

        // Secondary warm glow — wider, softer
        const pulse2 = Math.sin(t * 0.004 + 1.5) * 0.03 + 0.97;
        const hg2 = ctx.createRadialGradient(w * 0.5, h * 0.9, 0, w * 0.5, h * 0.9, h * 0.7 * pulse2);
        const glowAlpha = tod === "sunset" ? 0.12 : 0.08;
        hg2.addColorStop(0, `rgba(255,100,30,${glowAlpha})`);
        hg2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = hg2;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Milky Way & nebulae (night only) ──────────────────────────────
      if (tod === "night") {
        // Milky Way — diagonal band of diffuse light across the sky
        ctx.save();
        ctx.translate(w * 0.5, h * 0.22);
        ctx.rotate(-0.45); // ~25° tilt
        const mwWidth = w * 0.22;
        const mwLength = w * 1.8;
        // Core band — visible, ethereal glow
        const mwGrad = ctx.createLinearGradient(0, -mwWidth, 0, mwWidth);
        mwGrad.addColorStop(0, "rgba(0,0,0,0)");
        mwGrad.addColorStop(0.2, "rgba(140,120,180,0.06)");
        mwGrad.addColorStop(0.35, "rgba(160,140,210,0.12)");
        mwGrad.addColorStop(0.5, "rgba(185,165,230,0.16)");
        mwGrad.addColorStop(0.65, "rgba(160,140,210,0.12)");
        mwGrad.addColorStop(0.8, "rgba(140,120,180,0.06)");
        mwGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mwGrad;
        ctx.fillRect(-mwLength * 0.5, -mwWidth, mwLength, mwWidth * 2);
        // Brighter core center
        const mwCore = ctx.createRadialGradient(0, 0, 0, 0, 0, mwWidth * 0.7);
        mwCore.addColorStop(0, "rgba(210,190,255,0.12)");
        mwCore.addColorStop(0.5, "rgba(180,160,230,0.06)");
        mwCore.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mwCore;
        ctx.fillRect(-mwWidth, -mwWidth, mwWidth * 2, mwWidth * 2);
        ctx.restore();

        // Nebula patches — colored gas clouds with visible glow
        const nebulaData = [
          { x: 0.18, y: 0.10, r: 0.08, color: "rgba(120,60,160," },
          { x: 0.68, y: 0.06, r: 0.065, color: "rgba(60,80,180," },
          { x: 0.40, y: 0.18, r: 0.055, color: "rgba(160,60,100," },
          { x: 0.82, y: 0.14, r: 0.04, color: "rgba(80,140,200," },
        ];
        for (const nb of nebulaData) {
          const nx = nb.x * w, ny = nb.y * h, nr = nb.r * w;
          const pulse = Math.sin(t * 0.002 + nb.x * 10) * 0.02 + 1;
          const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr * pulse);
          ng.addColorStop(0, nb.color + "0.18)");
          ng.addColorStop(0.3, nb.color + "0.10)");
          ng.addColorStop(0.6, nb.color + "0.04)");
          ng.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = ng;
          ctx.beginPath();
          ctx.arc(nx, ny, nr * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── Stars ────────────────────────────────────────────────────────────
      // Stars fill the full viewport — the no-bg foreground image with its
      // transparent sky naturally masks stars behind mountains/buildings.
      if (tod !== "day") {
        const sa = tod === "night" ? 0.95 : tod === "dawn" ? 0.50 : 0.25;
        const starLimit = mobile() ? 250 : STAR_COUNT;

        for (let i = 0; i < starLimit; i++) {
          const s = stars[i];
          const sx = s.x * w;
          const sy = s.y * h; // Full viewport — foreground image handles masking
          // Two-frequency twinkle for natural variation
          const tw = Math.sin(t * s.ts + s.to) * 0.25 + Math.sin(t * s.ts * 1.7 + s.to * 0.6) * 0.15 + 0.6;
          const alpha = sa * tw;
          const starColor = s.warmTint ? "#ffe8c8" : s.blueTint ? "#b8d4ff" : "#d6c8ff";

          if (s.bright && (tod === "night" || tod === "dawn")) {
            // Cross-shaped twinkle for bright stars
            const crossLen = s.s * 4 * tw;
            ctx.globalAlpha = alpha * 0.5;
            ctx.strokeStyle = starColor;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(sx - crossLen, sy);
            ctx.lineTo(sx + crossLen, sy);
            ctx.moveTo(sx, sy - crossLen * 1.3);
            ctx.lineTo(sx, sy + crossLen * 1.3);
            ctx.stroke();
            // Diagonal cross (softer)
            ctx.globalAlpha = alpha * 0.25;
            const diagLen = crossLen * 0.6;
            ctx.beginPath();
            ctx.moveTo(sx - diagLen, sy - diagLen);
            ctx.lineTo(sx + diagLen, sy + diagLen);
            ctx.moveTo(sx + diagLen, sy - diagLen);
            ctx.lineTo(sx - diagLen, sy + diagLen);
            ctx.stroke();
            // Bright core
            ctx.globalAlpha = alpha;
            ctx.fillStyle = starColor;
            ctx.beginPath();
            ctx.arc(sx, sy, s.s * 1.3, 0, Math.PI * 2);
            ctx.fill();
            // Soft glow halo
            ctx.globalAlpha = alpha * 0.25;
            const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.s * 7);
            sg.addColorStop(0, s.warmTint ? "rgba(255,220,180,0.6)" : "rgba(200,190,255,0.6)");
            sg.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.arc(sx, sy, s.s * 7, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = starColor;
            ctx.beginPath();
            ctx.arc(sx, sy, s.s, 0, Math.PI * 2);
            ctx.fill();
            // Subtle glow for medium-sized stars
            if (s.s > 1.0) {
              ctx.globalAlpha = alpha * 0.15;
              ctx.beginPath();
              ctx.arc(sx, sy, s.s * 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Shooting stars (night & dawn) ──────────────────────────────────
      if (tod === "night" || tod === "dawn") {
        nextShootingStarAt--;
        if (nextShootingStarAt <= 0 && shootingStars.length < 2) {
          shootingStars.push(mkShootingStar(w, h));
          nextShootingStarAt = 300 + Math.random() * 600;
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const ss = shootingStars[i];
          ss.x += ss.vx;
          ss.y += ss.vy;
          ss.life++;

          const lifeRatio = ss.life / ss.maxLife;
          const fadeIn = Math.min(ss.life / 8, 1);
          const fadeOut = lifeRatio > 0.6 ? 1 - (lifeRatio - 0.6) / 0.4 : 1;
          const alpha = fadeIn * fadeOut * (tod === "night" ? 0.85 : 0.5);

          // Trail
          const tailX = ss.x - (ss.vx / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.length * fadeOut;
          const tailY = ss.y - (ss.vy / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.length * fadeOut;

          const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(0.6, `rgba(200,190,255,${(alpha * 0.3).toFixed(3)})`);
          grad.addColorStop(1, `rgba(240,235,255,${alpha.toFixed(3)})`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(ss.x, ss.y);
          ctx.stroke();

          // Bright head
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#f0ebff";
          ctx.beginPath();
          ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
          ctx.fill();

          if (ss.life >= ss.maxLife || ss.x < -50 || ss.x > w + 50 || ss.y > h) {
            shootingStars.splice(i, 1);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Moon / sun ───────────────────────────────────────────────────────
      if (tod === "night" || tod === "dawn") {
        const mx = w * 0.74, my = h * 0.17, mr = mobile() ? 19 : 29;
        const ma = tod === "night" ? 0.86 : 0.40;
        // Animated soft pulse
        const moonPulse = Math.sin(t * 0.003) * 0.03 + 1;
        const mg = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.8 * moonPulse);
        mg.addColorStop(0, `rgba(215,200,255,${(ma * 0.14).toFixed(3)})`);
        mg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr * 3.8 * moonPulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(230,225,255,${ma})`;
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = tod === "night" ? "rgba(8,4,18,0.92)" : "rgba(20,10,35,0.52)";
        ctx.beginPath(); ctx.arc(mx + mr * 0.27, my - mr * 0.07, mr * 0.82, 0, Math.PI * 2); ctx.fill();
      } else if (tod === "day") {
        // Sun with animated rays
        const sx = w * 0.62, sy = h * 0.17;
        const rayPulse = Math.sin(t * 0.005) * 0.02 + 1;
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * 0.5 * rayPulse);
        sg.addColorStop(0, "rgba(255,190,80,0.10)"); sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);

        // Light rays
        ctx.globalAlpha = 0.025 + Math.sin(t * 0.004) * 0.008;
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 0.6 + Math.PI * 0.35 + Math.sin(t * 0.001 + i) * 0.03;
          const rayLen = h * 0.7;
          const spread = 0.04;
          ctx.fillStyle = "rgba(255,200,100,1)";
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(angle - spread) * rayLen, sy + Math.sin(angle - spread) * rayLen);
          ctx.lineTo(sx + Math.cos(angle + spread) * rayLen, sy + Math.sin(angle + spread) * rayLen);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // Sunset glow
        const sg = ctx.createRadialGradient(w * 0.28, h * 0.82, 0, w * 0.28, h * 0.82, h * 0.55);
        sg.addColorStop(0, "rgba(255,88,18,0.30)"); sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
      }

      if (tod === "dawn") {
        const dg = ctx.createRadialGradient(w * 0.3, h * 0.85, 0, w * 0.3, h * 0.85, h * 0.52);
        dg.addColorStop(0, "rgba(255,130,42,0.26)"); dg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = dg; ctx.fillRect(0, 0, w, h);
      }

      // ── Cloud wisps ────────────────────────────────────────────────────
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.x -= c.speed;
        // Wrap around
        if (c.x + c.width < -50) {
          Object.assign(c, mkCloud(w, h, tod));
        }

        // Soft elliptical cloud
        ctx.globalAlpha = c.opacity;
        const cg = ctx.createRadialGradient(
          c.x + c.width * 0.5, c.y + c.height * 0.5, 0,
          c.x + c.width * 0.5, c.y + c.height * 0.5, c.width * 0.5
        );
        const cloudColor = tod === "night" ? "rgba(80,60,130," : tod === "sunset" ? "rgba(180,80,40," : tod === "dawn" ? "rgba(200,120,60," : "rgba(140,120,180,";
        cg.addColorStop(0, cloudColor + "1)");
        cg.addColorStop(0.5, cloudColor + "0.5)");
        cg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(c.x + c.width * 0.5, c.y + c.height * 0.5, c.width * 0.5, c.height * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Fog layer ────────────────────────────────────────────────────────
      if (tod !== "day") {
        const fy = h * 0.63 + Math.sin(t * 0.00038) * 7;
        const fc: Record<TOD, string> = {
          dawn:   "rgba(255,136,62,0.055)",
          day:    "rgba(0,0,0,0)",
          sunset: "rgba(195,65,20,0.055)",
          night:  "rgba(38,22,72,0.065)",
        };
        const fg = ctx.createLinearGradient(0, fy, 0, fy + h * 0.20);
        fg.addColorStop(0, "rgba(0,0,0,0)");
        fg.addColorStop(0.5, fc[tod]);
        fg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fg; ctx.fillRect(0, fy, w, h * 0.20);
      }

      // ── Seasonal particles ───────────────────────────────────────────────
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

      animId = requestAnimationFrame(frame);
    };

    frame();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [tod]);

  const bgOpacity = BG_OPACITY[tod];

  return (
    <>
      {/* Layer 1 — Sky canvas (stars, moon, clouds, shooting stars, particles) */}
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

      {/* Layer 2 — Guild Hall foreground (transparent sky lets canvas show through) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/guild-hall-no-bg.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center bottom",
            imageRendering: "auto",
            opacity: bgOpacity,
            userSelect: "none",
            transition: "opacity 2s ease",
          }}
        />
      </div>
    </>
  );
}
