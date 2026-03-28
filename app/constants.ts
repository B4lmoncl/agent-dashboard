// ─── Shared constants — single source of truth ─────────────────────────────

export const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f97316",
  unique: "#e6cc80",
};

export const RARITY_ORDER = ["legendary", "epic", "rare", "uncommon", "common"] as const;

export const STAT_LABELS: Record<string, string> = {
  kraft: "Kraft",
  ausdauer: "Ausdauer",
  weisheit: "Weisheit",
  glueck: "Glück",
  fokus: "Fokus",
  vitalitaet: "Vitalität",
  charisma: "Charisma",
  tempo: "Tempo",
};

export const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  unique: "Unique",
};
