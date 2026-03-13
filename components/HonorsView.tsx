"use client";

import type { AchievementDef, User, QuestsData } from "@/app/types";

export default function HonorsView({ catalogue, users, playerName = "" }: { catalogue: AchievementDef[]; users: User[]; playerName?: string; quests?: QuestsData; reviewApiKey?: string }) {
  const categories = Array.from(new Set(catalogue.map(a => a.category)));
  const loggedInUser = playerName ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;
  const playerEarnedIds = new Set((loggedInUser?.earnedAchievements ?? []).map(a => a.id));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #1a1208 0%, #1a1a1a 100%)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 40px rgba(245,158,11,0.07)" }}>
        <div className="flex items-center gap-3 mb-1">
          <span style={{ fontSize: 28 }}>x</span>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#fef3c7" }}>Hall of Honors</h2>
            <p className="text-xs" style={{ color: "rgba(253,230,138,0.5)" }}>
              {loggedInUser ? `${loggedInUser.name} — ${playerEarnedIds.size} achievement${playerEarnedIds.size !== 1 ? "s" : ""} earned` : "Log in to track your achievements"}
            </p>
          </div>
        </div>
        {!playerName && (
          <p className="text-xs mt-1.5 px-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            x Log in via the header to see your personal achievements highlighted.
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
          const visibleAchs = catAchs.filter(ach => {
            if (!ach.hidden) return true;
            return true; // render ??? below for locked hidden ones
          });
          if (visibleAchs.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: cat === "hidden" ? "rgba(138,43,226,0.7)" : "rgba(255,255,255,0.3)" }}>
                {cat === "hidden" ? "x Secret Achievements" : cat}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {visibleAchs.map(ach => {
                  const earners = users.filter(u =>
                    (u.earnedAchievements ?? []).some(e => e.id === ach.id)
                  );
                  const myEarned = playerEarnedIds.has(ach.id);
                  const anyEarned = earners.length > 0;
                  const isHidden = !!ach.hidden;
                  const showAsLocked = isHidden && !myEarned;
                  const highlight = playerName ? myEarned : anyEarned;
                  if (showAsLocked) {
                    return (
                      <div
                        key={ach.id}
                        className="rounded-xl p-3"
                        style={{ background: "#1a1a1a", border: "1px solid rgba(138,43,226,0.2)", opacity: 0.6 }}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-2xl flex-shrink-0" style={{ filter: "grayscale(1)" }}>x</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>??? Hidden Achievement</p>
                            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>Unlock to reveal...</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={ach.id}
                      className="rounded-xl p-3"
                      style={{
                        background: myEarned ? (isHidden ? "rgba(138,43,226,0.15)" : "rgba(245,158,11,0.12)") : anyEarned ? "rgba(245,158,11,0.04)" : "#252525",
                        border: `1px solid ${myEarned ? (isHidden ? "rgba(138,43,226,0.6)" : "rgba(245,158,11,0.5)") : anyEarned ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}`,
                        opacity: highlight || (!playerName && anyEarned) ? 1 : 0.45,
                        boxShadow: myEarned ? (isHidden ? "0 0 14px rgba(138,43,226,0.2)" : "0 0 14px rgba(245,158,11,0.12)") : "none",
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-2xl flex-shrink-0" style={{ filter: highlight || (!playerName && anyEarned) ? "none" : "grayscale(1)" }}>{ach.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold" style={{ color: highlight ? "#f0f0f0" : "rgba(255,255,255,0.4)" }}>{ach.name}</p>
                            {isHidden && myEarned && <span className="text-xs px-1 rounded" style={{ background: "rgba(138,43,226,0.2)", color: "#a855f7" }}>secret</span>}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{ach.desc}</p>
                          {earners.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {earners.filter(u => u.id.toLowerCase() !== playerName.toLowerCase() && u.name.toLowerCase() !== playerName.toLowerCase()).map(u => (
                                <span
                                  key={u.id}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: `${u.color}20`, color: u.color, border: `1px solid ${u.color}40` }}
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

    </div>
  );
}
