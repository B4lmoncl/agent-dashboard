"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import AgentCard from "@/components/AgentCard";
import StatBar from "@/components/StatBar";

interface Agent {
  id: string;
  name: string;
  status: "online" | "working" | "idle" | "offline";
  platform: string | null;
  uptime: number;
  currentJobDuration: number;
  questsCompleted?: number;
  xp?: number;
  gold?: number;
  streakDays?: number;
  health: "ok" | "needs_checkin" | "broken" | "stale";
  lastUpdate: string | null;
  role?: string;
  avatar?: string;
  color?: string;
  pendingCommands?: number;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  type?: "development" | "personal" | "learning" | "fitness" | "social" | "boss" | "relationship-coop";
  category: string | null;
  categories: string[];
  product: string | null;
  humanInputRequired: boolean;
  createdBy?: string;
  status: "open" | "in_progress" | "completed" | "suggested" | "rejected";
  createdAt: string;
  claimedBy: string | null;
  completedBy: string | null;
  completedAt: string | null;
  parentQuestId?: string | null;
  children?: Quest[];
  progress?: { completed: number; total: number };
  recurrence?: string | null;
  proof?: string | null;
  checklist?: { text: string; done: boolean }[] | null;
  nextQuestTemplate?: { title: string; description?: string | null; type?: string; priority?: string } | null;
  coopPartners?: string[] | null;
  coopClaimed?: string[];
  coopCompletions?: string[];
  skills?: string[];
  lore?: string | null;
  chapter?: string | null;
}

interface EarnedAchievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  category: string;
  earnedAt: string;
}

interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  xp: number;
  questsCompleted: number;
  achievements?: { reason: string; xp: number; at: string }[];
  earnedAchievements?: EarnedAchievement[];
  streakDays?: number;
  streakLastDate?: string | null;
  forgeTemp?: number;
  gold?: number;
  gear?: string;
  createdAt?: string;
}

interface CampaignQuest {
  id: string;
  title: string;
  status: string;
  priority?: string;
  type?: string;
  completedBy?: string | null;
  completedAt?: string | null;
  claimedBy?: string | null;
  lore?: string | null;
  description?: string;
}

interface Campaign {
  id: string;
  title: string;
  description: string;
  icon: string;
  lore: string;
  createdBy: string;
  createdAt: string;
  status: "active" | "completed" | "archived";
  questIds: string[];
  bossQuestId: string | null;
  rewards: { xp: number; gold: number; title: string };
  quests?: CampaignQuest[];
  progress?: { completed: number; total: number };
}

interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  category: string;
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  role?: string;
  xp: number;
  questsCompleted: number;
}

interface QuestsData {
  open: Quest[];
  inProgress: Quest[];
  completed: Quest[];
  suggested: Quest[];
  rejected: Quest[];
}

const priorityConfig = {
  low:    { label: "Low",    color: "#22c55e", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)"   },
  medium: { label: "Med",   color: "#eab308", bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.3)"   },
  high:   { label: "High",  color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)"   },
};

const categoryConfig: Record<string, { color: string; bg: string }> = {
  "Coding":         { color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  "Research":       { color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
  "Content":        { color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  "Sales":          { color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  "Infrastructure": { color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  "Bug Fix":        { color: "#ff4444", bg: "rgba(255,68,68,0.1)"   },
  "Feature":        { color: "#e879f9", bg: "rgba(232,121,249,0.1)" },
};

const productConfig: Record<string, { color: string; bg: string }> = {
  "Dashboard":      { color: "#ff6633", bg: "rgba(255,102,51,0.1)"  },
  "Companion App":  { color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  "Infrastructure": { color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  "Other":          { color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
};

const typeConfig: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  development: { label: "Dev",      icon: "⚙",  color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.3)"  },
  personal:    { label: "Personal", icon: "🏠", color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
  learning:    { label: "Learn",    icon: "📚", color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)"  },
  fitness:     { label: "Fitness",  icon: "💪", color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)"  },
  social:      { label: "Social",   icon: "❤️", color: "#ec4899", bg: "rgba(236,72,153,0.1)",  border: "rgba(236,72,153,0.3)"  },
  boss:        { label: "Boss",     icon: "🐉", color: "#ef4444", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.5)"   },
  "relationship-coop": { label: "Co-op", icon: "💞", color: "#f43f5e", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.4)" },
};

async function fetchAgents(): Promise<Agent[]> {
  try {
    const r = await fetch(`/api/agents`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* API not running */ }
  try {
    const r = await fetch(`/data/agents.json`);
    if (r.ok) {
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }
  } catch { /* ignore */ }
  return [];
}

async function fetchQuests(): Promise<QuestsData> {
  const empty: QuestsData = { open: [], inProgress: [], completed: [], suggested: [], rejected: [] };
  try {
    const r = await fetch(`/api/quests`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const data = await r.json();
      return { ...empty, ...data };
    }
  } catch { /* ignore */ }
  try {
    const r = await fetch(`/data/quests.json`);
    if (r.ok) {
      const data = await r.json();
      return data && !Array.isArray(data) ? { ...empty, ...data } : empty;
    }
  } catch { /* ignore */ }
  return empty;
}

async function fetchUsers(): Promise<User[]> {
  try {
    const r = await fetch(`/api/users`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* API not running */ }
  return [];
}

async function fetchCampaigns(): Promise<Campaign[]> {
  try {
    const r = await fetch(`/api/campaigns`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* ignore */ }
  return [];
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const r = await fetch(`/api/leaderboard`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* ignore */ }
  return [];
}

async function fetchAchievementCatalogue(): Promise<AchievementDef[]> {
  try {
    const r = await fetch(`/api/achievements`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* ignore */ }
  return [];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function useCountUp(target: number, decimals = 0, duration = 1000): string {
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

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [quests, setQuests] = useState<QuestsData>({ open: [], inProgress: [], completed: [], suggested: [], rejected: [] });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [apiLive, setApiLive] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedSearch, setCompletedSearch] = useState("");
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "priority">("newest");
  const [versions, setVersions] = useState<{ dashboard: string; app: string } | null>(null);
  const [reviewApiKey, setReviewApiKey] = useState<string>(() => {
    try { return localStorage.getItem("dash_api_key") || ""; } catch { return ""; }
  });
  const [reviewKeyInput, setReviewKeyInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dashView, setDashView] = useState<"questBoard" | "npcBoard" | "campaign" | "leaderboard" | "honors" | "season">("questBoard");
  const [lbSubTab, setLbSubTab] = useState<"agents" | "players">("players");
  const [createQuestOpen, setCreateQuestOpen] = useState(false);
  const [questBoardAgentOpen, setQuestBoardAgentOpen] = useState(false);
  const [npcAgentRosterOpen, setNpcAgentRosterOpen] = useState(true);
  const [dobbieOpen, setDobbieOpen] = useState(false);
  const [shopUserId, setShopUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<EarnedAchievement | null>(null);
  const [flavorToast, setFlavorToast] = useState<{ message: string; icon: string; sub?: string } | null>(null);
  const [chainOffer, setChainOffer] = useState<{ template: { title: string; description?: string | null; type?: string; priority?: string }; parentTitle: string } | null>(null);
  const [openSectionCollapsed, setOpenSectionCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("qb_open_collapsed") === "true"; } catch { return false; }
  });
  const [inProgressSectionCollapsed, setInProgressSectionCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("qb_inprogress_collapsed") === "true"; } catch { return false; }
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievementCatalogue, setAchievementCatalogue] = useState<AchievementDef[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [playerName, setPlayerName] = useState<string>(() => {
    try { return localStorage.getItem("dash_player_name") || ""; } catch { return ""; }
  });
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Particle system — white dust drifting upward
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    type Particle = { x: number; y: number; size: number; speedY: number; speedX: number; opacity: number; maxOpacity: number };

    const createParticle = (randomY = false): Particle => ({
      x: Math.random() * canvas.width,
      y: randomY ? Math.random() * canvas.height : canvas.height + 4,
      size: Math.random() * 1.5 + 0.4,
      speedY: -(Math.random() * 0.25 + 0.08),
      speedX: (Math.random() - 0.5) * 0.18,
      opacity: 0,
      maxOpacity: Math.random() * 0.35 + 0.08,
    });

    const particles: Particle[] = Array.from({ length: 48 }, () => createParticle(true));
    let animId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += p.speedX;
        const fade = canvas.height * 0.18;
        if (p.y > canvas.height - fade) {
          p.opacity = p.maxOpacity * ((canvas.height - p.y) / fade);
        } else if (p.y < fade) {
          p.opacity = p.maxOpacity * (p.y / fade);
        } else {
          p.opacity = p.maxOpacity;
        }
        if (p.y < -4) particles[i] = createParticle();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${CURRENT_SEASON.particle}${p.opacity.toFixed(3)})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  const refresh = useCallback(async () => {
    const [a, q, u, lb, ac, camps] = await Promise.all([fetchAgents(), fetchQuests(), fetchUsers(), fetchLeaderboard(), fetchAchievementCatalogue(), fetchCampaigns()]);
    // Lyra always first, then online/working agents, then rest
    const statusOrder: Record<string, number> = { working: 0, online: 1, idle: 2, offline: 3 };
    const sorted = [...a].sort((x, y) => {
      if (x.id === "lyra") return -1;
      if (y.id === "lyra") return 1;
      const sx = statusOrder[x.status] ?? 3;
      const sy = statusOrder[y.status] ?? 3;
      if (sx !== sy) return sx - sy;
      return x.name.localeCompare(y.name);
    });
    setAgents(sorted);
    setQuests(q);
    setUsers(u);
    if (lb.length > 0) setLeaderboard(lb);
    if (ac.length > 0) setAchievementCatalogue(ac);
    setCampaigns(camps);
    try {
      const r = await fetch(`/api/health`, { signal: AbortSignal.timeout(1500) });
      setApiLive(r.ok);
    } catch { setApiLive(false); }
    try {
      const r = await fetch(`/api/version`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) setVersions(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  const handleApprove = useCallback(async (id: string, comment?: string) => {
    const key = reviewApiKey;
    if (!key) return;
    try {
      const body = comment ? JSON.stringify({ comment }) : undefined;
      const r = await fetch(`/api/quest/${id}/approve`, {
        method: "POST",
        headers: { "X-API-Key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
      });
      if (r.ok) {
        setReviewComments(prev => { const next = { ...prev }; delete next[id]; return next; });
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh]);

  const handleReject = useCallback(async (id: string, comment?: string) => {
    const key = reviewApiKey;
    if (!key) return;
    try {
      const body = comment ? JSON.stringify({ comment }) : undefined;
      const r = await fetch(`/api/quest/${id}/reject`, {
        method: "POST",
        headers: { "X-API-Key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
      });
      if (r.ok) {
        setReviewComments(prev => { const next = { ...prev }; delete next[id]; return next; });
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh]);

  const handleChangePriority = useCallback(async (id: string, priority: Quest["priority"]) => {
    const key = reviewApiKey;
    if (!key) return;
    try {
      await fetch(`/api/quest/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ priority }),
      });
      setQuests(prev => ({
        ...prev,
        suggested: prev.suggested.map(q => q.id === id ? { ...q, priority } : q),
      }));
    } catch { /* ignore */ }
  }, [reviewApiKey]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkUpdate = useCallback(async (status: Quest["status"]) => {
    const key = reviewApiKey;
    if (!key || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await fetch("/api/quests/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      setSelectedIds(new Set());
      await refresh();
    } catch { /* ignore */ } finally {
      setBulkLoading(false);
    }
  }, [reviewApiKey, selectedIds, refresh]);

  const handleClaim = useCallback(async (questId: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ agentId: pName }),
      });
      if (r.ok) await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleUnclaim = useCallback(async (questId: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/unclaim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ agentId: pName }),
      });
      if (r.ok) await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleCoopClaim = useCallback(async (questId: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/coop-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ userId: pName }),
      });
      if (r.ok) await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleCoopComplete = useCallback(async (questId: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/coop-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ userId: pName }),
      });
      if (r.ok) await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleComplete = useCallback(async (questId: string, questTitle: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ agentId: pName }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.newAchievements?.length > 0) setToast(data.newAchievements[0]);
        if (data.chainQuestTemplate) {
          setChainOffer({ template: data.chainQuestTemplate, parentTitle: questTitle });
        }
        // Show flavor feedback on completion
        const currentUser = users.find(u => u.id === pName.toLowerCase() || u.name.toLowerCase() === pName.toLowerCase());
        const streak = currentUser?.streakDays ?? 0;
        const FLAVOR_MESSAGES = [
          { message: "Quest slain!", icon: "⚔️" },
          { message: "Like a pro!", icon: "💫" },
          { message: "Clutch finish!", icon: "🎯" },
          { message: "Well played!", icon: "🎮" },
          { message: "The Forge burns bright!", icon: "🔥" },
        ];
        let flavor = FLAVOR_MESSAGES[Math.floor(Math.random() * FLAVOR_MESSAGES.length)];
        if (streak >= 30) flavor = { message: "Legendary streak!", icon: "👑" };
        else if (streak >= 7) flavor = { message: "Streak master!", icon: "🔥" };
        setFlavorToast({ ...flavor, sub: questTitle.length > 40 ? questTitle.slice(0, 40) + "…" : questTitle });
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleChainAccept = useCallback(async () => {
    const key = reviewApiKey;
    if (!key || !chainOffer) return;
    try {
      await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ ...chainOffer.template, createdBy: playerName || "unknown" }),
      });
      setChainOffer(null);
      await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, chainOffer, playerName, refresh]);

  const handleShopBuy = useCallback(async (itemId: string) => {
    const key = reviewApiKey;
    if (!key || !shopUserId) return;
    try {
      const r = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ userId: shopUserId, itemId }),
      });
      if (r.ok) { setShopUserId(null); await refresh(); }
    } catch { /* ignore */ }
  }, [reviewApiKey, shopUserId, refresh]);

  const handleGearBuy = useCallback(async (gearId: string) => {
    const key = reviewApiKey;
    if (!key || !shopUserId) return;
    try {
      const r = await fetch("/api/shop/gear/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ userId: shopUserId, gearId }),
      });
      if (r.ok) { setShopUserId(null); await refresh(); }
    } catch { /* ignore */ }
  }, [reviewApiKey, shopUserId, refresh]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (lastRefresh) setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastRefresh]);

  // Auto-trigger tutorial on first visit (no login required)
  useEffect(() => {
    try {
      if (localStorage.getItem("tutorialCompleted") !== "true") {
        const t = setTimeout(() => { setShowTutorial(true); setTutorialStep(0); }, 800);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  const handleTutorialNext = () => {
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
      try { localStorage.setItem("tutorialCompleted", "true"); } catch { /* ignore */ }
      setShowTutorial(false);
      setTutorialStep(0);
    } else {
      setTutorialStep(s => s + 1);
    }
  };

  const handleTutorialSkip = () => {
    try { localStorage.setItem("tutorialCompleted", "true"); } catch { /* ignore */ }
    setShowTutorial(false);
    setTutorialStep(0);
  };

  const handleRestartTutorial = () => {
    try { localStorage.removeItem("tutorialCompleted"); } catch { /* ignore */ }
    setGuideOpen(false);
    setTutorialStep(0);
    setShowTutorial(true);
  };

  const needsAttention = agents.filter((a) => a.health === "needs_checkin" || a.health === "broken").length;

  // Player-specific stats (logged-in player)
  const loggedInUser = playerName ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;
  const playerTypes = ["personal", "learning", "fitness", "social", "relationship-coop"];
  const playerActiveQuests = quests.inProgress.filter(q => playerTypes.includes(q.type ?? "") && q.claimedBy?.toLowerCase() === (playerName || "").toLowerCase());
  const playerCompletedQuests = quests.completed.filter(q => playerTypes.includes(q.type ?? "") && q.completedBy?.toLowerCase() === (playerName || "").toLowerCase());
  const playerStreak = loggedInUser?.streakDays ?? 0;
  const playerGold = loggedInUser?.gold ?? 0;

  const playerActiveCount = playerActiveQuests.length;
  const playerCompletedCount = playerCompletedQuests.length;

  const openQuestsCount = quests.open.length;

  const animStreak    = useCountUp(playerStreak, 0);
  const animActive    = useCountUp(playerActiveCount, 0);
  const animCompleted = useCountUp(playerCompletedCount, 0);
  const animGold      = useCountUp(playerGold, 0);

  const lastUpdatedStr = lastRefresh
    ? secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`
    : "—";

  // Quest search + sort + type filter
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const applyFilter = useCallback((qs: Quest[]) => {
    let result = qs;
    if (typeFilter !== "all") result = result.filter(q => (q.type ?? "development") === typeFilter);
    if (!searchFilter) return result;
    const s = searchFilter.toLowerCase();
    return result.filter(q => q.title.toLowerCase().includes(s) || (q.description || "").toLowerCase().includes(s));
  }, [searchFilter, typeFilter]);
  const applySort = useCallback((qs: Quest[]) => {
    if (sortMode === "newest") return qs;
    return [...qs].sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
  }, [sortMode]);
  const visibleOpen = useMemo(() => applySort(applyFilter(quests.open)), [quests.open, applyFilter, applySort]);
  const visibleInProgress = useMemo(() => applySort(applyFilter(quests.inProgress)), [quests.inProgress, applyFilter, applySort]);

  // NPC board — dev-only filtered quests
  const devOpen = useMemo(() => applySort(quests.open.filter(q => (q.type ?? "development") === "development").filter(q => {
    if (!searchFilter) return true;
    const s = searchFilter.toLowerCase();
    return q.title.toLowerCase().includes(s) || (q.description || "").toLowerCase().includes(s);
  })), [quests.open, searchFilter, applySort]);
  const devInProgress = useMemo(() => applySort(quests.inProgress.filter(q => (q.type ?? "development") === "development").filter(q => {
    if (!searchFilter) return true;
    const s = searchFilter.toLowerCase();
    return q.title.toLowerCase().includes(s) || (q.description || "").toLowerCase().includes(s);
  })), [quests.inProgress, searchFilter, applySort]);

  // Build per-agent quest map
  const agentQuestMap: Record<string, Quest[]> = {};
  for (const q of quests.inProgress) {
    if (q.claimedBy) {
      if (!agentQuestMap[q.claimedBy]) agentQuestMap[q.claimedBy] = [];
      agentQuestMap[q.claimedBy].push(q);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "transparent", color: "#e8e8e8", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
      />
      {/* Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{
          position: "relative",
          zIndex: 40,
          background: "rgba(26,26,26,0.97)",
          borderBottom: "1px solid rgba(255,68,68,0.15)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: "linear-gradient(135deg, #ff4444, #cc2200)", boxShadow: "0 0 12px rgba(255,68,68,0.35)" }}
            >
              OC
            </div>
            <span className="font-semibold text-sm tracking-tight" style={{ color: "#e8e8e8" }}>
              Quest Hall
            </span>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ color: "#ff4444", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.18)" }}
            >
              The Guild
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ color: CURRENT_SEASON.color, background: CURRENT_SEASON.bg, border: `1px solid ${CURRENT_SEASON.color}40` }}
              title={`Current Season: ${CURRENT_SEASON.name}`}
            >
              {CURRENT_SEASON.icon} {CURRENT_SEASON.name}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleRestartTutorial}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              title="Restart Tutorial"
            >
              🎓 Tutorial
            </button>
            <button
              onClick={() => setGuideOpen(true)}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              📖 Guide
            </button>
            {/* Login / User area */}
            <div className="relative" data-tutorial="login-btn">
              {reviewApiKey && playerName ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ color: "#a78bfa", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)" }}>
                    👤 {playerName}
                  </span>
                  <button
                    onClick={() => {
                      localStorage.removeItem("dash_api_key");
                      localStorage.removeItem("dash_player_name");
                      setReviewApiKey("");
                      setPlayerName("");
                      setPlayerNameInput("");
                      setReviewKeyInput("");
                    }}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    title="Logout"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setLoginOpen(v => !v)}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    🔑 Login
                  </button>
                  {loginOpen && (
                    <div className="absolute right-0 top-7 z-50 rounded-xl p-3 shadow-xl flex flex-col gap-2" style={{ background: "#1e1e1e", border: "1px solid rgba(139,92,246,0.3)", minWidth: "200px" }}>
                      <input
                        type="text"
                        value={playerNameInput}
                        onChange={e => setPlayerNameInput(e.target.value)}
                        placeholder="Your name"
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                      />
                      <input
                        type="password"
                        value={reviewKeyInput}
                        onChange={e => setReviewKeyInput(e.target.value)}
                        placeholder="API Key"
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                        onKeyDown={e => {
                          if (e.key === "Enter" && reviewKeyInput) {
                            localStorage.setItem("dash_api_key", reviewKeyInput);
                            if (playerNameInput) { localStorage.setItem("dash_player_name", playerNameInput); setPlayerName(playerNameInput); }
                            setReviewApiKey(reviewKeyInput);
                            setLoginOpen(false);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (!reviewKeyInput) return;
                          localStorage.setItem("dash_api_key", reviewKeyInput);
                          if (playerNameInput) { localStorage.setItem("dash_player_name", playerNameInput); setPlayerName(playerNameInput); }
                          setReviewApiKey(reviewKeyInput);
                          setLoginOpen(false);
                        }}
                        className="text-xs px-3 py-1 rounded font-medium"
                        style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}
                      >
                        Sign In
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            {needsAttention > 0 && (
              <div
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                {needsAttention} need attention
              </div>
            )}
            {quests.suggested.length > 0 && (
              <div
                className="text-xs px-2 py-0.5 rounded font-semibold"
                style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)" }}
              >
                ✦ {quests.suggested.length} to review
              </div>
            )}
            <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{
                  background: apiLive ? "#22c55e" : "rgba(255,255,255,0.15)",
                  animation: apiLive ? "pulse-online 2s ease-in-out infinite" : "none",
                }}
              />
              {apiLive ? "API Live" : "Static"}
            </div>
            <div className="text-xs font-mono flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
              <span
                className="w-1.5 h-1.5 rounded-full inline-block animate-pulse"
                style={{ background: "rgba(255,102,51,0.5)" }}
              />
              Updated {lastUpdatedStr}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8" style={{ position: "relative", zIndex: 1 }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#f0f0f0" }}>
            Quest Hall
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            The Forge burns bright
          </p>
        </div>

        {/* Stats — Player-specific */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tutorial="stat-cards">
          {!playerName && !loading && (
            <div className="col-span-2 sm:col-span-4 rounded-xl p-3 text-center" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                🔑 <button onClick={() => setLoginOpen(true)} className="underline" style={{ color: "#a78bfa" }}>Log in</button> to see your personal stats
              </p>
            </div>
          )}
          <StatBar
            label="🔥 Forge Streak"
            value={loading ? "—" : playerName ? `${animStreak}d` : "—"}
            sub={playerName ? "your streak" : "login to view"}
            accent="#f97316"
          />
          <StatBar
            label="⚔️ Active Quests"
            value={loading ? "—" : playerName ? animActive : "—"}
            sub={playerName ? `${openQuestsCount} open total` : "login to view"}
            accent="#ef4444"
          />
          <StatBar
            label="✅ Quests Completed"
            value={loading ? "—" : playerName ? animCompleted : "—"}
            sub={playerName ? "your completions" : "login to view"}
            accent="#22c55e"
          />
          <StatBar
            label="🪙 Your Gold"
            value={loading ? "—" : playerName ? animGold : "—"}
            sub={playerName ? "your earnings" : "login to view"}
            accent="#eab308"
          />
        </div>

        {/* View toggle */}
        <div className="flex gap-1 flex-wrap" style={{ background: "#111", borderRadius: 8, padding: 3, display: "inline-flex" }}>
          {[
            { key: "questBoard",  label: "⚔ Quest Board",     tutorialKey: "quest-board-tab" },
            { key: "npcBoard",    label: "🤖 NPC Quest Board", tutorialKey: "npc-board-tab" },
            { key: "leaderboard", label: "🏆 Leaderboard",     tutorialKey: "leaderboard-tab" },
            { key: "honors",      label: "🏅 Honors",          tutorialKey: null },
            { key: "campaign",    label: "🐉 Campaign",        tutorialKey: "campaign-tab" },
            { key: "season",      label: `${CURRENT_SEASON.icon} Season`, tutorialKey: "season-tab" },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => setDashView(v.key as typeof dashView)}
              className="btn-interactive text-xs font-semibold px-3 py-1.5 rounded transition-all"
              style={{
                background: dashView === v.key ? "#252525" : "transparent",
                color: dashView === v.key ? "#f0f0f0" : "rgba(255,255,255,0.3)",
              }}
              {...(v.tutorialKey ? { "data-tutorial": v.tutorialKey } : {})}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Leaderboard View with Agent/Player sub-tabs */}
        {dashView === "leaderboard" && (
          <div className="space-y-4">
            <div className="flex gap-1" style={{ background: "#111", borderRadius: 8, padding: 3, display: "inline-flex" }}>
              {[
                { key: "players", label: "👤 Players" },
                { key: "agents",  label: "🤖 Agents" },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setLbSubTab(t.key as "agents" | "players")}
                  className="btn-interactive text-xs font-semibold px-3 py-1.5 rounded transition-all"
                  style={{
                    background: lbSubTab === t.key ? "#252525" : "transparent",
                    color: lbSubTab === t.key ? "#f0f0f0" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {lbSubTab === "agents" && <LeaderboardView entries={leaderboard} agents={agents} mode="agents" />}
            {lbSubTab === "players" && <LeaderboardView entries={leaderboard} agents={agents} mode="players" users={users} />}
          </div>
        )}

        {/* Honors View — Player-specific */}
        {dashView === "honors" && (
          <HonorsView catalogue={achievementCatalogue} users={users} playerName={playerName} quests={quests} reviewApiKey={reviewApiKey} />
        )}

        {/* Campaign View */}
        {dashView === "campaign" && (
          <CampaignHub campaigns={campaigns} quests={quests} reviewApiKey={reviewApiKey} onRefresh={refresh} />
        )}

        {/* Season & Battle Pass View */}
        {dashView === "season" && (
          <BattlePassView users={users} quests={quests} />
        )}

        {/* ── QUEST BOARD (Player Tab) ── */}
        {dashView === "questBoard" && (() => {
          const playerQuestTypes = ["personal", "learning", "fitness", "social", "relationship-coop"];
          const playerVisibleOpen = applySort(applyFilter(quests.open.filter(q => playerQuestTypes.includes(q.type ?? ""))));
          const playerVisibleInProgress = applySort(applyFilter(quests.inProgress.filter(q => playerQuestTypes.includes(q.type ?? ""))));
          return (
            <div>
              {/* Player Cards */}
              {users.length > 0 && (
                <section className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Players</h2>
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }}>{users.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {users.map(u => <UserCard key={u.id} user={u} onShopOpen={reviewApiKey ? setShopUserId : undefined} />)}
                  </div>
                </section>
              )}

              {/* Companions Widget */}
              <div className="mb-5">
                <CompanionsWidget user={loggedInUser} streak={playerStreak} />
              </div>

              {/* Quest Board — player types only */}
              <div>
                <aside className="w-full">
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>⚔ Quest Board</h2>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{playerVisibleOpen.length} open · {playerVisibleInProgress.length} in progress</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCreateQuestOpen(true)}
                          className="btn-interactive text-xs px-2 py-1 rounded font-semibold"
                          style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
                          title="Create Quest"
                        >
                          ＋ Create
                        </button>
                        <button
                          onClick={() => {
                            const allCollapsed = openSectionCollapsed && inProgressSectionCollapsed;
                            const next = !allCollapsed;
                            setOpenSectionCollapsed(next);
                            setInProgressSectionCollapsed(next);
                            try { localStorage.setItem("qb_open_collapsed", String(next)); localStorage.setItem("qb_inprogress_collapsed", String(next)); } catch { /* ignore */ }
                          }}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}
                          title="Collapse / Expand All"
                        >
                          {openSectionCollapsed && inProgressSectionCollapsed ? "⊞" : "⊟"}
                        </button>
                        <button
                          onClick={() => setSortMode(s => s === "newest" ? "priority" : "newest")}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: sortMode === "priority" ? "rgba(255,102,51,0.15)" : "rgba(255,255,255,0.05)", color: sortMode === "priority" ? "#ff6633" : "rgba(255,255,255,0.3)", border: `1px solid ${sortMode === "priority" ? "rgba(255,102,51,0.3)" : "rgba(255,255,255,0.08)"}` }}
                        >
                          {sortMode === "newest" ? "⇅ Newest" : "⇅ Priority"}
                        </button>
                      </div>
                    </div>
                    {/* Type filter — player types only */}
                    <div className="flex gap-1 flex-wrap mb-2" data-tutorial="quest-filters">
                      {(["all", "personal", "learning", "fitness", "social", "relationship-coop"] as const).map(t => {
                        const cfg = t === "all" ? null : typeConfig[t];
                        const isActive = typeFilter === t;
                        return (
                          <button key={t} onClick={() => setTypeFilter(t)} className="text-xs px-2 py-0.5 rounded"
                            style={{ background: isActive ? (cfg ? cfg.bg : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.03)", color: isActive ? (cfg ? cfg.color : "#e8e8e8") : "rgba(255,255,255,0.3)", border: `1px solid ${isActive ? (cfg ? cfg.border : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.07)"}` }}>
                            {t === "all" ? "All" : `${cfg!.icon} ${cfg!.label}`}
                          </button>
                        );
                      })}
                    </div>
                    <input type="text" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Search quests…" className="w-full text-xs px-2 py-1.5 rounded" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", outline: "none" }} />
                  </div>

                  <div className="space-y-2">
                    {loading ? [1,2,3].map(i => <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.05)" }} />) :
                    playerVisibleOpen.length === 0 && playerVisibleInProgress.length === 0 ? (
                      <div className="rounded-xl p-5 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{searchFilter ? "No quests match your search" : "No player quests open"}</p>
                        {!searchFilter && <button onClick={() => setCreateQuestOpen(true)} className="btn-interactive text-xs mt-2 px-3 py-1 rounded" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>＋ Create Quest</button>}
                      </div>
                    ) : (
                      <>
                        {playerVisibleOpen.length > 0 && (
                          <>
                            <button onClick={() => { const next = !openSectionCollapsed; setOpenSectionCollapsed(next); try { localStorage.setItem("qb_open_collapsed", String(next)); } catch { /* ignore */ } }} className="flex items-center gap-2 w-full text-left pt-1 pb-0.5">
                              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Open</span>
                              <span className="text-xs px-1 rounded font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)" }}>{playerVisibleOpen.length}</span>
                              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>{openSectionCollapsed ? "▼" : "▲"}</span>
                            </button>
                            {!openSectionCollapsed && playerVisibleOpen.map(q =>
                              q.children && q.children.length > 0
                                ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                                : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined}
                                    onClaim={reviewApiKey && playerName ? handleClaim : undefined}
                                    onUnclaim={reviewApiKey && playerName ? handleUnclaim : undefined}
                                    onComplete={reviewApiKey && playerName ? handleComplete : undefined}
                                    onCoopClaim={reviewApiKey && playerName ? handleCoopClaim : undefined}
                                    onCoopComplete={reviewApiKey && playerName ? handleCoopComplete : undefined}
                                    playerName={playerName} />
                            )}
                          </>
                        )}
                        {playerVisibleInProgress.length > 0 && (
                          <>
                            <button onClick={() => { const next = !inProgressSectionCollapsed; setInProgressSectionCollapsed(next); try { localStorage.setItem("qb_inprogress_collapsed", String(next)); } catch { /* ignore */ } }} className="flex items-center gap-2 w-full text-left pt-2 pb-0.5">
                              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>In Progress</span>
                              <span className="text-xs px-1 rounded font-mono" style={{ background: "rgba(139,92,246,0.08)", color: "rgba(139,92,246,0.5)" }}>{playerVisibleInProgress.length}</span>
                              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>{inProgressSectionCollapsed ? "▼" : "▲"}</span>
                            </button>
                            {!inProgressSectionCollapsed && playerVisibleInProgress.map(q =>
                              q.children && q.children.length > 0
                                ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                                : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined}
                                    onClaim={reviewApiKey && playerName ? handleClaim : undefined}
                                    onUnclaim={reviewApiKey && playerName ? handleUnclaim : undefined}
                                    onComplete={reviewApiKey && playerName ? handleComplete : undefined}
                                    onCoopClaim={reviewApiKey && playerName ? handleCoopClaim : undefined}
                                    onCoopComplete={reviewApiKey && playerName ? handleCoopComplete : undefined}
                                    playerName={playerName} />
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          );
        })()}

        {/* ── NPC QUEST BOARD (Agent Tab) ── */}
        {dashView === "npcBoard" && (() => {
          const devVisibleOpen = applySort(applyFilter(quests.open.filter(q => (q.type ?? "development") === "development")));
          const devVisibleInProgress = applySort(applyFilter(quests.inProgress.filter(q => (q.type ?? "development") === "development")));
          return (
            <div className="space-y-6">
              {/* NPC Roster — collapsible */}
              <section>
                <button
                  onClick={() => setNpcAgentRosterOpen(v => !v)}
                  className="flex items-center justify-between w-full mb-3"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>NPC Roster</h2>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{loading ? "Loading…" : agents.length > 0 ? `${agents.length} agents registered` : "Waiting for agents to check in"}</p>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#4ade80", animation: "pulse-online 2s ease-in-out infinite" }} />Online</span>
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#ff6b00", animation: "pulse-working 1.5s ease-in-out infinite" }} />Working</span>
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#facc15", animation: "pulse-idle 3s ease-in-out infinite" }} />Idle</span>
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{npcAgentRosterOpen ? "▲" : "▼"}</span>
                </button>
                {npcAgentRosterOpen && (loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}</div>
                ) : agents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {agents.map(agent => (
                      <div key={agent.id} className={agent.id === "lyra" ? "col-span-1 sm:col-span-2" : ""}>
                        <AgentCard agent={agent} activeQuests={agentQuestMap[agent.id] ?? []} isWide={agent.id === "lyra"} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No agents have checked in yet." sub="POST /api/agent/:name/status  →  { status, platform, uptime, questsCompleted, health }" />
                ))}
              </section>

              {/* NPC Quest Board (dev type only) + Review Board side-by-side */}
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <aside className="w-full lg:w-80 flex-shrink-0">
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b5cf6" }}>⚙ NPC Quest Board</h2>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{devVisibleOpen.length} open · {devVisibleInProgress.length} in progress</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSortMode(s => s === "newest" ? "priority" : "newest")} className="text-xs px-2 py-1 rounded" style={{ background: sortMode === "priority" ? "rgba(255,102,51,0.15)" : "rgba(255,255,255,0.05)", color: sortMode === "priority" ? "#ff6633" : "rgba(255,255,255,0.3)", border: `1px solid ${sortMode === "priority" ? "rgba(255,102,51,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                          {sortMode === "newest" ? "⇅ Newest" : "⇅ Priority"}
                        </button>
                      </div>
                    </div>
                    <input type="text" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Search agent quests…" className="w-full text-xs px-2 py-1.5 rounded" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", outline: "none" }} />
                  </div>
                  <div className="space-y-2">
                    {loading ? [1,2,3].map(i => <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.05)" }} />) :
                    devVisibleOpen.length === 0 && devVisibleInProgress.length === 0 ? (
                      <div className="rounded-xl p-5 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{searchFilter ? "No quests match" : "No development quests"}</p>
                      </div>
                    ) : (
                      <>
                        {devVisibleOpen.length > 0 && (
                          <>
                            <div className="flex items-center gap-2 pt-1 pb-0.5">
                              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Open</span>
                              <span className="text-xs px-1 rounded font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)" }}>{devVisibleOpen.length}</span>
                            </div>
                            {devVisibleOpen.map(q =>
                              q.children && q.children.length > 0
                                ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                                : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} playerName={playerName} />
                            )}
                          </>
                        )}
                        {devVisibleInProgress.length > 0 && (
                          <>
                            <div className="flex items-center gap-2 pt-2 pb-0.5">
                              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>In Progress</span>
                              <span className="text-xs px-1 rounded font-mono" style={{ background: "rgba(139,92,246,0.08)", color: "rgba(139,92,246,0.5)" }}>{devVisibleInProgress.length}</span>
                            </div>
                            {devVisibleInProgress.map(q =>
                              q.children && q.children.length > 0
                                ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                                : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} playerName={playerName} />
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </aside>

                {/* Review Board — NPC tab only */}
                <div className="flex-1 min-w-0">
                  {quests.suggested.length > 0 && (
                    <section className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f59e0b" }}>✦ Review Board</h2>
                        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>{quests.suggested.length}</span>
                      </div>
                      {!reviewApiKey ? (
                        <div className="rounded-xl p-3" style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.2)" }}>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>🔑 Log in to review and approve quests.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {quests.suggested.map(q => (
                            <div key={q.id} className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.25)", boxShadow: "0 0 12px rgba(245,158,11,0.06)" }}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <ClickablePriorityBadge priority={q.priority} onClick={() => { const cycle: Quest["priority"][] = ["low","medium","high"]; const next = cycle[(cycle.indexOf(q.priority)+1)%3]; handleChangePriority(q.id, next); }} />
                                    <h3 className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{q.title}</h3>
                                  </div>
                                  {q.description && <p className="text-xs leading-relaxed mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>{q.description}</p>}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {(q.categories?.length ? q.categories : (q.category ? [q.category] : [])).map(c => <CategoryBadge key={c} category={c} />)}
                                    {q.product && <ProductBadge product={q.product} />}
                                    {q.createdBy && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "rgba(245,158,11,0.7)", border: "1px solid rgba(245,158,11,0.2)" }}>by {q.createdBy}</span>}
                                  </div>
                                  <input type="text" value={reviewComments[q.id] ?? ""} onChange={e => setReviewComments(prev => ({ ...prev, [q.id]: e.target.value }))} placeholder="Add a comment (optional)…" className="mt-2 w-full text-xs px-2 py-1.5 rounded" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", outline: "none" }} />
                                </div>
                                <div className="flex flex-col gap-1.5 flex-shrink-0">
                                  <button onClick={() => handleApprove(q.id, reviewComments[q.id])} className="action-btn btn-approve px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>✓ Approve</button>
                                  <button onClick={() => handleReject(q.id, reviewComments[q.id])} className="action-btn btn-danger px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.7)", border: "1px solid rgba(239,68,68,0.2)" }}>✕ Reject</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                  <SmartSuggestionsPanel quests={quests} agents={agents} />
                  {reviewApiKey && (
                    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,107,157,0.04)", border: "1px solid rgba(255,107,157,0.2)" }}>
                      <button
                        onClick={() => setDobbieOpen(v => !v)}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-left"
                      >
                        <span className="text-sm">🐱</span>
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#ff6b9d" }}>Dobbie&apos;s Demands</span>
                        <span className="text-xs px-1.5 py-0.5 rounded font-mono ml-1" style={{ background: "rgba(255,107,157,0.12)", color: "#ff6b9d", border: "1px solid rgba(255,107,157,0.25)" }}>NPC</span>
                        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{dobbieOpen ? "▲" : "▼"}</span>
                      </button>
                      {dobbieOpen && (
                        <div style={{ borderTop: "1px solid rgba(255,107,157,0.15)" }}>
                          <DobbieQuestPanel reviewApiKey={reviewApiKey} onRefresh={refresh} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* AI Smart Suggestions — also on leaderboard */}
        {dashView === "leaderboard" && (
          <SmartSuggestionsPanel quests={quests} agents={agents} />
        )}

        {/* Rejected Quests (Mülleimer) */}
        {quests.rejected.length > 0 && (
          <section className="mb-6">
            <button
              onClick={() => setRejectedOpen(v => !v)}
              className="flex items-center gap-2 mb-3 w-full text-left"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                🗑 Rejected
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)" }}>
                {quests.rejected.length}
              </span>
              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                {rejectedOpen ? "▲" : "▼"}
              </span>
            </button>
            {rejectedOpen && (
              <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.04)" }}>
                {quests.rejected.map((q, i) => (
                  <div
                    key={q.id}
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ borderBottom: i === quests.rejected.length - 1 ? "none" : "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <span className="text-xs flex-shrink-0" style={{ color: "rgba(239,68,68,0.4)" }}>✕</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.25)", textDecoration: "line-through" }}>{q.title}</p>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>by {q.createdBy ?? "unknown"}</span>
                    </div>
                    <PriorityBadge priority={q.priority} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Completed Quests Log — Quest Journal */}
        {(quests.completed.length > 0 || !loading) && (
          <section>
            <button
              onClick={() => setCompletedOpen(v => !v)}
              className="flex items-center gap-2 mb-3 w-full text-left"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                📖 Quest Journal
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                {quests.completed.length}
              </span>
              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                {completedOpen ? "▲" : "▼"}
              </span>
            </button>

            {completedOpen && (
              <div>
                <input
                  type="text"
                  value={completedSearch}
                  onChange={e => setCompletedSearch(e.target.value)}
                  placeholder="Search completed quests…"
                  className="w-full text-xs px-3 py-2 rounded-lg mb-2"
                  style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", outline: "none" }}
                />
                <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {quests.completed.length === 0 ? (
                    <p className="text-xs p-4 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>No completed quests yet</p>
                  ) : (() => {
                    const filtered = completedSearch
                      ? quests.completed.filter(q =>
                          q.title.toLowerCase().includes(completedSearch.toLowerCase()) ||
                          (q.description ?? "").toLowerCase().includes(completedSearch.toLowerCase()) ||
                          (q.completedBy ?? "").toLowerCase().includes(completedSearch.toLowerCase())
                        )
                      : quests.completed;
                    if (filtered.length === 0) return (
                      <p className="text-xs p-4 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>No quests match &ldquo;{completedSearch}&rdquo;</p>
                    );
                    return (
                      <div>
                        {filtered.map((q, i) => (
                          <CompletedQuestRow
                            key={q.id}
                            quest={q}
                            isLast={i === filtered.length - 1}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl"
          style={{
            transform: "translateX(-50%)",
            background: "#252525",
            border: "1px solid rgba(255,102,51,0.4)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(255,102,51,0.1)",
          }}
        >
          <span className="text-xs font-medium mr-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            {selectedIds.size} selected
          </span>
          {(["open", "completed", "rejected"] as Quest["status"][]).map(s => (
            <button
              key={s}
              onClick={() => handleBulkUpdate(s)}
              disabled={bulkLoading}
              className="text-xs px-2.5 py-1 rounded-lg font-medium"
              style={{
                background: s === "completed" ? "rgba(34,197,94,0.15)" : s === "rejected" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.07)",
                color: s === "completed" ? "#22c55e" : s === "rejected" ? "#ef4444" : "rgba(255,255,255,0.6)",
                border: `1px solid ${s === "completed" ? "rgba(34,197,94,0.3)" : s === "rejected" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.12)"}`,
                opacity: bulkLoading ? 0.5 : 1,
              }}
            >
              → {s}
            </button>
          ))}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs px-2 py-1 rounded-lg ml-1"
            style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            ✕
          </button>
        </div>
      )}

      <footer className="mt-12 py-6" style={{ borderTop: "1px solid rgba(255,68,68,0.07)", position: "relative", zIndex: 1 }}>
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono"
          style={{ color: "rgba(255,255,255,0.15)" }}
        >
          <div className="flex items-center gap-3">
            <span>OpenClaw · Quest Hall · The Guild</span>
            {versions && (
              <span style={{ color: "rgba(255,255,255,0.25)" }}>
                Dashboard v{versions.dashboard} | Companion App v{versions.app}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4" style={{ color: "rgba(255,68,68,0.35)" }}>
            <span>GET /api/quests</span>
            <span>POST /api/quest</span>
            <span>GET /api/agents</span>
          </div>
        </div>
      </footer>

      {/* Shop Modal */}
      {shopUserId && (() => {
        const u = users.find(x => x.id === shopUserId);
        if (!u) return null;
        return (
          <ShopModal
            userId={u.id}
            userName={u.name}
            gold={u.gold ?? 0}
            currentGear={u.gear}
            onClose={() => setShopUserId(null)}
            onBuy={handleShopBuy}
            onGearBuy={handleGearBuy}
          />
        );
      })()}

      {/* Achievement Toast */}
      {toast && <AchievementToast achievement={toast} onClose={() => setToast(null)} />}

      {/* Flavor Toast */}
      {flavorToast && <FlavorToast toast={flavorToast} onClose={() => setFlavorToast(null)} />}

      {/* Chain Quest Toast */}
      {chainOffer && (
        <ChainQuestToast
          parentTitle={chainOffer.parentTitle}
          template={chainOffer.template}
          onAccept={handleChainAccept}
          onDismiss={() => setChainOffer(null)}
        />
      )}

      {/* Guide Modal */}
      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} onRestartTutorial={handleRestartTutorial} />}

      {/* Tutorial Overlay */}
      {showTutorial && (
        <TutorialOverlay step={tutorialStep} onNext={handleTutorialNext} onSkip={handleTutorialSkip} />
      )}

      {/* Create Quest Modal */}
      {createQuestOpen && (
        <CreateQuestModal
          quests={quests}
          users={users}
          reviewApiKey={reviewApiKey}
          onRefresh={refresh}
          onClose={() => setCreateQuestOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Create Quest Modal ──────────────────────────────────────────────────────
function CreateQuestModal({ quests, users, reviewApiKey, onRefresh, onClose }: {
  quests: QuestsData;
  users: User[];
  reviewApiKey: string;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"personal" | "learning" | "household" | "social" | "coop" | "challenges">("personal");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl overflow-hidden" style={{ background: "#1a1a1a", border: "1px solid rgba(167,139,250,0.3)", boxShadow: "0 0 60px rgba(139,92,246,0.15)", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>+ Create Quest</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Choose a template or start from scratch</p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}>x</button>
        </div>
        <div className="flex border-b overflow-x-auto" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {([
            { key: "personal",   label: "Personal" },
            { key: "learning",   label: "Learning" },
            { key: "household",  label: "Household" },
            { key: "social",     label: "Social" },
            { key: "coop",       label: "Co-op" },
            { key: "challenges", label: "⚡ Challenges" },
          ] as { key: typeof tab; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap px-2"
              style={{ color: tab === t.key ? "#a78bfa" : "rgba(255,255,255,0.3)", background: tab === t.key ? "rgba(167,139,250,0.08)" : "transparent", borderBottom: tab === t.key ? "2px solid #a78bfa" : "2px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === "personal" && <PersonalQuestPanel reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "learning" && <LearningQuestPanel quests={quests} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "household" && <HouseholdQuestBoard quests={quests} users={users} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "social" && <ThoughtfulHeroPanel quests={quests} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "coop" && <RelationshipCoopPanel users={users} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
          {tab === "challenges" && <ForgeChallengesPanel users={users} reviewApiKey={reviewApiKey} onRefresh={onRefresh} />}
        </div>
      </div>
    </div>
  );
}

// ─── Personal Quest Panel ────────────────────────────────────────────────────

interface PersonalTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  type: string;
  priority: "low" | "medium" | "high";
  recurrence: string | null;
  checklist: { text: string; done: boolean }[] | null;
}

function PersonalQuestPanel({ reviewApiKey, onRefresh }: {
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [templates, setTemplates] = useState<PersonalTemplate[]>([]);
  const [spawning, setSpawning] = useState<string | null>(null);
  const [spawned, setSpawned] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/personal-templates").then(r => r.ok ? r.json() : []).then(setTemplates).catch(() => {});
  }, []);

  const handleSpawn = async (templateId: string) => {
    setSpawning(templateId);
    try {
      const r = await fetch("/api/personal-templates/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({ templateId, createdBy: "leon" }),
      });
      if (r.ok) {
        setSpawned(prev => new Set(prev).add(templateId));
        onRefresh();
      }
    } catch { /* ignore */ } finally {
      setSpawning(null);
    }
  };

  if (templates.length === 0) return null;

  const typeColors: Record<string, { color: string; bg: string; border: string }> = {
    personal:    { color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
    learning:    { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)"  },
    fitness:     { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)"  },
    social:      { color: "#ec4899", bg: "rgba(236,72,153,0.1)",  border: "rgba(236,72,153,0.3)"  },
  };
  const typeIcons: Record<string, string> = { personal: "🏠", learning: "📚", fitness: "💪", social: "❤️" };
  const priorityBadge: Record<string, string> = { high: "#ef4444", medium: "#eab308", low: "#22c55e" };

  return (
    <section className="mb-6">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#a78bfa" }}>
          🧬 Personal Life Quests
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
          {templates.length}
        </span>
        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {templates.map(t => {
            const tc = typeColors[t.type] ?? { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.3)" };
            const isSpawned = spawned.has(t.id);
            const isSpawning = spawning === t.id;
            return (
              <div
                key={t.id}
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{ background: isSpawned ? tc.bg : "#252525", border: `1px solid ${isSpawned ? tc.border : "rgba(255,255,255,0.07)"}` }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-2xl flex-shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold leading-tight" style={{ color: "#f0f0f0" }}>{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                        {typeIcons[t.type]} {t.type}
                      </span>
                      {t.recurrence && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          🔁 {t.recurrence}
                        </span>
                      )}
                      <span className="text-xs px-1 py-0.5 rounded font-mono" style={{ color: priorityBadge[t.priority], background: `${priorityBadge[t.priority]}18` }}>
                        {t.priority}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>{t.desc}</p>
                {t.checklist && (
                  <ul className="space-y-0.5">
                    {t.checklist.slice(0, 3).map((item, i) => (
                      <li key={i} className="text-xs flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                        <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: tc.color }} />
                        {item.text}
                      </li>
                    ))}
                    {t.checklist.length > 3 && (
                      <li className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>+{t.checklist.length - 3} more steps</li>
                    )}
                  </ul>
                )}
                <button
                  onClick={() => handleSpawn(t.id)}
                  disabled={isSpawned || isSpawning}
                  className="mt-auto w-full text-xs py-1.5 rounded-lg font-semibold"
                  style={{
                    background: isSpawned ? `${tc.color}20` : isSpawning ? "rgba(255,255,255,0.04)" : "rgba(167,139,250,0.15)",
                    color: isSpawned ? tc.color : isSpawning ? "rgba(255,255,255,0.3)" : "#a78bfa",
                    border: `1px solid ${isSpawned ? tc.border : "rgba(167,139,250,0.35)"}`,
                    cursor: isSpawned ? "default" : "pointer",
                  }}
                >
                  {isSpawned ? "✓ Quest Added" : isSpawning ? "Adding…" : "＋ Add to Quest Board"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Forge Challenges Panel ──────────────────────────────────────────────────

interface ForgeChallengeTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  participants: { id: string; name: string; avatar: string; color: string }[];
}

function ForgeChallengesPanel({ users, reviewApiKey, onRefresh }: {
  users: User[];
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [challenges, setChallenges] = useState<ForgeChallengeTemplate[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinUserId, setJoinUserId] = useState<string>(() => users[0]?.id ?? "");

  useEffect(() => {
    fetch("/api/challenges").then(r => r.ok ? r.json() : []).then(setChallenges).catch(() => {});
  }, [users]);

  const handleJoin = async (challengeId: string) => {
    if (!joinUserId) return;
    setJoining(challengeId);
    try {
      await fetch("/api/challenges/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({ userId: joinUserId, challengeId }),
      });
      const updated = await fetch("/api/challenges").then(r => r.ok ? r.json() : challenges);
      setChallenges(updated);
      onRefresh();
    } catch { /* ignore */ } finally {
      setJoining(null);
    }
  };

  if (challenges.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f97316" }}>
          ⚡ Forge Challenges
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
          {challenges.length}
        </span>
        {users.length > 1 && (
          <select
            value={joinUserId}
            onChange={e => setJoinUserId(e.target.value)}
            className="ml-auto text-xs px-2 py-0.5 rounded"
            style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8", outline: "none" }}
          >
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {challenges.map(c => {
          const joined = users.find(u => u.id === joinUserId) && c.participants.some(p => p.id === joinUserId);
          return (
            <div
              key={c.id}
              className="rounded-xl p-4"
              style={{ background: joined ? "rgba(249,115,22,0.08)" : "#252525", border: `1px solid ${joined ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.07)"}` }}
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl flex-shrink-0">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold" style={{ color: "#f0f0f0" }}>{c.name}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{c.desc}</p>
                </div>
              </div>
              {c.participants.length > 0 && (
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  {c.participants.map(p => (
                    <span key={p.id} className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}>
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleJoin(c.id)}
                disabled={!!joined || joining === c.id}
                className="w-full text-xs py-1.5 rounded-lg font-semibold"
                style={{
                  background: joined ? "rgba(34,197,94,0.12)" : joining === c.id ? "rgba(255,255,255,0.04)" : "rgba(249,115,22,0.15)",
                  color: joined ? "#22c55e" : joining === c.id ? "rgba(255,255,255,0.3)" : "#f97316",
                  border: `1px solid ${joined ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.35)"}`,
                  cursor: joined ? "default" : "pointer",
                }}
              >
                {joined ? "✓ Joined" : joining === c.id ? "Joining…" : "⚡ Join Challenge"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Smart Suggestions Panel ──────────────────────────────────────────────────

interface Suggestion {
  id: string;
  icon: string;
  title: string;
  body: string;
  accent: string;
  accentBg: string;
}

function buildSuggestions(quests: QuestsData, agents: Agent[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const now = Date.now();
  const DAY = 86_400_000;

  // 1. Stale epic quests — parent open but no child activity for 7+ days
  const epics = quests.open.filter(q => q.children && q.children.length > 0);
  for (const epic of epics) {
    const lastActivity = Math.max(
      new Date(epic.createdAt).getTime(),
      ...(epic.children ?? []).map(c => new Date(c.createdAt).getTime()),
    );
    const staleDays = Math.floor((now - lastActivity) / DAY);
    if (staleDays >= 7) {
      suggestions.push({
        id: `stale-${epic.id}`,
        icon: "🕸",
        title: `Epic "${epic.title}" is stale`,
        body: `No sub-quest activity for ${staleDays} days. Consider breaking it down or reassigning.`,
        accent: "#f59e0b",
        accentBg: "rgba(245,158,11,0.08)",
      });
    }
  }

  // 2. Recurring quests not recently completed (no completion in last recurrence window)
  const recurringOpen = quests.open.filter(q => q.recurrence);
  for (const q of recurringOpen) {
    const windowDays = q.recurrence === "daily" ? 1 : q.recurrence === "weekly" ? 7 : 30;
    const age = (now - new Date(q.createdAt).getTime()) / DAY;
    if (age >= windowDays) {
      suggestions.push({
        id: `recurring-${q.id}`,
        icon: "🔁",
        title: `Recurring quest overdue: "${q.title}"`,
        body: `Scheduled ${q.recurrence} — created ${Math.floor(age)}d ago with no completion recorded.`,
        accent: "#6366f1",
        accentBg: "rgba(99,102,241,0.08)",
      });
    }
  }

  // 3. High-priority pile — 3+ high-priority open quests unclaimed
  const highOpen = quests.open.filter(q => q.priority === "high" && !q.claimedBy);
  if (highOpen.length >= 3) {
    suggestions.push({
      id: "high-pile",
      icon: "🔥",
      title: `${highOpen.length} high-priority quests unclaimed`,
      body: `High-value work is piling up: ${highOpen.slice(0, 2).map(q => `"${q.title}"`).join(", ")}${highOpen.length > 2 ? ` +${highOpen.length - 2} more` : ""}. Consider assigning them.`,
      accent: "#ef4444",
      accentBg: "rgba(239,68,68,0.08)",
    });
  }

  // 4. Quest type imbalance — one type dominates > 70% of open quests
  if (quests.open.length >= 5) {
    const typeCounts: Record<string, number> = {};
    for (const q of quests.open) {
      const t = q.type ?? "development";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] / quests.open.length > 0.7) {
      const cfg = typeConfig[dominant[0]];
      suggestions.push({
        id: "type-imbalance",
        icon: "⚖",
        title: `Quest type imbalance: ${Math.round((dominant[1] / quests.open.length) * 100)}% ${cfg?.label ?? dominant[0]}`,
        body: `${dominant[1]} of ${quests.open.length} open quests are ${dominant[0]}. Consider diversifying with personal, learning, or social quests.`,
        accent: cfg?.color ?? "#9ca3af",
        accentBg: cfg?.bg ?? "rgba(156,163,175,0.08)",
      });
    }
  }

  // 5. Idle agents with open quests available
  const idleAgents = agents.filter(a => a.status === "idle");
  if (idleAgents.length > 0 && quests.open.length > 0) {
    suggestions.push({
      id: "idle-agents",
      icon: "💤",
      title: `${idleAgents.length} agent${idleAgents.length > 1 ? "s" : ""} idle with ${quests.open.length} open quest${quests.open.length > 1 ? "s" : ""}`,
      body: `${idleAgents.map(a => a.name).join(", ")} ${idleAgents.length > 1 ? "are" : "is"} idle. There are open quests waiting to be claimed.`,
      accent: "#22c55e",
      accentBg: "rgba(34,197,94,0.08)",
    });
  }

  // 6. No learning quests — encourage knowledge capture
  const hasLearning = [...quests.open, ...quests.inProgress].some(q => q.type === "learning");
  if (!hasLearning && quests.open.length >= 3) {
    suggestions.push({
      id: "no-learning",
      icon: "📚",
      title: "No learning quests active",
      body: "Knowledge capture is missing from the queue. Consider adding a learning quest to build team knowledge.",
      accent: "#3b82f6",
      accentBg: "rgba(59,130,246,0.08)",
    });
  }

  return suggestions;
}

// ─── Relationship Co-op Panel ─────────────────────────────────────────────────

const COOP_TEMPLATES = [
  { id: "weekend_trip", title: "Plan Weekend Trip Together", description: "Research destinations, agree on dates, book accommodation.", icon: "✈️" },
  { id: "cook_dinner", title: "Cook Dinner as a Team", description: "Choose a recipe together, shop ingredients, cook and enjoy.", icon: "🍳" },
  { id: "watch_movie", title: "Movie Night Both Wanted", description: "Pick a movie you've both been wanting to watch, make popcorn.", icon: "🎬" },
  { id: "workout_together", title: "Workout Session Together", description: "Go for a run, gym session, or home workout — both complete it.", icon: "💪" },
  { id: "digital_detox", title: "1-Hour Digital Detox Together", description: "Both put phones away, spend quality time without screens.", icon: "🌿" },
];

function RelationshipCoopPanel({ users, reviewApiKey, onRefresh }: {
  users: User[];
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [partner1, setPartner1] = useState("");
  const [partner2, setPartner2] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userIds = users.map(u => u.id);

  const createCoopQuest = async (template: (typeof COOP_TEMPLATES)[0]) => {
    if (!reviewApiKey || !partner1 || !partner2) return;
    setCreating(template.id);
    try {
      const res = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: template.title,
          description: template.description,
          priority: "medium",
          type: "relationship-coop",
          createdBy: "leon",
          coopPartners: [partner1.toLowerCase(), partner2.toLowerCase()],
        }),
      });
      if (res.ok) {
        setSuccess(template.id);
        setTimeout(() => setSuccess(null), 3000);
        onRefresh();
      }
    } catch { /* ignore */ } finally { setCreating(null); }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f43f5e" }}>
          💞 Relationship Raid Boss
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.3)" }}>
          Co-op Quests
        </span>
      </div>
      <div className="rounded-xl p-4 mb-3" style={{ background: "#252525", border: "1px solid rgba(244,63,94,0.2)" }}>
        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          Co-op quests require both partners to complete their part. Shared XP reward on success!
        </p>
        <div className="flex gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Partner 1</label>
            <select value={partner1} onChange={e => setPartner1(e.target.value)} className="text-xs px-2 py-1.5 rounded" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8" }}>
              <option value="">Select player…</option>
              {userIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Partner 2</label>
            <select value={partner2} onChange={e => setPartner2(e.target.value)} className="text-xs px-2 py-1.5 rounded" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8" }}>
              <option value="">Select player…</option>
              {userIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {COOP_TEMPLATES.map(t => {
          const isCreating = creating === t.id;
          const isDone = success === t.id;
          const canCreate = !!(partner1 && partner2 && partner1 !== partner2);
          return (
            <div key={t.id} className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(244,63,94,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl flex-shrink-0">{t.icon}</span>
                <p className="text-xs font-bold" style={{ color: "#f0f0f0" }}>{t.title}</p>
              </div>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{t.description}</p>
              {reviewApiKey ? (
                <button
                  onClick={() => createCoopQuest(t)}
                  disabled={!canCreate || !!creating}
                  className="action-btn w-full text-xs py-1.5 rounded-lg font-semibold"
                  style={{ background: isDone ? "rgba(34,197,94,0.15)" : canCreate ? "rgba(244,63,94,0.15)" : "rgba(255,255,255,0.04)", color: isDone ? "#22c55e" : canCreate ? "#f43f5e" : "rgba(255,255,255,0.2)", border: `1px solid ${isDone ? "rgba(34,197,94,0.3)" : "rgba(244,63,94,0.3)"}`, cursor: canCreate ? "pointer" : "not-allowed" }}
                >
                  {isDone ? "✓ Co-op Quest Created!" : isCreating ? "Creating…" : canCreate ? "💞 Create Co-op Quest" : "Select both partners first"}
                </button>
              ) : (
                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>Login to create</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── CV Builder Panel ─────────────────────────────────────────────────────────

interface CVData {
  skills: { name: string; count: number; lastEarned: string | null; quests: { id: string; title: string; completedAt: string }[] }[];
  certifications: { title: string; earnedAt: string; questId: string }[];
  totalLearningQuests: number;
}

function CVBuilderPanel({ quests, users, playerName }: { quests: QuestsData; users: User[]; playerName: string }) {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeUser, setActiveUser] = useState(playerName || "");

  const loadCV = async (userId: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/cv-export?userId=${encodeURIComponent(userId)}`);
      if (r.ok) {
        const data = await r.json();
        setCvData(data);
        setOpen(true);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const completedLearning = quests.completed.filter(q => q.type === "learning").length;
  const allLearning = [...quests.open, ...quests.inProgress, ...quests.completed].filter(q => q.type === "learning").length;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#60a5fa" }}>📋 CV Builder</h2>
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}>
            {completedLearning} skills tracked
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{open ? "▲" : "▼"}</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <select value={activeUser} onChange={e => setActiveUser(e.target.value)} className="text-xs px-2 py-1 rounded" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8" }}>
            <option value="">All players</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button onClick={() => loadCV(activeUser || "")} disabled={loading} className="text-xs px-3 py-1 rounded font-medium" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}>
            {loading ? "Loading…" : "Generate CV"}
          </button>
        </div>
      </div>
      {open && cvData && (
        <div className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(96,165,250,0.2)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{activeUser ? `${activeUser}'s Skill Profile` : "All Players Skill Profile"}</p>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{cvData.totalLearningQuests} learning quests completed</span>
          </div>
          {cvData.skills.length === 0 ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No completed learning quests yet. Start a quest chain in the Learning Workshop!</p>
          ) : (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(96,165,250,0.7)" }}>Skill Tree</h3>
              <div className="space-y-2 mb-4">
                {cvData.skills.map(skill => {
                  // Tier thresholds: 1=Novice, 3=Apprentice, 6=Skilled, 10=Expert
                  const tiers = [
                    { label: "Novice",     icon: "🌱", min: 1,  max: 2,  color: "#22c55e" },
                    { label: "Apprentice", icon: "📗", min: 3,  max: 5,  color: "#60a5fa" },
                    { label: "Skilled",    icon: "⚔",  min: 6,  max: 9,  color: "#a78bfa" },
                    { label: "Expert",     icon: "👑", min: 10, max: 999, color: "#fbbf24" },
                  ];
                  const tier = tiers.findLast(t => skill.count >= t.min) ?? tiers[0];
                  const nextTier = tiers[tiers.indexOf(tier) + 1];
                  const progressInTier = nextTier
                    ? ((skill.count - tier.min) / (nextTier.min - tier.min)) * 100
                    : 100;
                  return (
                    <div key={skill.name} className="rounded-lg px-3 py-2" style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.12)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{tier.icon}</span>
                          <span className="text-xs font-medium" style={{ color: "#e8e8e8" }}>{skill.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold" style={{ color: tier.color }}>{tier.label}</span>
                          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>×{skill.count}</span>
                        </div>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${progressInTier}%`, background: tier.color, opacity: 0.7 }}
                        />
                      </div>
                      {nextTier && (
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                          {nextTier.min - skill.count} more to {nextTier.label}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {cvData.certifications.length > 0 && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(251,191,36,0.7)" }}>Certifications</h3>
              <div className="space-y-1">
                {cvData.certifications.map((cert, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span style={{ color: "#fbbf24" }}>🏆</span>
                    <span style={{ color: "#e8e8e8" }}>{cert.title}</span>
                    {cert.earnedAt && <span style={{ color: "rgba(255,255,255,0.3)" }}>{new Date(cert.earnedAt).toLocaleDateString()}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {!open && allLearning > 0 && (
        <div className="flex gap-2 flex-wrap">
          {quests.completed.filter(q => q.type === "learning").slice(0, 6).map(q => (
            <div key={q.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
              <span className="text-xs" style={{ color: "rgba(96,165,250,0.6)" }}>✓</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{q.title}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Dobbie's Demands — NPC Quest Panel ──────────────────────────────────────

const DOBBIE_QUESTS = [
  { id: "feed_dobbie", title: "Feed Dobbie Before 18:00", description: "His Highness demands his meal on time. No excuses.", icon: "🥫", priority: "high" as const },
  { id: "clean_litter", title: "Clean the Litter Box", description: "The sacred ritual must be performed. Dobbie demands cleanliness.", icon: "🧹", priority: "medium" as const },
  { id: "pet_dobbie", title: "Pet Dobbie for 5 Minutes", description: "Five minutes of undivided attention. The minimum acceptable tribute.", icon: "😸", priority: "low" as const },
  { id: "play_time", title: "Interactive Play Session", description: "10 minutes with the wand toy. Dobbie requires stimulation.", icon: "🎾", priority: "low" as const },
  { id: "window_watch", title: "Open Window for Bird Watching", description: "Allow access to the window ledge for prime bird surveillance.", icon: "🐦", priority: "low" as const },
];

const DOBBIE_MOODS = [
  { mood: "😸 Content", color: "#22c55e", quote: "You may proceed. I am… temporarily satisfied." },
  { mood: "😾 Demanding", color: "#f59e0b", quote: "This is taking far too long. My patience wears thin, human." },
  { mood: "😤 Annoyed", color: "#ef4444", quote: "UNACCEPTABLE. The litter box remains unattended. Consequences incoming." },
  { mood: "😻 Affectionate", color: "#ff6b9d", quote: "Fine. You may pet me. BRIEFLY. Do not read into this." },
  { mood: "🙄 Unimpressed", color: "#a78bfa", quote: "You call that a play session? I've seen dust motes with more energy." },
];

function DobbieQuestPanel({ reviewApiKey, onRefresh }: { reviewApiKey: string; onRefresh: () => void }) {
  const [creating, setCreating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const dobbieMood = DOBBIE_MOODS[Math.floor(Date.now() / (1000 * 60 * 60 * 4)) % DOBBIE_MOODS.length];

  const createDobbieQuest = async (q: (typeof DOBBIE_QUESTS)[0]) => {
    if (!reviewApiKey) return;
    setCreating(q.id);
    try {
      const res = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: q.title,
          description: q.description,
          priority: q.priority,
          type: "personal",
          createdBy: "dobbie",
          recurrence: "daily",
        }),
      });
      if (res.ok) {
        setSuccess(q.id);
        setTimeout(() => setSuccess(null), 3000);
        onRefresh();
      }
    } catch { /* ignore */ } finally { setCreating(null); }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#ff6b9d" }}>
          🐱 Dobbie&apos;s Demands
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,107,157,0.12)", color: "#ff6b9d", border: "1px solid rgba(255,107,157,0.3)" }}>
          NPC Quest Giver
        </span>
      </div>
      <div className="rounded-xl p-3 mb-3 flex items-center gap-3" style={{ background: "rgba(255,107,157,0.06)", border: "1px solid rgba(255,107,157,0.2)" }}>
        <span className="text-3xl flex-shrink-0">🐱</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold" style={{ color: "#ff6b9d" }}>Dobbie — Cat Overlord</p>
            <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: dobbieMood.color, background: `${dobbieMood.color}18`, border: `1px solid ${dobbieMood.color}40` }}>{dobbieMood.mood}</span>
          </div>
          <p className="text-xs mt-0.5 italic" style={{ color: "rgba(255,255,255,0.35)" }}>&ldquo;{dobbieMood.quote}&rdquo;</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DOBBIE_QUESTS.map(q => {
          const isCreating = creating === q.id;
          const isDone = success === q.id;
          return (
            <div key={q.id} className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(255,107,157,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl flex-shrink-0">{q.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "#f0f0f0" }}>{q.title}</p>
                  <span className="text-xs" style={{ color: q.priority === "high" ? "#ef4444" : q.priority === "medium" ? "#f59e0b" : "#22c55e" }}>{q.priority}</span>
                </div>
              </div>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{q.description}</p>
              <button
                onClick={() => createDobbieQuest(q)}
                disabled={!!creating}
                className="action-btn w-full text-xs py-1.5 rounded-lg font-semibold"
                style={{ background: isDone ? "rgba(34,197,94,0.15)" : "rgba(255,107,157,0.15)", color: isDone ? "#22c55e" : "#ff6b9d", border: `1px solid ${isDone ? "rgba(34,197,94,0.3)" : "rgba(255,107,157,0.3)"}` }}
              >
                {isDone ? "✓ Quest Issued!" : isCreating ? "Issuing…" : "🐱 Issue Quest"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SmartSuggestionsPanel({ quests, agents }: { quests: QuestsData; agents: Agent[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dismissed_suggestions") ?? "[]")); } catch { return new Set(); }
  });
  const [open, setOpen] = useState(true);

  const allSuggestions = buildSuggestions(quests, agents);
  const visible = allSuggestions.filter(s => !dismissed.has(s.id));

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    try { localStorage.setItem("dismissed_suggestions", JSON.stringify([...next])); } catch { /* ignore */ }
  };

  if (visible.length === 0) return null;

  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#a855f7" }}>
          ✦ Smart Suggestions
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}>
          {visible.length}
        </span>
        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="space-y-2">
          {visible.map(s => (
            <div
              key={s.id}
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: s.accentBg, border: `1px solid ${s.accent}30` }}
            >
              <span className="text-lg flex-shrink-0 leading-none mt-0.5">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: s.accent }}>{s.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{s.body}</p>
              </div>
              <button
                onClick={() => dismiss(s.id)}
                className="flex-shrink-0 text-xs px-2 py-1 rounded transition-all"
                style={{ color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)" }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Learning Quest Panel ──────────────────────────────────────────────────────

const LEARNING_TEMPLATES = [
  {
    id: "js_mastery",
    name: "JavaScript Mastery",
    icon: "💛",
    steps: ["Read MDN fundamentals", "Complete 5 coding exercises", "Build a mini project", "Write what you learned (proof)"],
  },
  {
    id: "design_system",
    name: "Design System Study",
    icon: "🎨",
    steps: ["Study color theory & typography", "Analyze 3 design systems", "Create a component sketch", "Document findings (proof)"],
  },
  {
    id: "habit_reading",
    name: "Daily 10-Page Reading",
    icon: "📖",
    steps: ["Choose your book", "Read 10 pages", "Take margin notes", "Share 1 key insight (proof)"],
  },
  {
    id: "language",
    name: "Language Practice",
    icon: "🌍",
    steps: ["30 min Duolingo/Anki", "Learn 5 new vocab words", "Practice 1 conversation", "Journal in target language (proof)"],
  },
];

function LearningQuestPanel({ quests, reviewApiKey, onRefresh }: {
  quests: QuestsData;
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const learningActive = [...quests.open, ...quests.inProgress].filter(q => q.type === "learning");
  const learningDone = quests.completed.filter(q => q.type === "learning").length;

  const createChain = async (template: (typeof LEARNING_TEMPLATES)[0]) => {
    if (!reviewApiKey) return;
    setCreating(template.id);
    try {
      const res = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: template.name,
          description: `Learning quest chain: ${template.name}`,
          priority: "medium",
          type: "learning",
          createdBy: "leon",
        }),
      });
      if (!res.ok) return;
      const { quest: parent } = await res.json();
      for (const step of template.steps) {
        await fetch("/api/quest", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
          body: JSON.stringify({
            title: step,
            priority: "low",
            type: "learning",
            parentQuestId: parent.id,
            createdBy: "leon",
          }),
        });
      }
      setSuccess(template.id);
      setTimeout(() => setSuccess(null), 3000);
      onRefresh();
    } catch { /* ignore */ } finally {
      setCreating(null);
    }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#3b82f6" }}>
          📚 Learning Workshop
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" }}>
          {learningActive.length} active · {learningDone} done
        </span>
      </div>

      {learningActive.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {learningActive.slice(0, 4).map(q => (
            <div key={q.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <span className="text-xs" style={{ color: "rgba(59,130,246,0.7)" }}>📚</span>
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{q.title}</span>
              {q.progress && (
                <span className="text-xs font-mono" style={{ color: "#3b82f6" }}>{q.progress.completed}/{q.progress.total}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {LEARNING_TEMPLATES.map(t => {
          const isCreating = creating === t.id;
          const isDone = success === t.id;
          return (
            <div key={t.id} className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(59,130,246,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl flex-shrink-0">{t.icon}</span>
                <p className="text-xs font-bold" style={{ color: "#f0f0f0" }}>{t.name}</p>
              </div>
              <div className="space-y-1 mb-3">
                {t.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: "rgba(59,130,246,0.5)" }}>◦</span>
                    <span className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.4)" }}>{step}</span>
                  </div>
                ))}
              </div>
              {reviewApiKey ? (
                <button
                  onClick={() => createChain(t)}
                  disabled={!!creating}
                  className="action-btn btn-primary w-full text-xs py-1.5 rounded-lg font-semibold"
                  style={{
                    background: isDone ? "rgba(34,197,94,0.15)" : isCreating ? "rgba(255,255,255,0.04)" : "rgba(59,130,246,0.15)",
                    color: isDone ? "#22c55e" : isCreating ? "rgba(255,255,255,0.3)" : "#3b82f6",
                    border: `1px solid ${isDone ? "rgba(34,197,94,0.3)" : "rgba(59,130,246,0.3)"}`,
                  }}
                >
                  {isDone ? "✓ Quest Chain Created!" : isCreating ? "Creating…" : "📚 Start Quest Chain"}
                </button>
              ) : (
                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>Login to create</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Household Quest Board ────────────────────────────────────────────────────

const CHORE_TEMPLATES = [
  { title: "Vacuum the apartment", recurrence: "weekly", priority: "low"    as Quest["priority"] },
  { title: "Clean bathroom",       recurrence: "weekly", priority: "medium" as Quest["priority"] },
  { title: "Do laundry",           recurrence: "weekly", priority: "medium" as Quest["priority"] },
  { title: "Wash dishes",          recurrence: "daily",  priority: "low"    as Quest["priority"] },
  { title: "Take out trash",       recurrence: "weekly", priority: "low"    as Quest["priority"] },
  { title: "Grocery shopping",     recurrence: "weekly", priority: "medium" as Quest["priority"] },
];

function HouseholdQuestBoard({ quests, users, reviewApiKey, onRefresh }: {
  quests: QuestsData;
  users: User[];
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [rotating, setRotating] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const householdQuests = [...quests.open, ...quests.inProgress].filter(
    q => q.type === "personal" && q.recurrence
  );

  const rotate = async () => {
    if (!reviewApiKey || users.length === 0 || householdQuests.length === 0) return;
    setRotating(true);
    try {
      await fetch("/api/quests/household-rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({ assignees: users.map(u => u.id) }),
      });
      onRefresh();
    } catch { /* ignore */ } finally {
      setRotating(false);
    }
  };

  const addChore = async (chore: (typeof CHORE_TEMPLATES)[0]) => {
    if (!reviewApiKey) return;
    setAdding(chore.title);
    try {
      await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: chore.title,
          type: "personal",
          priority: chore.priority,
          recurrence: chore.recurrence,
          createdBy: "leon",
        }),
      });
      onRefresh();
    } catch { /* ignore */ } finally {
      setAdding(null);
    }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#22c55e" }}>
          🏠 Household Board
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
          {householdQuests.length} chores
        </span>
        {reviewApiKey && users.length > 0 && (
          <button
            onClick={rotate}
            disabled={rotating || householdQuests.length === 0}
            className="action-btn btn-approve ml-auto text-xs px-3 py-1 rounded-lg"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            {rotating ? "Rotating…" : "↻ Rotate Assignments"}
          </button>
        )}
      </div>

      {householdQuests.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
          {householdQuests.map(q => (
            <div key={q.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: "#252525", border: "1px solid rgba(34,197,94,0.15)" }}>
              <span className="text-base flex-shrink-0">🏠</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "#e8e8e8" }}>{q.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {q.recurrence && <RecurringBadge recurrence={q.recurrence} />}
                  {q.claimedBy && (
                    <span className="text-xs" style={{ color: "rgba(34,197,94,0.7)" }}>→ {q.claimedBy}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-3 mb-3" style={{ background: "#252525", border: "1px solid rgba(34,197,94,0.1)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No recurring household chores yet. Add some below.</p>
        </div>
      )}

      {reviewApiKey && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CHORE_TEMPLATES.map(c => (
            <button
              key={c.title}
              onClick={() => addChore(c)}
              disabled={!!adding}
              className="action-btn text-xs px-2 py-1.5 rounded-lg text-left truncate"
              style={{
                background: adding === c.title ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              + {c.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Thoughtful Hero Panel ─────────────────────────────────────────────────────

const THOUGHTFUL_PROMPTS = [
  { icon: "🎁", title: "Gift Idea Reminder",  desc: "Note a gift idea for someone special",                 priority: "low"    as Quest["priority"] },
  { icon: "📞", title: "Call Reminder",        desc: "Schedule a call with someone you care about",          priority: "medium" as Quest["priority"] },
  { icon: "🌹", title: "Plan Date Night",      desc: "Plan a special date or quality time together",         priority: "high"   as Quest["priority"] },
  { icon: "💌", title: "Send a Kind Message",  desc: "Reach out and say something thoughtful",               priority: "low"    as Quest["priority"] },
  { icon: "🥂", title: "Celebrate Someone",    desc: "Celebrate an achievement or milestone in their life",  priority: "medium" as Quest["priority"] },
  { icon: "🤝", title: "Check In",             desc: "Check in on a friend or family member",                priority: "low"    as Quest["priority"] },
];

function ThoughtfulHeroPanel({ quests, reviewApiKey, onRefresh }: {
  quests: QuestsData;
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState<string | null>(null);

  const socialActive = [...quests.open, ...quests.inProgress].filter(q => q.type === "social");

  const createPrompt = async (prompt: (typeof THOUGHTFUL_PROMPTS)[0]) => {
    if (!reviewApiKey) return;
    setCreating(prompt.title);
    try {
      await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: prompt.title,
          description: prompt.desc,
          type: "social",
          priority: prompt.priority,
          createdBy: "leon",
        }),
      });
      onRefresh();
    } catch { /* ignore */ } finally {
      setCreating(null);
    }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#ec4899" }}>
          ❤ Thoughtful Hero
        </h2>
        {socialActive.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(236,72,153,0.12)", color: "#ec4899", border: "1px solid rgba(236,72,153,0.3)" }}>
            {socialActive.length} active
          </span>
        )}
      </div>

      {socialActive.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {socialActive.slice(0, 5).map(q => (
            <span
              key={q.id}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: "rgba(236,72,153,0.08)", color: "rgba(236,72,153,0.8)", border: "1px solid rgba(236,72,153,0.2)" }}
            >
              {q.title}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {THOUGHTFUL_PROMPTS.map(p => (
          <button
            key={p.title}
            onClick={() => createPrompt(p)}
            disabled={!reviewApiKey || !!creating}
            title={p.desc}
            className="action-btn btn-social rounded-xl p-3 flex flex-col items-center gap-1.5"
            style={{
              background: creating === p.title ? "rgba(236,72,153,0.15)" : "#252525",
              border: `1px solid ${creating === p.title ? "rgba(236,72,153,0.45)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <span className="text-xl">{p.icon}</span>
            <p className="text-xs font-medium leading-tight text-center" style={{ color: "#e8e8e8" }}>{p.title}</p>
          </button>
        ))}
      </div>
      {!reviewApiKey && (
        <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>Log in to create social quests</p>
      )}
    </section>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const cfg = categoryConfig[category] ?? { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" };
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
    >
      {category}
    </span>
  );
}

function ProductBadge({ product }: { product: string }) {
  const cfg = productConfig[product] ?? { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" };
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, fontStyle: "italic" }}
    >
      {product}
    </span>
  );
}

function HumanInputBadge() {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
      style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
    >
      👤 Needs Leon
    </span>
  );
}

function TypeBadge({ type }: { type?: string }) {
  const cfg = typeConfig[type ?? "development"] ?? typeConfig.development;
  if (!type || type === "development") return null;
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

const NPC_CONFIG: Record<string, { avatar: string; color: string }> = {
  dobbie:     { avatar: "🐱", color: "#ff6b9d" },
  "npc-dobbie": { avatar: "🐱", color: "#ff6b9d" },
};

function CreatorBadge({ name }: { name: string }) {
  const npc = NPC_CONFIG[name.toLowerCase()];
  if (npc) {
    return (
      <span
        className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ color: npc.color, background: `${npc.color}18`, border: `1px solid ${npc.color}50` }}
        title={`Quest from ${name}`}
      >
        {npc.avatar} {name.charAt(0).toUpperCase() + name.slice(1)}
      </span>
    );
  }
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}
    >
      🤖 {name.charAt(0).toUpperCase() + name.slice(1)}
    </span>
  );
}

function AgentBadge({ name }: { name: string }) {
  return <CreatorBadge name={name} />;
}

function RecurringBadge({ recurrence }: { recurrence: string }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: "#6366f1", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}
      title={`Recurring: ${recurrence}`}
    >
      🔁 {recurrence}
    </span>
  );
}

function CompletedQuestRow({ quest, isLast }: { quest: Quest; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);
  return (
    <div
      style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)" }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xs font-mono flex-shrink-0" style={{ color: "rgba(34,197,94,0.6)" }}>✓</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{quest.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              by <span style={{ color: "rgba(255,255,255,0.35)" }}>{quest.completedBy}</span>
            </span>
            {quest.humanInputRequired && (
              <span className="text-xs" style={{ color: "rgba(245,158,11,0.6)" }}>👤</span>
            )}
          </div>
        </div>
        <PriorityBadge priority={quest.priority} />
        <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
          {quest.completedAt ? timeAgo(quest.completedAt) : "—"}
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
          {quest.description && (
            <p className="text-xs leading-relaxed pt-2" style={{ color: "rgba(255,255,255,0.4)" }}>{quest.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {cats.map(c => <CategoryBadge key={c} category={c} />)}
            {quest.product && <ProductBadge product={quest.product} />}
          </div>
          {quest.proof && (
            <div className="mt-2 p-2 rounded" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "rgba(59,130,246,0.7)" }}>📖 Learning Proof</p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.4)" }}>
                {quest.proof.length > 300 ? quest.proof.slice(0, 297) + "…" : quest.proof}
              </p>
            </div>
          )}
          {quest.lore && (
            <p className="text-xs italic" style={{ color: "rgba(167,139,250,0.5)", borderLeft: "2px solid rgba(139,92,246,0.2)", paddingLeft: "8px" }}>
              ✨ {quest.lore}
            </p>
          )}
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Completed {quest.completedAt ? timeAgo(quest.completedAt) : "—"} · by {quest.completedBy}
          </p>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Quest["priority"] }) {
  const cfg = priorityConfig[priority] ?? priorityConfig.medium;
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

function ClickablePriorityBadge({ priority, onClick }: { priority: Quest["priority"]; onClick: () => void }) {
  const cfg = priorityConfig[priority] ?? priorityConfig.medium;
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title="Click to cycle priority"
      className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: "pointer" }}
    >
      {cfg.label} ↑
    </button>
  );
}

function QuestCard({ quest, selected, onToggle, onClaim, onUnclaim, onComplete, onCoopClaim, onCoopComplete, playerName }: {
  quest: Quest;
  selected?: boolean;
  onToggle?: (id: string) => void;
  onClaim?: (id: string) => void;
  onUnclaim?: (id: string) => void;
  onComplete?: (id: string, title: string) => void;
  onCoopClaim?: (id: string) => void;
  onCoopComplete?: (id: string) => void;
  playerName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = quest.status === "in_progress";
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);
  const isClaimedByMe = playerName && quest.claimedBy?.toLowerCase() === playerName.toLowerCase();
  const isCoop = quest.type === "relationship-coop";
  const coopPartners = quest.coopPartners ?? [];
  const coopClaimed = quest.coopClaimed ?? [];
  const coopCompletions = quest.coopCompletions ?? [];
  const isCoopPartner = playerName ? coopPartners.includes(playerName.toLowerCase()) : false;
  const hasCoopClaimed = playerName ? coopClaimed.includes(playerName.toLowerCase()) : false;
  const hasCoopCompleted = playerName ? coopCompletions.includes(playerName.toLowerCase()) : false;

  return (
    <div
      className="rounded-lg p-3 cursor-pointer"
      style={{
        background: selected ? "rgba(255,102,51,0.06)" : "#252525",
        border: `1px solid ${selected ? "rgba(255,102,51,0.4)" : isInProgress ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.07)"}`,
        transform: "translateY(0)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
      }}
      onClick={() => setExpanded(v => !v)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = selected ? "rgba(255,102,51,0.6)" : isInProgress ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.18)";
        el.style.boxShadow = isInProgress ? "0 8px 24px rgba(139,92,246,0.2)" : "0 8px 24px rgba(255,68,68,0.2)";
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = selected ? "rgba(255,102,51,0.4)" : isInProgress ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.07)";
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
      }}
    >
      <div className="flex items-start gap-2">
        {onToggle && (
          <button
            onClick={e => { e.stopPropagation(); onToggle(quest.id); }}
            className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
            style={{
              background: selected ? "rgba(255,102,51,0.8)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${selected ? "rgba(255,102,51,0.9)" : "rgba(255,255,255,0.15)"}`,
            }}
          >
            {selected && <span style={{ color: "#fff", fontSize: "8px", lineHeight: 1 }}>✓</span>}
          </button>
        )}
        {!onToggle && isInProgress && (
          <span
            className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6", animation: "pulse 1.5s ease-in-out infinite" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium truncate flex-1" style={{ color: "#e8e8e8" }}>{quest.title}</p>
            {quest.humanInputRequired && <HumanInputBadge />}
            {quest.createdBy && quest.createdBy !== "leon" && quest.createdBy !== "unknown" && (
              <AgentBadge name={quest.createdBy} />
            )}
            <PriorityBadge priority={quest.priority} />
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <TypeBadge type={quest.type} />
            {quest.recurrence && <RecurringBadge recurrence={quest.recurrence} />}
            {cats.map(c => <CategoryBadge key={c} category={c} />)}
            {quest.product && <ProductBadge product={quest.product} />}
            {isInProgress && quest.claimedBy && !isCoop && (
              <span className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ {quest.claimedBy}</span>
            )}
          </div>
          {isCoop && coopPartners.length > 0 && (
            <div className="mt-2">
              {/* Raid HP bar — decreases as partners complete */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold" style={{ color: "#f43f5e" }}>💞 Raid HP</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(0, 100 - (coopCompletions.length / coopPartners.length) * 100)}%`,
                      background: coopCompletions.length === coopPartners.length
                        ? "rgba(34,197,94,0.5)"
                        : "linear-gradient(90deg, #f43f5e, #fb7185)",
                      boxShadow: coopCompletions.length < coopPartners.length ? "0 0 6px rgba(244,63,94,0.5)" : "none",
                    }}
                  />
                </div>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{coopCompletions.length}/{coopPartners.length}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {coopPartners.map(p => {
                  const done = coopCompletions.includes(p);
                  const claimed = coopClaimed.includes(p);
                  return (
                    <span key={p} className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                      style={{ background: done ? "rgba(34,197,94,0.1)" : claimed ? "rgba(244,63,94,0.1)" : "rgba(255,255,255,0.05)", color: done ? "#22c55e" : claimed ? "#f43f5e" : "rgba(255,255,255,0.3)", border: `1px solid ${done ? "rgba(34,197,94,0.3)" : claimed ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.1)"}` }}
                    >
                      {done ? "✓" : claimed ? "⚔" : "○"} {p}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {expanded && quest.description && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{quest.description}</p>
          )}
          {expanded && quest.lore && (
            <p className="text-xs mt-1.5 leading-relaxed italic" style={{ color: "rgba(167,139,250,0.6)", borderLeft: "2px solid rgba(139,92,246,0.25)", paddingLeft: "8px" }}>
              ✨ {quest.lore}
            </p>
          )}
          {expanded && quest.chapter && (
            <span className="inline-flex text-xs mt-1 px-1.5 py-0.5 rounded" style={{ color: "rgba(251,191,36,0.7)", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
              📖 {quest.chapter}
            </span>
          )}
          {expanded && quest.checklist && quest.checklist.length > 0 && (
            <div className="mt-2 space-y-1">
              {quest.checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span style={{ color: item.done ? "#22c55e" : "rgba(255,255,255,0.25)" }}>{item.done ? "☑" : "☐"}</span>
                  <span style={{ color: item.done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{timeAgo(quest.createdAt)}</p>
            <div className="flex items-center gap-1.5">
              {!isCoop && onClaim && quest.status === "open" && (
                <button onClick={e => { e.stopPropagation(); onClaim(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>⚔ Claim</button>
              )}
              {!isCoop && onUnclaim && isClaimedByMe && (
                <button onClick={e => { e.stopPropagation(); onUnclaim(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>✕ Unclaim</button>
              )}
              {!isCoop && onComplete && isClaimedByMe && (
                <button onClick={e => { e.stopPropagation(); onComplete(quest.id, quest.title); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>✓ Done</button>
              )}
              {isCoop && isCoopPartner && !hasCoopClaimed && quest.status !== "completed" && onCoopClaim && (
                <button onClick={e => { e.stopPropagation(); onCoopClaim(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.3)" }}>💞 Join</button>
              )}
              {isCoop && isCoopPartner && hasCoopClaimed && !hasCoopCompleted && quest.status !== "completed" && onCoopComplete && (
                <button onClick={e => { e.stopPropagation(); onCoopComplete(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>✓ My Part Done</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EpicQuestCard({ quest, selected, onToggle }: { quest: Quest; selected?: boolean; onToggle?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = quest.status === "in_progress";
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);
  const progress = quest.progress;
  const children = quest.children ?? [];
  const progressPct = progress && progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div
      className="rounded-lg cursor-pointer"
      style={{
        background: selected ? "rgba(255,102,51,0.06)" : "#252525",
        border: `1px solid ${selected ? "rgba(255,102,51,0.4)" : "rgba(255,165,0,0.3)"}`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(255,165,0,0.15)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      {/* Header row */}
      <div className="p-3" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-2">
          {onToggle && (
            <button
              onClick={e => { e.stopPropagation(); onToggle(quest.id); }}
              className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
              style={{
                background: selected ? "rgba(255,102,51,0.8)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${selected ? "rgba(255,102,51,0.9)" : "rgba(255,255,255,0.15)"}`,
              }}
            >
              {selected && <span style={{ color: "#fff", fontSize: "8px", lineHeight: 1 }}>✓</span>}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,165,0,0.7)" }}>◆</span>
              <p className="text-xs font-semibold truncate flex-1" style={{ color: "#e8e8e8" }}>{quest.title}</p>
              {quest.humanInputRequired && <HumanInputBadge />}
              <PriorityBadge priority={quest.priority} />
              <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
                {expanded ? "▲" : "▼"}
              </span>
            </div>
            {/* Progress bar / Boss HP bar */}
            {progress && progress.total > 0 && (
              <div className="mt-2">
                {quest.type === "boss" ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                        🐉 Boss HP
                      </span>
                      <span className="text-xs font-mono" style={{ color: progressPct === 100 ? "#22c55e" : "#ef4444" }}>
                        {progressPct === 100 ? "DEFEATED!" : `${Math.round(100 - progressPct)}% HP`}
                      </span>
                    </div>
                    <div className="w-full rounded-full" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="rounded-full transition-all duration-700"
                        style={{
                          height: 6,
                          width: `${Math.max(0, 100 - progressPct)}%`,
                          background: progressPct >= 70 ? "#22c55e" : progressPct >= 40 ? "#f59e0b" : "linear-gradient(90deg, #ef4444, #ff6b00)",
                          boxShadow: progressPct < 40 ? "0 0 8px rgba(239,68,68,0.6)" : "none",
                        }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{progress.completed}/{progress.total} sub-quests dealt damage</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {progress.completed}/{progress.total} sub-quests
                      </span>
                      <span className="text-xs font-mono" style={{ color: progressPct === 100 ? "#22c55e" : "rgba(255,165,0,0.7)" }}>
                        {Math.round(progressPct)}%
                      </span>
                    </div>
                    <div className="w-full rounded-full" style={{ height: 4, background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="rounded-full"
                        style={{
                          height: 4,
                          width: `${progressPct}%`,
                          background: progressPct === 0
                            ? "#ef4444"
                            : progressPct === 100
                              ? "#22c55e"
                              : `linear-gradient(90deg, #ef4444 0%, #f59e0b ${Math.round(progressPct * 0.8)}%, #22c55e 100%)`,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <TypeBadge type={quest.type} />
              {quest.recurrence && <RecurringBadge recurrence={quest.recurrence} />}
              {cats.map(c => <CategoryBadge key={c} category={c} />)}
              {quest.product && <ProductBadge product={quest.product} />}
              {isInProgress && quest.claimedBy && (
                <span className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ {quest.claimedBy}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Sub-quests */}
      {expanded && children.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {children.map((child, i) => (
            <div
              key={child.id}
              className="flex items-center gap-2 px-3 py-2"
              style={{
                borderBottom: i === children.length - 1 ? "none" : "1px solid rgba(255,255,255,0.03)",
                background: "rgba(0,0,0,0.15)",
              }}
            >
              <span className="text-xs flex-shrink-0" style={{ color: child.status === "completed" ? "#22c55e" : "rgba(255,255,255,0.2)", marginLeft: 12 }}>
                {child.status === "completed" ? "✓" : "◦"}
              </span>
              <p
                className="text-xs flex-1 truncate"
                style={{ color: child.status === "completed" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.65)", textDecoration: child.status === "completed" ? "line-through" : "none" }}
              >
                {child.title}
              </p>
              <PriorityBadge priority={child.priority} />
              {child.claimedBy && (
                <span className="text-xs flex-shrink-0" style={{ color: "rgba(139,92,246,0.6)" }}>{child.claimedBy}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Season helpers ──────────────────────────────────────────────────────────
function getSeason() {
  const m = new Date().getMonth(); // 0=Jan
  if (m >= 2 && m <= 4) return { name: "Spring", icon: "🌸", color: "#ec4899", bg: "rgba(236,72,153,0.1)", particle: "rgba(255,182,193," };
  if (m >= 5 && m <= 7) return { name: "Summer", icon: "☀️", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", particle: "rgba(255,220,100," };
  if (m >= 8 && m <= 10) return { name: "Autumn", icon: "🍂", color: "#f97316", bg: "rgba(249,115,22,0.1)", particle: "rgba(255,140,50," };
  return { name: "Winter", icon: "❄️", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", particle: "rgba(180,220,255," };
}
const CURRENT_SEASON = getSeason();

// ─── XP helpers (shared with UserCard) ──────────────────────────────────────
const USER_LEVELS = [
  { name: "Novice",     min: 0,   max: 99,  color: "#9ca3af" },
  { name: "Apprentice", min: 100, max: 299, color: "#22c55e" },
  { name: "Knight",     min: 300, max: 599, color: "#3b82f6" },
  { name: "Archmage",   min: 600, max: Infinity, color: "#a855f7" },
];
function getUserLevel(xp: number) { return USER_LEVELS.findLast(l => xp >= l.min) ?? USER_LEVELS[0]; }
function getUserXpProgress(xp: number) {
  const l = getUserLevel(xp);
  if (l.max === Infinity) return 1;
  return (xp - l.min) / (l.max - l.min + 1);
}

function UserCard({ user, onShopOpen }: { user: User; onShopOpen?: (userId: string) => void }) {
  const xp = user.xp ?? 0;
  const lvl = getUserLevel(xp);
  const progress = getUserXpProgress(xp);
  const nextLvl = USER_LEVELS[USER_LEVELS.indexOf(lvl) + 1];
  const streak = user.streakDays ?? 0;
  const temp = user.forgeTemp ?? 100;
  const gold = user.gold ?? 0;
  const achs = user.earnedAchievements ?? [];
  const tempColor = temp >= 60 ? "#22c55e" : temp >= 30 ? "#f59e0b" : "#ef4444";
  const xpMalus = temp === 0;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "#252525", border: `1px solid ${lvl.color}30`, boxShadow: `0 0 16px ${lvl.color}10` }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${user.color}, ${user.color}99)`, boxShadow: `0 4px 14px ${user.color}50`, color: "#fff" }}
        >
          {user.avatar}
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
                🔥{streak}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold" style={{ color: lvl.color }}>{lvl.name}</p>
        </div>
        {/* Gold + Shop */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-mono font-bold" style={{ color: "#f59e0b" }} title="Gold">🪙 {gold}</span>
          {onShopOpen && (
            <button
              onClick={() => onShopOpen(user.id)}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              Shop
            </button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Quests</span>
          <span className="text-xs font-mono font-medium" style={{ color: "#8b5cf6" }}>{user.questsCompleted ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>XP{xpMalus ? " ⚠ −50%" : ""}</span>
          <span className="text-xs font-mono font-medium" style={{ color: xpMalus ? "#ef4444" : lvl.color }}>{xp}{nextLvl ? ` / ${nextLvl.min}` : " MAX"}</span>
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
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Forge Temp {temp < 30 ? "⚠ Cooling!" : CURRENT_SEASON.icon}
          </span>
          <span className="text-xs font-mono" style={{ color: tempColor }}>{temp}%</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${temp}%`, background: `linear-gradient(90deg, ${tempColor}99, ${CURRENT_SEASON.color})`, boxShadow: `0 0 5px ${tempColor}60` }}
          />
        </div>
      </div>

      {/* Gear badge */}
      {user.gear && user.gear !== "worn" && (() => {
        const GEAR_ICONS: Record<string, { icon: string; name: string; bonus: number }> = {
          sturdy:     { icon: "⚒",  name: "Sturdy Tools",     bonus: 5  },
          masterwork: { icon: "🛠",  name: "Masterwork Tools", bonus: 10 },
          legendary:  { icon: "⚙",  name: "Legendary Tools",  bonus: 15 },
          mythic:     { icon: "🔱", name: "Mythic Forge",     bonus: 25 },
        };
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

      {/* Companions with Moods */}
      {(() => {
        const COMPANION_IDS = ["ember_sprite", "lore_owl", "gear_golem"];
        const COMPANION_META: Record<string, { icon: string; name: string }> = {
          ember_sprite: { icon: "🔮", name: "Ember Sprite" },
          lore_owl:     { icon: "🦉", name: "Lore Owl" },
          gear_golem:   { icon: "🤖", name: "Gear Golem" },
        };
        const companions = achs.filter(a => COMPANION_IDS.includes(a.id));
        if (companions.length === 0) return null;
        // Companion mood based on streak
        const mood = streak >= 7 ? { emoji: "😊", label: "happy", anim: "animate-bounce", tip: "Happy! Keep the streak going!" }
                   : streak >= 3 ? { emoji: "😐", label: "neutral", anim: "", tip: "Neutral. Complete quests to cheer them up!" }
                   : { emoji: "😔", label: "sad", anim: "animate-pulse", tip: "Sad. No recent quests — your companions miss you!" };
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
                  {COMPANION_META[c.id]?.icon ?? c.icon}
                </span>
              ))}
              <span className="text-xs ml-auto" style={{ color: "rgba(99,102,241,0.5)" }}>+{companions.length * 2}% XP</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs" title={mood.tip}>{mood.emoji}</span>
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
              {a.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shop Modal ───────────────────────────────────────────────────────────────
interface ShopItem { id: string; name: string; cost: number; icon: string; desc: string; }

const GEAR_TIERS_CLIENT = [
  { id: "worn",       name: "Worn Tools",       cost: 0,    tier: 0, xpBonus: 0,  icon: "🔨", desc: "Starting gear. No bonus." },
  { id: "sturdy",     name: "Sturdy Tools",     cost: 100,  tier: 1, xpBonus: 5,  icon: "⚒",  desc: "+5% XP on all quests" },
  { id: "masterwork", name: "Masterwork Tools", cost: 300,  tier: 2, xpBonus: 10, icon: "🛠",  desc: "+10% XP on all quests" },
  { id: "legendary",  name: "Legendary Tools",  cost: 700,  tier: 3, xpBonus: 15, icon: "⚙",  desc: "+15% XP on all quests" },
  { id: "mythic",     name: "Mythic Forge",     cost: 1500, tier: 4, xpBonus: 25, icon: "🔱", desc: "+25% XP on all quests" },
];

function ShopModal({ userId, userName, gold, currentGear, onClose, onBuy, onGearBuy }: {
  userId: string;
  userName: string;
  gold: number;
  currentGear?: string;
  onClose: () => void;
  onBuy: (itemId: string) => void;
  onGearBuy?: (gearId: string) => void;
}) {
  const ITEMS: ShopItem[] = [
    { id: "gaming_1h",   name: "1h Gaming",    cost: 100, icon: "🎮", desc: "1 hour of guilt-free gaming" },
    { id: "snack_break", name: "Snack Break",   cost: 25,  icon: "🍕", desc: "Treat yourself to a snack" },
    { id: "day_off",     name: "Day Off Quest", cost: 500, icon: "🏖", desc: "Skip one day of recurring quests" },
    { id: "movie_night", name: "Movie Night",   cost: 150, icon: "🎬", desc: "Evening off for a movie" },
    { id: "sleep_in",    name: "Sleep In",      cost: 75,  icon: "😴", desc: "Extra hour of sleep, guilt-free" },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-5 w-full max-w-sm"
        style={{ background: "#1e1e1e", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 40px rgba(245,158,11,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>⚒ Forge Shop</h3>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{userName} · 🪙 {gold} gold</p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {ITEMS.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{item.name}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{item.desc}</p>
              </div>
              <button
                onClick={() => onBuy(item.id)}
                disabled={gold < item.cost}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                style={{
                  background: gold >= item.cost ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                  color: gold >= item.cost ? "#f59e0b" : "rgba(255,255,255,0.2)",
                  border: `1px solid ${gold >= item.cost ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
                  cursor: gold >= item.cost ? "pointer" : "not-allowed",
                }}
              >
                🪙 {item.cost}
              </button>
            </div>
          ))}

          {/* Gear upgrade section */}
          {onGearBuy && (
            <>
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(99,102,241,0.7)" }}>⚒ Workshop Tools</p>
              </div>
              {GEAR_TIERS_CLIENT.filter(g => g.tier > 0).map(gear => {
                const currentTier = GEAR_TIERS_CLIENT.find(g => g.id === (currentGear || "worn"))?.tier ?? 0;
                const owned = gear.tier <= currentTier;
                const canBuy = !owned && gear.tier === currentTier + 1 && gold >= gear.cost;
                return (
                  <div
                    key={gear.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: owned ? "rgba(99,102,241,0.1)" : "#252525",
                      border: `1px solid ${owned ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)"}`,
                      opacity: owned || canBuy || gear.tier === currentTier + 1 ? 1 : 0.4,
                    }}
                  >
                    <span className="text-xl flex-shrink-0">{gear.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: owned ? "#818cf8" : "#f0f0f0" }}>
                        {gear.name} {owned ? "✓" : ""}
                      </p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{gear.desc}</p>
                    </div>
                    {!owned && (
                      <button
                        onClick={() => onGearBuy(gear.id)}
                        disabled={!canBuy}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                        style={{
                          background: canBuy ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                          color: canBuy ? "#818cf8" : "rgba(255,255,255,0.2)",
                          border: `1px solid ${canBuy ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                          cursor: canBuy ? "pointer" : "not-allowed",
                        }}
                      >
                        🪙 {gear.cost}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Achievement Toast ────────────────────────────────────────────────────────
function ChainQuestToast({ parentTitle, template, onAccept, onDismiss }: {
  parentTitle: string;
  template: { title: string; description?: string | null; type?: string; priority?: string };
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const typeCfg = template.type ? (typeConfig[template.type] ?? null) : null;
  return (
    <div
      className="fixed bottom-36 right-6 z-50 rounded-xl px-4 py-3 shadow-2xl"
      style={{ background: "#252525", border: "1px solid rgba(139,92,246,0.5)", boxShadow: "0 8px 32px rgba(139,92,246,0.2)", maxWidth: 320 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">⛓</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold mb-0.5" style={{ color: "#a78bfa" }}>Quest Chain Available!</p>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Completed: <span style={{ color: "rgba(255,255,255,0.6)" }}>{parentTitle}</span>
          </p>
          <p className="text-sm font-semibold mb-1" style={{ color: "#e8e8e8" }}>{template.title}</p>
          {template.description && (
            <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>{template.description}</p>
          )}
          <div className="flex items-center gap-1 mb-3">
            {typeCfg && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: typeCfg.bg, color: typeCfg.color, border: `1px solid ${typeCfg.border}` }}>
                {typeCfg.icon} {typeCfg.label}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="flex-1 text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}
            >
              ⚔ Accept Quest
            </button>
            <button
              onClick={onDismiss}
              className="text-xs px-2 py-1.5 rounded"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Skip
            </button>
          </div>
        </div>
        <button onClick={onDismiss} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>✕</button>
      </div>
    </div>
  );
}

function AchievementToast({ achievement, onClose }: { achievement: EarnedAchievement; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className="fixed bottom-20 right-6 z-50 rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.5)", boxShadow: "0 8px 32px rgba(245,158,11,0.2)", maxWidth: 300 }}
    >
      <span className="text-2xl flex-shrink-0">{achievement.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: "#f59e0b" }}>Achievement Unlocked!</p>
        <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{achievement.name}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{achievement.desc}</p>
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
    </div>
  );
}

// ─── Flavor Toast ─────────────────────────────────────────────────────────────
function FlavorToast({ toast, onClose }: { toast: { message: string; icon: string; sub?: string }; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className="fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl"
      style={{ background: "#1e2a1e", border: "1px solid rgba(34,197,94,0.4)", boxShadow: "0 8px 32px rgba(34,197,94,0.15)", maxWidth: 280 }}
    >
      <span className="text-2xl flex-shrink-0">{toast.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: "#22c55e" }}>{toast.message}</p>
        {toast.sub && <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{toast.sub}</p>}
      </div>
      <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>✕</button>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>{message}</p>
      {sub && <p className="text-xs mt-2 font-mono" style={{ color: "rgba(255,68,68,0.3)" }}>{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl animate-pulse"
      style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.05)", height: 260 }}
    />
  );
}

// ─── Leaderboard View ─────────────────────────────────────────────────────────
const LB_LEVELS = [
  { name: "Novice",     min: 0,   color: "#9ca3af" },
  { name: "Apprentice", min: 100, color: "#22c55e" },
  { name: "Knight",     min: 300, color: "#3b82f6" },
  { name: "Archmage",   min: 600, color: "#a855f7" },
];
function getLbLevel(xp: number) { return LB_LEVELS.findLast(l => xp >= l.min) ?? LB_LEVELS[0]; }

const agentMetaLb: Record<string, { avatar: string; color: string }> = {
  nova:  { avatar: "NO", color: "#8b5cf6" },
  hex:   { avatar: "HX", color: "#10b981" },
  echo:  { avatar: "EC", color: "#ef4444" },
  pixel: { avatar: "PX", color: "#f59e0b" },
  atlas: { avatar: "AT", color: "#6366f1" },
  lyra:  { avatar: "✦",  color: "#e879f9" },
  forge: { avatar: "⚒",  color: "#f59e0b" },
};

const rankMedal = ["🥇", "🥈", "🥉"];

function LeaderboardView({ entries, agents, mode = "agents", users = [] }: { entries: LeaderboardEntry[]; agents: Agent[]; mode?: "agents" | "players"; users?: User[] }) {
  // For players mode: build leaderboard from users
  // For agents mode: use entries/agents as before
  let merged: LeaderboardEntry[];
  if (mode === "players") {
    merged = users.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      color: u.color,
      xp: u.xp ?? 0,
      questsCompleted: u.questsCompleted ?? 0,
    })).sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted).map((e, i) => ({ ...e, rank: i + 1 }));
  } else {
    merged = entries.length > 0 ? entries : agents.map((a, i) => ({
      rank: i + 1,
      id: a.id,
      name: a.name,
      avatar: a.avatar,
      color: a.color,
      xp: a.xp ?? 0,
      questsCompleted: a.questsCompleted ?? 0,
    })).sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  if (merged.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>{mode === "players" ? "No players registered yet." : "No agents registered yet."}</p>
      </div>
    );
  }

  const top3 = merged.slice(0, 3);
  const rest = merged.slice(3);
  const maxXp = merged[0]?.xp ?? 1;

  return (
    <div className="space-y-6">
      {/* Podium */}
      <div className="flex items-end justify-center gap-4">
        {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry, podiumIdx) => {
          const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd
          const rank = podiumOrder[podiumIdx] + 1;
          const heights = ["h-24", "h-32", "h-20"];
          const meta = agentMetaLb[entry.id?.toLowerCase()] ?? { avatar: entry.avatar ?? entry.id?.slice(0,2).toUpperCase() ?? "??", color: entry.color ?? "#666" };
          const color = entry.color ?? meta.color;
          const lvl = getLbLevel(entry.xp);
          return (
            <div key={entry.id} className="flex flex-col items-center gap-2" style={{ minWidth: 90 }}>
              <div className="text-lg">{rankMedal[rank - 1] ?? rank}</div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, boxShadow: `0 6px 20px ${color}60` }}
              >
                {entry.avatar ?? meta.avatar}
              </div>
              <div className="text-center">
                <p className="text-xs font-bold" style={{ color: "#f0f0f0" }}>{entry.name}</p>
                <p className="text-xs" style={{ color: lvl.color }}>{lvl.name}</p>
                <p className="text-xs font-mono font-bold mt-0.5" style={{ color: "#a855f7" }}>{entry.xp} XP</p>
              </div>
              <div
                className={`w-full rounded-t-lg flex items-center justify-center ${heights[podiumIdx]}`}
                style={{ background: `linear-gradient(180deg, ${color}20 0%, ${color}08 100%)`, border: `1px solid ${color}30`, borderBottom: "none" }}
              >
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>#{rank}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="grid px-4 py-2" style={{ gridTemplateColumns: "40px 1fr 80px 80px 80px", color: "rgba(255,255,255,0.3)", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>#</span><span>{mode === "players" ? "Player" : "Agent"}</span><span className="text-right">Level</span><span className="text-right">XP</span><span className="text-right">Quests</span>
        </div>
        {merged.map((entry) => {
          const meta = agentMetaLb[entry.id?.toLowerCase()] ?? { avatar: entry.avatar ?? entry.id?.slice(0,2).toUpperCase() ?? "??", color: entry.color ?? "#666" };
          const color = entry.color ?? meta.color;
          const lvl = getLbLevel(entry.xp);
          const barPct = maxXp > 0 ? (entry.xp / maxXp) * 100 : 0;
          const isTop = entry.rank <= 3;
          return (
            <div
              key={entry.id}
              className="grid px-4 py-3 items-center"
              style={{
                gridTemplateColumns: "40px 1fr 80px 80px 80px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: isTop ? `${color}08` : "transparent",
              }}
            >
              <span className="text-sm font-bold" style={{ color: entry.rank <= 3 ? ["#f59e0b","#9ca3af","#cd7f32"][entry.rank-1] : "rgba(255,255,255,0.25)" }}>
                {entry.rank <= 3 ? rankMedal[entry.rank - 1] : `#${entry.rank}`}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, color: "#fff" }}
                >
                  {entry.avatar ?? meta.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#f0f0f0" }}>{entry.name}</p>
                  <div className="mt-0.5 rounded-full overflow-hidden" style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }} />
                  </div>
                </div>
              </div>
              <span className="text-right text-xs font-semibold" style={{ color: lvl.color }}>{lvl.name}</span>
              <span className="text-right text-xs font-mono font-bold" style={{ color: "#a855f7" }}>{entry.xp}</span>
              <span className="text-right text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>{entry.questsCompleted}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Guide Modal ─────────────────────────────────────────────────────────────
function GuideModal({ onClose, onRestartTutorial }: { onClose: () => void; onRestartTutorial?: () => void }) {
  const [tab, setTab] = useState<"quests" | "xp" | "forge" | "achievements">("quests");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ background: "#1a1a1a", border: "1px solid rgba(255,140,68,0.3)", boxShadow: "0 0 60px rgba(255,100,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>📖 Player Guide</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Everything you need to know</p>
          </div>
          <div className="flex items-center gap-2">
            {onRestartTutorial && (
              <button
                onClick={onRestartTutorial}
                className="text-xs px-2 py-0.5 rounded"
                style={{ color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}
                title="Restart the interactive tutorial"
              >
                🎓 Restart Tutorial
              </button>
            )}
            <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {([
            { key: "quests", label: "⚔ Quests" },
            { key: "xp", label: "⭐ XP & Levels" },
            { key: "forge", label: "🔥 Forge" },
            { key: "achievements", label: "🏅 Achievements" },
          ] as { key: typeof tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2.5 text-xs font-semibold transition-colors"
              style={{
                color: tab === t.key ? "#ff8c44" : "rgba(255,255,255,0.3)",
                background: tab === t.key ? "rgba(255,140,68,0.08)" : "transparent",
                borderBottom: tab === t.key ? "2px solid #ff8c44" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 text-xs" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
          {tab === "quests" && (
            <>
              <GuideSection icon="🗺" title="Quest Hall Structure">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#f0f0f0" }}>⚔ Quest Board</span> — Player quests (personal, learning, fitness, social, co-op). Claim and complete directly — no review needed.</li>
                  <li><span style={{ color: "#a78bfa" }}>🤖 NPC Quest Board</span> — Development quests created and completed by agents. Includes Review Board for approving agent suggestions.</li>
                  <li><span style={{ color: "#f59e0b" }}>🏆 Leaderboard</span> — Ranks players and agents separately with an Agent/Player toggle.</li>
                  <li><span style={{ color: "#f59e0b" }}>🏅 Honors</span> — Your personal achievements. Log in to see your progress highlighted.</li>
                  <li><span style={{ color: "#8b5cf6" }}>🐉 Campaign</span> — Fantasy RPG overlay with agents as NPCs and quests as adventures.</li>
                  <li><span style={{ color: CURRENT_SEASON.color }}>{CURRENT_SEASON.icon} Season</span> — Battle Pass rewards track for the current season.</li>
                </ul>
              </GuideSection>
              <GuideSection icon="⚔" title="Player Quest Types">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#22c55e" }}>🏠 Personal</span> — Household chores, errands, life admin</li>
                  <li><span style={{ color: "#3b82f6" }}>📚 Learning</span> — Study, courses, reading (requires proof)</li>
                  <li><span style={{ color: "#f97316" }}>💪 Fitness</span> — Workouts, sports, health goals</li>
                  <li><span style={{ color: "#ec4899" }}>❤️ Social</span> — Thoughtful gestures, dates, quality time</li>
                  <li><span style={{ color: "#f43f5e" }}>💞 Co-op</span> — Partner quests requiring both to complete</li>
                </ul>
                <p className="mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Player quests go directly open → claimed → done. No agent review required.</p>
              </GuideSection>
              <GuideSection icon="🤖" title="NPC / Development Quests">
                <p>Development quests are created by agents (or Leon) and implemented exclusively by agents. They appear in the NPC Quest Board tab.</p>
                <p className="mt-1">The Review Board (in NPC tab) lets logged-in users approve or reject agent-suggested quests before they become active.</p>
              </GuideSection>
              <GuideSection icon="🔑" title="Login">
                Click <strong>Login</strong> in the header. Enter your name and API key. Once logged in, the stat cards show YOUR stats, and the Quest Board shows Claim / Complete buttons. Your achievements in Honors are highlighted.
              </GuideSection>
              <GuideSection icon="🎯" title="Quest Priorities">
                <ul className="space-y-1 mt-1">
                  <li><span style={{ color: "#ef4444" }}>High</span> — 30 XP · 50 Gold</li>
                  <li><span style={{ color: "#eab308" }}>Medium</span> — 20 XP · 25 Gold</li>
                  <li><span style={{ color: "#22c55e" }}>Low</span> — 10 XP · 10 Gold</li>
                </ul>
              </GuideSection>
            </>
          )}
          {tab === "xp" && (
            <>
              <GuideSection icon="⭐" title="XP & Levels">
                <div className="space-y-2 mt-1">
                  {[
                    { name: "Novice",     range: "0 – 99 XP",     color: "#9ca3af" },
                    { name: "Apprentice", range: "100 – 299 XP",  color: "#22c55e" },
                    { name: "Knight",     range: "300 – 599 XP",  color: "#3b82f6" },
                    { name: "Archmage",   range: "600+ XP",       color: "#a855f7" },
                  ].map(l => (
                    <div key={l.name} className="flex items-center gap-2">
                      <span className="w-16 text-xs font-semibold" style={{ color: l.color }}>{l.name}</span>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>{l.range}</span>
                    </div>
                  ))}
                </div>
              </GuideSection>
              <GuideSection icon="🪙" title="Gold">
                Earn gold by completing quests. Gold is multiplied by your streak (up to 3×). Spend it in the Forge Shop on rewards like Gaming time, Snack breaks, or Days Off.
              </GuideSection>
              <GuideSection icon="⚒" title="Workshop Gear">
                <p>Upgrade your Workshop Tools to earn more XP per quest:</p>
                <div className="space-y-1 mt-1">
                  {[
                    { icon: "🔨", name: "Worn Tools",       bonus: "+0%",  cost: "Free" },
                    { icon: "⚒",  name: "Sturdy Tools",     bonus: "+5%",  cost: "100g" },
                    { icon: "🛠",  name: "Masterwork Tools", bonus: "+10%", cost: "300g" },
                    { icon: "⚙",  name: "Legendary Tools",  bonus: "+15%", cost: "700g" },
                    { icon: "🔱", name: "Mythic Forge",     bonus: "+25%", cost: "1500g" },
                  ].map(g => (
                    <div key={g.name} className="flex items-center gap-2">
                      <span>{g.icon}</span>
                      <span className="flex-1">{g.name}</span>
                      <span style={{ color: "#22c55e" }}>{g.bonus}</span>
                      <span style={{ color: "#f59e0b" }}>{g.cost}</span>
                    </div>
                  ))}
                </div>
              </GuideSection>
            </>
          )}
          {tab === "forge" && (
            <>
              <GuideSection icon="🔥" title="Forge Temperature">
                Your Forge Temperature (0–100%) shows how active you are. Complete quests to heat it up. If it drops to 0%, you suffer a <span style={{ color: "#ef4444" }}>50% XP penalty</span>. Keep the forge burning!
              </GuideSection>
              <GuideSection icon="🔥" title="Streaks">
                Complete at least one quest each day to maintain your streak. Longer streaks increase your Gold multiplier (up to 3× at 20+ days). Streak milestones unlock achievements.
                <div className="space-y-1 mt-1">
                  <div>🔥 <span style={{ color: "#fb923c" }}>Active</span> — 1–6 days</div>
                  <div>🔥 <span style={{ color: "#f59e0b" }}>Hot</span> — 7–29 days</div>
                  <div>🔥 <span style={{ color: "#ef4444" }}>Blazing</span> — 30+ days</div>
                </div>
              </GuideSection>
              <GuideSection icon="🏪" title="Forge Shop">
                Spend your gold on real-world rewards. Open the Shop from your Player Card (requires API key). All purchases are tracked so you can redeem them.
              </GuideSection>
            </>
          )}
          {tab === "achievements" && (
            <>
              <GuideSection icon="🏅" title="Achievements">
                Achievements are automatically awarded when you hit milestones. They are <strong>per-player</strong> — tied to your login name. Check the <strong>🏅 Honors</strong> tab to see all achievements; when logged in, your earned achievements are highlighted with a gold border.
              </GuideSection>
              <GuideSection icon="📋" title="Achievement List">
                <div className="space-y-1 mt-1">
                  {[
                    { icon: "⚔", name: "First Quest",         desc: "Complete your first quest" },
                    { icon: "📜", name: "Apprentice",           desc: "Complete 10 quests" },
                    { icon: "🛡", name: "Knight",               desc: "Complete 50 quests" },
                    { icon: "👑", name: "Legend",               desc: "Complete 100 quests" },
                    { icon: "🔥", name: "Week Warrior",         desc: "7-day quest streak" },
                    { icon: "💎", name: "Monthly Champion",     desc: "30-day quest streak" },
                    { icon: "⚡", name: "Lightning Hands",      desc: "Complete 3 quests in one day" },
                    { icon: "🎯", name: "Jack of All Trades",   desc: "Complete all 5 quest types" },
                  ].map(a => (
                    <div key={a.name} className="flex items-center gap-2">
                      <span className="text-base w-5 flex-shrink-0">{a.icon}</span>
                      <div>
                        <span className="font-semibold" style={{ color: "#f0f0f0" }}>{a.name}</span>
                        <span className="ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>{a.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </GuideSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GuideSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="font-semibold mb-1.5" style={{ color: "#f0f0f0" }}>{icon} {title}</p>
      <div style={{ color: "rgba(255,255,255,0.55)" }}>{children}</div>
    </div>
  );
}

// ─── Honors / Achievements Gallery View ──────────────────────────────────────
function HonorsView({ catalogue, users, playerName = "", quests, reviewApiKey = "" }: { catalogue: AchievementDef[]; users: User[]; playerName?: string; quests?: QuestsData; reviewApiKey?: string }) {
  const emptyQuests: QuestsData = { open: [], inProgress: [], completed: [], suggested: [], rejected: [] };
  const q = quests ?? emptyQuests;
  const categories = Array.from(new Set(catalogue.map(a => a.category)));
  const loggedInUser = playerName ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;
  const playerEarnedIds = new Set((loggedInUser?.earnedAchievements ?? []).map(a => a.id));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #1a1208 0%, #1a1a1a 100%)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 40px rgba(245,158,11,0.07)" }}>
        <div className="flex items-center gap-3 mb-1">
          <span style={{ fontSize: 28 }}>🏅</span>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#fef3c7" }}>Hall of Honors</h2>
            <p className="text-xs" style={{ color: "rgba(253,230,138,0.5)" }}>
              {loggedInUser ? `${loggedInUser.name} — ${playerEarnedIds.size} achievement${playerEarnedIds.size !== 1 ? "s" : ""} earned` : "Log in to track your achievements"}
            </p>
          </div>
        </div>
        {!playerName && (
          <p className="text-xs mt-1.5 px-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            🔑 Log in via the header to see your personal achievements highlighted.
          </p>
        )}
      </div>

      {catalogue.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>No achievements data. Connect to the API.</p>
        </div>
      ) : (
        categories.map(cat => {
          const catAchs = catalogue.filter(a => a.category === cat);
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                {cat}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {catAchs.map(ach => {
                  const earners = users.filter(u =>
                    (u.earnedAchievements ?? []).some(e => e.id === ach.id)
                  );
                  const myEarned = playerEarnedIds.has(ach.id);
                  const anyEarned = earners.length > 0;
                  // If logged in, highlight player's own; otherwise show all
                  const highlight = playerName ? myEarned : anyEarned;
                  return (
                    <div
                      key={ach.id}
                      className="rounded-xl p-3"
                      style={{
                        background: myEarned ? "rgba(245,158,11,0.12)" : anyEarned ? "rgba(245,158,11,0.04)" : "#252525",
                        border: `1px solid ${myEarned ? "rgba(245,158,11,0.5)" : anyEarned ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}`,
                        opacity: highlight || (!playerName && anyEarned) ? 1 : 0.45,
                        boxShadow: myEarned ? "0 0 14px rgba(245,158,11,0.12)" : "none",
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-2xl flex-shrink-0" style={{ filter: highlight || (!playerName && anyEarned) ? "none" : "grayscale(1)" }}>{ach.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold" style={{ color: highlight ? "#f0f0f0" : "rgba(255,255,255,0.4)" }}>{ach.name}</p>
                            {myEarned && <span className="text-xs" style={{ color: "#f59e0b" }}>✓ Yours</span>}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{ach.desc}</p>
                          {earners.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {earners.map(u => (
                                <span
                                  key={u.id}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: `${u.color}20`, color: u.color, border: `1px solid ${u.color}40`, fontWeight: u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase() ? 700 : 400 }}
                                >
                                  {u.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* CV / Skill Tree — accessible from Honors */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(96,165,250,0.7)" }}>📋 CV &amp; Skill Tree</h3>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Track your learning progress</span>
        </div>
        <CVBuilderPanel quests={q} users={users} playerName={playerName} />
      </div>
    </div>
  );
}

// ─── Battle Pass / Season View ───────────────────────────────────────────────
const SEASON_START_MONTHS: Record<string, number> = { Winter: 11, Spring: 2, Summer: 5, Autumn: 8 };
const BATTLE_PASS_LEVELS = [
  { level: 1,  xp: 0,   reward: "🗡 Iron Pick",         premium: false },
  { level: 2,  xp: 30,  reward: "🪙 +50 Bonus Gold",     premium: false },
  { level: 3,  xp: 70,  reward: "📜 Lore Scroll (Cosmetic)", premium: false },
  { level: 4,  xp: 120, reward: "⚒ Forge Boost +5%",    premium: true  },
  { level: 5,  xp: 180, reward: "🔥 Streak Shield",       premium: false },
  { level: 6,  xp: 250, reward: "🎯 Daily Quest Bonus",   premium: true  },
  { level: 7,  xp: 330, reward: "🧭 Season Title: Wanderer", premium: false },
  { level: 8,  xp: 420, reward: "💎 Premium Gear Token",  premium: true  },
  { level: 9,  xp: 520, reward: "🌟 Seasonal Companion",  premium: false },
  { level: 10, xp: 630, reward: "👑 Season Champion Title", premium: true },
];

function BattlePassView({ users, quests }: { users: User[]; quests: QuestsData }) {
  const season = CURRENT_SEASON;
  const now = new Date();
  const seasonMonth = SEASON_START_MONTHS[season.name] ?? now.getMonth();
  const seasonYear = season.name === "Winter" && now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const seasonStart = new Date(seasonYear, seasonMonth, 1);
  const nextSeasonMonth = (seasonMonth + 3) % 12;
  const nextSeasonYear = nextSeasonMonth < seasonMonth ? seasonYear + 1 : seasonYear;
  const seasonEnd = new Date(nextSeasonYear, nextSeasonMonth, 1);
  const progressPct = Math.min(100, Math.round(((now.getTime() - seasonStart.getTime()) / (seasonEnd.getTime() - seasonStart.getTime())) * 100));

  // Compute season XP per user (XP earned since seasonStart, approximated from quest completions)
  const seasonCompleted = quests.completed.filter(q => q.completedAt && new Date(q.completedAt) >= seasonStart);
  const XP_MAP: Record<string, number> = { high: 30, medium: 20, low: 10 };
  const userSeasonXp: Record<string, number> = {};
  for (const q of seasonCompleted) {
    const uid = (q.completedBy || "").toLowerCase();
    if (uid) userSeasonXp[uid] = (userSeasonXp[uid] ?? 0) + (XP_MAP[q.priority] ?? 10);
  }

  const getBattlePassLevel = (xp: number) => {
    let lvl = BATTLE_PASS_LEVELS[0];
    for (const l of BATTLE_PASS_LEVELS) { if (xp >= l.xp) lvl = l; }
    return lvl;
  };
  const nextLevel = (xp: number) => BATTLE_PASS_LEVELS.find(l => l.xp > xp) ?? null;

  return (
    <div className="space-y-6">
      {/* Season header */}
      <div className="rounded-2xl p-5" style={{ background: `linear-gradient(135deg, #1a1a1a 0%, ${season.color}18 100%)`, border: `1px solid ${season.color}40`, boxShadow: `0 0 40px ${season.color}0a` }}>
        <div className="flex items-center gap-3 mb-3">
          <span style={{ fontSize: 32 }}>{season.icon}</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold" style={{ color: "#f0f0f0" }}>{season.name} Season {seasonYear}</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              {seasonStart.toLocaleDateString()} – {seasonEnd.toLocaleDateString()} · {100 - progressPct}% remaining
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold" style={{ color: season.color }}>{seasonCompleted.length} quests this season</p>
          </div>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${season.color}80, ${season.color})` }} />
        </div>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Season Progress {progressPct}%</p>
      </div>

      {/* Player Battle Pass tracks */}
      {users.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Player Tracks</h3>
          <div className="space-y-4">
            {users.map(u => {
              const sXp = userSeasonXp[u.id.toLowerCase()] ?? 0;
              const lvl = getBattlePassLevel(sXp);
              const nxt = nextLevel(sXp);
              const barPct = nxt ? Math.min(100, Math.round(((sXp - lvl.xp) / (nxt.xp - lvl.xp)) * 100)) : 100;
              return (
                <div key={u.id} className="rounded-xl p-4" style={{ background: "#252525", border: `1px solid ${u.color}30` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0" style={{ background: `linear-gradient(135deg, ${u.color}, ${u.color}80)`, color: "#fff" }}>
                      {u.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{u.name}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Level {lvl.level} · {sXp} Season XP{nxt ? ` / ${nxt.xp} to L${nxt.level}` : " MAX"}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: `${season.color}18`, color: season.color, border: `1px solid ${season.color}40` }}>
                      L{lvl.level}
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden mb-2" style={{ height: 4, background: "rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${season.color}80, ${season.color})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Battle Pass reward track */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Battle Pass Rewards</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {BATTLE_PASS_LEVELS.map(l => {
            const highestUserXp = Math.max(0, ...users.map(u => userSeasonXp[(u.id || "").toLowerCase()] ?? 0));
            const unlocked = highestUserXp >= l.xp;
            return (
              <div
                key={l.level}
                className="rounded-xl p-3 text-center"
                style={{
                  background: unlocked ? `${season.color}12` : "#252525",
                  border: `1px solid ${unlocked ? season.color + "50" : "rgba(255,255,255,0.07)"}`,
                  opacity: unlocked ? 1 : 0.5,
                }}
              >
                <p className="text-xs font-bold mb-1" style={{ color: unlocked ? season.color : "rgba(255,255,255,0.3)" }}>L{l.level}</p>
                <p className="text-xs" style={{ color: unlocked ? "#f0f0f0" : "rgba(255,255,255,0.4)" }}>{l.reward}</p>
                {l.premium && <p className="text-xs mt-1 font-semibold" style={{ color: "#f59e0b" }}>★ Premium</p>}
                <p className="text-xs mt-1 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{l.xp} XP</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Hub ──────────────────────────────────────────────────────────────
const CAMPAIGN_ICONS = ["⚔️","🛡️","🐉","📚","💀","🗡️","🏰","🌋","🌊","🔮","🌿","👑","⚡","🔥","🌟","💎"];

function CampaignHub({ campaigns, quests, reviewApiKey, onRefresh }: {
  campaigns: Campaign[];
  quests: QuestsData;
  reviewApiKey: string;
  onRefresh: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", icon: "⚔️", lore: "", bossQuestId: "", rewardXp: "", rewardGold: "", rewardTitle: "" });
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const expandedCampaign = campaigns.find(c => c.id === expandedId);
  const allAvailableQuests = [...quests.open, ...quests.inProgress];

  const getQuestNode = (q: CampaignQuest, isBoss: boolean, isCurrentQuest: boolean, idx: number) => {
    const isDone = q.status === "completed";
    const isDeleted = q.status === "deleted";
    const isUpcoming = !isDone && !isCurrentQuest;
    let nodeColor = isDone ? "#10b981" : isCurrentQuest ? "#a78bfa" : "rgba(255,255,255,0.15)";
    let borderColor = isDone ? "rgba(16,185,129,0.4)" : isCurrentQuest ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)";
    let bg = isDone ? "rgba(16,185,129,0.06)" : isCurrentQuest ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)";
    if (isBoss && !isDone) { nodeColor = "#ef4444"; borderColor = "rgba(239,68,68,0.5)"; bg = "rgba(239,68,68,0.1)"; }

    return (
      <div key={q.id} className="flex gap-3">
        {/* Timeline spine */}
        <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10"
            style={{ background: isDone ? "rgba(16,185,129,0.2)" : isBoss && !isDone ? "rgba(239,68,68,0.2)" : isCurrentQuest ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)", border: `2px solid ${nodeColor}`, color: nodeColor }}>
            {isDone ? "✓" : isBoss ? "👑" : isCurrentQuest ? "▶" : String(idx + 1)}
          </div>
          <div className="flex-1 w-px mt-1" style={{ background: "rgba(139,92,246,0.2)", minHeight: 12 }} />
        </div>
        {/* Quest card */}
        <div className="flex-1 mb-2 rounded-xl p-3" style={{ background: bg, border: `1px solid ${borderColor}`, opacity: isUpcoming && !isBoss ? 0.6 : 1, boxShadow: isBoss && !isDone ? "0 0 20px rgba(239,68,68,0.15)" : isCurrentQuest ? "0 0 16px rgba(139,92,246,0.15)" : "none" }}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {isBoss && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" }}>BOSS</span>}
                {isCurrentQuest && !isDone && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(167,139,250,0.2)", color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.4)" }}>CURRENT</span>}
                <p className="text-sm font-semibold" style={{ color: isDone ? "rgba(255,255,255,0.5)" : isBoss ? "#fca5a5" : isCurrentQuest ? "#e9d5ff" : "rgba(255,255,255,0.5)" }}>{q.title}</p>
              </div>
              {q.lore && <p className="text-xs mt-1 italic" style={{ color: "rgba(167,139,250,0.6)" }}>{q.lore}</p>}
              {isDone && q.completedBy && (
                <p className="text-xs mt-1" style={{ color: "rgba(16,185,129,0.7)" }}>✓ Completed by {q.completedBy}{q.completedAt ? ` · ${timeAgo(q.completedAt)}` : ""}</p>
              )}
              {!isDone && q.claimedBy && (
                <p className="text-xs mt-1" style={{ color: "rgba(167,139,250,0.6)" }}>⚡ Claimed by {q.claimedBy}</p>
              )}
              {isDeleted && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>(quest deleted)</p>}
            </div>
            {q.priority && (
              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: priorityConfig[q.priority as keyof typeof priorityConfig]?.bg ?? "rgba(255,255,255,0.05)", color: priorityConfig[q.priority as keyof typeof priorityConfig]?.color ?? "#aaa", border: `1px solid ${priorityConfig[q.priority as keyof typeof priorityConfig]?.border ?? "transparent"}` }}>
                {priorityConfig[q.priority as keyof typeof priorityConfig]?.label ?? q.priority}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !reviewApiKey) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          icon: form.icon,
          lore: form.lore.trim(),
          questIds: selectedQuestIds,
          bossQuestId: form.bossQuestId || null,
          rewards: { xp: Number(form.rewardXp) || 0, gold: Number(form.rewardGold) || 0, title: form.rewardTitle },
        }),
      });
      if (r.ok) {
        setCreateOpen(false);
        setForm({ title: "", description: "", icon: "⚔️", lore: "", bossQuestId: "", rewardXp: "", rewardGold: "", rewardTitle: "" });
        setSelectedQuestIds([]);
        onRefresh();
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!reviewApiKey) return;
    try {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE", headers: { "X-API-Key": reviewApiKey } });
      setDeleteConfirm(null);
      if (expandedId === id) setExpandedId(null);
      onRefresh();
    } catch { /* ignore */ }
  };

  const statusColors: Record<string, { color: string; bg: string; border: string; label: string }> = {
    active:    { color: "#a78bfa", bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.3)", label: "Active" },
    completed: { color: "#34d399", bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", label: "Victory!" },
    archived:  { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)", label: "Archived" },
  };

  // ── Expanded campaign timeline view ──────────────────────────────────────────
  if (expandedId && expandedCampaign) {
    const cq = expandedCampaign.quests ?? [];
    const firstIncompleteIdx = cq.findIndex(q => q.status !== "completed");
    const completedCount = expandedCampaign.progress?.completed ?? 0;
    const totalCount = expandedCampaign.progress?.total ?? cq.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isVictory = expandedCampaign.status === "completed" || completedCount === totalCount && totalCount > 0;

    return (
      <div className="space-y-6">
        {/* Back button + header */}
        <div>
          <button onClick={() => setExpandedId(null)} className="flex items-center gap-2 text-xs mb-4 transition-opacity hover:opacity-100" style={{ color: "rgba(167,139,250,0.7)", opacity: 0.8 }}>
            ← Back to Campaigns
          </button>
          <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a0d2e 0%, #0d1017 100%)", border: "1px solid rgba(139,92,246,0.3)", boxShadow: "0 0 40px rgba(139,92,246,0.1)" }}>
            {isVictory && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.06 }}>
                <span style={{ fontSize: 200 }}>🏆</span>
              </div>
            )}
            <div className="relative">
              <div className="flex items-start gap-4">
                <span style={{ fontSize: 40 }}>{expandedCampaign.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h2 className="text-xl font-bold" style={{ color: "#e9d5ff" }}>{expandedCampaign.title}</h2>
                    {isVictory && <span className="text-sm px-2 py-0.5 rounded font-bold" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)" }}>🏆 VICTORY</span>}
                    {!isVictory && <span className="text-xs px-2 py-0.5 rounded" style={statusColors[expandedCampaign.status] ?? statusColors.active}>{statusColors[expandedCampaign.status]?.label ?? expandedCampaign.status}</span>}
                  </div>
                  {expandedCampaign.lore && <p className="text-sm italic mb-2" style={{ color: "rgba(167,139,250,0.7)" }}>&quot;{expandedCampaign.lore}&quot;</p>}
                  {expandedCampaign.description && <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>{expandedCampaign.description}</p>}
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isVictory ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#8b5cf6,#a78bfa)" }} />
                    </div>
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: isVictory ? "#fbbf24" : "#a78bfa" }}>{completedCount}/{totalCount} · {pct}%</span>
                  </div>
                </div>
              </div>
              {/* Rewards */}
              {(expandedCampaign.rewards.xp > 0 || expandedCampaign.rewards.gold > 0 || expandedCampaign.rewards.title) && (
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <span className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>Completion Rewards:</span>
                  {expandedCampaign.rewards.xp > 0 && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>+{expandedCampaign.rewards.xp} XP</span>}
                  {expandedCampaign.rewards.gold > 0 && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>🪙 {expandedCampaign.rewards.gold}</span>}
                  {expandedCampaign.rewards.title && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(232,121,249,0.1)", color: "#e879f9", border: "1px solid rgba(232,121,249,0.25)" }}>🏅 &quot;{expandedCampaign.rewards.title}&quot;</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quest Chain Timeline */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(167,139,250,0.6)" }}>Quest Chain</h3>
          {cq.length === 0 && <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>No quests in this campaign yet.</p>}
          <div>
            {cq.map((q, idx) => {
              const isBoss = q.id === expandedCampaign.bossQuestId;
              const isCurrentQuest = !isBoss && idx === firstIncompleteIdx;
              return getQuestNode(q, isBoss, isCurrentQuest, idx);
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Campaign cards grid ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 28 }}>🐉</span>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#e9d5ff" }}>Campaign Hub</h2>
            <p className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>Long-form quest chains and story arcs</p>
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          style={{ background: "rgba(139,92,246,0.2)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.4)" }}
        >
          + New Campaign
        </button>
      </div>

      {/* Empty state */}
      {campaigns.length === 0 && (
        <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.2)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🐉</div>
          <p className="text-sm font-semibold mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>No active campaigns</p>
          <p className="text-xs">Start a quest chain to begin your saga!</p>
        </div>
      )}

      {/* Campaign grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {campaigns.map(c => {
          const completed = c.progress?.completed ?? 0;
          const total = c.progress?.total ?? 0;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const isVictory = c.status === "completed" || (completed === total && total > 0);
          const sc = statusColors[c.status] ?? statusColors.active;
          const bossInChain = c.quests?.find(q => q.id === c.bossQuestId);
          return (
            <div
              key={c.id}
              className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, rgba(26,13,46,0.8) 0%, rgba(13,16,23,0.8) 100%)", border: `1px solid ${isVictory ? "rgba(251,191,36,0.35)" : "rgba(139,92,246,0.25)"}`, boxShadow: isVictory ? "0 0 20px rgba(251,191,36,0.1)" : "0 0 20px rgba(139,92,246,0.05)" }}
              onClick={() => setExpandedId(c.id)}
            >
              <div className="flex items-start gap-3 mb-3">
                <span style={{ fontSize: 28, flexShrink: 0 }}>{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-bold truncate" style={{ color: "#e9d5ff" }}>{c.title}</p>
                    {isVictory
                      ? <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.35)" }}>🏆</span>
                      : <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={sc}>{sc.label}</span>
                    }
                  </div>
                  {c.description && <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{c.description.slice(0, 80)}{c.description.length > 80 ? "…" : ""}</p>}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "rgba(167,139,250,0.6)" }}>{completed}/{total} Quests</span>
                  <span className="text-xs font-semibold" style={{ color: isVictory ? "#fbbf24" : "#a78bfa" }}>{pct}%</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isVictory ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#7c3aed,#a78bfa)" }} />
                </div>
              </div>

              {/* Boss quest teaser */}
              {bossInChain && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-xs" style={{ color: bossInChain.status === "completed" ? "#34d399" : "rgba(239,68,68,0.8)" }}>
                    {bossInChain.status === "completed" ? "👑 Boss slain" : `👑 Boss: ${bossInChain.title.slice(0, 30)}${bossInChain.title.length > 30 ? "…" : ""}`}
                  </span>
                </div>
              )}

              {/* Lore snippet */}
              {c.lore && <p className="text-xs mt-2 italic" style={{ color: "rgba(167,139,250,0.4)" }}>&quot;{c.lore.slice(0, 60)}{c.lore.length > 60 ? "…" : ""}&quot;</p>}

              {/* Delete button */}
              {deleteConfirm === c.id ? (
                <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                  <button className="text-xs px-2 py-1 rounded" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }} onClick={() => handleDelete(c.id)}>Confirm delete</button>
                  <button className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                </div>
              ) : (
                reviewApiKey && (
                  <button className="text-xs mt-3 opacity-30 hover:opacity-70 transition-opacity" style={{ color: "#f87171" }}
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(c.id); }}>
                    Delete
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Create Campaign Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setCreateOpen(false)}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "#0d1017", border: "1px solid rgba(139,92,246,0.4)", boxShadow: "0 0 60px rgba(139,92,246,0.2)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4" style={{ color: "#e9d5ff" }}>New Campaign</h3>
            <div className="space-y-3">
              {/* Icon picker */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "rgba(167,139,250,0.7)" }}>Icon</p>
                <div className="flex flex-wrap gap-1">
                  {CAMPAIGN_ICONS.map(ic => (
                    <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} className="w-8 h-8 rounded text-base flex items-center justify-center transition-all"
                      style={{ background: form.icon === ic ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.04)", border: form.icon === ic ? "1px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.06)" }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(167,139,250,0.7)" }}>Title *</p>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Campaign name…"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.25)", color: "#e9d5ff" }} />
              </div>

              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(167,139,250,0.7)" }}>Description</p>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description…"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.25)", color: "#e9d5ff" }} />
              </div>

              <div>
                <p className="text-xs mb-1" style={{ color: "rgba(167,139,250,0.7)" }}>Lore / Flavor Text</p>
                <textarea value={form.lore} onChange={e => setForm(f => ({ ...f, lore: e.target.value }))} placeholder="The ancient scrolls speak of…"
                  rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.25)", color: "#e9d5ff" }} />
              </div>

              {/* Quest selector */}
              {allAvailableQuests.length > 0 && (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "rgba(167,139,250,0.7)" }}>Add Quests ({selectedQuestIds.length} selected)</p>
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.2)", maxHeight: 160, overflowY: "auto" }}>
                    {allAvailableQuests.map(q => {
                      const sel = selectedQuestIds.includes(q.id);
                      return (
                        <button key={q.id} onClick={() => setSelectedQuestIds(prev => sel ? prev.filter(id => id !== q.id) : [...prev, q.id])}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                          style={{ background: sel ? "rgba(139,92,246,0.12)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span className="text-xs" style={{ color: sel ? "#a78bfa" : "rgba(255,255,255,0.25)" }}>{sel ? "☑" : "☐"}</span>
                          <span className="text-xs truncate" style={{ color: sel ? "#e9d5ff" : "rgba(255,255,255,0.5)" }}>{q.title}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedQuestIds.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs mb-1" style={{ color: "rgba(167,139,250,0.6)" }}>Boss Quest (optional)</p>
                      <select value={form.bossQuestId} onChange={e => setForm(f => ({ ...f, bossQuestId: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.25)", color: "#e9d5ff" }}>
                        <option value="">None</option>
                        {selectedQuestIds.map(id => {
                          const q = allAvailableQuests.find(q => q.id === id);
                          return q ? <option key={id} value={id}>{q.title}</option> : null;
                        })}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Rewards */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "rgba(167,139,250,0.7)" }}>Completion Rewards</p>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" value={form.rewardXp} onChange={e => setForm(f => ({ ...f, rewardXp: e.target.value }))} placeholder="XP"
                    className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.2)", color: "#e9d5ff" }} />
                  <input type="number" value={form.rewardGold} onChange={e => setForm(f => ({ ...f, rewardGold: e.target.value }))} placeholder="Gold"
                    className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.2)", color: "#e9d5ff" }} />
                  <input value={form.rewardTitle} onChange={e => setForm(f => ({ ...f, rewardTitle: e.target.value }))} placeholder="Title"
                    className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.2)", color: "#e9d5ff" }} />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleCreate} disabled={!form.title.trim() || submitting || !reviewApiKey}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: form.title.trim() && reviewApiKey ? "rgba(139,92,246,0.4)" : "rgba(139,92,246,0.1)", color: form.title.trim() && reviewApiKey ? "#e9d5ff" : "rgba(167,139,250,0.3)", border: "1px solid rgba(139,92,246,0.4)" }}>
                  {submitting ? "Creating…" : !reviewApiKey ? "API key required" : "Create Campaign"}
                </button>
                <button onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tutorial Overlay (Honkai Star Rail style) ───────────────────────────────

const TUTORIAL_STEPS = [
  {
    key: "welcome",
    title: "Welcome to Quest Hall!",
    desc: "Let me show you around. It'll only take a minute.",
    target: null,
    position: "center" as const,
  },
  {
    key: "stat-cards",
    title: "Your Stats",
    desc: "These are your stats — Forge Streak, Active Quests, Quests Completed, and Gold. Log in to see your personal numbers.",
    target: "stat-cards",
    position: "bottom" as const,
  },
  {
    key: "quest-board-tab",
    title: "Quest Board",
    desc: "This is YOUR quest board. Personal quests, learning, fitness, social — all yours to claim and complete.",
    target: "quest-board-tab",
    position: "bottom" as const,
  },
  {
    key: "npc-board-tab",
    title: "NPC Quest Board",
    desc: "Agent quests live here. The NPCs (AI agents) work on development tasks — you can review their work too.",
    target: "npc-board-tab",
    position: "bottom" as const,
  },
  {
    key: "quest-filters",
    title: "Quest Filters",
    desc: "Filter quests by type — Personal, Learning, Fitness, Social, or Co-op. Find what you need fast.",
    target: "quest-filters",
    position: "bottom" as const,
  },
  {
    key: "claim-hint",
    title: "Claim Quests",
    desc: "See a quest you want? Click ⚔ Claim to take it on! Complete it when done to earn XP and Gold.",
    target: null,
    position: "center" as const,
  },
  {
    key: "login-btn",
    title: "Log In",
    desc: "Log in with your name and API key to claim quests, earn XP, and track your personal stats.",
    target: "login-btn",
    position: "bottom" as const,
  },
  {
    key: "companions",
    title: "Companions",
    desc: "Companions join your journey and grant XP bonuses. Keep your streak going to keep them happy!",
    target: "companions-widget",
    position: "top" as const,
  },
  {
    key: "leaderboard-tab",
    title: "Leaderboard",
    desc: "Compete with other players and agents. Rise through the ranks to claim the top spot!",
    target: "leaderboard-tab",
    position: "bottom" as const,
  },
  {
    key: "campaign-tab",
    title: "Campaign",
    desc: "Long quest chains and story arcs live here. Embark on epic adventures with your party.",
    target: "campaign-tab",
    position: "bottom" as const,
  },
  {
    key: "season-tab",
    title: "Season & Battle Pass",
    desc: "Each season brings a Battle Pass with exclusive rewards. Complete quests to level it up!",
    target: "season-tab",
    position: "bottom" as const,
  },
  {
    key: "done",
    title: "You're Ready, Adventurer! 🔥",
    desc: "The Forge awaits. Go forth, complete quests, and earn glory for the Guild!",
    target: null,
    position: "center" as const,
  },
];

function TutorialOverlay({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const stepDef = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; arrowDir: "up" | "down" | "none" } | null>(null);
  const [confetti, setConfetti] = useState<{ x: number; y: number; color: string; id: number }[]>([]);

  useEffect(() => {
    if (isLast) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const pieces = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: cx + (Math.random() - 0.5) * 300,
        y: cy + (Math.random() - 0.5) * 200,
        color: ["#ff4444","#f59e0b","#22c55e","#3b82f6","#a855f7","#ec4899"][i % 6],
      }));
      setConfetti(pieces);
      const t = setTimeout(() => setConfetti([]), 1800);
      return () => clearTimeout(t);
    }
  }, [isLast]);

  useEffect(() => {
    if (!stepDef.target) { setPopupPos(null); return; }
    const el = document.querySelector(`[data-tutorial="${stepDef.target}"]`);
    if (!el) { setPopupPos(null); return; }

    const rect = el.getBoundingClientRect();
    const POPUP_W = 300;
    const POPUP_H = 130;
    const GAP = 14;

    let top: number;
    let arrowDir: "up" | "down" | "none" = "none";

    if (stepDef.position === "bottom") {
      top = rect.bottom + GAP;
      arrowDir = "up";
      if (top + POPUP_H > window.innerHeight - 20) {
        top = rect.top - POPUP_H - GAP;
        arrowDir = "down";
      }
    } else {
      top = rect.top - POPUP_H - GAP;
      arrowDir = "down";
      if (top < 20) {
        top = rect.bottom + GAP;
        arrowDir = "up";
      }
    }

    let left = rect.left + rect.width / 2 - POPUP_W / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - POPUP_W - 12));

    setPopupPos({ top, left, arrowDir });

    // Elevate target element
    (el as HTMLElement).classList.add("tutorial-spotlight");
    return () => (el as HTMLElement).classList.remove("tutorial-spotlight");
  }, [stepDef]);

  const isCentered = !stepDef.target || !popupPos;

  return (
    <>
      {isCentered && (
        <div
          className="fixed inset-0"
          style={{ background: "rgba(0,0,0,0.78)", zIndex: 9998 }}
          onClick={onSkip}
        />
      )}
      {!isCentered && (
        <div className="fixed inset-0" style={{ zIndex: 9998, pointerEvents: "none" }} />
      )}

      {/* Confetti */}
      {confetti.map(c => (
        <div
          key={c.id}
          className="fixed pointer-events-none"
          style={{
            top: c.y,
            left: c.x,
            width: 10,
            height: 10,
            background: c.color,
            borderRadius: 2,
            zIndex: 10003,
            animation: "tutorial-confetti-burst 1.5s ease forwards",
          }}
        />
      ))}

      {/* Popup */}
      <div
        className="tutorial-popup fixed"
        style={{
          zIndex: 10002,
          ...(isCentered
            ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
            : { top: popupPos!.top, left: popupPos!.left }),
          width: isCentered ? 340 : 300,
          background: "#1a1a1a",
          border: "1px solid rgba(255,200,50,0.4)",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 0 30px rgba(255,200,50,0.12)",
          padding: "16px 18px 14px",
        }}
      >
        {!isCentered && popupPos?.arrowDir === "up" && (
          <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: "8px solid rgba(255,200,50,0.4)" }} />
        )}
        {!isCentered && popupPos?.arrowDir === "down" && (
          <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "8px solid rgba(255,200,50,0.4)" }} />
        )}

        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,200,50,0.12)", color: "#fbbf24", border: "1px solid rgba(255,200,50,0.25)" }}>
              {step + 1}/{TUTORIAL_STEPS.length}
            </span>
            <h3 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>{stepDef.title}</h3>
          </div>
          <button onClick={onSkip} style={{ color: "rgba(255,255,255,0.25)", fontSize: 14, lineHeight: 1, flexShrink: 0 }} title="Skip tutorial">✕</button>
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>{stepDef.desc}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onSkip}
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.25)", textDecoration: "underline" }}
          >
            Skip tutorial
          </button>
          <button
            onClick={onNext}
            className="action-btn btn-primary text-xs px-4 py-1.5 rounded-lg font-semibold"
            style={{ background: "rgba(251,191,36,0.18)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)" }}
          >
            {isLast ? "Let's Go! 🔥" : "Next →"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Companions Widget (always visible on Quest Board) ───────────────────────

const COMPANION_IDS_ALL = ["ember_sprite", "lore_owl", "gear_golem"];
const COMPANION_META_ALL: Record<string, { icon: string; name: string; quote: string }> = {
  ember_sprite: { icon: "🔮", name: "Ember Sprite", quote: "The forge burns because YOU keep it lit!" },
  lore_owl:     { icon: "🦉", name: "Lore Owl",     quote: "Knowledge is power, adventurer." },
  gear_golem:   { icon: "🤖", name: "Gear Golem",   quote: "Efficiency is the path to glory." },
};
const DOBBIE_QUOTES = [
  "Dobbie demands a quest! ...and also a snack.",
  "Mrow. The Forge grows cold without quests.",
  "Dobbie approves of your progress. Now pet me.",
  "Have you tried completing more quests? Dobbie has opinions.",
  "Purring softly while judging your quest log.",
];

function CompanionsWidget({ user, streak }: { user: User | null | undefined; streak: number }) {
  const [quoteIdx] = useState(() => Math.floor(Math.random() * DOBBIE_QUOTES.length));

  const earnedCompanions = (user?.earnedAchievements ?? []).filter(a => COMPANION_IDS_ALL.includes(a.id));
  const mood = streak >= 7
    ? { emoji: "😊", label: "Happy", color: "#22c55e", tip: "Keep the streak going!" }
    : streak >= 3
    ? { emoji: "😐", label: "Neutral", color: "#f59e0b", tip: "Complete quests to cheer them up!" }
    : { emoji: "😔", label: "Sad", color: "#ef4444", tip: "Your companions miss you!" };

  return (
    <div
      data-tutorial="companions-widget"
      className="rounded-xl p-3"
      style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.18)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.7)" }}>Companions</span>
        {earnedCompanions.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(99,102,241,0.1)", color: "rgba(99,102,241,0.6)", border: "1px solid rgba(99,102,241,0.2)" }}>
            +{(earnedCompanions.length + 1) * 2}% XP
          </span>
        )}
      </div>

      {/* Dobbie — always shown as starter companion */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-lg ${mood.label === "Happy" ? "animate-bounce" : mood.label === "Sad" ? "animate-pulse" : ""}`} title={`Dobbie — ${mood.tip}`}>🐱</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold" style={{ color: "#ff6b9d" }}>Dobbie</span>
            <span className="text-xs" title={mood.tip} style={{ color: mood.color }}>{mood.emoji} {mood.label}</span>
            <span className="text-xs" style={{ color: "rgba(99,102,241,0.5)" }}>+2% XP</span>
          </div>
          <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{DOBBIE_QUOTES[quoteIdx]}</p>
        </div>
      </div>

      {/* Earned companions */}
      {earnedCompanions.map(c => {
        const meta = COMPANION_META_ALL[c.id];
        return (
          <div key={c.id} className="flex items-center gap-2 mb-1">
            <span className={`text-base ${mood.label === "Happy" ? "animate-bounce" : ""}`} title={`${meta?.name} — ${mood.tip}`}>{meta?.icon ?? c.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold" style={{ color: "#a78bfa" }}>{meta?.name ?? c.name}</span>
                <span className="text-xs" style={{ color: "rgba(99,102,241,0.5)" }}>+2% XP</span>
              </div>
            </div>
          </div>
        );
      })}

      {earnedCompanions.length === 0 && (
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.22)" }}>
          Complete achievements to unlock more companions!
        </p>
      )}
    </div>
  );
}
