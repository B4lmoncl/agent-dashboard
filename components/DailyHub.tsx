"use client";

import { useState, useEffect, useMemo, memo } from "react";
import type { User } from "@/app/types";
import { getUserLevel } from "@/app/utils";
import { FLOORS } from "@/app/config";

// ─── Next Feature Unlock ────────────────────────────────────────────────────
function getNextUnlock(level: number): { level: number; features: string[]; color: string } | null {
  for (const floor of FLOORS) {
    if (floor.minLevel && floor.minLevel > level) {
      return { level: floor.minLevel, features: [floor.name], color: floor.color };
    }
    for (const room of floor.rooms) {
      const roomLevel = room.minLevel ?? floor.minLevel ?? 1;
      if (roomLevel > level) {
        return { level: roomLevel, features: [room.label], color: floor.color };
      }
    }
  }
  return null;
}

// ─── Companion daily quotes (Skulduggery-humor) ─────────────────────────────
// 15+ per type so quotes don't repeat within 2 weeks.
// Rules: NO motivation. NO poetry. Dry humor from the companion's CHARACTER.
// Every quote needs a LANDING — the last sentence is the punchline.
const COMPANION_DAILY_QUOTES: Record<string, string[]> = {
  cat: [
    "{name} stares at you. Then at the quest board. The message is clear.",
    "{name} yawns. Not boredom — judging you is exhausting work.",
    "{name} is asleep on your quest list. This is either a statement or a nap.",
    "{name} has knocked three items off your desk. Coincidentally, all were excuses.",
    "{name} sat on your keyboard. The resulting text was more productive than yesterday.",
    "{name} brought you a dead mouse. As a metaphor. For your last quest attempt.",
    "{name} is grooming. Not itself. Your reputation.",
    "{name} stared at the wall for forty minutes. {name} calls it 'planning'. You call it 'Tuesday'.",
    "{name} pushed your water glass to the edge of the table. A reminder that everything is temporary.",
    "{name} claims the sunny spot on your desk. Strategy, not laziness. There's a difference. Apparently.",
    "{name} watched you sleep. Counted your breaths. Found them adequate. Barely.",
    "{name} has opinions about your quest selection. {name} expressed them by sitting on the wrong ones.",
    "{name} purrs exclusively when you're trying to concentrate. Coincidence is for amateurs.",
    "{name} looked at your streak counter, then looked at you, then closed its eyes. Verdicts don't need words.",
    "{name} knocked your daily bonus notification off the table. Some lessons are physical.",
  ],
  dog: [
    "{name} brought you a quest. It's slightly chewed, but the intent is pure.",
    "{name} has faith in you. Unconditional, unearned, and slightly suspicious.",
    "{name} sat by the door. Someone has to guard against procrastination.",
    "{name} is spinning in circles. This is either excitement or a navigation error.",
    "{name} tilts head. The head-tilt is not confusion — it's polite disappointment.",
    "{name} fetched your to-do list. It came back wetter than expected. Some items are illegible now. Probably the hard ones.",
    "{name} barked at the screen. Not a bug report. More of a general protest.",
    "{name} rolled over. Not for belly rubs — for dramatic emphasis on your incomplete quests.",
    "{name} is wagging. The wag has nothing to do with your performance. {name} wags at everything. You are not special. You are loved anyway.",
    "{name} ate a sock. Unrelated to your quests but felt like you should know.",
    "{name} dug a hole in the backyard. For your excuses. It's quite deep now.",
    "{name} has been staring at the front door since 6 AM. Not because someone's coming. Because hope is a full-time occupation.",
    "{name} heard the treat bag and forgot everything else. You should try that kind of focus.",
    "{name} put a paw on your hand. Not affection. Intervention.",
    "{name} learned 'sit' and 'stay'. Now working on 'why haven't you started yet'.",
  ],
  dragon: [
    "{name} breathed on your coffee. It's warm now. You're welcome.",
    "{name} burned your excuses. Literally. The desk is fine. Mostly.",
    "{name} is not impressed. {name} is never impressed. That's the point.",
    "{name} set the quest board on fire. To be fair, it was a slow news day.",
    "{name} hoards gold. You hoard unfinished quests. One of you has better priorities.",
    "{name} ate a candle. Not out of hunger. Out of boredom. Your fault, apparently.",
    "{name} scorched the ceiling. In {name}'s defense, the ceiling was asking for it.",
    "{name} looked at your gear score and exhaled smoke. Not fire — disappointment has a lower temperature.",
    "{name} flew in circles for an hour. Called it 'reconnaissance'. Found nothing. Blamed the weather.",
    "{name} considers your streak adequately maintained. High praise. {name} once burned a castle for less.",
    "{name} tried to eat the forge. Grimvar was not amused. {name} was not sorry.",
    "{name} shed a scale. It's worth more than your best item. Neither of you mentions it.",
    "{name} curled around your quest list protectively. Not because it's valuable. Because it's flammable.",
    "{name} sneezed. Three tapestries are gone. A surprisingly productive sneeze, all things considered.",
    "{name} stared into the Rift for thirty seconds and lost interest. The Rift took it personally.",
  ],
  owl: [
    "{name} read three books while you slept. {name} has thoughts.",
    "{name} hooted at 3 AM. It was wisdom. You weren't listening.",
    "{name} arranged your quests by priority. Silently. Judgmentally.",
    "{name} blinked twice. In owl language, that's a thesis statement.",
    "{name} organized your inventory alphabetically. Then by color. Then gave up and organized it by disappointment level.",
    "{name} stayed up all night researching optimal quest routes. The conclusion: you should have started earlier.",
    "{name} left a bookmark in your Codex. Page 47. Paragraph 3. The footnote. The one you skipped.",
    "{name} rotated its head 270 degrees to look at your quest log. The extra 90 degrees were editorial.",
    "{name} found an error in your math. Didn't correct it. Wants to see how this plays out.",
    "{name} dropped a pellet. It contained the remains of your last excuse. Owls are efficient like that.",
    "{name} is perched on the highest shelf. For perspective. On your choices.",
    "{name} wrote you a note. It says 'Adequate.' {name} considers this generous.",
    "{name} filed your achievements chronologically. The gaps are... noted.",
    "{name} has read every Codex entry twice. Found three typos. Reported none. Some knowledge is a burden.",
    "{name} prefers silence. Not because there's nothing to say — because everything has already been said, and you weren't listening the first time.",
  ],
  phoenix: [
    "{name} died yesterday. {name} got better. Your excuses can too.",
    "{name} is on fire. As usual. It's a lifestyle, not a problem.",
    "Yesterday was yesterday. {name} already forgot it. Literally.",
    "{name} burst into flames at breakfast. The toast was ruined. {name} was fine.",
    "{name} has died 347 times. Still shows up. You missed one day and called it a 'setback'.",
    "{name} left ashes on the keyboard. Not an accident. A signature.",
    "{name} exploded during dinner. The good news: the food was reheated instantly. The bad news: so was the table.",
    "{name} rose from the ashes. Again. At this point the ashes file the paperwork themselves.",
    "{name} doesn't understand 'giving up'. Not philosophically — the concept literally doesn't translate. {name} tried. Caught fire. Started over.",
    "{name} looked at your broken streak and shrugged. In phoenix culture, 'broken' is just the part before 'reborn'.",
    "{name} is allergic to quitting. Also to water. One of these is more relevant.",
    "{name} set the curtains on fire. By existing. The landlord has stopped sending invoices.",
    "{name}'s last words before combusting were 'watch this.' They always are.",
    "Every morning {name} wakes up and chooses violence. Against entropy. The entropy is losing.",
    "{name} has no concept of failure. Only extremely dramatic pauses between successes.",
  ],
  wolf: [
    "{name} howled at the moon. It was motivational. The neighbors disagree.",
    "{name} is tracking your progress. {name} is a very patient hunter.",
    "{name} doesn't do pep talks. {name} does silent, intense staring.",
    "{name} circled three times before lying down. Not comfort — perimeter check.",
    "{name} sniffed the air. Smells like unfinished quests. And rain. Mostly unfinished quests.",
    "{name} watched you from across the room for four hours. Not creepy. Tactical.",
    "{name} growled at your notifications. Low. Sustained. The notifications got the message.",
    "{name} led the pack once. Now {name} leads you. The skill set is surprisingly transferable.",
    "{name} brought you a stick. Not a gift. A weapon. For whatever today brings.",
    "{name} is not your friend. {name} is your ally. The difference matters at 3 AM.",
    "{name} marked its territory around your desk. A bold strategy. Nobody sits there anymore.",
    "{name} heard a twig snap outside. Stood guard for six hours. It was the wind. {name} has no regrets.",
    "{name} doesn't wag. {name} acknowledges. It's the same motion, with different intent.",
    "{name} traveled 40 miles in a night. Not for food. To prove a point. The point was unclear but well-traveled.",
    "{name} sleeps with one eye open. The open eye is aimed at your quest list. Always.",
  ],
  fox: [
    "{name} found a shortcut. It's probably a trap. {name} took it anyway.",
    "{name} suggests a creative approach. 'Creative' is doing a lot of work there.",
    "{name} grinned. In {name}'s defense, foxes always grin. It's unsettling.",
    "{name} stole your socks. Not because they're useful. Because they were yours and now they're not.",
    "{name} solved your puzzle. Then unsolved it. Then solved it differently. Then looked bored.",
    "{name} rearranged your inventory while you weren't looking. Everything is where it shouldn't be. Everything works better now.",
    "{name} dug three holes. One for treasure. One for escape. One for fun. Guess which is which.",
    "{name} whispered something to the NPC. The NPC's prices dropped. {name} won't explain how.",
    "{name} has seven plans. Plan A is the worst. Plan G is illegal. Plan D is the one that works. {name} always starts with Plan A.",
    "{name} found your hidden stash of 'later' quests. Moved them to 'now'. You're welcome. Or not.",
    "{name} left a trail of breadcrumbs to your quest board. Ate half of them on the way back. Foxes have priorities.",
    "{name} opened a locked door. Without a key. And without telling you there WAS a locked door. Context is for other animals.",
    "{name} tilts its head when you make decisions. Not curiosity. Disbelief.",
    "{name} snuck into the Forge at night. Came back with better gear. Refuses to discuss the details.",
    "{name} observed that 'shortcuts' and 'scenic routes' are the same thing if you're fast enough.",
  ],
  bear: [
    "{name} woke up. This is a bigger deal than you think.",
    "{name} punched a tree. For motivation. The tree had it coming.",
    "{name} is here. {name} is large. {name} believes in you. Aggressively.",
    "{name} sat on your quest log. Not metaphorically. Literally. It's flat now. So are your priorities.",
    "{name} looked at the Rift. The Rift looked away first.",
    "{name} ate breakfast. All of it. Yours too. Consider it a lesson in preparedness.",
    "{name} tried to fit through a doorway. Modified the doorway. Didn't ask.",
    "{name} hibernated for six hours in the middle of the day. Woke up stronger. You napped for twenty minutes and woke up confused. Different species, different results.",
    "{name} gave you a look. The look said: 'I could solve all your problems. But then you wouldn't learn.' {name} went back to sleep.",
    "{name} stood up on hind legs. Not to intimidate — to get a better view of your quest board. The intimidation was free.",
    "{name} is quiet today. Not calm. Loading.",
    "{name} scratched a tree. Not an itch. A warning. To the tree. And to your procrastination.",
    "{name} caught a fish. Ate it raw. Looked at you eating toast. The judgment was mutual.",
    "{name} hugged you. Gently, by bear standards. You still couldn't breathe for thirty seconds. Love is complicated.",
    "{name} doesn't understand small talk. {name} understands large talk. And silence. Mostly silence.",
  ],
  hamster: [
    "{name} ran on the wheel for an hour. Made zero progress. Felt accomplished. There's a lesson here.",
    "{name} stuffed 14 sunflower seeds into its cheeks. A storage strategy you should consider for your quests.",
    "{name} escaped the cage. Again. Found in the kitchen. Near the snacks. Shocking.",
    "{name} built a nest out of your to-do list. Priorities were assessed. The nest won.",
    "{name} is tiny but has opinions. Loud ones. At 2 AM. About nothing in particular.",
    "{name} bit the cage bars. Not frustration. Communication. You should have listened.",
    "{name} runs. Constantly. Toward nothing. Away from nothing. The philosophy is advanced.",
  ],
  bird: [
    "{name} sang at dawn. Beautifully. For thirty seconds. Then screamed. The duality of nature.",
    "{name} repeated your last excuse back to you. In a higher pitch. With more conviction.",
    "{name} rearranged the seeds into a pattern. It means something. Probably 'feed me'. Possibly 'do your quests'.",
    "{name} flew into the window. Twice. Still more progress than your quest log.",
    "{name} learned a new word. The word is 'no'. {name} uses it liberally.",
    "{name} is perched on the monitor. Supervising. The supervision is non-negotiable.",
    "{name} plucked a feather and left it on your keyboard. A gift. Or a threat. Context is unclear.",
  ],
  fish: [
    "{name} swam in circles. Still more direction than your quest planning.",
    "{name} opened and closed its mouth. Not talking. Judging. Fish judge vertically.",
    "{name} stared through the glass. At you. For six hours. Fish don't blink. Neither does disappointment.",
    "{name} ate a flake. Then another. Then waited. Patience is a fish virtue. And a taunt.",
    "{name} hid behind the castle decoration. Not scared. Strategic. Fish understand cover.",
    "{name} blew a bubble. It popped. Like your plans for productivity. But prettier.",
    "{name} ignored you completely. In fish culture, this is considered a compliment.",
  ],
  rabbit: [
    "{name} thumped. Once. Firmly. The message was received. The message was: 'faster.'",
    "{name} ate your homework. {name} doesn't understand what homework is. That's not the point.",
    "{name} dug a tunnel under the couch. Strategic retreat or escape plan — depends on your quest completion rate.",
    "{name} binkied. Uncontrollable joy for no reason. You should try it. You won't. But you should.",
    "{name} sits perfectly still. Not calm. Calculating. Rabbits calculate at speeds you can't comprehend.",
    "{name} nudged your hand. For pets? For attention? No. To move you toward the quest board.",
    "{name} has sixteen backup hiding spots. For each one, {name} has a backup backup. Rabbits plan ahead. You don't.",
  ],
  other: [
    "Your companion watches. Not with judgment. With something worse: understanding.",
    "Today is a day. That's all the motivation you're getting. From anyone.",
    "Your companion made a list. It's longer than yours. It's always longer than yours.",
    "Your companion looked at your quest log and sighed. Companions don't sigh. Except when they do.",
    "Your companion is here. That's more than most can say about their plans.",
    "Something stirred in the corner. It was your companion. And your conscience. Same direction.",
    "Your companion has been awake longer than you. Your companion will outlast you. This is not a competition. You're losing anyway.",
  ],
  default: [
    "Your companion watches. Patiently. The patience is aggressive.",
    "Today is a day. That's all the motivation you're getting.",
    "Your companion made a list. It's longer than yours.",
    "Your companion looked at your streak counter and said nothing. The silence was deafening.",
    "Your companion nudges the quest board. Subtlety has never been its strength.",
    "Your companion is here. Your excuses are not. One of you showed up.",
    "Your companion tilted its head. Not in confusion. In slow, theatrical disbelief.",
  ],
};

// ─── Streak urgency (only shows when at-risk) ──────────────────────────────
function getStreakUrgency(streak: number, streakLastDate?: string | null): {
  show: boolean; label: string; color: string;
} {
  if (streak < 3) return { show: false, label: "", color: "" };
  const now = new Date();
  const berlinNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const todayStr = `${berlinNow.getFullYear()}-${String(berlinNow.getMonth() + 1).padStart(2, "0")}-${String(berlinNow.getDate()).padStart(2, "0")}`;
  if (streakLastDate === todayStr) return { show: false, label: "", color: "" }; // Safe today
  // At risk — show warning
  return { show: true, label: `${streak}d streak at risk!`, color: "#ef4444" };
}

// ─── DailyHub Component ─────────────────────────────────────────────────────
// Slim action bar: Daily Bonus + Streak Warning + Today Drawer trigger.
// Detail lives in TodayDrawer — DailyHub is the quick-glance + quick-act layer.

interface DailyHubProps {
  user: User;
  dailyBonusAvailable: boolean;
  onClaimDailyBonus: () => void;
  claimingDailyBonus: boolean;
  dailyMissions: {
    missions: { id: string; label: string; points: number; done: boolean }[];
    earned: number;
    total: number;
    milestones: { threshold: number; reward: Record<string, number>; claimed: boolean }[];
  } | null;
  questsCompletedToday: number;
  onNavigate: (view: string) => void;
  onTodayOpen: () => void;
}

export const DailyHub = memo(function DailyHub({
  user,
  dailyBonusAvailable,
  onClaimDailyBonus,
  claimingDailyBonus,
  dailyMissions,
  questsCompletedToday,
  onNavigate,
  onTodayOpen,
}: DailyHubProps) {
  const streak = user.streakDays ?? 0;
  const streakUrgency = getStreakUrgency(streak, user.streakLastDate);
  const playerLevel = getUserLevel(user.xp ?? 0).level;
  const nextUnlock = playerLevel < 15 ? getNextUnlock(playerLevel) : null;
  const nextMilestone = dailyMissions?.milestones.find(m => !m.claimed && dailyMissions.earned >= m.threshold);

  // Companion daily quote (deterministic per day)
  const companionQuote = useMemo(() => {
    const comp = user.companion;
    if (!comp) return null;
    const type = comp.type ?? "default";
    const name = comp.name ?? "Companion";
    const quotes = COMPANION_DAILY_QUOTES[type] ?? COMPANION_DAILY_QUOTES.default;
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const idx = dayOfYear % quotes.length;
    return quotes[idx].replace(/\{name\}/g, name);
  }, [user.companion]);

  // Greeting based on time of day (Berlin)
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const h = parseInt(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin", hour: "numeric", hour12: false }), 10);
    if (h >= 5 && h < 12) setGreeting("Good morning");
    else if (h >= 12 && h < 18) setGreeting("Good afternoon");
    else if (h >= 18 && h < 22) setGreeting("Good evening");
    else setGreeting("Night owl mode");
  }, []);

  // Only render if there's something actionable to show
  const hasAction = dailyBonusAvailable || streakUrgency.show || nextMilestone || (user._restedXpPool ?? 0) > 50;
  // Always show for new players (< Lv5) or when companion has a quote
  const showHub = hasAction || playerLevel < 5 || !!companionQuote;
  if (!showHub) return null;

  return (
    <div
      className="rounded-xl overflow-hidden tab-content-enter"
      style={{
        background: "linear-gradient(135deg, rgba(17,19,24,0.95), rgba(26,28,35,0.9))",
        border: `1px solid ${streakUrgency.show ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
        boxShadow: streakUrgency.show ? "0 0 20px rgba(239,68,68,0.1)" : "none",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Greeting (compact) */}
        <p className="text-sm font-semibold flex-shrink-0" style={{ color: "#e8e8e8" }}>
          {greeting}, <span style={{ color: user.color ?? "#a78bfa" }}>{user.name}</span>
        </p>

        {/* Streak Warning — only when at risk */}
        {streakUrgency.show && (
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded streak-urgent-pulse flex-shrink-0" style={{ color: streakUrgency.color, background: `${streakUrgency.color}15`, border: `1px solid ${streakUrgency.color}30` }}>
            🔥 {streakUrgency.label}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Rested XP badge */}
        {(user._restedXpPool ?? 0) > 50 && (
          <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
            ★ {Math.round(user._restedXpPool!)} Rested XP
          </span>
        )}

        {/* Next unlock badge */}
        {nextUnlock && (
          <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: `${nextUnlock.color}10`, color: `${nextUnlock.color}99`, border: `1px solid ${nextUnlock.color}25` }}>
            Lv.{nextUnlock.level}: {nextUnlock.features.join(", ")}
          </span>
        )}

        {/* Unclaimed milestone nudge */}
        {nextMilestone && !dailyBonusAvailable && (
          <button onClick={onTodayOpen} className="text-xs font-mono px-2 py-1.5 rounded flex-shrink-0" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)", cursor: "pointer" }} title="Claim milestone in Today's Overview">
            Claim ★
          </button>
        )}

        {/* Today Drawer trigger */}
        <button
          onClick={onTodayOpen}
          className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", cursor: "pointer", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
          title="Open detailed Today overview"
        >
          Today ↗
        </button>

        {/* Daily Bonus Claim — the primary action */}
        {dailyBonusAvailable && (
          <button
            onClick={onClaimDailyBonus}
            disabled={claimingDailyBonus}
            className="px-4 py-1.5 rounded-lg text-xs font-bold daily-bonus-glow flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.15))",
              color: "#fbbf24",
              border: "1px solid rgba(251,191,36,0.4)",
              cursor: claimingDailyBonus ? "not-allowed" : "pointer",
              opacity: claimingDailyBonus ? 0.6 : 1,
              animation: !claimingDailyBonus ? "daily-bonus-pulse 2s ease-in-out infinite" : "none",
            }}
            title="Claim your daily login bonus"
          >
            {claimingDailyBonus ? "Claiming..." : "Claim Daily Bonus"}
          </button>
        )}
      </div>
      {/* Companion message — unique to DailyHub, not in TodayDrawer */}
      {companionQuote && (
        <div className="px-4 pb-2 -mt-0.5">
          <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.22)", lineHeight: 1.5 }}>
            &ldquo;{companionQuote}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
});
