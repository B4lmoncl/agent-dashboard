"use client";

import { useDashboard } from "@/app/DashboardContext";
import type { ActiveNpc, Ritual } from "@/app/types";

interface TodayItem {
  id: string;
  icon: string;
  label: string;
  done: boolean;
  urgent?: boolean;
  sub?: string;
  onClick?: () => void;
}

export default function TodayDrawer({
  open,
  onClose,
  onNavigate,
  dailyBonusAvailable,
  dailyMissions,
  rituals,
  activeNpcs,
  onClaimDailyBonus,
  inProgressCount,
  weeklyChallenge,
  worldBossActive,
  riftActive,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  dailyBonusAvailable: boolean;
  dailyMissions: { missions: { id: string; label: string; points: number; done: boolean }[]; earned: number; total: number; milestones: { threshold: number; reward: Record<string, number>; claimed: boolean }[] } | null;
  rituals: Ritual[];
  activeNpcs: ActiveNpc[];
  onClaimDailyBonus: () => void;
  inProgressCount: number;
  weeklyChallenge: { stagesCompleted?: number } | null;
  worldBossActive: boolean;
  riftActive: boolean;
}) {
  const { loggedInUser } = useDashboard();

  if (!open) return null;

  // Build checklist items
  const items: TodayItem[] = [];

  // 1. Daily Bonus
  items.push({
    id: "daily-bonus",
    icon: "🎁",
    label: "Daily Bonus",
    done: !dailyBonusAvailable,
    onClick: dailyBonusAvailable ? onClaimDailyBonus : undefined,
  });

  // 2. Companion Pet (2x/day)
  const comp = loggedInUser?.companion;
  const today = new Date().toISOString().slice(0, 10);
  const petsDone = comp?.petDateStr === today ? (comp?.petCountToday ?? 0) : 0;
  if (comp) {
    items.push({
      id: "companion-pet",
      icon: comp.emoji || "🐾",
      label: `Pet ${comp.name}`,
      done: petsDone >= 2,
      sub: petsDone >= 2 ? "2/2" : `${petsDone}/2`,
      onClick: () => { onNavigate("questBoard"); onClose(); },
    });
  }

  // 3. Rituals (incomplete today)
  const incompleteRituals = rituals.filter(r => {
    if (!r.completedDates) return true;
    return !r.completedDates.includes(today);
  });
  items.push({
    id: "rituals",
    icon: "🔮",
    label: "Rituals",
    done: incompleteRituals.length === 0 && rituals.length > 0,
    sub: rituals.length === 0 ? "None set" : `${rituals.length - incompleteRituals.length}/${rituals.length}`,
    onClick: () => { onNavigate("rituals"); onClose(); },
  });

  // 4. Daily Missions
  if (dailyMissions) {
    const allDone = dailyMissions.missions.every(m => m.done);
    const doneCount = dailyMissions.missions.filter(m => m.done).length;
    items.push({
      id: "daily-missions",
      icon: "📋",
      label: "Daily Missions",
      done: allDone,
      sub: `${doneCount}/${dailyMissions.missions.length}`,
      onClick: () => { onNavigate("questBoard"); onClose(); },
    });

    // Unclaimed milestones
    const unclaimedMilestones = dailyMissions.milestones.filter(m => !m.claimed && dailyMissions.earned >= m.threshold);
    if (unclaimedMilestones.length > 0) {
      items.push({
        id: "milestone-claim",
        icon: "⭐",
        label: "Claim Milestone",
        done: false,
        urgent: true,
        sub: `${unclaimedMilestones.length} ready`,
        onClick: () => { onNavigate("questBoard"); onClose(); },
      });
    }
  }

  // 5. NPCs leaving within 24h
  const now = Date.now();
  const urgentNpcs = activeNpcs.filter(n => {
    const expires = new Date(n.expiresAt).getTime();
    return expires - now < 24 * 60 * 60 * 1000 && expires > now;
  });
  if (urgentNpcs.length > 0) {
    for (const npc of urgentNpcs) {
      const hoursLeft = Math.max(0, Math.round((new Date(npc.expiresAt).getTime() - now) / 3600000));
      items.push({
        id: `npc-${npc.id}`,
        icon: npc.emoji || "👤",
        label: npc.name,
        done: false,
        urgent: true,
        sub: `Leaves in ${hoursLeft}h`,
        onClick: () => { onNavigate("npcBoard"); onClose(); },
      });
    }
  }

  // 6. Crafting daily bonus (first craft = 2x XP)
  const lastCraft = (loggedInUser as Record<string, unknown> | null)?.lastCraftDate as string | undefined;
  const craftedToday = lastCraft === today;
  if (loggedInUser?.professions && Object.keys(loggedInUser.professions).length > 0) {
    items.push({
      id: "crafting-bonus",
      icon: "⚒️",
      label: "Crafting 2× XP",
      done: craftedToday,
      sub: craftedToday ? "Used" : "Available",
      onClick: () => { onNavigate("forge"); onClose(); },
    });
  }

  // 7. In-progress quests
  if (inProgressCount > 0) {
    items.push({
      id: "in-progress",
      icon: "⚔️",
      label: "Quests In Progress",
      done: false,
      sub: `${inProgressCount} active`,
      onClick: () => { onNavigate("questBoard"); onClose(); },
    });
  }

  // 8. Weekly challenge (Star Path)
  if (weeklyChallenge) {
    const starsEarned = weeklyChallenge.stagesCompleted ?? 0;
    items.push({
      id: "weekly-challenge",
      icon: "⭐",
      label: "Star Path",
      done: starsEarned >= 3,
      sub: `${starsEarned}/3 stages`,
      onClick: () => { onNavigate("challenges"); onClose(); },
    });
  }

  // 9. Active world boss
  if (worldBossActive) {
    items.push({
      id: "world-boss",
      icon: "🐉",
      label: "World Boss Active",
      done: false,
      urgent: true,
      onClick: () => { onNavigate("worldboss"); onClose(); },
    });
  }

  // 10. Active rift
  if (riftActive) {
    items.push({
      id: "rift-active",
      icon: "🌀",
      label: "Rift In Progress",
      done: false,
      sub: "Complete your stages",
      onClick: () => { onNavigate("rift"); onClose(); },
    });
  }

  const doneCount = items.filter(i => i.done).length;
  const allDone = doneCount === items.length && items.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed top-0 right-0 z-[91] h-full flex flex-col"
        style={{
          width: 300,
          background: "linear-gradient(180deg, #131620 0%, #0f1117 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
          animation: "today-drawer-in 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm">📅</span>
            <span className="text-sm font-bold" style={{ color: "#e8e8e8" }}>Today</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: allDone ? "rgba(74,222,128,0.12)" : "rgba(129,140,248,0.12)", color: allDone ? "#4ade80" : "#818cf8" }}>
              {doneCount}/{items.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-2">
          <div className="progress-bar-diablo">
            <div
              className="progress-bar-diablo-fill"
              style={{
                width: `${items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0}%`,
                background: allDone
                  ? "linear-gradient(90deg, #4ade8088, #4ade80, #22c55ecc)"
                  : "linear-gradient(90deg, #818cf888, #818cf8, #a78bfacc)",
              }}
            />
          </div>
        </div>

        {/* Checklist */}
        <div className="flex-1 overflow-y-auto px-3 py-1" style={{ scrollbarWidth: "thin" }}>
          {items.map(item => (
            <button
              key={item.id}
              onClick={item.onClick}
              disabled={!item.onClick}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-1 text-left transition-all"
              style={{
                background: item.urgent ? "rgba(251,191,36,0.04)" : item.done ? "rgba(74,222,128,0.03)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${item.urgent ? "rgba(251,191,36,0.15)" : item.done ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)"}`,
                cursor: item.onClick ? "pointer" : "default",
                opacity: item.done && !item.onClick ? 0.5 : 1,
              }}
            >
              {/* Status indicator */}
              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{
                background: item.done ? "rgba(74,222,128,0.15)" : item.urgent ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
                color: item.done ? "#4ade80" : item.urgent ? "#fbbf24" : "rgba(255,255,255,0.3)",
                border: `1px solid ${item.done ? "rgba(74,222,128,0.3)" : item.urgent ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
                fontSize: 10,
              }}>
                {item.done ? "✓" : item.urgent ? "!" : "○"}
              </span>

              {/* Icon */}
              <span className="flex-shrink-0" style={{ fontSize: 16 }}>{item.icon}</span>

              {/* Label + sub */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{
                  color: item.done ? "rgba(255,255,255,0.35)" : item.urgent ? "#fbbf24" : "#e8e8e8",
                  textDecoration: item.done ? "line-through" : "none",
                }}>
                  {item.label}
                </p>
                {item.sub && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>{item.sub}</p>
                )}
              </div>

              {/* Arrow for clickable items */}
              {item.onClick && !item.done && (
                <span className="flex-shrink-0 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>›</span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        {allDone && (
          <div className="px-4 py-3 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold" style={{ color: "#4ade80" }}>All done for today!</p>
          </div>
        )}
      </div>
    </>
  );
}
