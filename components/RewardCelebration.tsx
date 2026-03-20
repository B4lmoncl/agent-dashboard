"use client";

import { useEffect, useState } from "react";
import { SFX } from "@/lib/sounds";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RewardType = "quest" | "npc-quest" | "ritual" | "vow" | "companion" | "daily-bonus";

export interface RewardCelebrationData {
  type: RewardType;
  title: string;
  xpEarned: number;
  goldEarned: number;
  loot?: { name: string; emoji: string; rarity: string; rarityColor?: string } | null;
  bondXp?: number;
  streak?: number;
  /** Companion-specific accent (hex color) */
  companionAccent?: string;
  companionEmoji?: string;
  /** Extra flavor text override */
  flavor?: string;
  /** Achievement earned */
  achievement?: { id?: string; name: string; icon: string; desc: string } | null;
  /** Blood pact completion bonus */
  pactBonus?: { xp: number; gold: number } | null;
  /** Currency rewards (daily bonus) */
  currencies?: { name: string; amount: number; color: string }[];
}

// ─── Theme config per reward type ────────────────────────────────────────────

interface ThemeConfig {
  accent: string;
  accentRgb: string;
  gradientTop: string;
  label: string;
  icon: string;
  flavorMessages: string[];
}

const THEMES: Record<RewardType, ThemeConfig> = {
  quest: {
    accent: "#22c55e",
    accentRgb: "34,197,94",
    gradientTop: "#0d1a0f",
    label: "Quest Complete!",
    icon: "⚔️",
    flavorMessages: [
      "The Forge burns bright!",
      "Another quest conquered!",
      "Victory is yours, adventurer!",
      "Well fought!",
      "The guild celebrates your deed!",
    ],
  },
  "npc-quest": {
    accent: "#a855f7",
    accentRgb: "168,85,247",
    gradientTop: "#1a0d20",
    label: "Quest Complete!",
    icon: "🗡️",
    flavorMessages: [
      "The quest giver nods with approval.",
      "A worthy adventurer indeed!",
      "The chain grows stronger.",
      "Honor earned, rewards bestowed!",
      "The wanderer is pleased.",
    ],
  },
  ritual: {
    accent: "#6366f1",
    accentRgb: "99,102,241",
    gradientTop: "#0d0d1a",
    label: "Ritual Fulfilled!",
    icon: "🔥",
    flavorMessages: [
      "The flame endures!",
      "Discipline forged in fire.",
      "Another day, another victory.",
      "Your streak grows stronger!",
      "The ritual binds your will.",
    ],
  },
  vow: {
    accent: "#3b82f6",
    accentRgb: "59,130,246",
    gradientTop: "#0d111a",
    label: "Vow Upheld!",
    icon: "🛡️",
    flavorMessages: [
      "Your resolve is unshaken!",
      "Another clean day. Stay strong.",
      "The vow holds firm!",
      "Willpower made manifest.",
      "Each day, you grow stronger.",
    ],
  },
  companion: {
    accent: "#ff6b9d",
    accentRgb: "255,107,157",
    gradientTop: "#1a0d1e",
    label: "Quest Complete!",
    icon: "🐾",
    flavorMessages: [
      "Your companion is happy!",
      "A bond strengthened!",
      "Together, unstoppable!",
      "Your companion purrs with joy!",
      "Loyalty rewarded!",
    ],
  },
  "daily-bonus": {
    accent: "#fbbf24",
    accentRgb: "251,191,36",
    gradientTop: "#1a160d",
    label: "Täglicher Bonus!",
    icon: "🌟",
    flavorMessages: [
      "Die Schmiede begrüßt dich!",
      "Ein neuer Tag, neue Möglichkeiten!",
      "Deine Treue wird belohnt!",
      "Willkommen zurück, Abenteurer!",
      "Die Forge brennt für dich!",
    ],
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface RewardCelebrationProps {
  data: RewardCelebrationData;
  onClose: () => void;
  /** Called when user clicks "Nehmen" — use to fire toasts for loot/achievements */
  onCollect?: (data: RewardCelebrationData) => void;
  /** Called when user clicks an achievement to navigate to Hall of Honors */
  onAchievementClick?: (achievementId: string) => void;
}

export function RewardCelebration({ data, onClose, onCollect, onAchievementClick }: RewardCelebrationProps) {
  const [flavorIdx] = useState(() => Math.floor(Math.random() * 5));

  // Play reward sound on mount
  useEffect(() => {
    if (data.type === "ritual") SFX.ritualComplete();
    else if (data.type === "vow") SFX.ritualComplete();
    else SFX.questComplete();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC to collect & close
  // NOTE: Body scroll lock is handled by useModalBehavior in page.tsx — do NOT duplicate here
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (onCollect) onCollect(data); onClose(); }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [onClose, onCollect, data]);

  const theme = THEMES[data.type] || THEMES.quest;
  // Allow companion-specific overrides
  const accent = data.companionAccent || theme.accent;
  const accentRgb = data.companionAccent ? hexToRgb(data.companionAccent) : theme.accentRgb;
  const gradientTop = data.type === "companion" && data.companionAccent
    ? adjustGradientTop(data.companionAccent)
    : theme.gradientTop;
  const icon = data.companionEmoji || theme.icon;
  const flavor = data.flavor || theme.flavorMessages[flavorIdx % theme.flavorMessages.length];

  const hasRewards = data.xpEarned > 0 || data.goldEarned > 0 || data.loot || (data.bondXp && data.bondXp > 0) || (data.currencies && data.currencies.length > 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={() => { if (onCollect) onCollect(data); onClose(); }}
    >
      <div
        className="reward-celebration-modal w-full max-w-sm rounded-2xl p-8 text-center relative overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${gradientTop} 0%, #0d0d14 60%)`,
          border: `2px solid rgba(${accentRgb},0.5)`,
          boxShadow: `0 0 60px rgba(${accentRgb},0.3), 0 0 120px rgba(${accentRgb},0.1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sparkle particles */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none" style={{
            width: 4 + (i % 3) * 2,
            height: 4 + (i % 3) * 2,
            background: i % 2 === 0 ? accent : lighten(accent, 0.3),
            top: "50%",
            left: "50%",
            animation: `reward-sparkle ${1.5 + (i % 4) * 0.3}s ease-out ${i * 0.08}s infinite`,
            "--sx": `${Math.cos(i * Math.PI / 5) * (70 + i * 8)}px`,
            "--sy": `${Math.sin(i * Math.PI / 5) * (70 + i * 8)}px`,
            boxShadow: `0 0 6px rgba(${accentRgb},0.8)`,
          } as React.CSSProperties} />
        ))}

        {/* Expanding ring */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            border: `2px solid rgba(${accentRgb},0.6)`,
            animation: "reward-ring 2s ease-out infinite",
          }} />
        </div>

        {/* Icon */}
        <div
          className="text-4xl mb-3 reward-icon-bounce"
          style={{ filter: `drop-shadow(0 0 16px rgba(${accentRgb},0.6))` }}
        >
          {icon}
        </div>

        {/* Label */}
        <div
          className="text-xs font-bold uppercase tracking-[0.3em] mb-2"
          style={{ color: `rgba(${accentRgb},0.6)` }}
        >
          {theme.label}
        </div>

        {/* Title */}
        <div
          className="reward-title-glow text-lg font-bold mb-1"
          style={{ color: accent }}
        >
          {data.title.length > 50 ? data.title.slice(0, 50) + "…" : data.title}
        </div>

        {/* Streak badge */}
        {data.type === "ritual" && data.streak && data.streak > 0 && (
          <div className="text-xs mb-3" style={{ color: `rgba(${accentRgb},0.7)` }}>
            🔥 Streak: {data.streak} {data.streak === 1 ? "Tag" : "Tage"}
          </div>
        )}
        {data.type === "vow" && data.streak && data.streak > 0 && (
          <div className="text-xs mb-3" style={{ color: `rgba(${accentRgb},0.7)` }}>
            🛡️ Clean: {data.streak} {data.streak === 1 ? "Tag" : "Tage"}
          </div>
        )}

        {/* Flavor */}
        <div className="text-xs mb-5 text-w35">{flavor}</div>

        {/* Rewards */}
        {hasRewards && (
          <div className="flex flex-col gap-1.5 mb-5">
            {data.xpEarned > 0 && (
              <div className="reward-pill" style={{
                background: "rgba(167,139,250,0.1)",
                border: "1px solid rgba(167,139,250,0.25)",
              }}>
                <span className="text-sm font-semibold" style={{ color: "#a78bfa" }}>+{data.xpEarned} XP</span>
              </div>
            )}
            {data.goldEarned > 0 && (
              <div className="reward-pill" style={{
                background: "rgba(251,191,36,0.1)",
                border: "1px solid rgba(251,191,36,0.25)",
              }}>
                <span className="text-sm font-semibold" style={{ color: "#fbbf24" }}>+{data.goldEarned} Gold</span>
              </div>
            )}
            {data.bondXp && data.bondXp > 0 && (
              <div className="reward-pill" style={{
                background: `rgba(${accentRgb},0.1)`,
                border: `1px solid rgba(${accentRgb},0.25)`,
              }}>
                <span className="text-sm font-semibold" style={{ color: accent }}>+{data.bondXp} Bond XP</span>
              </div>
            )}
            {data.loot && (
              <div className="reward-pill" style={{
                background: "rgba(255,215,0,0.08)",
                border: "1px solid rgba(255,215,0,0.25)",
              }}>
                <span className="text-sm mr-1">{data.loot.emoji}</span>
                <span className="text-sm font-semibold" style={{ color: data.loot.rarityColor || "#FFD700" }}>{data.loot.name}</span>
              </div>
            )}
            {data.currencies && data.currencies.map((c, i) => (
              <div key={i} className="reward-pill" style={{
                background: `rgba(${hexToRgb(c.color)},0.1)`,
                border: `1px solid rgba(${hexToRgb(c.color)},0.25)`,
              }}>
                <span className="text-sm font-semibold" style={{ color: c.color }}>+{c.amount} {c.name}</span>
              </div>
            ))}
            {data.pactBonus && (
              <div className="reward-pill" style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}>
                <span className="text-sm font-semibold" style={{ color: "#ef4444" }}>🩸 Blood Pact: +{data.pactBonus.xp} XP, +{data.pactBonus.gold} Gold</span>
              </div>
            )}
          </div>
        )}

        {/* Achievement */}
        {data.achievement && (
          <div
            className="reward-pill mb-5"
            style={{
              background: "rgba(255,215,0,0.08)",
              border: "1px solid rgba(255,215,0,0.25)",
              cursor: onAchievementClick && data.achievement.id ? "pointer" : undefined,
            }}
            onClick={(e) => {
              if (onAchievementClick && data.achievement?.id) {
                e.stopPropagation();
                onAchievementClick(data.achievement.id);
                if (onCollect) onCollect(data);
                onClose();
              }
            }}
          >
            {data.achievement.icon && data.achievement.icon.startsWith("/")
              ? <img src={data.achievement.icon} alt="" width={20} height={20} className="mr-1 img-render-auto" style={{ imageRendering: "auto" }} />
              : <span className="text-sm mr-1">{data.achievement.icon}</span>}
            <span className="text-sm font-semibold" style={{ color: "#FFD700" }}>{data.achievement.name}</span>
            {onAchievementClick && data.achievement.id && <span className="text-xs ml-1" style={{ color: "rgba(255,215,0,0.5)" }}>→</span>}
          </div>
        )}

        {/* Collect button */}
        <button
          onClick={() => { if (onCollect) onCollect(data); onClose(); }}
          className="action-btn w-full py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: `rgba(${accentRgb},0.12)`,
            color: accent,
            border: `1px solid rgba(${accentRgb},0.35)`,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = `rgba(${accentRgb},0.25)`;
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px rgba(${accentRgb},0.2)`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = `rgba(${accentRgb},0.12)`;
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
        >
          Nehmen
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function lighten(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = Math.min(255, parseInt(h.substring(0, 2), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(h.substring(2, 4), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(h.substring(4, 6), 16) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

function adjustGradientTop(hex: string): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * 0.1);
  const g = Math.round(parseInt(h.substring(2, 4), 16) * 0.1);
  const b = Math.round(parseInt(h.substring(4, 6), 16) * 0.1);
  return `rgb(${r},${g},${b})`;
}
