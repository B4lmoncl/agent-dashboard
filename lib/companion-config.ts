// ─── Shared companion configuration ──────────────────────────────────────────
// Used by CompanionsWidget and WandererRest

export type CompanionColor = { accent: string; accentRgb: string; border: string };

export const COMPANION_COLORS: Record<string, CompanionColor> = {
  cat:     { accent: "#ff6b9d", accentRgb: "255,107,157", border: "rgba(255,107,157,0.4)" },
  dog:     { accent: "#c4873b", accentRgb: "196,135,59",  border: "rgba(196,135,59,0.4)" },
  hamster: { accent: "#f5a623", accentRgb: "245,166,35",  border: "rgba(245,166,35,0.4)" },
  bird:    { accent: "#4ade80", accentRgb: "74,222,128",   border: "rgba(74,222,128,0.4)" },
  fish:    { accent: "#60a5fa", accentRgb: "96,165,250",   border: "rgba(96,165,250,0.4)" },
  rabbit:  { accent: "#e879f9", accentRgb: "232,121,249",  border: "rgba(232,121,249,0.4)" },
  dragon:  { accent: "#ef4444", accentRgb: "239,68,68",    border: "rgba(239,68,68,0.4)" },
  owl:     { accent: "#a78bfa", accentRgb: "167,139,250",  border: "rgba(167,139,250,0.4)" },
  phoenix: { accent: "#f97316", accentRgb: "249,115,22",   border: "rgba(249,115,22,0.4)" },
  wolf:    { accent: "#64748b", accentRgb: "100,116,139",  border: "rgba(100,116,139,0.4)" },
  fox:     { accent: "#fb923c", accentRgb: "251,146,60",   border: "rgba(251,146,60,0.4)" },
  bear:    { accent: "#92400e", accentRgb: "146,64,14",    border: "rgba(146,64,14,0.4)" },
};

export const DEFAULT_COMPANION_COLOR: CompanionColor = {
  accent: "#00bcd4", accentRgb: "0,188,212", border: "rgba(0,188,212,0.4)",
};

export function getCompanionColor(type?: string): CompanionColor {
  if (!type) return COMPANION_COLORS.cat;
  return COMPANION_COLORS[type] ?? DEFAULT_COMPANION_COLOR;
}

export const VIRTUAL_COMPANION_TYPES = new Set(["dragon", "owl", "phoenix", "wolf", "fox", "bear"]);

export function getCompanionPortrait(type?: string, name?: string): string | null {
  if (type === "cat" && name?.toLowerCase() === "dobbie") return "/images/portraits/companion-dobbie.png";
  if (type && VIRTUAL_COMPANION_TYPES.has(type)) return `/images/portraits/companion-${type}.png`;
  return null;
}
