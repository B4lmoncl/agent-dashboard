"use client";

interface Agent {
  id: string;
  name: string;
  status: "active" | "idle" | "error" | "working" | "thinking" | "online";
  lastUpdate: string | null;
  currentTask: string | null;
  results?: { title: string; success: boolean; timestamp: string }[];
  pendingCommands?: number;
  role?: string;
  model?: string;
  description?: string;
  avatar?: string;
  color?: string;
  tasksCompleted?: number;
  lastSeen?: string;
}

const statusConfig: Record<string, { label: string; color: string; glow: string }> = {
  active:   { label: "Active",   color: "#22c55e", glow: "rgba(34,197,94,0.2)" },
  online:   { label: "Online",   color: "#22c55e", glow: "rgba(34,197,94,0.2)" },
  working:  { label: "Working",  color: "#ff6633", glow: "rgba(255,102,51,0.25)" },
  thinking: { label: "Thinking", color: "#a78bfa", glow: "rgba(167,139,250,0.25)" },
  idle:     { label: "Idle",     color: "#eab308", glow: "rgba(234,179,8,0.15)" },
  error:    { label: "Error",    color: "#ff4444", glow: "rgba(255,68,68,0.2)" },
};

const agentMeta: Record<string, { avatar: string; color: string; role: string }> = {
  nova:  { avatar: "NO", color: "#8b5cf6", role: "Optimizer" },
  hex:   { avatar: "HX", color: "#10b981", role: "Code Engineer" },
  echo:  { avatar: "EC", color: "#ef4444", role: "Sales" },
  pixel: { avatar: "PX", color: "#f59e0b", role: "Marketer" },
  atlas: { avatar: "AT", color: "#6366f1", role: "Researcher" },
  lyra:  { avatar: "LY", color: "#e879f9", role: "AI Orchestrator" },
};

export default function AgentCard({ agent }: { agent: Agent }) {
  const st = statusConfig[agent.status] ?? statusConfig.idle;
  const meta = agentMeta[agent.id?.toLowerCase()] ?? {
    avatar: (agent.id ?? "??").slice(0, 2).toUpperCase(),
    color: "#666",
    role: agent.role ?? "Agent",
  };
  const avatar = agent.avatar ?? meta.avatar;
  const color = agent.color ?? meta.color;
  const role = agent.role ?? meta.role;
  const lastSeen = agent.lastUpdate ?? agent.lastSeen;
  const lastSeenStr = lastSeen
    ? new Date(lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "never";
  const lastResult = agent.results?.[0];

  return (
    <div
      className="group relative rounded-2xl p-5 transition-all duration-200"
      style={{
        background: "#181818",
        border: "1px solid rgba(255,68,68,0.15)",
        boxShadow: agent.status === "active" ? `0 0 20px ${st.glow}` : "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,68,68,0.35)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 30px ${st.glow}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,68,68,0.15)";
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          agent.status === "active" ? `0 0 20px ${st.glow}` : "none";
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(ellipse at top left, ${color}10 0%, transparent 60%)` }}
      />
      <div className="relative flex items-start gap-4">
        <div
          className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${color}cc, ${color}66)`, boxShadow: `0 2px 12px ${color}30` }}
        >
          {avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold truncate" style={{ color: "#e8e8e8" }}>{agent.name}</h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: st.color, boxShadow: `0 0 4px ${st.color}` }} />
              <span className="text-xs font-medium" style={{ color: st.color }}>{st.label}</span>
            </div>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{role}</p>
          {agent.model && (
            <p className="text-xs mt-0.5 font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>{agent.model}</p>
          )}
        </div>
      </div>
      <div className="relative mt-3">
        {agent.currentTask ? (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "rgba(255,255,255,0.7)", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.15)" }}>
            ▶ {agent.currentTask}
          </p>
        ) : agent.description ? (
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{agent.description}</p>
        ) : (
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>No current task</p>
        )}
      </div>
      {lastResult && (
        <p className="relative mt-2 text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
          <span style={{ color: lastResult.success ? "#22c55e" : "#ff4444" }}>{lastResult.success ? "✓" : "✗"}</span>{" "}
          {lastResult.title}
        </p>
      )}
      <div className="relative mt-4 pt-4 grid grid-cols-3 gap-2 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Done</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
            {agent.tasksCompleted ?? (agent.results?.filter((r) => r.success).length ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Cmds</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: (agent.pendingCommands ?? 0) > 0 ? "#ff6633" : "rgba(255,255,255,0.7)" }}>
            {agent.pendingCommands ?? 0}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Seen</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>{lastSeenStr}</p>
        </div>
      </div>
    </div>
  );
}
