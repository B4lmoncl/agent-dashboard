"use client";

import { useState } from "react";
import type { User, Quest } from "@/app/types";
import { InfoTooltip } from "@/components/InfoTooltip";
import { RARITY_COLORS } from "@/components/QuestBoard";
import { getQuestRarity } from "@/app/utils";

// ─── Companions Widget (always visible on Quest Board) ───────────────────────


const COMPANION_IDS_ALL = ["ember_sprite", "lore_owl", "gear_golem"];
const COMPANION_META_ALL: Record<string, { name: string; quote: string }> = {
  ember_sprite: { name: "Ember Sprite", quote: "The forge burns because YOU keep it lit!" },
  lore_owl:     { name: "Lore Owl",     quote: "Knowledge is power, adventurer." },
  gear_golem:   { name: "Gear Golem",   quote: "Efficiency is the path to glory." },
};
// Companion quotes by type category
const COMPANION_QUOTES: Record<string, string[]> = {
  cat: [
    "{name} demands a quest! ...and also a snack.",
    "Mrow. The Forge grows cold without quests.",
    "{name} approves of your progress. Now pet me.",
    "Have you tried completing more quests? {name} has opinions.",
    "Purring softly while judging your quest log.",
  ],
  dog: [
    "{name} wags tail excitedly! Quest time!",
    "{name} fetches your quest list. Good boy!",
    "Woof! {name} believes in you!",
    "{name} sits patiently, waiting for your next quest.",
    "{name} tilts head. More quests, please?",
  ],
  digital: [
    "{name} hums with energy. Ready for action!",
    "{name} scans the horizon for new challenges.",
    "Systems online. {name} awaits your command.",
    "{name} calculates optimal quest order...",
    "{name} pulses with anticipation. Let's go!",
  ],
  default: [
    "{name} watches you with bright eyes.",
    "{name} nudges you gently. Quest time!",
    "{name} waits patiently for your next move.",
    "Your companion {name} is ready for adventure!",
    "{name} chirps encouragingly.",
  ],
};

const REAL_PET_TYPES = new Set(["cat", "dog", "hamster", "bird", "fish", "rabbit", "other"]);
const VIRTUAL_COMPANION_TYPES = new Set(["dragon", "owl", "phoenix", "wolf", "fox", "bear"]);

function getCompanionPortrait(type?: string, name?: string): string | null {
  if (type === "cat" && name?.toLowerCase() === "dobbie") return "/images/portraits/companion-dobbie.png";
  if (type && VIRTUAL_COMPANION_TYPES.has(type)) return `/images/portraits/companion-${type}.png`;
  return null;
}

// Per-type accent colors for the companion panel
const COMPANION_COLORS: Record<string, { accent: string; accentRgb: string; border: string }> = {
  cat:     { accent: "#ff6b9d", accentRgb: "255,107,157", border: "rgba(255,107,157,0.4)" },
  dog:     { accent: "#c4873b", accentRgb: "196,135,59",  border: "rgba(196,135,59,0.4)" },
  hamster: { accent: "#f5a623", accentRgb: "245,166,35",  border: "rgba(245,166,35,0.4)" },
  bird:    { accent: "#4ade80", accentRgb: "74,222,128",   border: "rgba(74,222,128,0.4)" },
  fish:    { accent: "#60a5fa", accentRgb: "96,165,250",   border: "rgba(96,165,250,0.4)" },
  rabbit:  { accent: "#e879f9", accentRgb: "232,121,249",  border: "rgba(232,121,249,0.4)" },
  dragon:  { accent: "#ef4444", accentRgb: "239,68,68",    border: "rgba(239,68,68,0.4)" },
  owl:     { accent: "#a78bfa", accentRgb: "167,139,250",  border: "rgba(167,139,250,0.4)" },
  phoenix: { accent: "#f97316", accentRgb: "249,115,22",   border: "rgba(249,115,22,0.4)" },
  wolf:    { accent: "#64748b", accentRgb: "100,116,139",  border: "rgba(100,116,139,0.4)" },
  fox:     { accent: "#fb923c", accentRgb: "251,146,60",   border: "rgba(251,146,60,0.4)" },
  bear:    { accent: "#92400e", accentRgb: "146,64,14",    border: "rgba(146,64,14,0.4)" },
};
const DEFAULT_COMPANION_COLOR = { accent: "#00bcd4", accentRgb: "0,188,212", border: "rgba(0,188,212,0.4)" };

function getCompanionColor(type?: string) {
  if (!type) return COMPANION_COLORS.cat;
  return COMPANION_COLORS[type] ?? DEFAULT_COMPANION_COLOR;
}

// Portrait path helper: falls back to "x" placeholder per type
const COMPANION_PORTRAIT_FALLBACK: Record<string, string> = {
  cat: "", dog: "", hamster: "", bird: "", fish: "", rabbit: "",
  dragon: "", owl: "", phoenix: "", wolf: "", fox: "", bear: "",
};

function getCompanionQuotes(companionType?: string, companionName?: string): string[] {
  const name = companionName ?? "Companion";
  let category = "default";
  if (companionType === "cat") category = "cat";
  else if (companionType === "dog") category = "dog";
  else if (companionType && !REAL_PET_TYPES.has(companionType)) category = "digital";
  else if (companionType === "hamster" || companionType === "bird" || companionType === "fish" || companionType === "rabbit") category = "default";
  const templates = COMPANION_QUOTES[category] ?? COMPANION_QUOTES.default;
  return templates.map(t => t.replace(/\{name\}/g, name));
}

export function CompanionsWidget({ user, streak, playerName, apiKey, onDobbieClick, onUserRefresh, compact, dobbieQuests }: {
  user: User | null | undefined;
  streak: number;
  playerName?: string;
  apiKey?: string;
  onDobbieClick?: () => void;
  onUserRefresh?: () => void;
  compact?: boolean;
  dobbieQuests?: Quest[];
}) {
  const companionType = user?.companion?.type || user?.companion?.species;
  const companionQuotes = getCompanionQuotes(companionType, user?.companion?.name);
  const [quoteIdx] = useState(() => Math.floor(Math.random() * 5));
  const [petting, setPetting] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [petError, setPetError] = useState("");
  const [petsToday, setPetsToday] = useState<number | null>(null);
  const [showHearts, setShowHearts] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [questToast, setQuestToast] = useState<string | null>(null);
  const [rewardPopup, setRewardPopup] = useState<{ title: string; xp: number; gold: number; bondXp: number; loot: { name: string; emoji: string; rarity: string } | null } | null>(null);
  const [completingSuccessId, setCompletingSuccessId] = useState<string | null>(null);
  const [companionGlow, setCompanionGlow] = useState(false);

  const handleCompleteQuest = async (questId: string, questTitle: string) => {
    if (!apiKey || completingId) return;
    setCompletingId(questId);
    try {
      const r = await fetch(`/api/quest/${questId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ agentId: playerName }),
      });
      if (r.ok) {
        const data = await r.json();
        setCompletedIds(prev => new Set([...prev, questId]));
        // Success animation on button for 1.5s
        setCompletingSuccessId(questId);
        setTimeout(() => setCompletingSuccessId(null), 1500);
        // Show reward popup — stays until user clicks to dismiss
        const quest = data.quest;
        setRewardPopup({
          title: questTitle.length > 40 ? questTitle.slice(0, 40) + "…" : questTitle,
          xp: quest?.rewards?.xp ?? data.xp ?? 0,
          gold: quest?.rewards?.gold ?? data.gold ?? 0,
          bondXp: 1,
          loot: data.lootDrop ? { name: data.lootDrop.name, emoji: data.lootDrop.emoji, rarity: data.lootDrop.rarity } : null,
        });
        // Companion glow effect
        setCompanionGlow(true);
        setTimeout(() => setCompanionGlow(false), 2000);
        setTimeout(() => {
          setCompletedIds(prev => { const s = new Set(prev); s.delete(questId); return s; });
          if (onUserRefresh) onUserRefresh();
        }, 2000);
      }
    } catch { /* silent */ }
    setCompletingId(null);
  };

  const earnedCompanions = (user?.earnedAchievements ?? []).filter(a => COMPANION_IDS_ALL.includes(a.id));

  // Mood v2: factors — streak, bond level, time since last petted, hour of day
  const hour = new Date().getHours();
  const isSleeping = hour >= 23 || hour < 7;
  const bondLevel = user?.companion?.bondLevel ?? 1;
  const lastPetted = user?.companion?.lastPetted;
  const hoursSincePet = lastPetted
    ? (Date.now() - new Date(lastPetted).getTime()) / 3_600_000
    : Infinity;
  const petRecent = hoursSincePet < 24;

  let mood: { label: string; color: string; tip: string; anim: string };
  if (isSleeping) {
    mood = { label: "Sleeping", color: "#818cf8", tip: "Your companion is resting. Come back in the morning!", anim: "" };
  } else if (streak >= 7 && petRecent && bondLevel >= 5) {
    mood = { label: "Ecstatic", color: "#f472b6", tip: "Your companion is absolutely thrilled!", anim: "animate-bounce" };
  } else if (streak >= 7 && petRecent) {
    mood = { label: "Happy", color: "#22c55e", tip: "Keep the streak going!", anim: "animate-bounce" };
  } else if (streak >= 3 || petRecent) {
    mood = { label: "Neutral", color: "#f59e0b", tip: "Complete quests to cheer them up!", anim: "" };
  } else if (!petRecent && hoursSincePet > 72) {
    mood = { label: "Neglected", color: "#dc2626", tip: "Your companion misses you — pet them!", anim: "animate-pulse" };
  } else {
    mood = { label: "Sad", color: "#ef4444", tip: "Your companions miss you!", anim: "animate-pulse" };
  }

  // Bond info
  const bondXp = user?.companion?.bondXp ?? 0;
  const bondTitles = ["Stranger","Acquaintance","Friend","Close Friend","Best Friend","Soulmate","Legendary I","Legendary II","Legendary III","Legendary IV"];
  const bondThresholds = [0, 10, 25, 50, 80, 120, 200, 300, 450, 666];
  const nextThreshold = bondThresholds[bondLevel] ?? bondThresholds[bondThresholds.length - 1];
  const prevThreshold = bondThresholds[bondLevel - 1] ?? 0;
  const bondProgress = bondLevel >= 10 ? 1 : Math.min(1, (bondXp - prevThreshold) / Math.max(1, nextThreshold - prevThreshold));
  const bondTitle = bondTitles[bondLevel - 1] ?? "Stranger";
  const bondXpBonus = bondLevel - 1; // +1% per level above 1

  const handlePet = async () => {
    if (!playerName || !apiKey || petting) return;
    setPetting(true);
    setPetError("");
    // Always play heart animation
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 1200);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/companion/pet`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
      const d = await r.json();
      if (r.ok) {
        setPetsToday(d.petsToday ?? null);
        // message feedback removed — belly rubs counter is enough
        if (onUserRefresh) onUserRefresh();
      } else {
        setPetError(d.error || "Error");
        setTimeout(() => setPetError(""), 3000);
      }
    } catch { setPetError("Error"); setTimeout(() => setPetError(""), 3000); }
    setPetting(false);
  };

  const companionName = user?.companion?.name ?? "Companion";
  const cColor = getCompanionColor(companionType);

  // Compact mode: companion row (mood + quote), used in Quest Board sidebar
  if (compact) {
    return (
      <div
        className="rounded-lg px-2 py-1.5 flex items-center gap-2"
        style={{
          background: `linear-gradient(135deg, rgba(${cColor.accentRgb},0.06), rgba(${cColor.accentRgb},0.02))`,
          border: `1px solid rgba(${cColor.accentRgb},0.2)`,
          borderLeft: "3px solid #2a2a3e",
          cursor: onDobbieClick ? "pointer" : "default",
        }}
        onClick={onDobbieClick}
        title={onDobbieClick ? `Click to visit ${companionName} at the Hearth` : undefined}
      >
        <span className={`text-xs font-bold flex-shrink-0 ${mood.anim}`} title={mood.tip} style={{ color: cColor.accent }}>{companionName}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs" style={{ color: mood.color }}>{mood.label}</span>
          </div>
          <p className="text-xs truncate italic" style={{ color: "rgba(220,185,120,0.4)" }}>{companionQuotes[quoteIdx % companionQuotes.length]}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-tutorial="companions-widget" style={{ padding: 8 }}>
      <div
        style={{
          background: "#0c0e14",
          border: "2px solid #2a2a3e",
          boxShadow: `inset 2px 2px 0 #0a0b10, inset -2px -2px 0 #141620, 0 0 0 5px #0c0e14, 0 0 0 7px #1e2030, 0 4px 16px rgba(0,0,0,0.7), 0 0 15px rgba(${cColor.accentRgb},0.04)`,
          borderRadius: 2,
          overflow: "visible",
        }}
      >
        {/* Portrait + Content layout */}
        <div style={{ display: "flex", gap: 16, padding: 16 }}>
          {/* Left: Portrait — virtual types get pixel art portrait, real pets use emoji fallback */}
          {(() => {
            const portraitSrc = getCompanionPortrait(companionType, companionName);
            return portraitSrc ? (
              <img
                src={portraitSrc}
                alt={companionName}
                style={{ width: 128, height: 160, imageRendering: "auto", borderRadius: 4, border: `2px solid ${cColor.border}`, boxShadow: companionGlow ? `0 0 24px rgba(${cColor.accentRgb},0.6), 0 0 48px rgba(${cColor.accentRgb},0.3)` : `0 0 12px rgba(${cColor.accentRgb},0.15)`, flexShrink: 0, transition: "box-shadow 0.5s ease" }}
              />
            ) : (
              <div style={{
                width: 128, height: 160, borderRadius: 4,
                border: `2px solid ${cColor.border}`,
                boxShadow: companionGlow ? `0 0 24px rgba(${cColor.accentRgb},0.6), 0 0 48px rgba(${cColor.accentRgb},0.3)` : `0 0 12px rgba(${cColor.accentRgb},0.15)`,
                flexShrink: 0,
                transition: "box-shadow 0.5s ease",
                background: `linear-gradient(135deg, rgba(${cColor.accentRgb},0.08), rgba(${cColor.accentRgb},0.02))`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 48, color: cColor.accent,
              }}>
                {user?.companion?.emoji || COMPANION_PORTRAIT_FALLBACK[companionType ?? ""] || "?"}
              </div>
            );
          })()}

          {/* Right: Name + Mood + Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title + mood on same line */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: cColor.accent, fontWeight: 600, fontSize: 14 }}>
                {companionName}&apos;s Demands
              </span>
              <span className={mood.anim} title={mood.tip} style={{ color: mood.color, fontSize: 12, flexShrink: 0 }}>
                {mood.label}
              </span>
            </div>

            {/* Flavor text / quote */}
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontStyle: "italic", marginBottom: 12 }}>
              &ldquo;{companionQuotes[quoteIdx % companionQuotes.length]}&rdquo;
            </p>

            {/* Player companion bond info */}
            {user?.companion && (
              <div style={{
                background: "#0e1018",
                border: "1px solid #1a1c28",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
                borderTop: `1px solid rgba(${cColor.accentRgb},0.25)`,
                borderRadius: 2,
                padding: "8px 10px",
                marginBottom: 10,
              }}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold" style={{ color: "#f0e0d0" }}>{user.companion.name}</span>
                      <span className="text-xs italic" style={{ color: "rgba(220,185,120,0.4)" }}>{user.companion.isReal ? "Real Pet" : "Virtual"}</span>
                      <span className="text-xs" style={{ color: `rgba(${cColor.accentRgb},0.65)` }}>Bond Lv.{bondLevel} — {bondTitle}</span>
                      {bondXpBonus > 0 && <span className="text-xs" style={{ color: `rgba(${cColor.accentRgb},0.45)` }}>+{bondXpBonus}% XP</span>}
                    </div>
                    <div className="mt-1 rounded-full overflow-hidden" style={{ height: 4, background: `rgba(${cColor.accentRgb},0.1)` }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${bondProgress * 100}%`, background: `linear-gradient(90deg, ${cColor.accent}, ${cColor.accent}99)` }} />
                    </div>
                  </div>
                  {playerName && apiKey && (
                    <div className="flex flex-col items-center gap-0.5 relative">
                      {/* Floating hearts animation */}
                      {heartAnim && (
                        <div className="absolute pointer-events-none" style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)" }}>
                          {["❤️","💕","❤️"].map((h, i) => (
                            <span key={i} style={{
                              position: "absolute",
                              left: `${(i - 1) * 14}px`,
                              bottom: 0,
                              fontSize: 14,
                              animation: `petHeartFloat 1.2s ease-out forwards`,
                              animationDelay: `${i * 0.15}s`,
                              opacity: 0,
                            }}>{h}</span>
                          ))}
                        </div>
                      )}
                      <button onClick={handlePet} disabled={petting} className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all" style={{
                        background: heartAnim ? "linear-gradient(135deg, rgba(255,107,157,0.3), rgba(255,107,157,0.15))" : "linear-gradient(135deg, rgba(255,107,157,0.12), rgba(255,107,157,0.06))",
                        color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)",
                        boxShadow: heartAnim ? "0 0 12px rgba(255,107,157,0.3)" : "0 0 6px rgba(255,107,157,0.1)",
                        cursor: petting ? "wait" : "pointer",
                      }} title="Pet your companion (+0.5 bond XP, max 2x/day)">
                        🐾 Pet
                      </button>
                      <span className="text-xs" style={{ color: "rgba(255,107,157,0.5)", fontSize: 10, whiteSpace: "nowrap" }}>
                        {petsToday !== null ? petsToday : (user?.companion?.petCountToday ?? 0)}/2 belly rubs today
                      </span>

                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quest cards in 2-column grid */}
            {dobbieQuests && dobbieQuests.length > 0 && (
              <div>
                {questToast && (
                  <div className="rounded px-2.5 py-1.5 text-xs font-semibold mb-1.5" style={{
                    background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.06))",
                    border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80",
                    boxShadow: "0 0 10px rgba(34,197,94,0.1)",
                  }}>
                    {questToast}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {dobbieQuests.filter(q => !completedIds.has(q.id)).map(q => {
                    const done = completedIds.has(q.id);
                    const rarity = getQuestRarity(q);
                    const isLegendary = rarity === "legendary";
                    const flavorText = q.flavorText || q.description || "";
                    return (
                      <div key={q.id} className="flex flex-col relative overflow-hidden" style={{
                        background: "#0e1018",
                        border: done ? "1px solid rgba(34,197,94,0.6)" : "1px solid #1a1c28",
                        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02)${isLegendary ? ", 0 0 12px rgba(255,107,157,0.1)" : ""}`,
                        borderTop: done ? "1px solid rgba(34,197,94,0.6)" : "1px solid rgba(255,107,157,0.25)",
                        borderRadius: 2,
                        opacity: done ? 0.5 : 1,
                        transition: "opacity 0.3s",
                        minHeight: 110,
                      }}>
                        <div className="p-3 flex-1">
                          <p className="text-sm font-semibold leading-snug" style={{ color: "#f0d0c0", textDecoration: done ? "line-through" : "none", textShadow: "0 0 8px rgba(255,107,157,0.15)" }}>{q.title}</p>
                          {flavorText && <p className="text-xs italic mt-1" style={{ color: "rgba(220,185,120,0.35)", fontSize: "0.75rem" }}>{flavorText}</p>}
                        </div>
                        <div className="px-3 pb-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono" style={{ fontSize: "0.7rem", color: "rgba(255,107,157,0.6)" }}>{q.rewards?.xp ?? 0} XP</span>
                            <span className="font-mono" style={{ fontSize: "0.7rem", color: "rgba(251,191,36,0.75)" }}>{q.rewards?.gold ?? 0}g</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs uppercase font-mono" style={{ color: "rgba(255,107,157,0.5)", fontSize: 9, letterSpacing: "0.06em" }}>{rarity}</span>
                            {apiKey && (
                              <button
                                onClick={() => handleCompleteQuest(q.id, q.title)}
                                disabled={!!completingId || done}
                                title="Mark quest complete"
                                style={{
                                  width: 24, height: 24, borderRadius: "50%",
                                  border: done || completingSuccessId === q.id ? "1.5px solid #4ade80" : "1.5px solid rgba(255,107,157,0.4)",
                                  background: completingSuccessId === q.id ? "rgba(34,197,94,0.7)" : done ? "rgba(34,197,94,0.15)" : "rgba(255,107,157,0.08)",
                                  color: done || completingSuccessId === q.id ? "#4ade80" : "#a78bfa",
                                  cursor: completingId ? "wait" : "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
                                  transition: "all 0.2s",
                                  boxShadow: completingSuccessId === q.id ? "0 0 14px rgba(34,197,94,0.6)" : "0 0 6px rgba(255,107,157,0.1)",
                                }}
                                onMouseEnter={e => {
                                  if (!done && completingSuccessId !== q.id) {
                                    const btn = e.currentTarget as HTMLButtonElement;
                                    btn.style.background = "rgba(34,197,94,0.8)";
                                    btn.style.color = "white";
                                    btn.style.border = "1.5px solid rgba(34,197,94,0.8)";
                                    btn.style.boxShadow = "0 0 12px rgba(34,197,94,0.5)";
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (completingSuccessId !== q.id) {
                                    const btn = e.currentTarget as HTMLButtonElement;
                                    btn.style.background = done ? "rgba(34,197,94,0.15)" : "rgba(255,107,157,0.08)";
                                    btn.style.color = done ? "#4ade80" : "#a78bfa";
                                    btn.style.border = done ? "1.5px solid #4ade80" : "1.5px solid rgba(255,107,157,0.4)";
                                    btn.style.boxShadow = "0 0 6px rgba(255,107,157,0.1)";
                                    btn.style.transform = "scale(1)";
                                  }
                                }}
                                onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)"; }}
                                onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
                              >
                                {completingSuccessId === q.id ? "✓" : completingId === q.id ? "…" : "✓"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Earned forge companions */}
            {earnedCompanions.map(c => {
              const meta = COMPANION_META_ALL[c.id];
              return (
                <div key={c.id} className="flex items-center gap-2 mt-2 px-2.5 py-1.5" style={{
                  background: "#0e1018",
                  border: "1px solid #1a1c28",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
                  borderTop: "1px solid rgba(167,139,250,0.25)",
                  borderRadius: 2,
                }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>{meta?.name ?? c.name}</span>
                      <span className="text-xs font-mono" style={{ color: "rgba(167,139,250,0.4)" }}>+2% XP</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {earnedCompanions.length === 0 && !user?.companion && (
              <p className="text-xs mt-1 italic" style={{ color: "rgba(220,185,120,0.25)" }}>
                Complete achievements to unlock more companions!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Companion Quest Reward Popup */}
      {rewardPopup && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setRewardPopup(null)}>
          <div className="w-full max-w-xs rounded-2xl p-6 text-center" style={{
            background: "linear-gradient(180deg, #1a0d1e 0%, #0d0d14 60%)",
            border: `2px solid ${cColor.border}`,
            boxShadow: `0 0 30px rgba(${cColor.accentRgb},0.3), 0 0 60px rgba(${cColor.accentRgb},0.1)`,
            animation: "levelup-modal-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }} onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-2" style={{ filter: `drop-shadow(0 0 12px rgba(${cColor.accentRgb},0.6))` }}>
              {user?.companion?.emoji || "⭐"}
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: cColor.accent }}>
              Quest Complete!
            </div>
            <div className="text-sm font-semibold mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>
              {rewardPopup.title}
            </div>
            <div className="flex flex-col gap-1.5 mb-4">
              {rewardPopup.xp > 0 && (
                <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg" style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <span className="text-sm" style={{ color: "#a78bfa" }}>+{rewardPopup.xp} XP</span>
                </div>
              )}
              {rewardPopup.gold > 0 && (
                <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <span className="text-sm" style={{ color: "#fbbf24" }}>+{rewardPopup.gold} Gold</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg" style={{ background: `rgba(${cColor.accentRgb},0.1)`, border: `1px solid rgba(${cColor.accentRgb},0.2)` }}>
                <span className="text-sm" style={{ color: cColor.accent }}>+{rewardPopup.bondXp} Bond XP</span>
              </div>
              {rewardPopup.loot && (
                <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                  <span className="text-sm">{rewardPopup.loot.emoji}</span>
                  <span className="text-sm" style={{ color: "#FFD700" }}>{rewardPopup.loot.name}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setRewardPopup(null)}
              className="action-btn w-full py-2 rounded-xl text-sm font-semibold"
              style={{ background: `rgba(${cColor.accentRgb},0.12)`, color: cColor.accent, border: `1px solid rgba(${cColor.accentRgb},0.35)` }}
            >
              Nice!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
