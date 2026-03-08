"use client";

import { useEffect, useState, useCallback } from "react";
import AgentCard from "@/components/AgentCard";
import QuestCard from "@/components/QuestCard";
import StatBar from "@/components/StatBar";

interface Agent {
  id: string;
  name: string;
  status: "active" | "idle" | "error" | "working" | "thinking" | "online";
  lastUpdate: string | null;
  currentTask: string | null;
  results?: { title: string; success: boolean; timestamp: string }[];
  pendingCommands?: number;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  why: string;
  agentId: string | null;
  agentName: string | null;
  status: "pending" | "running" | "completed" | "failed";
  priority: "critical" | "high" | "medium" | "low";
  tags: string[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  progress: number;
}

const API_BASE = "";

async function fetchAgents(): Promise<Agent[]> {
  // Try live API first, fall back to static JSON
  try {
    const r = await fetch(`${API_BASE}/api/agents`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* API not running */ }
  try {
    const r = await fetch(`${API_BASE}/data/agents.json`);
    if (r.ok) {
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }
  } catch { /* ignore */ }
  return [];
}

async function fetchQuests(): Promise<Quest[]> {
  try {
    const r = await fetch(`${API_BASE}/api/quests`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return r.json();
  } catch { /* API not running */ }
  try {
    const r = await fetch(`${API_BASE}/data/quests.json`);
    if (r.ok) {
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }
  } catch { /* ignore */ }
  return [];
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [apiLive, setApiLive] = useState(false);

  const refresh = useCallback(async () => {
    const [a, q] = await Promise.all([fetchAgents(), fetchQuests()]);
    setAgents(a);
    setQuests(q);
    try {
      const r = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(1500) });
      setApiLive(r.ok);
    } catch { setApiLive(false); }
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Tick "seconds ago" counter every second
  useEffect(() => {
    const tick = setInterval(() => {
      if (lastRefresh) {
        setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [lastRefresh]);

  const activeCount = agents.filter((a) => ["active", "working", "thinking", "online"].includes(a.status)).length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const errorCount = agents.filter((a) => a.status === "error").length;
  const runningQuests = quests.filter((q) => q.status === "running");
  const pendingQuests = quests.filter((q) => q.status === "pending");
  const doneQuests = quests.filter((q) => q.status === "completed" || q.status === "failed");

  const lastUpdatedStr = lastRefresh
    ? secondsAgo < 5
      ? "just now"
      : `${secondsAgo}s ago`
    : "—";

  return (
    <div className="min-h-screen" style={{ background: "#0d0d0d", color: "#e8e8e8" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{
          background: "rgba(14,14,14,0.95)",
          borderBottom: "1px solid rgba(255,68,68,0.18)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: "linear-gradient(135deg, #ff4444, #cc2200)", boxShadow: "0 0 12px rgba(255,68,68,0.3)" }}
            >
              OC
            </div>
            <span className="font-semibold text-sm tracking-tight" style={{ color: "#e8e8e8" }}>
              Agent Dashboard
            </span>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ color: "#ff4444", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)" }}
            >
              Revenue Team
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{
                  background: apiLive ? "#22c55e" : "rgba(255,255,255,0.2)",
                  boxShadow: apiLive ? "0 0 6px #22c55e" : "none",
                }}
              />
              <span>{apiLive ? "API Live" : "Static"}</span>
            </div>
            <div className="text-xs font-mono flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              <span
                className="w-1.5 h-1.5 rounded-full inline-block animate-pulse"
                style={{ background: "rgba(255,102,51,0.6)" }}
              />
              <span>Updated {lastUpdatedStr}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#e8e8e8" }}>
            Operations Center
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            Live overview of Leon&apos;s revenue agent team
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBar label="Agents" value={loading ? "—" : agents.length} sub={`${activeCount} active`} />
          <StatBar label="Active" value={loading ? "—" : activeCount} sub={`${idleCount} idle · ${errorCount} error`} accent="#ff4444" />
          <StatBar label="Running" value={loading ? "—" : runningQuests.length} sub={`${pendingQuests.length} pending`} accent="#ff6633" />
          <StatBar label="Completed" value={loading ? "—" : doneQuests.length} sub="total done" accent="rgba(255,255,255,0.6)" />
        </div>

        {/* Agent Roster */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
                Agent Roster
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                {loading ? "Loading…" : agents.length > 0 ? `${agents.length} agents registered` : "Waiting for agents to check in"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Active</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />Idle</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Error</span>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} height={180} />)}
            </div>
          ) : agents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
            </div>
          ) : (
            <EmptyState
              message="No agents have checked in yet."
              sub="POST /api/agent/:name/status  →  { status: 'active', currentTask: '...' }"
            />
          )}
        </section>

        {/* Active Quests */}
        <section>
          <SectionHeader title="Active Quests" count={runningQuests.length} sub="currently running" dot="#22c55e" />
          {loading ? <SkeletonCard height={80} /> : runningQuests.length > 0 ? (
            <div className="space-y-3">
              {runningQuests.map((q) => <QuestCard key={q.id} quest={q} />)}
            </div>
          ) : (
            <EmptyState message="No active quests." sub="PATCH /api/quest/:id  →  { status: 'running' }" />
          )}
        </section>

        {/* Pending bucket */}
        <section>
          <SectionHeader title="Pending" count={pendingQuests.length} sub="queued, not started" dot="#f59e0b" />
          {loading ? <SkeletonCard height={80} /> : pendingQuests.length > 0 ? (
            <div className="space-y-3">
              {pendingQuests.map((q) => <QuestCard key={q.id} quest={q} />)}
            </div>
          ) : (
            <EmptyState message="No pending quests." sub="POST /api/quests  →  { title, description, why, agentId }" />
          )}
        </section>

        {/* Quest log */}
        {doneQuests.length > 0 && (
          <section>
            <SectionHeader title="Quest Log" count={doneQuests.length} sub="completed & failed" dot="rgba(255,255,255,0.25)" />
            <div className="space-y-2">
              {doneQuests.slice(0, 10).map((q) => <QuestCard key={q.id} quest={q} compact />)}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-16 py-6" style={{ borderTop: "1px solid rgba(255,68,68,0.08)" }}>
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          <span>OpenClaw · Agent Dashboard · Revenue Team</span>
          <div className="flex items-center gap-4" style={{ color: "rgba(255,68,68,0.4)" }}>
            <span>GET /api/agents</span>
            <span>POST /api/agent/:name/status</span>
            <span>GET /api/quests</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ title, count, sub, dot }: { title: string; count: number; sub: string; dot: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ background: dot }} />
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
          {title}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
          {count} {sub}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>{message}</p>
      {sub && <p className="text-xs mt-1.5 font-mono" style={{ color: "rgba(255,68,68,0.3)" }}>{sub}</p>}
    </div>
  );
}

function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl animate-pulse"
      style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.06)", height }}
    />
  );
}
