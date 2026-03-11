"use client";

import type { User, QuestsData } from "@/app/types";
import { CURRENT_SEASON } from "@/app/utils";

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

export default function BattlePassView({ users, quests }: { users: User[]; quests: QuestsData }) {
  const season = CURRENT_SEASON;
  const now = new Date();
  const seasonMonth = SEASON_START_MONTHS[season.name] ?? now.getMonth();
  const seasonYear = season.name === "Winter" && now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const seasonStart = new Date(seasonYear, seasonMonth, 1);
  const nextSeasonMonth = (seasonMonth + 3) % 12;
  const nextSeasonYear = nextSeasonMonth < seasonMonth ? seasonYear + 1 : seasonYear;
  const seasonEnd = new Date(nextSeasonYear, nextSeasonMonth, 1);

  // Compute season XP per user (XP earned since seasonStart, approximated from quest completions)
  const seasonCompleted = quests.completed.filter(q => q.completedAt && new Date(q.completedAt) >= seasonStart);
  const XP_MAP: Record<string, number> = { high: 30, medium: 20, low: 10 };
  const userSeasonXp: Record<string, number> = {};
  for (const q of seasonCompleted) {
    const uid = (q.completedBy || "").toLowerCase();
    if (uid) userSeasonXp[uid] = (userSeasonXp[uid] ?? 0) + (XP_MAP[q.priority] ?? 10);
  }
  // Time-based season progress bar (2026-03-01 → 2026-06-01)
  const SEASON_FIXED_START = new Date("2026-03-01");
  const SEASON_FIXED_END = new Date("2026-06-01");
  const timePct = Math.min(100, Math.max(0, Math.round(
    (now.getTime() - SEASON_FIXED_START.getTime()) / (SEASON_FIXED_END.getTime() - SEASON_FIXED_START.getTime()) * 100
  )));
  const progressPct = timePct;

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
              {seasonStart.toLocaleDateString()} – {seasonEnd.toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold" style={{ color: season.color }}>{seasonCompleted.length} quests this season</p>
          </div>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${season.color}80, ${season.color})` }} />
        </div>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Season Progress {progressPct}% · {SEASON_FIXED_START.toLocaleDateString()} – {SEASON_FIXED_END.toLocaleDateString()}</p>
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
