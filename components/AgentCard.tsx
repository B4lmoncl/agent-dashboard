"use client";

interface Agent {
  id: string;
  name: string;
  status: "online" | "working" | "idle" | "offline";
  platform: string | null;
  uptime: number; // seconds
  currentJobDuration: number; // seconds
  jobsCompleted: number;
  questsCompleted?: number;
  revenue: number;
  health: "ok" | "needs_checkin" | "broken" | "stale";
  lastUpdate: string | null;
  role?: string;
  description?: string;
  avatar?: string;
  color?: string;
  pendingCommands?: number;
}

interface Quest {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "completed";
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
  lyra:  { avatar: "LY", color: "#e879f9", role: "AI Orchestrator", description: "AI Orchestrator. Team lead. Gets shit done." },
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
              fontSize: isWide ? 20 : 15,
              letterSpacing: "0.06em",
            }}
          >
            {avatar}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm truncate" style={{ color: "#f0f0f0" }}>{agent.name}</h3>
            <div
              className="flex items-center gap-1.5 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: `${st.dot}15`, border: `1px solid ${st.dot}40`, color: st.color }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{
                  background: st.dot,
                  boxShadow: isActive ? `0 0 7px ${st.dot}, 0 0 14px ${st.dot}60` : "none",
                  animation: agent.status === "working" ? "pulse 1.2s ease-in-out infinite" : "none",
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
          label="Current Job"
          value={agent.status === "working" || agent.currentJobDuration > 0 ? formatDuration(agent.currentJobDuration) : "—"}
          highlight={agent.status === "working"}
        />
        <MetricRow label="Jobs Completed" value={String(agent.jobsCompleted ?? 0)} />
        <MetricRow
          label="Quests Completed"
          value={String(agent.questsCompleted ?? 0)}
          highlight={(agent.questsCompleted ?? 0) > 0}
          highlightColor="#8b5cf6"
        />
        <MetricRow
          label="Revenue"
          value={`$${(agent.revenue ?? 0).toFixed(2)}`}
          highlight={(agent.revenue ?? 0) > 0}
          highlightColor="#22c55e"
        />
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
}: {
  label: string;
  value: string;
  highlight?: boolean;
  highlightColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</span>
      <span
        className="text-xs font-medium font-mono"
        style={{ color: highlight ? highlightColor : "rgba(255,255,255,0.7)" }}
      >
        {value}
      </span>
    </div>
  );
}
