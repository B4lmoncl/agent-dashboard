"use client";

import type { User, ClassDef } from "@/app/types";
import { getUserLevel, getUserXpProgress, getForgeTempInfo, GUILD_LEVELS } from "@/app/utils";
import shopData from "../public/data/shopItems.json";

const GEAR_ICONS: Record<string, { icon: string; name: string; bonus: number }> = Object.fromEntries(
  shopData.gearTiers.filter(g => g.tier > 0).map(g => [g.id, { icon: g.icon, name: g.name, bonus: g.xpBonus }])
);

export function UserCard({ user, classes = [] }: { user: User; classes?: ClassDef[] }) {
  const xp = user.xp ?? 0;
  const lvl = getUserLevel(xp);
  const progress = getUserXpProgress(xp);
  const nextLvlEntry = GUILD_LEVELS[lvl.level]; // level is 1-based, array idx = level
  const isMilestoneLevel = lvl.level === 10 || lvl.level === 20 || lvl.level === 30;
  const streak = user.streakDays ?? 0;
  const temp = Math.min(user.forgeTemp ?? 0, 100);
  const gold = user.gold ?? 0;
  const achs = user.earnedAchievements ?? [];
  const tempIcons = { cold: "/images/icons/temp-cold.png", warm: "/images/icons/temp-warm.png", hot: "/images/icons/temp-hot.png" };
  const tempKey = temp <= 33 ? "cold" : temp <= 66 ? "warm" : "hot";
  const tempIcon = tempKey;
  const tempColor = temp <= 33 ? "#ef4444" : temp <= 66 ? "#f97316" : "#60a5fa";
  const goldMultiplier = (1 + (temp / 100) * 0.5).toFixed(1);
  const xpMalus = temp === 0;
  const forgeInfo = getForgeTempInfo(temp);

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "#252525",
        border: `1px solid ${isMilestoneLevel ? lvl.color : lvl.color + "30"}`,
        boxShadow: isMilestoneLevel ? `0 0 20px ${lvl.color}30` : `0 0 16px ${lvl.color}10`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${user.color}, ${user.color}99)`, boxShadow: `0 4px 14px ${user.color}50`, color: "#fff" }}
        >
          {user.avatar || user.name?.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{user.name}</p>
            {streak > 0 && (
              <span
                className="text-xs font-bold flex items-center gap-0.5"
                style={{ color: streak >= 30 ? "#ef4444" : streak >= 7 ? "#f59e0b" : "#fb923c" }}
                title={`${streak} day streak!`}
              >
                {streak}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold" style={{ color: lvl.color }}>
            {isMilestoneLevel && "★ "}Lv {lvl.level}: {lvl.title}
          </p>
        </div>
        {/* Gold */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-mono font-bold inline-flex items-center gap-1" style={{ color: "#f59e0b" }} title="Gold"><img src="/images/icons/currency-gold.png" alt="" width={12} height={12} style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} /> {gold}</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Quests</span>
          <span className="text-xs font-mono font-medium" style={{ color: "#8b5cf6" }}>{user.questsCompleted ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>XP{xpMalus ? " −50%" : ""}</span>
          <span className="text-xs font-mono font-medium" style={{ color: xpMalus ? "#ef4444" : lvl.color }}>{xp}{nextLvlEntry ? ` / ${nextLvlEntry.xpRequired}` : " MAX"}</span>
        </div>
      </div>

      {/* XP Bar */}
      <div className="rounded-full overflow-hidden mb-2" style={{ height: 4, background: "rgba(255,255,255,0.07)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.round(progress * 100)}%`, background: `linear-gradient(90deg, ${lvl.color}99, ${lvl.color})`, boxShadow: `0 0 6px ${lvl.color}80` }}
        />
      </div>

      {/* Forge Temperature */}
      <div className="mb-2" title={forgeInfo.tooltipText}>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: tempColor }}>
            {tempIcon} {temp}% <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>|</span> <span style={{ color: "#f59e0b" }}>{goldMultiplier}x</span>
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Forge Temp</span>
        </div>
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{forgeInfo.actionSuggestion}</p>
        <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${temp}%`, background: `linear-gradient(90deg, ${tempColor}99, ${tempColor})`, boxShadow: `0 0 5px ${tempColor}60` }}
          />
        </div>
      </div>

      {/* Gear badge */}
      {user.gear && user.gear !== "worn" && (() => {
        const g = GEAR_ICONS[user.gear];
        if (!g) return null;
        return (
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <span className="text-sm">{g.icon}</span>
            <span className="text-xs font-semibold" style={{ color: "#818cf8" }}>{g.name}</span>
            <span className="text-xs ml-auto" style={{ color: "rgba(99,102,241,0.6)" }}>+{g.bonus}% XP</span>
          </div>
        );
      })()}

      {/* Class Badge */}
      {user.classId && (() => {
        const cls = classes.find(c => c.id === user.classId);
        if (user.classPending && !cls) {
          // Class is pending (not yet active)
          return (
            <div
              className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <span className="text-sm" style={{ animation: "pulse-online 1.5s ease-in-out infinite" }}>★</span>
              <span className="text-xs font-semibold" style={{ color: "rgba(245,158,11,0.7)" }}>Klasse wird geschmiedet...</span>
            </div>
          );
        }
        if (cls) {
          const tier = cls.tiers ? [...cls.tiers].reverse().find(t => (user.xp ?? 0) >= t.minXp) : null;
          return (
            <div
              className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)" }}
            >
              <span className="text-sm">{cls.icon}</span>
              <span className="text-xs font-semibold" style={{ color: "#a78bfa" }}>{cls.fantasy}</span>
              {tier && <span className="text-xs ml-auto" style={{ color: "rgba(167,139,250,0.55)" }}>{tier.title}</span>}
            </div>
          );
        }
        return null;
      })()}

      {/* Companion Badge */}
      {user.companion && (() => {
        const c = user.companion!;
        return (
          <div
            className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {c.emoji && c.emoji !== "x" && c.emoji.startsWith("/") ? <img src={c.emoji} alt="" width={18} height={18} style={{ imageRendering: "auto" }} /> : c.emoji && c.emoji !== "x" ? <span className="text-sm">{c.emoji}</span> : null}
            <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{c.name}</span>
            {c.isReal && <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.25)" }}>Haustier</span>}
          </div>
        );
      })()}

      {/* Companions with Moods */}
      {(() => {
        const COMPANION_IDS = ["ember_sprite", "lore_owl", "gear_golem"];
        const COMPANION_META: Record<string, { icon: string; name: string }> = {
          ember_sprite: { icon: "/images/icons/mini-ember-sprite.png", name: "Ember Sprite" },
          lore_owl:     { icon: "/images/icons/mini-lore-owl.png", name: "Lore Owl" },
          gear_golem:   { icon: "/images/icons/mini-gear-golem.png", name: "Gear Golem" },
        };
        const companions = achs.filter(a => COMPANION_IDS.includes(a.id));
        if (companions.length === 0) return null;
        // Companion mood based on streak
        const mood = streak >= 7 ? { emoji: "/images/icons/mood-happy.png", label: "happy", anim: "animate-bounce", tip: "Happy! Keep the streak going!" }
                   : streak >= 3 ? { emoji: "/images/icons/mood-neutral.png", label: "neutral", anim: "", tip: "Neutral. Complete quests to cheer them up!" }
                   : { emoji: "/images/icons/mood-sad.png", label: "sad", anim: "animate-pulse", tip: "Sad. No recent quests — your companions miss you!" };
        return (
          <div className="mt-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Companions:</span>
              {companions.map(c => (
                <span
                  key={c.id}
                  className={"text-sm " + mood.anim}
                  title={`${COMPANION_META[c.id]?.name ?? c.name} (+2% XP) — ${mood.tip}`}
                  style={{ cursor: "default" }}
                >
                  {(() => { const iconVal = COMPANION_META[c.id]?.icon ?? c.icon; return iconVal && iconVal.startsWith("/") ? <img src={iconVal} alt="" width={18} height={18} style={{ imageRendering: "auto" }} /> : iconVal; })()}
                </span>
              ))}
              <span className="text-xs ml-auto" style={{ color: "rgba(99,102,241,0.5)" }}>+{companions.length * 2}% XP</span>
            </div>
            <div className="flex items-center gap-1">
              {mood.emoji.startsWith("/") ? <img src={mood.emoji} alt="" width={14} height={14} style={{ imageRendering: "auto" }} title={mood.tip} /> : <span className="text-xs" title={mood.tip}>{mood.emoji}</span>}
              <span className="text-xs" style={{ color: mood.label === "happy" ? "#22c55e" : mood.label === "sad" ? "#ef4444" : "rgba(255,255,255,0.25)" }}>
                {mood.label === "happy" ? "Companions are happy!" : mood.label === "sad" ? "Companions need attention" : "Companions are fine"}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Achievement badges */}
      {achs.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {achs.filter(a => !["ember_sprite","lore_owl","gear_golem"].includes(a.id)).slice(-6).map(a => (
            <span
              key={a.id}
              className="text-sm"
              title={`${a.name}: ${a.desc}`}
              style={{ cursor: "default" }}
            >
              {a.icon && a.icon.startsWith("/") ? <img src={a.icon} alt="" width={18} height={18} style={{ imageRendering: "auto" }} /> : a.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
