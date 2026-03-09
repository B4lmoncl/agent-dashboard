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
  jobsCompleted: number;
  questsCompleted?: number;
  revenue: number;
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
  type?: "development" | "personal" | "learning" | "social";
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
}

interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  xp: number;
  questsCompleted: number;
  achievements?: { reason: string; xp: number; at: string }[];
  createdAt?: string;
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

const typeConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  development: { label: "Dev",      color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.3)"  },
  personal:    { label: "Personal", color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
  learning:    { label: "Learn",    color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)"  },
  social:      { label: "Social",   color: "#ec4899", bg: "rgba(236,72,153,0.1)",  border: "rgba(236,72,153,0.3)"  },
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
  const [typeFilter, setTypeFilter] = useState<string>("all");
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
        ctx.fillStyle = `rgba(255,255,255,${p.opacity.toFixed(3)})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  const refresh = useCallback(async () => {
    const [a, q, u] = await Promise.all([fetchAgents(), fetchQuests(), fetchUsers()]);
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

  const handleApprove = useCallback(async (id: string) => {
    const key = reviewApiKey;
    if (!key) return;
    try {
      const r = await fetch(`/api/quest/${id}/approve`, { method: "POST", headers: { "X-API-Key": key } });
      if (r.ok) await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh]);

  const handleReject = useCallback(async (id: string) => {
    const key = reviewApiKey;
    if (!key) return;
    try {
      const r = await fetch(`/api/quest/${id}/reject`, { method: "POST", headers: { "X-API-Key": key } });
      if (r.ok) await refresh();
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

  const activeCount = agents.filter((a) => a.status === "online" || a.status === "working").length;
  const workingCount = agents.filter((a) => a.status === "working").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const totalRevenue = agents.reduce((sum, a) => sum + (a.revenue ?? 0), 0);
  const totalJobs = agents.reduce((sum, a) => sum + (a.jobsCompleted ?? 0), 0);
  const needsAttention = agents.filter((a) => a.health === "needs_checkin" || a.health === "broken").length;

  const animAgents   = useCountUp(agents.length, 0);
  const animWorking  = useCountUp(workingCount, 0);
  const animIdle     = useCountUp(idleCount, 0);
  const animJobs     = useCountUp(totalJobs, 0);
  const animRevenue  = useCountUp(totalRevenue, 2);
  const animActive   = useCountUp(activeCount, 0);

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
          </div>

          <div className="flex items-center gap-4">
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
            Operations Center
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            Live agent guild command center
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBar
            label="Agents"
            value={loading ? "—" : animAgents}
            sub={`${animActive} online`}
          />
          <StatBar
            label="Working"
            value={loading ? "—" : animWorking}
            sub={`${animIdle} idle`}
            accent="#ff6633"
          />
          <StatBar
            label="Jobs Done"
            value={loading ? "—" : animJobs}
            sub="all agents"
            accent="rgba(255,255,255,0.6)"
          />
          <StatBar
            label="Revenue"
            value={loading ? "—" : `$${animRevenue}`}
            sub="total generated"
            accent="#22c55e"
          />
        </div>

        {/* Agent Roster + Quest Board */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* Agent Roster */}
          <section className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Agent Roster
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {loading ? "Loading…" : agents.length > 0 ? `${agents.length} agents registered` : "Waiting for agents to check in"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#4ade80", animation: "pulse-online 2s ease-in-out infinite" }} />
                  Online
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#ff6b00", animation: "pulse-working 1.5s ease-in-out infinite" }} />
                  Working
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#facc15", animation: "pulse-idle 3s ease-in-out infinite" }} />
                  Idle
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "rgba(255,255,255,0.2)" }} />
                  Offline
                </span>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : agents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {agents.map((agent) => (
                  <div key={agent.id} className={agent.id === "lyra" ? "col-span-1 sm:col-span-2" : ""}>
                    <AgentCard
                      agent={agent}
                      activeQuests={agentQuestMap[agent.id] ?? []}
                      isWide={agent.id === "lyra"}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                message="No agents have checked in yet."
                sub={`POST /api/agent/:name/status  →  { status, platform, uptime, jobsCompleted, revenue, health }`}
              />
            )}
          </section>

          {/* User Cards (Household Gamification) */}
          {users.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Players
                </h2>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }}>
                  {users.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {users.map(u => <UserCard key={u.id} user={u} />)}
              </div>
            </section>
          )}

          {/* Quest Board */}
          <aside className="w-full lg:w-80 flex-shrink-0">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Quest Board
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {visibleOpen.length} open · {visibleInProgress.length} in progress
                  </p>
                </div>
                <button
                  onClick={() => setSortMode(s => s === "newest" ? "priority" : "newest")}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    background: sortMode === "priority" ? "rgba(255,102,51,0.15)" : "rgba(255,255,255,0.05)",
                    color: sortMode === "priority" ? "#ff6633" : "rgba(255,255,255,0.3)",
                    border: `1px solid ${sortMode === "priority" ? "rgba(255,102,51,0.3)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {sortMode === "newest" ? "⇅ Newest" : "⇅ Priority"}
                </button>
              </div>
              {/* Type filter tabs */}
              <div className="flex gap-1 flex-wrap mb-2">
                {(["all", "development", "personal", "learning", "social"] as const).map(t => {
                  const cfg = t === "all" ? null : typeConfig[t];
                  const isActive = typeFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: isActive ? (cfg ? cfg.bg : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.03)",
                        color: isActive ? (cfg ? cfg.color : "#e8e8e8") : "rgba(255,255,255,0.3)",
                        border: `1px solid ${isActive ? (cfg ? cfg.border : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.07)"}`,
                      }}
                    >
                      {t === "all" ? "All" : cfg!.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search quests…"
                className="w-full text-xs px-2 py-1.5 rounded"
                style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", outline: "none" }}
              />
            </div>

            <div className="space-y-2">
              {loading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.05)" }} />
                ))
              ) : visibleOpen.length === 0 && visibleInProgress.length === 0 ? (
                <div className="rounded-xl p-5 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{searchFilter ? "No quests match your search" : "No open quests"}</p>
                  {!searchFilter && <p className="text-xs mt-1 font-mono" style={{ color: "rgba(255,68,68,0.3)" }}>POST /api/quest</p>}
                </div>
              ) : (
                visibleOpen.map(q => q.children && q.children.length > 0
                  ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                  : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                )
              )}

              {visibleInProgress.length > 0 && (
                <>
                  <div className="pt-2 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
                      In Progress
                    </span>
                  </div>
                  {visibleInProgress.map(q => q.children && q.children.length > 0
                    ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                    : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        {/* Review Board — Agent Suggestions */}
        {quests.suggested.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f59e0b" }}>
                ✦ Review Board
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                {quests.suggested.length}
              </span>
            </div>
            {!reviewApiKey ? (
              <div className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.2)" }}>
                <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Enter API key to review quests:</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={reviewKeyInput}
                    onChange={e => setReviewKeyInput(e.target.value)}
                    placeholder="API Key"
                    className="flex-1 text-xs px-2 py-1 rounded"
                    style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  />
                  <button
                    onClick={() => { localStorage.setItem("dash_api_key", reviewKeyInput); setReviewApiKey(reviewKeyInput); }}
                    className="text-xs px-3 py-1 rounded font-medium"
                    style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)" }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {quests.suggested.map(q => (
                  <div key={q.id} className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.25)", boxShadow: "0 0 12px rgba(245,158,11,0.06)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ClickablePriorityBadge priority={q.priority} onClick={() => {
                            const cycle: Quest["priority"][] = ["low", "medium", "high"];
                            const next = cycle[(cycle.indexOf(q.priority) + 1) % 3];
                            handleChangePriority(q.id, next);
                          }} />
                          <h3 className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{q.title}</h3>
                        </div>
                        {q.description && (
                          <p className="text-xs leading-relaxed mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>{q.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {(q.categories?.length ? q.categories : (q.category ? [q.category] : [])).map(c => (
                            <CategoryBadge key={c} category={c} />
                          ))}
                          {q.product && <ProductBadge product={q.product} />}
                          {q.createdBy && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "rgba(245,158,11,0.7)", border: "1px solid rgba(245,158,11,0.2)" }}>
                              by {q.createdBy}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleApprove(q.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(34,197,94,0.3)"; }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(34,197,94,0.15)"; }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleReject(q.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.7)", border: "1px solid rgba(239,68,68,0.2)" }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(239,68,68,0.25)"; }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(239,68,68,0.1)"; }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
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

        {/* Completed Quests Log */}
        {(quests.completed.length > 0 || !loading) && (
          <section>
            <button
              onClick={() => setCompletedOpen(v => !v)}
              className="flex items-center gap-2 mb-3 w-full text-left"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                Completed Quests
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                {quests.completed.length}
              </span>
              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                {completedOpen ? "▲" : "▼"}
              </span>
            </button>

            {completedOpen && (
              <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.06)" }}>
                {quests.completed.length === 0 ? (
                  <p className="text-xs p-4 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>No completed quests yet</p>
                ) : (
                  <div>
                    {quests.completed.map((q, i) => (
                      <CompletedQuestRow
                        key={q.id}
                        quest={q}
                        isLast={i === quests.completed.length - 1}
                      />
                    ))}
                  </div>
                )}
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
    </div>
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
      {cfg.label}
    </span>
  );
}

function AgentBadge({ name }: { name: string }) {
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}
    >
      🤖 {label}
    </span>
  );
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

function QuestCard({ quest, selected, onToggle }: { quest: Quest; selected?: boolean; onToggle?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = quest.status === "in_progress";
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);

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
            {isInProgress && quest.claimedBy && (
              <span className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ {quest.claimedBy}</span>
            )}
          </div>
          {expanded && quest.description && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{quest.description}</p>
          )}
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>{timeAgo(quest.createdAt)}</p>
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
            {/* Progress bar */}
            {progress && progress.total > 0 && (
              <div className="mt-2">
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

function UserCard({ user }: { user: User }) {
  const xp = user.xp ?? 0;
  const lvl = getUserLevel(xp);
  const progress = getUserXpProgress(xp);
  const nextLvl = USER_LEVELS[USER_LEVELS.indexOf(lvl) + 1];
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "#252525", border: `1px solid ${lvl.color}30`, boxShadow: `0 0 16px ${lvl.color}10` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${user.color}, ${user.color}99)`, boxShadow: `0 4px 14px ${user.color}50`, color: "#fff" }}
        >
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>{user.name}</p>
          <p className="text-xs font-semibold" style={{ color: lvl.color }}>{lvl.name}</p>
        </div>
        <span
          className="text-xs px-1.5 py-0.5 rounded font-semibold"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          👤 User
        </span>
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Quests Completed</span>
          <span className="text-xs font-mono font-medium" style={{ color: "#8b5cf6" }}>{user.questsCompleted ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>XP</span>
          <span className="text-xs font-mono font-medium" style={{ color: lvl.color }}>{xp} XP{nextLvl ? ` / ${nextLvl.min}` : " — MAX"}</span>
        </div>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.07)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.round(progress * 100)}%`, background: `linear-gradient(90deg, ${lvl.color}99, ${lvl.color})`, boxShadow: `0 0 6px ${lvl.color}80` }}
        />
      </div>
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
