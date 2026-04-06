"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalBehavior } from "@/components/ModalPortal";
import ItemActionPopup from "@/components/ItemActionPopup";
import { Tip, TipCustom } from "@/components/GameTooltip";
import { formatLegendaryLabel } from "@/app/utils";
import type { User, CharacterData, ClassDef, PixelCharacterProps, GearInstance } from "@/app/types";
import type { ToastInput } from "@/components/ToastStack";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { RARITY_COLORS, RARITY_LABELS } from "@/app/constants";

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
          imageRendering: 'smooth',
          filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
        }}
      />
      {companion && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          {companion.type && ["dragon","owl","phoenix","wolf","fox","bear"].includes(companion.type)
            ? <img src={`/images/portraits/companion-${companion.type}.png`} alt={companion.name} width={28} height={28} style={{ imageRendering: "auto", borderRadius: 3, objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
            : companion.type === "cat" && companion.name?.toLowerCase() === "dobbie"
              ? <img src="/images/portraits/companion-dobbie.png" alt={companion.name} width={28} height={28} style={{ imageRendering: "auto", borderRadius: 3, objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
              : <span className="text-xl" style={{ color: "rgba(255,255,255,0.3)" }}>◆</span>
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

  // Frame selection + avatar style
  const [frames, setFrames] = useState<{ id: string; name: string; color: string; glow?: boolean; source?: string }[]>([]);
  const [equippedFrameId, setEquippedFrameId] = useState<string | null>(null);
  const [frameLoading, setFrameLoading] = useState<string | null>(null);
  const [avatarStyle, setAvatarStyle] = useState<"male" | "female">("male");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/profile-data`, { headers: getAuthHeaders(apiKey) });
        if (r.ok) {
          const d = await r.json();
          setFrames(d.unlockedFrames || []);
          setEquippedFrameId(d.equippedFrame?.id || null);
          setAvatarStyle(d.avatarStyle || "male");
        }
      } catch { /* ignore */ }
    })();
  }, [playerName, apiKey]);

  const equipFrame = async (frameId: string | null) => {
    setFrameLoading(frameId || "__remove");
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
        body: JSON.stringify({ frameId }),
      });
      if (r.ok) {
        setEquippedFrameId(frameId);
      }
    } catch { /* network error — frame stays unchanged */ }
    setFrameLoading(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
        body: JSON.stringify({ relationshipStatus: status, partnerName: partner.trim() || null, avatarStyle }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); console.error("[profile] Save failed:", d.error || r.status); return; }
      await onSaved();
      onClose();
    } catch { console.error("[profile] Network error"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: "#1a1a1a", border: "1px solid rgba(167,139,250,0.3)", boxShadow: "0 0 60px rgba(139,92,246,0.15)", maxHeight: "85vh", overflowY: "auto", scrollbarWidth: "thin" as unknown as undefined }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-bold" style={{ color: "#f0f0f0" }}>Frames & Cosmetics</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Cosmetic frames for your player card. Avatar & profile settings are in the header menu.</p>
        </div>

        {/* Frame Selection */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          <label className="text-xs font-semibold block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Cosmetic Frame</label>
          <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>
            Frames add a colored border and glow effect to your player card visible to everyone. Earn frames from faction reputation (Revered), the Season Pass, World Boss #1, Dungeon first-clears, and the Currency Shops.
          </p>

          {/* Preview: how current frame looks */}
          <div className="rounded-lg p-3 mb-3 flex items-center gap-3" style={{
            background: "rgba(255,255,255,0.02)",
            border: equippedFrameId ? `2px solid ${frames.find(f => f.id === equippedFrameId)?.color || "#555"}80` : "1px solid rgba(255,255,255,0.06)",
            boxShadow: equippedFrameId && frames.find(f => f.id === equippedFrameId)?.glow ? `0 0 12px ${frames.find(f => f.id === equippedFrameId)?.color}30` : "none",
          }}>
            <img src={`/images/portraits/hero-${avatarStyle}.png`} alt="" className="w-12 h-12 rounded-lg object-cover" onError={e => { e.currentTarget.style.display = "none"; }} style={{
              imageRendering: "auto",
              border: equippedFrameId ? `2px solid ${frames.find(f => f.id === equippedFrameId)?.color || "#555"}` : "2px solid rgba(255,255,255,0.1)",
            }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: equippedFrameId ? frames.find(f => f.id === equippedFrameId)?.color : "rgba(255,255,255,0.4)" }}>
                {equippedFrameId ? frames.find(f => f.id === equippedFrameId)?.name || "Frame" : "No Frame"}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                {equippedFrameId ? "Your player card glows with this color" : "Your player card has no special border"}
              </p>
            </div>
          </div>

          {frames.length === 0 ? (
            <div className="rounded-lg p-4 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No frames unlocked yet.</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.15)" }}>Earn frames from:</p>
              <div className="flex flex-wrap gap-1 mt-2 justify-center">
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)" }}>Factions (Revered)</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)" }}>Season Pass</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)" }}>World Boss #1</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)" }}>Dungeon First-Clear</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)" }}>Currency Shops</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Remove frame option */}
              <button
                onClick={() => equippedFrameId && equipFrame(null)}
                disabled={!equippedFrameId || frameLoading === "__remove"}
                title={!equippedFrameId ? "No frame equipped" : "Remove current frame"}
                className="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2"
                style={{
                  background: !equippedFrameId ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${!equippedFrameId ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.07)"}`,
                  color: !equippedFrameId ? "#a78bfa" : "rgba(255,255,255,0.4)",
                  cursor: !equippedFrameId || frameLoading === "__remove" ? "not-allowed" : "pointer",
                }}
              >
                <span className="w-4 h-4 rounded-full" style={{ border: "2px solid rgba(255,255,255,0.15)" }} />
                <span className="flex-1">{frameLoading === "__remove" ? "..." : "No Frame"}</span>
                {!equippedFrameId && <span className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>Active</span>}
              </button>
              {frames.map(f => {
                const isActive = equippedFrameId === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => !isActive && equipFrame(f.id)}
                    disabled={isActive || frameLoading === f.id}
                    title={isActive ? "Currently equipped" : `Equip ${f.name}`}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-center gap-2.5"
                    style={{
                      background: isActive ? `${f.color}12` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isActive ? `${f.color}50` : "rgba(255,255,255,0.07)"}`,
                      cursor: isActive || frameLoading === f.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {/* Color preview circle with glow */}
                    <span
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{
                        background: `${f.color}30`,
                        border: `2px solid ${f.color}`,
                        boxShadow: f.glow ? `0 0 8px ${f.color}60` : "none",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold" style={{ color: isActive ? f.color : "rgba(255,255,255,0.6)" }}>{f.name}</p>
                      <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
                        {f.source || (f.glow ? "Glowing border + card effect" : "Colored border")}
                      </p>
                    </div>
                    {isActive && <span className="text-xs font-semibold" style={{ color: f.color }}>Equipped</span>}
                    {frameLoading === f.id && <span style={{ color: "rgba(255,255,255,0.3)" }}>...</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
        >Close</button>
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


/** Resolve display rarity — unique items show as "unique" instead of "legendary" */
function displayRarity(item: Record<string, unknown>): string {
  return item.isUnique ? "unique" : (String(item.rarity || "common"));
}

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
  "Kraft":     "+0.5% Quest XP per point (max +30%)",
  "Weisheit":  "+0.5% Gold per point (max +30%)",
  "Ausdauer":  "-0.5% Forge Decay per point (min 10% base rate)",
  "Glück":     "+0.5% Drop Chance per point (max 20%)",
  "Fokus":     "+1 Flat Bonus XP per point (max +50)",
  "Vitalität": "+1% Streak Protection per point (max 75% total)",
  "Charisma":  "+5% Companion Bond XP per point",
  "Tempo":     "+1% Forge Temp Recovery per point",
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
  unique: "rgba(230,204,128,0.18)",
};

const RARITY_BORDER_30: Record<string, string> = {
  common: "rgba(156,163,175,0.3)",
  uncommon: "rgba(34,197,94,0.3)",
  rare: "rgba(59,130,246,0.3)",
  epic: "rgba(168,85,247,0.3)",
  legendary: "rgba(249,115,22,0.3)",
  unique: "rgba(230,204,128,0.4)",
};

type InventoryItem = CharacterData["inventory"][number];

// ─── Item Level calculation (mirrors lib/helpers.js getItemLevel) ─────────

const RARITY_ILVL_BONUS: Record<string, number> = { common: 0, uncommon: 5, rare: 15, epic: 30, legendary: 50 };

function getItemLevel(item: InventoryItem | GearInstance): number {
  const stats = ("stats" in item && item.stats) ? item.stats : {};
  let ilvl = Object.values(stats).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
  ilvl += RARITY_ILVL_BONUS[("rarity" in item ? item.rarity : "") || "common"] || 0;
  if ("legendaryEffect" in item && item.legendaryEffect) ilvl += 20;
  if ("sockets" in item && Array.isArray((item as unknown as Record<string, unknown>).sockets)) {
    for (const s of (item as unknown as Record<string, unknown>).sockets as (string | null)[]) {
      if (s) ilvl += 5;
    }
  }
  if ("isUnique" in item && (item as Record<string, unknown>).isUnique) ilvl += 25;
  return ilvl;
}

function InventoryTooltip({ item, mousePosRef, equippedItem, playerLevel }: { item: InventoryItem; mousePosRef: React.RefObject<{ x: number; y: number }>; equippedItem?: InventoryItem | null; playerLevel?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const dRarity = displayRarity(item);
  const rarityColor = RARITY_COLORS[dRarity] || "#9ca3af";
  const hasStats = item.stats && Object.keys(item.stats).length > 0;
  const eqStats = equippedItem?.stats || {};

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

  // Build comparison data: all stats from both items
  const allStatKeys = new Set([
    ...Object.keys(item.stats || {}),
    ...Object.keys(eqStats),
  ]);

  return (
    <div
      ref={ref}
      className="fixed z-[200] pointer-events-none"
      style={{ left: 0, top: 0, minWidth: "min(260px, 90vw)", maxWidth: 340, willChange: "transform" }}
    >
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #1e1e22 0%, #141417 100%)",
          border: `2px solid ${rarityColor}60`,
          boxShadow: `0 0 20px ${rarityColor}25, 0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
      >
        {/* D3-style rarity header bar */}
        <div style={{
          background: `linear-gradient(90deg, transparent 0%, ${rarityColor}20 50%, transparent 100%)`,
          borderBottom: `1px solid ${rarityColor}40`,
          padding: "10px 14px",
        }}>
          <p className="text-sm font-bold" style={{ color: rarityColor, textShadow: `0 0 12px ${rarityColor}40` }}>{item.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${rarityColor}cc` }}>{RARITY_LABELS[dRarity] || item.rarity}</span>
            {item.slot && <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{item.slot.charAt(0).toUpperCase() + item.slot.slice(1)}</span>}
            {(() => { const rl = (item as Record<string, unknown>).reqLevel as number | undefined; return rl ? <span className="text-xs" style={{ color: playerLevel && playerLevel < rl ? "#ef4444" : "rgba(255,255,255,0.25)" }}>Req. Lv {rl}</span> : null; })()}
          </div>
        </div>

        <div className="p-3 space-y-2">
        {/* Icon */}
        {item.icon && (
          <div className="flex justify-center mb-1">
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 80, height: 80, background: `radial-gradient(circle, ${rarityColor}10 0%, transparent 70%)`, borderRadius: 8 }}>
              <img src={item.icon} alt={item.name} width={72} height={72} style={{ imageRendering: "auto", filter: `drop-shadow(0 0 8px ${rarityColor}40)` }} onError={e => { e.currentTarget.style.display = "none"; }} />
            </div>
          </div>
        )}

        {/* Binding badge */}
        {item.bound ? (
          <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>Soulbound</p>
        ) : item.binding === "boe" ? (
          <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>Bind on Equip</p>
        ) : item.binding === "bop" ? (
          <p className="text-xs font-semibold" style={{ color: "#f97316" }}>Bind on Pickup</p>
        ) : null}

        {/* Flavor text */}
        {item.flavorText && (
          <p className="text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>&ldquo;{item.flavorText}&rdquo;</p>
        )}

        {/* Description */}
        {item.desc && (
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>
        )}

        {/* Legendary effect — D3-style golden highlight box */}
        {item.legendaryEffect && (
          <div className="rounded px-2.5 py-2" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", boxShadow: "inset 0 0 12px rgba(245,158,11,0.05)" }}>
            <p className="text-xs font-bold" style={{ color: "#f59e0b", textShadow: "0 0 8px rgba(245,158,11,0.3)" }}>
              {formatLegendaryLabel(item.legendaryEffect)}
            </p>
          </div>
        )}

        {/* Stats with comparison */}
        {hasStats && (
          <div className="space-y-0.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {(() => {
              const itemAny = item as Record<string, unknown>;
              const affixes = (itemAny.affixes && typeof itemAny.affixes === "object") ? itemAny.affixes as { primary?: { pool: { stat: string; min: number; max: number }[] }; minor?: { pool: { stat: string; min: number; max: number }[] } } : null;
              const rangeMap: Record<string, { min: number; max: number }> = {};
              const primaryStats = new Set<string>();
              const minorStats = new Set<string>();
              if (affixes) {
                for (const p of (affixes.primary?.pool || [])) { rangeMap[p.stat] = { min: p.min, max: p.max }; primaryStats.add(p.stat); }
                for (const p of (affixes.minor?.pool || [])) { rangeMap[p.stat] = { min: p.min, max: p.max }; minorStats.add(p.stat); }
              }
              const showDiff = equippedItem && equippedItem.id !== item.id;
              const renderStat = (stat: string) => {
                const val = (item.stats?.[stat] as number) || 0;
                const eqVal = (eqStats[stat] as number) || 0;
                const diff = val - eqVal;
                const range = rangeMap[stat];
                return (
                  <div key={stat} className="flex items-center justify-between text-xs">
                    <span style={{ color: "rgba(255,255,255,0.55)" }}>{STAT_LABELS[stat] || stat}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold" style={{ color: val > 0 ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
                        {val > 0 ? `+${val}` : val}
                      </span>
                      {range && <span className="font-mono" style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>[{range.min}-{range.max}]</span>}
                      {showDiff && (
                        <span className="font-mono font-bold" style={{ color: diff > 0 ? "#4ade80" : diff < 0 ? "#ef4444" : "rgba(255,255,255,0.2)", fontSize: 12 }}>
                          {diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : "="}
                        </span>
                      )}
                    </span>
                  </div>
                );
              };
              // D3-style: separate primary and minor affixes with section headers
              const hasSections = primaryStats.size > 0 || minorStats.size > 0;
              const primaryEntries = [...allStatKeys].filter(s => primaryStats.has(s));
              const minorEntries = [...allStatKeys].filter(s => minorStats.has(s));
              const otherEntries = [...allStatKeys].filter(s => !primaryStats.has(s) && !minorStats.has(s));
              return (<>
                {hasSections && primaryEntries.length > 0 && <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)", marginBottom: 2 }}>Primary</p>}
                {primaryEntries.map(renderStat)}
                {hasSections && minorEntries.length > 0 && <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.2)", marginTop: 4, marginBottom: 2 }}>Minor</p>}
                {minorEntries.map(renderStat)}
                {otherEntries.map(renderStat)}
              </>);
            })()}
          </div>
        )}

        {/* Affix Roll Quality */}
        {(() => {
          const itemAny = item as Record<string, unknown>;
          if (!itemAny.affixes || typeof itemAny.affixes !== "object") return null;
          const affixes = itemAny.affixes as { primary?: { pool: { stat: string; min: number; max: number }[] }; minor?: { pool: { stat: string; min: number; max: number }[] } };
          const pool = [...(affixes.primary?.pool || []), ...(affixes.minor?.pool || [])];
          if (pool.length === 0) return null;
          let totalRolled = 0, totalMax = 0;
          for (const affix of pool) {
            const rolled = (item.stats?.[affix.stat] as number) || 0;
            if (rolled > 0 && affix.max > 0) { totalRolled += rolled; totalMax += affix.max; }
          }
          if (totalMax === 0) return null;
          const quality = Math.round((totalRolled / totalMax) * 100);
          const qColor = quality >= 90 ? "#22c55e" : quality >= 70 ? "#eab308" : quality >= 50 ? "#f97316" : "#ef4444";
          const qLabel = quality >= 90 ? "Perfect" : quality >= 70 ? "Good" : quality >= 50 ? "Average" : "Low";
          return (
            <div className="pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between text-xs">
                <Tip k="roll_quality"><span style={{ color: "rgba(255,255,255,0.3)", cursor: "help" }}>Roll Quality</span></Tip>
                <span className="font-mono font-semibold" style={{ color: qColor }}>{quality}% {qLabel}</span>
              </div>
              <div className="mt-0.5 rounded-full overflow-hidden" style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${quality}%`, background: qColor }} />
              </div>
            </div>
          );
        })()}

        {/* Socket display */}
        {(() => {
          const sockets = (item as Record<string, unknown>).sockets as (string | null)[] | undefined;
          if (!sockets || sockets.length === 0) return null;
          const GEM_COLORS: Record<string, string> = { ruby: "#ef4444", sapphire: "#3b82f6", emerald: "#22c55e", topaz: "#f59e0b", amethyst: "#a855f7", diamond: "#e0e7ff" };
          return (
            <div className="pt-1 flex items-center gap-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Sockets:</span>
              {sockets.map((s, idx) => (
                <div key={idx} className="w-4 h-4 rounded-sm" style={{
                  background: s ? (GEM_COLORS[s.split("-")[0] || ""] || "#888") : "rgba(255,255,255,0.06)",
                  border: `1px solid ${s ? (GEM_COLORS[s.split("-")[0] || ""] || "#888") + "60" : "rgba(255,255,255,0.1)"}`,
                  boxShadow: s ? `0 0 4px ${GEM_COLORS[s.split("-")[0] || ""] || "#888"}40` : "none",
                }} title={s || "Empty socket"} />
              ))}
            </div>
          );
        })()}

        {/* Salvage Preview */}
        {(() => {
          const ESSENZ_BY_RARITY: Record<string, number> = { common: 2, uncommon: 5, rare: 15, epic: 40, legendary: 100 };
          const essenz = ESSENZ_BY_RARITY[item.rarity] || 2;
          return (
            <div className="pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                Salvage: +{essenz} Essenz {item.rarity !== "common" ? "+ chance for materials" : ""}
              </p>
            </div>
          );
        })()}

        {/* Comparison summary — equipped item info */}
        {equippedItem && equippedItem.id !== item.id && (() => {
          const totalDiff = [...allStatKeys].reduce((sum, stat) => {
            return sum + ((item.stats?.[stat] as number) || 0) - ((eqStats[stat] as number) || 0);
          }, 0);
          const eqRarityColor = RARITY_COLORS[equippedItem.rarity] || "#9ca3af";
          return (
            <div className="pt-1.5 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>vs</span>
                  <span className="text-xs font-semibold truncate" style={{ color: eqRarityColor }}>{equippedItem.name}</span>
                </div>
                <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color: totalDiff > 0 ? "#4ade80" : totalDiff < 0 ? "#ef4444" : "rgba(255,255,255,0.3)" }}>
                  {totalDiff > 0 ? `+${totalDiff}` : totalDiff === 0 ? "=" : totalDiff} total
                </span>
              </div>
              {/* Equipped item mini-stats */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {Object.entries(eqStats).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                  <span key={k} className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {STAT_LABELS[k] || k}: +{v as number}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Level requirement + Slot type + Item Level (Gear Score) */}
        <div className="text-xs pt-1 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Item Level</span>
            <span className="font-mono font-bold" style={{ color: "#fbbf24" }}>
              {getItemLevel(item)}
            </span>
          </div>
          {item.minLevel && item.minLevel > 1 && (
            <p style={{ color: playerLevel != null && item.minLevel > playerLevel ? "#ef4444" : "rgba(255,255,255,0.4)" }}>
              Requires Level {item.minLevel}
            </p>
          )}
          {item.slot && (
            <p style={{ color: "rgba(255,255,255,0.3)" }}>
              {item.type || item.slot}
            </p>
          )}
        </div>
        </div>{/* close p-3 space-y-2 inner content */}
      </div>
    </div>
  );
}

const RARITY_SORT_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };

type InvFilter = "all" | "equipment" | "consumable" | "passive" | "materials";
type InvSort = "none" | "rarity" | "name" | "level";

const INV_FILTERS: { key: InvFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "equipment", label: "Gear" },
  { key: "consumable", label: "Items" },
  { key: "passive", label: "Passive" },
  { key: "materials", label: "Materials" },
];

const INV_SORTS: { key: InvSort; label: string }[] = [
  { key: "none", label: "Default" },
  { key: "rarity", label: "Rarity" },
  { key: "name", label: "Name" },
  { key: "level", label: "Level" },
];

function InventorySlot({ item, level, idx, onItemClick, onDragStart, onDragOver, onDrop, dragOverIdx, equippedForSlot, isNew, onMarkSeen }: {
  item: InventoryItem | null;
  level: number;
  idx: number;
  onItemClick: (item: InventoryItem, rect: { x: number; y: number; width: number; height: number }) => void;
  onDragStart: (idx: number) => void;
  onDragOver: (idx: number) => void;
  onDrop: () => void;
  dragOverIdx: number | null;
  equippedForSlot?: InventoryItem | null;
  isNew?: boolean;
  onMarkSeen?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const isDropTarget = dragOverIdx === idx;

  if (!item) {
    return (
      <div
        className="cv-auto"
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

  const slotDRarity = displayRarity(item);
  const rarityBg = RARITY_BG[slotDRarity] ?? "rgba(255,255,255,0.04)";
  const rarityBorder = RARITY_BORDER_30[slotDRarity] ?? "rgba(255,255,255,0.08)";

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
          onMarkSeen?.();
        }}
        onMouseEnter={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; setHovered(true); }}
        onMouseMove={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; }}
        onMouseLeave={() => setHovered(false)}
        className={`cv-auto${(item as Record<string, unknown>).isUnique ? " legendary-shimmer" : item.rarity === "legendary" ? " legendary-shimmer" : item.rarity === "epic" ? " epic-glow" : ""}`}
        style={{
          width: 56,
          height: 56,
          background: isDropTarget ? "rgba(167,139,250,0.2)" : rarityBg,
          border: `${item.rarity === "legendary" || (item as Record<string, unknown>).isUnique ? 2 : item.rarity === "epic" ? 2 : 1}px solid ${isDropTarget ? "rgba(167,139,250,0.5)" : rarityBorder}`,
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
          ? <img src={item.icon} alt={item.name} draggable={false} style={{ width: 44, height: 44, imageRendering: "auto", objectFit: "contain" }} onError={e => { e.currentTarget.style.display = "none"; }} />
          : <span style={{ fontSize: 14, color: RARITY_COLORS[item.rarity] || "#9ca3af", lineHeight: 1 }}>◆</span>
        }
        {/* Level requirement indicator */}
        {item.minLevel > 0 && item.minLevel > level && (
          <span style={{ position: "absolute", bottom: 1, right: 1, fontSize: 12, color: "#ef4444", fontWeight: 700, background: "rgba(0,0,0,0.7)", borderRadius: 2, padding: "0 2px" }}>
            Lv{item.minLevel}
          </span>
        )}
        {/* Lock indicator */}
        {item.locked && (
          <span style={{ position: "absolute", top: 1, left: 1, fontSize: 12, color: "#fbbf24", background: "rgba(0,0,0,0.7)", borderRadius: 2, padding: "0 2px", lineHeight: 1.4 }} title="Locked">{"\u29BF"}</span>
        )}
        {/* NEW badge */}
        {isNew && !item.locked && (
          <span className="badge-enter" style={{ position: "absolute", top: 1, left: 1, fontSize: 12, color: "#4ade80", background: "rgba(0,0,0,0.8)", borderRadius: 2, padding: "0 3px", lineHeight: 1.4, fontWeight: 700, animation: "pulse-online 2s ease-in-out infinite" }}>NEW</span>
        )}
      </button>
      {hovered && createPortal(<InventoryTooltip item={item} mousePosRef={mousePosRef} equippedItem={equippedForSlot} playerLevel={level} />, document.body)}
    </>
  );
}

const EQUIP_SLOT_LABELS: { slot: string; emoji: string; label: string; iconSrc?: string }[] = [
  { slot: "helm", emoji: "", iconSrc: "/images/icons/equip-helm.png", label: "Helm" },
  { slot: "weapon", emoji: "", iconSrc: "/images/icons/equip-weapon.png", label: "Weapon" },
  { slot: "shield", emoji: "", iconSrc: "/images/icons/equip-shield.png", label: "Shield" },
  { slot: "armor", emoji: "", iconSrc: "/images/icons/equip-armor.png", label: "Armor" },
  { slot: "amulet", emoji: "", iconSrc: "/images/icons/equip-amulet.png", label: "Amulet" },
  { slot: "ring", emoji: "", iconSrc: "/images/icons/equip-ring.png", label: "Ring" },
  { slot: "boots", emoji: "", iconSrc: "/images/icons/equip-boots.png", label: "Boots" },
];

function GearSlotRow({ slot, iconSrc, label, item, onUnequip, unequipping, compact }: {
  slot: string;
  iconSrc?: string;
  label: string;
  item: InventoryItem | null;
  onUnequip: (slot: string) => void;
  unequipping: string | null;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const borderColor = item ? (RARITY_COLORS[item.rarity] || "#9ca3af") : "rgba(255,255,255,0.1)";

  if (compact) {
    return (
      <>
        <div
          className={`flex items-center justify-center rounded-lg${!item ? " empty-slot-pulse empty-slot-dashed" : item.rarity === "legendary" ? " legendary-ambient" : item.rarity === "epic" ? " epic-ambient" : ""}`}
          style={{ width: 56, height: 56, background: item ? `${borderColor}08` : "rgba(255,255,255,0.04)", border: item ? `2px solid ${borderColor}` : undefined, cursor: item ? "help" : "default", boxShadow: item && (item.rarity === "legendary" || item.rarity === "epic") ? `0 0 8px ${borderColor}40` : undefined }}
          onMouseEnter={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; if (item) setHovered(true); }}
          onMouseMove={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; }}
          onMouseLeave={() => setHovered(false)}
          title={item ? item.name : `Klicke auf ein Item im Inventar um es auszurüsten`}
        >
          {item?.icon
            ? <img src={item.icon} alt={item.name} width={40} height={40} style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
            : iconSrc
              ? <img src={iconSrc} alt={label} width={36} height={36} style={{ imageRendering: "auto", opacity: 0.4 }} onError={e => { e.currentTarget.style.display = "none"; }} />
              : <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{label.slice(0, 3)}</span>
          }
        </div>
        {item && (
          <p className="text-center truncate mt-0.5" style={{ fontSize: 12, width: 56, color: borderColor, lineHeight: 1.2 }}>{item.name}</p>
        )}
        {!item && (
          <p className="text-center mt-0.5" style={{ fontSize: 12, width: 56, color: "rgba(255,255,255,0.2)", lineHeight: 1.2 }}>{label}</p>
        )}
        {hovered && item && createPortal(<InventoryTooltip item={item} mousePosRef={mousePosRef} />, document.body)}
      </>
    );
  }

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
          {iconSrc ? <img src={iconSrc} alt={label} width={40} height={40} style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} /> : null}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: item ? "#e8e8e8" : "rgba(255,255,255,0.3)" }}>
            {item
              ? <span className="inline-flex items-center gap-1">{item.icon ? <img src={item.icon} alt="" width={36} height={36} style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} /> : <span style={{ color: RARITY_COLORS[item.rarity] || "#9ca3af" }}>◆</span>} {item.name}</span>
              : <span style={{ color: "rgba(255,255,255,0.2)" }}>Empty</span>}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{label}</p>
        </div>
        {item && (
          <button
            onClick={() => onUnequip(slot)}
            disabled={unequipping === slot}
            title={unequipping === slot ? "Unequipping…" : "Unequip item"}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", cursor: unequipping === slot ? "not-allowed" : "pointer" }}
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
  const [rightTab, setRightTab] = useState<"stats" | "equipment" | "gems">("stats");
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ item: CharacterData["inventory"][number]; rect: { x: number; y: number; width: number; height: number } } | null>(null);
  const [statTooltipOpen, setStatTooltipOpen] = useState<string | null>(null);
  const [expandedStat, setExpandedStat] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [pinnedItem, setPinnedItem] = useState<InventoryItem | null>(null);
  const [invFilter, setInvFilter] = useState<InvFilter>("all");
  const [invSort, setInvSort] = useState<InvSort>("none");
  const [invSearch, setInvSearch] = useState("");
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
  const [allTitleDefs, setAllTitleDefs] = useState<{ id: string; name: string; description?: string; rarity: string; condition?: { type: string; value: number } }[]>([]);
  const [titleCategory, setTitleCategory] = useState<string>("all");
  const [titleEquipping, setTitleEquipping] = useState<string | null>(null);
  // Gem system
  const [gemData, setGemData] = useState<{ gems: { id: string; name: string; type: string; tier: number; stat: string; value: number }[]; inventory: Record<string, { gemId: string; count: number; gemType: string; tier: number; name: string; statBonus: number }>; socketedGems: Record<string, { slot: string; sockets: ({ gemId: string; gemName: string; gemType: string } | null)[] }>; unsocketCost?: number } | null>(null);
  const [gemsLoading, setGemsLoading] = useState(false);
  const [gemAction, setGemAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  // Collection log
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionData, setCollectionData] = useState<{ items: { id: string; name: string; slot: string; rarity: string; stats?: Record<string, number>; source: string; obtained: boolean; desc?: string; flavorText?: string; legendaryEffect?: { type: string; label?: string } | null }[]; completion: number } | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<string>("all");

  // Scroll lock + ESC for title and collection modals
  useModalBehavior(titlesOpen, useCallback(() => setTitlesOpen(false), []));
  useModalBehavior(collectionOpen, useCallback(() => setCollectionOpen(false), []));
  useModalBehavior(!!confirmAction, useCallback(() => { setConfirmAction(null); setConfirmMessage(""); }, []));

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

  // Track seen items for NEW badge (persistent via backend)
  const [seenItemIds, setSeenItemIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!playerName || !apiKey) return;
    fetch(`/api/player/${encodeURIComponent(playerName)}/seen`, { headers: getAuthHeaders(apiKey) })
      .then(r => r.ok ? r.json() : {})
      .then((d: Record<string, string[]>) => { if (d.items) setSeenItemIds(new Set(d.items)); })
      .catch(() => {});
  }, [playerName, apiKey]);
  const markItemSeen = useCallback((itemId: string) => {
    setSeenItemIds(prev => {
      if (prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.add(itemId);
      // Persist to backend (fire-and-forget)
      if (playerName && apiKey) {
        fetch(`/api/player/${encodeURIComponent(playerName)}/seen`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
          body: JSON.stringify({ category: "items", ids: [itemId] }),
        }).catch(() => {});
      }
      return next;
    });
  }, [playerName, apiKey]);

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
          addToast({ type: "item", itemName: item.name, message: `${item.name} equipped!`, icon: item.icon, rarity: displayRarity(item) });
        }
      } else {
        const data = await r.json().catch(e => { console.error('[character-view]', e); return null; });
        if (addToast) addToast({ type: "error", message: data?.error || "Failed to equip item" });
      }
      await fetchChar();
    } finally { setEquipping(null); }
  };

  const handleUnequip = async (slot: string) => {
    if (!apiKey) return;
    setUnequipping(slot);
    setSelectedItem(null);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/unequip/${slot}`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
      });
      if (!r.ok && addToast) {
        const data = await r.json().catch(e => { console.error('[character-view]', e); return null; });
        addToast({ type: "error", message: data?.error || "Failed to unequip" });
      }
      await fetchChar();
    } catch {
      if (addToast) addToast({ type: "error", message: "Network error while unequipping" });
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
          addToast({ type: "item", itemName: item.name, message: data.message || "Item used!", icon: item.icon, rarity: displayRarity(item) });
        }
      } else if (addToast) {
        const data = await r.json().catch(e => { console.error('[character-view]', e); return null; });
        addToast({ type: "error", message: data?.error || "Item could not be used" });
      }
      await fetchChar();
    } catch {
      if (addToast) addToast({ type: "error", message: "Network error while using item" });
    }
  };

  const handleLockItem = async (itemId: string) => {
    if (!apiKey) return;
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/inventory/lock/${itemId}`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
      });
      if (r.ok) {
        const data = await r.json();
        const lockedItem = charData?.inventory.find(i => i.id === itemId);
        if (addToast) addToast({ type: "item", message: data.locked ? "Item locked" : "Item unlocked", itemName: lockedItem?.name || "Item", rarity: lockedItem?.rarity || "common" });
      }
      await fetchChar();
    } catch {
      if (addToast) addToast({ type: "error", message: "Network error" });
    }
  };

  const handleDiscardItem = async (itemId: string) => {
    if (!apiKey) return;
    setSelectedItem(null);
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/inventory/discard/${itemId}`, {
        method: "POST",
        headers: { ...getAuthHeaders(apiKey) },
      });
      if (r.ok) {
        const item = charData?.inventory.find(i => i.id === itemId);
        if (addToast && item) addToast({ type: "item", itemName: item.name, message: `${item.name} discarded`, icon: item.icon, rarity: displayRarity(item) });
      } else if (addToast) {
        const data = await r.json().catch(e => { console.error('[character-view]', e); return null; });
        addToast({ type: "error", message: data?.error || "Discard failed" });
      }
      await fetchChar();
    } catch {
      if (addToast) addToast({ type: "error", message: "Network error while discarding" });
    }
  };

  const loggedInUser = users.find(u => u.name.toLowerCase() === playerName.toLowerCase());
  void loggedInUser;
  const cls = (charData?.classId && charData.classId !== "null") ? classesList.find(c => c.id === charData.classId) : null;

  return (
    <div className="tab-content-enter">
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
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          imageRendering: "auto",
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
            <img src={p.image} alt="" style={{ width: "100%", height: "100%", imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
          </div>
        ))}
      </div>

      {/* ── Layer 5: Ground ── */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: 60, background: "linear-gradient(0deg, #4a3728 0%, #5d4037 20%, transparent 100%)", zIndex: 2 }}
      />

      {/* ── Main 3-column layout ── */}
      <div className="relative flex flex-col md:flex-row gap-3 p-4" style={{ zIndex: 4, height: "calc(100% - 0px)", minHeight: 0 }}>

        {/* LEFT: Inventory Panel */}
        <div
          className="flex-shrink-0 rounded-xl p-2 overflow-y-auto scrollbar-rpg"
          style={{ width: "100%", maxWidth: 310, maxHeight: "calc(100vh - 200px)", background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)", minHeight: 0, paddingRight: 12 }}
        >
          {/* Header + Sort */}
          <div className="flex items-center justify-between mb-2">
            <Tip k="inventory" heading><p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>Inventory</p></Tip>
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
                <span>{INV_SORTS.find(s => s.key === invSort)?.label ?? "Default"}</span>
                <span style={{ fontSize: 12, opacity: 0.5 }}>{sortDropdownOpen ? "▲" : "▼"}</span>
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

          {/* Search + Filter */}
          <div className="relative mb-1.5">
            <input
              type="text"
              value={invSearch}
              onChange={e => setInvSearch(e.target.value)}
              placeholder="Search..."
              className="w-full text-xs px-2.5 py-1.5 rounded-lg"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e8e8e8",
                outline: "none",
                paddingLeft: 26,
              }}
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: "rgba(255,255,255,0.25)", pointerEvents: "none" }}>◇</span>
            {invSearch && (
              <button
                onClick={() => setInvSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs px-1 rounded"
                style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer", background: "rgba(255,255,255,0.06)" }}
              >×</button>
            )}
          </div>

          {/* Compare Mode Toggle */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => { setCompareMode(c => !c); if (compareMode) setPinnedItem(null); }}
              className="text-xs px-2 py-1 rounded font-semibold"
              style={{
                background: compareMode ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
                color: compareMode ? "#60a5fa" : "rgba(255,255,255,0.25)",
                border: `1px solid ${compareMode ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer",
              }}
              title={compareMode ? "Exit compare mode" : "Compare items side by side"}
            ><Tip k="compare_mode"><span>{compareMode ? "Exit Compare" : "Compare"}</span></Tip></button>
            {pinnedItem && (
              <div className="flex items-center gap-1 text-xs flex-1 min-w-0 px-2 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                <span className="font-semibold truncate" style={{ color: RARITY_COLORS[pinnedItem.rarity] || "#888" }}>{pinnedItem.name}</span>
                <button onClick={() => setPinnedItem(null)} className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer", background: "none", border: "none" }}>clear</button>
              </div>
            )}
          </div>

          {/* Inventory count */}
          {charData && (
            <p className="text-xs text-right mb-1" style={{ color: "rgba(255,255,255,0.2)" }}>
              {charData.inventory.length} / 100 slots
            </p>
          )}

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

          {loading && <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-card" style={{ height: 48 }}><div className="skeleton skeleton-text w-20" /></div>)}</div>}
          {!loading && charData && (() => {
            const equippedIds = new Set<string>();
            for (const v of Object.values(charData.equipment)) {
              if (!v) continue;
              if (typeof v === 'object' && v !== null) {
                const gi = v as GearInstance;
                if (gi.instanceId) equippedIds.add(gi.instanceId);
                if (gi.templateId) equippedIds.add(gi.templateId);
              } else if (typeof v === 'string') {
                equippedIds.add(v);
              }
            }
            // ─── Materials Tab ─────────────────────────────────────────
            if (invFilter === "materials") {
              const mats = charData.craftingMaterials || {};
              const matDefs = charData.materialDefs || [];
              const matEntries = Object.entries(mats).filter(([, count]) => count > 0);
              const searchQ = invSearch.trim().toLowerCase();
              const filtered = searchQ
                ? matEntries.filter(([id]) => {
                    const def = matDefs.find(d => d.id === id);
                    return (def?.name || id).toLowerCase().includes(searchQ);
                  })
                : matEntries;
              const sorted = [...filtered].sort((a, b) => {
                const da = matDefs.find(d => d.id === a[0]);
                const db = matDefs.find(d => d.id === b[0]);
                const ra = RARITY_SORT_ORDER[da?.rarity || "common"] ?? 9;
                const rb = RARITY_SORT_ORDER[db?.rarity || "common"] ?? 9;
                return ra - rb || (da?.name || a[0]).localeCompare(db?.name || b[0]);
              });
              return (
                <div className="space-y-2">
                  <p className="text-xs text-w25">{sorted.length} material{sorted.length !== 1 ? "s" : ""} in storage</p>
                  {sorted.length === 0 ? (
                    <p className="text-xs text-center py-8 text-w15">{searchQ ? "Keine Materialien gefunden" : "No materials yet. Complete quests to gather materials based on your professions."}</p>
                  ) : (
                    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                      {sorted.map(([id, count]) => {
                        const def = matDefs.find(d => d.id === id);
                        const rarityColor = RARITY_COLORS[def?.rarity || "common"] || "#9ca3af";
                        return (
                          <div key={id} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${rarityColor}20` }}>
                            {def?.icon ? (
                              <img src={def.icon} alt="" width={28} height={28} className="img-render-auto flex-shrink-0" onError={e => { e.currentTarget.style.display = "none"; }} />
                            ) : (
                              <span className="text-sm flex-shrink-0" style={{ color: rarityColor }}>◆</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: rarityColor }}>{def?.name || id}</p>
                              <p className="text-xs font-mono font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>×{count}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            let unequipped = charData.inventory.filter(i =>
              !equippedIds.has(i.id) && !equippedIds.has(i.templateId || "") && !equippedIds.has((i as unknown as Record<string, string>).instanceId || "")
            );

            // Search
            if (invSearch.trim()) {
              const q = invSearch.trim().toLowerCase();
              unequipped = unequipped.filter(i => i.name.toLowerCase().includes(q));
            }

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

            // Empty state when search/filter yields no results
            if (unequipped.length === 0 && (invSearch.trim() || invFilter !== "all")) {
              return <p className="text-xs text-w20 text-center py-6">Keine Items gefunden</p>;
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
              // Place remaining items in first available slots (and auto-save their positions)
              let nextSlot = 0;
              let positionsChanged = false;
              for (const item of unplaced) {
                while (nextSlot < GRID_TOTAL && grid[nextSlot] !== null) nextSlot++;
                if (nextSlot < GRID_TOTAL) {
                  grid[nextSlot] = item;
                  // Auto-assign position so items stay put after removal of others
                  if (invPositions[item.id] !== nextSlot) {
                    invPositions[item.id] = nextSlot;
                    positionsChanged = true;
                  }
                  nextSlot++;
                }
              }
              // Persist auto-assigned positions
              if (positionsChanged) {
                try { localStorage.setItem(`inv-pos-${playerName}`, JSON.stringify(invPositions)); } catch { /* ignore */ }
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
                {(() => {
                  // Build slot → equipped item map for comparison tooltips
                  const slotEquipMap: Record<string, InventoryItem | null> = {};
                  for (const { slot } of EQUIP_SLOT_LABELS) {
                    const eqRaw = charData.equipment[slot];
                    if (!eqRaw) { slotEquipMap[slot] = null; continue; }
                    const isInstance = typeof eqRaw === 'object' && eqRaw !== null;
                    const gi = isInstance ? eqRaw as GearInstance : null;
                    const eqId = gi ? (gi.instanceId || gi.templateId) : eqRaw;
                    slotEquipMap[slot] = gi
                      ? { id: gi.instanceId || gi.templateId, name: gi.name, slot: gi.slot, rarity: gi.rarity || 'common', stats: gi.stats || {}, icon: gi.icon || undefined, tier: gi.tier || 0, minLevel: gi.reqLevel || 0, desc: gi.desc, legendaryEffect: gi.legendaryEffect, affixes: gi.affixRolls } as unknown as InventoryItem
                      : charData.inventory.find(i => i.id === eqId) ?? null;
                  }
                  return Array.from({ length: GRID_TOTAL }, (_, idx) => {
                    const item = grid[idx];
                    const equipped = item?.slot ? slotEquipMap[item.slot] ?? null : null;
                    return (
                      <InventorySlot
                        key={item?.id ?? `empty-${idx}`}
                        item={item}
                        idx={idx}
                        level={charData.level}
                        onItemClick={(itm, rect) => {
                          if (compareMode) { setPinnedItem(pinnedItem?.id === itm.id ? null : itm); }
                          else { setSelectedItem({ item: itm, rect }); }
                        }}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        dragOverIdx={dragOverIdx}
                        equippedForSlot={compareMode && pinnedItem ? pinnedItem : equipped}
                        isNew={item ? !seenItemIds.has(item.id) : false}
                        onMarkSeen={item ? () => markItemSeen(item.id) : undefined}
                      />
                    );
                  });
                })()}
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
          className="flex-shrink-0 rounded-xl p-3 overflow-y-auto scrollbar-rpg"
          style={{ width: "100%", maxWidth: 250, maxHeight: 490, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)", minHeight: 0 }}
        >
          {/* Tab toggle */}
          <div className="flex gap-1 mb-3">
            {(["stats", "equipment", "gems"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setRightTab(tab);
                  if (tab === "gems" && !gemData && !gemsLoading) {
                    setGemsLoading(true);
                    fetch("/api/gems", { headers: apiKey ? getAuthHeaders(apiKey) : {} })
                      .then(r => r.ok ? r.json() : null)
                      .then(d => { if (d) setGemData(d); })
                      .catch(e => console.error('[character-view]', e))
                      .finally(() => setGemsLoading(false));
                  }
                }}
                className="flex-1 py-1 rounded-lg text-xs font-semibold"
                style={{
                  background: rightTab === tab ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${rightTab === tab ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
                  color: rightTab === tab ? "#a78bfa" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                }}
              >
                {tab === "stats" ? "Stats" : tab === "equipment" ? <Tip k="gear">Gear</Tip> : <Tip k="gems">Gems</Tip>}
              </button>
            ))}
          </div>

          {/* Gear tab — Paper Doll Layout */}
          {rightTab === "equipment" && (
            <div>
              {/* Paper Doll Grid */}
              <div className="relative mx-auto" style={{ width: 240, height: 250 }}>
                {/* Legendary equipment shimmer particles */}
                {(() => {
                  const hasLegendary = charData && Object.values(charData.equipment).some(v => {
                    if (!v || typeof v !== 'object') return false;
                    return (v as GearInstance).rarity === 'legendary' || (v as unknown as Record<string, unknown>).isUnique;
                  });
                  if (!hasLegendary) return null;
                  return (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      {Array.from({ length: 3 }, (_, i) => (
                        <div key={`legend-spark-${i}`} className="absolute rounded-full" style={{
                          width: 2,
                          height: 2,
                          left: `${25 + (i * 22) % 50}%`,
                          top: `${20 + (i * 28) % 60}%`,
                          background: "rgba(249,115,22,0.55)",
                          boxShadow: `0 0 ${3 + i % 2}px rgba(249,115,22,0.4)`,
                          animation: `ember-float ${4 + (i % 3) * 0.9}s ease-in-out ${i * 1.1}s infinite`,
                          opacity: 0,
                        }} />
                      ))}
                    </div>
                  );
                })()}
                {/* Silhouette background */}
                <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.03 }}>
                  <span style={{ fontSize: 120 }}>{"\u2666"}</span>
                </div>
                {/* Positioned slots */}
                {EQUIP_SLOT_LABELS.map(({ slot, iconSrc, label }) => {
                  const eqRaw = charData?.equipment[slot];
                  const isInstance = eqRaw && typeof eqRaw === 'object';
                  const gi = isInstance ? eqRaw as GearInstance : null;
                  const equippedItemId = gi ? (gi.instanceId || gi.templateId) : eqRaw;
                  const item = gi
                    ? { id: gi.instanceId || gi.templateId, name: gi.name, slot: gi.slot, rarity: gi.rarity || 'common', stats: gi.stats || {}, icon: gi.icon || undefined, tier: gi.tier || 0, minLevel: gi.reqLevel || 0, desc: gi.desc, legendaryEffect: gi.legendaryEffect, affixes: gi.affixRolls, binding: gi.binding, bound: gi.bound }
                    : equippedItemId ? { id: String(equippedItemId), name: String(equippedItemId), slot, rarity: "common", stats: {}, tier: 0, minLevel: 0 } : null;
                  const rc = item ? (RARITY_COLORS[item.rarity] || "#9ca3af") : "rgba(255,255,255,0.08)";
                  // Slot positions on the paper doll
                  const positions: Record<string, { top: number; left: number }> = {
                    helm:   { top: 0,   left: 88 },
                    amulet: { top: 0,   left: 176 },
                    weapon: { top: 80,  left: 0 },
                    armor:  { top: 80,  left: 88 },
                    shield: { top: 80,  left: 176 },
                    ring:   { top: 160, left: 0 },
                    boots:  { top: 160, left: 88 },
                  };
                  const pos = positions[slot] || { top: 0, left: 0 };
                  // Gem socket dots
                  const sockets = gi?.sockets || [];
                  const GEM_COLORS: Record<string, string> = { ruby: "#ef4444", sapphire: "#3b82f6", emerald: "#22c55e", topaz: "#f59e0b", amethyst: "#a855f7", diamond: "#e2e8f0" };

                  return (
                    <div key={slot} className="absolute" style={{ top: pos.top, left: pos.left }}>
                      <GearSlotRow
                        slot={slot}
                        iconSrc={iconSrc}
                        label={label}
                        item={item}
                        onUnequip={handleUnequip}
                        unequipping={unequipping}
                        compact
                      />
                      {/* Gem Quick-View dots */}
                      {sockets.length > 0 && (
                        <div className="flex gap-0.5 justify-center mt-0.5">
                          {sockets.map((gemKey: string | null, i: number) => {
                            if (!gemKey) return <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />;
                            const gemType = gemKey.split("_").slice(0, -1).join("_");
                            const color = GEM_COLORS[gemType] || "#888";
                            return <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 3px ${color}` }} />;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

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
                            ? <img src={item.icon} alt={item.name} width={32} height={32} style={{ imageRendering: "auto", flexShrink: 0 }} onError={e => { e.currentTarget.style.display = "none"; }} />
                            : <span style={{ width: 32, height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: RARITY_COLORS[item.rarity] || "#9ca3af", fontSize: 14 }}>◆</span>
                          }
                          <div className="flex-1 min-w-0" title={item.desc || item.name}>
                            <p className="text-xs font-semibold" style={{ color: "#e0e0e0" }}>{item.name}</p>
                            {item.desc && <p className="text-xs line-clamp-3 overflow-hidden" style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.3 }}>{item.desc}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Set Completion Tracker */}
              {charData && (() => {
                const sets: { name: string; count: number; total: number; isComplete: boolean; rarity?: string; activeLabel?: string | null; bonuses?: { threshold: number; label: string; active: boolean }[] }[] = [];
                // Tier-based set bonus
                if (charData.setBonusInfo) {
                  const sb = charData.setBonusInfo;
                  sets.push({ name: sb.name, count: sb.count, total: sb.total, isComplete: sb.count >= sb.total });
                }
                // Named sets
                for (const ns of charData.namedSetBonuses || []) {
                  sets.push({ name: ns.name, count: ns.count, total: ns.total, isComplete: ns.isComplete, rarity: ns.rarity, activeLabel: ns.activeLabel, bonuses: (ns as { bonuses?: { threshold: number; label: string; active: boolean }[] }).bonuses });
                }
                if (!sets.length) return null;
                return (
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Set-Boni</p>
                    <div className="space-y-1.5">
                      {sets.map(s => {
                        const pct = Math.min(s.count / s.total, 1);
                        const barColor = s.isComplete ? "#4ade80" : s.rarity === "legendary" ? "#f97316" : s.rarity === "epic" ? "#a855f7" : "#a78bfa";
                        return (
                          <div key={s.name} className="rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.isComplete ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold" style={{ color: s.isComplete ? "#4ade80" : "rgba(255,255,255,0.6)" }}>
                                {s.isComplete ? "✓ " : ""}{s.name}
                              </span>
                              <span className="text-xs font-mono" style={{ color: s.isComplete ? "#4ade80" : "rgba(255,255,255,0.35)" }}>
                                {s.count}/{s.total}
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: barColor }} />
                            </div>
                            {/* Show all bonus thresholds with active/inactive styling */}
                            {s.bonuses && s.bonuses.length > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                {s.bonuses.map((b, bi) => (
                                  <p key={bi} className="text-xs flex items-center gap-1" style={{ fontSize: 12, color: b.active ? barColor : "rgba(255,255,255,0.2)" }}>
                                    <span className="font-mono" style={{ minWidth: 24 }}>({b.threshold})</span>
                                    <span>{b.label}</span>
                                  </p>
                                ))}
                              </div>
                            ) : s.activeLabel && (
                              <p className="text-xs mt-1" style={{ color: barColor, fontSize: 12 }}>{s.activeLabel}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Stats tab */}
          {rightTab === "stats" && loading && <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton-card" style={{ height: 32 }}><div className="skeleton skeleton-text w-24" /></div>)}</div>}
          {rightTab === "stats" && !loading && charData && (() => {
            const { kraft = 0, ausdauer = 0, weisheit = 0, glueck = 0, fokus = 0, vitalitaet = 0, charisma = 0, tempo = 0 } = charData.stats || {};
            const base = charData.baseStats || { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 };
            const statRows = [
              { icon: "/images/icons/stat-kraft.png", label: "Kraft", iconSrc: "/images/icons/stat-kraft.png",    val: kraft,    base: base.kraft,    tooltip: "KRA · +0.5% Quest XP per point" },
              { icon: "/images/icons/stat-ausdauer.png", label: "Ausdauer", iconSrc: "/images/icons/stat-ausdauer.png", val: ausdauer, base: base.ausdauer, tooltip: "AUS · -0.5% Forge Decay per point (floor 10%)" },
              { icon: "/images/icons/stat-weisheit.png", label: "Weisheit", iconSrc: "/images/icons/stat-weisheit.png", val: weisheit, base: base.weisheit, tooltip: "WEI · +0.4% Gold per point" },
              { icon: "/images/icons/stat-glueck.png", label: "Glück", iconSrc: "/images/icons/stat-glueck.png",    val: glueck,   base: base.glueck,   tooltip: "GLÜ · +0.3% Drop Chance per point" },
            ];
            const minorStatRows = [
              { label: "Fokus", val: fokus || 0, tooltip: "FOK · +1 Flat Bonus XP per point (max +50)" },
              { label: "Vitalität", val: vitalitaet || 0, tooltip: "VIT · +1% Streak Protection per point (max 75%)" },
              { label: "Charisma", val: charisma || 0, tooltip: "CHA · +5% Companion Bond XP per point" },
              { label: "Tempo", val: tempo || 0, tooltip: "TMP · +1% Forge Temp Recovery per point" },
            ];
            const hasMinorStats = minorStatRows.some(s => s.val > 0);
            // Hero Numbers — 3 derived combat metrics
            const heroOffense = Math.round(kraft * 2.5 + (charData.gearScore?.gearScore || 0) * 0.3 + (fokus || 0) * 1.5);
            const heroDefense = Math.round(ausdauer * 3 + (vitalitaet || 0) * 2 + (charData.gearScore?.gearScore || 0) * 0.2);
            const heroUtility = Math.round(weisheit * 2 + glueck * 2 + (charisma || 0) * 1.5 + (tempo || 0) * 1.5);

            return (
              <>
                {/* Hero Numbers */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  <Tip k="hero_numbers"><div className="rounded-lg px-2 py-2 text-center cursor-help" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                    <p className="text-lg font-bold font-mono" style={{ color: "#ef4444" }}>{heroOffense}</p>
                    <p className="text-xs" style={{ color: "rgba(239,68,68,0.5)" }}>Offense</p>
                  </div></Tip>
                  <Tip k="hero_numbers"><div className="rounded-lg px-2 py-2 text-center cursor-help" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                    <p className="text-lg font-bold font-mono" style={{ color: "#3b82f6" }}>{heroDefense}</p>
                    <p className="text-xs" style={{ color: "rgba(59,130,246,0.5)" }}>Defense</p>
                  </div></Tip>
                  <Tip k="hero_numbers"><div className="rounded-lg px-2 py-2 text-center cursor-help" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <p className="text-lg font-bold font-mono" style={{ color: "#22c55e" }}>{heroUtility}</p>
                    <p className="text-xs" style={{ color: "rgba(34,197,94,0.5)" }}>Utility</p>
                  </div></Tip>
                </div>

                <div className="space-y-2 mb-4">
                  {statRows.map(s => {
                    const bonus = s.val - s.base;
                    const tipKey = s.label.toLowerCase().replace("ü", "ue") as string;
                    const registryKey = tipKey === "glueck" ? "glueck" : tipKey === "kraft" ? "kraft" : tipKey === "ausdauer" ? "ausdauer" : tipKey === "weisheit" ? "weisheit" : tipKey;
                    const statKey = s.label.toLowerCase().replace("ü", "ue");
                    const isExpanded = expandedStat === statKey;
                    const sources = charData.statBreakdown?.[statKey] || [];
                    return (
                      <div key={s.label}>
                        <Tip k={registryKey}>
                          <button
                            onClick={() => setExpandedStat(isExpanded ? null : statKey)}
                            className="w-full flex items-center gap-2"
                            style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
                          >
                            <img src={s.iconSrc} alt={s.label} width={16} height={16} style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} className="w-4 h-4" />
                            <span className="text-xs flex-1 text-left" style={{ color: "rgba(255,255,255,0.65)" }}>{s.label}</span>
                            <span className="text-xs font-mono font-bold" style={{ color: "#e8e8e8" }}>{s.val}</span>
                            {bonus > 0 && (
                              <span className="text-xs font-mono" style={{ color: "#4ade80" }}>(+{bonus})</span>
                            )}
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</span>
                          </button>
                        </Tip>
                        {isExpanded && sources.length > 0 && (
                          <div className="tab-content-enter ml-5 mt-1 mb-2 space-y-0.5 pl-2" style={{ borderLeft: "2px solid rgba(255,255,255,0.06)" }}>
                            {sources.map((src, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span style={{ color: src.type === "gem" ? "#a855f7" : src.type === "set" ? "#22c55e" : src.type === "trait" ? "#f59e0b" : "rgba(255,255,255,0.35)" }}>{src.source}</span>
                                <span className="font-mono" style={{ color: "#4ade80" }}>+{src.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {isExpanded && sources.length === 0 && (
                          <p className="ml-5 mt-1 mb-2 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>No gear contributions</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Minor Stats */}
                {hasMinorStats && (
                  <div className="space-y-1.5 mb-4 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Sekundär-Stats</p>
                    {minorStatRows.filter(s => s.val > 0).map(s => {
                      const tipKey = s.label.toLowerCase().replace("ä", "ae") as string;
                      const registryKey = tipKey === "vitalitaet" ? "vitalitaet" : tipKey;
                      return (
                        <div key={s.label}>
                          <Tip k={registryKey}>
                            <div className="flex items-center gap-2" style={{ cursor: "help" }}>
                              <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
                              <span className="text-xs font-mono font-bold" style={{ color: "#a78bfa" }}>{s.val}</span>
                            </div>
                          </Tip>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Gear Score — prominent, right after stats */}
                {charData.gearScore && charData.gearScore.gearScore > 0 && (
                  <Tip k="gear_score">
                  <div className="cursor-help mb-3 px-2 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Gear Score</span>
                      <span className="text-sm font-mono font-bold" style={{ color: charData.gearScore.gearScore >= 400 ? "#f97316" : charData.gearScore.gearScore >= 200 ? "#fbbf24" : charData.gearScore.gearScore >= 100 ? "#22c55e" : "#9ca3af" }}>
                        {charData.gearScore.gearScore}
                      </span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.07)" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (charData.gearScore.gearScore / 600) * 100)}%`, background: charData.gearScore.gearScore >= 400 ? "linear-gradient(90deg, #ea580c, #f97316)" : charData.gearScore.gearScore >= 200 ? "linear-gradient(90deg, #ca8a04, #fbbf24)" : "linear-gradient(90deg, #166534, #22c55e)" }} />
                    </div>
                  </div>
                  </Tip>
                )}

                {/* Set Bonus */}
                {charData.setBonusInfo && (
                  <div className="mb-3 px-2 py-1.5 rounded-lg" style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}>
                    <Tip k="set_bonus"><p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>
                      {charData.setBonusInfo.name} {charData.setBonusInfo.count}/{charData.setBonusInfo.total}
                      {charData.setBonusInfo.count >= charData.setBonusInfo.total ? " ✓" : " ○"}
                    </p></Tip>
                  </div>
                )}
                {/* Named Set Bonuses */}
                {(charData.namedSetBonuses ?? []).map(ns => {
                  const c = RARITY_COLORS[ns.rarity] ?? "#a78bfa";
                  return (
                    <div key={ns.id} className="mb-2 px-2 py-1.5 rounded-lg" style={{ background: `${c}10`, border: `1px solid ${c}30` }}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold" style={{ color: c }}>
                          {ns.name} {ns.count}/{ns.total} {ns.isComplete ? "✓" : "○"}
                        </p>
                      </div>
                      {ns.activeLabel && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{ns.activeLabel}</p>}
                      {/* Per-piece tracker */}
                      {(ns as unknown as { pieces?: { id: string; name: string; slot: string; equipped: boolean }[] }).pieces && (
                        <div className="mt-1.5 space-y-0.5">
                          {((ns as unknown as { pieces: { id: string; name: string; slot: string; equipped: boolean }[] }).pieces).map(p => (
                            <div key={p.id} className="flex items-center gap-1.5 text-xs">
                              <span style={{ color: p.equipped ? "#22c55e" : "rgba(255,255,255,0.15)", fontSize: 12 }}>{p.equipped ? "●" : "○"}</span>
                              <span className="flex-1 truncate" style={{ color: p.equipped ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)" }}>{p.name}</span>
                              <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>{p.slot}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Legendary Effects */}
                {(charData.legendaryEffects ?? []).length > 0 && (
                  <div className="mb-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <Tip k="legendary_effects"><p className="text-xs font-bold mb-1" style={{ color: "#f97316" }}>Legendary Effects</p></Tip>
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
                    <Tip k="player_level"><span className="text-xs font-bold" style={{ color: "#a78bfa" }}>Lv.{charData.level}</span></Tip>
                    <Tip k="xp"><span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {charData.xpInLevel ?? charData.xp}{charData.xpForLevel ? ` / ${charData.xpForLevel}` : ""} XP
                    </span></Tip>
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
                  <Tip k="classes">
                    <div className="mb-3 px-2 py-1.5 rounded-lg" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
                      <div className="flex items-center gap-2">
                        {cls.icon?.startsWith("/") ? <img src={cls.icon} alt="" width={20} height={20} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-base" style={{ color: "#c4b5fd" }}>✦</span>}
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>{cls.fantasy}</p>
                          {charData.classTier && <p className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>{charData.classTier}</p>}
                        </div>
                      </div>
                    </div>
                  </Tip>
                )}

                {/* Title — WoW Achievement Panel */}
                <div className="mb-3">
                  <button
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left"
                    style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
                    onClick={async () => {
                      const opening = !titlesOpen;
                      setTitlesOpen(opening);
                      if (opening && playerName) {
                        try {
                          const [titlesRes, defsRes] = await Promise.all([
                            fetch(`/api/player/${encodeURIComponent(playerName)}/titles`, { signal: AbortSignal.timeout(3000) }),
                            fetch(`/api/titles`, { signal: AbortSignal.timeout(3000) }),
                          ]);
                          if (titlesRes.ok) {
                            const data = await titlesRes.json();
                            setEarnedTitles(data.earned || []);
                            setEquippedTitleId(data.equipped?.id || null);
                          }
                          if (defsRes.ok) {
                            const defs = await defsRes.json();
                            setAllTitleDefs(Array.isArray(defs) ? defs : defs.titles || []);
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
                  {titlesOpen && createPortal((() => {
                    const earnedIds = new Set(earnedTitles.map(t => t.id));
                    const earnedMap = new Map(earnedTitles.map(t => [t.id, t]));

                    // Category definitions
                    const TITLE_CATEGORIES: { key: string; label: string; condTypes: string[] }[] = [
                      { key: "all", label: "All", condTypes: [] },
                      { key: "level", label: "Level", condTypes: ["level"] },
                      { key: "quests", label: "Quests", condTypes: ["quests_completed"] },
                      { key: "streak", label: "Streak", condTypes: ["streak"] },
                      { key: "collection", label: "Collection", condTypes: ["inventory_count"] },
                      { key: "wealth", label: "Wealth", condTypes: ["gold"] },
                      { key: "npc", label: "NPC", condTypes: ["npc_chains"] },
                      { key: "forge", label: "Forge", condTypes: ["forge_temp"] },
                      { key: "gacha", label: "Gacha", condTypes: ["gacha_legendary"] },
                      { key: "equipment", label: "Equipment", condTypes: ["full_equipment"] },
                      { key: "battlepass", label: "Battle Pass", condTypes: ["battlepass_level"] },
                      { key: "achievement", label: "Achievements", condTypes: ["achievement_points"] },
                      { key: "other", label: "Other", condTypes: [] },
                    ];
                    const knownCondTypes = new Set(TITLE_CATEGORIES.flatMap(c => c.condTypes));

                    // Merge all defs with earned info — normalize to common shape
                    const allTitles: { id: string; name: string; description?: string; rarity: string; condition?: { type: string; value: number } }[] =
                      allTitleDefs.length > 0 ? allTitleDefs : earnedTitles.map(t => ({ id: t.id, name: t.name, description: t.description, rarity: t.rarity }));

                    // Categorize
                    const getCatKey = (t: { condition?: { type: string } }) => {
                      const ct = t.condition?.type;
                      if (!ct) return "other";
                      if (knownCondTypes.has(ct)) {
                        const found = TITLE_CATEGORIES.find(c => c.condTypes.includes(ct));
                        return found?.key || "other";
                      }
                      return "other";
                    };

                    const filtered = titleCategory === "all"
                      ? allTitles
                      : allTitles.filter(t => getCatKey(t) === titleCategory);

                    // Sort: earned first, then by rarity weight
                    const rarityWeight: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, unique: 5 };
                    const sorted = [...filtered].sort((a, b) => {
                      const aE = earnedIds.has(a.id) ? 0 : 1;
                      const bE = earnedIds.has(b.id) ? 0 : 1;
                      if (aE !== bE) return aE - bE;
                      return (rarityWeight[b.rarity] ?? 0) - (rarityWeight[a.rarity] ?? 0);
                    });

                    // Condition label helper
                    const condLabel = (cond?: { type: string; value: number }) => {
                      if (!cond) return "Dynamically earned";
                      const v = cond.value;
                      switch (cond.type) {
                        case "level": return `Reach Level ${v}`;
                        case "quests_completed": return `Complete ${v} Quests`;
                        case "streak": return `${v}-Day Streak`;
                        case "inventory_count": return `${v} Items in Inventory`;
                        case "gold": return `Collect ${v.toLocaleString()} Gold`;
                        case "npc_chains": return `${v} NPC Chains Completed`;
                        case "forge_temp": return `Forge Temp ${v}%`;
                        case "gacha_legendary": return `${v} Legendary Gacha Pull${v > 1 ? "s" : ""}`;
                        case "full_equipment": return "All 6 Slots Equipped";
                        case "achievement_points": return `${v.toLocaleString()} Achievement Points`;
                        case "battlepass_level": return `Season Pass Level ${v}`;
                        default: return "Dynamically earned";
                      }
                    };

                    // Category counts
                    const catCounts = TITLE_CATEGORIES.map(cat => {
                      const titles = cat.key === "all" ? allTitles : allTitles.filter(t => getCatKey(t) === cat.key);
                      const earned = titles.filter(t => earnedIds.has(t.id)).length;
                      return { ...cat, earned, total: titles.length };
                    });

                    const handleEquip = async (titleId: string | null) => {
                      if (!playerName || !apiKey) return;
                      setTitleEquipping(titleId);
                      try {
                        const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/title/equip`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...getAuthHeaders(apiKey) },
                          body: JSON.stringify({ titleId }),
                        });
                        if (r.ok) {
                          setEquippedTitleId(titleId);
                          addToast?.({ type: "purchase", message: titleId ? `Title equipped: ${allTitles.find(t => t.id === titleId)?.name || titleId}` : "Title removed" });
                        }
                      } catch { /* ignore */ }
                      setTitleEquipping(null);
                    };

                    const equippedDef = allTitles.find(t => t.id === equippedTitleId);
                    const eqColor = equippedDef ? (RARITY_COLORS[equippedDef.rarity] || "#fbbf24") : "#fbbf24";

                    return (
                      <div className="fixed inset-0 z-[150] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setTitlesOpen(false)}>
                      <div className="w-full max-w-lg max-h-[80vh] rounded-xl overflow-hidden tab-content-enter" style={{ background: "#111318", border: "1px solid rgba(251,191,36,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(251,191,36,0.06)", borderBottom: "1px solid rgba(251,191,36,0.15)" }}>
                          <p className="text-sm font-bold" style={{ color: "#fbbf24" }}>Titles ({earnedTitles.length} earned)</p>
                          <button onClick={() => setTitlesOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}><span className="text-xs font-mono" style={{ fontSize: 12 }}>ESC</span></button>
                        </div>
                        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(80vh - 56px)", scrollbarWidth: "thin" }}>
                        {/* Equipped Title Display */}
                        {equippedDef && (
                          <div
                            className="mb-3 px-3 py-2 rounded-lg flex items-center justify-between"
                            style={{
                              background: `linear-gradient(135deg, ${eqColor}12 0%, transparent 70%)`,
                              border: `1px solid ${eqColor}40`,
                              boxShadow: `inset 0 1px 0 ${eqColor}18, 0 0 12px ${eqColor}10`,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span style={{ color: eqColor, fontSize: 16 }}>★</span>
                              <div>
                                <p className="text-sm font-bold" style={{ color: eqColor }}>{equippedDef.name}</p>
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{equippedDef.description}</p>
                              </div>
                            </div>
                            <button
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", cursor: titleEquipping ? "not-allowed" : "pointer" }}
                              title={titleEquipping ? "Action in progress..." : "Unequip title"}
                              disabled={!!titleEquipping}
                              onClick={() => handleEquip(null)}
                            >
                              {titleEquipping === null ? "..." : "Unequip"}
                            </button>
                          </div>
                        )}

                        {/* Section Header */}
                        <div className="flex items-center justify-between mb-2 px-1">
                          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>Titles</p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {earnedTitles.length} / {allTitleDefs.length || earnedTitles.length} earned
                          </p>
                        </div>

                        {/* Category Tabs */}
                        <div className="flex flex-wrap gap-1 mb-2 px-1">
                          {catCounts.filter(c => c.key === "all" || c.total > 0).map(cat => (
                            <button
                              key={cat.key}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: titleCategory === cat.key ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                                border: titleCategory === cat.key ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.08)",
                                color: titleCategory === cat.key ? "#fbbf24" : "rgba(255,255,255,0.4)",
                                cursor: "pointer",
                              }}
                              onClick={() => setTitleCategory(cat.key)}
                            >
                              {cat.label} {cat.key !== "all" && <span style={{ color: "rgba(255,255,255,0.2)" }}>{cat.earned}/{cat.total}</span>}
                            </button>
                          ))}
                        </div>

                        {/* Title Cards */}
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1" style={{ overscrollBehavior: "contain" }}>
                          {sorted.map(t => {
                            const isEarned = earnedIds.has(t.id);
                            const isEquipped = equippedTitleId === t.id;
                            const c = RARITY_COLORS[t.rarity] || "#9ca3af";
                            const earnedInfo = earnedMap.get(t.id);
                            const earnedDate = earnedInfo?.earnedAt ? new Date(earnedInfo.earnedAt).toLocaleDateString() : null;

                            return (
                              <button
                                key={t.id}
                                className="w-full text-left rounded-lg flex items-stretch"
                                style={{
                                  opacity: isEarned ? 1 : 0.4,
                                  cursor: !isEarned || titleEquipping ? "not-allowed" : isEquipped ? "default" : "pointer",
                                  border: isEquipped ? `1px solid ${c}60` : "1px solid rgba(255,255,255,0.06)",
                                  background: isEquipped
                                    ? `linear-gradient(90deg, ${c}14 0%, transparent 100%)`
                                    : "rgba(255,255,255,0.02)",
                                  boxShadow: isEquipped
                                    ? `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 8px ${c}15`
                                    : "inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.2)",
                                  overflow: "hidden",
                                }}
                                disabled={!isEarned || !!titleEquipping}
                                title={!isEarned ? condLabel(t.condition) : isEquipped ? "Currently equipped" : `Click to equip "${t.name}"`}
                                onClick={() => {
                                  if (isEarned && !isEquipped) handleEquip(t.id);
                                }}
                              >
                                {/* Rarity left border */}
                                <div style={{ width: 3, flexShrink: 0, background: c, borderRadius: "6px 0 0 6px" }} />

                                {/* Card content */}
                                <div className="flex-1 px-2.5 py-1.5 flex items-center justify-between gap-2 min-w-0">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-semibold truncate" style={{ color: isEarned ? c : "rgba(255,255,255,0.5)" }}>
                                        {isEarned ? t.name : "???"}
                                      </span>
                                      {isEquipped && (
                                        <span
                                          className="text-xs px-1.5 py-0 rounded-full font-medium flex-shrink-0"
                                          style={{ background: `${c}20`, color: c, fontSize: 12, lineHeight: "16px" }}
                                        >
                                          Equipped
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                                      {t.description || condLabel(t.condition)}
                                    </p>
                                  </div>

                                  {/* Right side: status */}
                                  <div className="flex-shrink-0 flex items-center gap-1">
                                    {isEarned ? (
                                      <div className="flex flex-col items-end">
                                        <span style={{ color: "#22c55e", fontSize: 12 }}>✓</span>
                                        {earnedDate && <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>{earnedDate}</span>}
                                      </div>
                                    ) : (
                                      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>{"\u25CB"}</span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                          {sorted.length === 0 && (
                            <p className="text-xs text-center py-3" style={{ color: "rgba(255,255,255,0.25)" }}>No titles in this category</p>
                          )}
                        </div>
                      </div>
                      </div>
                      </div>
                    );
                  })(), document.body)}
                </div>

                {/* Gear Score moved to stats tab — above set bonuses */}
              </>
            );
          })()}

          {/* Gems tab */}
          {rightTab === "gems" && gemsLoading && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Loading gems...</p>}
          {rightTab === "gems" && !gemsLoading && gemData && (() => {
            const GEM_COLORS: Record<string, string> = { Ruby: "#ef4444", Sapphire: "#3b82f6", Emerald: "#22c55e", Topaz: "#f59e0b", Amethyst: "#a855f7", Diamond: "#e2e8f0" };
            // Group inventory by type
            const gemMap = new Map(gemData.gems.map(g => [g.id, g]));
            const grouped: Record<string, { gemKey: string; gem: typeof gemData.gems[0]; tier: number; count: number; name: string; statBonus: number }[]> = {};
            for (const [gemKey, inv] of Object.entries(gemData.inventory || {})) {
              if (!inv || inv.count <= 0) continue;
              const gem = gemMap.get(inv.gemType);
              if (!gem) continue;
              const gemName = gem.name || inv.gemType;
              if (!grouped[gemName]) grouped[gemName] = [];
              grouped[gemName].push({ gemKey, gem, tier: inv.tier, count: inv.count, name: inv.name, statBonus: inv.statBonus });
            }
            const doGemAction = async (action: string, body: Record<string, unknown>) => {
              if (!apiKey || gemAction) return;
              setGemAction(action);
              try {
                const r = await fetch(`/api/gems/${action}`, { method: "POST", headers: { ...getAuthHeaders(apiKey), "Content-Type": "application/json" }, body: JSON.stringify(body) });
                const d = await r.json();
                if (r.ok) {
                  addToast?.({ type: "purchase", message: d.message || "Done" });
                  // Refresh gem data
                  const gr = await fetch("/api/gems", { headers: getAuthHeaders(apiKey) });
                  if (gr.ok) setGemData(await gr.json());
                } else {
                  addToast?.({ type: "error", message: d.error || "Something went wrong. Please try again." });
                }
              } catch { addToast?.({ type: "error", message: "Network error" }); }
              setGemAction(null);
            };
            return (
              <div className="space-y-3">
                {/* Gem Inventory */}
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Gem Inventory</p>
                {Object.keys(grouped).length === 0 && (
                  <p className="text-xs text-w20">No gems found.</p>
                )}
                {Object.entries(grouped).map(([type, entries]) => (
                  <div key={type}>
                    <p className="text-xs font-semibold mb-1" style={{ color: GEM_COLORS[type] || "#9ca3af" }}>{type}</p>
                    <div className="space-y-0.5">
                      {entries.sort((a, b) => a.tier - b.tier).map(({ gemKey, gem, count, tier }) => (
                        <div key={gemKey} className="flex items-center justify-between px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: GEM_COLORS[gem.type] || "#9ca3af" }} />
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{gem.name}</span>
                            <span className="text-xs text-w20">T{tier}</span>
                            {gem.stat && <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>+{(gem as unknown as { tiers?: { tier: number; statBonus: number }[] }).tiers?.find(t => t.tier === tier)?.statBonus ?? "?"} {gem.stat}</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono" style={{ color: GEM_COLORS[gem.type] || "#9ca3af" }}>x{count}</span>
                            {count >= 3 && tier < 5 && (
                              <button
                                onClick={() => doGemAction("upgrade", { gemKey })}
                                disabled={!!gemAction}
                                title={gemAction ? "Action in progress…" : `Combine 3 × T${tier} → 1 × T${tier + 1} (costs 100g + Essenz)`}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)", cursor: gemAction ? "not-allowed" : "pointer", fontSize: 12 }}
                              >
                                3{"\u2192"}1
                              </button>
                            )}
                            {tier < 5 && (
                              <button
                                onClick={() => doGemAction("polish", { gemKey })}
                                disabled={!!gemAction}
                                title={gemAction ? "Action in progress…" : `Polish 1 × T${tier} → T${tier + 1} (costs ${500 * tier}g + ${Math.floor(500 * tier / 2)} Essenz)`}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", cursor: gemAction ? "not-allowed" : "pointer", fontSize: 12 }}
                              >
                                Polish
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Socketed Items */}
                {Object.keys(gemData.socketedGems || {}).length > 0 && (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>Sockets</p>
                    {Object.entries(gemData.socketedGems).map(([instanceId, data]) => (
                      <div key={instanceId} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>{(data as { itemName?: string; slot: string }).itemName || (data as { slot: string }).slot}</p>
                        <div className="flex gap-1.5">
                          {data.sockets.map((socket, si) => (
                            <div key={si} className="flex flex-col items-center gap-1">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center"
                                style={{
                                  background: socket ? `${GEM_COLORS[socket.gemType] || "#9ca3af"}20` : "rgba(255,255,255,0.04)",
                                  border: `2px solid ${socket ? `${GEM_COLORS[socket.gemType] || "#9ca3af"}60` : "rgba(255,255,255,0.1)"}`,
                                }}
                                title={socket ? socket.gemName : "Empty socket"}
                              >
                                {socket ? (
                                  <span className="w-2 h-2 rounded-full" style={{ background: GEM_COLORS[socket.gemType] || "#9ca3af" }} />
                                ) : (
                                  <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>+</span>
                                )}
                              </div>
                              <div className="flex gap-0.5">
                                {!socket ? (
                                  <button
                                    onClick={() => {
                                      // Pick first available gem from inventory for quick socket
                                      const firstGem = Object.entries(gemData.inventory || {}).find(([, v]) => (v as { count: number }).count > 0);
                                      if (!firstGem) { addToast?.({ type: "error", message: "No gems available" }); return; }
                                      doGemAction("socket", { instanceId, socketIndex: si, gemKey: firstGem[0] });
                                    }}
                                    disabled={!!gemAction || Object.keys(gemData.inventory || {}).length === 0}
                                    title={gemAction ? "Action in progress…" : Object.keys(gemData.inventory || {}).length === 0 ? "No gems available" : "Socket a gem"}
                                    className="text-xs px-1 py-0.5 rounded"
                                    style={{ fontSize: 12, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)", cursor: (gemAction || Object.keys(gemData.inventory || {}).length === 0) ? "not-allowed" : "pointer" }}
                                  >
                                    Socket
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setConfirmMessage(`Gem entfernen? Kostet ${gemData.unsocketCost || 50}g. Der Edelstein kann dabei zerstört werden.`);
                                      setConfirmAction(() => () => doGemAction("unsocket", { instanceId, socketIndex: si }));
                                    }}
                                    disabled={!!gemAction}
                                    title={gemAction ? "Action in progress…" : "Remove socketed gem"}
                                    className="text-xs px-1 py-0.5 rounded"
                                    style={{ fontSize: 12, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: gemAction ? "not-allowed" : "pointer" }}
                                  >
                                    Unsocket {gemData.unsocketCost || 50}g
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Unlock Socket button */}
                        <button
                          onClick={() => doGemAction("unlock-socket", { inventoryItemId: instanceId })}
                          disabled={!!gemAction}
                          title={gemAction ? "Action in progress…" : `Add a new socket (1,000g + 5 Essenz)`}
                          className="text-xs px-2 py-1 rounded mt-1.5 w-full"
                          style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", cursor: gemAction ? "not-allowed" : "pointer", fontSize: 12 }}
                        >
                          + Unlock Socket
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })()}
          {rightTab === "gems" && !gemsLoading && !gemData && (
            <p className="text-xs text-w20">Could not load gem data.</p>
          )}
        </div>
      </div>

      {/* Profile Settings Modal */}
      {profileSettingsOpen && createPortal(
        <ProfileSettingsModal
          playerName={playerName}
          apiKey={apiKey}
          initialStatus={charData?.relationshipStatus ?? "single"}
          initialPartnerName={charData?.partnerName ?? ""}
          onClose={() => setProfileSettingsOpen(false)}
          onSaved={fetchChar}
        />,
      document.body)}

      {/* Item Action Popup */}
      {selectedItem && charData && (() => {
        const equippedIdSet = new Set(
          Object.values(charData.equipment).filter(Boolean).map(v =>
            typeof v === 'object' && v !== null ? ((v as { instanceId?: string; templateId?: string }).instanceId || (v as { instanceId?: string; templateId?: string }).templateId) : v
          )
        );
        const isEquipped = equippedIdSet.has(selectedItem.item.id);
        const equippedSlot = isEquipped
          ? Object.entries(charData.equipment).find(([, v]) => {
              if (!v) return false;
              const id = typeof v === 'object' ? ((v as { instanceId?: string; templateId?: string }).instanceId || (v as { instanceId?: string; templateId?: string }).templateId) : v;
              return id === selectedItem.item.id;
            })?.[0]
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
            onLock={handleLockItem}
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
            title="Frames & Cosmetics"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
          >Frames</button>
        </div>
        {charData && <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{charData.title}</p>}
      </div>
      {cls && (
        <div className="flex items-center gap-2 shrink-0">
          {cls.icon?.startsWith("/") ? <img src={cls.icon} alt="" width={24} height={24} className="img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} /> : <span className="text-lg" style={{ color: "#c4b5fd" }}>✦</span>}
          <div className="text-center">
            <p className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>{cls.fantasy}</p>
            {charData?.classTier && <p className="text-xs" style={{ color: "rgba(167,139,250,0.45)" }}>{charData.classTier}</p>}
          </div>
        </div>
      )}
      <button
        onClick={async () => {
          setCollectionOpen(true);
          if (!collectionData && !collectionLoading && playerName) {
            setCollectionLoading(true);
            try {
              const r = await fetch(`/api/player/${encodeURIComponent(playerName)}/collection`);
              if (r.ok) {
                const d = await r.json();
                setCollectionData({ items: d.uniques || [], completion: (d.completionPercent ?? 0) / 100 });
              }
            } catch { /* ignore */ }
            setCollectionLoading(false);
          }
        }}
        className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-semibold"
        style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", color: "rgba(96,165,250,0.55)", cursor: "pointer" }}
      >
        Collection
      </button>
      {onNavigate && (
        <button
          onClick={() => onNavigate("forge")}
          className="cross-nav-link shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-semibold"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", color: "rgba(245,158,11,0.55)" }}
        >
          <Tip k="artisans_quarter">Artisan&#39;s Quarter &#8250;</Tip>
        </button>
      )}
      {onNavigate && (
        <button
          onClick={() => onNavigate("talents")}
          className="cross-nav-link shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-semibold"
          style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", color: "rgba(168,85,247,0.55)" }}
        >
          <Tip k="talent_tree">Schicksalsbaum &#8250;</Tip>
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
          <Tip k="bond_level"><div className="flex items-center gap-2 shrink-0">
            {comp.type && ["dragon","owl","phoenix","wolf","fox","bear"].includes(comp.type)
              ? <img src={`/images/portraits/companion-${comp.type}.png`} alt={comp.name} width={32} height={32} style={{ imageRendering: "auto", borderRadius: 4, objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
              : comp.type === "cat" && comp.name?.toLowerCase() === "dobbie"
                ? <img src="/images/portraits/companion-dobbie.png" alt={comp.name} width={32} height={32} style={{ imageRendering: "auto", borderRadius: 4, objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                : <span className="text-xl" style={{ color: "rgba(255,255,255,0.3)" }}>◆</span>
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
          </div></Tip>
        );
      })()}
    </div>

    {/* Collection Log Modal */}
    {collectionOpen && createPortal(
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 9999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={e => { if (e.target === e.currentTarget) setCollectionOpen(false); }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{ width: "min(90vw, 620px)", maxHeight: "85vh", background: "#0f1117", border: "1px solid rgba(96,165,250,0.2)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        >
          {/* Header */}
          <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(96,165,250,0.04)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg" style={{ color: "#60a5fa" }}>◆</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: "#60a5fa" }}>Collection Log</p>
                  {collectionData && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {Math.round(collectionData.completion * 100)}% complete
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setCollectionOpen(false)}
                className="text-sm px-2 py-1 rounded-lg"
                style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer", background: "rgba(255,255,255,0.04)" }}
              >
                ESC
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
              Handcrafted legendary artifacts from the most dangerous encounters in Aethermoor. Each one is unique — once obtained, it&apos;s yours forever.
            </p>
            <p className="text-xs italic mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
              Some heroes collect stamps. You collect the impossible.
            </p>
          </div>

          {/* Completion bar */}
          {collectionData && (
            <div className="px-5 pt-3">
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${collectionData.completion * 100}%`, background: "linear-gradient(90deg, #3b82f6, #60a5fa)", transition: "width 0.3s" }} />
              </div>
              <p className="text-xs text-right mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                {collectionData.items.filter(i => i.obtained).length}/{collectionData.items.length} items
              </p>
            </div>
          )}

          {/* Source filter tabs */}
          <div className="px-5 pt-3 flex gap-1.5 flex-wrap">
            {(["all", "world_boss", "dungeon", "gacha"] as const).map(tab => {
              const labels: Record<string, string> = { all: "All", world_boss: "World Boss", dungeon: "Dungeon", gacha: "Gacha" };
              const isActive = collectionFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setCollectionFilter(tab)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{
                    cursor: "pointer",
                    background: isActive ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.04)",
                    color: isActive ? "#60a5fa" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${isActive ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.06)"}`,
                    transition: "all 0.15s ease",
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Items grouped by source */}
          <div className="p-5 overflow-y-auto" style={{ maxHeight: "calc(85vh - 220px)" }}>
            {collectionLoading && <p className="text-xs text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>Loading collection...</p>}
            {!collectionLoading && !collectionData && <p className="text-xs text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>Could not load collection data.</p>}
            {collectionData && (() => {
              const sourceDisplayNames: Record<string, string> = {
                "world_boss:procrastination-wyrm": "◆ The Procrastination Wyrm",
                "world_boss:burnout-colossus": "◆ Burnout Colossus",
                "world_boss:chaos-hydra": "◆ Chaos Hydra",
                "world_boss:doubt-phantom": "◆ Doubt Phantom",
                "world_boss:entropy-weaver": "◆ Entropy Weaver",
                "world_boss:stagnation-golem": "◆ Stagnation Golem",
                "world_boss:perfection-seraph": "◆ Perfection Seraph",
                "world_boss:isolation-leviathan": "◆ Isolation Leviathan",
                "world_boss:apathy-sovereign": "◆ Apathy Sovereign",
                "dungeon:sunken-archive": "▣ Sunken Archive (Normal)",
                "dungeon:shattered-spire": "▣ Shattered Spire (Hard)",
                "dungeon:hollow-core": "▣ Hollow Core (Legendary)",
                "gacha:astral-radiance": "★ Astral Radiance Banner",
                "gacha:wheel-of-stars": "★ Wheel of Stars Banner",
              };

              const getSourceType = (source: string) => source.split(":")[0];
              const getSourceDisplayName = (source: string) => {
                if (sourceDisplayNames[source]) return sourceDisplayNames[source];
                const [type, id] = source.split(":");
                const name = (id || "").split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                if (type === "world_boss") return `◆ ${name}`;
                if (type === "dungeon") return `▣ ${name}`;
                if (type === "gacha") return `★ ${name}`;
                if (type === "rift") return `◇ ${name}`;
                return source;
              };
              const getSourceLabel = (source: string) => {
                const [type, id] = source.split(":");
                const name = (id || "").split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                if (type === "world_boss") return `World Boss: ${name}`;
                if (type === "dungeon") return `Dungeon: ${name}`;
                if (type === "gacha") return `Gacha: ${name}`;
                if (type === "rift") return `Rift: ${name}`;
                return source;
              };

              // Filter items by selected tab
              const filteredItems = collectionFilter === "all"
                ? collectionData.items
                : collectionData.items.filter(i => getSourceType(i.source) === collectionFilter);

              // Group by source
              const groups: Record<string, typeof collectionData.items> = {};
              for (const item of filteredItems) {
                if (!groups[item.source]) groups[item.source] = [];
                groups[item.source].push(item);
              }

              // Sort groups: world_boss first, then dungeon, then gacha, then rest
              const typeOrder: Record<string, number> = { world_boss: 0, dungeon: 1, gacha: 2, rift: 3 };
              const sortedSources = Object.keys(groups).sort((a, b) => {
                const ta = typeOrder[getSourceType(a)] ?? 99;
                const tb = typeOrder[getSourceType(b)] ?? 99;
                return ta - tb || a.localeCompare(b);
              });


              if (sortedSources.length === 0) {
                return <p className="text-xs text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>No items in this category.</p>;
              }

              return (
                <div className="space-y-5 tab-content-enter" key={collectionFilter}>
                  {sortedSources.map(source => {
                    const items = groups[source];
                    const obtained = items.filter(i => i.obtained).length;
                    return (
                      <div key={source}>
                        {/* Section header */}
                        <div className="flex items-center justify-between mb-2 pb-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
                            {getSourceDisplayName(source)}
                          </p>
                          <p className="text-xs font-mono" style={{ color: obtained === items.length ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
                            {obtained}/{items.length}
                          </p>
                        </div>
                        {/* Items grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {items.map(item => {
                            const color = RARITY_COLORS[item.rarity] || "#9ca3af";
                            const sourceLabel = getSourceLabel(item.source);
                            return (
                              <TipCustom
                                key={item.id}
                                title={item.obtained ? item.name : "???"}
                                accent={item.obtained ? color : "rgba(255,255,255,0.3)"}
                                hoverDelay={300}
                                body={<>
                                  {item.obtained ? (
                                    <>
                                      <p className="text-xs capitalize" style={{ color }}>Legendary {item.slot}</p>
                                      {item.desc && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>}
                                      {item.flavorText && <p className="text-xs italic mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>&ldquo;{item.flavorText}&rdquo;</p>}
                                      {item.legendaryEffect?.label && <p className="text-xs mt-1 font-semibold" style={{ color: "#f59e0b" }}>{formatLegendaryLabel(item.legendaryEffect)}</p>}
                                      {item.stats && Object.keys(item.stats).length > 0 && (
                                        <div className="mt-1 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 4 }}>
                                          {Object.entries(item.stats).map(([k, v]) => (
                                            <div key={k} className="flex justify-between text-xs">
                                              <span style={{ color: "rgba(255,255,255,0.5)" }}>{k}</span>
                                              <span className="font-mono" style={{ color: "#4ade80" }}>+{v}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Drops from: {sourceLabel}</p>
                                        <p className="text-xs font-semibold mt-0.5" style={{ color: "#4ade80" }}>Obtained ✓</p>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Not yet discovered.</p>
                                      <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Drops from: {sourceLabel}</p>
                                    </>
                                  )}
                                </>}
                              >
                              <div
                                className="rounded-lg p-2.5 cursor-help"
                                style={{
                                  background: item.obtained ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
                                  border: `1px solid ${item.obtained ? `${color}30` : "rgba(255,255,255,0.04)"}`,
                                  borderTop: item.obtained ? `2px solid ${color}` : undefined,
                                  opacity: item.obtained ? 1 : 0.45,
                                  filter: item.obtained ? "none" : "grayscale(1)",
                                }}
                              >
                                {item.obtained ? (
                                  <>
                                    <p className="text-xs font-semibold truncate" style={{ color }}>{item.name}</p>
                                    <p className="text-xs text-w20 truncate capitalize">{item.slot}</p>
                                    {item.legendaryEffect?.label && (
                                      <p className="text-xs mt-1 truncate" style={{ color: "#f59e0b", fontSize: 12 }}>{formatLegendaryLabel(item.legendaryEffect)}</p>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>???</p>
                                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>{item.slot}</p>
                                  </>
                                )}
                              </div>
                              </TipCustom>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>,
      document.body
    )}

      {/* ── Confirmation Modal ── */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="rounded-xl p-5 max-w-sm w-full mx-4"
            style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm mb-4" style={{ color: "#e8e8e8" }}>{confirmMessage}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="text-xs px-4 py-2 rounded-lg font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => { confirmAction(); setConfirmAction(null); }}
                className="text-xs px-4 py-2 rounded-lg font-semibold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
              >
                Entfernen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
