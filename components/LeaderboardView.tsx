"use client";

import type { LeaderboardEntry, Agent, User } from "@/app/types";
import { useDashboard } from "@/app/DashboardContext";
import { getLbLevel } from "@/app/utils";
import { Tip } from "@/components/GameTooltip";

const agentMetaLb: Record<string, { avatar: string; color: string }> = {
  nova:  { avatar: "NO", color: "#8b5cf6" },
  hex:   { avatar: "HX", color: "#10b981" },
  echo:  { avatar: "EC", color: "#ef4444" },
  pixel: { avatar: "PX", color: "#f59e0b" },
  atlas: { avatar: "AT", color: "#6366f1" },
  lyra:  { avatar: "LY",  color: "#e879f9" },
  forge: { avatar: "FG",  color: "#f59e0b" },
};

const RANK_ICONS = ["/images/icons/ui-rank-gold.png", "/images/icons/ui-rank-silver.png", "/images/icons/ui-rank-bronze.png"];
const RankMedal = ({ rank }: { rank: number }) => rank <= 3
  ? <img src={RANK_ICONS[rank - 1]} alt={`#${rank}`} width={24} height={24} style={{ imageRendering: "auto" as const }} onError={e => { e.currentTarget.style.display = "none"; }} />
  : <span>#{rank}</span>;

// ─── Forge Temperature tiers ─────────────────────────────────────────────────

const FORGE_TIERS = [
  { min: 0,   label: "Cold",      color: "#4b5563" },
  { min: 20,  label: "Smoldering", color: "#78716c" },
  { min: 40,  label: "Warming",   color: "#b45309" },
  { min: 60,  label: "Burning",   color: "#ea580c" },
  { min: 80,  label: "Blazing",   color: "#f97316" },
  { min: 100, label: "White-hot", color: "#e0f0ff" },
];

function getForgeTier(temp: number) {
  for (let i = FORGE_TIERS.length - 1; i >= 0; i--) {
    if (temp >= FORGE_TIERS[i].min) return FORGE_TIERS[i];
  }
  return FORGE_TIERS[0];
}

// ─── Extended entry type for player mode ─────────────────────────────────────

type PlayerEntry = LeaderboardEntry & {
  classId?: string | null;
  forgeTemp?: number;
  gold?: number;
  companion?: { type: string; name: string; emoji: string } | null;
  earnedAchievements?: unknown[];
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeaderboardView({ entries, agents, mode = "agents", onOpenProfile }: {
  entries: LeaderboardEntry[];
  agents: Agent[];
  mode?: "agents" | "players";
  onOpenProfile?: (playerId: string) => void;
}) {
  const { users, classesList: classes } = useDashboard();
  const classMap = new Map(classes.map(c => [c.id, c]));
  const agentIdSet = new Set(agents.map(a => a.id));

  // Build user lookup for player mode (to get extra fields not on LeaderboardEntry)
  const userMap = new Map(users.map(u => [u.id, u]));

  let merged: PlayerEntry[];
  if (mode === "players") {
    merged = users
      .filter(u => !agentIdSet.has(u.id))
      .map((u) => ({
        rank: 0,
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        color: u.color,
        xp: u.xp ?? 0,
        questsCompleted: u.questsCompleted ?? 0,
        classId: u.classId ?? null,
        forgeTemp: u.forgeTemp ?? 0,
        gold: u.gold ?? u.currencies?.gold ?? 0,
        companion: u.companion ?? null,
        earnedAchievements: u.earnedAchievements ?? [],
      }))
      .sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  } else {
    const agentEntries = entries.filter(e => agentIdSet.has(e.id));
    merged = (agentEntries.length > 0 ? agentEntries : agents.map((a) => ({
      rank: 0,
      id: a.id,
      name: a.name,
      avatar: a.avatar,
      color: a.color,
      xp: a.xp ?? 0,
      questsCompleted: a.questsCompleted ?? 0,
    }))).sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  if (merged.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-2xl mb-2">{mode === "players" ? "🏆" : "🤖"}</p>
        <p className="text-sm font-medium mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{mode === "players" ? "The Proving Grounds await" : "No agents deployed"}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>{mode === "players" ? "Register and complete quests to claim your rank." : "Deploy agents to see them on the leaderboard."}</p>
      </div>
    );
  }

  const top3 = merged.slice(0, 3);
  const isPlayerMode = mode === "players";

  return (
    <div className="space-y-6 tab-content-enter">
      {/* ── Podium ── */}
      <div className="flex items-end justify-center gap-4">
        {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry) => {
          const rank = entry.rank;
          const heights: Record<number, string> = { 1: "h-32", 2: "h-24", 3: "h-20" };
          const podiumHeightClass = heights[rank] ?? "h-16";
          const meta = agentMetaLb[entry.id?.toLowerCase()] ?? { avatar: entry.avatar ?? entry.id?.slice(0, 2).toUpperCase() ?? "??", color: entry.color ?? "#666" };
          const color = entry.color ?? meta.color;
          const lvl = getLbLevel(entry.xp);
          const cls = isPlayerMode && entry.classId && entry.classId !== "null" ? classMap.get(entry.classId) : null;
          return (
            <div key={entry.id} className="flex flex-col items-center gap-2" style={{ minWidth: 100 }}>
              <div className="text-lg"><RankMedal rank={rank} /></div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, boxShadow: `0 6px 20px ${color}60` }}
              >
                {entry.avatar ?? meta.avatar}
              </div>
              <div className="text-center space-y-0.5">
                <p className="text-xs font-bold" style={{ color: "#f0f0f0" }}>{entry.name}</p>
                {(() => { const t = userMap.get(entry.id)?.equippedTitle; const tc: Record<string,string> = { common: "#9ca3af", uncommon: "#22c55e", rare: "#60a5fa", epic: "#a855f7", legendary: "#f97316" }; return t ? <p className="text-xs font-medium" style={{ color: tc[t.rarity] ?? "#9ca3af" }}>{t.name}</p> : null; })()}
                {cls && <p className="text-xs" style={{ color: "rgba(167,139,250,0.7)" }}>{cls.icon} {cls.fantasy}</p>}
                <p className="text-xs" style={{ color: lvl.color }}>{lvl.name}</p>
                <span className="text-xs font-mono font-bold" style={{ color: "#a855f7" }}>{entry.xp} XP</span>
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

      {/* ── Ranking Note ── */}
      <Tip k="leaderboard_rank"><p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
        Ranked by XP · Ties broken by Quests Completed
      </p></Tip>

      {/* ── Leaderboard Table ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="grid px-4 py-2" style={{ gridTemplateColumns: "40px 1fr 80px 80px 80px", color: "rgba(255,255,255,0.3)", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>#</span><span>{isPlayerMode ? "Adventurer" : "Agent"}</span><Tip k="player_level"><span className="text-right">Level</span></Tip><Tip k="xp"><span className="text-right">XP</span></Tip><span className="text-right">Quests</span>
        </div>
        {merged.map((entry) => {
          const meta = agentMetaLb[entry.id?.toLowerCase()] ?? { avatar: entry.avatar ?? entry.id?.slice(0, 2).toUpperCase() ?? "??", color: entry.color ?? "#666" };
          const color = entry.color ?? meta.color;
          const lvl = getLbLevel(entry.xp);
          const isTop = entry.rank <= 3;
          const maxXp = merged[0]?.xp ?? 1;
          const barPct = maxXp > 0 ? (entry.xp / maxXp) * 100 : 0;

          return (
            <div
              key={entry.id}
              className={`cv-auto grid px-4 py-3 items-center${isPlayerMode && onOpenProfile ? " cursor-pointer hover:bg-white/[0.03] transition-colors" : ""}`}
              onClick={isPlayerMode && onOpenProfile ? () => onOpenProfile(entry.id) : undefined}
              style={{
                gridTemplateColumns: "40px 1fr 80px 80px 80px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: isTop ? `${color}08` : "transparent",
              }}
            >
              <span className="text-sm font-bold" style={{ color: entry.rank <= 3 ? ["#f59e0b", "#9ca3af", "#cd7f32"][entry.rank - 1] : "rgba(255,255,255,0.25)" }}>
                <RankMedal rank={entry.rank} />
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, color: "#fff" }}
                >
                  {entry.avatar ?? meta.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold truncate" style={{ color: "#f0f0f0" }}>{entry.name}</p>
                    {isPlayerMode && (() => { const t = userMap.get(entry.id)?.equippedTitle; const tc: Record<string,string> = { common: "#9ca3af", uncommon: "#22c55e", rare: "#60a5fa", epic: "#a855f7", legendary: "#f97316" }; return t ? <span className="text-xs flex-shrink-0" style={{ color: tc[t.rarity] ?? "#9ca3af" }}>{t.name}</span> : null; })()}
                    {isPlayerMode && (() => {
                      const cls = entry.classId && entry.classId !== "null" ? classMap.get(entry.classId) : null;
                      return cls ? (
                        <span className="text-xs flex-shrink-0" style={{ color: "rgba(167,139,250,0.6)" }}>{cls.icon} {cls.fantasy}</span>
                      ) : (
                        <span className="text-xs flex-shrink-0 italic" style={{ color: "rgba(255,255,255,0.15)" }}>No Class</span>
                      );
                    })()}
                  </div>
                  <div className="mt-0.5 rounded-full overflow-hidden" style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }} />
                  </div>
                </div>
              </div>
              <span className="text-right text-xs font-semibold" style={{ color: lvl.color }}>{lvl.name}</span>
              <span className="text-right text-xs font-mono font-bold" style={{ color: "#a855f7" }}>{entry.xp.toLocaleString()}</span>
              <span className="text-right text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>{entry.questsCompleted.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
