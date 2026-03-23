"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useDashboard } from "@/app/DashboardContext";

import { useModalBehavior } from "@/components/ModalPortal";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";

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

interface Recipe {
  id: string;
  profession: string;
  name: string;
  desc: string;
  reqProfLevel: number;
  xpGain?: number;
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

interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  desc: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface InventoryItem { instanceId?: string; id: string; name: string; rarity: string; slot?: string; [key: string]: any; }

const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
  unique: "#e6cc80",
};

const RARITY_ORDER = ["legendary", "epic", "rare", "uncommon", "common"];
const RARITY_LABELS: Record<string, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

const ESSENZ_TABLE: Record<string, number> = { common: 2, uncommon: 5, rare: 15, epic: 40, legendary: 100 };

// ─── Slot labels ────────────────────────────────────────────────────────────
const SLOT_LABELS: Record<string, string> = {
  weapon: "Weapon",
  shield: "Shield",
  helm: "Helm",
  armor: "Armor",
  amulet: "Amulet",
  boots: "Boots",
};

// ─── Synergy hints (profession pairing suggestions) ─────────────────────────
const SYNERGY_HINTS: Record<string, { partner: string; label: string }> = {
  schmied: { partner: "verzauberer", label: "Gear Mastery" },
  verzauberer: { partner: "schmied", label: "Gear Mastery" },
  schneider: { partner: "verzauberer", label: "Arcane Mastery" },
  alchemist: { partner: "koch", label: "Sustenance" },
  koch: { partner: "alchemist", label: "Sustenance" },
};

// ─── Skill-up color labels ──────────────────────────────────────────────────
const SKILL_UP_COLORS: Record<string, { color: string; label: string }> = {
  orange: { color: "#f97316", label: "Guaranteed XP" },
  yellow: { color: "#eab308", label: "Likely XP" },
  green: { color: "#22c55e", label: "Rare XP" },
  gray: { color: "#6b7280", label: "No XP" },
};

// ─── NPC location metadata ───────────────────────────────────────────────────
const NPC_LOCATIONS: Record<string, { label: string; color: string; desc: string }> = {
  schmied: { label: "Deepforge", color: "#f59e0b", desc: "Heavy armor crafting, salvage" },
  schneider: { label: "Webstube", color: "#c084fc", desc: "Cloth armor crafting" },
  alchemist: { label: "Alchemist Lab", color: "#22c55e", desc: "Potions, elixirs & transmutation" },
  koch: { label: "Guild Kitchen", color: "#e87b35", desc: "Meals with XP/Gold buffs" },
  verzauberer: { label: "Arcanum", color: "#a78bfa", desc: "Enchantments & stat rerolling" },
};

// ─── Workshop tool tiers ─────────────────────────────────────────────────────
const WORKSHOP_TIERS = [
  { id: "worn", name: "Worn Tools", tier: 0, xpBonus: 0, cost: 0, currency: "gold", desc: "No bonus", icon: "/images/icons/tools-worn.png" },
  { id: "sturdy", name: "Sturdy Tools", tier: 1, xpBonus: 2, cost: 250, currency: "gold", desc: "+2% XP on all quests", icon: "/images/icons/tools-sturdy.png" },
  { id: "masterwork", name: "Masterwork Tools", tier: 2, xpBonus: 4, cost: 750, currency: "gold", desc: "+4% XP on all quests", icon: "/images/icons/tools-masterwork.png" },
  { id: "legendary", name: "Legendary Tools", tier: 3, xpBonus: 7, cost: 2000, currency: "gold", desc: "+7% XP on all quests", icon: "/images/icons/tools-legendary.png" },
  { id: "mythic", name: "Mythic Forge", tier: 4, xpBonus: 10, cost: 5000, currency: "gold", desc: "+10% XP on all quests", icon: "/images/icons/tools-mythic.png" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; };

function getUserInventory(user: unknown): InventoryItem[] {
  return ((user as Record<string, unknown>).inventory as InventoryItem[] | undefined) || [];
}

// ─── ForgeView Component ────────────────────────────────────────────────────
export default function ForgeView({ onRefresh, onNavigate }: { onRefresh?: () => void; onNavigate?: (tab: string) => void }) {
  const { playerName, reviewApiKey, loggedInUser } = useDashboard();
  const [professions, setProfessions] = useState<ProfessionDef[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [materials, setMaterials] = useState<Record<string, number>>({});
  const [materialDefs, setMaterialDefs] = useState<MaterialDef[]>([]);
  const [currencies, setCurrencies] = useState<Record<string, number>>({});
  const [maxProfSlots, setMaxProfSlots] = useState(2);
  const [selectedNpc, setSelectedNpc] = useState<ProfessionDef | null>(null);
  const [craftResult, setCraftResult] = useState<string | null>(null);
  const [crafting, setCrafting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("weapon");
  const [dismantleResult, setDismantleResult] = useState<{ message: string; essenz?: number; materials?: { id: string; name: string; amount: number }[] } | null>(null);
  const [transmuteResult, setTransmuteResult] = useState<string | null>(null);
  const [selectedTransmute, setSelectedTransmute] = useState<string[]>([]);
  const [npcModalTab, setNpcModalTab] = useState<"recipes" | "schmiedekunst" | "transmutation" | "enchanting">("recipes");
  // infoOpen state removed — info now shown via hover tooltip on header
  const [choosingProf, setChoosingProf] = useState(false);
  const [confirmProf, setConfirmProf] = useState<ProfessionDef | null>(null);
  const [dailyBonusAvailable, setDailyBonusAvailable] = useState(false);
  const [craftCount, setCraftCount] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [buyingTool, setBuyingTool] = useState<string | null>(null);
  const [slotAffixRanges, setSlotAffixRanges] = useState<Record<string, { primary: { stat: string; min: number; max: number }[]; minor: { stat: string; min: number; max: number }[]; currentStats: Record<string, number>; itemName: string; rarity: string }>>({});
  const [workshopUpgrades, setWorkshopUpgrades] = useState<{ id: string; name: string; desc: string; icon: string; category: string; currentTier: number; maxTier: number; currentValue: number; nextTier: { tier: number; cost: number; currency: string; value: number; label: string } | null }[]>([]);
  const [buyingUpgrade, setBuyingUpgrade] = useState<string | null>(null);
  // Enchanting (D3-style reroll) state
  const [enchantSlot, setEnchantSlot] = useState<string>("weapon");
  const [enchantStat, setEnchantStat] = useState<string | null>(null);
  const [enchantOptions, setEnchantOptions] = useState<{ label: string; value: number; index: number }[] | null>(null);
  const [enchantCost, setEnchantCost] = useState<{ gold: number; essenz: number } | null>(null);
  const [enchantLoading, setEnchantLoading] = useState(false);
  const [enchantResult, setEnchantResult] = useState<string | null>(null);

  // Close callbacks for modal behavior hooks
  const closeNpcModal = useCallback(() => {
    setSelectedNpc(null); setCraftResult(null); setDismantleResult(null); setTransmuteResult(null); setSelectedTransmute([]);
    setEnchantSlot("weapon"); setEnchantStat(null); setEnchantOptions(null); setEnchantCost(null); setEnchantResult(null);
  }, []);
  const closeConfirmProf = useCallback(() => setConfirmProf(null), []);
  const closeConfirmAction = useCallback(() => setConfirmAction(null), []);

  // Consistent modal behavior: ESC to close + body scroll lock
  useModalBehavior(!!selectedNpc, closeNpcModal);
  useModalBehavior(!!confirmProf, closeConfirmProf);
  useModalBehavior(!!confirmAction, closeConfirmAction);

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
        if (data.currencies) setCurrencies(data.currencies);
        if (data.dailyBonus) setDailyBonusAvailable(data.dailyBonus.dailyBonusAvailable ?? false);
        if (data.maxProfSlots != null) setMaxProfSlots(data.maxProfSlots);
        if (data.slotAffixRanges) setSlotAffixRanges(data.slotAffixRanges);
      }
    } catch { /* ignore */ }
    // Fetch workshop upgrades
    try {
      const wr = await fetch(`/api/shop/workshop?player=${encodeURIComponent(playerName)}`, { signal: AbortSignal.timeout(3000) });
      if (wr.ok) {
        const wData = await wr.json();
        setWorkshopUpgrades(wData.workshopUpgrades || []);
      }
    } catch { /* ignore */ }
  }, [playerName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keep selectedNpc in sync with refreshed professions data
  useEffect(() => {
    if (selectedNpc) {
      const updated = professions.find(p => p.id === selectedNpc.id);
      if (updated && (updated.playerXp !== selectedNpc.playerXp || updated.playerLevel !== selectedNpc.playerLevel || updated.rank !== selectedNpc.rank)) {
        setSelectedNpc(updated);
      }
    }
  }, [professions, selectedNpc]);

  // Reset craft count when switching NPC, tab, or slot
  useEffect(() => { setCraftCount(1); }, [selectedNpc, npcModalTab, selectedSlot]);

  const handleCraft = async (recipeId: string, count = 1) => {
    if (crafting || !reviewApiKey) return;
    setCrafting(true);
    setCraftResult(null);
    try {
      const body: Record<string, unknown> = { recipeId, targetSlot: selectedSlot, count };
      const r = await fetch("/api/professions/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok) {
        let msg = data.message || "Success!";
        if (data.xpGained) msg += ` (+${data.xpGained} XP${data.dailyBonusUsed ? " \u2606 Daily Bonus!" : ""})`;
        if (data.profLevelUp) msg += " LEVEL UP!";
        setCraftResult(msg);
        setCraftCount(1);
        fetchData();
        onRefresh?.();
      } else {
        setCraftResult(data.error || "Crafting failed");
      }
    } catch {
      setCraftResult("Network error");
    }
    setCrafting(false);
    // Auto-scroll craft result into view, then auto-dismiss after 5s
    requestAnimationFrame(() => {
      document.getElementById("forge-craft-result")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    setTimeout(() => setCraftResult(null), 5000);
  };

  const handleLearnRecipe = async (recipeId: string) => {
    if (crafting || !reviewApiKey) return;
    setCrafting(true);
    setCraftResult(null);
    try {
      const r = await fetch("/api/professions/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ recipeId }),
      });
      const data = await r.json();
      if (r.ok) {
        setCraftResult(`Learned: ${data.recipe} (${data.profession}) — ${data.goldSpent}g`);
        fetchData();
        onRefresh?.();
      } else {
        setCraftResult(data.error || "Failed to learn recipe");
      }
    } catch {
      setCraftResult("Network error");
    }
    setCrafting(false);
  };

  const handleDismantle = async (itemId: string, itemName?: string, itemRarity?: string) => {
    if (!reviewApiKey) return;
    const needsConfirm = ["rare", "epic", "legendary"].includes(itemRarity || "");
    if (needsConfirm) {
      setConfirmAction({
        message: `Dismantle ${itemRarity?.toUpperCase()} "${itemName || "item"}"?\n\nThis cannot be undone.`,
        onConfirm: () => { setConfirmAction(null); doDismantle(itemId); },
      });
      return;
    }
    doDismantle(itemId);
  };
  const doDismantle = async (itemId: string) => {
    if (!reviewApiKey) return;
    try {
      const r = await fetch("/api/schmiedekunst/dismantle", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ inventoryItemId: itemId }),
      });
      const data = await r.json();
      if (r.ok && data.essenzGained != null) {
        setDismantleResult({
          message: data.message,
          essenz: data.essenzGained,
          materials: Array.isArray(data.materialsGained) ? data.materialsGained : Object.entries(data.materialsGained || {}).map(([id, amt]) => {
            const def = materialDefs.find(m => m.id === id);
            return { id, name: def?.name || id, amount: amt as number };
          }),
        });
      } else {
        setDismantleResult({ message: data.error || "Error" });
      }
      setTimeout(() => setDismantleResult(null), 5000);
      fetchData();
      onRefresh?.();
    } catch { setDismantleResult({ message: "Network error" }); }
  };

  const handleDismantleAll = async (rarity: string, count?: number) => {
    if (!reviewApiKey) return;
    setConfirmAction({
      message: `Salvage ALL ${count || ""} ${rarity.toUpperCase()} items?\n\nAll items of this rarity will be dismantled. This cannot be undone.`,
      onConfirm: () => { setConfirmAction(null); doDismantleAll(rarity); },
    });
  };
  const doDismantleAll = async (rarity: string) => {
    if (!reviewApiKey) return;
    try {
      const r = await fetch("/api/schmiedekunst/dismantle-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ rarity }),
      });
      const data = await r.json();
      if (r.ok && data.totalEssenz != null) {
        setDismantleResult({
          message: data.message,
          essenz: data.totalEssenz,
          materials: Object.entries(data.materialsGained || {}).map(([id, amt]) => {
            const def = materialDefs.find(m => m.id === id);
            return { id, name: def?.name || id, amount: amt as number };
          }),
        });
      } else {
        setDismantleResult({ message: data.error || "Error" });
      }
      setTimeout(() => setDismantleResult(null), 6000);
      fetchData();
      onRefresh?.();
    } catch { setDismantleResult({ message: "Network error" }); }
  };

  const handleTransmute = async () => {
    if (!reviewApiKey || selectedTransmute.length !== 3) return;
    setConfirmAction({
      message: "Transmute 3 Epic items + 500 Gold into 1 Legendary?\n\nThe 3 selected items will be destroyed. This cannot be undone.",
      onConfirm: () => { setConfirmAction(null); doTransmute(); },
    });
  };
  const doTransmute = async () => {
    if (!reviewApiKey) return;
    try {
      const r = await fetch("/api/schmiedekunst/transmute", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ itemIds: selectedTransmute }),
      });
      const data = await r.json();
      setTransmuteResult(data.message || data.error || "Error");
      setSelectedTransmute([]);
      setTimeout(() => setTransmuteResult(null), 5000);
      fetchData();
      onRefresh?.();
    } catch { setTransmuteResult("Network error"); }
  };

  const handleChooseProfession = async (profId: string) => {
    if (!reviewApiKey || choosingProf) return;
    setChoosingProf(true);
    try {
      const r = await fetch("/api/professions/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ professionId: profId }),
      });
      const data = await r.json();
      if (r.ok) {
        setCraftResult(data.message || "Profession chosen!");
        fetchData();
        onRefresh?.();
      } else {
        setCraftResult(data.error || "Error");
      }
    } catch { setCraftResult("Network error"); }
    setChoosingProf(false);
  };

  const handleDropProfession = async (profId: string, profName: string) => {
    if (!reviewApiKey) return;
    setConfirmAction({
      message: `Drop ${profName}?\n\nCosts 200 Essenz. All progress (level & XP) will be lost permanently.`,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          const r = await fetch("/api/professions/switch", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
            body: JSON.stringify({ dropProfession: profId }),
          });
          const data = await r.json();
          if (r.ok) {
            closeNpcModal();
            fetchData();
            onRefresh?.();
          } else {
            setCraftResult(data.error || "Failed to drop profession");
          }
        } catch { setCraftResult("Network error"); }
      },
    });
  };

  // Compute materials used by each profession's recipes
  const profMaterialIds = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const r of recipes) {
      if (!map[r.profession]) map[r.profession] = new Set();
      for (const matId of Object.keys(r.materials || {})) {
        map[r.profession].add(matId);
      }
    }
    return map;
  }, [recipes]);

  if (!loggedIn || !loggedInUser) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <span className="text-4xl" style={{ opacity: 0.3 }}>&#9876;</span>
        <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{"Artisan's Quarter"}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{"Sign in to enter the Artisan's Quarter."}</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const equippedSlots = (loggedInUser.equipment || {}) as Record<string, any>;
  const chosenCount = professions.filter(p => p.chosen).length;

  return (
    <div className="space-y-4 tab-content-enter">
      {/* ─── Header with currencies + info ─────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <Tip k="artisans_quarter" heading><span className="text-base font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>{"Artisan's Quarter"}</span></Tip>
          <p className="text-xs italic mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Vier Meister. Vier Disziplinen. Was du hier schmiedest, hallt in Ewigkeit wider.</p>
        </div>
        <div className="flex items-center gap-4 ml-auto text-sm">
          <Tip k="professions"><span className="font-mono font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>{chosenCount}/{maxProfSlots} Professions</span></Tip>
          {dailyBonusAvailable && (
            <TipCustom title="Daily Bonus" icon="⚡" accent="#facc15" body={<p>Your first craft today gives <strong>2x profession XP</strong>. Resets daily at midnight.</p>}>
              <span className="px-2 py-1 rounded font-bold text-xs cursor-help" style={{ background: "rgba(250,204,21,0.12)", color: "#facc15", border: "1px solid rgba(250,204,21,0.25)" }}>
                2x XP
              </span>
            </TipCustom>
          )}
          <Tip k="gold"><span className="flex items-center gap-1.5" style={{ color: "#f59e0b" }}>
            <img src="/images/icons/currency-gold.png" alt="" width={24} height={24} style={{ imageRendering: "auto" }} onError={hideOnError} />
            <span className="font-mono font-bold">{currencies.gold ?? loggedInUser.currencies?.gold ?? loggedInUser.gold ?? 0}</span>
          </span></Tip>
          <Tip k="essenz"><span className="flex items-center gap-1.5" style={{ color: "#ff8c00" }}>
            <img src="/images/icons/currency-essenz.png" alt="" width={24} height={24} style={{ imageRendering: "auto" }} onError={hideOnError} />
            <span className="font-mono font-bold">{currencies.essenz ?? loggedInUser.currencies?.essenz ?? 0}</span>
          </span></Tip>
          {onNavigate && (
            <button onClick={() => onNavigate("character")} className="cross-nav-link text-sm px-3 py-1 rounded" style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Character &rarr;
            </button>
          )}
        </div>
      </div>

      {/* ─── All Materials Bar ─────────────────────────────────────────── */}
      {Object.keys(materials).length > 0 && (
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Tip k="materials" heading><p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Materials</p></Tip>
          <div className="flex flex-wrap gap-2">
            {materialDefs.filter(m => materials[m.id]).map(m => (
              <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${RARITY_COLORS[m.rarity] || "#555"}30` }} title={m.desc}>
                <img src={m.icon} alt="" width={16} height={16} style={{ imageRendering: "auto" }} onError={hideOnError} />
                <span className="text-xs" style={{ color: RARITY_COLORS[m.rarity] || "#ccc" }}>{m.name}</span>
                <span className="text-xs font-mono font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>x{materials[m.id]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── NPC Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {professions.map(prof => {
        const locked = !prof.unlocked;
        const loc = NPC_LOCATIONS[prof.id] || { label: prof.name, color: prof.color, desc: "" };
        const isChosen = prof.chosen;
        const canChoose = prof.canChoose && !isChosen && !locked;
        const profMats = profMaterialIds[prof.id];
        const relevantMats = profMats ? materialDefs.filter(m => profMats.has(m.id) && materials[m.id]) : [];
        const rankGlow = prof.rank === "Master" ? `0 0 12px ${prof.color}20` : prof.rank === "Artisan" ? `0 0 8px ${prof.color}15` : prof.rank === "Expert" ? `0 0 6px ${prof.color}10` : "none";
        const synergy = SYNERGY_HINTS[prof.id];
        const synergyChosen = synergy ? professions.find(p => p.id === synergy.partner && p.chosen) : null;

        return (
          <div key={prof.id} className={`rounded-xl overflow-hidden npc-rank-glow ${locked ? "" : "npc-card-hover"}`} data-rank={prof.rank || "Novice"} style={{ background: locked ? "rgba(255,255,255,0.02)" : `${prof.color}06`, border: `1px solid ${locked ? "rgba(255,255,255,0.05)" : `${prof.color}25`}`, opacity: locked ? 0.5 : 1, boxShadow: locked ? "none" : rankGlow }}>
            {/* Location header */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <Tip k="professions" heading><span className="text-sm font-semibold uppercase tracking-widest" style={{ color: `${loc.color}70` }}>{loc.label}</span></Tip>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>{loc.desc}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {isChosen && <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: `${prof.color}18`, color: prof.color }}>Active</span>}
                  {!isChosen && !prof.canChoose && !locked && <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(255,68,68,0.1)", color: "#f44" }}>{chosenCount}/{maxProfSlots}</span>}
                </div>
              </div>
            </div>

            {/* NPC card — clickable to open modal */}
            <button
              onClick={() => { if (!locked) { setSelectedNpc(prof); setNpcModalTab("recipes"); setCraftResult(null); setDismantleResult(null); setTransmuteResult(null); setSelectedTransmute([]); } }}
              disabled={locked}
              title={locked ? `Requires Player Level ${prof.unlockCondition?.value || "?"}` : `Open ${prof.npcName}'s workshop`}
              className="w-full p-4 pt-2 text-left"
              style={{ cursor: locked ? "not-allowed" : "pointer" }}
            >
              <div className="flex items-center gap-3 mb-2">
                {/* NPC portrait — border evolves with rank */}
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{ background: `${prof.color}12`, border: `2px solid ${prof.rankColor || prof.color}${prof.playerLevel >= 7 ? "80" : prof.playerLevel >= 3 ? "50" : "30"}` }}>
                  <img src={prof.npcPortrait} alt={prof.npcName} width={56} height={56} style={{ imageRendering: "auto", width: "100%", height: "100%", objectFit: "cover" }} onError={hideOnError} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold" style={{ color: prof.color }}>{prof.npcName}</p>
                    {prof.rank && prof.rank !== "Novice" && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: `${prof.rankColor}15`, color: prof.rankColor, border: `1px solid ${prof.rankColor}30` }}>
                        {prof.rank}
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{prof.description}</p>
                  {synergy && (() => {
                    const partnerProf = professions.find(p => p.id === synergy.partner);
                    if (isChosen && synergyChosen) {
                      return <p className="text-xs mt-0.5" style={{ color: `${prof.color}80` }}>&#9733; {synergy.label} synergy active with {partnerProf?.npcName || synergy.partner}</p>;
                    }
                    if (!isChosen && canChoose && partnerProf) {
                      return <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Pairs well with {partnerProf.name} ({synergy.label})</p>;
                    }
                    if (isChosen && !synergyChosen && partnerProf) {
                      return <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Tip: Add {partnerProf.name} for {synergy.label} synergy</p>;
                    }
                    return null;
                  })()}
                </div>
              </div>

              {prof.unlocked && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all" style={{ background: `linear-gradient(90deg, ${prof.color}, ${prof.rankColor || prof.color})`, width: `${prof.nextLevelXp ? Math.min(100, (prof.playerXp / prof.nextLevelXp) * 100) : 100}%` }} />
                  </div>
                  <span className="text-sm font-mono font-semibold" style={{ color: prof.rankColor || prof.color }}>Lv.{prof.playerLevel}</span>
                </div>
              )}
              {prof.masteryBonus && (prof.masteryActive ? (
                <p className="text-xs mt-1" style={{ color: "#facc15" }} title={prof.masteryBonus.desc}>&#9733; Mastery: {prof.masteryBonus.desc}</p>
              ) : prof.unlocked && prof.playerLevel > 0 ? (
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.15)" }} title={`Unlocks at Level 8: ${prof.masteryBonus.desc}`}>&#9734; Mastery (Lv.8): {prof.masteryBonus.desc}</p>
              ) : null)}
              {isChosen && prof.gatheringAffinity && prof.gatheringAffinity.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Gathering: {prof.gatheringAffinity.map(id => materialDefs.find(m => m.id === id)?.name || id).join(", ")}
                </p>
              )}
              {locked && (
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Requires Player Level {prof.unlockCondition?.value || "?"}
                </p>
              )}
            </button>

            {canChoose && (
              <div className="px-4 pb-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmProf(prof); }}
                  disabled={choosingProf}
                  title={choosingProf ? "Choosing profession..." : `Choose ${prof.name}`}
                  className="forge-btn w-full text-xs font-semibold py-2 rounded-lg"
                  style={{ background: `${prof.color}15`, color: prof.color, border: `1px solid ${prof.color}35`, cursor: choosingProf ? "not-allowed" : "pointer" }}
                >
                  {choosingProf ? "..." : "Choose Profession"}
                </button>
              </div>
            )}

            {relevantMats.length > 0 && !locked && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {relevantMats.slice(0, 6).map(m => (
                  <span key={m.id} className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", color: `${RARITY_COLORS[m.rarity]}90` }}>
                    <img src={m.icon} alt="" width={12} height={12} style={{ imageRendering: "auto" }} onError={hideOnError} />
                    x{materials[m.id]}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      </div>

      {/* ─── Workshop Tools — permanent upgrades ────────────────────────────── */}
      {(() => {
        const currentGear = loggedInUser.gear || "worn";
        const currentTierNum = WORKSHOP_TIERS.find(t => t.id === currentGear)?.tier ?? 0;
        const gold = currencies.gold ?? loggedInUser.currencies?.gold ?? loggedInUser.gold ?? 0;
        const essenz = currencies.essenz ?? loggedInUser.currencies?.essenz ?? 0;

        return (
          <div className="space-y-2">
            <Tip k="workshop_upgrades" heading><p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "rgba(99,102,241,0.6)", cursor: "help" }}>Workshop Tools</p></Tip>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>Permanent XP upgrades. Each tier must be unlocked sequentially.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WORKSHOP_TIERS.filter(t => t.tier > 0).map(gear => {
                const owned = gear.tier <= currentTierNum;
                const isNext = gear.tier === currentTierNum + 1;
                const canAfford = gear.currency === "gold" ? gold >= gear.cost : essenz >= gear.cost;
                const canBuy = isNext && canAfford;
                return (
                  <div key={gear.id} className="flex items-center gap-3 p-3 rounded-xl" style={{
                    background: owned ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${owned ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
                    opacity: owned || isNext ? 1 : 0.35,
                  }}>
                    <img src={gear.icon} alt="" className="w-12 h-12 flex-shrink-0" style={{ imageRendering: "auto" }} onError={hideOnError} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: owned ? "#818cf8" : "#e8e8e8" }}>
                        {gear.name} {owned && <span style={{ color: "rgba(129,140,248,0.5)" }}>✓</span>}
                      </p>
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>{gear.desc}</p>
                    </div>
                    {!owned && (
                      <button
                        onClick={async () => {
                          if (!canBuy || !reviewApiKey || buyingTool) return;
                          setBuyingTool(gear.id);
                          try {
                            const r = await fetch("/api/shop/gear/buy", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                              body: JSON.stringify({ gearId: gear.id }),
                            });
                            if (r.ok) { onRefresh?.(); fetchData(); setCraftResult("Tool purchased!"); }
                            else { const d = await r.json().catch(() => ({})); setCraftResult(d.error || "Purchase failed"); }
                          } catch { setCraftResult("Network error"); }
                          setBuyingTool(null);
                        }}
                        disabled={!canBuy || buyingTool === gear.id}
                        className="forge-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                        title={!canBuy ? "Not enough gold" : `Buy for ${gear.cost}g`}
                        style={{
                          background: canBuy ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)",
                          color: canBuy ? "#818cf8" : "rgba(255,255,255,0.2)",
                          border: `1px solid ${canBuy ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        {buyingTool === gear.id ? "..." : (<>
                          <img src={gear.currency === "essenz" ? "/images/icons/currency-essenz.png" : "/images/icons/currency-gold.png"} alt="" width={18} height={18} style={{ imageRendering: "auto", display: "inline", verticalAlign: "middle", marginRight: 3 }} onError={hideOnError} />
                          {gear.cost}
                        </>)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ─── Workshop Upgrades — permanent bonuses ────────────────────────── */}
      {workshopUpgrades.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "rgba(168,85,247,0.6)" }}>Workshop Upgrades</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>Permanent bonuses. Each tier must be unlocked sequentially.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {workshopUpgrades.map(up => {
              const maxed = up.currentTier >= up.maxTier;
              const next = up.nextTier;
              const gold = currencies.gold ?? loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0;
              const canAfford = next ? gold >= next.cost : false;
              return (
                <div key={up.id} className="flex items-center gap-3 p-3 rounded-xl" style={{
                  background: maxed ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${maxed ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}>
                  <img src={up.icon} alt="" className="w-12 h-12 flex-shrink-0" style={{ imageRendering: "auto" }} onError={hideOnError} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: maxed ? "#a78bfa" : "#e8e8e8" }}>
                      {up.name} {maxed && <span style={{ color: "rgba(168,85,247,0.5)" }}>✓ MAX</span>}
                    </p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {maxed ? `+${up.currentValue}% active` : next?.label || up.desc}
                    </p>
                    {!maxed && up.currentTier > 0 && (
                      <p className="text-xs" style={{ color: "rgba(168,85,247,0.4)" }}>Current: +{up.currentValue}% (Tier {up.currentTier}/{up.maxTier})</p>
                    )}
                  </div>
                  {!maxed && next && (
                    <button
                      onClick={async () => {
                        if (!canAfford || !reviewApiKey || buyingUpgrade) return;
                        setBuyingUpgrade(up.id);
                        try {
                          const r = await fetch("/api/shop/workshop/buy", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                            body: JSON.stringify({ upgradeId: up.id }),
                          });
                          if (r.ok) { onRefresh?.(); fetchData(); setCraftResult("Upgrade purchased!"); }
                          else { const d = await r.json().catch(() => ({})); setCraftResult(d.error || "Upgrade failed"); }
                        } catch { setCraftResult("Network error"); }
                        setBuyingUpgrade(null);
                      }}
                      disabled={!canAfford || buyingUpgrade === up.id}
                      className="forge-btn text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0"
                      style={{
                        background: canAfford ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.03)",
                        color: canAfford ? "#a78bfa" : "rgba(255,255,255,0.2)",
                        border: `1px solid ${canAfford ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.06)"}`,
                        cursor: canAfford ? "pointer" : "not-allowed",
                      }}
                      title={canAfford ? `Buy for ${next.cost} gold` : `Insufficient gold (need ${next.cost})`}
                    >
                      {buyingUpgrade === up.id ? "..." : (<>
                        <img src="/images/icons/currency-gold.png" alt="" width={18} height={18} style={{ imageRendering: "auto", display: "inline", verticalAlign: "middle", marginRight: 3 }} onError={hideOnError} />
                        {next.cost}
                      </>)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── NPC Popout Modal ────────────────────────────────────────────────── */}
      {selectedNpc && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
          onClick={e => { if (e.target === e.currentTarget) closeNpcModal(); }}
        >
          <div className="relative w-full max-w-xl rounded-xl" style={{ background: "#141418", border: `1px solid ${selectedNpc.color}30`, maxHeight: "85vh", overflowY: "auto", overflowX: "hidden" }}>
            {/* Close */}
            <button onClick={closeNpcModal} className="forge-btn absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              <span className="text-white text-sm">&#10005;</span>
            </button>

            {/* NPC Header */}
            <div className="p-5 pb-3" style={{ background: `linear-gradient(180deg, ${selectedNpc.color}12 0%, transparent 100%)` }}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `2px solid ${selectedNpc.color}50` }}>
                  <img src={selectedNpc.npcPortrait} alt="" width={64} height={64} style={{ imageRendering: "auto", width: "100%", height: "100%", objectFit: "cover" }} onError={hideOnError} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold" style={{ color: selectedNpc.color }}>{selectedNpc.npcName}</p>
                    {selectedNpc.rank && selectedNpc.rank !== "Novice" && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: `${selectedNpc.rankColor}15`, color: selectedNpc.rankColor, border: `1px solid ${selectedNpc.rankColor}30` }}>{selectedNpc.rank}</span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{selectedNpc.name} &middot; Level {selectedNpc.playerLevel}/{selectedNpc.maxLevel}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-24 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full" style={{ background: selectedNpc.color, width: `${selectedNpc.nextLevelXp ? Math.min(100, (selectedNpc.playerXp / selectedNpc.nextLevelXp) * 100) : 100}%` }} />
                    </div>
                    <span className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{selectedNpc.playerXp}/{selectedNpc.nextLevelXp || "MAX"}</span>
                  </div>
                </div>
              </div>
              {/* Speech bubble + drop profession */}
              <div className="mt-3 flex items-start gap-2">
                <div className="flex-1 px-4 py-2.5 rounded-lg text-sm italic" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", borderLeft: `3px solid ${selectedNpc.color}40` }}>
                  &ldquo;{selectedNpc.npcGreeting}&rdquo;
                </div>
                {selectedNpc.chosen && (
                  <button
                    onClick={() => handleDropProfession(selectedNpc.id, selectedNpc.name)}
                    className="forge-btn text-xs px-2.5 py-2 rounded-lg flex-shrink-0"
                    style={{ color: "rgba(255,68,68,0.5)", border: "1px solid rgba(255,68,68,0.15)" }}
                    title={`Drop ${selectedNpc.name} (costs 200 Essenz, resets all progress)`}
                  >
                    Drop
                  </button>
                )}
              </div>
              {/* Materials available for this profession */}
              {(() => {
                const profMats = profMaterialIds[selectedNpc.id];
                const mats = profMats ? materialDefs.filter(m => profMats.has(m.id)) : [];
                if (mats.length === 0) return null;
                return (
                  <div className="mt-3">
                    <p className="text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>Your materials <span style={{ color: "rgba(255,255,255,0.15)" }}>(earned from quest completions)</span></p>
                    <div className="flex flex-wrap gap-2">
                      {mats.map(m => (
                        <TipCustom key={m.id} title={m.name} icon="🧱" accent={RARITY_COLORS[m.rarity] || "#888"} body={<><p>{m.desc || m.name}</p><p style={{ marginTop: 4, opacity: 0.7 }}>{RARITY_LABELS[m.rarity] || m.rarity} material — drops from {m.rarity} quests</p></>}>
                        <span className="text-sm flex items-center gap-1.5 px-2 py-1 rounded cursor-help" style={{ background: "rgba(255,255,255,0.04)", color: materials[m.id] ? RARITY_COLORS[m.rarity] : "rgba(255,255,255,0.15)" }}>
                          <img src={m.icon} alt="" width={16} height={16} style={{ imageRendering: "auto" }} onError={hideOnError} />
                          {m.name} <strong className="font-mono">x{materials[m.id] || 0}</strong>
                        </span>
                        </TipCustom>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Tab bar */}
            {(() => {
              const tabs: { key: typeof npcModalTab; label: string; color: string }[] = [
                { key: "recipes", label: "Recipes", color: selectedNpc.color },
              ];
              if (selectedNpc.id === "schmied") {
                tabs.push({ key: "schmiedekunst", label: "Salvage", color: "#ff8c00" });
              }
              if (selectedNpc.id === "verzauberer") {
                tabs.push({ key: "enchanting", label: "Enchanting", color: "#a855f7" });
              }
              if (selectedNpc.id === "alchemist") {
                tabs.push({ key: "transmutation", label: "Transmutation", color: "#22c55e" });
              }
              if (tabs.length <= 1) return null;
              return (
                <div className="flex gap-0.5 px-5 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  {tabs.map(t => (
                    <button key={t.key} onClick={() => setNpcModalTab(t.key)} className="forge-btn text-sm font-semibold px-5 py-2.5 rounded-t-lg transition-colors hover:brightness-110" style={{
                      background: npcModalTab === t.key ? `${t.color}12` : "transparent",
                      color: npcModalTab === t.key ? t.color : "rgba(255,255,255,0.25)",
                      borderBottom: npcModalTab === t.key ? `2px solid ${t.color}` : "2px solid transparent",
                      cursor: "pointer",
                    }}>
                      {t.key === "schmiedekunst" ? <Tip k="schmiedekunst">{t.label}</Tip> : t.label}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* ─── Tab: Recipes ──────────────────────────────────────────── */}
            {npcModalTab === "recipes" && (
              <>
                {/* Slot selector for Schmied/Verzauberer */}
                {(selectedNpc.id === "schmied" || selectedNpc.id === "verzauberer") && (
                  <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Target Slot</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(SLOT_LABELS).map(([slot, label]) => {
                        const hasGear = !!(equippedSlots[slot] && typeof equippedSlots[slot] === "object");
                        return (
                          <button
                            key={slot}
                            onClick={() => setSelectedSlot(slot)}
                            className="text-xs px-2.5 py-1 rounded-lg transition-all hover:brightness-125"
                            style={{
                              background: selectedSlot === slot ? `${selectedNpc.color}20` : "rgba(255,255,255,0.04)",
                              color: selectedSlot === slot ? selectedNpc.color : hasGear ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
                              border: `1px solid ${selectedSlot === slot ? `${selectedNpc.color}40` : "rgba(255,255,255,0.06)"}`,
                              opacity: hasGear ? 1 : 0.4,
                              cursor: "pointer",
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

                {/* Recipes list */}
                <div className="px-5 py-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <Tip k="recipes" heading><p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Recipes</p></Tip>
                    <div className="flex items-center gap-3">
                      {Object.entries(SKILL_UP_COLORS).map(([key, sc]) => (
                        <TipCustom key={key} title={`${sc.label} Skill-Up`} icon="📊" accent={sc.color} body={<p>{key === "orange" ? "100% chance to gain XP" : key === "yellow" ? "75% chance to gain XP" : key === "green" ? "25% chance to gain XP" : "0% XP — level up to unlock XP from higher recipes"}</p>}>
                        <span className="flex items-center gap-1 text-xs cursor-help" style={{ color: "rgba(255,255,255,0.3)" }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: sc.color }} />
                          {sc.label}
                        </span>
                        </TipCustom>
                      ))}
                    </div>
                  </div>
                  {recipes.filter(r => r.profession === selectedNpc.id).map(recipe => {
                    const isLearned = recipe.learned !== false;
                    const needsLearn = !isLearned && recipe.source === "trainer" && (recipe.trainerCost ?? 0) > 0;
                    const meetsLevel = recipe.canCraft;
                    const onCooldown = (recipe.cooldownRemaining ?? 0) > 0;
                    const skillUp = SKILL_UP_COLORS[recipe.skillUpColor || "orange"];
                    const isBatchable = recipe.result?.type === "buff" || recipe.result?.type === "streak_shield" || recipe.result?.type === "forge_temp";
                    const effectiveCount = isBatchable ? craftCount : 1;
                    const canAfford = (() => {
                      const gold = currencies.gold ?? loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0;
                      if (recipe.cost?.gold && gold < recipe.cost.gold * effectiveCount) return false;
                      for (const [matId, amt] of Object.entries(recipe.materials || {})) {
                        if ((materials[matId] || 0) < (amt as number) * effectiveCount) return false;
                      }
                      return true;
                    })();
                    // For reroll recipes, check if the equipped item has rerollable stats AND the template has an affix pool
                    const isSlotRecipe = recipe.id === "reinforce_armor" || recipe.id === "enchant_socket" || recipe.id === "upgrade_rarity" || recipe.id === "permanent_enchant" || recipe.id === "sharpen_blade";
                    const slotItem = equippedSlots[selectedSlot];
                    const hasSlotItem = isSlotRecipe ? (slotItem && typeof slotItem === "object") : true;
                    const canDo = isLearned && canAfford && meetsLevel && !onCooldown && hasSlotItem;

                    return (
                      <div key={recipe.id} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: `3px solid ${skillUp?.color || "rgba(255,255,255,0.06)"}` }}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold" style={{ color: meetsLevel ? "#e8e8e8" : "rgba(255,255,255,0.3)" }}>{recipe.name}</p>
                              {/* Skill-up indicator dot */}
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: skillUp?.color || "#6b7280" }} title={skillUp?.label || ""} />
                            </div>
                            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{recipe.desc}</p>
                            {/* Stat preview for slot-targeting recipes */}
                            {meetsLevel && (recipe.id === "reinforce_armor" || recipe.id === "enchant_socket" || recipe.id === "sharpen_blade" || recipe.id === "permanent_enchant") && equippedSlots[selectedSlot] && typeof equippedSlots[selectedSlot] === "object" && (() => {
                              const currentStats = (equippedSlots[selectedSlot] as Record<string, unknown>).stats as Record<string, number> || {};
                              return (
                                <div className="mt-1 rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                                    Current: {Object.entries(currentStats).map(([k, v]) => `${k} +${v}`).join(", ") || "none"}
                                  </p>
                                </div>
                              );
                            })()}
                            {!meetsLevel && (
                              <p className="text-xs mt-1" style={{ color: "#f44" }}>Requires {selectedNpc.name} Lv.{recipe.reqProfLevel}</p>
                            )}
                            {onCooldown && (
                              <p className="text-xs mt-1" style={{ color: "#f97316" }}>
                                Cooldown: {(recipe.cooldownRemaining ?? 0) >= 3600 ? `${Math.floor((recipe.cooldownRemaining ?? 0) / 3600)}h ${Math.floor(((recipe.cooldownRemaining ?? 0) % 3600) / 60)}m` : `${Math.ceil((recipe.cooldownRemaining ?? 0) / 60)}m`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isBatchable && canDo && (
                              <select
                                value={craftCount}
                                onChange={e => setCraftCount(parseInt(e.target.value, 10))}
                                className="text-xs rounded-lg px-1 py-1 font-mono"
                                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", width: 38 }}
                              >
                                {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>x{n}</option>)}
                              </select>
                            )}
                            {needsLearn ? (() => {
                              const playerGold = currencies.gold ?? loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0;
                              const canAfford = playerGold >= (recipe.trainerCost ?? 0);
                              return (
                              <button
                                onClick={() => handleLearnRecipe(recipe.id)}
                                disabled={crafting || !canAfford}
                                className="forge-btn text-sm px-4 py-2 rounded-lg font-semibold"
                                style={{
                                  background: canAfford ? `${selectedNpc.color}15` : "rgba(255,255,255,0.03)",
                                  color: canAfford ? "#facc15" : "rgba(255,255,255,0.2)",
                                  border: canAfford ? "1px solid rgba(250,204,21,0.3)" : "1px solid rgba(255,255,255,0.06)",
                                  cursor: canAfford && !crafting ? "pointer" : "not-allowed",
                                }}
                                title={!canAfford ? `Need ${(recipe.trainerCost ?? 0) - playerGold} more gold` : `Learn from ${selectedNpc.npcName} for ${recipe.trainerCost}g`}
                              >
                                {crafting ? "..." : `Learn (${recipe.trainerCost}g)`}
                              </button>
                              );
                            })() : (
                              <button
                                onClick={() => canDo && handleCraft(recipe.id, effectiveCount)}
                                disabled={!canDo || crafting}
                                className="forge-btn text-sm px-4 py-2 rounded-lg font-semibold"
                                style={{
                                  background: canDo ? `${selectedNpc.color}20` : "rgba(255,255,255,0.03)",
                                  color: canDo ? selectedNpc.color : "rgba(255,255,255,0.2)",
                                  border: `1px solid ${canDo ? `${selectedNpc.color}40` : "rgba(255,255,255,0.06)"}`,
                                  cursor: canDo && !crafting ? "pointer" : "not-allowed",
                                }}
                                title={!canDo ? (!isLearned ? "Recipe not learned" : !meetsLevel ? "Profession level too low" : onCooldown ? `On cooldown (${Math.ceil((recipe.cooldownRemaining ?? 0) / 60)}min left)` : !hasSlotItem ? "No gear equipped in this slot" : !canAfford ? "Not enough materials or gold" : "") : `Craft ${recipe.name}`}
                              >
                                {crafting ? "Crafting\u2026" : onCooldown ? "On Cooldown" : "Craft"}
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Cost display */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {recipe.cost?.gold && (
                            <span className="text-sm flex items-center gap-1" style={{ color: (currencies.gold ?? loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0) >= recipe.cost.gold * effectiveCount ? "#f59e0b" : "#f44" }}>
                              <img src="/images/icons/currency-gold.png" alt="" width={16} height={16} style={{ imageRendering: "auto" }} onError={hideOnError} />
                              {recipe.cost.gold * effectiveCount}{effectiveCount > 1 ? ` (${recipe.cost.gold}x${effectiveCount})` : ""}
                            </span>
                          )}
                          {Object.entries(recipe.materials || {}).map(([matId, amt]) => {
                            const mat = materialDefs.find(m => m.id === matId);
                            const needed = (amt as number) * effectiveCount;
                            const has = (materials[matId] || 0) >= needed;
                            return (
                              <span key={matId} className="text-sm flex items-center gap-1" style={{ color: has ? RARITY_COLORS[mat?.rarity || "common"] : "#f44" }}>
                                <img src={mat?.icon || ""} alt="" width={16} height={16} style={{ imageRendering: "auto" }} onError={hideOnError} />
                                {materials[matId] || 0}/{needed} {mat?.name || matId}
                              </span>
                            );
                          })}
                          {recipe.cooldownMinutes > 0 && (
                            <span className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>CD: {recipe.cooldownMinutes >= 60 ? `${Math.floor(recipe.cooldownMinutes / 60)}h` : `${recipe.cooldownMinutes}m`}</span>
                          )}
                          {recipe.xpGain != null && (() => {
                            const skillUp = SKILL_UP_COLORS[recipe.skillUpColor || "orange"];
                            const multiplier = recipe.skillUpColor === "gray" ? 0 : recipe.skillUpColor === "green" ? 0.25 : recipe.skillUpColor === "yellow" ? 0.75 : 1;
                            const effectiveXp = Math.floor(recipe.xpGain * (isBatchable ? craftCount : 1) * multiplier);
                            const xpColor = recipe.skillUpColor === "gray" ? "#6b7280" : dailyBonusAvailable ? "#facc15" : "rgba(255,255,255,0.25)";
                            return (
                              <span className="text-sm font-mono" style={{ color: xpColor }} title={skillUp?.label}>
                                {recipe.skillUpColor === "gray" ? "0" : `+${effectiveXp}${dailyBonusAvailable ? "x2" : ""}`} XP
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Craft result toast */}
                {craftResult && (
                  <div id="forge-craft-result" className="mx-5 mb-4 px-3 py-2 rounded-lg text-xs font-semibold text-center" style={{ background: `${selectedNpc.color}15`, color: selectedNpc.color, border: `1px solid ${selectedNpc.color}30` }}>
                    {craftResult}
                  </div>
                )}
              </>
            )}

            {/* ─── Tab: Enchanting (D3-style stat reroll — available to all) */}
            {npcModalTab === "enchanting" && selectedNpc.id === "verzauberer" && (() => {
              const eq = equippedSlots[enchantSlot];
              const hasItem = eq && typeof eq === "object";
              const itemStats = hasItem ? ((eq as Record<string, unknown>).stats as Record<string, number> || {}) : {};
              const lockedStat = hasItem ? (eq as Record<string, unknown>).rerollLocked as string | null : null;
              const rerollCount = hasItem ? ((eq as Record<string, unknown>).rerollCount as number || 0) : 0;
              const pending = hasItem ? (eq as Record<string, unknown>).rerollPending as { options: number[]; stat: string } | null : null;

              const handleEnchantRoll = async (stat: string) => {
                if (enchantLoading || !reviewApiKey) return;
                setEnchantLoading(true);
                setEnchantResult(null);
                setEnchantOptions(null);
                try {
                  const r = await fetch("/api/reroll/enchant", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                    body: JSON.stringify({ slot: enchantSlot, statToLock: stat }),
                  });
                  const data = await r.json();
                  if (r.ok && data.options) {
                    setEnchantOptions(data.options);
                    setEnchantCost(data.nextCost || data.cost);
                    setEnchantStat(stat);
                    fetchData();
                    onRefresh?.();
                  } else {
                    setEnchantResult(data.error || "Enchanting failed");
                  }
                } catch { setEnchantResult("Network error"); }
                setEnchantLoading(false);
              };

              const handleEnchantChoose = async (idx: number) => {
                if (enchantLoading || !reviewApiKey) return;
                setEnchantLoading(true);
                try {
                  const r = await fetch("/api/reroll/enchant", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                    body: JSON.stringify({ slot: enchantSlot, statToLock: enchantStat, chosenOption: idx }),
                  });
                  const data = await r.json();
                  if (r.ok) {
                    setEnchantResult(data.message || "Stat updated!");
                    setEnchantOptions(null);
                    setEnchantStat(null);
                    fetchData();
                    onRefresh?.();
                  } else {
                    setEnchantResult(data.error || "Failed");
                  }
                } catch { setEnchantResult("Network error"); }
                setEnchantLoading(false);
              };

              return (
                <div className="px-5 py-4 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  {/* Intro */}
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#a855f7" }}>Stat Enchanting</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Pick one stat to reroll. Once chosen, that stat is locked — only it can be rerolled on this item. Cost escalates with each reroll.
                    </p>
                  </div>

                  {/* Slot selector */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Equipment Slot</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(SLOT_LABELS).map(([slot, label]) => {
                        const hasGear = !!(equippedSlots[slot] && typeof equippedSlots[slot] === "object");
                        return (
                          <button key={slot} onClick={() => { setEnchantSlot(slot); setEnchantOptions(null); setEnchantResult(null); setEnchantStat(null); }}
                            className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                            style={{
                              background: enchantSlot === slot ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                              color: enchantSlot === slot ? "#a855f7" : hasGear ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
                              border: `1px solid ${enchantSlot === slot ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.06)"}`,
                              opacity: hasGear ? 1 : 0.35,
                              cursor: hasGear ? "pointer" : "not-allowed",
                            }}
                            disabled={!hasGear}
                            title={hasGear ? "" : "No item equipped"}
                          >
                            {label}{hasGear ? " \u2713" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Item stats */}
                  {hasItem ? (
                    <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold" style={{ color: RARITY_COLORS[(eq as Record<string, unknown>).rarity as string] || "#fff" }}>
                          {(eq as Record<string, unknown>).name as string}
                        </p>
                        {rerollCount > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>
                            {rerollCount}x enchanted
                          </span>
                        )}
                      </div>

                      {/* Stat rows */}
                      <div className="space-y-1">
                        {Object.entries(itemStats).map(([stat, val]) => {
                          const isLocked = lockedStat === stat;
                          const isOtherLocked = lockedStat && lockedStat !== stat;
                          return (
                            <button key={stat}
                              onClick={() => !isOtherLocked && handleEnchantRoll(stat)}
                              disabled={!!isOtherLocked || enchantLoading}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all"
                              style={{
                                background: isLocked ? "rgba(168,85,247,0.08)" : isOtherLocked ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)",
                                border: `1px solid ${isLocked ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.04)"}`,
                                cursor: isOtherLocked ? "not-allowed" : "pointer",
                                opacity: isOtherLocked ? 0.35 : 1,
                              }}
                              title={isOtherLocked ? `Locked to "${lockedStat}" — cannot reroll other stats` : isLocked ? "This stat is locked for enchanting" : "Click to reroll this stat"}
                            >
                              <span style={{ color: isLocked ? "#a855f7" : "rgba(255,255,255,0.6)" }}>
                                {isLocked && <span style={{ marginRight: 6 }}>&#128274;</span>}
                                {isOtherLocked && <span style={{ marginRight: 6, opacity: 0.4 }}>&#128275;</span>}
                                {stat}
                              </span>
                              <span className="font-mono font-bold" style={{ color: isLocked ? "#c084fc" : "rgba(255,255,255,0.8)" }}>+{val}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Cost preview */}
                      {!enchantOptions && (() => {
                        const previewGold = enchantCost?.gold ?? Math.min(50000, Math.round(100 * Math.pow(1.5, rerollCount)));
                        const previewEssenz = enchantCost?.essenz ?? Math.min(10, 2 + Math.floor(rerollCount / 3));
                        return (
                        <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                          <span>Next reroll: <strong style={{ color: "#f59e0b" }}>{previewGold}g</strong> + <strong style={{ color: "#ff8c00" }}>{previewEssenz} Essenz</strong></span>
                          {rerollCount >= 5 && <span style={{ color: "#f59e0b" }}>&#9888; Cost escalating</span>}
                        </div>
                        );
                      })()
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>
                      No item equipped in this slot
                    </div>
                  )}

                  {/* Enchant options (D3-style pick one of three) */}
                  {enchantOptions && (
                    <div className="rounded-lg p-3" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)" }}>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#a855f7" }}>Choose a value for {enchantStat}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {enchantOptions.map(opt => (
                          <button key={opt.index} onClick={() => handleEnchantChoose(opt.index)}
                            disabled={enchantLoading}
                            className="flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all hover:brightness-125"
                            style={{
                              background: opt.index === 0 ? "rgba(255,255,255,0.04)" : "rgba(168,85,247,0.08)",
                              border: `1px solid ${opt.index === 0 ? "rgba(255,255,255,0.08)" : "rgba(168,85,247,0.25)"}`,
                              cursor: "pointer",
                            }}
                          >
                            <span className="text-xs" style={{ color: opt.index === 0 ? "rgba(255,255,255,0.4)" : "#c084fc" }}>{opt.label}</span>
                            <span className="text-xl font-bold font-mono" style={{ color: opt.index === 0 ? "rgba(255,255,255,0.6)" : "#a855f7" }}>+{opt.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Result message */}
                  {enchantResult && (
                    <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(168,85,247,0.08)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.2)" }}>
                      {enchantResult}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ─── Tab: Schmiedekunst (Schmied only) ───────────────────── */}
            {npcModalTab === "schmiedekunst" && selectedNpc.id === "schmied" && (() => {
              const inv = getUserInventory(loggedInUser);
              // Collect equipped item IDs so we never show them in dismantle/transmute
              const equippedIds = new Set<string>();
              for (const slot of Object.keys(equippedSlots)) {
                const eq = equippedSlots[slot];
                if (eq && typeof eq === "object") {
                  if (eq.instanceId) equippedIds.add(eq.instanceId);
                  else if (eq.id) equippedIds.add(eq.id);
                }
              }
              const dismantleItems = inv.filter(i => i.rarity && i.name && (i.instanceId || i.id) && (i.slot || i.templateId) && !equippedIds.has(i.instanceId || i.id));
              const hasItems = dismantleItems.length > 0;
              // Group by rarity
              const grouped: Record<string, InventoryItem[]> = {};
              for (const item of dismantleItems) {
                if (!grouped[item.rarity]) grouped[item.rarity] = [];
                grouped[item.rarity].push(item);
              }
              return (
                <div className="px-5 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Dismantle gear into <strong style={{ color: "#ff8c00" }}>Essenz</strong> + <strong style={{ color: "#22c55e" }}>Materials</strong>. Essenz is used for recipes and profession switching.
                  </p>

                  {dismantleResult && (
                    <div className="rounded-lg px-3 py-2 text-xs space-y-1" style={{ background: "rgba(255,140,0,0.08)", border: "1px solid rgba(255,140,0,0.2)" }}>
                      {dismantleResult.essenz != null ? (
                        <>
                          <div className="flex items-center gap-2 font-semibold" style={{ color: "#ff8c00" }}>
                            <span>+{dismantleResult.essenz} Essenz</span>
                            {dismantleResult.materials && dismantleResult.materials.length > 0 && (
                              <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
                            )}
                            {dismantleResult.materials && dismantleResult.materials.length > 0 && (
                              <span style={{ color: "#22c55e" }}>
                                {dismantleResult.materials.map(m => `${m.name} x${m.amount}`).join(", ")}
                              </span>
                            )}
                          </div>
                          {dismantleResult.materials && dismantleResult.materials.length === 0 && (
                            <p style={{ color: "rgba(255,255,255,0.25)" }}>No materials dropped this time</p>
                          )}
                        </>
                      ) : (
                        <p className="font-semibold" style={{ color: "#ff8c00" }}>{dismantleResult.message}</p>
                      )}
                    </div>
                  )}

                  {!hasItems ? (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>No items in inventory to dismantle.</p>
                  ) : (
                    <div className="space-y-3">
                      {RARITY_ORDER.filter(r => grouped[r]?.length).map(rarity => (
                        <div key={rarity}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold uppercase" style={{ color: RARITY_COLORS[rarity] }}>{rarity}</span>
                            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>+{ESSENZ_TABLE[rarity] || 2} Essenz each</span>
                            {/* Salvage All button */}
                            {grouped[rarity].length >= 2 && rarity !== "legendary" && (
                              <button
                                onClick={() => handleDismantleAll(rarity, grouped[rarity].length)}
                                className="salvage-all-btn text-xs px-2 py-1 rounded font-semibold ml-auto"
                                style={{ background: "rgba(255,140,0,0.1)", color: "#ff8c00", border: "1px solid rgba(255,140,0,0.25)" }}
                              >
                                Salvage All ({grouped[rarity].length})
                              </button>
                            )}
                          </div>
                          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))" }}>
                            {grouped[rarity].slice(0, 24).map(item => (
                              <button
                                key={item.instanceId || item.id}
                                onClick={() => handleDismantle(item.instanceId || item.id, item.name, rarity)}
                                className="forge-btn relative flex items-center justify-center rounded-lg aspect-square"
                                style={{ background: `${RARITY_COLORS[rarity]}08`, border: `1px solid ${RARITY_COLORS[rarity]}30` }}
                                title={`${item.name} — Dismantle → +${ESSENZ_TABLE[rarity] || 2} Essenz + Materials`}
                              >
                                {item.icon
                                  ? <img src={item.icon} alt={item.name} style={{ width: 40, height: 40, imageRendering: "auto", objectFit: "contain" }} />
                                  : <span style={{ fontSize: 18, color: RARITY_COLORS[rarity] }}>◆</span>
                                }
                              </button>
                            ))}
                            {grouped[rarity].length > 24 && (
                              <span className="text-xs self-center text-center" style={{ color: "rgba(255,255,255,0.2)" }}>+{grouped[rarity].length - 24}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ─── Tab: Transmutation (Verzauberer only) ───────────────── */}
            {npcModalTab === "transmutation" && selectedNpc.id === "alchemist" && (() => {
              const inv = getUserInventory(loggedInUser);
              // Exclude equipped items from transmutation
              const equippedIds = new Set<string>();
              for (const slot of Object.keys(equippedSlots)) {
                const eq = equippedSlots[slot];
                if (eq && typeof eq === "object") {
                  if (eq.instanceId) equippedIds.add(eq.instanceId);
                  else if (eq.id) equippedIds.add(eq.id);
                }
              }
              const epicItems = inv.filter(i => i.rarity === "epic" && i.name && (i.instanceId || i.id) && i.slot && !equippedIds.has(i.instanceId || i.id));
              // Group epics by slot for proper same-slot validation
              const epicsBySlot: Record<string, InventoryItem[]> = {};
              for (const item of epicItems) {
                const s = item.slot || "unknown";
                if (!epicsBySlot[s]) epicsBySlot[s] = [];
                epicsBySlot[s].push(item);
              }
              // Only allow selecting items from the same slot as the first selected item
              const firstSelected = selectedTransmute.length > 0
                ? epicItems.find(i => (i.instanceId || i.id) === selectedTransmute[0])
                : null;
              const lockedSlot = firstSelected?.slot || null;
              return (
                <div className="px-5 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Combine 3 Epic gear pieces from the same slot + 500 Gold to create a Legendary item.
                  </p>

                  {transmuteResult && (
                    <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" }}>
                      {transmuteResult}
                    </div>
                  )}

                  {epicItems.length === 0 ? (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                      No Epic items in inventory. Epics drop from quests or can be crafted.
                    </p>
                  ) : epicItems.length < 3 ? (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {epicItems.length}/3 Epic items available — collect {3 - epicItems.length} more.
                    </p>
                  ) : (
                    <>
                      {/* Show epics grouped by slot */}
                      <div className="space-y-2">
                        {Object.entries(epicsBySlot).map(([slot, items]) => {
                          const slotLocked = lockedSlot && lockedSlot !== slot;
                          return (
                            <div key={slot}>
                              <p className="text-sm font-semibold uppercase mb-1.5" style={{ color: slotLocked ? "rgba(255,255,255,0.1)" : "rgba(34,197,94,0.5)" }}>
                                {SLOT_LABELS[slot] || slot} ({items.length})
                              </p>
                              <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))" }}>
                                {items.map(item => {
                                  const iid = item.instanceId || item.id;
                                  const sel = selectedTransmute.includes(iid);
                                  const disabled = !!slotLocked && !sel;
                                  return (
                                    <button key={iid} onClick={() => {
                                      if (disabled) return;
                                      setSelectedTransmute(prev => sel ? prev.filter(x => x !== iid) : prev.length < 3 ? [...prev, iid] : prev);
                                    }} disabled={disabled} className="forge-btn relative flex items-center justify-center rounded-lg aspect-square" style={{
                                      background: sel ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.03)",
                                      border: `2px solid ${sel ? "rgba(34,197,94,0.6)" : "rgba(34,197,94,0.15)"}`,
                                      opacity: disabled ? 0.3 : 1,
                                    }} title={item.name}>
                                      {item.icon
                                        ? <img src={item.icon} alt={item.name} style={{ width: 40, height: 40, imageRendering: "auto", objectFit: "contain" }} />
                                        : <span style={{ fontSize: 18, color: "#22c55e" }}>◆</span>
                                      }
                                      {sel && <span className="absolute top-0.5 right-0.5 text-xs font-bold" style={{ color: "#4ade80", textShadow: "0 0 4px rgba(0,0,0,0.8)" }}>✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-xs font-mono" style={{ color: selectedTransmute.length === 3 ? "#4ade80" : "rgba(255,255,255,0.2)" }}>
                          {selectedTransmute.length}/3{lockedSlot ? ` (${SLOT_LABELS[lockedSlot] || lockedSlot})` : ""}
                        </span>
                        {selectedTransmute.length > 0 && selectedTransmute.length < 3 && (
                          <button onClick={() => setSelectedTransmute([])} className="forge-btn text-xs px-2 py-1 rounded-lg" style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            Reset
                          </button>
                        )}
                        {selectedTransmute.length === 3 && (
                          <button onClick={handleTransmute} className="forge-btn text-xs px-3 py-1.5 rounded-lg font-semibold" style={{
                            background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.4)",
                          }}>
                            Transmute (500g)
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
      {/* ─── Confirm Profession Modal ─────────────────────────────────── */}
      {confirmProf && createPortal(
        <div className="modal-backdrop" onClick={() => setConfirmProf(null)} style={{ zIndex: 150 }}>
          <div
            className="rounded-2xl p-6 w-full max-w-md space-y-4"
            onClick={e => e.stopPropagation()}
            style={{ background: "#14161c", border: `1px solid ${confirmProf.color}30`, boxShadow: `0 0 40px ${confirmProf.color}10` }}
          >
            <div className="flex items-center gap-3">
              {confirmProf.npcPortrait && (
                <img src={confirmProf.npcPortrait} alt="" width={40} height={40} className="rounded-lg" style={{ imageRendering: "auto", border: `1px solid ${confirmProf.color}30` }} />
              )}
              <div>
                <h3 className="text-sm font-bold" style={{ color: confirmProf.color }}>Choose {confirmProf.name}</h3>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{confirmProf.npcName ? `Trainer: ${confirmProf.npcName}` : ""}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex justify-between">
                  <span>Used Slots</span>
                  <span className="font-mono font-semibold" style={{ color: chosenCount >= maxProfSlots ? "#f44" : "#e8e8e8" }}>{chosenCount} / {maxProfSlots}</span>
                </div>
                <div className="flex justify-between">
                  <span>Free Slots</span>
                  <span className="font-mono font-semibold" style={{ color: "#22c55e" }}>{maxProfSlots - chosenCount}</span>
                </div>
              </div>

              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>What happens:</p>
                <ul className="space-y-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                  <li className="flex gap-2"><span style={{ color: "#22c55e" }}>&#10003;</span> You learn <strong style={{ color: confirmProf.color }}>{confirmProf.name}</strong> at Level 1</li>
                  <li className="flex gap-2"><span style={{ color: "#22c55e" }}>&#10003;</span> Access to all recipes of this profession</li>
                  <li className="flex gap-2"><span style={{ color: "#22c55e" }}>&#10003;</span> Daily bonus: First craft grants 2x XP</li>
                </ul>
              </div>

              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(255,68,68,0.03)", border: "1px solid rgba(255,68,68,0.08)" }}>
                <p className="font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Switching professions later:</p>
                <ul className="space-y-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                  <li className="flex gap-2"><span style={{ color: "#f44" }}>&#10007;</span> Costs <strong style={{ color: "#ff8c00" }}>200 Essenz</strong></li>
                  <li className="flex gap-2"><span style={{ color: "#f44" }}>&#10007;</span> <strong>All progress</strong> in the dropped profession is lost</li>
                  <li className="flex gap-2"><span style={{ color: "#f44" }}>&#10007;</span> Level and XP are reset to 0</li>
                </ul>
              </div>

              {maxProfSlots < 4 && (
                <p className="text-xs text-center pt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                  More slots unlock through leveling up (Lv5, Lv15, Lv20, Lv25)
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmProf(null)}
                className="forge-btn flex-1 text-xs font-semibold py-2.5 rounded-lg"
                style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { const id = confirmProf.id; setConfirmProf(null); handleChooseProfession(id); }}
                disabled={choosingProf}
                title={choosingProf ? "Choosing profession..." : "Confirm profession choice"}
                className="forge-btn flex-1 text-xs font-bold py-2.5 rounded-lg"
                style={{ background: `${confirmProf.color}18`, color: confirmProf.color, border: `1px solid ${confirmProf.color}40`, cursor: choosingProf ? "not-allowed" : "pointer" }}
              >
                {choosingProf ? "..." : "Learn Profession"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation modal (replaces window.confirm) */}
      {confirmAction && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setConfirmAction(null)}>
          <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#1a1509", border: "1px solid rgba(180,140,70,0.35)" }} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1" style={{ color: "#fbbf24" }}>Confirm Action</p>
            <p className="text-xs mb-4 whitespace-pre-line" style={{ color: "rgba(255,255,255,0.6)" }}>{confirmAction.message}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction(null)} className="flex-1 text-xs py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmAction.onConfirm} className="flex-1 text-xs py-2 rounded-lg font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", cursor: "pointer" }}>Confirm</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
