"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useDashboard } from "@/app/DashboardContext";

import { useModalBehavior } from "@/components/ModalPortal";
import { getAuthHeaders } from "@/lib/auth-client";
import { Tip, TipCustom } from "@/components/GameTooltip";
import { RARITY_COLORS, RARITY_ORDER, RARITY_LABELS } from "@/app/constants";

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

// ─── WoW Classic rank training costs (mirrors backend RANK_TRAINING_COSTS) ──
const RANK_TRAINING_COSTS = [
  { rank: "Journeyman", fromCap: 75, toCap: 150, cost: 500, reqPlayerLevel: 15, reqSkill: 50 },
  { rank: "Expert", fromCap: 150, toCap: 225, cost: 2000, reqPlayerLevel: 25, reqSkill: 125 },
  { rank: "Artisan", fromCap: 225, toCap: 300, cost: 5000, reqPlayerLevel: 40, reqSkill: 200 },
];


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
  waffenschmied: { partner: "lederverarbeiter", label: "Grip Mastery" },
  juwelier: { partner: "alchemist", label: "Transmutation" },
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

// ─── WoW-style recipe type names per profession ────────────────────────────
const RECIPE_TYPE_NAME: Record<string, string> = {
  schmied: "Bauplan", schneider: "Muster", alchemist: "Rezeptur",
  koch: "Rezept", verzauberer: "Formel", lederverarbeiter: "Vorlage",
  waffenschmied: "Entwurf", juwelier: "Design",
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
  const [npcModalTab, setNpcModalTab] = useState<"recipes" | "trainer" | "schmiedekunst" | "transmutation" | "enchanting">("recipes");
  // infoOpen state removed — info now shown via hover tooltip on header
  const [choosingProf, setChoosingProf] = useState(false);
  const [confirmProf, setConfirmProf] = useState<ProfessionDef | null>(null);
  const [profCelebration, setProfCelebration] = useState<ProfessionDef | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [dailyBonusAvailable, setDailyBonusAvailable] = useState(false);
  const [moonlightActive, setMoonlightActive] = useState(false);
  const [craftCount, setCraftCount] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [craftedItemCelebration, setCraftedItemCelebration] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [buyingTool, setBuyingTool] = useState<string | null>(null);
  const [slotAffixRanges, setSlotAffixRanges] = useState<Record<string, { primary: { stat: string; min: number; max: number }[]; minor: { stat: string; min: number; max: number }[]; currentStats: Record<string, number>; itemName: string; rarity: string }>>({});
  const [workshopUpgrades, setWorkshopUpgrades] = useState<{ id: string; name: string; desc: string; icon: string; category: string; currentTier: number; maxTier: number; currentValue: number; nextTier: { tier: number; cost: number; currency: string; value: number; label: string } | null }[]>([]);
  const [buyingUpgrade, setBuyingUpgrade] = useState<string | null>(null);
  // Recipe search & filter state
  const [recipeSearch, setRecipeSearch] = useState("");
  const [showCraftableOnly, setShowCraftableOnly] = useState(false);
  const [showHaveMatsOnly, setShowHaveMatsOnly] = useState(false);
  const [recipeSort, setRecipeSort] = useState<"default" | "skill" | "name" | "color">("default");
  const [recipeSlotFilter, setRecipeSlotFilter] = useState<string>("all");
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
  const [rankUpCelebration, setRankUpCelebration] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [craftPreview, setCraftPreview] = useState<{ recipeId: string; data: any } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
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
  // Skill bracket collapse state for recipe list
  const [collapsedBrackets, setCollapsedBrackets] = useState<Set<string>>(new Set());
  // Track which recipes were newly learned (for NEW badge — clears on NPC modal close)
  const [newlyLearned, setNewlyLearned] = useState<Set<string>>(new Set());

  // Close callbacks for modal behavior hooks
  const closeNpcModal = useCallback(() => {
    setSelectedNpc(null); setCraftResult(null); setDismantleResult(null); setTransmuteResult(null); setSelectedTransmute([]);
    setEnchantSlot("weapon"); setEnchantStat(null); setEnchantOptions(null); setEnchantCost(null); setEnchantResult(null);
    setCraftProgress(null); setNewlyLearned(new Set());
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

  // WoW-style craft with cast bar — scales by recipe result rarity
  const CAST_MS_BY_RARITY: Record<string, number> = { common: 3000, uncommon: 3500, rare: 4000, epic: 5000, legendary: 6000 };
  const getCraftCastMs = (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    const rarity = (recipe?.result as unknown as Record<string, unknown>)?.rarity as string || (recipe as unknown as Record<string, unknown>)?.rarity as string || "common";
    return CAST_MS_BY_RARITY[rarity] || 3000;
  };
  const craftTimerRef = useRef<number | null>(null);
  const craftCastMsRef = useRef(3000);

  const startCraftCast = (recipeId: string, count = 1) => {
    if (crafting || craftProgress || !reviewApiKey) return;
    const castMs = getCraftCastMs(recipeId);
    craftCastMsRef.current = castMs;
    setCraftProgress({ recipeId, current: 0, total: count, startTime: Date.now() });
    // After cast time, execute the actual craft
    craftTimerRef.current = window.setTimeout(() => {
      setCraftProgress(null);
      handleCraft(recipeId, count);
    }, castMs);
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
      const remaining = Math.max(0, craftCastMsRef.current - elapsed) / 1000;
      setCastCountdown(remaining > 0.05 ? remaining.toFixed(1) : null);
      if (remaining > 0) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [craftProgress]);

  const handleCraft = async (recipeId: string, count = 1) => {
    if (crafting || !reviewApiKey) return;
    const prevSkill = selectedNpc?.skill || selectedNpc?.playerXp || 0;
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
        if (data.atSkillCap && data.nextRankNeeded) msg += ` — Skill Cap reached! Train ${data.nextRankNeeded} to continue.`;
        else if (data.skillGained > 0) msg += ` (+${data.skillGained} Skill${data.dailyBonusUsed ? " \u2606 Daily Bonus!" : ""})`;
        else if (data.skillGained === 0 && data.skillUpColor !== "gray") msg += " (No skill-up)";
        if (data.newSkill) msg += ` [${data.newSkill}/${data.skillCap || 300}]`;
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
        // Rank milestone celebration
        if (data.newSkill) {
          const ns = data.newSkill;
          const milestones: [number, string][] = [[300, "Artisan — Meisterrang!"], [225, "Expert erreicht!"], [150, "Journeyman erreicht!"], [75, "Apprentice gemeistert!"]];
          for (const [threshold, label] of milestones) {
            if (prevSkill < threshold && ns >= threshold) {
              setRankUpCelebration(label);
              setTimeout(() => setRankUpCelebration(null), 3000);
              break;
            }
          }
        }
        // Epic+ gear craft celebration popup
        if (data.craftedItem && (data.craftedItem.rarity === "epic" || data.craftedItem.rarity === "legendary")) {
          setCraftedItemCelebration(data.craftedItem);
          setTimeout(() => setCraftedItemCelebration(null), 4000);
        }
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

  const toggleCraftPreview = async (recipeId: string) => {
    if (craftPreview?.recipeId === recipeId) { setCraftPreview(null); return; }
    if (previewLoading) return;
    setPreviewLoading(recipeId);
    try {
      const r = await fetch("/api/professions/craft-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ recipeId, targetSlot: selectedSlot }),
      });
      const data = await r.json();
      if (r.ok) setCraftPreview({ recipeId, data });
      else setCraftResult(data.error || "Preview failed");
    } catch { setCraftResult("Network error"); }
    setPreviewLoading(null);
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
        setNewlyLearned(prev => new Set([...prev, recipeId]));
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
      if (data.created) {
        setCraftedItemCelebration({
          name: data.created.name,
          rarity: data.created.rarity || "legendary",
          slot: data.created.slot,
          stats: data.created.stats,
          sockets: data.created.sockets,
          legendaryEffect: data.created.legendaryEffect,
          setId: data.created.setId,
        });
        setTimeout(() => setCraftedItemCelebration(null), 4000);
      }
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
        const chosenProf = professions.find(p => p.id === profId);
        if (chosenProf) setProfCelebration(chosenProf);
        else setCraftResult(data.message || "Profession chosen!");
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
    const prof = professions.find(p => p.id === profId);
    const profSkill = prof?.skill || prof?.playerXp || 0;
    const profRank = prof?.rank || "Novice";
    const learnedCount = recipes.filter(r => r.profession === profId && r.learned).length;
    setConfirmAction({
      message: `Drop ${profName}?\n\nYou will lose:\n• Skill: ${profSkill} → 0\n• Rank: ${profRank} → Novice\n• ${learnedCount} learned recipe${learnedCount !== 1 ? "s" : ""}\n\nThis cannot be undone.`,
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
    <div className={`space-y-4 tab-content-enter${moonlightActive ? " mondlicht-bg" : ""}`} style={{ position: "relative" }}>
      {/* Ambient forge sparks */}
      {[0,1,2].map(i => (
        <div key={`spark-${i}`} className="absolute pointer-events-none" style={{
          width: 2, height: 2, borderRadius: "50%",
          background: moonlightActive ? "#818cf8" : "#f59e0b",
          boxShadow: `0 0 4px ${moonlightActive ? "#818cf880" : "#f59e0b80"}`,
          right: `${20 + i * 30}px`, top: `${8 + i * 12}px`,
          animation: `ambient-spark ${moonlightActive ? 1.5 + i * 0.5 : 2 + i * 0.7}s ease-in-out ${i * 0.8}s infinite`,
        }} />
      ))}
      {/* Mondlicht-Schmiede particles — extra indigo particles when active */}
      {moonlightActive && [0,1,2,3].map(i => (
        <div key={`moon-${i}`} className="absolute pointer-events-none" style={{
          width: 2, height: 3, borderRadius: 1,
          background: "rgba(129,140,248,0.7)",
          boxShadow: "0 0 6px rgba(129,140,248,0.5)",
          left: `${10 + i * 22}%`, top: `${5 + (i % 2) * 15}px`,
          animation: `crystal-particle-rise ${2 + i * 0.4}s ease-out ${i * 0.6}s infinite`,
        }} />
      ))}
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
          <button onClick={() => setMatStorageOpen(o => !o)} className="text-xs px-2 py-1 rounded" style={{ color: matStorageOpen ? "#22c55e" : "rgba(255,255,255,0.3)", border: `1px solid ${matStorageOpen ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer" }} title="Toggle material storage">
            Materials
          </button>
          {onNavigate && (
            <button onClick={() => onNavigate("character")} className="cross-nav-link text-sm px-3 py-1 rounded" style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Character &rarr;
            </button>
          )}
        </div>
      </div>

      {/* ─── Profession Guide (expandable) ─────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => setGuideOpen(g => !g)} className="w-full flex items-center justify-between px-4 py-2.5 text-left" style={{ cursor: "pointer" }}>
          <span className="text-xs font-semibold uppercase tracking-wider text-w30">
            {chosenCount === 0 ? "Wie funktionieren Berufe?" : "Berufe-Handbuch"}
          </span>
          <span className="text-xs text-w20">{guideOpen ? "▲" : "▼"}</span>
        </button>
        {(guideOpen || chosenCount === 0) && (
          <div className="px-4 pb-4 space-y-3 tab-content-enter" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className="rounded-lg p-3" style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.12)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "#f97316" }}>Beruf wählen</p>
                <p className="text-xs text-w40">Klicke auf einen NPC um seinen Beruf zu lernen. Du kannst <strong className="text-w60">2 Hauptberufe</strong> (Rüstung/Waffen/Schmuck) gleichzeitig haben. Kochkunst und Verzauberung sind Nebenberufe und belegen keinen Slot.</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "#fbbf24" }}>Rezepte lernen</p>
                <p className="text-xs text-w40">Kaufe Rezepte beim Meister für Gold. Seltene Rezepte droppen aus Quests (<span style={{ color: "#3b82f6" }}>Blau</span>) oder erfordern Fraktionsruf (<span style={{ color: "#a855f7" }}>Lila</span>). Unbekannte Rezepte erscheinen als <span className="text-w20">???</span>.</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "#22c55e" }}>Skill-System (0-300)</p>
                <p className="text-xs text-w40">Jedes Craft hat eine Skill-Up Chance: <span style={{ color: "#f97316" }}>Orange</span> = 100%, <span style={{ color: "#eab308" }}>Gelb</span> = ~75%, <span style={{ color: "#22c55e" }}>Grün</span> = ~25%, <span className="text-w20">Grau</span> = 0%. Skill-Cap wird durch <strong className="text-w60">Rangtraining</strong> beim Meister erhöht.</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.12)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "#a855f7" }}>Ränge & Materialien</p>
                <p className="text-xs text-w40">4 Ränge: <span style={{ color: "#22c55e" }}>Apprentice</span> → <span style={{ color: "#3b82f6" }}>Journeyman</span> → <span style={{ color: "#a855f7" }}>Expert</span> → <span style={{ color: "#f59e0b" }}>Artisan</span>. Materialien droppen automatisch aus Quests basierend auf deinem Beruf.</p>
              </div>
            </div>
            {chosenCount === 0 && (
              <p className="text-xs text-center pt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                Wähle unten einen Meister aus um deinen ersten Beruf zu erlernen.
              </p>
            )}
          </div>
        )}
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
            <div className="flex items-center gap-3 mb-3 px-1">
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), rgba(255,255,255,0.06))" }} />
              <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>{cat.label}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{cat.desc}</span>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.18), transparent)" }} />
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
          <div key={prof.id} className={`rounded-xl overflow-hidden npc-rank-glow ${locked ? "" : "npc-card-hover"}${moonlightActive && !locked ? " mondlicht-glow" : ""}`} data-rank={prof.rank || "Novice"} style={{ background: locked ? "rgba(255,255,255,0.02)" : `${prof.color}06`, border: `1px solid ${locked ? "rgba(255,255,255,0.05)" : `${prof.color}25`}`, opacity: locked ? 0.5 : 1, boxShadow: locked ? "none" : rankGlow }}>
            {/* Location header */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <Tip k={`prof_${prof.id}`} heading><span className="text-sm font-semibold uppercase tracking-widest" style={{ color: `${loc.color}70` }}>{loc.label}</span></Tip>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>{loc.desc}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {isChosen && (() => {
                    const craftableCount = recipes.filter(r => r.profession === prof.id && r.canCraft && r.learned && (r.cooldownRemaining ?? 0) <= 0).length;
                    return <>
                      {craftableCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>{craftableCount}</span>}
                      <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: `${prof.color}18`, color: prof.color }}>Active</span>
                    </>;
                  })()}
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
                  <p className="text-sm line-clamp-2 overflow-hidden" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{prof.description}
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
                  <span className="text-sm font-mono font-semibold" style={{ color: prof.rankColor || prof.color }}>{prof.skill || prof.playerXp || 0}/{prof.skillCap || 300} <span className="text-xs font-sans font-normal" style={{ opacity: 0.6 }}>{prof.rank || "Novice"}</span></span>
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
              {/* Quick output summary — what this profession creates */}
              {!locked && !isChosen && (() => {
                const outputs: Record<string, string> = {
                  schmied: "Helme, Rüstungen, Stiefel",
                  schneider: "Stoffrüstung (Helm, Körper, Stiefel)",
                  lederverarbeiter: "Lederrüstung (Helm, Körper, Stiefel)",
                  waffenschmied: "Waffen, Schilde",
                  juwelier: "Ringe, Amulette, geschliffene Edelsteine",
                  alchemist: "Tränke, Elixiere, Flasks",
                  koch: "Mahlzeiten, Streak-Schutz, Buffs",
                  verzauberer: "Verzauberungen, Vellums, Infusionen",
                };
                return outputs[prof.id] ? (
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Stellt her: {outputs[prof.id]}
                  </p>
                ) : null;
              })()}
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
      <div id="mat-storage-section" className="space-y-2">
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
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
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
                        <img src={m.icon} alt={m.name} width={36} height={36} style={{ imageRendering: "auto", flexShrink: 0 }} onError={hideOnError} />
                      ) : (
                        <span className="flex-shrink-0" style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: rc, fontSize: 16 }}>{"\u25C6"}</span>
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
                      <p className="text-sm line-clamp-2 overflow-hidden" style={{ color: "rgba(255,255,255,0.3)" }}>{gear.desc}</p>
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
                            if (r.ok) {
                              onRefresh?.(); fetchData();
                              setCraftedItemCelebration({
                                name: gear.name,
                                rarity: "epic",
                                slot: null,
                                stats: {},
                                sockets: null,
                                legendaryEffect: null,
                                setId: null,
                              });
                              setTimeout(() => setCraftedItemCelebration(null), 4000);
                            }
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
                          if (r.ok) {
                            onRefresh?.(); fetchData();
                            setCraftedItemCelebration({
                              name: `${up.name} — ${next.label || "Upgraded"}`,
                              rarity: "epic",
                              slot: null,
                              stats: {},
                              sockets: null,
                              legendaryEffect: null,
                              setId: null,
                            });
                            setTimeout(() => setCraftedItemCelebration(null), 4000);
                          }
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
          <div className="relative w-full max-w-[calc(100vw-2rem)] sm:max-w-xl rounded-xl npc-modal-content" style={{ background: "#141418", border: `1px solid ${selectedNpc.color}30`, maxHeight: "85vh", overflowY: "auto", overflowX: "hidden" }}>
            {/* Close */}
            <button onClick={closeNpcModal} className="forge-btn absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              <span className="text-white text-sm">&#10005;</span>
            </button>

            {/* Rank milestone celebration overlay */}
            {rankUpCelebration && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ background: "rgba(0,0,0,0.5)" }}>
                <div className="rank-up-celebration px-8 py-5 rounded-xl text-center" style={{
                  background: `linear-gradient(135deg, ${selectedNpc.color}30, ${selectedNpc.color}10)`,
                  border: `2px solid ${selectedNpc.color}80`,
                  boxShadow: `0 0 40px ${selectedNpc.color}40, 0 0 80px ${selectedNpc.color}20`,
                }}>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Rank Up</p>
                  <p className="text-xl font-bold" style={{ color: selectedNpc.color }}>{rankUpCelebration}</p>
                </div>
              </div>
            )}

            {/* Epic+ crafted item celebration overlay */}
            {craftedItemCelebration && (() => {
              const ci = craftedItemCelebration;
              const rc = RARITY_COLORS[ci.rarity] || "#a855f7";
              return (
                <div
                  className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.65)" }}
                  onClick={() => setCraftedItemCelebration(null)}
                >
                  <div className="reward-burst-enter px-6 py-5 rounded-xl text-center max-w-xs w-full" style={{
                    background: `linear-gradient(135deg, ${rc}18, rgba(11,13,17,0.95))`,
                    border: `2px solid ${rc}80`,
                    boxShadow: `0 0 60px ${rc}30, 0 0 120px ${rc}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  }}>
                    <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Masterwork Forged</p>
                    <p className="text-lg font-bold mb-1 item-drop-in" style={{ color: rc, filter: `drop-shadow(0 0 8px ${rc}60)` }}>{ci.name}</p>
                    <p className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: `${rc}aa` }}>
                      {RARITY_LABELS[ci.rarity] || ci.rarity} {ci.slot ? `\u00b7 ${ci.slot}` : ""}
                    </p>
                    {ci.stats && Object.keys(ci.stats).length > 0 && (
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mb-3">
                        {Object.entries(ci.stats as Record<string, number>).map(([stat, val]) => (
                          <span key={stat} className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.7)" }}>
                            {stat} <span style={{ color: "#22c55e" }}>+{val}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {ci.sockets && ci.sockets.length > 0 && (
                      <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                        ◇ {ci.sockets.length} Socket{ci.sockets.length > 1 ? "s" : ""}
                      </p>
                    )}
                    {ci.legendaryEffect && (
                      <p className="text-xs mb-2 italic" style={{ color: "#f97316" }}>
                        ★ {ci.legendaryEffect.type?.replace(/_/g, " ")} +{ci.legendaryEffect.value ?? ci.legendaryEffect.min ?? "?"}%
                      </p>
                    )}
                    {ci.setId && (
                      <p className="text-xs mb-2" style={{ color: "#3b82f6" }}>
                        Set: {ci.setId}
                      </p>
                    )}
                    {moonlightActive && (
                      <p className="text-xs" style={{ color: "#c4b5fd" }}>
                        ☽ Mondlicht-Bonus
                      </p>
                    )}
                    <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.2)" }}>Click to dismiss</p>
                  </div>
                </div>
              );
            })()}

            {/* NPC Header — profession-colored */}
            <div className="p-5 pb-3 relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${selectedNpc.color}18 0%, ${selectedNpc.color}06 60%, transparent 100%)`, borderBottom: `1px solid ${selectedNpc.color}15` }}>
              {/* Moonlight stars in modal background */}
              {moonlightActive && [0,1,2,3,4].map(i => (
                <div key={`mstar-${i}`} className="absolute pointer-events-none" style={{
                  width: 2, height: 2, borderRadius: "50%",
                  background: "rgba(196,181,253,0.5)",
                  boxShadow: "0 0 4px rgba(196,181,253,0.4)",
                  left: `${10 + i * 20}%`, top: `${8 + (i % 3) * 12}px`,
                  animation: `ambient-spark ${2.5 + i * 0.6}s ease-in-out ${i * 0.5}s infinite`,
                }} />
              ))}
              <div className="flex items-center gap-4 relative">
                <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0" style={{ border: `2px solid ${selectedNpc.color}60`, boxShadow: `0 0 20px ${selectedNpc.color}25` }}>
                  <img src={selectedNpc.npcPortrait} alt="" width={96} height={96} style={{ imageRendering: "auto", width: "100%", height: "100%", objectFit: "cover" }} onError={hideOnError} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold truncate" style={{ color: selectedNpc.color }}>{selectedNpc.npcName}</p>
                    {selectedNpc.rank && selectedNpc.rank !== "Novice" && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: `${selectedNpc.rankColor}15`, color: selectedNpc.rankColor, border: `1px solid ${selectedNpc.rankColor}30` }}>{selectedNpc.rank}</span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{selectedNpc.name} &middot; {selectedNpc.rank || "Novice"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TipCustom title="Profession Skill" icon="◆" accent={selectedNpc.color} body={<>
                      <p>Current Skill: <strong>{selectedNpc.skill || 0}</strong> / {selectedNpc.skillCap || 75} (Cap)</p>
                      <p style={{ marginTop: 4, opacity: 0.6 }}>Maximum possible: {selectedNpc.maxSkill || 300}. Train higher ranks to raise your cap.</p>
                      <p style={{ marginTop: 4, opacity: 0.6 }}>Skill-Up Colors: <span style={{ color: "#f97316" }}>Orange</span>=100%, <span style={{ color: "#eab308" }}>Yellow</span>=~75%, <span style={{ color: "#22c55e" }}>Green</span>=~25%, Gray=0%</p>
                    </>}>
                      <div className={`w-32 progress-bar-diablo${skillUpFlash ? " skill-bar-flash" : ""}`} style={{ height: 7, cursor: "help" }}>
                        <div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${selectedNpc.color}cc, ${selectedNpc.color})`, width: `${Math.min(100, ((selectedNpc.skill || selectedNpc.playerXp || 0) / (selectedNpc.skillCap || 300)) * 100)}%`, boxShadow: `0 0 6px ${selectedNpc.color}40` }} />
                      </div>
                    </TipCustom>
                    <span className="text-sm font-mono" style={{ color: selectedNpc.rankColor || "rgba(255,255,255,0.35)" }}>
                      {selectedNpc.skill || selectedNpc.playerXp || 0}<span style={{ color: "rgba(255,255,255,0.2)" }}>/{selectedNpc.skillCap || 75}</span>
                    </span>
                  </div>
                </div>
              </div>
              {/* WoW-style "Visit Trainer" warning when near skill cap */}
              {selectedNpc.chosen && (selectedNpc.skill || 0) >= (selectedNpc.skillCap || 75) - 5 && (selectedNpc.skill || 0) < (selectedNpc.maxSkill || 300) && (
                <div className="mt-2 rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <span className="text-xs" style={{ color: "#fbbf24" }}>&#9888;</span>
                  <p className="text-xs" style={{ color: "#fbbf24" }}>
                    Dein Skill nähert sich dem Cap ({selectedNpc.skillCap || 75}). Gehe zum <strong onClick={() => setNpcModalTab("trainer" as typeof npcModalTab)} style={{ cursor: "pointer", textDecoration: "underline" }}>Trainer-Tab</strong> um deinen Rang zu erhöhen!
                  </p>
                </div>
              )}
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
                    title={`Drop ${selectedNpc.name} (free, but resets all progress permanently)`}
                  >
                    Unlearn
                  </button>
                )}
              </div>
              {/* Materials moved to Material Storage section — no longer duplicated here */}
            </div>

            {/* Tab bar */}
            {(() => {
              const tabs: { key: typeof npcModalTab; label: string; color: string }[] = [
                { key: "recipes", label: "Recipes", color: selectedNpc.color },
                { key: "trainer", label: "Trainer", color: "#fbbf24" },
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
              // Always show tabs (at least Recipes + Trainer)
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
                {/* Not enrolled gate */}
                {!selectedNpc.chosen && (
                  <div className="px-5 py-4 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>You haven&apos;t learned this profession yet.</p>
                    <button
                      onClick={() => setConfirmProf(selectedNpc)}
                      disabled={choosingProf || professions.filter(p => p.chosen && !["koch", "verzauberer"].includes(p.id)).length >= maxProfSlots}
                      className="text-sm px-5 py-2.5 rounded-lg font-semibold"
                      style={{ background: `${selectedNpc.color}20`, color: selectedNpc.color, border: `1px solid ${selectedNpc.color}40`, cursor: "pointer" }}
                    >
                      Choose {selectedNpc.name}
                    </button>
                    <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>Browse recipes below to see what this profession offers.</p>
                  </div>
                )}
                {/* Recipe discovery counter + WoW-style color breakdown */}
                {(() => {
                  const profRecipes = recipes.filter(r => r.profession === selectedNpc.id);
                  const discovered = profRecipes.filter(r => !(r as unknown as Record<string, unknown>).hidden).length;
                  const total = totalRecipesByProf[selectedNpc.id] || profRecipes.length;
                  const learned = profRecipes.filter(r => r.learned !== false && !(r as unknown as Record<string, unknown>).hidden);
                  const colorCounts = { orange: 0, yellow: 0, green: 0, gray: 0 };
                  for (const r of learned) { colorCounts[(r.skillUpColor as keyof typeof colorCounts) || "gray"]++; }
                  return (
                    <div className="px-5 pt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                          {discovered}/{total} recipes discovered
                        </span>
                        {discovered >= total && <span className="text-xs font-semibold" style={{ color: "#4ade80" }}>Complete</span>}
                      </div>
                      {selectedNpc.chosen && learned.length > 0 && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Skill-up:</span>
                          {colorCounts.orange > 0 && <span className="text-xs font-mono font-bold" style={{ color: "#f97316" }}>{colorCounts.orange}</span>}
                          {colorCounts.yellow > 0 && <span className="text-xs font-mono font-bold" style={{ color: "#eab308" }}>{colorCounts.yellow}</span>}
                          {colorCounts.green > 0 && <span className="text-xs font-mono font-bold" style={{ color: "#22c55e" }}>{colorCounts.green}</span>}
                          {colorCounts.gray > 0 && <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>{colorCounts.gray}</span>}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Slot selector for Schmied/Verzauberer */}
                {selectedNpc.id === "verzauberer" && (npcModalTab as string) === "enchanting" && (
                  <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Enchantment Target</p>
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
                  {/* Compact filter bar: search + toggles on one row */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        value={recipeSearch}
                        onChange={e => setRecipeSearch(e.target.value)}
                        placeholder="Search..."
                        className="input-dark w-full text-xs px-2.5 py-1.5 rounded-lg pr-6"
                        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
                      />
                      {recipeSearch && (
                        <button onClick={() => setRecipeSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded text-xs" style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>&#10005;</button>
                      )}
                    </div>
                    <button onClick={() => setShowCraftableOnly(v => !v)} className="text-xs px-2 py-1.5 rounded-lg font-medium whitespace-nowrap" style={{ background: showCraftableOnly ? `${selectedNpc.color}18` : "rgba(255,255,255,0.04)", color: showCraftableOnly ? selectedNpc.color : "rgba(255,255,255,0.25)", border: `1px solid ${showCraftableOnly ? `${selectedNpc.color}30` : "rgba(255,255,255,0.06)"}`, cursor: "pointer" }} title="Show only recipes you can craft right now">Craftable</button>
                    <button onClick={() => setShowHaveMatsOnly(v => !v)} className="text-xs px-2 py-1.5 rounded-lg font-medium whitespace-nowrap" style={{ background: showHaveMatsOnly ? `${selectedNpc.color}18` : "rgba(255,255,255,0.04)", color: showHaveMatsOnly ? selectedNpc.color : "rgba(255,255,255,0.25)", border: `1px solid ${showHaveMatsOnly ? `${selectedNpc.color}30` : "rgba(255,255,255,0.06)"}`, cursor: "pointer" }} title="Show only recipes where you have all materials">Materials</button>
                    <select
                      value={recipeSort}
                      onChange={e => setRecipeSort(e.target.value as typeof recipeSort)}
                      className="text-xs px-1.5 py-1.5 rounded-lg input-dark"
                      style={{ background: recipeSort !== "default" ? `${selectedNpc.color}18` : "rgba(255,255,255,0.04)", color: recipeSort !== "default" ? selectedNpc.color : "rgba(255,255,255,0.25)", border: `1px solid ${recipeSort !== "default" ? `${selectedNpc.color}30` : "rgba(255,255,255,0.06)"}`, cursor: "pointer" }}
                      title="Sort recipes"
                    >
                      <option value="default">Sort: Skill</option>
                      <option value="name">Sort: A-Z</option>
                      <option value="color">Sort: Color</option>
                    </select>
                    <TipCustom title="Skill-Up Colors" icon="◆" accent={selectedNpc.color} body={<div className="space-y-1">{Object.entries(SKILL_UP_COLORS).map(([k, sc]) => <p key={k} style={{ color: sc.color }}>{sc.label}: {k === "orange" ? "100%" : k === "yellow" ? "~75%" : k === "green" ? "~25%" : "0%"} skill-up</p>)}</div>}>
                      <span className="flex items-center gap-0.5 cursor-help" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {Object.values(SKILL_UP_COLORS).map((sc, i) => <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />)}
                      </span>
                    </TipCustom>
                  </div>
                  {/* Slot filter — compact pills */}
                  <div className="flex gap-1 flex-wrap mb-2">
                    {["all", "weapon", "shield", "helm", "armor", "amulet", "ring", "boots", "consumable"].map(s => (
                      <button key={s} onClick={() => setRecipeSlotFilter(s)} className="text-xs px-2 py-0.5 rounded" style={{ background: recipeSlotFilter === s ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)", color: recipeSlotFilter === s ? "#e8e8e8" : "rgba(255,255,255,0.2)", border: `1px solid ${recipeSlotFilter === s ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)"}`, cursor: "pointer" }}>{s === "all" ? "All" : s === "consumable" ? "Buffs" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
                    ))}
                  </div>
                  {(() => {
                    const SKILL_BRACKETS = [
                      { name: "Apprentice", min: 0, max: 75, color: "#22c55e" },
                      { name: "Journeyman", min: 75, max: 150, color: "#3b82f6" },
                      { name: "Expert", min: 150, max: 225, color: "#a855f7" },
                      { name: "Artisan", min: 225, max: 300, color: "#f59e0b" },
                    ];
                    const playerSkill = selectedNpc.skill || 0;
                    const filteredRecipes = recipes.filter(r => r.profession === selectedNpc.id).filter(recipe => {
                      // Slot filter
                      if (recipeSlotFilter !== "all") {
                        if (recipeSlotFilter === "consumable") {
                          const isConsumable = ["buff", "temp_enchant", "streak_shield", "forge_temp", "vellum", "material", "transmute_material"].includes(recipe.result?.type || "");
                          if (!isConsumable) return false;
                        } else {
                          const nameLower = (recipe.name || "").toLowerCase();
                          const SLOT_KEYWORDS: Record<string, string[]> = { weapon: ["schwert", "klinge", "dolch", "axt", "waffe", "stab", "bogen"], shield: ["schild", "buckler"], helm: ["helm", "haube", "kappe", "krone"], armor: ["rüstung", "panzer", "wams", "robe", "tunika"], amulet: ["amulett", "kette", "anhänger", "medallion"], ring: ["ring", "reif", "band"], boots: ["stiefel", "schuhe", "sandalen"] };
                          const keywords = SLOT_KEYWORDS[recipeSlotFilter] || [];
                          if (!keywords.some(k => nameLower.includes(k))) return false;
                        }
                      }
                      if (recipeSearch && !recipe.name.toLowerCase().includes(recipeSearch.toLowerCase())) return false;
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
                      if (showHaveMatsOnly) {
                        const hasMats = Object.entries(recipe.materials || {}).every(([matId, amt]) => (materials[matId] || 0) >= (amt as number));
                        const hasGold = (currencies.gold ?? loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0) >= (recipe.cost?.gold || 0);
                        if (!hasMats || !hasGold) return false;
                      }
                      return true;
                    });
                    // Apply sort
                    const COLOR_ORDER: Record<string, number> = { orange: 0, yellow: 1, green: 2, gray: 3 };
                    if (recipeSort === "name") filteredRecipes.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                    else if (recipeSort === "color") filteredRecipes.sort((a, b) => (COLOR_ORDER[a.skillUpColor || "gray"] ?? 9) - (COLOR_ORDER[b.skillUpColor || "gray"] ?? 9));
                    // default = by reqSkill (already in data order)
                    const totalRecipes = recipes.filter(r => r.profession === selectedNpc.id && !(r as unknown as Record<string, unknown>).hidden).length;
                    const isFiltered = recipeSearch || showCraftableOnly || showHaveMatsOnly || recipeSlotFilter !== "all";
                    return <>{isFiltered && <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.2)" }}>Showing {filteredRecipes.length} of {totalRecipes} recipes</p>}{SKILL_BRACKETS.map(bracket => {
                      const bracketRecipes = filteredRecipes.filter(r => {
                        const skill = r.reqSkill || 0;
                        return skill >= bracket.min && skill < bracket.max;
                      }).sort((a, b) => (a.reqSkill || 0) - (b.reqSkill || 0));
                      if (bracketRecipes.length === 0) return null;
                      // Determine default collapse: brackets below player's current bracket are collapsed,
                      // the player's bracket and above are expanded. We use a lazy init pattern —
                      // if the bracket was never explicitly toggled by the user, apply the default.
                      const isPlayerBracket = playerSkill >= bracket.min && playerSkill < bracket.max;
                      const isBelowPlayer = bracket.max <= playerSkill && !isPlayerBracket;
                      // Default: collapse lower brackets, expand current + higher brackets
                      const defaultCollapsed = isBelowPlayer && !isPlayerBracket;
                      const collapsed = collapsedBrackets.has(bracket.name) ? true : collapsedBrackets.has(`_expanded_${bracket.name}`) ? false : defaultCollapsed;
                      const handleToggle = () => {
                        setCollapsedBrackets(prev => {
                          const next = new Set(prev);
                          if (collapsed) {
                            // Expand: remove collapsed marker, add expanded marker
                            next.delete(bracket.name);
                            next.add(`_expanded_${bracket.name}`);
                          } else {
                            // Collapse: add collapsed marker, remove expanded marker
                            next.add(bracket.name);
                            next.delete(`_expanded_${bracket.name}`);
                          }
                          return next;
                        });
                      };
                      return (
                        <div key={bracket.name} className="mb-1">
                          <button
                            onClick={handleToggle}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 transition-all"
                            style={{ background: `${bracket.color}10`, border: `1px solid ${bracket.color}20`, cursor: "pointer" }}
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-bold" style={{ color: bracket.color }}>{bracket.name}</span>
                              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>({bracket.min}-{bracket.max})</span>
                              {isPlayerBracket && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${bracket.color}15`, color: bracket.color, border: `1px solid ${bracket.color}30` }}>Current</span>}
                            </span>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                              {bracketRecipes.length} recipe{bracketRecipes.length !== 1 ? "s" : ""} {collapsed ? "\u25B8" : "\u25BE"}
                            </span>
                          </button>
                          {!collapsed && bracketRecipes.map(recipe => {
                    // Hidden/undiscovered recipes — show as "???" with source hint
                    if ((recipe as unknown as Record<string, unknown>).hidden) {
                      return (
                        <div key={recipe.id} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "3px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.15)" }}>?</span>
                            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.15)" }}>???</p>
                          </div>
                          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "rgba(255,255,255,0.1)" }}>{recipe.desc || "Unknown recipe"}</p>
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
                              <p className="text-sm font-semibold" style={{ color: !isLearned ? "rgba(255,255,255,0.3)" : !meetsLevel ? "rgba(255,255,255,0.3)" : recipe.skillUpColor === "gray" ? "#6b7280" : recipe.skillUpColor === "green" ? "#86efaccc" : recipe.skillUpColor === "yellow" ? "#eab308cc" : "#f97316cc" }}>
                                {selectedNpc && RECIPE_TYPE_NAME[selectedNpc.id] && <span className="text-xs font-normal mr-1" style={{ color: "rgba(255,255,255,0.2)" }}>{RECIPE_TYPE_NAME[selectedNpc.id]}:</span>}
                                {recipe.name}
                                {newlyLearned.has(recipe.id) && <span className="new-badge-pulse text-xs font-bold ml-1.5 px-1 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", fontSize: 10 }}>NEW</span>}
                              </p>
                              {/* Skill-up indicator dot */}
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: skillUp?.color || "#6b7280" }} title={skillUp?.label || ""} />
                            </div>
                            <p className="text-sm mt-0.5 line-clamp-2" style={{ color: "rgba(255,255,255,0.4)" }}>{recipe.desc}</p>
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
                            {(() => {
                              // Calculate max craftable quantity for the "Max" option
                              const playerGoldForMax = currencies.gold ?? loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0;
                              const maxFromMats = Object.entries(recipe.materials || {}).map(([matId, amt]) => Math.floor((materials[matId] || 0) / (amt as number)));
                              const maxFromGold = recipe.cost?.gold && recipe.cost.gold > 0 ? Math.floor(playerGoldForMax / recipe.cost.gold) : Infinity;
                              const hasMaterials = Object.keys(recipe.materials || {}).length > 0;
                              const batchCap = hasMaterials ? 50 : 10;
                              const maxCraftable = Math.min(batchCap, maxFromGold, ...(maxFromMats.length > 0 ? maxFromMats : [batchCap]));
                              const safeMax = Math.max(0, maxCraftable);
                              return (
                                <select
                                  value={craftCount}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === "max") setCraftCount(Math.max(1, safeMax));
                                    else setCraftCount(parseInt(val, 10));
                                  }}
                                  disabled={!isBatchable}
                                  title={!isBatchable ? "Only buff/consumable recipes support batch crafting" : `Craft x${craftCount}`}
                                  className="text-xs rounded-lg px-1 py-1 font-mono"
                                  style={{ background: "rgba(255,255,255,0.06)", color: isBatchable ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.1)", width: 52, cursor: isBatchable ? "pointer" : "not-allowed", opacity: isBatchable ? 1 : 0.4 }}
                                >
                                  {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>x{n}</option>)}
                                  {isBatchable && <option value="max">Max ({safeMax})</option>}
                                </select>
                              );
                            })()}
                            {needsLearn ? (() => {
                              const playerGold = currencies.gold ?? loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0;
                              const canAfford = playerGold >= (recipe.trainerCost ?? 0);
                              return (
                              <button
                                onClick={() => handleLearnRecipe(recipe.id)}
                                disabled={crafting || !canAfford || !selectedNpc.chosen}
                                className="forge-btn text-sm px-4 py-2 rounded-lg font-semibold"
                                style={{
                                  background: !selectedNpc.chosen ? "rgba(255,255,255,0.03)" : canAfford ? `${selectedNpc.color}15` : "rgba(255,255,255,0.03)",
                                  color: !selectedNpc.chosen ? "rgba(255,255,255,0.2)" : canAfford ? "#facc15" : "rgba(255,255,255,0.2)",
                                  border: !selectedNpc.chosen ? "1px solid rgba(255,255,255,0.06)" : canAfford ? "1px solid rgba(250,204,21,0.3)" : "1px solid rgba(255,255,255,0.06)",
                                  cursor: canAfford && !crafting && selectedNpc.chosen ? "pointer" : "not-allowed",
                                }}
                                title={!selectedNpc.chosen ? "Choose this profession first" : !canAfford ? `Need ${(recipe.trainerCost ?? 0) - playerGold} more gold` : `Learn from ${selectedNpc.npcName} for ${recipe.trainerCost}g`}
                              >
                                {!selectedNpc.chosen ? "Choose First" : crafting ? "..." : `Learn (${recipe.trainerCost}g)`}
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
                                {craftProgress && craftProgress.recipeId === recipe.id ? `Crafting\u2026 ${craftProgress.total > 1 ? `${Math.min(craftProgress.current + 1, craftProgress.total)}/${craftProgress.total} ` : ''}` : crafting ? "Crafting\u2026" : onCooldown ? "On Cooldown" : "Craft"}
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
                                {mat?.icon ? <img src={mat.icon} alt="" width={20} height={20} style={{ imageRendering: "auto" }} onError={hideOnError} /> : <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: RARITY_COLORS[mat?.rarity || "common"] || "#6b7280" }} />}
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
                          {/* Preview toggle for gear craft recipes */}
                          {recipe.result?.type === "craft_gear" && isLearned && (
                            <button
                              onClick={() => toggleCraftPreview(recipe.id)}
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ color: craftPreview?.recipeId === recipe.id ? selectedNpc.color : "rgba(255,255,255,0.3)", background: craftPreview?.recipeId === recipe.id ? `${selectedNpc.color}15` : "rgba(255,255,255,0.04)", border: `1px solid ${craftPreview?.recipeId === recipe.id ? `${selectedNpc.color}30` : "rgba(255,255,255,0.06)"}`, cursor: "pointer" }}
                              title="Preview possible craft result"
                            >
                              {previewLoading === recipe.id ? "..." : craftPreview?.recipeId === recipe.id ? "Hide" : "Preview"}
                            </button>
                          )}
                        </div>
                        {/* Craft preview panel */}
                        {craftPreview?.recipeId === recipe.id && craftPreview.data?.gear && (() => {
                          const g = craftPreview.data.gear;
                          const sr = g.statRanges;
                          return (
                            <div className="mt-2 rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${(RARITY_COLORS[g.rarity] || "#9ca3af")}25` }}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-sm font-semibold" style={{ color: RARITY_COLORS[g.rarity] || "#9ca3af" }}>{g.name}</span>
                                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{SLOT_LABELS[g.slot] || g.slot}</span>
                                {g.setId && <span className="text-xs" style={{ color: "#22c55e" }}>Set: {g.setId}</span>}
                              </div>
                              {/* Primary stats */}
                              {sr.primary?.length > 0 && (
                                <div className="mb-1">
                                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Primary ({sr.primaryCount?.[0]}–{sr.primaryCount?.[1]} stats):</span>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                    {sr.primary.map((a: { stat: string; min: number; max: number }) => (
                                      <span key={a.stat} className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                                        {a.stat} <span style={{ color: "#e8e8e8" }}>{a.min}–{a.max}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Minor stats */}
                              {sr.minor?.length > 0 && (
                                <div className="mb-1">
                                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Minor ({sr.minorCount?.[0]}–{sr.minorCount?.[1]} stats):</span>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                    {sr.minor.map((a: { stat: string; min: number; max: number }) => (
                                      <span key={a.stat} className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                                        {a.stat} <span style={{ color: "#e8e8e8" }}>{a.min}–{a.max}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Fixed stats */}
                              {g.fixedStats && (
                                <div className="mb-1">
                                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Fixed stats:</span>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                    {Object.entries(g.fixedStats).map(([stat, val]) => (
                                      <span key={stat} className="text-xs font-mono" style={{ color: "#e8e8e8" }}>{stat} +{String(val)}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Sockets & Legendary */}
                              <div className="flex flex-wrap gap-3 mt-1">
                                {g.socketRange && (g.socketRange[0] > 0 || g.socketRange[1] > 0) && (
                                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Sockets: {g.socketRange[0]}–{g.socketRange[1]}</span>
                                )}
                                {g.legendaryEffect && (
                                  <span className="text-xs" style={{ color: "#f97316" }}>
                                    Legendary: {g.legendaryEffect.type} ({g.legendaryEffect.min}–{g.legendaryEffect.max}%)
                                  </span>
                                )}
                              </div>
                              {/* Moonlight bonus indicator */}
                              {craftPreview.data.moonlightActive && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#93c5fd", boxShadow: "0 0 4px #93c5fd" }} />
                                  <span className="text-xs" style={{ color: "#93c5fd" }}>Mondlicht-Schmiede active: +{Math.round((craftPreview.data.moonlightBonus || 0) * 100)}% minimum rolls</span>
                                </div>
                              )}
                              {craftPreview.data.mastery && (
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#facc15" }} />
                                  <span className="text-xs" style={{ color: "#facc15" }}>Mastery bonus active</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* Standalone cast bar below recipe card */}
                        {craftProgress && craftProgress.recipeId === recipe.id && (
                          <div className="mt-2 relative">
                            <div className="text-xs text-center font-mono mb-1" style={{ color: selectedNpc.color }}>
                              {craftProgress.total > 1 && <span style={{ color: "rgba(255,255,255,0.3)", marginRight: 4 }}>{Math.min(craftProgress.current + 1, craftProgress.total)}/{craftProgress.total}</span>}
                              {castCountdown ?? "0.0"}s
                            </div>
                            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full" style={{
                                background: `linear-gradient(90deg, ${selectedNpc.color}80, ${selectedNpc.color})`,
                                animation: `craft-cast-fill ${craftCastMsRef.current}ms linear forwards`,
                                boxShadow: `0 0 8px ${selectedNpc.color}60, 0 0 2px ${selectedNpc.color}`,
                              }} />
                            </div>
                            <p className="text-xs text-center mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>ESC to cancel</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                        </div>
                      );
                    })}</>;
                  })()}
                  {/* Empty state when filter shows no results */}
                  {showCraftableOnly && recipes.filter(r => r.profession === selectedNpc.id).filter(r => !(r as unknown as Record<string, unknown>).hidden && r.learned !== false && r.canCraft && (r.cooldownRemaining ?? 0) <= 0).length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.2)" }}>
                      No craftable recipes. Possible reasons: not enough materials, skill too low, recipes on cooldown, or no gear equipped for slot-targeted recipes. Try dismantling gear for materials or completing quests.
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
                  {/* Intro — D3 Mystic style explanation */}
                  <div className="rounded-lg p-3" style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.12)" }}>
                    <p className="text-xs font-bold mb-1" style={{ color: "#a855f7" }}>Eldrics Verzauberung — Stat Reroll</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Wähle einen Stat auf deinem ausgerüsteten Item. Eldric zeigt dir zwei neue Optionen — du wählst, ob du den alten Wert behältst oder einen neuen nimmst.
                    </p>
                    <div className="mt-2 space-y-0.5">
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>◆ Einmal gewählt, ist der Stat <strong className="text-w50">permanent gesperrt</strong> — nur er kann rerolled werden</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>◆ Kosten steigen mit jedem Reroll (Gold + Essenz)</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>◆ Alle anderen Stats bleiben unberührt</p>
                    </div>
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

                  {/* Enchant options (D3 Mystic-style: 3 comparison cards) */}
                  {enchantOptions && (() => {
                    const originalVal = enchantOptions.find(o => o.index === 0)?.value ?? 0;
                    return (
                      <div className="rounded-lg p-4" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)", boxShadow: "0 0 20px rgba(168,85,247,0.08)" }}>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#a855f7" }}>Choose a value for <span className="font-bold">{enchantStat}</span></p>
                        <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.25)" }}>Select one option to apply. The other two will be lost.</p>
                        <div className="grid grid-cols-3 gap-3">
                          {enchantOptions.map(opt => {
                            const isOriginal = opt.index === 0;
                            const diff = opt.value - originalVal;
                            const isBetter = diff > 0;
                            const isWorse = diff < 0;
                            const borderColor = isOriginal ? "rgba(255,255,255,0.12)" : isBetter ? "rgba(34,197,94,0.4)" : isWorse ? "rgba(239,68,68,0.4)" : "rgba(168,85,247,0.3)";
                            const bgColor = isOriginal ? "rgba(255,255,255,0.03)" : isBetter ? "rgba(34,197,94,0.06)" : isWorse ? "rgba(239,68,68,0.04)" : "rgba(168,85,247,0.06)";
                            const accentColor = isOriginal ? "rgba(255,255,255,0.5)" : isBetter ? "#22c55e" : isWorse ? "#ef4444" : "#a855f7";
                            const glowColor = isOriginal ? "none" : isBetter ? "0 0 12px rgba(34,197,94,0.15)" : isWorse ? "0 0 12px rgba(239,68,68,0.1)" : "0 0 12px rgba(168,85,247,0.15)";
                            return (
                              <button
                                key={opt.index}
                                onClick={() => handleEnchantChoose(opt.index)}
                                disabled={enchantLoading}
                                className="relative flex flex-col items-center gap-2 py-4 px-3 rounded-xl transition-all"
                                style={{
                                  background: bgColor,
                                  border: `1px solid ${borderColor}`,
                                  boxShadow: glowColor,
                                  cursor: enchantLoading ? "not-allowed" : "pointer",
                                  opacity: enchantLoading ? 0.6 : 1,
                                }}
                                title={isOriginal ? "Keep the current value" : `Change ${enchantStat} from ${originalVal} to ${opt.value}`}
                              >
                                {/* Card header */}
                                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
                                  {opt.label}
                                </span>
                                {/* Stat name */}
                                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{enchantStat}</span>
                                {/* Value display */}
                                <span className="text-2xl font-bold font-mono" style={{ color: isOriginal ? "rgba(255,255,255,0.6)" : accentColor }}>
                                  +{opt.value}
                                </span>
                                {/* Diff indicator */}
                                {!isOriginal && diff !== 0 && (
                                  <span className="text-xs font-semibold font-mono px-2 py-0.5 rounded-full" style={{
                                    background: isBetter ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)",
                                    color: isBetter ? "#4ade80" : "#f87171",
                                    border: `1px solid ${isBetter ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.2)"}`,
                                  }}>
                                    {isBetter ? "\u25B2" : "\u25BC"} {Math.abs(diff)}
                                  </span>
                                )}
                                {!isOriginal && diff === 0 && (
                                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>=</span>
                                )}
                                {isOriginal && (
                                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>no change</span>
                                )}
                                {/* Choose button */}
                                <span className="mt-1 text-xs font-semibold px-4 py-1.5 rounded-lg" style={{
                                  background: isOriginal ? "rgba(255,255,255,0.06)" : `${accentColor}18`,
                                  color: isOriginal ? "rgba(255,255,255,0.4)" : accentColor,
                                  border: `1px solid ${isOriginal ? "rgba(255,255,255,0.08)" : `${accentColor}35`}`,
                                }}>
                                  {enchantLoading ? "..." : "Choose"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {/* Cost reminder */}
                        {enchantCost && (
                          <div className="mt-3 text-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                            Paid: <span style={{ color: "#f59e0b" }}>{enchantCost.gold}g</span> + <span style={{ color: "#ff8c00" }}>{enchantCost.essenz} Essenz</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Result message */}
                  {enchantResult && (
                    <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(168,85,247,0.08)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.2)" }}>
                      {enchantResult}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ─── Tab: Trainer (Buy Recipes — all professions) ──────────── */}
            {(npcModalTab as string) === "trainer" && !selectedNpc.chosen && (
              <div className="tab-content-enter px-5 py-8 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-sm font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>Choose this profession to learn recipes from {selectedNpc.npcName}.</p>
                <button
                  onClick={() => setConfirmProf(selectedNpc)}
                  disabled={choosingProf || professions.filter(p => p.chosen && !["koch", "verzauberer"].includes(p.id)).length >= maxProfSlots}
                  className="text-sm px-5 py-2.5 rounded-lg font-semibold"
                  style={{ background: `${selectedNpc.color}20`, color: selectedNpc.color, border: `1px solid ${selectedNpc.color}40`, cursor: "pointer" }}
                >
                  Choose {selectedNpc.name}
                </button>
              </div>
            )}
            {(npcModalTab as string) === "trainer" && selectedNpc.chosen && (() => {
              // Trainer tab explanation
              const trainerIntro = (
                <div className="px-5 pt-3 pb-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Kaufe Rezepte bei {selectedNpc.npcName}. Rezepte sind nach Rang sortiert — du brauchst das nötige Skill-Level und Gold.
                    Trainiere deinen Rang um höhere Rezepte freizuschalten.
                  </p>
                </div>
              );
              const trainerRecipes = recipes
                .filter(r => r.profession === selectedNpc.id && r.source === "trainer" && (r.trainerCost ?? 0) > 0)
                .sort((a, b) => (a.reqSkill || 0) - (b.reqSkill || 0));
              const learnedSet = new Set(recipes.filter(r => r.learned !== false).map(r => r.id));
              const playerSkill = selectedNpc.skill || 0;
              const gold = currencies.gold ?? loggedInUser?.currencies?.gold ?? loggedInUser?.gold ?? 0;

              // Group by skill range
              const groups: Record<string, typeof trainerRecipes> = {};
              for (const r of trainerRecipes) {
                const sk = r.reqSkill || 0;
                const bracket = sk < 75 ? "Apprentice (1-75)" : sk < 150 ? "Journeyman (75-150)" : sk < 225 ? "Expert (150-225)" : "Artisan (225-300)";
                if (!groups[bracket]) groups[bracket] = [];
                groups[bracket].push(r);
              }

              // Determine if player is near skill cap and can train next rank
              const currentSkillCap = selectedNpc.skillCap || 75;
              const nearCap = playerSkill >= currentSkillCap - 10;
              const nextRank = nearCap ? RANK_TRAINING_COSTS.find(r => r.fromCap === currentSkillCap) : null;
              const playerLevelForRank = selectedNpc.playerLevel || 1;
              const meetsRankLevel = nextRank ? playerLevelForRank >= nextRank.reqPlayerLevel : false;
              const meetsRankSkill = nextRank ? playerSkill >= nextRank.reqSkill : false;
              const canAffordRank = nextRank ? gold >= nextRank.cost : false;
              const canTrainRank = nextRank && meetsRankLevel && meetsRankSkill && canAffordRank;

              return (
                <div className="tab-content-enter space-y-4">
                  {trainerIntro}
                  <div className="px-5 pb-4 space-y-4">
                  {/* ─── Train Rank Banner ──────────────────────────── */}
                  {nearCap && nextRank && (
                    <div className="rounded-lg p-4" style={{
                      background: `linear-gradient(135deg, ${selectedNpc.color}18, ${selectedNpc.color}08)`,
                      border: `1px solid ${selectedNpc.color}40`,
                      boxShadow: `0 0 20px ${selectedNpc.color}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
                    }}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-bold" style={{ color: selectedNpc.color }}>
                            {selectedNpc.rank || "Apprentice"} — {playerSkill}/{currentSkillCap}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                            Next: <span className="font-semibold" style={{ color: "#e8e8e8" }}>{nextRank.rank}</span>
                            {" "}&middot; Cap {nextRank.toCap}
                            {" "}&middot; <span style={{ color: canAffordRank ? "#facc15" : "#f44" }}>{nextRank.cost.toLocaleString()}g</span>
                            {" "}&middot; <span style={{ color: meetsRankLevel ? "rgba(255,255,255,0.4)" : "#f44" }}>Lv {nextRank.reqPlayerLevel}</span>
                          </p>
                          {!meetsRankLevel && (
                            <p className="text-xs mt-1" style={{ color: "#f44" }}>Requires player level {nextRank.reqPlayerLevel} (you are {playerLevelForRank})</p>
                          )}
                          {!meetsRankSkill && meetsRankLevel && (
                            <p className="text-xs mt-1" style={{ color: "#f44" }}>Requires skill {nextRank.reqSkill} (you have {playerSkill})</p>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/crafting/train-rank", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                                body: JSON.stringify({ professionId: selectedNpc.id }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setCraftResult(`Rank Up! ${nextRank.rank} — Skill cap now ${data.newCap || nextRank.toCap}`);
                                setRankUpCelebration(`${nextRank.rank}!`);
                                setTimeout(() => setRankUpCelebration(null), 3000);
                                fetchData();
                              } else {
                                setCraftResult(data.error || "Failed to train rank");
                              }
                              setTimeout(() => setCraftResult(null), 5000);
                            } catch { setCraftResult("Network error"); setTimeout(() => setCraftResult(null), 5000); }
                          }}
                          disabled={!canTrainRank}
                          title={!meetsRankLevel ? `Requires player level ${nextRank.reqPlayerLevel}` : !meetsRankSkill ? `Requires skill ${nextRank.reqSkill}` : !canAffordRank ? `Need ${nextRank.cost - gold} more gold` : `Train ${nextRank.rank} for ${nextRank.cost}g`}
                          className="text-sm px-5 py-2.5 rounded-lg font-bold flex-shrink-0"
                          style={{
                            background: canTrainRank ? `${selectedNpc.color}25` : "rgba(255,255,255,0.03)",
                            color: canTrainRank ? selectedNpc.color : "rgba(255,255,255,0.2)",
                            border: `2px solid ${canTrainRank ? `${selectedNpc.color}60` : "rgba(255,255,255,0.08)"}`,
                            cursor: canTrainRank ? "pointer" : "not-allowed",
                            boxShadow: canTrainRank ? `0 0 12px ${selectedNpc.color}30` : "none",
                          }}
                        >
                          Train {nextRank.rank}
                        </button>
                      </div>
                    </div>
                  )}
                  {nearCap && !nextRank && currentSkillCap >= 300 && (
                    <div className="rounded-lg p-3 text-center" style={{
                      background: `linear-gradient(135deg, ${selectedNpc.color}12, ${selectedNpc.color}06)`,
                      border: `1px solid ${selectedNpc.color}30`,
                    }}>
                      <p className="text-sm font-bold" style={{ color: selectedNpc.color }}>Grand Master — {playerSkill}/300</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Maximum rank reached</p>
                    </div>
                  )}
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Buy recipes from {selectedNpc.npcName}. Learned recipes are marked with a checkmark.
                  </p>
                  {Object.entries(groups).map(([bracket, recs]) => (
                    <div key={bracket}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>{bracket}</p>
                      <div className="space-y-1">
                        {recs.map(r => {
                          const learned = learnedSet.has(r.id);
                          const canAfford = gold >= (r.trainerCost || 0);
                          const meetsSkill = playerSkill >= (r.reqSkill || 0);
                          return (
                            <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: learned ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${learned ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)"}` }}>
                              <span style={{ color: learned ? "#22c55e" : "rgba(255,255,255,0.15)", fontSize: 12 }}>{learned ? "✓" : "○"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: learned ? "rgba(255,255,255,0.4)" : meetsSkill ? "#e8e8e8" : "rgba(255,255,255,0.3)" }}>{r.name}</p>
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Skill {r.reqSkill || 0}{r.desc ? ` — ${r.desc}` : ""}</p>
                              </div>
                              {!learned && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch("/api/professions/learn", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                                        body: JSON.stringify({ recipeId: r.id }),
                                      });
                                      const data = await res.json();
                                      if (res.ok) { setCraftResult(`Learned: ${r.name}`); fetchData(); }
                                      else setCraftResult(data.error || "Failed");
                                      setTimeout(() => setCraftResult(null), 3000);
                                    } catch { setCraftResult("Network error"); }
                                  }}
                                  disabled={!canAfford || !meetsSkill || learned}
                                  title={!meetsSkill ? `Requires Skill ${r.reqSkill}` : !canAfford ? `Need ${(r.trainerCost || 0) - gold} more gold` : `Learn for ${r.trainerCost}g`}
                                  className="text-xs px-2 py-1 rounded font-semibold flex-shrink-0"
                                  style={{
                                    background: canAfford && meetsSkill ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)",
                                    color: canAfford && meetsSkill ? "#f59e0b" : "rgba(255,255,255,0.2)",
                                    border: `1px solid ${canAfford && meetsSkill ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.06)"}`,
                                    cursor: canAfford && meetsSkill ? "pointer" : "not-allowed",
                                  }}
                                >
                                  {(r.trainerCost || 0).toLocaleString()}g
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {trainerRecipes.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.15)" }}>No trainer recipes for this profession.</p>
                  )}
                  </div>
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
                  {/* Schmiedekunst explanation */}
                  <div className="rounded-lg p-3 space-y-1" style={{ background: "rgba(255,140,0,0.03)", border: "1px solid rgba(255,140,0,0.1)" }}>
                    <p className="text-xs font-bold" style={{ color: "#ff8c00" }}>Schmiedekunst — Grimvars Spezialgebiet</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      ◆ <strong className="text-w50">Zerlegen</strong>: Rüstung in Essenz + Materialien auflösen. Höhere Seltenheit = mehr Essenz.
                    </p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      ◆ <strong className="text-w50">Transmutation</strong>: 3 epische Items desselben Slots + 500g = 1 legendäres Item.
                    </p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      ◆ <strong className="text-w50">Reforge</strong>: Stats eines Items komplett neu würfeln (Gold + Materialien).
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Zerlegen: Gear → <strong style={{ color: "#ff8c00" }}>Essenz</strong> + <strong style={{ color: "#22c55e" }}>Materialien</strong>
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

                  {/* ─── Reforge Stats (re-roll stats on any item with affixes) ── */}
                  {(() => {
                    const reforgeableItems = dismantleItems.filter(i => i.rarity && ["uncommon", "rare", "epic", "legendary"].includes(i.rarity) && !i.fixedStats && !i.locked);
                    if (reforgeableItems.length === 0) return null;
                    const REFORGE_COSTS: Record<string, number> = { common: 50, uncommon: 100, rare: 250, epic: 500, legendary: 1000 };
                    return (
                      <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="text-sm font-semibold mb-1" style={{ color: "#818cf8" }}>Reforge Stats</p>
                        <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                          Re-roll all stats on an item from its affix pool. Identity and sockets stay.
                        </p>
                        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))" }}>
                          {reforgeableItems.slice(0, 16).map(item => {
                            const cost = REFORGE_COSTS[item.rarity || "common"] || 50;
                            return (
                              <button
                                key={item.instanceId || item.id}
                                onClick={() => {
                                  setConfirmAction({
                                    message: `Reforge "${item.name}" stats?\n\nAll stats will be re-rolled from the affix pool. Sockets and identity stay.\n\nCost: ${cost}g`,
                                    onConfirm: async () => {
                                      setConfirmAction(null);
                                      try {
                                        const r = await fetch("/api/schmiedekunst/reforge-stats", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey!) },
                                          body: JSON.stringify({ inventoryItemId: item.instanceId || item.id }),
                                        });
                                        const data = await r.json();
                                        setDismantleResult({ message: data.message || data.error || "Something went wrong. Try again." });
                                        setTimeout(() => setDismantleResult(null), 5000);
                                        fetchData();
                                        onRefresh?.();
                                      } catch (err) { console.error('[forge] reforge-stats error:', err); setDismantleResult({ message: "Network error" }); }
                                    },
                                  });
                                }}
                                className="forge-btn relative flex items-center justify-center rounded-lg aspect-square"
                                style={{ background: "rgba(129,140,248,0.06)", border: `1px solid rgba(129,140,248,0.25)` }}
                                title={`${item.name} (${item.rarity}) — Reforge stats (${cost}g)`}
                              >
                                {item.icon
                                  ? <img src={item.icon} alt={item.name} style={{ width: 40, height: 40, imageRendering: "auto", objectFit: "contain" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                                  : <span style={{ fontSize: 18, color: "#818cf8" }}>◆</span>
                                }
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

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
                  <div className="rounded-lg p-3" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}>
                    <p className="text-xs font-bold mb-1" style={{ color: "#22c55e" }}>Ysoldes Transmutation</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Combine 3 Epic gear pieces from the <strong className="text-w60">same equipment slot</strong> + 500 Gold → 1 random Legendary item for that slot. The 3 Epics are destroyed in the process. Choose wisely.
                    </p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                      Tip: Mondlicht-Schmiede (22:00-06:00) gives +20% better minimum rolls on the result.
                    </p>
                  </div>

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
        <div className="fixed inset-0 z-[150] flex items-center justify-center modal-backdrop" onClick={() => setConfirmProf(null)}>
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
                  <li className="flex gap-2"><span style={{ color: "#22c55e" }}>&#10003;</span> Free to drop (no cost)</li>
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

      {/* ─── Profession Celebration Modal ─────────────────────────────────── */}
      {profCelebration && createPortal(
        <div className="fixed inset-0 z-[160] flex items-center justify-center modal-backdrop" onClick={() => setProfCelebration(null)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden reward-burst-enter" style={{ background: `linear-gradient(180deg, ${profCelebration.color}12 0%, #111318 100%)`, border: `1px solid ${profCelebration.color}40`, boxShadow: `0 0 80px ${profCelebration.color}20` }} onClick={e => e.stopPropagation()}>
            {/* Accent bar */}
            <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${profCelebration.color}, transparent)` }} />
            <div className="p-6 space-y-5">
              {/* Header — NPC portrait + congratulations */}
              <div className="flex items-center gap-4">
                {profCelebration.npcPortrait && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0" style={{ border: `2px solid ${profCelebration.color}60`, boxShadow: `0 0 20px ${profCelebration.color}20` }}>
                    <img src={profCelebration.npcPortrait} alt="" className="w-full h-full object-cover img-render-auto" onError={e => { e.currentTarget.style.display = "none"; }} />
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: `${profCelebration.color}80` }}>Neuer Beruf erlernt!</p>
                  <p className="text-xl font-bold mt-1" style={{ color: profCelebration.color }}>{profCelebration.name}</p>
                  <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Meister: {profCelebration.npcName}</p>
                </div>
              </div>

              {/* NPC greeting — flavor */}
              <div className="rounded-lg px-4 py-3" style={{ background: `${profCelebration.color}08`, borderLeft: `3px solid ${profCelebration.color}40` }}>
                <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.5)" }}>&ldquo;{profCelebration.npcGreeting}&rdquo;</p>
              </div>

              {/* What this profession creates — profession-specific */}
              <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Was du jetzt herstellen kannst</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {profCelebration.id === "schmied" && "Plattenrüstung: Helme, Brustpanzer und Stiefel aus Metall. Schwere Rüstung mit hoher Ausdauer. Außerdem: Reforge, Salvage und Transmutation im Schmiedekunst-Tab."}
                  {profCelebration.id === "schneider" && "Stoffrüstung: Helme, Roben und Schuhe aus Stoff. Leichte Rüstung mit hoher Weisheit und Fokus."}
                  {profCelebration.id === "lederverarbeiter" && "Lederrüstung: Helme, Wämser und Stiefel aus Leder. Mittlere Rüstung mit Ausdauer und Glück."}
                  {profCelebration.id === "waffenschmied" && "Waffen und Schilde: Schwerter, Äxte, Dolche, Keulen und Schilde für jeden Kampfstil."}
                  {profCelebration.id === "juwelier" && "Schmuck: Ringe und Amulette mit konzentrierten Stats. Außerdem: Edelsteine schleifen und zusammenführen."}
                  {profCelebration.id === "alchemist" && "Tränke und Elixiere: Temporäre Buffs für XP, Gold, Glück und mehr. Außerdem: Material-Transmutationen."}
                  {profCelebration.id === "koch" && "Mahlzeiten und Snacks: Streak-Schutz, Forge-Temperatur-Boosts und der legendäre Champion's Feast."}
                  {profCelebration.id === "verzauberer" && "Verzauberungen: Permanente und temporäre Enchants für ausgerüstete Items. Außerdem: Stat-Rerolling im Enchanting-Tab."}
                </p>
              </div>

              {/* How it works — WoW Classic style guide */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>So funktioniert dein Beruf</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>1. Rezepte lernen</p>
                    <p className="text-xs text-w30 mt-0.5">Kaufe beim Meister im Trainer-Tab oder finde seltene Drops.</p>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>2. Materialien sammeln</p>
                    <p className="text-xs text-w30 mt-0.5">Droppen automatisch aus Quests basierend auf deinem Beruf.</p>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-xs font-semibold" style={{ color: "#f97316" }}>3. Craften &amp; Skillen</p>
                    <p className="text-xs text-w30 mt-0.5">Jedes Craft gibt Skill-XP. <span style={{ color: "#f97316" }}>Orange</span>=100%, <span style={{ color: "#eab308" }}>Gelb</span>=75%, <span style={{ color: "#22c55e" }}>Grün</span>=25%.</p>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-xs font-semibold" style={{ color: "#a855f7" }}>4. Ränge aufsteigen</p>
                    <p className="text-xs text-w30 mt-0.5">Trainiere beim Meister um das Skill-Cap zu erhöhen (bis 300).</p>
                  </div>
                </div>
              </div>

              {/* Pro tips */}
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <p className="text-xs" style={{ color: "#fbbf24" }}>Tipp: Dein erster Craft des Tages gibt <strong>doppeltes Skill-XP</strong>. Nachts (22-06 Uhr) sind die Mindest-Rolls auf gecrafteten Items +20% besser.</p>
              </div>

              <button
                onClick={() => setProfCelebration(null)}
                className="btn-interactive w-full text-sm font-bold py-3 rounded-lg"
                style={{ background: `${profCelebration.color}20`, color: profCelebration.color, border: `1px solid ${profCelebration.color}40`, cursor: "pointer" }}
              >
                Auf zum ersten Craft!
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Auto-Salvage Modal ──────────────────────────────────────────── */}
      {autoSalvageOpen && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center modal-backdrop" onClick={closeAutoSalvage}>
          <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl overflow-hidden" style={{ background: "#141209", border: "1px solid rgba(255,140,0,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()}>
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
          <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-xl rounded-xl overflow-hidden" style={{ background: "#12100a", border: "1px solid rgba(249,115,22,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: "rgba(249,115,22,0.06)", borderBottom: "1px solid rgba(249,115,22,0.15)" }}>
              <p className="text-sm font-bold" style={{ color: "#f97316" }}>Ätherwürfel</p>
              <button onClick={closeCube} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}><span className="text-xs font-mono" style={{ fontSize: 12 }}>ESC</span></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* 3 Hex Slots */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
