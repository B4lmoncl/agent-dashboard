import { useState, useEffect, useRef } from "react";
import type {
  Agent, Quest, QuestsData, User, Campaign, AchievementDef,
  AchievementPointMilestone,
  ClassDef, LeaderboardEntry, Ritual, Habit, ChangelogEntry,
  WeeklyChallenge, Expedition,
} from "@/app/types";

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export async function fetchAgents(): Promise<Agent[]> {
  try {
    const r = await fetch(`/api/agents`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* API not running */ }
  try {
    const r = await fetch(`/data/agents.json`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }
  } catch { /* ignore */ }
  return [];
}

export async function fetchQuests(playerName?: string): Promise<QuestsData> {
  const empty: QuestsData = { open: [], inProgress: [], completed: [], suggested: [], rejected: [], locked: [] };
  try {
    const url = playerName ? `/api/quests?player=${encodeURIComponent(playerName)}` : `/api/quests`;
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const data = await r.json();
      return { ...empty, ...data };
    }
  } catch { /* ignore */ }
  try {
    const r = await fetch(`/data/quests.json`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const data = await r.json();
      return data && !Array.isArray(data) ? { ...empty, ...data } : empty;
    }
  } catch { /* ignore */ }
  return empty;
}

export async function fetchUsers(): Promise<User[]> {
  try {
    const r = await fetch(`/api/users`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* API not running */ }
  return [];
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  try {
    const r = await fetch(`/api/campaigns`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* ignore */ }
  return [];
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const r = await fetch(`/api/leaderboard`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* ignore */ }
  return [];
}

export async function fetchAchievementCatalogue(): Promise<{ achievements: AchievementDef[]; pointMilestones: AchievementPointMilestone[] }> {
  try {
    const r = await fetch(`/api/achievements`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const data = await r.json();
      // Handle both old (array) and new (object) response formats
      if (Array.isArray(data)) return { achievements: data, pointMilestones: [] };
      return { achievements: data.achievements || [], pointMilestones: data.pointMilestones || [] };
    }
  } catch { /* ignore */ }
  return { achievements: [], pointMilestones: [] };
}

export async function fetchRituals(playerName: string): Promise<Ritual[]> {
  try {
    const r = await fetch(`/api/rituals?player=${encodeURIComponent(playerName)}`, { signal: AbortSignal.timeout(2000), cache: "no-store" });
    if (r.ok) {
      const all: Ritual[] = await r.json();
      return all.filter(r => !r.isAntiRitual);
    }
  } catch { /* ignore */ }
  return [];
}

export async function fetchHabits(playerName: string): Promise<Habit[]> {
  try {
    const r = await fetch(`/api/habits?player=${encodeURIComponent(playerName)}`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* ignore */ }
  return [];
}

export async function fetchChangelog(): Promise<ChangelogEntry[]> {
  try {
    const r = await fetch(`/api/changelog`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const data = await r.json();
      return Array.isArray(data.entries) ? data.entries : [];
    }
  } catch { /* ignore */ }
  return [];
}

// ─── Batch dashboard fetch (reduces 14 API calls to 1) ─────────────────────
export async function fetchDashboard(playerName?: string): Promise<{
  agents: Agent[];
  quests: QuestsData;
  users: User[];
  achievements: AchievementDef[];
  campaigns: Campaign[];
  rituals: Ritual[];
  habits: Habit[];
  favorites: string[];
  activeNpcs: any[];
  dailyBonusAvailable?: boolean;
  weeklyChallenge?: WeeklyChallenge | null;
  expedition?: Expedition | null;
  socialSummary?: { pendingFriendRequests: number; unreadMessages: number; activeTrades: number } | null;
  dailyMissions?: { missions: { id: string; label: string; points: number; done: boolean }[]; earned: number; total: number; milestones: { threshold: number; reward: Record<string, number>; claimed: boolean }[] } | null;
  worldBossActive?: boolean;
  riftActive?: boolean;
  dungeonActive?: boolean;
  notifications?: Record<string, number> | null;
  apiLive: boolean;
} | null> {
  try {
    const url = playerName
      ? `/api/dashboard?player=${encodeURIComponent(playerName)}`
      : `/api/dashboard`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (r.ok) return r.json();
  } catch { /* API not running */ }
  return null;
}

export async function createStarterQuestsIfNew(playerName: string, apiKey: string) {
  try {
    const { getAuthHeaders } = await import("@/lib/auth-client");
    const key = `starter_quests_${playerName.toLowerCase()}`;
    if (localStorage.getItem(key) === "true") return;
    localStorage.setItem(key, "true");
    const headers = { "Content-Type": "application/json", ...getAuthHeaders(apiKey) };
    const starterQuests = [
      { title: "x Welcome to the Guild!", description: "Complete this quest to earn your first companion — Dobbie the Cat! Just click 'Complete' to claim your reward. This teaches you the claim → complete flow.", type: "personal", priority: "high", createdBy: "system" },
      { title: "x Organize Your Desk", description: "Tidy up your workspace. A clear desk leads to a clear mind!", type: "personal", priority: "low", createdBy: "system" },
      { title: "x Read for 30 Minutes", description: "Pick any book, article, or topic you're curious about and read for 30 minutes.", type: "learning", priority: "low", createdBy: "system" },
      { title: "x 10-Minute Stretch", description: "Do a short stretching routine to warm up and get your body moving!", type: "fitness", priority: "low", createdBy: "system" },
    ];
    await Promise.all(starterQuests.map(q =>
      fetch("/api/quest", { method: "POST", headers, body: JSON.stringify(q), signal: AbortSignal.timeout(5000) })
    ));
  } catch { /* ignore */ }
}

// ─── Time helper ──────────────────────────────────────────────────────────────

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function useCountUp(target: number, decimals = 0, duration = 1000): string {
  const [display, setDisplay] = useState("0");
  const prevRef = useRef(-1);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevRef.current === target) return;
    const from = prevRef.current < 0 ? 0 : prevRef.current;
    prevRef.current = target;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setDisplay((from + (target - from) * eased).toFixed(decimals));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, decimals, duration]);
  return display;
}

// ─── Season helpers ───────────────────────────────────────────────────────────

export function getSeason() {
  const m = new Date().getMonth(); // 0=Jan
  if (m >= 2 && m <= 4) return { name: "Spring", icon: "", color: "#ec4899", bg: "rgba(236,72,153,0.1)", particle: "rgba(255,182,193," };
  if (m >= 5 && m <= 7) return { name: "Summer", icon: "", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", particle: "rgba(255,220,100," };
  if (m >= 8 && m <= 10) return { name: "Autumn", icon: "", color: "#f97316", bg: "rgba(249,115,22,0.1)", particle: "rgba(255,140,50," };
  return { name: "Winter", icon: "", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", particle: "rgba(180,220,255," };
}
export const CURRENT_SEASON = getSeason();

// ─── XP / Level helpers — 50-level system ────────────────────────────────────

export const GUILD_LEVELS = [
  { level: 1,  title: "Forge Initiate",       xpRequired: 0,       color: "#9ca3af" },
  { level: 2,  title: "Anvil Striker",         xpRequired: 50,      color: "#9ca3af" },
  { level: 3,  title: "Coal Tender",           xpRequired: 150,     color: "#9ca3af" },
  { level: 4,  title: "Iron Apprentice",       xpRequired: 300,     color: "#9ca3af" },
  { level: 5,  title: "Flame Keeper",          xpRequired: 500,     color: "#22c55e" },
  { level: 6,  title: "Bronze Shaper",         xpRequired: 800,     color: "#22c55e" },
  { level: 7,  title: "Steel Crafter",         xpRequired: 1200,    color: "#22c55e" },
  { level: 8,  title: "Glyph Carver",          xpRequired: 1700,    color: "#22c55e" },
  { level: 9,  title: "Rune Binder",           xpRequired: 2400,    color: "#22c55e" },
  { level: 10, title: "Ironclad Journeyman",   xpRequired: 3300,    color: "#f59e0b" },
  { level: 11, title: "Forge Adept",           xpRequired: 4500,    color: "#3b82f6" },
  { level: 12, title: "Silver Tempered",       xpRequired: 6000,    color: "#3b82f6" },
  { level: 13, title: "Ember Warden",          xpRequired: 7800,    color: "#3b82f6" },
  { level: 14, title: "Mithral Seeker",        xpRequired: 10000,   color: "#3b82f6" },
  { level: 15, title: "Flame Warden",          xpRequired: 12500,   color: "#3b82f6" },
  { level: 16, title: "Knight of the Forge",   xpRequired: 15500,   color: "#6366f1" },
  { level: 17, title: "Obsidian Blade",        xpRequired: 19000,   color: "#6366f1" },
  { level: 18, title: "Ashbound Knight",       xpRequired: 23000,   color: "#6366f1" },
  { level: 19, title: "Dawnsteel Sentinel",    xpRequired: 27500,   color: "#6366f1" },
  { level: 20, title: "Ironforged Champion",   xpRequired: 32500,   color: "#ef4444" },
  { level: 21, title: "Void Temperer",         xpRequired: 38500,   color: "#a855f7" },
  { level: 22, title: "Stormhammer",           xpRequired: 45000,   color: "#a855f7" },
  { level: 23, title: "Skyforgeling",          xpRequired: 52000,   color: "#a855f7" },
  { level: 24, title: "Dragon Tempered",       xpRequired: 60000,   color: "#a855f7" },
  { level: 25, title: "Master Artificer",      xpRequired: 69000,   color: "#ec4899" },
  { level: 26, title: "Grandmaster Smith",     xpRequired: 79000,   color: "#ec4899" },
  { level: 27, title: "Forge Sovereign",       xpRequired: 90000,   color: "#ec4899" },
  { level: 28, title: "Mythic Hammerborn",     xpRequired: 102000,  color: "#fbbf24" },
  { level: 29, title: "Legendary Smelter",     xpRequired: 115000,  color: "#fbbf24" },
  { level: 30, title: "Archmage of the Forge", xpRequired: 130000,  color: "#ffffff" },
  { level: 31, title: "Radiant Forgemaster",   xpRequired: 148000,  color: "#38bdf8" },
  { level: 32, title: "Celestial Anvil",       xpRequired: 168000,  color: "#38bdf8" },
  { level: 33, title: "Starbinder",            xpRequired: 190000,  color: "#38bdf8" },
  { level: 34, title: "Voidsteel Warden",      xpRequired: 215000,  color: "#38bdf8" },
  { level: 35, title: "Etherforged",           xpRequired: 243000,  color: "#2dd4bf" },
  { level: 36, title: "Shardbearer",           xpRequired: 274000,  color: "#2dd4bf" },
  { level: 37, title: "Runic Overlord",        xpRequired: 308000,  color: "#2dd4bf" },
  { level: 38, title: "Astral Hammersmith",    xpRequired: 346000,  color: "#2dd4bf" },
  { level: 39, title: "Primordial Smith",      xpRequired: 388000,  color: "#2dd4bf" },
  { level: 40, title: "Herald of the Forge",   xpRequired: 435000,  color: "#f472b6" },
  { level: 41, title: "Stormforged Ascendant", xpRequired: 488000,  color: "#f472b6" },
  { level: 42, title: "Keeper of Embers",      xpRequired: 547000,  color: "#f472b6" },
  { level: 43, title: "Titan Shaper",          xpRequired: 613000,  color: "#f472b6" },
  { level: 44, title: "Worldanvil",            xpRequired: 686000,  color: "#f472b6" },
  { level: 45, title: "Soulforge Sentinel",    xpRequired: 768000,  color: "#fbbf24" },
  { level: 46, title: "Eternal Crucible",      xpRequired: 860000,  color: "#fbbf24" },
  { level: 47, title: "Mythweaver",            xpRequired: 963000,  color: "#fbbf24" },
  { level: 48, title: "Archon of Steel",       xpRequired: 1078000, color: "#fbbf24" },
  { level: 49, title: "Forgeborn Paragon",     xpRequired: 1208000, color: "#fbbf24" },
  { level: 50, title: "Windrunner's Equal",    xpRequired: 1355000, color: "#ffffff" },
];

export function getUserLevel(xp: number) {
  let current = GUILD_LEVELS[0];
  for (const l of GUILD_LEVELS) { if (xp >= l.xpRequired) current = l; else break; }
  return current;
}

// Keep backward compat alias
export const USER_LEVELS = GUILD_LEVELS.map(l => ({ name: l.title, min: l.xpRequired, max: GUILD_LEVELS[l.level] ? GUILD_LEVELS[l.level].xpRequired - 1 : Infinity, color: l.color, level: l.level }));

export function getUserXpProgress(xp: number) {
  const l = getUserLevel(xp);
  const next = GUILD_LEVELS[l.level]; // level is 1-based, array is 0-based so this is next level
  if (!next) return 1;
  return (xp - l.xpRequired) / (next.xpRequired - l.xpRequired);
}

// ─── Forge Temperature helpers ────────────────────────────────────────────────

export function getForgeTempInfo(temp: number): { statusMessage: string; actionSuggestion: string; tooltipText: string } {
  const baseTooltip = "Forge Temperature: The hotter the forge, the better your crafting results. Higher temperature = more Gold multiplier (up to 1.5×). Temperature drops automatically over time — complete quests to keep it up. At 0% you receive an XP penalty.";
  if (temp === 100) return {
    statusMessage: "The forge burns white-hot — you are unstoppable",
    actionSuggestion: "Peak reached! Every completed quest maintains this temperature.",
    tooltipText: baseTooltip,
  };
  if (temp >= 80) return {
    statusMessage: "The forge roars — your hammer strikes true",
    actionSuggestion: "Near maximum. One or two more quests will bring the forge to white heat.",
    tooltipText: baseTooltip,
  };
  if (temp >= 60) return {
    statusMessage: "The forge glows steadily — the rhythm of a craftsman",
    actionSuggestion: "Good rhythm! Keep the forge running with completed quests.",
    tooltipText: baseTooltip,
  };
  if (temp >= 40) return {
    statusMessage: "The forge is cooling — the metal grows stiff",
    actionSuggestion: "The embers still hold — but not for long. Complete a quest to stoke the fire.",
    tooltipText: baseTooltip,
  };
  if (temp >= 20) return {
    statusMessage: "The forge is cold — but the structure holds",
    actionSuggestion: "Back to the anvil. Pick the smallest quest on your board and complete it.",
    tooltipText: baseTooltip,
  };
  return {
    statusMessage: "The forge is frozen — but you still hold the hammer",
    actionSuggestion: "This is your restart moment. Complete a quest. Any quest.",
    tooltipText: baseTooltip,
  };
}

// ─── Quest helpers ────────────────────────────────────────────────────────────

export function getQuestRarity(quest: Quest): string {
  if (quest.rarity) return quest.rarity;
  const xp = quest.rewards?.xp ?? 0;
  if (xp >= 60) return "legendary";
  if (xp >= 40) return "epic";
  if (quest.priority === "high") return "rare";
  if (quest.priority === "medium") return "uncommon";
  return "common";
}

// ─── Anti-Ritual helpers ──────────────────────────────────────────────────────

export function getAntiRitualMood(days: number) {
  if (days >= 90) return { msg: "Legendary restraint. The Guild bows before you.", color: "#f59e0b" };
  if (days >= 30) return { msg: "One month strong. The urge has lost its hold.", color: "#a78bfa" };
  if (days >= 14) return { msg: "Two weeks clean. The streak grows in power.", color: "#60a5fa" };
  if (days >= 7)  return { msg: "A week without. The forge grows hotter.", color: "#22c55e" };
  if (days >= 1)  return { msg: "You resisted yesterday. Keep going.", color: "#f97316" };
  return { msg: "Day zero. Every journey starts here.", color: "rgba(255,255,255,0.4)" };
}

// ─── Leaderboard helpers ──────────────────────────────────────────────────────

export const LB_LEVELS = [
  { name: "Novice",     min: 0,   color: "#9ca3af" },
  { name: "Apprentice", min: 100, color: "#22c55e" },
  { name: "Knight",     min: 300, color: "#3b82f6" },
  { name: "Archmage",   min: 600, color: "#a855f7" },
];
export function getLbLevel(xp: number) { return LB_LEVELS.findLast(l => xp >= l.min) ?? LB_LEVELS[0]; }
export function getLbXpProgress(xp: number): number {
  const lvl = getLbLevel(xp);
  const idx = LB_LEVELS.indexOf(lvl);
  const next = LB_LEVELS[idx + 1];
  if (!next) return 1;
  return (xp - lvl.min) / (next.min - lvl.min);
}

/** Replace {value} in legendary effect labels with the actual value or min-max range. */
export function formatLegendaryLabel(le: { type?: string; label?: string; value?: number; min?: number; max?: number } | null | undefined): string {
  if (!le?.label) return le?.type ?? "";
  if (le.value != null) return le.label.replace(/\{value\}/g, String(le.value));
  if (le.min != null && le.max != null) return le.label.replace(/\{value\}/g, le.min === le.max ? String(le.min) : `${le.min}-${le.max}`);
  return le.label.replace(/\{value\}/g, "?");
}
