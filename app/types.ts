export interface Agent {
  id: string;
  name: string;
  status: "online" | "working" | "idle" | "offline";
  platform: string | null;
  uptime: number;
  currentJobDuration: number;
  questsCompleted?: number;
  xp?: number;
  gold?: number;
  streakDays?: number;
  health: "ok" | "needs_checkin" | "broken" | "stale";
  lastUpdate: string | null;
  role?: string;
  avatar?: string;
  color?: string;
  pendingCommands?: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  type?: "development" | "personal" | "learning" | "fitness" | "social" | "boss" | "relationship-coop";
  category: string | null;
  categories: string[];
  product: string | null;
  humanInputRequired: boolean;
  createdBy?: string;
  status: "open" | "in_progress" | "completed" | "suggested" | "rejected";
  createdAt: string;
  claimedBy: string | null;
  completedBy: string | null;
  completedAt: string | null;
  parentQuestId?: string | null;
  children?: Quest[];
  progress?: { completed: number; total: number };
  recurrence?: string | null;
  proof?: string | null;
  checklist?: { text: string; done: boolean }[] | null;
  nextQuestTemplate?: { title: string; description?: string | null; type?: string; priority?: string } | null;
  coopPartners?: string[] | null;
  coopClaimed?: string[];
  coopCompletions?: string[];
  skills?: string[];
  lore?: string | null;
  chapter?: string | null;
  minLevel?: number;
  classRequired?: string | null;
  requiresRelationship?: boolean;
  playerStatus?: "open" | "in_progress" | "completed" | "locked";
  rewards?: { xp: number; gold: number };
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary" | "companion";
  npcGiverId?: string | null;
  npcName?: string | null;
  npcRarity?: string | null;
  difficulty?: string | null;
  flavorText?: string | null;
  chainIndex?: number | null;
  chainTotal?: number | null;
}

export interface NpcQuestChainEntry {
  questId: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  claimedBy: string | null;
  completedBy: string | null;
  rewards: { xp: number; gold: number };
  position: number;
  flavorText?: string | null;
}

export interface ActiveNpc {
  id: string;
  name: string;
  emoji: string;
  title: string;
  description: string;
  portrait: string | null;
  greeting: string | null;
  rarity: string;
  arrivedAt: string;
  expiresAt: string;
  daysLeft: number;
  hoursLeft: number;
  finalReward: { type: string; item: { id: string; name: string; emoji: string; rarity: string; desc: string } } | null;
  questChain: NpcQuestChainEntry[];
}

export interface EarnedAchievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  category: string;
  rarity?: string;
  points?: number;
  earnedAt: string;
}

export interface AchievementPointMilestone {
  points: number;
  reward: {
    type: 'frame' | 'title';
    id: string;
    name: string;
    color?: string;
    desc?: string;
    glow?: boolean;
  };
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  xp: number;
  questsCompleted: number;
  achievements?: { reason: string; xp: number; at: string }[];
  earnedAchievements?: EarnedAchievement[];
  streakDays?: number;
  streakLastDate?: string | null;
  forgeTemp?: number;
  gold?: number;
  currencies?: {
    gold: number;
    stardust: number;
    essenz: number;
    runensplitter: number;
    gildentaler: number;
    mondstaub: number;
    sternentaler: number;
  };
  gear?: string;
  createdAt?: string;
  // Onboarding fields
  classId?: string | null;
  classPending?: boolean;
  companion?: {
    type: string; name: string; emoji: string; isReal: boolean; species?: string;
    bondLevel?: number; bondXp?: number; lastPetted?: string | null;
    petCountToday?: number; petDateStr?: string | null;
    ultimateLastUsed?: string | null;
  } | null;
  age?: number | null;
  goals?: string | null;
  relationshipStatus?: string;
  partnerName?: string | null;
  pronouns?: string | null;
  modifiers?: {
    xp: { forge: number; kraft?: number; gear: number; companions: number; bond: number; hoarding: number; hoardingCount: number; hoardingPct: number; total: number };
    gold: { forge: number; weisheit?: number; streak: number; total: number };
  };
  // Equipment (populated from backend)
  equipment?: Record<string, unknown>;
  // Achievement points & cosmetic frames
  achievementPoints?: number;
  unlockedFrames?: { id: string; name: string; color: string; glow?: boolean; unlockedAt: string }[];
  equippedFrame?: { id: string; name: string; color: string; glow?: boolean } | null;
  // Crafting professions
  professions?: {
    schmied?: { level: number; xp: number; lastCraftAt?: string };
    alchemist?: { level: number; xp: number; lastCraftAt?: string };
    verzauberer?: { level: number; xp: number; lastCraftAt?: string };
    koch?: { level: number; xp: number; lastCraftAt?: string };
  };
  craftingMaterials?: Record<string, number>;
  equippedTitle?: { id: string; name: string; rarity: string } | null;
  chosenProfessions?: string[];
}

export interface CampaignQuest {
  id: string;
  title: string;
  status: string;
  priority?: string;
  type?: string;
  completedBy?: string | null;
  completedAt?: string | null;
  claimedBy?: string | null;
  lore?: string | null;
  description?: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  icon: string;
  lore: string;
  createdBy: string;
  createdAt: string;
  status: "active" | "completed" | "archived";
  questIds: string[];
  bossQuestId: string | null;
  rewards: { xp: number; gold: number; title: string };
  quests?: CampaignQuest[];
  progress?: { completed: number; total: number };
}

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  category: string;
  hidden?: boolean;
  condition?: Record<string, unknown>;
}

export interface ClassDef {
  id: string;
  name: string;
  icon: string;
  fantasy: string;
  description: string;
  realWorld: string;
  status: string;
  playerCount?: number;
  tiers?: { level: number; title: string; minXp: number }[];
  skillTree?: { id: string; name: string; icon: string }[];
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  role?: string;
  xp: number;
  questsCompleted: number;
}

export interface QuestsData {
  open: Quest[];
  inProgress: Quest[];
  completed: Quest[];
  suggested: Quest[];
  rejected: Quest[];
  locked?: Quest[];
}

export interface Ritual {
  id: string;
  title: string;
  description: string;
  schedule: { type: string; days?: string[] };
  difficulty: string;
  rewards: { xp: number; gold: number };
  streak: number;
  longestStreak?: number;
  completedDates?: string[];
  lastCompleted: string | null;
  playerId: string;
  status?: "active" | "broken";
  isAntiRitual?: boolean;
  commitment?: string;
  commitmentDays?: number;
  bloodPact?: boolean;
  pactCompleted?: boolean;
  cleanDays?: number;
  lastViolated?: string | null;
  missedDays?: number;
}

export interface Habit {
  id: string;
  title: string;
  positive: boolean;
  negative: boolean;
  color: string;
  score: number;
  playerId: string;
}

export interface LootItem {
  id: string;
  itemId?: string;
  name: string;
  emoji: string;
  rarity: string;
  rarityColor: string;
  effect: { type: string; amount?: number };
}

export interface ChangelogCommit {
  sha: string;
  type: string;
  message: string;
  author: string;
  url: string | null;
}

export interface ChangelogEntry {
  date: string;
  commits: ChangelogCommit[];
}

export interface PersonalTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  type: string;
  priority: "low" | "medium" | "high";
  recurrence: string | null;
  checklist: { text: string; done: boolean }[] | null;
}

export interface ForgeChallengeTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  participants: { id: string; name: string; avatar: string; color: string }[];
}

export interface AntiRitual {
  id: string;
  title: string;
  isAntiRitual: boolean;
  cleanDays: number;
  lastViolated: string | null;
  lastCompleted: string | null;
  playerId: string;
  milestones?: number[];
  createdAt: string;
  longestStreak?: number;
  completedDates?: string[];
  commitment?: string;
  commitmentDays?: number;
  bloodPact?: boolean;
  status?: "active" | "broken";
}

export interface Suggestion {
  id: string;
  icon: string;
  title: string;
  body: string;
  accent: string;
  accentBg: string;
}

export interface CVData {
  skills: { name: string; count: number; lastEarned: string | null; quests: { id: string; title: string; completedAt: string }[] }[];
  certifications: { title: string; earnedAt: string; questId: string }[];
  totalLearningQuests: number;
}

export interface ShopItem { id: string; name: string; cost: number; icon: string; desc: string; category?: "self-care" | "boost"; effect?: { type: string; questsRemaining?: number; amount?: number }; }

export interface GachaItem {
  id: string;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  type: "weapon" | "armor" | "consumable" | "gacha";
  emoji: string;
  icon?: string;
  stats?: Record<string, number>;
  effect?: string;
  desc: string;
}

export interface GachaPullResult {
  item: GachaItem;
  isNew: boolean;
  isDuplicate: boolean;
  duplicateRefund?: number;
  pityCounter: number;
  epicPityCounter: number;
}

export interface GachaBanner {
  id: string;
  name: string;
  icon: string;
  type: "standard" | "featured";
  currency: string;
  costSingle: number;
  cost10: number;
  featuredItems: string[];
  pool: GachaItem[];
  active: boolean;
  lore: string;
  poolSize?: number;
  dropRates?: Record<string, string>;
}

export interface GachaPityInfo {
  pityCounter: number;
  epicPityCounter: number;
  guaranteed5050: boolean;
  hardPity: number;
  softPityStart: number;
  epicPity: number;
}

export interface CurrencyTemplate {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
}

export interface RoadmapItem {
  id: string;
  title: string;
  desc: string;
  status: "planned" | "in_progress" | "done";
  eta: string;
  category: string;
}

export interface PixelCharacterProps {
  appearance?: { skinColor?: string; hairStyle?: string; hairColor?: string };
  equipment?: Record<string, string | null>;
  companion?: { type?: string; name: string; emoji: string } | null;
}

export interface GearInstance {
  instanceId: string;
  templateId: string;
  name: string;
  slot: string;
  tier: number;
  rarity: string;
  reqLevel: number;
  desc?: string;
  icon?: string | null;
  stats: Record<string, number>;
  legendaryEffect?: { type: string; value: number; label?: string } | null;
  setId?: string;
  rolledAt: string;
  affixRolls?: { primary: { stat: string; value: number }[]; minor: { stat: string; value: number }[] };
}

export interface CharacterData {
  name: string;
  level: number;
  xp: number;
  xpToNext: number | null;
  title: string;
  classId: string | null;
  classTier: string | null;
  classFantasy: string | null;
  classIcon: string | null;
  companion: { type?: string; name: string; emoji: string; bondLevel: number; bondXp?: number } | null;
  appearance?: { skinColor?: string; hairStyle?: string; hairColor?: string };
  equipment: Record<string, GearInstance | string | null>;
  stats: { kraft: number; ausdauer: number; weisheit: number; glueck: number; fokus?: number; vitalitaet?: number; charisma?: number; tempo?: number; _setBonus?: number };
  baseStats: { kraft: number; ausdauer: number; weisheit: number; glueck: number };
  inventory: { id: string; slot: string; name: string; emoji?: string; icon?: string; tier: number; minLevel: number; stats: Record<string, number>; rarity: string; desc?: string; type?: string; effect?: any }[];
  forgeTemp: number;
  season: string;
  setBonusInfo: { name: string; count: number; total: number } | null;
  namedSetBonuses?: { id: string; name: string; rarity: string; count: number; total: number; isComplete: boolean; activeLabel: string | null }[];
  xpProgress: number;
  xpInLevel?: number;
  xpForLevel?: number;
  legendaryEffects?: { label: string; itemName: string }[];
  equippedTitle?: { id: string; name: string; rarity: string; description?: string } | null;
  earnedTitleCount?: number;
  relationshipStatus?: string;
  partnerName?: string | null;
}

// ─── Challenge System Types ──────────────────────────────────────────────────

export interface WeeklyModifier {
  id: string;
  name: string;
  description: string;
  bonusType: string;
  bonusMultiplier: number;
  malusMultiplier: number;
}

export interface WeeklyChallengeStage {
  stage: number;
  desc: string;
  requirement: { type: string; questType?: string; count: number };
  starThresholds: [number, number, number];
  completed: boolean;
  current: boolean;
  rewards: Record<string, number>;
  earnedStars: number;
}

export interface WeeklyChallenge {
  weekId: string;
  templateId: string;
  name: string;
  icon: string;
  stages: WeeklyChallengeStage[];
  currentStage: number;
  progress: Record<string, number>;
  canAdvance: boolean;
  startedAt: string;
  stageStartedAt: (string | null)[];
  stars: number[];
  totalStars: number;
  modifier: WeeklyModifier | null;
  speedBonusDays: number;
  streakDays?: number;
}

export interface ExpeditionCheckpoint {
  number: number;
  name: string;
  required: number;
  reached: boolean;
  rewards: Record<string, number>;
  isBonus: boolean;
  bonusTitle: { id: string; name: string; rarity: string } | null;
  claimedByPlayer: boolean;
}

export interface ExpeditionContribution {
  userId: string;
  name: string;
  avatar: string;
  color: string;
  count: number;
}

export interface Expedition {
  weekId: string;
  templateId: string;
  name: string;
  description: string;
  icon: string;
  progress: number;
  playerCount: number;
  checkpoints: ExpeditionCheckpoint[];
  contributions: ExpeditionContribution[];
  playerContribution: number;
  startedAt: string;
}
