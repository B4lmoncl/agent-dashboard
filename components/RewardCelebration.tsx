"use client";

import { useEffect, useState } from "react";
import { SFX } from "@/lib/sounds";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RewardType = "quest" | "npc-quest" | "ritual" | "vow" | "companion" | "daily-bonus" | "expedition" | "sternenpfad" | "battlepass" | "faction" | "world-boss" | "dungeon" | "rift" | "levelUp";

export interface RewardCelebrationData {
  type: RewardType;
  title: string;
  xpEarned: number;
  goldEarned: number;
  loot?: { name: string; emoji: string; rarity: string; rarityColor?: string; icon?: string } | null;
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
  /** Chain quest available after this quest */
  chainQuestTemplate?: { title?: string } | null;
  /** Level-up info if the player leveled up */
  levelUp?: { level: number; title: string } | null;
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
    icon: "◆",
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
    icon: "◆",
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
    icon: "◆",
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
    icon: "◆",
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
    icon: "◆",
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
    label: "Daily Bonus!",
    icon: "★",
    flavorMessages: [
      "The Forge welcomes you!",
      "A new day, new possibilities!",
      "Your loyalty is rewarded!",
      "Welcome back, adventurer!",
      "The Forge burns for you!",
    ],
  },
  expedition: {
    accent: "#4ade80",
    accentRgb: "74,222,128",
    gradientTop: "#0d1a12",
    label: "Expedition Reward!",
    icon: "◆",
    flavorMessages: [
      "The guild marches onward!",
      "Teamwork makes the dream work!",
      "A checkpoint well earned!",
      "Together, nothing can stop us!",
      "The expedition bears fruit!",
    ],
  },
  sternenpfad: {
    accent: "#fbbf24",
    accentRgb: "251,191,36",
    gradientTop: "#1a160d",
    label: "Star Path Milestone!",
    icon: "★",
    flavorMessages: [
      "The stars align in your favor!",
      "Your brilliance shines through!",
      "A constellation of effort!",
      "Stardust fills your coffers!",
      "The path rewards the worthy!",
    ],
  },
  battlepass: {
    accent: "#f472b6",
    accentRgb: "244,114,182",
    gradientTop: "#1a0d15",
    label: "Season Pass Reward!",
    icon: "◆",
    flavorMessages: [
      "Season progress rewarded!",
      "Another level conquered!",
      "The season favors the bold!",
      "Climbing the ranks!",
      "Your dedication pays off!",
    ],
  },
  faction: {
    accent: "#c084fc",
    accentRgb: "192,132,252",
    gradientTop: "#150d1a",
    label: "Faction Reward!",
    icon: "🜂",
    flavorMessages: [
      "The Circle acknowledges you!",
      "Your allegiance is rewarded!",
      "Standing increased!",
      "The order is pleased!",
      "Honor among the ranks!",
    ],
  },
  "world-boss": {
    accent: "#ef4444",
    accentRgb: "239,68,68",
    gradientTop: "#1a0d0d",
    label: "World Boss Vanquished!",
    icon: "◆",
    flavorMessages: [
      "The beast has fallen!",
      "A mighty foe, defeated!",
      "The realm breathes easier!",
      "Spoils of a legendary battle!",
      "Your courage is unmatched!",
    ],
  },
  dungeon: {
    accent: "#22d3ee",
    accentRgb: "34,211,238",
    gradientTop: "#0d1518",
    label: "Dungeon Cleared!",
    icon: "◆",
    flavorMessages: [
      "The Undercroft yields its treasures!",
      "Darkness conquered!",
      "The dungeon bows before you!",
      "Riches from the deep!",
      "A dungeon well plundered!",
    ],
  },
  rift: {
    accent: "#818cf8",
    accentRgb: "129,140,248",
    gradientTop: "#0d0d1a",
    label: "Rift Stage Cleared!",
    icon: "◇",
    flavorMessages: [
      "The Rift yields to your will!",
      "Reality bends — and rewards.",
      "Another tear in the veil, sealed.",
      "The Aetherstream whispers approval.",
      "Deeper still, the Rift beckons...",
    ],
  },
  levelUp: {
    accent: "#fbbf24",
    accentRgb: "251,191,36",
    gradientTop: "#1a1400",
    label: "Level Up!",
    icon: "★",
    flavorMessages: [
      "A new level of power unlocked!",
      "The Hall of Records grows!",
      "Greater strength, greater purpose.",
      "Ascension. The forge burns hotter.",
      "Power, earned through deeds.",
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
  /** Navigate to a view (e.g. "character" to see gear) */
  onNavigate?: (view: string) => void;
}

export function RewardCelebration({ data, onClose, onCollect, onAchievementClick, onNavigate }: RewardCelebrationProps) {
  const [flavorIdx] = useState(() => Math.floor(Math.random() * 5));

  // Play reward sound on mount
  useEffect(() => {
    if (data.type === "levelUp") SFX.levelUp();
    else if (data.type === "ritual") SFX.ritualComplete();
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
      style={{ background: `radial-gradient(circle at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.88) 100%)` }}
      onClick={() => { if (onCollect) onCollect(data); onClose(); }}
    >
      <div
        className="reward-celebration-modal reward-burst-enter w-full max-w-sm rounded-2xl p-8 text-center relative overflow-hidden"
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

        {/* Crystal splinter particles rising */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`crystal-${i}`} className="absolute pointer-events-none" style={{
            width: 3, height: 8, borderRadius: 1,
            background: `linear-gradient(180deg, rgba(${accentRgb},0.9), rgba(${accentRgb},0.2))`,
            bottom: "30%",
            left: `${25 + i * 12}%`,
            animation: `crystal-particle-rise ${1.2 + i * 0.2}s ease-out ${0.1 + i * 0.15}s infinite`,
            boxShadow: `0 0 4px rgba(${accentRgb},0.5)`,
            transform: `rotate(${-10 + i * 5}deg)`,
          }} />
        ))}

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
            ◆ Clean: {data.streak} {data.streak === 1 ? "Tag" : "Tage"}
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
                {data.loot.icon ? (
                  <img src={data.loot.icon} alt="" width={24} height={24} className="mr-1.5" style={{ imageRendering: "auto", verticalAlign: "middle" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <span className="text-sm mr-1">{data.loot.emoji}</span>
                )}
                <span className="text-sm font-semibold" style={{ color: data.loot.rarityColor || "#FFD700" }}>{data.loot.name}</span>
                {onNavigate && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (onCollect) onCollect(data); onNavigate("character"); onClose(); }}
                    className="ml-2 text-xs px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                  >
                    View {"\u2192"}
                  </button>
                )}
              </div>
            )}
            {data.currencies && data.currencies.map((c, i) => {
              const spendView = onNavigate ? (
                c.name === "Gold" || c.name === "Stardust" ? "shop"
                : c.name === "Runensplitter" ? "gacha"
                : c.name === "Essenz" ? "forge"
                : c.name === "Sternentaler" ? "challenges"
                : null
              ) : null;
              return (
                <div key={i} className="reward-pill" style={{
                  background: `rgba(${hexToRgb(c.color)},0.1)`,
                  border: `1px solid rgba(${hexToRgb(c.color)},0.25)`,
                }}>
                  <span className="text-sm font-semibold" style={{ color: c.color }}>+{c.amount} {c.name}</span>
                  {spendView && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (onCollect) onCollect(data); onNavigate!(spendView); onClose(); }}
                      className="ml-2 text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                    >
                      Spend {"\u2192"}
                    </button>
                  )}
                </div>
              );
            })}
            {data.pactBonus && (
              <div className="reward-pill" style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}>
                <span className="text-sm font-semibold" style={{ color: "#ef4444" }}>● Blood Pact: +{data.pactBonus.xp} XP, +{data.pactBonus.gold} Gold</span>
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
              ? <img src={data.achievement.icon} alt="" width={20} height={20} className="mr-1 img-render-auto" style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
              : <span className="text-sm mr-1">{data.achievement.icon}</span>}
            <span className="text-sm font-semibold" style={{ color: "#FFD700" }}>{data.achievement.name}</span>
            {onAchievementClick && data.achievement.id && <span className="text-xs ml-1" style={{ color: "rgba(255,215,0,0.5)" }}>→</span>}
          </div>
        )}

        {/* Collect button row */}
        <div className="flex gap-2">
          {/* Contextual quick-navigate buttons */}
          {onNavigate && data.loot && (
            <QuickNavBtn
              label="Inventar"
              onClick={() => { if (onCollect) onCollect(data); onNavigate("character"); onClose(); }}
              accentRgb={accentRgb}
            />
          )}
          {onNavigate && data.chainQuestTemplate && (
            <QuickNavBtn
              label="Nächste Quest"
              onClick={() => { if (onCollect) onCollect(data); onNavigate("questBoard"); onClose(); }}
              accentRgb={accentRgb}
            />
          )}
          {onNavigate && data.levelUp && (
            <QuickNavBtn
              label="Leaderboard"
              onClick={() => { if (onCollect) onCollect(data); onNavigate("leaderboard"); onClose(); }}
              accentRgb={accentRgb}
            />
          )}
          {onNavigate && data.type === "faction" && (
            <QuickNavBtn
              label="Factions"
              onClick={() => { if (onCollect) onCollect(data); onNavigate("factions"); onClose(); }}
              accentRgb={accentRgb}
            />
          )}

          <button
            onClick={() => { if (onCollect) onCollect(data); onClose(); }}
            className="action-btn flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
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
    </div>
  );
}

// ─── QuickNavBtn ─────────────────────────────────────────────────────────────

interface QuickNavBtnProps {
  label: string;
  onClick: () => void;
  accentRgb: string;
}

function QuickNavBtn({ label, onClick, accentRgb }: QuickNavBtnProps) {
  return (
    <button
      onClick={onClick}
      className="py-2.5 px-3 rounded-xl text-xs font-semibold transition-all"
      style={{
        background: "transparent",
        color: `rgba(${accentRgb},0.75)`,
        border: `1px solid rgba(${accentRgb},0.3)`,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = `rgba(${accentRgb},0.12)`;
        (e.currentTarget as HTMLButtonElement).style.color = `rgba(${accentRgb},1)`;
        (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${accentRgb},0.55)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = `rgba(${accentRgb},0.75)`;
        (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${accentRgb},0.3)`;
      }}
    >
      {label} →
    </button>
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
