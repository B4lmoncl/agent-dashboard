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

export const STREAK_MILESTONES_CLIENT = [
  { days: 7,   badge: 'Bronze',  label: 'Bronze' },
  { days: 14,  badge: '2W',      label: '2-Wochen' },
  { days: 21,  badge: 'Silber',  label: 'Silber' },
  { days: 30,  badge: '1M',      label: 'Monat' },
  { days: 60,  badge: 'Gold',    label: 'Gold' },
  { days: 90,  badge: 'Titan',   label: 'Unerschütterlich' },
  { days: 180, badge: 'Diamond', label: 'Diamond' },
  { days: 365, badge: 'Legend',  label: 'Legendary' },
];
