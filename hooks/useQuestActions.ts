"use client";

import { useCallback, useState, useRef } from "react";
import { SFX } from "@/lib/sounds";
import type { Quest, ActiveNpc } from "@/app/types";
import type { RewardCelebrationData } from "@/components/RewardCelebration";
import type { ToastInput } from "@/components/ToastStack";
import { getAuthHeaders } from "@/lib/auth-client";
import { advanceTutorial } from "@/components/ContextualTutorial";


interface UseQuestActionsParams {
  reviewApiKey: string;
  playerName: string;
  refresh: () => Promise<void>;
  setActiveNpcs: React.Dispatch<React.SetStateAction<ActiveNpc[]>>;
  setSelectedNpc: React.Dispatch<React.SetStateAction<ActiveNpc | null>>;
  setChainOffer: (v: { template: { title: string; description?: string | null; type?: string; priority?: string }; parentTitle: string } | null) => void;
  setRewardCelebration: (v: RewardCelebrationData | null) => void;
  pendingLevelUpRef: React.MutableRefObject<{ level: number; title: string } | null>;
  addToast: (t: ToastInput) => void;
  setApiErrorWithAutoClose: (msg: string | null) => void;
  lastPoolRefresh: Date | null;
  setLastPoolRefresh: React.Dispatch<React.SetStateAction<Date | null>>;
}

export function useQuestActions({
  reviewApiKey,
  playerName,
  refresh,
  setActiveNpcs,
  setSelectedNpc,
  setChainOffer,
  setRewardCelebration,
  pendingLevelUpRef,
  addToast,
  setApiErrorWithAutoClose,
  setLastPoolRefresh,
}: UseQuestActionsParams) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [poolRefreshing, setPoolRefreshing] = useState(false);
  const [shopUserId, setShopUserId] = useState<string | null>(null);
  // Tracks which quest+action is currently in-flight to prevent double-clicks
  const [loadingAction, setLoadingAction] = useState<{ questId: string; action: string } | null>(null);
  const loadingRef = useRef(loadingAction);
  loadingRef.current = loadingAction;

  const updateNpcQuestStatus = useCallback((questId: string, status: string, claimedBy: string | null) => {
    const updateChain = (npc: ActiveNpc): ActiveNpc => ({
      ...npc,
      questChain: npc.questChain.map(q =>
        q.questId === questId ? { ...q, status: status as "open" | "in_progress" | "completed" | "claimed", claimedBy } : q
      ),
    });
    setActiveNpcs(prev => prev.map(npc =>
      npc.questChain.some(q => q.questId === questId) ? updateChain(npc) : npc
    ));
    setSelectedNpc(prev => {
      if (!prev || !prev.questChain.some(q => q.questId === questId)) return prev;
      return updateChain(prev);
    });
  }, [setActiveNpcs, setSelectedNpc]);

  const handleApprove = useCallback(async (id: string, comment?: string) => {
    if (!reviewApiKey || loadingRef.current) return;
    setLoadingAction({ questId: id, action: "approve" });
    try {
      const body = comment ? JSON.stringify({ comment }) : undefined;
      const r = await fetch(`/api/quest/${id}/approve`, {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey), ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
      });
      if (r.ok) {
        setReviewComments(prev => { const next = { ...prev }; delete next[id]; return next; });
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: (d as { error?: string }).error || "Failed to approve quest" });
      }
    } catch {
      addToast({ type: "error", message: "Network error — could not approve quest" });
    } finally {
      setLoadingAction(null);
    }
  }, [reviewApiKey, refresh, addToast]);

  const handleReject = useCallback(async (id: string, comment?: string) => {
    if (!reviewApiKey || loadingRef.current) return;
    setLoadingAction({ questId: id, action: "reject" });
    try {
      const body = comment ? JSON.stringify({ comment }) : undefined;
      const r = await fetch(`/api/quest/${id}/reject`, {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey), ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
      });
      if (r.ok) {
        setReviewComments(prev => { const next = { ...prev }; delete next[id]; return next; });
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: (d as { error?: string }).error || "Failed to approve quest" });
      }
    } catch {
      addToast({ type: "error", message: "Network error — could not reject quest" });
    } finally {
      setLoadingAction(null);
    }
  }, [reviewApiKey, refresh, addToast]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkUpdate = useCallback(async (status: Quest["status"]) => {
    if (!reviewApiKey || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const r = await fetch("/api/quests/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: (d as { error?: string }).error || "Bulk update failed" });
        return;
      }
      setSelectedIds(new Set());
      await refresh();
    } catch {
      addToast({ type: "error", message: "Bulk update failed" });
    } finally {
      setBulkLoading(false);
    }
  }, [reviewApiKey, selectedIds, refresh, addToast]);

  const handleToggleFavorite = useCallback(async (questId: string, favorites: string[]) => {
    if (!reviewApiKey || !playerName) return;
    const isFav = favorites.includes(questId);
    const action = isFav ? "remove" : "add";
    try {
      const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ questId, action }),
      });
      if (!r.ok) addToast({ type: "error", message: "Failed to toggle favorite" });
    } catch {
      addToast({ type: "error", message: "Network error toggling favorite" });
    }
  }, [reviewApiKey, playerName, addToast]);

  const handleClaim = useCallback(async (questId: string) => {
    if (!reviewApiKey || !playerName || loadingRef.current) return;
    setLoadingAction({ questId, action: "claim" });
    try {
      const r = await fetch(`/api/quest/${questId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ agentId: playerName }),
      });
      if (r.ok) {
        updateNpcQuestStatus(questId, "in_progress", playerName.toLowerCase());
        addToast({ type: "flavor", message: "Quest claimed", icon: "/images/icons/nav-great-hall.png" });
        advanceTutorial();
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: d.error || "Failed to claim quest" });
      }
    } catch {
      addToast({ type: "error", message: "Network error — could not claim quest", onRetry: () => handleClaim(questId) });
    } finally {
      setLoadingAction(null);
    }
  }, [reviewApiKey, playerName, refresh, updateNpcQuestStatus, addToast]);

  const handleUnclaim = useCallback(async (questId: string) => {
    if (!reviewApiKey || !playerName || loadingRef.current) return;
    setLoadingAction({ questId, action: "unclaim" });
    try {
      const r = await fetch(`/api/quest/${questId}/unclaim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ agentId: playerName }),
      });
      if (r.ok) {
        updateNpcQuestStatus(questId, "open", null);
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: (d as { error?: string }).error || "Failed to unclaim quest" });
      }
    } catch {
      addToast({ type: "error", message: "Network error — could not unclaim quest", onRetry: () => handleUnclaim(questId) });
    } finally {
      setLoadingAction(null);
    }
  }, [reviewApiKey, playerName, refresh, updateNpcQuestStatus, addToast]);

  const handleCoopClaim = useCallback(async (questId: string) => {
    if (!reviewApiKey || !playerName || loadingRef.current) return;
    setLoadingAction({ questId, action: "coopClaim" });
    try {
      const r = await fetch(`/api/quest/${questId}/coop-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ userId: playerName }),
      });
      if (r.ok) {
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: (d as { error?: string }).error || "Failed to join co-op quest" });
      }
    } catch {
      addToast({ type: "error", message: "Network error — could not join co-op quest" });
    } finally {
      setLoadingAction(null);
    }
  }, [reviewApiKey, playerName, refresh, addToast]);

  const handleCoopComplete = useCallback(async (questId: string) => {
    if (!reviewApiKey || !playerName || loadingRef.current) return;
    setLoadingAction({ questId, action: "coopComplete" });
    try {
      const r = await fetch(`/api/quest/${questId}/coop-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ userId: playerName }),
      });
      if (r.ok) {
        const data = await r.json().catch(() => ({}));
        if (data.allDone) {
          addToast({ type: "flavor", message: "Co-op quest complete. All partners finished.", icon: "/images/icons/cat-coop.png", sub: "Rewards granted" });
          // Server now mirrors the single-player response shape — fire the
          // celebration so players see what they earned. Previously co-op
          // grants were silent.
          if ((data.xpEarned || 0) > 0 || (data.goldEarned || 0) > 0 || data.lootDrop) {
            const currencies: { name: string; amount: number; color: string }[] = [];
            if (data.currencies) {
              if (data.currencies.runensplitter > 0) currencies.push({ name: "Runensplitter", amount: data.currencies.runensplitter, color: "#818cf8" });
              if (data.currencies.gildentaler > 0) currencies.push({ name: "Gildentaler", amount: data.currencies.gildentaler, color: "#10b981" });
              if (data.currencies.essenz > 0) currencies.push({ name: "Essenz", amount: data.currencies.essenz, color: "#ef4444" });
            }
            if ((data.lastRestedXP || 0) > 0) currencies.push({ name: "Rested Bonus", amount: data.lastRestedXP, color: "#60a5fa" });
            setRewardCelebration({
              type: "quest",
              title: "Co-op Quest Complete",
              xpEarned: data.xpEarned || 0,
              goldEarned: data.goldEarned || 0,
              loot: data.lootDrop || null,
              achievement: data.newAchievements?.length > 0 ? data.newAchievements[0] : null,
              ...(currencies.length > 0 ? { currencies } : {}),
            });
          }
        } else {
          addToast({ type: "flavor", message: "Your part is done. Waiting for partners...", icon: "/images/icons/cat-coop.png" });
        }
        if (data.newAchievements?.length > 0) {
          for (const ach of data.newAchievements) {
            addToast({ type: "achievement", achievement: ach });
          }
        }
        if (data.inventoryFull) {
          addToast({ type: "error", message: "Inventory full — loot item lost. Free up space." });
        }
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: (d as { error?: string }).error || "Failed to complete co-op quest" });
      }
    } catch {
      addToast({ type: "error", message: "Network error — could not complete co-op quest", onRetry: () => handleCoopComplete(questId) });
    } finally {
      setLoadingAction(null);
    }
  }, [reviewApiKey, playerName, refresh, addToast]);

  const handleComplete = useCallback(async (questId: string, questTitle: string) => {
    if (!reviewApiKey || !playerName || loadingRef.current) return;
    setLoadingAction({ questId, action: "complete" });
    try {
      const r = await fetch(`/api/quest/${questId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ agentId: playerName }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.chainQuestTemplate) {
          setChainOffer({ template: data.chainQuestTemplate, parentTitle: questTitle });
        }
        const isNpcQuest = !!data.quest?.npcGiverId;
        const currencies: { name: string; amount: number; color: string }[] = [];
        if (data.runensplitterEarned > 0) currencies.push({ name: "Runensplitter", amount: data.runensplitterEarned, color: "#818cf8" });
        if (data.gildentalerEarned > 0) currencies.push({ name: "Gildentaler", amount: data.gildentalerEarned, color: "#10b981" });
        if (data.restedBonusXp > 0) currencies.push({ name: "Rested Bonus", amount: data.restedBonusXp, color: "#60a5fa" });
        if (data.repGains && Array.isArray(data.repGains)) {
          for (const rg of data.repGains) {
            if (rg.gained > 0) currencies.push({ name: `${rg.factionName} Rep`, amount: rg.gained, color: rg.factionIcon === "\u{1F702}" ? "#ef4444" : rg.factionIcon === "\u{1F704}" ? "#3b82f6" : rg.factionIcon === "\u{1F701}" ? "#f59e0b" : "#ec4899" });
          }
        }
        advanceTutorial();
        setRewardCelebration({
          type: isNpcQuest ? "npc-quest" : data.companionReward ? "companion" : "quest",
          title: data.npcFinalReward ? `${questTitle} — Chain Complete` : questTitle,
          xpEarned: data.xpEarned || 0,
          goldEarned: data.goldEarned || 0,
          loot: data.npcFinalReward ? { name: data.npcFinalReward.name, emoji: "◆", rarity: data.npcFinalReward.rarity || "epic", rarityColor: data.npcFinalReward.rarity === "legendary" ? "#f97316" : data.npcFinalReward.rarity === "epic" ? "#a855f7" : "#3b82f6", icon: data.npcFinalReward.icon } : data.lootDrop || null,
          achievement: data.newAchievements?.length > 0 ? data.newAchievements[0] : null,
          ...(currencies.length > 0 ? { currencies } : {}),
          ...(data.npcFinalReward
            ? { flavor: `${data.npcFinalReward.name} — ${data.npcFinalReward.desc || "A unique reward for completing this chain."}` }
            : data.gambleResult === "double"
              ? { flavor: "Gamble paid off. Double rewards." }
              : data.gambleResult === "halved"
                ? { flavor: "Gamble lost. Half rewards." }
            : data.varietyBonus && data.varietyBonus.bonus > 0
              ? { flavor: `${data.varietyBonus.types} quest types today. Variety Bonus +${data.varietyBonus.bonus}% XP.` }
            : data.dailyDiminishing != null && data.dailyDiminishing < 1
              ? { flavor: `Quest ${data.dailyQuestCount || "?"} today. Rewards reduced to ${Math.round(data.dailyDiminishing * 100)}%.` }
              : data.dailyQuestCount != null && data.dailyQuestCount <= 5
                ? { flavor: `Quest ${data.dailyQuestCount} of 5 at full rewards today` }
                : {}
          ),
          ...(data.companionReward ? {
            bondXp: data.companionReward.bondXpGained || 0,
            companionEmoji: data.companionReward.companionType === "ember_sprite" ? "🔥" : data.companionReward.companionType === "lore_owl" ? "🦉" : data.companionReward.companionType === "gear_golem" ? "⚙️" : "🐾",
            companionAccent: data.companionReward.companionType === "ember_sprite" ? "#f97316" : data.companionReward.companionType === "lore_owl" ? "#a78bfa" : data.companionReward.companionType === "gear_golem" ? "#60a5fa" : "#ff6b9d",
          } : {}),
          chainQuestTemplate: data.chainQuestTemplate || null,
          levelUp: data.levelUp || null,
        });
        // Fire toasts for additional achievements beyond the first (which is shown in celebration)
        if (data.newAchievements?.length > 1) {
          for (let i = 1; i < data.newAchievements.length; i++) {
            addToast({ type: "achievement", achievement: data.newAchievements[i] });
          }
        }
        // Fire companion bond toast if companion quest awarded bond XP
        if (data.companionReward) {
          const cr = data.companionReward;
          const isUltimateUnlock = cr.bondLevelUp === 5;
          addToast({
            type: "companionBond",
            companionName: cr.companionName || "Companion",
            companionEmoji: cr.companionType === "ember_sprite" ? "🔥" : cr.companionType === "lore_owl" ? "🦉" : cr.companionType === "gear_golem" ? "⚙️" : "🐾",
            bondXpGained: cr.bondXpGained || 1,
            newBondXp: cr.newBondXp || 0,
            bondTitle: cr.bondTitle || "Stranger",
            bondLevelUp: !!cr.bondLevelUp,
          });
          if (isUltimateUnlock) {
            addToast({ type: "flavor", message: `${cr.companionName || "Companion"} hat etwas erwachen lassen, das lange geschlafen hat.`, icon: "★", sub: "Bond Level 5 — eine lang gehaltene Luft entweicht." });
          }
        }
        if (data.levelUp) {
          pendingLevelUpRef.current = data.levelUp;
        }
        // Toast for gem drops
        if (data.gemDrop) {
          addToast({
            type: "item",
            itemName: data.gemDrop.name,
            message: "Ein Stein, aus seinem Versteck gelöst.",
            icon: data.gemDrop.icon,
            rarity: data.gemDrop.rarity || "rare",
            item: { name: data.gemDrop.name, rarity: data.gemDrop.rarity || "rare", icon: data.gemDrop.icon || null, desc: data.gemDrop.desc || null, stats: data.gemDrop.stats || null },
          });
        }
        // Toast for material drops
        if (data.materialDrops && Array.isArray(data.materialDrops) && data.materialDrops.length > 0) {
          const matNames = data.materialDrops.map((m: { name?: string; id: string; amount: number }) => `${m.amount}x ${m.name || m.id}`).join(", ");
          addToast({ type: "item", itemName: matNames, message: "Material aufgelesen. Nützlich, diesmal.", rarity: "uncommon" });
        }
        // Warning: inventory was full, loot was lost
        if (data.inventoryFull) {
          addToast({ type: "error", message: "Inventory full — loot item lost. Free up space." });
        }
        // Streak milestone celebration
        if (data.streakMilestone) {
          SFX.streakMilestone();
          addToast({ type: "flavor", message: `${data.streakMilestone.days}-Day Streak. ${data.streakMilestone.label || "The flame endures."}`, icon: data.streakMilestone.badge || "◆" });
        }
        // Toast for recipe discoveries
        if (data.recipeDrop) {
          addToast({ type: "item", itemName: data.recipeDrop.name, message: "Ein Rezept taucht auf. Irgendwer, irgendwo, vermisst es.", rarity: "epic" });
        }
        // Toast for codex discoveries
        if (data.codexDiscovery && Array.isArray(data.codexDiscovery) && data.codexDiscovery.length > 0) {
          for (const entry of data.codexDiscovery) {
            addToast({ type: "flavor", message: `Codex: ${entry.title || "New entry"} discovered.`, icon: "◆" });
          }
        }
        // Toast for achievement point milestone unlocks (frames, titles)
        if (data.milestoneUnlocks && Array.isArray(data.milestoneUnlocks)) {
          for (const ml of data.milestoneUnlocks) {
            addToast({ type: "flavor", message: `${ml.type === "frame" ? "Frame" : "Title"} Unlocked: ${ml.name}`, icon: "★", sub: `${ml.atPoints} Achievement Points` });
          }
        }
        // Toast for battle pass level-up
        if (data.battlePassLevelUp) {
          addToast({ type: "flavor", message: `Season Pass Level ${data.battlePassLevelUp.level}. Die Saison nickt dir zu.`, icon: "◆" });
        }
        // Toast for faction rep level-ups
        if (data.repGains) {
          for (const rg of data.repGains) {
            if (rg.leveledUp) {
              addToast({ type: "flavor", message: `${rg.factionName}: ${rg.standingName}!`, icon: rg.factionIcon || "◆", sub: `+${rg.gained} Rep` });
            }
          }
        }
        // Bond objective completed notification
        if (data.bondObjectiveCompleted) {
          addToast({ type: "flavor", message: "Sworn Bond objective complete. Chest ready.", icon: "★", sub: "Visit your Bond to claim." });
        }
        // Expedition checkpoint reached notification
        if (data.expeditionCheckpoint) {
          addToast({ type: "flavor", message: "Expedition checkpoint reached. Rewards available.", icon: "◆", sub: "The guild advances together." });
        }
        // World Boss defeated notification
        if (data.worldBossDefeated) {
          addToast({ type: "flavor", message: "World Boss defeated. Claim your rewards in the Colosseum.", icon: "★", sub: "Your blow was the last." });
        }
        // Diminishing returns notification — warn early, then each tier
        if (data.dailyQuestCount === 5) addToast({ type: "flavor", message: "Full rewards reached for today", icon: "◆", sub: "Next quests earn 75% — the forge cools" });
        else if (data.dailyQuestCount === 6) addToast({ type: "flavor", message: "Rewards at 75%", icon: "◆", sub: `Quest ${data.dailyQuestCount} — first 5 were full value` });
        else if (data.dailyQuestCount === 11) addToast({ type: "flavor", message: "Daily rewards reduced to 50%", icon: "◆", sub: "Consider resting until tomorrow" });
        else if (data.dailyQuestCount === 21) addToast({ type: "flavor", message: "Daily rewards at minimum (25%)", icon: "◆", sub: "Your forge burns low — rest and return stronger" });

        // Optimistically update NPC quest chain
        setActiveNpcs(prev => prev.map(npc => {
          if (!npc.questChain.some(q => q.questId === questId)) return npc;
          let unlockNext = false;
          const updated = npc.questChain.map(q => {
            if (q.questId === questId) { unlockNext = true; return { ...q, status: "completed" as const, completedBy: playerName.toLowerCase() }; }
            if (unlockNext && q.status === "locked") { unlockNext = false; return { ...q, status: "open" as const }; }
            return q;
          });
          return { ...npc, questChain: updated };
        }));
        setSelectedNpc(prev => {
          if (!prev || !prev.questChain.some(q => q.questId === questId)) return prev;
          let unlockNext = false;
          const updated = prev.questChain.map(q => {
            if (q.questId === questId) { unlockNext = true; return { ...q, status: "completed" as const, completedBy: playerName.toLowerCase() }; }
            if (unlockNext && q.status === "locked") { unlockNext = false; return { ...q, status: "open" as const }; }
            return q;
          });
          return { ...prev, questChain: updated };
        });
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: d.error || "Failed to complete quest" });
      }
    } catch {
      addToast({ type: "error", message: "Network error — could not complete quest", onRetry: () => handleComplete(questId, questTitle) });
    } finally {
      setLoadingAction(null);
    }
  }, [reviewApiKey, playerName, refresh, setChainOffer, setRewardCelebration, pendingLevelUpRef, setActiveNpcs, setSelectedNpc, addToast]);

  const handleChainAccept = useCallback(async (chainOffer: { template: Record<string, unknown>; parentTitle: string } | null) => {
    if (!reviewApiKey || !chainOffer) return;
    try {
      const r = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ ...chainOffer.template, createdBy: playerName || "unknown" }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: (d as { error?: string }).error || "Failed to create chain quest" });
        return;
      }
      setChainOffer(null);
      await refresh();
    } catch {
      addToast({ type: "error", message: "Failed to accept chain quest" });
    }
  }, [reviewApiKey, playerName, refresh, setChainOffer, addToast]);

  const handlePoolRefresh = useCallback(async () => {
    if (!playerName || !reviewApiKey || poolRefreshing) return;
    setPoolRefreshing(true);
    try {
      const r = await fetch(`/api/quests/pool/refresh?player=${encodeURIComponent(playerName)}`, {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey) },
      });
      if (r.ok) {
        setLastPoolRefresh(new Date());
        addToast({ type: "flavor", message: "Quest pool refreshed. New scrolls on the board.", icon: "/images/icons/ui-quest-scroll.png" });
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        if (d.error) setApiErrorWithAutoClose(d.error);
      }
    } catch {
      addToast({ type: "error", message: "Network error — could not refresh quest pool" });
    } finally {
      setPoolRefreshing(false);
    }
  }, [playerName, reviewApiKey, poolRefreshing, refresh, setApiErrorWithAutoClose, addToast, setLastPoolRefresh]);

  const handleShopBuy = useCallback(async (userId: string, itemId: string) => {
    if (!reviewApiKey || !userId || loadingRef.current) return;
    setLoadingAction({ questId: itemId, action: "shopBuy" });
    try {
      const r = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ userId, itemId }),
      });
      if (r.ok) {
        const data = await r.json();
        setShopUserId(null);
        if (data.item?.name) {
          setRewardCelebration({
            type: "daily-bonus" as RewardCelebrationData["type"],
            title: data.item.name || "Item Acquired",
            xpEarned: 0,
            goldEarned: 0,
            loot: { name: data.item.name, emoji: "", rarity: data.item.rarity || "common", rarityColor: undefined },
          });
        }
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: d.error || "Purchase failed" });
      }
    } catch {
      addToast({ type: "error", message: "Network error — purchase failed" });
    } finally {
      setLoadingAction(null);
    }
  }, [reviewApiKey, refresh, addToast, setRewardCelebration]);

  const handleGearBuy = useCallback(async (userId: string, gearId: string) => {
    if (!reviewApiKey || !userId || loadingRef.current) return;
    setLoadingAction({ questId: gearId, action: "gearBuy" });
    try {
      const r = await fetch("/api/shop/gear/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ userId, gearId }),
      });
      if (r.ok) {
        const data = await r.json();
        setShopUserId(null);
        if (data.gear?.name) {
          setRewardCelebration({
            type: "daily-bonus" as RewardCelebrationData["type"],
            title: data.gear.name || "Gear Acquired",
            xpEarned: 0,
            goldEarned: 0,
            loot: { name: data.gear.name, emoji: "", rarity: data.gear.rarity || "common", rarityColor: undefined },
          });
        }
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        addToast({ type: "error", message: d.error || "Gear purchase failed" });
      }
    } catch {
      addToast({ type: "error", message: "Network error — gear purchase failed" });
    } finally {
      setLoadingAction(null);
    }
  }, [reviewApiKey, refresh, addToast, setRewardCelebration]);

  return {
    // State
    selectedIds, setSelectedIds,
    bulkLoading,
    reviewComments, setReviewComments,
    poolRefreshing,
    shopUserId, setShopUserId,
    loadingAction,
    // Handlers
    handleApprove,
    handleReject,
    toggleSelect,
    handleBulkUpdate,
    handleToggleFavorite,
    handleClaim,
    handleUnclaim,
    handleCoopClaim,
    handleCoopComplete,
    handleComplete,
    handleChainAccept,
    handlePoolRefresh,
    handleShopBuy,
    handleGearBuy,
    updateNpcQuestStatus,
  };
}
