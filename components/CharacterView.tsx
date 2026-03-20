"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalBehavior } from "@/components/ModalPortal";
import ItemActionPopup from "@/components/ItemActionPopup";
import type { User, CharacterData, ClassDef, PixelCharacterProps, GearInstance } from "@/app/types";
import type { ToastInput } from "@/components/ToastStack";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";

// ─── PixelCharacter Canvas Component ─────────────────────────────────────────

function PixelCharacter({ appearance = {}, equipment = {}, companion = null }: PixelCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const frameRef = useRef(0);
  const blinkRef = useRef(false);

  // Determine equipped tier from weapon/armor slot
  const getTier = () => {
    const slots = ['weapon', 'armor', 'shield', 'helm'];
    for (const s of slots) {
      const id = equipment[s];
      if (!id) continue;
      if (id.startsWith('t4-') || ['dawn-blade','aegis-shield','wise-crown','dragon-armor','luck-heart','world-boots'].includes(id)) return 4;
      if (id.startsWith('t3-') || ['rune-sword','dragon-scale','arcane-helm','mythril-armor','gold-medallion','wind-boots'].includes(id)) return 3;
      if (id.startsWith('t2-') || ['steel-sword','iron-shield','chain-helm','chain-armor','silver-amulet','iron-boots'].includes(id)) return 2;
    }
    return 1;
  };

  // Stable key for equipment changes (avoids JSON.stringify in dep array)
  const equipKey = useMemo(() => Object.entries(equipment || {}).map(([k, v]) => `${k}:${typeof v === 'object' && v ? (v as Record<string, unknown>).templateId : v}`).join(','), [equipment]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SCALE = 4;
    const W = 32;
    const H = 48;
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;

    const SKIN_COLORS: Record<string, string> = {
      light: '#fdd8b5', medium: '#d4a574', tan: '#a0785a', dark: '#6b4423',
    };
    const HAIR_COLORS: Record<string, string> = {
      black: '#222222', brown: '#8B4513', blonde: '#DAA520',
      red: '#B22222', blue: '#1565C0', white: '#DDDDDD',
    };

    const skin = SKIN_COLORS[appearance.skinColor || 'medium'] || SKIN_COLORS.medium;
    const hairColor = HAIR_COLORS[appearance.hairColor || 'brown'] || HAIR_COLORS.brown;
    const hairStyle = appearance.hairStyle || 'short';
    const tier = getTier();

    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
    };

    let lastTimestamp = 0;
    const FRAME_DURATION = 300; // ms per animation frame
    const BLINK_DURATION = 200; // ms eyes closed

    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleBlink = () => {
      blinkTimeout = setTimeout(() => {
        blinkRef.current = true;
        setTimeout(() => {
          blinkRef.current = false;
          scheduleBlink();
        }, BLINK_DURATION);
      }, 2500 + Math.random() * 1000);
    };
    scheduleBlink();

    const draw = (timestamp: number) => {
      if (timestamp - lastTimestamp >= FRAME_DURATION) {
        frameRef.current = (frameRef.current + 1) % 4;
        lastTimestamp = timestamp;
      }

      const frame = frameRef.current;
      const bobY = frame === 1 ? 1 : frame === 3 ? -1 : 0;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── Armor colors by tier ──
      let armorMain = '#8D6E63';
      let armorAccent = '#6D4C41';
      let weaponColor = '#A0A0A0';
      let shieldColor = '#795548';
      if (tier === 2) { armorMain = '#B0BEC5'; armorAccent = '#78909C'; weaponColor = '#B0BEC5'; shieldColor = '#546E7A'; }
      if (tier === 3) { armorMain = '#78909C'; armorAccent = '#FFD54F'; weaponColor = '#FFD54F'; shieldColor = '#FFD54F'; }
      if (tier === 4) { armorMain = '#7C4DFF'; armorAccent = '#B388FF'; weaponColor = '#B388FF'; shieldColor = '#7C4DFF'; }

      const base = 4 + bobY; // top of character (head starts here)

      // ── Head ──
      px(11, base, 10, 10, skin);

      // ── Eyes ──
      if (!blinkRef.current) {
        px(13, base + 3, 2, 2, '#333');
        px(17, base + 3, 2, 2, '#333');
      } else {
        // blink: thin line
        px(13, base + 4, 2, 1, '#555');
        px(17, base + 4, 2, 1, '#555');
      }

      // ── Hair ──
      if (hairStyle === 'short') {
        px(11, base, 10, 3, hairColor);
        px(10, base + 1, 1, 2, hairColor);
        px(21, base + 1, 1, 2, hairColor);
      } else if (hairStyle === 'long') {
        px(11, base, 10, 3, hairColor);
        px(9, base + 1, 2, 8, hairColor);
        px(21, base + 1, 2, 8, hairColor);
      } else if (hairStyle === 'spiky') {
        px(11, base, 10, 2, hairColor);
        px(11, base - 2, 2, 2, hairColor);
        px(14, base - 3, 2, 3, hairColor);
        px(17, base - 2, 2, 2, hairColor);
        px(20, base - 1, 1, 1, hairColor);
      } else if (hairStyle === 'ponytail') {
        px(11, base, 10, 2, hairColor);
        px(21, base + 1, 2, 10, hairColor);
      }

      // ── Torso (armor) ──
      px(9, base + 10, 14, 12, armorMain);
      // Shoulder pads by tier
      if (tier >= 2) { px(7, base + 10, 3, 4, armorAccent); px(22, base + 10, 3, 4, armorAccent); }
      if (tier >= 3) { px(6, base + 9, 4, 5, armorAccent); px(22, base + 9, 4, 5, armorAccent); }
      // Gold trim on tier 3+
      if (tier >= 3) {
        px(9, base + 10, 14, 1, armorAccent);
        px(9, base + 21, 14, 1, armorAccent);
      }

      // ── Arms ──
      px(5, base + 10, 4, 10, armorMain);   // left arm
      px(23, base + 10, 4, 10, armorMain);  // right arm

      // ── Legs ──
      const pantsColor = tier >= 3 ? '#546E7A' : '#5D4037';
      px(9, base + 22, 6, 12, pantsColor);   // left leg
      px(17, base + 22, 6, 12, pantsColor);  // right leg
      // Boots
      const bootColor = tier >= 2 ? '#455A64' : '#4E342E';
      px(8, base + 32, 7, 4, bootColor);
      px(17, base + 32, 7, 4, bootColor);

      // ── Weapon (right side) ──
      if (equipment.weapon) {
        px(27, base + 8, 2, 16, weaponColor);  // blade
        px(25, base + 16, 6, 2, weaponColor);  // crossguard
      }

      // ── Shield (left side) ──
      if (equipment.shield) {
        px(1, base + 12, 5, 7, shieldColor);
        px(0, base + 13, 7, 5, armorAccent);
        px(1, base + 12, 5, 7, 'transparent'); // re-clear center
        ctx.fillStyle = shieldColor;
        ctx.fillRect(1 * SCALE, (base + 12) * SCALE, 5 * SCALE, 7 * SCALE);
        ctx.fillStyle = armorAccent;
        ctx.fillRect(2 * SCALE, (base + 15) * SCALE, 3 * SCALE, 1 * SCALE);
      }

      // ── Tier 4 glow effect ──
      if (tier === 4) {
        const glowAlpha = 0.15 + 0.1 * Math.sin(timestamp / 400);
        ctx.fillStyle = `rgba(124, 77, 255, ${glowAlpha})`;
        ctx.fillRect(0, (base + 8) * SCALE, canvas.width, 20 * SCALE);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (blinkTimeout) clearTimeout(blinkTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance.skinColor, appearance.hairStyle, appearance.hairColor, equipKey]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        style={{
          imageRendering: 'auto',
          filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
        }}
      />
      {companion && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          {companion.type && ["dragon","owl","phoenix","wolf","fox","bear"].includes(companion.type)
            ? <img src={`/images/portraits/companion-${companion.type}.png`} alt={companion.name} width={28} height={28} style={{ imageRendering: "auto", borderRadius: 3, objectFit: "cover" }} />
            : companion.type === "cat" && companion.name?.toLowerCase() === "dobbie"
              ? <img src="/images/portraits/companion-dobbie.png" alt={companion.name} width={28} height={28} style={{ imageRendering: "auto", borderRadius: 3, objectFit: "cover" }} />
              : <span className="text-xl">{companion.emoji}</span>
          }
          <span className="text-xs font-semibold" style={{ color: "#e8e8e8" }}>{companion.name}</span>
        </div>
      )}
    </div>
  );
}

// ─── ProfileSettingsModal ─────────────────────────────────────────────────────

function ProfileSettingsModal({ playerName, apiKey, initialStatus, initialPartnerName, onClose, onSaved }: {
  playerName: string;
  apiKey: string;
  initialStatus: string;
  initialPartnerName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  useModalBehavior(true, onClose);
  const [status, setStatus] = useState(initialStatus);
  const [partner, setPartner] = useState(initialPartnerName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/player/${encodeURIComponent(playerName)}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
        body: JSON.stringify({ relationshipStatus: status, partnerName: partner.trim() || null }),
      });
      await onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: "#1a1a1a", border: "1px solid rgba(167,139,250,0.3)", boxShadow: "0 0 60px rgba(139,92,246,0.15)" }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-bold" style={{ color: "#f0f0f0" }}>⚙ Profil-Einstellungen</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Beziehungsstatus und weitere Einstellungen</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold block" style={{ color: "rgba(255,255,255,0.5)" }}>Beziehungsstatus</label>
          {[
            { value: "single",       label: "Single" },
            { value: "relationship", label: "In einer Beziehung" },
            { value: "married",      label: "Verheiratet" },
            { value: "complicated",  label: "Es ist kompliziert" },
            { value: "other",        label: "Andere" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm"
              style={{
                background: status === opt.value ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${status === opt.value ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.07)"}`,
                color: status === opt.value ? "#a78bfa" : "rgba(255,255,255,0.55)",
              }}
            >{opt.label}</button>
          ))}
        </div>

        {status !== "single" && (
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Name des Partners / der Partnerin</label>
            <input
              value={partner}
              onChange={e => setPartner(e.target.value)}
              placeholder="z.B. Alex, Maria..."
              className="w-full text-xs px-3 py-2 rounded-lg"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.12)", color: "#f0f0f0", outline: "none", borderRadius: 8 }}
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-xs"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
          >Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", color: "#fff" }}
          >{saving ? "…" : "Speichern"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── CharacterView ────────────────────────────────────────────────────────────

const RARITY_BORDER: Record<number, string> = {
  1: "#9ca3af",  // white/grey
  2: "#22c55e",  // green
  3: "#3b82f6",  // blue
  4: "#a855f7",  // purple
  5: "#f97316",  // orange
};

const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const STAT_LABELS: Record<string, string> = { kraft: "Kraft", ausdauer: "Ausdauer", weisheit: "Weisheit", glueck: "Glück", fokus: "Fokus", vitalitaet: "Vitalität", charisma: "Charisma", tempo: "Tempo" };

const BOND_LEVELS = [
  { level: 1,  title: "Stranger",       minXp: 0   },
  { level: 2,  title: "Acquaintance",   minXp: 10  },
  { level: 3,  title: "Friend",         minXp: 25  },
  { level: 4,  title: "Close Friend",   minXp: 50  },
  { level: 5,  title: "Best Friend",    minXp: 80  },
  { level: 6,  title: "Soulmate",       minXp: 120 },
  { level: 7,  title: "Legendary I",    minXp: 200 },
  { level: 8,  title: "Legendary II",   minXp: 300 },
  { level: 9,  title: "Legendary III",  minXp: 450 },
  { level: 10, title: "Legendary IV",   minXp: 666 },
];

const STAT_EFFECTS: Record<string, string> = {
  "Kraft":     "+0.5% Quest XP pro Punkt (max +30%)",
  "Weisheit":  "+0.5% Gold pro Punkt (max +30%)",
  "Ausdauer":  "-0.5% Forge Decay pro Punkt (min 10% der Basis-Rate)",
  "Glück":     "+0.5% Drop Chance pro Punkt (max 20%)",
  "Fokus":     "+1 Flat Bonus-XP pro Punkt (max +50)",
  "Vitalität": "+1% Streak-Schutz pro Punkt (max 75% gesamt)",
  "Charisma":  "+5% Companion Bond-XP pro Punkt",
  "Tempo":     "+1% Forge-Temp-Recovery pro Punkt",
};

const GRID_COLS = 5;
const GRID_ROWS = 12;
const GRID_TOTAL = GRID_COLS * GRID_ROWS;

const RARITY_BG: Record<string, string> = {
  common: "rgba(156,163,175,0.08)",
  uncommon: "rgba(34,197,94,0.1)",
  rare: "rgba(59,130,246,0.12)",
  epic: "rgba(168,85,247,0.15)",
  legendary: "rgba(249,115,22,0.18)",
};

const RARITY_BORDER_30: Record<string, string> = {
  common: "rgba(156,163,175,0.3)",
  uncommon: "rgba(34,197,94,0.3)",
  rare: "rgba(59,130,246,0.3)",
  epic: "rgba(168,85,247,0.3)",
  legendary: "rgba(249,115,22,0.3)",
};

type InventoryItem = CharacterData["inventory"][number];

function InventoryTooltip({ item, mousePosRef }: { item: InventoryItem; mousePosRef: React.RefObject<{ x: number; y: number }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const rarityColor = RARITY_COLORS[item.rarity] || "#9ca3af";
  const hasStats = item.stats && Object.keys(item.stats).length > 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const pos = mousePosRef.current;
      if (!pos) { raf = requestAnimationFrame(update); return; }
      const tw = 340;
      const th = el.offsetHeight || 300;
      let left = pos.x + 12;
      let top = pos.y + 12;
      if (left + tw > window.innerWidth - 8) left = pos.x - tw - 8;
      if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
      if (top < 4) top = 4;
      if (left < 4) left = 4;
      el.style.transform = `translate(${left}px, ${top}px)`;
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [mousePosRef]);

  return (
    <div
      ref={ref}
      className="fixed z-[200] pointer-events-none"
      style={{ left: 0, top: 0, minWidth: 260, maxWidth: 340, willChange: "transform" }}
    >
      <div
        className="rounded-lg p-3 space-y-2"
        style={{
          background: "#1a1a1a",
          borderTop: `3px solid ${rarityColor}`,
          border: `1px solid rgba(255,255,255,0.12)`,
          borderTopColor: rarityColor,
          borderTopWidth: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
        }}
      >
        {/* Icon + Name */}
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 160, height: 160, background: "rgba(255,255,255,0.04)", borderRadius: 8, border: `1px solid ${rarityColor}40` }}>
            {item.icon
              ? <img src={item.icon} alt={item.name} width={148} height={148} style={{ imageRendering: "auto" }} />
              : <span className="text-6xl" style={{ color: rarityColor }}>◆</span>
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "#fff" }}>{item.name}</p>
            <p className="text-xs font-semibold" style={{ color: rarityColor }}>{RARITY_LABELS[item.rarity] || item.rarity}</p>
          </div>
        </div>

        {/* Description */}
        {item.desc && (
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>
        )}

        {/* Stats */}
        {hasStats && (
          <div className="space-y-0.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {Object.entries(item.stats).map(([stat, val]) => (
              <div key={stat} className="flex items-center justify-between text-xs">
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{STAT_LABELS[stat] || stat}</span>
                <span className="font-mono font-semibold" style={{ color: "#4ade80" }}>+{val as number}</span>
              </div>
            ))}
          </div>
        )}

        {/* Level requirement + Slot type */}
        <div className="text-xs pt-1 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {item.minLevel && item.minLevel > 1 && (
            <p style={{ color: item.minLevel > (item as any)._playerLevel ? "#ef4444" : "rgba(255,255,255,0.4)" }}>
              Benötigt Level {item.minLevel}
            </p>
          )}
          {item.slot && (
            <p style={{ color: "rgba(255,255,255,0.3)" }}>
              {item.type || item.slot}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const RARITY_SORT_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };

type InvFilter = "all" | "equipment" | "consumable" | "passive";
type InvSort = "none" | "rarity" | "name" | "level";

const INV_FILTERS: { key: InvFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "equipment", label: "Gear" },
  { key: "consumable", label: "Items" },
  { key: "passive", label: "Passiv" },
];

const INV_SORTS: { key: InvSort; label: string }[] = [
  { key: "none", label: "Standard" },
  { key: "rarity", label: "Seltenheit" },
  { key: "name", label: "Name" },
  { key: "level", label: "Level" },
];

function InventorySlot({ item, level, idx, onItemClick, onDragStart, onDragOver, onDrop, dragOverIdx }: {
  item: InventoryItem | null;
  level: number;
  idx: number;
  onItemClick: (item: InventoryItem, rect: { x: number; y: number; width: number; height: number }) => void;
  onDragStart: (idx: number) => void;
  onDragOver: (idx: number) => void;
  onDrop: () => void;
  dragOverIdx: number | null;
}) {
  const [hovered, setHovered] = useState(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const isDropTarget = dragOverIdx === idx;

  if (!item) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); onDragOver(idx); }}
        onDrop={(e) => { e.preventDefault(); onDrop(); }}
        style={{
          width: 56,
          height: 56,
          background: isDropTarget ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${isDropTarget ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 3,
          transition: "background 0.15s, border-color 0.15s",
        }}
      />
    );
  }

  const rarityBg = RARITY_BG[item.rarity] ?? "rgba(255,255,255,0.04)";
  const rarityBorder = RARITY_BORDER_30[item.rarity] ?? "rgba(255,255,255,0.08)";

  return (
    <>
      <button
        ref={btnRef}
        draggable
        onDragStart={(e) => {
          onDragStart(idx);
          e.dataTransfer.effectAllowed = "move";
          if (btnRef.current) {
            e.dataTransfer.setDragImage(btnRef.current, 28, 28);
          }
        }}
        onDragOver={(e) => { e.preventDefault(); onDragOver(idx); }}
        onDrop={(e) => { e.preventDefault(); onDrop(); }}
        onDragEnd={() => { /* cleanup handled by parent */ }}
        onClick={() => {
          const el = btnRef.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          onItemClick(item, { x: r.left, y: r.top, width: r.width, height: r.height });
        }}
        onMouseEnter={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; setHovered(true); }}
        onMouseMove={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; }}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 56,
          height: 56,
          background: isDropTarget ? "rgba(167,139,250,0.2)" : rarityBg,
          border: `1px solid ${isDropTarget ? "rgba(167,139,250,0.5)" : rarityBorder}`,
          borderRadius: 3,
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 2,
          position: "relative",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        {item.icon
          ? <img src={item.icon} alt={item.name} draggable={false} style={{ width: 44, height: 44, imageRendering: "auto", objectFit: "contain" }} />
          : <span style={{ fontSize: 14, color: RARITY_COLORS[item.rarity] || "#9ca3af", lineHeight: 1 }}>◆</span>
        }
        {/* Level requirement indicator */}
        {item.minLevel > 0 && item.minLevel > level && (
          <span style={{ position: "absolute", bottom: 1, right: 1, fontSize: 12, color: "#ef4444", fontWeight: 700, background: "rgba(0,0,0,0.7)", borderRadius: 2, padding: "0 2px" }}>
            Lv{item.minLevel}
          </span>
        )}
      </button>
      {hovered && createPortal(<InventoryTooltip item={item} mousePosRef={mousePosRef} />, document.body)}
    </>
  );
}

const EQUIP_SLOT_LABELS: { slot: string; emoji: string; label: string; iconSrc?: string }[] = [
  { slot: "helm", emoji: "", iconSrc: "/images/icons/equip-helm.png", label: "Helm" },
  { slot: "weapon", emoji: "", iconSrc: "/images/icons/equip-weapon.png", label: "Waffe" },
  { slot: "shield", emoji: "", iconSrc: "/images/icons/equip-shield.png", label: "Schild" },
  { slot: "armor", emoji: "", iconSrc: "/images/icons/equip-armor.png", label: "Rüstung" },
  { slot: "amulet", emoji: "", iconSrc: "/images/icons/equip-amulet.png", label: "Amulett" },
  { slot: "boots", emoji: "", iconSrc: "/images/icons/equip-boots.png", label: "Stiefel" },
];

function GearSlotRow({ slot, iconSrc, label, item, onUnequip, unequipping }: {
  slot: string;
  iconSrc?: string;
  label: string;
  item: InventoryItem | null;
  onUnequip: (slot: string) => void;
  unequipping: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const borderColor = item ? (RARITY_COLORS[item.rarity] || "#9ca3af") : "rgba(255,255,255,0.1)";

  return (
    <>
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
        style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${borderColor}` }}
        onMouseEnter={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; if (item) setHovered(true); }}
        onMouseMove={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; }}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="flex items-center justify-center" style={{ width: 40, height: 40, flexShrink: 0 }}>
          {iconSrc ? <img src={iconSrc} alt={label} width={40} height={40} style={{ imageRendering: "auto" }} /> : null}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: item ? "#e8e8e8" : "rgba(255,255,255,0.3)" }}>
            {item
              ? <span className="inline-flex items-center gap-1">{item.icon ? <img src={item.icon} alt="" width={36} height={36} style={{ imageRendering: "auto" }} /> : <span style={{ color: RARITY_COLORS[item.rarity] || "#9ca3af" }}>◆</span>} {item.name}</span>
              : <span style={{ color: "rgba(255,255,255,0.2)" }}>Leer</span>}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{label}</p>
        </div>
        {item && (
          <button
            onClick={() => onUnequip(slot)}
            disabled={unequipping === slot}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}
          >
            {unequipping === slot ? "…" : "−"}
          </button>
        )}
      </div>
      {hovered && item && createPortal(<InventoryTooltip item={item} mousePosRef={mousePosRef} />, document.body)}
    </>
  );
}

export default function CharacterView({ addToast, onNavigate }: { addToast?: (t: ToastInput) => void; onNavigate?: (tab: string) => void }) {
  const { playerName, reviewApiKey: apiKey, users, classesList } = useDashboard();
  const [charData, setCharData] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [unequipping, setUnequipping] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"stats" | "ausrustung">("stats");
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ item: CharacterData["inventory"][number]; rect: { x: number; y: number; width: number; height: number } } | null>(null);
  const [statTooltipOpen, setStatTooltipOpen] = useState<string | null>(null);
  const [invFilter, setInvFilter] = useState<InvFilter>("all");
  const [invSort, setInvSort] = useState<InvSort>("none");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Position-based grid: maps grid slot index → item id (supports gaps)
  const [invPositions, setInvPositions] = useState<Record<string, number>>({});
  // Title system
  const [titlesOpen, setTitlesOpen] = useState(false);
  const [earnedTitles, setEarnedTitles] = useState<{ id: string; name: string; description?: string; rarity: string; earnedAt?: string }[]>([]);
  const [equippedTitleId, setEquippedTitleId] = useState<string | null>(null);

  useEffect(() => {
    if (!statTooltipOpen) return;
    const close = () => setStatTooltipOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [statTooltipOpen]);

  // Close sort dropdown on click outside
  useEffect(() => {
    if (!sortDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) setSortDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [sortDropdownOpen]);

  // Load inventory positions from localStorage
  useEffect(() => {
    if (!playerName) return;
    try {
      const saved = localStorage.getItem(`inv-pos-${playerName}`);
      if (saved) setInvPositions(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [playerName]);

  const PETAL_COUNT = 35;
  const petals = useMemo(() => Array.from({ length: PETAL_COUNT }, (_, i) => ({
    id: i,
    image: `/images/petals/petal-${String((i % 12) + 1).padStart(2, '0')}.png`,
    left: Math.random() * 100,
    delay: Math.random() * 15,
    duration: 10 + Math.random() * 15,
    size: 8 + Math.random() * 10,
    drift: -30 + Math.random() * 60,
    rotation: Math.random() * 360,
  })), []);

  const fetchChar = useCallback(async () => {
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/character`);
      if (r.ok) setCharData(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [playerName]);

  useEffect(() => { fetchChar(); }, [fetchChar]);

  const handleEquip = async (itemId: string) => {
    if (!apiKey) return;
    setEquipping(itemId);
    setSelectedItem(null);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/equip/${itemId}`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
      });
      if (r.ok) {
        const item = charData?.inventory.find(i => i.id === itemId);
        if (item && addToast) {
          addToast({ type: "item", itemName: item.name, message: `${item.name} ausgerüstet!`, icon: item.icon, rarity: item.rarity || "common" });
        }
      }
      await fetchChar();
    } finally { setEquipping(null); }
  };

  const handleUnequip = async (slot: string) => {
    if (!apiKey) return;
    setUnequipping(slot);
    setSelectedItem(null);
    try {
      await fetch(`/api/player/${encodeURIComponent(playerName)}/unequip/${slot}`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
      });
      await fetchChar();
    } finally { setUnequipping(null); }
  };

  const handleUseItem = async (itemId: string) => {
    if (!apiKey) return;
    setSelectedItem(null);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/inventory/use/${itemId}`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
      });
      if (r.ok) {
        const data = await r.json();
        const item = charData?.inventory.find(i => i.id === itemId);
        if (addToast && item) {
          addToast({ type: "item", itemName: item.name, message: data.message || "Item benutzt!", icon: item.icon, rarity: item.rarity || "common" });
        }
      }
      await fetchChar();
    } catch { /* ignore */ }
  };

  const handleDiscardItem = async (itemId: string) => {
    if (!apiKey) return;
    setSelectedItem(null);
    try {
      await fetch(`/api/player/${encodeURIComponent(playerName)}/inventory/discard/${itemId}`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
      });
      await fetchChar();
    } catch { /* ignore */ }
  };

  const loggedInUser = users.find(u => u.name.toLowerCase() === playerName.toLowerCase());
  void loggedInUser;
  const cls = (charData?.classId && charData.classId !== "null") ? classesList.find(c => c.id === charData.classId) : null;

  return (
    <div>
    <div
      className="relative overflow-hidden rounded-t-2xl"
      style={{
        height: 550,
        backgroundColor: "#fce4ec",
      }}
    >
      {/* ── Background image (brightness applied only here, not on parent) ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/images/bg-character-spring.png')",
          backgroundSize: "100% auto",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          imageRendering: "auto" as any,
          filter: "brightness(1.3)",
          pointerEvents: "none",
        }}
      />
      {/* ── Layer 1: Dark overlay for readability ── */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(11,13,17,0.45)", pointerEvents: "none", zIndex: 1 }}
      />

      {/* ── Petal Rain ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 2 }}>
        {petals.map(p => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              top: 0,
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animation: `petalFall ${p.duration}s ${p.delay}s infinite linear`,
              animationFillMode: "backwards",
              opacity: 0,
              "--drift": `${p.drift}px`,
              pointerEvents: "none",
              imageRendering: "auto",
            } as React.CSSProperties}
          >
            <img src={p.image} alt="" style={{ width: "100%", height: "100%", imageRendering: "auto" }} />
          </div>
        ))}
      </div>

      {/* ── Layer 5: Ground ── */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: 60, background: "linear-gradient(0deg, #4a3728 0%, #5d4037 20%, transparent 100%)", zIndex: 2 }}
      />

      {/* ── Main 3-column layout ── */}
      <div className="relative flex gap-3 p-4" style={{ zIndex: 4, height: "calc(100% - 0px)", minHeight: 0 }}>

        {/* LEFT: Inventory Panel */}
        <div
          className="flex-shrink-0 rounded-xl p-2 overflow-y-auto"
          style={{ width: 310, maxHeight: 490, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)", minHeight: 0, paddingRight: 12 }}
        >
          {/* Header + Sort */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>Inventar</p>
            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setSortDropdownOpen(v => !v)}
                className="text-xs rounded px-2 py-1 flex items-center gap-1"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  outline: "none",
                  minWidth: 90,
                  justifyContent: "space-between",
                }}
              >
                <span>{INV_SORTS.find(s => s.key === invSort)?.label ?? "Standard"}</span>
                <span style={{ fontSize: 8, opacity: 0.5 }}>{sortDropdownOpen ? "▲" : "▼"}</span>
              </button>
              {sortDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 2,
                    background: "rgba(18,14,28,0.97)",
                    border: "1px solid rgba(167,139,250,0.25)",
                    borderRadius: 6,
                    overflow: "hidden",
                    zIndex: 50,
                    minWidth: 110,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                  }}
                >
                  {INV_SORTS.map(s => (
                    <button
                      key={s.key}
                      onClick={() => { setInvSort(s.key); setSortDropdownOpen(false); }}
                      className="w-full text-left text-xs px-3 py-1.5"
                      style={{
                        background: invSort === s.key ? "rgba(167,139,250,0.15)" : "transparent",
                        color: invSort === s.key ? "#a78bfa" : "rgba(255,255,255,0.6)",
                        cursor: "pointer",
                        border: "none",
                        display: "block",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { if (invSort !== s.key) (e.target as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={e => { if (invSort !== s.key) (e.target as HTMLElement).style.background = "transparent"; }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 mb-2">
            {INV_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setInvFilter(f.key)}
                className="flex-1 py-0.5 rounded text-xs font-semibold"
                style={{
                  background: invFilter === f.key ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${invFilter === f.key ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: invFilter === f.key ? "#a78bfa" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Lädt...</p>}
          {!loading && charData && (() => {
            const equippedIds = new Set(
              Object.values(charData.equipment).filter(Boolean).map(v =>
                typeof v === 'object' && v !== null ? ((v as GearInstance).instanceId || (v as GearInstance).templateId) : v
              )
            );
            let unequipped = charData.inventory.filter(i => !equippedIds.has(i.id));

            // Filter
            if (invFilter !== "all") {
              unequipped = unequipped.filter(i => {
                const t = i.type || "consumable";
                return t === invFilter;
              });
            }

            // Sort
            const isSorted = invSort !== "none";
            if (invSort === "rarity") {
              unequipped = [...unequipped].sort((a, b) => (RARITY_SORT_ORDER[a.rarity] ?? 9) - (RARITY_SORT_ORDER[b.rarity] ?? 9));
            } else if (invSort === "name") {
              unequipped = [...unequipped].sort((a, b) => a.name.localeCompare(b.name));
            } else if (invSort === "level") {
              unequipped = [...unequipped].sort((a, b) => (b.minLevel || 0) - (a.minLevel || 0));
            }

            // Build position-based grid (only in "Standard" sort mode)
            // grid[slotIndex] = item | null
            const grid: (InventoryItem | null)[] = new Array(GRID_TOTAL).fill(null);
            if (isSorted) {
              // When sorted: compact layout, no custom positions
              for (let i = 0; i < unequipped.length && i < GRID_TOTAL; i++) grid[i] = unequipped[i];
            } else {
              // Standard mode: use saved positions, place items with gaps
              const positioned = new Set<number>();
              const unplaced: InventoryItem[] = [];
              for (const item of unequipped) {
                const pos = invPositions[item.id];
                if (pos !== undefined && pos >= 0 && pos < GRID_TOTAL && !positioned.has(pos)) {
                  grid[pos] = item;
                  positioned.add(pos);
                } else {
                  unplaced.push(item);
                }
              }
              // Place remaining items in first available slots
              let nextSlot = 0;
              for (const item of unplaced) {
                while (nextSlot < GRID_TOTAL && grid[nextSlot] !== null) nextSlot++;
                if (nextSlot < GRID_TOTAL) {
                  grid[nextSlot] = item;
                  nextSlot++;
                }
              }
            }

            const handleDragStart = (idx: number) => setDragFromIdx(idx);
            const handleDragOver = (idx: number) => setDragOverIdx(idx);
            const handleDrop = async () => {
              if (dragFromIdx === null || dragOverIdx === null || dragFromIdx === dragOverIdx) {
                setDragFromIdx(null);
                setDragOverIdx(null);
                return;
              }

              const srcItem = grid[dragFromIdx];
              const dstItem = grid[dragOverIdx];
              if (!srcItem) { setDragFromIdx(null); setDragOverIdx(null); return; }

              // Swap positions (or move to empty slot)
              const newPositions = { ...invPositions };
              newPositions[srcItem.id] = dragOverIdx;
              if (dstItem) {
                newPositions[dstItem.id] = dragFromIdx;
              }
              setInvPositions(newPositions);
              setDragFromIdx(null);
              setDragOverIdx(null);

              // Persist positions to localStorage
              try { localStorage.setItem(`inv-pos-${playerName}`, JSON.stringify(newPositions)); } catch { /* ignore */ }

              // Persist order to backend (flat item list, no gaps)
              try {
                const allEquippedIds = new Set(Object.values(charData.equipment).filter(Boolean));
                const equipped = charData.inventory.filter(i => allEquippedIds.has(i.id));
                // Build new grid with swap applied
                const newGrid = [...grid];
                newGrid[dragOverIdx] = srcItem;
                newGrid[dragFromIdx] = dstItem;
                const reordered = newGrid.filter(Boolean) as InventoryItem[];
                const fullOrder = [...equipped, ...reordered].map(i => i.id);
                await fetch(`/api/player/${encodeURIComponent(playerName)}/inventory/reorder`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
                  body: JSON.stringify({ order: fullOrder }),
                });
              } catch { /* silent */ }
            };

            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${GRID_COLS}, 56px)`,
                  gap: 2,
                }}
              >
                {Array.from({ length: GRID_TOTAL }, (_, idx) => {
                  const item = grid[idx];
                  return (
                    <InventorySlot
                      key={item?.id ?? `empty-${idx}`}
                      item={item}
                      idx={idx}
                      level={charData.level}
                      onItemClick={(itm, rect) => setSelectedItem({ item: itm, rect })}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      dragOverIdx={dragOverIdx}
                    />
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* CENTER: Character Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative" style={{ minHeight: 360 }}>
          <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: 200 }}>
            <div className="flex items-center justify-center" style={{ width: 160, height: 160, borderRadius: 16, background: "rgba(167,139,250,0.06)", border: "2px dashed rgba(167,139,250,0.2)" }}>
              <span className="text-4xl" style={{ opacity: 0.3 }}>?</span>
            </div>
            <p className="text-sm font-bold" style={{ color: "rgba(167,139,250,0.5)" }}>Hero Spawning...</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Pixel art coming soon</p>
          </div>
        </div>

        {/* RIGHT: Stats / Gear Panel */}
        <div
          className="flex-shrink-0 rounded-xl p-3 overflow-y-auto"
          style={{ width: 250, maxHeight: 490, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)", minHeight: 0 }}
        >
          {/* Tab toggle */}
          <div className="flex gap-1 mb-3">
            {(["stats", "ausrustung"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className="flex-1 py-1 rounded-lg text-xs font-semibold"
                style={{
                  background: rightTab === tab ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${rightTab === tab ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
                  color: rightTab === tab ? "#a78bfa" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                }}
              >
                {tab === "stats" ? "Stats" : "Gear"}
              </button>
            ))}
          </div>

          {/* Gear tab */}
          {rightTab === "ausrustung" && (
            <div className="space-y-1.5">
              {EQUIP_SLOT_LABELS.map(({ slot, iconSrc, label }) => {
                const eqRaw = charData?.equipment[slot];
                const isInstance = eqRaw && typeof eqRaw === 'object';
                const gi = isInstance ? eqRaw as GearInstance : null;
                const equippedItemId = gi ? (gi.instanceId || gi.templateId) : eqRaw;
                // For instance objects, build item directly from equipment data
                const item = gi
                  ? { id: gi.instanceId || gi.templateId, name: gi.name, slot: gi.slot, rarity: gi.rarity || 'common', stats: gi.stats || {}, icon: gi.icon || undefined, tier: gi.tier || 0, minLevel: gi.reqLevel || 0, desc: gi.desc, legendaryEffect: gi.legendaryEffect, affixes: gi.affixRolls }
                  : equippedItemId ? charData?.inventory.find(i => i.id === equippedItemId) ?? null : null;
                return (
                  <GearSlotRow
                    key={slot}
                    slot={slot}
                    iconSrc={iconSrc}
                    label={label}
                    item={item}
                    onUnequip={handleUnequip}
                    unequipping={unequipping}
                  />
                );
              })}




              {/* Passive Items */}
              {charData && (() => {
                const passives = charData.inventory.filter(i => i.type === "passive");
                if (!passives.length) return null;
                return (
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Active Passives</p>
                    <div className="space-y-1">
                      {passives.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                        >
                          {item.icon
                            ? <img src={item.icon} alt={item.name} width={32} height={32} style={{ imageRendering: "auto", flexShrink: 0 }} />
                            : <span style={{ width: 32, height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: RARITY_COLORS[item.rarity] || "#9ca3af", fontSize: 14 }}>◆</span>
                          }
                          <div className="flex-1 min-w-0" title={item.desc || item.name}>
                            <p className="text-xs font-semibold" style={{ color: "#e0e0e0" }}>{item.name}</p>
                            {item.desc && <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.3 }}>{item.desc}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Stats tab */}
          {rightTab === "stats" && loading && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Lädt...</p>}
          {rightTab === "stats" && !loading && charData && (() => {
            const { kraft, ausdauer, weisheit, glueck, fokus, vitalitaet, charisma, tempo } = charData.stats;
            const base = charData.baseStats;
            const statRows = [
              { icon: "/images/icons/stat-kraft.png", label: "Kraft", iconSrc: "/images/icons/stat-kraft.png",    val: kraft,    base: base.kraft,    tooltip: "KRA · +0.5% Quest-XP pro Punkt (max +30%)" },
              { icon: "/images/icons/stat-ausdauer.png", label: "Ausdauer", iconSrc: "/images/icons/stat-ausdauer.png", val: ausdauer, base: base.ausdauer, tooltip: "AUS · -0.5% Forge Decay pro Punkt" },
              { icon: "/images/icons/stat-weisheit.png", label: "Weisheit", iconSrc: "/images/icons/stat-weisheit.png", val: weisheit, base: base.weisheit, tooltip: "WEI · +0.5% Gold pro Punkt (max +30%)" },
              { icon: "/images/icons/stat-glueck.png", label: "Glück", iconSrc: "/images/icons/stat-glueck.png",    val: glueck,   base: base.glueck,   tooltip: "GLÜ · +0.5% Drop-Chance pro Punkt (max 20%)" },
            ];
            const minorStatRows = [
              { label: "Fokus", val: fokus || 0, tooltip: "FOK · +1 Flat Bonus-XP pro Punkt (max +50)" },
              { label: "Vitalität", val: vitalitaet || 0, tooltip: "VIT · +1% Streak-Schutz pro Punkt (max 75%)" },
              { label: "Charisma", val: charisma || 0, tooltip: "CHA · +5% Companion Bond-XP pro Punkt" },
              { label: "Tempo", val: tempo || 0, tooltip: "TMP · +1% Forge-Temp-Recovery pro Punkt" },
            ];
            const hasMinorStats = minorStatRows.some(s => s.val > 0);
            return (
              <>
                <div className="space-y-2 mb-4">
                  {statRows.map(s => {
                    const bonus = s.val - s.base;
                    const isOpen = statTooltipOpen === s.label;
                    return (
                      <div key={s.label} style={{ position: "relative" }}>
                        <div
                          className="flex items-center gap-2"
                          style={{ cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); setStatTooltipOpen(isOpen ? null : s.label); }}
                        >
                          <img src={s.iconSrc} alt={s.label} width={16} height={16} style={{ imageRendering: "auto" }} className="w-4 h-4" />
                          <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.65)" }}>{s.label}</span>
                          <span className="text-xs font-mono font-bold" style={{ color: "#e8e8e8" }}>{s.val}</span>
                          {bonus > 0 && (
                            <span className="text-xs font-mono" style={{ color: "#4ade80" }}>(+{bonus})</span>
                          )}
                        </div>
                        {isOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "calc(100% + 4px)",
                              right: 0,
                              zIndex: 300,
                              background: "#141414",
                              border: `1px solid rgba(255,255,255,0.15)`,
                              borderRadius: 6,
                              padding: "6px 10px",
                              whiteSpace: "nowrap",
                              boxShadow: "0 4px 16px rgba(0,0,0,0.7)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-xs font-semibold" style={{ color: "#e8e8e8" }}>{s.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{STAT_EFFECTS[s.label] ?? s.tooltip}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Minor Stats */}
                {hasMinorStats && (
                  <div className="space-y-1.5 mb-4 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Sekundär-Stats</p>
                    {minorStatRows.filter(s => s.val > 0).map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
                        <span className="text-xs font-mono font-bold" style={{ color: "#a78bfa" }}>{s.val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Set Bonus */}
                {charData.setBonusInfo && (
                  <div className="mb-3 px-2 py-1.5 rounded-lg" style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}>
                    <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>
                      {charData.setBonusInfo.name} {charData.setBonusInfo.count}/{charData.setBonusInfo.total}
                      {charData.setBonusInfo.count >= charData.setBonusInfo.total ? " ✓" : " ○"}
                    </p>
                  </div>
                )}
                {/* Named Set Bonuses */}
                {(charData.namedSetBonuses ?? []).map(ns => {
                  const rarityColors: Record<string, string> = { common: "#9ca3af", uncommon: "#22c55e", rare: "#60a5fa", epic: "#a78bfa", legendary: "#f59e0b" };
                  const c = rarityColors[ns.rarity] ?? "#a78bfa";
                  return (
                    <div key={ns.id} className="mb-2 px-2 py-1.5 rounded-lg" style={{ background: `${c}10`, border: `1px solid ${c}30` }}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold" style={{ color: c }}>
                          {ns.name} {ns.count}/{ns.total} {ns.isComplete ? "✓" : "○"}
                        </p>
                      </div>
                      {ns.activeLabel && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{ns.activeLabel}</p>}
                    </div>
                  );
                })}

                {/* Legendary Effects */}
                {(charData.legendaryEffects ?? []).length > 0 && (
                  <div className="mb-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <p className="text-xs font-bold mb-1" style={{ color: "#f97316" }}>Legendary Effects</p>
                    {(charData.legendaryEffects ?? []).map((e, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: "rgba(249,115,22,0.7)" }}>{e.label}</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{e.itemName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Level bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: "#a78bfa" }}>Lv.{charData.level}</span>
                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {charData.xpInLevel ?? charData.xp}{charData.xpForLevel ? ` / ${charData.xpForLevel}` : ""} XP
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.07)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(charData.xpProgress * 100).toFixed(1)}%`, background: "linear-gradient(90deg, #7c3aed, #a78bfa)" }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{charData.title}</p>
                </div>

                {/* Class */}
                {cls && (
                  <div className="mb-3 px-2 py-1.5 rounded-lg" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cls.icon}</span>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>{cls.fantasy}</p>
                        {charData.classTier && <p className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>{charData.classTier}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Title */}
                <div className="mb-3">
                  <button
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left"
                    style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
                    onClick={async () => {
                      setTitlesOpen(!titlesOpen);
                      if (!titlesOpen && playerName) {
                        try {
                          const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/titles`, { signal: AbortSignal.timeout(3000) });
                          if (r.ok) {
                            const data = await r.json();
                            setEarnedTitles(data.earned || []);
                            setEquippedTitleId(data.equipped?.id || null);
                          }
                        } catch { /* ignore */ }
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
                        {charData.equippedTitle?.name || "No Title"}
                      </span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                        ({charData.earnedTitleCount ?? 0} earned)
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{titlesOpen ? "▲" : "▼"}</span>
                  </button>
                  {titlesOpen && (
                    <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
                      {/* Unequip option */}
                      <button
                        className="w-full text-left px-2 py-1 rounded text-xs"
                        style={{ background: !equippedTitleId ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)" }}
                        onClick={async () => {
                          try {
                            const r = await fetch(`/api/player/${encodeURIComponent(playerName!)}/title/equip`, {
                              method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
                              body: JSON.stringify({ titleId: null }),
                            });
                            if (r.ok) { setEquippedTitleId(null); addToast?.({ type: "purchase", message: "Title removed" }); }
                          } catch { /* ignore */ }
                        }}
                      >
                        — No Title —
                      </button>
                      {earnedTitles.map(t => {
                        const tc: Record<string,string> = { common: "#9ca3af", uncommon: "#22c55e", rare: "#60a5fa", epic: "#a855f7", legendary: "#f97316" };
                        const c = tc[t.rarity] ?? "#9ca3af";
                        return (
                          <button
                            key={t.id}
                            className="w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between"
                            style={{ background: equippedTitleId === t.id ? `${c}18` : "rgba(255,255,255,0.03)", border: equippedTitleId === t.id ? `1px solid ${c}40` : "1px solid transparent" }}
                            onClick={async () => {
                              try {
                                const r = await fetch(`/api/player/${encodeURIComponent(playerName!)}/title/equip`, {
                                  method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
                                  body: JSON.stringify({ titleId: t.id }),
                                });
                                if (r.ok) { setEquippedTitleId(t.id); addToast?.({ type: "purchase", message: `Title: ${t.name}` }); }
                              } catch { /* ignore */ }
                            }}
                          >
                            <span style={{ color: c }}>{t.name}</span>
                            {t.description && <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{t.description}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Forge Temp */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Forge Temp</span>
                    <span className="flex items-center gap-1 text-xs font-mono" style={{ color: charData.forgeTemp >= 70 ? "#f97316" : charData.forgeTemp >= 40 ? "#facc15" : "#9ca3af" }}>
                      <img
                        src="/images/icons/ach-forge-novice.png"
                        alt="forge"
                        width={16}
                        height={16}
                        style={{
                          imageRendering: "auto",
                          filter: charData.forgeTemp >= 70
                            ? "brightness(1.2) sepia(1) saturate(3) hue-rotate(-10deg)"
                            : charData.forgeTemp >= 40
                            ? "brightness(1.1) sepia(1) saturate(2) hue-rotate(10deg)"
                            : "brightness(0.6) grayscale(0.8)",
                        }}
                      />
                      {charData.forgeTemp}%
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.07)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${charData.forgeTemp}%`,
                        background: charData.forgeTemp >= 70 ? "linear-gradient(90deg, #ea580c, #f97316)" : charData.forgeTemp >= 40 ? "linear-gradient(90deg, #ca8a04, #facc15)" : "linear-gradient(90deg, #374151, #6b7280)",
                      }}
                    />
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Profile Settings Modal */}
      {profileSettingsOpen && (
        <ProfileSettingsModal
          playerName={playerName}
          apiKey={apiKey}
          initialStatus={charData?.relationshipStatus ?? "single"}
          initialPartnerName={charData?.partnerName ?? ""}
          onClose={() => setProfileSettingsOpen(false)}
          onSaved={fetchChar}
        />
      )}

      {/* Item Action Popup */}
      {selectedItem && charData && (() => {
        const equippedIds = Object.values(charData.equipment).filter(Boolean);
        const isEquipped = equippedIds.includes(selectedItem.item.id);
        const equippedSlot = isEquipped
          ? Object.entries(charData.equipment).find(([, v]) => v === selectedItem.item.id)?.[0]
          : undefined;
        return (
          <ItemActionPopup
            item={selectedItem.item}
            anchorRect={selectedItem.rect}
            playerLevel={charData.level}
            isEquipped={isEquipped}
            equippedSlot={equippedSlot}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
            onUse={handleUseItem}
            onDiscard={handleDiscardItem}
            onClose={() => setSelectedItem(null)}
          />
        );
      })()}
    </div>

    {/* ── Bottom Info Bar (below character art) ── */}
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-b-2xl"
      style={{ background: "rgba(0,0,0,0.82)", borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-bold truncate" style={{ color: "#e8e8e8" }}>{playerName}</p>
          <button
            onClick={() => setProfileSettingsOpen(true)}
            className="text-xs px-1.5 py-0.5 rounded-lg ml-2"
            title="Profil-Einstellungen"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
          >...</button>
        </div>
        {charData && <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{charData.title}</p>}
      </div>
      {cls && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-lg">{cls.icon}</span>
          <div className="text-center">
            <p className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>{cls.fantasy}</p>
            {charData?.classTier && <p className="text-xs" style={{ color: "rgba(167,139,250,0.45)" }}>{charData.classTier}</p>}
          </div>
        </div>
      )}
      {onNavigate && (
        <button
          onClick={() => onNavigate("forge")}
          className="cross-nav-link shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-semibold"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", color: "rgba(245,158,11,0.55)" }}
          title="Reroll stats, enchant gear, craft items"
        >
          Artisan&#39;s Quarter &#8250;
        </button>
      )}
      {charData?.companion && (() => {
        const comp = charData.companion;
        const bondXp = comp.bondXp ?? 0;
        const bondLvl = [...BOND_LEVELS].reverse().find(b => bondXp >= b.minXp) ?? BOND_LEVELS[0];
        const nextBond = BOND_LEVELS.find(b => b.level === bondLvl.level + 1);
        const bondProgress = nextBond
          ? Math.min(1, (bondXp - bondLvl.minXp) / (nextBond.minXp - bondLvl.minXp))
          : 1;
        const xpToNext = nextBond ? nextBond.minXp - bondXp : 0;
        return (
          <div className="flex items-center gap-2 shrink-0">
            {comp.type && ["dragon","owl","phoenix","wolf","fox","bear"].includes(comp.type)
              ? <img src={`/images/portraits/companion-${comp.type}.png`} alt={comp.name} width={32} height={32} style={{ imageRendering: "auto", borderRadius: 4, objectFit: "cover" }} />
              : comp.type === "cat" && comp.name?.toLowerCase() === "dobbie"
                ? <img src="/images/portraits/companion-dobbie.png" alt={comp.name} width={32} height={32} style={{ imageRendering: "auto", borderRadius: 4, objectFit: "cover" }} />
                : <span className="text-xl">{comp.emoji}</span>
            }
            <div>
              <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{comp.name}</p>
              <p className="text-xs" style={{ color: "#f48fb1" }}>{bondLvl.title}</p>
              <div className="rounded-full overflow-hidden mt-0.5" style={{ height: 3, width: 72, background: "rgba(255,255,255,0.07)" }}>
                <div style={{ width: `${bondProgress * 100}%`, height: "100%", background: "linear-gradient(90deg, #ec4899, #f9a8d4)", borderRadius: 9999 }} />
              </div>
              {nextBond && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{xpToNext} XP → {nextBond.title}</p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
    </div>
  );
}
