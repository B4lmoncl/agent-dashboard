"use client";
import { categoryConfig, productConfig, typeConfig } from "@/app/config";
import type { Quest } from "@/app/types";

export function CategoryBadge({ category }: { category: string }) {
  const cfg = categoryConfig[category] ?? { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" };
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
    >
      {category}
    </span>
  );
}

export function ProductBadge({ product }: { product: string }) {
  const cfg = productConfig[product] ?? { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" };
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, fontStyle: "italic" }}
    >
      {product}
    </span>
  );
}

export function HumanInputBadge() {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
      style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
    >
      Needs Leon
    </span>
  );
}

export function TypeBadge({ type }: { type?: string }) {
  const cfg = typeConfig[type ?? "development"] ?? typeConfig.development;
  if (!type || type === "development") return null;
  const iconSrc = `/images/icons/cat-${type}.png`;
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 inline-flex items-center gap-1"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <img
        src={iconSrc}
        alt=""
        width={18}
        height={18}
        style={{ imageRendering: "auto", display: "inline", verticalAlign: "middle" }}
        onError={(e) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; const s = t.nextElementSibling as HTMLElement | null; if (s) s.style.display = "inline"; }}
      />
      <span style={{ display: "none" }}>{cfg.icon?.startsWith("/") ? cfg.label : cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

const NPC_CONFIG: Record<string, { avatar: string; color: string; label?: string }> = {
  dobbie:       { avatar: "DB", color: "#ff6b9d" },
  "npc-dobbie": { avatar: "DB", color: "#ff6b9d" },
  system:       { avatar: "SY", color: "#94a3b8", label: "Gefunden am schwarzen Brett" },
  lyra:         { avatar: "LY", color: "#e879f9", label: "Von der Sternenwächterin" },
};

export function CreatorBadge({ name }: { name: string }) {
  const npc = NPC_CONFIG[name.toLowerCase()];
  if (npc) {
    return (
      <span
        className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ color: npc.color, background: `${npc.color}18`, border: `1px solid ${npc.color}50` }}
        title={`Quest from ${name}`}
      >
        {npc.avatar} {npc.label ?? (name.charAt(0).toUpperCase() + name.slice(1))}
      </span>
    );
  }
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}
    >
      x {name.charAt(0).toUpperCase() + name.slice(1)}
    </span>
  );
}

export function AgentBadge({ name }: { name: string }) {
  return <CreatorBadge name={name} />;
}

export function RecurringBadge({ recurrence }: { recurrence: string }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: "#6366f1", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}
      title={`Recurring: ${recurrence}`}
    >
      x {recurrence}
    </span>
  );
}

/** @deprecated Priority system removed — kept for backward compatibility with existing quest data */
const _priorityFallback: Record<string, { label: string; color: string; bg: string; border: string }> = {
  low:    { label: "Low",  color: "#22c55e", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)"  },
  medium: { label: "Med",  color: "#eab308", bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.3)"  },
  high:   { label: "High", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)"  },
};

/** @deprecated Will be removed in Stage 2 */
export function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const cfg = _priorityFallback[priority] ?? _priorityFallback.medium;
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

/** @deprecated Will be removed in Stage 2 */
export function ClickablePriorityBadge({ priority, onClick }: { priority?: string; onClick: () => void }) {
  if (!priority) return null;
  const cfg = _priorityFallback[priority] ?? _priorityFallback.medium;
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title="Click to cycle priority"
      className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: "pointer" }}
    >
      {cfg.label} ↑
    </button>
  );
}

export { RARITY_COLORS } from "@/app/constants";
