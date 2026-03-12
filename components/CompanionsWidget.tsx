"use client";

import { useState } from "react";
import type { User, Quest } from "@/app/types";
import { InfoTooltip } from "@/components/InfoTooltip";
import { RARITY_COLORS } from "@/components/QuestBoard";
import { getQuestRarity } from "@/app/utils";

// ─── Companions Widget (always visible on Quest Board) ───────────────────────


const COMPANION_IDS_ALL = ["ember_sprite", "lore_owl", "gear_golem"];
const COMPANION_META_ALL: Record<string, { icon: string; name: string; quote: string }> = {
  ember_sprite: { icon: "🔮", name: "Ember Sprite", quote: "The forge burns because YOU keep it lit!" },
  lore_owl:     { icon: "🦉", name: "Lore Owl",     quote: "Knowledge is power, adventurer." },
  gear_golem:   { icon: "🤖", name: "Gear Golem",   quote: "Efficiency is the path to glory." },
};
const DOBBIE_QUOTES = [
  "Dobbie demands a quest! ...and also a snack.",
  "Mrow. The Forge grows cold without quests.",
  "Dobbie approves of your progress. Now pet me.",
  "Have you tried completing more quests? Dobbie has opinions.",
  "Purring softly while judging your quest log.",
];

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
  const [quoteIdx] = useState(() => Math.floor(Math.random() * DOBBIE_QUOTES.length));
  const [petting, setPetting] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [petError, setPetError] = useState("");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [questToast, setQuestToast] = useState<string | null>(null);

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
        setCompletedIds(prev => new Set([...prev, questId]));
        setQuestToast(`✓ "${questTitle.length > 32 ? questTitle.slice(0, 32) + "…" : questTitle}" completed!`);
        setTimeout(() => setQuestToast(null), 2500);
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

  let mood: { emoji: string; label: string; color: string; tip: string; anim: string };
  if (isSleeping) {
    mood = { emoji: "😴", label: "Sleeping", color: "#818cf8", tip: "Your companion is resting. Come back in the morning!", anim: "" };
  } else if (streak >= 7 && petRecent && bondLevel >= 5) {
    mood = { emoji: "😸", label: "Ecstatic", color: "#f472b6", tip: "Your companion is absolutely thrilled!", anim: "animate-bounce" };
  } else if (streak >= 7 && petRecent) {
    mood = { emoji: "😊", label: "Happy", color: "#22c55e", tip: "Keep the streak going!", anim: "animate-bounce" };
  } else if (streak >= 3 || petRecent) {
    mood = { emoji: "😐", label: "Neutral", color: "#f59e0b", tip: "Complete quests to cheer them up!", anim: "" };
  } else if (!petRecent && hoursSincePet > 72) {
    mood = { emoji: "😢", label: "Neglected", color: "#dc2626", tip: "Your companion misses you — pet them!", anim: "animate-pulse" };
  } else {
    mood = { emoji: "😔", label: "Sad", color: "#ef4444", tip: "Your companions miss you!", anim: "animate-pulse" };
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
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/companion/pet`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
      if (r.ok) {
        setHeartAnim(true);
        setTimeout(() => setHeartAnim(false), 1200);
        if (onUserRefresh) onUserRefresh();
      } else {
        const d = await r.json();
        setPetError(d.error || "Already petted today");
        setTimeout(() => setPetError(""), 3000);
      }
    } catch { setPetError("Error"); setTimeout(() => setPetError(""), 3000); }
    setPetting(false);
  };

  const companionName = user?.companion?.name ?? "Dobbie";

  // Compact mode: only Dobbie row (mood + quote), used in Quest Board sidebar
  if (compact) {
    return (
      <div
        className="rounded-lg px-2 py-1.5 flex items-center gap-2"
        style={{
          background: "linear-gradient(135deg, rgba(255,107,157,0.06), rgba(255,107,157,0.02))",
          border: "1px solid rgba(255,107,157,0.2)",
          borderLeft: "3px solid #ff6b9d",
          cursor: onDobbieClick ? "pointer" : "default",
        }}
        onClick={onDobbieClick}
        title={onDobbieClick ? `Click to visit ${companionName} at the Hearth` : undefined}
      >
        <span className={`text-lg flex-shrink-0 ${mood.anim}`} title={mood.tip} style={{ filter: "drop-shadow(0 0 4px rgba(255,107,157,0.4))" }}>🐱</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: "#ff6b9d" }}>{companionName}</span>
            <span className="text-xs" style={{ color: mood.color }}>{mood.emoji} {mood.label}</span>
          </div>
          <p className="text-xs truncate italic" style={{ color: "rgba(220,185,120,0.4)" }}>{DOBBIE_QUOTES[quoteIdx]}</p>
        </div>
        {onDobbieClick && <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,107,157,0.5)" }}>🐾</span>}
      </div>
    );
  }

  return (
    <div
      data-tutorial="companions-widget"
      className="rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(255,107,157,0.04) 0%, rgba(20,10,30,0.8) 100%)",
        border: "2px solid rgba(255,107,157,0.15)",
        boxShadow: "inset 0 0 30px rgba(255,107,157,0.03), 0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      {/* Ornate top border strip */}
      <div style={{ height: 3, background: "linear-gradient(90deg, transparent, #ff6b9d88, rgba(255,215,0,0.3), #ff6b9d88, transparent)" }} />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs" style={{ color: "rgba(255,107,157,0.5)" }}>🐾</span>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,107,157,0.7)", textShadow: "0 0 8px rgba(255,107,157,0.2)" }}>Companions</span>
          <InfoTooltip text="Companions give you XP bonuses. Keep your streak and pet your companion to boost bond level. Higher bond = more XP!" />
          {earnedCompanions.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,107,157,0.08)", color: "rgba(255,107,157,0.6)", border: "1px solid rgba(255,107,157,0.2)" }}>
              +{(earnedCompanions.length + 1) * 2}% XP
            </span>
          )}
          {onDobbieClick && (
            <button
              onClick={onDobbieClick}
              className="ml-auto text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
              style={{
                color: "#ff6b9d",
                background: "linear-gradient(135deg, rgba(255,107,157,0.12), rgba(255,107,157,0.06))",
                border: "1px solid rgba(255,107,157,0.3)",
                boxShadow: "0 0 8px rgba(255,107,157,0.1)",
                cursor: "pointer",
              }}
              title="Go to Dobbie's Quest Board"
            >
              🐾 Quests
            </button>
          )}
        </div>

        {/* Player companion (real or virtual) */}
        {user?.companion && (
          <div className="mb-2 rounded-lg p-2.5" style={{
            background: "linear-gradient(135deg, rgba(255,107,157,0.06) 0%, rgba(30,15,5,0.5) 100%)",
            border: "1px solid rgba(255,107,157,0.15)",
            boxShadow: "inset 0 0 20px rgba(255,107,157,0.02)",
          }}>
            <div className="flex items-start gap-2">
              <span className={`text-2xl ${mood.anim}`} title={`${user.companion.name} — ${mood.tip}`} style={{ filter: "drop-shadow(0 0 6px rgba(255,107,157,0.3))" }}>
                {user.companion.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: "#f0e0d0" }}>{user.companion.name}</span>
                  <span className="text-xs italic" style={{ color: "rgba(220,185,120,0.4)" }}>{user.companion.isReal ? "Real Pet" : "Virtual"}</span>
                  <span className="text-xs" title={mood.tip} style={{ color: mood.color }}>{mood.emoji} {mood.label}</span>
                </div>
                {/* Bond level bar */}
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs" style={{ color: "rgba(255,107,157,0.65)" }}>Bond Lv.{bondLevel} — {bondTitle}</span>
                    <span className="text-xs" style={{ color: "rgba(255,107,157,0.45)" }}>
                      {bondXpBonus > 0 ? `+${bondXpBonus}% XP` : ""}
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,107,157,0.1)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${bondProgress * 100}%`, background: "linear-gradient(90deg, #ff6b9d, #ff9ec7)" }}
                    />
                  </div>
                </div>
              </div>
              {/* Pet button */}
              {playerName && apiKey && (
                <div className="flex flex-col items-center gap-0.5 relative">
                  <button
                    onClick={handlePet}
                    disabled={petting}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
                    style={{
                      background: heartAnim
                        ? "linear-gradient(135deg, rgba(255,107,157,0.3), rgba(255,107,157,0.15))"
                        : "linear-gradient(135deg, rgba(255,107,157,0.12), rgba(255,107,157,0.06))",
                      color: "#ff6b9d",
                      border: "1px solid rgba(255,107,157,0.3)",
                      boxShadow: heartAnim ? "0 0 12px rgba(255,107,157,0.3)" : "0 0 6px rgba(255,107,157,0.1)",
                      cursor: petting ? "wait" : "pointer",
                    }}
                    title="Pet your companion (+0.5 bond XP, max 2x/day)"
                  >
                    {heartAnim ? "💖" : "🐾"} Pet
                  </button>
                  {heartAnim && (
                    <span className="absolute -top-4 text-sm animate-bounce" style={{ pointerEvents: "none" }}>💕</span>
                  )}
                  {petError && (
                    <span className="text-xs mt-0.5" style={{ color: "#f59e0b", whiteSpace: "nowrap" }}>{petError}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dobbie — clickable, switches to NPC Quest Board */}
        <div
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all"
          style={{
            cursor: onDobbieClick ? "pointer" : "default",
            background: "linear-gradient(135deg, rgba(40,18,8,0.7) 0%, rgba(60,25,12,0.5) 100%)",
            border: "1px solid rgba(255,107,157,0.2)",
            borderLeft: "3px solid #ff6b9d",
            boxShadow: "inset 0 0 15px rgba(255,107,157,0.03), 0 2px 8px rgba(0,0,0,0.2)",
            minHeight: 52,
            marginBottom: dobbieQuests && dobbieQuests.length > 0 ? "0.5rem" : "0.375rem",
          }}
          onClick={onDobbieClick}
          title={onDobbieClick ? `Click to open ${companionName}'s Quest Board` : undefined}
        >
          <span
            className={`text-xl ${mood.label === "Happy" || mood.label === "Ecstatic" ? "animate-bounce" : mood.label === "Sad" || mood.label === "Neglected" ? "animate-pulse" : ""}`}
            title={`${companionName} — ${mood.tip}`}
            style={{ filter: "drop-shadow(0 0 5px rgba(255,107,157,0.35))" }}
          >🐱</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold" style={{ color: "#ff6b9d" }}>{companionName}</span>
              <span className="text-xs italic" style={{ color: "rgba(220,185,120,0.45)" }}>Cat Overlord</span>
              <span className="text-xs" title={mood.tip} style={{ color: mood.color }}>{mood.emoji} {mood.label}</span>
              <span className="text-xs font-mono" style={{ color: "rgba(255,107,157,0.4)" }}>+2% XP</span>
            </div>
            {/* Speech bubble style quote */}
            <div className="mt-1 relative" style={{
              background: "rgba(255,107,157,0.04)",
              border: "1px solid rgba(255,107,157,0.1)",
              borderRadius: 6,
              padding: "2px 8px",
            }}>
              <p className="text-xs italic truncate" style={{ color: "rgba(220,185,120,0.4)" }}>&ldquo;{DOBBIE_QUOTES[quoteIdx]}&rdquo;</p>
            </div>
          </div>
        </div>

        {/* Active Dobbie quests — fantasy-styled quest decree cards */}
        {dobbieQuests && dobbieQuests.length > 0 && (
          <div className="mb-1.5">
            {questToast && (
              <div className="rounded-lg px-2.5 py-1.5 text-xs font-semibold mb-1.5" style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.06))",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#4ade80",
                boxShadow: "0 0 10px rgba(34,197,94,0.1)",
              }}>
                {questToast}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.45rem" }}>
              {dobbieQuests.filter(q => !completedIds.has(q.id)).map(q => {
                const done = completedIds.has(q.id);
                const rarity = getQuestRarity(q);
                const rc = "#ff6b9d";
                const isLegendary = rarity === "legendary";
                const flavorText = q.flavorText || q.description || "";
                return (
                  <div
                    key={q.id}
                    className="rounded-xl flex flex-col relative overflow-hidden"
                    style={{
                      background: "linear-gradient(160deg, rgba(50,20,15,0.9) 0%, rgba(30,12,8,0.95) 55%, rgba(40,18,12,0.9) 100%)",
                      border: done ? "2px solid rgba(34,197,94,0.6)" : `2px solid rgba(255,107,157,0.25)`,
                      boxShadow: `inset 0 0 20px rgba(255,107,157,0.03), 0 0 ${isLegendary ? 16 : 8}px rgba(255,107,157,${isLegendary ? "0.15" : "0.06"})`,
                      opacity: done ? 0.5 : 1,
                      transition: "opacity 0.3s",
                      minHeight: 110,
                    }}
                  >
                    {/* Companion pink top strip */}
                    <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${rc}99, rgba(255,215,0,0.2), ${rc}99, transparent)`, borderRadius: "10px 10px 0 0" }} />
                    {/* Paw print gem — top right corner */}
                    <div style={{ position: "absolute", top: 8, right: 8, fontSize: 10, opacity: 0.5, filter: "drop-shadow(0 0 4px rgba(255,107,157,0.4))" }}>🐾</div>
                    {/* Card body */}
                    <div className="p-3 flex-1">
                      <p className="text-sm font-semibold leading-snug" style={{ color: "#f0d0c0", textDecoration: done ? "line-through" : "none", textShadow: "0 0 8px rgba(255,107,157,0.15)" }}>{q.title}</p>
                      {flavorText && (
                        <p className="text-xs italic mt-1" style={{ color: "rgba(220,185,120,0.35)", fontSize: "0.75rem" }}>{flavorText}</p>
                      )}
                    </div>
                    {/* Card footer — rewards + complete button */}
                    <div className="px-3 pb-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono" style={{ fontSize: "0.7rem", color: "rgba(255,107,157,0.6)" }}>{q.rewards?.xp ?? 0} XP</span>
                        <span className="font-mono" style={{ fontSize: "0.7rem", color: "rgba(251,191,36,0.75)" }}>🪙 {q.rewards?.gold ?? 0}</span>
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
                              border: done ? "1.5px solid #4ade80" : "1.5px solid rgba(255,107,157,0.4)",
                              background: done ? "rgba(34,197,94,0.15)" : "rgba(255,107,157,0.08)",
                              color: done ? "#4ade80" : "#ff6b9d",
                              cursor: completingId ? "wait" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
                              transition: "all 0.2s",
                              boxShadow: "0 0 6px rgba(255,107,157,0.1)",
                            }}
                            onMouseEnter={e => {
                              if (!done) {
                                const btn = e.currentTarget as HTMLButtonElement;
                                btn.style.background = "rgba(34,197,94,0.8)";
                                btn.style.color = "white";
                                btn.style.border = "1.5px solid rgba(34,197,94,0.8)";
                                btn.style.boxShadow = "0 0 12px rgba(34,197,94,0.5)";
                              }
                            }}
                            onMouseLeave={e => {
                              const btn = e.currentTarget as HTMLButtonElement;
                              btn.style.background = done ? "rgba(34,197,94,0.15)" : "rgba(255,107,157,0.08)";
                              btn.style.color = done ? "#4ade80" : "#ff6b9d";
                              btn.style.border = done ? "1.5px solid #4ade80" : "1.5px solid rgba(255,107,157,0.4)";
                              btn.style.boxShadow = "0 0 6px rgba(255,107,157,0.1)";
                              btn.style.transform = "scale(1)";
                            }}
                            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)"; }}
                            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
                          >
                            ✓
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
            <div key={c.id} className="flex items-center gap-2 mb-1.5 rounded-lg px-2.5 py-1.5"
              style={{
                background: "linear-gradient(135deg, rgba(20,10,30,0.6) 0%, rgba(30,15,40,0.5) 100%)",
                border: "1px solid rgba(255,107,157,0.12)",
                borderLeft: "2px solid rgba(167,139,250,0.4)",
                minHeight: 40,
              }}
            >
              <span className={`text-base ${mood.label === "Happy" || mood.label === "Ecstatic" ? "animate-bounce" : ""}`} title={`${meta?.name} — ${mood.tip}`} style={{ filter: "drop-shadow(0 0 4px rgba(167,139,250,0.3))" }}>{meta?.icon ?? c.icon}</span>
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

      {/* Ornate bottom border strip */}
      <div style={{ height: 2, background: "linear-gradient(90deg, transparent, rgba(255,107,157,0.2), transparent)" }} />
    </div>
  );
}

