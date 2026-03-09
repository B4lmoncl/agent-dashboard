"use client";

import { useEffect, useRef, useState } from "react";

interface Agent {
  id: string;
  name: string;
  status: "online" | "working" | "idle" | "offline";
  platform: string | null;
  uptime: number; // seconds
  currentJobDuration: number; // seconds
  questsCompleted?: number;
  xp?: number;
  gold?: number;
  streakDays?: number;
  health: "ok" | "needs_checkin" | "broken" | "stale";
  lastUpdate: string | null;
  role?: string;
  description?: string;
  avatar?: string;
  color?: string;
  pendingCommands?: number;
}

// ─── XP / Level system ────────────────────────────────────────────────────────
const LEVELS = [
  { name: "Novice",     min: 0,   max: 99,  color: "#9ca3af" },
  { name: "Apprentice", min: 100, max: 299, color: "#22c55e" },
  { name: "Knight",     min: 300, max: 599, color: "#3b82f6" },
  { name: "Archmage",   min: 600, max: Infinity, color: "#a855f7" },
];

function getLevel(xp: number) {
  return LEVELS.findLast(l => xp >= l.min) ?? LEVELS[0];
}

function getXpProgress(xp: number): number {
  const lvl = getLevel(xp);
  if (lvl.max === Infinity) return 1;
  return (xp - lvl.min) / (lvl.max - lvl.min + 1);
}

interface Quest {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "completed" | "suggested" | "rejected";
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

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  online:  { label: "Online",  color: "#4ade80", dot: "#4ade80" },
  working: { label: "Working", color: "#ff6b00", dot: "#ff6b00" },
  idle:    { label: "Idle",    color: "#facc15", dot: "#facc15" },
  offline: { label: "Offline", color: "rgba(255,255,255,0.25)", dot: "rgba(255,255,255,0.2)" },
};

const statusDotAnim: Record<string, string> = {
  online:  "pulse-online 2s ease-in-out infinite",
  working: "pulse-working 1.5s ease-in-out infinite",
  idle:    "pulse-idle 3s ease-in-out infinite",
  offline: "none",
};

const healthConfig: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  ok:            { label: "Health: OK",           color: "#22c55e", bg: "rgba(34,197,94,0.08)"   },
  needs_checkin: { label: "⚠ Needs Check-In",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)", pulse: true },
  broken:        { label: "✕ Broken",              color: "#ff4444", bg: "rgba(255,68,68,0.12)"   },
  stale:         { label: "Health: Stale",         color: "#6b7280", bg: "rgba(107,114,128,0.1)"  },
};

const priorityDot: Record<string, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#ef4444",
};

const agentMeta: Record<string, { avatar: string; color: string; role: string; description: string }> = {
  nova:  { avatar: "NO", color: "#8b5cf6", role: "Optimizer",       description: "Numbers-driven optimizer. Quietly competitive." },
  hex:   { avatar: "HX", color: "#10b981", role: "Code Engineer",   description: "Blunt coder. Ships fast, talks less." },
  echo:  { avatar: "EC", color: "#ef4444", role: "Sales",           description: "Bold sales closer. Charm offensive." },
  pixel: { avatar: "PX", color: "#f59e0b", role: "Marketer",        description: "Creative marketer. Eye for aesthetics." },
  atlas: { avatar: "AT", color: "#6366f1", role: "Researcher",      description: "Deep researcher. Pattern finder." },
  lyra:  { avatar: "✦", color: "#e879f9", role: "AI Orchestrator", description: "AI Orchestrator. Team lead. Gets shit done." },
  forge: { avatar: "⚒", color: "#f59e0b", role: "Idea Smith", description: "Feature ideation. Hammers out quest suggestions." },
};

export default function AgentCard({ agent, activeQuests = [], isWide = false }: { agent: Agent; activeQuests?: Quest[]; isWide?: boolean }) {
  const st = statusConfig[agent.status] ?? statusConfig.offline;
  const hc = healthConfig[agent.health] ?? healthConfig.ok;
  const meta = agentMeta[agent.id?.toLowerCase()] ?? {
    avatar: (agent.id ?? "??").slice(0, 2).toUpperCase(),
    color: "#666",
    role: agent.role ?? "Agent",
  };
  const avatar = agent.avatar ?? meta.avatar;
  const color = agent.color ?? meta.color;
  const description = agent.description ?? meta.description ?? meta.role;
  const needsCheckin = agent.health === "needs_checkin";
  const isActive = agent.status === "online" || agent.status === "working";

  // CountUp animations for numeric metrics
  const animQuests  = useCountUp(agent.questsCompleted ?? 0, 0);

  // Shimmer on value change (skip initial mount)
  const prevQuestsRef  = useRef(agent.questsCompleted ?? 0);
  const [shimmerQuests,  setShimmerQuests]  = useState(false);

  useEffect(() => {
    const q = agent.questsCompleted ?? 0;
    if (prevQuestsRef.current === q) return;
    prevQuestsRef.current = q;
    setShimmerQuests(true);
    const t = setTimeout(() => setShimmerQuests(false), 800);
    return () => clearTimeout(t);
  }, [agent.questsCompleted]);

  return (
    <div
      className="group relative rounded-xl p-5 transition-all duration-200"
      style={{
        background: "#252525",
        border: `1px solid ${needsCheckin ? "rgba(245,158,11,0.35)" : isActive ? "rgba(255,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
        boxShadow: needsCheckin ? "0 0 20px rgba(245,158,11,0.1)" : isActive ? "0 0 20px rgba(255,68,68,0.06)" : "none",
        transform: "translateY(0)",
        transition: "border 0.2s, box-shadow 0.2s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.border = needsCheckin ? "1px solid rgba(245,158,11,0.7)" : "1px solid rgba(255,68,68,0.45)";
        el.style.boxShadow = needsCheckin ? "0 8px 32px rgba(245,158,11,0.2)" : "0 8px 32px rgba(255,68,68,0.18)";
        el.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.border = `1px solid ${needsCheckin ? "rgba(245,158,11,0.35)" : isActive ? "rgba(255,68,68,0.2)" : "rgba(255,255,255,0.06)"}`;
        el.style.boxShadow = needsCheckin ? "0 0 20px rgba(245,158,11,0.1)" : isActive ? "0 0 20px rgba(255,68,68,0.06)" : "none";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* Header row: avatar + name + status badge */}
      <div className="flex items-center gap-3">
        <div
          className="flex-shrink-0 relative"
          style={{ width: isWide ? 72 : 58, height: isWide ? 72 : 58 }}
        >
          {/* Outer glow ring for active agents */}
          {isActive && (
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                boxShadow: `0 0 0 2px ${color}70, 0 0 20px ${color}55`,
                borderRadius: isWide ? 18 : 14,
                animation: agent.status === "working" ? "pulse 2s ease-in-out infinite" : "none",
              }}
            />
          )}
          <div
            className="w-full h-full rounded-2xl flex items-center justify-center font-black text-white"
            style={{
              background: `linear-gradient(135deg, ${color}, ${color}99)`,
              boxShadow: `0 6px 20px ${color}50`,
              fontSize: avatar.length === 1 ? (isWide ? 30 : 24) : (isWide ? 20 : 15),
              letterSpacing: avatar.length === 1 ? "0" : "0.06em",
            }}
          >
            {avatar}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-semibold text-sm truncate" style={{ color: "#f0f0f0" }}>{agent.name}</h3>
              {(agent.streakDays ?? 0) > 0 && (
                <span
                  className="text-xs font-bold flex-shrink-0"
                  style={{ color: (agent.streakDays ?? 0) >= 30 ? "#ef4444" : (agent.streakDays ?? 0) >= 7 ? "#f59e0b" : "#fb923c" }}
                  title={`${agent.streakDays} day streak`}
                >
                  🔥{agent.streakDays}
                </span>
              )}
            </div>
            <div
              className="flex items-center gap-1.5 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: `${st.dot}15`, border: `1px solid ${st.dot}40`, color: st.color }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{
                  background: st.dot,
                  animation: statusDotAnim[agent.status] ?? "none",
                }}
              />
              {st.label}
            </div>
          </div>
          <p className="text-xs mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.35)" }}>{description}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className={`mt-4 ${isWide ? "grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2" : "space-y-2"}`}>
        <MetricRow label="Platform" value={agent.platform ?? "—"} />
        <MetricRow label="Uptime" value={formatDuration(agent.uptime)} />
        <MetricRow
          label="Current Quest"
          value={agent.status === "working" || agent.currentJobDuration > 0 ? formatDuration(agent.currentJobDuration) : "—"}
          highlight={agent.status === "working"}
        />
        <MetricRow
          label="Quests Completed"
          value={animQuests}
          highlight={(agent.questsCompleted ?? 0) > 0}
          highlightColor="#8b5cf6"
          shimmer={shimmerQuests}
        />
        {(agent.gold ?? 0) > 0 && (
          <MetricRow
            label="Gold"
            value={`🪙 ${agent.gold}`}
            highlight={true}
            highlightColor="#f59e0b"
          />
        )}
      </div>

      {/* Health badge */}
      <div
        className="mt-4 px-3 py-1.5 rounded-lg text-xs font-medium text-center"
        style={{
          background: hc.bg,
          color: hc.color,
          border: `1px solid ${hc.color}${needsCheckin ? "60" : "30"}`,
          animation: needsCheckin ? "pulse 1.5s ease-in-out infinite" : "none",
          fontWeight: needsCheckin ? 700 : undefined,
        }}
      >
        {hc.label}
      </div>

      {/* XP Bar */}
      {(() => {
        const xp = agent.xp ?? 0;
        const lvl = getLevel(xp);
        const progress = getXpProgress(xp);
        const nextLvl = LEVELS[LEVELS.indexOf(lvl) + 1];
        return (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: lvl.color }}>{lvl.name}</span>
              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                {xp} XP{nextLvl ? ` / ${nextLvl.min}` : " — MAX"}
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.07)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  background: `linear-gradient(90deg, ${lvl.color}99, ${lvl.color})`,
                  boxShadow: `0 0 6px ${lvl.color}80`,
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* Active Quests */}
      {activeQuests.length > 0 && (
        <div className="mt-3">
          <p className="text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>Active Quests</p>
          <div className="flex flex-wrap gap-1.5">
            {activeQuests.map(q => (
              <div
                key={q.id}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs max-w-full"
                style={{
                  background: "rgba(139,92,246,0.1)",
                  border: "1px solid rgba(139,92,246,0.25)",
                  color: "rgba(255,255,255,0.6)",
                }}
                title={q.title}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: priorityDot[q.priority] ?? "#888" }}
                />
                <span className="truncate" style={{ maxWidth: "120px" }}>{q.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricRow({
  label,
  value,
  highlight = false,
  highlightColor = "#ff6633",
  shimmer = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  highlightColor?: string;
  shimmer?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</span>
      <span
        className={`text-xs font-medium font-mono flex-shrink-0${shimmer ? " shimmer" : ""}`}
        style={{ color: highlight ? highlightColor : "rgba(255,255,255,0.7)" }}
      >
        {value}
      </span>
    </div>
  );
}
