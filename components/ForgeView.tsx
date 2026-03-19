"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDashboard } from "@/app/DashboardContext";
import type { User } from "@/app/types";

// ─── Types ──────────────────────────────────────────────────────────────────
interface ProfessionDef {
  id: string;
  name: string;
  npcName: string;
  npcPortrait: string;
  npcGreeting: string;
  description: string;
  color: string;
  icon: string;
  maxLevel: number;
  unlocked: boolean;
  playerLevel: number;
  playerXp: number;
  nextLevelXp: number | null;
  levelThresholds: number[];
  unlockCondition?: { type: string; value: number };
}

interface Recipe {
  id: string;
  profession: string;
  name: string;
  desc: string;
  reqProfLevel: number;
  cost: { gold?: number };
  materials: Record<string, number>;
  cooldownMinutes: number;
  canCraft: boolean;
}

interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  desc: string;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

// ─── Slot labels ────────────────────────────────────────────────────────────
const SLOT_LABELS: Record<string, string> = {
  weapon: "Waffe",
  shield: "Schild",
  helm: "Helm",
  armor: "Rüstung",
  amulet: "Amulett",
  boots: "Stiefel",
};

// ─── ForgeView Component ────────────────────────────────────────────────────
export default function ForgeView({ onRefresh }: { onRefresh?: () => void }) {
  const { playerName, reviewApiKey, loggedInUser } = useDashboard();
  const [professions, setProfessions] = useState<ProfessionDef[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [materials, setMaterials] = useState<Record<string, number>>({});
  const [materialDefs, setMaterialDefs] = useState<MaterialDef[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<ProfessionDef | null>(null);
  const [craftResult, setCraftResult] = useState<string | null>(null);
  const [crafting, setCrafting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("weapon");
  const [dismantleResult, setDismantleResult] = useState<string | null>(null);
  const [transmuteResult, setTransmuteResult] = useState<string | null>(null);
  const [selectedTransmute, setSelectedTransmute] = useState<string[]>([]);

  const loggedIn = playerName && reviewApiKey;

  const fetchData = useCallback(async () => {
    if (!playerName) return;
    try {
      const r = await fetch(`/api/professions?player=${encodeURIComponent(playerName)}`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const data = await r.json();
        setProfessions(data.professions || []);
        setRecipes(data.recipes || []);
        setMaterials(data.materials || {});
        setMaterialDefs(data.materialDefs || []);
      }
    } catch { /* ignore */ }
  }, [playerName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCraft = async (recipeId: string) => {
    if (crafting || !reviewApiKey) return;
    setCrafting(true);
    setCraftResult(null);
    try {
      const r = await fetch("/api/professions/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
        body: JSON.stringify({ recipeId, targetSlot: selectedSlot }),
      });
      const data = await r.json();
      if (r.ok) {
        setCraftResult(data.message || "Erfolgreich!");
        if (data.profLevelUp) setCraftResult(prev => `${prev} LEVEL UP!`);
        fetchData();
        onRefresh?.();
      } else {
        setCraftResult(data.error || "Fehler beim Craften");
      }
    } catch {
      setCraftResult("Netzwerkfehler");
    }
    setCrafting(false);
  };

  const handleDismantle = async (itemId: string) => {
    if (!reviewApiKey) return;
    try {
      const r = await fetch("/api/schmiedekunst/dismantle", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
        body: JSON.stringify({ inventoryItemId: itemId }),
      });
      const data = await r.json();
      setDismantleResult(data.message || data.error || "Fehler");
      setTimeout(() => setDismantleResult(null), 4000);
      fetchData();
      onRefresh?.();
    } catch { setDismantleResult("Netzwerkfehler"); }
  };

  const handleTransmute = async () => {
    if (!reviewApiKey || selectedTransmute.length !== 3) return;
    try {
      const r = await fetch("/api/schmiedekunst/transmute", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
        body: JSON.stringify({ itemIds: selectedTransmute }),
      });
      const data = await r.json();
      setTransmuteResult(data.message || data.error || "Fehler");
      setSelectedTransmute([]);
      setTimeout(() => setTransmuteResult(null), 5000);
      fetchData();
      onRefresh?.();
    } catch { setTransmuteResult("Netzwerkfehler"); }
  };

  if (!loggedIn || !loggedInUser) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <span className="text-4xl" style={{ opacity: 0.3 }}>&#9876;</span>
        <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Deepforge</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Melde dich an, um die Deepforge zu betreten.</p>
      </div>
    );
  }

  const equippedSlots = (loggedInUser.equipment || {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Deepforge</span>
        <div className="flex items-center gap-3 ml-auto text-xs">
          <span style={{ color: "#f59e0b" }}>
            <img src="/images/icons/currency-gold.png" alt="" width={20} height={20} style={{ imageRendering: "smooth", display: "inline", verticalAlign: "middle", marginRight: 2 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            {loggedInUser.currencies?.gold ?? loggedInUser.gold ?? 0}
          </span>
        </div>
      </div>

      {/* Materials Bar */}
      {Object.keys(materials).length > 0 && (
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Materialien</p>
          <div className="flex flex-wrap gap-2">
            {materialDefs.filter(m => materials[m.id]).map(m => (
              <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${RARITY_COLORS[m.rarity] || "#555"}30` }} title={m.desc}>
                <img src={m.icon} alt="" width={18} height={18} style={{ imageRendering: "smooth" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span className="text-xs" style={{ color: RARITY_COLORS[m.rarity] || "#ccc" }}>{m.name}</span>
                <span className="text-xs font-mono font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>x{materials[m.id]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NPC Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {professions.map(prof => {
          const locked = !prof.unlocked;
          return (
            <button
              key={prof.id}
              onClick={() => !locked && setSelectedNpc(prof)}
              disabled={locked}
              className="relative rounded-xl p-4 text-left transition-all"
              style={{
                background: locked ? "rgba(255,255,255,0.02)" : `${prof.color}08`,
                border: `1px solid ${locked ? "rgba(255,255,255,0.05)" : `${prof.color}25`}`,
                opacity: locked ? 0.5 : 1,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{ background: `${prof.color}15`, border: `1px solid ${prof.color}30` }}>
                  <img src={prof.npcPortrait} alt={prof.npcName} width={56} height={56} style={{ imageRendering: "smooth", width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: prof.color }}>{prof.npcName}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{prof.name}</p>
                </div>
              </div>
              {prof.unlocked && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ background: prof.color, width: `${prof.nextLevelXp ? Math.min(100, (prof.playerXp / prof.nextLevelXp) * 100) : 100}%` }} />
                  </div>
                  <span className="text-xs font-mono" style={{ color: prof.color }}>Lv.{prof.playerLevel}</span>
                </div>
              )}
              {locked && (
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Benötigt Spieler-Level {prof.unlockCondition?.value || "?"}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Schmiedekunst (Kanai's Cube) ──────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,140,0,0.15)" }}>
        <div className="flex items-center gap-2 mb-3">
          <img src="/images/icons/prof-schmied.png" alt="" width={20} height={20} style={{ imageRendering: "smooth" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,140,0,0.6)" }}>Schmiedekunst</span>
        </div>

        {dismantleResult && (
          <div className="rounded px-2.5 py-1.5 text-xs font-semibold mb-2" style={{ background: "rgba(255,140,0,0.08)", border: "1px solid rgba(255,140,0,0.2)", color: "#ff8c00" }}>
            {dismantleResult}
          </div>
        )}
        {transmuteResult && (
          <div className="rounded px-2.5 py-1.5 text-xs font-semibold mb-2" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", color: "#a855f7" }}>
            {transmuteResult}
          </div>
        )}

        {/* Inventory items for dismantle */}
        {(() => {
          const inv = (loggedInUser as any).inventory || [];
          const dismantleItems = inv.filter((i: any) => i.rarity && i.name && (i.instanceId || i.id));
          if (dismantleItems.length === 0) return (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Keine Items im Inventar zum Zerlegen.</p>
          );
          const epicItems = dismantleItems.filter((i: any) => i.rarity === "epic");
          return (
            <div className="space-y-3">
              {/* Dismantle */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Zerlege Items in Essenz + Materialien
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dismantleItems.slice(0, 12).map((item: any) => {
                    const rc = RARITY_COLORS[item.rarity] || "#9ca3af";
                    return (
                      <button key={item.instanceId || item.id} onClick={() => handleDismantle(item.instanceId || item.id)} className="text-xs px-2 py-1 rounded-lg" style={{
                        background: "rgba(255,255,255,0.03)", border: `1px solid ${rc}30`, color: rc,
                      }} title={`Zerlegen: +${item.rarity === "legendary" ? 100 : item.rarity === "epic" ? 40 : item.rarity === "rare" ? 15 : 5} Essenz`}>
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transmute: 3 epics → 1 legendary */}
              {epicItems.length >= 3 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
                  <p className="text-xs mb-1.5" style={{ color: "rgba(168,85,247,0.6)" }}>
                    Transmutation: 3 Epics (gleicher Slot) + 500 Gold = 1 Legendary
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {epicItems.map((item: any) => {
                      const iid = item.instanceId || item.id;
                      const sel = selectedTransmute.includes(iid);
                      return (
                        <button key={iid} onClick={() => {
                          setSelectedTransmute(prev => sel ? prev.filter(x => x !== iid) : prev.length < 3 ? [...prev, iid] : prev);
                        }} className="text-xs px-2 py-1 rounded-lg transition-all" style={{
                          background: sel ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${sel ? "rgba(168,85,247,0.5)" : "rgba(168,85,247,0.15)"}`,
                          color: sel ? "#c084fc" : "#a855f7",
                        }}>
                          {sel ? "\u2713 " : ""}{item.name}
                          <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.2)", fontSize: 9 }}>{item.slot}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedTransmute.length === 3 && (
                    <button onClick={handleTransmute} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{
                      background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.4)",
                    }}>
                      Transmutieren (500 Gold)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ─── NPC Popout Modal ────────────────────────────────────────────────── */}
      {selectedNpc && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
          onClick={e => { if (e.target === e.currentTarget) { setSelectedNpc(null); setCraftResult(null); } }}
        >
          <div className="relative w-full max-w-lg rounded-xl overflow-hidden" style={{ background: "#141418", border: `1px solid ${selectedNpc.color}30`, maxHeight: "85vh", overflowY: "auto" }}>
            {/* Close */}
            <button onClick={() => { setSelectedNpc(null); setCraftResult(null); }} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              <span className="text-white text-sm">&#10005;</span>
            </button>

            {/* NPC Header */}
            <div className="p-5 pb-3" style={{ background: `linear-gradient(180deg, ${selectedNpc.color}12 0%, transparent 100%)` }}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `2px solid ${selectedNpc.color}50` }}>
                  <img src={selectedNpc.npcPortrait} alt="" width={64} height={64} style={{ imageRendering: "smooth", width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: selectedNpc.color }}>{selectedNpc.npcName}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{selectedNpc.name} &middot; Level {selectedNpc.playerLevel}/{selectedNpc.maxLevel}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-24 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full" style={{ background: selectedNpc.color, width: `${selectedNpc.nextLevelXp ? Math.min(100, (selectedNpc.playerXp / selectedNpc.nextLevelXp) * 100) : 100}%` }} />
                    </div>
                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{selectedNpc.playerXp}/{selectedNpc.nextLevelXp || "MAX"}</span>
                  </div>
                </div>
              </div>
              {/* Speech bubble */}
              <div className="mt-3 px-3 py-2 rounded-lg text-xs italic" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", borderLeft: `3px solid ${selectedNpc.color}40` }}>
                &ldquo;{selectedNpc.npcGreeting}&rdquo;
              </div>
            </div>

            {/* Slot selector for Schmied/Verzauberer */}
            {(selectedNpc.id === "schmied" || selectedNpc.id === "verzauberer") && (
              <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Ziel-Slot</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(SLOT_LABELS).map(([slot, label]) => {
                    const hasGear = !!(equippedSlots[slot] && typeof equippedSlots[slot] === "object");
                    return (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className="text-xs px-2.5 py-1 rounded-lg transition-all"
                        style={{
                          background: selectedSlot === slot ? `${selectedNpc.color}20` : "rgba(255,255,255,0.04)",
                          color: selectedSlot === slot ? selectedNpc.color : hasGear ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
                          border: `1px solid ${selectedSlot === slot ? `${selectedNpc.color}40` : "rgba(255,255,255,0.06)"}`,
                          opacity: hasGear ? 1 : 0.4,
                        }}
                      >
                        {label}
                        {hasGear && " \u2713"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recipes */}
            <div className="px-5 py-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Rezepte</p>
              {recipes.filter(r => r.profession === selectedNpc.id).map(recipe => {
                const canAfford = (() => {
                  const gold = loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0;
                  if (recipe.cost?.gold && gold < recipe.cost.gold) return false;
                  for (const [matId, amt] of Object.entries(recipe.materials || {})) {
                    if ((materials[matId] || 0) < amt) return false;
                  }
                  return true;
                })();
                const meetsLevel = recipe.canCraft;
                const canDo = canAfford && meetsLevel;

                return (
                  <div key={recipe.id} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: meetsLevel ? "#e8e8e8" : "rgba(255,255,255,0.3)" }}>{recipe.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{recipe.desc}</p>
                        {!meetsLevel && (
                          <p className="text-xs mt-1" style={{ color: "#f44" }}>Benötigt {selectedNpc.name} Lv.{recipe.reqProfLevel}</p>
                        )}
                      </div>
                      <button
                        onClick={() => canDo && handleCraft(recipe.id)}
                        disabled={!canDo || crafting}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-all"
                        style={{
                          background: canDo ? `${selectedNpc.color}20` : "rgba(255,255,255,0.03)",
                          color: canDo ? selectedNpc.color : "rgba(255,255,255,0.2)",
                          border: `1px solid ${canDo ? `${selectedNpc.color}40` : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        {crafting ? "..." : "Craften"}
                      </button>
                    </div>
                    {/* Cost display */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {recipe.cost?.gold && (
                        <span className="text-xs flex items-center gap-1" style={{ color: (loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0) >= recipe.cost.gold ? "#f59e0b" : "#f44" }}>
                          <img src="/images/icons/currency-gold.png" alt="" width={14} height={14} style={{ imageRendering: "smooth" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          {recipe.cost.gold}
                        </span>
                      )}
                      {Object.entries(recipe.materials || {}).map(([matId, amt]) => {
                        const mat = materialDefs.find(m => m.id === matId);
                        const has = (materials[matId] || 0) >= (amt as number);
                        return (
                          <span key={matId} className="text-xs flex items-center gap-1" style={{ color: has ? RARITY_COLORS[mat?.rarity || "common"] : "#f44" }}>
                            <img src={mat?.icon || ""} alt="" width={14} height={14} style={{ imageRendering: "smooth" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            {materials[matId] || 0}/{amt as number} {mat?.name || matId}
                          </span>
                        );
                      })}
                      {recipe.cooldownMinutes > 0 && (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>CD: {recipe.cooldownMinutes >= 60 ? `${Math.floor(recipe.cooldownMinutes / 60)}h` : `${recipe.cooldownMinutes}m`}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Craft result toast */}
            {craftResult && (
              <div className="mx-5 mb-4 px-3 py-2 rounded-lg text-xs font-semibold text-center" style={{ background: `${selectedNpc.color}15`, color: selectedNpc.color, border: `1px solid ${selectedNpc.color}30` }}>
                {craftResult}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
