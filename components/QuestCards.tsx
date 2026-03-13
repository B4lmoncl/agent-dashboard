"use client";

import { useState } from "react";
import type { Quest } from "@/app/types";
import { timeAgo, getQuestRarity } from "@/app/utils";
import { typeConfig } from "@/app/config";
import {
  CategoryBadge, ProductBadge, HumanInputBadge, TypeBadge,
  AgentBadge, RecurringBadge, PriorityBadge,
} from "./QuestBadges";

const QUEST_BOARD_FLAVORS = [
  "Gefunden am schwarzen Brett",
  "Ein Flüstern im Wind",
  "Die Gilde bittet um Hilfe",
  "Eine alte Schriftrolle",
  "Ein dringender Auftrag",
  "Vom Schicksal bestimmt",
];

export const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#FFD700",
  companion: "#ff6b9d",
};

function ChainDots({ chainIndex, chainTotal, color }: { chainIndex: number; chainTotal: number; color: string }) {
  if (chainTotal <= 1) return null;
  return (
    <span style={{ fontSize: 8, letterSpacing: "0.15em", marginLeft: 4 }}>
      {Array.from({ length: chainTotal }, (_, i) => (
        <span key={i} style={{ color, opacity: i < chainIndex ? 0.8 : i === chainIndex ? 1 : 0.3 }}>
          {i < chainIndex ? "●" : i === chainIndex ? "◐" : "○"}
        </span>
      ))}
    </span>
  );
}

export function CompletedQuestRow({ quest, isLast }: { quest: Quest; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);
  return (
    <div
      style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)" }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xs font-mono flex-shrink-0" style={{ color: "rgba(34,197,94,0.6)" }}>x</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{quest.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              by <span style={{ color: "rgba(255,255,255,0.35)" }}>{quest.completedBy}</span>
            </span>
            {quest.humanInputRequired && (
              <span className="text-xs" style={{ color: "rgba(245,158,11,0.6)" }}>x</span>
            )}
          </div>
        </div>
        <PriorityBadge priority={quest.priority} />
        <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
          {quest.completedAt ? timeAgo(quest.completedAt) : "—"}
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
          {quest.description && (
            <p className="text-xs leading-relaxed pt-2" style={{ color: "rgba(255,255,255,0.4)" }}>{quest.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {cats.map(c => <CategoryBadge key={c} category={c} />)}
            {quest.product && <ProductBadge product={quest.product} />}
          </div>
          {quest.proof && (
            <div className="mt-2 p-2 rounded" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "rgba(59,130,246,0.7)" }}>x Learning Proof</p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.4)" }}>
                {quest.proof.length > 300 ? quest.proof.slice(0, 297) + "…" : quest.proof}
              </p>
            </div>
          )}
          {quest.lore && (
            <p className="text-xs italic" style={{ color: "rgba(167,139,250,0.5)", borderLeft: "2px solid rgba(139,92,246,0.2)", paddingLeft: "8px" }}>
              x {quest.lore}
            </p>
          )}
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Completed {quest.completedAt ? timeAgo(quest.completedAt) : "—"} · by {quest.completedBy}
          </p>
        </div>
      )}
    </div>
  );
}

export function QuestCard({ quest, selected, onToggle, onClaim, onUnclaim, onComplete, onCoopClaim, onCoopComplete, playerName, playerLevel, gridMode, onDetails }: {
  quest: Quest;
  selected?: boolean;
  onToggle?: (id: string) => void;
  onClaim?: (id: string) => void;
  onUnclaim?: (id: string) => void;
  onComplete?: (id: string, title: string) => void;
  onCoopClaim?: (id: string) => void;
  onCoopComplete?: (id: string) => void;
  playerName?: string;
  playerLevel?: number;
  gridMode?: boolean;
  onDetails?: (quest: Quest) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = quest.status === "in_progress";
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);
  const isClaimedByMe = playerName && quest.claimedBy?.toLowerCase() === playerName.toLowerCase();
  const isCoop = quest.type === "relationship-coop";
  const flavorText = quest.npcGiverId
    ? (quest.flavorText || `Quest von ${quest.npcName || "NPC"}`)
    : QUEST_BOARD_FLAVORS[
        Math.abs((quest.id.charCodeAt(0) ?? 0) + (quest.id.charCodeAt(quest.id.length - 1) ?? 0)) % QUEST_BOARD_FLAVORS.length
      ];
  const coopPartners = quest.coopPartners ?? [];
  const coopClaimed = quest.coopClaimed ?? [];
  const coopCompletions = quest.coopCompletions ?? [];
  const isCoopPartner = playerName ? coopPartners.includes(playerName.toLowerCase()) : false;
  const hasCoopClaimed = playerName ? coopClaimed.includes(playerName.toLowerCase()) : false;
  const hasCoopCompleted = playerName ? coopCompletions.includes(playerName.toLowerCase()) : false;
  const rarity = getQuestRarity(quest);
  const rarityColor = RARITY_COLORS[rarity] ?? "#9ca3af";
  const isLegendary = rarity === "legendary";
  const hasMinLevel = quest.minLevel != null && quest.minLevel > 0;
  const meetsLevel = !hasMinLevel || (playerLevel != null && playerLevel >= quest.minLevel!);

  if (gridMode) {
    const typeCfg = typeConfig[quest.type ?? "personal"] ?? typeConfig.personal;
    return (
      <div
        data-feedback-id={`quest-board.quest-card.${quest.id}`}
        className="rounded-xl flex flex-col cursor-pointer relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #2c2318 0%, #1e1912 55%, #241e16 100%)",
          border: `2px solid ${rarityColor}88`,
          boxShadow: `0 0 ${isLegendary ? 16 : 6}px ${rarityColor}${isLegendary ? "44" : "1a"}`,
          transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
          transform: "translateY(0)",
          minHeight: 110,
        }}
        onClick={() => onDetails ? onDetails(quest) : undefined}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = `${rarityColor}cc`;
          el.style.boxShadow = `0 6px 20px ${rarityColor}40, 0 0 ${isLegendary ? 24 : 12}px ${rarityColor}30`;
          el.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = `${rarityColor}88`;
          el.style.boxShadow = `0 0 ${isLegendary ? 16 : 6}px ${rarityColor}${isLegendary ? "44" : "1a"}`;
          el.style.transform = "translateY(0)";
        }}
      >
        {/* Rarity top strip */}
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${rarityColor}bb, transparent)`, borderRadius: "10px 10px 0 0" }} />
        {/* Rarity gem — top right corner */}
        <div style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: rarityColor, boxShadow: `0 0 7px ${rarityColor}`, opacity: 0.88 }} />
        {/* Card body */}
        <div className="p-3 flex-1">
          <div className="flex items-start gap-2 mb-1.5">
            <span className="flex-shrink-0 inline-flex" style={{ lineHeight: 1.2 }}>
              <img
                src={`/images/icons/cat-${quest.type === "relationship-coop" ? "coop" : quest.type}.png`}
                alt=""
                width={27}
                height={27}
                style={{ imageRendering: "pixelated" }}
                onError={(e) => { e.currentTarget.style.display = "none"; const next = e.currentTarget.nextElementSibling as HTMLElement; if (next) next.style.display = "inline"; }}
              />
              <span style={{ display: "none" }}>{typeCfg.icon}</span>
            </span>
            <p className="text-sm font-semibold leading-snug" style={{ color: isInProgress ? "#c4b5fd" : "#e8d5a3" }}>{quest.title}</p>
          </div>
          {quest.npcGiverId ? (
            <>
              <p className="text-xs font-semibold" style={{ color: RARITY_COLORS[quest.npcRarity ?? "common"] ?? "#9ca3af", opacity: 0.85 }}>
                {quest.npcName || "NPC"}
              </p>
              {flavorText && (
                <p className="text-xs truncate" style={{ fontSize: "0.75rem", fontStyle: "italic", color: "rgba(255,255,255,0.35)" }}>{flavorText}</p>
              )}
            </>
          ) : (
            <p className="text-xs italic" style={{ color: "rgba(220,185,120,0.35)" }}>{flavorText}</p>
          )}
        </div>
        {/* Card footer — rewards */}
        <div className="px-3 pb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {quest.npcGiverId && (
              <span className="font-bold uppercase" style={{ fontSize: 9, letterSpacing: "0.05em", color: "#e879f9", background: "rgba(232,121,249,0.08)", border: "1px solid rgba(232,121,249,0.25)", padding: "1px 4px", borderRadius: 3 }}>NPC</span>
            )}
            {(quest.chainTotal ?? 1) > 1 && <ChainDots chainIndex={quest.chainIndex ?? 0} chainTotal={quest.chainTotal!} color={RARITY_COLORS[quest.npcRarity ?? "common"] ?? "#f59e0b"} />}
            <span className="font-mono" style={{ fontSize: "0.7rem", color: "rgba(179,157,219,0.75)" }}>{(quest.rewards?.xp != null && quest.rewards.xp > 0) ? quest.rewards.xp : ({ high: 30, medium: 20, low: 10 }[quest.priority] ?? 10)} XP</span>
            <span className="font-mono" style={{ fontSize: "0.7rem", color: "rgba(251,191,36,0.75)" }}><img src="/images/icons/currency-gold.png" alt="" style={{width:14,height:14,display:"inline",verticalAlign:"middle",marginRight:2}} /> {(quest.rewards?.gold != null && quest.rewards.gold > 0) ? quest.rewards.gold : ({ high: 25, medium: 15, low: 9 }[quest.priority] ?? 9)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs uppercase font-mono" style={{ color: `${rarityColor}aa`, fontSize: 9, letterSpacing: "0.06em" }}>{rarity}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-feedback-id={`quest-board.quest-card.${quest.id}`}
      className="rounded-lg p-3 cursor-pointer relative overflow-hidden"
      style={{
        background: selected ? "linear-gradient(160deg, #2e2010 0%, #1e1a10 100%)" : "linear-gradient(160deg, #2a2016 0%, #1c1810 60%, #221d14 100%)",
        border: `1px solid ${selected ? "rgba(255,102,51,0.6)" : isInProgress ? `${rarityColor}55` : `${rarityColor}44`}`,
        boxShadow: isInProgress ? `0 0 10px ${rarityColor}22` : isLegendary ? `0 0 12px ${rarityColor}30` : "none",
        transform: "translateY(0)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
      }}
      onClick={() => setExpanded(v => !v)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = selected ? "rgba(255,102,51,0.8)" : `${rarityColor}88`;
        el.style.boxShadow = `0 6px 18px ${rarityColor}30`;
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = selected ? "rgba(255,102,51,0.6)" : isInProgress ? `${rarityColor}55` : `${rarityColor}44`;
        el.style.boxShadow = isInProgress ? `0 0 10px ${rarityColor}22` : isLegendary ? `0 0 12px ${rarityColor}30` : "none";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* Rarity left accent line */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${rarityColor}cc, ${rarityColor}44)`, borderRadius: "8px 0 0 8px" }} />
      <div className="flex items-start gap-2">
        {onToggle && (
          <button
            onClick={e => { e.stopPropagation(); onToggle(quest.id); }}
            className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
            style={{
              background: selected ? "rgba(255,102,51,0.8)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${selected ? "rgba(255,102,51,0.9)" : "rgba(255,255,255,0.15)"}`,
            }}
          >
            {selected && <span style={{ color: "#fff", fontSize: "8px", lineHeight: 1 }}>x</span>}
          </button>
        )}
        {!onToggle && isInProgress && (
          <span
            className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "#8b5cf6", boxShadow: "0 0 6px #8b5cf6", animation: "pulse 1.5s ease-in-out infinite" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium truncate flex-1" style={{ color: "#e8d5a3" }}>{quest.title}</p>
            {quest.humanInputRequired && <HumanInputBadge />}
            {quest.createdBy && quest.createdBy !== "leon" && quest.createdBy !== "unknown" && (
              <AgentBadge name={quest.createdBy} />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <TypeBadge type={quest.type} />
            {quest.npcGiverId && quest.npcName && (
              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 inline-flex items-center gap-1"
                style={{ color: RARITY_COLORS[quest.npcRarity ?? "common"] ?? "#e879f9", background: `${RARITY_COLORS[quest.npcRarity ?? "common"] ?? "#e879f9"}15`, border: `1px solid ${RARITY_COLORS[quest.npcRarity ?? "common"] ?? "#e879f9"}40` }}>
                x {quest.npcName}
              </span>
            )}
            {quest.recurrence && <RecurringBadge recurrence={quest.recurrence} />}
            {cats.map(c => <CategoryBadge key={c} category={c} />)}
            {quest.product && <ProductBadge product={quest.product} />}
            {isInProgress && quest.claimedBy && !isCoop && (
              <span className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ {quest.claimedBy}</span>
            )}
          </div>
          {isCoop && coopPartners.length > 0 && (
            <div className="mt-2">
              {/* Raid HP bar — decreases as partners complete */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold" style={{ color: "#f43f5e" }}>x Raid HP</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(0, 100 - (coopCompletions.length / coopPartners.length) * 100)}%`,
                      background: coopCompletions.length === coopPartners.length
                        ? "rgba(34,197,94,0.5)"
                        : "linear-gradient(90deg, #f43f5e, #fb7185)",
                      boxShadow: coopCompletions.length < coopPartners.length ? "0 0 6px rgba(244,63,94,0.5)" : "none",
                    }}
                  />
                </div>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{coopCompletions.length}/{coopPartners.length}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {coopPartners.map(p => {
                  const done = coopCompletions.includes(p);
                  const claimed = coopClaimed.includes(p);
                  return (
                    <span key={p} className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                      style={{ background: done ? "rgba(34,197,94,0.1)" : claimed ? "rgba(244,63,94,0.1)" : "rgba(255,255,255,0.05)", color: done ? "#22c55e" : claimed ? "#f43f5e" : "rgba(255,255,255,0.3)", border: `1px solid ${done ? "rgba(34,197,94,0.3)" : claimed ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.1)"}` }}
                    >
                      {done ? "x" : claimed ? "x" : "○"} {p}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {!expanded && quest.npcGiverId ? (
            <>
              <p className="text-xs mt-0.5 font-semibold truncate" style={{ color: RARITY_COLORS[quest.npcRarity ?? "common"] ?? "#9ca3af", opacity: 0.8 }}>
                {quest.npcName || "NPC"}
              </p>
              {flavorText && (
                <p className="text-xs mt-0.5 truncate" style={{ fontSize: "0.75rem", fontStyle: "italic", color: "rgba(255,255,255,0.35)" }}>{flavorText}</p>
              )}
            </>
          ) : !expanded ? (
            <p className="text-xs mt-0.5 italic truncate" style={{ color: "rgba(220,185,120,0.28)" }}>{flavorText}</p>
          ) : null}
          {expanded && quest.description && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "rgba(220,195,140,0.6)", fontStyle: "italic", borderLeft: `2px solid ${rarityColor}44`, paddingLeft: 8 }}>{quest.description}</p>
          )}
          {expanded && quest.lore && (
            <p className="text-xs mt-1.5 leading-relaxed italic" style={{ color: "rgba(167,139,250,0.6)", borderLeft: "2px solid rgba(139,92,246,0.25)", paddingLeft: "8px" }}>
              x {quest.lore}
            </p>
          )}
          {expanded && quest.chapter && (
            <span className="inline-flex text-xs mt-1 px-1.5 py-0.5 rounded" style={{ color: "rgba(251,191,36,0.7)", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
              x {quest.chapter}
            </span>
          )}
          {expanded && quest.checklist && quest.checklist.length > 0 && (
            <div className="mt-2 space-y-1">
              {quest.checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span style={{ color: item.done ? "#22c55e" : "rgba(255,255,255,0.25)" }}>{item.done ? "x" : "x"}</span>
                  <span style={{ color: item.done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              {quest.npcGiverId && (
                <span className="text-xs px-1 py-0.5 rounded font-bold uppercase" style={{ fontSize: 9, letterSpacing: "0.05em", color: "#e879f9", background: "rgba(232,121,249,0.08)", border: "1px solid rgba(232,121,249,0.25)" }}>NPC</span>
              )}
              {(quest.chainTotal ?? 1) > 1 && <ChainDots chainIndex={quest.chainIndex ?? 0} chainTotal={quest.chainTotal!} color={RARITY_COLORS[quest.npcRarity ?? "common"] ?? "#f59e0b"} />}
              <span style={{ fontSize: "0.7rem", color: "rgba(179,157,219,0.6)" }}>{(quest.rewards?.xp != null && quest.rewards.xp > 0) ? quest.rewards.xp : ({ high: 30, medium: 20, low: 10 }[quest.priority] ?? 10)} XP</span>
              <span style={{ fontSize: "0.7rem", color: "rgba(251,191,36,0.6)" }}><img src="/images/icons/currency-gold.png" alt="" style={{width:14,height:14,display:"inline",verticalAlign:"middle",marginRight:2}} /> {(quest.rewards?.gold != null && quest.rewards.gold > 0) ? quest.rewards.gold : ({ high: 25, medium: 15, low: 9 }[quest.priority] ?? 9)}</span>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{timeAgo(quest.createdAt)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {!isCoop && onClaim && quest.status === "open" && (
                <button onClick={e => { e.stopPropagation(); onClaim(quest.id); }} className="text-xs font-bold" style={{ background: "radial-gradient(circle at 40% 35%, #c0392b, #7b1a10)", color: "#ffd6a5", border: "2px solid #8b2010", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,180,100,0.2)", flexShrink: 0, padding: 0 }} title="Claim quest">x</button>
              )}
              {!isCoop && onUnclaim && isClaimedByMe && (
                <button onClick={e => { e.stopPropagation(); onUnclaim(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>Unclaim</button>
              )}
              {!isCoop && onComplete && isClaimedByMe && (
                <button onClick={e => { e.stopPropagation(); onComplete(quest.id, quest.title); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>x Done</button>
              )}
              {isCoop && isCoopPartner && !hasCoopClaimed && quest.status !== "completed" && onCoopClaim && (
                <button onClick={e => { e.stopPropagation(); onCoopClaim(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.3)" }}>x Join</button>
              )}
              {isCoop && isCoopPartner && hasCoopClaimed && !hasCoopCompleted && quest.status !== "completed" && onCoopComplete && (
                <button onClick={e => { e.stopPropagation(); onCoopComplete(quest.id); }} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>x My Part Done</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EpicQuestCard({ quest, selected, onToggle }: { quest: Quest; selected?: boolean; onToggle?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = quest.status === "in_progress";
  const cats = quest.categories?.length ? quest.categories : (quest.category ? [quest.category] : []);
  const progress = quest.progress;
  const children = quest.children ?? [];
  const progressPct = progress && progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div
      className="rounded-lg cursor-pointer"
      style={{
        background: selected ? "rgba(255,102,51,0.06)" : "#252525",
        border: `1px solid ${selected ? "rgba(255,102,51,0.4)" : "rgba(255,165,0,0.3)"}`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(255,165,0,0.15)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      {/* Header row */}
      <div className="p-3" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-2">
          {onToggle && (
            <button
              onClick={e => { e.stopPropagation(); onToggle(quest.id); }}
              className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
              style={{
                background: selected ? "rgba(255,102,51,0.8)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${selected ? "rgba(255,102,51,0.9)" : "rgba(255,255,255,0.15)"}`,
              }}
            >
              {selected && <span style={{ color: "#fff", fontSize: "8px", lineHeight: 1 }}>x</span>}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,165,0,0.7)" }}>◆</span>
              <p className="text-xs font-semibold truncate flex-1" style={{ color: "#e8e8e8" }}>{quest.title}</p>
              {quest.humanInputRequired && <HumanInputBadge />}
              <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
                {expanded ? "▲" : "▼"}
              </span>
            </div>
            {/* Progress bar / Boss HP bar */}
            {progress && progress.total > 0 && (
              <div className="mt-2">
                {quest.type === "boss" ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                        x Boss HP
                      </span>
                      <span className="text-xs font-mono" style={{ color: progressPct === 100 ? "#22c55e" : "#ef4444" }}>
                        {progressPct === 100 ? "DEFEATED!" : `${Math.round(100 - progressPct)}% HP`}
                      </span>
                    </div>
                    <div className="w-full rounded-full" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="rounded-full transition-all duration-700"
                        style={{
                          height: 6,
                          width: `${Math.max(0, 100 - progressPct)}%`,
                          background: progressPct >= 70 ? "#22c55e" : progressPct >= 40 ? "#f59e0b" : "linear-gradient(90deg, #ef4444, #ff6b00)",
                          boxShadow: progressPct < 40 ? "0 0 8px rgba(239,68,68,0.6)" : "none",
                        }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{progress.completed}/{progress.total} sub-quests dealt damage</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {progress.completed}/{progress.total} sub-quests
                      </span>
                      <span className="text-xs font-mono" style={{ color: progressPct === 100 ? "#22c55e" : "rgba(255,165,0,0.7)" }}>
                        {Math.round(progressPct)}%
                      </span>
                    </div>
                    <div className="w-full rounded-full" style={{ height: 4, background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="rounded-full"
                        style={{
                          height: 4,
                          width: `${progressPct}%`,
                          background: progressPct === 0
                            ? "#ef4444"
                            : progressPct === 100
                              ? "#22c55e"
                              : `linear-gradient(90deg, #ef4444 0%, #f59e0b ${Math.round(progressPct * 0.8)}%, #22c55e 100%)`,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <TypeBadge type={quest.type} />
              {quest.recurrence && <RecurringBadge recurrence={quest.recurrence} />}
              {cats.map(c => <CategoryBadge key={c} category={c} />)}
              {quest.product && <ProductBadge product={quest.product} />}
              {isInProgress && quest.claimedBy && (
                <span className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ {quest.claimedBy}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Sub-quests */}
      {expanded && children.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {children.map((child, i) => (
            <div
              key={child.id}
              className="flex items-center gap-2 px-3 py-2"
              style={{
                borderBottom: i === children.length - 1 ? "none" : "1px solid rgba(255,255,255,0.03)",
                background: "rgba(0,0,0,0.15)",
              }}
            >
              <span className="text-xs flex-shrink-0" style={{ color: child.status === "completed" ? "#22c55e" : "rgba(255,255,255,0.2)", marginLeft: 12 }}>
                {child.status === "completed" ? "x" : "◦"}
              </span>
              <p
                className="text-xs flex-1 truncate"
                style={{ color: child.status === "completed" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.65)", textDecoration: child.status === "completed" ? "line-through" : "none" }}
              >
                {child.title}
              </p>
              {child.claimedBy && (
                <span className="text-xs flex-shrink-0" style={{ color: "rgba(139,92,246,0.6)" }}>{child.claimedBy}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );}
