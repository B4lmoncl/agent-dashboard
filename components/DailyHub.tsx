"use client";

import { useState, useEffect, useMemo, memo } from "react";
import type { User } from "@/app/types";
import { getUserLevel } from "@/app/utils";
import { FLOORS } from "@/app/config";

// ─── Next Feature Unlock ────────────────────────────────────────────────────
function getNextUnlock(level: number): { level: number; features: string[]; color: string } | null {
  for (const floor of FLOORS) {
    if (floor.minLevel && floor.minLevel > level) {
      return { level: floor.minLevel, features: [floor.name], color: floor.color };
    }
    for (const room of floor.rooms) {
      const roomLevel = room.minLevel ?? floor.minLevel ?? 1;
      if (roomLevel > level) {
        return { level: roomLevel, features: [room.label], color: floor.color };
      }
    }
  }
  return null;
}

// ─── Companion daily quotes (Skulduggery-humor) ─────────────────────────────
const COMPANION_DAILY_QUOTES: Record<string, string[]> = {
  cat: [
    "{name} stares at you. Then at the quest board. The message is clear.",
    "{name} yawns. Not boredom — judging you is exhausting work.",
    "{name} is asleep on your quest list. This is either a statement or a nap.",
  ],
  dog: [
    "{name} brought you a quest. It's slightly chewed, but the intent is pure.",
    "{name} has faith in you. Unconditional, unearned, and slightly suspicious.",
    "{name} sat by the door. Someone has to guard against procrastination.",
  ],
  dragon: [
    "{name} breathed on your coffee. It's warm now. You're welcome.",
    "{name} burned your excuses. Literally. The desk is fine. Mostly.",
    "{name} is not impressed. {name} is never impressed. That's the point.",
  ],
  owl: [
    "{name} read three books while you slept. {name} has thoughts.",
    "{name} hooted at 3 AM. It was wisdom. You weren't listening.",
    "{name} arranged your quests by priority. Silently. Judgmentally.",
  ],
  phoenix: [
    "{name} died yesterday. {name} got better. Your excuses can too.",
    "{name} is on fire. As usual. It's a lifestyle, not a problem.",
    "Yesterday was yesterday. {name} already forgot it. Literally.",
  ],
  wolf: [
    "{name} howled at the moon. It was motivational. The neighbors disagree.",
    "{name} is tracking your progress. {name} is a very patient hunter.",
    "{name} doesn't do pep talks. {name} does silent, intense staring.",
  ],
  fox: [
    "{name} found a shortcut. It's probably a trap. {name} took it anyway.",
    "{name} suggests a creative approach. 'Creative' is doing a lot of work there.",
    "{name} grinned. In {name}'s defense, foxes always grin. It's unsettling.",
  ],
  bear: [
    "{name} woke up. This is a bigger deal than you think.",
    "{name} punched a tree. For motivation. The tree had it coming.",
    "{name} is here. {name} is large. {name} believes in you. Aggressively.",
  ],
  default: [
    "Your companion watches. Patiently. The patience is aggressive.",
    "Today is a day. That's all the motivation you're getting.",
    "Your companion made a list. It's longer than yours.",
  ],
};

// ─── Streak urgency (only shows when at-risk) ──────────────────────────────
function getStreakUrgency(streak: number, streakLastDate?: string | null): {
  show: boolean; label: string; color: string;
} {
  if (streak < 3) return { show: false, label: "", color: "" };
  const now = new Date();
  const berlinNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const todayStr = `${berlinNow.getFullYear()}-${String(berlinNow.getMonth() + 1).padStart(2, "0")}-${String(berlinNow.getDate()).padStart(2, "0")}`;
  if (streakLastDate === todayStr) return { show: false, label: "", color: "" }; // Safe today
  // At risk — show warning
  return { show: true, label: `${streak}d streak at risk!`, color: "#ef4444" };
}

// ─── DailyHub Component ─────────────────────────────────────────────────────
// Slim action bar: Daily Bonus + Streak Warning + Today Drawer trigger.
// Detail lives in TodayDrawer — DailyHub is the quick-glance + quick-act layer.

interface DailyHubProps {
  user: User;
  dailyBonusAvailable: boolean;
  onClaimDailyBonus: () => void;
  claimingDailyBonus: boolean;
  dailyMissions: {
    missions: { id: string; label: string; points: number; done: boolean }[];
    earned: number;
    total: number;
    milestones: { threshold: number; reward: Record<string, number>; claimed: boolean }[];
  } | null;
  questsCompletedToday: number;
  onNavigate: (view: string) => void;
  onTodayOpen: () => void;
}

export const DailyHub = memo(function DailyHub({
  user,
  dailyBonusAvailable,
  onClaimDailyBonus,
  claimingDailyBonus,
  dailyMissions,
  questsCompletedToday,
  onNavigate,
  onTodayOpen,
}: DailyHubProps) {
  const streak = user.streakDays ?? 0;
  const streakUrgency = getStreakUrgency(streak, user.streakLastDate);
  const playerLevel = getUserLevel(user.xp ?? 0).level;
  const nextUnlock = playerLevel < 15 ? getNextUnlock(playerLevel) : null;
  const nextMilestone = dailyMissions?.milestones.find(m => !m.claimed && dailyMissions.earned >= m.threshold);

  // Companion daily quote (deterministic per day)
  const companionQuote = useMemo(() => {
    const comp = user.companion;
    if (!comp) return null;
    const type = comp.type ?? "default";
    const name = comp.name ?? "Companion";
    const quotes = COMPANION_DAILY_QUOTES[type] ?? COMPANION_DAILY_QUOTES.default;
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const idx = dayOfYear % quotes.length;
    return quotes[idx].replace(/\{name\}/g, name);
  }, [user.companion]);

  // Greeting based on time of day (Berlin)
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const h = parseInt(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin", hour: "numeric", hour12: false }), 10);
    if (h >= 5 && h < 12) setGreeting("Good morning");
    else if (h >= 12 && h < 18) setGreeting("Good afternoon");
    else if (h >= 18 && h < 22) setGreeting("Good evening");
    else setGreeting("Night owl mode");
  }, []);

  // Only render if there's something actionable to show
  const hasAction = dailyBonusAvailable || streakUrgency.show || nextMilestone || (user._restedXpPool ?? 0) > 50;
  // Always show for new players (< Lv5) or when companion has a quote
  const showHub = hasAction || playerLevel < 5 || !!companionQuote;
  if (!showHub) return null;

  return (
    <div
      className="rounded-xl overflow-hidden tab-content-enter"
      style={{
        background: "linear-gradient(135deg, rgba(17,19,24,0.95), rgba(26,28,35,0.9))",
        border: `1px solid ${streakUrgency.show ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
        boxShadow: streakUrgency.show ? "0 0 20px rgba(239,68,68,0.1)" : "none",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Greeting (compact) */}
        <p className="text-sm font-semibold flex-shrink-0" style={{ color: "#e8e8e8" }}>
          {greeting}, <span style={{ color: user.color ?? "#a78bfa" }}>{user.name}</span>
        </p>

        {/* Streak Warning — only when at risk */}
        {streakUrgency.show && (
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded streak-urgent-pulse flex-shrink-0" style={{ color: streakUrgency.color, background: `${streakUrgency.color}15`, border: `1px solid ${streakUrgency.color}30` }}>
            🔥 {streakUrgency.label}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Rested XP badge */}
        {(user._restedXpPool ?? 0) > 50 && (
          <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
            ★ {Math.round(user._restedXpPool!)} Rested XP
          </span>
        )}

        {/* Next unlock badge */}
        {nextUnlock && (
          <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: `${nextUnlock.color}10`, color: `${nextUnlock.color}99`, border: `1px solid ${nextUnlock.color}25` }}>
            Lv.{nextUnlock.level}: {nextUnlock.features.join(", ")}
          </span>
        )}

        {/* Unclaimed milestone nudge */}
        {nextMilestone && !dailyBonusAvailable && (
          <button onClick={onTodayOpen} className="text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)", cursor: "pointer" }} title="Claim milestone in Today's Overview">
            Claim ★
          </button>
        )}

        {/* Today Drawer trigger */}
        <button
          onClick={onTodayOpen}
          className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", cursor: "pointer", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
          title="Open detailed Today overview"
        >
          Today ↗
        </button>

        {/* Daily Bonus Claim — the primary action */}
        {dailyBonusAvailable && (
          <button
            onClick={onClaimDailyBonus}
            disabled={claimingDailyBonus}
            className="px-4 py-1.5 rounded-lg text-xs font-bold daily-bonus-glow flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.15))",
              color: "#fbbf24",
              border: "1px solid rgba(251,191,36,0.4)",
              cursor: claimingDailyBonus ? "not-allowed" : "pointer",
              opacity: claimingDailyBonus ? 0.6 : 1,
              animation: !claimingDailyBonus ? "daily-bonus-pulse 2s ease-in-out infinite" : "none",
            }}
            title="Claim your daily login bonus"
          >
            {claimingDailyBonus ? "Claiming..." : "Claim Daily Bonus"}
          </button>
        )}
      </div>
      {/* Companion message — unique to DailyHub, not in TodayDrawer */}
      {companionQuote && (
        <div className="px-4 pb-2 -mt-0.5">
          <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.22)", lineHeight: 1.5 }}>
            &ldquo;{companionQuote}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
});
