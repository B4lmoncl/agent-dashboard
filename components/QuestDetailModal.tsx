"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { RARITY_COLORS } from "@/components/QuestBoard";
import { getQuestRarity } from "@/app/utils";
import { typeConfig } from "@/app/config";
import { Tip, TipCustom } from "@/components/GameTooltip";
import type { Quest } from "@/app/types";

interface QuestDetailModalProps {
  quest: Quest;
  onClose: () => void;
  playerName: string;
  playerLevel: number;
  reviewApiKey: string;
  favorites: string[];
  handleClaim: (id: string) => Promise<void>;
  handleUnclaim: (id: string) => Promise<void>;
  handleComplete: (id: string, title: string) => Promise<void>;
  handleCoopClaim: (id: string) => Promise<void>;
  handleCoopComplete: (id: string) => Promise<void>;
  handleToggleFavorite: (id: string) => Promise<void>;
}

export default function QuestDetailModal({
  quest: q,
  onClose,
  playerName,
  playerLevel,
  reviewApiKey,
  favorites,
  handleClaim,
  handleUnclaim,
  handleComplete,
  handleCoopClaim,
  handleCoopComplete,
  handleToggleFavorite,
}: QuestDetailModalProps) {
  // NOTE: useModalBehavior is called in page.tsx (line 248) — do NOT duplicate here
  // or body scroll lock will break on close (double-lock restores "hidden" instead of "")
  const [modalStarAnimating, setModalStarAnimating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const rarity = getQuestRarity(q);
  const rarityColor = RARITY_COLORS[rarity] ?? "#9ca3af";
  const isLegendary = rarity === "legendary";
  const typeCfg = typeConfig[q.type ?? "personal"] ?? typeConfig.personal;
  const isClaimedByMe = playerName && q.claimedBy?.toLowerCase() === playerName.toLowerCase();
  const isCoop = q.type === "relationship-coop";
  const coopPartners = q.coopPartners ?? [];
  const coopClaimed = q.coopClaimed ?? [];
  const coopCompletions = q.coopCompletions ?? [];
  const isCoopPartner = playerName ? coopPartners.includes(playerName.toLowerCase()) : false;
  const hasCoopClaimed = playerName ? coopClaimed.includes(playerName.toLowerCase()) : false;
  const hasCoopCompleted = playerName ? coopCompletions.includes(playerName.toLowerCase()) : false;

  const FLAVOR_BY_TYPE: Record<string, string> = {
    personal:           "Jemand muss es tun. Laut Zettel bist du dieser Jemand. Der Zettel lügt selten.",
    learning:           "Ein Buch. Oder drei. Der Bibliothekar sagt, Wissen sei Macht. Er sagt auch, er brauche einen neuen Stuhl. Beides stimmt vermutlich.",
    fitness:            "Der Körper beschwert sich. Das ist normal. Er beschwert sich auch wenn man nichts tut, also kann man es genauso gut versuchen.",
    social:             "Andere Menschen. Unvorhersehbar, gelegentlich nützlich, manchmal sogar angenehm. Die Gilde empfiehlt Kontakt in moderaten Dosen.",
    "relationship-coop":"Zu zweit ist alles einfacher. Oder doppelt so kompliziert. Die Statistik ist da uneindeutig, aber optimistisch.",
    development:        "Code schreibt sich nicht von allein. Technisch gesehen schon, aber das Ergebnis ist dann meistens beleidigt.",
    boss:               "Das hier wird unangenehm. Nicht unmöglich — unangenehm. Ein feiner Unterschied, den der vorherige Auftragnehmer leider zu spät verstand.",
  };
  const flavorText = q.flavorText || FLAVOR_BY_TYPE[q.type ?? "personal"] || "Eine Herausforderung wartet. Beweise dein Können.";

  const XP_BY_RARITY: Record<string, number> = { common: 10, uncommon: 18, rare: 30, epic: 50, legendary: 80 };
  const GOLD_BY_RARITY: Record<string, [number, number]> = { common: [5, 10], uncommon: [10, 18], rare: [18, 30], epic: [30, 50], legendary: [50, 80] };
  const displayXp = (q.rewards?.xp != null && q.rewards.xp > 0) ? q.rewards.xp : (XP_BY_RARITY[q.rarity || "common"] ?? 10);
  const goldRange = GOLD_BY_RARITY[q.rarity || "common"] || null;
  const displayGold = (q.rewards?.gold != null && q.rewards.gold > 0) ? String(q.rewards.gold) : (goldRange ? `${goldRange[0]}–${goldRange[1]}` : "9");

  return (
    <ModalPortal>
    <div
      data-feedback-id="quest-board.quest-modal"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col bg-surface-alt"
        style={{
          border: `2px solid ${rarityColor}66`,
          boxShadow: isLegendary ? `0 0 40px ${rarityColor}30` : "0 20px 60px rgba(0,0,0,0.6)",
          maxHeight: "80vh",
          overflow: "hidden",
          overscrollBehavior: "contain",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Rarity header bar */}
        <div style={{ height: 6, background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)`, boxShadow: `0 2px 8px ${rarityColor}40` }} />
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3" style={{ borderBottom: `1px solid rgba(255,255,255,0.11)` }}>
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{typeCfg.icon?.startsWith("/") ? <img src={typeCfg.icon} alt="" width={28} height={28} className="img-render-auto" onError={(e) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> : typeCfg.icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold leading-snug text-bright">{q.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <TipCustom title={`${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Quest`} accent={rarityColor} body={<p>Quest rarity determines base XP and Gold rewards. Higher rarity quests also deal more damage to World Bosses.</p>}>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded cursor-help" style={{ color: rarityColor, background: `${rarityColor}18`, border: `1px solid ${rarityColor}40` }}>{rarity}</span>
                </TipCustom>
                {q.difficulty && q.difficulty !== "none" && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded capitalize text-w50" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>{q.difficulty}</span>
                )}
                <span className="text-xs capitalize text-w35">{q.type ?? "personal"}</span>
                {q.minLevel != null && q.minLevel > 0 && (() => {
                  const meets = playerLevel >= q.minLevel;
                  return (
                    <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded" style={{
                      color: meets ? "#22c55e" : "#ef4444",
                      background: meets ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${meets ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                    }}>Level {q.minLevel}</span>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {reviewApiKey && playerName && (
              <button
                onClick={() => { handleToggleFavorite(q.id); setModalStarAnimating(true); setTimeout(() => setModalStarAnimating(false), 350); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, lineHeight: 1, color: favorites.includes(q.id) ? "#fbbf24" : "rgba(255,255,255,0.2)", textShadow: favorites.includes(q.id) ? "0 0 10px rgba(251,191,36,0.7)" : "none", transition: "color 0.2s, text-shadow 0.2s", padding: 0, animation: modalStarAnimating ? "star-bounce 300ms ease-out forwards" : "none" }}
                title={favorites.includes(q.id) ? "Remove from favorites" : "Add to favorites"}
              >
                {favorites.includes(q.id) ? "\u2605" : "\u2606"}
              </button>
            )}
            <button onClick={onClose} className="btn-close" aria-label="Schließen" style={{ fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
        </div>
        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3" style={{ scrollbarWidth: "thin" as const }}>
          {/* Flavor / Lore text */}
          {q.npcGiverId && (
            <p className="text-xs font-semibold mb-1" style={{ color: RARITY_COLORS[q.npcRarity ?? "common"] ?? "#9ca3af" }}>
              {q.npcName}{(q.chainTotal ?? 1) > 1 && (
                <span style={{ fontSize: 12, letterSpacing: "0.15em", marginLeft: 4 }}>
                  {Array.from({ length: q.chainTotal! }, (_, i) => (
                    <span key={i} style={{ color: RARITY_COLORS[q.npcRarity ?? "common"] ?? "#f59e0b", opacity: i < (q.chainIndex ?? 0) ? 0.8 : i === (q.chainIndex ?? 0) ? 1 : 0.3 }}>
                      {i < (q.chainIndex ?? 0) ? "●" : i === (q.chainIndex ?? 0) ? "◐" : "○"}
                    </span>
                  ))}
                </span>
              )}
            </p>
          )}
          <p className="text-sm italic leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
            &ldquo;{flavorText}&rdquo;
          </p>
          {/* Ornamental divider */}
          <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.22)" }}>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)", display: "block" }} />
            <span style={{ fontSize: 12, letterSpacing: 4 }}>◆ ◆ ◆</span>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)", display: "block" }} />
          </div>
          {/* Task */}
          {q.description && (
            <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", borderLeft: `3px solid ${rarityColor}55`, border: `1px solid rgba(255,255,255,0.10)`, borderLeftColor: `${rarityColor}66` }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: `${rarityColor}99` }}>Task</p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{q.description}</p>
            </div>
          )}
          {/* Checklist */}
          {q.checklist && q.checklist.length > 0 && (
            <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Checklist ({q.checklist.filter(c => c.done).length}/{q.checklist.length})</p>
              <div className="space-y-1">
                {q.checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span style={{ color: item.done ? "#22c55e" : "rgba(255,255,255,0.2)", fontSize: 12 }}>{item.done ? "✓" : "○"}</span>
                    <span style={{ color: item.done ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.6)", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Faction rep indicator */}
          {q.type && ["fitness", "learning", "development", "personal", "social"].includes(q.type) && (() => {
            const FACTION_BY_TYPE: Record<string, { name: string; symbol: string; color: string }> = {
              fitness: { name: "Zirkel der Glut", symbol: "🜂", color: "#ef4444" },
              learning: { name: "Zirkel der Tinte", symbol: "🜄", color: "#3b82f6" },
              development: { name: "Zirkel des Amboss", symbol: "🜁", color: "#f59e0b" },
              personal: { name: "Zirkel des Amboss", symbol: "🜁", color: "#f59e0b" },
              social: { name: "Zirkel des Echos", symbol: "🜃", color: "#ec4899" },
            };
            const f = FACTION_BY_TYPE[q.type!];
            if (!f) return null;
            return (
              <div className="flex items-center gap-2 text-xs" style={{ color: f.color }}>
                <span>{f.symbol}</span>
                <span>+Rep {f.name}</span>
              </div>
            );
          })()}
          {/* Requirements */}
          {((q.minLevel != null && q.minLevel > 1) || q.classRequired) && (
            <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Voraussetzungen</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {q.minLevel != null && q.minLevel > 1 && (() => {
                  const meets = playerLevel >= q.minLevel;
                  return (
                    <span className="text-xs font-mono" style={{ color: meets ? "#22c55e" : "#ef4444" }}>
                      Requires: Level {q.minLevel}
                    </span>
                  );
                })()}
                {q.classRequired && (
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Klasse: {q.classRequired}
                  </span>
                )}
              </div>
            </div>
          )}
          {/* Rewards */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-w25">Reward</p>
            <div className="flex items-center gap-3">
              <Tip k="gold">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-help" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <img src="/images/icons/reward-gold.png" alt="" width={16} height={16} className="img-render-auto" style={{ verticalAlign: "middle" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                  <span className="text-sm font-mono font-bold" style={{ color: "#fbbf24" }}>{displayGold} Gold</span>
                </div>
              </Tip>
              <Tip k="xp">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-help" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <img src="/images/icons/reward-xp.png" alt="" width={16} height={16} className="img-render-auto" style={{ verticalAlign: "middle" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                  <span className="text-sm font-mono font-bold" style={{ color: "#a78bfa" }}>{displayXp} XP</span>
                </div>
              </Tip>
            </div>
          </div>
          {q.claimedBy && !isClaimedByMe && (
            <p className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ Claimed by {q.claimedBy}</p>
          )}
        </div>
        {/* Action footer */}
        <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.11)" }}>
          {!isCoop && reviewApiKey && playerName && q.status === "open" && (
            <button
              disabled={actionLoading}
              title={actionLoading ? "Action in progress..." : undefined}
              onClick={async () => { setActionLoading(true); try { await handleClaim(q.id); onClose(); } finally { setActionLoading(false); } }}
              style={{ background: "linear-gradient(180deg, #2a2a2a, #1a1a1a)", border: "2px solid #FFD700", color: "#FFD700", fontSize: 14, fontWeight: 700, padding: "10px 28px", borderRadius: 8, cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1, transition: "background 0.15s, color 0.15s" }}
              onMouseEnter={e => { if (!actionLoading) { (e.currentTarget as HTMLButtonElement).style.background = "#FFD700"; (e.currentTarget as HTMLButtonElement).style.color = "#1a1a1a"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(180deg, #2a2a2a, #1a1a1a)"; (e.currentTarget as HTMLButtonElement).style.color = "#FFD700"; }}
            >{actionLoading ? "Claiming…" : "Claim Quest"}</button>
          )}
          {!isCoop && reviewApiKey && playerName && isClaimedByMe && (
            <>
              <button
                disabled={actionLoading}
                onClick={async () => { setActionLoading(true); try { await handleUnclaim(q.id); onClose(); } finally { setActionLoading(false); } }}
                className="text-xs px-3 py-1.5 rounded font-medium"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1 }}
              >{actionLoading ? "…" : "Unclaim"}</button>
              <button
                disabled={actionLoading}
                onClick={async () => { setActionLoading(true); try { await handleComplete(q.id, q.title); onClose(); } finally { setActionLoading(false); } }}
                className="text-sm px-4 py-1.5 rounded font-semibold"
                style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.35)", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1, transition: "background 0.15s, color 0.15s" }}
                onMouseEnter={e => { if (!actionLoading) { (e.currentTarget as HTMLButtonElement).style.background = "#22c55e"; (e.currentTarget as HTMLButtonElement).style.color = "#1a1a1a"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#22c55e"; }}
              >{actionLoading ? "Completing…" : "Complete"}</button>
            </>
          )}
          {isCoop && isCoopPartner && !hasCoopClaimed && q.status !== "completed" && reviewApiKey && playerName && (
            <button
              disabled={actionLoading}
              onClick={async () => { setActionLoading(true); try { await handleCoopClaim(q.id); onClose(); } finally { setActionLoading(false); } }}
              className="text-sm px-4 py-1.5 rounded font-semibold"
              style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.3)", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1 }}
            >{actionLoading ? "Joining…" : "Join Coop"}</button>
          )}
          {isCoop && isCoopPartner && hasCoopClaimed && !hasCoopCompleted && q.status !== "completed" && reviewApiKey && playerName && (
            <button
              disabled={actionLoading}
              onClick={async () => { setActionLoading(true); try { await handleCoopComplete(q.id); onClose(); } finally { setActionLoading(false); } }}
              className="text-sm px-4 py-1.5 rounded font-semibold"
              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1 }}
            >{actionLoading ? "Completing…" : "My Part Done"}</button>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
