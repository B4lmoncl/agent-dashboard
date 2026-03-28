"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  maxSkill?: number;
  skill?: number;
  skillCap?: number;
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
  reqSkill?: number;
  xpGain?: number;
  skillUpChance?: number;
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
  legendary: "#f97316",
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
  lederverarbeiter: { partner: "alchemist", label: "Wilderness" },
};

// ─── Skill-up color labels ──────────────────────────────────────────────────
const SKILL_UP_COLORS: Record<string, { color: string; label: string }> = {
  orange: { color: "#f97316", label: "Guaranteed (100%)" },
  yellow: { color: "#eab308", label: "Likely (~75%)" },
  green: { color: "#22c55e", label: "Unlikely (~25%)" },
  gray: { color: "#6b7280", label: "No skill-up (0%)" },
};

// ─── NPC location metadata ───────────────────────────────────────────────────
const NPC_LOCATIONS: Record<string, { label: string; color: string; desc: string }> = {
  schmied: { label: "Deepforge", color: "#f59e0b", desc: "Heavy armor crafting, salvage" },
  schneider: { label: "Webstube", color: "#c084fc", desc: "Cloth armor crafting" },
  alchemist: { label: "Alchemist Lab", color: "#22c55e", desc: "Potions, elixirs & transmutation" },
  koch: { label: "Guild Kitchen", color: "#e87b35", desc: "Meals with XP/Gold buffs" },
  verzauberer: { label: "Arcanum", color: "#a78bfa", desc: "Enchantments & stat rerolling" },
  lederverarbeiter: { label: "Gerberei", color: "#b45309", desc: "Leather armor crafting" },
  waffenschmied: { label: "Waffenkammer", color: "#dc2626", desc: "Weapons & shields" },
  juwelier: { label: "Edelsteinkammer", color: "#ec4899", desc: "Rings, amulets & gem cutting" },
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
  const [craftProgress, setCraftProgress] = useState<{ recipeId: string; current: number; total: number; startTime: number } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("weapon");
  const [dismantleResult, setDismantleResult] = useState<{ message: string; essenz?: number; materials?: { id: string; name: string; amount: number }[] } | null>(null);
  const [transmuteResult, setTransmuteResult] = useState<string | null>(null);
  const [selectedTransmute, setSelectedTransmute] = useState<string[]>([]);
  const [npcModalTab, setNpcModalTab] = useState<"recipes" | "schmiedekunst" | "transmutation" | "enchanting">("recipes");
  // infoOpen state removed — info now shown via hover tooltip on header
  const [choosingProf, setChoosingProf] = useState(false);
  const [confirmProf, setConfirmProf] = useState<ProfessionDef | null>(null);
  const [dailyBonusAvailable, setDailyBonusAvailable] = useState(false);
  const [moonlightActive, setMoonlightActive] = useState(false);
  const [craftCount, setCraftCount] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [buyingTool, setBuyingTool] = useState<string | null>(null);
  const [slotAffixRanges, setSlotAffixRanges] = useState<Record<string, { primary: { stat: string; min: number; max: number }[]; minor: { stat: string; min: number; max: number }[]; currentStats: Record<string, number>; itemName: string; rarity: string }>>({});
  const [workshopUpgrades, setWorkshopUpgrades] = useState<{ id: string; name: string; desc: string; icon: string; category: string; currentTier: number; maxTier: number; currentValue: number; nextTier: { tier: number; cost: number; currency: string; value: number; label: string } | null }[]>([]);
  const [buyingUpgrade, setBuyingUpgrade] = useState<string | null>(null);
  // Recipe search & filter state
  const [recipeSearch, setRecipeSearch] = useState("");
  const [showCraftableOnly, setShowCraftableOnly] = useState(false);
  const [totalRecipesByProf, setTotalRecipesByProf] = useState<Record<string, number>>({});
  // Cast bar countdown state
  const [castCountdown, setCastCountdown] = useState<string | null>(null);
  // Enchanting (D3-style reroll) state
  const [enchantSlot, setEnchantSlot] = useState<string>("weapon");
  const [enchantStat, setEnchantStat] = useState<string | null>(null);
  const [enchantOptions, setEnchantOptions] = useState<{ label: string; value: number; index: number }[] | null>(null);
  const [enchantCost, setEnchantCost] = useState<{ gold: number; essenz: number } | null>(null);
  const [enchantLoading, setEnchantLoading] = useState(false);
  const [enchantResult, setEnchantResult] = useState<string | null>(null);
  const [skillUpFlash, setSkillUpFlash] = useState(false);
  // Ätherwürfel state
  const [cubeData, setCubeData] = useState<{
    offensive: { type: string; value: number; label: string } | null;
    defensive: { type: string; value: number; label: string } | null;
    utility: { type: string; value: number; label: string } | null;
    library: { type: string; value: number; label: string; category: string; extractedFrom: string; extractedAt: string }[];
    categories: Record<string, string>;
  } | null>(null);
  const [cubeOpen, setCubeOpen] = useState(false);
  const [cubeLoading, setCubeLoading] = useState(false);
  const [cubeExtractId, setCubeExtractId] = useState<string | null>(null);
  const [cubeResult, setCubeResult] = useState<string | null>(null);
  // Material Storage state
  const [matStorageOpen, setMatStorageOpen] = useState(false);
  const [matSearch, setMatSearch] = useState("");
  // Auto-Salvage modal state
  const [autoSalvageOpen, setAutoSalvageOpen] = useState(false);
  const [autoSalvageRarity, setAutoSalvageRarity] = useState<string>("common");
  const [autoSalvagePreview, setAutoSalvagePreview] = useState<{ items: { id: string; name: string; rarity: string; slot: string | null; icon: string | null }[]; count: number; estimatedEssenz: number; estimatedMaterials: Record<string, { name: string; amount: number }> } | null>(null);
  const [autoSalvageLoading, setAutoSalvageLoading] = useState(false);
  const [autoSalvageStep, setAutoSalvageStep] = useState<0 | 1 | 2>(0); // 0=preview, 1=confirm, 2=done

  // Close callbacks for modal behavior hooks
  const closeNpcModal = useCallback(() => {
    setSelectedNpc(null); setCraftResult(null); setDismantleResult(null); setTransmuteResult(null); setSelectedTransmute([]);
    setEnchantSlot("weapon"); setEnchantStat(null); setEnchantOptions(null); setEnchantCost(null); setEnchantResult(null);
  }, []);
  const closeConfirmProf = useCallback(() => setConfirmProf(null), []);
  const closeConfirmAction = useCallback(() => setConfirmAction(null), []);
  const closeAutoSalvage = useCallback(() => { setAutoSalvageOpen(false); setAutoSalvagePreview(null); setAutoSalvageStep(0); }, []);
  const closeCube = useCallback(() => { setCubeOpen(false); setCubeResult(null); setCubeExtractId(null); }, []);

  // Consistent modal behavior: ESC to close + body scroll lock
  useModalBehavior(!!selectedNpc, closeNpcModal);
  useModalBehavior(!!confirmProf, closeConfirmProf);
  useModalBehavior(!!confirmAction, closeConfirmAction);
  useModalBehavior(autoSalvageOpen, closeAutoSalvage);
  useModalBehavior(cubeOpen, closeCube);

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
        if (data.moonlightActive !== undefined) setMoonlightActive(data.moonlightActive);
        if (data.maxProfSlots != null) setMaxProfSlots(data.maxProfSlots);
        if (data.slotAffixRanges) setSlotAffixRanges(data.slotAffixRanges);
        if (data.totalRecipesByProf) setTotalRecipesByProf(data.totalRecipesByProf);
      }
    } catch (err) { console.error('Failed to fetch crafting data:', err); }
    // Fetch workshop upgrades
    try {
      const wr = await fetch(`/api/shop/workshop?player=${encodeURIComponent(playerName)}`, { signal: AbortSignal.timeout(3000) });
      if (wr.ok) {
        const wData = await wr.json();
        setWorkshopUpgrades(wData.workshopUpgrades || []);
      }
    } catch (err) { console.error('Failed to fetch workshop upgrades:', err); }
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

  // WoW-style craft with cast bar (2s per craft)
  const CRAFT_CAST_MS = 2000;
  const craftTimerRef = useRef<number | null>(null);

  const startCraftCast = (recipeId: string, count = 1) => {
    if (crafting || craftProgress || !reviewApiKey) return;
    setCraftProgress({ recipeId, current: 0, total: count, startTime: Date.now() });
    // After cast time, execute the actual craft
    craftTimerRef.current = window.setTimeout(() => {
      setCraftProgress(null);
      handleCraft(recipeId, count);
    }, CRAFT_CAST_MS);
  };

  // Cancel cast on ESC
  useEffect(() => {
    if (!craftProgress) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && craftTimerRef.current) {
        clearTimeout(craftTimerRef.current);
        setCraftProgress(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [craftProgress]);

  // Cast bar countdown timer (Feature #4)
  useEffect(() => {
    if (!craftProgress) { setCastCountdown(null); return; }
    let rafId: number;
    const tick = () => {
      const elapsed = Date.now() - craftProgress.startTime;
      const remaining = Math.max(0, CRAFT_CAST_MS - elapsed) / 1000;
      setCastCountdown(remaining.toFixed(1));
      if (remaining > 0) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [craftProgress]);

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
        if (data.skillGained > 0) msg += ` (+${data.skillGained} Skill${data.dailyBonusUsed ? " \u2606 Daily Bonus!" : ""})`;
        else if (data.skillGained === 0 && data.skillUpColor !== "gray") msg += " (No skill-up)";
        if (data.newSkill) msg += ` [${data.newSkill}/300]`;
        // Batch craft: sequential tick animation
        if (count > 1 && (data.craftCount || count) > 1) {
          const total = data.craftCount || count;
          setCraftResult(`Crafting 1/${total}...`);
          let tick = 1;
          const interval = setInterval(() => {
            tick++;
            if (tick >= total) {
              clearInterval(interval);
              setCraftResult(msg);
            } else {
              setCraftResult(`Crafting ${tick}/${total}...`);
            }
          }, 200);
        } else {
          setCraftResult(msg);
        }
        if (data.skillGained > 0) { setSkillUpFlash(true); setTimeout(() => setSkillUpFlash(false), 1000); }
        setCraftCount(1);
        fetchData();
        onRefresh?.();
      } else {
        setCraftResult(data.error || "Crafting failed");
      }
    } catch (err) {
      console.error('Crafting network error:', err);
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
    } catch (err) {
      console.error('Learn recipe network error:', err);
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
        setDismantleResult({ message: data.error || "Something went wrong. Try again." });
      }
      setTimeout(() => setDismantleResult(null), 5000);
      fetchData();
      onRefresh?.();
    } catch (err) { console.error('[forge] dismantle error:', err); setDismantleResult({ message: "Network error" }); }
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
        setDismantleResult({ message: data.error || "Something went wrong. Try again." });
      }
      setTimeout(() => setDismantleResult(null), 6000);
      fetchData();
      onRefresh?.();
    } catch (err) { console.error('[forge] dismantle_all error:', err); setDismantleResult({ message: "Network error" }); }
  };

  // ─── Auto-Salvage Preview+Execute ─────────────────────────────────────────
  const fetchSalvagePreview = async (rarity: string) => {
    if (!reviewApiKey) return;
    setAutoSalvageLoading(true);
    try {
      const r = await fetch("/api/schmiedekunst/dismantle-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ rarity }),
      });
      const data = await r.json();
      if (r.ok) {
        setAutoSalvagePreview(data);
        setAutoSalvageStep(0);
      }
    } catch (err) { console.error('[forge] preview error:', err); }
    setAutoSalvageLoading(false);
  };
  const executeAutoSalvage = async () => {
    if (!reviewApiKey || !autoSalvagePreview) return;
    setAutoSalvageLoading(true);
    try {
      const r = await fetch("/api/schmiedekunst/dismantle-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ rarity: autoSalvageRarity }),
      });
      const data = await r.json();
      if (r.ok) {
        setAutoSalvageStep(2);
        setDismantleResult({
          message: data.message,
          essenz: data.totalEssenz,
          materials: Object.entries(data.materialsGained || {}).map(([id, amt]) => {
            const def = materialDefs.find(m => m.id === id);
            return { id, name: def?.name || id, amount: amt as number };
          }),
        });
        fetchData();
        onRefresh?.();
      }
    } catch (err) { console.error('[forge] auto-salvage error:', err); }
    setAutoSalvageLoading(false);
  };

  // ─── Ätherwürfel handlers ─────────────────────────────────────────────────
  const fetchCubeData = async () => {
    if (!reviewApiKey) return;
    try {
      const r = await fetch("/api/kanais-cube", { headers: getAuthHeaders(reviewApiKey) });
      if (r.ok) setCubeData(await r.json());
    } catch (err) { console.error('[cube] fetch error:', err); }
  };
  const handleCubeExtract = async (itemId: string) => {
    if (!reviewApiKey) return;
    setCubeLoading(true);
    setCubeResult(null);
    try {
      const r = await fetch("/api/kanais-cube/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ inventoryItemId: itemId }),
      });
      const data = await r.json();
      if (r.ok) {
        setCubeData(data.cube);
        setCubeResult(`Extracted "${data.extracted.label}" from ${data.destroyed.name}`);
        setCubeExtractId(null);
        fetchData();
        onRefresh?.();
      } else {
        setCubeResult(data.error || "Something went wrong. Try again.");
      }
    } catch (err) { console.error('[cube] extract error:', err); setCubeResult("Network error"); }
    setCubeLoading(false);
  };
  const handleCubeEquip = async (slot: string, effectType: string) => {
    if (!reviewApiKey) return;
    setCubeLoading(true);
    try {
      const r = await fetch("/api/kanais-cube/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ slot, effectType }),
      });
      const data = await r.json();
      if (r.ok) setCubeData(data.cube);
      else setCubeResult(data.error || "Something went wrong. Try again.");
    } catch (err) { console.error('[cube] equip error:', err); }
    setCubeLoading(false);
  };
  const handleCubeUnequip = async (slot: string) => {
    if (!reviewApiKey) return;
    setCubeLoading(true);
    try {
      const r = await fetch("/api/kanais-cube/unequip", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ slot }),
      });
      const data = await r.json();
      if (r.ok) setCubeData(data.cube);
      else setCubeResult(data.error || "Unequip failed");
    } catch (err) { console.error('[cube] unequip error:', err); setCubeResult("Network error"); }
    setCubeLoading(false);
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
      setTransmuteResult(data.message || data.error || "Something went wrong. Try again.");
      setSelectedTransmute([]);
      setTimeout(() => setTransmuteResult(null), 5000);
      fetchData();
      onRefresh?.();
    } catch (err) { console.error('[forge] transmute error:', err); setTransmuteResult("Network error"); }
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
        setCraftResult(data.error || "Something went wrong. Try again.");
      }
    } catch (err) { console.error('[forge] choose_profession error:', err); setCraftResult("Network error"); }
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
        } catch (err) { console.error('[forge] drop_profession error:', err); setCraftResult("Network error"); }
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
          <p className="text-xs italic mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Acht Künste. Zwei Wege. Was du hier schmiedest, hallt in Ewigkeit wider.</p>
          {moonlightActive && (
            <TipCustom title="Mondlicht-Schmiede" accent="#818cf8" body={<p className="text-xs">Zwischen 22:00 und 06:00 Uhr (Berlin) sind die Sterne ausgerichtet. Items die jetzt gecraftet werden erhalten +20% bessere Minimum-Rolls auf alle Stats.</p>}>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg cursor-help" style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.25)" }}>
                Mondlicht aktiv
              </span>
            </TipCustom>
          )}
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

      {/* ─── NPC Grid (categorized) — materials shown per NPC card ────── */}
      {[
        { label: "Armor Professions", desc: "Helm, Armor, Boots", ids: ["schmied","schneider","lederverarbeiter"] },
        { label: "Weapon & Jewelry", desc: "Weapons, Shields, Rings, Amulets", ids: ["waffenschmied","juwelier"] },
        { label: "Consumables", desc: "Potions, Meals, Enchants", ids: ["alchemist","koch","verzauberer"] },
      ].map(cat => {
        const catProfs = professions.filter(p => cat.ids.includes(p.id));
        if (catProfs.length === 0) return null;
        return (
          <div key={cat.label} className="mb-4">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>{cat.label}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.1)" }}>{cat.desc}</span>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {catProfs.map(prof => {
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
                <Tip k={`prof_${prof.id}`} heading><span className="text-sm font-semibold uppercase tracking-widest" style={{ color: `${loc.color}70` }}>{loc.label}</span></Tip>
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
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{prof.description}
                    <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.2)" }}>· {recipes.filter(r => r.profession === prof.id).length} recipes</span>
                  </p>
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
                  <div className="flex-1 progress-bar-diablo" style={{ height: 7 }}>
                    <div className="h-full rounded-full transition-all" style={{ background: `linear-gradient(90deg, ${prof.color}cc, ${prof.color})`, width: `${(prof.skill || prof.playerXp || 0) / (prof.skillCap || prof.nextLevelXp || 300) * 100}%`, boxShadow: `0 0 6px ${prof.color}40` }} />
                  </div>
                  <span className="text-sm font-mono font-semibold" style={{ color: prof.rankColor || prof.color }}>{prof.skill || prof.playerXp || 0}/{prof.skillCap || 300}</span>
                </div>
              )}
              {prof.masteryBonus && (prof.masteryActive ? (
                <p className="text-xs mt-1" style={{ color: "#facc15" }} title={prof.masteryBonus.desc}>&#9733; Mastery: {prof.masteryBonus.desc}</p>
              ) : prof.unlocked && (prof.skill || prof.playerXp || 0) > 0 ? (
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.15)" }} title={`Unlocks at Skill 225: ${prof.masteryBonus.desc}`}>&#9734; Mastery (Skill 225): {prof.masteryBonus.desc}</p>
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
          </div>
        );
      })}

      {/* ─── Material Storage (GW2-style) ────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "rgba(34,197,94,0.6)" }}>Material Storage</p>
          <button
            onClick={() => setMatStorageOpen(o => !o)}
            className="text-xs px-3 py-1 rounded-lg"
            style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", cursor: "pointer" }}
          >
            {matStorageOpen ? "Collapse" : "Expand"}
          </button>
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
          Unlimited storage. Materials do not count against inventory cap ({Object.values(materials).reduce((s, v) => s + v, 0)} total).
        </p>
        {matStorageOpen && (
          <div className="tab-content-enter space-y-2">
            {/* Search */}
            <input
              type="text"
              placeholder="Search materials..."
              value={matSearch}
              onChange={e => setMatSearch(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg input-dark"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8" }}
            />
            {/* Material grid */}
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
              {materialDefs
                .filter(m => {
                  const count = materials[m.id] || 0;
                  if (matSearch) return m.name.toLowerCase().includes(matSearch.toLowerCase()) || m.id.toLowerCase().includes(matSearch.toLowerCase());
                  return count > 0;
                })
                .sort((a, b) => {
                  const ra = ["common", "uncommon", "rare", "epic", "legendary"].indexOf(a.rarity);
                  const rb = ["common", "uncommon", "rare", "epic", "legendary"].indexOf(b.rarity);
                  return ra - rb || a.name.localeCompare(b.name);
                })
                .map(m => {
                  const count = materials[m.id] || 0;
                  const rc = RARITY_COLORS[m.rarity] || "#9ca3af";
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                      title={m.desc}
                      style={{ background: `${rc}06`, border: `1px solid ${rc}15`, opacity: count > 0 ? 1 : 0.4 }}
                    >
                      {m.icon ? (
                        <img src={m.icon} alt={m.name} width={28} height={28} style={{ imageRendering: "auto", flexShrink: 0 }} onError={hideOnError} />
                      ) : (
                        <span className="flex-shrink-0" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: rc, fontSize: 14 }}>{"\u25C6"}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: rc }}>{m.name}</p>
                        <p className="text-xs font-mono" style={{ color: count > 0 ? "#e8e8e8" : "rgba(255,255,255,0.2)" }}>{count}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
            {materialDefs.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.15)" }}>No materials data loaded.</p>
            )}
          </div>
        )}
      </div>

      {/* ─── Ätherwürfel — Legendary Effect Extraction ─────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "rgba(249,115,22,0.6)" }}>Ätherwürfel</p>
          <button
            onClick={() => { setCubeOpen(true); fetchCubeData(); }}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", cursor: "pointer" }}
          >
            Open Cube
          </button>
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          Sacrifice legendary items to permanently learn their effects. Equip one effect per category without wearing the item.
        </p>
        {/* Quick preview of active cube effects */}
        {cubeData && (
          <div className="flex gap-2">
            {(["offensive", "defensive", "utility"] as const).map(slot => {
              const active = cubeData[slot];
              const colors = { offensive: "#ef4444", defensive: "#3b82f6", utility: "#22c55e" };
              return (
                <div key={slot} className="flex-1 rounded-lg px-2 py-1.5 text-center" style={{ background: `${colors[slot]}08`, border: `1px solid ${colors[slot]}20` }}>
                  <p className="text-xs uppercase font-semibold" style={{ color: `${colors[slot]}80` }}>{slot}</p>
                  <p className="text-xs font-semibold truncate" style={{ color: active ? colors[slot] : "rgba(255,255,255,0.15)" }}>
                    {active ? active.label : "Empty"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
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
                          } catch (err) { console.error('[forge] buy_tool error:', err); setCraftResult("Network error"); }
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
                        } catch (err) { console.error('[forge] buy_upgrade error:', err); setCraftResult("Network error"); }
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
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 npc-modal-backdrop"
          style={{ background: "rgba(0,0,0,0.82)" }}
          onClick={e => { if (e.target === e.currentTarget) closeNpcModal(); }}
        >
          <div className="relative w-full max-w-xl rounded-xl npc-modal-content" style={{ background: "#141418", border: `1px solid ${selectedNpc.color}30`, maxHeight: "85vh", overflowY: "auto", overflowX: "hidden" }}>
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
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{selectedNpc.name} &middot; Skill {selectedNpc.skill || selectedNpc.playerXp || 0}/{selectedNpc.skillCap || 300}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-32 progress-bar-diablo${skillUpFlash ? " skill-bar-flash" : ""}`} style={{ height: 7 }}>
                      <div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${selectedNpc.color}cc, ${selectedNpc.color})`, width: `${Math.min(100, ((selectedNpc.skill || selectedNpc.playerXp || 0) / (selectedNpc.skillCap || 300)) * 100)}%`, boxShadow: `0 0 6px ${selectedNpc.color}40` }} />
                    </div>
                    <span className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{selectedNpc.skill || selectedNpc.playerXp || 0}/{selectedNpc.maxSkill || 300}</span>
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
              <div className="tab-content-enter">
                {/* Recipe discovery counter */}
                {(() => {
                  const profRecipes = recipes.filter(r => r.profession === selectedNpc.id);
                  const discovered = profRecipes.filter(r => !(r as unknown as Record<string, unknown>).hidden).length;
                  const total = totalRecipesByProf[selectedNpc.id] || profRecipes.length;
                  return (
                    <div className="px-5 pt-3 flex items-center justify-between">
                      <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                        {discovered}/{total} recipes discovered
                      </span>
                      {discovered >= total && <span className="text-xs font-semibold" style={{ color: "#4ade80" }}>Complete</span>}
                    </div>
                  );
                })()}
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
                  {/* Recipe search + craftable filter (Features #1 & #2) */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={recipeSearch}
                        onChange={e => setRecipeSearch(e.target.value)}
                        placeholder="Search recipes..."
                        className="input-dark w-full text-xs px-3 py-1.5 rounded-lg pr-7"
                        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
                      />
                      {recipeSearch && (
                        <button
                          onClick={() => setRecipeSearch("")}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-xs"
                          style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer" }}
                          title="Clear search"
                        >
                          &#10005;
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowCraftableOnly(v => !v)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap"
                      style={{
                        background: showCraftableOnly ? `${selectedNpc.color}18` : "rgba(255,255,255,0.04)",
                        color: showCraftableOnly ? selectedNpc.color : "rgba(255,255,255,0.3)",
                        border: `1px solid ${showCraftableOnly ? `${selectedNpc.color}40` : "rgba(255,255,255,0.08)"}`,
                        boxShadow: showCraftableOnly ? `0 0 8px ${selectedNpc.color}20` : "none",
                        cursor: "pointer",
                      }}
                      title="Show only recipes you can craft right now"
                    >
                      Show Craftable
                    </button>
                  </div>
                  {recipes.filter(r => r.profession === selectedNpc.id).filter(recipe => {
                    // Search filter
                    if (recipeSearch && !recipe.name.toLowerCase().includes(recipeSearch.toLowerCase())) return false;
                    // Craftable-only filter
                    if (showCraftableOnly) {
                      const isLearned = recipe.learned !== false;
                      const meetsLevel = recipe.canCraft;
                      const onCooldown = (recipe.cooldownRemaining ?? 0) > 0;
                      const isBatchable = recipe.result?.type === "buff" || recipe.result?.type === "streak_shield" || recipe.result?.type === "forge_temp";
                      const effectiveCount = isBatchable ? craftCount : 1;
                      const canAffordCheck = (() => {
                        const g = currencies.gold ?? loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0;
                        if (recipe.cost?.gold && g < recipe.cost.gold * effectiveCount) return false;
                        for (const [matId, amt] of Object.entries(recipe.materials || {})) {
                          if ((materials[matId] || 0) < (amt as number) * effectiveCount) return false;
                        }
                        return true;
                      })();
                      if (!canAffordCheck || !meetsLevel || onCooldown || !isLearned) return false;
                    }
                    return true;
                  }).map(recipe => {
                    // Hidden/undiscovered recipes — show as "???" with source hint
                    if ((recipe as unknown as Record<string, unknown>).hidden) {
                      return (
                        <div key={recipe.id} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "3px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.15)" }}>?</span>
                            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.15)" }}>???</p>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.1)" }}>{recipe.desc || "Unknown recipe"}</p>
                        </div>
                      );
                    }
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
                      <div key={recipe.id} className="forge-recipe-card rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: `3px solid ${skillUp?.color || "rgba(255,255,255,0.06)"}` }}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              {/* Craftability indicator */}
                              {isLearned && (
                                <span className="flex-shrink-0" style={{ fontSize: 12, color: !meetsLevel || onCooldown ? "rgba(255,255,255,0.15)" : canAfford ? "#22c55e" : "#f59e0b" }} title={!meetsLevel ? "Skill too low" : onCooldown ? "On cooldown" : canAfford ? "Ready to craft" : "Missing materials"}>
                                  {!meetsLevel || onCooldown ? "○" : canAfford ? "●" : "◐"}
                                </span>
                              )}
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
                              <p className="text-xs mt-1" style={{ color: "#f44" }}>Requires {selectedNpc.name} Skill {recipe.reqSkill || recipe.reqProfLevel}</p>
                            )}
                            {onCooldown && (
                              <p className="text-xs mt-1" style={{ color: "#f97316" }}>
                                Cooldown: {(recipe.cooldownRemaining ?? 0) >= 3600 ? `${Math.floor((recipe.cooldownRemaining ?? 0) / 3600)}h ${Math.floor(((recipe.cooldownRemaining ?? 0) % 3600) / 60)}m` : `${Math.ceil((recipe.cooldownRemaining ?? 0) / 60)}m`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <select
                              value={craftCount}
                              onChange={e => setCraftCount(parseInt(e.target.value, 10))}
                              disabled={!isBatchable}
                              title={!isBatchable ? "Only buff/consumable recipes support batch crafting" : `Craft x${craftCount}`}
                              className="text-xs rounded-lg px-1 py-1 font-mono"
                              style={{ background: "rgba(255,255,255,0.06)", color: isBatchable ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.1)", width: 38, cursor: isBatchable ? "pointer" : "not-allowed", opacity: isBatchable ? 1 : 0.4 }}
                            >
                              {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>x{n}</option>)}
                            </select>
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
                                onClick={() => canDo && !craftProgress && startCraftCast(recipe.id, effectiveCount)}
                                disabled={!canDo || crafting || !!craftProgress}
                                className="forge-btn text-sm px-4 py-2 rounded-lg font-semibold relative overflow-hidden"
                                style={{
                                  background: canDo ? `${selectedNpc.color}20` : "rgba(255,255,255,0.03)",
                                  color: canDo ? selectedNpc.color : "rgba(255,255,255,0.2)",
                                  border: `1px solid ${canDo ? `${selectedNpc.color}40` : "rgba(255,255,255,0.06)"}`,
                                  cursor: canDo && !crafting && !craftProgress ? "pointer" : "not-allowed",
                                }}
                                title={!canDo ? (!isLearned ? "Recipe not learned" : !meetsLevel ? "Profession level too low" : onCooldown ? `On cooldown (${Math.ceil((recipe.cooldownRemaining ?? 0) / 60)}min left)` : !hasSlotItem ? "No gear equipped in this slot" : !canAfford ? "Not enough materials or gold" : "") : craftProgress ? "Press ESC to cancel" : `Craft ${recipe.name}`}
                              >
                                {/* WoW-style cast bar overlay */}
                                {craftProgress && craftProgress.recipeId === recipe.id && (
                                  <div className="absolute inset-0 rounded-lg overflow-hidden" style={{ zIndex: 0 }}>
                                    <div
                                      className="h-full"
                                      style={{
                                        background: `linear-gradient(90deg, ${selectedNpc.color}50, ${selectedNpc.color}30)`,
                                        animation: `craft-cast-fill ${CRAFT_CAST_MS}ms linear forwards`,
                                        transformOrigin: "left",
                                      }}
                                    />
                                  </div>
                                )}
                                <span className="relative" style={{ zIndex: 1 }}>
                                  {craftProgress && craftProgress.recipeId === recipe.id ? `Crafting\u2026 ${craftProgress.total > 1 ? `${Math.min(craftProgress.current + 1, craftProgress.total)}/${craftProgress.total} ` : ''}${castCountdown ?? ""}s` : crafting ? "Crafting\u2026" : onCooldown ? "On Cooldown" : "Craft"}
                                </span>
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
                            const owned = materials[matId] || 0;
                            const has = owned >= needed;
                            const almostReady = !has && needed > 0 && owned >= needed * 0.6;
                            return (
                              <span key={matId} className={`text-sm flex items-center gap-1${almostReady ? " mat-almost-ready" : ""}`} style={{ color: has ? RARITY_COLORS[mat?.rarity || "common"] : "#f44", fontWeight: has ? "normal" : "bold" }}>
                                {!has && <span style={{ color: "#f44", fontSize: 12, lineHeight: 1 }}>●</span>}
                                <img src={mat?.icon || ""} alt="" width={16} height={16} style={{ imageRendering: "auto" }} onError={hideOnError} />
                                {owned}/{needed} {mat?.name || matId}
                              </span>
                            );
                          })}
                          {recipe.cooldownMinutes > 0 && (
                            <span className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>CD: {recipe.cooldownMinutes >= 60 ? `${Math.floor(recipe.cooldownMinutes / 60)}h` : `${recipe.cooldownMinutes}m`}</span>
                          )}
                          {(() => {
                            const skillUp = SKILL_UP_COLORS[recipe.skillUpColor || "orange"];
                            const chance = recipe.skillUpChance ?? (recipe.skillUpColor === "gray" ? 0 : recipe.skillUpColor === "green" ? 25 : recipe.skillUpColor === "yellow" ? 75 : 100);
                            const xpColor = recipe.skillUpColor === "gray" ? "#6b7280" : dailyBonusAvailable ? "#facc15" : skillUp?.color || "rgba(255,255,255,0.25)";
                            return (
                              <span className="text-sm font-mono flex items-center gap-1.5" style={{ color: xpColor }} title={`${skillUp?.label}: ${chance}% skill-up chance${dailyBonusAvailable ? " (2x daily)" : ""}`}>
                                {chance === 0 ? "—" : `${chance}%`}
                                {chance > 0 && (
                                  <span className="inline-block rounded-full overflow-hidden" style={{ width: 40, height: 2, background: "rgba(255,255,255,0.08)" }}>
                                    <span className="block h-full rounded-full" style={{ width: `${chance}%`, background: chance === 100 ? "#f97316" : chance >= 75 ? "#eab308" : chance >= 25 ? "#22c55e" : "#6b7280" }} />
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                  {/* Empty state when filter shows no results */}
                  {showCraftableOnly && recipes.filter(r => r.profession === selectedNpc.id).filter(r => !(r as unknown as Record<string, unknown>).hidden && r.learned !== false && r.canCraft && (r.cooldownRemaining ?? 0) <= 0).length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.2)" }}>
                      No craftable recipes right now. Check material stock or raise your profession skill.
                    </p>
                  )}
                </div>

                {/* Craft result toast */}
                {craftResult && (
                  <div className="relative mx-5 mb-4">
                    <div id="forge-craft-result" className="craft-result-celebrate px-3 py-2 rounded-lg text-xs font-semibold text-center" style={{ background: `${selectedNpc.color}15`, color: selectedNpc.color, border: `1px solid ${selectedNpc.color}30` }}>
                      {craftResult}
                    </div>
                    {craftResult.includes("+") && [0,1,2,3].map(i => (
                      <span key={i} className="absolute pointer-events-none" style={{
                        left: `${20 + i * 20}%`, bottom: '100%',
                        width: 4, height: 4, borderRadius: '50%',
                        background: selectedNpc.color || '#fbbf24',
                        animation: `craft-sparkle-rise 0.8s ease-out ${i * 0.1}s forwards`,
                        opacity: 0,
                      }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Tab: Enchanting (D3-style stat reroll — Verzauberer only) */}
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
                } catch (err) { console.error('[forge] enchant_roll error:', err); setEnchantResult("Network error"); }
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
                    setEnchantResult(data.error || "Something went wrong. Please try again.");
                  }
                } catch (err) { console.error('[forge] enchant_choose error:', err); setEnchantResult("Network error"); }
                setEnchantLoading(false);
              };

              return (
                <div className="tab-content-enter px-5 py-4 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
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

                      {/* Affix pool preview (D3-style "?" info) */}
                      {!enchantOptions && slotAffixRanges[enchantSlot] && (() => {
                        const rangeData = slotAffixRanges[enchantSlot];
                        const allRanges = [...(rangeData.primary || []), ...(rangeData.minor || [])];
                        if (allRanges.length === 0) return null;
                        return (
                          <div className="mt-2 rounded-lg px-2.5 py-2" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.08)" }}>
                            <p className="text-xs mb-1.5" style={{ color: "rgba(168,85,247,0.5)" }}>Possible roll ranges:</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {allRanges.map(r => {
                                const currentVal = itemStats[r.stat];
                                const isPrimary = ["kraft", "ausdauer", "weisheit", "glueck"].includes(r.stat);
                                return (
                                  <span key={r.stat} className="text-xs" style={{ color: currentVal != null ? (isPrimary ? "#60a5fa" : "#34d399") : "rgba(255,255,255,0.2)" }}>
                                    {r.stat} {r.min}–{r.max}{currentVal != null && <span style={{ color: "rgba(255,255,255,0.15)" }}> (now {currentVal})</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Cost preview */}
                      {!enchantOptions && (
                        <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                          <span>Next reroll: <strong style={{ color: "#f59e0b" }}>{enchantCost?.gold ?? Math.min(50000, Math.round(100 * Math.pow(1.5, rerollCount)))}g</strong> + <strong style={{ color: "#ff8c00" }}>{enchantCost?.essenz ?? 2} Essenz</strong></span>
                          {rerollCount >= 5 && <span style={{ color: "#f59e0b" }}>&#9888; Cost escalating</span>}
                        </div>
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
                <div className="tab-content-enter px-5 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Dismantle gear into <strong style={{ color: "#ff8c00" }}>Essenz</strong> + <strong style={{ color: "#22c55e" }}>Materials</strong>.
                    </p>
                    <button
                      onClick={() => { setAutoSalvageOpen(true); setAutoSalvageRarity("common"); fetchSalvagePreview("common"); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: "rgba(255,140,0,0.12)", color: "#ff8c00", border: "1px solid rgba(255,140,0,0.3)", cursor: "pointer" }}
                    >
                      Auto-Salvage
                    </button>
                  </div>

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
                                onClick={() => { if (!item.locked) handleDismantle(item.instanceId || item.id, item.name, rarity); }}
                                className="forge-btn relative flex items-center justify-center rounded-lg aspect-square"
                                style={{ background: `${RARITY_COLORS[rarity]}08`, border: `1px solid ${item.locked ? "rgba(250,204,21,0.3)" : `${RARITY_COLORS[rarity]}30`}`, opacity: item.locked ? 0.4 : 1, cursor: item.locked ? "not-allowed" : "pointer" }}
                                title={item.locked ? `${item.name} — Locked` : `${item.name} — Dismantle → +${ESSENZ_TABLE[rarity] || 2} Essenz + Materials`}
                              >
                                {item.icon
                                  ? <img src={item.icon} alt={item.name} style={{ width: 40, height: 40, imageRendering: "auto", objectFit: "contain" }} onError={e => { e.currentTarget.style.display = "none"; }} />
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

                  {/* ─── Reforge Legendary (D3 Ätherwürfel) ──────────────── */}
                  {(() => {
                    const legendaryItems = dismantleItems.filter(i => i.rarity === "legendary");
                    if (legendaryItems.length === 0) return null;
                    return (
                      <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="text-sm font-semibold mb-1" style={{ color: "#f97316" }}>Reforge Legendary</p>
                        <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                          Re-randomize all stats on a legendary item. Identity stays, stats are rerolled. Costs 1000g + 2 Soul Fragment + 3 Aether Core.
                        </p>
                        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))" }}>
                          {legendaryItems.slice(0, 12).map(item => (
                            <button
                              key={item.instanceId || item.id}
                              onClick={() => {
                                setConfirmAction({
                                  message: `Reforge "${item.name}"?\n\nAll stats will be completely re-randomized. The item keeps its identity but gets new rolls.\n\nCost: 1000g + 2 Soul Fragment + 3 Aether Core`,
                                  onConfirm: async () => {
                                    setConfirmAction(null);
                                    try {
                                      const r = await fetch("/api/schmiedekunst/reforge", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey!) },
                                        body: JSON.stringify({ inventoryItemId: item.instanceId || item.id }),
                                      });
                                      const data = await r.json();
                                      setDismantleResult({ message: data.message || data.error || "Something went wrong. Try again." });
                                      setTimeout(() => setDismantleResult(null), 5000);
                                      fetchData();
                                      onRefresh?.();
                                    } catch (err) { console.error('[forge] reforge error:', err); setDismantleResult({ message: "Network error" }); }
                                  },
                                });
                              }}
                              className="forge-btn relative flex items-center justify-center rounded-lg aspect-square"
                              style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.3)" }}
                              title={`${item.name} — Reforge (re-randomize stats)`}
                            >
                              {item.icon
                                ? <img src={item.icon} alt={item.name} style={{ width: 40, height: 40, imageRendering: "auto", objectFit: "contain" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                                : <span style={{ fontSize: 18, color: "#f97316" }}>◆</span>
                              }
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* ─── Tab: Transmutation (Alchemist only) ────────────────── */}
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
                <div className="tab-content-enter px-5 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
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
                                        ? <img src={item.icon} alt={item.name} style={{ width: 40, height: 40, imageRendering: "auto", objectFit: "contain" }} onError={e => { e.currentTarget.style.display = "none"; }} />
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
                <img src={confirmProf.npcPortrait} alt="" width={40} height={40} className="rounded-lg" style={{ imageRendering: "auto", border: `1px solid ${confirmProf.color}30` }} onError={e => { e.currentTarget.style.display = "none"; }} />
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

              {maxProfSlots < 2 && (
                <p className="text-xs text-center pt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Second slot unlocks at Player Level 15
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

      {/* ─── Auto-Salvage Modal ──────────────────────────────────────────── */}
      {autoSalvageOpen && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center modal-backdrop" onClick={closeAutoSalvage}>
          <div className="w-full max-w-lg rounded-xl overflow-hidden" style={{ background: "#141209", border: "1px solid rgba(255,140,0,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: "rgba(255,140,0,0.06)", borderBottom: "1px solid rgba(255,140,0,0.15)" }}>
              <p className="text-sm font-bold" style={{ color: "#ff8c00" }}>Auto-Salvage</p>
              <button onClick={closeAutoSalvage} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}><span className="text-xs font-mono" style={{ fontSize: 12 }}>ESC</span></button>
            </div>

            {/* Rarity tabs */}
            <div className="flex gap-1 px-5 pt-3">
              {(["common", "uncommon", "rare", "epic"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { setAutoSalvageRarity(r); setAutoSalvageStep(0); fetchSalvagePreview(r); }}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold capitalize"
                  style={{
                    background: autoSalvageRarity === r ? `${RARITY_COLORS[r]}18` : "rgba(255,255,255,0.03)",
                    color: autoSalvageRarity === r ? RARITY_COLORS[r] : "rgba(255,255,255,0.3)",
                    border: `1px solid ${autoSalvageRarity === r ? `${RARITY_COLORS[r]}40` : "rgba(255,255,255,0.06)"}`,
                    cursor: "pointer",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="px-5 py-3 space-y-3">
              {autoSalvageLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Loading...</span>
                </div>
              ) : autoSalvagePreview && autoSalvagePreview.count > 0 ? (
                <>
                  {/* Item grid */}
                  <div className="rounded-lg p-2 max-h-[240px] overflow-y-auto" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", scrollbarWidth: "thin" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 52px)", gap: 3 }}>
                      {autoSalvagePreview.items.map(item => {
                        const rc = RARITY_COLORS[item.rarity] || "#888";
                        return (
                          <div
                            key={item.id}
                            className="relative flex items-center justify-center rounded-lg"
                            title={item.name}
                            style={{ width: 52, height: 52, background: `${rc}08`, border: `1px solid ${rc}30` }}
                          >
                            {item.icon
                              ? <img src={item.icon} alt={item.name} width={36} height={36} style={{ imageRendering: "auto", objectFit: "contain" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                              : <span style={{ color: rc, fontSize: 18 }}>{"\u25C6"}</span>
                            }
                            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: rc }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Estimated rewards */}
                  <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,140,0,0.06)", border: "1px solid rgba(255,140,0,0.15)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Estimated Rewards</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-bold" style={{ color: "#ff8c00" }}>~{autoSalvagePreview.estimatedEssenz} Essenz</span>
                      {Object.values(autoSalvagePreview.estimatedMaterials).map(m => (
                        <span key={m.name} className="text-xs font-semibold" style={{ color: "#22c55e" }}>~{m.amount} {m.name}</span>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons — 2-step confirmation */}
                  {autoSalvageStep === 0 && (
                    <button
                      onClick={() => setAutoSalvageStep(1)}
                      className="w-full text-xs py-2.5 rounded-lg font-semibold"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
                    >
                      Salvage {autoSalvagePreview.count} Items
                    </button>
                  )}
                  {autoSalvageStep === 1 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-center" style={{ color: "#ef4444" }}>
                        This will destroy {autoSalvagePreview.count} items. This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setAutoSalvageStep(0)} className="flex-1 text-xs py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                          Cancel
                        </button>
                        <button
                          onClick={executeAutoSalvage}
                          disabled={autoSalvageLoading}
                          className="flex-1 text-xs py-2 rounded-lg font-semibold"
                          style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.5)", cursor: autoSalvageLoading ? "not-allowed" : "pointer" }}
                        >
                          {autoSalvageLoading ? "Salvaging..." : "Confirm Salvage"}
                        </button>
                      </div>
                    </div>
                  )}
                  {autoSalvageStep === 2 && (
                    <div className="text-center py-2">
                      <p className="text-xs font-semibold" style={{ color: "#4ade80" }}>Salvage complete!</p>
                      <button onClick={closeAutoSalvage} className="text-xs mt-2 px-4 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>Close</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                    No {autoSalvageRarity} items to salvage.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Ätherwürfel Modal ──────────────────────────────────────────── */}
      {cubeOpen && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center modal-backdrop" onClick={closeCube}>
          <div className="w-full max-w-xl rounded-xl overflow-hidden" style={{ background: "#12100a", border: "1px solid rgba(249,115,22,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: "rgba(249,115,22,0.06)", borderBottom: "1px solid rgba(249,115,22,0.15)" }}>
              <p className="text-sm font-bold" style={{ color: "#f97316" }}>Ätherwürfel</p>
              <button onClick={closeCube} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}><span className="text-xs font-mono" style={{ fontSize: 12 }}>ESC</span></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* 3 Hex Slots */}
              <div className="grid grid-cols-3 gap-3">
                {(["offensive", "defensive", "utility"] as const).map(slot => {
                  const active = cubeData?.[slot];
                  const colors = { offensive: "#ef4444", defensive: "#3b82f6", utility: "#22c55e" };
                  const c = colors[slot];
                  const slotEffects = cubeData?.library.filter(e => e.category === slot) || [];
                  return (
                    <div key={slot} className="rounded-xl p-3 text-center space-y-2" style={{ background: `${c}06`, border: `1px solid ${c}25` }}>
                      <p className="text-xs uppercase font-bold tracking-wider" style={{ color: `${c}90` }}>{slot}</p>
                      {active ? (
                        <>
                          <p className="text-xs font-semibold" style={{ color: c }}>{active.label}</p>
                          <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{active.value}%</p>
                          <button onClick={() => handleCubeUnequip(slot)} disabled={cubeLoading} className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)", cursor: cubeLoading ? "not-allowed" : "pointer" }}>Remove</button>
                        </>
                      ) : (
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>Empty</p>
                      )}
                      {/* Dropdown to equip from library */}
                      {slotEffects.length > 0 && (
                        <select
                          value={active?.type || ""}
                          onChange={e => { if (e.target.value) handleCubeEquip(slot, e.target.value); }}
                          className="w-full text-xs rounded px-1 py-1 mt-1"
                          style={{ background: "rgba(0,0,0,0.4)", color: c, border: `1px solid ${c}30`, cursor: "pointer" }}
                        >
                          <option value="">Select effect...</option>
                          {slotEffects.map(e => (
                            <option key={e.type} value={e.type}>{e.label} ({e.value}%)</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Result message */}
              {cubeResult && (
                <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "#f97316" }}>
                  {cubeResult}
                </div>
              )}

              {/* Extract section: show legendary items in inventory */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Extract Effect (destroys item, costs 500 Essenz)</p>
                {(() => {
                  const cubeInv = getUserInventory(loggedInUser);
                  const legendaryInv = cubeInv.filter(
                    (i: InventoryItem) => i.legendaryEffect && i.legendaryEffect.type && i.rarity === "legendary"
                  );
                  const alreadyExtracted = new Set((cubeData?.library || []).map(e => e.type));
                  if (legendaryInv.length === 0) return <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>No legendary items with effects in inventory.</p>;
                  return (
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))" }}>
                      {legendaryInv.map(item => {
                        const extracted = alreadyExtracted.has(item.legendaryEffect!.type);
                        const id = item.instanceId || item.id;
                        return (
                          <button
                            key={id}
                            onClick={() => { if (!extracted) setCubeExtractId(cubeExtractId === id ? null : id); }}
                            disabled={extracted}
                            title={extracted ? `${item.name} — already extracted` : `${item.name} — ${item.legendaryEffect?.label || item.legendaryEffect?.type}`}
                            className="relative flex items-center justify-center rounded-lg aspect-square"
                            style={{
                              background: cubeExtractId === id ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.04)",
                              border: `2px solid ${cubeExtractId === id ? "#f97316" : extracted ? "rgba(255,255,255,0.06)" : "rgba(249,115,22,0.2)"}`,
                              opacity: extracted ? 0.3 : 1,
                              cursor: extracted ? "not-allowed" : "pointer",
                            }}
                          >
                            {item.icon
                              ? <img src={item.icon} alt={item.name} style={{ width: 36, height: 36, imageRendering: "auto", objectFit: "contain" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                              : <span style={{ fontSize: 18, color: "#f97316" }}>{"\u25C6"}</span>
                            }
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                {cubeExtractId && (() => {
                  const item = getUserInventory(loggedInUser).find((i: InventoryItem) => (i.instanceId || i.id) === cubeExtractId);
                  if (!item) return null;
                  return (
                    <div className="mt-3 rounded-lg px-3 py-2 space-y-2" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Destroy <strong style={{ color: "#f97316" }}>{item.name}</strong> to extract:
                      </p>
                      <p className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
                        {item.legendaryEffect?.label || item.legendaryEffect?.type} (at minimum value)
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setCubeExtractId(null)} className="flex-1 text-xs py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>Cancel</button>
                        <button
                          onClick={() => handleCubeExtract(cubeExtractId)}
                          disabled={cubeLoading}
                          className="flex-1 text-xs py-2 rounded-lg font-semibold"
                          style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", cursor: cubeLoading ? "not-allowed" : "pointer" }}
                        >
                          {cubeLoading ? "Extracting..." : "Extract (500 Essenz)"}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Library — all extracted effects */}
              {cubeData && cubeData.library.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Effect Library ({cubeData.library.length})
                  </p>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                    {cubeData.library.map(e => {
                      const colors = { offensive: "#ef4444", defensive: "#3b82f6", utility: "#22c55e" };
                      const c = colors[e.category as keyof typeof colors] || "#888";
                      return (
                        <div key={e.type} className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: `${c}06`, border: `1px solid ${c}12` }}>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold" style={{ color: c }}>{e.label}</p>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>from {e.extractedFrom} · {e.value}%</p>
                          </div>
                          <span className="text-xs uppercase font-semibold flex-shrink-0" style={{ color: `${c}60` }}>{e.category}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
