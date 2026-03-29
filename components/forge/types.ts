// ─── Shared types for ForgeView sub-components ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface InventoryItem { instanceId?: string; id: string; name: string; rarity: string; slot?: string; [key: string]: any; }

export interface ProfessionDef {
  id: string;
  name: string;
  npcName: string;
  npcPortrait: string;
  npcGreeting: string;
  description: string;
  color: string;
  icon: string;
  maxLevel: number;
  maxSkill?: number;
  skill?: number;
  skillCap?: number;
  unlocked: boolean;
  chosen?: boolean;
  canChoose?: boolean;
  playerLevel: number;
  playerXp: number;
  nextLevelXp: number | null;
  levelThresholds: number[];
  unlockCondition?: { type: string; value: number };
  rank?: string;
  rankColor?: string;
  masteryActive?: boolean;
  masteryBonus?: { type: string; value: number; desc: string } | null;
  gatheringAffinity?: string[];
}

export interface Recipe {
  id: string;
  profession: string;
  name: string;
  desc: string;
  reqProfLevel: number;
  reqSkill?: number;
  xpGain?: number;
  skillUpChance?: number;
  cost: { gold?: number };
  materials: Record<string, number>;
  cooldownMinutes: number;
  canCraft: boolean;
  learned?: boolean;
  source?: "trainer" | "drop";
  trainerCost?: number;
  skillUpColor?: string;
  cooldownRemaining?: number;
  result?: { type?: string; templateId?: string };
}

export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  desc: string;
}

// ─── Shared constants ───────────────────────────────────────────────────────

export const ESSENZ_TABLE: Record<string, number> = { common: 2, uncommon: 5, rare: 15, epic: 40, legendary: 100 };

export const SLOT_LABELS: Record<string, string> = {
  weapon: "Weapon",
  shield: "Shield",
  helm: "Helm",
  armor: "Armor",
  amulet: "Amulet",
  boots: "Boots",
};

export const SKILL_UP_COLORS: Record<string, { color: string; label: string }> = {
  orange: { color: "#f97316", label: "Guaranteed (100%)" },
  yellow: { color: "#eab308", label: "Likely (~75%)" },
  green: { color: "#22c55e", label: "Unlikely (~25%)" },
  gray: { color: "#6b7280", label: "No skill-up (0%)" },
};

export const RANK_TRAINING_COSTS = [
  { rank: "Journeyman", fromCap: 75, toCap: 150, cost: 500, reqPlayerLevel: 15, reqSkill: 50 },
  { rank: "Expert", fromCap: 150, toCap: 225, cost: 2000, reqPlayerLevel: 25, reqSkill: 125 },
  { rank: "Artisan", fromCap: 225, toCap: 300, cost: 5000, reqPlayerLevel: 40, reqSkill: 200 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; };

export function getUserInventory(user: unknown): InventoryItem[] {
  return ((user as Record<string, unknown>).inventory as InventoryItem[] | undefined) || [];
}
