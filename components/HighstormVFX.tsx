"use client";

import { useEffect, useState, useRef } from "react";

interface HighstormProps {
  active: boolean;
  intensity?: "minor" | "major" | "cataclysm";
  color?: string;
  duration?: number;
}

export default function HighstormVFX({ active, intensity = "major", color = "#818cf8", duration = 4000 }: HighstormProps) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!active || shownRef.current) return;
    shownRef.current = true;
    setVisible(true);
    const fadeTimer = setTimeout(() => setFading(true), duration - 1000);
    const removeTimer = setTimeout(() => { setVisible(false); setFading(false); }, duration);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, [active, duration]);

  // Reset when event ends so it can trigger again next time
  useEffect(() => { if (!active) shownRef.current = false; }, [active]);

  if (!visible) return null;

  const cfg = intensity === "cataclysm" ? { streaks: 18, debris: 12, flashes: 3 }
    : intensity === "major" ? { streaks: 12, debris: 8, flashes: 2 }
    : { streaks: 6, debris: 4, flashes: 1 };

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 95, opacity: fading ? 0 : 1, transition: "opacity 1s ease-out" }}
    >
      {/* Wind streaks — horizontal lines rushing across */}
      {Array.from({ length: cfg.streaks }, (_, i) => {
        const y = 5 + ((i * 137.508) % 90);
        const dur = 0.4 + (i % 3) * 0.15;
        const delay = (i * 0.12) % 1.5;
        const width = 60 + (i % 4) * 40;
        return (
          <div
            key={`streak-${i}`}
            className="absolute"
            style={{
              top: `${y}%`,
              left: "-10%",
              width: `${width}px`,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${color}40, ${color}20, transparent)`,
              animation: `highstorm-streak ${dur}s linear ${delay}s infinite`,
            }}
          />
        );
      })}

      {/* Debris particles — small squares tumbling */}
      {Array.from({ length: cfg.debris }, (_, i) => {
        const y = 10 + ((i * 97) % 80);
        const size = 2 + (i % 3);
        const dur = 0.6 + (i % 4) * 0.2;
        const delay = (i * 0.25) % 2;
        return (
          <div
            key={`debris-${i}`}
            className="absolute"
            style={{
              top: `${y}%`,
              left: "-5%",
              width: size,
              height: size,
              background: `${color}60`,
              borderRadius: 1,
              animation: `highstorm-debris ${dur}s ease-in ${delay}s infinite`,
            }}
          />
        );
      })}

      {/* Lightning flashes — full-screen brightness bursts */}
      {Array.from({ length: cfg.flashes }, (_, i) => (
        <div
          key={`flash-${i}`}
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at ${30 + i * 25}% ${20 + i * 15}%, ${color}15 0%, transparent 60%)`,
            animation: `highstorm-flash 0.15s ease-out ${0.8 + i * 1.2}s`,
            animationFillMode: "both",
            animationIterationCount: intensity === "cataclysm" ? 3 : 2,
          }}
        />
      ))}

      {/* Screen edge vignette — storm darkness at edges */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.3) 100%)`,
          animation: "highstorm-vignette 2s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}
