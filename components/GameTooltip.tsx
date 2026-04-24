"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { getBalance, onBalanceLoaded } from "@/lib/balance-cache";

// ─── Tooltip System ──────────────────────────────────────────────────────────
// Hover with 0.8s delay → tooltip appears. Nested keywords inside tooltips
// can be hovered to open sub-tooltips (infinite nesting).

const HOVER_DELAY = 800; // ms before tooltip shows
const TOOLTIP_GAP = 8;   // px gap between trigger and tooltip
const NESTED_OFFSET = 8; // px offset for nested tooltips

// ─── Tooltip Context (tracks nesting depth for stacking) ────────────────────

const TooltipDepthContext = createContext(0);

// ─── Tooltip Content Types ──────────────────────────────────────────────────

export interface TooltipEntry {
  title: string;
  icon?: string;
  accent?: string;
  body: React.ReactNode;
}

// ─── Central Tooltip Registry ───────────────────────────────────────────────
// All game terms that can be hovered for explanations.

function buildTooltipRegistry(): Record<string, TooltipEntry> {
  const B = getBalance();
  return {
  // ── Stats ──
  kraft: {
    title: "Kraft",
    icon: "/images/icons/stat-kraft.png",
    accent: "#ef4444",
    body: (
      <>
        <p>Primary stat from equipped gear. Increases Quest <GTRef k="xp">XP</GTRef> earned.</p>
        <div className="gt-stat-row"><span>Effect</span><span>{B.stats.kraft?.label || "+0.5% XP per point"}</span></div>
        <div className="gt-stat-row"><span>At 20</span><span>+{(B.stats.kraft?.effect || 0.005) * 20 * 100}% · At 30: +{(B.stats.kraft?.effect || 0.005) * 30 * 100}%</span></div>
        <p className="gt-source">Sources: Gear affixes, set bonuses, enchantments</p>
      </>
    ),
  },
  ausdauer: {
    title: "Ausdauer",
    icon: "/images/icons/stat-ausdauer.png",
    accent: "#3b82f6",
    body: (
      <>
        <p>Primary stat. Slows <GTRef k="forge_temp">Forge Temperature</GTRef> decay rate.</p>
        <div className="gt-stat-row"><span>Effect</span><span>{B.stats.ausdauer?.label || "-0.5% Forge Decay per point"}</span></div>
        <div className="gt-stat-row"><span>Floor</span><span>{((B.stats.ausdauer?.decayFloor || 0.1) * 100).toFixed(0)}% of base decay rate</span></div>
        <p className="gt-source">Sources: Gear affixes (armor, shield, boots)</p>
      </>
    ),
  },
  weisheit: {
    title: "Weisheit",
    icon: "/images/icons/stat-weisheit.png",
    accent: "#f59e0b",
    body: (
      <>
        <p>Primary stat. Increases <GTRef k="gold">Gold</GTRef> earned from quests.</p>
        <div className="gt-stat-row"><span>Effect</span><span>{B.stats.weisheit?.label || "+0.4% Gold per point"}</span></div>
        <div className="gt-stat-row"><span>At 20</span><span>+{(B.stats.weisheit?.effect || 0.004) * 20 * 100}% · At 30: +{(B.stats.weisheit?.effect || 0.004) * 30 * 100}%</span></div>
        <p className="gt-source">Sources: Gear affixes (helm, amulet, weapon)</p>
      </>
    ),
  },
  glueck: {
    title: "Glück",
    icon: "/images/icons/stat-glueck.png",
    accent: "#22c55e",
    body: (
      <>
        <p>Primary stat. Increases loot drop chance from quests.</p>
        <div className="gt-stat-row"><span>Effect</span><span>{B.stats.glueck?.label || "+0.3% drop chance per point"}</span></div>
        <div className="gt-stat-row"><span>At 20</span><span>+{((B.stats.glueck?.effect || 0.003) * 20 * 100).toFixed(0)}% · At 30: +{((B.stats.glueck?.effect || 0.003) * 30 * 100).toFixed(1)}%</span></div>
        <p className="gt-source">Sources: Gear affixes (boots, amulet, helm)</p>
      </>
    ),
  },
  fokus: {
    title: "Fokus",
    icon: "🎯",
    accent: "#9ca3af",
    body: (
      <>
        <p>Minor stat. Adds flat bonus <GTRef k="xp">XP</GTRef> to every quest completion.</p>
        <div className="gt-stat-row"><span>Effect</span><span>{B.stats.fokus?.label || "+1 flat XP per point"}</span></div>
        <div className="gt-stat-row"><span>Cap</span><span>+{B.stats.fokus?.cap || 50} <GTRef k="xp">XP</GTRef></span></div>
      </>
    ),
  },
  vitalitaet: {
    title: "Vitalität",
    icon: "❤️",
    accent: "#9ca3af",
    body: (
      <>
        <p>Minor stat. Chance to automatically save your <GTRef k="streak">Streak</GTRef> when you miss a day.</p>
        <div className="gt-stat-row"><span>Effect</span><span>{B.stats.vitalitaet?.label || "+1% streak protection per point"}</span></div>
        <div className="gt-stat-row"><span>Cap</span><span>{((B.stats.vitalitaet?.cap || 0.75) * 100).toFixed(0)}% total</span></div>
      </>
    ),
  },
  charisma: {
    title: "Charisma",
    icon: "💬",
    accent: "#9ca3af",
    body: (
      <>
        <p>Minor stat. Increases Bond <GTRef k="xp">XP</GTRef> earned from companion quests.</p>
        <div className="gt-stat-row"><span>Effect</span><span>{B.stats.charisma?.label || "+5% Bond XP per point"}</span></div>
      </>
    ),
  },
  tempo: {
    title: "Tempo",
    icon: "⚡",
    accent: "#9ca3af",
    body: (
      <>
        <p>Minor stat. Increases <GTRef k="forge_temp">Forge Temperature</GTRef> recovery from quests.</p>
        <div className="gt-stat-row"><span>Effect</span><span>{B.stats.tempo?.label || "+1% Forge Temp recovery per point"}</span></div>
      </>
    ),
  },

  // ── Core Systems ──
  forge_temp: {
    title: "Forge Temperature",
    icon: "/images/icons/temp-hot.png",
    accent: "#f97316",
    body: (
      <>
        <p>Activity meter (0-100%). Higher temp = more <GTRef k="xp">XP</GTRef> &amp; <GTRef k="gold">Gold</GTRef>. Decays {B.forgeTemp.decayPerHour}%/hour, <GTRef k="ausdauer">Ausdauer</GTRef> slows decay. Each quest: +{B.forgeTemp.gainPerQuest}.</p>
        {B.forgeTemp.tiers.map((t, i) => (
          <div key={i} className="gt-stat-row" style={t.xp < 1 ? { color: "#ef4444" } : undefined}>
            <span>{t.min === 0 ? `<${B.forgeTemp.tiers[i > 0 ? i - 1 : 0]?.min || 20}%` : `${t.min}%+`} {t.label}</span>
            <span>×{t.xp} <GTRef k="xp">XP</GTRef>{t.gold !== 1 ? ` · ×${t.gold} Gold` : ""}</span>
          </div>
        ))}
      </>
    ),
  },
  streak: {
    title: "Streak",
    icon: "/images/icons/ui-streak-fire.png",
    accent: "#fbbf24",
    body: (
      <>
        <p>Complete at least 1 quest or ritual per day to maintain your streak. Longer streaks increase <GTRef k="gold">Gold</GTRef> earned (up to ~+20% with diminishing returns at 30+ days).</p>
        <div className="gt-stat-row"><span><GTRef k="gold">Gold</GTRef> bonus</span><span>+0.5%/day (diminishing), soft cap ~20% at 60+ days</span></div>
        <div className="gt-stat-row"><span>Protection</span><span><GTRef k="vitalitaet">Vitalität</GTRef> stat, Streak Shields, Legendary gear</span></div>
        <p className="gt-source">Milestones: Bronze (7d), Silver (21d), Gold (60d), Diamond (180d), Legend (365d)</p>
      </>
    ),
  },
  xp: {
    title: "Experience Points (XP)",
    icon: "/images/icons/reward-xp.png",
    accent: "#a855f7",
    body: (
      <>
        <p>Earned from quests. XP is multiplied by many factors:</p>
        <div className="gt-stat-row"><span><GTRef k="forge_temp">Forge Temp</GTRef></span><span>×0.6 to ×1.25</span></div>
        <div className="gt-stat-row"><span><GTRef k="kraft">Kraft</GTRef> stat</span><span>+0.5% per point (max +15% at 30)</span></div>
        <div className="gt-stat-row"><span>Gear bonus</span><span>Varies by equipment</span></div>
        <div className="gt-stat-row"><span>Companion Bond</span><span>+1% per bond level</span></div>
        <div className="gt-stat-row"><span>Hoarding malus</span><span>-10%/quest over 20 active</span></div>
        <p className="gt-source">Max level: 50. Level-up grants 5 + level <GTRef k="stardust">Stardust</GTRef>.</p>
      </>
    ),
  },

  // ── Currencies ──
  gold: {
    title: "Gold",
    icon: "/images/icons/currency-gold.png",
    accent: "#f59e0b",
    body: (
      <>
        <p>Primary currency. Earned from quests (scaled by <GTRef k="weisheit">Weisheit</GTRef>, <GTRef k="streak">Streak</GTRef>, <GTRef k="forge_temp">Forge Temp</GTRef>).</p>
        <p className="gt-source">Used for: Bazaar shop, crafting, gear purchase, transmutation</p>
      </>
    ),
  },
  runensplitter: {
    title: "Runensplitter",
    icon: "💎",
    accent: "#a78bfa",
    body: (
      <>
        <p>Gacha currency for the Wheel of Stars (standard banner). Earned from quest completion (1-5 per quest based on rarity) and duplicate gacha refunds.</p>
        <div className="gt-stat-row"><span>Single pull</span><span>10 Runensplitter</span></div>
        <div className="gt-stat-row"><span>10× pull</span><span>90 Runensplitter</span></div>
      </>
    ),
  },
  stardust: {
    title: "Stardust",
    icon: "⭐",
    accent: "#818cf8",
    body: <p>Premium currency for the Astral Radiance (featured banner). Earned from level-ups (5 + level) and special events.</p>,
  },
  essenz: {
    title: "Essenz",
    icon: "/images/icons/currency-essenz.png",
    accent: "#ef4444",
    body: <p>Crafting currency. Earned by <strong>dismantling gear</strong> at the Schmied (Salvage tab) and from daily login rewards. Used for enchanting rerolls, Ätherwürfel extraction, and recipe learning.</p>,
  },
  sternentaler: {
    title: "Sternentaler",
    icon: "🌟",
    accent: "#fbbf24",
    body: <p>Exclusive currency earned only from Weekly Challenges (Sternenpfad star rewards and Expedition checkpoints). Used for special shop items.</p>,
  },
  gildentaler: {
    title: "Gildentaler",
    icon: "🏛️",
    accent: "#10b981",
    body: <p>Earned from Social and Coop quests (+5 per quest). Reserved for future guild features.</p>,
  },

  // ── Rarity ──
  rarity: {
    title: "Item Rarity",
    icon: "💠",
    accent: "#a855f7",
    body: (
      <>
        <p>Items and quests have 5 rarity tiers. Higher rarity = better stats and rewards.</p>
        <div className="gt-stat-row" style={{ color: "#9ca3af" }}><span>Common</span><span>1 primary, 0 minor</span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Uncommon</span><span>1-2 primary, 0-1 minor</span></div>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>Rare</span><span>2 primary, 1 minor</span></div>
        <div className="gt-stat-row" style={{ color: "#a855f7" }}><span>Epic</span><span>2-3 primary, 1-2 minor</span></div>
        <div className="gt-stat-row" style={{ color: "#FFD700" }}><span>Legendary</span><span>3 primary, 2 minor + effect</span></div>
      </>
    ),
  },

  // ── Game Features ──
  pity: {
    title: "Pity System",
    icon: "◆",
    accent: "#fbbf24",
    body: (
      <>
        <p>Gacha safety net. Guarantees rare drops after a set number of pulls.</p>
        <div className="gt-stat-row"><span>Soft Pity (60)</span><span>+2.5% Legendary chance/pull</span></div>
        <div className="gt-stat-row"><span>Hard Pity (75)</span><span>Guaranteed Legendary</span></div>
        <div className="gt-stat-row"><span>Epic Pity (10)</span><span>Guaranteed Epic+ every 10</span></div>
        <p className="gt-source">Pity wird pro Banner separat gezählt — Pulls auf Banner A zählen nicht für Banner B.</p>
      </>
    ),
  },
  bond_level: {
    title: "Bond Level",
    icon: "🐾",
    accent: "#ec4899",
    body: (
      <>
        <p>Your companion&apos;s bond level (1-10). Higher bond = more bonuses. At Bond 5, unlock Ultimate abilities (7-day cooldown).</p>
        <div className="gt-stat-row"><span>Petting</span><span>2×/day, +0.5 Bond <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row"><span>Companion Quests</span><span>+1 Bond <GTRef k="xp">XP</GTRef> (× <GTRef k="charisma">Charisma</GTRef>)</span></div>
        <p className="gt-source">Ultimates: ⚡ Instant Complete · ✨ 2× Loot · 🔥 +3 <GTRef k="streak">Streak</GTRef> Days</p>
      </>
    ),
  },
  sworn_bonds: {
    title: "Sworn Bonds",
    icon: "◆",
    accent: "#f59e0b",
    body: (
      <>
        <p>A 1-on-1 pact between friends with shared weekly objectives. Complete them together for escalating rewards.</p>
        <div className="gt-stat-row"><span>Bond Levels</span><span>1-10 (Bekannte → Ewiger Bund)</span></div>
        <div className="gt-stat-row"><span>Weekly Objectives</span><span>Reset every Monday</span></div>
        <div className="gt-stat-row"><span>Duo Streak</span><span>Consecutive weeks = better rewards</span></div>
        <div className="gt-stat-row"><span>Bond Chest</span><span>Gold + Essenz + Duo Frame chance</span></div>
        <div className="gt-stat-row"><span>Break Cooldown</span><span>7 days after breaking a bond</span></div>
        <p className="gt-source">One bond at a time. Both players must complete objectives to earn the chest.</p>
      </>
    ),
  },
  hoarding: {
    title: "Hoarding Penalty",
    icon: "⚠️",
    accent: "#ef4444",
    body: (
      <>
        <p>Having too many active quests reduces <GTRef k="xp">XP</GTRef> earned. Encourages completing quests before claiming new ones.</p>
        <div className="gt-stat-row"><span>1-{B.hoarding.freeLimit} quests</span><span style={{ color: "#22c55e" }}>No penalty</span></div>
        <div className="gt-stat-row"><span>{B.hoarding.freeLimit + 1}-{B.hoarding.hardCapAt - 1} quests</span><span style={{ color: "#ef4444" }}>-{B.hoarding.penaltyPerQuest}% <GTRef k="xp">XP</GTRef> per quest over {B.hoarding.freeLimit}</span></div>
        <div className="gt-stat-row"><span>{B.hoarding.hardCapAt - 5}+ quests</span><span style={{ color: "#ef4444" }}>-{B.hoarding.softCap}% <GTRef k="xp">XP</GTRef> (soft cap)</span></div>
        <div className="gt-stat-row"><span>{B.hoarding.hardCapAt}+ quests</span><span style={{ color: "#ef4444" }}>-{B.hoarding.hardCap}% <GTRef k="xp">XP</GTRef> (hard cap)</span></div>
      </>
    ),
  },
  rested_xp: {
    title: "Rested XP",
    icon: "/images/icons/reward-xp.png",
    accent: "#3b82f6",
    body: (
      <>
        <p>Accumulates while you're offline and doubles the XP you earn until depleted.</p>
        <div className="gt-stat-row"><span>Accumulation</span><span>5% of level XP per 8h offline</span></div>
        <div className="gt-stat-row"><span>Cap</span><span>150% of current level XP</span></div>
        <div className="gt-stat-row"><span>Effect</span><span>+100% XP (doubled) until pool empty</span></div>
        <div className="gt-stat-row"><span>Shown as</span><span>Blue zone in XP bar</span></div>
        <p className="gt-source">Take a break — your adventures will be more rewarding when you return.</p>
      </>
    ),
  },
  daily_diminishing: {
    title: "Daily Quest Limit",
    icon: "/images/icons/ui-quest-scroll.png",
    accent: "#f59e0b",
    body: (
      <>
        <p>Quest rewards diminish throughout the day to encourage steady daily play. The first quests each day are the most valuable.</p>
        {B.dailyDiminishing?.tiers?.map((t: { maxQuests: number; multiplier: number; label: string }, i: number) => (
          <div key={i} className="gt-stat-row" style={t.multiplier < 1 ? { color: "#f59e0b" } : undefined}>
            <span>{t.maxQuests === Infinity ? "21+" : `${i === 0 ? 1 : (B.dailyDiminishing?.tiers?.[i - 1]?.maxQuests ?? 0) + 1}-${t.maxQuests}`} quests</span>
            <span>{Math.round(t.multiplier * 100)}% rewards</span>
          </div>
        )) || <>
          <div className="gt-stat-row"><span>1-5 quests</span><span>100% rewards</span></div>
          <div className="gt-stat-row" style={{ color: "#f59e0b" }}><span>6-7 quests</span><span>90% rewards</span></div>
          <div className="gt-stat-row" style={{ color: "#f59e0b" }}><span>8-10 quests</span><span>75% rewards</span></div>
          <div className="gt-stat-row" style={{ color: "#f59e0b" }}><span>11-15 quests</span><span>60% rewards</span></div>
          <div className="gt-stat-row" style={{ color: "#f59e0b" }}><span>16-20 quests</span><span>50% rewards</span></div>
          <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>21+ quests</span><span>25% rewards</span></div>
        </>}
        <p className="gt-source">Resets daily at midnight. Material drops are not affected.</p>
      </>
    ),
  },
  forge_fever: {
    title: "Schmiedefieber",
    icon: "/images/icons/prof-schmied.png",
    accent: "#f97316",
    body: (
      <>
        <p>Alle 48 Stunden bricht in einer zuf\u00e4lligen Profession das Schmiedefieber aus \u2014 ein 4-st\u00fcndiges Zeitfenster mit besonderen Boni.</p>
        <div className="gt-stat-row"><span>Materialkosten</span><span style={{ color: "#22c55e" }}>-50%</span></div>
        <div className="gt-stat-row"><span>Skill-XP</span><span style={{ color: "#22c55e" }}>2\u00d7</span></div>
        <div className="gt-stat-row"><span>Bonus-Cache</span><span>5+ Crafts im Fenster</span></div>
        <p className="gt-source">Der Bonus-Cache enth\u00e4lt 2-4 zuf\u00e4llige Materialien (Uncommon-Rare). Stapelt sich mit dem t\u00e4glichen Erstcraft-Bonus.</p>
      </>
    ),
  },
  set_bonus: {
    title: "Set Bonuses",
    icon: "\uD83D\uDD37",
    accent: "#3b82f6",
    body: (
      <>
        <p>Equipping multiple items from the same tier or named set grants bonus stats.</p>
        <div className="gt-stat-row"><span>3/6 Tier Set</span><span>+5% all primary stats</span></div>
        <div className="gt-stat-row"><span>6/6 Tier Set</span><span>+10% all primary stats</span></div>
        <p className="gt-source">Named sets (from NPC quest chains) have unique bonuses at 2/3 and 3/3 pieces.</p>
      </>
    ),
  },
  legendary_effects: {
    title: "Legendary Effects",
    icon: "✦",
    accent: "#FFD700",
    body: (
      <>
        <p>Special passive effects on Legendary-rarity gear. Values are randomly rolled within a range when the item drops.</p>
        <div className="gt-stat-row"><span><GTRef k="xp">XP</GTRef> Bonus</span><span>+2-8%</span></div>
        <div className="gt-stat-row"><span><GTRef k="gold">Gold</GTRef> Bonus</span><span>+2-7%</span></div>
        <div className="gt-stat-row"><span>Drop Bonus</span><span>+1-4%</span></div>
        <div className="gt-stat-row"><span>Decay Reduction</span><span>8-12%</span></div>
        <div className="gt-stat-row"><span>Night <GTRef k="gold">Gold</GTRef> ×2</span><span>23:00-05:00</span></div>
        <div className="gt-stat-row"><span>Every 5th Quest</span><span>Bonus <GTRef k="xp">XP</GTRef></span></div>
      </>
    ),
  },
  daily_missions: {
    title: "Daily Missions",
    icon: "✅",
    accent: "#22c55e",
    body: (
      <>
        <p>6 daily tasks with a point milestone track. Visible at the top of the Quest Board. Resets daily at midnight.</p>
        <div className="gt-stat-row"><span>100 pts</span><span>25 <GTRef k="gold">Gold</GTRef></span></div>
        <div className="gt-stat-row"><span>300 pts</span><span>50 <GTRef k="gold">Gold</GTRef> + 3 <GTRef k="essenz">Essenz</GTRef></span></div>
        <div className="gt-stat-row"><span>500 pts</span><span>100 <GTRef k="gold">Gold</GTRef> + 2 <GTRef k="runensplitter">Runensplitter</GTRef></span></div>
        <div className="gt-stat-row"><span>750 pts</span><span>150 <GTRef k="gold">Gold</GTRef> + 1 <GTRef k="sternentaler">Sternentaler</GTRef></span></div>
      </>
    ),
  },
  workshop_upgrades: {
    title: "Workshop Upgrades",
    icon: "🔧",
    accent: "#f59e0b",
    body: (
      <>
        <p>Permanent bonus items purchasable in the Artisan's Quarter. All bonuses are additive.</p>
        <div className="gt-stat-row"><span><GTRef k="gold">Gold</GTRef>-Forged Tools</span><span>+2/3/4/5% <GTRef k="gold">Gold</GTRef></span></div>
        <div className="gt-stat-row"><span>Loot Chance Amulet</span><span>+1/2/3% Loot</span></div>
        <div className="gt-stat-row"><span><GTRef k="streak">Streak</GTRef> Shield Charm</span><span>Auto-save 1-2×/week</span></div>
        <div className="gt-stat-row"><span>Material Magnet</span><span>+5/10/15% material chance</span></div>
      </>
    ),
  },
  rift: {
    title: "The Rift (Dungeons)",
    icon: "/images/icons/nav-rift.png",
    accent: "#a855f7",
    body: (
      <>
        <p>Timed quest chains with escalating difficulty. 3 tiers: Normal (3 quests/72h), Hard (5/48h), Legendary (7/36h). Failure triggers a cooldown.</p>
        <p className="gt-source">Rift stages grant full rewards: <GTRef k="xp">XP</GTRef> multipliers, loot drops, materials, <GTRef k="streak">streak</GTRef> + <GTRef k="forge_temp">forge temp</GTRef> updates.</p>
      </>
    ),
  },
  dungeons: {
    title: "The Undercroft (Dungeons)",
    icon: "◆",
    accent: "#3b82f6",
    body: (
      <>
        <p>Cooperative group dungeons for 2-4 friends. Send your party into the depths, wait 8 hours, then collect rewards based on combined Gear Score + companion bond.</p>
        <div className="gt-stat-row"><span>Success</span><span>100% / 70% / 40% / 15% based on power vs threshold</span></div>
        <div className="gt-stat-row"><span>Cooldown</span><span>7 days per dungeon</span></div>
        <div className="gt-stat-row"><span>Tiers</span><span>Normal (Lv10) · Hard (Lv20) · Legendary (Lv35)</span></div>
        <p className="gt-source">Dungeons can drop unique named items, gems, gear, materials, and currencies. Bonus title + frame on first clear.</p>
      </>
    ),
  },
  world_boss: {
    title: "The Colosseum (World Boss)",
    icon: "⚔️",
    accent: "#ef4444",
    body: (
      <>
        <p>Community-wide boss encounters. All players deal damage by completing quests. <GTRef k="gear_score">Gear Score</GTRef> multiplies your damage.</p>
        <div className="gt-stat-row"><span>Duration</span><span>Until weekly reset (Monday)</span></div>
        <div className="gt-stat-row"><span>Spawn</span><span>Every Monday</span></div>
        <p className="gt-source">Top 3 contributors earn exclusive titles. #1 gets a unique frame. All contributors receive <GTRef k="gold">Gold</GTRef>, <GTRef k="essenz">Essenz</GTRef>, and a chance at unique item drops.</p>
      </>
    ),
  },
  gear_score: {
    title: "Gear Score",
    icon: "⚔️",
    accent: "#818cf8",
    body: (
      <>
        <p>Combined power rating from all equipped gear. Higher stats and socketed <GTRef k="gems">Gems</GTRef> increase your score.</p>
        <p className="gt-source">Affects dungeon success chance and <GTRef k="world_boss">World Boss</GTRef> damage multiplier.</p>
      </>
    ),
  },
  collection_log: {
    title: "Collection Log",
    icon: "📖",
    accent: "#60a5fa",
    body: (
      <p>Track all Unique Named Items you&apos;ve discovered. Unique items drop from <GTRef k="world_boss">World Bosses</GTRef>, <GTRef k="dungeons">Dungeons</GTRef>, and the Mythic Rift.</p>
    ),
  },
  mythic_rift: {
    title: "Mythic+ Endless Rift",
    icon: "♾️",
    accent: "#f97316",
    body: (
      <>
        <p>Infinite scaling difficulty beyond Legendary. Each level increases the difficulty multiplier by +0.3× and reduces time by 1.5 hours (min 18h).</p>
        <div className="gt-stat-row"><span>Progression</span><span>+1 level per clear</span></div>
        <div className="gt-stat-row"><span>Fail Cooldown</span><span>None — retry immediately</span></div>
        <p className="gt-source">Leaderboard tracks highest level. Bonus loot at M+5, M+10, M+15, M+20.</p>
      </>
    ),
  },
  hearth: {
    title: "The Hearth (Rest Mode)",
    icon: "/images/icons/nav-hearth.png",
    accent: "#d97706",
    body: (
      <>
        <p>Rest mode for 1-7 days. Freezes <GTRef k="streak">Streak</GTRef> and <GTRef k="forge_temp">Forge Temp</GTRef>. No quest generation or <GTRef k="hoarding">hoarding penalty</GTRef> changes during rest.</p>
        <div className="gt-stat-row"><span>Cooldown</span><span>30 days after rest ends</span></div>
        <p className="gt-source">Can leave early — frozen values are restored.</p>
      </>
    ),
  },

  // ── Section Headers ──
  quest_board: {
    title: "Quest Board",
    icon: "📋",
    accent: "#ef4444",
    body: (
      <>
        <p>Your personal quest board. Claim quests, complete them for <GTRef k="xp">XP</GTRef> and <GTRef k="gold">Gold</GTRef>. Filter by type to find what interests you.</p>
        <div className="gt-stat-row" style={{ color: "#9ca3af" }}><span>Common</span><span>10 <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Uncommon</span><span>18 <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>Rare</span><span>30 <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row" style={{ color: "#a855f7" }}><span>Epic</span><span>50 <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row" style={{ color: "#FFD700" }}><span>Legendary</span><span>80 <GTRef k="xp">XP</GTRef></span></div>
        <p className="gt-source"><GTRef k="forge_temp">Forge</GTRef>, Gear &amp; <GTRef k="bond_level">Companion</GTRef> bonuses multiply all <GTRef k="xp">XP</GTRef>.</p>
      </>
    ),
  },
  proving_grounds: {
    title: "The Proving Grounds",
    icon: "🏆",
    accent: "#fbbf24",
    body: (
      <>
        <p>Rankings based on <GTRef k="xp">XP</GTRef> earned. Compete with other players to claim glory on the leaderboard.</p>
        <p className="gt-source">Level, achievements, and title are displayed alongside your rank.</p>
      </>
    ),
  },
  weekly_challenges: {
    title: "Weekly Challenges",
    icon: "⭐",
    accent: "#fbbf24",
    body: (
      <>
        <p>Two challenges that reset every Monday:</p>
        <div className="gt-stat-row"><span><GTRef k="sternenpfad">Star Path</GTRef></span><span>Solo · 3 stages · up to 9★</span></div>
        <div className="gt-stat-row"><span><GTRef k="expedition">Expedition</GTRef></span><span>Co-op · shared checkpoints</span></div>
        <p>Speed bonus: complete a stage within 2 days for +1★. <GTRef k="streak">Streak</GTRef> and <GTRef k="forge_temp">Forge</GTRef> bonuses apply.</p>
        <p className="gt-source">Rewards: <GTRef k="gold">Gold</GTRef>, <GTRef k="runensplitter">Rune Shards</GTRef>, <GTRef k="essenz">Essenz</GTRef>, and the exclusive <GTRef k="sternentaler">Sternentaler</GTRef> currency.</p>
      </>
    ),
  },
  breakaway: {
    title: "The Breakaway",
    icon: "🤝",
    accent: "#818cf8",
    body: (
      <>
        <p>Social hub of the Trading District. Add friends, send messages, and propose trades.</p>
        <p>Trades are negotiated back and forth — both players must agree before items and <GTRef k="gold">Gold</GTRef> are exchanged.</p>
        <p className="gt-source">Activity feed shows quest completions, level-ups, achievements, and rare drops from friends.</p>
      </>
    ),
  },
  npc_quest_board: {
    title: "The Wanderer's Rest",
    icon: "🏕️",
    accent: "#8b5cf6",
    body: (
      <>
        <p>Travelling NPCs visit the guild hall on a rotating schedule. Each NPC brings unique quest chains with story and rewards.</p>
        <p>Up to 3 NPCs are active at a time. They stay for a few days before departing, with a cooldown before they can return.</p>
        <p>Complete an NPC&apos;s quest chain before they leave to earn all rewards. Quests unlock sequentially within each chain.</p>
        <p className="gt-source">Rarer NPCs appear less often but offer better rewards.</p>
      </>
    ),
  },
  artisans_quarter: {
    title: "Artisan's Quarter",
    icon: "⚒️",
    accent: "#f59e0b",
    body: (
      <>
        <p>The crafting hub. Choose 2 of 8 professions — each with a unique NPC, recipes, and gear. Skill up from 1 to 300, rank up at the trainer, and craft everything from basic armor to legendary weapons.</p>
        <div className="gt-stat-row"><span>Professions</span><span>2 slots (can unlearn + relearn)</span></div>
        <div className="gt-stat-row"><span>Skill</span><span>1–300, 4 ranks (Apprentice → Artisan)</span></div>
        <div className="gt-stat-row"><span>Skill-Up</span><span>🟠 guaranteed → 🟡 likely → 🟢 rare → ⚪ none</span></div>
        <p className="gt-source">Materials drop from quests (only for your chosen professions). Recipes come from trainers, quest drops, factions, and dungeons. All crafted items are tradeable.</p>
      </>
    ),
  },
  vault_of_fate: {
    title: "Vault of Fate",
    icon: "★",
    accent: "#a78bfa",
    body: (
      <>
        <p>Draw items from the Aetherstream. The Wheel remembers every pull.</p>
        <div className="gt-stat-row" style={{ color: "#f97316" }}><span>Legendary</span><span>{(B.gacha.legendaryRate * 100).toFixed(1)}%</span></div>
        <div className="gt-stat-row" style={{ color: "#a855f7" }}><span>Epic</span><span>{(B.gacha.epicRate * 100).toFixed(0)}%</span></div>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>Rare</span><span>{(B.gacha.rareRate * 100).toFixed(0)}%</span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Uncommon</span><span>{(B.gacha.uncommonRate * 100).toFixed(0)}%</span></div>
        <div className="gt-stat-row" style={{ color: "#9ca3af" }}><span>Common</span><span>{((1 - B.gacha.legendaryRate - B.gacha.epicRate - B.gacha.rareRate - B.gacha.uncommonRate) * 100).toFixed(1)}%</span></div>
        <p className="gt-source"><GTRef k="pity">Pity</GTRef>: Soft at {B.gacha.softPity}, hard at {B.gacha.hardPity}. 10-pull = 10% discount + guaranteed Epic+. Duplicates → <GTRef k="runensplitter">Rune Shards</GTRef>.</p>
      </>
    ),
  },
  companions: {
    title: "Companions",
    icon: "/images/icons/companion-dragon.png",
    accent: "#ec4899",
    body: (
      <>
        <p>Loyal companions that grow alongside you. Each has unique abilities and bond levels (1-10).</p>
        <div className="gt-stat-row"><span>Bond Bonus</span><span>+1% <GTRef k="xp">XP</GTRef> per level</span></div>
        <div className="gt-stat-row"><span>Ultimate (Bond 5)</span><span>7-day cooldown ability</span></div>
        <p className="gt-source">Pet 2×/day for +0.5 Bond <GTRef k="xp">XP</GTRef>. Complete companion quests for +1 Bond <GTRef k="xp">XP</GTRef> (× <GTRef k="charisma">Charisma</GTRef>).</p>
      </>
    ),
  },
  login_calendar: {
    title: "Login Calendar",
    icon: "📅",
    accent: "#22c55e",
    body: (
      <>
        <p>Daily login rewards tracked on a monthly calendar. Each day grants scaling currency bonuses.</p>
        <p><GTRef k="streak">Streak</GTRef> days are highlighted — maintain your streak for milestone rewards.</p>
        <p className="gt-source">Rewards include <GTRef k="gold">Gold</GTRef>, <GTRef k="essenz">Essenz</GTRef>, and <GTRef k="runensplitter">Rune Shards</GTRef>.</p>
      </>
    ),
  },

  // ── Rituals & Vows ──
  rituals: {
    title: "Rituals",
    icon: "🔮",
    accent: "#8b5cf6",
    body: (
      <>
        <p>Daily or weekly habits you commit to. Complete them consistently to build <GTRef k="streak">Streaks</GTRef> and earn bonus <GTRef k="xp">XP</GTRef> + <GTRef k="gold">Gold</GTRef>.</p>
        <div className="gt-stat-row"><span>Aetherbond tiers</span><span>1× to 16× multiplier</span></div>
        <div className="gt-stat-row"><span>Blood Pact</span><span>30× but streak resets on miss</span></div>
        <p className="gt-source">Categories: Personal, Social, Creative, Health, Learning. Schedule: Daily or Weekly.</p>
      </>
    ),
  },
  aetherbond: {
    title: "Aetherbond",
    icon: "⚡",
    accent: "#a78bfa",
    body: (
      <>
        <p>Commitment tier for rituals. Higher tiers multiply rewards but increase the penalty for missing days.</p>
        <div className="gt-stat-row"><span>Spark</span><span>3× rewards</span></div>
        <div className="gt-stat-row"><span>Flame</span><span>3× rewards</span></div>
        <div className="gt-stat-row"><span>Ember</span><span>7× rewards</span></div>
        <div className="gt-stat-row"><span>Crucible</span><span>16× rewards</span></div>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>Eternity</span><span>30× (<GTRef k="blood_pact">Blood Pact</GTRef>)</span></div>
      </>
    ),
  },
  blood_pact: {
    title: "Blood Pact",
    icon: "🩸",
    accent: "#ef4444",
    body: (
      <>
        <p>The highest commitment tier. Grants <strong>30× multiplied rewards</strong> but missing a single day <strong>resets your entire streak to 0</strong>.</p>
        <p>Only choose this if you are absolutely certain you can maintain the ritual every day.</p>
        <p className="gt-source">Cannot be undone once active. The pact remembers.</p>
      </>
    ),
  },
  vows: {
    title: "Vows (Anti-Rituals)",
    icon: "🚫",
    accent: "#f97316",
    body: (
      <>
        <p>Commitments to <strong>stop</strong> doing something. Every day you resist, your streak grows and you earn rewards.</p>
        <div className="gt-stat-row"><span>Easy</span><span>0.5× · 3 <GTRef k="gold">Gold</GTRef> · 8 <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row"><span>Medium</span><span>1× · 5 <GTRef k="gold">Gold</GTRef> · 15 <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row"><span>Hard</span><span>1.5× · 8 <GTRef k="gold">Gold</GTRef> · 25 <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row"><span>Legendary</span><span>2× · 12 <GTRef k="gold">Gold</GTRef> · 40 <GTRef k="xp">XP</GTRef></span></div>
        <p className="gt-source">Milestones: Bronze (7d), Silver (14d), Gold (21d), Titan (30d), Diamond (60d), Legend (90d).</p>
      </>
    ),
  },

  // ── Campaigns ──
  campaigns: {
    title: "Campaigns",
    icon: "📜",
    accent: "#818cf8",
    body: (
      <>
        <p>Multi-quest storylines that unfold as you progress. Each campaign has sequential stages with escalating rewards.</p>
        <p>Complete all stages to finish the campaign and unlock unique rewards.</p>
        <p className="gt-source">Campaign quests appear alongside regular quests on the Quest Board.</p>
      </>
    ),
  },

  // ── Professions & Crafting ──
  professions: {
    title: "Professions",
    icon: "/images/icons/nav-forge.png",
    accent: "#f59e0b",
    body: (
      <>
        <p>8 professions, choose 2. Your choice determines what you craft and which materials drop from quests.</p>
        <div className="gt-stat-row" style={{ color: "#dc2626" }}><span><GTRef k="prof_waffenschmied">Weaponsmith</GTRef></span><span>Weapons + Shields</span></div>
        <div className="gt-stat-row" style={{ color: "#f59e0b" }}><span><GTRef k="prof_schmied">Blacksmith</GTRef></span><span>Heavy Armor</span></div>
        <div className="gt-stat-row" style={{ color: "#a855f7" }}><span><GTRef k="prof_schneider">Tailor</GTRef></span><span>Cloth Armor</span></div>
        <div className="gt-stat-row" style={{ color: "#b45309" }}><span><GTRef k="prof_lederverarbeiter">Leatherworker</GTRef></span><span>Leather Armor</span></div>
        <div className="gt-stat-row" style={{ color: "#ec4899" }}><span><GTRef k="prof_juwelier">Jewelcrafter</GTRef></span><span>Rings + Amulets</span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span><GTRef k="prof_alchemist">Alchemist</GTRef></span><span>Potions + Transmutes</span></div>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span><GTRef k="prof_koch">Cook</GTRef></span><span>Meals + Feasts</span></div>
        <div className="gt-stat-row" style={{ color: "#6366f1" }}><span><GTRef k="prof_verzauberer">Enchanter</GTRef></span><span>Enchants + Scrolls</span></div>
      </>
    ),
  },
  prof_waffenschmied: {
    title: "Weaponsmith",
    icon: "/images/icons/prof-waffenschmied.png",
    accent: "#dc2626",
    body: (
      <>
        <p>Forges weapons and shields — swords, axes, staves, wands, bucklers, tower shields. The offensive arm of the Guild.</p>
        <div className="gt-stat-row"><span>Crafts</span><span>Weapons + Shields</span></div>
        <div className="gt-stat-row"><span>Materials</span><span>Eisenerz, Kristallsplitter, Drachenschuppe</span></div>
        <div className="gt-stat-row"><span>Highlights</span><span>Schärfsteine, Klinge schärfen, Schild polieren</span></div>
        <p className="gt-source">Shares materials with <GTRef k="prof_schmied">Blacksmith</GTRef> — offense vs defense.</p>
      </>
    ),
  },
  prof_schmied: {
    title: "Blacksmith",
    icon: "🔨",
    accent: "#f59e0b",
    body: (
      <>
        <p>Forges heavy plate armor — helm, armor, boots. The defensive backbone.</p>
        <div className="gt-stat-row"><span>Armor Trait</span><span>Heavy: +1 <GTRef k="ausdauer">Ausdauer</GTRef> per piece</span></div>
        <div className="gt-stat-row"><span>Materials</span><span>Eisenerz, Kristallsplitter, Drachenschuppe</span></div>
        <div className="gt-stat-row"><span>Highlights</span><span>Gewichtsteine, Rüstung verstärken, Barren-Chain</span></div>
        <p className="gt-source">Pairs with: <GTRef k="prof_alchemist">Alchemist</GTRef> (transmutes) or <GTRef k="prof_verzauberer">Enchanter</GTRef> (enchants).</p>
      </>
    ),
  },
  prof_schneider: {
    title: "Tailor",
    icon: "/images/icons/prof-schneider.png",
    accent: "#a855f7",
    body: (
      <>
        <p>Weaves cloth armor — light, flowing, magical. The scholar&apos;s choice.</p>
        <div className="gt-stat-row"><span>Armor Trait</span><span>Cloth: +1% <GTRef k="xp">XP</GTRef> per piece</span></div>
        <div className="gt-stat-row"><span>Materials</span><span>Leinenstoff, Wollstoff, Seidenstoff</span></div>
        <div className="gt-stat-row"><span>Highlights</span><span>Zauberfäden, Glücksfäden, XP-Gewänder</span></div>
        <p className="gt-source">Pairs with: <GTRef k="prof_verzauberer">Enchanter</GTRef> or <GTRef k="prof_alchemist">Alchemist</GTRef>.</p>
      </>
    ),
  },
  prof_lederverarbeiter: {
    title: "Leatherworker",
    icon: "/images/icons/prof-lederverarbeiter.png",
    accent: "#b45309",
    body: (
      <>
        <p>Crafts leather armor from hides and pelts. Balanced between defense and agility.</p>
        <div className="gt-stat-row"><span>Armor Trait</span><span>Leather: +1% <GTRef k="gold">Gold</GTRef> per piece</span></div>
        <div className="gt-stat-row"><span>Materials</span><span>Leichtes Leder, Mittleres Leder, Schweres Leder</span></div>
        <div className="gt-stat-row"><span>Highlights</span><span>Leder-Kits, Köcher, Gold-Beutel</span></div>
        <p className="gt-source">Pairs with: <GTRef k="prof_koch">Cook</GTRef> (shared drops) or <GTRef k="prof_schmied">Blacksmith</GTRef> (trade mats).</p>
      </>
    ),
  },
  prof_alchemist: {
    title: "Alchemist",
    icon: "/images/icons/prof-alchemist.png",
    accent: "#22c55e",
    body: (
      <>
        <p>Brews potions, elixirs, and flasks. Also transmutes materials between professions — turning iron into crystal, linen into wool.</p>
        <div className="gt-stat-row"><span>Materials</span><span>Kräuterbündel, Mondblume, Phoenixfeder</span></div>
        <div className="gt-stat-row"><span>Highlights</span><span>Stat potions, endgame flasks, material transmutes</span></div>
        <p className="gt-source">The universal support. Transmutes help every profession. High-tier transmutes share a 24-48h cooldown.</p>
      </>
    ),
  },
  prof_koch: {
    title: "Cook",
    icon: "/images/icons/prof-koch.png",
    accent: "#ef4444",
    body: (
      <>
        <p>Prepares meals, drinks, and feasts. Feasts buff the entire guild — the most social profession.</p>
        <div className="gt-stat-row"><span>Materials</span><span>Wildfleisch, Feuerwurz, Sternenfrucht</span></div>
        <div className="gt-stat-row"><span>Highlights</span><span>Stat meals, Tee/Wein/Met, guild feasts, instant snacks</span></div>
        <p className="gt-source">Pairs with anything. Feasts are endgame guild support.</p>
      </>
    ),
  },
  prof_verzauberer: {
    title: "Enchanter",
    icon: "/images/icons/prof-verzauberer.png",
    accent: "#6366f1",
    body: (
      <>
        <p>Enchants gear with temporary or permanent stat bonuses. Crafts tradeable scrolls and oils for the guild.</p>
        <div className="gt-stat-row"><span>Materials</span><span>Magiestaub, Runenstein, Aetherkern</span></div>
        <div className="gt-stat-row"><span>Highlights</span><span>Permanent enchants, scrolls, weapon/armor oils</span></div>
        <p className="gt-source">Pairs with: <GTRef k="prof_schmied">Blacksmith</GTRef> or <GTRef k="prof_schneider">Tailor</GTRef> (enchant your own gear).</p>
      </>
    ),
  },
  prof_juwelier: {
    title: "Jewelcrafter",
    icon: "💎",
    accent: "#ec4899",
    body: (
      <>
        <p>Crafts rings, amulets, and cut gems. The only profession linked to the gem socket system.</p>
        <div className="gt-stat-row"><span>Crafts</span><span>Rings (unique slot) + Amulets + Cut Gems</span></div>
        <div className="gt-stat-row"><span>Materials</span><span>Kristallsplitter, Runenstein, Aetherkern</span></div>
        <div className="gt-stat-row"><span>Highlights</span><span>Gem cutting, gem merging, Glück/Charisma focus</span></div>
        <p className="gt-source">The luxury profession. Rings and amulets boost stats no other profession covers.</p>
      </>
    ),
  },
  recipes: {
    title: "Recipes",
    icon: "📖",
    accent: "#f59e0b",
    body: (
      <>
        <p>Crafting instructions learned as your profession rank increases. Each recipe requires <GTRef k="gold">Gold</GTRef> and <GTRef k="materials">Materials</GTRef>.</p>
        <p>Skill-up chance shown by color:</p>
        <div className="gt-stat-row" style={{ color: "#f97316" }}><span>Orange</span><span>Guaranteed skill-up</span></div>
        <div className="gt-stat-row" style={{ color: "#eab308" }}><span>Yellow</span><span>High chance</span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Green</span><span>Low chance</span></div>
        <div className="gt-stat-row" style={{ color: "#6b7280" }}><span>Gray</span><span>No skill-up possible</span></div>
      </>
    ),
  },
  schmiedekunst: {
    title: "Schmiedekunst (Salvage)",
    icon: "🔨",
    accent: "#ef4444",
    body: (
      <>
        <p>Dismantle items into <GTRef k="essenz">Essenz</GTRef> + <GTRef k="materials">Materials</GTRef>. Higher rarity items yield more.</p>
        <p><strong>Transmutation:</strong> Combine 3 same-slot Epic items + 500 <GTRef k="gold">Gold</GTRef> → 1 Legendary item (slot-locked).</p>
        <p className="gt-source">Salvage All: bulk-dismantle by rarity tier.</p>
      </>
    ),
  },
  materials: {
    title: "Crafting Materials",
    icon: "/images/icons/mat-eisenerz.png",
    accent: "#f59e0b",
    body: (
      <>
        <p>13 materials from quest drops, scaling in rarity from Common to Legendary.</p>
        <div className="gt-stat-row" style={{ color: "#9ca3af" }}><span>Common</span><span>Iron Ore, Herb Bundle</span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Uncommon</span><span>Arcane Dust, Beast Hide</span></div>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>Rare</span><span>Moonpetal, Crystal Shard</span></div>
        <div className="gt-stat-row" style={{ color: "#a855f7" }}><span>Epic</span><span>Void Essence, Dragonscale</span></div>
        <div className="gt-stat-row" style={{ color: "#FFD700" }}><span>Legendary</span><span>Stardust Fragment</span></div>
        <p className="gt-source">Drop chance increased by <GTRef k="glueck">Glück</GTRef> stat and Material Magnet upgrade.</p>
      </>
    ),
  },

  // ── Equipment & Inventory ──
  gear: {
    title: "Gear & Equipment",
    icon: "🛡️",
    accent: "#3b82f6",
    body: (
      <>
        <p>Equip items in 7 slots: Helm, Armor, Boots, Weapon, Shield, Amulet, Ring. Each item has primary + minor stat <GTRef k="affixes">affixes</GTRef>.</p>
        <div className="gt-stat-row"><span><GTRef k="set_bonus">Set Bonuses</GTRef></span><span>4/7 or 7/7 tier match</span></div>
        <div className="gt-stat-row"><span><GTRef k="legendary_effects">Legendary Effects</GTRef></span><span>Unique passives on gold items</span></div>
        <p className="gt-source">Gear drops from quest completions. <GTRef k="glueck">Glück</GTRef> stat increases drop chance.</p>
      </>
    ),
  },
  gems: {
    title: "Gem & Socket System",
    icon: "/images/icons/currency-stardust.png",
    accent: "#a855f7",
    body: (
      <>
        <p>Socket gems into gear to gain bonus stats. 6 gem types, 5 tiers from Chipped to Royal.</p>
        <div className="gt-stat-row"><span>Ruby</span><span>+<GTRef k="kraft">Kraft</GTRef></span></div>
        <div className="gt-stat-row"><span>Sapphire</span><span>+<GTRef k="weisheit">Weisheit</GTRef></span></div>
        <div className="gt-stat-row"><span>Emerald</span><span>+<GTRef k="glueck">Glück</GTRef></span></div>
        <div className="gt-stat-row"><span>Topaz</span><span>+<GTRef k="ausdauer">Ausdauer</GTRef></span></div>
        <div className="gt-stat-row"><span>Amethyst</span><span>+Vitalität</span></div>
        <div className="gt-stat-row"><span>Diamond</span><span>+Fokus</span></div>
        <p className="gt-source">Upgrade gems in-place. Salvage to recover lower tiers. Socket via the Gems tab in Character.</p>
      </>
    ),
  },
  affixes: {
    title: "Gear Affixes",
    icon: "✦",
    accent: "#3b82f6",
    body: (
      <>
        <p>Stats rolled on gear items. Values are random within a range per rarity tier.</p>
        <p><strong>Primary:</strong> <GTRef k="kraft">Kraft</GTRef>, <GTRef k="ausdauer">Ausdauer</GTRef>, <GTRef k="weisheit">Weisheit</GTRef>, <GTRef k="glueck">Glück</GTRef></p>
        <p><strong>Minor:</strong> <GTRef k="fokus">Fokus</GTRef>, <GTRef k="vitalitaet">Vitalität</GTRef>, <GTRef k="charisma">Charisma</GTRef>, <GTRef k="tempo">Tempo</GTRef></p>
        <p className="gt-source">Higher rarity → more affixes and higher value ranges.</p>
      </>
    ),
  },
  inventory: {
    title: "Inventory",
    icon: "🎒",
    accent: "#f59e0b",
    body: (
      <>
        <p>Your item storage. Gear, consumables, and passive items. Drag to reorder, click to equip or use.</p>
        <p>Filters: All, Gear, Consumables, Passive. Sort by rarity, level, or default position.</p>
        <p className="gt-source">Discard unwanted items or salvage them in <GTRef k="schmiedekunst">Schmiedekunst</GTRef>.</p>
      </>
    ),
  },

  // ── Achievements & Titles ──
  achievements: {
    title: "Hall of Honors",
    icon: "🏅",
    accent: "#fbbf24",
    body: (
      <>
        <p>Track your accomplishments. Achievements award points based on rarity:</p>
        <div className="gt-stat-row" style={{ color: "#9ca3af" }}><span>Common</span><span>5 pts</span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Uncommon</span><span>10 pts</span></div>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>Rare</span><span>25 pts</span></div>
        <div className="gt-stat-row" style={{ color: "#a855f7" }}><span>Epic</span><span>50 pts</span></div>
        <div className="gt-stat-row" style={{ color: "#FFD700" }}><span>Legendary</span><span>100 pts</span></div>
        <p className="gt-source">Point milestones unlock cosmetic frame upgrades for your player card.</p>
      </>
    ),
  },
  titles: {
    title: "Titles",
    icon: "👑",
    accent: "#fbbf24",
    body: (
      <>
        <p>Honorific titles earned through gameplay milestones. Equip a title to display it on your player card and leaderboard entry.</p>
        <p className="gt-source">Titles are earned from achievements, streaks, expeditions, and special events.</p>
      </>
    ),
  },

  // ── Level & Classes ──
  player_level: {
    title: "Player Level",
    icon: "⬆️",
    accent: "#a855f7",
    body: (
      <>
        <p>Earn <GTRef k="xp">XP</GTRef> from quests to level up (max 50). Each level requires exponentially more <GTRef k="xp">XP</GTRef>.</p>
        <p>Level-ups grant <GTRef k="stardust">Stardust</GTRef> (5 + level) and unlock new features:</p>
        <div className="gt-stat-row"><span>Lv 5</span><span>Talent tree unlocked</span></div>
        <div className="gt-stat-row"><span>Lv 10</span><span>Rift access</span></div>
        <div className="gt-stat-row"><span>Professions</span><span>2 primary slots + Koch/Enchanter free</span></div>
      </>
    ),
  },
  classes: {
    title: "Character Classes",
    icon: "⚔️",
    accent: "#ef4444",
    body: (
      <>
        <p>Choose a class path to specialize your playstyle. Each class offers unique bonuses and quest affinities.</p>
        <p className="gt-source">Class quests and skill trees coming soon (The Arcanum).</p>
      </>
    ),
  },

  // ── Weekly Challenge Subtypes ──
  sternenpfad: {
    title: "Star Path (Sternenpfad)",
    icon: "/images/icons/nav-challenges.png",
    accent: "#fbbf24",
    body: (
      <>
        <p>Solo weekly challenge with 3 stages. Earn 1-3 stars per stage (max 9★). Speed bonus: +1★ if completed within 2 days.</p>
        <div className="gt-stat-row"><span>2★ stage</span><span>+15% bonus rewards</span></div>
        <div className="gt-stat-row"><span>3★ stage</span><span>+33% bonus rewards</span></div>
        <p className="gt-source">Weekly modifiers: +50% or -25% to specific quest types. Rewards <GTRef k="sternentaler">Sternentaler</GTRef>.</p>
      </>
    ),
  },
  expedition: {
    title: "Expedition",
    icon: "/images/icons/expedition-generic.png",
    accent: "#22c55e",
    body: (
      <>
        <p>Cooperative weekly challenge. All registered players contribute quests toward shared checkpoints.</p>
        <p>Scales with player count — active players compensate for inactive ones.</p>
        <div className="gt-stat-row"><span>3 checkpoints</span><span>Increasing rewards</span></div>
        <div className="gt-stat-row"><span>Bonus checkpoint</span><span>Rotating title reward</span></div>
        <p className="gt-source">No per-player cap. More completions = faster progress for everyone.</p>
      </>
    ),
  },

  // ── Shop ──
  bazaar: {
    title: "The Bazaar",
    icon: "🏪",
    accent: "#f59e0b",
    body: (
      <>
        <p>Two categories of items purchasable with <GTRef k="gold">Gold</GTRef>:</p>
        <p><strong>Self-Care Rewards:</strong> Real-world treats (gaming time, movie night, spa day) — motivational rewards for your effort.</p>
        <p><strong>Boosts &amp; Buffs:</strong> Temporary gameplay effects (<GTRef k="xp">XP</GTRef> scrolls, luck coins, <GTRef k="streak">streak</GTRef> shields) applied server-side on purchase.</p>
        <p className="gt-source">Buff durations and effects vary by item tier.</p>
      </>
    ),
  },

  // ── Gacha Banners ──
  gacha_banners: {
    title: "Gacha Banners",
    icon: "🎰",
    accent: "#a78bfa",
    body: (
      <>
        <p>Two banner types in the <GTRef k="vault_of_fate">Vault of Fate</GTRef>:</p>
        <div className="gt-stat-row"><span>Wheel of Stars</span><span>Standard · costs <GTRef k="runensplitter">Rune Shards</GTRef></span></div>
        <div className="gt-stat-row"><span>Astral Radiance</span><span>Featured · costs <GTRef k="stardust">Stardust</GTRef></span></div>
        <p>Featured banners have a 50/50 system: lose the coin flip once, and your next Legendary is guaranteed to be the featured item.</p>
        <p className="gt-source"><GTRef k="pity">Pity</GTRef> counter is tracked separately per banner.</p>
      </>
    ),
  },

  // ── Mondstaub ──
  mondstaub: {
    title: "Mondstaub (Moondust)",
    icon: "🌙",
    accent: "#c084fc",
    body: (
      <>
        <p>The rarest currency. Only obtainable through extreme consistency — long <GTRef k="streak">Streak</GTRef> milestones and rare events.</p>
        <p className="gt-source">Reserved for limited rewards. Not convertible to other currencies.</p>
      </>
    ),
  },

  // ── Modifiers & Multipliers ──
  modifiers: {
    title: "Active Modifiers",
    icon: "📊",
    accent: "#a78bfa",
    body: (
      <>
        <p>Your current <GTRef k="xp">XP</GTRef> and <GTRef k="gold">Gold</GTRef> multipliers. These combine all active bonuses:</p>
        <div className="gt-stat-row"><span><GTRef k="forge_temp">Forge Temp</GTRef></span><span>×0.6 to ×1.25</span></div>
        <div className="gt-stat-row"><span><GTRef k="streak">Streak</GTRef></span><span>up to ~+20% <GTRef k="gold">Gold</GTRef></span></div>
        <div className="gt-stat-row"><span><GTRef k="gear">Gear</GTRef> Stats</span><span><GTRef k="kraft">Kraft</GTRef>, <GTRef k="weisheit">Weisheit</GTRef></span></div>
        <div className="gt-stat-row"><span>Buffs</span><span>Shop scrolls, potions</span></div>
        <div className="gt-stat-row"><span><GTRef k="hoarding">Hoarding</GTRef></span><span>Penalty if 20+ quests</span></div>
        <p className="gt-source">Hover over individual modifiers in the details panel for breakdowns.</p>
      </>
    ),
  },
  active_quests: {
    title: "Active Quests",
    icon: "📋",
    accent: "#6366f1",
    body: (
      <>
        <p>Quests you&apos;ve claimed from the <GTRef k="quest_board">Quest Board</GTRef>. Complete them to earn <GTRef k="xp">XP</GTRef>, <GTRef k="gold">Gold</GTRef>, and loot drops.</p>
        <div className="gt-stat-row"><span>Soft cap</span><span>20 active quests</span></div>
        <div className="gt-stat-row"><span>Hard cap</span><span>~25 in-progress max</span></div>
        <p className="gt-source">Exceeding 20 active quests triggers the <GTRef k="hoarding">Hoarding Penalty</GTRef>.</p>
      </>
    ),
  },

  // ── Rift Details ──
  rift_tiers: {
    title: "Rift Difficulty Tiers",
    icon: "⚡",
    accent: "#a855f7",
    body: (
      <>
        <p>Choose a tier when entering <GTRef k="rift">The Rift</GTRef>. Higher tiers are harder but give better rewards.</p>
        <div className="gt-stat-row"><span>Normal</span><span>3 quests · 72h · 1×-1.5× diff</span></div>
        <div className="gt-stat-row"><span>Hard</span><span>5 quests · 48h · 1.5×-2.5× diff</span></div>
        <div className="gt-stat-row" style={{ color: "#FFD700" }}><span>Legendary</span><span>7 quests · 36h · 2×-3.5× diff</span></div>
        <p className="gt-source">Failure triggers a cooldown: Normal 3d, Hard 5d, Legendary 7d.</p>
      </>
    ),
  },
  rift_cooldown: {
    title: "Rift Cooldown",
    icon: "⏳",
    accent: "#ef4444",
    body: (
      <>
        <p>After failing or abandoning a <GTRef k="rift">Rift</GTRef> run, a cooldown prevents re-entry.</p>
        <div className="gt-stat-row"><span>Normal fail</span><span>3 day cooldown</span></div>
        <div className="gt-stat-row"><span>Hard fail</span><span>5 day cooldown</span></div>
        <div className="gt-stat-row"><span>Legendary fail</span><span>7 day cooldown</span></div>
        <p className="gt-source">Completing a run successfully has no cooldown — enter again immediately.</p>
      </>
    ),
  },

  // ── Rest & Tavern ──
  rest_freeze: {
    title: "Rest Mode Effects",
    icon: "❄️",
    accent: "#60a5fa",
    body: (
      <>
        <p>While resting at <GTRef k="hearth">The Hearth</GTRef>, the following are frozen:</p>
        <div className="gt-stat-row"><span><GTRef k="streak">Streak</GTRef></span><span>Paused — won&apos;t decay</span></div>
        <div className="gt-stat-row"><span><GTRef k="forge_temp">Forge Temp</GTRef></span><span>Paused — won&apos;t decay</span></div>
        <div className="gt-stat-row"><span>Quest generation</span><span>Disabled during rest</span></div>
        <div className="gt-stat-row"><span>Duration</span><span>1-7 days (auto-expires)</span></div>
        <p className="gt-source">30-day cooldown after rest ends. You can leave early.</p>
      </>
    ),
  },

  // ── Social Features ──
  trading: {
    title: "Trading",
    icon: "🔄",
    accent: "#f59e0b",
    body: (
      <>
        <p>Exchange items and <GTRef k="gold">Gold</GTRef> with friends in <GTRef k="breakaway">The Breakaway</GTRef>.</p>
        <p>Both players propose offers, then negotiate back and forth until both accept.</p>
        <p className="gt-source">Item rarity colors and stat tooltips are shown during trade preview.</p>
      </>
    ),
  },
  messages: {
    title: "Messages",
    icon: "💬",
    accent: "#818cf8",
    body: (
      <>
        <p>Direct messages with friends in <GTRef k="breakaway">The Breakaway</GTRef>.</p>
        <p>Messages have auto-read receipts: ✓ = sent, ✓✓ = read.</p>
        <p className="gt-source">Keep conversations going to strengthen your social connections.</p>
      </>
    ),
  },
  activity_feed: {
    title: "Activity Feed",
    icon: "📰",
    accent: "#10b981",
    body: (
      <>
        <p>Activity feed showing your friends&apos; recent achievements and actions:</p>
        <div className="gt-stat-row"><span>Quest completions</span><span>All rarities</span></div>
        <div className="gt-stat-row"><span>Level-ups</span><span>Major milestones</span></div>
        <div className="gt-stat-row"><span><GTRef k="achievements">Achievements</GTRef></span><span>New unlocks</span></div>
        <div className="gt-stat-row"><span>Gacha pulls</span><span>Epic+ only</span></div>
        <div className="gt-stat-row"><span>Rare drops &amp; trades</span><span>Notable items</span></div>
        <p className="gt-source">Toggle compact/detailed view. Capped at 500 events.</p>
      </>
    ),
  },
  friends: {
    title: "Friends",
    icon: "👥",
    accent: "#818cf8",
    body: (
      <>
        <p>Add friends to see their status, send <GTRef k="messages">messages</GTRef>, propose <GTRef k="trading">trades</GTRef>, and follow their <GTRef k="activity_feed">activity</GTRef>.</p>
        <div className="gt-stat-row"><span>🟢 Online</span><span>Active now</span></div>
        <div className="gt-stat-row"><span>🟡 Idle</span><span>Recently active</span></div>
        <div className="gt-stat-row"><span>⚫ Offline</span><span>Not active</span></div>
        <p className="gt-source">Search for players by name to send friend requests.</p>
      </>
    ),
  },

  // ── Campaign Details ──
  campaign_stages: {
    title: "Campaign Stages",
    icon: "🗺️",
    accent: "#818cf8",
    body: (
      <>
        <p>Each <GTRef k="campaigns">Campaign</GTRef> has sequential quest stages. Complete the current stage to unlock the next.</p>
        <p>Stage rewards escalate — later stages grant more <GTRef k="xp">XP</GTRef>, <GTRef k="gold">Gold</GTRef>, and unique drops.</p>
        <p className="gt-source">Some campaigns feature a Boss Quest as the final stage.</p>
      </>
    ),
  },

  // ── Quest Details ──
  quest_types: {
    title: "Quest Types",
    icon: "/images/icons/ui-quest-scroll.png",
    accent: "#6366f1",
    body: (
      <>
        <p>Quests are categorized by type, affecting which <GTRef k="weekly_challenges">weekly modifiers</GTRef> apply:</p>
        <div className="gt-stat-row"><span>🧘 Personal</span><span>Self-care, organization</span></div>
        <div className="gt-stat-row"><span>📚 Learning</span><span>Study, skills, reading</span></div>
        <div className="gt-stat-row"><span>💪 Fitness</span><span>Exercise, health</span></div>
        <div className="gt-stat-row"><span>👥 Social</span><span>Friends, community</span></div>
        <div className="gt-stat-row"><span>💻 Development</span><span>Coding, career, projects</span></div>
        <div className="gt-stat-row"><span>⚔️ Boss</span><span>Multi-hour challenges</span></div>
      </>
    ),
  },
  quest_difficulty: {
    title: "Quest Difficulty",
    icon: "📈",
    accent: "#f59e0b",
    body: (
      <>
        <p>Quest difficulty affects <GTRef k="xp">XP</GTRef> and <GTRef k="gold">Gold</GTRef> rewards. Higher difficulty = greater rewards but harder tasks.</p>
        <p>Difficulty is set when a quest is created and cannot be changed afterward.</p>
        <p className="gt-source">Combined with <GTRef k="rarity">Rarity</GTRef> to determine final reward values.</p>
      </>
    ),
  },

  // ── Leaderboard ──
  leaderboard_rank: {
    title: "Leaderboard Rank",
    icon: "🏆",
    accent: "#fbbf24",
    body: (
      <>
        <p>Your position on <GTRef k="proving_grounds">The Proving Grounds</GTRef> based on total <GTRef k="xp">XP</GTRef> earned.</p>
        <div className="gt-stat-row" style={{ color: "#FFD700" }}><span>🥇 1st</span><span>Gold medal</span></div>
        <div className="gt-stat-row" style={{ color: "#C0C0C0" }}><span>🥈 2nd</span><span>Silver medal</span></div>
        <div className="gt-stat-row" style={{ color: "#CD7F32" }}><span>🥉 3rd</span><span>Bronze medal</span></div>
        <p className="gt-source">Level, <GTRef k="titles">Title</GTRef>, and <GTRef k="achievements">Achievement Points</GTRef> are displayed alongside your rank.</p>
      </>
    ),
  },

  // ── Seasons ──
  seasons: {
    title: "Seasons",
    icon: "🌿",
    accent: "#10b981",
    body: (
      <>
        <p>The world of Quest Hall changes with the seasons. Each season brings unique modifiers, themed quests, and exclusive rewards.</p>
        <p className="gt-source">Season badges show the current active season and its theme.</p>
      </>
    ),
  },

  // ── Factions ──
  factions: {
    title: "The Four Circles",
    icon: "🜂",
    accent: "#a78bfa",
    body: (
      <>
        <p>Secret orders of the tower. Quests automatically grant reputation to the matching faction.</p>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>🔥 Circle of Embers</span><span>Fitness</span></div>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>📜 Circle of Ink</span><span>Learning</span></div>
        <div className="gt-stat-row" style={{ color: "#f59e0b" }}><span>⚒️ Circle of the Anvil</span><span>Dev / Personal</span></div>
        <div className="gt-stat-row" style={{ color: "#8b5cf6" }}><span>🌊 Circle of Echoes</span><span>Social / Creative</span></div>
        <p className="gt-source">6 tiers: Neutral → Friendly → Honored → Revered → Exalted → Paragon. Each tier unlocks titles, recipes, frames, and bonuses.</p>
      </>
    ),
  },

  // ── Battle Pass ──
  battle_pass: {
    title: "Season Pass",
    icon: "🌅",
    accent: "#a78bfa",
    body: (
      <>
        <p>Saisonaler Fortschrittstrack mit 40 Stufen. Verdiene Pass-<GTRef k="xp">XP</GTRef> durch alle Aktivitäten:</p>
        <div className="gt-stat-row"><span>Quests</span><span>10-60 XP nach <GTRef k="rarity">Rarität</GTRef></span></div>
        <div className="gt-stat-row"><span><GTRef k="rituals">Rituale</GTRef></span><span>8 XP</span></div>
        <div className="gt-stat-row"><span><GTRef k="rift">Rift</GTRef> Stufe</span><span>20 XP</span></div>
        <div className="gt-stat-row"><span><GTRef k="daily_missions">Daily Missions</GTRef></span><span>10-30 XP</span></div>
        <div className="gt-stat-row"><span>Crafting</span><span>5 XP</span></div>
        <p className="gt-source">250 XP pro Level. Belohnungen: <GTRef k="gold">Gold</GTRef>, <GTRef k="essenz">Essenz</GTRef>, <GTRef k="runensplitter">Runensplitter</GTRef>, <GTRef k="titles">Titel</GTRef>, Frames, <GTRef k="mondstaub">Mondstaub</GTRef>.</p>
      </>
    ),
  },
  // ─── v1.6.0 Systems ────────────────────────────────────────────────────────
  mail: {
    title: "Mail",
    icon: "✉",
    accent: "#a855f7",
    body: (
      <>
        <p>Sende Gold und Items an andere Spieler. 5 Gold Portogebühr pro Mail.</p>
        <div className="gt-stat-row"><span>Max Anhänge</span><span>6 Items pro Mail</span></div>
        <div className="gt-stat-row"><span>Inbox-Limit</span><span>50 Mails</span></div>
        <div className="gt-stat-row"><span>Ablaufzeit</span><span>30 Tage</span></div>
        <p className="gt-source">Soulbound-Items (<GTRef k="binding">BoP</GTRef>) und gesperrte Items können nicht verschickt werden.</p>
      </>
    ),
  },
  binding: {
    title: "Item Binding",
    icon: "⛓",
    accent: "#ef4444",
    body: (
      <>
        <p>Items können gebunden sein — gebundene Items können nicht gehandelt oder verschickt werden.</p>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Bind on Equip (BoE)</span><span>Frei handelbar bis zum ersten Anlegen</span></div>
        <div className="gt-stat-row" style={{ color: "#f97316" }}><span>Bind on Pickup (BoP)</span><span>Sofort gebunden beim Erhalt</span></div>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>Soulbound</span><span>Bereits getragen — permanent gebunden</span></div>
        <p className="gt-source">Crafted + General Pool Items sind BoE. Dungeon, Rift, World Boss und Unique Items sind BoP.</p>
      </>
    ),
  },
  item_lock: {
    title: "Item Lock",
    icon: "⦿",
    accent: "#fbbf24",
    body: (
      <>
        <p>Sperre Items um sie vor versehentlichem Salvage, Trade oder Discard zu schützen.</p>
        <p className="gt-source">Klicke auf ein Item im Inventar, dann auf &quot;Lock&quot;. Gesperrte Items zeigen ein goldenes ⦿ Symbol.</p>
      </>
    ),
  },
  kanais_cube: {
    title: "Ätherwürfel",
    icon: "⬡",
    accent: "#f97316",
    body: (
      <>
        <p>Opfere ein Legendary-Item um seinen Effekt permanent zu extrahieren. Kosten: 500 <GTRef k="essenz">Essenz</GTRef>.</p>
        <div className="gt-stat-row"><span>Offensive Slot</span><span>XP, Gold, Crit, Berserker</span></div>
        <div className="gt-stat-row"><span>Defensive Slot</span><span>Streak, Decay, Shield, Fortify</span></div>
        <div className="gt-stat-row"><span>Utility Slot</span><span>Drop, Material, Cooldown, Gem</span></div>
        <p className="gt-source">Effekte werden zum Minimum-Wert extrahiert. Stackt additiv mit Gear-Effekten.</p>
      </>
    ),
  },
  mythic_affixes: {
    title: "Mythic+ Affixes",
    icon: "☠",
    accent: "#ff4444",
    body: (
      <>
        <p>Ab Mythic+2 werden wöchentlich 2 zufällige Affixe aktiv die den Rift verändern.</p>
        <div className="gt-stat-row"><span>Minor (M+2)</span><span>Tyrannisch, Verstärkt, Blutrünstig, Vulkanisch, Explosiv</span></div>
        <div className="gt-stat-row"><span>Major (M+4/7)</span><span>Anspornend, Rasend, Nekrotisch, Inspirierend, Bebend</span></div>
        <p className="gt-source">Affixe rotieren jeden Montag. Reward-Multiplier kompensieren die Schwierigkeit.</p>
      </>
    ),
  },
  auto_salvage: {
    title: "Auto-Salvage",
    icon: "⚒",
    accent: "#ff8c00",
    body: (
      <>
        <p>Bulk-Salvage aller Items einer Rarität auf einen Klick. Vorschau zeigt betroffene Items + geschätzte Erträge.</p>
        <p className="gt-source">Gesperrte Items werden automatisch übersprungen. 2-Schritt-Bestätigung verhindert Unfälle.</p>
      </>
    ),
  },
  material_storage: {
    title: "Material Storage",
    icon: "◇",
    accent: "#22c55e",
    body: (
      <>
        <p>Separater Materiallager-Tab im Artisan&apos;s Quarter. Materials zählen nicht gegen das Inventar-Cap von 100.</p>
        <p className="gt-source">Suchfunktion und Sortierung nach Rarität. Automatisch gesammelt bei Quest-Completion und Salvage.</p>
      </>
    ),
  },
  enchant_vellum: {
    title: "Enchant Vellum",
    icon: "📜",
    accent: "#a78bfa",
    body: (
      <>
        <p>Handelbare Verzauberungs-Pergamente. Vom Verzauberer hergestellt, können als Buff angewendet oder an andere Spieler gehandelt/geschickt werden.</p>
        <div className="gt-stat-row"><span>Schwach (Skill 50)</span><span>+2-3 Stat, 24h</span></div>
        <div className="gt-stat-row"><span>Mittel (Skill 125)</span><span>+3-5 Stat, 24h</span></div>
        <div className="gt-stat-row"><span>Stark (Skill 225)</span><span>+4-7 Stat, 48h</span></div>
      </>
    ),
  },
  // ─── v1.6.0 Character Screen Explanations ──────────────────────────────────
  hero_numbers: {
    title: "Combat Metrics",
    icon: "◆",
    accent: "#f0f0f0",
    body: (
      <>
        <p>Drei abgeleitete Kampfwerte basierend auf deinen Stats und Gear Score:</p>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>Offense</span><span>Kraft + Gear Score + Fokus</span></div>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>Defense</span><span>Ausdauer + Vitalität + Gear Score</span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Utility</span><span>Weisheit + Glück + Charisma + Tempo</span></div>
        <p className="gt-source">Höhere Werte = bessere Performance in Rifts, Dungeons und bei World Bosses.</p>
      </>
    ),
  },
  roll_quality: {
    title: "Roll Quality",
    icon: "◆",
    accent: "#eab308",
    body: (
      <>
        <p>Zeigt wie gut die zufällig gewürfelten Stats eines Items im Vergleich zum Maximum sind.</p>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Perfect (90%+)</span><span>Nahezu maximale Rolls</span></div>
        <div className="gt-stat-row" style={{ color: "#eab308" }}><span>Good (70-89%)</span><span>Überdurchschnittlich</span></div>
        <div className="gt-stat-row" style={{ color: "#f97316" }}><span>Average (50-69%)</span><span>Durchschnittlich</span></div>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>Low (&lt;50%)</span><span>Unterdurchschnittlich — Reforge empfohlen</span></div>
      </>
    ),
  },
  companion_ultimate: {
    title: "Companion Ultimate",
    icon: "◆",
    accent: "#f59e0b",
    body: (
      <>
        <p>Ab Bond Level 5 schaltet dein Companion eine Ultimate-Fähigkeit frei:</p>
        <div className="gt-stat-row"><span>Instant Complete</span><span>Schließt die nächste Solo-Quest sofort ab</span></div>
        <div className="gt-stat-row"><span>Double Reward</span><span>Verdoppelt XP + Gold der nächsten Quest</span></div>
        <div className="gt-stat-row"><span>Streak Extend</span><span>+3 Tage auf deinen aktuellen Streak</span></div>
        <p className="gt-source">Cooldown: 7 Tage nach Verwendung. Welche Fähigkeit dein Companion hat hängt vom Typ ab.</p>
      </>
    ),
  },
  companion_expedition: {
    title: "Companion Expedition",
    icon: "◆",
    accent: "#22c55e",
    body: (
      <>
        <p>Schicke deinen Companion auf eine zeitbasierte Expedition für passive Belohnungen.</p>
        <div className="gt-stat-row"><span>Quick Forage</span><span>4h — Gold + Materials</span></div>
        <div className="gt-stat-row"><span>Deep Woods</span><span>8h — Bessere Belohnungen</span></div>
        <div className="gt-stat-row"><span>Mountain Pass</span><span>12h — Seltene Materials</span></div>
        <div className="gt-stat-row"><span>Ancient Ruins</span><span>24h — Beste Belohnungen inkl. Gems</span></div>
        <p className="gt-source">Bond Level multipliziert Gold-Rewards. 1h Cooldown zwischen Expeditionen. Kein Bond XP während Expedition.</p>
      </>
    ),
  },
  bp_xp_sources: {
    title: "Season Pass XP",
    icon: "◆",
    accent: "#a78bfa",
    body: (
      <>
        <p>Diese Aktivitäten geben Season Pass XP:</p>
        <div className="gt-stat-row"><span>Quests</span><span>10-60 XP nach Rarität</span></div>
        <div className="gt-stat-row"><span>Rituale</span><span>8 XP</span></div>
        <div className="gt-stat-row"><span>Rift Stufe</span><span>20 XP</span></div>
        <div className="gt-stat-row"><span>Crafting</span><span>5 XP</span></div>
        <div className="gt-stat-row"><span>Daily Missions</span><span>10-30 XP</span></div>
        <p className="gt-source">250 XP pro Level. 40 Level pro Season.</p>
      </>
    ),
  },
  wb_claim_tiers: {
    title: "World Boss Rewards",
    icon: "◆",
    accent: "#ef4444",
    body: (
      <>
        <p>Belohnungen basieren auf deinem prozentualen Schadensanteil am Boss:</p>
        <div className="gt-stat-row"><span>Legendary (Top 3)</span><span>Unique Items + maximale Rewards</span></div>
        <div className="gt-stat-row"><span>Gold (Top 10)</span><span>Gear Drops + hohe Currency</span></div>
        <div className="gt-stat-row"><span>Silver (Top 25%)</span><span>Moderate Rewards</span></div>
        <div className="gt-stat-row"><span>Bronze (Rest)</span><span>Basis-Rewards für Teilnahme</span></div>
        <p className="gt-source">Gear Score multipliziert deinen Schaden: +10% pro 50 GS, max +100%.</p>
      </>
    ),
  },
  compare_mode: {
    title: "Compare Mode",
    icon: "◆",
    accent: "#60a5fa",
    body: (
      <>
        <p>Vergleiche Items direkt gegeneinander:</p>
        <p>1. Klicke &quot;Compare&quot; über dem Inventar</p>
        <p>2. Klicke ein Item zum Anpinnen</p>
        <p>3. Alle anderen Items zeigen jetzt Stat-Vergleiche (▲▼) gegen das angepinnte Item</p>
        <p className="gt-source">Klicke das angepinnte Item erneut zum Lösen. &quot;Exit Compare&quot; beendet den Modus.</p>
      </>
    ),
  },
  mondlicht: {
    title: "Mondlicht-Schmiede",
    icon: "◆",
    accent: "#818cf8",
    body: (
      <>
        <p>Zwischen 22:00 und 06:00 Uhr (Berlin) ist der Aetherstrom ruhiger. Items, die in dieser Zeit gecraftet werden, erhalten +20 % bessere Minimum-Rolls auf alle Stats.</p>
        <p className="gt-source">Effektiv: Die unterste Grenze jedes Stat-Rolls wird angehoben. Maximum bleibt gleich — aber schlechte Rolls werden seltener.</p>
      </>
    ),
  },
  armor_types: {
    title: "Rüstungstypen",
    icon: "◆",
    accent: "#f59e0b",
    body: (
      <>
        <p>Drei Rüstungstypen mit unterschiedlichen Boni:</p>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>Stoff (Schneider)</span><span>+1% XP pro Stoffteil</span></div>
        <div className="gt-stat-row" style={{ color: "#b45309" }}><span>Leder (Lederverarbeiter)</span><span>+1% Gold pro Lederteil</span></div>
        <div className="gt-stat-row" style={{ color: "#9ca3af" }}><span>Schwer (Schmied)</span><span>+1 Ausdauer pro Schwerteil</span></div>
        <p className="gt-source">Ein voller Satz (5+ Teile) eines Typs gibt spürbaren Bonus. Mische nur wenn du die Stats brauchst.</p>
      </>
    ),
  },
  // ── New Features ──
  talent_tree: {
    title: "Schicksalsbaum (Talent Tree)",
    icon: "/images/icons/nav-talents.png",
    accent: "#a855f7",
    body: (
      <>
        <p>Passive skill tree with 44 nodes in 3 concentric rings. Allocate points to unlock permanent bonuses.</p>
        <div className="gt-stat-row"><span>Unlock</span><span>Level 5</span></div>
        <div className="gt-stat-row"><span>Points</span><span>1 per 2 levels (max 23)</span></div>
        <div className="gt-stat-row"><span>Rings</span><span>Inner (12) · Middle (18) · Outer (14)</span></div>
        <div className="gt-stat-row"><span>Reset</span><span>500 Gold + 50 Essenz</span></div>
        <p className="gt-source">Some nodes are mutually exclusive — choose wisely. Build archetypes: Grinder, Crafter, Gambler, Social, Rift Runner.</p>
      </>
    ),
  },
  adventure_tome: {
    title: "Abenteuerbuch (Adventure Tome)",
    icon: "/images/icons/nav-tome.png",
    accent: "#f97316",
    body: (
      <>
        <p>Completionist tracker for every floor of the tower. Complete objectives to fill the progress bar and claim milestone rewards.</p>
        <div className="gt-stat-row"><span>Floors</span><span>5 (Great Halls → Pinnacle)</span></div>
        <div className="gt-stat-row"><span>Milestones</span><span>25% · 50% · 75% · 100%</span></div>
        <div className="gt-stat-row"><span>Rewards</span><span>Gold, Essenz, Runensplitter, Titles, Frames</span></div>
        <p className="gt-source">100% a floor to earn its exclusive title. 100% all floors for the ultimate Turmkronenwächter title + frame.</p>
      </>
    ),
  },
  bonus_stacking: {
    title: "Bonus Stacking",
    icon: "◈",
    accent: "#818cf8",
    body: (
      <>
        <p>Boni derselben Kategorie (z.B. mehrere Gear-Boni) werden <strong>additiv</strong> zusammengerechnet. Boni verschiedener Kategorien (Forge, Gear, Companion, Buffs) werden <strong>multiplikativ</strong> miteinander verrechnet.</p>
        <div className="gt-stat-row"><span>Gleiche Kategorie</span><span>Additiv (+5% + +3% = +8%)</span></div>
        <div className="gt-stat-row"><span>Verschiedene Kategorien</span><span>Multiplikativ (1.08 × 1.05 × ...)</span></div>
        <p className="gt-source">Diversifizierung lohnt sich: Boni aus verschiedenen Quellen (Forge, Gear, Companions, Buffs) bringen mehr als alles in eine Kategorie zu stecken.</p>
      </>
    ),
  },
};
}

// Lazy-initialized cache (rebuilt when balance data changes)
let _registryCache: Record<string, TooltipEntry> | null = null;
function getRegistry(): Record<string, TooltipEntry> {
  if (!_registryCache) _registryCache = buildTooltipRegistry();
  return _registryCache;
}
// Allow cache invalidation when balance data loads
export function invalidateTooltipCache() { _registryCache = null; }
// Auto-invalidate when balance data arrives from API
onBalanceLoaded(invalidateTooltipCache);

// ─── Nested Tooltip Reference (clickable/hoverable keyword) ─────────────────

function GTRef({ k, children }: { k: string; children: React.ReactNode }) {
  const entry = getRegistry()[k];
  if (!entry) return <span style={{ color: "#f0f0f0", fontWeight: 600 }}>{children}</span>;
  return (
    <GameTooltip entry={entry}>
      <span className="gt-ref" style={{ color: entry.accent || "#f0f0f0", borderBottomColor: entry.accent || "#f0f0f0" }}>{children}</span>
    </GameTooltip>
  );
}

// ─── Main GameTooltip Component ─────────────────────────────────────────────

interface GameTooltipProps {
  /** Registry key to look up */
  k?: string;
  /** Or provide entry directly */
  entry?: TooltipEntry;
  /** The trigger element */
  children: React.ReactNode;
  /** Preferred position */
  align?: "left" | "right" | "center";
  /** Is this a heading-level tooltip? (gets loading bar + dotted underline) */
  heading?: boolean;
  /** Custom hover delay in ms (default 800, use 1500 for buttons) */
  hoverDelay?: number;
}

export function GameTooltip({ k, entry: directEntry, children, align: alignProp, heading, hoverDelay }: GameTooltipProps) {
  const align = alignProp || (heading ? "center" : "left");
  const resolvedEntry = directEntry || (k ? getRegistry()[k] : null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depth = useContext(TooltipDepthContext);
  const isPinnable = depth === 0; // Root tooltips pin open; nested use hover

  const computePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(360, window.innerWidth - 16);

    // getBoundingClientRect returns viewport-relative coords; add scroll offsets for absolute positioning
    let top = rect.bottom + TOOLTIP_GAP + window.scrollY;
    let left = align === "right"
      ? rect.right - tooltipWidth + window.scrollX
      : align === "center"
        ? rect.left + rect.width / 2 - tooltipWidth / 2 + window.scrollX
        : rect.left + window.scrollX;

    if (left < 8 + window.scrollX) left = 8 + window.scrollX;
    if (left + tooltipWidth > window.innerWidth + window.scrollX - 8) left = window.innerWidth + window.scrollX - tooltipWidth - 8;
    if (rect.bottom + TOOLTIP_GAP + 200 > window.innerHeight) top = rect.top + window.scrollY - TOOLTIP_GAP - 200;

    if (depth > 0) {
      left += NESTED_OFFSET * depth;
      top += NESTED_OFFSET * depth;
    }

    setPos({ top, left });
  }, [align, depth]);

  const hide = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setLoading(false);
    setVisible(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (visible) return; // already pinned
    setLoading(true);
    const delay = hoverDelay || HOVER_DELAY;
    timerRef.current = setTimeout(() => {
      computePos();
      setLoading(false);
      setVisible(true);
    }, delay);
  }, [visible, computePos, hoverDelay]);

  const handleMouseLeave = useCallback(() => {
    // Cancel loading bar if still in delay phase
    if (loading) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      setLoading(false);
      return;
    }
    // Pinned root tooltip — stays open until click-outside
    if (isPinnable) return;
    // Nested tooltip — grace period then close
    timerRef.current = setTimeout(hide, 150);
  }, [loading, isPinnable, hide]);

  const handleTooltipEnter = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const handleTooltipLeave = useCallback(() => {
    if (isPinnable) return; // Pinned root — stays open
    timerRef.current = setTimeout(hide, 150);
  }, [isPinnable, hide]);

  // Click-outside to close pinned root tooltips
  useEffect(() => {
    if (!visible || !isPinnable) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (triggerRef.current?.contains(target)) return;
      if (tooltipRef.current?.contains(target)) return;
      // Don't close if click lands inside a nested tooltip panel
      if (target.closest?.(".gt-panel")) return;
      hide();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    const frame = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKeyDown);
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, isPinnable, hide]);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!resolvedEntry) return <>{children}</>;

  const tooltip = visible && typeof document !== "undefined"
    ? createPortal(
        <TooltipDepthContext.Provider value={depth + 1}>
          <div
            ref={tooltipRef}
            className="gt-panel"
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              zIndex: 10100 + depth * 10,
              borderColor: resolvedEntry.accent ? `${resolvedEntry.accent}30` : undefined,
            }}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
          >
            {/* Header (conditional) */}
            {resolvedEntry.title && (
              <div className="gt-header">
                {resolvedEntry.icon && (
                  resolvedEntry.icon.startsWith("/")
                    ? <img src={resolvedEntry.icon} alt="" width={20} height={20} className="gt-icon" style={{ imageRendering: "auto", display: "inline" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                    : <span className="gt-icon">{resolvedEntry.icon}</span>
                )}
                <span className="gt-title" style={{ color: resolvedEntry.accent || "#f0f0f0" }}>{resolvedEntry.title}</span>
              </div>
            )}
            {/* Body */}
            <div className="gt-body">
              {resolvedEntry.body}
            </div>
          </div>
        </TooltipDepthContext.Provider>,
        document.body,
      )
    : null;

  return (
    <span
      ref={triggerRef}
      className={`gt-trigger${loading ? " gt-loading" : ""}${heading ? " gt-heading" : ""}`}
      style={heading ? { display: "inline-block" } : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {tooltip}
    </span>
  );
}

// ─── Convenience: Inline Tooltip Wrapper ────────────────────────────────────
// Use this to wrap any text/element with a tooltip from the registry.
// <Tip k="kraft">Kraft</Tip> → hoverable "Kraft" text that shows tooltip

export function Tip({ k, children, accent, heading }: { k: string; children: React.ReactNode; accent?: string; heading?: boolean }) {
  const entry = getRegistry()[k];
  if (!entry) return <>{children}</>;
  return (
    <GameTooltip k={k} heading={heading}>
      <span className={heading ? "gt-ref-heading" : "gt-ref"} style={{
        color: accent || entry.accent || "inherit",
        ...(heading ? { borderBottomColor: accent || entry.accent || "rgba(255,255,255,0.2)" } : {}),
      }}>{children}</span>
    </GameTooltip>
  );
}

// ─── Convenience: Ad-hoc tooltip (no registry) ─────────────────────────────

export function TipCustom({ title, icon, accent, body, children, heading, hoverDelay, align }: {
  title: string; icon?: string; accent?: string; body: React.ReactNode; children: React.ReactNode; heading?: boolean; hoverDelay?: number; align?: "left" | "center" | "right";
}) {
  return (
    <GameTooltip entry={{ title, icon, accent, body }} heading={heading} hoverDelay={hoverDelay} align={align}>
      {children}
    </GameTooltip>
  );
}

export { getRegistry as getTooltipRegistry, GTRef };
export default GameTooltip;
