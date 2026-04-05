"use client";

import { useState, useEffect, useMemo, memo } from "react";
import type { User } from "@/app/types";

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

// ─── Streak urgency thresholds ──────────────────────────────────────────────
function getStreakStatus(streak: number, streakLastDate?: string | null): {
  label: string; color: string; urgent: boolean; message: string;
} {
  if (streak === 0) return { label: "No Streak", color: "#4b5563", urgent: false, message: "Complete a quest to start your streak" };

  // Check if streak was already updated today (Berlin timezone)
  const now = new Date();
  const berlinNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const todayStr = `${berlinNow.getFullYear()}-${String(berlinNow.getMonth() + 1).padStart(2, "0")}-${String(berlinNow.getDate()).padStart(2, "0")}`;

  if (streakLastDate === todayStr) {
    return { label: "Streak Safe", color: "#22c55e", urgent: false, message: `${streak}-day streak secured for today` };
  }

  // Streak exists but no activity today
  if (streak >= 7) {
    return { label: "Streak at Risk!", color: "#ef4444", urgent: true, message: `${streak}-day streak needs a quest today!` };
  }
  return { label: "Keep Going", color: "#f59e0b", urgent: false, message: `${streak}-day streak — complete a quest to extend it` };
}

// ─── DailyHub Component ─────────────────────────────────────────────────────

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
  const streakStatus = getStreakStatus(streak, user.streakLastDate);
  const missionsCompleted = dailyMissions?.missions.filter(m => m.done).length ?? 0;
  const missionsTotal = dailyMissions?.missions.length ?? 6;
  const missionProgress = missionsTotal > 0 ? missionsCompleted / missionsTotal : 0;
  const nextMilestone = dailyMissions?.milestones.find(m => !m.claimed && dailyMissions.earned >= m.threshold);
  const forgeTemp = Math.min(user.forgeTemp ?? 0, 100);

  // Companion daily quote (deterministic per day)
  const companionQuote = useMemo(() => {
    const comp = user.companion;
    if (!comp) return null;
    const type = comp.type ?? "default";
    const name = comp.name ?? "Companion";
    const quotes = COMPANION_DAILY_QUOTES[type] ?? COMPANION_DAILY_QUOTES.default;
    // Use date as seed for deterministic daily rotation
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

  return (
    <div
      className="rounded-xl overflow-hidden tab-content-enter"
      style={{
        background: "linear-gradient(135deg, rgba(17,19,24,0.95), rgba(26,28,35,0.9))",
        border: `1px solid ${streakStatus.urgent ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
        boxShadow: streakStatus.urgent ? "0 0 20px rgba(239,68,68,0.1)" : "none",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Greeting + Streak */}
        <div className="flex-1 min-w-[180px]">
          <p className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>
            {greeting}, <span style={{ color: user.color ?? "#a78bfa" }}>{user.name}</span>
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded${streakStatus.urgent ? " streak-urgent-pulse" : ""}`}
              style={{
                color: streakStatus.color,
                background: `${streakStatus.color}15`,
                border: `1px solid ${streakStatus.color}30`,
              }}
            >
              {streak > 0 && <span style={{ marginRight: 3 }}>🔥</span>}
              {streakStatus.label}
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {streakStatus.message}
            </span>
          </div>
        </div>

        {/* Daily Missions Mini-Bar */}
        <button
          onClick={onTodayOpen}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
          title="Open Today's Overview"
        >
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs font-semibold" style={{ color: missionProgress >= 1 ? "#22c55e" : "rgba(255,255,255,0.5)" }}>
              Daily {missionsCompleted}/{missionsTotal}
            </span>
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${missionProgress * 100}%`,
                  background: missionProgress >= 1
                    ? "linear-gradient(90deg, #22c55e, #4ade80)"
                    : "linear-gradient(90deg, rgba(129,140,248,0.6), rgba(167,139,250,0.8))",
                }}
              />
            </div>
          </div>
          {nextMilestone && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
              Claim
            </span>
          )}
        </button>

        {/* Quests Today Counter */}
        <div className="flex items-center gap-1.5 px-2 py-1" title={`${questsCompletedToday} quests completed today`}>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Today:</span>
          <span className="text-sm font-bold font-mono" style={{ color: questsCompletedToday > 0 ? "#22c55e" : "rgba(255,255,255,0.2)" }}>
            {questsCompletedToday}
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>quests</span>
        </div>

        {/* Daily Bonus Claim */}
        {dailyBonusAvailable ? (
          <button
            onClick={onClaimDailyBonus}
            disabled={claimingDailyBonus}
            className="px-4 py-2 rounded-lg text-xs font-bold daily-bonus-glow"
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
        ) : (
          <div className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", color: "rgba(34,197,94,0.5)" }}>
            ✓ Bonus claimed
          </div>
        )}
      </div>
      {/* Bottom row: Rested XP + Companion message */}
      <div className="px-4 pb-2.5 -mt-1 flex items-center gap-3 flex-wrap">
        {(user._restedXpPool ?? 0) > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
            ★ {Math.round(user._restedXpPool!)} Rested XP
          </span>
        )}
        {companionQuote && (
          <p className="text-xs italic flex-1 min-w-0" style={{ color: "rgba(255,255,255,0.25)", lineHeight: 1.5 }}>
            &ldquo;{companionQuote}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
});
