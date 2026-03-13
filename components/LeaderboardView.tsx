"use client";

import type { LeaderboardEntry, Agent, User } from "@/app/types";
import { getLbLevel } from "@/app/utils";

const agentMetaLb: Record<string, { avatar: string; color: string }> = {
  nova:  { avatar: "NO", color: "#8b5cf6" },
  hex:   { avatar: "HX", color: "#10b981" },
  echo:  { avatar: "EC", color: "#ef4444" },
  pixel: { avatar: "PX", color: "#f59e0b" },
  atlas: { avatar: "AT", color: "#6366f1" },
  lyra:  { avatar: "x",  color: "#e879f9" },
  forge: { avatar: "x",  color: "#f59e0b" },
};

const rankMedal = ["x", "x", "x"];

export default function LeaderboardView({ entries, agents, mode = "agents", users = [] }: { entries: LeaderboardEntry[]; agents: Agent[]; mode?: "agents" | "players"; users?: User[] }) {
  // For players mode: build leaderboard from users (registered players only, exclude agent IDs)
  // For agents mode: use entries/agents as before
  const agentIdSet = new Set(agents.map(a => a.id));
  let merged: LeaderboardEntry[];
  if (mode === "players") {
    merged = users
      .filter(u => !agentIdSet.has(u.id))
      .map((u, i) => ({
        rank: i + 1,
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        color: u.color,
        xp: u.xp ?? 0,
        questsCompleted: u.questsCompleted ?? 0,
      })).sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted).map((e, i) => ({ ...e, rank: i + 1 }));
  } else {
    // agents mode: filter entries to only agent IDs
    const agentEntries = entries.filter(e => agentIdSet.has(e.id));
    merged = agentEntries.length > 0 ? agentEntries : agents.map((a, i) => ({
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
          const rank = entry.rank;
          const heights: Record<number, string> = { 1: "h-32", 2: "h-24", 3: "h-20" };
          const podiumHeightClass = heights[rank] ?? "h-16";
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
                className={`w-full rounded-t-lg flex items-center justify-center ${podiumHeightClass}`}
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
          <span>#</span><span>{mode === "players" ? "Adventurer" : "Agent"}</span><span className="text-right">Level</span><span className="text-right">XP</span><span className="text-right">Quests</span>
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
      {rest.length === 0 && null}
    </div>
  );
}
