"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Quest, ActiveNpc, QuestsData } from "@/app/types";
import {
  EpicQuestCard, QuestCard, DobbieQuestPanel,
  ClickablePriorityBadge, CategoryBadge, ProductBadge, PriorityBadge,
} from "@/components/QuestBoard";
import { InfoTooltip } from "@/components/InfoTooltip";
interface WandererRestProps {
  npcBoardFilter: string | null;
  setNpcBoardFilter: (v: string | null) => void;
  activeNpcs: ActiveNpc[];
  selectedNpc: ActiveNpc | null;
  setSelectedNpc: (npc: ActiveNpc | null) => void;
  isAdmin: boolean;
  reviewApiKey: string;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  sortMode: "rarity" | "newest";
  setSortMode: (fn: (s: "rarity" | "newest") => "rarity" | "newest") => void;
  searchFilter: string;
  setSearchFilter: (v: string) => void;
  devOpenCollapsed: boolean;
  setDevOpenCollapsed: (fn: (v: boolean) => boolean) => void;
  devInProgressCollapsed: boolean;
  setDevInProgressCollapsed: (fn: (v: boolean) => boolean) => void;
  handleApprove: (id: string, comment?: string) => void;
  handleReject: (id: string, comment?: string) => void;
  handleChangePriority: (id: string, priority: Quest["priority"]) => void;
  reviewComments: Record<string, string>;
  setReviewComments: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  dobbieOpen: boolean;
  setDobbieOpen: (fn: (v: boolean) => boolean) => void;
  loading: boolean;
  quests: QuestsData;
  playerName: string;
  petName?: string;
  refresh: () => void;
  devVisibleOpen: Quest[];
  devVisibleInProgress: Quest[];
  lyraQuestsOpen: Quest[];
  lyraQuestsInProgress: Quest[];
  lyraAllQuests: Quest[];
  // Quest actions
  handleClaim?: (questId: string) => void;
  handleUnclaim?: (questId: string) => void;
  handleComplete?: (questId: string, questTitle: string) => void;
}

const rarityColors: Record<string, string> = { common: "#c4ccd8", uncommon: "#4ade80", rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24" };
const rarityRgb: Record<string, string> = { common: "196,204,216", uncommon: "74,222,128", rare: "96,165,250", epic: "192,132,252", legendary: "251,191,36" };
const rarityStars: Record<string, string> = { common: "★", uncommon: "★★", rare: "★★★", epic: "★★★★", legendary: "★★★★★" };

export function WandererRest({
  npcBoardFilter, setNpcBoardFilter,
  activeNpcs, selectedNpc, setSelectedNpc,
  isAdmin, reviewApiKey,
  selectedIds, toggleSelect,
  sortMode, setSortMode,
  searchFilter, setSearchFilter,
  devOpenCollapsed, setDevOpenCollapsed,
  devInProgressCollapsed, setDevInProgressCollapsed,
  handleApprove, handleReject, handleChangePriority,
  reviewComments, setReviewComments,
  dobbieOpen, setDobbieOpen,
  loading, quests, playerName, petName, refresh,
  devVisibleOpen, devVisibleInProgress,
  lyraQuestsOpen, lyraQuestsInProgress, lyraAllQuests,
  handleClaim, handleUnclaim, handleComplete,
}: WandererRestProps) {
  // Sync selectedNpc with fresh data when activeNpcs updates (e.g. after claim/complete)
  useEffect(() => {
    if (!selectedNpc || selectedNpc.id === "lyra-permanent") return;
    const fresh = activeNpcs.find(n => n.id === selectedNpc.id);
    if (fresh) setSelectedNpc(fresh);
  }, [activeNpcs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC key closes NPC popup
  useEffect(() => {
    if (!selectedNpc) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedNpc(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedNpc, setSelectedNpc]);

  return (
    <div className="space-y-6">
      {/* Dobbie filter banner */}
      {npcBoardFilter === "dobbie" && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,107,157,0.07)", border: "1px solid rgba(255,107,157,0.2)" }}>
          <span className="text-lg">🐱</span>
          <div className="flex-1">
            <p className="text-xs font-semibold" style={{ color: "#ff6b9d" }}>{petName ?? "Companion"}&apos;s Demands</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{petName ?? "Your companion"} sent you here. Check {petName ?? "Companion"}&apos;s Demands below!</p>
          </div>
          <button onClick={() => setNpcBoardFilter(null)} style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* ── SECTION 1: Wandering Visitors (TOP) ── */}
      <section data-feedback-id="wanderers-rest" className="mb-8" style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#f59e0b" }}>🏰 The Wanderer&apos;s Rest</h2>
          <p className="text-xs mt-0.5 italic" style={{ color: "rgba(255,255,255,0.3)" }}>They come. They go. They always return.</p>
        </div>
        {activeNpcs.length === 0 ? (
          <div className="rounded-xl px-4 py-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.25)" }}>The hall is quiet... for now. 🌙</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-6 mb-2">
              {activeNpcs.map(npc => {
                const urgent = npc.hoursLeft <= 24;
                const rc = rarityColors[npc.rarity] ?? "#9ca3af";
                const allDone = npc.questChain.length > 0 && npc.questChain.every(q => q.status === "completed");
                const hasOpenQuests = !allDone && npc.questChain.some(q => q.status === "open");
                return (
                  <button
                    key={npc.id}
                    data-feedback-id={`wanderers-rest.npc.${npc.id}`}
                    onClick={() => setSelectedNpc(npc)}
                    className="flex flex-col items-center gap-2 group"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <div
                      className="relative rounded-lg overflow-hidden flex-shrink-0"
                      style={{
                        width: 148, height: 148,
                        border: `3px solid ${urgent ? "rgba(245,158,11,0.65)" : `${rc}60`}`,
                        boxShadow: urgent ? "0 0 14px 3px rgba(245,158,11,0.22)" : `0 0 0 0 ${rc}`,
                        transition: "box-shadow 0.2s ease",
                        animation: urgent && hasOpenQuests ? "pulse-amber-border 1.8s ease-in-out infinite" : undefined,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 18px 4px ${rc}55`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 0 ${rc}`; }}
                    >
                      {npc.portrait ? (
                        <img
                          src={npc.portrait}
                          alt={npc.name}
                          width={148}
                          height={148}
                          style={{ imageRendering: "pixelated", display: "block", width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", fontSize: 56 }}>
                          {npc.emoji}
                        </div>
                      )}
                      {allDone && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)" }}>
                          <span style={{ fontSize: 36 }}>✓</span>
                        </div>
                      )}
                      {urgent && !allDone && (
                        <div className="absolute bottom-0 left-0 right-0 py-0.5 text-center" style={{ background: "rgba(245,158,11,0.85)", fontSize: 9, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
                          ⏰ {npc.hoursLeft}H LEFT
                        </div>
                      )}
                      {/* Gold pulsing dot for NPCs with unclaimed open quests */}
                      {hasOpenQuests && (
                        <div
                          className="absolute top-1.5 right-1.5 rounded-full"
                          style={{
                            width: 8, height: 8,
                            background: "#f59e0b",
                            animation: "pulse-gold-dot 1.5s ease-in-out infinite",
                            border: "1.5px solid rgba(0,0,0,0.4)",
                          }}
                        />
                      )}
                    </div>
                    <div className="text-center" style={{ maxWidth: 148 }}>
                      <p className="text-xs font-semibold leading-tight" style={{ color: "#e8e8e8" }}>{npc.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: rc, fontSize: 10 }}>{rarityStars[npc.rarity] ?? "★"}</p>
                      {!allDone && (
                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: urgent ? "#f59e0b" : "rgba(255,255,255,0.3)", fontSize: 10 }}>
                          Departs in {urgent ? `${npc.hoursLeft}h` : `${npc.daysLeft}d`}
                          <span
                            onClick={e => { e.stopPropagation(); setSelectedNpc(npc); }}
                            style={{ cursor: "pointer", color: "rgba(255,255,255,0.4)", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)", width: 12, height: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, flexShrink: 0 }}
                          >?</span>
                        </p>
                      )}
                      {allDone && (
                        <p className="text-xs mt-0.5" style={{ color: "#22c55e", fontSize: 10 }}>✓ Completed</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Click a visitor to see their quest...</p>
          </>
        )}
      </section>

      {/* ── Dobbie's Demands ── */}
      {playerName && (
        <div className="rounded-xl overflow-hidden mt-8" style={{ maxWidth: 1000, margin: "32px auto 0", background: "rgba(255,107,157,0.04)", border: "1px solid rgba(255,107,157,0.2)" }}>
          <button
            onClick={() => setDobbieOpen(v => !v)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-left"
          >
            <span className="text-sm">🐱</span>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#ff6b9d" }}>{petName ?? "Companion"}&apos;s Demands</span>
            <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{dobbieOpen ? "▲" : "▼"}</span>
          </button>
          {dobbieOpen && (
            <div style={{ borderTop: "1px solid rgba(255,107,157,0.15)" }}>
              <DobbieQuestPanel reviewApiKey={reviewApiKey} onRefresh={refresh} playerName={playerName} petName={petName} quests={quests} />
            </div>
          )}
        </div>
      )}

      {/* ── Divider: Dobbie's Demands ↔ Starweaver ── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", marginTop: 48, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.25), transparent)" }} />
        <span style={{ fontSize: "0.85rem", color: "rgba(255,215,0,0.6)", letterSpacing: "0.15em", textTransform: "uppercase" }}>✦ Chamber ✦</span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.25), transparent)" }} />
      </div>

      {/* ── SECTION 3: The Starweaver's Chamber Portal (BOTTOM) ── */}
      <section data-feedback-id="starweaver-portal" style={{ maxWidth: 1000, margin: "0 auto", marginTop: 24 }}>
        <button
          onClick={() => setSelectedNpc({ id: "lyra-permanent", name: "The Starweaver", title: "Guardian of Quests", rarity: "legendary", emoji: "✨", greeting: "Guardian of Quests. Forged in starlight.", questChain: lyraAllQuests.map(q => ({ ...q, status: q.status as "open" | "in_progress" | "completed" | "claimed" })), hoursLeft: 9999, daysLeft: 999, portrait: "/images/npcs/starweaver-final.png", finalReward: undefined } as unknown as ActiveNpc)}
          className="w-full relative overflow-hidden rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #0a0a1e 0%, #1a0a3e 50%, #0d1a3a 100%)",
            border: "2px solid rgba(255,215,0,0.35)",
            boxShadow: "0 0 40px rgba(100,60,200,0.2), 0 0 80px rgba(255,215,0,0.06), inset 0 0 60px rgba(0,0,20,0.5)",
            cursor: "pointer",
            padding: 0,
            transition: "box-shadow 0.3s ease, border-color 0.3s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 60px rgba(100,60,200,0.35), 0 0 120px rgba(255,215,0,0.12), inset 0 0 60px rgba(0,0,20,0.5)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,215,0,0.6)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(100,60,200,0.2), 0 0 80px rgba(255,215,0,0.06), inset 0 0 60px rgba(0,0,20,0.5)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,215,0,0.35)"; }}
        >
          {/* Star field */}
          {["8%,15%","15%,70%","25%,30%","35%,80%","45%,20%","55%,65%","65%,35%","75%,75%","85%,25%","92%,55%","50%,90%","30%,10%","60%,50%","10%,45%","90%,30%"].map((pos, i) => (
            <span key={i} style={{ position: "absolute", left: pos.split(",")[0], top: pos.split(",")[1], fontSize: i % 3 === 0 ? 10 : 8, opacity: 0.2 + (i % 4) * 0.1, animation: `star-float-${i % 3} ${2 + i * 0.3}s ease-in-out infinite`, pointerEvents: "none", color: "#c4b5fd", zIndex: 0 }}>✦</span>
          ))}
          <div className="relative flex items-center gap-6 px-8 py-5" style={{ zIndex: 1 }}>
            {/* Portal arch / gate icon */}
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 160, height: 160 }}>
              <div style={{
                width: 144, height: 144,
                borderRadius: "50% 50% 0 0",
                border: "3px solid #FFD700",
                boxShadow: "0 0 20px rgba(255,215,0,0.6), inset 0 0 20px rgba(100,60,200,0.3)",
                background: "radial-gradient(ellipse at 50% 70%, rgba(100,60,200,0.4) 0%, rgba(0,0,30,0.9) 70%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}>
                <img
                  src="/images/npcs/starweaver-final.png"
                  alt="The Starweaver"
                  width={144}
                  height={144}
                  style={{ imageRendering: "pixelated", display: "block", width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; const fb = (e.target as HTMLImageElement).nextElementSibling as HTMLElement; if (fb) fb.style.display = "flex"; }}
                />
                <div style={{ display: "none", position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", fontSize: 32 }}>✨</div>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,215,0,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />
              </div>
            </div>
            {/* Text */}
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,215,0,0.5)", letterSpacing: "0.15em" }}>✦ Enter the Chamber</p>
              <p className="text-2xl font-bold" style={{ color: "#FFD700", textShadow: "0 0 20px rgba(255,215,0,0.45)" }}>The Starweaver&apos;s Chamber</p>
              <p className="text-sm mt-1 italic" style={{ color: "rgba(192,169,255,0.6)" }}>Step through — if she deems you worthy</p>
              {lyraAllQuests.length > 0 && (
                <p className="text-xs mt-2" style={{ color: "rgba(255,215,0,0.4)" }}>✦ {lyraAllQuests.length} active quest{lyraAllQuests.length !== 1 ? "s" : ""} await</p>
              )}
            </div>
            {/* Arrow */}
            <div className="flex-shrink-0 text-2xl" style={{ color: "rgba(255,215,0,0.35)" }}>›</div>
          </div>
        </button>
      </section>

      {/* ── NPC Speech Bubble Modal ── */}
      {selectedNpc && (() => {
        const npc = selectedNpc;
        const rarityColorsModal: Record<string, string> = { common: "#c4ccd8", uncommon: "#4ade80", rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24" };
        const rarityStarsModal: Record<string, string> = { common: "★ Common", uncommon: "★★ Uncommon", rare: "★★★ Rare", epic: "★★★★ Epic", legendary: "★★★★★ Legendary" };
        const rc = rarityColorsModal[npc.rarity] ?? "#9ca3af";
        const allDone = npc.questChain.length > 0 && npc.questChain.every(q => q.status === "completed");
        const currentQuest = npc.questChain.find(q => q.status === "open" || q.status === "in_progress" || q.status === "claimed") ?? null;
        const completedCount = npc.questChain.filter(q => q.status === "completed").length;
        const totalCount = npc.questChain.length;
        const isStarweaver = npc.id === "lyra-permanent";
        return createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.82)" }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedNpc(null); }}
          >
            <div className="relative w-full rounded-xl overflow-hidden" style={{ background: isStarweaver ? "linear-gradient(135deg, #0a0a1e 0%, #120830 100%)" : `linear-gradient(135deg, rgba(${rarityRgb[npc.rarity] ?? "196,204,216"},0.03), rgba(${rarityRgb[npc.rarity] ?? "196,204,216"},0.01))`, border: `2px solid ${isStarweaver ? "rgba(255,215,0,0.3)" : `rgba(${rarityRgb[npc.rarity] ?? "196,204,216"},0.5)`}`, boxShadow: isStarweaver ? undefined : `0 0 20px rgba(${rarityRgb[npc.rarity] ?? "196,204,216"},0.1)`, maxHeight: "90vh", overflowY: "auto", maxWidth: isStarweaver ? 680 : 520 }}>
              {/* Close */}
              <button
                onClick={() => setSelectedNpc(null)}
                className="absolute top-3 right-3 z-10 flex items-center justify-center rounded-full"
                style={{ width: 28, height: 28, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14 }}
              >✕</button>

              {isStarweaver && (
                <>
                  {["8%,15%","15%,70%","25%,30%","35%,80%","45%,20%","55%,65%","65%,35%","75%,75%","85%,25%","92%,55%"].map((pos, i) => (
                    <span key={i} style={{ position: "absolute", left: pos.split(",")[0], top: pos.split(",")[1], fontSize: i % 3 === 0 ? 10 : 8, opacity: 0.15 + (i % 3) * 0.08, animation: `star-float-${i % 3} ${2 + i * 0.3}s ease-in-out infinite`, pointerEvents: "none", color: "#c4b5fd", zIndex: 0 }}>✦</span>
                  ))}
                </>
              )}

              {/* NPC Header */}
              <div className="relative px-5 pt-5 pb-4 flex items-start gap-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", zIndex: 1 }}>
                <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: isStarweaver ? 128 : 96, height: isStarweaver ? 128 : 96, border: `3px solid ${isStarweaver ? "rgba(255,215,0,0.5)" : `rgba(${rarityRgb[npc.rarity] ?? "196,204,216"},0.6)`}`, boxShadow: isStarweaver ? "0 0 24px rgba(255,215,0,0.35), 0 0 8px rgba(100,60,200,0.3)" : `0 0 12px rgba(${rarityRgb[npc.rarity] ?? "196,204,216"},0.25)` }}>
                  {npc.portrait ? (
                    <img src={npc.portrait} alt={npc.name} width={isStarweaver ? 128 : 96} height={isStarweaver ? 128 : 96} style={{ imageRendering: "pixelated", display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", fontSize: 40 }}>{npc.emoji}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-sm font-bold leading-tight" style={{ color: isStarweaver ? "#FFD700" : "#f0f0f0", textShadow: isStarweaver ? "0 0 12px rgba(255,215,0,0.4)" : `0 0 10px rgba(${rarityRgb[npc.rarity] ?? "196,204,216"},0.4)` }}>{npc.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: isStarweaver ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.35)" }}>{npc.title}</p>
                  <p className="text-xs mt-1 font-semibold" style={{ color: rc }}>{rarityStarsModal[npc.rarity] ?? npc.rarity}</p>
                  {!isStarweaver && !(npc as ActiveNpc & { permanent?: boolean }).permanent && (
                    <p className="text-xs mt-1" style={{ color: npc.hoursLeft <= 24 ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>
                      {npc.hoursLeft <= 24 ? `⏰ Departs in ${npc.hoursLeft}h!` : `Departs in ${npc.daysLeft} day${npc.daysLeft !== 1 ? "s" : ""}`}
                    </p>
                  )}
                  {isStarweaver && (
                    <span className="text-xs mt-2 inline-block px-2 py-0.5 rounded" style={{ background: "rgba(255,215,0,0.07)", color: "rgba(255,215,0,0.45)", border: "1px solid rgba(255,215,0,0.15)", fontSize: 10 }}>✦ Permanent · Always here</span>
                  )}
                </div>
              </div>

              {/* Greeting / Speech bubble */}
              {npc.greeting && (
                <div className="relative mx-5 mt-4 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", zIndex: 1 }}>
                  <p className="text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>💬 &ldquo;{npc.greeting}&rdquo;</p>
                </div>
              )}

              {/* Starweaver's Quests heading */}
              {isStarweaver && (lyraQuestsOpen.length > 0 || lyraQuestsInProgress.length > 0) && (
                <div className="relative px-5 pt-4 pb-0" style={{ zIndex: 1 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#c084fc" }}>✦ Starweaver&apos;s Quests</h3>
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(192,132,252,0.1)", color: "#c084fc", border: "1px solid rgba(192,132,252,0.2)" }}>{lyraQuestsOpen.length + lyraQuestsInProgress.length}</span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {lyraQuestsOpen.map(q =>
                      q.children && q.children.length > 0
                        ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                        : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} playerName={playerName} />
                    )}
                    {lyraQuestsInProgress.map(q =>
                      q.children && q.children.length > 0
                        ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                        : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} playerName={playerName} />
                    )}
                  </div>
                </div>
              )}

              {/* Quest content (for wandering NPCs) */}
              {!isStarweaver && (
                <div className="px-5 pt-4 pb-5">
                  {allDone ? (
                    <div className="text-center py-4">
                      <p className="text-2xl mb-2">🎉</p>
                      <p className="text-sm font-bold" style={{ color: "#22c55e" }}>All quests completed!</p>
                      <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Well done, brave adventurer.</p>
                    </div>
                  ) : currentQuest ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>
                          📜 Quest {currentQuest.position}/{totalCount}
                        </p>
                        {completedCount > 0 && (
                          <p className="text-xs" style={{ color: "#22c55e" }}>{completedCount} completed ✓</p>
                        )}
                      </div>
                      <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <p className="text-sm font-bold leading-snug" style={{ color: "#f0f0f0" }}>{currentQuest.title}</p>
                        {currentQuest.flavorText && (
                          <p className="mt-1 truncate" style={{ fontSize: "0.65rem", fontStyle: "italic", color: "rgba(255,255,255,0.35)" }}>{currentQuest.flavorText}</p>
                        )}
                        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{currentQuest.description}</p>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-xs font-semibold" style={{ color: "#f59e0b" }}>🎁 +{currentQuest.rewards?.xp ?? 0} XP</span>
                          <span className="text-xs" style={{ color: "rgba(255,193,7,0.6)" }}>+{currentQuest.rewards?.gold ?? 0} 🪙</span>
                          {(currentQuest.status === "claimed" || currentQuest.status === "in_progress") && (
                            <div className="flex items-center gap-2 ml-auto">
                              <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}>⚔ Active</span>
                              {handleUnclaim && playerName && currentQuest.claimedBy?.toLowerCase() === playerName.toLowerCase() && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUnclaim(currentQuest.questId); }}
                                  className="text-xs px-2 py-0.5 rounded font-semibold"
                                  style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
                                  onMouseEnter={e => { (e.currentTarget).style.background = "rgba(239,68,68,0.25)"; }}
                                  onMouseLeave={e => { (e.currentTarget).style.background = "rgba(239,68,68,0.12)"; }}
                                >✕ Unclaim</button>
                              )}
                            </div>
                          )}
                          {currentQuest.status === "open" && handleClaim && playerName && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClaim(currentQuest.questId);
                              }}
                              className="text-xs px-3 py-1 rounded-lg font-semibold ml-auto"
                              style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)", cursor: "pointer", transition: "all 0.2s" }}
                              onMouseEnter={e => { (e.currentTarget).style.background = "rgba(245,158,11,0.35)"; }}
                              onMouseLeave={e => { (e.currentTarget).style.background = "rgba(245,158,11,0.2)"; }}
                            >⚔ Accept Quest</button>
                          )}
                          {(currentQuest.status === "claimed" || currentQuest.status === "in_progress") && currentQuest.claimedBy?.toLowerCase() === playerName?.toLowerCase() && handleComplete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleComplete(currentQuest.questId, currentQuest.title); }}
                              className="text-xs px-3 py-1 rounded-lg font-semibold ml-auto"
                              style={{ background: "rgba(34,197,94,0.2)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.4)", cursor: "pointer", transition: "all 0.2s" }}
                              onMouseEnter={e => { (e.currentTarget).style.background = "rgba(34,197,94,0.35)"; }}
                              onMouseLeave={e => { (e.currentTarget).style.background = "rgba(34,197,94,0.2)"; }}
                            >✓ Complete</button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-center py-3" style={{ color: "rgba(255,255,255,0.3)" }}>No active quests.</p>
                  )}

                  {/* Chain progress dots */}
                  {totalCount > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      {npc.questChain.map(q => (
                        q.status === "locked" ? (
                          <span
                            key={q.questId}
                            style={{ fontSize: 9, opacity: 0.3, lineHeight: 1, display: "inline-block" }}
                            title={`Quest ${q.position}: ${q.title} (locked)`}
                          >🔒</span>
                        ) : (
                          <div
                            key={q.questId}
                            className="rounded-full"
                            style={{
                              width: 8, height: 8,
                              background: q.status === "completed" ? "#22c55e" : (q === currentQuest ? "#f59e0b" : "rgba(255,255,255,0.12)"),
                              border: q === currentQuest ? "2px solid #f59e0b" : "none",
                            }}
                            title={`Quest ${q.position}: ${q.title}`}
                          />
                        )
                      ))}
                    </div>
                  )}

                  {/* Final reward */}
                  {npc.finalReward?.item && (
                    <div className="mt-4 px-4 py-3 rounded-xl flex items-start gap-3" style={{ background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.12)" }}>
                      <span className="text-lg flex-shrink-0 mt-0.5">{npc.finalReward.item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: "rgba(255,215,0,0.7)" }}>💎 Chain Reward</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{npc.finalReward.item.name}</p>
                        <p className="text-xs mt-0.5 italic" style={{ color: "rgba(255,255,255,0.25)" }}>{npc.finalReward.item.desc}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isStarweaver && (
                <div className="relative px-5 pt-3 pb-5" style={{ zIndex: 1 }}>
                  {/* Future feature placeholders — coming soon */}
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,215,0,0.25)", letterSpacing: "0.12em" }}>✦ Coming Soon</p>
                  <div className="space-y-2">
                    {[
                      { icon: "📜", label: "Special Requests", sub: "Coming soon" },
                      { icon: "🔮", label: "Prophecies",        sub: "Coming soon" },
                      { icon: "⚔", label: "Legendary Quests",  sub: "Coming soon" },
                    ].map(({ icon, label, sub }) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", opacity: 0.45, cursor: "not-allowed" }}
                      >
                        <span style={{ fontSize: 16, filter: "grayscale(0.7)" }}>{icon}</span>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{sub}</p>
                        </div>
                        <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.07)" }}>Soon</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        , document.body);
      })()}

      {/* Admin-only: NPC Quest Board (dev type) + Review Board */}
      {isAdmin && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <aside className="w-full lg:w-80 flex-shrink-0">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b5cf6" }}>⚙ NPC Quest Board</h2>
                    <InfoTooltip text="Agent development quests. The AI NPCs (Nova, Hex, Echo, Pixel, Atlas, Lyra) work on these. Admin can review and approve suggested quests." />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{devVisibleOpen.length} open · {devVisibleInProgress.length} in progress</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSortMode(s => s === "rarity" ? "newest" : "rarity")} className="text-xs px-2 py-1 rounded" style={{ background: sortMode === "rarity" ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.05)", color: sortMode === "rarity" ? "#a78bfa" : "rgba(255,255,255,0.3)", border: `1px solid ${sortMode === "rarity" ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                    {sortMode === "rarity" ? "⇅ Rarity" : "⇅ Newest"}
                  </button>
                </div>
              </div>
              <input type="text" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Search agent quests…" className="w-full text-xs px-2 py-1.5 rounded" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", outline: "none" }} />
            </div>
            <div className="space-y-2">
              {loading ? [1,2,3].map(i => <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.05)" }} />) :
              devVisibleOpen.length === 0 && devVisibleInProgress.length === 0 ? (
                <div className="rounded-xl p-5 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{searchFilter ? "No quests match" : "No development quests"}</p>
                </div>
              ) : (
                <>
                  {devVisibleOpen.length > 0 && (
                    <>
                      <button onClick={() => setDevOpenCollapsed(v => !v)} className="flex items-center gap-2 w-full text-left pt-1 pb-0.5">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Open</span>
                        <span className="text-xs px-1 rounded font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)" }}>{devVisibleOpen.length}</span>
                        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>{devOpenCollapsed ? "►" : "▼"}</span>
                      </button>
                      {!devOpenCollapsed && devVisibleOpen.map(q =>
                        q.children && q.children.length > 0
                          ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                          : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} playerName={playerName} />
                      )}
                    </>
                  )}
                  {devVisibleInProgress.length > 0 && (
                    <>
                      <button onClick={() => setDevInProgressCollapsed(v => !v)} className="flex items-center gap-2 w-full text-left pt-2 pb-0.5">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>In Progress</span>
                        <span className="text-xs px-1 rounded font-mono" style={{ background: "rgba(139,92,246,0.08)", color: "rgba(139,92,246,0.5)" }}>{devVisibleInProgress.length}</span>
                        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>{devInProgressCollapsed ? "►" : "▼"}</span>
                      </button>
                      {!devInProgressCollapsed && devVisibleInProgress.map(q =>
                        q.children && q.children.length > 0
                          ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                          : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} playerName={playerName} />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* Review Board — admin-gated */}
          <div className="flex-1 min-w-0">
            {quests.suggested.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#f59e0b" }}>✦ Review Board</h2>
                  <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>{quests.suggested.length}</span>
                </div>
                {!reviewApiKey ? (
                  <div className="rounded-xl p-3" style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>🔑 Log in to review and approve quests.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quests.suggested.map(q => (
                      <div key={q.id} className="rounded-xl p-4" style={{ background: "#252525", border: "1px solid rgba(245,158,11,0.25)", boxShadow: "0 0 12px rgba(245,158,11,0.06)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <ClickablePriorityBadge priority={q.priority} onClick={() => { const cycle: Quest["priority"][] = ["low","medium","high"]; const next = cycle[(cycle.indexOf(q.priority)+1)%3]; handleChangePriority(q.id, next); }} />
                              <h3 className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{q.title}</h3>
                            </div>
                            {q.description && <p className="text-xs leading-relaxed mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>{q.description}</p>}
                            <div className="flex items-center gap-2 flex-wrap">
                              {(q.categories?.length ? q.categories : (q.category ? [q.category] : [])).map(c => <CategoryBadge key={c} category={c} />)}
                              {q.product && <ProductBadge product={q.product} />}
                              {q.createdBy && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "rgba(245,158,11,0.7)", border: "1px solid rgba(245,158,11,0.2)" }}>by {q.createdBy}</span>}
                            </div>
                            <input type="text" value={reviewComments[q.id] ?? ""} onChange={e => setReviewComments(prev => ({ ...prev, [q.id]: e.target.value }))} placeholder="Add a comment (optional)…" className="mt-2 w-full text-xs px-2 py-1.5 rounded" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", outline: "none" }} />
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <button onClick={() => handleApprove(q.id, reviewComments[q.id])} className="action-btn btn-approve px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>✓ Approve</button>
                            <button onClick={() => handleReject(q.id, reviewComments[q.id])} className="action-btn btn-danger px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.7)", border: "1px solid rgba(239,68,68,0.2)" }}>✕ Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
            {reviewApiKey && (
              <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,107,157,0.04)", border: "1px solid rgba(255,107,157,0.2)" }}>
                <button
                  onClick={() => setDobbieOpen(v => !v)}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-left"
                >
                  <span className="text-sm">🐱</span>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#ff6b9d" }}>{petName ?? "Companion"}&apos;s Demands</span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-mono ml-1" style={{ background: "rgba(255,107,157,0.12)", color: "#ff6b9d", border: "1px solid rgba(255,107,157,0.25)" }}>NPC</span>
                  <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{dobbieOpen ? "▲" : "▼"}</span>
                </button>
                {dobbieOpen && (
                  <div style={{ borderTop: "1px solid rgba(255,107,157,0.15)" }}>
                    <DobbieQuestPanel reviewApiKey={reviewApiKey} onRefresh={refresh} playerName={playerName} petName={petName} quests={quests} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
