"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import AgentCard from "@/components/AgentCard";
import StatBar from "@/components/StatBar";
import OnboardingWizard from "@/components/OnboardingWizard";
import LeaderboardView from "@/components/LeaderboardView";
import HonorsView from "@/components/HonorsView";
import CVBuilderPanel from "@/components/CVBuilderPanel";
import BattlePassView from "@/components/BattlePassView";
import CampaignHub from "@/components/CampaignHub";
import ShopView from "@/components/ShopView";
import GachaView from "@/components/GachaView";
import CharacterView from "@/components/CharacterView";
import { GuideModal, GuideContent, TutorialOverlay, TUTORIAL_STEPS } from "@/components/TutorialModal";
import {
  CreateQuestModal, PersonalQuestPanel, ForgeChallengesPanel, AntiRitualePanel,
  RelationshipCoopPanel, DobbieQuestPanel, SmartSuggestionsPanel, LearningQuestPanel,
  HouseholdQuestBoard, ThoughtfulHeroPanel, CategoryBadge, ProductBadge,
  HumanInputBadge, TypeBadge, CreatorBadge, AgentBadge, RecurringBadge,
  CompletedQuestRow, PriorityBadge, ClickablePriorityBadge, EpicQuestCard, QuestCard,
  ChainQuestToast, AchievementToast, FlavorToast, EmptyState, SkeletonCard,
  UserCard, ShopModal, RARITY_COLORS,
} from "@/components/QuestBoard";
import { ToastStack, useToastStack } from "@/components/ToastStack";
import { CompanionsWidget } from "@/components/CompanionsWidget";
import { RoadmapView } from "@/components/RoadmapView";
import { InfoTooltip } from "@/components/InfoTooltip";
import { WandererRest } from "@/components/WandererRest";
import GuildHallBackground from "@/components/GuildHallBackground";
import FeedbackOverlay from "@/components/FeedbackOverlay";
import { ModalPortal } from "@/components/ModalPortal";
import type {
  Agent, Quest, NpcQuestChainEntry, ActiveNpc, EarnedAchievement,
  User, CampaignQuest, Campaign, AchievementDef, ClassDef, LeaderboardEntry,
  QuestsData, Ritual, Habit, LootItem, ChangelogCommit, ChangelogEntry,
  PersonalTemplate, ForgeChallengeTemplate, AntiRitual, Suggestion, CVData,
  ShopItem, RoadmapItem,
} from "@/app/types";
import {
  fetchAgents, fetchQuests, fetchUsers, fetchCampaigns, fetchLeaderboard,
  fetchAchievementCatalogue, fetchRituals, fetchHabits, fetchChangelog,
  createStarterQuestsIfNew, timeAgo, useCountUp, getSeason, CURRENT_SEASON,
  GUILD_LEVELS, getUserLevel, USER_LEVELS, getUserXpProgress, getForgeTempInfo,
  getQuestRarity, getAntiRitualMood, LB_LEVELS, getLbLevel,
} from "@/app/utils";
import {
  priorityConfig, categoryConfig, productConfig, typeConfig, STREAK_MILESTONES_CLIENT,
} from "@/app/config";

const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4, companion: 1 };

// ─── Ritual / Vow Commitment Tiers ───────────────────────────────────────────
const COMMITMENT_TIERS = [
  { id: "none",     label: "None",     days: 0,   color: "rgba(255,255,255,0.25)", bonusGold: 0,  bonusXp: 0,  flavorShort: "No commitment" },
  { id: "spark",    label: "Spark",    days: 7,   color: "#94a3b8",                bonusGold: 3,  bonusXp: 5,  flavorShort: "First spark" },
  { id: "flame",    label: "Flame",    days: 21,  color: "#cd7f32",                bonusGold: 7,  bonusXp: 10, flavorShort: "Habit forms" },
  { id: "ember",    label: "Ember",    days: 60,  color: "#f59e0b",                bonusGold: 13, bonusXp: 20, flavorShort: "Deeply anchored" },
  { id: "crucible", label: "Crucible", days: 180, color: "#e2e8f0",                bonusGold: 20, bonusXp: 35, flavorShort: "Refined in fire" },
  { id: "eternity", label: "Eternity", days: 365, color: "#a78bfa",                bonusGold: 30, bonusXp: 50, flavorShort: "For eternity" },
];

function getSeraineSpeech(commitment: string, bloodPact: boolean): string {
  if (bloodPact) return "Den Blutknoten also. Ich werde dich nicht davon abhalten. Aber die letzte Person die hier einen Blutknoten geschworen hat, stand drei Monate später weinend vor meiner Tür. Tee?";
  if (commitment === "eternity") return "Ein Jahr. Es gibt Kriege, die kürzer dauern. Königreiche, die weniger Bestand haben. Bist du sicher?";
  if (commitment === "none") return "Kein Ziel? Mutig. Oder feige. Manchmal ist das dasselbe.";
  return "Ein neues Ritual? Gut. Sag mir nicht, warum es dir wichtig ist. Zeig es mir. Morgen. Und übermorgen.";
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [quests, setQuests] = useState<QuestsData>({ open: [], inProgress: [], completed: [], suggested: [], rejected: [] });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [apiLive, setApiLive] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedSearch, setCompletedSearch] = useState("");
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [sortMode, setSortMode] = useState<"rarity" | "newest">("rarity");
  const [versions, setVersions] = useState<{ dashboard: string; app: string } | null>(null);
  const [reviewApiKey, setReviewApiKey] = useState<string>(() => {
    try { return localStorage.getItem("dash_api_key") || ""; } catch { return ""; }
  });
  const [reviewKeyInput, setReviewKeyInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dashView, setDashView] = useState<"questBoard" | "npcBoard" | "klassenquests" | "character" | "campaign" | "leaderboard" | "honors" | "season" | "shop" | "gacha" | "roadmap" | "changelog">("questBoard");
  const [createQuestOpen, setCreateQuestOpen] = useState(false);
  const [questBoardAgentOpen, setQuestBoardAgentOpen] = useState(false);
  const [npcAgentRosterOpen, setNpcAgentRosterOpen] = useState(true);
  const [dobbieOpen, setDobbieOpen] = useState(false);
  const [shopUserId, setShopUserId] = useState<string | null>(null);
  // Toast stack system (replaces individual toast states)
  const { toasts, addToast, removeToast } = useToastStack();
  // Compat setters that push into the unified toast stack
  const setToast = useCallback((a: EarnedAchievement | null) => { if (a) addToast({ type: "achievement", achievement: a }); }, [addToast]);
  const setFlavorToast = useCallback((t: { message: string; icon: string; sub?: string } | null) => { if (t) addToast({ type: "flavor", ...t }); }, [addToast]);
  const setPurchaseToast = useCallback((msg: string | null) => { if (msg) addToast({ type: "purchase", message: msg }); }, [addToast]);
  const [chainOffer, setChainOffer] = useState<{ template: { title: string; description?: string | null; type?: string; priority?: string }; parentTitle: string } | null>(null);
  const [openSectionCollapsed, setOpenSectionCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("qb_open_collapsed") === "true"; } catch { return false; }
  });
  const [inProgressSectionCollapsed, setInProgressSectionCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("qb_inprogress_collapsed") === "true"; } catch { return false; }
  });
  const [devOpenCollapsed, setDevOpenCollapsed] = useState(true);
  const [devInProgressCollapsed, setDevInProgressCollapsed] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievementCatalogue, setAchievementCatalogue] = useState<AchievementDef[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [playerName, setPlayerName] = useState<string>(() => {
    try { return localStorage.getItem("dash_player_name") || ""; } catch { return ""; }
  });
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [cvBuilderOpen, setCvBuilderOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [classesList, setClassesList] = useState<ClassDef[]>([]);
  const [classActivatedNotif, setClassActivatedNotif] = useState<{ className: string; classIcon: string; classDescription: string } | null>(null);
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [lootDrop, setLootDrop] = useState<LootItem | null>(null);
  const [questBoardTab, setQuestBoardTab] = useState<"auftraege" | "rituale" | "anti-rituale">("auftraege");
  const [createRitualOpen, setCreateRitualOpen] = useState(false);
  const [newRitualTitle, setNewRitualTitle] = useState("");
  const [ritualNameError, setRitualNameError] = useState(false);
  const [ritualCommitmentError, setRitualCommitmentError] = useState(false);
  const [newRitualSchedule, setNewRitualSchedule] = useState("daily");
  const [newRitualCategory, setNewRitualCategory] = useState("personal");
  const [newRitualCommitment, setNewRitualCommitment] = useState("none");
  const [newRitualBloodPact, setNewRitualBloodPact] = useState(false);
  const [deleteRitualConfirmId, setDeleteRitualConfirmId] = useState<string | null>(null);
  const [extendRitualId, setExtendRitualId] = useState<string | null>(null);
  const [extendRitualCommitment, setExtendRitualCommitment] = useState("none");
  const [recommitRitualId, setRecommitRitualId] = useState<string | null>(null);

  useEffect(() => {
    if (!createRitualOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCreateRitualOpen(false); setNewRitualTitle(""); setNewRitualCommitment("none"); setNewRitualBloodPact(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createRitualOpen]);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [poolRefreshing, setPoolRefreshing] = useState(false);
  const [npcBoardFilter, setNpcBoardFilter] = useState<string | null>(null);
  const [activeNpcs, setActiveNpcs] = useState<ActiveNpc[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<ActiveNpc | null>(null);
  const [infoOverlayOpen, setInfoOverlayOpen] = useState(false);
  const [infoOverlayTab, setInfoOverlayTab] = useState<"roadmap" | "changelog" | "guide">("roadmap");
  const [settingsPopupOpen, setSettingsPopupOpen] = useState(false);
  const settingsPopupRef = useRef<HTMLDivElement>(null);
  const [questDetailModal, setQuestDetailModal] = useState<Quest | null>(null);
  const [currenciesOpen, setCurrenciesOpen] = useState(false);
  const [currencyExpanded, setCurrencyExpanded] = useState<string | null>(null);
  const [feedbackMode, setFeedbackMode] = useState(false);

  // Quest detail modal — ESC to close
  useEffect(() => {
    if (!questDetailModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setQuestDetailModal(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [questDetailModal]);

  // Settings popup — click-outside to close
  useEffect(() => {
    if (!settingsPopupOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsPopupRef.current && !settingsPopupRef.current.contains(e.target as Node)) {
        setSettingsPopupOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsPopupOpen]);


  // ─── apiFetch wrapper ─────────────────────────────────────────────────────
  const [apiError, setApiError] = useState<string | null>(null);
  const apiErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setApiErrorWithAutoClose = useCallback((msg: string | null) => {
    setApiError(msg);
    if (apiErrorTimerRef.current) clearTimeout(apiErrorTimerRef.current);
    if (msg) {
      apiErrorTimerRef.current = setTimeout(() => setApiError(null), 5000);
    }
  }, []);
  // Escape key dismisses api error toast
  useEffect(() => {
    if (!apiError) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setApiError(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [apiError]);
  const apiFetch = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    const r = await fetch(url, options);
    if (r.status === 429) {
      const msg = "Zu viel geschmiedet! Der Amboss muss erst abkühlen. Warte kurz vor dem Einreichen neuer Quests.";
      setApiErrorWithAutoClose(msg);
      throw new Error(msg);
    }
    return r;
  }, []);

  const refresh = useCallback(async () => {
    const [a, q, u, lb, ac, camps] = await Promise.all([fetchAgents(), fetchQuests(playerName || undefined), fetchUsers(), fetchLeaderboard(), fetchAchievementCatalogue(), fetchCampaigns()]);
    // Lyra always first, then online/working agents, then rest
    const statusOrder: Record<string, number> = { working: 0, online: 1, idle: 2, offline: 3 };
    const sorted = [...a].sort((x, y) => {
      if (x.id === "lyra") return -1;
      if (y.id === "lyra") return 1;
      const sx = statusOrder[x.status] ?? 3;
      const sy = statusOrder[y.status] ?? 3;
      if (sx !== sy) return sx - sy;
      return x.name.localeCompare(y.name);
    });
    setAgents(sorted);
    setQuests(q);
    setUsers(u);
    if (lb.length > 0) setLeaderboard(lb);
    if (ac.length > 0) setAchievementCatalogue(ac);
    setCampaigns(camps);
    if (playerName) {
      fetchRituals(playerName).then(setRituals);
      fetchHabits(playerName).then(setHabits);
    }
    try {
      const r = await fetch(`/api/health`, { signal: AbortSignal.timeout(1500) });
      setApiLive(r.ok);
    } catch { setApiLive(false); }
    try {
      const r = await fetch(`/api/version`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) setVersions(await r.json());
    } catch { /* ignore */ }
    try {
      const npcUrl = playerName ? `/api/npcs/active?player=${encodeURIComponent(playerName.toLowerCase())}` : `/api/npcs/active`;
      const r = await fetch(npcUrl, { signal: AbortSignal.timeout(2000) });
      if (r.ok) { const d = await r.json(); setActiveNpcs(d.npcs || []); }
    } catch { /* ignore */ }
    setLoading(false);
    setLastRefresh(new Date());
  }, [playerName]);

  const handleApprove = useCallback(async (id: string, comment?: string) => {
    const key = reviewApiKey;
    if (!key) return;
    try {
      const body = comment ? JSON.stringify({ comment }) : undefined;
      const r = await fetch(`/api/quest/${id}/approve`, {
        method: "POST",
        headers: { "X-API-Key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
      });
      if (r.ok) {
        setReviewComments(prev => { const next = { ...prev }; delete next[id]; return next; });
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh]);

  const handleReject = useCallback(async (id: string, comment?: string) => {
    const key = reviewApiKey;
    if (!key) return;
    try {
      const body = comment ? JSON.stringify({ comment }) : undefined;
      const r = await fetch(`/api/quest/${id}/reject`, {
        method: "POST",
        headers: { "X-API-Key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
      });
      if (r.ok) {
        setReviewComments(prev => { const next = { ...prev }; delete next[id]; return next; });
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh]);

  const handleChangePriority = useCallback(async (id: string, priority: Quest["priority"]) => {
    const key = reviewApiKey;
    if (!key) return;
    try {
      await fetch(`/api/quest/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ priority }),
      });
      setQuests(prev => ({
        ...prev,
        suggested: prev.suggested.map(q => q.id === id ? { ...q, priority } : q),
      }));
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
    const key = reviewApiKey;
    if (!key || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await fetch("/api/quests/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      setSelectedIds(new Set());
      await refresh();
    } catch { /* ignore */ } finally {
      setBulkLoading(false);
    }
  }, [reviewApiKey, selectedIds, refresh]);

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
  }, []);

  const handleClaim = useCallback(async (questId: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ agentId: pName }),
      });
      if (r.ok) {
        updateNpcQuestStatus(questId, "in_progress", pName.toLowerCase());
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh, updateNpcQuestStatus]);

  const handleUnclaim = useCallback(async (questId: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/unclaim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ agentId: pName }),
      });
      if (r.ok) {
        updateNpcQuestStatus(questId, "open", null);
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh, updateNpcQuestStatus]);

  const handleCoopClaim = useCallback(async (questId: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/coop-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ userId: pName }),
      });
      if (r.ok) await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleCoopComplete = useCallback(async (questId: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/coop-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ userId: pName }),
      });
      if (r.ok) await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleComplete = useCallback(async (questId: string, questTitle: string) => {
    const key = reviewApiKey;
    const pName = playerName;
    if (!key || !pName) return;
    try {
      const r = await fetch(`/api/quest/${questId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ agentId: pName }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.newAchievements?.length > 0) setToast(data.newAchievements[0]);
        if (data.chainQuestTemplate) {
          setChainOffer({ template: data.chainQuestTemplate, parentTitle: questTitle });
        }
        if (data.lootDrop) {
          setLootDrop(data.lootDrop);
        }
        // Show flavor feedback on completion
        const currentUser = users.find(u => u.id === pName.toLowerCase() || u.name.toLowerCase() === pName.toLowerCase());
        const streak = currentUser?.streakDays ?? 0;
        const FLAVOR_MESSAGES = [
          { message: "Quest slain!", icon: "×" },
          { message: "Like a pro!", icon: "×" },
          { message: "Clutch finish!", icon: "×" },
          { message: "Well played!", icon: "×" },
          { message: "The Forge burns bright!", icon: "×" },
        ];
        let flavor = FLAVOR_MESSAGES[Math.floor(Math.random() * FLAVOR_MESSAGES.length)];
        if (streak >= 30) flavor = { message: "Legendary streak!", icon: "×" };
        else if (streak >= 7) flavor = { message: "Streak master!", icon: "×" };
        setFlavorToast({ ...flavor, sub: questTitle.length > 40 ? questTitle.slice(0, 40) + "…" : questTitle });
        // Optimistically update NPC quest chain: mark completed + unlock next locked quest
        setActiveNpcs(prev => prev.map(npc => {
          if (!npc.questChain.some(q => q.questId === questId)) return npc;
          let unlockNext = false;
          const updated = npc.questChain.map(q => {
            if (q.questId === questId) { unlockNext = true; return { ...q, status: "completed" as const, completedBy: pName.toLowerCase() }; }
            if (unlockNext && q.status === "locked") { unlockNext = false; return { ...q, status: "open" as const }; }
            return q;
          });
          return { ...npc, questChain: updated };
        }));
        setSelectedNpc(prev => {
          if (!prev || !prev.questChain.some(q => q.questId === questId)) return prev;
          let unlockNext = false;
          const updated = prev.questChain.map(q => {
            if (q.questId === questId) { unlockNext = true; return { ...q, status: "completed" as const, completedBy: pName.toLowerCase() }; }
            if (unlockNext && q.status === "locked") { unlockNext = false; return { ...q, status: "open" as const }; }
            return q;
          });
          return { ...prev, questChain: updated };
        });
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, playerName, refresh]);

  const handleChainAccept = useCallback(async () => {
    const key = reviewApiKey;
    if (!key || !chainOffer) return;
    try {
      await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ ...chainOffer.template, createdBy: playerName || "unknown" }),
      });
      setChainOffer(null);
      await refresh();
    } catch { /* ignore */ }
  }, [reviewApiKey, chainOffer, playerName, refresh]);

  const handlePoolRefresh = useCallback(async () => {
    if (!playerName || !reviewApiKey || poolRefreshing) return;
    setPoolRefreshing(true);
    try {
      const r = await fetch(`/api/quests/pool/refresh?player=${encodeURIComponent(playerName)}`, {
        method: "POST",
        headers: { "x-api-key": reviewApiKey },
      });
      if (r.ok) {
        await refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        if (d.error) setApiErrorWithAutoClose(d.error);
      }
    } catch { /* ignore */ } finally {
      setPoolRefreshing(false);
    }
  }, [playerName, reviewApiKey, poolRefreshing, refresh]);

  const handleShopBuy = useCallback(async (userId: string, itemId: string) => {
    const key = reviewApiKey;
    if (!key || !userId) return;
    try {
      const r = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ userId, itemId }),
      });
      if (r.ok) {
        const data = await r.json();
        setShopUserId(null);
        if (data.item?.name) setPurchaseToast(`${data.item.name} acquired!`);
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh]);

  const handleGearBuy = useCallback(async (userId: string, gearId: string) => {
    const key = reviewApiKey;
    if (!key || !userId) return;
    try {
      const r = await fetch("/api/shop/gear/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ userId, gearId }),
      });
      if (r.ok) {
        const data = await r.json();
        setShopUserId(null);
        if (data.gear?.name) setPurchaseToast(`${data.gear.name} acquired!`);
        await refresh();
      }
    } catch { /* ignore */ }
  }, [reviewApiKey, refresh]);

  // Toast auto-dismiss is handled by ToastStack

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Fetch class list once on mount
  useEffect(() => {
    fetch("/api/classes")
      .then(r => r.ok ? r.json() : [])
      .then(setClassesList)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      if (lastRefresh) setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastRefresh]);

  // Auto-trigger tutorial on first visit (no login required)
  useEffect(() => {
    try {
      if (localStorage.getItem("tutorialCompleted") !== "true") {
        const t = setTimeout(() => { setShowTutorial(true); setTutorialStep(0); }, 800);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (dashView === "changelog" && changelog.length === 0 && !changelogLoading) {
      setChangelogLoading(true);
      fetchChangelog().then(entries => { setChangelog(entries); setChangelogLoading(false); });
    }
  }, [dashView, changelog.length, changelogLoading]);

  // Load changelog when info overlay changelog tab is opened
  useEffect(() => {
    if (infoOverlayTab === "changelog" && infoOverlayOpen && changelog.length === 0 && !changelogLoading) {
      setChangelogLoading(true);
      fetchChangelog().then(entries => { setChangelog(entries); setChangelogLoading(false); });
    }
  }, [infoOverlayTab, infoOverlayOpen, changelog.length, changelogLoading]);

  // ESC handler for info overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setInfoOverlayOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleTutorialNext = () => {
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
      try { localStorage.setItem("tutorialCompleted", "true"); } catch { /* ignore */ }
      setShowTutorial(false);
      setTutorialStep(0);
    } else {
      setTutorialStep(s => s + 1);
    }
  };

  const handleTutorialSkip = () => {
    try { localStorage.setItem("tutorialCompleted", "true"); } catch { /* ignore */ }
    setShowTutorial(false);
    setTutorialStep(0);
  };

  const handleRestartTutorial = () => {
    try { localStorage.removeItem("tutorialCompleted"); } catch { /* ignore */ }
    setGuideOpen(false);
    setTutorialStep(0);
    setShowTutorial(true);
  };

  // Check for class-activation notification on login
  useEffect(() => {
    if (!playerName || !reviewApiKey) return;
    const check = async () => {
      try {
        const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/notifications`, {
          headers: { "x-api-key": reviewApiKey },
        });
        if (!r.ok) return;
        const data = await r.json();
        const classNotif = data.notifications?.find((n: { type: string }) => n.type === "class_activated");
        if (classNotif) {
          setClassActivatedNotif({ className: classNotif.className, classIcon: classNotif.classIcon, classDescription: classNotif.classDescription });
        }
      } catch { /* ignore */ }
    };
    check();
  }, [playerName, reviewApiKey]);

  const needsAttention = agents.filter((a) => a.health === "needs_checkin" || a.health === "broken").length;

  // Player-specific stats (logged-in player)
  const loggedInUser = playerName ? users.find(u => u.id.toLowerCase() === playerName.toLowerCase() || u.name.toLowerCase() === playerName.toLowerCase()) : null;
  const currentPlayerLevel = loggedInUser ? getUserLevel(loggedInUser.xp ?? 0).level : undefined;
  const playerTypes = ["personal", "learning", "fitness", "social", "relationship-coop"];
  const playerActiveQuests = quests.inProgress.filter(q => playerTypes.includes(q.type ?? "") && q.claimedBy?.toLowerCase() === (playerName || "").toLowerCase());
  const playerCompletedQuests = quests.completed.filter(q => playerTypes.includes(q.type ?? "") && q.completedBy?.toLowerCase() === (playerName || "").toLowerCase());

  // Level info for logged-in player
  const LEVEL_XP = [0,50,120,200,300,420,560,720,900,1100,1350,1650,2000,2400,2850,3350,3900,4500,5150,5850,6700,7600,8600,9700,10900,12200,13600,15100,16700,18400];
  const LEVEL_TITLES = ["Forge Initiate","Anvil Striker","Coal Tender","Iron Apprentice","Flame Keeper","Bronze Shaper","Steel Crafter","Glyph Carver","Rune Binder","Ironclad Journeyman","Forge Adept","Silver Tempered","Ember Warden","Mithral Seeker","Flame Warden","Knight of the Forge","Obsidian Blade","Ashbound Knight","Dawnsteel Sentinel","Ironforged Champion","Void Temperer","Stormhammer","Skyforgeling","Dragon Tempered","Master Artificer","Grandmaster Smith","Forge Sovereign","Mythic Hammerborn","Legendary Smelter","Archmage of the Forge"];
  function getPlayerLevelInfo(xp: number) {
    let lvl = 0;
    for (let i = 0; i < LEVEL_XP.length; i++) { if (xp >= LEVEL_XP[i]) lvl = i; else break; }
    const nextXp = LEVEL_XP[lvl + 1] ?? null;
    const progress = nextXp ? Math.min(1, (xp - LEVEL_XP[lvl]) / (nextXp - LEVEL_XP[lvl])) : 1;
    return { level: lvl + 1, title: LEVEL_TITLES[lvl] ?? "Archmage of the Forge", xp, nextXp, progress };
  }
  const playerXp = loggedInUser?.xp ?? 0;
  const playerLevelInfo = getPlayerLevelInfo(playerXp);
  const playerStreak = loggedInUser?.streakDays ?? 0;
  const playerGold = loggedInUser?.gold ?? 0;

  // Forge: count quests completed by the player in the last 24h
  const now24h = Date.now() - 24 * 3600 * 1000;
  const forgeQuestsToday = quests.completed.filter(q =>
    playerName &&
    (q.completedBy ?? "").toLowerCase() === playerName.toLowerCase() &&
    q.completedAt && new Date(q.completedAt).getTime() > now24h
  ).length;
  const forgeTemp = Math.min(loggedInUser?.forgeTemp ?? 0, 100);
  const forgeTempColor = forgeTemp === 0 ? "#4a4a4a" : forgeTemp <= 20 ? "#8b0000" : forgeTemp <= 40 ? "#ff4500" : forgeTemp <= 60 ? "#ff8c00" : forgeTemp <= 80 ? "#ffa500" : "#00bfff";
  const forgeTempLabel = forgeTemp === 0 ? "Cold" : forgeTemp <= 20 ? "Smoldering" : forgeTemp <= 40 ? "Warming" : forgeTemp <= 60 ? "Burning" : forgeTemp <= 80 ? "Blazing" : "White-hot";
  const forgeTempIcon = forgeTemp === 0 ? "×" : forgeTemp <= 20 ? "×" : forgeTemp <= 40 ? "×" : forgeTemp <= 60 ? "×" : forgeTemp <= 80 ? "×" : "×";

  const playerActiveCount = playerActiveQuests.length;
  const playerCompletedCount = playerCompletedQuests.length;

  const openQuestsCount = quests.open.filter(q => playerTypes.includes(q.type ?? "")).length;

  const animStreak    = useCountUp(playerStreak, 0);
  const animActive    = useCountUp(playerActiveCount, 0);
  const animCompleted = useCountUp(playerCompletedCount, 0);
  const animGold      = useCountUp(playerGold, 0);

  const lastUpdatedStr = lastRefresh
    ? secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`
    : "—";

  // Quest search + sort + type filter
  const applyFilter = useCallback((qs: Quest[]) => {
    let result = qs;
    if (typeFilter === "npc") result = result.filter(q => !!q.npcGiverId);
    else if (typeFilter !== "all") result = result.filter(q => (q.type ?? "development") === typeFilter);
    // Class-specific quest filter
    if (playerName) {
      const currentUser = users.find(u => u.name.toLowerCase() === playerName.toLowerCase());
      const playerClassId = currentUser?.classId ?? null;
      result = result.filter(q => !q.classRequired || q.classRequired === playerClassId);
      // Relationship quest filter
      const relStatus = currentUser?.relationshipStatus ?? "single";
      result = result.filter(q => !q.requiresRelationship || relStatus !== "single");
    }
    if (!searchFilter) return result;
    const s = searchFilter.toLowerCase();
    return result.filter(q => q.title.toLowerCase().includes(s) || (q.description || "").toLowerCase().includes(s));
  }, [searchFilter, typeFilter, playerName, users]);
  const applySort = useCallback((qs: Quest[]) => {
    if (sortMode === "newest") return qs;
    return [...qs].sort((a, b) => (RARITY_ORDER[getQuestRarity(a)] ?? 4) - (RARITY_ORDER[getQuestRarity(b)] ?? 4));
  }, [sortMode]);
  const isCompanionQuest = (q: Quest) => q.rarity === "companion" || (q.type as string) === "companion" || (q.createdBy ?? "").toLowerCase() === "dobbie" || (q.createdBy ?? "").toLowerCase() === "companion";
  const visibleOpen = useMemo(() => applySort(applyFilter(quests.open.filter(q => !isCompanionQuest(q)))), [quests.open, applyFilter, applySort]);
  const dobbieActiveQuests = useMemo(() => quests.inProgress.filter(q => isCompanionQuest(q)), [quests.inProgress]);
  const visibleInProgress = useMemo(() => applySort(applyFilter(quests.inProgress.filter(q => !isCompanionQuest(q)))), [quests.inProgress, applyFilter, applySort]);

  // NPC board — dev-only filtered quests
  const devOpen = useMemo(() => applySort(quests.open.filter(q => (q.type ?? "development") === "development").filter(q => {
    if (!searchFilter) return true;
    const s = searchFilter.toLowerCase();
    return q.title.toLowerCase().includes(s) || (q.description || "").toLowerCase().includes(s);
  })), [quests.open, searchFilter, applySort]);
  const devInProgress = useMemo(() => applySort(quests.inProgress.filter(q => (q.type ?? "development") === "development").filter(q => {
    if (!searchFilter) return true;
    const s = searchFilter.toLowerCase();
    return q.title.toLowerCase().includes(s) || (q.description || "").toLowerCase().includes(s);
  })), [quests.inProgress, searchFilter, applySort]);

  // Build per-agent quest map
  const agentQuestMap: Record<string, Quest[]> = {};
  for (const q of quests.inProgress) {
    if (q.claimedBy) {
      if (!agentQuestMap[q.claimedBy]) agentQuestMap[q.claimedBy] = [];
      agentQuestMap[q.claimedBy].push(q);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "transparent", color: "#e8e8e8", position: "relative" }}>
      <GuildHallBackground />
      {/* Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{
          position: "relative",
          zIndex: 40,
          background: "rgba(26,26,26,0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,68,68,0.15)",
          overflow: "visible",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between" style={{ overflow: "visible" }}>
          <div className="flex items-center gap-3">
            <button
              data-feedback-id="header.guild-gate"
              className="flex items-center gap-2"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", transition: "opacity 0.15s", alignSelf: "flex-start" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
              onClick={() => { setDashView("questBoard"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              title="Home — Quest Hall"
            >
              <img src="/guild-gate.png" alt="Quest Hall" className="h-20 w-20" style={{ imageRendering: "auto", display: "block", marginBottom: "-8px", marginTop: "4px" }} />
              <span className="font-semibold text-sm tracking-tight" style={{ color: "#e8e8e8" }}>
                Quest Hall
              </span>
            </button>
            <button
              data-feedback-id="header.season-badge"
              className="text-xs px-2 py-0.5 rounded font-medium btn-interactive"
              style={{ color: CURRENT_SEASON.color, background: CURRENT_SEASON.bg, border: `1px solid ${CURRENT_SEASON.color}40`, cursor: "pointer" }}
              title={`Current Season: ${CURRENT_SEASON.name} — click to view Season tab`}
              onClick={() => setDashView("season")}
            >
              {CURRENT_SEASON.icon} {CURRENT_SEASON.name}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              data-feedback-id="header.info-button"
              onClick={() => { setInfoOverlayTab("guide"); setInfoOverlayOpen(true); }}
              className="btn-interactive text-xs px-2 py-0.5 rounded"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              title="Info, Guide & Tutorial"
            >
              Info
            </button>
            {/* Login / User area */}
            <div className="relative" data-tutorial="login-btn" data-feedback-id="header.login-badge">
              {reviewApiKey && playerName ? (
                <div ref={settingsPopupRef} className="flex items-center gap-2">
                  <button
                    title={`${playerName} — Einstellungen`}
                    onClick={() => setSettingsPopupOpen(v => !v)}
                    className="btn-interactive flex items-center justify-center font-bold flex-shrink-0"
                    style={{
                      width: 48, height: 48, borderRadius: "50%",
                      overflow: "hidden",
                      border: `2px solid ${loggedInUser?.color ?? "#a78bfa"}60`,
                      boxShadow: `0 2px 8px ${loggedInUser?.color ?? "#a78bfa"}40`,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <img src="/images/portraits/hero-male.png" alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "auto" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex"; }} />
                    <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${loggedInUser?.color ?? "#a78bfa"}, ${loggedInUser?.color ?? "#a78bfa"}88)`, color: "#fff", fontSize: 13, fontWeight: "bold" }}>{playerName.slice(0, 1).toUpperCase()}</div>
                  </button>
                  {settingsPopupOpen && (
                      <div className="absolute right-0 top-9 z-50 rounded-xl shadow-xl flex flex-col" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.1)", minWidth: 200, overflow: "hidden" }}>
                        {/* Profile */}
                        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: `linear-gradient(135deg, ${loggedInUser?.color ?? "#a78bfa"}, ${loggedInUser?.color ?? "#a78bfa"}88)`, color: "#fff" }}>
                              {playerName.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: "#e8e8e8" }}>{playerName}</p>
                              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Lv.{playerLevelInfo.level} · {playerLevelInfo.title}</p>
                            </div>
                          </div>
                        </div>
                        {/* Settings placeholder */}
                        <button
                          className="flex items-center gap-2 px-4 py-2.5 text-xs text-left"
                          style={{ color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "not-allowed", opacity: 0.5 }}
                        >
                          Einstellungen <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>(bald)</span>
                        </button>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 12px" }} />
                        {/* Logout */}
                        <button
                          className="flex items-center gap-2 px-4 py-2.5 text-xs text-left"
                          style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "none"}
                          onClick={() => {
                            localStorage.removeItem("dash_api_key");
                            localStorage.removeItem("dash_player_name");
                            setReviewApiKey("");
                            setPlayerName("");
                            setPlayerNameInput("");
                            setReviewKeyInput("");
                            setIsAdmin(false);
                            setSettingsPopupOpen(false);
                          }}
                        >
                          Logout
                        </button>
                      </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setLoginOpen(v => !v)}
                    className="btn-interactive text-xs px-2 py-0.5 rounded"
                    style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    Login
                  </button>
                  {loginOpen && (
                    <div className="absolute right-0 top-7 z-50 rounded-xl p-3 shadow-xl flex flex-col gap-2" style={{ background: "#1e1e1e", border: "1px solid rgba(139,92,246,0.3)", minWidth: "220px" }}>
                      {!registerOpen ? (
                        <>
                          <input
                            type="text"
                            value={playerNameInput}
                            onChange={e => setPlayerNameInput(e.target.value)}
                            placeholder="Your name"
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                          />
                          <input
                            type="password"
                            value={reviewKeyInput}
                            onChange={e => setReviewKeyInput(e.target.value)}
                            placeholder="Password"
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                            onKeyDown={async e => {
                              if (e.key === "Enter" && reviewKeyInput && playerNameInput) {
                                const r = await fetch("/api/auth/login", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ name: playerNameInput, password: reviewKeyInput }),
                                });
                                const data = await r.json();
                                if (data.success) {
                                  localStorage.setItem("dash_api_key", data.apiKey);
                                  localStorage.setItem("dash_player_name", data.name);
                                  setPlayerName(data.name);
                                  setReviewApiKey(data.apiKey);
                                  setIsAdmin(data.isAdmin);
                                  setLoginOpen(false);
                                  setLoginError("");
                                  createStarterQuestsIfNew(data.name, data.apiKey).then(() => refresh());
                                } else {
                                  setLoginError(data.error || "Invalid credentials");
                                }
                              }
                            }}
                          />
                          {loginError && <p className="text-xs" style={{ color: "#ef4444" }}>{loginError}</p>}
                          <div className="flex gap-1">
                            <button
                              onClick={async () => {
                                if (!reviewKeyInput || !playerNameInput) return;
                                const r = await fetch("/api/auth/login", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ name: playerNameInput, password: reviewKeyInput }),
                                });
                                const data = await r.json();
                                if (data.success) {
                                  localStorage.setItem("dash_api_key", data.apiKey);
                                  localStorage.setItem("dash_player_name", data.name);
                                  setPlayerName(data.name);
                                  setReviewApiKey(data.apiKey);
                                  setIsAdmin(data.isAdmin);
                                  setLoginOpen(false);
                                  setLoginError("");
                                  createStarterQuestsIfNew(data.name, data.apiKey).then(() => refresh());
                                } else {
                                  setLoginError(data.error || "Invalid credentials");
                                }
                              }}
                              className="flex-1 text-xs px-3 py-1 rounded font-medium"
                              style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}
                            >
                              Sign In
                            </button>
                            <button
                              onClick={() => { setLoginOpen(false); setOnboardingOpen(true); }}
                              className="text-xs px-3 py-1 rounded font-medium"
                              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                            >
                              Register
                            </button>
                          </div>
                        </>
                      ) : registerSuccess ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>Account Created!</p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>You are now logged in.</p>
                          <button
                            onClick={() => { setRegisterOpen(false); setRegisterSuccess(false); setLoginOpen(false); }}
                            className="text-xs px-3 py-1 rounded font-medium"
                            style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>Create Account</p>
                          <input
                            type="text"
                            value={registerName}
                            onChange={e => setRegisterName(e.target.value)}
                            placeholder="Choose a name"
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                          />
                          <input
                            type="password"
                            value={registerPassword}
                            onChange={e => setRegisterPassword(e.target.value)}
                            placeholder="Password (min 6 chars)"
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                          />
                          <input
                            type="password"
                            value={registerPasswordConfirm}
                            onChange={e => setRegisterPasswordConfirm(e.target.value)}
                            placeholder="Confirm password"
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                          />
                          {registerError && <p className="text-xs" style={{ color: "#ef4444" }}>{registerError}</p>}
                          <div className="flex gap-1">
                            <button
                              onClick={async () => {
                                if (!registerName.trim()) return;
                                if (registerPassword.length < 6) { setRegisterError("Password must be at least 6 characters"); return; }
                                if (registerPassword !== registerPasswordConfirm) { setRegisterError("Passwords do not match"); return; }
                                const r = await fetch("/api/register", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ name: registerName.trim(), password: registerPassword }),
                                });
                                const data = await r.json();
                                if (r.ok) {
                                  setRegisterSuccess(true);
                                  localStorage.setItem("dash_api_key", data.apiKey);
                                  localStorage.setItem("dash_player_name", data.name);
                                  setPlayerName(data.name);
                                  setReviewApiKey(data.apiKey);
                                  setIsAdmin(false);
                                  setRegisterError("");
                                  setRegisterPassword("");
                                  setRegisterPasswordConfirm("");
                                  await createStarterQuestsIfNew(data.name, data.apiKey);
                                  await refresh();
                                } else {
                                  setRegisterError(data.error || "Registration failed");
                                }
                              }}
                              className="flex-1 text-xs px-3 py-1 rounded font-medium"
                              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                            >
                              Create
                            </button>
                            <button
                              onClick={() => { setRegisterOpen(false); setRegisterError(""); setRegisterPassword(""); setRegisterPasswordConfirm(""); }}
                              className="text-xs px-2 py-1 rounded"
                              style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {needsAttention > 0 && (
              <div
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                {needsAttention} need attention
              </div>
            )}
            {quests.suggested.length > 0 && (
              <div
                className="text-xs px-2 py-0.5 rounded font-semibold"
                style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)" }}
              >
                {quests.suggested.length} to review
              </div>
            )}
            <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{
                  background: apiLive ? "#22c55e" : "rgba(255,255,255,0.15)",
                  animation: apiLive ? "pulse-online 2s ease-in-out infinite" : "none",
                }}
              />
              {apiLive ? "API Live" : "Static"}
            </div>
            <div className="text-xs font-mono flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
              <span
                className="w-1.5 h-1.5 rounded-full inline-block animate-pulse"
                style={{ background: "rgba(255,102,51,0.5)" }}
              />
              Updated <span style={{ display: "inline-block", minWidth: "4rem" }}>{lastUpdatedStr}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8" style={{ position: "relative", zIndex: 2, background: "rgba(11,13,17,0.75)", borderRadius: 16, backdropFilter: "blur(8px)", marginTop: 8 }}>
        {/* Stats — Player-specific */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-tutorial="stat-cards">
          {!playerName && !loading && (
            <div className="col-span-1 sm:col-span-3 rounded-xl p-3 text-center" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                <button onClick={() => setLoginOpen(true)} className="underline" style={{ color: "#a78bfa" }}>Log in</button> to see your personal stats
              </p>
            </div>
          )}
          {/* TODO: replace icon placeholders with pixel art once ui-forge/ui-sword/ui-check/reward-gold assets exist */}
          <div data-feedback-id="stats.forge-temp">
          <StatBar
            label="Forge Streak"
            value={loading ? "—" : playerName ? `${animStreak}d` : "—"}
            sub={playerName ? "your streak" : "login to view"}
            accent="#f97316"
            tooltip={<InfoTooltip text="Your consecutive days of quest completion. Keep the streak alive to earn bonus XP and keep companions happy!" />}
          />
          </div>
          <div data-feedback-id="stats.active-quests">
          <StatBar
            label="Active Quests"
            value={loading ? "—" : playerName ? animActive : "—"}
            sub={playerName ? `${openQuestsCount} open` : "login to view"}
            accent="#ef4444"
            tooltip={<InfoTooltip text="Quests you've claimed and are currently working on." />}
          />
          </div>
          <div data-feedback-id="stats.completed">
          <StatBar
            label="Quests Completed"
            value={loading ? "—" : playerName ? animCompleted : "—"}
            sub={playerName ? "your completions" : "login to view"}
            accent="#22c55e"
            tooltip={<InfoTooltip text="Total quests you've finished. Each one earns XP toward your next level." />}
          />
          </div>
        </div>

        {/* Player Card — shown when logged in */}
        {playerName && loggedInUser && (
          <div data-feedback-id="player-card" className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <div className="flex items-center gap-4">
              {/* Portrait */}
              <div data-feedback-id="player-card.portrait" className="relative flex-shrink-0 cursor-pointer" onClick={() => setDashView("character")} title="Character">
                <img
                  src="/images/portraits/hero-male.png"
                  alt={playerName}
                  className="w-28 h-28 rounded-xl object-cover"
                  style={{ imageRendering: "auto", border: `2px solid ${loggedInUser.color ?? "#a78bfa"}50` }}
                  onError={e => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.style.display = "none";
                    const fallback = img.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <div
                  className="w-28 h-28 rounded-xl items-center justify-center font-black text-3xl flex-shrink-0"
                  style={{ display: "none", background: `linear-gradient(135deg, ${loggedInUser.color ?? "#a78bfa"}, ${loggedInUser.color ?? "#a78bfa"}99)`, color: "#fff", border: `2px solid ${loggedInUser.color ?? "#a78bfa"}50` }}
                >
                  {playerName.slice(0, 1).toUpperCase()}
                </div>
              </div>

              {/* Name + level + XP bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold" style={{ color: "#f0f0f0" }}>{playerName}</p>
                  {loggedInUser.classId && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {loggedInUser.classId}
                    </span>
                  )}
                </div>
                <p className="text-xs mb-1.5" style={{ color: "#a78bfa" }}>Lv.{playerLevelInfo.level} · {playerLevelInfo.title}</p>
                {/* XP progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(playerLevelInfo.progress * 100).toFixed(1)}%`, background: "linear-gradient(90deg, #7c3aed, #a78bfa)" }}
                  />
                </div>
                <p className="text-xs mt-1 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {playerXp} {playerLevelInfo.nextXp ? `/ ${playerLevelInfo.nextXp} XP` : "(max)"}
                </p>
              </div>

              {/* Right side: Currencies + Forge */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {/* Currency bar — prominent like HSR/Genshin */}
                <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {[
                    { emoji: "", key: "gold" as const, value: Number(loggedInUser?.currencies?.gold ?? animGold), color: "#f59e0b", iconSrc: "/images/icons/currency-gold.png" },
                    { emoji: "", key: "stardust" as const, value: Number(loggedInUser?.currencies?.stardust ?? 0), color: "#a78bfa", iconSrc: "/images/icons/currency-stardust.png" },
                    { emoji: "", key: "runensplitter" as const, value: Number(loggedInUser?.currencies?.runensplitter ?? 0), color: "#818cf8", iconSrc: "/images/icons/currency-runensplitter.png" },
                    { emoji: "", key: "essenz" as const, value: Number(loggedInUser?.currencies?.essenz ?? 0), color: "#ef4444", iconSrc: "/images/icons/currency-essenz.png" },
                    { emoji: "", key: "gildentaler" as const, value: Number(loggedInUser?.currencies?.gildentaler ?? 0), color: "#10b981", iconSrc: "/images/icons/currency-gildentaler.png" },
                    { emoji: "", key: "mondstaub" as const, value: Number(loggedInUser?.currencies?.mondstaub ?? 0), color: "#c084fc", iconSrc: "/images/icons/currency-mondstaub.png" },
                  ].map(c => (
                    <div key={c.key} className="flex items-center gap-1 cursor-pointer" onClick={() => setCurrenciesOpen(true)} title={c.key}>
                      {(c as any).iconSrc ? <img src={(c as any).iconSrc} alt="" width={16} height={16} className={c.key === "stardust" ? "premium-stardust" : c.key === "runensplitter" ? "premium-rune-shards" : ""} style={{ imageRendering: "auto" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span style={{ fontSize: 18 }}>{c.emoji}</span>}
                      <span className="text-base font-mono font-black" style={{ color: c.value > 0 ? c.color : "rgba(255,255,255,0.15)" }}>
                        {c.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Forge Temperature */}
                <div data-feedback-id="player-card.forge-tooltip" className="relative group">
                  <div className="flex items-center gap-1.5 cursor-help">
                    <span className="text-xs font-medium" style={{ color: forgeTempColor }}>
                      {forgeTempIcon} {forgeTemp}%
                    </span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{forgeTempLabel}</span>
                    <span className="text-xs px-1 py-0.5 rounded font-mono" style={{ color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      {forgeQuestsToday}/8
                    </span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>?</span>
                  </div>
                  {/* Forge bar */}
                  <div className="mt-1 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)", width: 120 }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${forgeTemp}%`, background: `linear-gradient(90deg, ${forgeTempColor}80, ${forgeTempColor})`, boxShadow: forgeTemp > 60 ? `0 0 6px ${forgeTempColor}80` : "none" }}
                    />
                  </div>
                  {/* Tooltip */}
                  <div
                    className="absolute right-0 top-full mt-1 rounded-xl p-3 text-xs leading-relaxed pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", minWidth: 260, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", zIndex: 100 }}
                  >
                    <p className="font-semibold mb-1.5" style={{ color: "#f0f0f0" }}>The Deepforge</p>
                    <p className="mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Die Deepforge brennt heißer mit jeder Quest die du abschließt.
                    </p>
                    <div className="space-y-0.5 mb-2">
                      {[
                        { q: "0 quests", t: "0%", note: "Cold — XP ×0.5" },
                        { q: "1 quest",  t: "20%", note: "" },
                        { q: "2 quests", t: "40%", note: "" },
                        { q: "3 quests", t: "60%", note: "" },
                        { q: "5+ quests", t: "80%", note: "" },
                        { q: "8+ quests", t: "100%", note: "White-hot!" },
                      ].map(row => (
                        <div key={row.q} className="flex gap-2">
                          <span style={{ color: "rgba(255,255,255,0.35)", minWidth: 72 }}>{row.q}</span>
                          <span style={{ color: "#f97316" }}>{row.t}</span>
                          {row.note && <span style={{ color: "#a78bfa" }}>{row.note}</span>}
                        </div>
                      ))}
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.4)" }}>
                      Halte die Esse am Brennen für maximale XP!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Currencies Modal */}
        {currenciesOpen && (() => {
          const CURRENCY_HOW: Record<string, string> = {
            gold: "Schließe Quests ab, verkaufe Loot, oder erledige tägliche Herausforderungen. Das ehrliche Metall — ehrlich verdient.",
            stardust: "Geronnenes Sternenlicht. Fällt bei Level-Ups, seltenen Achievements und besonderen Events vom Himmel.",
            essenz: "Der stille Trank. Entsteht durch Beständigkeit — halte deinen Streak aufrecht und die Essenz fließt.",
            runensplitter: "Echos der vergessenen Sprache. Belohnung für abgeschlossene Quest-Ketten und NPC-Aufträge. Ziehe am Rad der Sterne.",
            gildentaler: "Zeichen des Zusammenhalts. Verdient durch Co-op Quests und soziale Herausforderungen mit deinen Verbündeten.",
            mondstaub: "Der Atem der Konzentration. Extrem selten — fällt nur bei zeitlich begrenzten Events und legendären Taten.",
          };
          return (
          <ModalPortal>
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => { setCurrenciesOpen(false); setCurrencyExpanded(null); }}>
            <div className="w-full max-w-xs rounded-2xl p-5" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>Currencies</h3>
                <button onClick={() => { setCurrenciesOpen(false); setCurrencyExpanded(null); }} style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>×</button>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1">
                {[
                  { name: "Gold", key: "gold" as const, value: loggedInUser?.currencies?.gold ?? animGold, color: "#f59e0b", desc: "Das ehrliche Metall der Halle.", iconSrc: "/images/icons/currency-gold.png" },
                  { name: "Stardust", key: "stardust" as const, value: loggedInUser?.currencies?.stardust ?? 0, color: "#a78bfa", desc: "Geronnenes Sternenlicht.", iconSrc: "/images/icons/currency-stardust.png" },
                  { name: "Essence", key: "essenz" as const, value: loggedInUser?.currencies?.essenz ?? 0, color: "#ef4444", desc: "Der stille Trank der Beständigkeit.", iconSrc: "/images/icons/currency-essenz.png" },
                  { name: "Rune Shards", key: "runensplitter" as const, value: loggedInUser?.currencies?.runensplitter ?? 0, color: "#818cf8", desc: "Echos der vergessenen Sprache.", iconSrc: "/images/icons/currency-runensplitter.png" },
                  { name: "Guild Coins", key: "gildentaler" as const, value: loggedInUser?.currencies?.gildentaler ?? 0, color: "#10b981", desc: "Zeichen des Zusammenhalts.", iconSrc: "/images/icons/currency-gildentaler.png" },
                  { name: "Moondust", key: "mondstaub" as const, value: loggedInUser?.currencies?.mondstaub ?? 0, color: "#c084fc", desc: "Atem der Konzentration. Extrem selten.", iconSrc: "/images/icons/currency-mondstaub.png" },
                ].map(c => (
                  <div key={c.name}>
                    <div
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors"
                      style={{ background: currencyExpanded === c.key ? `${c.color}12` : "rgba(255,255,255,0.03)", border: `1px solid ${currencyExpanded === c.key ? c.color + "30" : "rgba(255,255,255,0.07)"}` }}
                      onClick={() => setCurrencyExpanded(currencyExpanded === c.key ? null : c.key)}
                    >
                      <img src={c.iconSrc} alt="" width={24} height={24} className={c.key === "stardust" ? "premium-stardust" : c.key === "runensplitter" ? "premium-rune-shards" : ""} style={{ imageRendering: "auto" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: c.color }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{c.desc}</p>
                      </div>
                      <span className="text-sm font-mono font-bold" style={{ color: c.value === 0 && c.key !== "gold" ? "rgba(255,255,255,0.2)" : c.color }}>
                        {c.value === 0 && c.key !== "gold" ? "—" : c.value}
                      </span>
                    </div>
                    {currencyExpanded === c.key && (
                      <div className="rounded-b-xl px-4 py-3 -mt-1" style={{ background: `${c.color}08`, borderLeft: `1px solid ${c.color}30`, borderRight: `1px solid ${c.color}30`, borderBottom: `1px solid ${c.color}30` }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: `${c.color}99` }}>Wie erhältst du {c.name}?</p>
                        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{CURRENCY_HOW[c.key]}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          </ModalPortal>
          );
        })()}

        {/* View toggle */}
        <div className="flex gap-1 flex-wrap" data-tutorial="nav-bar" style={{ background: "#111", borderRadius: 8, padding: 3, display: "inline-flex" }}>
          {[
            { key: "questBoard",    label: "The Great Hall",     tutorialKey: "quest-board-tab", iconSrc: "/images/icons/nav-great-hall.png" },
            { key: "npcBoard",      label: "The Wanderer's Rest", tutorialKey: "npc-board-tab", iconSrc: "/images/icons/nav-wanderer.png" },
            { key: "campaign",    label: "The Observatory",        tutorialKey: "campaign-tab", iconSrc: "/images/icons/nav-observatory.png" },
            { key: "klassenquests", label: "The Arcanum",  tutorialKey: null, iconSrc: "/images/icons/nav-arcanum.png" },
            ...(playerName ? [{ key: "character", label: "Character", tutorialKey: "character-tab", iconSrc: "/images/icons/nav-character.png" }] : []),
            { key: "shop",        label: "The Bazaar",               tutorialKey: "bazaar-tab", iconSrc: "/images/icons/nav-bazaar.png" },
            { key: "gacha",       label: "Vault of Fate",            tutorialKey: "vault-tab", iconSrc: "/images/icons/vault-of-fate.png" },
            { key: "leaderboard", label: "The Proving Grounds", tutorialKey: "leaderboard-tab", iconSrc: "/images/icons/nav-proving.png" },
            { key: "honors",      label: "Hall of Honors",  tutorialKey: "honors-tab", iconSrc: "/images/icons/nav-honors.png" },
            { key: "season",      label: `${CURRENT_SEASON.name} Season`, tutorialKey: "season-tab", iconSrc: "" },
          ].map(v => (
            "isDivider" in v && v.isDivider ? (
              <span key={v.key} className="text-xs font-semibold uppercase tracking-widest px-2 py-1.5 flex items-center" style={{ color: "rgba(255,215,0,0.5)", letterSpacing: "0.1em", pointerEvents: "none" }}>
                x {v.label}
              </span>
            ) : (
            <button
              key={v.key}
              data-feedback-id={`nav.tab.${v.key}`}
              onClick={() => setDashView(v.key as typeof dashView)}
              className="btn-interactive text-sm font-semibold px-3 py-1.5 rounded transition-all inline-flex items-center gap-1.5"
              style={{
                background: dashView === v.key ? "#252525" : "transparent",
                color: dashView === v.key ? "#f0f0f0" : "rgba(255,255,255,0.3)",
              }}
              {...(v.tutorialKey ? { "data-tutorial": v.tutorialKey } : {})}
            >
              {"iconSrc" in v && v.iconSrc && <img src={v.iconSrc} alt="" width={24} height={24} className={v.key === "gacha" ? "vault-nav-glow" : ""} style={{ imageRendering: "auto", opacity: dashView === v.key ? 1 : 0.5 }} onError={e => (e.currentTarget.style.display = "none")} />}
              {v.label}
            </button>
            )
          ))}
        </div>

        {/* The Proving Grounds — Leaderboard + Player Cards */}
        {dashView === "leaderboard" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>The Proving Grounds</span>
              <InfoTooltip text="Rankings based on XP earned. Compete with other players to claim glory!" />
            </div>
            {/* Player cards */}
            {users.filter(u => !agents.some(a => a.id === u.id)).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>Adventurers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {users.filter(u => !agents.some(a => a.id === u.id)).map(u => <UserCard key={u.id} user={u} classes={classesList} />)}
                </div>
              </div>
            )}
            <LeaderboardView entries={leaderboard} agents={agents} mode="players" users={users} classes={classesList} />
          </div>
        )}

        {/* Honors View — Player-specific */}
        {dashView === "honors" && (
          <HonorsView catalogue={achievementCatalogue} users={users} playerName={playerName} quests={quests} reviewApiKey={reviewApiKey} />
        )}

        {/* Campaign View */}
        {dashView === "campaign" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>The Observatory</span>
            </div>
            <div className="rounded-xl px-6 py-16 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-lg font-bold mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Coming Soon</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>Das Observatory wird bald eröffnet. Halte Ausschau nach den Sternen.</p>
            </div>
          </div>
        )}

        {/* Season & Battle Pass View */}
        {dashView === "season" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>{CURRENT_SEASON.icon} Season & Battle Pass</span>
              <InfoTooltip text="Each season (3 months) brings a new Battle Pass. Earn season XP to unlock rewards at each tier." />
            </div>
            <BattlePassView users={users} quests={quests} />
          </div>
        )}

        {/* ── SHOP TAB ── */}
        {dashView === "shop" && (
          <ShopView
            users={users}
            playerName={playerName}
            reviewApiKey={reviewApiKey}
            onBuy={handleShopBuy}
            onGearBuy={handleGearBuy}
          />
        )}

        {/* ── VAULT OF FATE (GACHA) TAB ── */}
        {dashView === "gacha" && (
          <GachaView
            users={users}
            playerName={playerName}
            reviewApiKey={reviewApiKey}
            onRefresh={refresh}
            onPullComplete={(items) => { items.forEach((item: any, i: number) => { setTimeout(() => addToast({ type: "flavor", message: `${item.item?.name || "Item"} collected!`, icon: item.item?.icon || "/images/icons/vault-of-fate.png", sub: item.item?.rarity || "common" }), i * 50); }); }}
          />
        )}

        {/* ── ROADMAP TAB ── */}
        {dashView === "roadmap" && (
          <RoadmapView isAdmin={isAdmin} reviewApiKey={reviewApiKey} />
        )}

        {/* ── CHANGELOG TAB ── */}
        {dashView === "changelog" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Changelog</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>— recent commits from GitHub</span>
            </div>
            {changelogLoading && (
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading commits…</div>
            )}
            {!changelogLoading && changelog.length === 0 && (
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>No changelog data available.</div>
            )}
            {changelog.map(entry => (
              <div key={entry.date} className="space-y-1.5">
                <div
                  className="text-xs font-semibold uppercase tracking-widest pt-2 pb-1"
                  style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {entry.date}
                </div>
                {entry.commits.map((c, i) => {
                  const typeStyle: Record<string, { badge: string; color: string; bg: string }> = {
                    feat:     { badge: "feat",     color: "#4ade80", bg: "rgba(74,222,128,0.1)"  },
                    fix:      { badge: "fix",      color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
                    chore:    { badge: "chore",    color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
                    docs:     { badge: "docs",     color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
                    refactor: { badge: "refactor", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
                  };
                  const ts = typeStyle[c.type] || { badge: c.type, color: "#9ca3af", bg: "rgba(156,163,175,0.1)" };
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-3 py-2 rounded"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: ts.color, background: ts.bg, whiteSpace: "nowrap" }}
                      >
                        {ts.badge}
                      </span>
                      <span className="text-sm flex-1 leading-snug" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {c.message}
                      </span>
                      {c.sha && (
                        c.url ? (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono shrink-0"
                            style={{ color: "rgba(255,255,255,0.2)", textDecoration: "none" }}
                            title={`View commit ${c.sha}`}
                          >
                            {c.sha}
                          </a>
                        ) : (
                          <span className="text-xs font-mono shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>{c.sha}</span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── QUEST BOARD (Player Tab) ── */}
        {dashView === "questBoard" && (() => {
          const playerQuestTypes = ["personal", "learning", "fitness", "social", "relationship-coop"];
          const playerVisibleOpen = applySort(applyFilter(quests.open.filter(q => playerQuestTypes.includes(q.type ?? ""))));
          const playerVisibleInProgress = applySort(applyFilter(quests.inProgress.filter(q => playerQuestTypes.includes(q.type ?? "") && !isCompanionQuest(q))));
          // Filter by player level, exclude already claimed
          const inProgressIds = new Set(playerVisibleInProgress.map(q => q.id));
          const levelFiltered = playerVisibleOpen.filter(q => {
            if (inProgressIds.has(q.id)) return false;
            // NPC and companion quests always visible
            if (q.npcGiverId || q.rarity === "companion") return true;
            // No level req = visible to all
            if (!q.minLevel) return true;
            // Show quests up to 3 levels above player (stretch goals), hide if way above
            if (q.minLevel > playerLevelInfo.level + 3) return false;
            return true;
          });
          // Show all quests from daily rotation (no frontend cap)
          const boardOpen = applySort(levelFiltered);
          return (
            <div>

              {/* Companions Widget — full experience in the Great Hall */}
              {playerName && (
                <div className="mb-5" style={{ minHeight: 100 }}>
                  <CompanionsWidget user={loggedInUser} streak={playerStreak} playerName={playerName} apiKey={reviewApiKey} onDobbieClick={() => { setDashView("npcBoard"); setNpcBoardFilter(null); }} onUserRefresh={refresh} dobbieQuests={dobbieActiveQuests} />
                </div>
              )}

              {/* Quest Board — player types only */}
              <div>
                <aside className="w-full">
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Quest Board</h2>
                          <InfoTooltip text="Your personal quest board. Claim quests to start them, complete them to earn XP and Gold. Filter by type to find what interests you." />
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                          {playerName
                            ? `${boardOpen.length + playerVisibleInProgress.length} aktive Quests`
                            : "Logge dich ein · 0 verfügbar"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {(isAdmin || !playerName) && (
                          <button
                            onClick={() => setCreateQuestOpen(true)}
                            className="btn-interactive text-xs px-2 py-1 rounded font-semibold"
                            style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
                            title="Create Quest"
                          >
                            ＋ Create
                          </button>
                        )}
                        {/* Suggest button removed — not needed for now */}
                        {playerName && reviewApiKey && (
                          <button
                            onClick={handlePoolRefresh}
                            disabled={poolRefreshing}
                            className="btn-interactive px-2 py-1 rounded"
                            style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)", opacity: poolRefreshing ? 0.6 : 1 }}
                            title="Refresh quest pool (1x per 6h)"
                          >
                            {poolRefreshing ? (
                              <span className="text-sm">—</span>
                            ) : (
                              <img src="/images/icons/ui-quest-scroll.png" alt="" width={24} height={24} style={{ imageRendering: "auto" }} onError={e => (e.currentTarget.style.display = "none")} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Board Sub-Tabs */}
                  <div className="flex gap-1 mb-3">
                    {[
                      { key: "auftraege",    label: "Quest Board",     iconSrc: "/images/icons/ui-quest-scroll.png",  fallback: "" },
                      { key: "rituale",      label: "Ritual Chamber",  iconSrc: "/images/icons/ui-ritual-rune.png",   fallback: "", tutorialKey: "rituals-tab" },
                      { key: "anti-rituale", label: "Vow Shrine",      iconSrc: "/images/icons/ui-vow-sword.png",     fallback: "" },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        data-feedback-id={`sub-tab.${tab.key}`}
                        onClick={() => setQuestBoardTab(tab.key as "auftraege" | "rituale" | "anti-rituale")}
                        className="btn-interactive text-sm px-3 py-1.5 rounded-lg font-medium transition-all inline-flex items-center gap-1.5"
                        style={{
                          background: questBoardTab === tab.key ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
                          color: questBoardTab === tab.key ? "#a78bfa" : "rgba(255,255,255,0.4)",
                          border: `1px solid ${questBoardTab === tab.key ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`,
                        }}
                        {...("tutorialKey" in tab && tab.tutorialKey ? { "data-tutorial": tab.tutorialKey } : {})}
                      >
                        <img src={tab.iconSrc} alt="" width={42} height={42}
                          style={{ imageRendering: "auto" }}
                          onError={(e) => { e.currentTarget.style.display = "none"; const next = e.currentTarget.nextElementSibling as HTMLElement; if (next) next.style.display = "inline"; }} />
                        <span style={{ display: "none" }}>{tab.fallback}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {questBoardTab === "auftraege" && <div data-feedback-id="quest-board" className="space-y-2">
                    {/* Category filters — Quest Board only */}
                    <div data-feedback-id="quest-board.filters" className="flex gap-1 flex-wrap mb-2" data-tutorial="quest-filters">
                      {(["all", "personal", "learning", "fitness", "social", "relationship-coop", "npc"] as const).map(t => {
                        const cfg = t === "all" || t === "npc" ? null : typeConfig[t];
                        const isActive = typeFilter === t;
                        const iconFile = t === "relationship-coop" ? "coop" : t;
                        const npcStyle = t === "npc" ? { color: "#e879f9", bg: "rgba(232,121,249,0.1)", border: "rgba(232,121,249,0.3)" } : null;
                        return (
                          <button key={t} onClick={() => setTypeFilter(t)} className="btn-interactive text-sm px-2 py-0.5 rounded inline-flex items-center gap-1.5"
                            style={{ background: isActive ? (cfg ? cfg.bg : npcStyle ? npcStyle.bg : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.03)", color: isActive ? (cfg ? cfg.color : npcStyle ? npcStyle.color : "#e8e8e8") : "rgba(255,255,255,0.3)", border: `1px solid ${isActive ? (cfg ? cfg.border : npcStyle ? npcStyle.border : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.07)"}` }}>
                            {t === "all" ? "All" : t === "npc" ? (
                              <>
                                <img src="/images/icons/cat-npc.png" alt="" width={28} height={28}
                                  style={{ imageRendering: "auto" }}
                                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                NPC
                              </>
                            ) : (
                              <>
                                <img src={`/images/icons/cat-${iconFile}.png`} alt="" width={28} height={28}
                                  style={{ imageRendering: "auto" }}
                                  onError={(e) => { e.currentTarget.style.display = "none"; const next = e.currentTarget.nextElementSibling as HTMLElement; if (next) next.style.display = "inline"; }} />
                                <span style={{ display: "none" }}>{cfg!.icon?.startsWith("/") ? cfg!.label : cfg!.icon}</span>
                                {cfg!.label}
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Search + Sort row */}
                    <div className="flex gap-1 mb-2">
                      <input data-feedback-id="quest-board.search" type="text" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Search quests…" className="flex-1 text-xs px-2 py-1.5 rounded" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", outline: "none" }} />
                      <button
                        data-feedback-id="quest-board.sort"
                        onClick={() => setSortMode(s => s === "rarity" ? "newest" : "rarity")}
                        className="text-xs px-2 py-1.5 rounded shrink-0"
                        style={{ background: sortMode === "rarity" ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.05)", color: sortMode === "rarity" ? "#a78bfa" : "rgba(255,255,255,0.3)", border: `1px solid ${sortMode === "rarity" ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)"}` }}
                      >
                        {sortMode === "rarity" ? "⇅ Rarity" : "⇅ Newest"}
                      </button>
                      <button
                        onClick={() => {
                          const allCollapsed = openSectionCollapsed && inProgressSectionCollapsed;
                          const next = !allCollapsed;
                          setOpenSectionCollapsed(next);
                          setInProgressSectionCollapsed(next);
                          try { localStorage.setItem("qb_open_collapsed", String(next)); localStorage.setItem("qb_inprogress_collapsed", String(next)); } catch { /* ignore */ }
                        }}
                        className="text-xs px-2 py-1.5 rounded shrink-0"
                        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}
                        title="Collapse / Expand All"
                      >
                        {openSectionCollapsed && inProgressSectionCollapsed ? "⊞" : "⊟"}
                      </button>
                    </div>
                    {!playerName && !loading ? (
                      <div className="rounded-xl p-8 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-base mb-2">×</p>
                        <p className="text-sm font-semibold mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Logge dich ein um deine Quests zu sehen</p>
                        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>Dein persönlicher Quest-Pool wartet auf dich!</p>
                        <button onClick={() => setLoginOpen(true)} className="text-xs px-4 py-1.5 rounded font-semibold" style={{ background: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.4)" }}>
                          Login
                        </button>
                      </div>
                    ) :
                    loading ? [1,2,3].map(i => <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.05)" }} />) :
                    boardOpen.length === 0 && playerVisibleInProgress.length === 0 ? (
                      <div className="rounded-xl p-5 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{searchFilter ? "No quests match your search" : "No player quests open"}</p>
                        {!searchFilter && playerName && reviewApiKey && <button onClick={handlePoolRefresh} className="btn-interactive mt-2 px-3 py-1 rounded inline-flex items-center gap-1.5" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}><img src="/images/icons/ui-quest-scroll.png" alt="" width={20} height={20} style={{ imageRendering: "auto" }} onError={e => (e.currentTarget.style.display = "none")} /><span className="text-xs font-semibold">Load Quests</span></button>}
                      </div>
                    ) : (
                      <>
                        {playerVisibleInProgress.length > 0 && (
                          <>
                            <button data-feedback-id="quest-board.in-progress" onClick={() => { const next = !inProgressSectionCollapsed; setInProgressSectionCollapsed(next); try { localStorage.setItem("qb_inprogress_collapsed", String(next)); } catch { /* ignore */ } }} className="flex items-center gap-2 w-full text-left pt-1 pb-0.5">
                              <span className="text-base font-extrabold uppercase tracking-widest" style={{ color: "#a78bfa", textShadow: "0 0 12px rgba(167,139,250,0.35)", borderLeft: "3px solid #a78bfa", paddingLeft: 8 }}>In Progress</span>
                              <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold" style={{ background: "rgba(139,92,246,0.18)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>{playerVisibleInProgress.length}</span>
                              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{inProgressSectionCollapsed ? "▼" : "▲"}</span>
                            </button>
                            {!inProgressSectionCollapsed && (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: 4 }}>
                                {playerVisibleInProgress.map(q =>
                                  q.children && q.children.length > 0
                                    ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                                    : <QuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined}
                                        onClaim={reviewApiKey && playerName ? handleClaim : undefined}
                                        onUnclaim={reviewApiKey && playerName ? handleUnclaim : undefined}
                                        onComplete={reviewApiKey && playerName ? handleComplete : undefined}
                                        onCoopClaim={reviewApiKey && playerName ? handleCoopClaim : undefined}
                                        onCoopComplete={reviewApiKey && playerName ? handleCoopComplete : undefined}
                                        playerName={playerName} playerLevel={currentPlayerLevel} gridMode
                                        onDetails={q => setQuestDetailModal(q)} />
                                )}
                              </div>
                            )}
                          </>
                        )}
                        {boardOpen.length > 0 && (
                          <>
                            {playerVisibleInProgress.length > 0 && (
                              <div className="flex items-center gap-3 my-3">
                                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.25), rgba(148,163,184,0.15), transparent)" }} />
                                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.12)", fontSize: 9 }}>◆</span>
                                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(148,163,184,0.15), rgba(167,139,250,0.25), transparent)" }} />
                              </div>
                            )}
                            <button data-feedback-id="quest-board.open" onClick={() => { const next = !openSectionCollapsed; setOpenSectionCollapsed(next); try { localStorage.setItem("qb_open_collapsed", String(next)); } catch { /* ignore */ } }} className="flex items-center gap-2 w-full text-left pt-1 pb-0.5">
                              <span className="text-base font-extrabold uppercase tracking-widest" style={{ color: "#94a3b8", textShadow: "0 0 8px rgba(148,163,184,0.2)", borderLeft: "3px solid #94a3b8", paddingLeft: 8 }}>Offen</span>
                              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{openSectionCollapsed ? "▼" : "▲"}</span>
                            </button>
                            {!openSectionCollapsed && (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: 4 }}>
                                {boardOpen.map((q, i) =>
                                  q.children && q.children.length > 0
                                    ? <EpicQuestCard key={q.id} quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined} />
                                    : <div key={q.id} {...(i === 0 ? { "data-tutorial": "quest-list-first" } : {})}><QuestCard quest={q} selected={selectedIds.has(q.id)} onToggle={reviewApiKey ? toggleSelect : undefined}
                                        onClaim={reviewApiKey && playerName ? handleClaim : undefined}
                                        onUnclaim={reviewApiKey && playerName ? handleUnclaim : undefined}
                                        onComplete={reviewApiKey && playerName ? handleComplete : undefined}
                                        onCoopClaim={reviewApiKey && playerName ? handleCoopClaim : undefined}
                                        onCoopComplete={reviewApiKey && playerName ? handleCoopComplete : undefined}
                                        playerName={playerName} playerLevel={currentPlayerLevel} gridMode
                                        onDetails={q => setQuestDetailModal(q)} /></div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* Locked quests teaser — shown when logged in and level-gated quests exist */}
                    {playerName && (quests.locked ?? []).length > 0 && (
                      <>
                        <div data-feedback-id="quest-board.locked" className="flex items-center gap-2 pt-2 pb-0.5">
                          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>Locked</span>
                          <span className="text-xs px-1 rounded font-mono" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.15)" }}>{(quests.locked ?? []).length}</span>
                        </div>
                        {applySort(quests.locked ?? []).map(q => (
                          <div key={q.id} className="rounded-lg px-3 py-2.5 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", opacity: 0.5 }}>
                            <span className="text-base">×</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{q.title}</p>
                              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Unlocks at Level {q.minLevel ?? 1}</p>
                            </div>
                            <span className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0" style={{ background: "rgba(139,92,246,0.08)", color: "rgba(139,92,246,0.35)", border: "1px solid rgba(139,92,246,0.15)" }}>
                              Lv.{q.minLevel ?? 1}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>}

                  {/* ── Rituale Tab ── */}
                  {questBoardTab === "rituale" && (() => {
                    const playerRituals = rituals.filter(r => r.playerId === playerName?.toLowerCase());
                    const renderRitualCard = (ritual: Ritual) => {
                      const today = new Date().toISOString().slice(0, 10);
                      const doneToday = ritual.lastCompleted === today;
                      const isBroken = ritual.status === "broken";
                      const milestone = STREAK_MILESTONES_CLIENT.reduce<{days:number;badge:string;label:string}|null>((acc, m) => ritual.streak >= m.days ? m : acc, null);
                      const nextMilestone = STREAK_MILESTONES_CLIENT.find(m => ritual.streak < m.days);
                      const progress = nextMilestone ? (ritual.streak / nextMilestone.days) * 100 : 100;
                      const longestStreak = ritual.longestStreak ?? ritual.streak;
                      const lastCompletedFormatted = ritual.lastCompleted
                        ? new Date(ritual.lastCompleted + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "short" })
                        : null;
                      // Flame intensity based on streak
                      const flameColor = isBroken ? "#ef4444" : ritual.streak >= 30 ? "#f59e0b" : ritual.streak >= 14 ? "#f97316" : ritual.streak >= 7 ? "#ef4444" : "rgba(255,255,255,0.25)";
                      const flameGlow = isBroken ? "0 0 8px rgba(239,68,68,0.3)" : ritual.streak >= 7 ? `0 0 8px ${flameColor}44` : "none";
                      return (
                        <div key={ritual.id} className="rounded-xl p-3" style={{
                          background: isBroken ? "rgba(239,68,68,0.04)" : doneToday ? "rgba(34,197,94,0.06)" : "#252525",
                          border: `1px solid ${isBroken ? "rgba(239,68,68,0.3)" : doneToday ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)"}`,
                          opacity: doneToday ? 0.8 : 1,
                        }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {/* Streak flame counter */}
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ color: flameColor, background: `${flameColor}12`, border: `1px solid ${flameColor}30`, boxShadow: flameGlow, fontSize: 11 }}>
                                  <span style={{ fontSize: 13 }}>{ritual.streak >= 7 ? "★" : "●"}</span>
                                  {ritual.streak}
                                </span>
                                <span className="text-sm font-medium truncate" style={{ color: doneToday ? "rgba(255,255,255,0.4)" : "#e8e8e8", textDecoration: doneToday ? "line-through" : "none" }}>{ritual.title}</span>
                                {milestone && ((milestone as any).icon ? <img src={(milestone as any).icon} alt={milestone.badge} width={20} height={20} style={{ imageRendering: "auto" }} /> : <span className="text-xs">{milestone.badge}</span>)}
                              </div>
                              <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "rgba(255,255,255,0.35)" }}>
                                <span style={{ color: ritual.streak >= 21 ? "#818cf8" : ritual.streak >= 7 ? "#f97316" : "rgba(255,255,255,0.35)" }}>
                                  {ritual.streak} Tage Streak
                                </span>
                                {longestStreak > 0 && (
                                  <span title="Longest streak" style={{ color: "rgba(245,158,11,0.5)" }}>
                                    Best: {longestStreak}
                                  </span>
                                )}
                                {lastCompletedFormatted && (
                                  <span title="Last completed" style={{ color: "rgba(255,255,255,0.2)" }}>
                                    {doneToday ? "Heute" : lastCompletedFormatted}
                                  </span>
                                )}
                                <span>{ritual.schedule.type === 'daily' ? 'täglich' : ritual.schedule.days?.join(', ')}</span>
                                <span>{ritual.rewards.xp} XP · {ritual.rewards.gold} Gold</span>
                              </div>
                              {nextMilestone && (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                                    <span>Nächstes Ziel in {nextMilestone.days - ritual.streak}d: <span style={{ color: nextMilestone.label === "Bronze" ? "#cd7f32" : nextMilestone.label === "Silber" ? "#c0c0c0" : nextMilestone.label === "Gold" ? "#ffd700" : nextMilestone.label === "Diamond" ? "#b9f2ff" : "#a78bfa", fontWeight: 700 }}>{nextMilestone.label}</span></span>
                                    <span>{ritual.streak}/{nextMilestone.days}</span>
                                  </div>
                                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "rgba(167,139,250,0.6)" }} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isBroken ? (
                                <>
                                  <button
                                    onClick={() => setRecommitRitualId(ritual.id)}
                                    disabled={!reviewApiKey}
                                    className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
                                    style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.4)", cursor: "pointer", boxShadow: "0 0 10px rgba(167,139,250,0.1)" }}
                                  >
                                    Rise Again
                                  </button>
                                  {reviewApiKey && (
                                    <button onClick={() => setDeleteRitualConfirmId(ritual.id)} className="text-xs px-2 py-1.5 rounded-lg transition-all" style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.5)", border: "1px solid rgba(239,68,68,0.15)", cursor: 'pointer' }} title="Ritual löschen">×</button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    disabled={doneToday || !reviewApiKey}
                                    onClick={async () => {
                                      if (!reviewApiKey || !playerName) return;
                                      try {
                                        const r = await fetch(`/api/rituals/${ritual.id}/complete`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json', 'x-api-key': reviewApiKey },
                                          body: JSON.stringify({ playerId: playerName }),
                                        });
                                        const data = await r.json();
                                        if (data.ok) {
                                          fetchRituals(playerName).then(setRituals);
                                          if (data.lootDrop) setLootDrop(data.lootDrop);
                                          if (data.milestoneDrop) setLootDrop(data.milestoneDrop);
                                          refresh();
                                        }
                                      } catch { /* ignore */ }
                                    }}
                                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all"
                                    style={{
                                      background: doneToday ? "rgba(34,197,94,0.08)" : "rgba(167,139,250,0.15)",
                                      color: doneToday ? "rgba(34,197,94,0.5)" : "#a78bfa",
                                      border: `1px solid ${doneToday ? "rgba(34,197,94,0.2)" : "rgba(167,139,250,0.3)"}`,
                                      cursor: doneToday ? 'default' : 'pointer',
                                    }}
                                    onMouseEnter={e => { if (!doneToday) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(167,139,250,0.28)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(167,139,250,0.55)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 10px rgba(167,139,250,0.2)"; } }}
                                    onMouseLeave={e => { if (!doneToday) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(167,139,250,0.15)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(167,139,250,0.3)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; } }}
                                  >
                                    {doneToday ? "✓ Erledigt" : "Abhaken"}
                                  </button>
                                  {reviewApiKey && !ritual.bloodPact && (
                                    <button
                                      onClick={() => { setExtendRitualId(ritual.id); setExtendRitualCommitment(ritual.commitment ?? "none"); }}
                                      className="text-xs px-2 py-1.5 rounded-lg transition-all"
                                      style={{ background: "rgba(245,158,11,0.06)", color: "rgba(245,158,11,0.5)", border: "1px solid rgba(245,158,11,0.15)", cursor: 'pointer' }}
                                      title="Extend ritual duration"
                                    >
                                      Extend
                                    </button>
                                  )}
                                  {reviewApiKey && (
                                    <button onClick={() => setDeleteRitualConfirmId(ritual.id)} className="text-xs px-2 py-1.5 rounded-lg transition-all" style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.5)", border: "1px solid rgba(239,68,68,0.15)", cursor: 'pointer' }} title="Ritual löschen">×</button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    };
                    return (
                      <div data-feedback-id="ritual-chamber" className="section-ritual">
                        {/* ── Top flex row: Portrait left, content right ── */}
                        <div className="flex gap-4 mb-4" style={{ alignItems: "flex-start" }}>
                          {/* Portrait column with speech bubble */}
                          <div className="flex-none" style={{ width: 195, overflow: "visible" }}>
                            <img src="/images/portraits/npc-seraine.png?v=3" alt="Seraine Ashwell" width={256} height={384} style={{ imageRendering: "auto", width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.35))", borderRadius: "4px 4px 0 0", pointerEvents: "none" }} />
                            <div style={{ background: "rgba(25,17,5,0.88)", border: "1px solid rgba(245,158,11,0.3)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "8px 10px" }}>
                              <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>„Jedes Feuer beginnt mit einem Funken. Deins auch."</p>
                            </div>
                          </div>
                          {/* Right: title + create button + first 2 cards */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h3 className="font-bold uppercase tracking-widest" style={{ color: "#f59e0b", fontSize: "1rem" }}>Ritual Chamber</h3>
                                <p style={{ color: "rgba(245,158,11,0.6)", fontSize: "1rem", fontWeight: 600, marginTop: 2 }}>Seraine Ashwell</p>
                              </div>
                              {playerName && reviewApiKey && (
                                <button onClick={() => setCreateRitualOpen(true)} className="action-btn text-xs px-3 py-1.5 rounded-lg font-semibold"
                                  style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.35)", boxShadow: "0 0 10px rgba(245,158,11,0.08)" }}>
                                  ＋ Create Ritual
                                </button>
                              )}
                            </div>
                            {playerRituals.length === 0 ? (
                              <div className="rounded-xl p-5 text-center" style={{ background: "#252525", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>No rituals. Create your first daily ritual!</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {playerRituals.slice(0, 2).map(renderRitualCard)}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Remaining cards (3+) at full width */}
                        {playerRituals.length > 2 && (
                          <div className="space-y-2">
                            {playerRituals.slice(2).map(renderRitualCard)}
                          </div>
                        )}
                        {/* Create Ritual Modal — simplified, no portrait */}
                        {createRitualOpen && (() => {
                          const closeRitualModal = () => { setCreateRitualOpen(false); setNewRitualTitle(""); setRitualNameError(false); setRitualCommitmentError(false); setNewRitualCommitment("none"); setNewRitualBloodPact(false); };
                          const submitRitual = async () => {
                            if (!newRitualTitle.trim()) { setRitualNameError(true); return; }
                            if (newRitualCommitment === "none") { setRitualCommitmentError(true); return; }
                            if (!reviewApiKey || !playerName) return;
                            const tier = COMMITMENT_TIERS.find(t => t.id === newRitualCommitment)!;
                            await fetch('/api/rituals', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': reviewApiKey }, body: JSON.stringify({ title: newRitualTitle.trim(), schedule: { type: newRitualSchedule }, playerId: playerName, createdBy: playerName, category: newRitualCategory, commitment: newRitualCommitment, commitmentDays: tier.days, bloodPact: newRitualBloodPact }) });
                            closeRitualModal();
                            fetchRituals(playerName).then(setRituals);
                          };
                          const tierData = COMMITMENT_TIERS.find(t => t.id === newRitualCommitment)!;
                          const bonusGold = tierData.bonusGold * (newRitualBloodPact ? 3 : 1);
                          const bonusXp = tierData.bonusXp * (newRitualBloodPact ? 3 : 1);
                          return (
                            <ModalPortal>
                            <div data-feedback-id="ritual-chamber.create-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={closeRitualModal}>
                              <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                                {/* NPC Portrait — absolute left of modal, hidden on mobile */}
                                <div className="hidden md:flex flex-col" style={{ position: "absolute", right: "calc(100% + 16px)", top: "50%", transform: "translateY(-50%)", width: 200, overflow: "visible" }}>
                                  <img src="/images/portraits/npc-seraine.png?v=3" alt="Seraine Ashwell" width={256} height={384} style={{ imageRendering: "auto", width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.4))", borderRadius: "8px 8px 0 0", pointerEvents: "none" }} />
                                  <div style={{ background: "rgba(25,17,5,0.92)", border: "1px solid rgba(245,158,11,0.4)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                                    <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>{getSeraineSpeech(newRitualCommitment, newRitualBloodPact)}</p>
                                  </div>
                                </div>
                              <div style={{ maxWidth: 1000, width: "100%", borderRadius: "1rem", background: newRitualBloodPact ? "linear-gradient(160deg, #2c1a1a 0%, #1e1010 100%)" : "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: `1px solid ${newRitualBloodPact ? "rgba(239,68,68,0.45)" : "rgba(245,158,11,0.3)"}`, boxShadow: newRitualBloodPact ? "0 0 60px rgba(239,68,68,0.12)" : "0 0 40px rgba(167,139,250,0.08)", transition: "all 0.4s ease" }}>
                                {/* Header */}
                                <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b" style={{ borderColor: "rgba(245,158,11,0.12)" }}>
                                  <img src="/images/icons/ui-ritual-rune.png" alt="" width={28} height={28} style={{ imageRendering: "auto" }} onError={e => (e.currentTarget.style.display = "none")} />
                                  <div>
                                    <h3 className="text-sm font-bold" style={{ color: "#e8d5a3" }}>Forge a New Rite</h3>
                                    <p className="text-xs" style={{ color: "rgba(200,170,100,0.4)" }}>Seraine Ashwell — Ritual Chamber</p>
                                  </div>
                                  <button onClick={closeRitualModal} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.6)"; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ""; }}>×</button>
                                </div>
                                {/* Mobile-only speech */}
                                <div className="md:hidden px-5 py-2.5" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)", background: "rgba(25,17,5,0.4)" }}>
                                  <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>{getSeraineSpeech(newRitualCommitment, newRitualBloodPact)}</p>
                                </div>
                                {/* Form */}
                                <div className="p-5 space-y-4" style={{ paddingBottom: "1.75rem" }}>
                                  <div>
                                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(200,170,100,0.55)" }}>Ritual Name</label>
                                    <input value={newRitualTitle} onChange={e => { setNewRitualTitle(e.target.value); if (ritualNameError) setRitualNameError(false); }} placeholder="Name your ritual..." className="w-full text-sm px-3 py-2.5 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: ritualNameError ? "1px solid #ef4444" : "1px solid rgba(245,158,11,0.25)", color: "#e8d5a3", outline: "none" }} onKeyDown={e => e.key === "Enter" && submitRitual()} autoFocus />
                                    {ritualNameError && <p style={{ color: "#ef4444", fontSize: "0.7rem", marginTop: 4 }}>Please enter a ritual name</p>}
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(200,170,100,0.55)" }}>Category</label>
                                      <select value={newRitualCategory} onChange={e => setNewRitualCategory(e.target.value)} className="w-full text-sm rounded-lg" style={{ background: "#1a1a2e", border: "1px solid rgba(245,158,11,0.3)", color: "#f0f0f0", outline: "none", padding: "8px 12px", borderRadius: 8, appearance: "none", cursor: "pointer" }}>
                                        <option value="fitness">Fitness</option>
                                        <option value="learning">Learning</option>
                                        <option value="personal">Personal</option>
                                        <option value="social">Social</option>
                                        <option value="creative">Creative</option>
                                        <option value="wellness">Wellness</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(200,170,100,0.55)" }}>Frequency</label>
                                      <div className="flex gap-1.5">
                                        {[{ v: "daily", label: "Daily" }, { v: "weekly", label: "Weekly" }].map(({ v, label }) => (
                                          <button key={v} onClick={() => setNewRitualSchedule(v)} className="ritual-freq-btn flex-1 text-xs py-2 rounded-lg font-medium" style={{ background: newRitualSchedule === v ? "rgba(245,158,11,0.2)" : "rgba(0,0,0,0.25)", color: newRitualSchedule === v ? "#f59e0b" : "rgba(200,170,100,0.4)", border: `1px solid ${newRitualSchedule === v ? "rgba(245,158,11,0.45)" : "rgba(245,158,11,0.1)"}` }}>{label}</button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(200,170,100,0.55)" }}>Aetherbond</label>
                                    <div className="grid grid-cols-3 gap-1.5" style={ritualCommitmentError ? { border: "1px solid #ef4444", borderRadius: 8, padding: 2 } : {}}>
                                      {COMMITMENT_TIERS.map(tier => (
                                        <button key={tier.id} onClick={() => { setNewRitualCommitment(tier.id); if (ritualCommitmentError) setRitualCommitmentError(false); }} className="ritual-tier-btn text-left p-2 rounded-lg" style={{ background: newRitualCommitment === tier.id ? `${tier.color}22` : "rgba(0,0,0,0.2)", border: `1px solid ${newRitualCommitment === tier.id ? tier.color : "rgba(255,255,255,0.07)"}`, boxShadow: newRitualCommitment === tier.id ? `0 0 12px ${tier.color}55` : "none" }}>
                                          <div className="text-xs font-bold" style={{ color: newRitualCommitment === tier.id ? tier.color : "rgba(255,255,255,0.55)" }}>{tier.label}</div>
                                          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{tier.days > 0 ? `${tier.days}d` : "—"}</div>
                                          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.22)", lineHeight: 1.3 }}>{tier.flavorShort}</div>
                                        </button>
                                      ))}
                                    </div>
                                    {ritualCommitmentError && <p style={{ color: "#ef4444", fontSize: "0.7rem", marginTop: 4 }}>Choose a commitment duration</p>}
                                  </div>
                                  <div>
                                    <button onClick={() => setNewRitualBloodPact(p => !p)} className={`action-btn w-full py-2.5 px-4 rounded-xl font-semibold text-sm ${newRitualBloodPact ? "blood-pact-active" : ""}`} style={{ background: newRitualBloodPact ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.04)", color: newRitualBloodPact ? "#ef4444" : "rgba(255,255,255,0.28)", border: `1px solid ${newRitualBloodPact ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`, transition: "color 0.3s, background 0.3s, border 0.3s" }}>
                                      {newRitualBloodPact ? "Blood Pact Sealed" : "Seal Blood Pact"}
                                    </button>
                                    {newRitualBloodPact && <p className="text-xs mt-1.5 text-center" style={{ color: "rgba(239,68,68,0.7)" }}>! Blood Pact: Failure = all rewards forfeit.</p>}
                                  </div>
                                  <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(245,158,11,0.1)" }}>
                                    <p className="text-xs font-semibold mb-1.5" style={{ color: "rgba(200,170,100,0.45)" }}>Reward Preview</p>
                                    <p className="text-xs" style={{ color: "rgba(200,170,100,0.65)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>Daily: <span style={{ color: "#f59e0b", display: "inline-flex", alignItems: "center", gap: 2 }}>5 <img src="/images/icons/reward-gold.png" width={20} height={20} style={{ imageRendering: "auto" }} /></span> <span style={{ color: "#a78bfa" }}>10 XP</span></p>
                                    {tierData.id !== "none" && <p className="text-xs mt-0.5" style={{ color: "rgba(200,170,100,0.65)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>Bond Bonus: <span style={{ color: "#f59e0b", display: "inline-flex", alignItems: "center", gap: 2 }}>+{bonusGold} <img src="/images/icons/reward-gold.png" width={20} height={20} style={{ imageRendering: "auto" }} /></span> <span style={{ color: "#a78bfa" }}>+{bonusXp} XP</span>{newRitualBloodPact && <span style={{ color: "#ef4444", fontWeight: "bold" }}> ×3</span>}</p>}
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <button onClick={closeRitualModal} className="action-btn text-sm py-2.5 px-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(200,170,100,0.38)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
                                    <button onClick={submitRitual} className="action-btn flex-1 text-sm py-2.5 rounded-xl font-bold" style={{ background: "rgba(245,158,11,0.22)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.55)", boxShadow: "0 0 16px rgba(245,158,11,0.12)" }}>Forge Ritual</button>
                                  </div>
                                </div>
                              </div>
                              </div>
                            </div>
                            </ModalPortal>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* ── Anti-Rituale Tab ── */}
                  {questBoardTab === "anti-rituale" && (
                    <div data-feedback-id="vow-shrine">
                    <AntiRitualePanel playerName={playerName} reviewApiKey={reviewApiKey} />
                    </div>
                  )}

                </aside>

                {/* Delete Ritual Confirm Modal */}
                {deleteRitualConfirmId && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => setDeleteRitualConfirmId(null)}>
                    <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: "1px solid rgba(239,68,68,0.35)", boxShadow: "0 0 40px rgba(239,68,68,0.1)" }} onClick={e => e.stopPropagation()}>
                      <div className="p-5 text-center">
                        <p className="text-2xl mb-3">×</p>
                        <p className="text-sm font-bold mb-1" style={{ color: "#e8d5a3" }}>Break this Ritual?</p>
                        <p className="text-xs mb-5" style={{ color: "rgba(200,170,100,0.45)" }}>Are you sure you want to shatter this daily rite?</p>
                        <div className="flex gap-2">
                          <button onClick={() => setDeleteRitualConfirmId(null)} className="flex-1 text-sm py-2 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(200,170,100,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>Keep It</button>
                          <button
                            onClick={async () => {
                              const id = deleteRitualConfirmId;
                              setDeleteRitualConfirmId(null);
                              try {
                                await fetch(`/api/rituals/${id}`, { method: 'DELETE', headers: { 'x-api-key': reviewApiKey } });
                                if (playerName) fetchRituals(playerName).then(setRituals);
                              } catch { /* ignore */ }
                            }}
                            className="flex-1 text-sm py-2 rounded-lg font-semibold"
                            style={{ background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}
                          >
                            Break Ritual
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Extend Ritual Modal */}
                {extendRitualId && (() => {
                  const ritualToExtend = rituals.find(r => r.id === extendRitualId);
                  if (!ritualToExtend) return null;
                  const currentDays = ritualToExtend.commitmentDays ?? 0;
                  const selectedTier = COMMITMENT_TIERS.find(t => t.id === extendRitualCommitment);
                  const canExtend = selectedTier && selectedTier.days > currentDays;
                  const closeExtend = () => { setExtendRitualId(null); setExtendRitualCommitment("none"); };

                  return (
                    <ModalPortal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={closeExtend}>
                      <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                        <div className="hidden md:flex flex-col" style={{ position: "absolute", right: "calc(100% + 16px)", top: "50%", transform: "translateY(-50%)", width: 200, overflow: "visible" }}>
                          <img src="/images/portraits/npc-seraine.png?v=3" alt="Seraine Ashwell" width={256} height={384} style={{ imageRendering: "auto", width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.4))", borderRadius: "8px 8px 0 0", pointerEvents: "none" }} />
                          <div style={{ background: "rgba(25,17,5,0.92)", border: "1px solid rgba(245,158,11,0.4)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                            <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>&ldquo;Das Feuer wächst. Gut. Nähre es.&rdquo;</p>
                          </div>
                        </div>
                        <div style={{ maxWidth: 480, width: "100%", borderRadius: "1rem", background: "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 40px rgba(245,158,11,0.07)" }}>
                          <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b" style={{ borderColor: "rgba(245,158,11,0.12)" }}>
                            <div>
                              <h3 className="text-sm font-bold" style={{ color: "#e8d5a3" }}>Ritual verlängern: {ritualToExtend.title}</h3>
                              <p className="text-xs" style={{ color: "rgba(200,170,100,0.4)" }}>Aktuell: {COMMITMENT_TIERS.find(t => t.id === (ritualToExtend.commitment ?? "none"))?.label ?? "Keine"} ({currentDays}d)</p>
                            </div>
                            <button onClick={closeExtend} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                          </div>
                          <div className="p-5 space-y-4">
                            <div>
                              <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(200,170,100,0.55)" }}>Neuer Ätherbund (muss länger sein)</label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {COMMITMENT_TIERS.filter(tier => tier.days > currentDays).map(tier => (
                                  <button key={tier.id} onClick={() => setExtendRitualCommitment(tier.id)} className="text-left p-2 rounded-lg" style={{ background: extendRitualCommitment === tier.id ? `${tier.color}1a` : "rgba(0,0,0,0.2)", border: `1px solid ${extendRitualCommitment === tier.id ? tier.color : "rgba(255,255,255,0.07)"}`, boxShadow: extendRitualCommitment === tier.id ? `0 0 12px ${tier.color}55` : "none" }}>
                                    <div className="text-xs font-bold" style={{ color: extendRitualCommitment === tier.id ? tier.color : "rgba(255,255,255,0.5)" }}>{tier.label}</div>
                                    <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{tier.days}d</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={closeExtend} className="text-sm py-2.5 px-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(200,170,100,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>Abbrechen</button>
                              <button
                                disabled={!canExtend}
                                onClick={async () => {
                                  if (!canExtend || !selectedTier) return;
                                  try {
                                    await fetch(`/api/rituals/${extendRitualId}/extend`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
                                      body: JSON.stringify({ newCommitment: selectedTier.id, newCommitmentDays: selectedTier.days }),
                                    });
                                    closeExtend();
                                    if (playerName) { const updated = await fetchRituals(playerName); setRituals(updated); }
                                  } catch { /* ignore */ }
                                }}
                                className="flex-1 text-sm py-2.5 rounded-xl font-bold"
                                style={{ background: canExtend ? "rgba(180,130,50,0.32)" : "rgba(255,255,255,0.04)", color: canExtend ? "#e8d5a3" : "rgba(255,255,255,0.2)", border: `1px solid ${canExtend ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.08)"}`, cursor: canExtend ? "pointer" : "not-allowed" }}
                              >
                                Ritual verlängern
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    </ModalPortal>
                  );
                })()}

                {/* Rise Again / Recommit Ritual Modal */}
                {recommitRitualId && (() => {
                  const ritualToRecommit = rituals.find(r => r.id === recommitRitualId);
                  if (!ritualToRecommit) return null;
                  return (
                    <ModalPortal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)" }} onClick={() => setRecommitRitualId(null)}>
                      <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                        <div className="hidden md:flex flex-col" style={{ position: "absolute", right: "calc(100% + 16px)", top: "50%", transform: "translateY(-50%)", width: 200, overflow: "visible" }}>
                          <img src="/images/portraits/npc-seraine.png?v=3" alt="Seraine Ashwell" width={256} height={384} style={{ imageRendering: "auto", width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 0 14px rgba(245,158,11,0.4))", borderRadius: "8px 8px 0 0", pointerEvents: "none" }} />
                          <div style={{ background: "rgba(25,17,5,0.92)", border: "1px solid rgba(245,158,11,0.4)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                            <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>&ldquo;The flame went out. But the ember remembers. Do you?&rdquo;</p>
                          </div>
                        </div>
                        <div style={{ maxWidth: 420, width: "100%", borderRadius: "1rem", background: "linear-gradient(160deg, #2c2318 0%, #1e1912 100%)", border: "1px solid rgba(167,139,250,0.35)", boxShadow: "0 0 40px rgba(167,139,250,0.08)" }}>
                          <div className="px-5 pt-5 pb-3 text-center" style={{ borderBottom: "1px solid rgba(245,158,11,0.12)" }}>
                            <p className="text-3xl mb-2">—</p>
                            <h3 className="text-base font-bold" style={{ color: "#e8d5a3" }}>Rise Again</h3>
                            <p className="text-xs mt-1" style={{ color: "rgba(200,170,100,0.5)" }}>{ritualToRecommit.title}</p>
                          </div>
                          <div className="md:hidden px-5 py-2.5" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)", background: "rgba(25,17,5,0.4)" }}>
                            <p style={{ fontSize: "0.8rem", fontStyle: "italic", color: "#c9a46a", lineHeight: 1.5, margin: 0 }}>&ldquo;The flame went out. But the ember remembers. Do you?&rdquo;</p>
                          </div>
                          <div className="p-5 space-y-4">
                            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                              Your streak was broken, but the rite endures. Recommit and begin anew — your longest streak of <span style={{ color: "#f59e0b", fontWeight: 600 }}>{ritualToRecommit.longestStreak ?? 0} days</span> is etched in the records.
                            </p>
                            <p className="text-xs italic" style={{ color: "rgba(200,170,100,0.35)" }}>
                              &ldquo;Every forge has cooled. Every flame has flickered. What matters is the next spark.&rdquo;
                            </p>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => setRecommitRitualId(null)} className="text-sm py-2.5 px-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(200,170,100,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>Not Yet</button>
                              <button
                                onClick={async () => {
                                  try {
                                    await fetch(`/api/rituals/${recommitRitualId}/recommit`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", "x-api-key": reviewApiKey },
                                      body: JSON.stringify({ playerId: playerName }),
                                    });
                                    setRecommitRitualId(null);
                                    if (playerName) fetchRituals(playerName).then(setRituals);
                                  } catch { /* ignore */ }
                                }}
                                className="flex-1 text-sm py-2.5 rounded-xl font-bold"
                                style={{ background: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.5)", boxShadow: "0 0 16px rgba(167,139,250,0.12)", cursor: "pointer" }}
                              >
                                x Rise Again
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    </ModalPortal>
                  );
                })()}
              </div>

              {/* Smart Suggestions — player quest board only */}
              {/* <SmartSuggestionsPanel quests={quests} agents={agents} /> */}
            </div>
          );
        })()}

        {/* ── KLASSENQUESTS TAB ── */}
        {dashView === "klassenquests" && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#60a5fa" }}>The Arcanum</h2>
            </div>
            <div className="rounded-xl px-6 py-16 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-lg font-bold mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Coming Soon</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>Das Arcanum sammelt seine Schriftrollen. Klassenquests und Skill Trees folgen bald.</p>
            </div>
          </div>
        )}

        {/* ── CHARACTER TAB ── */}
        {dashView === "character" && playerName && (
          <CharacterView playerName={playerName} apiKey={reviewApiKey} users={users} classesList={classesList} />
        )}

        {/* ── THE WANDERER'S REST (NPC Tab) ── */}
        {dashView === "npcBoard" && (() => {
          const devVisibleOpen = applySort(applyFilter(quests.open.filter(q => (q.type ?? "development") === "development" && (q.createdBy ?? "").toLowerCase() !== "lyra")));
          const devVisibleInProgress = applySort(applyFilter(quests.inProgress.filter(q => (q.type ?? "development") === "development" && (q.createdBy ?? "").toLowerCase() !== "lyra")));
          const lyraQuestsOpen = applySort(applyFilter(quests.open.filter(q => (q.createdBy ?? "").toLowerCase() === "lyra")));
          const lyraQuestsInProgress = applySort(applyFilter(quests.inProgress.filter(q => (q.createdBy ?? "").toLowerCase() === "lyra")));
          const lyraAllQuests = lyraQuestsOpen.concat(lyraQuestsInProgress);
          return (
            <WandererRest
              npcBoardFilter={npcBoardFilter}
              setNpcBoardFilter={setNpcBoardFilter}
              activeNpcs={activeNpcs}
              selectedNpc={selectedNpc}
              setSelectedNpc={setSelectedNpc}
              isAdmin={isAdmin}
              reviewApiKey={reviewApiKey}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              sortMode={sortMode}
              setSortMode={setSortMode}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              devOpenCollapsed={devOpenCollapsed}
              setDevOpenCollapsed={setDevOpenCollapsed}
              devInProgressCollapsed={devInProgressCollapsed}
              setDevInProgressCollapsed={setDevInProgressCollapsed}
              handleApprove={handleApprove}
              handleReject={handleReject}
              handleChangePriority={handleChangePriority}
              reviewComments={reviewComments}
              setReviewComments={setReviewComments}
              dobbieOpen={dobbieOpen}
              setDobbieOpen={setDobbieOpen}
              loading={loading}
              quests={quests}
              playerName={playerName}
              petName={loggedInUser?.companion?.name}
              refresh={refresh}
              devVisibleOpen={devVisibleOpen}
              devVisibleInProgress={devVisibleInProgress}
              lyraQuestsOpen={lyraQuestsOpen}
              lyraQuestsInProgress={lyraQuestsInProgress}
              lyraAllQuests={lyraAllQuests}
              handleClaim={handleClaim}
              handleUnclaim={handleUnclaim}
              handleComplete={handleComplete}
              streak={playerStreak}
              user={loggedInUser}
            />
          );
        })()}

        {/* Rejected Quests (Mülleimer) — only on NPC board, admin only */}
        {isAdmin && dashView === "npcBoard" && quests.rejected.length > 0 && (
          <section className="mb-6">
            <button
              onClick={() => setRejectedOpen(v => !v)}
              className="flex items-center gap-2 mb-3 w-full text-left"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                Rejected
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)" }}>
                {quests.rejected.length}
              </span>
              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                {rejectedOpen ? "▲" : "▼"}
              </span>
            </button>
            {rejectedOpen && (
              <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.04)" }}>
                {quests.rejected.map((q, i) => (
                  <div
                    key={q.id}
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ borderBottom: i === quests.rejected.length - 1 ? "none" : "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <span className="text-xs flex-shrink-0" style={{ color: "rgba(239,68,68,0.4)" }}>x</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.25)", textDecoration: "line-through" }}>{q.title}</p>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>by {q.createdBy ?? "unknown"}</span>
                    </div>
                    <PriorityBadge priority={q.priority} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Completed Quests Log — Quest Journal (context-sensitive) */}
        {(quests.completed.length > 0 || !loading) && (() => {
          const playerJournalTypes = ["personal", "fitness", "social", "learning", "relationship-coop"];
          // Player board: only logged-in player's completed player-type quests (not rejected, not dev)
          const playerJournalQuests = dashView === "questBoard" && playerName
            ? quests.completed.filter(q =>
                playerJournalTypes.includes(q.type ?? "") &&
                (q.completedBy ?? "").toLowerCase() === playerName.toLowerCase() &&
                q.status !== "rejected"
              )
            : null;
          // NPC board: development completed quests (admin only)
          const npcJournalQuests = (dashView === "npcBoard" && isAdmin)
            ? quests.completed.filter(q => (q.type ?? "development") === "development")
            : null;
          const journalQuests = playerJournalQuests ?? npcJournalQuests;
          if (journalQuests === null || (journalQuests.length === 0 && loading)) return null;

          return (
            <section>
              <button
                onClick={() => setCompletedOpen(v => !v)}
                className="flex items-center gap-2 mb-3 w-full text-left"
              >
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {dashView === "npcBoard" ? "NPC Quest Log" : "Quest Journal"}
                </h2>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                  {journalQuests.length}
                </span>
                <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {completedOpen ? "▲" : "▼"}
                </span>
              </button>

              {completedOpen && (
                <div>
                  <input
                    type="text"
                    value={completedSearch}
                    onChange={e => setCompletedSearch(e.target.value)}
                    placeholder="Search completed quests…"
                    className="w-full text-xs px-3 py-2 rounded-lg mb-2"
                    style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", color: "#e8e8e8", outline: "none" }}
                  />
                  <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {journalQuests.length === 0 ? (
                      <p className="text-xs p-4 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {dashView === "questBoard" && !playerName ? "Login to see your completed quests" : "No completed quests yet"}
                      </p>
                    ) : (() => {
                      const filtered = completedSearch
                        ? journalQuests.filter(q =>
                            q.title.toLowerCase().includes(completedSearch.toLowerCase()) ||
                            (q.description ?? "").toLowerCase().includes(completedSearch.toLowerCase()) ||
                            (q.completedBy ?? "").toLowerCase().includes(completedSearch.toLowerCase())
                          )
                        : journalQuests;
                      if (filtered.length === 0) return (
                        <p className="text-xs p-4 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>No quests match &ldquo;{completedSearch}&rdquo;</p>
                      );
                      return (
                        <div>
                          {filtered.map((q, i) => (
                            <CompletedQuestRow
                              key={q.id}
                              quest={q}
                              isLast={i === filtered.length - 1}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </section>
          );
        })()}
      </main>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl"
          style={{
            transform: "translateX(-50%)",
            background: "#252525",
            border: "1px solid rgba(255,102,51,0.4)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(255,102,51,0.1)",
          }}
        >
          <span className="text-xs font-medium mr-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            {selectedIds.size} selected
          </span>
          {(["open", "completed", "rejected"] as Quest["status"][]).map(s => (
            <button
              key={s}
              onClick={() => handleBulkUpdate(s)}
              disabled={bulkLoading}
              className="text-xs px-2.5 py-1 rounded-lg font-medium"
              style={{
                background: s === "completed" ? "rgba(34,197,94,0.15)" : s === "rejected" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.07)",
                color: s === "completed" ? "#22c55e" : s === "rejected" ? "#ef4444" : "rgba(255,255,255,0.6)",
                border: `1px solid ${s === "completed" ? "rgba(34,197,94,0.3)" : s === "rejected" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.12)"}`,
                opacity: bulkLoading ? 0.5 : 1,
              }}
            >
              → {s}
            </button>
          ))}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs px-2 py-1 rounded-lg ml-1"
            style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            x
          </button>
        </div>
      )}

      {/* Quest Detail Modal */}
      {questDetailModal && (() => {
        const q = questDetailModal;
        const rarity = getQuestRarity(q);
        const rarityColor = RARITY_COLORS[rarity] ?? "#9ca3af";
        const isLegendary = rarity === "legendary";
        const typeCfg = typeConfig[q.type ?? "personal"] ?? typeConfig.personal;
        const isClaimedByMe = playerName && q.claimedBy?.toLowerCase() === playerName.toLowerCase();
        const isCoop = q.type === "relationship-coop";
        const coopPartners = q.coopPartners ?? [];
        const coopClaimed = q.coopClaimed ?? [];
        const coopCompletions = q.coopCompletions ?? [];
        const isCoopPartner = playerName ? coopPartners.includes(playerName.toLowerCase()) : false;
        const hasCoopClaimed = playerName ? coopClaimed.includes(playerName.toLowerCase()) : false;
        const hasCoopCompleted = playerName ? coopCompletions.includes(playerName.toLowerCase()) : false;
        return (
          <ModalPortal>
          <div
            data-feedback-id="quest-board.quest-modal"
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => setQuestDetailModal(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl flex flex-col"
              style={{
                background: "#1e1e1e",
                border: `2px solid ${rarityColor}66`,
                boxShadow: isLegendary ? `0 0 40px ${rarityColor}30` : "0 20px 60px rgba(0,0,0,0.6)",
                maxHeight: "80vh",
                overflow: "hidden",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Rarity header bar */}
              <div style={{ height: 4, background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)` }} />
              {/* Header */}
              <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3" style={{ borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{typeCfg.icon?.startsWith("/") ? <img src={typeCfg.icon} alt="" width={28} height={28} style={{ imageRendering: "auto" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : typeCfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold leading-snug" style={{ color: "#f0f0f0" }}>{q.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: rarityColor, background: `${rarityColor}18`, border: `1px solid ${rarityColor}40` }}>{rarity}</span>
                      {q.difficulty && q.difficulty !== "none" && (
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded capitalize" style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>{q.difficulty}</span>
                      )}
                      <span className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.35)" }}>{q.type ?? "personal"}</span>
                      {/* priority hidden from modal header */}
                      {q.minLevel != null && q.minLevel > 0 && (() => {
                        const meets = playerLevelInfo.level >= q.minLevel;
                        return (
                          <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded" style={{
                            color: meets ? "#22c55e" : "#ef4444",
                            background: meets ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            border: `1px solid ${meets ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                          }}>Level {q.minLevel}</span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <button onClick={() => setQuestDetailModal(null)} style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
              {/* Body */}
              <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
                {/* Flavor / Lore text */}
                {(() => {
                  const FLAVOR_BY_TYPE: Record<string, string> = {
                    personal:           "Eine persönliche Herausforderung, die dein Wesen stärkt und deinen Charakter formt.",
                    learning:           "Das Wissen der Alten wartet darauf, entdeckt zu werden. Nur wer sucht, wird finden.",
                    fitness:            "Nur durch körperliche Ertüchtigung wird der Geist wahrhaft frei. Stähle deinen Körper.",
                    social:             "Verbindungen sind die stärkste Magie in dieser Welt. Knüpfe Bande, die den Sturm überdauern.",
                    "relationship-coop":"Gemeinsam seid ihr stärker als ihr es alleine je sein könntet. Schulter an Schulter.",
                    development:        "Der Code ist die neue Magie — und du bist der Zauberer. Erschaffe etwas Bleibendes.",
                    boss:               "Eine dunkle Macht erhebt sich. Nur die Mutigsten können bestehen. Rüste dich gut.",
                  };
                  const flavorText = q.flavorText || FLAVOR_BY_TYPE[q.type ?? "personal"] || "Eine Herausforderung wartet. Beweise dein Können.";
                  return (
                    <>
                      {q.npcGiverId && (
                        <p className="text-xs font-semibold mb-1" style={{ color: RARITY_COLORS[q.npcRarity ?? "common"] ?? "#9ca3af" }}>
                          {q.npcName}{(q.chainTotal ?? 1) > 1 && (
                            <span style={{ fontSize: 8, letterSpacing: "0.15em", marginLeft: 4 }}>
                              {Array.from({ length: q.chainTotal! }, (_, i) => (
                                <span key={i} style={{ color: RARITY_COLORS[q.npcRarity ?? "common"] ?? "#f59e0b", opacity: i < (q.chainIndex ?? 0) ? 0.8 : i === (q.chainIndex ?? 0) ? 1 : 0.3 }}>
                                  {i < (q.chainIndex ?? 0) ? "●" : i === (q.chainIndex ?? 0) ? "◐" : "○"}
                                </span>
                              ))}
                            </span>
                          )}
                        </p>
                      )}
                      <p className="text-sm italic leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
                        &ldquo;{flavorText}&rdquo;
                      </p>
                    </>
                  );
                })()}
                {/* Ornamental divider */}
                <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.12)" }}>
                  <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)", display: "block" }} />
                  <span style={{ fontSize: 11, letterSpacing: 4 }}>◆ ◆ ◆</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)", display: "block" }} />
                </div>
                {/* Task / Aufgabe */}
                {q.description && (
                  <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${rarityColor}55`, border: `1px solid rgba(255,255,255,0.06)`, borderLeftColor: `${rarityColor}66` }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: `${rarityColor}99` }}>Aufgabe</p>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{q.description}</p>
                  </div>
                )}
                {/* Rewards */}
                {(() => {
                  const XP_BY_RARITY: Record<string, number> = { common: 10, uncommon: 18, rare: 30, epic: 50, legendary: 80 };
                  const GOLD_BY_RARITY: Record<string, number> = { common: 8, uncommon: 14, rare: 24, epic: 40, legendary: 65 };
                  const XP_FALLBACK: Record<string, number> = { high: 30, medium: 20, low: 10 };
                  const GOLD_FALLBACK: Record<string, number> = { high: 25, medium: 15, low: 9 };
                  const displayXp = (q.rewards?.xp != null && q.rewards.xp > 0) ? q.rewards.xp : (q.rarity ? (XP_BY_RARITY[q.rarity] ?? XP_FALLBACK[q.priority] ?? 10) : (XP_FALLBACK[q.priority] ?? 10));
                  const displayGold = (q.rewards?.gold != null && q.rewards.gold > 0) ? q.rewards.gold : (q.rarity ? (GOLD_BY_RARITY[q.rarity] ?? GOLD_FALLBACK[q.priority] ?? 9) : (GOLD_FALLBACK[q.priority] ?? 9));
                  return (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Belohnung</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                          <img src="/images/icons/reward-gold.png" width={16} height={16} style={{ imageRendering: "auto", verticalAlign: "middle" }} />
                          <span className="text-sm font-mono font-bold" style={{ color: "#fbbf24" }}>{displayGold} Gold</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                          <img src="/images/icons/reward-xp.png" width={16} height={16} style={{ imageRendering: "auto", verticalAlign: "middle" }} />
                          <span className="text-sm font-mono font-bold" style={{ color: "#a78bfa" }}>{displayXp} XP</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {q.claimedBy && !isClaimedByMe && (
                  <p className="text-xs" style={{ color: "rgba(139,92,246,0.7)" }}>→ Beansprucht von {q.claimedBy}</p>
                )}
              </div>
              {/* Action footer */}
              <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                {!isCoop && reviewApiKey && playerName && q.status === "open" && (
                  <button
                    onClick={() => { handleClaim(q.id); setQuestDetailModal(null); }}
                    style={{ background: "linear-gradient(180deg, #2a2a2a, #1a1a1a)", border: "2px solid #FFD700", color: "#FFD700", fontSize: 14, fontWeight: 700, padding: "10px 28px", borderRadius: 8, cursor: "pointer", transition: "background 0.15s, color 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#FFD700"; (e.currentTarget as HTMLButtonElement).style.color = "#1a1a1a"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(180deg, #2a2a2a, #1a1a1a)"; (e.currentTarget as HTMLButtonElement).style.color = "#FFD700"; }}
                  >Claim Quest</button>
                )}
                {!isCoop && reviewApiKey && playerName && isClaimedByMe && (
                  <>
                    <button onClick={() => { handleUnclaim(q.id); setQuestDetailModal(null); }} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer" }}>Unclaim</button>
                    <button
                      onClick={() => { handleComplete(q.id, q.title); setQuestDetailModal(null); }}
                      className="text-sm px-4 py-1.5 rounded font-semibold"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.35)", cursor: "pointer", transition: "background 0.15s, color 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#22c55e"; (e.currentTarget as HTMLButtonElement).style.color = "#1a1a1a"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#22c55e"; }}
                    >Abgeschlossen</button>
                  </>
                )}
                {isCoop && isCoopPartner && !hasCoopClaimed && q.status !== "completed" && reviewApiKey && playerName && (
                  <button onClick={() => { handleCoopClaim(q.id); setQuestDetailModal(null); }} className="text-sm px-4 py-1.5 rounded font-semibold" style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.3)", cursor: "pointer" }}>Join Coop</button>
                )}
                {isCoop && isCoopPartner && hasCoopClaimed && !hasCoopCompleted && q.status !== "completed" && reviewApiKey && playerName && (
                  <button onClick={() => { handleCoopComplete(q.id); setQuestDetailModal(null); }} className="text-sm px-4 py-1.5 rounded font-semibold" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", cursor: "pointer" }}>My Part Done</button>
                )}
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}

      {/* Loot Drop Notification */}
      {lootDrop && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setLootDrop(null)}>
          <div className="w-full max-w-xs rounded-2xl p-6 text-center" style={{ background: "#1a1a1a", border: `2px solid ${lootDrop.rarityColor}`, boxShadow: `0 0 30px ${lootDrop.rarityColor}55` }}
            onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-3" style={{ filter: `drop-shadow(0 0 12px ${lootDrop.rarityColor})` }}>{lootDrop.emoji}</div>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: lootDrop.rarityColor }}>{lootDrop.rarity}</div>
            <div className="text-base font-bold mb-2" style={{ color: "#e8e8e8" }}>{lootDrop.name}</div>
            {lootDrop.effect?.amount && (
              <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
                {lootDrop.effect.type === 'gold' && `＋${lootDrop.effect.amount} Gold`}
                {lootDrop.effect.type === 'xp' && `＋${lootDrop.effect.amount} XP`}
                {lootDrop.effect.type === 'streak_shield' && `＋${lootDrop.effect.amount} Streak-Schutzschild`}
                {lootDrop.effect.type === 'bond' && `＋${lootDrop.effect.amount} Bond XP`}
              </div>
            )}
            <button
              onClick={() => { setPurchaseToast(`${lootDrop.name} added to inventory!`); setLootDrop(null); }}
              className="shop-buy-btn w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: `${lootDrop.rarityColor}22`, color: lootDrop.rarityColor, border: `1px solid ${lootDrop.rarityColor}55` }}
            >
              Einsammeln x
            </button>
          </div>
        </div>
      )}

      <footer data-feedback-id="footer" className="mt-12 py-4" style={{ borderTop: "1px solid rgba(255,68,68,0.07)", position: "relative", zIndex: 2 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-center gap-3 text-xs font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>
          <span>Quest Hall v1.5.0</span>
          <span style={{ color: "rgba(255,255,255,0.08)" }}>·</span>
          <button
            data-feedback-id="footer.alpha-button"
            onClick={() => setFeedbackMode(v => !v)}
            title={feedbackMode ? "Exit Feedback Mode (Esc)" : "Enter Alpha Feedback Mode"}
            style={{
              background: "none",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 12,
              padding: "2px 6px",
              borderRadius: 4,
              color: feedbackMode ? "#818cf8" : "rgba(255,255,255,0.25)",
              border: `1px solid ${feedbackMode ? "rgba(129,140,248,0.5)" : "rgba(255,255,255,0.1)"}`,
              animation: feedbackMode ? "pulse-online 1.5s ease-in-out infinite" : "none",
              transition: "color 0.2s, border-color 0.2s",
            }}
          >
            (α) Alpha v1.5
          </button>
        </div>
      </footer>

      {/* Shop Modal */}
      {shopUserId && (() => {
        const u = users.find(x => x.id === shopUserId);
        if (!u) return null;
        return (
          <ShopModal
            userId={u.id}
            userName={u.name}
            gold={u.gold ?? 0}
            currentGear={u.gear}
            onClose={() => setShopUserId(null)}
            onBuy={handleShopBuy}
            onGearBuy={handleGearBuy}
          />
        );
      })()}

      {/* API Error Toast (rate limit etc) — auto-closes after 5s, click/Escape to dismiss */}
      {apiError && (
        <div
          onClick={() => setApiError(null)}
          className="fixed top-16 left-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl cursor-pointer select-none"
          style={{
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #1c1010, #1a1a1a)",
            border: "1px solid rgba(239,68,68,0.45)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.6), 0 0 16px rgba(239,68,68,0.12)",
            maxWidth: "min(480px, 92vw)",
            animation: "fadeInDown 0.2s ease",
          }}
          title="Klicken zum Schließen"
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>⏱</span>
          <p className="text-xs leading-relaxed flex-1" style={{ color: "#fca5a5" }}>{apiError}</p>
          <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)", marginLeft: 4 }}>✕</span>
        </div>
      )}

      {/* Unified Toast Stack */}
      <ToastStack toasts={toasts} onRemove={removeToast} />

      {/* Chain Quest Toast (interactive, still separate for accept handling) */}
      {chainOffer && (
        <ChainQuestToast
          parentTitle={chainOffer.parentTitle}
          template={chainOffer.template}
          onAccept={handleChainAccept}
          onDismiss={() => setChainOffer(null)}
        />
      )}

      {/* Guide Modal (legacy fallback) */}
      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} onRestartTutorial={handleRestartTutorial} />}

      {/* Info Overlay */}
      {infoOverlayOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={e => { if (e.target === e.currentTarget) setInfoOverlayOpen(false); }}
        >
          <div
            style={{
              background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16, width: "min(800px, 95vw)", maxHeight: "80vh",
              overflow: "hidden", display: "flex", flexDirection: "column",
            }}
          >
            {/* Header with tabs */}
            <div style={{ padding: "1rem 1.25rem 0", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 4, flex: 1 }}>
                {[
                  { key: "roadmap",   label: "Roadmap" },
                  { key: "changelog", label: "Changelog" },
                  { key: "guide",     label: "Guide" },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setInfoOverlayTab(t.key as typeof infoOverlayTab)}
                    style={{
                      padding: "0.5rem 0.75rem", borderRadius: "8px 8px 0 0",
                      background: infoOverlayTab === t.key ? "rgba(255,255,255,0.08)" : "transparent",
                      color: infoOverlayTab === t.key ? "#f0f0f0" : "rgba(255,255,255,0.35)",
                      border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setInfoOverlayOpen(false)}
                style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "0 0.5rem 0.5rem" }}
              >
                ×
              </button>
            </div>
            {/* Content */}
            <div style={{ overflowY: "auto", flex: 1, padding: "1.25rem" }}>
              {infoOverlayTab === "roadmap" && <RoadmapView isAdmin={isAdmin} reviewApiKey={reviewApiKey} />}
              {infoOverlayTab === "changelog" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Changelog</span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>— recent commits from GitHub</span>
                  </div>
                  {changelogLoading && (
                    <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading commits…</div>
                  )}
                  {!changelogLoading && changelog.length === 0 && (
                    <div className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>No changelog data available.</div>
                  )}
                  {changelog.map(entry => (
                    <div key={entry.date} className="space-y-1.5">
                      <div
                        className="text-xs font-semibold uppercase tracking-widest pt-2 pb-1"
                        style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        {entry.date}
                      </div>
                      {entry.commits.map((c, i) => {
                        const typeStyle: Record<string, { badge: string; color: string; bg: string }> = {
                          feat:     { badge: "feat",     color: "#4ade80", bg: "rgba(74,222,128,0.1)"  },
                          fix:      { badge: "fix",      color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
                          chore:    { badge: "chore",    color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
                          docs:     { badge: "docs",     color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
                          refactor: { badge: "refactor", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
                        };
                        const ts = typeStyle[c.type] || { badge: c.type, color: "#9ca3af", bg: "rgba(156,163,175,0.1)" };
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-2 px-3 py-2 rounded"
                            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            <span
                              className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0"
                              style={{ color: ts.color, background: ts.bg, whiteSpace: "nowrap" }}
                            >
                              {ts.badge}
                            </span>
                            <span className="text-sm flex-1 leading-snug" style={{ color: "rgba(255,255,255,0.7)" }}>
                              {c.message}
                            </span>
                            {c.sha && (
                              c.url ? (
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-mono shrink-0"
                                  style={{ color: "rgba(255,255,255,0.2)", textDecoration: "none" }}
                                >
                                  {c.sha}
                                </a>
                              ) : (
                                <span className="text-xs font-mono shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>{c.sha}</span>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
              {infoOverlayTab === "guide" && (
                <GuideContent onRestartTutorial={() => { handleRestartTutorial(); setInfoOverlayOpen(false); }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Overlay */}
      {showTutorial && (
        <TutorialOverlay step={tutorialStep} onNext={handleTutorialNext} onSkip={handleTutorialSkip} onNavigate={(tabKey) => {
          if (tabKey === "rituals") {
            setDashView("questBoard");
            setQuestBoardTab("rituale");
          } else {
            setDashView(tabKey as typeof dashView);
          }
        }} />
      )}

      {/* Onboarding Wizard */}
      {/* Alpha Feedback Overlay */}
      <FeedbackOverlay
        active={feedbackMode}
        onExit={() => setFeedbackMode(false)}
        playerName={playerName || undefined}
      />

      {onboardingOpen && (
        <OnboardingWizard
          onClose={() => setOnboardingOpen(false)}
          onComplete={async ({ name: newName, apiKey }) => {
            setOnboardingOpen(false);
            localStorage.setItem("dash_api_key", apiKey);
            localStorage.setItem("dash_player_name", newName);
            setPlayerName(newName);
            setReviewApiKey(apiKey);
            setIsAdmin(false);
            await createStarterQuestsIfNew(newName, apiKey);
            await refresh();
            setShowTutorial(true);
            setTutorialStep(0);
          }}
        />
      )}

      {/* Class Activation Notification */}
      {classActivatedNotif && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => setClassActivatedNotif(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "#1a1a1a", border: "1px solid rgba(167,139,250,0.4)", boxShadow: "0 0 60px rgba(139,92,246,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <div className="text-4xl">×</div>
              <h2 className="text-base font-bold" style={{ color: "#f0f0f0" }}>
                Dein Klassenpfad steht bereit!
              </h2>
              <p className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
                {classActivatedNotif.classIcon} Willkommen auf dem {classActivatedNotif.className}!
              </p>
            </div>
            <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
              {classActivatedNotif.classDescription}
            </p>
            <button
              onClick={() => setClassActivatedNotif(null)}
              className="w-full py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", color: "#fff" }}
            >
              Los geht&apos;s!
            </button>
          </div>
        </div>
      )}

      {/* Create Quest Modal */}
      {createQuestOpen && (
        <div data-feedback-id="quest-board.create-modal">
        <CreateQuestModal
          quests={quests}
          users={users}
          reviewApiKey={reviewApiKey}
          onRefresh={refresh}
          onClose={() => setCreateQuestOpen(false)}
        />
        </div>
      )}
    </div>
  );
}

// ─── Suggest Quest Button + Modal (for non-admin players) ────────────────────
function SuggestQuestButton({ reviewApiKey, playerName, onRefresh }: {
  reviewApiKey: string;
  playerName: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"personal" | "learning" | "fitness" | "social">("personal");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": reviewApiKey },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), type, priority, createdBy: playerName, suggest: true }),
      });
      if (r.ok) {
        setDone(true);
        onRefresh();
        setTimeout(() => { setOpen(false); setDone(false); setTitle(""); setDescription(""); }, 1800);
      } else {
        const d = await r.json();
        setError(d.error || "Failed to submit");
      }
    } catch { setError("Network error"); } finally { setLoading(false); }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setDone(false); setError(""); }}
        className="btn-interactive text-xs px-2 py-1 rounded font-semibold"
        style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
        title="Suggest a Quest"
      >
        Suggest
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => setOpen(false)}>
          <div className="rounded-2xl w-full max-w-md" style={{ background: "#1a1a1a", border: "1px solid rgba(34,197,94,0.3)", boxShadow: "0 0 40px rgba(34,197,94,0.1)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>Suggest a Quest</h2>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Your suggestion goes to the admin for review</p>
              </div>
              <button onClick={() => setOpen(false)} style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}>×</button>
            </div>
            {done ? (
              <div className="p-6 text-center">
                <p className="text-2xl mb-2">×</p>
                <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>Quest Suggested!</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Awaiting admin review</p>
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Quest Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="What quest do you want to suggest?"
                    className="w-full text-xs px-2 py-1.5 rounded"
                    style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", outline: "none" }}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Optional details…"
                    rows={3}
                    className="w-full text-xs px-2 py-1.5 rounded resize-none"
                    style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", outline: "none" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Type</label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value as typeof type)}
                      className="w-full text-xs px-2 py-1.5 rounded"
                      style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", outline: "none" }}
                    >
                      <option value="personal">Personal</option>
                      <option value="learning">Learning</option>
                      <option value="fitness">Fitness</option>
                      <option value="social">Social</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Priority</label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value as typeof priority)}
                      className="w-full text-xs px-2 py-1.5 rounded"
                      style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", outline: "none" }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={loading || !title.trim()}
                  className="w-full text-xs py-2 rounded font-semibold"
                  style={{ background: loading || !title.trim() ? "rgba(34,197,94,0.05)" : "rgba(34,197,94,0.18)", color: loading || !title.trim() ? "rgba(34,197,94,0.4)" : "#22c55e", border: "1px solid rgba(34,197,94,0.3)", cursor: loading || !title.trim() ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Submitting…" : "Submit for Review"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
