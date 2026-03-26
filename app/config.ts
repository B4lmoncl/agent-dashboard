export const priorityConfig = {
  low:    { label: "Low",    color: "#22c55e", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)"   },
  medium: { label: "Med",   color: "#eab308", bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.3)"   },
  high:   { label: "High",  color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)"   },
};

export const categoryConfig: Record<string, { color: string; bg: string }> = {
  "Coding":         { color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  "Research":       { color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
  "Content":        { color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  "Sales":          { color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  "Infrastructure": { color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  "Bug Fix":        { color: "#ff4444", bg: "rgba(255,68,68,0.1)"   },
  "Feature":        { color: "#e879f9", bg: "rgba(232,121,249,0.1)" },
};

export const productConfig: Record<string, { color: string; bg: string }> = {
  "Dashboard":      { color: "#ff6633", bg: "rgba(255,102,51,0.1)"  },
  "Companion App":  { color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  "Infrastructure": { color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  "Other":          { color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
};

export const typeConfig: Record<string, { label: string; icon: string | null; color: string; bg: string; border: string }> = {
  development: { label: "Dev",      icon: "",  color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.3)"  },
  personal:    { label: "Personal", icon: "/images/icons/cat-personal.png", color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
  learning:    { label: "Learn",    icon: "/images/icons/cat-learning.png", color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)"  },
  fitness:     { label: "Fitness",  icon: "/images/icons/cat-fitness.png", color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)"  },
  social:      { label: "Social",   icon: "/images/icons/cat-social.png", color: "#ec4899", bg: "rgba(236,72,153,0.1)",  border: "rgba(236,72,153,0.3)"  },
  boss:        { label: "Boss",     icon: "", color: "#ef4444", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.5)"   },
  "relationship-coop": { label: "Co-op", icon: "/images/icons/cat-coop.png", color: "#f43f5e", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.4)" },
};

// ─── Canonical Rarity Colors ─────────────────────────────────────────────────
// Single source of truth — import this instead of defining locally
export const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f97316",
  unique: "#e6cc80",
};

// ─── Gildenhallen-Stockwerke (Urithiru-inspired navigation) ──────────────────

export interface FloorRoom {
  key: string;
  label: string;
  iconSrc: string;
  requiresLogin?: boolean;
  tutorialKey?: string | null;
  /** Minimum player level to see/access this room (defaults to floor's minLevel) */
  minLevel?: number;
}

export interface Floor {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  color: string;
  gradient: string;
  /** Optional 792x200 banner image (right-aligned behind gradient overlay) */
  banner?: string;
  /** Minimum player level to see this floor (default: 1) */
  minLevel?: number;
  rooms: FloorRoom[];
}

export const FLOORS: Floor[] = [
  {
    id: "turmspitze",
    name: "Pinnacle",
    subtitle: "Prestige & Glory",
    icon: "▲",
    color: "#fbbf24",
    gradient: "linear-gradient(135deg, #fbbf24 0%, #1a1a3a 100%)",
    banner: "/images/banners/turmspitze-banner.png",
    minLevel: 8,
    rooms: [
      { key: "campaign",    label: "Observatory",        iconSrc: "/images/icons/nav-observatory.png", tutorialKey: "campaign-tab" },
      { key: "leaderboard", label: "Proving Grounds",    iconSrc: "/images/icons/nav-proving.png",     tutorialKey: "leaderboard-tab" },
      { key: "honors",      label: "Hall of Honors",     iconSrc: "/images/icons/nav-honors.png",      tutorialKey: "honors-tab" },
      { key: "factions",    label: "Four Circles",       iconSrc: "",                                  requiresLogin: true, tutorialKey: null },
      { key: "season",      label: "Season Pass",        iconSrc: "",                                  requiresLogin: true, tutorialKey: "season-tab" },
    ],
  },
  {
    id: "haupthalle",
    name: "Great Halls",
    subtitle: "Adventure",
    icon: "●",
    color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316 0%, #1a0f0a 100%)",
    banner: "/images/banners/haupthalle-banner.png",
    minLevel: 1,
    rooms: [
      { key: "questBoard", label: "Quest Board",          iconSrc: "/images/icons/nav-great-hall.png",  tutorialKey: "quest-board-tab" },
      { key: "npcBoard",   label: "Wanderers Rest",       iconSrc: "/images/icons/nav-wanderer.png",    tutorialKey: "npc-board-tab" },
      { key: "challenges", label: "Challenges",           iconSrc: "/images/icons/nav-challenges.png",  tutorialKey: null, minLevel: 10 },
      { key: "rift",       label: "Rift",                 iconSrc: "/images/icons/nav-rift.png",        requiresLogin: true, tutorialKey: null, minLevel: 15 },
      { key: "worldboss",  label: "Colosseum",            iconSrc: "",                                  requiresLogin: true, tutorialKey: null, minLevel: 15 },
      { key: "dungeons",   label: "Undercroft",           iconSrc: "",                                  requiresLogin: true, tutorialKey: null, minLevel: 15 },
    ],
  },
  {
    id: "gewerbeviertel",
    name: "Trading District",
    subtitle: "Commerce & Craft",
    icon: "■",
    color: "#a855f7",
    gradient: "linear-gradient(135deg, #a855f7 0%, #1a0a2e 100%)",
    banner: "/images/banners/gewerbeviertel-banner.png",
    minLevel: 5,
    rooms: [
      { key: "shop",   label: "Bazaar",              iconSrc: "/images/icons/nav-bazaar.png",       tutorialKey: "bazaar-tab" },
      { key: "forge",  label: "Artisan's Quarter",   iconSrc: "/images/icons/prof-schmied.png",     requiresLogin: true },
      { key: "gacha",  label: "Vault of Fate",       iconSrc: "/images/icons/vault-of-fate.png",    tutorialKey: "vault-tab" },
    ],
  },
  {
    id: "charakterturm",
    name: "Inner Sanctum",
    subtitle: "Personal",
    icon: "✦",
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #0a1a2e 100%)",
    banner: "/images/banners/charakterturm-banner.png",
    minLevel: 3,
    rooms: [
      { key: "character",     label: "Character",      iconSrc: "/images/icons/nav-character.png",    requiresLogin: true, tutorialKey: "character-tab" },
      { key: "klassenquests", label: "Arcanum",        iconSrc: "/images/icons/nav-arcanum.png",      tutorialKey: null },
      { key: "rituals",       label: "Ritual Chamber", iconSrc: "/images/icons/ui-ritual-rune.png",   requiresLogin: true, tutorialKey: "rituals-tab" },
      { key: "vows",          label: "Vow Shrine",     iconSrc: "/images/icons/ui-vow-sword.png",     requiresLogin: true },
    ],
  },
  {
    id: "breakaway",
    name: "Breakaway",
    subtitle: "Social & Rest",
    icon: "⬡",
    color: "#ec4899",
    gradient: "linear-gradient(135deg, #ec4899 0%, #1a0a1e 100%)",
    banner: "/images/banners/breakaway-banner.png",
    minLevel: 1,
    rooms: [
      { key: "social", label: "Breakaway", iconSrc: "/images/icons/nav-breakaway.png", requiresLogin: true, tutorialKey: null },
      { key: "tavern", label: "Hearth", iconSrc: "/images/icons/nav-tavern.png", requiresLogin: true, tutorialKey: null },
    ],
  },
];

/** Get the floor that contains a given room key */
export function getFloorForRoom(roomKey: string): Floor | undefined {
  return FLOORS.find(f => f.rooms.some(r => r.key === roomKey));
}

export const STREAK_MILESTONES_CLIENT = [
  { days: 7,   badge: 'Bronze',  label: 'Bronze',           icon: '/images/icons/streak-bronze.png' },
  { days: 14,  badge: '2W',      label: '2 Weeks',          icon: '/images/icons/streak-2w.png' },
  { days: 21,  badge: 'Silber',  label: 'Silver',           icon: '/images/icons/streak-silver.png' },
  { days: 30,  badge: '1M',      label: '1 Month',          icon: '/images/icons/streak-1m.png' },
  { days: 60,  badge: 'Gold',    label: 'Gold',             icon: '/images/icons/streak-gold.png' },
  { days: 90,  badge: 'Titan',   label: 'Unyielding',       icon: '/images/icons/streak-titan.png' },
  { days: 180, badge: 'Diamond', label: 'Diamond',          icon: '/images/icons/streak-diamond.png' },
  { days: 365, badge: 'Legend',  label: 'Legendary',        icon: '/images/icons/streak-legend.png' },
];
