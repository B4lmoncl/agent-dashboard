"use client";

import { useCallback, useState } from "react";
import type { Quest, ActiveNpc, Ritual } from "@/app/types";
import type { RewardCelebrationData } from "@/components/RewardCelebration";
import { getAuthHeaders } from "@/lib/auth-client";


interface UseQuestActionsParams {
  reviewApiKey: string;
  playerName: string;
  refresh: () => Promise<void>;
  setActiveNpcs: React.Dispatch<React.SetStateAction<ActiveNpc[]>>;
  setSelectedNpc: React.Dispatch<React.SetStateAction<ActiveNpc | null>>;
  setChainOffer: (v: { template: { title: string; description?: string | null; type?: string; priority?: string }; parentTitle: string } | null) => void;
  setRewardCelebration: (v: RewardCelebrationData | null) => void;
  pendingLevelUpRef: React.MutableRefObject<{ level: number; title: string } | null>;
  setRituals: React.Dispatch<React.SetStateAction<Ritual[]>>;
  addToast: (t: { type: string; message?: string; icon?: string; sub?: string }) => void;
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
  setRituals,
  addToast,
  setApiErrorWithAutoClose,
  lastPoolRefresh,
  setLastPoolRefresh,
}: UseQuestActionsParams) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [poolRefreshing, setPoolRefreshing] = useState(false);
  const [shopUserId, setShopUserId] = useState<string | null>(null);

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
    if (!reviewApiKey) return;
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
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh]);

  const handleReject = useCallback(async (id: string, comment?: string) => {
    if (!reviewApiKey) return;
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
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh]);

  const handleChangePriority = useCallback(async (id: string, priority: Quest["priority"]) => {
    if (!reviewApiKey) return;
    try {
      await fetch(`/api/quest/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ priority }),
      });
    } catch { /* ignore */ }
  }, [reviewApiKey]);

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
      await fetch("/api/quests/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      setSelectedIds(new Set());
      await refresh();
    } catch { /* ignore */ } finally {
      setBulkLoading(false);
    }
  }, [reviewApiKey, selectedIds, refresh]);

  const handleToggleFavorite = useCallback(async (questId: string, favorites: string[]) => {
    if (!reviewApiKey || !playerName) return;
    const isFav = favorites.includes(questId);
    const action = isFav ? "remove" : "add";
    try {
      await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ questId, action }),
      });
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName]);

  const handleClaim = useCallback(async (questId: string) => {
    if (!reviewApiKey || !playerName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ agentId: playerName }),
      });
      if (r.ok) {
        updateNpcQuestStatus(questId, "in_progress", playerName.toLowerCase());
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh, updateNpcQuestStatus]);

  const handleUnclaim = useCallback(async (questId: string) => {
    if (!reviewApiKey || !playerName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/unclaim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ agentId: playerName }),
      });
      if (r.ok) {
        updateNpcQuestStatus(questId, "open", null);
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh, updateNpcQuestStatus]);

  const handleCoopClaim = useCallback(async (questId: string) => {
    if (!reviewApiKey || !playerName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/coop-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ userId: playerName }),
      });
      if (r.ok) await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleCoopComplete = useCallback(async (questId: string) => {
    if (!reviewApiKey || !playerName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/coop-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ userId: playerName }),
      });
      if (r.ok) await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleComplete = useCallback(async (questId: string, questTitle: string) => {
    if (!reviewApiKey || !playerName) return;
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
        setRewardCelebration({
          type: isNpcQuest ? "npc-quest" : "quest",
          title: questTitle,
          xpEarned: data.xpEarned || 0,
          goldEarned: data.goldEarned || 0,
          loot: data.lootDrop || null,
          achievement: data.newAchievements?.length > 0 ? data.newAchievements[0] : null,
        });
        if (data.levelUp) {
          pendingLevelUpRef.current = data.levelUp;
        }
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
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh, setChainOffer, setRewardCelebration, pendingLevelUpRef, setActiveNpcs, setSelectedNpc]);

  const handleChainAccept = useCallback(async (chainOffer: { template: Record<string, unknown>; parentTitle: string } | null) => {
    if (!reviewApiKey || !chainOffer) return;
    try {
      await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ ...chainOffer.template, createdBy: playerName || "unknown" }),
      });
      setChainOffer(null);
      await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh, setChainOffer]);

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
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        if (d.error) setApiErrorWithAutoClose(d.error);
      }
    } catch { /* ignore */ } finally {
      setPoolRefreshing(false);
    }
  }, [playerName, reviewApiKey, poolRefreshing, refresh, setApiErrorWithAutoClose]);

  const handleShopBuy = useCallback(async (userId: string, itemId: string) => {
    if (!reviewApiKey || !userId) return;
    try {
      const r = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ userId, itemId }),
      });
      if (r.ok) {
        const data = await r.json();
        setShopUserId(null);
        if (data.item?.name) addToast({ type: "purchase", message: `${data.item.name} acquired!` });
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh, addToast]);

  const handleGearBuy = useCallback(async (userId: string, gearId: string) => {
    if (!reviewApiKey || !userId) return;
    try {
      const r = await fetch("/api/shop/gear/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ userId, gearId }),
      });
      if (r.ok) {
        const data = await r.json();
        setShopUserId(null);
        if (data.gear?.name) addToast({ type: "purchase", message: `${data.gear.name} acquired!` });
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh, addToast]);

  return {
    // State
    selectedIds, setSelectedIds,
    bulkLoading,
    reviewComments, setReviewComments,
    poolRefreshing,
    shopUserId, setShopUserId,
    // Handlers
    handleApprove,
    handleReject,
    handleChangePriority,
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
