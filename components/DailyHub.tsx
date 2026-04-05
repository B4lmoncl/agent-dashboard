"use client";

import { useState, useEffect, memo } from "react";
import type { User } from "@/app/types";
import { Tip, TipCustom } from "@/components/GameTooltip";

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
    </div>
  );
});
