"use client";

import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import StatBar from "@/components/StatBar";
import OnboardingWizard from "@/components/OnboardingWizard";
import ErrorBoundary from "@/components/ErrorBoundary";
// Lazy-loaded views — only loaded when the tab is active (code splitting)
const ForgeView = lazy(() => import("@/components/ForgeView"));
const LeaderboardView = lazy(() => import("@/components/LeaderboardView"));
const HonorsView = lazy(() => import("@/components/HonorsView"));
const ShopView = lazy(() => import("@/components/ShopView"));
const GachaView = lazy(() => import("@/components/GachaView"));
const CharacterView = lazy(() => import("@/components/CharacterView"));
const RitualChamber = lazy(() => import("@/components/RitualChamber"));
const ChallengesView = lazy(() => import("@/components/ChallengesView"));
const DailyLoginCalendar = lazy(() => import("@/components/DailyLoginCalendar"));
const SocialView = lazy(() => import("@/components/SocialView"));
const TavernView = lazy(() => import("@/components/TavernView"));
const RiftView = lazy(() => import("@/components/RiftView"));
const FactionsView = lazy(() => import("@/components/FactionsView"));
const BattlePassView = lazy(() => import("@/components/BattlePassView"));
const WorldBossView = lazy(() => import("@/components/WorldBossView"));
const DungeonView = lazy(() => import("@/components/DungeonView"));
import TodayDrawer from "@/components/TodayDrawer";
const PlayerProfileModal = lazy(() => import("@/components/PlayerProfileModal"));
import { GuideModal, GuideContent, TutorialOverlay, TUTORIAL_STEPS } from "@/components/TutorialModal";
import {
  CreateQuestModal, AntiRitualePanel,
  CompletedQuestRow, PriorityBadge, EpicQuestCard, QuestCard,
  ChainQuestToast,
  UserCard, ShopModal,
} from "@/components/QuestBoard";
import { ToastStack, useToastStack } from "@/components/ToastStack";
import { RewardCelebration, RewardCelebrationData } from "@/components/RewardCelebration";
import { useFloatingRewards, FloatingRewardsLayer } from "@/components/FloatingRewards";
import { CompanionsWidget } from "@/components/CompanionsWidget";
import { RoadmapView } from "@/components/RoadmapView";
import { Tip, TipCustom } from "@/components/GameTooltip";
import { WandererRest } from "@/components/WandererRest";
import GuildHallBackground from "@/components/GuildHallBackground";
import FeedbackOverlay from "@/components/FeedbackOverlay";
import { ModalPortal, useModalBehavior, ModalOverlay } from "@/components/ModalPortal";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardModals from "@/components/DashboardModals";
import { DashboardProvider } from "@/app/DashboardContext";
import QuestDetailModal from "@/components/QuestDetailModal";
import { SFX } from "@/lib/sounds";
import type {
  Agent, Quest, ActiveNpc, EarnedAchievement,
  User, Campaign, AchievementDef, ClassDef, LeaderboardEntry,
  QuestsData, Ritual, Habit, LootItem, ChangelogEntry,
} from "@/app/types";
import {
  fetchAgents, fetchQuests, fetchUsers, fetchCampaigns, fetchLeaderboard,
  fetchAchievementCatalogue, fetchRituals, fetchHabits, fetchChangelog, fetchDashboard,
  createStarterQuestsIfNew, useCountUp, CURRENT_SEASON,
  GUILD_LEVELS, getUserLevel, getUserXpProgress,
  getQuestRarity,
} from "@/app/utils";
import {
  typeConfig,
  FLOORS, getFloorForRoom,
} from "@/app/config";
import type { Floor } from "@/app/config";
import { getAuthHeaders, setAccessToken } from "@/lib/auth-client";
import { useQuestActions } from "@/hooks/useQuestActions";
import professionsData from "@/public/data/professions.json";

const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4, companion: 1 };

// ─── Profession helpers ──────────────────────────────────────────────────────
const PROF_RANK_THRESHOLDS = [0, 100, 250, 450, 720, 1100, 1600, 2200, 3000, 4000];
const PROF_RANKS: { name: string; color: string }[] = [
  { name: "Novice", color: "#6b7280" },
  { name: "Apprentice", color: "#22c55e" },
  { name: "Journeyman", color: "#3b82f6" },
  { name: "Expert", color: "#a855f7" },
  { name: "Artisan", color: "#f59e0b" },
  { name: "Master", color: "#ef4444" },
];
function getProfRank(level: number) {
  if (level >= 9) return PROF_RANKS[5];  // Master
  if (level >= 7) return PROF_RANKS[4];  // Artisan
  if (level >= 5) return PROF_RANKS[3];  // Expert
  if (level >= 3) return PROF_RANKS[2];  // Journeyman
  if (level >= 1) return PROF_RANKS[1];  // Apprentice
  return PROF_RANKS[0];                  // Novice
}
const PROF_META: Record<string, { name: string; icon: string; color: string }> = {
  schmied: { name: "Blacksmith", icon: "/images/icons/prof-schmied.png", color: "#f59e0b" },
  alchemist: { name: "Alchemist", icon: "/images/icons/prof-alchemist.png", color: "#22c55e" },
  verzauberer: { name: "Enchanter", icon: "/images/icons/prof-verzauberer.png", color: "#a78bfa" },
  koch: { name: "Cook", icon: "/images/icons/prof-koch.png", color: "#e87b35" },
};
const MAT_RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};

const MAT_SOURCES: Record<string, string> = {
  common: "Common/Uncommon quest drops · Dismantling common gear",
  uncommon: "Uncommon/Rare quest drops · Dismantling uncommon gear",
  rare: "Rare/Epic quest drops · Dismantling rare gear",
  epic: "Epic/Legendary quest drops · Dismantling epic gear",
  legendary: "Legendary quest drops · Dismantling legendary gear",
};

// Suspense fallback for lazy-loaded views
const ViewFallback = () => <div className="flex items-center justify-center py-20 text-w30 text-sm font-mono">Loading...</div>;

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [quests, setQuests] = useState<QuestsData>({ open: [], inProgress: [], completed: [], suggested: [], rejected: [] });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [apiLive, setApiLive] = useState(false);
  const [dailyBonusAvailable, setDailyBonusAvailable] = useState(false);
  const [weeklyChallenge, setWeeklyChallenge] = useState<import("@/app/types").WeeklyChallenge | null>(null);
  const [expedition, setExpedition] = useState<import("@/app/types").Expedition | null>(null);
  const [socialBadge, setSocialBadge] = useState<{ pendingFriendRequests: number; unreadMessages: number; activeTrades: number } | null>(null);
  const [todayOpen, setTodayOpen] = useState(false);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [dailyMissions, setDailyMissions] = useState<{ missions: { id: string; label: string; points: number; done: boolean }[]; earned: number; total: number; milestones: { threshold: number; reward: Record<string, number>; claimed: boolean }[] } | null>(null);
  const [claimingDailyBonus, setClaimingDailyBonus] = useState(false);
  const [loginCalendarOpen, setLoginCalendarOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedSearch, setCompletedSearch] = useState("");
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [sortMode, setSortMode] = useState<"rarity" | "newest">("rarity");
  const [reviewApiKey, setReviewApiKey] = useState<string>(() => {
    try { return localStorage.getItem("dash_api_key") || ""; } catch { return ""; }
  });
  // selectedIds, bulkLoading, reviewComments moved to useQuestActions hook
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dashViewRaw, setDashViewRaw] = useState<"questBoard" | "npcBoard" | "klassenquests" | "character" | "campaign" | "leaderboard" | "honors" | "season" | "shop" | "forge" | "gacha" | "roadmap" | "changelog" | "challenges" | "rituals" | "vows" | "social" | "tavern" | "rift" | "factions" | "worldboss" | "dungeons">("questBoard");
  const [activeFloor, setActiveFloor] = useState("haupthalle");
  // Wrap setDashView to auto-sync the active floor
  const dashView = dashViewRaw;
  const setDashView = useCallback((view: typeof dashViewRaw) => {
    setDashViewRaw(view);
    const floor = getFloorForRoom(view);
    if (floor) setActiveFloor(floor.id);
  }, []);
  // Track seen content for notification dots (persists across renders via ref)
  const seenQuestIdsRef = useRef<Set<string>>(new Set());
  const seenNpcIdsRef = useRef<Set<string>>(new Set());
  // Trigger re-render when seen sets change
  const [seenVersion, setSeenVersion] = useState(0);
  const [createQuestOpen, setCreateQuestOpen] = useState(false);
  const [dobbieOpen, setDobbieOpen] = useState(false);
  // shopUserId moved to useQuestActions hook
  // Toast stack system (replaces individual toast states)
  const { toasts, addToast, removeToast } = useToastStack();
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
  const [highlightedAchievementId, setHighlightedAchievementId] = useState<string | null>(null);
  const navigateToAchievement = useCallback((achievementId: string) => {
    setDashView("honors");
    setHighlightedAchievementId(achievementId);
  }, [setDashView]);
  const [, setCampaigns] = useState<Campaign[]>([]);
  const [playerName, setPlayerName] = useState<string>(() => {
    try { return localStorage.getItem("dash_player_name") || ""; } catch { return ""; }
  });
  // Ref keeps the latest playerName available inside callbacks without stale closures.
  // This is the root fix for filter bugs after login on new devices / incognito.
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;
  const [guideOpen, setGuideOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [classesList, setClassesList] = useState<ClassDef[]>([]);
  const [classActivatedNotif, setClassActivatedNotif] = useState<{ className: string; classIcon: string; classDescription: string } | null>(null);
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [, setHabits] = useState<Habit[]>([]);
  const [lootDrop, setLootDrop] = useState<LootItem | null>(null);
  const [levelUpCelebration, setLevelUpCelebration] = useState<{ level: number; title: string } | null>(null);
  const [rewardCelebration, setRewardCelebration] = useState<RewardCelebrationData | null>(null);
  const { rewards: floatingRewards, addFloating, removeFloating } = useFloatingRewards();
  // questBoardTab removed — Rituals and Vows are now standalone views in Charakter-Turm
  const closeLootDrop = useCallback(() => setLootDrop(null), []);
  useModalBehavior(!!lootDrop, closeLootDrop);
  const closeLevelUp = useCallback(() => setLevelUpCelebration(null), []);
  useModalBehavior(!!levelUpCelebration, closeLevelUp);
  const pendingLevelUpRef = useRef<{ level: number; title: string } | null>(null);
  const closeRewardCelebration = useCallback(() => {
    setRewardCelebration(null);
    // Show queued level-up celebration after reward popup is dismissed
    if (pendingLevelUpRef.current) {
      const lu = pendingLevelUpRef.current;
      pendingLevelUpRef.current = null;
      setTimeout(() => { setLevelUpCelebration(lu); SFX.levelUp(); }, 200);
    }
  }, []);
  useModalBehavior(!!rewardCelebration, closeRewardCelebration);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  // poolRefreshing moved to useQuestActions hook
  const [lastPoolRefresh, setLastPoolRefresh] = useState<Date | null>(null);
  const [npcBoardFilter, setNpcBoardFilter] = useState<string | null>(null);
  const [activeNpcs, setActiveNpcs] = useState<ActiveNpc[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<ActiveNpc | null>(null);
  const [infoOverlayOpen, setInfoOverlayOpen] = useState(false);
  const [infoOverlayTab, setInfoOverlayTab] = useState<"roadmap" | "changelog" | "guide">("roadmap");
  const [questDetailModal, setQuestDetailModal] = useState<Quest | null>(null);
  const [currenciesOpen, setCurrenciesOpen] = useState(false);
  const [modifierOpen, setModifierOpen] = useState(false);
  const [streakInfoOpen, setStreakInfoOpen] = useState(false);
  const [activeQuestsInfoOpen, setActiveQuestsInfoOpen] = useState(false);
  const [xpInfoOpen, setXpInfoOpen] = useState(false);
  const [professionsInfoOpen, setProfessionsInfoOpen] = useState(false);
  const [currencyExpanded, setCurrencyExpanded] = useState<string | null>(null);
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [gameVersion, setGameVersion] = useState<string>("1.5.3");
  const [versionPopupOpen, setVersionPopupOpen] = useState(false);
  const [changelogData, setChangelogData] = useState<{ version: string; date: string; title: string; changes: string[] }[]>([]);
  const [changelogExpanded, setChangelogExpanded] = useState<string | null>(null);

  // Stat card info popups — ESC to close + scroll lock
  const closeStreakInfo = useCallback(() => setStreakInfoOpen(false), []);
  const closeActiveQuestsInfo = useCallback(() => setActiveQuestsInfoOpen(false), []);
  const closeXpInfo = useCallback(() => setXpInfoOpen(false), []);
  const closeModifier = useCallback(() => setModifierOpen(false), []);
  const closeProfessionsInfo = useCallback(() => setProfessionsInfoOpen(false), []);
  useModalBehavior(streakInfoOpen, closeStreakInfo);
  useModalBehavior(activeQuestsInfoOpen, closeActiveQuestsInfo);
  useModalBehavior(xpInfoOpen, closeXpInfo);
  useModalBehavior(modifierOpen, closeModifier);
  useModalBehavior(professionsInfoOpen, closeProfessionsInfo);

  // Currencies modal — ESC to close + scroll lock
  const closeCurrencies = useCallback(() => { setCurrenciesOpen(false); setCurrencyExpanded(null); }, []);
  useModalBehavior(currenciesOpen, closeCurrencies);

  // Quest detail modal — ESC to close + scroll lock
  const closeQuestDetailModal = useCallback(() => setQuestDetailModal(null), []);
  useModalBehavior(!!questDetailModal, closeQuestDetailModal);


  // ─── Notification dot logic: mark content as seen per tab visit ─────────
  // Compute "has new" before marking seen (so dots show on first render)
  const notifNewQuests = useMemo(() => {
    if (dashView === "questBoard") return false;
    return quests.open.some(q => !seenQuestIdsRef.current.has(q.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashView, quests.open, seenVersion]);
  const notifNewNpcs = useMemo(() => {
    if (dashView === "npcBoard") return false;
    return activeNpcs.some(n => !seenNpcIdsRef.current.has(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashView, activeNpcs, seenVersion]);
  // Mark content as seen when user visits a tab
  useEffect(() => {
    let changed = false;
    if (dashView === "questBoard") {
      for (const q of quests.open) {
        if (!seenQuestIdsRef.current.has(q.id)) { seenQuestIdsRef.current.add(q.id); changed = true; }
      }
    }
    if (dashView === "npcBoard") {
      for (const n of activeNpcs) {
        if (!seenNpcIdsRef.current.has(n.id)) { seenNpcIdsRef.current.add(n.id); changed = true; }
      }
    }
    if (changed) setSeenVersion(v => v + 1);
  }, [dashView, quests.open, activeNpcs]);

  // ─── New Version popup check ────────────────────────────────────────────
  const versionCheckedRef = useRef(false);
  useEffect(() => {
    if (!playerName || !reviewApiKey || !gameVersion || versionCheckedRef.current) return;
    versionCheckedRef.current = true;
    (async () => {
      try {
        const r = await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/seen-version`, { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
          const d = await r.json();
          if (d.lastSeenVersion !== gameVersion) {
            setVersionPopupOpen(true);
          }
        }
      } catch { /* ignore */ }
    })();
  }, [playerName, reviewApiKey, gameVersion]);

  const dismissVersionPopup = useCallback(async () => {
    setVersionPopupOpen(false);
    if (playerName && reviewApiKey) {
      try {
        await fetch(`/api/player/${encodeURIComponent(playerName.toLowerCase())}/seen-version`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
          body: JSON.stringify({ version: gameVersion }),
        });
      } catch { /* ignore */ }
    }
  }, [playerName, reviewApiKey, gameVersion]);

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
  const refresh = useCallback(async () => {
    // Read from ref so we always use the LATEST playerName, even if called
    // from a stale closure (e.g. right after login before React re-renders).
    const pName = playerNameRef.current;
    const statusOrder: Record<string, number> = { working: 0, online: 1, idle: 2, offline: 3 };
    const sortAgents = (a: Agent[]) => [...a].sort((x, y) => {
      if (x.id === "lyra") return -1;
      if (y.id === "lyra") return 1;
      return (statusOrder[x.status] ?? 3) - (statusOrder[y.status] ?? 3) || x.name.localeCompare(y.name);
    });

    // Try batch endpoint first (1 call instead of 14)
    const batch = await fetchDashboard(pName || undefined);
    if (batch && batch.quests && batch.agents) {
      setAgents(sortAgents(batch.agents || []));
      setQuests(batch.quests);
      setUsers(batch.users || []);
      const rawAchs = batch.achievements as AchievementDef[] | { achievements: AchievementDef[] } | undefined;
      const batchAchs = Array.isArray(rawAchs) ? rawAchs : rawAchs?.achievements;
      if (Array.isArray(batchAchs) && batchAchs.length > 0) setAchievementCatalogue(batchAchs);
      setCampaigns(batch.campaigns || []);
      setRituals(batch.rituals || []);
      setHabits(batch.habits || []);
      setFavorites(batch.favorites || []);
      setActiveNpcs(batch.activeNpcs || []);
      setApiLive(!!batch.apiLive);
      if (batch.dailyBonusAvailable !== undefined) setDailyBonusAvailable(!!batch.dailyBonusAvailable);
      if (batch.weeklyChallenge !== undefined) setWeeklyChallenge(batch.weeklyChallenge || null);
      if (batch.expedition !== undefined) setExpedition(batch.expedition || null);
      if (batch.socialSummary) setSocialBadge(batch.socialSummary);
      if (batch.dailyMissions) setDailyMissions(batch.dailyMissions);
    } else {
      // Fallback: individual fetches if batch endpoint not available
      const [a, q, u, lb, ac, camps] = await Promise.all([fetchAgents(), fetchQuests(pName || undefined), fetchUsers(), fetchLeaderboard(), fetchAchievementCatalogue(), fetchCampaigns()]);
      setAgents(sortAgents(a));
      setQuests(q);
      setUsers(u);
      if (lb.length > 0) setLeaderboard(lb);
      if (ac.achievements.length > 0) setAchievementCatalogue(ac.achievements);
      setCampaigns(camps);
      if (pName) {
        fetchRituals(pName).then(setRituals);
        fetchHabits(pName).then(setHabits);
      }
      try { const r = await fetch(`/api/health`, { signal: AbortSignal.timeout(1500) }); setApiLive(r.ok); } catch { setApiLive(false); }
      try {
        const npcUrl = pName ? `/api/npcs/active?player=${encodeURIComponent(pName.toLowerCase())}` : `/api/npcs/active`;
        const r = await fetch(npcUrl, { signal: AbortSignal.timeout(2000) });
        if (r.ok) { const d = await r.json(); setActiveNpcs(d.npcs || []); }
      } catch { /* ignore */ }
      if (pName) {
        try { const r = await fetch(`/api/player/${encodeURIComponent(pName.toLowerCase())}/favorites`, { signal: AbortSignal.timeout(2000) }); if (r.ok) { const d = await r.json(); setFavorites(d.favorites || []); } } catch { /* ignore */ }
      }
    }
    // These lightweight calls remain separate (rarely change, small payloads)
    try { const r = await fetch(`/api/game-version`, { signal: AbortSignal.timeout(1500) }); if (r.ok) { const d = await r.json(); setGameVersion(d.version || "1.5.1"); } } catch { /* ignore */ }
    try { const r = await fetch(`/api/changelog-data`, { signal: AbortSignal.timeout(2000) }); if (r.ok) { const d = await r.json(); if (Array.isArray(d)) setChangelogData(d); } } catch { /* ignore */ }
    if (pName) {
      try { const r = await fetch(`/api/quests/pool?player=${encodeURIComponent(pName)}`, { signal: AbortSignal.timeout(2000) }); if (r.ok) { const d = await r.json(); if (d.lastRefresh) setLastPoolRefresh(new Date(d.lastRefresh)); } } catch { /* ignore */ }
    }
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  // ─── Quest/Shop action handlers (extracted to hook) ─────────────────────────
  const {
    selectedIds, setSelectedIds,
    bulkLoading,
    reviewComments, setReviewComments,
    poolRefreshing,
    shopUserId, setShopUserId,
    handleApprove, handleReject, handleChangePriority,
    toggleSelect, handleBulkUpdate,
    handleToggleFavorite: _handleToggleFavorite,
    handleClaim, handleUnclaim, handleCoopClaim, handleCoopComplete,
    handleComplete, handleChainAccept: _handleChainAccept,
    handlePoolRefresh, handleShopBuy, handleGearBuy,
  } = useQuestActions({
    reviewApiKey, playerName, refresh,
    setActiveNpcs, setSelectedNpc,
    setChainOffer, setRewardCelebration,
    pendingLevelUpRef, setRituals,
    addToast, setApiErrorWithAutoClose,
    lastPoolRefresh, setLastPoolRefresh,
  });

  // Daily bonus claim
  const handleClaimDailyBonus = useCallback(async () => {
    if (!reviewApiKey || !playerName || claimingDailyBonus) return;
    setClaimingDailyBonus(true);
    try {
      const r = await fetch("/api/daily-bonus/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
        body: JSON.stringify({ player: playerName }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setDailyBonusAvailable(false);
        const currencies: { name: string; amount: number; color: string }[] = [];
        if (data.rewards?.essenz) currencies.push({ name: "Essenz", amount: data.rewards.essenz, color: "#ef4444" });
        if (data.rewards?.runensplitter) currencies.push({ name: "Runensplitter", amount: data.rewards.runensplitter, color: "#818cf8" });
        if (data.rewards?.sternentaler) currencies.push({ name: "Sternentaler", amount: data.rewards.sternentaler, color: "#fbbf24" });
        setRewardCelebration({
          type: "daily-bonus",
          title: "Daily Bonus Claimed!",
          flavor: data.milestone ? `${data.milestone.label} streak bonus!` : undefined,
          xpEarned: 0,
          goldEarned: 0,
          currencies,
        });
        refresh();
      } else {
        addToast({ type: "flavor", message: data.error || "Could not claim daily bonus", icon: "/images/icons/currency-essenz.png" });
      }
    } catch {
      addToast({ type: "flavor", message: "Network error", icon: "/images/icons/currency-essenz.png" });
    } finally {
      setClaimingDailyBonus(false);
    }
  }, [reviewApiKey, playerName, claimingDailyBonus, refresh, addToast, setRewardCelebration]);

  // Wrap handleToggleFavorite to also update local favorites state
  const handleToggleFavorite = useCallback(async (questId: string) => {
    const isFav = favorites.includes(questId);
    setFavorites(prev => isFav ? prev.filter(id => id !== questId) : [...prev, questId]);
    await _handleToggleFavorite(questId, favorites);
  }, [_handleToggleFavorite, favorites]);

  // Wrap handleChainAccept to pass chainOffer
  const handleChainAccept = useCallback(async () => {
    await _handleChainAccept(chainOffer);
  }, [_handleChainAccept, chainOffer]);

  // Wrap handleChangePriority to also update local quests state
  const handleChangePriorityWithState = useCallback(async (id: string, priority: Quest["priority"]) => {
    await handleChangePriority(id, priority);
    setQuests(prev => ({
      ...prev,
      suggested: prev.suggested.map(q => q.id === id ? { ...q, priority } : q),
    }));
  }, [handleChangePriority]);

  // Toast auto-dismiss is handled by ToastStack

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Re-fetch when playerName changes (login/logout) so filters apply correctly
  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName]);

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
          headers: { ...getAuthHeaders(reviewApiKey) },
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

  const needsAttention = useMemo(() => agents.filter((a) => a.health === "needs_checkin" || a.health === "broken").length, [agents]);

  // Player-specific stats (logged-in player)
  const playerNameLower = useMemo(() => (playerName || "").toLowerCase(), [playerName]);
  const loggedInUser = useMemo(() => playerName ? users.find(u => u.id.toLowerCase() === playerNameLower || u.name.toLowerCase() === playerNameLower) : null, [playerName, playerNameLower, users]);
  const currentPlayerLevel = useMemo(() => loggedInUser ? getUserLevel(loggedInUser.xp ?? 0).level : undefined, [loggedInUser]);

  const playerTypes = useMemo(() => ["personal", "learning", "fitness", "social", "relationship-coop"], []);
  const playerActiveQuests = useMemo(() => quests.inProgress.filter(q => playerTypes.includes(q.type ?? "") && q.claimedBy?.toLowerCase() === playerNameLower), [quests.inProgress, playerTypes, playerNameLower]);
  const playerCompletedQuests = useMemo(() => quests.completed.filter(q => playerTypes.includes(q.type ?? "") && q.completedBy?.toLowerCase() === playerNameLower), [quests.completed, playerTypes, playerNameLower]);
  // Use persistent counter from user record (survives rotation cleanup)
  const playerCompletedTotal = loggedInUser?.questsCompleted ?? playerCompletedQuests.length;

  // Level info for logged-in player
  const playerXp = loggedInUser?.xp ?? 0;
  const playerLevelInfo = useMemo(() => {
    const lvl = getUserLevel(playerXp);
    const progress = getUserXpProgress(playerXp);
    const nextEntry = GUILD_LEVELS[lvl.level]; // 1-based level → next entry
    return {
      level: lvl.level,
      title: lvl.title,
      xp: playerXp,
      nextXp: nextEntry?.xpRequired ?? null,
      progress,
      xpInLevel: nextEntry ? playerXp - lvl.xpRequired : 0,
      xpForLevel: nextEntry ? nextEntry.xpRequired - lvl.xpRequired : 0,
    };
  }, [playerXp]);
  const playerStreak = loggedInUser?.streakDays ?? 0;
  const playerGold = loggedInUser?.gold ?? 0;

  // Forge: derived from loggedInUser
  const forgeTemp = Math.min(loggedInUser?.forgeTemp ?? 0, 100);
  const { forgeTempLabel, forgeTempColor } = useMemo(() => ({
    forgeTempLabel: forgeTemp >= 100 ? "White-hot" : forgeTemp >= 80 ? "Blazing" : forgeTemp >= 60 ? "Burning" : forgeTemp >= 40 ? "Warming" : forgeTemp >= 20 ? "Smoldering" : "Cold",
    forgeTempColor: forgeTemp >= 100 ? "#e0f0ff" : forgeTemp >= 80 ? "#f97316" : forgeTemp >= 60 ? "#ea580c" : forgeTemp >= 40 ? "#b45309" : forgeTemp >= 20 ? "#78716c" : "#4b5563",
  }), [forgeTemp]);

  const playerActiveCount = playerActiveQuests.length;
  const playerCompletedCount = playerCompletedTotal;

  const openQuestsCount = useMemo(() => quests.open.filter(q => playerTypes.includes(q.type ?? "")).length, [quests.open, playerTypes]);

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
    if (typeFilter === "favorites") {
      result = result.filter(q => favorites.includes(q.id));
    } else if (typeFilter === "npc") {
      result = result.filter(q => !!q.npcGiverId);
    } else if (typeFilter !== "all") {
      result = result.filter(q => (q.type ?? "development") === typeFilter);
    }
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
  }, [searchFilter, typeFilter, playerName, users, favorites]);
  const applySort = useCallback((qs: Quest[]) => {
    const sorted = sortMode === "newest" ? qs : [...qs].sort((a, b) => (RARITY_ORDER[getQuestRarity(a)] ?? 4) - (RARITY_ORDER[getQuestRarity(b)] ?? 4));
    // Favorites always sort to top
    if (favorites.length === 0) return sorted;
    const favSet = new Set(favorites);
    return [...sorted].sort((a, b) => {
      const aFav = favSet.has(a.id) ? 0 : 1;
      const bFav = favSet.has(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [sortMode, favorites]);
  const isCompanionQuest = useCallback((q: Quest) => q.rarity === "companion" || (q.type as string) === "companion" || (q.createdBy ?? "").toLowerCase() === "dobbie" || (q.createdBy ?? "").toLowerCase() === "companion", []);
  const dobbieActiveQuests = useMemo(() => quests.inProgress.filter(q => isCompanionQuest(q) && (!playerNameLower || q.claimedBy?.toLowerCase() === playerNameLower || (q as Quest & { companionOwnerId?: string }).companionOwnerId?.toLowerCase() === playerNameLower)), [quests.inProgress, playerNameLower, isCompanionQuest]);

  const ctxValue = useMemo(() => ({
    playerName, reviewApiKey, isAdmin, loggedInUser: loggedInUser ?? null,
    users, quests, classesList, refresh,
  }), [playerName, reviewApiKey, isAdmin, loggedInUser, users, quests, classesList, refresh]);

  return (
    <DashboardProvider value={ctxValue}>
    <div className="min-h-screen text-primary" style={{ background: "transparent", position: "relative" }}>
      <GuildHallBackground />
      <DashboardHeader
        dashView={dashView}
        setDashView={(v) => setDashView(v as typeof dashView)}
        playerName={playerName}
        setPlayerName={setPlayerName}
        loggedInUser={loggedInUser ?? null}
        playerLevelInfo={playerLevelInfo}
        reviewApiKey={reviewApiKey}
        setReviewApiKey={setReviewApiKey}
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
        needsAttention={needsAttention}
        suggestedCount={quests.suggested.length}
        apiLive={apiLive}
        lastUpdatedStr={lastUpdatedStr}
        refresh={refresh}
        setOnboardingOpen={setOnboardingOpen}
        setInfoOverlayOpen={setInfoOverlayOpen}
        setInfoOverlayTab={setInfoOverlayTab}
        onTodayOpen={() => setTodayOpen(true)}
      />

      {!apiLive && !loading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6" style={{ position: "relative", zIndex: 3, marginTop: 8 }}>
          <div className="rounded-lg px-4 py-2 flex items-center gap-2 text-xs font-medium" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#ef4444" }} />
            Connection lost — showing cached data. Actions may not save.
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8" style={{ position: "relative", zIndex: 2, background: "rgba(11,13,17,0.75)", borderRadius: 16, backdropFilter: "blur(8px)", marginTop: 8 }}>
        {/* Stats — Player-specific */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3" data-tutorial="stat-cards">
          {!playerName && !loading && (
            <div className="col-span-1 sm:col-span-4 rounded-xl p-3 text-center" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
              <p className="text-xs text-w35">
                <button onClick={() => setOnboardingOpen(true)} className="underline" style={{ color: "#a78bfa" }}>Log in</button> to see your personal stats
              </p>
            </div>
          )}
          <div data-feedback-id="stats.forge-streak">
          <Tip k="streak"><StatBar
            label="Forge Streak"
            value={loading ? "—" : playerName ? `${animStreak}d` : "—"}
            sub={playerName ? (playerStreak > 0 ? `+${Math.min((playerStreak * 1.5), 45).toFixed(1)}% gold` : "your streak") : "login to view"}
            subColor={playerName && playerStreak > 0 ? "#fbbf24" : undefined}
            accent="#f97316"
            onClick={playerName ? () => setStreakInfoOpen(true) : undefined}
          /></Tip>
          </div>
          <div data-feedback-id="stats.quests">
          <Tip k="active_quests"><StatBar
            label="Quests"
            value={loading ? "—" : playerName ? `${animActive}` : "—"}
            value2={playerName ? `✓ ${animCompleted}` : undefined}
            value2Color="#22c55e"
            sub={playerName ? `active · ${openQuestsCount} open` : "login to view"}
            accent="#ef4444"
            onClick={playerName ? () => setActiveQuestsInfoOpen(true) : undefined}
            inline
          /></Tip>
          </div>
          <div data-feedback-id="stats.modifiers">
          <Tip k="modifiers"><StatBar
            label="Modifier"
            value={loading ? "—" : playerName && loggedInUser?.modifiers ? `XP ×${loggedInUser.modifiers.xp.total}` : "—"}
            value2={playerName && loggedInUser?.modifiers ? `◆ Gold ×${loggedInUser.modifiers.gold.total}` : undefined}
            value2Color="#fbbf24"
            sub={playerName ? "all active bonuses" : "login to view"}
            accent="#a855f7"
            onClick={loggedInUser?.modifiers ? () => setModifierOpen(true) : undefined}
            inline
          /></Tip>
          </div>
          <div data-feedback-id="stats.professions">
          {(() => {
            const profs = loggedInUser?.professions;
            const chosen = loggedInUser?.chosenProfessions ?? [];
            if (!playerName || !profs || chosen.length === 0) {
              return (
                <Tip k="artisans_quarter"><StatBar
                  label="Artisan"
                  value={loading ? "—" : playerName ? "—" : "—"}
                  sub={playerName ? "no professions yet" : "login to view"}
                  accent="#f59e0b"
                  onClick={playerName ? () => setProfessionsInfoOpen(true) : undefined}
                  inline
                /></Tip>
              );
            }
            const profSummary = chosen.map(pid => {
              const p = profs[pid as keyof typeof profs];
              const meta = PROF_META[pid];
              return { id: pid, level: p?.level ?? 0, name: meta?.name ?? pid, color: meta?.color ?? "#888" };
            });
            const mainValue = profSummary.map(p => `Lv.${p.level}`).join(" · ");
            const totalMats = Object.values(loggedInUser?.craftingMaterials ?? {}).reduce((a, b) => a + b, 0);
            return (
              <Tip k="artisans_quarter"><StatBar
                label="Artisan"
                value={loading ? "—" : mainValue}
                sub={`${totalMats} materials`}
                subColor="rgba(245,158,11,0.5)"
                accent="#f59e0b"
                onClick={() => setProfessionsInfoOpen(true)}
                inline
              /></Tip>
            );
          })()}
          </div>
        </div>

        {/* Player Card — shown when logged in */}
        {playerName && loggedInUser && (
          <div data-feedback-id="player-card" className={`rounded-xl p-4 bg-w3${levelUpCelebration ? " levelup-glow-header" : ""}`} style={{ border: "1px solid rgba(255,255,255,0.09)" }}>
            <div className="flex items-center gap-4">
              {/* Portrait */}
              <div data-feedback-id="player-card.portrait" className="relative flex-shrink-0 cursor-pointer" onClick={() => setDashView("character")} title="Character">
                <img
                  src="/images/portraits/hero-male.png"
                  alt={playerName}
                  className="w-28 h-28 rounded-xl object-cover img-render-auto"
                  style={{ border: `2px solid ${loggedInUser.color ?? "#a78bfa"}50` }}
                  onError={e => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.style.opacity = "0"; img.style.width = "0"; img.style.overflow = "hidden";
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
                  <p className="text-sm font-bold text-bright">{playerName}</p>
                  {loggedInUser.equippedTitle && (() => {
                    const titleColors: Record<string, string> = { common: "#9ca3af", uncommon: "#22c55e", rare: "#60a5fa", epic: "#a855f7", legendary: "#f97316" };
                    const tc = titleColors[loggedInUser.equippedTitle.rarity] ?? "#9ca3af";
                    return (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: tc, background: `${tc}15` }}>
                        {loggedInUser.equippedTitle.name}
                      </span>
                    );
                  })()}
                  {loggedInUser.classId && loggedInUser.classId !== "null" && (() => {
                    const cls = (classesList || []).find((c: ClassDef) => c.id === loggedInUser.classId);
                    return cls ? (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium text-w40 bg-w6 border-w10">
                        {cls.name}
                      </span>
                    ) : null;
                  })()}
                </div>
                <p className="text-xs mb-1.5" style={{ color: "#a78bfa" }}><Tip k="player_level">Lv.{playerLevelInfo.level}</Tip> · {playerLevelInfo.title}</p>
                {/* XP progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden bg-w7">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(playerLevelInfo.progress * 100).toFixed(1)}%`, background: "linear-gradient(90deg, #7c3aed, #a78bfa)" }}
                  />
                </div>
                <p className="text-xs mt-1 font-mono text-w20">
                  {playerLevelInfo.xpInLevel} {playerLevelInfo.xpForLevel ? `/ ${playerLevelInfo.xpForLevel} XP` : "(max)"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {dailyBonusAvailable && (
                    <button
                      onClick={handleClaimDailyBonus}
                      disabled={claimingDailyBonus}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5"
                      style={{
                        background: "linear-gradient(90deg, rgba(250,204,21,0.12), rgba(245,158,11,0.15))",
                        color: "#facc15",
                        border: "1px solid rgba(250,204,21,0.3)",
                        cursor: claimingDailyBonus ? "wait" : "pointer",
                        opacity: claimingDailyBonus ? 0.5 : 1,
                        animation: "pulse-online 2s ease-in-out infinite",
                      }}
                    >
                      <span>☀</span> {claimingDailyBonus ? "Claiming..." : "Claim Daily Bonus"}
                    </button>
                  )}
                  <button
                    onClick={() => setLoginCalendarOpen(true)}
                    className="px-2 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                    style={{
                      background: "rgba(251,191,36,0.06)",
                      color: "rgba(251,191,36,0.6)",
                      border: "1px solid rgba(251,191,36,0.15)",
                      cursor: "pointer",
                    }}
                  >
                    <Tip k="login_calendar">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
                        <rect x="1" y="3" width="14" height="12" rx="2" stroke="rgba(251,191,36,0.6)" strokeWidth="1.5" fill="rgba(251,191,36,0.06)" />
                        <path d="M1 7h14" stroke="rgba(251,191,36,0.3)" strokeWidth="1" />
                        <rect x="5" y="1" width="1.5" height="3.5" rx="0.75" fill="rgba(251,191,36,0.5)" />
                        <rect x="9.5" y="1" width="1.5" height="3.5" rx="0.75" fill="rgba(251,191,36,0.5)" />
                        <circle cx="5.5" cy="10.5" r="1" fill="rgba(251,191,36,0.5)" />
                        <circle cx="8" cy="10.5" r="1" fill="rgba(251,191,36,0.4)" />
                        <circle cx="10.5" cy="10.5" r="1" fill="rgba(251,191,36,0.3)" />
                      </svg>
                    </Tip>
                  </button>
                </div>
              </div>

              {/* Right side: Currencies + Forge */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {/* Currency bar */}
                <div className="flex items-center gap-3 rounded-xl px-3 py-2 bg-w4 border-w8">
                  {[
                    { emoji: "", key: "gold" as const, value: Number(loggedInUser?.currencies?.gold ?? animGold), color: "#f59e0b", iconSrc: "/images/icons/currency-gold.png" },
                    { emoji: "", key: "stardust" as const, value: Number(loggedInUser?.currencies?.stardust ?? 0), color: "#a78bfa", iconSrc: "/images/icons/currency-stardust.png" },
                    { emoji: "", key: "runensplitter" as const, value: Number(loggedInUser?.currencies?.runensplitter ?? 0), color: "#818cf8", iconSrc: "/images/icons/currency-runensplitter.png" },
                    { emoji: "", key: "essenz" as const, value: Number(loggedInUser?.currencies?.essenz ?? 0), color: "#ef4444", iconSrc: "/images/icons/currency-essenz.png" },
                    { emoji: "", key: "gildentaler" as const, value: Number(loggedInUser?.currencies?.gildentaler ?? 0), color: "#10b981", iconSrc: "/images/icons/currency-gildentaler.png" },
                    { emoji: "", key: "mondstaub" as const, value: Number(loggedInUser?.currencies?.mondstaub ?? 0), color: "#c084fc", iconSrc: "/images/icons/currency-mondstaub.png" },
                    { emoji: "", key: "sternentaler" as const, value: Number(loggedInUser?.currencies?.sternentaler ?? 0), color: "#fbbf24", iconSrc: "/images/icons/currency-sternentaler.png" },
                  ].map(c => (
                    <div key={c.key} className="flex items-center gap-1 cursor-pointer" onClick={() => setCurrenciesOpen(true)}>
                      <Tip k={c.key}>
                        {c.iconSrc ? <img src={c.iconSrc} alt="" width={16} height={16} className={`${c.key === "stardust" ? "premium-stardust" : c.key === "runensplitter" ? "premium-rune-shards" : ""} img-render-auto`} onError={(e) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /> : <span style={{ fontSize: 18 }}>{c.emoji}</span>}
                        <span className="text-base font-mono font-black" style={{ color: c.value > 0 ? c.color : "rgba(255,255,255,0.15)" }}>
                          {c.value}
                        </span>
                      </Tip>
                    </div>
                  ))}
                </div>

                {/* Forge Temperature */}
                <div data-feedback-id="player-card.forge-tooltip" className="relative">
                  <div className="flex items-center gap-1.5">
                    <img src="/images/icons/ach-forge-novice.png" alt="forge" width={35} height={35} className="img-render-auto" onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />
                    <Tip k="forge_temp">
                      <span className="text-xs font-medium" style={{ color: forgeTempColor }}>
                        {forgeTemp}%
                      </span>
                      <span className="text-xs font-medium" style={{ color: forgeTempColor }}>{forgeTempLabel}</span>
                    </Tip>
                  </div>
                  {/* Forge bar */}
                  <div className="mt-1 rounded-full overflow-hidden bg-w6" style={{ height: 3, width: 120 }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${forgeTemp}%`, background: `linear-gradient(90deg, ${forgeTempColor}80, ${forgeTempColor})`, boxShadow: forgeTemp > 60 ? `0 0 6px ${forgeTempColor}80` : "none" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Currencies, Modifier, and Stat Info Modals */}
        <DashboardModals
          loggedInUser={loggedInUser ?? null}
          animGold={animGold}
          forgeTemp={forgeTemp}
          forgeTempColor={forgeTempColor}
          forgeTempLabel={forgeTempLabel}
          openQuestsCount={openQuestsCount}
          currenciesOpen={currenciesOpen}
          setCurrenciesOpen={setCurrenciesOpen}
          currencyExpanded={currencyExpanded}
          setCurrencyExpanded={setCurrencyExpanded}
          modifierOpen={modifierOpen}
          setModifierOpen={setModifierOpen}
          streakInfoOpen={streakInfoOpen}
          setStreakInfoOpen={setStreakInfoOpen}
          activeQuestsInfoOpen={activeQuestsInfoOpen}
          setActiveQuestsInfoOpen={setActiveQuestsInfoOpen}
          xpInfoOpen={xpInfoOpen}
          setXpInfoOpen={setXpInfoOpen}
          inProgressCount={quests.inProgress.length}
        />

        {/* Professions Info Modal */}
        {professionsInfoOpen && loggedInUser && (() => {
          const profs = loggedInUser.professions;
          const chosen = loggedInUser.chosenProfessions ?? [];
          const mats = loggedInUser.craftingMaterials ?? {};
          const matDefs = professionsData.materials ?? [];
          return (
            <ModalPortal>
              <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} onClick={() => setProfessionsInfoOpen(false)}>
                <div className="absolute inset-0 modal-backdrop-blur" />
                <div className="relative rounded-2xl p-5 bg-surface border-w12" style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.7)", minWidth: 340, maxWidth: 440, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold" style={{ color: "#f59e0b" }}>Artisan&apos;s Quarter</h3>
                    <button onClick={() => setProfessionsInfoOpen(false)} className="btn-close">×</button>
                  </div>

                  {/* Chosen Professions */}
                  {chosen.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {chosen.map(pid => {
                        const p = profs?.[pid as keyof typeof profs];
                        const meta = PROF_META[pid];
                        const level = p?.level ?? 0;
                        const xp = p?.xp ?? 0;
                        const rank = getProfRank(level);
                        // Backend: level = i+1 when xp >= thresholds[i], so current = thresholds[level-1], next = thresholds[level]
                        const currentThreshold = level > 0 ? (PROF_RANK_THRESHOLDS[level - 1] ?? 0) : 0;
                        const nextThreshold = level < 10 ? (PROF_RANK_THRESHOLDS[level] ?? null) : null;
                        const xpInLevel = xp - currentThreshold;
                        const xpForLevel = nextThreshold != null ? nextThreshold - currentThreshold : 0;
                        return (
                          <div key={pid} className="rounded-xl px-3 py-2.5" style={{ background: `${meta?.color ?? "#888"}08`, border: `1px solid ${meta?.color ?? "#888"}25` }}>
                            <div className="flex items-center gap-2.5">
                              <img src={meta?.icon ?? ""} alt="" width={28} height={28} className="img-render-auto" onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold" style={{ color: meta?.color ?? "#888" }}>{meta?.name ?? pid}</span>
                                  <span className="text-xs font-semibold" style={{ color: rank.color }}>{rank.name}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>Lv.{level}/10</span>
                                  {nextThreshold != null && xpForLevel > 0 ? (
                                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>{xpInLevel}/{xpForLevel} XP</span>
                                  ) : level >= 10 ? (
                                    <span className="text-xs font-mono" style={{ color: "#f59e0b" }}>MAX</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            {/* XP progress bar */}
                            {nextThreshold != null && xpForLevel > 0 && (
                              <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((xpInLevel / xpForLevel) * 100, 100)}%`, background: meta?.color ?? "#888" }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-w30 mb-4">No professions chosen yet. Visit the Artisan&apos;s Quarter!</p>
                  )}

                  {/* Materials Inventory */}
                  <div className="mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Materials</p>
                    <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Earned from quest completions (scaled by rarity) and dismantling gear.</p>
                    {matDefs.length > 0 ? (
                      <div className="space-y-1">
                        {matDefs.map(m => {
                          const count = mats[m.id] ?? 0;
                          const rarColor = MAT_RARITY_COLORS[m.rarity] ?? "#9ca3af";
                          const source = MAT_SOURCES[m.rarity] ?? "Quest drops";
                          return (
                            <div key={m.id} className="rounded-lg px-2.5 py-1.5" style={{ background: count > 0 ? "rgba(255,255,255,0.03)" : "transparent", opacity: count > 0 ? 1 : 0.35 }}>
                              <div className="flex items-center gap-2">
                                <img src={m.icon} alt="" width={18} height={18} className="img-render-auto" onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs truncate block" style={{ color: rarColor }}>{m.name}</span>
                                </div>
                                <span className="text-xs font-mono font-bold" style={{ color: count > 0 ? "#f0f0f0" : "rgba(255,255,255,0.2)" }}>{count}</span>
                              </div>
                              <p className="text-xs mt-0.5 pl-[26px]" style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>{source}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-w20">No material data available.</p>
                    )}
                  </div>

                  {/* Navigate to forge */}
                  <button
                    onClick={() => { setProfessionsInfoOpen(false); setDashView("forge"); }}
                    className="w-full mt-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
                  >
                    Open Artisan&apos;s Quarter
                  </button>
                </div>
              </div>
            </ModalPortal>
          );
        })()}

        {/* ── Stockwerk-Navigation (2-level: Floor tabs + Room tabs) ── */}
        {(() => {
          const currentFloor = FLOORS.find(f => f.id === activeFloor) || FLOORS[1];
          const visibleRooms = currentFloor.rooms.filter(r => !r.requiresLogin || playerName);
          // Notification dots per room
          const socialTotal = socialBadge ? (socialBadge.pendingFriendRequests + socialBadge.unreadMessages + socialBadge.activeTrades) : 0;
          const getRoomNotif = (key: string) => {
            if (dashView === key) return null;
            if (key === "questBoard" && notifNewQuests) return "#4ade80";
            if (key === "npcBoard" && notifNewNpcs) return "#f59e0b";
            if (key === "social" && socialTotal > 0) return "#a855f7";
            return null;
          };
          // Check if a floor has any notification
          const floorHasNotif = (floor: Floor) => floor.rooms.some(r => getRoomNotif(r.key) !== null);

          return (
            <div data-tutorial="nav-bar" className="space-y-0">
              {/* Floor tabs */}
              <div className="flex gap-1" style={{ background: "#0d0d0d", borderRadius: "10px 10px 0 0", padding: "4px 4px 0 4px" }}>
                {FLOORS.map(floor => {
                  const isActive = floor.id === activeFloor;
                  const hasNotif = !isActive && floorHasNotif(floor);
                  return (
                    <button
                      key={floor.id}
                      data-feedback-id={`nav.floor.${floor.id}`}
                      onClick={() => {
                        setActiveFloor(floor.id);
                        // Navigate to first visible room if current view isn't on this floor
                        const floorRoomKeys = floor.rooms.filter(r => !r.requiresLogin || playerName).map(r => r.key);
                        if (!floorRoomKeys.includes(dashView)) {
                          setDashView(floorRoomKeys[0] as typeof dashView);
                        }
                      }}
                      className="btn-interactive text-sm font-bold px-4 py-2 rounded-t-lg transition-all inline-flex items-center gap-1.5 relative"
                      style={{
                        background: isActive ? "#111" : "transparent",
                        color: isActive ? floor.color : "rgba(255,255,255,0.3)",
                        borderBottom: isActive ? "none" : "1px solid rgba(255,255,255,0.06)",
                        letterSpacing: "0.03em",
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{floor.icon}</span>
                      <span className="hidden sm:inline">{floor.name}</span>
                      {hasNotif && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full badge-enter" style={{ background: "#4ade80", boxShadow: "0 0 4px #4ade80" }} />}
                      {floor.id === "breakaway" && socialTotal > 0 && !isActive && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-xs font-bold badge-enter" style={{ background: "#a855f7", color: "#fff", fontSize: 12, padding: "0 4px", boxShadow: "0 0 6px rgba(168,85,247,0.4)" }}>
                          {socialTotal}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Floor header banner */}
              <div className="floor-banner relative overflow-hidden" style={{ background: currentFloor.gradient, borderRadius: 0, height: 200 }}>
                {/* Banner background image (right-aligned, 792x200) with left fade-out via mask */}
                {currentFloor.banner && (
                  <img
                    src={currentFloor.banner}
                    alt=""
                    className="absolute top-0 right-0 h-full w-auto max-w-none pointer-events-none img-render-auto"
                    style={currentFloor.id === "breakaway" ? {} : { maskImage: "linear-gradient(to right, transparent 0%, black 30%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 30%)" }}
                    onError={e => { e.currentTarget.style.display = "none"; }}
                  />
                )}
                {/* Gradient overlay (floor color, fades out quickly to the right so image shows through) */}
                <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${currentFloor.color}cc 0%, ${currentFloor.color}55 25%, transparent 50%)` }} />
                {/* Dark scrim for text legibility (left-heavy) */}
                <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 30%, transparent 50%)" }} />
                {/* Text */}
                <div className="absolute bottom-5 left-5 z-10">
                  <span className="text-base font-black uppercase tracking-widest" style={{ color: currentFloor.color, textShadow: `0 1px 12px rgba(0,0,0,0.8), 0 0 20px ${currentFloor.color}30` }}>{currentFloor.name}</span>
                  <span className="text-sm ml-2.5 font-semibold" style={{ color: "rgba(255,255,255,0.65)", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>— {currentFloor.subtitle}</span>
                </div>
                {/* Decorative overlay pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 11px)" }} />
                {/* Ambient particles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {Array.from({ length: 12 }, (_, i) => {
                    const seed = i * 137.5;
                    const left = `${(seed % 100)}%`;
                    const top = `${((seed * 2.3) % 80) + 10}%`;
                    const delay = `${(i * 0.7) % 5}s`;
                    const size = 2 + (i % 3) * 1.5;

                    if (currentFloor.id === "turmspitze") {
                      // Gold sparkles drifting
                      return <div key={i} className="banner-particle" style={{
                        left, top, width: size, height: size,
                        background: i % 3 === 0 ? "#fbbf24" : "#fff8dc",
                        boxShadow: `0 0 ${4 + i % 3}px #fbbf2480`,
                        animation: `banner-sparkle ${4 + (i % 3)}s ease-in-out ${delay} infinite`,
                        "--dx1": `${Math.cos(i) * 20}px`, "--dy1": `${Math.sin(i) * -15}px`,
                        "--dx2": `${Math.cos(i + 1) * 40}px`, "--dy2": `${Math.sin(i + 1) * -30}px`,
                        "--dx3": `${Math.cos(i + 2) * 55}px`, "--dy3": `${Math.sin(i + 2) * -40}px`,
                      } as React.CSSProperties} />;
                    }
                    if (currentFloor.id === "haupthalle") {
                      // Rising embers
                      return <div key={i} className="banner-particle" style={{
                        left, bottom: `${(i * 7) % 20}%`, top: "auto",
                        width: size * 0.8, height: size * 0.8,
                        background: i % 2 === 0 ? "#ff6a00" : "#ffa040",
                        boxShadow: `0 0 ${3 + i % 2}px #ff6a0060`,
                        borderRadius: "50%",
                        animation: `banner-float-up ${5 + (i % 4)}s ease-out ${delay} infinite`,
                      }} />;
                    }
                    if (currentFloor.id === "gewerbeviertel") {
                      // Purple magic dust
                      return <div key={i} className="banner-particle" style={{
                        left, top, width: size, height: size,
                        background: i % 2 === 0 ? "#c084fc" : "#e0b0ff",
                        boxShadow: `0 0 ${4 + i % 2}px #a855f760`,
                        animation: `banner-drift ${6 + (i % 3)}s ease-in-out ${delay} infinite`,
                        "--drift-x": `${Math.sin(i * 0.8) * 50}px`,
                        "--drift-y": `${-20 - (i % 4) * 10}px`,
                      } as React.CSSProperties} />;
                    }
                    if (currentFloor.id === "charakterturm") {
                      // Blue crystal motes
                      return <div key={i} className="banner-particle" style={{
                        left, top, width: size, height: size,
                        background: i % 3 === 0 ? "#60a5fa" : "#93c5fd",
                        boxShadow: `0 0 ${5 + i % 2}px #3b82f650`,
                        animation: `banner-drift ${7 + (i % 3)}s ease-in-out ${delay} infinite`,
                        "--drift-x": `${Math.cos(i * 1.2) * 35}px`,
                        "--drift-y": `${Math.sin(i * 0.9) * -25}px`,
                      } as React.CSSProperties} />;
                    }
                    // Breakaway — warm fireflies
                    return <div key={i} className="banner-particle" style={{
                      left, top, width: size + 1, height: size + 1,
                      background: i % 2 === 0 ? "#fde68a" : "#fbbf24",
                      boxShadow: `0 0 ${6 + i % 3}px #fbbf2480`,
                      animation: `banner-firefly ${5 + (i % 4)}s ease-in-out ${delay} infinite`,
                      "--ff1x": `${Math.cos(i) * 25}px`, "--ff1y": `${Math.sin(i) * -15}px`,
                      "--ff2x": `${Math.cos(i + 2) * 40}px`, "--ff2y": `${Math.sin(i + 2) * 10}px`,
                      "--ff3x": `${Math.cos(i + 4) * 50}px`, "--ff3y": `${Math.sin(i + 4) * -20}px`,
                    } as React.CSSProperties} />;
                  })}
                </div>
              </div>

              {/* Room tabs */}
              <div className="flex gap-1 flex-wrap" style={{ background: "#111", borderRadius: "0 0 10px 10px", padding: "4px" }}>
                {visibleRooms.map(room => {
                  const isActive = dashView === room.key;
                  const notifDot = getRoomNotif(room.key);
                  const seasonLabel = room.key === "season" ? `${CURRENT_SEASON.name} Season` : room.label;
                  return (
                    <button
                      key={room.key}
                      data-feedback-id={`nav.tab.${room.key}`}
                      onClick={() => setDashView(room.key as typeof dashView)}
                      className="btn-interactive text-sm font-semibold px-3 py-1.5 rounded transition-all inline-flex items-center gap-1.5 relative"
                      style={{
                        background: isActive ? "#252525" : "transparent",
                        color: isActive ? "#f0f0f0" : "rgba(255,255,255,0.3)",
                      }}
                      {...(room.tutorialKey ? { "data-tutorial": room.tutorialKey } : {})}
                    >
                      {room.iconSrc && <img src={room.iconSrc} alt="" width={24} height={24} className={`${room.key === "gacha" ? "vault-nav-glow" : ""} img-render-auto`} style={{ opacity: isActive ? 1 : 0.5 }} onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />}
                      {seasonLabel}
                      {notifDot && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: notifDot, boxShadow: `0 0 4px ${notifDot}` }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* The Proving Grounds — Leaderboard + Player Cards */}
        {dashView === "leaderboard" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Tip k="proving_grounds" heading><span className="text-xs font-semibold uppercase tracking-widest text-w35">The Proving Grounds</span></Tip>
            </div>
            {/* Player cards */}
            {users.filter(u => !agents.some(a => a.id === u.id)).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-3 text-w25">Adventurers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {users.filter(u => !agents.some(a => a.id === u.id)).map(u => <UserCard key={u.id} user={u} classes={classesList} onClick={() => setProfilePlayerId(u.id)} />)}
                </div>
              </div>
            )}
            <ErrorBoundary><Suspense fallback={<ViewFallback />}><LeaderboardView entries={leaderboard} agents={agents} mode="players" onOpenProfile={id => setProfilePlayerId(id)} /></Suspense></ErrorBoundary>
          </div>
        )}

        {/* Honors View — Player-specific */}
        {dashView === "honors" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><HonorsView catalogue={achievementCatalogue} highlightedAchievementId={highlightedAchievementId} onHighlightClear={() => setHighlightedAchievementId(null)} /></Suspense></ErrorBoundary>
        )}

        {/* Campaign View */}
        {dashView === "campaign" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Tip k="campaigns" heading><span className="text-xs font-semibold uppercase tracking-widest text-w35">The Observatory</span></Tip>
            </div>
            <div className="rounded-xl px-6 py-16 text-center border-w6" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-lg font-bold mb-2 text-w25">Coming Soon</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>The Observatory will open soon. Watch for the stars.</p>
            </div>
          </div>
        )}

        {/* Factions — Die Vier Zirkel */}
        {dashView === "factions" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><FactionsView onRewardCelebration={setRewardCelebration} /></Suspense></ErrorBoundary>
        )}

        {/* Season Pass (Battle Pass) */}
        {dashView === "season" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><BattlePassView onRewardCelebration={setRewardCelebration} /></Suspense></ErrorBoundary>
        )}

        {/* World Boss — The Colosseum */}
        {dashView === "worldboss" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><WorldBossView onRewardCelebration={setRewardCelebration} /></Suspense></ErrorBoundary>
        )}

        {/* ── DUNGEONS — The Undercroft ── */}
        {dashView === "dungeons" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><DungeonView onRefresh={refresh} onRewardCelebration={setRewardCelebration} /></Suspense></ErrorBoundary>
        )}

        {/* ── SHOP TAB ── */}
        {dashView === "shop" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><ShopView
            onBuy={handleShopBuy}
            onGearBuy={handleGearBuy}
          /></Suspense></ErrorBoundary>
        )}

        {/* ── FORGE TAB ── */}
        {dashView === "forge" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><ForgeView onRefresh={refresh} onNavigate={(tab: string) => setDashView(tab as typeof dashView)} /></Suspense></ErrorBoundary>
        )}

        {/* ── VAULT OF FATE (GACHA) TAB ── */}
        {dashView === "gacha" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><GachaView
            onRefresh={refresh}
            onPullComplete={(items) => { items.forEach((item: { item?: { name?: string; icon?: string; rarity?: string } }, i: number) => { setTimeout(() => addToast({ type: "flavor", message: `${item.item?.name || "Item"} collected!`, icon: item.item?.icon || "/images/icons/vault-of-fate.png", sub: item.item?.rarity || "common" }), i * 50); }); }}
          /></Suspense></ErrorBoundary>
        )}

        {/* ── CHALLENGES TAB ── */}
        {dashView === "challenges" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><ChallengesView
            weeklyChallenge={weeklyChallenge}
            expedition={expedition}
            onRefresh={refresh}
            onRewardCelebration={setRewardCelebration}
          /></Suspense></ErrorBoundary>
        )}

        {/* ── THE RIFT (Dungeon System) ── */}
        {dashView === "rift" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><RiftView onRefresh={refresh} onRewardCelebration={setRewardCelebration} /></Suspense></ErrorBoundary>
        )}

        {/* ── ROADMAP TAB ── */}
        {dashView === "roadmap" && (
          <RoadmapView />
        )}

        {/* ── CHANGELOG TAB ── */}
        {dashView === "changelog" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-w35">Changelog</span>
              <span className="text-xs text-w20">— recent commits from GitHub</span>
            </div>
            {changelogLoading && (
              <div className="text-sm text-w30">Loading commits…</div>
            )}
            {!changelogLoading && changelog.length === 0 && (
              <div className="text-sm text-w25">No changelog data available.</div>
            )}
            {changelog.map(entry => (
              <div key={entry.date} className="space-y-1.5">
                <div
                  className="text-xs font-semibold uppercase tracking-widest pt-2 pb-1 text-w35"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
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
                      <span className="text-sm flex-1 leading-snug text-w70">
                        {c.message}
                      </span>
                      {c.sha && (
                        c.url ? (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono shrink-0 text-w20"
                            style={{ textDecoration: "none" }}
                            title={`View commit ${c.sha}`}
                          >
                            {c.sha}
                          </a>
                        ) : (
                          <span className="text-xs font-mono shrink-0 text-w20">{c.sha}</span>
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
          const playerVisibleInProgress = applySort(applyFilter(quests.inProgress.filter(q => playerQuestTypes.includes(q.type ?? "") && !isCompanionQuest(q) && (!playerNameLower || q.claimedBy?.toLowerCase() === playerNameLower))));
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
          const boardOpen = applySort(levelFiltered);
          return (
            <div>

              {/* Companions Widget — full experience in the Great Hall */}
              {playerName && (
                <div className="mb-5" style={{ minHeight: 100 }}>
                  <CompanionsWidget user={loggedInUser} streak={playerStreak} playerName={playerName} apiKey={reviewApiKey} onDobbieClick={() => { setDashView("npcBoard"); setNpcBoardFilter(null); }} onUserRefresh={refresh} dobbieQuests={dobbieActiveQuests} onRewardCelebration={setRewardCelebration} />
                </div>
              )}

              {/* Quest Board — player types only */}
              <div>
                <aside className="w-full">
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Tip k="quest_board" heading><h2 className="text-xs font-semibold uppercase tracking-widest text-w40">Quest Board</h2></Tip>
                        </div>
                        <p className="text-xs mt-0.5 text-w25">
                          {playerName
                            ? `${boardOpen.length + playerVisibleInProgress.length} active quests`
                            : "Log in · 0 available"}
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
                            className={`btn-interactive px-2 py-1 rounded${(() => { const ready = !poolRefreshing && (!lastPoolRefresh || Date.now() - lastPoolRefresh.getTime() >= 6 * 3600 * 1000); return poolRefreshing ? "" : ready ? " quest-refresh-ready" : " quest-refresh-cooldown"; })()}`}
                            style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)", opacity: poolRefreshing ? 0.6 : 1 }}
                          >
                            <TipCustom title="Refresh Quest Pool" icon="🔄" accent="#22c55e" body={<p>Refreshes the available quest pool. Limited to once every 6 hours.</p>}>
                              {poolRefreshing ? (
                                <span className="text-sm">—</span>
                              ) : (
                                <img src="/images/icons/ui-quest-scroll.png" alt="" width={24} height={24} className="img-render-auto" onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />
                              )}
                            </TipCustom>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Daily Missions Panel */}
                  {dailyMissions && playerName && (
                    <div id="daily-missions-section" className="rounded-xl p-3 mb-3" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.04) 100%)", border: "1px solid rgba(99,102,241,0.15)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <Tip k="daily_missions" heading><span className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(99,102,241,0.7)", cursor: "help" }}>Daily Missions</span></Tip>
                        <span className="text-xs font-mono font-bold" style={{ color: dailyMissions.earned >= dailyMissions.total ? "#4ade80" : "#818cf8" }}>
                          {dailyMissions.earned}/{dailyMissions.total}
                        </span>
                      </div>
                      {/* Milestone reward track */}
                      <div className="relative mb-3">
                        <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (dailyMissions.earned / dailyMissions.total) * 100)}%`, background: "linear-gradient(90deg, #818cf8, #a78bfa)" }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          {dailyMissions.milestones.map(ms => {
                            const reached = dailyMissions.earned >= ms.threshold;
                            const pct = (ms.threshold / dailyMissions.total) * 100;
                            return (
                              <div key={ms.threshold} className="relative" style={{ left: `${pct - 50/(dailyMissions.milestones.length)}%` }}>
                                {reached && !ms.claimed ? (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const { getAuthHeaders } = await import("@/lib/auth-client");
                                        const r = await fetch("/api/daily-missions/claim", {
                                          method: "POST",
                                          headers: { ...getAuthHeaders(reviewApiKey!), "Content-Type": "application/json" },
                                          body: JSON.stringify({ threshold: ms.threshold }),
                                        });
                                        if (r.ok) {
                                          const data = await r.json();
                                          const rewardText = Object.entries(data.reward || ms.reward).map(([k, v]) => `+${v} ${k[0].toUpperCase() + k.slice(1)}`).join(", ");
                                          addToast({ type: "flavor", message: `Milestone ${ms.threshold} claimed! ${rewardText}`, icon: "/images/icons/currency-gold.png" });
                                          refresh();
                                        }
                                      } catch { /* ignore */ }
                                    }}
                                    className="btn-interactive text-xs px-1.5 py-0.5 rounded font-bold badge-enter"
                                    style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
                                    title={Object.entries(ms.reward).map(([k, v]) => `+${v} ${k}`).join(", ")}
                                  >
                                    {ms.threshold}
                                  </button>
                                ) : (
                                  <span className="text-xs font-mono px-1" style={{ color: ms.claimed ? "#4ade80" : reached ? "#818cf8" : "rgba(255,255,255,0.15)" }}>
                                    {ms.claimed ? "✓" : ms.threshold}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {/* Mission list — compact */}
                      <div className="flex flex-wrap gap-1.5">
                        {dailyMissions.missions.map(m => (
                          <span key={m.id} className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1" style={{
                            background: m.done ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.03)",
                            color: m.done ? "#4ade80" : "rgba(255,255,255,0.3)",
                            border: `1px solid ${m.done ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)"}`,
                            textDecoration: m.done ? "line-through" : "none",
                          }}>
                            {m.done ? "✓" : "○"} {m.label} <span className="font-mono" style={{ color: m.done ? "rgba(74,222,128,0.5)" : "rgba(255,255,255,0.15)" }}>+{m.points}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div data-feedback-id="quest-board" className="space-y-2">
                    {/* Category filters — Quest Board only */}
                    <div data-feedback-id="quest-board.filters" className="flex gap-1 flex-wrap mb-2" data-tutorial="quest-filters">
                      {(["all", "favorites", "personal", "learning", "fitness", "social", "relationship-coop", "npc"] as const).map(t => {
                        const cfg = t === "all" || t === "npc" || t === "favorites" ? null : typeConfig[t];
                        const isActive = typeFilter === t;
                        const iconFile = t === "relationship-coop" ? "coop" : t;
                        const npcStyle = t === "npc" ? { color: "#e879f9", bg: "rgba(232,121,249,0.1)", border: "rgba(232,121,249,0.3)" } : null;
                        const favStyle = t === "favorites" ? { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)" } : null;
                        return (
                          <button key={t} onClick={() => setTypeFilter(t)} className="btn-interactive text-sm px-2 py-0.5 rounded inline-flex items-center gap-1.5"
                            style={{ background: isActive ? (cfg ? cfg.bg : npcStyle ? npcStyle.bg : favStyle ? favStyle.bg : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.03)", color: isActive ? (cfg ? cfg.color : npcStyle ? npcStyle.color : favStyle ? favStyle.color : "#e8e8e8") : "rgba(255,255,255,0.3)", border: `1px solid ${isActive ? (cfg ? cfg.border : npcStyle ? npcStyle.border : favStyle ? favStyle.border : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.07)"}` }}>
                            {t === "all" ? "All" : t === "favorites" ? (<><span style={{ fontSize: 14 }}>&#9733;</span> Favorites</>) : t === "npc" ? (
                              <>
                                <img src="/images/icons/cat-npc.png" alt="" width={28} height={28}
                                  className="img-render-auto"
                                  onError={(e) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />
                                NPC
                              </>
                            ) : (
                              <>
                                <img src={`/images/icons/cat-${iconFile}.png`} alt="" width={28} height={28}
                                  className="img-render-auto"
                                  onError={(e) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; const next = t.nextElementSibling as HTMLElement; if (next) next.style.display = "inline"; }} />
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
                      <input data-feedback-id="quest-board.search" type="text" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Search quests…" className="flex-1 text-xs px-2 py-1.5 rounded input-dark border-w8" />
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
                        className="text-xs px-2 py-1.5 rounded shrink-0 bg-w4 text-w25 border-w7"

                        title="Collapse / Expand All"
                      >
                        {openSectionCollapsed && inProgressSectionCollapsed ? "⊞" : "⊟"}
                      </button>
                    </div>
                    {!playerName && !loading ? (
                      <div className="rounded-xl p-8 text-center bg-card border-w6">
                        <p className="text-base mb-2">×</p>
                        <p className="text-sm font-semibold mb-1 text-w50">Log in to view your quests</p>
                        <p className="text-xs mb-3 text-w25">Your personal quest pool awaits!</p>
                        <button onClick={() => setOnboardingOpen(true)} className="text-xs px-4 py-1.5 rounded font-semibold" style={{ background: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.4)" }}>
                          Login
                        </button>
                      </div>
                    ) :
                    loading ? [1,2,3].map(i => <div key={i} className="h-20 rounded-lg animate-pulse bg-card" style={{ border: "1px solid rgba(255,255,255,0.05)" }} />) :
                    boardOpen.length === 0 && playerVisibleInProgress.length === 0 ? (
                      <div className="rounded-xl p-5 text-center bg-card border-w6">
                        <p className="text-xs text-w20">{searchFilter ? `No quests match "${searchFilter}"` : "No player quests open"}</p>
                        {searchFilter && <button onClick={() => setSearchFilter("")} className="btn-interactive mt-2 text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>Clear Search</button>}
                        {!searchFilter && playerName && reviewApiKey && <button onClick={handlePoolRefresh} className="btn-interactive mt-2 px-3 py-1 rounded inline-flex items-center gap-1.5" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}><img src="/images/icons/ui-quest-scroll.png" alt="" width={20} height={20} className="img-render-auto" onError={e => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} /><span className="text-xs font-semibold">Load Quests</span></button>}
                      </div>
                    ) : (
                      <>
                        {playerVisibleInProgress.length > 0 && (
                          <>
                            <button data-feedback-id="quest-board.in-progress" onClick={() => { const next = !inProgressSectionCollapsed; setInProgressSectionCollapsed(next); try { localStorage.setItem("qb_inprogress_collapsed", String(next)); } catch { /* ignore */ } }} className="flex items-center gap-2 w-full text-left pt-1 pb-0.5">
                              <span className="text-sm uppercase tracking-widest px-3 py-1 rounded-md" style={{ color: "#a78bfa", background: "linear-gradient(90deg, rgba(139,92,246,0.18), rgba(139,92,246,0.1) 60%, transparent 100%)", minWidth: 180 }}>In Progress</span>
                              <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold relative group" style={{ background: playerVisibleInProgress.length >= 20 ? "rgba(239,68,68,0.18)" : "rgba(139,92,246,0.18)", color: playerVisibleInProgress.length >= 20 ? "#ef4444" : "#a78bfa", border: playerVisibleInProgress.length >= 20 ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(139,92,246,0.3)" }}>{playerVisibleInProgress.length}{playerVisibleInProgress.length > 20 && <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity z-50" style={{ background: "#1c1c1c", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>Too many quests in progress! XP malus: -{playerVisibleInProgress.length >= 30 ? 80 : Math.min(50, (playerVisibleInProgress.length - 20) * 10)}%</span>}</span>
                              <span className="ml-auto text-xs text-w25">{inProgressSectionCollapsed ? "▼" : "▲"}</span>
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
                                        onDetails={setQuestDetailModal}
                                        isFavorite={favorites.includes(q.id)} onToggleFavorite={reviewApiKey && playerName ? handleToggleFavorite : undefined} />
                                )}
                              </div>
                            )}
                          </>
                        )}
                        {boardOpen.length > 0 && (
                          <>
                            {playerVisibleInProgress.length > 0 && (
                              <div className="flex items-center gap-3 my-4">
                                <div className="flex-1" style={{ height: 2, background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.35), rgba(148,163,184,0.25), transparent)" }} />
                                <span className="text-xs font-mono uppercase tracking-widest text-w20" style={{ fontSize: 12 }}>◆</span>
                                <div className="flex-1" style={{ height: 2, background: "linear-gradient(90deg, transparent, rgba(148,163,184,0.25), rgba(167,139,250,0.35), transparent)" }} />
                              </div>
                            )}
                            <button data-feedback-id="quest-board.open" onClick={() => { const next = !openSectionCollapsed; setOpenSectionCollapsed(next); try { localStorage.setItem("qb_open_collapsed", String(next)); } catch { /* ignore */ } }} className="flex items-center gap-2 w-full text-left pt-1 pb-0.5">
                              <span className="text-sm uppercase tracking-widest px-3 py-1 rounded-md" style={{ color: "#94a3b8", background: "linear-gradient(90deg, rgba(148,163,184,0.15), rgba(148,163,184,0.08) 60%, transparent 100%)", minWidth: 180 }}>Open</span>
                              <span className="ml-auto text-xs text-w25">{openSectionCollapsed ? "▼" : "▲"}</span>
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
                                        onDetails={setQuestDetailModal}
                                        isFavorite={favorites.includes(q.id)} onToggleFavorite={reviewApiKey && playerName ? handleToggleFavorite : undefined} /></div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                  </div>

                </aside>

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
              <Tip k="classes" heading><h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#60a5fa" }}>The Arcanum</h2></Tip>
            </div>
            <div className="rounded-xl px-6 py-16 text-center border-w6" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-lg font-bold mb-2 text-w25">Coming Soon</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>The Arcanum gathers its scrolls. Class quests and skill trees coming soon.</p>
            </div>
          </div>
        )}

        {/* ── CHARACTER TAB ── */}
        {dashView === "character" && playerName && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><CharacterView addToast={addToast} onNavigate={(tab: string) => setDashView(tab as typeof dashView)} /></Suspense></ErrorBoundary>
        )}

        {/* ── RITUAL CHAMBER (standalone view) ── */}
        {dashView === "rituals" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><RitualChamber rituals={rituals} setRituals={setRituals} setRewardCelebration={setRewardCelebration} /></Suspense></ErrorBoundary>
        )}

        {/* ── VOW SHRINE (standalone view) ── */}
        {dashView === "vows" && (
          <div data-feedback-id="vow-shrine">
            <AntiRitualePanel onRewardCelebration={setRewardCelebration} />
          </div>
        )}

        {/* ── THE BREAKAWAY (Social & Trade) ── */}
        {dashView === "social" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><SocialView /></Suspense></ErrorBoundary>
        )}

        {/* ── THE HEARTH (Tavern / Rest Mode) ── */}
        {dashView === "tavern" && (
          <ErrorBoundary><Suspense fallback={<ViewFallback />}><TavernView onRefresh={refresh} /></Suspense></ErrorBoundary>
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
              handleChangePriority={handleChangePriorityWithState}
              reviewComments={reviewComments}
              setReviewComments={setReviewComments}
              dobbieOpen={dobbieOpen}
              setDobbieOpen={setDobbieOpen}
              loading={loading}
              petName={loggedInUser?.companion?.name}
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
              <h2 className="text-xs font-semibold uppercase tracking-widest text-w20">
                Rejected
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-w4 text-w20">
                {quests.rejected.length}
              </span>
              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                {rejectedOpen ? "▲" : "▼"}
              </span>
            </button>
            {rejectedOpen && (
              <div className="rounded-xl overflow-hidden bg-surface-alt" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                {quests.rejected.map((q, i) => (
                  <div
                    key={q.id}
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ borderBottom: i === quests.rejected.length - 1 ? "none" : "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <span className="text-xs flex-shrink-0" style={{ color: "rgba(239,68,68,0.4)" }}>x</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate text-w25" style={{ textDecoration: "line-through" }}>{q.title}</p>
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
                <h2 className="text-xs font-semibold uppercase tracking-widest text-w40">
                  {dashView === "npcBoard" ? "NPC Quest Log" : "Quest Journal"}
                </h2>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-w6 text-w30">
                  {journalQuests.length}
                </span>
                <span className="ml-auto text-xs text-w20">
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
                    className="w-full text-xs px-3 py-2 rounded-lg mb-2 input-dark border-w8"
                  />
                  <div className="rounded-xl overflow-hidden bg-surface-alt border-w6">
                    {journalQuests.length === 0 ? (
                      <p className="text-xs p-4 text-center text-w20">
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
                        <div className="p-4 text-center"><p className="text-xs text-w20">No quests match &ldquo;{completedSearch}&rdquo;</p><button onClick={() => setCompletedSearch("")} className="btn-interactive mt-2 text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>Clear Search</button></div>
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
          className="fixed bottom-6 left-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl bg-card"
          style={{
            transform: "translateX(-50%)",
            border: "1px solid rgba(255,102,51,0.4)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(255,102,51,0.1)",
          }}
        >
          <span className="text-xs font-medium mr-1 text-w50">
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
            className="text-xs px-2 py-1 rounded-lg ml-1 text-w30 bg-w4 border-w8"
          >
            x
          </button>
        </div>
      )}

      {/* Quest Detail Modal */}
      {questDetailModal && (
        <QuestDetailModal
          quest={questDetailModal}
          onClose={closeQuestDetailModal}
          playerName={playerName}
          playerLevel={playerLevelInfo.level}
          reviewApiKey={reviewApiKey}
          favorites={favorites}
          handleClaim={handleClaim}
          handleUnclaim={handleUnclaim}
          handleComplete={handleComplete}
          handleCoopClaim={handleCoopClaim}
          handleCoopComplete={handleCoopComplete}
          handleToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* Daily Login Calendar */}
      {loginCalendarOpen && (
        <Suspense fallback={null}>
          <DailyLoginCalendar onClose={() => setLoginCalendarOpen(false)} />
        </Suspense>
      )}

      {/* Fixed Today button — always visible top-right */}
      {playerName && !todayOpen && (
        <button
          onClick={() => setTodayOpen(true)}
          className="fixed top-3 right-4 z-[80] btn-interactive text-xs px-3 py-2 rounded-lg font-bold tracking-wide today-header-btn"
          style={{
            background: "linear-gradient(135deg, rgba(129,140,248,0.15) 0%, rgba(167,139,250,0.1) 100%)",
            color: "#a78bfa",
            border: "1px solid rgba(129,140,248,0.25)",
            boxShadow: "0 2px 12px rgba(129,140,248,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
          title="Today's tasks"
          aria-label="Open today's task overview"
        >
          {"\u2726"} Today
        </button>
      )}

      {/* Today Drawer */}
      {playerName && (
        <TodayDrawer
          open={todayOpen}
          onClose={() => setTodayOpen(false)}
          onNavigate={(v) => { setDashView(v as typeof dashView); }}
          dailyBonusAvailable={dailyBonusAvailable}
          dailyMissions={dailyMissions}
          rituals={rituals}
          activeNpcs={activeNpcs}
          onClaimDailyBonus={() => { setClaimingDailyBonus(true); }}
          inProgressCount={quests.inProgress.length}
          weeklyChallenge={weeklyChallenge ? { stagesCompleted: weeklyChallenge.stages?.filter((s: { completed?: boolean }) => s.completed).length ?? 0 } : null}
          worldBossActive={false}
          riftActive={false}
          vowCount={rituals.filter(r => r.isAntiRitual).length}
          socialBadge={socialBadge}
          expeditionActive={!!expedition}
          dungeonActive={false}
          onClaimMilestone={async (threshold) => {
            try {
              const { getAuthHeaders } = await import("@/lib/auth-client");
              const r = await fetch("/api/daily-missions/claim", {
                method: "POST",
                headers: { ...getAuthHeaders(reviewApiKey!), "Content-Type": "application/json" },
                body: JSON.stringify({ threshold }),
              });
              if (r.ok) {
                const data = await r.json();
                const rewardText = Object.entries(data.reward || {}).map(([k, v]) => `+${v} ${k[0].toUpperCase() + k.slice(1)}`).join(", ");
                addToast({ type: "flavor", message: `Milestone ${threshold} claimed! ${rewardText}`, icon: "/images/icons/currency-gold.png" });
                refresh();
              }
            } catch { /* ignore */ }
          }}
        />
      )}

      {/* Reward Celebration (quest/ritual/vow/companion completion) */}
      {rewardCelebration && (
        <RewardCelebration data={rewardCelebration} onClose={closeRewardCelebration} onAchievementClick={navigateToAchievement} onCollect={(rd) => {
          if (rd.loot) setPurchaseToast(`${rd.loot.name} added to inventory!`);
          if (rd.achievement) addToast({ type: "achievement", achievement: rd.achievement as EarnedAchievement });
          // Trigger floating reward numbers
          const floats: { text: string; color: string }[] = [];
          if (rd.xpEarned > 0) floats.push({ text: `+${rd.xpEarned} XP`, color: "#a78bfa" });
          if (rd.goldEarned > 0) floats.push({ text: `+${rd.goldEarned} Gold`, color: "#fbbf24" });
          if (rd.bondXp && rd.bondXp > 0) floats.push({ text: `+${rd.bondXp} Bond`, color: "#ff6b9d" });
          if (floats.length > 0) addFloating(floats);
        }} />
      )}

      {/* Loot Drop Notification */}
      {lootDrop && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setLootDrop(null)}>
          <div className="w-full max-w-xs rounded-2xl p-6 text-center bg-surface" style={{ border: `2px solid ${lootDrop.rarityColor}`, boxShadow: `0 0 30px ${lootDrop.rarityColor}55` }}
            onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-3" style={{ filter: `drop-shadow(0 0 12px ${lootDrop.rarityColor})` }}>{lootDrop.emoji}</div>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: lootDrop.rarityColor }}>{lootDrop.rarity}</div>
            <div className="text-base font-bold mb-2 text-primary">{lootDrop.name}</div>
            {lootDrop.effect?.amount && (
              <div className="text-xs mb-4 text-w50">
                {lootDrop.effect.type === 'gold' && `＋${lootDrop.effect.amount} Gold`}
                {lootDrop.effect.type === 'xp' && `＋${lootDrop.effect.amount} XP`}
                {lootDrop.effect.type === 'streak_shield' && `＋${lootDrop.effect.amount} Streak Shield`}
                {lootDrop.effect.type === 'bond' && `＋${lootDrop.effect.amount} Bond XP`}
              </div>
            )}
            <button
              onClick={() => { setPurchaseToast(`${lootDrop.name} added to inventory!`); setLootDrop(null); }}
              className="shop-buy-btn w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: `${lootDrop.rarityColor}22`, color: lootDrop.rarityColor, border: `1px solid ${lootDrop.rarityColor}55` }}
            >
              Collect x
            </button>
          </div>
        </div>
      )}

      {/* Level Up Celebration */}
      {levelUpCelebration && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="levelup-modal w-full max-w-sm rounded-2xl p-8 text-center relative overflow-hidden" style={{ background: "linear-gradient(180deg, #1a1400 0%, #0d0d14 60%)", border: "2px solid rgba(255,215,0,0.5)", boxShadow: "0 0 60px rgba(255,215,0,0.3), 0 0 120px rgba(255,215,0,0.1)" }}
            onClick={e => e.stopPropagation()}>
            {/* Sparkle particles */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="absolute rounded-full" style={{
                width: 4 + (i % 3) * 2, height: 4 + (i % 3) * 2,
                background: i % 2 === 0 ? "#FFD700" : "#FFF8DC",
                top: "50%", left: "50%",
                animation: `levelup-sparkle ${1.5 + (i % 4) * 0.3}s ease-out ${i * 0.1}s infinite`,
                "--sx": `${Math.cos(i * Math.PI / 6) * (80 + i * 8)}px`,
                "--sy": `${Math.sin(i * Math.PI / 6) * (80 + i * 8)}px`,
                boxShadow: "0 0 6px rgba(255,215,0,0.8)",
                pointerEvents: "none",
              } as React.CSSProperties} />
            ))}
            {/* Expanding ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div style={{ width: 100, height: 100, borderRadius: "50%", border: "2px solid rgba(255,215,0,0.6)", animation: "levelup-ring 2s ease-out infinite" }} />
            </div>
            <img src="/images/icons/levelup-icon.png" alt="Level Up" width={80} height={80} className="mx-auto mb-3" style={{ imageRendering: "auto", filter: "drop-shadow(0 0 16px rgba(255,215,0,0.6))" }} />
            <div className="text-xs font-bold uppercase tracking-[0.3em] mb-2" style={{ color: "rgba(255,215,0,0.6)" }}>Level Up!</div>
            <div className="levelup-title text-3xl font-black mb-1" style={{ color: "#FFD700" }}>Level {levelUpCelebration.level}</div>
            <div className="text-sm font-semibold mb-5" style={{ color: "rgba(255,215,0,0.7)" }}>{levelUpCelebration.title}</div>
            <div className="text-xs mb-6 text-w35">The Forge recognizes your dedication, adventurer.</div>
            <button
              onClick={() => setLevelUpCelebration(null)}
              className="action-btn w-full py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.35)" }}
            >
              Continue the Journey
            </button>
          </div>
        </div>
      )}

      <footer data-feedback-id="footer" className="mt-12 py-4" style={{ borderTop: "1px solid rgba(255,68,68,0.07)", position: "relative", zIndex: 2 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-center gap-3 text-xs font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>
          <span>Quest Hall v{gameVersion}</span>
          {reviewApiKey && playerName && (
            <>
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
                (α) Alpha v{gameVersion}
              </button>
            </>
          )}
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
          title="Click to close"
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>⏱</span>
          <p className="text-xs leading-relaxed flex-1" style={{ color: "#fca5a5" }}>{apiError}</p>
          <span className="text-xs flex-shrink-0 text-w25" style={{ marginLeft: 4 }}>✕</span>
        </div>
      )}

      {/* Unified Toast Stack */}
      <ToastStack toasts={toasts} onRemove={removeToast} onAchievementClick={navigateToAchievement} />

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
            className="bg-surface border-w10"
            style={{
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
                className="text-w30" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "0 0.5rem 0.5rem" }}
              >
                ×
              </button>
            </div>
            {/* Content */}
            <div style={{ overflowY: "auto", flex: 1, padding: "1.25rem" }}>
              {infoOverlayTab === "roadmap" && <RoadmapView />}
              {infoOverlayTab === "changelog" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-widest text-w35">Changelog</span>
                  </div>
                  {changelogData.length === 0 && (
                    <div className="text-sm text-w25">No changelog data available.</div>
                  )}
                  {changelogData.map(entry => (
                    <div key={entry.version} className="rounded-lg overflow-hidden border-w7">
                      <button
                        onClick={() => setChangelogExpanded(changelogExpanded === entry.version ? null : entry.version)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-w3"
                        style={{ cursor: "pointer", border: "none" }}
                      >
                        <span className="text-xs font-mono px-2 py-0.5 rounded shrink-0" style={{ background: "rgba(255,68,68,0.15)", color: "#ff6666", border: "1px solid rgba(255,68,68,0.25)" }}>
                          v{entry.version}
                        </span>
                        <span className="flex-1 text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                          {entry.title}
                        </span>
                        <span className="text-xs shrink-0 text-w25">
                          {entry.date}
                        </span>
                        <span className="shrink-0 text-w30" style={{ fontSize: 12 }}>
                          {changelogExpanded === entry.version ? "▲" : "▼"}
                        </span>
                      </button>
                      {changelogExpanded === entry.version && (
                        <ul className="px-4 py-3 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
                          {entry.changes.map((change, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-w60">
                              <span className="shrink-0" style={{ color: "rgba(255,68,68,0.6)", marginTop: 2 }}>•</span>
                              {change}
                            </li>
                          ))}
                        </ul>
                      )}
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
          setDashView(tabKey as typeof dashView);
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
          onComplete={async ({ name: newName, apiKey, accessToken: token }) => {
            setOnboardingOpen(false);
            if (token) setAccessToken(token);
            try { localStorage.setItem("dash_api_key", apiKey); } catch { /* private browsing */ }
            try { localStorage.setItem("dash_player_name", newName); } catch { /* private browsing */ }
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
        <ModalOverlay isOpen={!!classActivatedNotif} onClose={() => setClassActivatedNotif(null)} zIndex={90}>
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4 bg-surface" style={{ border: "1px solid rgba(167,139,250,0.4)", boxShadow: "0 0 60px rgba(139,92,246,0.2)" }}
          >
            <div className="text-center space-y-1">
              <div className="text-4xl">×</div>
              <h2 className="text-base font-bold text-bright">
                Your class path is ready!
              </h2>
              <p className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
                {classActivatedNotif.classIcon} Welcome to {classActivatedNotif.className}!
              </p>
            </div>
            <p className="text-xs text-center text-w50">
              {classActivatedNotif.classDescription}
            </p>
            <button
              onClick={() => setClassActivatedNotif(null)}
              className="w-full py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", color: "#fff" }}
            >
              Let&apos;s go!
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Version Update Popup */}
      {versionPopupOpen && (
        <ModalOverlay isOpen={versionPopupOpen} onClose={dismissVersionPopup} zIndex={70}>
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4 bg-surface"
            style={{
              border: "1px solid rgba(255,68,68,0.35)",
              boxShadow: "0 0 60px rgba(255,68,68,0.12)",
            }}
          >
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-bright">
                Version {gameVersion} is live! ✨
              </h2>
              {changelogData[0] && (
                <p className="text-sm text-w50">
                  {changelogData[0].title}
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setVersionPopupOpen(false);
                  setInfoOverlayOpen(true);
                  setInfoOverlayTab("changelog");
                }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                style={{ background: "rgba(255,68,68,0.15)", color: "#ff6666", border: "1px solid rgba(255,68,68,0.3)", cursor: "pointer" }}
              >
                View Changelog
              </button>
              <button
                onClick={dismissVersionPopup}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-w6 border-w10" style={{ color: "rgba(255,255,255,0.45)", cursor: "pointer" }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </ModalOverlay>
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
    <FloatingRewardsLayer rewards={floatingRewards} onRemove={removeFloating} />
    {/* Player Profile Modal — accessible from Leaderboard, Social, etc. */}
    {profilePlayerId && (
      <Suspense fallback={null}>
        <PlayerProfileModal playerId={profilePlayerId} onClose={() => setProfilePlayerId(null)} />
      </Suspense>
    )}
    </DashboardProvider>
  );
}

