"use client";

import { useMemo, useEffect, useRef } from "react";
import type { AchievementDef } from "@/app/types";
import { useDashboard } from "@/app/DashboardContext";

function conditionToText(cond: Record<string, unknown> | undefined): string {
  if (!cond) return "";
  const t = cond.type as string;
  const c = (cond.count as number) || 0;
  const TYPE_LABELS: Record<string, string> = { development: "Development", learning: "Wissen", fitness: "Fitness", social: "Social" };
  switch (t) {
    case "quests_completed": return `Schließe ${c} Quest${c > 1 ? "s" : ""} ab`;
    case "streak_days": return `Halte einen ${c}-Tage Streak`;
    case "quests_today": return `Schließe ${c} Quests an einem Tag ab`;
    case "completed_types": return `Schließe Quests in ${c} verschiedenen Kategorien ab`;
    case "boss_defeated": return `Besiege ${c} Boss-Quest${c > 1 ? "s" : ""}`;
    case "quest_type_count": return `Schließe ${c} ${TYPE_LABELS[(cond.questType as string)] || (cond.questType as string)}-Quests ab`;
    case "xp_threshold": return `Erreiche ${c} XP`;
    case "gold_threshold": return `Sammle ${c} Gold`;
    case "time_of_day": return `Schließe eine Quest zwischen ${cond.startHour}:00 und ${cond.endHour}:00 ab`;
    case "completion_time": return `Schließe eine Quest in unter ${cond.maxMinutes} Minuten ab`;
    case "chain_completed": return `Schließe ${c} NPC Quest-Chain${c > 1 ? "s" : ""} ab`;
    case "campaign_completed": return `Schließe ${c} Kampagne${c > 1 ? "n" : ""} ab`;
    case "coop_completed": return `Schließe ${c} Coop-Quest${c > 1 ? "s" : ""} ab`;
    case "early_completions": return `Schließe ${c} Quests vor ${cond.beforeHour}:00 Uhr ab`;
    case "day_of_week": return `Schließe eine Quest am Sonntag ab`;
    case "secret_found": return "???";
    default: return "";
  }
}

export default function HonorsView({ catalogue, highlightedAchievementId, onHighlightClear }: { catalogue: AchievementDef[]; highlightedAchievementId?: string | null; onHighlightClear?: () => void }) {
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedAchievementId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      // Clear after a delay so user sees the highlight then it fades
      const timer = setTimeout(() => { if (onHighlightClear) onHighlightClear(); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedAchievementId, onHighlightClear]);
  const { users, playerName: ctxPlayerName } = useDashboard();
  const playerName = ctxPlayerName || "";
  const categories = Array.from(new Set(catalogue.map(a => a.category)));
  const loggedInUser = playerName ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;
  const playerEarnedIds = new Set((loggedInUser?.earnedAchievements ?? []).map(a => a.id));
  const playerEarnedMap = new Map((loggedInUser?.earnedAchievements ?? []).map(a => [a.id, a]));

  // Precompute earner counts for rarity
  const earnerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ach of catalogue) {
      map[ach.id] = users.filter(u => (u.earnedAchievements ?? []).some(e => e.id === ach.id)).length;
    }
    return map;
  }, [catalogue, users]);

  const totalUsers = users.length;

  // Sort achievements: earned first, then by rarity (fewer earners = rarer)
    // Keep original order — no sorting by earned/unearned
  const sortAchievements = (achs: AchievementDef[]) => achs;

  const getRarityLabel = (count: number) => {
    if (count === 0) return { label: "Unearned", color: "rgba(255,255,255,0.2)" };
    const pct = totalUsers > 0 ? (count / totalUsers) * 100 : 100;
    if (pct <= 10) return { label: "Legendary", color: "#f59e0b" };
    if (pct <= 25) return { label: "Rare", color: "#a78bfa" };
    if (pct <= 50) return { label: "Uncommon", color: "#3b82f6" };
    return { label: "Common", color: "#22c55e" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #110d04 0%, #0f0f0f 100%)", border: "1px solid rgba(245,158,11,0.18)", boxShadow: "0 0 30px rgba(245,158,11,0.04)" }}>
        <div className="flex items-center gap-3 mb-1">
          <span style={{ fontSize: 28 }}>—</span>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#d4a64a" }}>Hall of Honors</h2>
            <p className="text-xs" style={{ color: "rgba(212,166,74,0.4)" }}>
              {loggedInUser ? `${loggedInUser.name} — ${playerEarnedIds.size} / ${catalogue.length} achievements` : "Log in to track your achievements"}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        {loggedInUser && catalogue.length > 0 && (
          <div className="mt-3">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(playerEarnedIds.size / catalogue.length) * 100}%`, background: "linear-gradient(90deg, #a07020, #c49530)" }} />
            </div>
          </div>
        )}
        {!playerName && (
          <p className="text-xs mt-1.5 px-1" style={{ color: "rgba(255,255,255,0.2)" }}>
            Log in via the header to see your personal achievements highlighted.
          </p>
        )}
      </div>

      {catalogue.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>No achievements data. Connect to the API.</p>
        </div>
      ) : (
        categories.map(cat => {
          const catAchs = catalogue.filter(a => a.category === cat);
          if (catAchs.length === 0) return null;
          const sorted = sortAchievements(catAchs);
          const earnedInCat = sorted.filter(a => playerEarnedIds.has(a.id)).length;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: cat === "hidden" ? "rgba(138,43,226,0.7)" : "rgba(255,255,255,0.3)" }}>
                  {cat === "hidden" ? "Secret Achievements" : cat}
                </h3>
                {playerName && (
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {earnedInCat}/{catAchs.length}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {sorted.map(ach => {
                  const earners = users.filter(u => (u.earnedAchievements ?? []).some(e => e.id === ach.id));
                  const earnerCount = earners.length;
                  const myEarned = playerEarnedIds.has(ach.id);
                  const myEarnedData = playerEarnedMap.get(ach.id);
                  const anyEarned = earnerCount > 0;
                  const isHidden = !!ach.hidden;
                  const showAsLocked = isHidden && !myEarned;
                  const highlight = playerName ? myEarned : anyEarned;
                  const rarity = getRarityLabel(earnerCount);

                  if (showAsLocked) {
                    return (
                      <div
                        key={ach.id}
                        className="rounded-xl overflow-hidden"
                        style={{ background: "#111111", border: "2px solid rgba(138,43,226,0.1)", opacity: 0.5 }}
                      >
                        <div className="h-1" style={{ background: "rgba(138,43,226,0.3)" }} />
                        <div className="p-3.5 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(138,43,226,0.08)", border: "1px solid rgba(138,43,226,0.15)" }}>
                            <span className="text-2xl" style={{ filter: "grayscale(1) brightness(0.5)" }}>?</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>??? Hidden Achievement</p>
                            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.12)" }}>Unlock to reveal...</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Trophy case frame colors
                  const frameColor = myEarned
                    ? (isHidden ? "rgba(138,43,226,0.4)" : "rgba(245,158,11,0.3)")
                    : "rgba(255,255,255,0.04)";
                  const frameShadow = myEarned
                    ? (isHidden ? "0 0 14px rgba(138,43,226,0.12), inset 0 0 14px rgba(138,43,226,0.03)" : "0 0 14px rgba(245,158,11,0.08), inset 0 0 14px rgba(245,158,11,0.02)")
                    : "none";
                  const bgColor = myEarned
                    ? (isHidden ? "linear-gradient(160deg, rgba(138,43,226,0.08) 0%, rgba(12,8,18,0.95) 100%)" : "linear-gradient(160deg, rgba(25,20,8,0.95) 0%, rgba(14,12,8,0.95) 100%)")
                    : anyEarned
                      ? "linear-gradient(160deg, rgba(20,17,10,0.6) 0%, #131313 100%)"
                      : "#131313";

                  const isHighlighted = highlightedAchievementId === ach.id;

                  return (
                    <div
                      key={ach.id}
                      ref={isHighlighted ? highlightRef : undefined}
                      className="rounded-xl overflow-hidden group"
                      style={{
                        background: bgColor,
                        border: `2px solid ${isHighlighted ? "#f59e0b" : frameColor}`,
                        boxShadow: isHighlighted ? "0 0 24px rgba(245,158,11,0.4), 0 0 48px rgba(245,158,11,0.15)" : frameShadow,
                        opacity: highlight || (!playerName && anyEarned) || isHighlighted ? 1 : 0.4,
                        transition: "all 0.3s ease",
                      }}
                    >
                      {/* Golden top strip for earned */}
                      <div className="h-1" style={{ background: myEarned ? (isHidden ? "linear-gradient(90deg, transparent, rgba(138,43,226,0.8), transparent)" : "linear-gradient(90deg, transparent, rgba(245,158,11,0.8), transparent)") : "rgba(255,255,255,0.03)" }} />

                      <div className="p-3.5">
                        <div className="flex items-start gap-3">
                          {/* Trophy icon frame */}
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: myEarned ? (isHidden ? "rgba(138,43,226,0.1)" : "rgba(245,158,11,0.08)") : "rgba(255,255,255,0.02)",
                              border: `1px solid ${myEarned ? (isHidden ? "rgba(138,43,226,0.4)" : "rgba(245,158,11,0.3)") : "rgba(255,255,255,0.06)"}`,
                              boxShadow: myEarned ? `inset 0 0 12px ${isHidden ? "rgba(138,43,226,0.15)" : "rgba(245,158,11,0.1)"}` : "none",
                            }}
                          >
                            {ach.icon && ach.icon.startsWith("/") ? <img src={ach.icon} alt="" width={48} height={48} style={{ imageRendering: "auto", filter: highlight || (!playerName && anyEarned) ? "none" : "grayscale(1) brightness(0.5)" }} /> : <span className="text-2xl" style={{ filter: highlight || (!playerName && anyEarned) ? "none" : "grayscale(1) brightness(0.5)" }}>{ach.icon}</span>}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold truncate" style={{ color: highlight ? "#f0f0f0" : "rgba(255,255,255,0.35)" }}>{ach.name}</p>
                              {isHidden && myEarned && <span className="text-xs px-1 rounded" style={{ background: "rgba(138,43,226,0.2)", color: "#a855f7", fontSize: 9 }}>SECRET</span>}
                            </div>
                            {earnerCount > 0 || myEarned
                              ? <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>{ach.desc || conditionToText(ach.condition as Record<string, unknown>) || "Achievement freigeschaltet!"}</p>
                              : <p className="text-xs mt-0.5 leading-relaxed italic" style={{ color: "rgba(255,255,255,0.15)" }}>Schließe dieses Achievement ab, um mehr zu erfahren...</p>
                            }
                          </div>
                        </div>

                        {/* Rarity + earned date + earner count */}
                        <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ color: rarity.color, fontSize: 10, letterSpacing: "0.04em" }}>
                              {rarity.label.toUpperCase()}
                            </span>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>
                              {totalUsers > 0 ? Math.round((earnerCount / totalUsers) * 100) : 0}% aller Spieler
                            </span>
                          </div>
                          {myEarned && myEarnedData?.earnedAt && (
                            <span className="text-xs" style={{ color: "rgba(245,158,11,0.5)", fontSize: 10 }}>
                              {new Date(myEarnedData.earnedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>

                        {/* Earner badges */}
                        {earners.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {earners.map(u => (
                              <span
                                key={u.id}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{
                                  background: `${u.color}15`,
                                  color: `${u.color}cc`,
                                  border: `1px solid ${u.color}30`,
                                  fontSize: 10,
                                  fontWeight: playerName && (u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) ? 700 : 400,
                                }}
                              >
                                {u.name}
                              </span>
                            ))}
                          </div>
                        )}
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
