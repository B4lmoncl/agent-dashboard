"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { createPortal } from "react-dom";

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

const TOOLTIP_REGISTRY: Record<string, TooltipEntry> = {
  // ── Stats ──
  kraft: {
    title: "Kraft",
    icon: "⚔️",
    accent: "#ef4444",
    body: (
      <>
        <p>Primary stat from equipped gear. Increases Quest <GTRef k="xp">XP</GTRef> earned.</p>
        <div className="gt-stat-row"><span>Effect</span><span>+0.5% Quest <GTRef k="xp">XP</GTRef> per point</span></div>
        <div className="gt-stat-row"><span>Cap</span><span>+30% (60 points)</span></div>
        <p className="gt-source">Sources: Gear affixes, set bonuses, enchantments</p>
      </>
    ),
  },
  ausdauer: {
    title: "Ausdauer",
    icon: "🛡️",
    accent: "#3b82f6",
    body: (
      <>
        <p>Primary stat. Slows <GTRef k="forge_temp">Forge Temperature</GTRef> decay rate.</p>
        <div className="gt-stat-row"><span>Effect</span><span>-0.5% decay rate per point</span></div>
        <div className="gt-stat-row"><span>Floor</span><span>10% of base decay rate</span></div>
        <p className="gt-source">Sources: Gear affixes (armor, shield, boots)</p>
      </>
    ),
  },
  weisheit: {
    title: "Weisheit",
    icon: "📖",
    accent: "#f59e0b",
    body: (
      <>
        <p>Primary stat. Increases <GTRef k="gold">Gold</GTRef> earned from quests.</p>
        <div className="gt-stat-row"><span>Effect</span><span>+0.5% <GTRef k="gold">Gold</GTRef> per point</span></div>
        <div className="gt-stat-row"><span>Cap</span><span>+30% (60 points)</span></div>
        <p className="gt-source">Sources: Gear affixes (helm, amulet, weapon)</p>
      </>
    ),
  },
  glueck: {
    title: "Glück",
    icon: "🍀",
    accent: "#22c55e",
    body: (
      <>
        <p>Primary stat. Increases loot drop chance from quests.</p>
        <div className="gt-stat-row"><span>Effect</span><span>+0.5% drop chance per point</span></div>
        <div className="gt-stat-row"><span>Cap</span><span>+20% (40 points)</span></div>
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
        <div className="gt-stat-row"><span>Effect</span><span>+1 <GTRef k="xp">XP</GTRef> per point</span></div>
        <div className="gt-stat-row"><span>Cap</span><span>+50 <GTRef k="xp">XP</GTRef></span></div>
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
        <div className="gt-stat-row"><span>Effect</span><span>+1% auto-recovery per point</span></div>
        <div className="gt-stat-row"><span>Cap</span><span>75% total</span></div>
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
        <div className="gt-stat-row"><span>Effect</span><span>+5% Bond <GTRef k="xp">XP</GTRef> per point</span></div>
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
        <div className="gt-stat-row"><span>Effect</span><span>+1% recovery per point</span></div>
      </>
    ),
  },

  // ── Core Systems ──
  forge_temp: {
    title: "Forge Temperature",
    icon: "🔥",
    accent: "#f97316",
    body: (
      <>
        <p>Activity meter (0-100%). Higher temp = more <GTRef k="xp">XP</GTRef> &amp; <GTRef k="gold">Gold</GTRef>. Decays 2%/hour, <GTRef k="ausdauer">Ausdauer</GTRef> slows decay. Each quest: +10.</p>
        <div className="gt-stat-row"><span>100% White-hot</span><span>×1.5 <GTRef k="xp">XP</GTRef> · ×1.5 <GTRef k="gold">Gold</GTRef></span></div>
        <div className="gt-stat-row"><span>80%+ Blazing</span><span>×1.25 <GTRef k="xp">XP</GTRef> · ×1.3 <GTRef k="gold">Gold</GTRef></span></div>
        <div className="gt-stat-row"><span>60%+ Burning</span><span>×1.15 <GTRef k="xp">XP</GTRef> · ×1.15 <GTRef k="gold">Gold</GTRef></span></div>
        <div className="gt-stat-row"><span>40%+ Warming</span><span>×1.0 <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>20%+ Smoldering</span><span>×0.8 <GTRef k="xp">XP</GTRef></span></div>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>&lt;20% Cold</span><span>×0.5 <GTRef k="xp">XP</GTRef></span></div>
      </>
    ),
  },
  streak: {
    title: "Streak",
    icon: "🔗",
    accent: "#fbbf24",
    body: (
      <>
        <p>Complete at least 1 quest or ritual per day to maintain your streak. Longer streaks increase <GTRef k="gold">Gold</GTRef> earned (up to +45% at 30+ days).</p>
        <div className="gt-stat-row"><span><GTRef k="gold">Gold</GTRef> bonus</span><span>+1.5% per day (cap 45%)</span></div>
        <div className="gt-stat-row"><span>Protection</span><span><GTRef k="vitalitaet">Vitalität</GTRef> stat, Streak Shields, Legendary gear</span></div>
        <p className="gt-source">Milestones: Bronze (7d), Silver (21d), Gold (60d), Diamond (180d), Legend (365d)</p>
      </>
    ),
  },
  xp: {
    title: "Experience Points (XP)",
    icon: "✨",
    accent: "#a855f7",
    body: (
      <>
        <p>Earned from quests. XP is multiplied by many factors:</p>
        <div className="gt-stat-row"><span><GTRef k="forge_temp">Forge Temp</GTRef></span><span>×0.5 to ×1.5</span></div>
        <div className="gt-stat-row"><span><GTRef k="kraft">Kraft</GTRef> stat</span><span>up to +30%</span></div>
        <div className="gt-stat-row"><span>Gear bonus</span><span>Varies by equipment</span></div>
        <div className="gt-stat-row"><span>Companion Bond</span><span>+1% per bond level</span></div>
        <div className="gt-stat-row"><span>Hoarding malus</span><span>-10%/quest over 20 active</span></div>
        <p className="gt-source">Max level: 30. Level-up grants 5 + level <GTRef k="stardust">Stardust</GTRef>.</p>
      </>
    ),
  },

  // ── Currencies ──
  gold: {
    title: "Gold",
    icon: "🪙",
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
    icon: "🔴",
    accent: "#ef4444",
    body: <p>Crafting currency. Earned from item dismantling and quest drops. Used for crafting recipes, profession switching (200 Essenz), and Workshop Tools.</p>,
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
        <div className="gt-stat-row" style={{ color: "#9ca3af" }}><span>Common</span><span>Base values</span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Uncommon</span><span>1-2 affixes</span></div>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>Rare</span><span>2-3 primary + 1 minor</span></div>
        <div className="gt-stat-row" style={{ color: "#a855f7" }}><span>Epic</span><span>2-3 primary + 1-2 minor</span></div>
        <div className="gt-stat-row" style={{ color: "#FFD700" }}><span>Legendary</span><span>3-4 primary + 1-2 minor + effect</span></div>
      </>
    ),
  },

  // ── Game Features ──
  pity: {
    title: "Pity System",
    icon: "🎯",
    accent: "#fbbf24",
    body: (
      <>
        <p>Gacha safety net. Guarantees rare drops after a set number of pulls.</p>
        <div className="gt-stat-row"><span>Soft Pity (55)</span><span>+2.5% Legendary chance/pull</span></div>
        <div className="gt-stat-row"><span>Hard Pity (75)</span><span>Guaranteed Legendary</span></div>
        <div className="gt-stat-row"><span>Epic Pity (10)</span><span>Guaranteed Epic+ every 10</span></div>
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
  hoarding: {
    title: "Hoarding Penalty",
    icon: "⚠️",
    accent: "#ef4444",
    body: (
      <>
        <p>Having too many active quests reduces <GTRef k="xp">XP</GTRef> earned. Encourages completing quests before claiming new ones.</p>
        <div className="gt-stat-row"><span>1-20 quests</span><span style={{ color: "#22c55e" }}>No penalty</span></div>
        <div className="gt-stat-row"><span>21+ quests</span><span style={{ color: "#ef4444" }}>-10% <GTRef k="xp">XP</GTRef> per quest over 20</span></div>
        <div className="gt-stat-row"><span>28+ quests</span><span style={{ color: "#ef4444" }}>-80% <GTRef k="xp">XP</GTRef> (hard cap)</span></div>
      </>
    ),
  },
  set_bonus: {
    title: "Set Bonuses",
    icon: "🔷",
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
        <p>Permanent bonus items purchasable in the Artisan&apos;s Quarter. All bonuses are additive.</p>
        <div className="gt-stat-row"><span><GTRef k="gold">Gold</GTRef>-Forged Tools</span><span>+2/3/4/5% <GTRef k="gold">Gold</GTRef></span></div>
        <div className="gt-stat-row"><span>Loot Chance Amulet</span><span>+1/2/3% Loot</span></div>
        <div className="gt-stat-row"><span><GTRef k="streak">Streak</GTRef> Shield Charm</span><span>Auto-save 1-2×/week</span></div>
        <div className="gt-stat-row"><span>Material Magnet</span><span>+5/10/15% material chance</span></div>
      </>
    ),
  },
  rift: {
    title: "The Rift (Dungeons)",
    icon: "🌀",
    accent: "#a855f7",
    body: (
      <>
        <p>Timed quest chains with escalating difficulty. 3 tiers: Normal (3 quests/72h), Hard (5/48h), Legendary (7/36h). Failure triggers a cooldown.</p>
        <p className="gt-source">Rift stages grant full rewards: <GTRef k="xp">XP</GTRef> multipliers, loot drops, materials, <GTRef k="streak">streak</GTRef> + <GTRef k="forge_temp">forge temp</GTRef> updates.</p>
      </>
    ),
  },
  hearth: {
    title: "The Hearth (Rest Mode)",
    icon: "🏠",
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
    title: "NPC Quest Board",
    icon: "🤖",
    accent: "#8b5cf6",
    body: (
      <>
        <p>Agent development quests. The AI NPCs (Nova, Hex, Echo, Pixel, Atlas, Lyra) work on these autonomously.</p>
        <p className="gt-source">Admin can review and approve suggested quests.</p>
      </>
    ),
  },
  artisans_quarter: {
    title: "Artisan&apos;s Quarter",
    icon: "⚒️",
    accent: "#f59e0b",
    body: (
      <>
        <p>Crafting hub with 4 profession NPCs. Collect materials from quests, craft recipes with <GTRef k="gold">Gold</GTRef> + materials.</p>
        <div className="gt-stat-row"><span>Ranks</span><span>Apprentice → Master</span></div>
        <div className="gt-stat-row"><span>Profession Slots</span><span>Lv5 / Lv15 / Lv20 / Lv25</span></div>
        <div className="gt-stat-row"><span>Daily Bonus</span><span>First craft = 2× prof. <GTRef k="xp">XP</GTRef></span></div>
        <p className="gt-source">Skill-up colors: orange / yellow / green / gray. Switching costs 200 <GTRef k="essenz">Essenz</GTRef>.</p>
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
        <div className="gt-stat-row" style={{ color: "#f97316" }}><span>Legendary</span><span>0.8%</span></div>
        <div className="gt-stat-row" style={{ color: "#a855f7" }}><span>Epic</span><span>13%</span></div>
        <div className="gt-stat-row" style={{ color: "#3b82f6" }}><span>Rare</span><span>35%</span></div>
        <div className="gt-stat-row" style={{ color: "#22c55e" }}><span>Uncommon</span><span>40%</span></div>
        <div className="gt-stat-row" style={{ color: "#9ca3af" }}><span>Common</span><span>11.2%</span></div>
        <p className="gt-source"><GTRef k="pity">Pity</GTRef>: Soft at 55, hard at 75. 10-pull = 10% discount + guaranteed Epic+. Duplicates → <GTRef k="runensplitter">Rune Shards</GTRef>.</p>
      </>
    ),
  },
  companions: {
    title: "Companions",
    icon: "🐾",
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
        <div className="gt-stat-row"><span>Easy</span><span>1× · 3 <GTRef k="gold">Gold</GTRef> · 8 <GTRef k="xp">XP</GTRef></span></div>
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
    icon: "⚒️",
    accent: "#f59e0b",
    body: (
      <>
        <p>4 crafting disciplines, each with a unique NPC master. Choose up to 2 professions (more slots unlock at higher levels).</p>
        <div className="gt-stat-row"><span>Blacksmith (Grimvar)</span><span>Gear rerolling + reinforcing</span></div>
        <div className="gt-stat-row"><span>Alchemist (Ysolde)</span><span>Buff potions + flasks</span></div>
        <div className="gt-stat-row"><span>Enchanter (Eldric)</span><span>Gear enchanting + infusions</span></div>
        <div className="gt-stat-row"><span>Cook (Bruna)</span><span>Meals + consumables</span></div>
        <p className="gt-source">10 levels per profession. Ranks: Novice → Apprentice → Journeyman → Expert → Artisan → Master.</p>
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
    icon: "🧱",
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
        <p>Equip items in 6 slots: Helm, Chest, Gloves, Boots, Weapon, Amulet. Each item has primary + minor stat <GTRef k="affixes">affixes</GTRef>.</p>
        <div className="gt-stat-row"><span><GTRef k="set_bonus">Set Bonuses</GTRef></span><span>3/6 or 6/6 tier match</span></div>
        <div className="gt-stat-row"><span><GTRef k="legendary_effects">Legendary Effects</GTRef></span><span>Unique passives on gold items</span></div>
        <p className="gt-source">Gear drops from quest completions. <GTRef k="glueck">Glück</GTRef> stat increases drop chance.</p>
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
        <p>Earn <GTRef k="xp">XP</GTRef> from quests to level up (max 30). Each level requires exponentially more <GTRef k="xp">XP</GTRef>.</p>
        <p>Level-ups grant <GTRef k="stardust">Stardust</GTRef> (5 + level) and unlock new features:</p>
        <div className="gt-stat-row"><span>Lv 5</span><span>1st profession slot</span></div>
        <div className="gt-stat-row"><span>Lv 15</span><span>2nd profession slot</span></div>
        <div className="gt-stat-row"><span>Lv 20</span><span>3rd profession slot</span></div>
        <div className="gt-stat-row"><span>Lv 25</span><span>All 4 profession slots</span></div>
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
    icon: "⭐",
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
    icon: "🗺️",
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
        <p className="gt-source"><GTRef k="pity">Pity</GTRef> tracks separately per banner.</p>
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
};

// ─── Nested Tooltip Reference (clickable/hoverable keyword) ─────────────────

function GTRef({ k, children }: { k: string; children: React.ReactNode }) {
  const entry = TOOLTIP_REGISTRY[k];
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
}

export function GameTooltip({ k, entry: directEntry, children, align = "left" }: GameTooltipProps) {
  const resolvedEntry = directEntry || (k ? TOOLTIP_REGISTRY[k] : null);
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
    const tooltipWidth = 360;

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
    timerRef.current = setTimeout(() => {
      computePos();
      setLoading(false);
      setVisible(true);
    }, HOVER_DELAY);
  }, [visible, computePos]);

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
              zIndex: 9950 + depth * 10,
              borderColor: resolvedEntry.accent ? `${resolvedEntry.accent}30` : undefined,
            }}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
          >
            {/* Header (conditional) */}
            {resolvedEntry.title && (
              <div className="gt-header">
                {resolvedEntry.icon && <span className="gt-icon">{resolvedEntry.icon}</span>}
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
      className={`gt-trigger${loading ? " gt-loading" : ""}`}
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

export function Tip({ k, children, accent }: { k: string; children: React.ReactNode; accent?: string }) {
  const entry = TOOLTIP_REGISTRY[k];
  if (!entry) return <>{children}</>;
  return (
    <GameTooltip k={k}>
      <span className="gt-ref" style={{
        color: accent || entry.accent || "inherit",
        borderBottomColor: accent || entry.accent || "rgba(255,255,255,0.2)",
      }}>{children}</span>
    </GameTooltip>
  );
}

// ─── Convenience: Ad-hoc tooltip (no registry) ─────────────────────────────

export function TipCustom({ title, icon, accent, body, children }: {
  title: string; icon?: string; accent?: string; body: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <GameTooltip entry={{ title, icon, accent, body }}>
      {children}
    </GameTooltip>
  );
}

export { TOOLTIP_REGISTRY, GTRef };
export default GameTooltip;
