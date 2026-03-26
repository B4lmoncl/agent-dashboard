"use client";

import { useState } from "react";
import { Tip, TipCustom } from "@/components/GameTooltip";
import type { User, Quest } from "@/app/types";
import { RARITY_COLORS } from "@/components/QuestBoard";
import { getQuestRarity } from "@/app/utils";
import { SFX } from "@/lib/sounds";
import { getAuthHeaders } from "@/lib/auth-client";
import { getCompanionColor, getCompanionPortrait } from "@/lib/companion-config";

// ─── Companions Widget (always visible on Quest Board) ───────────────────────


const COMPANION_IDS_ALL = ["ember_sprite", "lore_owl", "gear_golem"];
const COMPANION_META_ALL: Record<string, { name: string; quote: string; icon: string }> = {
  ember_sprite: { name: "Ember Sprite", quote: "The forge burns because YOU keep it lit!", icon: "/images/icons/mini-ember-sprite.png" },
  lore_owl:     { name: "Lore Owl",     quote: "Knowledge is power, adventurer.",         icon: "/images/icons/mini-lore-owl.png" },
  gear_golem:   { name: "Gear Golem",   quote: "Efficiency is the path to glory.",        icon: "/images/icons/mini-gear-golem.png" },
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

export function CompanionsWidget({ user, streak, playerName, apiKey, onDobbieClick, onUserRefresh, compact, dobbieQuests, onRewardCelebration, onNavigate }: {
  user: User | null | undefined;
  streak: number;
  playerName?: string;
  apiKey?: string;
  onDobbieClick?: () => void;
  onUserRefresh?: () => void;
  compact?: boolean;
  dobbieQuests?: Quest[];
  onRewardCelebration?: (data: { type: "companion"; title: string; xpEarned: number; goldEarned: number; loot?: { name: string; emoji: string; rarity: string } | null; bondXp?: number; companionAccent?: string; companionEmoji?: string }) => void;
  onNavigate?: (view: string) => void;
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
  const [ultimateUsing, setUltimateUsing] = useState<string | null>(null);
  const [ultimateResult, setUltimateResult] = useState<string | null>(null);
  const [ultimatePickQuest, setUltimatePickQuest] = useState(false);
  const [ultimateGlow, setUltimateGlow] = useState(false);
  const [rewardPopup, setRewardPopup] = useState<{ title: string; xp: number; gold: number; bondXp: number; loot: { name: string; emoji: string; rarity: string } | null } | null>(null);
  const [completingSuccessId, setCompletingSuccessId] = useState<string | null>(null);
  const [companionGlow, setCompanionGlow] = useState(false);

  const handleCompleteQuest = async (questId: string, questTitle: string) => {
    if (!apiKey || completingId) return;
    setCompletingId(questId);
    try {
      const r = await fetch(`/api/quest/${questId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
        body: JSON.stringify({ agentId: playerName }),
      });
      if (r.ok) {
        const data = await r.json();
        setCompletedIds(prev => new Set([...prev, questId]));
        // Success animation on button for 1.5s
        setCompletingSuccessId(questId);
        setTimeout(() => setCompletingSuccessId(null), 1500);
        // Show reward celebration via unified popup
        if (onRewardCelebration) {
          const cColor = getCompanionColor(user?.companion?.type || user?.companion?.species);
          onRewardCelebration({
            type: "companion",
            title: questTitle.length > 40 ? questTitle.slice(0, 40) + "…" : questTitle,
            xpEarned: data.xpEarned ?? data.quest?.rewards?.xp ?? 0,
            goldEarned: data.goldEarned ?? data.quest?.rewards?.gold ?? 0,
            bondXp: 1,
            loot: data.lootDrop ? { name: data.lootDrop.name, emoji: data.lootDrop.emoji, rarity: data.lootDrop.rarity } : null,
            companionAccent: cColor.accent,
            companionEmoji: user?.companion?.emoji || "🐾",
          });
        } else {
          // Fallback to local popup if no callback
          const quest = data.quest;
          setRewardPopup({
            title: questTitle.length > 40 ? questTitle.slice(0, 40) + "…" : questTitle,
            xp: quest?.rewards?.xp ?? data.xp ?? 0,
            gold: quest?.rewards?.gold ?? data.gold ?? 0,
            bondXp: 1,
            loot: data.lootDrop ? { name: data.lootDrop.name, emoji: data.lootDrop.emoji, rarity: data.lootDrop.rarity } : null,
          });
        }
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
    SFX.companionPet();
    // Always play heart animation
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 1200);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/companion/pet`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
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

  const handleUltimate = async (abilityId: string, targetQuestId?: string) => {
    if (!playerName || !apiKey || ultimateUsing) return;
    setUltimateUsing(abilityId);
    setUltimateResult(null);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/companion/ultimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
        body: JSON.stringify({ abilityId, targetQuestId }),
      });
      const d = await r.json();
      if (r.ok) {
        setUltimateResult(d.flavorText || d.message || "Success!");
        setUltimatePickQuest(false);
        setUltimateGlow(true);
        SFX.companionPet();
        setTimeout(() => setUltimateResult(null), 5000);
        setTimeout(() => setUltimateGlow(false), 4000);
        if (onUserRefresh) onUserRefresh();
      } else {
        setUltimateResult(d.error || "Error");
        setTimeout(() => setUltimateResult(null), 4000);
      }
    } catch { setUltimateResult("Network error"); setTimeout(() => setUltimateResult(null), 3000); }
    setUltimateUsing(null);
  };

  // Calculate ultimate cooldown
  const ultimateLastUsed = user?.companion?.ultimateLastUsed as string | undefined;
  const ultimateCooldownDays = 7;
  const ultimateReady = !ultimateLastUsed || (Date.now() - new Date(ultimateLastUsed).getTime()) >= ultimateCooldownDays * 24 * 60 * 60 * 1000;
  const ultimateDaysLeft = ultimateLastUsed ? Math.max(0, Math.ceil(ultimateCooldownDays - (Date.now() - new Date(ultimateLastUsed).getTime()) / (24 * 60 * 60 * 1000))) : 0;

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
          border: ultimateGlow ? "2px solid rgba(255,215,0,0.6)" : "2px solid #2a2a3e",
          boxShadow: ultimateGlow
            ? `0 0 20px rgba(255,215,0,0.35), 0 0 40px rgba(255,215,0,0.15), 0 0 60px rgba(255,215,0,0.08), inset 0 0 20px rgba(255,215,0,0.05)`
            : `inset 2px 2px 0 #0a0b10, inset -2px -2px 0 #141620, 0 0 0 5px #0c0e14, 0 0 0 7px #1e2030, 0 4px 16px rgba(0,0,0,0.7), 0 0 15px rgba(${cColor.accentRgb},0.04)`,
          borderRadius: 2,
          overflow: "visible",
          transition: "border 0.5s ease, box-shadow 1s ease",
          animation: ultimateGlow ? "ultimateBreath 2s ease-in-out infinite" : undefined,
        }}
      >
        {/* Portrait + Content layout */}
        <div style={{ display: "flex", gap: 16, padding: 16 }}>
          {/* Left: Portrait — virtual types get pixel art portrait, real pets use emoji fallback */}
          {(() => {
            const portraitSrc = getCompanionPortrait(companionType, companionName);
            const ringSize = portraitSrc ? { w: 128, h: 160 } : { w: 128, h: 160 };
            const ringPad = 5;
            const circumference = 2 * (ringSize.w + ringSize.h - 4 * 4); // approximate rect perimeter
            const isMaxBond = bondLevel >= 10;
            const portrait = portraitSrc ? (
              <img
                src={portraitSrc}
                alt={companionName}
                style={{ width: ringSize.w, height: ringSize.h, imageRendering: "auto", borderRadius: 4, border: `2px solid ${cColor.border}`, boxShadow: companionGlow ? `0 0 24px rgba(${cColor.accentRgb},0.6), 0 0 48px rgba(${cColor.accentRgb},0.3)` : `0 0 12px rgba(${cColor.accentRgb},0.15)`, flexShrink: 0, transition: "box-shadow 0.5s ease" }}
              onError={e => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div style={{
                width: ringSize.w, height: ringSize.h, borderRadius: 4,
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
            return (
              <div className={`bond-ring${isMaxBond ? " bond-max-glow" : ""}`} style={{ position: "relative", flexShrink: 0, width: ringSize.w + ringPad * 2, height: ringSize.h + ringPad * 2 }}>
                {/* Bond progress ring */}
                <svg className="bond-ring-svg" viewBox={`0 0 ${ringSize.w + ringPad * 2} ${ringSize.h + ringPad * 2}`} fill="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                  <rect x="1.5" y="1.5" width={ringSize.w + ringPad * 2 - 3} height={ringSize.h + ringPad * 2 - 3} rx="6" ry="6"
                    stroke={`rgba(${cColor.accentRgb},0.1)`} strokeWidth="2.5" fill="none" />
                  <rect x="1.5" y="1.5" width={ringSize.w + ringPad * 2 - 3} height={ringSize.h + ringPad * 2 - 3} rx="6" ry="6"
                    stroke={isMaxBond ? "#facc15" : cColor.accent} strokeWidth="2.5" fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - bondProgress)}
                    style={{ transition: "stroke-dashoffset 0.8s ease-out" }} />
                </svg>
                <div
                  style={{ position: "absolute", top: ringPad, left: ringPad, cursor: onNavigate ? "pointer" : undefined, transition: "transform 0.15s ease" }}
                  title={onNavigate ? "View companion details" : undefined}
                  onClick={onNavigate ? () => onNavigate("character") : undefined}
                  onMouseEnter={onNavigate ? (e) => { e.currentTarget.style.transform = "translateY(-2px)"; } : undefined}
                  onMouseLeave={onNavigate ? (e) => { e.currentTarget.style.transform = "translateY(0)"; } : undefined}
                >
                  {portrait}
                </div>
              </div>
            );
          })()}

          {/* Right: Name + Mood + Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title + mood on same line */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <Tip k="companions"><span style={{ color: cColor.accent, fontWeight: 600, fontSize: 14 }}>
                {companionName}&apos;s Demands
              </span></Tip>
              <span className={mood.anim} title={mood.tip} style={{ color: mood.color, fontSize: 12, flexShrink: 0 }}>
                {mood.label}
              </span>
            </div>

            {/* Flavor text / quote */}
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontStyle: "italic", marginBottom: 12 }}>
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
                      <Tip k="bond_level"><span className="text-xs" style={{ color: `rgba(${cColor.accentRgb},0.65)`, cursor: "help" }}>Bond Lv.{bondLevel} — {bondTitle}</span></Tip>
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
                          {["♥","♥","♥"].map((h, i) => (
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
                      <button onClick={handlePet} disabled={petting} className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
                        title={petting ? "Petting in progress…" : ""}
                        style={{
                        background: heartAnim ? "linear-gradient(135deg, rgba(255,107,157,0.3), rgba(255,107,157,0.15))" : "linear-gradient(135deg, rgba(255,107,157,0.12), rgba(255,107,157,0.06))",
                        color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)",
                        boxShadow: heartAnim ? "0 0 12px rgba(255,107,157,0.3)" : "0 0 6px rgba(255,107,157,0.1)",
                        cursor: petting ? "not-allowed" : "pointer",
                      }}>
                        <TipCustom title="Pet Companion" icon="🐾" accent="#a78bfa" body={<p>Give your companion a belly rub! Grants <strong>+0.5 bond XP</strong> per pet, up to <strong>2x per day</strong>.</p>}>
                          <span>🐾 Pet</span>
                        </TipCustom>
                      </button>
                      <span className="text-xs" style={{ color: "rgba(255,107,157,0.5)", whiteSpace: "nowrap" }}>
                        {petsToday !== null ? petsToday : (user?.companion?.petDateStr === new Date().toISOString().slice(0, 10) ? (user?.companion?.petCountToday ?? 0) : 0)}/2 belly rubs today
                      </span>

                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Companion Ultimate ─── */}
            {bondLevel >= 5 && playerName && apiKey && (
              <div style={{
                background: "#0e1018",
                border: "1px solid #1a1c28",
                borderTop: `1px solid rgba(${cColor.accentRgb},0.35)`,
                borderRadius: 2,
                padding: "8px 10px",
                marginBottom: 10,
              }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: `rgba(${cColor.accentRgb},0.6)` }}>Ultimate</span>
                  {!ultimateReady && (
                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                      Cooldown: {ultimateDaysLeft}d
                    </span>
                  )}
                </div>
                {ultimateResult && (
                  <div className="rounded px-2.5 py-1.5 text-xs font-semibold mb-2" style={{
                    background: `rgba(${cColor.accentRgb},0.08)`,
                    border: `1px solid rgba(${cColor.accentRgb},0.2)`,
                    color: cColor.accent,
                  }}>
                    {ultimateResult}
                  </div>
                )}
                {/* Quest picker for instant_complete */}
                {ultimatePickQuest && dobbieQuests && dobbieQuests.length > 0 && (
                  <div className="mb-2 space-y-1">
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Choose a quest:</p>
                    {dobbieQuests.filter(q => !completedIds.has(q.id)).map(q => (
                      <button key={q.id} onClick={() => handleUltimate("instant_complete", q.id)} disabled={!!ultimateUsing}
                        className="w-full text-left text-xs px-2 py-1.5 rounded" style={{
                          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#f0d0c0",
                          cursor: ultimateUsing ? "not-allowed" : "pointer",
                        }}
                        title={ultimateUsing ? "Using ultimate\u2026" : undefined}>
                        {q.title}
                      </button>
                    ))}
                    <button onClick={() => setUltimatePickQuest(false)} className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Cancel</button>
                  </div>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { id: "instant_complete", label: "Instant", desc: `${companionName} completes a quest`, icon: "◆", needsQuest: true },
                    { id: "double_reward", label: "2x Loot", desc: "Next quest doubled", icon: "✨", needsQuest: false },
                    { id: "streak_extend", label: "+3 Streak", desc: "Extend streak", icon: "🔥", needsQuest: false },
                  ].map(ult => (
                    <button
                      key={ult.id}
                      onClick={() => {
                        if (ult.needsQuest) { setUltimatePickQuest(true); }
                        else handleUltimate(ult.id);
                      }}
                      disabled={!ultimateReady || !!ultimateUsing}
                      title={ultimateUsing ? "Using ultimate..." : !ultimateReady ? `Ultimate on cooldown (${ultimateDaysLeft}d left)` : ult.desc}
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg font-semibold transition-all text-center"
                      style={{
                        background: ultimateReady ? `rgba(${cColor.accentRgb},0.1)` : "rgba(255,255,255,0.02)",
                        color: ultimateReady ? cColor.accent : "rgba(255,255,255,0.15)",
                        border: `1px solid ${ultimateReady ? `rgba(${cColor.accentRgb},0.25)` : "rgba(255,255,255,0.05)"}`,
                        cursor: ultimateReady ? "pointer" : "not-allowed",
                        minWidth: 70,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{ult.icon}</span>
                      <br />
                      {ultimateUsing === ult.id ? "..." : ult.label}
                    </button>
                  ))}
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
                            <span className="font-mono" style={{ fontSize: "0.75rem", color: "rgba(255,107,157,0.6)" }}>{q.rewards?.xp ?? 0} XP</span>
                            <span className="font-mono" style={{ fontSize: "0.75rem", color: "rgba(251,191,36,0.75)" }}>{q.rewards?.gold ?? 0}g</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs uppercase font-mono" style={{ color: "rgba(255,107,157,0.5)", letterSpacing: "0.06em" }}>{rarity}</span>
                            {apiKey && (
                              <button
                                onClick={() => handleCompleteQuest(q.id, q.title)}
                                disabled={!!completingId || done}
                                title={completingId ? "Action in progress\u2026" : "Mark quest complete"}
                                style={{
                                  width: 24, height: 24, borderRadius: "50%",
                                  border: done || completingSuccessId === q.id ? "1.5px solid #4ade80" : "1.5px solid rgba(255,107,157,0.4)",
                                  background: completingSuccessId === q.id ? "rgba(34,197,94,0.7)" : done ? "rgba(34,197,94,0.15)" : "rgba(255,107,157,0.08)",
                                  color: done || completingSuccessId === q.id ? "#4ade80" : "#a78bfa",
                                  cursor: (completingId || done) ? "not-allowed" : "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
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
            {earnedCompanions.length > 0 && (
              <div className="grid mt-2" style={{ gridTemplateColumns: `repeat(${Math.min(earnedCompanions.length, 3)}, 1fr)`, gap: 6 }}>
                {earnedCompanions.map(c => {
                  const meta = COMPANION_META_ALL[c.id];
                  return (
                    <div key={c.id} className="flex flex-col items-center gap-1.5 py-2.5 px-2" style={{
                      background: "#0e1018",
                      border: "1px solid #1a1c28",
                      borderTop: "1px solid rgba(167,139,250,0.25)",
                      borderRadius: 6,
                    }}>
                      {meta?.icon && (
                        <img src={meta.icon} alt={meta.name} style={{ width: 48, height: 48, imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                      )}
                      <span className="text-xs font-semibold text-center" style={{ color: "#c4b5fd", lineHeight: 1.2 }}>{meta?.name ?? c.name}</span>
                      <span className="text-xs font-mono" style={{ color: "rgba(167,139,250,0.4)" }}>+2% XP</span>
                    </div>
                  );
                })}
              </div>
            )}

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
