"use client";

/**
 * Balance Config Cache — loads gameplay constants from /api/config once
 * and makes them available to tooltip/UI components.
 *
 * Usage:
 *   import { getBalance, loadBalance } from "@/lib/balance-cache";
 *   // Call loadBalance() once at app startup
 *   // Then getBalance() returns the cached data anywhere
 */

export interface BalanceConfig {
  stats: Record<string, { effect: number; cap?: number; decayFloor?: number; label: string }>;
  forgeTemp: {
    tiers: { min: number; xp: number; gold: number; label: string }[];
    decayPerHour: number;
    gainPerQuest: number;
  };
  streak: { bonusPerDay: number; maxBonus: number; maxDays: number };
  hoarding: { freeLimit: number; penaltyPerQuest: number; softCap: number; hardCap: number; hardCapAt: number };
  gacha: {
    legendaryRate: number;
    epicRate: number;
    rareRate: number;
    uncommonRate: number;
    softPity: number;
    hardPity: number;
    softPityIncrease: number;
    epicPity: number;
  };
  setBonuses: { partial: number; full: number };
  starBonus: { twoStar: number; threeStar: number };
}

let _cache: BalanceConfig | null = null;

/** Default fallback values matching lib/helpers.js (used before API loads) */
const DEFAULTS: BalanceConfig = {
  stats: {
    kraft:      { effect: 0.005, label: "+0.5% XP per point" },
    ausdauer:   { effect: 0.005, decayFloor: 0.1, label: "-0.5% Forge Decay per point (floor 10%)" },
    weisheit:   { effect: 0.004, label: "+0.4% Gold per point" },
    glueck:     { effect: 0.003, label: "+0.3% Drop Chance per point" },
    fokus:      { effect: 1, cap: 50, label: "+1 flat XP per point (cap 50)" },
    vitalitaet: { effect: 0.01, cap: 0.75, label: "+1% streak protection per point (cap 75%)" },
    charisma:   { effect: 0.05, label: "+5% Bond XP per point" },
    tempo:      { effect: 0.01, label: "+1% Forge Temp recovery per point" },
  },
  forgeTemp: {
    tiers: [
      { min: 100, xp: 1.25, gold: 1.25, label: "White-hot" },
      { min: 80,  xp: 1.15, gold: 1.15, label: "Blazing" },
      { min: 60,  xp: 1.10, gold: 1.08, label: "Burning" },
      { min: 40,  xp: 1.0,  gold: 1.0,  label: "Warming" },
      { min: 20,  xp: 0.85, gold: 1.0,  label: "Smoldering" },
      { min: 0,   xp: 0.6,  gold: 1.0,  label: "Cold" },
    ],
    decayPerHour: 2,
    gainPerQuest: 10,
  },
  streak: { bonusPerDay: 0.015, maxBonus: 0.45, maxDays: 30 },
  hoarding: { freeLimit: 20, penaltyPerQuest: 10, softCap: 50, hardCap: 80, hardCapAt: 30 },
  gacha: { legendaryRate: 0.008, epicRate: 0.03, rareRate: 0.25, uncommonRate: 0.45, softPity: 55, hardPity: 75, softPityIncrease: 0.025, epicPity: 10 },
  setBonuses: { partial: 0.05, full: 0.10 },
  starBonus: { twoStar: 0.15, threeStar: 0.33 },
};

export function getBalance(): BalanceConfig {
  return _cache || DEFAULTS;
}

export async function loadBalance(): Promise<BalanceConfig> {
  try {
    const r = await fetch("/api/config", { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const data = await r.json();
      if (data.balance) {
        _cache = data.balance as BalanceConfig;
        return _cache!;
      }
    }
  } catch { /* use defaults */ }
  return DEFAULTS;
}
