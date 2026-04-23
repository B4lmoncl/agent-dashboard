"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import type { AchievementDef } from "@/app/types";
import { useDashboard } from "@/app/DashboardContext";
import { Tip, TipCustom } from "@/components/GameTooltip";

function conditionToText(cond: Record<string, unknown> | undefined): string {
  if (!cond) return "";
  const t = cond.type as string;
  const c = (cond.count as number) || 0;
  const TYPE_LABELS: Record<string, string> = { development: "Development", learning: "Learning", fitness: "Fitness", social: "Social" };
  switch (t) {
    case "quests_completed": return `Complete ${c} quest${c > 1 ? "s" : ""}`;
    case "streak_days": return `Maintain a ${c}-day streak`;
    case "quests_today": return `Complete ${c} quests in one day`;
    case "completed_types": return `Complete quests in ${c} different categories`;
    case "boss_defeated": return `Defeat ${c} boss quest${c > 1 ? "s" : ""}`;
    case "quest_type_count": return `Complete ${c} ${TYPE_LABELS[(cond.questType as string)] || (cond.questType as string)} quests`;
    case "xp_threshold": return `Reach ${c} XP`;
    case "gold_threshold": return `Collect ${c} Gold`;
    case "time_of_day": return `Complete a quest between ${cond.startHour}:00 and ${cond.endHour}:00`;
    case "completion_time": return `Complete a quest in under ${cond.maxMinutes} minutes`;
    case "chain_completed": return `Complete ${c} NPC quest chain${c > 1 ? "s" : ""}`;
    case "campaign_completed": return `Complete ${c} campaign${c > 1 ? "s" : ""}`;
    case "coop_completed": return `Complete ${c} coop quest${c > 1 ? "s" : ""}`;
    case "early_completions": return `Complete ${c} quests before ${cond.beforeHour}:00`;
    case "day_of_week": return `Complete a quest on Sunday`;
    case "secret_found": return "???";
    default: return "";
  }
}

// Category color map — used for tab highlight tints
const CAT_COLORS: Record<string, string> = {
  hidden: "#a855f7",
  progression: "#f59e0b",
  social: "#3b82f6",
  combat: "#ef4444",
  exploration: "#22c55e",
  crafting: "#f97316",
  collection: "#06b6d4",
};

function getCatColor(cat: string): string {
  return CAT_COLORS[(cat || "").toLowerCase()] ?? "#a0a0a0";
}

export default function HonorsView({ catalogue, highlightedAchievementId, onHighlightClear }: { catalogue: AchievementDef[]; highlightedAchievementId?: string | null; onHighlightClear?: () => void }) {
  const highlightRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("all");
  const [earnedFilter, setEarnedFilter] = useState<"all" | "earned" | "unearned">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (catalogue.length > 0) setLoading(false);
  }, [catalogue.length]);

  useEffect(() => {
    if (highlightedAchievementId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      // Clear after a delay so user sees the highlight then it fades
      const timer = setTimeout(() => { if (onHighlightClear) onHighlightClear(); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedAchievementId, onHighlightClear]);

  // Debounce search input by 200ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { users, playerName: ctxPlayerName } = useDashboard();
  const playerName = ctxPlayerName || "";
  const allCategories = Array.from(new Set(catalogue.map(a => a.category).filter(Boolean)));
  const loggedInUser = playerName ? users.find(u => (u.id || "").toLowerCase() === playerName.toLowerCase() || (u.name || "").toLowerCase() === playerName.toLowerCase()) : null;
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

  // Filtered catalogue — apply all three filters
  const filteredCatalogue = useMemo(() => {
    let result = catalogue;
    if (activeCat !== "all") result = result.filter(a => a.category === activeCat);
    if (earnedFilter === "earned") result = result.filter(a => playerEarnedIds.has(a.id));
    else if (earnedFilter === "unearned") result = result.filter(a => !playerEarnedIds.has(a.id));
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(a => !a.hidden || playerEarnedIds.has(a.id)
        ? a.name.toLowerCase().includes(q)
        : false);
    }
    return result;
  }, [catalogue, activeCat, earnedFilter, debouncedSearch, playerEarnedIds]);

  // Visible categories after filtering (for rendering groups)
  const categories = activeCat === "all"
    ? allCategories.filter(cat => filteredCatalogue.some(a => a.category === cat))
    : [activeCat];

  // Sort achievements: keep original order
  const sortAchievements = (achs: AchievementDef[]) => achs;

  const getRarityLabel = (count: number) => {
    if (count === 0) return { label: "Unearned", color: "rgba(255,255,255,0.35)" };
    const pct = totalUsers > 0 ? (count / totalUsers) * 100 : 100;
    if (pct <= 10) return { label: "Legendary", color: "#f59e0b" };
    if (pct <= 25) return { label: "Rare", color: "#a78bfa" };
    if (pct <= 50) return { label: "Uncommon", color: "#3b82f6" };
    return { label: "Common", color: "#22c55e" };
  };

  if (loading) {
    return (
      <div className="space-y-3 tab-content-enter">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton-card h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 tab-content-enter">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #110d04 0%, #0f0f0f 100%)", border: "1px solid rgba(245,158,11,0.18)", boxShadow: "0 0 30px rgba(245,158,11,0.04)" }}>
        <div className="flex items-center gap-3 mb-1">
          <span style={{ fontSize: 28 }}>—</span>
          <div>
            <Tip k="achievements" heading><h2 className="text-lg font-bold" style={{ color: "#d4a64a" }}>Hall of Honors</h2></Tip>
            <p className="text-xs" style={{ color: "rgba(212,166,74,0.4)" }}>
              {loggedInUser ? `${loggedInUser.name} — ${playerEarnedIds.size}/${catalogue.length} achievements · ${catalogue.filter(a => playerEarnedIds.has(a.id)).reduce((sum, a) => sum + ((a as unknown as { points?: number }).points || 0), 0)} pts` : "Log in to track your achievements"}
            </p>
            <p className="text-xs italic mt-0.5" style={{ color: "rgba(212,166,74,0.25)" }}>Die Sterne erinnern sich an jeden Helden. Auch an die, die niemand sonst kennt.</p>
          </div>
        </div>
        {/* Progress bar */}
        {loggedInUser && catalogue.length > 0 && (
          <div className="mt-3">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className={`h-full rounded-full transition-all duration-700${playerEarnedIds.size / catalogue.length > 0.8 ? " bar-pulse" : ""}`} style={{ width: `${(playerEarnedIds.size / catalogue.length) * 100}%`, background: "linear-gradient(90deg, #a07020, #c49530)" }} />
            </div>
          </div>
        )}
        {!playerName && (
          <p className="text-xs mt-1.5 px-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            Log in via the header to see your personal achievements highlighted.
          </p>
        )}
      </div>

      {catalogue.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Die Ehrentafel schweigt — der Kurier bringt sie gleich nach.</p>
        </div>
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="space-y-2">
            {/* Category tabs — horizontally scrollable */}
            <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setActiveCat("all")}
                className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0"
                style={{
                  background: activeCat === "all" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.03)",
                  color: activeCat === "all" ? "#f59e0b" : "rgba(255,255,255,0.3)",
                  border: `1px solid ${activeCat === "all" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer",
                }}
              >
                All ({catalogue.length})
              </button>
              {allCategories.map(cat => {
                const color = getCatColor(cat);
                const total = catalogue.filter(a => a.category === cat).length;
                const isActive = activeCat === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCat(cat)}
                    className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0"
                    style={{
                      background: isActive ? `${color}22` : "rgba(255,255,255,0.03)",
                      color: isActive ? color : "rgba(255,255,255,0.3)",
                      border: `1px solid ${isActive ? `${color}40` : "rgba(255,255,255,0.06)"}`,
                      cursor: "pointer",
                    }}
                  >
                    {cat === "hidden" ? "Secret" : cat} ({total})
                  </button>
                );
              })}
            </div>

            {/* Per-category progress bar — only when a specific category is active and player is logged in */}
            {activeCat !== "all" && loggedInUser && (() => {
              const catTotal = catalogue.filter(a => a.category === activeCat).length;
              const catEarned = catalogue.filter(a => a.category === activeCat && playerEarnedIds.has(a.id)).length;
              const color = getCatColor(activeCat);
              return catTotal > 0 ? (
                <div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(catEarned / catTotal) * 100}%`, background: color, opacity: 0.7 }}
                    />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{catEarned}/{catTotal} in this category</p>
                </div>
              ) : null;
            })()}

            {/* Earned / Unearned filter + Search row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1">
                {(["all", "earned", "unearned"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setEarnedFilter(f)}
                    className="text-xs px-2 py-1.5 rounded"
                    style={{
                      background: earnedFilter === f ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                      color: earnedFilter === f ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                      border: `1px solid ${earnedFilter === f ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}`,
                      cursor: "pointer",
                    }}
                  >
                    {f === "all" ? "All" : f === "earned" ? "Earned" : "Unearned"}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search achievements..."
                className="input-dark text-xs flex-1 min-w-[140px] max-w-xs"
                style={{ height: 26, padding: "0 8px" }}
              />
              {(activeCat !== "all" || earnedFilter !== "all" || searchQuery) && (
                <button
                  onClick={() => { setActiveCat("all"); setEarnedFilter("all"); setSearchQuery(""); }}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer" }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {filteredCatalogue.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.04)" }}>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Kein Eintrag passt. Die Filter sind streng, vielleicht zu streng.</p>
            </div>
          )}

          {categories.map(cat => {
          const catAchs = filteredCatalogue.filter(a => a.category === cat);
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
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
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
                        style={{ background: "#111111", border: "2px solid rgba(138,43,226,0.1)", opacity: 0.5, cursor: "not-allowed" }}
                        title="Unlock this hidden achievement to reveal it"
                      >
                        <div className="h-1" style={{ background: "rgba(138,43,226,0.3)" }} />
                        <div className="p-3.5 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(138,43,226,0.08)", border: "1px solid rgba(138,43,226,0.15)" }}>
                            <span className="text-2xl" style={{ filter: "grayscale(1) brightness(0.5)" }}>?</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>??? Hidden Achievement</p>
                            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Unlock to reveal...</p>
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
                      className={`rounded-xl overflow-hidden group${myEarned && (rarity.label === "Legendary" || rarity.label === "Rare") ? " crystal-breathe" : ""}`}
                      style={{
                        background: bgColor,
                        border: `2px solid ${isHighlighted ? "#f59e0b" : frameColor}`,
                        boxShadow: isHighlighted ? "0 0 24px rgba(245,158,11,0.4), 0 0 48px rgba(245,158,11,0.15)" : frameShadow,
                        opacity: highlight || (!playerName && anyEarned) || isHighlighted ? 1 : 0.4,
                        transition: "all 0.3s ease",
                        ...(myEarned && (rarity.label === "Legendary" || rarity.label === "Rare") ? { ["--glow-color" as string]: rarity.label === "Legendary" ? "rgba(245,158,11,0.2)" : "rgba(167,139,250,0.2)" } : {}),
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
                            {ach.icon && ach.icon.startsWith("/") ? <img src={ach.icon} alt="" width={48} height={48} style={{ imageRendering: "auto", filter: highlight || (!playerName && anyEarned) ? "none" : "grayscale(1) brightness(0.5)" }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-2xl" style={{ filter: highlight || (!playerName && anyEarned) ? "none" : "grayscale(1) brightness(0.5)" }}>{ach.icon}</span>}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold truncate" style={{ color: highlight ? "#f0f0f0" : "rgba(255,255,255,0.35)" }}>{ach.name}</p>
                              {(ach as unknown as { points?: number }).points && <span className="text-xs font-mono" style={{ color: "rgba(251,191,36,0.4)" }}>{(ach as unknown as { points: number }).points}pt</span>}
                              {isHidden && myEarned && <span className="text-xs px-1 rounded" style={{ background: "rgba(138,43,226,0.2)", color: "#a855f7" }}>SECRET</span>}
                            </div>
                            {earnerCount > 0 || myEarned
                              ? <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{ach.desc || conditionToText(ach.condition as Record<string, unknown>) || "Achievement unlocked."}</p>
                              : <p className="text-xs mt-0.5 leading-relaxed italic" style={{ color: "rgba(255,255,255,0.4)" }}>Complete conditions to reveal description.</p>
                            }
                          </div>
                        </div>

                        {/* Rarity + earned date + earner count */}
                        <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <div className="flex items-center gap-2">
                            <Tip k="rarity">
                              <span className="text-xs font-semibold" style={{ color: rarity.color, letterSpacing: "0.04em" }}>
                                {rarity.label.toUpperCase()}
                              </span>
                            </Tip>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                              {totalUsers > 0 ? Math.round((earnerCount / totalUsers) * 100) : 0}% aller Spieler
                            </span>
                          </div>
                          {myEarned && myEarnedData?.earnedAt && (
                            <span className="text-xs" style={{ color: "rgba(245,158,11,0.5)" }}>
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
                                  fontSize: 12,
                                  fontWeight: playerName && ((u.id || "").toLowerCase() === playerName.toLowerCase() || (u.name || "").toLowerCase() === playerName.toLowerCase()) ? 700 : 400,
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
        })}
        </>
      )}
    </div>
  );
}
