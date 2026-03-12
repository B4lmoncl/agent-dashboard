"use client";

import { useState } from "react";
import type { User, Quest } from "@/app/types";
import { InfoTooltip } from "@/components/InfoTooltip";

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
        headers: { "x-api-key": apiKey },
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

  // Compact mode: only Dobbie row (mood + quote), used in Quest Board sidebar
  if (compact) {
    return (
      <div
        className="rounded-lg px-2 py-1.5 flex items-center gap-2"
        style={{ background: "rgba(255,107,157,0.04)", border: "1px solid rgba(255,107,157,0.12)", cursor: onDobbieClick ? "pointer" : "default" }}
        onClick={onDobbieClick}
        title={onDobbieClick ? `Click to visit ${user?.companion?.name ?? "Dobbie"} at the Hearth` : undefined}
      >
        <span className={`text-base flex-shrink-0 ${mood.anim}`} title={mood.tip}>🐱</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: "#ff6b9d" }}>{user?.companion?.name ?? "Dobbie"}</span>
            <span className="text-xs" style={{ color: mood.color }}>{mood.emoji} {mood.label}</span>
          </div>
          <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{DOBBIE_QUOTES[quoteIdx]}</p>
        </div>
        {onDobbieClick && <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,107,157,0.4)" }}>→</span>}
      </div>
    );
  }

  return (
    <div
      data-tutorial="companions-widget"
      className="rounded-xl p-3"
      style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.18)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.7)" }}>Companions</span>
        <InfoTooltip text="Companions give you XP bonuses. Keep your streak and pet your companion to boost bond level. Higher bond = more XP!" />
        {earnedCompanions.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(99,102,241,0.1)", color: "rgba(99,102,241,0.6)", border: "1px solid rgba(99,102,241,0.2)" }}>
            +{(earnedCompanions.length + 1) * 2}% XP
          </span>
        )}
        {onDobbieClick && (
          <button
            onClick={onDobbieClick}
            className="ml-auto text-xs px-2 py-0.5 rounded"
            style={{ color: "#ff6b9d", background: "rgba(255,107,157,0.08)", border: "1px solid rgba(255,107,157,0.2)", cursor: "pointer" }}
            title="Go to Dobbie's Quest Board"
          >
            → Quests
          </button>
        )}
      </div>

      {/* Player companion (real or virtual) */}
      {user?.companion && (
        <div className="mb-2 rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-start gap-2">
            <span className={`text-xl ${mood.anim}`} title={`${user.companion.name} — ${mood.tip}`}>
              {user.companion.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{user.companion.name}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{user.companion.isReal ? "Real Pet" : "Virtual"}</span>
                <span className="text-xs" title={mood.tip} style={{ color: mood.color }}>{mood.emoji} {mood.label}</span>
              </div>
              {/* Bond level bar */}
              <div className="mt-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs" style={{ color: "rgba(167,139,250,0.7)" }}>Bond Lv.{bondLevel} — {bondTitle}</span>
                  <span className="text-xs" style={{ color: "rgba(99,102,241,0.55)" }}>
                    {bondXpBonus > 0 ? `+${bondXpBonus}% XP` : ""}
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${bondProgress * 100}%`, background: "linear-gradient(90deg, #7c3aed, #a78bfa)" }}
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
                  className="text-xs px-2 py-1 rounded-lg font-semibold transition-all"
                  style={{
                    background: heartAnim ? "rgba(255,107,157,0.2)" : "rgba(255,107,157,0.08)",
                    color: "#ff6b9d",
                    border: "1px solid rgba(255,107,157,0.25)",
                    cursor: petting ? "wait" : "pointer",
                  }}
                  title="Pet your companion (+0.5 bond XP, max 2×/day)"
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
        className="flex items-center gap-2 rounded-lg px-2 py-2 transition-all"
        style={{
          cursor: onDobbieClick ? "pointer" : "default",
          background: "linear-gradient(135deg, rgba(30,15,5,0.55) 0%, rgba(50,20,10,0.45) 100%)",
          border: "1px solid rgba(255,107,157,0.2)",
          minHeight: 52,
          marginBottom: dobbieQuests && dobbieQuests.length > 0 ? "0.5rem" : "0.375rem",
        }}
        onClick={onDobbieClick}
        title={onDobbieClick ? `Click to open ${user?.companion?.name ?? "Dobbie"}'s Quest Board` : undefined}
      >
        <span className={`text-lg ${mood.label === "Happy" || mood.label === "Ecstatic" ? "animate-bounce" : mood.label === "Sad" || mood.label === "Neglected" ? "animate-pulse" : ""}`} title={`${user?.companion?.name ?? "Dobbie"} — ${mood.tip}`}>🐱</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold" style={{ color: "#ff6b9d" }}>{user?.companion?.name ?? "Dobbie"}</span>
            <span className="text-xs" title={mood.tip} style={{ color: mood.color }}>{mood.emoji} {mood.label}</span>
            <span className="text-xs" style={{ color: "rgba(99,102,241,0.5)" }}>+2% XP</span>
          </div>
          <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{DOBBIE_QUOTES[quoteIdx]}</p>
        </div>
      </div>

      {/* Active Dobbie quests */}
      {dobbieQuests && dobbieQuests.length > 0 && (
        <div className="mb-1.5 space-y-1 pl-1" style={{ maxWidth: 500 }}>
          {questToast && (
            <div className="rounded px-2 py-1 text-xs font-semibold mb-1" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}>
              {questToast}
            </div>
          )}
          {dobbieQuests.filter(q => !completedIds.has(q.id)).map(q => {
            const done = completedIds.has(q.id);
            return (
              <div key={q.id} className="flex items-center gap-1.5 rounded px-1.5 py-0.5" style={{ background: "rgba(255,107,157,0.06)", border: "1px solid rgba(255,107,157,0.15)", opacity: done ? 0.5 : 1 }}>
                {/* Complete button */}
                {apiKey && (
                  <button
                    onClick={() => handleCompleteQuest(q.id, q.title)}
                    disabled={!!completingId || done}
                    title="Mark quest complete"
                    style={{
                      width: 18, height: 18, borderRadius: "50%",
                      border: done ? "1.5px solid #4ade80" : "1.5px solid rgba(255,255,255,0.2)",
                      background: done ? "rgba(34,197,94,0.15)" : "transparent",
                      color: done ? "#4ade80" : "rgba(255,255,255,0.35)",
                      cursor: completingId ? "wait" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.65rem", fontWeight: 700, flexShrink: 0,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { if (!done) (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 6px rgba(34,197,94,0.5)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
                  >
                    ✓
                  </button>
                )}
                <span className="truncate flex-1" style={{ fontSize: "0.8rem", color: done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.55)", textDecoration: done ? "line-through" : "none" }}>{q.title}</span>
                <span className="flex-shrink-0 font-semibold" style={{ fontSize: "0.8rem", color: "#ff6b9d" }}>+{q.rewards?.xp ?? 0} XP</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Earned forge companions */}
      {earnedCompanions.map(c => {
        const meta = COMPANION_META_ALL[c.id];
        return (
          <div key={c.id} className="flex items-center gap-2 mb-1.5 rounded-lg px-2 py-1.5"
            style={{
              background: "linear-gradient(135deg, rgba(10,8,25,0.55) 0%, rgba(20,10,40,0.45) 100%)",
              border: "1px solid rgba(167,139,250,0.2)",
              minHeight: 40,
            }}
          >
            <span className={`text-base ${mood.label === "Happy" || mood.label === "Ecstatic" ? "animate-bounce" : ""}`} title={`${meta?.name} — ${mood.tip}`}>{meta?.icon ?? c.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold" style={{ color: "#a78bfa" }}>{meta?.name ?? c.name}</span>
                <span className="text-xs" style={{ color: "rgba(99,102,241,0.5)" }}>+2% XP</span>
              </div>
            </div>
          </div>
        );
      })}

      {earnedCompanions.length === 0 && !user?.companion && (
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.22)" }}>
          Complete achievements to unlock more companions!
        </p>
      )}
    </div>
  );
}

