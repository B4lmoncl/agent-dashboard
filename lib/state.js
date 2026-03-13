/**
 * Shared State Module — Single source of truth for all in-memory data.
 * All route files import from here. Never duplicate state.
 */
const fs = require('fs');
const path = require('path');

// ─── File Paths ──────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

const FILES = {
  AGENTS:          path.join(DATA_DIR, 'agents.json'),
  QUESTS:          path.join(DATA_DIR, 'quests.json'),
  KEYS:            path.join(DATA_DIR, 'keys.json'),
  USERS:           path.join(DATA_DIR, 'users.json'),
  CAMPAIGNS:       path.join(DATA_DIR, 'campaigns.json'),
  PLAYER_PROGRESS: path.join(DATA_DIR, 'playerProgress.json'),
  QUEST_CATALOG:   path.join(DATA_DIR, 'questCatalog.json'),
  CLASSES:         path.join(DATA_DIR, 'classes.json'),
  ROADMAP:         path.join(DATA_DIR, 'roadmap.json'),
  COMPANIONS:      path.join(DATA_DIR, 'companions.json'),
  RITUALS:         path.join(DATA_DIR, 'rituals.json'),
  HABITS:          path.join(DATA_DIR, 'habits.json'),
  LOOT_TABLES:     path.join(DATA_DIR, 'lootTables.json'),
  GEAR_TEMPLATES:  path.join(DATA_DIR, 'gearTemplates.json'),
  NPC_GIVERS:      path.join(DATA_DIR, 'npcQuestGivers.json'),
  NPC_STATE:       path.join(DATA_DIR, 'npcState.json'),
  APP_STATE:       path.join(DATA_DIR, 'appState.json'),
  FEEDBACK:        path.join(DATA_DIR, 'feedback.json'),
  ROTATION_STATE:  path.join(DATA_DIR, 'rotationState.json'),
  GAME_CONFIG:     path.join(DATA_DIR, 'gameConfig.json'),
  LEVELS:          path.join(DATA_DIR, 'levels.json'),
  CAMPAIGN_NPCS:   path.join(DATA_DIR, 'campaignNpcs.json'),
  QUEST_FLAVOR:    path.join(DATA_DIR, 'questFlavor.json'),
  ACHIEVEMENTS:    path.join(DATA_DIR, 'achievements.json'),
  ACHIEVEMENT_TEMPLATES: path.join(DATA_DIR, 'achievementTemplates.json'),
  CURRENCY_TEMPLATES: path.join(DATA_DIR, 'currencyTemplates.json'),
  GACHA_POOL:      path.join(DATA_DIR, 'gachaPool.json'),
  BANNER_TEMPLATES: path.join(DATA_DIR, 'bannerTemplates.json'),
  GACHA_STATE:     path.join(DATA_DIR, 'gachaState.json'),
};

// ─── Sync JSON load helper ──────────────────────────────────────────────────
function tryLoadJsonSync(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.warn(`[config] Failed to load ${path.basename(file)}: ${e.message}`); }
  return fallback;
}

// ─── Ensure data dir exists ─────────────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Template seeding (Docker volume may overwrite build files) ─────────────
// Template files are read-only definitions that ship with the image.
// If the data volume doesn't have them, copy from a bundled fallback dir.
const TEMPLATE_FALLBACK_DIR = path.join(__dirname, '..', 'templates');

const TEMPLATE_FILES = [
  'achievementTemplates.json',
  'itemTemplates.json',
  'ritualVowTemplates.json',
  'seasonTemplates.json',
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
const PLAYER_QUEST_TYPES = ['personal', 'learning', 'fitness', 'social', 'relationship-coop', 'companion'];

// Admin key (hardcoded fallback)
const ADMIN_KEY = '608f596d4b64d994b1f1624256f00549';

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
  lyra:  { avatar: '✦', color: '#e879f9', role: 'Die Sternenwächterin', description: 'Die leuchtende Strategin. Geschmiedet im Sternenlicht, gehärtet im Chaos. ✨' },
  forge: { avatar: '⚒', color: '#f59e0b', role: 'Idea Smith', description: 'Silent craftsman' },
};

const NPC_META = {
  dobbie:       { avatar: '🐱', color: '#ff6b9d', role: 'Cat Overlord', description: 'Dobbie the demanding house cat. His requests are not optional. Resistance is futile.' },
  'npc-dobbie': { avatar: '🐱', color: '#ff6b9d', role: 'Cat Overlord', description: 'Dobbie the demanding house cat. His requests are not optional. Resistance is futile.' },
};
const NPC_NAMES = Object.keys(NPC_META);

// ─── Economy constants (from gameConfig.json) ───────────────────────────────
const XP_BY_PRIORITY   = _gameConfig.xpByPriority   || { high: 30, medium: 20, low: 10 };
const GOLD_BY_PRIORITY = _gameConfig.goldByPriority  || { high: [20, 30], medium: [12, 20], low: [6, 12] };
const TEMP_BY_PRIORITY = _gameConfig.tempByPriority  || { high: 15, medium: 10, low: 5 };

// Streak milestones
const STREAK_MILESTONES = _gameConfig.streakMilestones || [
  { days: 7,   badge: '🥉', label: 'Bronze',           xpBonus: 5,  lootTier: null },
  { days: 14,  badge: '🎁', label: '2-Wochen',         xpBonus: 0,  lootTier: 'uncommon' },
  { days: 21,  badge: '🥈', label: 'Silber',           xpBonus: 10, lootTier: null },
  { days: 30,  badge: '📅', label: 'Monat',            xpBonus: 0,  lootTier: 'rare' },
  { days: 60,  badge: '🥇', label: 'Gold',             xpBonus: 15, lootTier: null },
  { days: 90,  badge: '🗿', label: 'Unerschütterlich', xpBonus: 0,  lootTier: 'epic' },
  { days: 180, badge: '💎', label: 'Diamond',          xpBonus: 25, lootTier: null },
  { days: 365, badge: '🟠', label: 'Legendary',        xpBonus: 0,  lootTier: 'legendary' },
];

// Loot config
const RARITY_WEIGHTS = _gameConfig.rarityWeights || { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
const RARITY_COLORS  = _gameConfig.rarityColors  || {
  common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f97316',
};
const RARITY_ORDER = _gameConfig.rarityOrder || ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Equipment
const EQUIPMENT_SLOTS = _gameConfig.equipmentSlots || ['weapon', 'shield', 'helm', 'armor', 'amulet', 'boots'];
const SLOT_EMOJI = { weapon: 'x', shield: 'x', helm: 'x', armor: 'x', amulet: 'x', boots: 'x' };

// Shop / gear tiers
const SHOP_ITEMS = [
  { id: 'gaming_1h',   name: '1h Gaming',      cost: 100, icon: '🎮', desc: '1 hour of guilt-free gaming' },
  { id: 'snack_break', name: 'Snack Break',     cost: 25,  icon: '🍕', desc: 'Treat yourself to a snack' },
  { id: 'day_off',     name: 'Day Off Quest',   cost: 500, icon: '🏖', desc: 'Skip one day of recurring quests' },
  { id: 'movie_night', name: 'Movie Night',     cost: 150, icon: '🎬', desc: 'Evening off for a movie' },
  { id: 'sleep_in',    name: 'Sleep In',        cost: 75,  icon: '😴', desc: 'Extra hour of sleep, guilt-free' },
];

const GEAR_TIERS = [
  { id: 'worn',       name: 'Worn Tools',       cost: 0,    tier: 0, xpBonus: 0,  icon: '🔨', desc: 'Starting gear. No bonus.' },
  { id: 'sturdy',     name: 'Sturdy Tools',     cost: 100,  tier: 1, xpBonus: 5,  icon: '⚒',  desc: '+5% XP on all quests' },
  { id: 'masterwork', name: 'Masterwork Tools', cost: 300,  tier: 2, xpBonus: 10, icon: '🛠',  desc: '+10% XP on all quests' },
  { id: 'legendary',  name: 'Legendary Tools',  cost: 700,  tier: 3, xpBonus: 15, icon: '⚙',  desc: '+15% XP on all quests' },
  { id: 'mythic',     name: 'Mythic Forge',     cost: 1500, tier: 4, xpBonus: 25, icon: '🔱', desc: '+25% XP on all quests' },
];

const SET_BONUSES = {
  adventurer: { name: 'Abenteurer-Set', tier: 1 },
  veteran:    { name: 'Veteranen-Set',  tier: 2 },
  master:     { name: 'Meister-Set',    tier: 3 },
  legendary:  { name: 'Legendäres Set', tier: 4 },
};

// NPC auto-rotation constants
const NPC_MAX_ACTIVE       = 7;
const NPC_SPAWN_CHANCE     = 0.30;
const NPC_ROTATION_MS      = 30 * 60 * 1000;
const NPC_PERMANENT_IDS    = new Set(['lyra-permanent']);
const NPC_DEFAULT_WEIGHTS  = { common: 50, uncommon: 25, rare: 15, epic: 8, legendary: 2 };

// Achievement flavor text
const ACHIEVEMENT_FLAVOR = {
  'first_quest':    "Every legend begins with a single step through the Quest Hall gates. You have drawn your blade and answered the call—your journey is forged.",
  'hot_streak':     "Five quests felled between dawn and dusk—the Forge burns white-hot with your relentless fury. The Guild has not seen such fervor in an age.",
  'dedicated':      "Seven days, seven victories. Your hammer has struck the anvil without rest, and the Forge recognizes the tempered will of a true Guild artisan.",
  'marathoner':     "Thirty unbroken days of conquest—a feat whispered about in Guild halls across the realm. Your discipline has been smelted into something unbreakable.",
  'boss_slayer':    "The beast is slain, its shadow lifted from the Quest Hall. Where others faltered, you stood your ground and drove your blade home.",
  'companion_collector': "Three Forge Companions now answer your call—spirits of flame, stone, and arcana bound to your will. Together, no quest is beyond reach.",
  'gear_master':    "You bear arms of Mythic make, forged in fires that predate the Guild itself. Few have proven worthy enough to wield such storied steel.",
  'gold_hoarder':   "A thousand gold gleams in your vault—a fortune earned quest by quest, strike by strike. The Guild Treasury echoes with the weight of your ambition.",
  'completionist':  "One hundred quests, inscribed and sealed in the Guild ledger. Your name is etched deep into the Quest Hall's living stone.",
  'legend':         "Five hundred quests completed—mortal no longer in the eyes of the Guild. Bards shall sing of your deeds long after the last Forge grows cold.",
  'early_bird':     "Three quests vanquished before the sun crests the ramparts. The Guild's dawn bell tolls in your honor—first to rise, first to conquer.",
  'night_owl':      "While the Guild sleeps, you hunt by moonlight and ember-glow. Three quests claimed from the dark—proof that your Forge never truly dims.",
  'master_forger':  "Seven days at maximum Forge Temperature without a single falter—a feat of mastery that crowns you among the Guild's most elite smiths. The flames themselves bend to your command.",
  'versatile':      "Five disciplines conquered in a single week—blade, tome, shield, craft, and cunning alike. The Guild forges specialists, but legends are built from versatility.",
};

// Achievement triggers
const ACHIEVEMENT_TRIGGERS = {
  'first_quest':       (u) => (u.questsCompleted || 0) >= 1,
  'apprentice':        (u) => (u.questsCompleted || 0) >= 10,
  'knight':            (u) => (u.questsCompleted || 0) >= 50,
  'legend':            (u) => (u.questsCompleted || 0) >= 100,
  'week_warrior':      (u) => (u.streakDays || 0) >= 7,
  'monthly_champ':     (u) => (u.streakDays || 0) >= 30,
  'lightning':         (u) => (u._todayCount || 0) >= 3,
  'all_trades':        (u) => (u._completedTypes || new Set()).size >= 5,
  'boss_slayer':       (u) => (u._bossDefeated || false),
  'ember_sprite':      (u) => (u._devCount || 0) >= 10,
  'lore_owl':          (u) => (u._learningCount || 0) >= 5,
  'gear_golem':        (u) => (u.xp || 0) >= 300,
  'challenge_coder':   (u) => (u._challengesCompleted || []).includes('code_sprint'),
  'challenge_learner': (u) => (u._challengesCompleted || []).includes('learning_marathon'),
  'social_butterfly':  (u) => (u._socialCount || 0) >= 5,
  'scholar':           (u) => (u._learningCount || 0) >= 10,
  'gym_rat':           (u) => (u._fitnessCount || 0) >= 10,
  'forge_novice':      (u) => (u._devCount || 0) >= 1,
  'arena_first':       (u) => (u._fitnessCount || 0) >= 1,
  'scholar_first':     (u) => (u._learningCount || 0) >= 1,
  'ten_quests':        (u) => (u.questsCompleted || 0) >= 10,
  'fifty_quests':      (u) => (u.questsCompleted || 0) >= 50,
  'perfectionist':     (u) => (u.questsCompleted || 0) >= 100,
  'no_rest':           (u) => (u.streakDays || 0) >= 30,
  'one_ring':          (u) => (u.gold || 0) >= 1000,
};

// ─── Mutable state ──────────────────────────────────────────────────────────
// These are exported as objects so route files get a live reference.
// Always mutate the .value property or array/object in-place.
const state = {
  store: { agents: {} },
  quests: [],
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
  managedKeys: [],
  validApiKeys: null, // set during boot
  todayCompletions: {},
  ACHIEVEMENT_CATALOGUE: [],
  // Changelog cache
  changelogCache: null,
  changelogLastFetch: 0,
  // Currency & Gacha
  currencyTemplates: { currencies: [], conversionRules: {} },
  gachaPool: { standardPool: [], featuredPool: [] },
  bannerTemplates: [],
  gachaState: {},  // keyed by playerId: { pityCounter, epicPityCounter, guaranteed5050, history }
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
    ensureDataDir();
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
}

function saveQuests() {
  try {
    ensureDataDir();
    fs.writeFileSync(FILES.QUESTS, JSON.stringify(state.quests, null, 2));
  } catch (e) {
    console.warn('[quests] Failed to persist quests:', e.message);
  }
}

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
  try {
    ensureDataDir();
    fs.writeFileSync(FILES.CAMPAIGNS, JSON.stringify(state.campaigns, null, 2));
  } catch (e) {
    console.warn('[campaigns] Failed to persist campaigns:', e.message);
  }
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
    ensureDataDir();
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
    ensureDataDir();
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
        const setIds = ['adventurer', 'veteran', 'master', 'legendary'];
        for (const item of raw.items || []) {
          state.FULL_GEAR_ITEMS.push({
            id: item.id,
            slot: item.slot,
            tier: item.tier,
            name: item.name,
            emoji: SLOT_EMOJI[item.slot] || 'x',
            cost: item.price || 0,
            minLevel: item.reqLevel || 1,
            stats: item.stats || {},
            setId: setIds[item.tier - 1] || 'adventurer',
            rarity: item.rarity || 'common',
            desc: item.desc || '',
            shopHidden: item.shopHidden || false,
          });
        }
        console.log(`[gear] Loaded ${state.FULL_GEAR_ITEMS.length} gear items, ${raw.namedSets?.length || 0} named sets`);
      }
    }
  } catch (e) { console.warn('[gear] Failed to load gear templates:', e.message); }
}

function loadNpcGivers() {
  try {
    if (fs.existsSync(FILES.NPC_GIVERS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.NPC_GIVERS, 'utf8'));
      if (raw && raw.givers) {
        state.npcGivers = raw;
        const existingIds = new Set(state.FULL_GEAR_ITEMS.map(g => g.id));
        for (const giver of raw.givers) {
          const item = giver.finalReward?.item;
          if (item && !existingIds.has(item.id)) {
            state.FULL_GEAR_ITEMS.push({
              id: item.id,
              slot: item.slot || 'amulet',
              tier: 4,
              name: item.name,
              emoji: item.emoji || '🎒',
              cost: 0,
              minLevel: 1,
              stats: item.stats || {},
              setId: 'npc-reward',
              rarity: item.rarity || 'rare',
              desc: item.desc || '',
              shopHidden: true,
              npcGiverId: giver.id,
            });
            existingIds.add(item.id);
          }
        }
        console.log(`[npc] Loaded ${state.npcGivers.givers.length} NPC quest givers`);
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
  try { fs.writeFileSync(FILES.APP_STATE, JSON.stringify(state.appState, null, 2)); } catch (e) {}
}

function loadFeedback() {
  try {
    if (fs.existsSync(FILES.FEEDBACK)) {
      state.feedbackEntries = JSON.parse(fs.readFileSync(FILES.FEEDBACK, 'utf8')) || [];
    }
  } catch (e) { /* ignore */ }
}

function saveFeedback() {
  try { fs.writeFileSync(FILES.FEEDBACK, JSON.stringify(state.feedbackEntries, null, 2)); } catch (e) {}
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
      if (raw && raw.templates) state.questCatalog = raw;
    } else {
      saveQuestCatalog();
    }
  } catch (e) { console.warn('[catalog] Failed to load:', e.message); }
}

function saveQuestCatalog() {
  try {
    ensureDataDir();
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
    ensureDataDir();
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
    ensureDataDir();
    fs.writeFileSync(FILES.ROADMAP, JSON.stringify(state.roadmapData, null, 2));
  } catch (e) { console.warn('[roadmap] Failed to persist:', e.message); }
}

function loadUsers() {
  try {
    if (fs.existsSync(FILES.USERS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.USERS, 'utf8'));
      if (raw && typeof raw === 'object') state.users = raw;
    }
  } catch (e) { console.warn('[users] Failed to load:', e.message); }
  if (!state.users['leon']) {
    state.users['leon'] = { id: 'leon', name: 'Leon', avatar: 'L', color: '#f59e0b', xp: 0, questsCompleted: 0, achievements: [], createdAt: new Date().toISOString() };
  }
  for (const u of Object.values(state.users)) {
    if (u.streakDays    === undefined) u.streakDays    = 0;
    if (u.streakLastDate=== undefined) u.streakLastDate= null;
    if (u.forgeTemp     === undefined) u.forgeTemp     = 100;
    if (u.gold          === undefined) u.gold          = 0;
    if (!u.earnedAchievements)         u.earnedAchievements = [];
    if (!u._allCompletedTypes)         u._allCompletedTypes = [];
    // Multi-currency migration: copy gold into currencies object, init others to 0
    if (!u.currencies) {
      u.currencies = {
        gold: u.gold || 0,
        stardust: 0,
        essenz: 0,
        runensplitter: 0,
        gildentaler: 0,
        mondstaub: 0,
      };
    }
    // Keep gold in sync
    u.currencies.gold = u.gold || 0;
  }
}

function saveUsers() {
  try {
    ensureDataDir();
    fs.writeFileSync(FILES.USERS, JSON.stringify(state.users, null, 2));
  } catch (e) { console.warn('[users] Failed to save:', e.message); }
}

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
  }
}

function savePlayerProgress() {
  try {
    ensureDataDir();
    fs.writeFileSync(FILES.PLAYER_PROGRESS, JSON.stringify(state.playerProgress, null, 2));
  } catch (e) { console.warn('[playerProgress] Failed to save:', e.message); }
}

function loadManagedKeys() {
  try {
    if (fs.existsSync(FILES.KEYS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.KEYS, 'utf8'));
      if (Array.isArray(raw)) {
        state.managedKeys = raw;
        for (const k of state.managedKeys) state.validApiKeys.add(k.key);
      }
    }
  } catch (_) {}
}

function saveManagedKeys() {
  try {
    ensureDataDir();
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
    ensureDataDir();
    fs.writeFileSync(FILES.GACHA_STATE, JSON.stringify(state.gachaState, null, 2));
  } catch (e) { console.warn('[gacha] Failed to save state:', e.message); }
}

// ─── Exports ────────────────────────────────────────────────────────────────
module.exports = {
  // Paths
  DATA_DIR,
  FILES,
  // Helpers
  tryLoadJsonSync,
  ensureDataDir,
  ensureTemplateFiles,
  // Config (immutable)
  TIMEZONE,
  ADMIN_KEY,
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
  ACHIEVEMENT_FLAVOR,
  ACHIEVEMENT_TRIGGERS,
  // Mutable state (live reference)
  state,
  // Load/save functions
  initStore,
  loadData,
  saveData,
  loadQuests,
  saveQuests,
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
  loadUsers,
  saveUsers,
  loadPlayerProgress,
  savePlayerProgress,
  loadManagedKeys,
  saveManagedKeys,
  loadCurrencyTemplates,
  loadGachaPool,
  loadBannerTemplates,
  loadGachaState,
  saveGachaState,
};
