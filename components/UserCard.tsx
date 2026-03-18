"use client";

import type { User, ClassDef } from "@/app/types";
import { getUserLevel, getUserXpProgress, getForgeTempInfo, GUILD_LEVELS } from "@/app/utils";
import shopData from "../public/data/shopItems.json";

const GEAR_ICONS: Record<string, { icon: string; name: string; bonus: number }> = Object.fromEntries(
  shopData.gearTiers.filter(g => g.tier > 0).map(g => [g.id, { icon: g.icon, name: g.name, bonus: g.xpBonus }])
);

const COMPANION_IDS = ["ember_sprite", "lore_owl", "gear_golem"];
const COMPANION_META: Record<string, { icon: string; name: string }> = {
  ember_sprite: { icon: "/images/icons/mini-ember-sprite.png", name: "Ember Sprite" },
  lore_owl:     { icon: "/images/icons/mini-lore-owl.png", name: "Lore Owl" },
  gear_golem:   { icon: "/images/icons/mini-gear-golem.png", name: "Gear Golem" },
};

function SmartIcon({ src, alt, size = 16, style }: { src: string; alt?: string; size?: number; style?: React.CSSProperties }) {
  if (!src) return null;
  if (src.startsWith("/")) {
    return <img src={src} alt={alt ?? ""} width={size} height={size} style={{ imageRendering: "smooth", ...style }} onError={e => { e.currentTarget.style.display = "none"; }} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1, ...style }}>{src}</span>;
}

export function UserCard({ user, classes = [] }: { user: User; classes?: ClassDef[] }) {
  const xp = user.xp ?? 0;
  const lvl = getUserLevel(xp);
  const progress = getUserXpProgress(xp);
  const nextLvlEntry = GUILD_LEVELS[lvl.level];
  const isMilestoneLevel = lvl.level === 10 || lvl.level === 20 || lvl.level === 30;
  const streak = user.streakDays ?? 0;
  const temp = Math.min(user.forgeTemp ?? 0, 100);
  const gold = user.gold ?? 0;
  const achs = user.earnedAchievements ?? [];

  const forgeFilter = temp >= 70
    ? "brightness(1.2) sepia(1) saturate(3) hue-rotate(-10deg)"
    : temp >= 40
    ? "brightness(1.1) sepia(1) saturate(2) hue-rotate(10deg)"
    : "brightness(0.6) grayscale(0.8)";
  const forgeColor = temp >= 100 ? "#e0f0ff" : temp >= 80 ? "#f97316" : temp >= 60 ? "#ea580c" : temp >= 40 ? "#b45309" : temp >= 20 ? "#78716c" : "#4b5563";
  const forgeTierLabel = temp >= 100 ? "White-hot" : temp >= 80 ? "Blazing" : temp >= 60 ? "Burning" : temp >= 40 ? "Warming" : temp >= 20 ? "Smoldering" : "Cold";
  const goldMultiplier = temp >= 100 ? "1.5" : temp >= 80 ? "1.3" : temp >= 60 ? "1.15" : "1.0";
  const xpMalus = temp === 0;
  const forgeInfo = getForgeTempInfo(temp);

  // Class info — only show if classId is a non-empty string and class exists
  const cls = (user.classId && user.classId !== "null") ? classes.find(c => c.id === user.classId) : null;
  const classTier = cls?.tiers ? [...cls.tiers].reverse().find(t => xp >= t.minXp) : null;

  // Gear info
  const gear = user.gear && user.gear !== "worn" ? GEAR_ICONS[user.gear] : null;

  // Companion companions (from achievements)
  const companionAchs = achs.filter(a => COMPANION_IDS.includes(a.id));
  const mood = streak >= 7 ? { emoji: "/images/icons/mood-happy.png", label: "happy", anim: "animate-bounce", tip: "Happy! Keep the streak going!" }
             : streak >= 3 ? { emoji: "/images/icons/mood-neutral.png", label: "neutral", anim: "", tip: "Neutral. Complete quests to cheer them up!" }
             : { emoji: "/images/icons/mood-sad.png", label: "sad", anim: "animate-pulse", tip: "Sad. No recent quests — your companions miss you!" };

  // Non-companion achievements
  const displayAchs = achs.filter(a => !COMPANION_IDS.includes(a.id)).slice(-8);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#252525",
        border: `1px solid ${isMilestoneLevel ? lvl.color + "80" : "rgba(255,255,255,0.08)"}`,
        boxShadow: isMilestoneLevel ? `0 0 24px ${lvl.color}25, inset 0 1px 0 rgba(255,255,255,0.05)` : `inset 0 1px 0 rgba(255,255,255,0.05)`,
        minWidth: 240,
      }}
    >
      {/* Header — name, avatar, level */}
      <div className="p-4 pb-3" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${user.color}, ${user.color}88)`,
              boxShadow: `0 4px 12px ${user.color}40`,
              color: "#fff",
            }}
          >
            {user.avatar || user.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold truncate" style={{ color: "#f5f5f5" }}>{user.name}</p>
              {streak > 0 && (
                <span
                  className="text-xs font-bold flex items-center gap-0.5 flex-shrink-0"
                  style={{ color: streak >= 30 ? "#ef4444" : streak >= 7 ? "#f59e0b" : "#fb923c" }}
                  title={`${streak} day streak!`}
                >
                  🔥{streak}
                </span>
              )}
            </div>
            <p className="text-xs font-bold" style={{ color: lvl.color }}>
              {isMilestoneLevel && "★ "}Lv {lvl.level} · {lvl.title}
            </p>
          </div>
          {/* Gold */}
          <div className="flex-shrink-0">
            <span className="text-xs font-mono font-bold inline-flex items-center gap-1" style={{ color: "#fbbf24" }} title="Gold">
              <SmartIcon src="/images/icons/currency-gold.png" size={13} /> {gold}
            </span>
          </div>
        </div>

        {/* Inline badges: class + companion pet */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {cls && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold"
              style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}
            >
              {cls.icon} {cls.fantasy}{classTier ? ` · ${classTier.title}` : ""}
            </span>
          )}
          {user.classPending && !cls && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold"
              style={{ background: "rgba(245,158,11,0.08)", color: "rgba(245,158,11,0.7)", animation: "pulse-online 1.5s ease-in-out infinite" }}
            >
              ★ Klasse wird geschmiedet...
            </span>
          )}
          {user.companion && (() => {
            const c = user.companion!;
            return (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}
              >
                <SmartIcon src={
                  c.type && ["dragon","owl","phoenix","wolf","fox","bear"].includes(c.type)
                    ? `/images/portraits/companion-${c.type}.png`
                    : c.type === "cat" && c.name?.toLowerCase() === "dobbie"
                      ? "/images/portraits/companion-dobbie.png"
                      : c.emoji && c.emoji !== "x" ? c.emoji : ""
                } size={14} /> {c.name}
              </span>
            );
          })()}
          {gear && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold"
              style={{ background: "rgba(99,102,241,0.08)", color: "#818cf8" }}
            >
              <SmartIcon src={gear.icon} size={14} /> {gear.name} <span style={{ color: "rgba(99,102,241,0.6)", fontWeight: 400 }}>+{gear.bonus}%</span>
            </span>
          )}
        </div>
      </div>

      {/* Stats section */}
      <div className="px-4 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        {/* XP row + bar */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>XP{xpMalus ? " (−50%)" : ""}</span>
          <span className="text-xs font-mono font-semibold" style={{ color: xpMalus ? "#ef4444" : "#a855f7" }}>
            {nextLvlEntry ? `${xp - lvl.xpRequired} / ${nextLvlEntry.xpRequired - lvl.xpRequired}` : "MAX"}
          </span>
        </div>
        <div className="rounded-full overflow-hidden mb-2" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.round(progress * 100)}%`, background: `linear-gradient(90deg, ${lvl.color}99, ${lvl.color})`, boxShadow: `0 0 6px ${lvl.color}60` }}
          />
        </div>

        {/* Quests + Forge — compact row */}
        <div className="flex items-center justify-between">
          <span className="text-xs inline-flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            Quests <span className="font-mono font-semibold" style={{ color: "#8b5cf6" }}>{user.questsCompleted ?? 0}</span>
          </span>
          <span
            className="text-xs inline-flex items-center gap-1"
            title={forgeInfo.tooltipText}
            style={{ cursor: "default" }}
          >
            <SmartIcon src="/images/icons/ach-forge-novice.png" size={35} style={{ filter: forgeFilter }} />
            <span className="font-mono font-semibold" style={{ color: forgeColor }}>{temp}%</span>
            <span style={{ color: forgeColor, fontSize: 10, fontWeight: 600 }}>{forgeTierLabel}</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
            <span className="font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{goldMultiplier}×</span>
          </span>
        </div>
        {/* Total Modifiers */}
        {user.modifiers && (
          <div className="flex items-center justify-between mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="text-xs inline-flex items-center gap-1" style={{ color: "#a855f7" }}>
              XP <span className="font-mono font-bold" style={{ color: user.modifiers.xp.total >= 1 ? "#a855f7" : "#ef4444" }}>×{user.modifiers.xp.total}</span>
            </span>
            <span className="text-xs inline-flex items-center gap-1" style={{ color: "#fbbf24" }}>
              Gold <span className="font-mono font-bold" style={{ color: "#fbbf24" }}>×{user.modifiers.gold.total}</span>
            </span>
          </div>
        )}
      </div>

      {/* Bottom section — companions + achievements */}
      {(companionAchs.length > 0 || displayAchs.length > 0) && (
        <div className="px-4 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {/* Summoned companions */}
          {companionAchs.length > 0 && (
            <div className="flex items-center gap-2 mb-1.5">
              {companionAchs.map(c => (
                <span
                  key={c.id}
                  className={mood.anim}
                  title={`${COMPANION_META[c.id]?.name ?? c.name} (+2% XP) — ${mood.tip}`}
                  style={{ cursor: "default", display: "inline-flex" }}
                >
                  <SmartIcon src={COMPANION_META[c.id]?.icon ?? c.icon} size={18} />
                </span>
              ))}
              <SmartIcon src={mood.emoji} size={13} style={{ marginLeft: 2 }} />
              <span className="text-xs ml-auto font-mono" style={{ color: "rgba(99,102,241,0.5)", fontSize: 10 }}>+{companionAchs.length * 2}% XP</span>
            </div>
          )}

          {/* Achievement badges */}
          {displayAchs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {displayAchs.map(a => (
                <span
                  key={a.id}
                  title={`${a.name}: ${a.desc}`}
                  style={{ cursor: "default", display: "inline-flex" }}
                >
                  <SmartIcon src={a.icon} size={20} />
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
