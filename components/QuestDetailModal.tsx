"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { RARITY_COLORS } from "@/components/QuestBoard";
import { getQuestRarity } from "@/app/utils";
import { typeConfig } from "@/app/config";
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
  const [modalStarAnimating, setModalStarAnimating] = useState(false);

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
    personal:           "Eine persönliche Herausforderung, die dein Wesen stärkt und deinen Charakter formt.",
    learning:           "Das Wissen der Alten wartet darauf, entdeckt zu werden. Nur wer sucht, wird finden.",
    fitness:            "Nur durch körperliche Ertüchtigung wird der Geist wahrhaft frei. Stähle deinen Körper.",
    social:             "Verbindungen sind die stärkste Magie in dieser Welt. Knüpfe Bande, die den Sturm überdauern.",
    "relationship-coop":"Gemeinsam seid ihr stärker als ihr es alleine je sein könntet. Schulter an Schulter.",
    development:        "Der Code ist die neue Magie — und du bist der Zauberer. Erschaffe etwas Bleibendes.",
    boss:               "Eine dunkle Macht erhebt sich. Nur die Mutigsten können bestehen. Rüste dich gut.",
  };
  const flavorText = q.flavorText || FLAVOR_BY_TYPE[q.type ?? "personal"] || "Eine Herausforderung wartet. Beweise dein Können.";

  const XP_BY_RARITY: Record<string, number> = { common: 10, uncommon: 18, rare: 30, epic: 50, legendary: 80 };
  const GOLD_BY_RARITY: Record<string, [number, number]> = { common: [5, 10], uncommon: [10, 18], rare: [18, 30], epic: [30, 50], legendary: [50, 80] };
  const XP_FALLBACK: Record<string, number> = { high: 30, medium: 20, low: 10 };
  const GOLD_FALLBACK: Record<string, number> = { high: 25, medium: 15, low: 9 };
  const displayXp = (q.rewards?.xp != null && q.rewards.xp > 0) ? q.rewards.xp : (q.rarity ? (XP_BY_RARITY[q.rarity] ?? XP_FALLBACK[q.priority] ?? 10) : (XP_FALLBACK[q.priority] ?? 10));
  const goldRange = q.rarity ? GOLD_BY_RARITY[q.rarity] : null;
  const displayGold = (q.rewards?.gold != null && q.rewards.gold > 0) ? String(q.rewards.gold) : (goldRange ? `${goldRange[0]}–${goldRange[1]}` : String(GOLD_FALLBACK[q.priority] ?? 9));

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
        <div style={{ height: 4, background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)` }} />
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3" style={{ borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{typeCfg.icon?.startsWith("/") ? <img src={typeCfg.icon} alt="" width={28} height={28} className="img-render-auto" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : typeCfg.icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold leading-snug text-bright">{q.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: rarityColor, background: `${rarityColor}18`, border: `1px solid ${rarityColor}40` }}>{rarity}</span>
                {q.difficulty && q.difficulty !== "none" && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded capitalize text-w50" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>{q.difficulty}</span>
                )}
                <span className="text-xs capitalize text-w35">{q.type ?? "personal"}</span>
                {/* priority hidden from modal header */}
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
            <button onClick={onClose} className="btn-close" style={{ fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
        </div>
        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          {/* Flavor / Lore text */}
          {q.npcGiverId && (
            <p className="text-xs font-semibold mb-1" style={{ color: RARITY_COLORS[q.npcRarity ?? "common"] ?? "#9ca3af" }}>
              {q.npcName}{(q.chainTotal ?? 1) > 1 && (
                <span style={{ fontSize: 8, letterSpacing: "0.15em", marginLeft: 4 }}>
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
          <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.12)" }}>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)", display: "block" }} />
            <span style={{ fontSize: 11, letterSpacing: 4 }}>◆ ◆ ◆</span>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)", display: "block" }} />
          </div>
          {/* Task */}
          {q.description && (
            <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${rarityColor}55`, border: `1px solid rgba(255,255,255,0.06)`, borderLeftColor: `${rarityColor}66` }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: `${rarityColor}99` }}>Task</p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{q.description}</p>
            </div>
          )}
          {/* Rewards */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-w25">Reward</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <img src="/images/icons/reward-gold.png" width={16} height={16} className="img-render-auto" style={{ verticalAlign: "middle" }} />
                <span className="text-sm font-mono font-bold" style={{ color: "#fbbf24" }}>{displayGold} Gold</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <img src="/images/icons/reward-xp.png" width={16} height={16} className="img-render-auto" style={{ verticalAlign: "middle" }} />
                <span className="text-sm font-mono font-bold" style={{ color: "#a78bfa" }}>{displayXp} XP</span>
              </div>
            </div>
          </div>
          {q.claimedBy && !isClaimedByMe && (
            <p className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ Claimed by {q.claimedBy}</p>
          )}
        </div>
        {/* Action footer */}
        <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {!isCoop && reviewApiKey && playerName && q.status === "open" && (
            <button
              onClick={() => { handleClaim(q.id); onClose(); }}
              style={{ background: "linear-gradient(180deg, #2a2a2a, #1a1a1a)", border: "2px solid #FFD700", color: "#FFD700", fontSize: 14, fontWeight: 700, padding: "10px 28px", borderRadius: 8, cursor: "pointer", transition: "background 0.15s, color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#FFD700"; (e.currentTarget as HTMLButtonElement).style.color = "#1a1a1a"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(180deg, #2a2a2a, #1a1a1a)"; (e.currentTarget as HTMLButtonElement).style.color = "#FFD700"; }}
            >Claim Quest</button>
          )}
          {!isCoop && reviewApiKey && playerName && isClaimedByMe && (
            <>
              <button onClick={() => { handleUnclaim(q.id); onClose(); }} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer" }}>Unclaim</button>
              <button
                onClick={() => { handleComplete(q.id, q.title); onClose(); }}
                className="text-sm px-4 py-1.5 rounded font-semibold"
                style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.35)", cursor: "pointer", transition: "background 0.15s, color 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#22c55e"; (e.currentTarget as HTMLButtonElement).style.color = "#1a1a1a"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#22c55e"; }}
              >Abgeschlossen</button>
            </>
          )}
          {isCoop && isCoopPartner && !hasCoopClaimed && q.status !== "completed" && reviewApiKey && playerName && (
            <button onClick={() => { handleCoopClaim(q.id); onClose(); }} className="text-sm px-4 py-1.5 rounded font-semibold" style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.3)", cursor: "pointer" }}>Join Coop</button>
          )}
          {isCoop && isCoopPartner && hasCoopClaimed && !hasCoopCompleted && q.status !== "completed" && reviewApiKey && playerName && (
            <button onClick={() => { handleCoopComplete(q.id); onClose(); }} className="text-sm px-4 py-1.5 rounded font-semibold" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", cursor: "pointer" }}>My Part Done</button>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
