"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  category: string | null;
  categories: string[];
  product: string | null;
  humanInputRequired: boolean;
  status: "open" | "in_progress" | "completed";
  createdAt: string;
  claimedBy: string | null;
  completedBy: string | null;
  completedAt: string | null;
}

interface QuestsData {
  open: Quest[];
  inProgress: Quest[];
  completed: Quest[];
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
  try {
    const r = await fetch(`/api/quests`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* ignore */ }
  try {
    const r = await fetch(`/data/quests.json`);
    if (r.ok) {
      const data = await r.json();
      return data && !Array.isArray(data) ? data : { open: [], inProgress: [], completed: [] };
    }
  } catch { /* ignore */ }
  return { open: [], inProgress: [], completed: [] };
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
  const [quests, setQuests] = useState<QuestsData>({ open: [], inProgress: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [apiLive, setApiLive] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [versions, setVersions] = useState<{ dashboard: string; app: string } | null>(null);

  const refresh = useCallback(async () => {
    const [a, q] = await Promise.all([fetchAgents(), fetchQuests()]);
    // Lyra is team lead — always first
    const sorted = [...a].sort((x, y) => {
      if (x.id === "lyra") return -1;
      if (y.id === "lyra") return 1;
      return x.name.localeCompare(y.name);
    });
    setAgents(sorted);
    setQuests(q);
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

  // Build per-agent quest map
  const agentQuestMap: Record<string, Quest[]> = {};
  for (const q of quests.inProgress) {
    if (q.claimedBy) {
      if (!agentQuestMap[q.claimedBy]) agentQuestMap[q.claimedBy] = [];
      agentQuestMap[q.claimedBy].push(q);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "transparent", color: "#e8e8e8" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{
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
              Revenue Team
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#f0f0f0" }}>
            Operations Center
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            Live revenue agent overview
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

          {/* Quest Board */}
          <aside className="w-full lg:w-80 flex-shrink-0">
            <div className="mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                Quest Board
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                {quests.open.length} open · {quests.inProgress.length} in progress
              </p>
            </div>

            <div className="space-y-2">
              {loading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.05)" }} />
                ))
              ) : quests.open.length === 0 ? (
                <div className="rounded-xl p-5 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>No open quests</p>
                  <p className="text-xs mt-1 font-mono" style={{ color: "rgba(255,68,68,0.3)" }}>POST /api/quest</p>
                </div>
              ) : (
                quests.open.map(q => <QuestCard key={q.id} quest={q} />)
              )}

              {quests.inProgress.length > 0 && (
                <>
                  <div className="pt-2 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
                      In Progress
                    </span>
                  </div>
                  {quests.inProgress.map(q => <QuestCard key={q.id} quest={q} />)}
                </>
              )}
            </div>
          </aside>
        </div>

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

      <footer className="mt-12 py-6" style={{ borderTop: "1px solid rgba(255,68,68,0.07)" }}>
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono"
          style={{ color: "rgba(255,255,255,0.15)" }}
        >
          <div className="flex items-center gap-3">
            <span>OpenClaw · Quest Hall · Revenue Team</span>
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

function QuestCard({ quest }: { quest: Quest }) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = quest.status === "in_progress";
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);

  return (
    <div
      className="rounded-lg p-3 cursor-pointer"
      style={{
        background: "#252525",
        border: `1px solid ${isInProgress ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.07)"}`,
        transform: "translateY(0)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
      }}
      onClick={() => setExpanded(v => !v)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = isInProgress ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.18)";
        el.style.boxShadow = isInProgress ? "0 8px 24px rgba(139,92,246,0.2)" : "0 8px 24px rgba(255,68,68,0.2)";
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = isInProgress ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.07)";
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
      }}
    >
      <div className="flex items-start gap-2">
        {isInProgress && (
          <span
            className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6", animation: "pulse 1.5s ease-in-out infinite" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium truncate flex-1" style={{ color: "#e8e8e8" }}>{quest.title}</p>
            {quest.humanInputRequired && <HumanInputBadge />}
            <PriorityBadge priority={quest.priority} />
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
