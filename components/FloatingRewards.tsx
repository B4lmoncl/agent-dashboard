"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FloatingReward {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

let counter = 0;

export function useFloatingRewards() {
  const [rewards, setRewards] = useState<FloatingReward[]>([]);

  const addFloating = useCallback((items: { text: string; color: string }[]) => {
    // Position rewards in the center-right area of the screen, staggered vertically
    const baseX = window.innerWidth / 2;
    const baseY = window.innerHeight * 0.35;
    const newRewards = items.map((item, i) => ({
      id: `fr-${Date.now()}-${counter++}`,
      text: item.text,
      color: item.color,
      x: baseX + (Math.random() - 0.5) * 60,
      y: baseY + i * 36,
    }));
    setRewards(prev => [...prev, ...newRewards]);
  }, []);

  const removeFloating = useCallback((id: string) => {
    setRewards(prev => prev.filter(r => r.id !== id));
  }, []);

  return { rewards, addFloating, removeFloating };
}

// ─── Floating Text Component ─────────────────────────────────────────────────

function FloatingText({ reward, onDone }: { reward: FloatingReward; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="fixed pointer-events-none z-[300]"
      style={{
        left: reward.x,
        top: reward.y,
        animation: "floatRewardUp 1.8s ease-out forwards",
      }}
    >
      <span
        className="text-xl font-black"
        style={{
          color: reward.color,
          textShadow: `0 0 12px ${reward.color}80, 0 2px 8px rgba(0,0,0,0.8)`,
          whiteSpace: "nowrap",
        }}
      >
        {reward.text}
      </span>
    </div>
  );
}

// ─── Portal Renderer ─────────────────────────────────────────────────────────

export function FloatingRewardsLayer({ rewards, onRemove }: {
  rewards: FloatingReward[];
  onRemove: (id: string) => void;
}) {
  if (rewards.length === 0) return null;
  return createPortal(
    <>
      {rewards.map(r => (
        <FloatingText key={r.id} reward={r} onDone={() => onRemove(r.id)} />
      ))}
    </>,
    document.body
  );
}
