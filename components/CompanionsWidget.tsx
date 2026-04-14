"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useModalBehavior } from "@/components/ModalPortal";
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
  ember_sprite: { name: "Ember Sprite", quote: "The forge burns because you keep it lit.", icon: "/images/icons/mini-ember-sprite.png" },
  lore_owl:     { name: "Lore Owl",     quote: "Knowledge is power, adventurer.",         icon: "/images/icons/mini-lore-owl.png" },
  gear_golem:   { name: "Gear Golem",   quote: "Efficiency is the path to glory.",        icon: "/images/icons/mini-gear-golem.png" },
};
// Companion quotes by type category — shown in the widget next to companion portrait.
// Separate pool from DailyHub quotes so the same companion shows different text in different places.
const COMPANION_QUOTES: Record<string, string[]> = {
  cat: [
    "{name} stares at you. Then at the quest board. Then back at you. The message is clear.",
    "{name} has knocked three items off your desk. Coincidentally, all were excuses.",
    "{name} is asleep on your quest list. This is either a statement or a nap. Possibly both.",
    "{name} approves of your progress. {name} also approves of snacks. The priorities are unclear.",
    "{name} yawns. Not because you're boring — because judging you is exhausting work.",
    "{name} pushed your water glass to the edge of the table. A reminder that everything is temporary.",
    "{name} sat on your keyboard. The result was more productive than yesterday.",
    "{name} brought you a dead mouse. As a metaphor.",
    "{name} purrs when you're trying to focus. Coincidence is for amateurs.",
    "{name} claims the sunny spot. Strategy, not laziness. There's a difference. Apparently.",
    "{name} watched a bird for three hours. Research, not procrastination.",
    "{name} turned its back to you. In cat culture, this IS the greeting.",
    "{name} knocked a pen off the desk. Then watched it fall. Physics experiment complete.",
    "{name} occupied the exact center of your workspace. Territorial disputes are won by sitting.",
    "{name} made biscuits on your lap. Not affection. Dough practice. The bakery never opened.",
  ],
  dog: [
    "{name} brought you a quest. It's slightly chewed, but the intent is pure.",
    "{name} is spinning in circles. This is either excitement or a navigation error.",
    "{name} has faith in you. Unconditional, unearned, and frankly a little suspicious.",
    "{name} sat down next to your quest board. Someone has to guard it from procrastination.",
    "{name} tilts head. The head-tilt is not confusion — it's polite disappointment.",
    "{name} fetched your to-do list. It came back wetter. Some items are illegible. Probably the hard ones.",
    "{name} barked at the screen. Not a bug report. More of a general protest.",
    "{name} rolled over. Not for belly rubs — for dramatic emphasis.",
    "{name} dug a hole in the garden. For your excuses. It's quite deep now.",
    "{name} put a paw on your hand. Not affection. Intervention.",
    "{name} brought the leash. In {name}'s mouth. Drooling. The walk is happening. Quests can wait. (They can't.)",
    "{name} ate something unidentified. Seemed happy about it. The bar for joy is refreshingly low.",
    "{name} pressed its nose against the window. Writing a novel. In fog.",
    "{name} heard 'walk' and forgot gravity exists for a moment.",
    "{name} is lying on your feet. Warm. Heavy. An anchor. Against everything except deadlines.",
  ],
  dragon: [
    "{name} breathed on your coffee. It's warm now. You're welcome.",
    "{name} burned your excuses. Literally. The desk is fine. Mostly.",
    "{name} is not impressed. {name} is never impressed. That's the point.",
    "{name} set the quest board on fire. Slow news day.",
    "{name} hoards gold. You hoard unfinished quests. One of you has better priorities.",
    "{name} scorched the ceiling. The ceiling was asking for it.",
    "{name} exhaled smoke at your gear score. Not fire — disappointment has a lower temperature.",
    "{name} curled around your quest list protectively. Not because it's valuable. Because it's flammable.",
    "{name} tried to eat the forge. Grimvar was not amused. {name} was not sorry.",
    "{name} sneezed. Three tapestries are gone. A productive sneeze.",
    "{name} considered your streak. Exhaled warmth. Approval is thermonuclear.",
    "{name} looked at the Rift. The Rift looked away first.",
    "{name} found your old gear. Melted it. Called it 'decluttering.'",
    "{name} perched on the roof. The whole floor is warm now.",
    "{name} landed. The architecture adjusted. Involuntarily.",
  ],
  owl: [
    "{name} read three books while you slept. {name} has thoughts.",
    "{name} hooted at 3 AM. It was wisdom. You weren't listening.",
    "{name} arranged your quests by priority. Silently. Judgmentally.",
    "{name} blinked twice. In owl language, that's a thesis statement.",
    "{name} organized your inventory by disappointment level.",
    "{name} rotated its head 270 degrees to look at your log. The extra 90 were editorial.",
    "{name} found an error in your math. Didn't correct it. Wants to see how this plays out.",
    "{name} is perched on the highest shelf. For perspective. On your choices.",
    "{name} filed your achievements chronologically. The gaps are noted.",
    "{name} knows your password. Because you say it out loud every time.",
    "{name} counted your quests. Then your excuses. The second number was higher.",
    "{name} brought you a pellet. It contained the remains of your last excuse.",
    "{name} prefers silence. Everything has been said. You weren't listening.",
    "{name} wrote you a note. It says 'Adequate.' This is generous.",
    "{name} stayed up researching. The conclusion: you should have started earlier.",
  ],
  phoenix: [
    "{name} died yesterday. {name} got better. Your excuses can too.",
    "{name} is on fire. As usual. It's a lifestyle, not a problem.",
    "Yesterday was yesterday. {name} already forgot it. Literally.",
    "{name} burst into flames at breakfast. The toast was ruined. {name} was fine.",
    "{name} has died 347 times. Still shows up.",
    "{name} rose from the ashes. Again. The ashes file their own paperwork now.",
    "{name} doesn't understand 'giving up'. The concept doesn't translate.",
    "{name} set the curtains on fire. By existing. The landlord stopped sending invoices.",
    "Every morning {name} chooses violence. Against entropy.",
    "{name} has no concept of failure. Only dramatic pauses between successes.",
    "{name} warmed your chair. From the inside. The upholstery changed color.",
    "{name} sneezed embers. The bookshelf is fine. The bookmark is a legend.",
    "{name} winked. While on fire. Style points aren't awarded. But if they were.",
    "{name} tried to take a bath. The water evaporated. {name} considers this success.",
    "{name} watched you fail. Caught fire. Secondhand embarrassment is exothermic.",
  ],
  wolf: [
    "{name} howled at the moon. The neighbors disagree it was motivational.",
    "{name} is tracking your progress. A very patient hunter.",
    "{name} doesn't do pep talks. {name} does silent, intense staring.",
    "{name} circled three times before lying down. Not comfort — perimeter check.",
    "{name} sniffed the air. Smells like unfinished quests. And rain.",
    "{name} growled at your notifications. Low. Sustained.",
    "{name} brought you a stick. Not a gift. A weapon. For today.",
    "{name} is not your friend. {name} is your ally. The difference matters at 3 AM.",
    "{name} heard a twig snap. Stood guard for six hours. It was the wind.",
    "{name} sleeps with one eye open. Aimed at your quest list.",
    "{name} disappeared for three days. Came back with a scar and better gear.",
    "{name} formed a hierarchy. You are third. After {name} and {name}'s shadow.",
    "{name} protected your campfire all night. The forge metaphor writes itself.",
    "{name} sat in the rain without flinching. You complain about cold coffee.",
    "{name} doesn't fetch. {name} hunts. If you want fetch, get a dog.",
  ],
  fox: [
    "{name} found a shortcut. It's probably a trap. {name} took it anyway.",
    "{name} suggests a creative approach. 'Creative' is doing a lot of work there.",
    "{name} grinned. Foxes always grin. It's unsettling.",
    "{name} stole your socks. Not useful. Just yours.",
    "{name} rearranged your inventory. Everything works better. Somehow.",
    "{name} whispered to the NPC. Prices dropped. {name} won't explain.",
    "{name} has seven plans. Plan G is illegal. Plan D works. Always starts with A.",
    "{name} opened a locked door. Without a key. Context is for other animals.",
    "{name} tilts its head when you decide things. Not curiosity. Disbelief.",
    "{name} snuck into the Forge. Came back with better gear. No details.",
    "{name} hid your keys. Behavioral experiment. You passed. Barely.",
    "{name} counted your gold. Twice. Both numbers were different. Both correct.",
    "{name} pretended to sleep. Stole your sandwich. Espionage has many forms.",
    "{name} is not sneaky. {name} is 'efficient with visibility.'",
    "{name} made friends with the NPC. Got a discount. Won't explain how.",
  ],
  bear: [
    "{name} woke up. This is a bigger deal than you think.",
    "{name} punched a tree. For motivation. The tree had it coming.",
    "{name} is here. {name} is large. Believes in you. Aggressively.",
    "{name} sat on your quest log. Literally. It's flat now.",
    "{name} looked at the Rift. The Rift looked away first.",
    "{name} ate breakfast. All of it. Yours too. Lesson: preparedness.",
    "{name} tried to fit through a doorway. Modified the doorway.",
    "{name} gave you a look that said: 'I could solve everything. But then you wouldn't learn.'",
    "{name} stood on hind legs. Not to intimidate — to see your quest board. Intimidation was free.",
    "{name} is quiet today. Not calm. Loading.",
    "{name} caught a fish. Ate it raw. Looked at your toast. Judgment was mutual.",
    "{name} hugged you. Gently by bear standards. You couldn't breathe for thirty seconds.",
    "{name} napped for six hours. Woke up stronger. You napped for twenty minutes. Woke up confused.",
    "{name} made a noise science hasn't named. You felt it in your bones.",
    "{name} is protecting you. From everything. Especially your own decisions.",
  ],
  digital: [
    "{name} ran the numbers. The numbers suggest more quests.",
    "{name} has been awake for 72 hours. {name} doesn't understand your concept of 'breaks'.",
    "{name} scanned the horizon. Found problems. Also solutions. Mostly problems.",
    "Systems nominal. Motivation levels... {name} declines to comment.",
    "{name} calculated the optimal path forward. It starts with standing up.",
    "{name} compiled your excuses into a report. The report is 47 pages. Single-spaced.",
    "{name} ran a diagnostic on your productivity. Results: inconclusive. Charitably.",
    "{name} updated its firmware overnight. You updated nothing.",
    "{name} has a 99.7% success rate. You are the 0.3%.",
    "{name} generated a motivational message, analyzed it, and deleted it.",
    "{name} optimized your quest order. Estimated time saved: 4 minutes. {name} is proud. You are unimpressed. {name} is right.",
    "{name} detected an anomaly in your schedule. The anomaly is called 'free time.' {name} has recommendations.",
    "{name} ran a simulation of your day. Best case: productive. Worst case: current trajectory.",
    "{name} archived your browser history. Not for blackmail. For analysis. The result was a pie chart. The chart is mostly red.",
    "{name} sent you a reminder. Then a follow-up. Then a summary of why reminders are necessary. The meta-reminder is the cruelest one.",
  ],
  default: [
    "{name} watches you with an expression that's somewhere between hope and concern.",
    "{name} nudges the quest board. Subtlety has never been {name}'s strength.",
    "{name} made a list of things you should do today. It's longer than yours.",
    "{name} is waiting. Patiently. The patience is aggressive.",
    "{name} looked at your streak counter and said nothing. The silence was deafening.",
    "{name} is here. Your excuses are not. One of you showed up.",
    "{name} tilted its head. Not curiosity. Slow, theatrical disbelief.",
    "{name} glanced at the clock. Then at you. The math was unflattering.",
    "{name} made a sound. Not words. Something between a sigh and a verdict.",
    "{name} moved closer. Not for comfort. For accountability. Proximity is a tactic.",
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
  const closeRewardPopup = useCallback(() => setRewardPopup(null), []);
  useModalBehavior(!!rewardPopup, closeRewardPopup);

  // ─── Timeout refs for cleanup on unmount ─────────────────────────────────
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const safeTimeout = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timeoutRefs.current.push(id);
    return id;
  }, []);
  useEffect(() => {
    return () => { timeoutRefs.current.forEach(clearTimeout); };
  }, []);

  // ─── Companion Expedition State ───────────────────────────────────────────
  const [expeditionData, setExpeditionData] = useState<{
    active: { expeditionId: string; name: string; icon: string; sentAt: string; completesAt: string; remainingMs: number; completed: boolean } | null;
    available: { id: string; name: string; description: string; durationHours: number; icon: string; rewards: { gold?: number[]; essenz?: number[]; runensplitter?: number[]; materials?: { chance: number; count: number[] }; gems?: { chance: number; maxTier: number }; rareItem?: { chance: number } } }[];
    cooldownRemainingMs: number;
    bondLevel: number;
    bondMultiplier: number;
  } | null>(null);
  const [expeditionLoading, setExpeditionLoading] = useState(false);
  const [expeditionInitialLoading, setExpeditionInitialLoading] = useState(true);
  const [expeditionTimer, setExpeditionTimer] = useState<string | null>(null);
  const [expeditionTimerProgress, setExpeditionTimerProgress] = useState(0);
  const [expeditionSending, setExpeditionSending] = useState<string | null>(null);
  const [expeditionCollecting, setExpeditionCollecting] = useState(false);
  const [expeditionError, setExpeditionError] = useState<string | null>(null);
  const [expeditionConfirm, setExpeditionConfirm] = useState<{ id: string; name: string; hours: number } | null>(null);
  const [lastExpeditionTier, setLastExpeditionTier] = useState<string | null>(null);

  const fetchExpeditions = useCallback(async () => {
    if (!playerName || !apiKey || !user?.companion) { setExpeditionInitialLoading(false); return; }
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/companion/expeditions`, {
        headers: { ...getAuthHeaders(apiKey) },
      });
      if (r.ok) {
        const data = await r.json();
        setExpeditionData(data);
      }
    } catch { /* silent */ } finally {
      setExpeditionInitialLoading(false);
    }
  }, [playerName, apiKey, user?.companion]);

  // Fetch expedition data on mount and when companion changes
  useEffect(() => {
    fetchExpeditions();
  }, [fetchExpeditions]);

  // Expedition countdown timer
  useEffect(() => {
    if (!expeditionData?.active) { setExpeditionTimer(null); setExpeditionTimerProgress(0); return; }
    const endTime = new Date(expeditionData.active.completesAt).getTime();
    const startTime = new Date(expeditionData.active.sentAt).getTime();
    const totalDuration = endTime - startTime;
    const tick = () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        setExpeditionTimer("Ready");
        setExpeditionTimerProgress(1);
        return;
      }
      const elapsed = Date.now() - startTime;
      setExpeditionTimerProgress(Math.min(1, elapsed / totalDuration));
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setExpeditionTimer(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expeditionData?.active]);

  const handleExpeditionSend = async (expeditionId: string) => {
    if (!playerName || !apiKey || expeditionSending) return;
    setExpeditionSending(expeditionId);
    setExpeditionError(null);
    setExpeditionConfirm(null);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/companion/expedition/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
        body: JSON.stringify({ expeditionId }),
      });
      const d = await r.json();
      if (r.ok) {
        setLastExpeditionTier(expeditionId);
        await fetchExpeditions();
        if (onUserRefresh) onUserRefresh();
      } else {
        setExpeditionError(d.error || "Failed to send companion");
        safeTimeout(() => setExpeditionError(null), 5000);
      }
    } catch {
      setExpeditionError("Network error");
      safeTimeout(() => setExpeditionError(null), 5000);
    }
    setExpeditionSending(null);
  };

  const handleExpeditionCollect = async () => {
    if (!playerName || !apiKey || expeditionCollecting) return;
    setExpeditionCollecting(true);
    setExpeditionError(null);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/companion/expedition/collect`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
      });
      const d = await r.json();
      if (r.ok) {
        // Show reward celebration
        if (onRewardCelebration && d.rewards) {
          const cCol = getCompanionColor(user?.companion?.type || user?.companion?.species);
          const rewardLines: string[] = [];
          if (d.rewards.gold) rewardLines.push(`+${d.rewards.gold} Gold`);
          if (d.rewards.essenz) rewardLines.push(`+${d.rewards.essenz} Essenz`);
          if (d.rewards.runensplitter) rewardLines.push(`+${d.rewards.runensplitter} Runensplitter`);
          onRewardCelebration({
            type: "companion",
            title: `${d.expedition || "Expedition"} Complete`,
            xpEarned: 0,
            goldEarned: d.rewards.gold || 0,
            bondXp: 0,
            loot: d.rewards.rareItem ? { name: d.rewards.rareItem.name, emoji: "◆", rarity: d.rewards.rareItem.rarity } :
                  d.rewards.gem ? { name: `${d.rewards.gem.name} (T${d.rewards.gem.tier})`, emoji: "◆", rarity: "rare" } :
                  d.rewards.materials?.length ? { name: `${d.rewards.materials.length} Materials`, emoji: "◆", rarity: "uncommon" } : null,
            companionAccent: cCol.accent,
            companionEmoji: user?.companion?.emoji || "◆",
          });
        }
        setCompanionGlow(true);
        safeTimeout(() => setCompanionGlow(false), 2000);
        await fetchExpeditions();
        if (onUserRefresh) onUserRefresh();
      } else {
        setExpeditionError(d.error || "Failed to collect");
        safeTimeout(() => setExpeditionError(null), 5000);
      }
    } catch {
      setExpeditionError("Network error");
      safeTimeout(() => setExpeditionError(null), 5000);
    }
    setExpeditionCollecting(false);
  };

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
        safeTimeout(() => setCompletingSuccessId(null), 1500);
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
        safeTimeout(() => setCompanionGlow(false), 2000);
        safeTimeout(() => {
          setCompletedIds(prev => { const s = new Set(prev); s.delete(questId); return s; });
          if (onUserRefresh) onUserRefresh();
        }, 2000);
      }
    } catch { setPetError("Network error"); safeTimeout(() => setPetError(""), 3000); }
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
    mood = { label: "Sleeping", color: "#818cf8", tip: "Your companion is resting. Come back in the morning.", anim: "" };
  } else if (streak >= 7 && petRecent && bondLevel >= 5) {
    mood = { label: "Ecstatic", color: "#f472b6", tip: "Your companion is thrilled. Suspiciously so.", anim: "animate-bounce" };
  } else if (streak >= 7 && petRecent) {
    mood = { label: "Happy", color: "#22c55e", tip: "The streak continues. So does the bond.", anim: "animate-bounce" };
  } else if (streak >= 3 || petRecent) {
    mood = { label: "Neutral", color: "#f59e0b", tip: "Complete quests. They notice.", anim: "" };
  } else if (!petRecent && hoursSincePet > 72) {
    mood = { label: "Neglected", color: "#dc2626", tip: "Your companion misses you. Pet them.", anim: "animate-pulse" };
  } else {
    mood = { label: "Sad", color: "#ef4444", tip: "Your companion misses you.", anim: "animate-pulse" };
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
    safeTimeout(() => setHeartAnim(false), 1200);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/companion/pet`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
      });
      const d = await r.json();
      if (r.ok) {
        setPetsToday(d.petsToday ?? null);
        // Celebration for bond level-up
        if (d.bondLevelUp && onRewardCelebration) {
          const cCol = getCompanionColor(user?.companion?.type || user?.companion?.species);
          onRewardCelebration({
            type: "companion",
            title: `Bond Level ${d.bondLevelUp}!`,
            xpEarned: 0,
            goldEarned: 0,
            bondXp: 0,
            loot: null,
            companionAccent: cCol.accent,
            companionEmoji: user?.companion?.emoji || "◆",
          });
        }
        if (onUserRefresh) onUserRefresh();
      } else {
        setPetError(d.error || "Error");
        safeTimeout(() => setPetError(""), 3000);
      }
    } catch { setPetError("Error"); safeTimeout(() => setPetError(""), 3000); }
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
        setUltimateResult(d.flavorText || d.message || "Done.");
        setUltimatePickQuest(false);
        setUltimateGlow(true);
        SFX.companionPet();
        safeTimeout(() => setUltimateResult(null), 5000);
        safeTimeout(() => setUltimateGlow(false), 4000);
        if (onUserRefresh) onUserRefresh();
      } else {
        setUltimateResult(d.error || "Error");
        safeTimeout(() => setUltimateResult(null), 4000);
      }
    } catch { setUltimateResult("Network error"); safeTimeout(() => setUltimateResult(null), 3000); }
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
              <div className={`bond-ring${isMaxBond ? " bond-max-glow" : ""}${bondLevel >= 7 ? " bond-aura-legendary" : bondLevel >= 5 ? " bond-aura-strong" : bondLevel >= 3 ? " bond-aura-medium" : ""}`} style={{ position: "relative", flexShrink: 0, width: ringSize.w + ringPad * 2, height: ringSize.h + ringPad * 2 }}>
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
                    <div className="progress-bar-diablo mt-1" style={{ height: 3, borderRadius: 2 }}>
                      <div className="progress-bar-diablo-fill" style={{ width: `${bondProgress * 100}%`, background: `linear-gradient(90deg, ${cColor.accent}, ${cColor.accent}99)` }} />
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
                        title={petting ? "Petting in progress…" : (petsToday !== null && petsToday >= 2) ? "Your companion purrs contentedly (no bond XP — limit 2/day)" : "Give a belly rub (+0.5 Bond XP)"}
                        style={{
                        background: heartAnim ? "linear-gradient(135deg, rgba(255,107,157,0.3), rgba(255,107,157,0.15))" : "linear-gradient(135deg, rgba(255,107,157,0.12), rgba(255,107,157,0.06))",
                        color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)",
                        boxShadow: heartAnim ? "0 0 12px rgba(255,107,157,0.3)" : "0 0 6px rgba(255,107,157,0.1)",
                        cursor: petting ? "not-allowed" : "pointer",
                      }}>
                        <TipCustom title="Pet Companion" icon="●" accent="#a78bfa" body={<p>Give your companion a belly rub! Grants <strong>+0.5 bond XP</strong> per pet, up to <strong>2x per day</strong>.{petsToday != null && <> Today: {petsToday}/2</>}{petsToday !== null && petsToday >= 2 && <br />}<em>{petsToday !== null && petsToday >= 2 ? "You can still pet — your companion loves it!" : ""}</em></p>}>
                          <span>{petting ? "..." : `Pet${petsToday != null && petsToday < 2 && petsToday > 0 ? ` (${2 - petsToday})` : ""}`}</span>
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
                    { id: "instant_complete", label: "Instant", desc: `${companionName} completes a quest`, icon: "/images/icons/ult-instant.png", needsQuest: true },
                    { id: "double_reward", label: "2x Loot", desc: "Next quest doubled", icon: "/images/icons/ult-double.png", needsQuest: false },
                    { id: "streak_extend", label: "+3 Streak", desc: "Extend streak", icon: "/images/icons/ult-streak.png", needsQuest: false },
                  ].map(ult => (
                    <button
                      key={ult.id}
                      onClick={() => {
                        if (ult.needsQuest) { setUltimatePickQuest(true); }
                        else handleUltimate(ult.id);
                      }}
                      disabled={!ultimateReady || !!ultimateUsing}
                      title={ultimateUsing ? "Using ultimate..." : !ultimateReady ? `Ultimate on cooldown (${ultimateDaysLeft}d left)` : ult.desc}
                      className={`flex-1 text-xs px-2 py-1.5 rounded-lg font-semibold transition-all text-center${ultimateReady && !ultimateUsing ? " claimable-breathe" : ""}`}
                      style={{
                        background: ultimateReady ? `rgba(${cColor.accentRgb},0.1)` : "rgba(255,255,255,0.02)",
                        color: ultimateReady ? cColor.accent : "rgba(255,255,255,0.15)",
                        border: `1px solid ${ultimateReady ? `rgba(${cColor.accentRgb},0.25)` : "rgba(255,255,255,0.05)"}`,
                        cursor: ultimateReady ? "pointer" : "not-allowed",
                        minWidth: 70,
                      }}
                    >
                      {ult.icon.startsWith("/") ? <img src={ult.icon} alt="" width={20} height={20} className="mx-auto img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /> : <span style={{ fontSize: 14 }}>{ult.icon}</span>}
                      <br />
                      {ultimateUsing === ult.id ? "..." : ult.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Locked ultimate teaser for players below bond level 5 */}
            {bondLevel < 5 && (
              <div style={{
                background: "#0e1018",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 2,
                padding: "8px 10px",
                marginBottom: 10,
                opacity: 0.45,
              }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 16, filter: "grayscale(1)" }}>◆</span>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Ultimate Ability</span>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Unlocks at Bond Level 5 ({5 - bondLevel} levels away)</p>
                  </div>
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
                          {flavorText && <p className="text-sm italic mt-1" style={{ color: "rgba(220,185,120,0.4)" }}>{flavorText}</p>}
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
                Complete achievements to unlock more companions.
              </p>
            )}

            {/* ─── Companion Expeditions skeleton ─── */}
            {user?.companion && playerName && apiKey && expeditionInitialLoading && (
              <div style={{ background: "#0e1018", border: "1px solid #1a1c28", borderRadius: 2, padding: "8px 10px", marginTop: 10 }}>
                <div className="skeleton-pulse h-3 w-32 rounded mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="skeleton-pulse h-12 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
              </div>
            )}

            {/* ─── Companion Expeditions ─── */}
            {user?.companion && playerName && apiKey && !expeditionInitialLoading && expeditionData && (
              <div className="tab-content-enter" style={{
                background: "#0e1018",
                border: "1px solid #1a1c28",
                borderTop: `1px solid rgba(${cColor.accentRgb},0.25)`,
                borderRadius: 2,
                padding: "8px 10px",
                marginTop: 10,
              }}>
                <div className="flex items-center justify-between mb-2">
                  <Tip k="companion_expedition">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: `rgba(${cColor.accentRgb},0.6)` }}>
                      Companion Expeditions
                    </span>
                  </Tip>
                  {expeditionData.bondMultiplier > 1 && (
                    <TipCustom title="Bond Multiplier" accent={cColor.accent} body={<p className="text-xs">Your companion&apos;s bond level boosts expedition gold rewards by <strong>{Math.round((expeditionData.bondMultiplier - 1) * 100)}%</strong>. Increase bond level for bigger bonuses.</p>}>
                      <span className="text-xs font-mono cursor-help px-1.5 py-0.5 rounded" style={{ color: cColor.accent, background: `${cColor.accent}12`, border: `1px solid ${cColor.accent}25` }}>
                        Bond x{expeditionData.bondMultiplier.toFixed(1)}
                      </span>
                    </TipCustom>
                  )}
                </div>

                {/* Error display */}
                {expeditionError && (
                  <div className="rounded px-2.5 py-1.5 text-xs font-semibold mb-2" style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#ef4444",
                  }}>
                    {expeditionError}
                  </div>
                )}

                {/* Active expedition */}
                {expeditionData.active && (
                  <div style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 2,
                    padding: "8px 10px",
                  }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: "#f0e0d0" }}>
                        {expeditionData.active.name}
                      </span>
                      <span className="text-xs font-mono" style={{
                        color: expeditionTimer === "Ready" ? "#4ade80" : "rgba(255,255,255,0.4)",
                        fontWeight: expeditionTimer === "Ready" ? 700 : 400,
                      }}>
                        {expeditionTimer || "..."}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="progress-bar-diablo mb-2" style={{ height: 7 }}>
                      <div style={{
                        height: "100%",
                        width: `${expeditionTimerProgress * 100}%`,
                        background: expeditionTimer === "Ready"
                          ? "linear-gradient(90deg, #22c55e, #4ade80)"
                          : `linear-gradient(90deg, ${cColor.accent}, ${cColor.accent}99)`,
                        borderRadius: "inherit",
                        transition: "width 1s linear",
                      }} />
                    </div>
                    {/* Collect button when ready */}
                    {expeditionTimer === "Ready" && (
                      <button
                        onClick={handleExpeditionCollect}
                        disabled={expeditionCollecting}
                        className={`w-full text-xs px-3 py-2 rounded font-semibold transition-all${!expeditionCollecting ? " claimable-breathe" : ""}`}
                        title={expeditionCollecting ? "Collecting rewards..." : "Collect expedition rewards"}
                        style={{
                          background: expeditionCollecting ? "rgba(34,197,94,0.08)" : "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.08))",
                          color: "#4ade80",
                          border: "1px solid rgba(34,197,94,0.35)",
                          cursor: expeditionCollecting ? "not-allowed" : "pointer",
                          boxShadow: "0 0 12px rgba(34,197,94,0.15)",
                        }}
                      >
                        {expeditionCollecting ? "Collecting..." : "Collect Rewards"}
                      </button>
                    )}
                  </div>
                )}

                {/* Cooldown display */}
                {!expeditionData.active && expeditionData.cooldownRemainingMs > 0 && (
                  <div className="text-xs text-center py-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Your companion is resting. Available in {Math.ceil(expeditionData.cooldownRemainingMs / 60000)} minutes.
                  </div>
                )}

                {/* Send Again shortcut (after cooldown, if last tier known) */}
                {!expeditionData.active && expeditionData.cooldownRemainingMs <= 0 && lastExpeditionTier && !expeditionConfirm && (() => {
                  const lastExp = expeditionData.available?.find((e: { id: string }) => e.id === lastExpeditionTier);
                  if (!lastExp) return null;
                  return (
                    <button
                      onClick={() => setExpeditionConfirm({ id: lastExp.id, name: lastExp.name, hours: lastExp.durationHours })}
                      className="w-full text-xs px-3 py-2 rounded font-semibold mb-2"
                      style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)", cursor: "pointer" }}
                    >
                      Send Again: {lastExp.name} ({lastExp.durationHours}h)
                    </button>
                  );
                })()}

                {/* Confirm dialog */}
                {expeditionConfirm && (
                  <div className="rounded p-3 mb-2" style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Your companion won&apos;t earn bond XP while away. Send for {expeditionConfirm.hours}h?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExpeditionSend(expeditionConfirm.id)}
                        disabled={!!expeditionSending}
                        className="flex-1 text-xs px-2 py-1.5 rounded font-semibold"
                        style={{
                          background: `rgba(${cColor.accentRgb},0.12)`,
                          color: cColor.accent,
                          border: `1px solid rgba(${cColor.accentRgb},0.3)`,
                          cursor: expeditionSending ? "not-allowed" : "pointer",
                        }}
                        title={expeditionSending ? "Sending..." : undefined}
                      >
                        {expeditionSending ? "Sending..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setExpeditionConfirm(null)}
                        className="flex-1 text-xs px-2 py-1.5 rounded font-semibold"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          color: "rgba(255,255,255,0.4)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Expedition tier selection */}
                {!expeditionData.active && expeditionData.cooldownRemainingMs <= 0 && !expeditionConfirm && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {expeditionData.available.map((exp) => {
                      const tierColors: Record<string, { accent: string; bg: string; border: string }> = {
                        "quick-forage":   { accent: "#22c55e", bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.2)" },
                        "deep-woods":     { accent: "#3b82f6", bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.2)" },
                        "mountain-pass":  { accent: "#a855f7", bg: "rgba(168,85,247,0.06)", border: "rgba(168,85,247,0.2)" },
                        "ancient-ruins":  { accent: "#f97316", bg: "rgba(249,115,22,0.06)", border: "rgba(249,115,22,0.2)" },
                      };
                      const tc = tierColors[exp.id] || tierColors["quick-forage"];
                      const isSending = expeditionSending === exp.id;
                      return (
                        <div
                          key={exp.id}
                          className="crystal-breathe flex flex-col rounded"
                          style={{
                            background: tc.bg,
                            border: `1px solid ${tc.border}`,
                            borderTop: `2px solid ${tc.accent}`,
                            padding: "8px 8px 6px",
                            minHeight: 70,
                            "--glow-color": `${tc.accent}33`,
                          } as React.CSSProperties}
                        >
                          <span className="text-xs font-bold mb-0.5" style={{ color: tc.accent, lineHeight: 1.2 }}>
                            {exp.name}
                          </span>
                          <span className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.2)", lineHeight: 1.2 }}>
                            {exp.description}
                          </span>
                          <span className="text-xs font-mono mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                            {exp.durationHours}h
                          </span>
                          {exp.rewards.gold && (
                            <span className="text-xs mb-1.5" style={{ color: "rgba(251,191,36,0.55)" }}>
                              {exp.rewards.gold[0]}-{exp.rewards.gold[1]}g
                            </span>
                          )}
                          <button
                            onClick={() => setExpeditionConfirm({ id: exp.id, name: exp.name, hours: exp.durationHours })}
                            disabled={isSending || !!expeditionSending}
                            className="text-xs px-2 py-1.5 rounded font-semibold mt-auto transition-all"
                            title={isSending ? "Sending..." : expeditionSending ? "Another expedition is being sent..." : `Send companion on ${exp.name} (${exp.durationHours}h)`}
                            style={{
                              background: `${tc.accent}18`,
                              color: tc.accent,
                              border: `1px solid ${tc.accent}40`,
                              cursor: (isSending || !!expeditionSending) ? "not-allowed" : "pointer",
                              opacity: (!!expeditionSending && !isSending) ? 0.5 : 1,
                            }}
                          >
                            {isSending ? "Sending..." : "Send"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
              Quest Complete
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
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
