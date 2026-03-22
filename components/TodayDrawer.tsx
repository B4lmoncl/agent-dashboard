"use client";

import { useMemo } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getUserLevel, getUserXpProgress, getForgeTempInfo } from "@/app/utils";
import type { ActiveNpc, Ritual } from "@/app/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TodayItem {
  id: string;
  icon: string;
  label: string;
  done: boolean;
  urgent?: boolean;
  sub?: string;
  reward?: string;
  onClick?: () => void;
}

interface TodayCategory {
  id: string;
  label: string;
  icon: string;
  items: TodayItem[];
}

// ─── Time-of-day flavor ──────────────────────────────────────────────────────

function getTimeGreeting(): { greeting: string; icon: string; flavor: string } {
  const h = new Date().getHours();
  if (h < 6) return { greeting: "Night Watch", icon: "🌙", flavor: "The halls are quiet. Perfect for focused work." };
  if (h < 12) return { greeting: "Dawn Patrol", icon: "☀️", flavor: "A new day in Aethermoor. The forge awaits." };
  if (h < 17) return { greeting: "Afternoon", icon: "⚔️", flavor: "The sun is high. Time for quests." };
  if (h < 21) return { greeting: "Evening", icon: "🌅", flavor: "The day winds down. Wrap up your tasks." };
  return { greeting: "Night Watch", icon: "🌙", flavor: "The halls are quiet. Perfect for focused work." };
}

// ─── Component ───────────────────────────────────────────────────────────────

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
  vowCount,
  socialBadge,
  expeditionActive,
  dungeonActive,
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
  vowCount: number;
  socialBadge: { pendingFriendRequests: number; unreadMessages: number; activeTrades: number } | null;
  expeditionActive: boolean;
  dungeonActive: boolean;
}) {
  const { loggedInUser } = useDashboard();

  // ─── Hero data ───────────────────────────────────────────────────────────

  const xp = loggedInUser?.xp ?? 0;
  const levelInfo = useMemo(() => getUserLevel(xp), [xp]);
  const xpProgress = useMemo(() => getUserXpProgress(xp), [xp]);
  const forgeTemp = Math.min(loggedInUser?.forgeTemp ?? 0, 100);
  const forgeInfo = useMemo(() => getForgeTempInfo(forgeTemp), [forgeTemp]);
  const streak = loggedInUser?.streakDays ?? 0;
  const timeInfo = useMemo(() => getTimeGreeting(), []);

  // Forge color
  const forgeTempColor = forgeTemp >= 100 ? "#e0f0ff" : forgeTemp >= 80 ? "#f97316" : forgeTemp >= 60 ? "#ea580c" : forgeTemp >= 40 ? "#b45309" : forgeTemp >= 20 ? "#78716c" : "#4b5563";

  // ─── Build categories ────────────────────────────────────────────────────

  const today = new Date().toISOString().slice(0, 10);

  const categories = useMemo(() => {
    const urgent: TodayItem[] = [];
    const daily: TodayItem[] = [];
    const content: TodayItem[] = [];
    const social: TodayItem[] = [];

    // ── DAILY ──

    // Daily Bonus
    daily.push({
      id: "daily-bonus",
      icon: "🎁",
      label: "Daily Bonus",
      done: !dailyBonusAvailable,
      reward: dailyBonusAvailable ? "+Gold, +Stardust" : undefined,
      onClick: dailyBonusAvailable ? onClaimDailyBonus : undefined,
    });

    // Companion Pet (2x/day)
    const comp = loggedInUser?.companion;
    const petsDone = comp?.petDateStr === today ? (comp?.petCountToday ?? 0) : 0;
    if (comp) {
      daily.push({
        id: "companion-pet",
        icon: comp.emoji || "🐾",
        label: `Pet ${comp.name}`,
        done: petsDone >= 2,
        sub: `${petsDone}/2`,
        reward: "+Bond XP",
        onClick: () => { onNavigate("questBoard"); onClose(); },
      });
    }

    // Rituals
    const incompleteRituals = rituals.filter(r => {
      if (!r.completedDates) return true;
      return !r.completedDates.includes(today);
    });
    daily.push({
      id: "rituals",
      icon: "🔮",
      label: "Rituals",
      done: incompleteRituals.length === 0 && rituals.length > 0,
      sub: rituals.length === 0 ? "None set" : `${rituals.length - incompleteRituals.length}/${rituals.length}`,
      reward: rituals.length > 0 ? "+XP, Streak" : undefined,
      onClick: () => { onNavigate("rituals"); onClose(); },
    });

    // Daily Missions
    if (dailyMissions) {
      const allDone = dailyMissions.missions.every(m => m.done);
      const doneCount = dailyMissions.missions.filter(m => m.done).length;
      daily.push({
        id: "daily-missions",
        icon: "📋",
        label: "Daily Missions",
        done: allDone,
        sub: `${doneCount}/${dailyMissions.missions.length}`,
        reward: allDone ? undefined : `${dailyMissions.total - dailyMissions.earned} pts left`,
        onClick: () => { onNavigate("questBoard"); onClose(); },
      });

      // Unclaimed milestones → URGENT
      const unclaimedMilestones = dailyMissions.milestones.filter(m => !m.claimed && dailyMissions.earned >= m.threshold);
      if (unclaimedMilestones.length > 0) {
        urgent.push({
          id: "milestone-claim",
          icon: "⭐",
          label: "Claim Milestone",
          done: false,
          urgent: true,
          sub: `${unclaimedMilestones.length} ready`,
          reward: "Currencies",
          onClick: () => { onNavigate("questBoard"); onClose(); },
        });
      }
    }

    // Crafting daily bonus
    const lastCraft = (loggedInUser as Record<string, unknown> | null)?.lastCraftDate as string | undefined;
    const craftedToday = lastCraft === today;
    if (loggedInUser?.professions && Object.keys(loggedInUser.professions).length > 0) {
      daily.push({
        id: "crafting-bonus",
        icon: "⚒️",
        label: "Crafting 2× XP",
        done: craftedToday,
        sub: craftedToday ? "Used" : "Available",
        reward: craftedToday ? undefined : "2× Prof. XP",
        onClick: () => { onNavigate("forge"); onClose(); },
      });
    }

    // ── URGENT ──

    // NPCs leaving within 24h
    const now = Date.now();
    const urgentNpcs = activeNpcs.filter(n => {
      const expires = new Date(n.expiresAt).getTime();
      return expires - now < 24 * 60 * 60 * 1000 && expires > now;
    });
    for (const npc of urgentNpcs) {
      const hoursLeft = Math.max(0, Math.round((new Date(npc.expiresAt).getTime() - now) / 3600000));
      urgent.push({
        id: `npc-${npc.id}`,
        icon: npc.emoji || "👤",
        label: npc.name,
        done: false,
        urgent: true,
        sub: `Leaves in ${hoursLeft}h`,
        onClick: () => { onNavigate("npcBoard"); onClose(); },
      });
    }

    // World Boss
    if (worldBossActive) {
      urgent.push({
        id: "world-boss",
        icon: "🐉",
        label: "World Boss Active",
        done: false,
        urgent: true,
        reward: "Unique drops",
        onClick: () => { onNavigate("worldboss"); onClose(); },
      });
    }

    // ── ACTIVE CONTENT ──

    // In-progress quests
    if (inProgressCount > 0) {
      content.push({
        id: "in-progress",
        icon: "⚔️",
        label: "Quests In Progress",
        done: false,
        sub: `${inProgressCount} active`,
        reward: "+XP, +Gold",
        onClick: () => { onNavigate("questBoard"); onClose(); },
      });
    }

    // Weekly challenge
    if (weeklyChallenge) {
      const starsEarned = weeklyChallenge.stagesCompleted ?? 0;
      content.push({
        id: "weekly-challenge",
        icon: "⭐",
        label: "Star Path",
        done: starsEarned >= 3,
        sub: `${starsEarned}/3 stages`,
        reward: starsEarned < 3 ? "Sternentaler" : undefined,
        onClick: () => { onNavigate("challenges"); onClose(); },
      });
    }

    // Rift
    if (riftActive) {
      content.push({
        id: "rift-active",
        icon: "🌀",
        label: "Rift In Progress",
        done: false,
        sub: "Complete your stages",
        reward: "Rift loot",
        onClick: () => { onNavigate("rift"); onClose(); },
      });
    }

    // Expedition
    if (expeditionActive) {
      content.push({
        id: "expedition",
        icon: "🏔️",
        label: "Expedition",
        done: false,
        sub: "Contribute quests",
        reward: "Group rewards",
        onClick: () => { onNavigate("challenges"); onClose(); },
      });
    }

    // Dungeon
    if (dungeonActive) {
      content.push({
        id: "dungeon-active",
        icon: "🏚️",
        label: "Dungeon Run",
        done: false,
        sub: "Collect rewards",
        reward: "Gear, Gems",
        onClick: () => { onNavigate("dungeons"); onClose(); },
      });
    }

    // Vows
    if (vowCount > 0) {
      content.push({
        id: "vows",
        icon: "🩸",
        label: "Vows",
        done: false,
        sub: `${vowCount} active`,
        reward: "+XP per clean day",
        onClick: () => { onNavigate("vows"); onClose(); },
      });
    }

    // ── SOCIAL ──

    if (socialBadge) {
      if (socialBadge.pendingFriendRequests > 0) {
        social.push({
          id: "friend-requests",
          icon: "👥",
          label: "Friend Requests",
          done: false,
          urgent: true,
          sub: `${socialBadge.pendingFriendRequests} pending`,
          onClick: () => { onNavigate("social"); onClose(); },
        });
      }
      if (socialBadge.activeTrades > 0) {
        social.push({
          id: "active-trades",
          icon: "🤝",
          label: "Open Trades",
          done: false,
          sub: `${socialBadge.activeTrades} active`,
          onClick: () => { onNavigate("social"); onClose(); },
        });
      }
      if (socialBadge.unreadMessages > 0) {
        social.push({
          id: "unread-messages",
          icon: "💬",
          label: "Unread Messages",
          done: false,
          sub: `${socialBadge.unreadMessages} new`,
          onClick: () => { onNavigate("social"); onClose(); },
        });
      }
    }

    // Build categories array (skip empty categories)
    const cats: TodayCategory[] = [];
    if (urgent.length > 0) cats.push({ id: "urgent", label: "Urgent", icon: "⚡", items: urgent });
    if (daily.length > 0) cats.push({ id: "daily", label: "Daily Tasks", icon: "☀️", items: daily });
    if (content.length > 0) cats.push({ id: "content", label: "Active Content", icon: "🗺️", items: content });
    if (social.length > 0) cats.push({ id: "social", label: "Social", icon: "💬", items: social });
    return cats;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyBonusAvailable, dailyMissions, rituals, activeNpcs, loggedInUser, inProgressCount, weeklyChallenge, worldBossActive, riftActive, vowCount, socialBadge, expeditionActive, dungeonActive, today]);

  const allItems = categories.flatMap(c => c.items);
  const doneCount = allItems.filter(i => i.done).length;
  const totalCount = allItems.length;
  const allDone = doneCount === totalCount && totalCount > 0;

  if (!open) return null;

  // ─── Level ring SVG params ─────────────────────────────────────────────

  const ringRadius = 28;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - xpProgress);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 z-[91] h-full flex flex-col"
        style={{
          width: 420,
          background: "linear-gradient(180deg, #14172199 0%, #0f1117 30%)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.6)",
          animation: "today-drawer-in 0.25s ease-out",
        }}
      >
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <span className="text-base">{timeInfo.icon}</span>
              <div>
                <span className="text-sm font-bold" style={{ color: "#e8e8e8" }}>{timeInfo.greeting}</span>
                <span className="text-xs font-mono ml-2 px-1.5 py-0.5 rounded" style={{
                  background: allDone ? "rgba(74,222,128,0.12)" : "rgba(129,140,248,0.12)",
                  color: allDone ? "#4ade80" : "#818cf8",
                }}>
                  {doneCount}/{totalCount}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)", lineHeight: 1.4 }}>{timeInfo.flavor}</p>
        </div>

        {/* ─── Hero Section ───────────────────────────────────────────── */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-5">

            {/* Level Ring */}
            <div className="relative flex-shrink-0" style={{ width: 68, height: 68 }}>
              <svg width="68" height="68" viewBox="0 0 68 68" className="absolute inset-0">
                {/* Background ring */}
                <circle cx="34" cy="34" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                {/* Progress ring */}
                <circle
                  cx="34" cy="34" r={ringRadius}
                  fill="none"
                  stroke={levelInfo.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  transform="rotate(-90 34 34)"
                  style={{ transition: "stroke-dashoffset 0.8s ease-out", filter: `drop-shadow(0 0 4px ${levelInfo.color}60)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold font-mono" style={{ color: levelInfo.color, lineHeight: 1 }}>{levelInfo.level}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>LVL</span>
              </div>
            </div>

            {/* Stats column */}
            <div className="flex-1 min-w-0 space-y-2.5">
              {/* XP bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: levelInfo.color }}>{levelInfo.title}</span>
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{Math.round(xpProgress * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(xpProgress * 100)}%`,
                      background: `linear-gradient(90deg, ${levelInfo.color}88, ${levelInfo.color})`,
                      transition: "width 0.8s ease-out",
                    }}
                  />
                </div>
              </div>

              {/* Streak + Forge row */}
              <div className="flex items-center gap-4">
                {/* Streak */}
                <div className="flex items-center gap-1.5" title={`${streak} day streak`}>
                  <span className="text-sm" style={{ filter: streak > 0 ? "none" : "grayscale(1) opacity(0.4)" }}>🔥</span>
                  <span className="text-sm font-bold font-mono" style={{ color: streak > 0 ? "#f97316" : "rgba(255,255,255,0.2)" }}>{streak}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Streak</span>
                </div>

                {/* Forge Temp */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0" title={forgeInfo.statusMessage}>
                  <span className="text-sm" style={{ filter: forgeTemp > 0 ? "none" : "grayscale(1) opacity(0.4)" }}>🔨</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold" style={{ color: forgeTempColor }}>{forgeTemp}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden mt-0.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${forgeTemp}%`,
                          background: `linear-gradient(90deg, ${forgeTempColor}80, ${forgeTempColor})`,
                          boxShadow: forgeTemp > 60 ? `0 0 4px ${forgeTempColor}80` : "none",
                          transition: "width 0.8s ease-out",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Overall Progress ───────────────────────────────────────── */}
        <div className="px-5 py-2.5">
          <div className="progress-bar-diablo">
            <div
              className="progress-bar-diablo-fill"
              style={{
                width: `${totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%`,
                background: allDone
                  ? "linear-gradient(90deg, #4ade8088, #4ade80, #22c55ecc)"
                  : "linear-gradient(90deg, #818cf888, #818cf8, #a78bfacc)",
              }}
            />
          </div>
        </div>

        {/* ─── Categorized Checklist ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pb-3" style={{ scrollbarWidth: "thin" }}>
          {categories.map(cat => (
            <div key={cat.id} className="mb-3">
              {/* Category header */}
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <span style={{ fontSize: 12 }}>{cat.icon}</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{
                  color: cat.id === "urgent" ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.25)",
                }}>
                  {cat.label}
                </span>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>
                  {cat.items.filter(i => i.done).length}/{cat.items.length}
                </span>
              </div>

              {/* Items */}
              {cat.items.map(item => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  disabled={!item.onClick}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 mb-1 text-left transition-all"
                  style={{
                    background: item.urgent ? "rgba(251,191,36,0.04)" : item.done ? "rgba(74,222,128,0.03)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${item.urgent ? "rgba(251,191,36,0.15)" : item.done ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)"}`,
                    cursor: item.onClick ? "pointer" : "default",
                    opacity: item.done && !item.onClick ? 0.5 : 1,
                  }}
                >
                  {/* Status indicator */}
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{
                    background: item.done ? "rgba(74,222,128,0.15)" : item.urgent ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
                    color: item.done ? "#4ade80" : item.urgent ? "#fbbf24" : "rgba(255,255,255,0.3)",
                    border: `1px solid ${item.done ? "rgba(74,222,128,0.3)" : item.urgent ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
                    fontSize: 10,
                  }}>
                    {item.done ? "✓" : item.urgent ? "!" : "○"}
                  </span>

                  {/* Icon */}
                  <span className="flex-shrink-0" style={{ fontSize: 15 }}>{item.icon}</span>

                  {/* Label + sub + reward */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{
                      color: item.done ? "rgba(255,255,255,0.35)" : item.urgent ? "#fbbf24" : "#e8e8e8",
                      textDecoration: item.done ? "line-through" : "none",
                    }}>
                      {item.label}
                    </p>
                    <div className="flex items-center gap-2">
                      {item.sub && (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>{item.sub}</span>
                      )}
                      {item.reward && !item.done && (
                        <span className="text-xs font-mono" style={{ color: "rgba(167,139,250,0.6)", fontSize: 10 }}>{item.reward}</span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  {item.onClick && !item.done && (
                    <span className="flex-shrink-0 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>›</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ─── Footer ─────────────────────────────────────────────────── */}
        {allDone && (
          <div className="px-5 py-3 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold" style={{ color: "#4ade80" }}>All done for today! The forge rests.</p>
          </div>
        )}
      </div>
    </>
  );
}
