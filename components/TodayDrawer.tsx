"use client";

import { useMemo, useState, useEffect } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getUserLevel, getUserXpProgress } from "@/app/utils";
import { Tip, TipCustom } from "@/components/GameTooltip";
import type { ActiveNpc, Ritual } from "@/app/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Navigate to a view and scroll to a DOM element once it renders */
function navigateAndScroll(
  onNavigate: (view: string) => void,
  onClose: () => void,
  view: string,
  elementId: string,
) {
  onNavigate(view);
  onClose();
  // Poll for the element since the view needs time to render
  let attempts = 0;
  const poll = () => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight flash
      el.style.boxShadow = "0 0 0 2px rgba(129,140,248,0.5)";
      setTimeout(() => { el.style.boxShadow = ""; }, 1500);
      return;
    }
    if (++attempts < 20) requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TodayItem {
  id: string;
  icon: string;       // image path (/images/...) or short text symbol
  label: string;
  done: boolean;
  urgent?: boolean;
  sub?: string;
  reward?: string;
  rewardIcon?: string;
  tooltipKey?: string; // GameTooltip registry key
  onClick?: () => void;
  onClaim?: () => void;  // separate claim action (rendered as button inside card)
}

interface TodayCategory {
  id: string;
  label: string;
  icon: string;       // image path or text symbol
  items: TodayItem[];
}

// ─── Category Tooltip Descriptions ───────────────────────────────────────────

const CATEGORY_TOOLTIPS: Record<string, { title: string; desc: string }> = {
  urgent: { title: "Urgent", desc: "Time-sensitive items that need your attention — unclaimed rewards, expiring content, or milestones ready to collect." },
  daily: { title: "Daily Tasks", desc: "Your core daily routine: claim your bonus, feed your companion, complete rituals, and check daily missions." },
  content: { title: "Active Content", desc: "Ongoing game systems with active progress: quests, challenges, rifts, world boss, dungeons, and NPC quest chains." },
  social: { title: "Social", desc: "Stay connected — pending friend requests, unread messages, and active trades with other players." },
  timers: { title: "Timers", desc: "All active countdowns at a glance — weekly resets, season deadlines, active rifts, and world boss spawns." },
};

// ─── Time-of-day flavor ──────────────────────────────────────────────────────

interface TimeInfo {
  greeting: string;
  icon: string;
  flavor: string;
  bg: string;           // drawer background gradient
  particleColor: string; // floating mote color
  accentGlow: string;    // ambient glow tint
}

function getTimeGreeting(): TimeInfo {
  const h = new Date().getHours();
  if (h < 6) return {
    greeting: "Night Watch", icon: "\u263D",
    flavor: "The halls are quiet. Perfect for focused work.",
    bg: "linear-gradient(180deg, #0a0d1a 0%, #0d1020 40%, #0f1117 100%)",
    particleColor: "rgba(129,140,248,0.5)", accentGlow: "rgba(99,102,241,0.06)",
  };
  if (h < 12) return {
    greeting: "Dawn Patrol", icon: "\u2600",
    flavor: "A new day in Aethermoor. The forge awaits.",
    bg: "linear-gradient(180deg, #1a1410 0%, #15120f 40%, #0f1117 100%)",
    particleColor: "rgba(251,191,36,0.5)", accentGlow: "rgba(251,191,36,0.04)",
  };
  if (h < 17) return {
    greeting: "Afternoon", icon: "\u2694",
    flavor: "The sun is high. Time for quests.",
    bg: "linear-gradient(180deg, #14172199 0%, #0f1117 30%)",
    particleColor: "rgba(232,232,232,0.35)", accentGlow: "rgba(255,255,255,0.03)",
  };
  if (h < 21) return {
    greeting: "Evening", icon: "\u2728",
    flavor: "The day winds down. Wrap up your tasks.",
    bg: "linear-gradient(180deg, #1a1210 0%, #151010 40%, #0f1117 100%)",
    particleColor: "rgba(249,115,22,0.45)", accentGlow: "rgba(249,115,22,0.04)",
  };
  return {
    greeting: "Night Watch", icon: "\u263D",
    flavor: "The halls are quiet. Perfect for focused work.",
    bg: "linear-gradient(180deg, #0a0d1a 0%, #0d1020 40%, #0f1117 100%)",
    particleColor: "rgba(129,140,248,0.5)", accentGlow: "rgba(99,102,241,0.06)",
  };
}

// ─── Floating Particles (CSS-only motes) ─────────────────────────────────────

function FloatingMotes({ color }: { color: string }) {
  const motes = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    id: i,
    left: `${10 + (i * 13) % 80}%`,
    top: `${15 + (i * 17) % 70}%`,
    size: 2 + (i % 3),
    delay: `${i * 1.2}s`,
    duration: `${6 + (i % 4) * 2}s`,
    dx: `${-20 + (i * 7) % 40}px`,
    dy: `${-40 - (i * 11) % 60}px`,
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {motes.map(m => (
        <div
          key={m.id}
          className="absolute rounded-full"
          style={{
            left: m.left, top: m.top,
            width: m.size, height: m.size,
            background: color,
            boxShadow: `0 0 ${m.size * 2}px ${color}`,
            animation: `today-particle-drift ${m.duration} ease-in-out ${m.delay} infinite`,
            "--p-dx": m.dx, "--p-dy": m.dy, "--p-max-opacity": "0.5",
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Night Stars ─────────────────────────────────────────────────────────────

function NightStars() {
  const stars = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: `${5 + (i * 8.3) % 90}%`,
    top: `${3 + (i * 7.1) % 25}%`,
    size: 1 + (i % 2),
    delay: `${i * 0.7}s`,
    duration: `${2 + (i % 3)}s`,
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {stars.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: s.left, top: s.top,
            width: s.size, height: s.size,
            background: "rgba(200,210,255,0.7)",
            animation: `today-star-twinkle ${s.duration} ease-in-out ${s.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Category Divider with traveling light ───────────────────────────────────

function MagicDivider({ color = "rgba(129,140,248,0.3)" }: { color?: string }) {
  const brightColor = color.replace(/[\d.]+\)$/, "0.8)");
  return (
    <div className="relative my-3 mx-2" style={{ height: 1 }}>
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      {/* Traveling light dot — uses translateX animation to slide across */}
      <div
        className="absolute top-0 rounded-full"
        style={{
          width: 20, height: 1,
          background: `linear-gradient(90deg, transparent, ${brightColor}, transparent)`,
          boxShadow: `0 0 6px ${color}`,
          animation: "today-divider-travel 3s linear infinite",
        }}
      />
    </div>
  );
}

// ─── Streak Flame SVG ────────────────────────────────────────────────────────

function StreakFlame({ streak }: { streak: number }) {
  const intensity = Math.min(streak / 30, 1);
  const isHigh = streak >= 14;
  const isEpic = streak >= 30;
  const baseColor = isEpic ? "#818cf8" : isHigh ? "#fbbf24" : "#f97316";
  const tipColor = isEpic ? "#c4b5fd" : isHigh ? "#fde68a" : "#fcd34d";
  const height = 16 + intensity * 8;

  if (streak === 0) return <span style={{ fontSize: 14, filter: "grayscale(1) opacity(0.3)" }}>🔥</span>;

  return (
    <div className="relative" style={{ width: 18, height: 24 }}>
      <svg viewBox="0 0 18 24" width="18" height="24" style={{ animation: "today-flame-flicker 0.8s ease-in-out infinite" }}>
        <defs>
          <linearGradient id="today-flame-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={baseColor} stopOpacity="0.9" />
            <stop offset="60%" stopColor={tipColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor="white" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Outer flame */}
        <path
          d={`M9 ${24 - height} C5 ${24 - height + 4}, 2 ${24 - height / 2}, 4 24 L14 24 C16 ${24 - height / 2}, 13 ${24 - height + 4}, 9 ${24 - height} Z`}
          fill="url(#today-flame-grad)"
          style={{ filter: `drop-shadow(0 0 3px ${baseColor})` }}
        />
        {/* Inner core */}
        <ellipse
          cx="9" cy="20" rx="3" ry={4 + intensity * 2}
          fill={tipColor}
          opacity="0.5"
          style={{ animation: "today-flame-core 0.6s ease-in-out infinite" }}
        />
      </svg>
      {isEpic && <div className="absolute inset-0 rounded-full" style={{
        background: `radial-gradient(circle, ${baseColor}30 0%, transparent 70%)`,
        animation: "today-hero-breathe 2s ease-in-out infinite",
      }} />}
    </div>
  );
}

// ─── Forge Ember Indicator ───────────────────────────────────────────────────

function ForgeEmbers({ temp, color }: { temp: number; color: string }) {
  if (temp < 20) return null;
  const count = Math.min(Math.floor(temp / 20), 5);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            bottom: 0,
            left: `${15 + i * 18}%`,
            width: 2, height: 2,
            background: color,
            boxShadow: `0 0 3px ${color}`,
            animation: `today-ember-rise ${1.5 + i * 0.3}s ease-out ${i * 0.4}s infinite`,
            "--ember-rise": `-${12 + i * 4}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
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
  onClaimMilestone,
  playerLevel,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  playerLevel?: number;
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
  onClaimMilestone?: (threshold: number) => void;
}) {
  const { loggedInUser } = useDashboard();

  // ─── Staggered entry ───────────────────────────────────────────────────
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setEntered(true), 50);
      return () => clearTimeout(t);
    }
    setEntered(false);
  }, [open]);

  // ESC to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  // ─── Hero data ───────────────────────────────────────────────────────────

  const xp = loggedInUser?.xp ?? 0;
  const levelInfo = useMemo(() => getUserLevel(xp), [xp]);
  const xpProgress = useMemo(() => getUserXpProgress(xp), [xp]);
  const forgeTemp = Math.min(loggedInUser?.forgeTemp ?? 0, 100);
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
      icon: "/images/icons/currency-gold.png",
      label: "Daily Bonus",
      done: !dailyBonusAvailable,
      reward: dailyBonusAvailable ? "+Gold, +Stardust" : undefined,
      rewardIcon: "/images/icons/currency-gold.png",
      tooltipKey: "gold",
      onClick: () => { onNavigate("questBoard"); onClose(); },
      onClaim: dailyBonusAvailable ? onClaimDailyBonus : undefined,
    });

    // Companion Pet (2x/day)
    const userComp = loggedInUser?.companion;
    const petsDone = userComp?.petDateStr === today ? (userComp?.petCountToday ?? 0) : 0;
    if (userComp) {
      const compIcon = userComp.type ? `/images/companions/companion-${userComp.type}.png` : "/images/icons/currency-essenz.png";
      daily.push({
        id: "companion-pet",
        icon: compIcon,
        label: `Pet ${userComp.name}`,
        done: petsDone >= 2,
        sub: `${petsDone}/2`,
        reward: "+Bond XP",
        rewardIcon: "/images/icons/currency-essenz.png",
        tooltipKey: "bond_level",
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
      icon: "/images/icons/currency-essenz.png",
      label: "Rituals",
      done: incompleteRituals.length === 0 && rituals.length > 0,
      sub: rituals.length === 0 ? "None set" : `${rituals.length - incompleteRituals.length}/${rituals.length}`,
      reward: rituals.length > 0 ? "+XP, Streak" : undefined,
      rewardIcon: "/images/icons/currency-essenz.png",
      tooltipKey: "rituals",
      onClick: () => { onNavigate("rituals"); onClose(); },
    });

    // Daily Missions — individual mission cards with cross-navigation
    if (dailyMissions) {
      const missionNav: Record<string, { view: string; icon: string; title: string }> = {
        login:  { view: "", icon: "/images/icons/currency-gold.png", title: "" },
        quest1: { view: "questBoard", icon: "/images/icons/equip-weapon.png", title: "Go to Quest Board" },
        quest3: { view: "questBoard", icon: "/images/icons/equip-weapon.png", title: "Go to Quest Board" },
        ritual: { view: "rituals", icon: "/images/icons/currency-essenz.png", title: "Go to Rituals" },
        pet:    { view: "character", icon: "/images/icons/currency-essenz.png", title: "Go to Character" },
        craft:  { view: "forge", icon: "/images/icons/equip-weapon.png", title: "Go to Forge" },
      };
      for (const m of dailyMissions.missions) {
        const nav = missionNav[m.id];
        const item: TodayItem = {
          id: `dm-${m.id}`,
          icon: nav?.icon ?? "/images/icons/currency-stardust.png",
          label: m.label,
          done: m.done,
          sub: `${m.points} pts`,
          reward: m.done ? undefined : `+${m.points}`,
          rewardIcon: "/images/icons/currency-stardust.png",
          tooltipKey: "daily_missions",
          onClick: nav?.view
            ? () => { onNavigate(nav.view); onClose(); }
            : () => navigateAndScroll(onNavigate, onClose, "questBoard", "daily-missions-section"),
        };
        // Login mission gets a separate claim button when daily bonus is available
        if (m.id === "login" && dailyBonusAvailable) {
          item.onClaim = onClaimDailyBonus;
        }
        daily.push(item);
      }

      // Unclaimed milestones → URGENT
      const unclaimedMilestones = dailyMissions.milestones.filter(m => !m.claimed && dailyMissions.earned >= m.threshold);
      if (unclaimedMilestones.length > 0) {
        // Add one card per unclaimed milestone so user can claim directly
        for (const ms of unclaimedMilestones) {
          urgent.push({
            id: `milestone-claim-${ms.threshold}`,
            icon: "/images/icons/currency-stardust.png",
            label: `Claim ${ms.threshold} Milestone`,
            done: false,
            urgent: true,
            sub: Object.entries(ms.reward).map(([k, v]) => `+${v} ${k}`).join(", "),
            reward: "Claim now",
            tooltipKey: "daily_missions",
            onClick: () => navigateAndScroll(onNavigate, onClose, "questBoard", "daily-missions-section"),
            onClaim: onClaimMilestone ? () => onClaimMilestone(ms.threshold) : undefined,
          });
        }
      }
    }

    // Crafting daily bonus
    const lastCraft = (loggedInUser as Record<string, unknown> | null)?.lastCraftDate as string | undefined;
    const craftedToday = lastCraft === today;
    if (loggedInUser?.professions && Object.keys(loggedInUser.professions).length > 0 && (playerLevel ?? 1) >= 5) {
      daily.push({
        id: "crafting-bonus",
        icon: "/images/icons/equip-weapon.png",
        label: "Crafting 2× XP",
        done: craftedToday,
        sub: craftedToday ? "Used" : "Available",
        reward: craftedToday ? undefined : "2× Prof. XP",
        tooltipKey: "professions",
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
        icon: npc.portrait ? `/images/npcs/${npc.portrait}` : "\u2022",
        label: npc.name,
        done: false,
        urgent: true,
        sub: `Leaves in ${hoursLeft}h`,
        tooltipKey: "npc_quest_board",
        onClick: () => { onNavigate("npcBoard"); onClose(); },
      });
    }

    // World Boss (Lv15+)
    if (worldBossActive && (playerLevel ?? 1) >= 15) {
      urgent.push({
        id: "world-boss",
        icon: "/images/icons/ach-boss-slayer.png",
        label: "World Boss Active",
        done: false,
        urgent: true,
        reward: "Unique drops",
        tooltipKey: "world_boss",
        onClick: () => { onNavigate("worldboss"); onClose(); },
      });
    }

    // ── ACTIVE CONTENT ──

    // In-progress quests
    if (inProgressCount > 0) {
      content.push({
        id: "in-progress",
        icon: "/images/icons/equip-weapon.png",
        label: "Quests In Progress",
        done: false,
        sub: `${inProgressCount} active`,
        reward: "+XP, +Gold",
        rewardIcon: "/images/icons/currency-gold.png",
        tooltipKey: "quest_board",
        onClick: () => { onNavigate("questBoard"); onClose(); },
      });
    }

    // Weekly challenge (Lv3+)
    if (weeklyChallenge && (playerLevel ?? 1) >= 3) {
      const starsEarned = weeklyChallenge.stagesCompleted ?? 0;
      content.push({
        id: "weekly-challenge",
        icon: "/images/icons/currency-stardust.png",
        label: "Star Path",
        done: starsEarned >= 3,
        sub: `${starsEarned}/3 stages`,
        reward: starsEarned < 3 ? "Sternentaler" : undefined,
        tooltipKey: "sternenpfad",
        onClick: () => { onNavigate("challenges"); onClose(); },
      });
    }

    // Rift (Lv8+)
    if (riftActive && (playerLevel ?? 1) >= 8) {
      content.push({
        id: "rift-active",
        icon: "/images/icons/currency-runensplitter.png",
        label: "Rift In Progress",
        done: false,
        sub: "Complete your stages",
        reward: "Rift loot",
        tooltipKey: "rift",
        onClick: () => { onNavigate("rift"); onClose(); },
      });
    }

    // Expedition (Lv3+ — same as Challenges)
    if (expeditionActive && (playerLevel ?? 1) >= 3) {
      content.push({
        id: "expedition",
        icon: "/images/icons/ach-marathon-runner.png",
        label: "Expedition",
        done: false,
        sub: "Contribute quests",
        reward: "Group rewards",
        tooltipKey: "expedition",
        onClick: () => { onNavigate("challenges"); onClose(); },
      });
    }

    // Dungeon (Lv12+)
    if (dungeonActive && (playerLevel ?? 1) >= 12) {
      content.push({
        id: "dungeon-active",
        icon: "/images/icons/ach-coop-hero.png",
        label: "Dungeon Run",
        done: false,
        sub: "Collect rewards",
        reward: "Gear, Gems",
        tooltipKey: "dungeons",
        onClick: () => { onNavigate("dungeons"); onClose(); },
      });
    }

    // Vows
    if (vowCount > 0) {
      content.push({
        id: "vows",
        icon: "/images/icons/currency-mondstaub.png",
        label: "Vows",
        done: false,
        sub: `${vowCount} active`,
        reward: "+XP per clean day",
        tooltipKey: "vows",
        onClick: () => { onNavigate("vows"); onClose(); },
      });
    }

    // ── SOCIAL ──

    if (socialBadge) {
      if (socialBadge.pendingFriendRequests > 0) {
        social.push({
          id: "friend-requests",
          icon: "/images/icons/ach-social-butterfly.png",
          label: "Friend Requests",
          done: false,
          urgent: true,
          sub: `${socialBadge.pendingFriendRequests} pending`,
          tooltipKey: "breakaway",
          onClick: () => { onNavigate("social"); onClose(); },
        });
      }
      if (socialBadge.activeTrades > 0) {
        social.push({
          id: "active-trades",
          icon: "/images/icons/currency-gildentaler.png",
          label: "Open Trades",
          done: false,
          sub: `${socialBadge.activeTrades} active`,
          tooltipKey: "trading",
          onClick: () => { onNavigate("social"); onClose(); },
        });
      }
      if (socialBadge.unreadMessages > 0) {
        social.push({
          id: "unread-messages",
          icon: "/images/icons/ach-social-king.png",
          label: "Unread Messages",
          done: false,
          sub: `${socialBadge.unreadMessages} new`,
          tooltipKey: "breakaway",
          onClick: () => { onNavigate("social"); onClose(); },
        });
      }
    }

    // Build categories array (skip empty categories)
    const cats: TodayCategory[] = [];
    if (urgent.length > 0) cats.push({ id: "urgent", label: "Urgent", icon: "\u26A0", items: urgent });
    if (daily.length > 0) cats.push({ id: "daily", label: "Daily Tasks", icon: "\u2726", items: daily });
    if (content.length > 0) cats.push({ id: "content", label: "Active Content", icon: "\u2694", items: content });
    if (social.length > 0) cats.push({ id: "social", label: "Social", icon: "\u2606", items: social });

    // ─── Timers category (Calendar/Reset Widget) ──────────────────────────────
    const timers: TodayItem[] = [];
    // Weekly reset (next Monday 00:00)
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
    nextMonday.setHours(0, 0, 0, 0);
    const weeklyMs = nextMonday.getTime() - Date.now();
    const weeklyDays = Math.floor(weeklyMs / 86400000);
    const weeklyHours = Math.floor((weeklyMs % 86400000) / 3600000);
    timers.push({ id: "timer-weekly", icon: "/images/icons/currency-runensplitter.png", label: "Weekly Reset", done: false, sub: `${weeklyDays}d ${weeklyHours}h` });
    // Battle Pass season (estimate: 90-day seasons from March 1)
    const bpEpoch = new Date("2026-03-01T00:00:00Z").getTime();
    const bpDuration = 90 * 86400000;
    const bpElapsed = (Date.now() - bpEpoch) % bpDuration;
    const bpRemaining = bpDuration - bpElapsed;
    const bpDays = Math.floor(bpRemaining / 86400000);
    timers.push({ id: "timer-bp", icon: "/images/icons/currency-stardust.png", label: "Season Ends", done: false, sub: `${bpDays}d remaining` });
    // World boss (Lv15+)
    if (worldBossActive && (playerLevel ?? 1) >= 15) {
      timers.push({ id: "timer-wb", icon: "/images/icons/ach-boss-slayer.png", label: "World Boss Active", done: false, sub: "Contribute now", urgent: true, onClick: () => { onNavigate("worldboss"); onClose(); } });
    }
    // Active rift (Lv8+)
    if (riftActive && (playerLevel ?? 1) >= 8) {
      timers.push({ id: "timer-rift", icon: "/images/icons/currency-runensplitter.png", label: "Rift Active", done: false, sub: "In progress", urgent: true, onClick: () => { onNavigate("rift"); onClose(); } });
    }
    if (timers.length > 0) cats.push({ id: "timers", label: "Timers", icon: "\u23F0", items: timers });
    return cats;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyBonusAvailable, dailyMissions, rituals, activeNpcs, loggedInUser, inProgressCount, weeklyChallenge, worldBossActive, riftActive, vowCount, socialBadge, expeditionActive, dungeonActive, today, playerLevel]);

  const allItems = categories.flatMap(c => c.items);
  const doneCount = allItems.filter(i => i.done).length;
  const totalCount = allItems.length;
  const allDone = doneCount === totalCount && totalCount > 0;

  const comp = loggedInUser?.companion;

  // Companion portrait (same logic as UserCard)
  const companionSrc = useMemo(() => {
    if (!comp) return "";
    if (comp.type && ["dragon", "owl", "phoenix", "wolf", "fox", "bear"].includes(comp.type))
      return `/images/portraits/companion-${comp.type}.png`;
    if (comp.type === "cat" && comp.name?.toLowerCase() === "dobbie")
      return "/images/portraits/companion-dobbie.png";
    if (comp.type) return `/images/companions/companion-${comp.type}.png`;
    return "";
  }, [comp]);

  if (!open) return null;

  // ─── Level ring SVG params ─────────────────────────────────────────────

  const ringRadius = 28;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - xpProgress);

  const isNight = new Date().getHours() < 6 || new Date().getHours() >= 21;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 z-[91] h-full flex flex-col"
        style={{
          width: "min(95vw, 720px)",
          background: timeInfo.bg,
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.7)",
          animation: "today-drawer-in 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Ambient particles layer */}
        <FloatingMotes color={timeInfo.particleColor} />
        {isNight && <NightStars />}

        {/* ─── Header + Task Arc ────────────────────────────────────── */}
        <div className="relative px-5 pt-4 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 1 }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <span className="text-base">{timeInfo.icon}</span>
              <div>
                <span className="text-sm font-bold" style={{ color: "#e8e8e8" }}>{timeInfo.greeting}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs btn-interactive"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)", lineHeight: 1.4 }}>{timeInfo.flavor}</p>

          {/* Task Arc — compact, centered in header */}
          <div className="relative flex justify-center mt-1" style={{ marginBottom: -4 }}>
            <TipCustom title="Tasks Today" accent="#818cf8" hoverDelay={500} align="center"
              body={<>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Your daily checklist progress.</p>
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between mt-1 text-xs">
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>{cat.label}</span>
                    <span className="font-mono" style={{ color: cat.items.every(i => i.done) ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
                      {cat.items.filter(i => i.done).length}/{cat.items.length}
                    </span>
                  </div>
                ))}
              </>}
            >
              <svg width="160" height="80" viewBox="0 0 160 80" className="cursor-help">
                <path d="M 16 65 A 64 64 0 0 1 144 65" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" strokeLinecap="round" />
                <path d="M 16 65 A 64 64 0 0 1 144 65" fill="none" stroke={allDone ? "#4ade80" : "#818cf8"} strokeWidth="5" strokeLinecap="round"
                  strokeDasharray="201" strokeDashoffset={201 * (1 - (totalCount > 0 ? doneCount / totalCount : 0))}
                  style={{ transition: "stroke-dashoffset 0.8s ease-out", filter: `drop-shadow(0 0 3px ${allDone ? "rgba(74,222,128,0.4)" : "rgba(129,140,248,0.3)"})` }}
                />
                <text x="80" y="55" textAnchor="middle" fill={allDone ? "#4ade80" : "#e8e8e8"} fontSize="14" fontWeight="bold" fontFamily="monospace">{doneCount}/{totalCount}</text>
                <text x="80" y="68" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="9">{allDone ? "ALL COMPLETE" : "tasks today"}</text>
                {categories.map((cat, ci) => {
                  const catDone = cat.items.filter(i => i.done).length === cat.items.length;
                  const angle = -180 + ((ci + 0.5) / categories.length) * 180;
                  const rad = (angle * Math.PI) / 180;
                  const cx = 80 + 64 * Math.cos(rad);
                  const cy = 65 + 64 * Math.sin(rad);
                  return <circle key={cat.id} cx={cx} cy={cy} r="2.5" fill={catDone ? "#4ade80" : cat.id === "urgent" ? "#fbbf24" : "rgba(255,255,255,0.15)"} style={{ transition: "fill 0.3s", filter: catDone ? "drop-shadow(0 0 3px rgba(74,222,128,0.5))" : "none" }} />;
                })}
              </svg>
            </TipCustom>
          </div>
        </div>

        {/* ─── Hero Section: Horizontal layout ─────────────────────── */}
        <div className="relative px-5 pt-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 1 }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(ellipse at 50% 40%, ${timeInfo.accentGlow} 0%, transparent 70%)`,
            animation: "today-hero-breathe 4s ease-in-out infinite",
          }} />

          {/* Row: Streak | Companion + Level + XP | Forge */}
          <div className="flex items-center gap-3 relative" style={{ zIndex: 1 }}>
            {/* Streak Card — left */}
            <Tip k="streak"><div
              className="today-stat-card rounded-xl px-4 py-2.5 relative overflow-hidden"
              role="button"
              tabIndex={0}
              title="Go to Rituals"
              onClick={() => { onNavigate("rituals"); onClose(); }}
              onKeyDown={e => { if (e.key === "Enter") { onNavigate("rituals"); onClose(); } }}
              style={{ minWidth: 100, cursor: "pointer",
              background: streak > 0 ? "linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(251,191,36,0.04) 100%)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${streak > 0 ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)"}`,
              boxShadow: streak > 7 ? "inset 0 1px 0 rgba(249,115,22,0.1)" : "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}>
              <div className="flex items-center gap-2">
                <StreakFlame streak={streak} />
                <div>
                  <span className="text-lg font-bold font-mono" style={{ color: streak > 0 ? "#f97316" : "rgba(255,255,255,0.2)" }}>{streak}</span>
                  <span className="text-xs block" style={{ color: "rgba(255,255,255,0.25)", marginTop: -2 }}>Streak <span style={{ fontSize: 12, opacity: 0.5 }}>→</span></span>
                </div>
              </div>
            </div></Tip>

            {/* Center: Companion + Level Ring + XP */}
            <div
              className="flex-1 flex flex-col items-center min-w-0"
              role="button"
              tabIndex={0}
              title="Go to Character"
              onClick={() => { onNavigate("character"); onClose(); }}
              onKeyDown={e => { if (e.key === "Enter") { onNavigate("character"); onClose(); } }}
              style={{ cursor: "pointer" }}
            >
              <div className="flex items-center gap-3">
                {/* Companion Avatar — bigger */}
                {comp && (
                  <button
                    onClick={() => { onNavigate("questBoard"); onClose(); }}
                    className="relative flex-shrink-0 rounded-full today-stat-card"
                    style={{
                      width: 52, height: 52, cursor: "pointer",
                      border: `2px solid rgba(251,191,36,${comp.bondLevel && comp.bondLevel >= 3 ? "0.4" : "0.15"})`,
                      boxShadow: comp.bondLevel && comp.bondLevel >= 5 ? "0 0 8px rgba(251,191,36,0.2)" : "none",
                    }}
                    title={`${comp.name} (Bond ${comp.bondLevel ?? 1})`}
                  >
                    <span className="block w-full h-full rounded-full overflow-hidden">
                    {companionSrc ? (
                      <img src={companionSrc} alt={comp.name} width={52} height={52} className="w-full h-full object-cover" style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-xl" style={{ color: "rgba(255,255,255,0.4)" }}>{comp.name?.[0] || "?"}</span>
                    )}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 text-xs rounded-full flex items-center justify-center"
                      style={{ width: 16, height: 16, fontSize: 12, background: "rgba(251,191,36,0.9)", color: "#000", fontWeight: 800 }}>
                      {comp.bondLevel ?? 1}
                    </span>
                  </button>
                )}
                {/* Level Ring */}
                <div className="relative flex-shrink-0" style={{ width: 68, height: 68, "--ring-color": levelInfo.color } as React.CSSProperties}>
                  <svg width="68" height="68" viewBox="0 0 76 76" className="absolute inset-0" style={{ animation: "today-ring-glow 3s ease-in-out infinite", "--ring-color": levelInfo.color } as React.CSSProperties}>
                    <circle cx="38" cy="38" r="35" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    <circle cx="38" cy="38" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4.5" />
                    <circle cx="38" cy="38" r={ringRadius} fill="none" stroke={levelInfo.color} strokeWidth="4.5" strokeLinecap="round"
                      strokeDasharray={ringCircumference} strokeDashoffset={ringOffset} transform="rotate(-90 38 38)"
                      style={{ transition: "stroke-dashoffset 0.8s ease-out" }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold font-mono" style={{ color: levelInfo.color, lineHeight: 1 }}>{levelInfo.level}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>LVL</span>
                  </div>
                </div>
              </div>
              {/* XP percentage text */}
              <div className="mt-1.5 text-center">
                <span className="text-xs font-semibold" style={{ color: levelInfo.color, fontSize: 12 }}>{levelInfo.title}</span>
                <span className="text-xs font-mono ml-1.5" style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{Math.round(xpProgress * 100)}% XP</span>
              </div>
            </div>

            {/* Forge Temp Card — right (Lv5+ only) */}
            {(playerLevel ?? 1) >= 5 && (
            <>
            <Tip k="forge_temp"><div
              className="today-stat-card rounded-xl px-4 py-2.5 relative overflow-hidden"
              role="button"
              tabIndex={0}
              title="Go to Forge"
              onClick={() => { onNavigate("forge"); onClose(); }}
              onKeyDown={e => { if (e.key === "Enter") { onNavigate("forge"); onClose(); } }}
              style={{ minWidth: 100, cursor: "pointer",
              background: forgeTemp > 0 ? `linear-gradient(135deg, ${forgeTempColor}10 0%, ${forgeTempColor}05 100%)` : "rgba(255,255,255,0.02)",
              border: `1px solid ${forgeTemp > 0 ? `${forgeTempColor}25` : "rgba(255,255,255,0.04)"}`,
              boxShadow: forgeTemp > 60 ? `inset 0 1px 0 ${forgeTempColor}15` : "inset 0 1px 0 rgba(255,255,255,0.04)",
              animation: forgeTemp >= 80 ? "today-forge-pulse 2s ease-in-out infinite" : "none",
              "--forge-color": forgeTempColor,
            } as React.CSSProperties}>
              <ForgeEmbers temp={forgeTemp} color={forgeTempColor} />
              <div className="flex items-center gap-2 relative" style={{ zIndex: 1 }}>
                <span className="text-sm" style={{ filter: forgeTemp > 0 ? "none" : "grayscale(1) opacity(0.4)", fontFamily: "serif" }}>{"\u2692"}</span>
                <div className="min-w-0">
                  <span className="text-sm font-mono font-bold" style={{ color: forgeTempColor }}>{forgeTemp}%</span>
                  <div className="h-1 rounded-full overflow-hidden mt-0.5" style={{ background: "rgba(255,255,255,0.06)", width: 50 }}>
                    <div className="h-full rounded-full" style={{
                      width: `${forgeTemp}%`,
                      background: `linear-gradient(90deg, ${forgeTempColor}80, ${forgeTempColor})`,
                      transition: "width 0.8s ease-out",
                    }} />
                  </div>
                  <span className="text-xs block mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Forge <span style={{ fontSize: 12, opacity: 0.5 }}>→</span></span>
                </div>
              </div>
            </div></Tip>
            </>
            )}
          </div>
        </div>

        {/* ─── Categorized Card Grid ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pb-3 relative today-scroll" style={{ zIndex: 1 }}>
          {categories.map((cat, catIdx) => {
            const catAllDone = cat.items.every(i => i.done);
            return (
              <div key={cat.id}>
                {catIdx > 0 && <MagicDivider />}

                {/* Category header */}
                <div className="flex items-center gap-1.5 mb-2 px-1" style={{
                  animation: entered ? `today-card-enter 0.3s ease-out ${catIdx * 80}ms both` : "none",
                }}>
                  <span style={{ fontSize: 13 }}>{cat.icon}</span>
                  {CATEGORY_TOOLTIPS[cat.id] ? (
                    <TipCustom title={CATEGORY_TOOLTIPS[cat.id].title} accent={cat.id === "urgent" ? "#fbbf24" : "#818cf8"} body={<p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{CATEGORY_TOOLTIPS[cat.id].desc}</p>}>
                      <span className="text-xs font-bold uppercase tracking-widest cursor-help" style={{
                        color: cat.id === "urgent" ? "rgba(251,191,36,0.7)" : catAllDone ? "rgba(74,222,128,0.5)" : "rgba(255,255,255,0.3)",
                        borderBottom: "1px dotted rgba(255,255,255,0.15)",
                      }}>
                        {cat.label}
                      </span>
                    </TipCustom>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-widest" style={{
                      color: cat.id === "urgent" ? "rgba(251,191,36,0.7)" : catAllDone ? "rgba(74,222,128,0.5)" : "rgba(255,255,255,0.3)",
                    }}>
                      {cat.label}
                    </span>
                  )}
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>
                    {cat.items.filter(i => i.done).length}/{cat.items.length}
                  </span>
                  {catAllDone && <span className="text-xs" style={{ color: "#4ade80" }}>✓</span>}
                </div>

                {/* 2-Column Card Grid */}
                <div className="grid grid-cols-3 gap-2 mb-1">
                  {cat.items.map((item, itemIdx) => (
                    <button
                      key={item.id}
                      onClick={() => { item.onClick?.(); }}
                      disabled={!item.onClick}
                      className="today-item-card rounded-xl p-3 text-left flex flex-col gap-1.5"
                      style={{
                        background: item.urgent
                          ? "linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(251,191,36,0.02) 100%)"
                          : item.done
                          ? "linear-gradient(135deg, rgba(74,222,128,0.04) 0%, rgba(74,222,128,0.01) 100%)"
                          : "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                        border: `1px solid ${item.urgent ? "rgba(251,191,36,0.18)" : item.done ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)"}`,
                        boxShadow: item.urgent
                          ? "inset 0 1px 0 rgba(251,191,36,0.06)"
                          : "inset 0 1px 0 rgba(255,255,255,0.03)",
                        cursor: item.onClick ? "pointer" : item.done ? "default" : "not-allowed",
                        opacity: item.done && !item.onClick ? 0.55 : 1,
                        animation: entered
                          ? `today-card-enter 0.3s ease-out ${catIdx * 80 + (itemIdx + 1) * 50}ms both${item.urgent ? ", today-urgent-pulse 2.5s ease-in-out infinite" : ""}`
                          : item.urgent ? "today-urgent-pulse 2.5s ease-in-out infinite" : "none",
                      }}
                    >
                      {/* Top row: icon + status */}
                      <div className="flex items-center justify-between">
                        {item.icon.startsWith("/") ? (
                          <img src={item.icon} alt="" width={20} height={20} className="img-render-auto flex-shrink-0" onError={e => { e.currentTarget.style.display = "none"; }} />
                        ) : (
                          <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                        )}
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{
                          background: item.done ? "rgba(74,222,128,0.15)" : item.urgent ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
                          color: item.done ? "#4ade80" : item.urgent ? "#fbbf24" : "rgba(255,255,255,0.3)",
                          border: `1px solid ${item.done ? "rgba(74,222,128,0.3)" : item.urgent ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
                          fontSize: 12, fontWeight: 700,
                          animation: item.done ? "today-check-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" : "none",
                        }}>
                          {item.done ? "✓" : item.urgent ? "!" : "○"}
                        </span>
                      </div>

                      {/* Label */}
                      <p className="text-xs font-semibold leading-tight" style={{
                        color: item.done ? "rgba(255,255,255,0.35)" : item.urgent ? "#fbbf24" : "#e8e8e8",
                        textDecoration: item.done ? "line-through" : "none",
                        textDecorationColor: "rgba(74,222,128,0.3)",
                      }}>
                        {item.tooltipKey ? <Tip k={item.tooltipKey}>{item.label}</Tip> : item.label}
                      </p>

                      {/* Sub + Reward row */}
                      <div className="flex items-center justify-between mt-auto">
                        {item.sub && (
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>{item.sub}</span>
                        )}
                        {item.reward && !item.done && !item.onClaim && (
                          <span className="text-xs font-mono flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{
                            background: "rgba(167,139,250,0.08)",
                            color: "rgba(167,139,250,0.7)",
                            fontSize: 12,
                            border: "1px solid rgba(167,139,250,0.1)",
                          }}>
                            {item.rewardIcon && (
                              <img src={item.rewardIcon} alt="" width={10} height={10} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} />
                            )}
                            {item.reward}
                          </span>
                        )}
                        {!item.sub && !item.reward && !item.onClaim && <span />}
                      </div>

                      {/* Claim button (separate from card navigation) */}
                      {item.onClaim && !item.done && (
                        <button
                          onClick={(e) => { e.stopPropagation(); item.onClaim?.(); }}
                          className="w-full mt-1 py-1.5 rounded-lg text-xs font-bold"
                          style={{
                            background: item.urgent
                              ? "linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(251,191,36,0.1) 100%)"
                              : "linear-gradient(135deg, rgba(255,68,68,0.2) 0%, rgba(255,68,68,0.1) 100%)",
                            color: item.urgent ? "#fbbf24" : "#ff4444",
                            border: `1px solid ${item.urgent ? "rgba(251,191,36,0.3)" : "rgba(255,68,68,0.3)"}`,
                            cursor: "pointer",
                          }}
                        >
                          {item.urgent ? "Claim!" : "Claim"}
                        </button>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Footer ─────────────────────────────────────────────────── */}
        {allDone && (
          <div className="relative px-5 py-4 text-center overflow-hidden" style={{ borderTop: "1px solid rgba(74,222,128,0.1)", zIndex: 1 }}>
            {/* Celebration burst */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="absolute rounded-full" style={{
                width: 80, height: 80,
                background: "radial-gradient(circle, rgba(74,222,128,0.15) 0%, transparent 70%)",
                animation: "today-done-burst 2s ease-out infinite",
              }} />
            </div>
            {/* Confetti dots */}
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 4, height: 4,
                  left: "50%", top: "50%",
                  background: ["#4ade80", "#fbbf24", "#818cf8", "#f97316", "#ec4899", "#22d3ee"][i],
                  animation: `today-done-confetti 1.5s ease-out ${i * 0.15}s infinite`,
                  "--cx": `${-30 + i * 12}px`,
                  "--cy": `${-20 - (i % 3) * 10}px`,
                  "--cr": `${i * 60}deg`,
                } as React.CSSProperties}
              />
            ))}
            <p className="relative text-xs font-bold" style={{ color: "#4ade80" }}>
              All done for today! The forge rests.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
