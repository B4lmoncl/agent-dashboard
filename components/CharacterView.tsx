"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { User, CharacterData, ClassDef, PixelCharacterProps } from "@/app/types";

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
  }, [appearance.skinColor, appearance.hairStyle, appearance.hairColor, JSON.stringify(equipment)]);

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
          <span className="text-xl">{companion.emoji}</span>
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
  const [status, setStatus] = useState(initialStatus);
  const [partner, setPartner] = useState(initialPartnerName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/player/${encodeURIComponent(playerName)}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
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

const STAT_LABELS: Record<string, string> = { kraft: "Kraft", ausdauer: "Ausdauer", weisheit: "Weisheit", glueck: "Glück" };

const GRID_COLS = 6;
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

        {/* Slot type */}
        {item.slot && (
          <p className="text-xs pt-1" style={{ color: "rgba(255,255,255,0.3)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {item.type || item.slot}
          </p>
        )}
      </div>
    </div>
  );
}

function InventorySlot({ item, level, onEquip }: {
  item: InventoryItem | null;
  level: number;
  onEquip: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const mousePosRef = useRef({ x: 0, y: 0 });

  if (!item) {
    return (
      <div
        style={{
          width: 56,
          height: 56,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 3,
        }}
      />
    );
  }

  const locked = item.minLevel > level;
  const rarityBg = RARITY_BG[item.rarity] ?? "rgba(255,255,255,0.04)";
  const rarityBorder = RARITY_BORDER_30[item.rarity] ?? "rgba(255,255,255,0.08)";

  return (
    <>
      <button
        onClick={() => !locked && onEquip(item.id)}
        onMouseEnter={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; setHovered(true); }}
        onMouseMove={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; }}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 56,
          height: 56,
          background: rarityBg,
          border: `1px solid ${rarityBorder}`,
          borderRadius: 3,
          cursor: locked ? "not-allowed" : "pointer",
          opacity: locked ? 0.4 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 2,
          position: "relative",
        }}
      >
        {item.icon
          ? <img src={item.icon} alt={item.name} style={{ width: 44, height: 44, imageRendering: "auto", objectFit: "contain" }} />
          : <span style={{ fontSize: 14, color: RARITY_COLORS[item.rarity] || "#9ca3af", lineHeight: 1 }}>◆</span>
        }
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

export default function CharacterView({ playerName, apiKey, users, classesList }: { playerName: string; apiKey: string; users: User[]; classesList: ClassDef[] }) {
  const [charData, setCharData] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [unequipping, setUnequipping] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"stats" | "ausrustung">("stats");
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);

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
    try {
      await fetch(`/api/player/${encodeURIComponent(playerName)}/equip/${itemId}`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
      await fetchChar();
    } finally { setEquipping(null); }
  };

  const handleUnequip = async (slot: string) => {
    if (!apiKey) return;
    setUnequipping(slot);
    try {
      await fetch(`/api/player/${encodeURIComponent(playerName)}/unequip/${slot}`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
      await fetchChar();
    } finally { setUnequipping(null); }
  };

  const loggedInUser = users.find(u => u.name.toLowerCase() === playerName.toLowerCase());
  void loggedInUser;
  const cls = charData?.classId ? classesList.find(c => c.id === charData.classId) : null;

  return (
    <div>
    <div
      className="relative overflow-hidden rounded-t-2xl"
      style={{
        minHeight: 520,
        backgroundColor: "#fce4ec",
      }}
    >
      {/* ── Background image (brightness applied only here, not on parent) ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/images/bg-character-spring.png')",
          backgroundSize: "cover",
          backgroundPosition: "bottom center",
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
          style={{ width: 362, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)", minHeight: 0, paddingRight: 12 }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Inventar</p>

          {loading && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Lädt...</p>}
          {!loading && charData && (() => {
            const equippedIds = new Set(Object.values(charData.equipment).filter(Boolean));
            const unequipped = charData.inventory.filter(i => !equippedIds.has(i.id));
            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${GRID_COLS}, 56px)`,
                  gap: 2,
                }}
              >
                {Array.from({ length: GRID_TOTAL }, (_, idx) => {
                  const item = unequipped[idx] ?? null;
                  return (
                    <InventorySlot
                      key={idx}
                      item={item}
                      level={charData.level}
                      onEquip={handleEquip}
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
          style={{ width: 250, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)", minHeight: 0 }}
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
                const equippedItemId = charData?.equipment[slot];
                const item = equippedItemId
                  ? charData?.inventory.find(i => i.id === equippedItemId) ?? null
                  : null;
                const borderColor = item ? (RARITY_COLORS[item.rarity] || RARITY_BORDER[item.tier] || "#9ca3af") : "rgba(255,255,255,0.1)";
                return (
                  <div
                    key={slot}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${borderColor}` }}
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
                        onClick={() => handleUnequip(slot)}
                        disabled={unequipping === slot}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}
                      >
                        {unequipping === slot ? "…" : "−"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats tab */}
          {rightTab === "stats" && loading && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Lädt...</p>}
          {rightTab === "stats" && !loading && charData && (() => {
            const { kraft, ausdauer, weisheit, glueck } = charData.stats;
            const base = charData.baseStats;
            const statRows = [
              { icon: "/images/icons/stat-kraft.png", label: "Kraft", iconSrc: "/images/icons/stat-kraft.png",    val: kraft,    base: base.kraft,    tooltip: "KRA · Bonus-XP aus Quests" },
              { icon: "/images/icons/stat-ausdauer.png", label: "Ausdauer", iconSrc: "/images/icons/stat-ausdauer.png", val: ausdauer, base: base.ausdauer, tooltip: "AUS · Reduziert Streak-Strafe" },
              { icon: "/images/icons/stat-weisheit.png", label: "Weisheit", iconSrc: "/images/icons/stat-weisheit.png", val: weisheit, base: base.weisheit, tooltip: "WEI · Bonus-Fokuspunkte" },
              { icon: "/images/icons/stat-glueck.png", label: "Glück", iconSrc: "/images/icons/stat-glueck.png",    val: glueck,   base: base.glueck,   tooltip: "GLÜ · Bessere Loot-Chancen" },
            ];
            return (
              <>
                <div className="space-y-2 mb-4">
                  {statRows.map(s => {
                    const bonus = s.val - s.base;
                    return (
                      <div key={s.label} className="flex items-center gap-2" title={s.tooltip}>
                        <img src={s.iconSrc} alt={s.label} width={16} height={16} style={{ imageRendering: "auto" }} className="w-4 h-4" />
                        <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.65)" }}>{s.label}</span>
                        <span className="text-xs font-mono font-bold" style={{ color: "#e8e8e8" }}>{s.val}</span>
                        {bonus > 0 && (
                          <span className="text-xs font-mono" style={{ color: "#4ade80" }}>(+{bonus})</span>
                        )}
                      </div>
                    );
                  })}
                </div>

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

                {/* Level bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: "#a78bfa" }}>Lv.{charData.level}</span>
                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {charData.xp}{charData.xpToNext ? ` / ${charData.xpToNext}` : ""} XP
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

                {/* Forge Temp */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Forge Temp</span>
                    <span className="text-xs font-mono" style={{ color: charData.forgeTemp >= 70 ? "#f97316" : charData.forgeTemp >= 40 ? "#facc15" : "#9ca3af" }}>
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
      {charData?.companion && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">{charData.companion.emoji}</span>
          <div>
            <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{charData.companion.name}</p>
            <p className="text-xs" style={{ color: "#f48fb1" }}>
              {"♥".repeat(Math.min(charData.companion.bondLevel, 5))}
            </p>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
