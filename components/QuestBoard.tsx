/**
 * QuestBoard — barrel re-export file.
 * All components are split into focused files:
 *   QuestBadges.tsx    — badge components (CategoryBadge, TypeBadge, etc.)
 *   QuestCards.tsx     — QuestCard, EpicQuestCard, CompletedQuestRow
 *   QuestModals.tsx    — CreateQuestModal + quest creation panels
 *   QuestPanels.tsx    — AntiRitualePanel, DobbieQuestPanel, SmartSuggestionsPanel
 *   UserCard.tsx          — UserCard component
 *   ShopModal.tsx         — ShopModal component
 *   QuestToasts.tsx       — ChainQuestToast, AchievementToast, FlavorToast, EmptyState, SkeletonCard
 */

// ─── Badges ──────────────────────────────────────────────────────────────────
export {
  CategoryBadge,
  ProductBadge,
  HumanInputBadge,
  TypeBadge,
  CreatorBadge,
  AgentBadge,
  RecurringBadge,
} from "./QuestBadges";

// ─── Quest Cards ─────────────────────────────────────────────────────────────
export { RARITY_COLORS } from "@/app/constants";
export {
  CompletedQuestRow,
  QuestCard,
  EpicQuestCard,
} from "./QuestCards";

// ─── Quest Creation Modal + Panels ───────────────────────────────────────────
export {
  CreateQuestModal,
  PersonalQuestPanel,
  ForgeChallengesPanel,
  RelationshipCoopPanel,
  LearningQuestPanel,
  HouseholdQuestBoard,
  ThoughtfulHeroPanel,
} from "./QuestModals";

// ─── NPC / Companion / Suggestions Panels ────────────────────────────────────
export {
  AntiRitualePanel,
  DobbieQuestPanel,
  SmartSuggestionsPanel,
} from "./QuestPanels";

// ─── UserCard ─────────────────────────────────────────────────────────────────
export { UserCard } from "./UserCard";

// ─── ShopModal ────────────────────────────────────────────────────────────────
export { ShopModal } from "./ShopModal";

// ─── Toasts & Utility UI ─────────────────────────────────────────────────────
export { ChainQuestToast, AchievementToast, FlavorToast, EmptyState, SkeletonCard } from "./QuestToasts";
