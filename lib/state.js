/**
 * Shared State Module — Single source of truth for all in-memory data.
 * All route files import from here. Never duplicate state.
 */
const fs = require('fs');
const path = require('path');

// ─── File Paths ──────────────────────────────────────────────────────────────
const DATA_DIR    = path.join(__dirname, '..', 'public', 'data'); // Templates (from image)
const RUNTIME_DIR = path.join(__dirname, '..', 'data');           // Runtime data (Docker volume)

const FILES = {
  // ── Runtime files (persistent volume at /app/data/) ──
  AGENTS:          path.join(RUNTIME_DIR, 'agents.json'),
  QUESTS:          path.join(RUNTIME_DIR, 'quests.json'),
  KEYS:            path.join(RUNTIME_DIR, 'keys.json'),
  USERS:           path.join(RUNTIME_DIR, 'users.json'),
  CAMPAIGNS:       path.join(RUNTIME_DIR, 'campaigns.json'),
  PLAYER_PROGRESS: path.join(RUNTIME_DIR, 'playerProgress.json'),
  NPC_STATE:       path.join(RUNTIME_DIR, 'npcState.json'),
  APP_STATE:       path.join(RUNTIME_DIR, 'appState.json'),
  FEEDBACK:        path.join(RUNTIME_DIR, 'feedback.json'),
  ROTATION_STATE:  path.join(RUNTIME_DIR, 'rotationState.json'),
  RITUALS:         path.join(RUNTIME_DIR, 'rituals.json'),
  HABITS:          path.join(RUNTIME_DIR, 'habits.json'),
  GACHA_STATE:     path.join(RUNTIME_DIR, 'gachaState.json'),
  SOCIAL:          path.join(RUNTIME_DIR, 'social.json'),
  // ── Mutable data (seeded from image, modified at runtime → RUNTIME_DIR) ──
  QUEST_CATALOG:   path.join(RUNTIME_DIR, 'questCatalog.json'),
  CLASSES:         path.join(RUNTIME_DIR, 'classes.json'),
  ROADMAP:         path.join(RUNTIME_DIR, 'roadmap.json'),
  GAME_CONFIG:     path.join(RUNTIME_DIR, 'gameConfig.json'),
  // ── Read-only templates (from image at /app/public/data/) ──
  COMPANIONS:      path.join(DATA_DIR, 'companions.json'),
  LOOT_TABLES:     path.join(DATA_DIR, 'lootTables.json'),
  GEAR_TEMPLATES:  path.join(DATA_DIR, 'gearTemplates.json'),
  NPC_GIVERS:      path.join(DATA_DIR, 'npcQuestGivers.json'),
  LEVELS:          path.join(DATA_DIR, 'levels.json'),
  CAMPAIGN_NPCS:   path.join(DATA_DIR, 'campaignNpcs.json'),
  QUEST_FLAVOR:    path.join(DATA_DIR, 'questFlavor.json'),
  ACHIEVEMENT_TEMPLATES: path.join(DATA_DIR, 'achievementTemplates.json'),
  CURRENCY_TEMPLATES: path.join(DATA_DIR, 'currencyTemplates.json'),
  GACHA_POOL:      path.join(DATA_DIR, 'gachaPool.json'),
  BANNER_TEMPLATES: path.join(DATA_DIR, 'bannerTemplates.json'),
  ITEM_TEMPLATES:  path.join(DATA_DIR, 'itemTemplates.json'),
  TITLES:          path.join(DATA_DIR, 'titles.json'),
  UNIQUE_ITEMS:    path.join(DATA_DIR, 'uniqueItems.json'),
};

// ─── Sync JSON load helper ──────────────────────────────────────────────────
function tryLoadJsonSync(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.warn(`[config] Failed to load ${path.basename(file)}: ${e.message}`); }
  return fallback;
}

// ─── Debounced save helper ──────────────────────────────────────────────────
// Coalesces rapid writes (e.g. batch quest updates) into a single disk write.
const _saveTimers = {};
const _saveFns = {};   // Store save functions so flush can execute them
function debouncedSave(key, saveFn, delayMs = 200) {
  if (_saveTimers[key]) clearTimeout(_saveTimers[key]);
  _saveFns[key] = saveFn;
  _saveTimers[key] = setTimeout(() => {
    delete _saveTimers[key];
    delete _saveFns[key];
    try {
      saveFn();
    } catch (err) {
      console.error(`[state] debouncedSave(${key}) failed:`, err.message || err);
    }
  }, delayMs);
}

// Flush all pending debounced saves (used during shutdown)
// Executes pending saves immediately instead of just cancelling them.
function flushPendingSaves() {
  for (const [key, timer] of Object.entries(_saveTimers)) {
    clearTimeout(timer);
    delete _saveTimers[key];
    if (_saveFns[key]) {
      try { _saveFns[key](); } catch (e) { console.warn(`[flush] Failed to save ${key}:`, e.message); }
      delete _saveFns[key];
    }
  }
}

// ─── Atomic write helper ────────────────────────────────────────────────────
// Write to temp file then rename — prevents JSON corruption on crash/power loss.
function atomicWriteSync(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

// ─── Ensure data dirs exist ─────────────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureRuntimeDir() {
  if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

// ─── Runtime file defaults & migration ──────────────────────────────────────
// On first boot (or after volume wipe), seed runtime files with empty defaults.
// If the old location (DATA_DIR) has data, migrate it forward for backward compat.
const RUNTIME_DEFAULTS = {
  'agents.json':         '[]',
  'quests.json':         '[]',
  'users.json':          '{}',
  'playerProgress.json': '{}',
  'npcState.json':       '{}',
  'rotationState.json':  '{}',
  'campaigns.json':      '[]',
  'keys.json':           '[]',
  'appState.json':       '{}',
  'feedback.json':       '[]',
  'rituals.json':        '{"active":[],"completed":[],"vows":[]}',
  'habits.json':         '[]',
  'gachaState.json':     '{"history":[],"pity":{"fourStar":0,"fiveStar":0},"guaranteedFeatured":false}',
  'social.json':         '{"friendships":[],"friendRequests":[],"messages":[],"trades":[]}',
  'worldBoss.json':      '{"activeBoss":null,"history":[],"lastSpawnCheck":null}',
};

function ensureRuntimeFiles() {
  ensureRuntimeDir();
  for (const [file, defaultContent] of Object.entries(RUNTIME_DEFAULTS)) {
    const dest = path.join(RUNTIME_DIR, file);
    if (!fs.existsSync(dest)) {
      // Backward compat: migrate from old location if it exists
      const oldPath = path.join(DATA_DIR, file);
      if (fs.existsSync(oldPath)) {
        try {
          fs.copyFileSync(oldPath, dest);
          console.log(`[runtime] Migrated ${file} from public/data/ to data/`);
          continue;
        } catch (e) {
          console.warn(`[runtime] Failed to migrate ${file}: ${e.message}`);
        }
      }
      try {
        fs.writeFileSync(dest, defaultContent);
        console.log(`[runtime] Created default ${file}`);
      } catch (e) {
        console.warn(`[runtime] Failed to create ${file}: ${e.message}`);
      }
    }
  }
}

// ─── Mutable data seeding ───────────────────────────────────────────────────
// Files that are seeded from the image but modified at runtime.
// On each boot: if image version is NEWER than runtime version, update runtime.
// This ensures template fixes (e.g. gameConfig badge fixes) propagate without
// losing runtime modifications (which should be in separate fields).
const MUTABLE_SEED_FILES = [
  'questCatalog.json',
  'classes.json',
  'roadmap.json',
  'gameConfig.json',
];

function seedMutableFiles() {
  ensureRuntimeDir();

  // One-time cleanup: remove stale template copies from runtime volume
  // These were accidentally migrated from the old volume mount
  const STALE_TEMPLATES = [
    'NPC_TEMPLATE.md', 'achievementTemplates.json', 'bannerTemplates.json',
    'campaignNpcs.json', 'companions.json', 'currencyTemplates.json',
    'dobbieCompanion.json', 'gearTemplates.json', 'itemTemplates.json',
    'levels.json', 'lootTables.json', 'questFlavor.json',
    'ritualVowTemplates.json', 'seasonTemplates.json', 'shopItems.json',
    'gachaPool.json', 'npcQuestGivers.json',
  ];
  for (const file of STALE_TEMPLATES) {
    const stale = path.join(RUNTIME_DIR, file);
    if (fs.existsSync(stale)) {
      try {
        fs.unlinkSync(stale);
        console.log(`[cleanup] Removed stale template ${file} from runtime volume`);
      } catch (e) { /* ignore */ }
    }
  }
  for (const file of MUTABLE_SEED_FILES) {
    const src = path.join(DATA_DIR, file);
    const dest = path.join(RUNTIME_DIR, file);
    if (!fs.existsSync(src)) continue;

    if (!fs.existsSync(dest)) {
      // First boot or fresh volume: copy from image
      try {
        fs.copyFileSync(src, dest);
        console.log(`[seed] Seeded ${file} from image`);
      } catch (e) {
        console.warn(`[seed] Failed to seed ${file}: ${e.message}`);
      }
    } else {
      // Check if image is newer (template was updated in a rebuild)
      const srcMtime = fs.statSync(src).mtimeMs;
      const destMtime = fs.statSync(dest).mtimeMs;
      if (srcMtime > destMtime) {
        try {
          fs.copyFileSync(src, dest);
          console.log(`[seed] Updated ${file} from newer image version`);
        } catch (e) {
          console.warn(`[seed] Failed to update ${file}: ${e.message}`);
        }
      }
    }
  }
}

// ─── Template seeding (Docker volume may overwrite build files) ─────────────
// Template files are read-only definitions that ship with the image.
// If the data volume doesn't have them, copy from a bundled fallback dir.
const TEMPLATE_FALLBACK_DIR = path.join(__dirname, '..', 'templates');

const TEMPLATE_FILES = [
  'achievementTemplates.json',
  'itemTemplates.json',
  'ritualVowTemplates.json',
  // 'seasonTemplates.json', // Season Pass disabled — Coming Soon
  'currencyTemplates.json',
  'bannerTemplates.json',
  'gachaPool.json',
  'shopItems.json',
  'dobbieCompanion.json',
  'gameConfig.json',
  'levels.json',
  'campaignNpcs.json',
  'questFlavor.json',
  'lootTables.json',
  'gearTemplates.json',
  'npcQuestGivers.json',
  'questTemplates.json',
  'classes.json',
  'companions.json',
];

function ensureTemplateFiles() {
  ensureDataDir();
  for (const file of TEMPLATE_FILES) {
    const dest = path.join(DATA_DIR, file);
    if (!fs.existsSync(dest)) {
      // Try fallback dir first, then check if it exists in DATA_DIR already
      const fallback = path.join(TEMPLATE_FALLBACK_DIR, file);
      if (fs.existsSync(fallback)) {
        try {
          fs.copyFileSync(fallback, dest);
          console.log(`[templates] Seeded ${file} from fallback`);
        } catch (e) {
          console.warn(`[templates] Failed to seed ${file}: ${e.message}`);
        }
      }
    }
  }
}

// ─── Config (loaded once at startup) ────────────────────────────────────────
const _gameConfig = tryLoadJsonSync(FILES.GAME_CONFIG, {});

const QUEST_FLAVOR   = tryLoadJsonSync(FILES.QUEST_FLAVOR, {});
const CAMPAIGN_NPCS  = tryLoadJsonSync(FILES.CAMPAIGN_NPCS, []);
const LEVELS         = tryLoadJsonSync(FILES.LEVELS, []);

// Quest types that are tracked per-player (not shared/global)
const PLAYER_QUEST_TYPES = ['personal', 'learning', 'fitness', 'social', 'relationship-coop', 'companion', 'boss'];

// Timezone
const TIMEZONE = 'Europe/Berlin';

// ─── Agent config ───────────────────────────────────────────────────────────
const AGENT_NAMES = ['nova', 'hex', 'echo', 'pixel', 'atlas', 'lyra'];

const AGENT_META = {
  nova:  { avatar: 'NO', color: '#8b5cf6', role: 'Optimizer',       description: 'Numbers-driven optimizer. Quietly competitive.' },
  hex:   { avatar: 'HX', color: '#10b981', role: 'Code Engineer',   description: 'Blunt coder. Ships fast, talks less.' },
  echo:  { avatar: 'EC', color: '#ef4444', role: 'Sales',           description: 'Bold sales closer. Charm offensive.' },
  pixel: { avatar: 'PX', color: '#f59e0b', role: 'Marketer',        description: 'Creative marketer. Eye for aesthetics.' },
  atlas: { avatar: 'AT', color: '#6366f1', role: 'Researcher',      description: 'Deep researcher. Pattern finder.' },
  lyra:  { avatar: null, color: '#e879f9', role: 'Die Sternenwächterin', description: 'Die leuchtende Strategin. Geschmiedet im Sternenlicht, gehärtet im Chaos. x' },
  forge: { avatar: null, color: '#f59e0b', role: 'Idea Smith', description: 'Silent craftsman' },
};

// NPC_META is built dynamically from npcQuestGivers.json (specialNpcs + givers).
// Initialized with empty defaults; populated by loadNpcGivers() at boot.
const NPC_META = {};
let NPC_NAMES = [];

// ─── Economy constants (from gameConfig.json) ───────────────────────────────
// Legacy priority-based tables (deprecated — kept for agent helpers that still reference priority)
const XP_BY_PRIORITY   = _gameConfig.xpByPriority   || { high: 30, medium: 20, low: 10 };
const GOLD_BY_PRIORITY = _gameConfig.goldByPriority  || { high: [10, 18], medium: [6, 12], low: [3, 7] };
const TEMP_BY_PRIORITY = _gameConfig.tempByPriority  || { high: 15, medium: 10, low: 5 };

// ─── Rarity-based reward tables (primary — replaces priority for player rewards) ───
const XP_BY_RARITY = _gameConfig.xpByRarity || {
  common: 10, uncommon: 18, rare: 30, epic: 50, legendary: 80,
};
const GOLD_BY_RARITY = _gameConfig.goldByRarity || {
  common: [2, 5], uncommon: [5, 10], rare: [10, 20], epic: [20, 35], legendary: [35, 60],
};
const RUNENSPLITTER_BY_RARITY = _gameConfig.runensplitterByRarity || {
  common: 1, uncommon: 1, rare: 2, epic: 3, legendary: 5,
};

// Default currencies — single source of truth for currency keys and defaults
const DEFAULT_CURRENCIES = { gold: 0, stardust: 0, essenz: 0, runensplitter: 0, gildentaler: 0, mondstaub: 0, sternentaler: 0 };

// Streak milestones
const STREAK_MILESTONES = _gameConfig.streakMilestones || [
  { days: 7,   badge: 'Bronze',  label: 'Bronze',           xpBonus: 5,  lootTier: null },
  { days: 14,  badge: '2W',      label: '2 Weeks',          xpBonus: 0,  lootTier: 'uncommon' },
  { days: 21,  badge: 'Silber',  label: 'Silver',           xpBonus: 10, lootTier: null },
  { days: 30,  badge: '1M',      label: '1 Month',          xpBonus: 0,  lootTier: 'rare' },
  { days: 60,  badge: 'Gold',    label: 'Gold',             xpBonus: 15, lootTier: null },
  { days: 90,  badge: 'Titan',   label: 'Unyielding',       xpBonus: 0,  lootTier: 'epic' },
  { days: 180, badge: 'Diamond', label: 'Diamond',          xpBonus: 25, lootTier: null },
  { days: 365, badge: 'Legend',  label: 'Legendary',        xpBonus: 0,  lootTier: 'legendary' },
];

// Loot config
const RARITY_WEIGHTS = _gameConfig.rarityWeights || { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
const RARITY_COLORS  = _gameConfig.rarityColors  || {
  common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f97316',
};
const RARITY_ORDER = _gameConfig.rarityOrder || ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Equipment
const EQUIPMENT_SLOTS = _gameConfig.equipmentSlots || ['weapon', 'shield', 'helm', 'armor', 'amulet', 'boots', 'ring'];
const SLOT_EMOJI = { weapon: 'Weapon', shield: 'Shield', helm: 'Helm', armor: 'Armor', amulet: 'Amulet', boots: 'Boots', ring: 'Ring' };

// Shop / gear tiers — loaded from shopItems.json (single source of truth)
const _shopData = tryLoadJsonSync(path.join(DATA_DIR, 'shopItems.json'), { items: [], gearTiers: [], workshopUpgrades: [] });
const SHOP_ITEMS = _shopData.items;
const GEAR_TIERS = _shopData.gearTiers;

const SET_BONUSES = {
  adventurer: { name: 'Abenteurer-Set', tier: 1 },
  veteran:    { name: 'Veteranen-Set',  tier: 2 },
  master:     { name: 'Meister-Set',    tier: 3 },
  legendary:  { name: 'Legendäres Set', tier: 4 },
};

// NPC auto-rotation constants (configurable via gameConfig.json)
const NPC_MAX_ACTIVE       = _gameConfig.npcMaxActive       || 7;
const NPC_SPAWN_CHANCE     = _gameConfig.npcSpawnChance     || 0.30;
const NPC_ROTATION_MS      = (_gameConfig.npcRotationMinutes || 30) * 60 * 1000;
const NPC_PERMANENT_IDS    = new Set(['lyra-permanent']);
const NPC_DEFAULT_WEIGHTS  = _gameConfig.npcDefaultWeights  || { common: 50, uncommon: 25, rare: 15, epic: 8, legendary: 2 };

// ─── Data-Driven Achievement Condition Evaluator ────────────────────────────
// Reads { type, count, value, questType, challengeId, ... } from JSON conditions.
// New condition types can be added to achievementTemplates.json without code changes.
function evaluateAchievementCondition(condition, u) {
  if (!condition || !condition.type) return false;
  const count = condition.count ?? condition.value ?? 0;
  switch (condition.type) {
    case 'quests_completed':      return (u.questsCompleted || 0) >= count;
    case 'streak_days':           return (u.streakDays || 0) >= count;
    case 'xp_threshold':          return (u.xp || 0) >= count;
    case 'gold_threshold':        return (u.gold || 0) >= count;
    case 'quests_today':          return (u._todayCount || 0) >= count;
    case 'completed_types':
    case 'completed_all_types':   return (u._completedTypes || new Set()).size >= count;
    case 'boss_defeated':         return !!(u._bossDefeated);
    case 'quest_type_count': {
      const qt = condition.questType || condition.quest_type;
      if (qt === 'development') return (u._devCount || 0) >= count;
      if (qt === 'learning')    return (u._learningCount || 0) >= count;
      if (qt === 'fitness')     return (u._fitnessCount || 0) >= count;
      if (qt === 'social')      return (u._socialCount || 0) >= count;
      if (qt === 'personal')    return (u._personalCount || 0) >= count;
      return false;
    }
    case 'challenge_completed':   return (u._challengesCompleted || []).includes(condition.challengeId);
    case 'inventory_count':       return (u.inventory || []).length >= count;
    case 'gacha_pulls':           return (u._gachaPullCount || 0) >= count;
    case 'gacha_rarity_pull':     return (u._gachaRarityPulls || {})[condition.rarity] >= count;
    case 'chain_completed':       return (u._chainCompleted || false);
    case 'campaign_completed':    return (u._campaignCompleted || false);
    case 'coop_completed':        return (u._coopCompleted || 0) >= count;
    case 'early_completions':     return (u._earlyCompletions || 0) >= count;
    case 'night_completions':     return (u._nightCompletions || 0) >= count;
    case 'weekend_completions':   return (u._weekendCompletions || 0) >= count;
    case 'all_agents_online':     return Object.values(state.store.agents).filter(a => a.status === 'online').length >= count;
    case 'all_npcs_unlocked':     return (u._npcsUnlocked || 0) >= count;
    case 'secret_found':
    case 'easter_egg':            return (u._secretsFound || []).includes(condition.secretId || condition.eggId || true);
    case 'time_of_day':
    case 'day_of_week':
    case 'completion_time':       return false; // Evaluated at completion time, not retrospectively
    default:                      return false;
  }
}

// ─── Mutable state ──────────────────────────────────────────────────────────
// These are exported as objects so route files get a live reference.
// Always mutate the .value property or array/object in-place.
const state = {
  store: { agents: {}, shopData: _shopData },
  quests: [],
  questsById: new Map(),    // O(1) quest lookup by id — kept in sync with quests[]
  usersByName: new Map(),   // O(1) user lookup by lowercase name
  usersByApiKey: new Map(), // O(1) user lookup by API key
  usersByEmail: new Map(),  // O(1) user lookup by lowercase email
  campaigns: [],
  rituals: [],
  habits: [],
  lootTables: { common: [], uncommon: [], rare: [], epic: [], legendary: [] },
  gearTemplates: { tiers: [], items: [], setBonus: {} },
  npcGivers: { givers: [] },
  npcState: { activeNpcs: [], cooldowns: {}, lastRotation: null, npcQuestIds: {} },
  npcStateFileExisted: false,
  appState: { version: '1.0.0' },
  feedbackEntries: [],
  rotationState: { lastDailyRotation: null, questSeed: 0, previousQuestTemplateIds: [] },
  questCatalog: { meta: { totalTemplates: 0, byCategory: { generic: 0, classQuest: 0, chainQuest: 0, companionQuest: 0 }, byClass: {}, lastUpdated: new Date().toISOString() }, templates: [] },
  questCatalogById: new Map(),  // O(1) quest template lookup by id
  classesData: { classes: [] },
  companionsData: { realTemplates: {}, virtualTemplates: {}, careQuestTemplates: {}, bondLevels: [] },
  BOND_LEVELS: [
    { level: 1,  title: 'Stranger',      minXp: 0   },
    { level: 2,  title: 'Acquaintance',  minXp: 10  },
    { level: 3,  title: 'Friend',        minXp: 25  },
    { level: 4,  title: 'Close Friend',  minXp: 50  },
    { level: 5,  title: 'Best Friend',   minXp: 80  },
    { level: 6,  title: 'Soulmate',      minXp: 120 },
    { level: 7,  title: 'Legendary I',   minXp: 200 },
    { level: 8,  title: 'Legendary II',  minXp: 300 },
    { level: 9,  title: 'Legendary III', minXp: 450 },
    { level: 10, title: 'Legendary IV',  minXp: 666 },
  ],
  roadmapData: [],
  users: {},
  playerProgress: {},
  FULL_GEAR_ITEMS: [],
  gearById: new Map(),  // O(1) gear lookup by id
  managedKeys: [],
  validApiKeys: null, // set during boot
  todayCompletions: {},
  ACHIEVEMENT_CATALOGUE: [],
  achievementMilestones: [],
  professionsData: { professions: [], materials: [], materialDropRates: {}, recipes: [] },
  weeklyChallengeData: null,
  expeditionData: null,
  expedition: null,
  // Changelog cache
  changelogCache: null,
  changelogLastFetch: 0,
  // Currency & Gacha
  currencyTemplates: { currencies: [], conversionRules: {} },
  gachaPool: { standardPool: [], featuredPool: [] },
  bannerTemplates: [],
  gachaState: {},  // keyed by playerId: { pityCounter, epicPityCounter, guaranteed5050, history }
  itemTemplates: new Map(),  // keyed by item id → full template object
  titleDefinitions: [],  // loaded from titles.json
  // Social system (friends, messages, trades)
  socialData: { friendships: [], friendRequests: [], messages: [], trades: [], activityLog: [] },
  // Unique named items (Diablo-style handcrafted legendaries)
  uniqueItems: [],
  uniqueItemsById: new Map(),
};

// ─── Init & Load Functions ──────────────────────────────────────────────────

function initStore() {
  for (const name of AGENT_NAMES) {
    const meta = AGENT_META[name] || {};
    state.store.agents[name] = {
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      status: 'offline',
      platform: null,
      uptime: 0,
      currentJobDuration: 0,
      jobsCompleted: 0,
      questsCompleted: 0,
      revenue: 0.00,
      health: 'ok',
      lastUpdate: null,
      commands: [],
      description: '',
      ...meta,
    };
  }
}

function loadData() {
  try {
    if (fs.existsSync(FILES.AGENTS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.AGENTS, 'utf8'));
      if (Array.isArray(raw)) {
        for (const a of raw) {
          const key = a.id || a.name?.toLowerCase();
          if (key && state.store.agents[key]) {
            state.store.agents[key] = { ...state.store.agents[key], ...a };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[store] Failed to load persisted data:', e.message);
  }
}

function saveData() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.AGENTS, JSON.stringify(Object.values(state.store.agents), null, 2));
  } catch (e) {
    console.warn('[store] Failed to persist data:', e.message);
  }
}

function loadQuests() {
  try {
    if (fs.existsSync(FILES.QUESTS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.QUESTS, 'utf8'));
      if (Array.isArray(raw)) {
        state.quests = raw.map(q => {
          if (!q.categories) q.categories = q.category ? [q.category] : [];
          if (q.product === undefined) q.product = null;
          if (q.humanInputRequired === undefined) q.humanInputRequired = false;
          if (q.createdBy === undefined) q.createdBy = 'unknown';
          if (q.type === undefined) q.type = 'development';
          if (q.parentQuestId === undefined) q.parentQuestId = null;
          if (q.recurrence === undefined) q.recurrence = null;
          if (q.streak === undefined) q.streak = 0;
          if (q.lastCompletedAt === undefined) q.lastCompletedAt = null;
          if (q.proof === undefined) q.proof = null;
          if (q.checklist === undefined) q.checklist = null;
          if (q.coopPartners === undefined) q.coopPartners = null;
          if (q.coopClaimed === undefined) q.coopClaimed = [];
          if (q.coopCompletions === undefined) q.coopCompletions = [];
          if (q.skills === undefined) q.skills = [];
          if (q.minLevel === undefined) q.minLevel = 1;
          return q;
        });
      }
    }
  } catch (e) {
    console.warn('[quests] Failed to load quests:', e.message);
  }
  rebuildQuestsById();
}

// Rebuild questsById Map from quests array. Call after any mutation to state.quests.
function rebuildQuestsById() {
  state.questsById.clear();
  for (const q of state.quests) {
    if (q.id) state.questsById.set(q.id, q);
  }
}

function _saveQuestsImmediate() {
  try {
    ensureRuntimeDir();
    atomicWriteSync(FILES.QUESTS, JSON.stringify(state.quests, null, 2));
  } catch (e) {
    console.warn('[quests] Failed to persist quests:', e.message);
  }
}
function saveQuests() { debouncedSave('quests', _saveQuestsImmediate); }

function loadCampaigns() {
  try {
    if (fs.existsSync(FILES.CAMPAIGNS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.CAMPAIGNS, 'utf8'));
      if (Array.isArray(raw)) state.campaigns = raw;
    }
  } catch (e) {
    console.warn('[campaigns] Failed to load campaigns:', e.message);
  }
}

function saveCampaigns() {
  debouncedSave('campaigns', () => {
    try {
      ensureRuntimeDir();
      fs.writeFileSync(FILES.CAMPAIGNS, JSON.stringify(state.campaigns, null, 2));
    } catch (e) {
      console.warn('[campaigns] Failed to persist campaigns:', e.message);
    }
  });
}

function loadRituals() {
  try {
    if (fs.existsSync(FILES.RITUALS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.RITUALS, 'utf8'));
      if (raw && Array.isArray(raw.rituals)) state.rituals = raw.rituals;
    } else {
      saveRituals();
    }
  } catch (e) { console.warn('[rituals] Failed to load:', e.message); }
}

function saveRituals() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.RITUALS, JSON.stringify({ rituals: state.rituals }, null, 2));
  } catch (e) { console.warn('[rituals] Failed to save:', e.message); }
}

function loadHabits() {
  try {
    if (fs.existsSync(FILES.HABITS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.HABITS, 'utf8'));
      if (raw && Array.isArray(raw.habits)) state.habits = raw.habits;
    } else {
      saveHabits();
    }
  } catch (e) { console.warn('[habits] Failed to load:', e.message); }
}

function saveHabits() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.HABITS, JSON.stringify({ habits: state.habits }, null, 2));
  } catch (e) { console.warn('[habits] Failed to save:', e.message); }
}

function loadLootTables() {
  try {
    if (fs.existsSync(FILES.LOOT_TABLES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.LOOT_TABLES, 'utf8'));
      if (raw) state.lootTables = raw;
    }
  } catch (e) { console.warn('[loot] Failed to load:', e.message); }
}

function loadGearTemplates() {
  try {
    if (fs.existsSync(FILES.GEAR_TEMPLATES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.GEAR_TEMPLATES, 'utf8'));
      if (raw) {
        state.gearTemplates = raw;
        state.FULL_GEAR_ITEMS.length = 0;
        state.gearById.clear();
        const setIds = ['adventurer', 'veteran', 'master', 'legendary'];
        for (const item of raw.items || []) {
          const gearItem = {
            id: item.id,
            slot: item.slot,
            tier: item.tier,
            name: item.name,
            emoji: SLOT_EMOJI[item.slot] || 'x',
            cost: item.price || 0,
            minLevel: item.reqLevel || 1,
            stats: item.stats || {},
            affixes: item.affixes || null,
            legendaryEffect: item.legendaryEffect || null,
            setId: setIds[item.tier - 1] || 'adventurer',
            rarity: item.rarity || 'common',
            desc: item.desc || '',
            shopHidden: item.shopHidden || false,
          };
          state.FULL_GEAR_ITEMS.push(gearItem);
          state.gearById.set(gearItem.id, gearItem);
        }
        console.log(`[gear] Loaded ${state.FULL_GEAR_ITEMS.length} gear items, ${raw.namedSets?.length || 0} named sets`);
      }
    }
    // Load profession-specific gear templates (gearTemplates-schmied.json, etc.)
    const profGearFiles = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('gearTemplates-') && f.endsWith('.json'));
    for (const file of profGearFiles) {
      try {
        const profRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        const profItems = profRaw.items || profRaw;
        if (!Array.isArray(profItems)) continue;
        const setIds = ['adventurer', 'veteran', 'master', 'legendary'];
        let count = 0;
        for (const item of profItems) {
          if (state.gearById.has(item.id)) continue; // skip duplicates
          const gearItem = {
            id: item.id, slot: item.slot, tier: item.tier, name: item.name,
            emoji: SLOT_EMOJI[item.slot] || 'x', cost: item.price || 0,
            minLevel: item.reqLevel || 1, stats: item.stats || {},
            affixes: item.affixes || null, fixedStats: item.fixedStats || null,
            legendaryEffect: item.legendaryEffect || null, armorType: item.armorType || null,
            setId: item.setId || setIds[(item.tier || 1) - 1] || 'adventurer',
            rarity: item.rarity || 'common', desc: item.desc || item.flavorText || '',
            shopHidden: item.shopHidden !== undefined ? item.shopHidden : true,
            source: item.source || null,
          };
          state.FULL_GEAR_ITEMS.push(gearItem);
          state.gearById.set(gearItem.id, gearItem);
          count++;
        }
        if (count > 0) console.log(`[gear] +${count} items from ${file}`);
      } catch (e) { console.warn(`[gear] Failed to load ${file}:`, e.message); }
    }
  } catch (e) { console.warn('[gear] Failed to load gear templates:', e.message); }
}

function loadNpcGivers() {
  try {
    if (fs.existsSync(FILES.NPC_GIVERS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.NPC_GIVERS, 'utf8'));
      if (raw && raw.givers) {
        state.npcGivers = raw;
        for (const giver of raw.givers) {
          const item = giver.finalReward?.item;
          if (item && !state.gearById.has(item.id)) {
            const gearItem = {
              id: item.id,
              slot: item.slot || 'amulet',
              tier: 4,
              name: item.name,
              emoji: item.emoji || 'x',
              cost: 0,
              minLevel: 1,
              stats: item.stats || {},
              setId: 'npc-reward',
              rarity: item.rarity || 'rare',
              desc: item.desc || '',
              shopHidden: true,
              npcGiverId: giver.id,
            };
            state.FULL_GEAR_ITEMS.push(gearItem);
            state.gearById.set(gearItem.id, gearItem);
          }
          // Build NPC_META from giver data
          NPC_META[giver.id] = {
            avatar: giver.portrait || null,
            color: giver.color || null,
            role: giver.title || giver.name,
            description: giver.description || '',
          };
        }
        // Merge specialNpcs (e.g. dobbie) from JSON
        if (raw.specialNpcs) {
          Object.assign(NPC_META, raw.specialNpcs);
        }
        NPC_NAMES.length = 0;
        NPC_NAMES.push(...Object.keys(NPC_META));
        console.log(`[npc] Loaded ${state.npcGivers.givers.length} NPC quest givers, ${NPC_NAMES.length} total NPCs`);
      }
    }
  } catch (e) { console.warn('[npc] Failed to load npcQuestGivers:', e.message); }
}

function loadNpcState() {
  try {
    if (fs.existsSync(FILES.NPC_STATE)) {
      state.npcStateFileExisted = true;
      const raw = JSON.parse(fs.readFileSync(FILES.NPC_STATE, 'utf8'));
      if (raw) state.npcState = { activeNpcs: [], cooldowns: {}, lastRotation: null, npcQuestIds: {}, ...raw };
    }
  } catch (e) { console.warn('[npc] Failed to load npcState:', e.message); }
}

function saveNpcState() {
  try { fs.writeFileSync(FILES.NPC_STATE, JSON.stringify(state.npcState, null, 2)); } catch (e) { console.warn('[npc] Failed to save npcState:', e.message); }
}

function loadAppState() {
  try {
    if (fs.existsSync(FILES.APP_STATE)) {
      const raw = JSON.parse(fs.readFileSync(FILES.APP_STATE, 'utf8'));
      if (raw) state.appState = { ...state.appState, ...raw };
    }
  } catch (e) { /* ignore */ }
}

function saveAppState() {
  try { fs.writeFileSync(FILES.APP_STATE, JSON.stringify(state.appState, null, 2)); } catch (e) { console.warn('[appState] Failed to save:', e.message); }
}

function loadFeedback() {
  try {
    if (fs.existsSync(FILES.FEEDBACK)) {
      state.feedbackEntries = JSON.parse(fs.readFileSync(FILES.FEEDBACK, 'utf8')) || [];
    }
  } catch (e) { /* ignore */ }
}

function saveFeedback() {
  try { fs.writeFileSync(FILES.FEEDBACK, JSON.stringify(state.feedbackEntries, null, 2)); } catch (e) { console.warn('[feedback] Failed to save:', e.message); }
}

function loadRotationState() {
  try {
    if (fs.existsSync(FILES.ROTATION_STATE)) {
      const raw = JSON.parse(fs.readFileSync(FILES.ROTATION_STATE, 'utf8'));
      if (raw) state.rotationState = { lastDailyRotation: null, questSeed: 0, previousQuestTemplateIds: [], ...raw };
    }
  } catch (e) { console.warn('[rotation] Failed to load rotationState:', e.message); }
}

function saveRotationState() {
  try { fs.writeFileSync(FILES.ROTATION_STATE, JSON.stringify(state.rotationState, null, 2)); } catch (e) { console.warn('[rotation] Failed to save rotationState:', e.message); }
}

function loadQuestCatalog() {
  try {
    if (fs.existsSync(FILES.QUEST_CATALOG)) {
      const raw = JSON.parse(fs.readFileSync(FILES.QUEST_CATALOG, 'utf8'));
      if (raw && raw.templates) {
        state.questCatalog = raw;
        // Build id→template Map and detect collisions
        state.questCatalogById.clear();
        for (const tpl of raw.templates) {
          if (!tpl.id) continue;
          if (state.questCatalogById.has(tpl.id)) {
            console.warn(`[catalog] Duplicate template id "${tpl.id}" — last definition wins`);
          }
          state.questCatalogById.set(tpl.id, tpl);
        }
        console.log(`[catalog] Loaded ${raw.templates.length} quest templates (${state.questCatalogById.size} unique)`);
      }
    } else {
      saveQuestCatalog();
    }
  } catch (e) { console.warn('[catalog] Failed to load:', e.message); }
}

function saveQuestCatalog() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.QUEST_CATALOG, JSON.stringify(state.questCatalog, null, 2));
  } catch (e) { console.warn('[catalog] Failed to persist:', e.message); }
}

function loadClasses() {
  try {
    if (fs.existsSync(FILES.CLASSES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.CLASSES, 'utf8'));
      if (raw && Array.isArray(raw.classes)) state.classesData = raw;
    } else {
      saveClasses();
    }
  } catch (e) { console.warn('[classes] Failed to load:', e.message); }
}

function saveClasses() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.CLASSES, JSON.stringify(state.classesData, null, 2));
  } catch (e) { console.warn('[classes] Failed to persist:', e.message); }
}

function loadCompanionsData() {
  try {
    if (fs.existsSync(FILES.COMPANIONS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.COMPANIONS, 'utf8'));
      if (raw) {
        state.companionsData = raw;
        if (Array.isArray(raw.bondLevels) && raw.bondLevels.length > 0) {
          state.BOND_LEVELS = raw.bondLevels;
        }
      }
    }
  } catch (e) { console.warn('[companions] Failed to load:', e.message); }
}

function loadRoadmap() {
  try {
    if (fs.existsSync(FILES.ROADMAP)) {
      const raw = JSON.parse(fs.readFileSync(FILES.ROADMAP, 'utf8'));
      if (Array.isArray(raw)) state.roadmapData = raw;
    } else {
      saveRoadmap();
    }
  } catch (e) { console.warn('[roadmap] Failed to load:', e.message); }
}

function saveRoadmap() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.ROADMAP, JSON.stringify(state.roadmapData, null, 2));
  } catch (e) { console.warn('[roadmap] Failed to persist:', e.message); }
}

// Ensure user has complete currencies object and gold accessor.
// Eliminates the dual-storage bug where u.gold and u.currencies.gold could diverge.
// After this call, u.gold is an accessor that delegates to u.currencies.gold.
function ensureUserCurrencies(u) {
  if (!u.currencies) {
    u.currencies = { ...DEFAULT_CURRENCIES, gold: u.gold || 0 };
  }
  for (const key of Object.keys(DEFAULT_CURRENCIES)) {
    if (u.currencies[key] === undefined) u.currencies[key] = 0;
  }
  // Define gold as accessor that delegates to currencies.gold
  const desc = Object.getOwnPropertyDescriptor(u, 'gold');
  if (!desc || !desc.get) {
    // Migrate: if gold is a data property, sync its value into currencies
    if (desc) {
      const dataGold = desc.value || 0;
      if (u.currencies.gold !== dataGold) u.currencies.gold = dataGold;
    }
    Object.defineProperty(u, 'gold', {
      get() { return this.currencies.gold; },
      set(v) { this.currencies.gold = v; },
      enumerable: true,
      configurable: true,
    });
  }
}

function loadUsers() {
  try {
    if (fs.existsSync(FILES.USERS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.USERS, 'utf8'));
      if (raw && typeof raw === 'object') state.users = raw;
    }
  } catch (e) { console.warn('[users] Failed to load:', e.message); }
  for (const u of Object.values(state.users)) {
    if (u.streakDays    === undefined) u.streakDays    = 0;
    if (u.streakLastDate=== undefined) u.streakLastDate= null;
    if (u.forgeTemp     === undefined) u.forgeTemp     = 100;
    if (!u.earnedAchievements)         u.earnedAchievements = [];
    if (!u._allCompletedTypes)         u._allCompletedTypes = [];
    if (!Array.isArray(u.activeBuffs)) u.activeBuffs = [];
    ensureUserCurrencies(u);
  }
  rebuildUserIndexes();
}

// Rebuild user lookup Maps. Call after adding/modifying users.
function rebuildUserIndexes() {
  state.usersByName.clear();
  state.usersByApiKey.clear();
  state.usersByEmail.clear();
  for (const u of Object.values(state.users)) {
    if (u.name) state.usersByName.set(u.name.toLowerCase(), u);
    if (u.apiKey) state.usersByApiKey.set(u.apiKey, u);
    if (u.email) state.usersByEmail.set(u.email.toLowerCase(), u);
  }
}

function _saveUsersImmediate() {
  try {
    ensureRuntimeDir();
    atomicWriteSync(FILES.USERS, JSON.stringify(state.users, null, 2));
  } catch (e) { console.warn('[users] Failed to save:', e.message); }
}
function saveUsers() { debouncedSave('users', _saveUsersImmediate); }

function loadPlayerProgress() {
  if (fs.existsSync(FILES.PLAYER_PROGRESS)) {
    try {
      const raw = JSON.parse(fs.readFileSync(FILES.PLAYER_PROGRESS, 'utf8'));
      if (raw && typeof raw === 'object') state.playerProgress = raw;
    } catch (e) { console.warn('[playerProgress] Failed to load:', e.message); }
  } else {
    for (const q of state.quests) {
      if (!PLAYER_QUEST_TYPES.includes(q.type)) continue;
      if (q.completedBy && q.status === 'completed') {
        const uid = q.completedBy.toLowerCase();
        if (!state.playerProgress[uid]) state.playerProgress[uid] = { completedQuests: {}, claimedQuests: [] };
        state.playerProgress[uid].completedQuests[q.id] = { at: q.completedAt || new Date().toISOString(), proof: q.proof || null };
      }
    }
    savePlayerProgress();
    console.log('[playerProgress] Migrated from existing quests');
  }
  for (const uid of Object.keys(state.playerProgress)) {
    if (!state.playerProgress[uid].completedQuests) state.playerProgress[uid].completedQuests = {};
    if (!Array.isArray(state.playerProgress[uid].claimedQuests)) state.playerProgress[uid].claimedQuests = [];
    if (!state.playerProgress[uid].npcQuests) state.playerProgress[uid].npcQuests = {};
  }
}

function _savePlayerProgressImmediate() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.PLAYER_PROGRESS, JSON.stringify(state.playerProgress, null, 2));
  } catch (e) { console.warn('[playerProgress] Failed to save:', e.message); }
}
function savePlayerProgress() { debouncedSave('playerProgress', _savePlayerProgressImmediate); }

function loadManagedKeys() {
  try {
    if (fs.existsSync(FILES.KEYS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.KEYS, 'utf8'));
      if (Array.isArray(raw)) {
        state.managedKeys = raw;
        for (const k of state.managedKeys) { if (state.validApiKeys) state.validApiKeys.add(k.key); }
      }
    }
  } catch (_) {}
}

function saveManagedKeys() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.KEYS, JSON.stringify(state.managedKeys, null, 2));
  } catch (_) {}
}

// ─── Currency & Gacha load/save ─────────────────────────────────────────────
function loadCurrencyTemplates() {
  try {
    if (fs.existsSync(FILES.CURRENCY_TEMPLATES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.CURRENCY_TEMPLATES, 'utf8'));
      if (raw) state.currencyTemplates = raw;
    }
  } catch (e) { console.warn('[currency] Failed to load templates:', e.message); }
}

function loadGachaPool() {
  try {
    if (fs.existsSync(FILES.GACHA_POOL)) {
      const raw = JSON.parse(fs.readFileSync(FILES.GACHA_POOL, 'utf8'));
      if (raw) state.gachaPool = raw;
    }
  } catch (e) { console.warn('[gacha] Failed to load pool:', e.message); }
}

function loadBannerTemplates() {
  try {
    if (fs.existsSync(FILES.BANNER_TEMPLATES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.BANNER_TEMPLATES, 'utf8'));
      if (Array.isArray(raw)) state.bannerTemplates = raw;
    }
  } catch (e) { console.warn('[gacha] Failed to load banners:', e.message); }
}

function loadGachaState() {
  try {
    if (fs.existsSync(FILES.GACHA_STATE)) {
      const raw = JSON.parse(fs.readFileSync(FILES.GACHA_STATE, 'utf8'));
      if (raw && typeof raw === 'object') state.gachaState = raw;
    }
  } catch (e) { console.warn('[gacha] Failed to load state:', e.message); }
}

function saveGachaState() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.GACHA_STATE, JSON.stringify(state.gachaState, null, 2));
  } catch (e) { console.warn('[gacha] Failed to save state:', e.message); }
}

// ─── Item Templates ─────────────────────────────────────────────────────────
function loadItemTemplates() {
  try {
    if (fs.existsSync(FILES.ITEM_TEMPLATES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.ITEM_TEMPLATES, 'utf8'));
      if (raw && Array.isArray(raw.items)) {
        state.itemTemplates = new Map();
        let dupes = 0;
        for (const item of raw.items) {
          if (!item.id) continue;
          if (state.itemTemplates.has(item.id)) {
            console.warn(`[items] Duplicate item id "${item.id}" — last definition wins`);
            dupes++;
          }
          state.itemTemplates.set(item.id, item);
        }
        console.log(`[items] Loaded ${state.itemTemplates.size} item templates${dupes ? ` (${dupes} duplicates)` : ''}`);
      }
    }
  } catch (e) { console.warn('[items] Failed to load item templates:', e.message); }
}

function loadTitles() {
  try {
    if (fs.existsSync(FILES.TITLES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.TITLES, 'utf8'));
      if (raw && Array.isArray(raw.titles)) {
        state.titleDefinitions = raw.titles;
        console.log(`[titles] Loaded ${state.titleDefinitions.length} title definitions`);
      }
    }
  } catch (e) { console.warn('[titles] Failed to load:', e.message); }
}

function loadUniqueItems() {
  try {
    if (fs.existsSync(FILES.UNIQUE_ITEMS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.UNIQUE_ITEMS, 'utf8'));
      if (raw && Array.isArray(raw.uniques)) {
        state.uniqueItems = raw.uniques;
        state.uniqueItemsById.clear();
        for (const item of raw.uniques) {
          state.uniqueItemsById.set(item.id, item);
        }
        console.log(`[unique-items] Loaded ${state.uniqueItems.length} unique items`);
      }
    }
  } catch (e) { console.warn('[unique-items] Failed to load:', e.message); }
}

function resolveItem(itemId) {
  if (!itemId) return null;
  // Direct lookup in item templates (Map — O(1))
  const tmpl = state.itemTemplates.get(itemId);
  if (tmpl) return tmpl;
  // Fallback: check gearById Map (O(1) instead of O(n) array scan)
  const gear = state.gearById.get(itemId);
  if (gear) return { ...gear, type: 'equipment', minLevel: gear.minLevel || 1 };
  return null;
}

function getActiveBuffs(userId) {
  const u = state.users[userId];
  if (!u || !Array.isArray(u.activeBuffs)) return [];
  const now = Date.now();
  // Filter out expired buffs and clean up
  u.activeBuffs = u.activeBuffs.filter(b => {
    if (!b.expiresAt) return true; // permanent buffs
    return new Date(b.expiresAt).getTime() > now;
  });
  return u.activeBuffs;
}

// ─── Social load/save ────────────────────────────────────────────────────────
function loadSocialData() {
  try {
    if (fs.existsSync(FILES.SOCIAL)) {
      const raw = JSON.parse(fs.readFileSync(FILES.SOCIAL, 'utf8'));
      if (raw && typeof raw === 'object') {
        state.socialData = {
          friendships: raw.friendships || [],
          friendRequests: raw.friendRequests || [],
          messages: raw.messages || [],
          trades: raw.trades || [],
          activityLog: raw.activityLog || [],
        };
      }
    }
  } catch (e) { console.warn('[social] Failed to load:', e.message); }
}

function _saveSocialImmediate() {
  try {
    ensureRuntimeDir();
    fs.writeFileSync(FILES.SOCIAL, JSON.stringify(state.socialData, null, 2));
  } catch (e) { console.warn('[social] Failed to save:', e.message); }
}
function saveSocial() { debouncedSave('social', _saveSocialImmediate); }

// ─── Activity Feed ──────────────────────────────────────────────────────────

const MAX_ACTIVITY_LOG = 500;

/**
 * Log an activity event for the feed. Types:
 * quest_complete, level_up, achievement, gacha_pull, trade_complete, streak_milestone
 */
function logActivity(playerId, type, data) {
  if (!state.socialData.activityLog) state.socialData.activityLog = [];
  state.socialData.activityLog.unshift({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    player: playerId,
    type,
    data,
    at: new Date().toISOString(),
  });
  // Cap to prevent unbounded growth
  if (state.socialData.activityLog.length > MAX_ACTIVITY_LOG) {
    state.socialData.activityLog.length = MAX_ACTIVITY_LOG;
  }
  saveSocial();
}

// ─── Exports ────────────────────────────────────────────────────────────────
module.exports = {
  // Paths
  DATA_DIR,
  RUNTIME_DIR,
  FILES,
  // Helpers
  tryLoadJsonSync,
  ensureDataDir,
  ensureRuntimeDir,
  ensureRuntimeFiles,
  seedMutableFiles,
  ensureTemplateFiles,
  // Config (immutable)
  TIMEZONE,
  PLAYER_QUEST_TYPES,
  AGENT_NAMES,
  AGENT_META,
  NPC_META,
  NPC_NAMES,
  QUEST_FLAVOR,
  CAMPAIGN_NPCS,
  LEVELS,
  XP_BY_PRIORITY,
  GOLD_BY_PRIORITY,
  TEMP_BY_PRIORITY,
  XP_BY_RARITY,
  GOLD_BY_RARITY,
  RUNENSPLITTER_BY_RARITY,
  DEFAULT_CURRENCIES,
  STREAK_MILESTONES,
  RARITY_WEIGHTS,
  RARITY_COLORS,
  RARITY_ORDER,
  EQUIPMENT_SLOTS,
  SLOT_EMOJI,
  SHOP_ITEMS,
  GEAR_TIERS,
  SET_BONUSES,
  NPC_MAX_ACTIVE,
  NPC_SPAWN_CHANCE,
  NPC_ROTATION_MS,
  NPC_PERMANENT_IDS,
  NPC_DEFAULT_WEIGHTS,
  // Mutable state (live reference)
  state,
  // Load/save functions
  initStore,
  loadData,
  saveData,
  loadQuests,
  saveQuests,
  rebuildQuestsById,
  rebuildUserIndexes,
  loadCampaigns,
  saveCampaigns,
  loadRituals,
  saveRituals,
  loadHabits,
  saveHabits,
  loadLootTables,
  loadGearTemplates,
  loadNpcGivers,
  loadNpcState,
  saveNpcState,
  loadAppState,
  saveAppState,
  loadFeedback,
  saveFeedback,
  loadRotationState,
  saveRotationState,
  loadQuestCatalog,
  saveQuestCatalog,
  loadClasses,
  saveClasses,
  loadCompanionsData,
  loadRoadmap,
  saveRoadmap,
  ensureUserCurrencies,
  loadUsers,
  saveUsers,
  saveUsersSync: _saveUsersImmediate,
  loadPlayerProgress,
  savePlayerProgress,
  loadManagedKeys,
  saveManagedKeys,
  loadCurrencyTemplates,
  loadGachaPool,
  loadBannerTemplates,
  loadGachaState,
  saveGachaState,
  loadItemTemplates,
  loadTitles,
  loadUniqueItems,
  resolveItem,
  getActiveBuffs,
  evaluateAchievementCondition,
  flushPendingSaves,
  loadSocialData,
  saveSocial,
  logActivity,
};
