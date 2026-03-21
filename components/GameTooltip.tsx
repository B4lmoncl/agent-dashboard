"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { createPortal } from "react-dom";

// ─── CK3/BG3-style Tooltip System ──────────────────────────────────────────
// Hover with 0.8s delay → tooltip appears. Nested keywords inside tooltips
// can be hovered to open sub-tooltips (infinite nesting like CK3).

const HOVER_DELAY = 800; // ms before tooltip shows (CK3-style)
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
        <p>Primary stat from equipped gear. Increases Quest XP earned.</p>
        <div className="gt-stat-row"><span>Effect</span><span>+0.5% Quest XP per point</span></div>
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
        <p>Primary stat. Increases Gold earned from quests.</p>
        <div className="gt-stat-row"><span>Effect</span><span>+0.5% Gold per point</span></div>
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
        <p>Minor stat. Adds flat bonus XP to every quest completion.</p>
        <div className="gt-stat-row"><span>Effect</span><span>+1 XP per point</span></div>
        <div className="gt-stat-row"><span>Cap</span><span>+50 XP</span></div>
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
        <p>Minor stat. Increases Bond XP earned from companion quests.</p>
        <div className="gt-stat-row"><span>Effect</span><span>+5% Bond XP per point</span></div>
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
        <p>Activity meter (0-100%). Higher temp = more XP &amp; Gold. Decays 2%/hour, <GTRef k="ausdauer">Ausdauer</GTRef> slows decay. Each quest: +10.</p>
        <div className="gt-stat-row"><span>100% White-hot</span><span>×1.5 XP · ×1.5 Gold</span></div>
        <div className="gt-stat-row"><span>80%+ Blazing</span><span>×1.25 XP · ×1.3 Gold</span></div>
        <div className="gt-stat-row"><span>60%+ Burning</span><span>×1.15 XP · ×1.15 Gold</span></div>
        <div className="gt-stat-row"><span>40%+ Warming</span><span>×1.0 XP</span></div>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>20%+ Smoldering</span><span>×0.8 XP</span></div>
        <div className="gt-stat-row" style={{ color: "#ef4444" }}><span>&lt;20% Cold</span><span>×0.5 XP</span></div>
      </>
    ),
  },
  streak: {
    title: "Streak",
    icon: "🔗",
    accent: "#fbbf24",
    body: (
      <>
        <p>Complete at least 1 quest or ritual per day to maintain your streak. Longer streaks increase Gold earned (up to +45% at 30+ days).</p>
        <div className="gt-stat-row"><span>Gold bonus</span><span>+1.5% per day (cap 45%)</span></div>
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
        <p className="gt-source">Max level: 30. Level-up grants 5 + level Stardust.</p>
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
        <p>Items and quests have 5 rarity tiers (Diablo-style). Higher rarity = better stats and rewards.</p>
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
        <p>Gacha safety net (inspired by Honkai Star Rail). Guarantees rare drops after a set number of pulls.</p>
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
        <div className="gt-stat-row"><span>Petting</span><span>2×/day, +0.5 Bond XP</span></div>
        <div className="gt-stat-row"><span>Companion Quests</span><span>+1 Bond XP (× <GTRef k="charisma">Charisma</GTRef>)</span></div>
        <p className="gt-source">Ultimates: ⚡ Instant Complete · ✨ 2× Loot · 🔥 +3 Streak Days</p>
      </>
    ),
  },
  hoarding: {
    title: "Hoarding Penalty",
    icon: "⚠️",
    accent: "#ef4444",
    body: (
      <>
        <p>Having too many active quests reduces XP earned. Encourages completing quests before claiming new ones.</p>
        <div className="gt-stat-row"><span>1-20 quests</span><span style={{ color: "#22c55e" }}>No penalty</span></div>
        <div className="gt-stat-row"><span>21+ quests</span><span style={{ color: "#ef4444" }}>-10% XP per quest over 20</span></div>
        <div className="gt-stat-row"><span>28+ quests</span><span style={{ color: "#ef4444" }}>-80% XP (hard cap)</span></div>
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
        <p>Special passive effects on Legendary-rarity gear. Values are randomly rolled within a range when the item drops (Diablo-style).</p>
        <div className="gt-stat-row"><span>XP Bonus</span><span>+2-8%</span></div>
        <div className="gt-stat-row"><span>Gold Bonus</span><span>+2-7%</span></div>
        <div className="gt-stat-row"><span>Drop Bonus</span><span>+1-4%</span></div>
        <div className="gt-stat-row"><span>Decay Reduction</span><span>8-12%</span></div>
        <div className="gt-stat-row"><span>Night Gold ×2</span><span>23:00-05:00</span></div>
        <div className="gt-stat-row"><span>Every 5th Quest</span><span>Bonus XP</span></div>
      </>
    ),
  },
  daily_missions: {
    title: "Daily Missions",
    icon: "✅",
    accent: "#22c55e",
    body: (
      <>
        <p>6 daily tasks (HSR-style) with a point milestone track. Visible at the top of the Quest Board. Resets daily at midnight.</p>
        <div className="gt-stat-row"><span>100 pts</span><span>25 Gold</span></div>
        <div className="gt-stat-row"><span>300 pts</span><span>50 Gold + 3 Essenz</span></div>
        <div className="gt-stat-row"><span>500 pts</span><span>100 Gold + 2 Runensplitter</span></div>
        <div className="gt-stat-row"><span>750 pts</span><span>150 Gold + 1 Sternentaler</span></div>
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
        <div className="gt-stat-row"><span>Gold-Forged Tools</span><span>+2/3/4/5% Gold</span></div>
        <div className="gt-stat-row"><span>Loot Chance Amulet</span><span>+1/2/3% Loot</span></div>
        <div className="gt-stat-row"><span>Streak Shield Charm</span><span>Auto-save 1-2×/week</span></div>
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
        <p className="gt-source">Rift stages grant full rewards: XP multipliers, loot drops, materials, streak + forge temp updates.</p>
      </>
    ),
  },
  hearth: {
    title: "The Hearth (Rest Mode)",
    icon: "🏠",
    accent: "#d97706",
    body: (
      <>
        <p>Rest mode for 1-7 days. Freezes <GTRef k="streak">Streak</GTRef> and <GTRef k="forge_temp">Forge Temp</GTRef>. No quest generation or hoarding penalty changes during rest.</p>
        <div className="gt-stat-row"><span>Cooldown</span><span>30 days after rest ends</span></div>
        <p className="gt-source">Can leave early — frozen values are restored.</p>
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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depth = useContext(TooltipDepthContext);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 320;

    // Calculate position — prefer below, flip if near bottom
    let top = rect.bottom + TOOLTIP_GAP;
    let left = align === "right"
      ? rect.right - tooltipWidth
      : align === "center"
        ? rect.left + rect.width / 2 - tooltipWidth / 2
        : rect.left;

    // Clamp to viewport
    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - tooltipWidth - 8;
    if (top + 200 > window.innerHeight) top = rect.top - TOOLTIP_GAP - 200;

    // Offset for nested tooltips
    if (depth > 0) {
      left += NESTED_OFFSET * depth;
      top += NESTED_OFFSET * depth;
    }

    setPos({ top, left });
    setVisible(true);
  }, [align, depth]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(show, HOVER_DELAY);
  }, [show]);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // Small delay before hiding to allow moving to tooltip
    timerRef.current = setTimeout(hide, 150);
  }, [hide]);

  const handleTooltipEnter = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const handleTooltipLeave = useCallback(() => {
    timerRef.current = setTimeout(hide, 150);
  }, [hide]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!resolvedEntry) return <>{children}</>;

  const tooltip = visible && typeof document !== "undefined"
    ? createPortal(
        <TooltipDepthContext.Provider value={depth + 1}>
          <div
            ref={tooltipRef}
            className="gt-panel"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 9950 + depth * 10,
              borderColor: resolvedEntry.accent ? `${resolvedEntry.accent}30` : undefined,
            }}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
          >
            {/* Header */}
            <div className="gt-header">
              {resolvedEntry.icon && <span className="gt-icon">{resolvedEntry.icon}</span>}
              <span className="gt-title" style={{ color: resolvedEntry.accent || "#f0f0f0" }}>{resolvedEntry.title}</span>
            </div>
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
      className="gt-trigger"
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
