"use client";

import type { User, ClassDef } from "@/app/types";
import { getUserLevel, getUserXpProgress, GUILD_LEVELS } from "@/app/utils";
import { Tip } from "@/components/GameTooltip";

// ─── Constants ───────────────────────────────────────────────────────────────

const FORGE_TIERS = [
  { min: 0, label: "Cold", color: "#4b5563" },
  { min: 20, label: "Smoldering", color: "#78716c" },
  { min: 40, label: "Warming", color: "#b45309" },
  { min: 60, label: "Burning", color: "#ea580c" },
  { min: 80, label: "Blazing", color: "#f97316" },
  { min: 100, label: "White-hot", color: "#e0f0ff" },
];

function getForgeTier(temp: number) {
  for (let i = FORGE_TIERS.length - 1; i >= 0; i--) {
    if (temp >= FORGE_TIERS[i].min) return FORGE_TIERS[i];
  }
  return FORGE_TIERS[0];
}

const TITLE_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#60a5fa",
  epic: "#a855f7",
  legendary: "#f97316",
};

// ─── SmartIcon ───────────────────────────────────────────────────────────────

function SmartIcon({ src, alt, size = 16, style }: { src: string; alt?: string; size?: number; style?: React.CSSProperties }) {
  if (!src) return null;
  if (src.startsWith("/")) {
    return <img src={src} alt={alt ?? ""} width={size} height={size} style={{ imageRendering: "auto", ...style }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1, ...style }}>{src}</span>;
}

// ─── UserCard Component ──────────────────────────────────────────────────────

export function UserCard({ user, classes = [], onClick, onNavigate }: { user: User; classes?: ClassDef[]; onClick?: () => void; onNavigate?: (view: string) => void }) {
  const xp = user.xp ?? 0;
  const lvl = getUserLevel(xp);
  const progress = getUserXpProgress(xp);
  const nextLvlEntry = GUILD_LEVELS[lvl.level];
  const xpForLevel = nextLvlEntry ? (nextLvlEntry.xpRequired - (GUILD_LEVELS[lvl.level - 1]?.xpRequired || 0)) : 1000;
  const isMilestoneLevel = lvl.level === 10 || lvl.level === 20 || lvl.level === 30;
  const streak = user.streakDays ?? 0;
  const temp = Math.min(user.forgeTemp ?? 0, 100);
  const achs = user.earnedAchievements ?? [];

  // Forge
  const forgeTier = getForgeTier(temp);

  // Class
  const cls = (user.classId && user.classId !== "null") ? classes.find(c => c.id === user.classId) : null;

  // Companion
  const comp = user.companion;

  // Cosmetic frame
  const frame = user.equippedFrame;
  const frameColor = frame?.color ?? (isMilestoneLevel ? lvl.color : undefined);
  const frameBorder = frameColor ? `2px solid ${frameColor}80` : "1px solid rgba(255,255,255,0.08)";
  const frameShadow = frame?.glow
    ? `0 0 16px ${frame.color}40, 0 0 32px ${frame.color}20`
    : isMilestoneLevel ? `0 0 20px ${lvl.color}20` : "none";

  // Only earned achievement icons (no ???)
  const displayAchs = achs.slice(-6);

  // Companion portrait
  const companionSrc = comp
    ? comp.type && ["dragon", "owl", "phoenix", "wolf", "fox", "bear"].includes(comp.type)
      ? `/images/portraits/companion-${comp.type}.png`
      : comp.type === "cat" && comp.name?.toLowerCase() === "dobbie"
        ? "/images/portraits/companion-dobbie.png"
        : ""
    : "";

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all duration-200${onClick ? " cursor-pointer" : ""}${frameColor ? " crystal-breathe" : ""}`}
      style={{
        background: "linear-gradient(180deg, #2a2a2e 0%, #1e1e22 100%)",
        border: frameBorder,
        boxShadow: frameShadow,
        ...(frameColor ? { "--glow-color": `${frameColor}30` } as React.CSSProperties : {}),
      }}
      onClick={onClick}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `${frameShadow}, 0 8px 24px rgba(0,0,0,0.4)`; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = frameShadow; } : undefined}
    >
      {/* ── Header: Portrait + Name/Level/Class ── */}
      <div className="flex items-center gap-3 p-3 pb-2.5">
        {/* Portrait with frame */}
        <div className="relative flex-shrink-0">
          <div
            className="w-14 h-14 rounded-xl overflow-hidden"
            style={{
              border: `2px solid ${frameColor ?? user.color ?? "#555"}60`,
              boxShadow: `inset 0 0 12px rgba(0,0,0,0.5), 0 2px 8px ${(frameColor ?? user.color ?? "#555")}30`,
            }}
          >
            <img
              src={`/images/portraits/hero-${user.avatarStyle || "male"}.png`}
              alt={user.name}
              className="w-full h-full object-cover"
              style={{ imageRendering: "auto" }}
              onError={e => {
                // Fallback to colored letter avatar
                const t = e.currentTarget;
                t.style.display = "none";
                const fallback = t.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }}
            />
            <div
              className="w-full h-full items-center justify-center font-black text-lg"
              style={{
                display: "none",
                background: `linear-gradient(135deg, ${user.color ?? "#666"}, ${user.color ?? "#666"}88)`,
                color: "#fff",
              }}
            >
              {user.avatar || user.name?.slice(0, 2).toUpperCase()}
            </div>
          </div>
          {/* Level badge overlay */}
          <div
            className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-xs font-black"
            style={{
              background: "#1a1a1e",
              color: lvl.color,
              border: `1px solid ${lvl.color}50`,
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            {lvl.level}
          </div>
        </div>

        {/* Name + Class + Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold truncate" style={{ color: "#f0f0f0" }}>{user.name}</p>
            {streak > 0 && (
              <Tip k="streak">
                <span
                  className="text-xs font-bold flex-shrink-0"
                  style={{ color: streak >= 30 ? "#ef4444" : streak >= 7 ? "#f59e0b" : "#fb923c", cursor: onNavigate ? "pointer" : undefined }}
                  onClick={onNavigate ? (e) => { e.stopPropagation(); onNavigate("rituals"); } : undefined}
                  title={onNavigate ? "Go to Ritual Chamber" : undefined}
                >
                  🔥{streak}
                </span>
              </Tip>
            )}
          </div>
          <p className="text-xs" style={{ color: lvl.color, opacity: 0.8 }}>
            {isMilestoneLevel && "★ "}{lvl.title}
          </p>
          {cls && (
            <p className="text-xs" style={{ color: "rgba(167,139,250,0.7)" }}>
              {cls.icon} {cls.fantasy}
            </p>
          )}
          {user.equippedTitle && (
            <p className="text-xs font-medium" style={{ color: TITLE_COLORS[user.equippedTitle.rarity] ?? "#9ca3af" }}>
              &laquo; {user.equippedTitle.name} &raquo;
            </p>
          )}
        </div>
      </div>

      {/* ── XP Bar ── */}
      <div className="px-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
            {nextLvlEntry ? `${(xp - lvl.xpRequired).toLocaleString()} / ${(nextLvlEntry.xpRequired - lvl.xpRequired).toLocaleString()}` : "MAX"}
          </span>
        </div>
        <div className={`progress-bar-diablo${progress > 0.9 ? " progress-bar-nearly-full" : ""}`} style={{ position: "relative" }}>
          <div
            className="progress-bar-diablo-fill progress-shimmer"
            style={{
              width: `${Math.round(progress * 100)}%`,
              background: `linear-gradient(90deg, ${lvl.color}88, ${lvl.color}, ${lvl.color}cc)`,
            }}
          />
          {/* Rested XP pool indicator (blue zone after current XP) */}
          {user._restedXpPool && user._restedXpPool > 0 && xpForLevel > 0 && (() => {
            const restedPct = Math.min(100 - Math.round(progress * 100), Math.round((user._restedXpPool / xpForLevel) * 100));
            if (restedPct <= 0) return null;
            return (
              <Tip k="rested_xp">
                <div style={{
                  position: "absolute",
                  left: `${Math.round(progress * 100)}%`,
                  top: 0,
                  bottom: 0,
                  width: `${restedPct}%`,
                  background: "rgba(59,130,246,0.35)",
                  borderRadius: "0 3px 3px 0",
                  cursor: "help",
                }} />
              </Tip>
            );
          })()}
        </div>
      </div>

      {/* ── Stats Grid: Forge + Quests + Achievement Points ── */}
      <div className="px-3 pb-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Forge Temp */}
          <Tip k="forge_temp">
            <div
              className="rounded-lg px-2 py-1.5 text-center"
              style={{ background: "rgba(255,255,255,0.03)", cursor: onNavigate ? "pointer" : undefined }}
              onClick={onNavigate ? (e) => { e.stopPropagation(); onNavigate("forge"); } : undefined}
              title={onNavigate ? "Go to Artisan's Quarter" : undefined}
            >
              <p className="text-xs font-mono font-bold" style={{ color: forgeTier.color }}>{temp}%</p>
              <p className="text-xs" style={{ color: forgeTier.color, opacity: 0.7, fontSize: 12 }}>{forgeTier.label}</p>
            </div>
          </Tip>
          {/* Quests */}
          <div
            className="rounded-lg px-2 py-1.5 text-center"
            style={{ background: "rgba(255,255,255,0.03)", cursor: onNavigate ? "pointer" : undefined }}
            onClick={onNavigate ? (e) => { e.stopPropagation(); onNavigate("questBoard"); } : undefined}
            title={onNavigate ? "Go to Quest Board" : undefined}
          >
            <p className="text-xs font-mono font-bold" style={{ color: "#8b5cf6" }}>{user.questsCompleted ?? 0}</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Quests</p>
          </div>
          {/* Achievement Points */}
          <Tip k="achievements">
            <div
              className="rounded-lg px-2 py-1.5 text-center"
              style={{ background: "rgba(255,255,255,0.03)", cursor: onNavigate ? "pointer" : undefined }}
              onClick={onNavigate ? (e) => { e.stopPropagation(); onNavigate("honors"); } : undefined}
              title={onNavigate ? "Go to Hall of Honors" : undefined}
            >
              <p className="text-xs font-mono font-bold" style={{ color: "#d4a64a" }}>{user.achievementPoints ?? 0}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Points</p>
            </div>
          </Tip>
        </div>
      </div>

      {/* ── Footer: Companion + Earned Achievements ── */}
      {(comp || displayAchs.length > 0) && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center justify-between">
            {/* Companion */}
            {comp && (
              <Tip k="bond_level">
                <div
                  className="flex items-center gap-1.5"
                  style={{ cursor: onNavigate ? "pointer" : undefined }}
                  onClick={onNavigate ? (e) => { e.stopPropagation(); onNavigate("character"); } : undefined}
                  title={onNavigate ? "View companion details" : undefined}
                >
                  {companionSrc ? (
                    <img src={companionSrc} alt={comp.name} width={18} height={18} className="rounded" style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                  ) : comp.emoji && comp.emoji !== "x" ? (
                    <span style={{ fontSize: 14 }}>{comp.emoji}</span>
                  ) : null}
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{comp.name}</span>
                </div>
              </Tip>
            )}
            {/* Earned achievement icons — only real earned ones, no ??? */}
            {displayAchs.length > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                {displayAchs.map(a => (
                  <span key={a.id} title={`${a.name}: ${a.desc}`} style={{ display: "inline-flex" }}>
                    <SmartIcon src={a.icon} size={16} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
