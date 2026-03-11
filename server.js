/**
 * Agent Dashboard - REST API Server
 * Run: node server.js
 * Serves: http://localhost:3001
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'public', 'data');
const AGENTS_FILE          = path.join(DATA_DIR, 'agents.json');
const QUESTS_FILE          = path.join(DATA_DIR, 'quests.json');
const KEYS_FILE            = path.join(DATA_DIR, 'keys.json');
const USERS_FILE           = path.join(DATA_DIR, 'users.json');
const CAMPAIGNS_FILE       = path.join(DATA_DIR, 'campaigns.json');
const PLAYER_PROGRESS_FILE = path.join(DATA_DIR, 'playerProgress.json');
const QUEST_CATALOG_FILE   = path.join(DATA_DIR, 'questCatalog.json');
const CLASSES_FILE         = path.join(DATA_DIR, 'classes.json');
const ROADMAP_FILE         = path.join(DATA_DIR, 'roadmap.json');
const COMPANIONS_FILE      = path.join(DATA_DIR, 'companions.json');
const RITUALS_FILE         = path.join(DATA_DIR, 'rituals.json');
const HABITS_FILE          = path.join(DATA_DIR, 'habits.json');
const LOOT_TABLES_FILE     = path.join(DATA_DIR, 'lootTables.json');
const GEAR_TEMPLATES_FILE  = path.join(DATA_DIR, 'gearTemplates.json');
const NPC_GIVERS_FILE      = path.join(DATA_DIR, 'npcQuestGivers.json');
const NPC_STATE_FILE       = path.join(DATA_DIR, 'npcState.json');
const APP_STATE_FILE       = path.join(DATA_DIR, 'appState.json');

// Quest types that are tracked per-player (not shared/global)
const PLAYER_QUEST_TYPES = ['personal', 'learning', 'fitness', 'social', 'relationship-coop', 'companion'];

app.use(cors());
app.use(express.json());

// ─── Admin Key (hardcoded fallback) ─────────────────────────────────────────
const ADMIN_KEY = '608f596d4b64d994b1f1624256f00549';

// ─── Quest Flavor Text ───────────────────────────────────────────────────────
const QUEST_FLAVOR = {
  development: {
    completionMessage: "⚒️ **PROTOCOL FORGED.** The anvil cools and your creation hums with power. Another artifact added to the Guild vault. The Forge Masters nod in approval — your craft grows sharper with every strike.",
    streakBonus: {
      "3":  "🔥 3-day Forge Streak! The anvil hasn't cooled in days. You're entering a state the old smiths called *The Endless Heat*.",
      "7":  "⚒️🔥 7-day Forge Streak! The Guild speaks your name in whispers. They call you Ironhand — one who never lets the fire die.",
      "14": "🌋 14-day Forge Streak! You've transcended mortal crafting. The Forge itself bends to your will. Legendary Artificer status unlocked.",
      "30": "💎⚒️ 30-day Forge Streak! The Council of Master Smiths has no choice but to acknowledge a new peer. You are now part of the living legend of the Guild.",
    },
  },
  learning: {
    completionMessage: "📜 **KNOWLEDGE ACQUIRED.** The Archive glows as a new understanding etches itself into your mind. You feel the subtle shift — you are not who you were when you opened that first page. The Guild's Lorekeepers record your advancement.",
    streakBonus: {
      "3":  "📖 3-day Study Streak! The candles in the Archive burn for you alone. Your mind sharpens like a blade on the whetstone of knowledge.",
      "7":  "🧠📖 7-day Study Streak! The Lorekeepers have taken notice. They've started leaving rare texts on your desk — they see potential for mastery.",
      "14": "🌟 14-day Study Streak! You've entered the Scholar's Flow. Concepts that once seemed like foreign runes now read like your mother tongue.",
      "30": "👁️📜 30-day Study Streak! The Grand Lorekeeper has granted you a key to the Restricted Section. Few have ever earned this honor. Your intellect is now a Guild-tier weapon.",
    },
  },
  personal: {
    completionMessage: "🏰 **DOMAIN SECURED.** Your quarters are fortified, your supplies restocked, your chaos tamed. It's invisible work, but the Guild knows — operational readiness is what wins wars. Respect earned where it matters most: in the foundation.",
    streakBonus: {
      "3":  "🧱 3-day Upkeep Streak! Your domain runs like a well-oiled siege engine. Consistency is the unsexy superpower, and you're wielding it.",
      "7":  "🏰🧱 7-day Upkeep Streak! The Guild Quartermaster is impressed. Your personal operations are running at peak efficiency. Others are starting to ask how you do it.",
      "14": "⚙️ 14-day Upkeep Streak! You've built something rare — sustainable order from chaos. The Guild promotes you to Keeper of the Inner Sanctum.",
      "30": "👑🏰 30-day Upkeep Streak! A full month of unbroken discipline. Your domain is a fortress others aspire to. The Guild whispers of a new rank: Sovereign of the Hearth.",
    },
  },
  fitness: {
    completionMessage: "⚔️ **TRIAL SURVIVED.** You walked into the Arena and walked out stronger. Muscles forged, limits pushed, weakness burned away. The Warrior's Path demands everything, and today you paid the toll. The Guild salutes your iron will.",
    streakBonus: {
      "3":  "💪 3-day Arena Streak! Your body is beginning to remember what it was built for. The soreness is just your weakness leaving — the old warriors called it *The Shedding*.",
      "7":  "⚔️💪 7-day Arena Streak! A full week in the Arena. The other warriors have stopped underestimating you. Your discipline echoes through the training halls like war drums.",
      "14": "🔱 14-day Arena Streak! Two weeks of unbroken combat training. The Arena Masters have inscribed your name on the Wall of Perseverance. Your body is becoming a weapon of Guild legend.",
      "30": "🏆⚔️ 30-day Arena Streak! Thirty days. THIRTY. The Arena has tested you with everything it has, and you are still standing. The Guild bestows upon you the title: Ironforged Champion.",
    },
  },
  social: {
    completionMessage: "🤝 **ALLIANCE STRENGTHENED.** The bonds between you and your allies grow deeper. In the quiet moments between battles, these are the connections that keep a warrior whole. The Guild knows: the strongest fighters are the ones with something worth fighting for.",
    streakBonus: {
      "3":  "💬 3-day Alliance Streak! You're showing up for your people consistently. Trust compounds quietly, but its power is immense. Your inner circle feels it.",
      "7":  "🤝💬 7-day Alliance Streak! A full week of tending your alliances. The bonds are visibly stronger now. Your people know they can count on you — that's rarer than legendary loot.",
      "14": "🛡️ 14-day Alliance Streak! Two weeks of dedicated connection. Your allies would ride into battle for you without hesitation. The Guild calls this *Unbreakable Accord*.",
      "30": "👑🤝 30-day Alliance Streak! Thirty days of showing up for the people who matter. You've built something most adventurers never achieve — a true Fellowship. The Guild honors you as Warden of the Inner Circle.",
    },
  },
};

// ─── Campaign NPCs ───────────────────────────────────────────────────────────
const CAMPAIGN_NPCS = [
  { id: "npc_001", name: "Brenna Ironledger",   role: "Quest Hall Guildmaster",                   race: "Dwarf",    alignment: "Lawful Neutral" },
  { id: "npc_002", name: "Silas Dawnmantle",    role: "Mysterious Stranger / Wandering Lorekeeper", race: "Half-Elf", alignment: "Chaotic Good"  },
  { id: "npc_003", name: "Marta Hearthwine",    role: "Tavern Owner & Helpful Ally",              race: "Human",    alignment: "Neutral Good"   },
  { id: "npc_004", name: "Vex",                 role: "Morally Gray Information Broker / Rival",  race: "Tiefling", alignment: "True Neutral"   },
  { id: "npc_005", name: "Old Korrin",          role: "Retired Adventurer / Guild Mentor",        race: "Goliath",  alignment: "Neutral Good"   },
];

// ─── Level System ────────────────────────────────────────────────────────────
const LEVELS = [
  { level: 1,  title: "Forge Initiate",       xpRequired: 0     },
  { level: 2,  title: "Anvil Striker",         xpRequired: 50    },
  { level: 3,  title: "Coal Tender",           xpRequired: 120   },
  { level: 4,  title: "Iron Apprentice",       xpRequired: 200   },
  { level: 5,  title: "Flame Keeper",          xpRequired: 300   },
  { level: 6,  title: "Bronze Shaper",         xpRequired: 420   },
  { level: 7,  title: "Steel Crafter",         xpRequired: 560   },
  { level: 8,  title: "Glyph Carver",          xpRequired: 720   },
  { level: 9,  title: "Rune Binder",           xpRequired: 900   },
  { level: 10, title: "Ironclad Journeyman",   xpRequired: 1100  },
  { level: 11, title: "Forge Adept",           xpRequired: 1350  },
  { level: 12, title: "Silver Tempered",       xpRequired: 1650  },
  { level: 13, title: "Ember Warden",          xpRequired: 2000  },
  { level: 14, title: "Mithral Seeker",        xpRequired: 2400  },
  { level: 15, title: "Flame Warden",          xpRequired: 2850  },
  { level: 16, title: "Knight of the Forge",   xpRequired: 3350  },
  { level: 17, title: "Obsidian Blade",        xpRequired: 3900  },
  { level: 18, title: "Ashbound Knight",       xpRequired: 4500  },
  { level: 19, title: "Dawnsteel Sentinel",    xpRequired: 5150  },
  { level: 20, title: "Ironforged Champion",   xpRequired: 5850  },
  { level: 21, title: "Void Temperer",         xpRequired: 6700  },
  { level: 22, title: "Stormhammer",           xpRequired: 7600  },
  { level: 23, title: "Skyforgeling",          xpRequired: 8600  },
  { level: 24, title: "Dragon Tempered",       xpRequired: 9700  },
  { level: 25, title: "Master Artificer",      xpRequired: 10900 },
  { level: 26, title: "Grandmaster Smith",     xpRequired: 12200 },
  { level: 27, title: "Forge Sovereign",       xpRequired: 13600 },
  { level: 28, title: "Mythic Hammerborn",     xpRequired: 15100 },
  { level: 29, title: "Legendary Smelter",     xpRequired: 16700 },
  { level: 30, title: "Archmage of the Forge", xpRequired: 18400 },
];

function getLevelInfo(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xpRequired) current = l;
    else break;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  const progress = next
    ? Math.min(1, (xp - current.xpRequired) / (next.xpRequired - current.xpRequired))
    : 1;
  return {
    level: current.level,
    title: current.title,
    xpRequired: current.xpRequired,
    nextXp: next ? next.xpRequired : null,
    progress,
  };
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // High limit — per IP, generous for active use
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.set('Retry-After', retryAfter);
    res.status(429).json({ error: 'Too Many Requests', retryAfter });
  },
});
app.use(limiter);

app.use(express.static(path.join(__dirname, 'out')));
app.use('/data', express.static(DATA_DIR));

// ─── Auth ───────────────────────────────────────────────────────────────────────
// Supports multiple API keys via API_KEYS (comma-separated) or single API_KEY (backward compat)
const validApiKeys = new Set(
  [
    ...(process.env.API_KEYS ? process.env.API_KEYS.split(',').map(k => k.trim()).filter(Boolean) : []),
    ...(process.env.API_KEY ? [process.env.API_KEY.trim()] : []),
  ]
);
if (validApiKeys.size === 0) {
  console.error('[fatal] No API keys configured. Set API_KEY or API_KEYS environment variable. Exiting.');
  process.exit(1);
}
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || !validApiKeys.has(key)) {
    return res.status(401).json({ error: 'Unauthorized', hint: 'Set X-API-Key header' });
  }
  next();
}

// ─── Admin Key Management ───────────────────────────────────────────────────────
let managedKeys = []; // [{ key, label, created }]

function loadManagedKeys() {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        managedKeys = raw;
        for (const k of managedKeys) validApiKeys.add(k.key);
      }
    }
  } catch (_) {}
}

function saveManagedKeys() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(KEYS_FILE, JSON.stringify(managedKeys, null, 2));
  } catch (_) {}
}

function getMasterKey() {
  const envKeys = [
    ...(process.env.API_KEYS ? process.env.API_KEYS.split(',').map(k => k.trim()).filter(Boolean) : []),
    ...(process.env.API_KEY ? [process.env.API_KEY.trim()] : []),
  ];
  return envKeys[0] || '';
}

function requireMasterKey(req, res, next) {
  const key = req.headers['x-api-key'];
  const master = getMasterKey();
  if (!key || !master || key !== master) {
    return res.status(401).json({ error: 'Master key required' });
  }
  next();
}

// ─── In-memory store ───────────────────────────────────────────────────────────
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

// ─── NPC Catalogue ──────────────────────────────────────────────────────────
const NPC_META = {
  dobbie:       { avatar: '🐱', color: '#ff6b9d', role: 'Cat Overlord', description: 'Dobbie the demanding house cat. His requests are not optional. Resistance is futile.' },
  'npc-dobbie': { avatar: '🐱', color: '#ff6b9d', role: 'Cat Overlord', description: 'Dobbie the demanding house cat. His requests are not optional. Resistance is futile.' },
};
const NPC_NAMES = Object.keys(NPC_META);

let store = { agents: {} };

// ─── Quest store ────────────────────────────────────────────────────────────────
let quests = [];

// ─── Campaign store ──────────────────────────────────────────────────────────────
let campaigns = [];

let rituals = [];
let habits = [];
let lootTables = { common: [], uncommon: [], rare: [], epic: [], legendary: [] };
let gearTemplates = { tiers: [], items: [], setBonus: {} };
let npcGivers = { givers: [] };
let npcState  = { activeNpcs: [], cooldowns: {}, lastRotation: null, npcQuestIds: {} };
let appState  = { version: '1.0.0' };

function initStore() {
  for (const name of AGENT_NAMES) {
    const meta = AGENT_META[name] || {};
    store.agents[name] = {
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
    if (fs.existsSync(AGENTS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        for (const a of raw) {
          const key = a.id || a.name?.toLowerCase();
          if (key && store.agents[key]) {
            store.agents[key] = { ...store.agents[key], ...a };
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
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(Object.values(store.agents), null, 2));
  } catch (e) {
    console.warn('[store] Failed to persist data:', e.message);
  }
}

function loadQuests() {
  try {
    if (fs.existsSync(QUESTS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(QUESTS_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        quests = raw.map(q => {
          // Backward compat: normalize category (string) → categories (array)
          if (!q.categories) {
            q.categories = q.category ? [q.category] : [];
          }
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
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(QUESTS_FILE, JSON.stringify(quests, null, 2));
  } catch (e) {
    console.warn('[quests] Failed to persist quests:', e.message);
  }
}

function loadCampaigns() {
  try {
    if (fs.existsSync(CAMPAIGNS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));
      if (Array.isArray(raw)) campaigns = raw;
    }
  } catch (e) {
    console.warn('[campaigns] Failed to load campaigns:', e.message);
  }
}

function saveCampaigns() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
  } catch (e) {
    console.warn('[campaigns] Failed to persist campaigns:', e.message);
  }
}

function loadRituals() {
  try {
    if (fs.existsSync(RITUALS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(RITUALS_FILE, 'utf8'));
      if (raw && Array.isArray(raw.rituals)) rituals = raw.rituals;
    } else {
      saveRituals();
    }
  } catch (e) { console.warn('[rituals] Failed to load:', e.message); }
}

function saveRituals() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(RITUALS_FILE, JSON.stringify({ rituals }, null, 2));
  } catch (e) { console.warn('[rituals] Failed to save:', e.message); }
}

function loadHabits() {
  try {
    if (fs.existsSync(HABITS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(HABITS_FILE, 'utf8'));
      if (raw && Array.isArray(raw.habits)) habits = raw.habits;
    } else {
      saveHabits();
    }
  } catch (e) { console.warn('[habits] Failed to load:', e.message); }
}

function saveHabits() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HABITS_FILE, JSON.stringify({ habits }, null, 2));
  } catch (e) { console.warn('[habits] Failed to save:', e.message); }
}

function loadLootTables() {
  try {
    if (fs.existsSync(LOOT_TABLES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LOOT_TABLES_FILE, 'utf8'));
      if (raw) lootTables = raw;
    }
  } catch (e) { console.warn('[loot] Failed to load:', e.message); }
}

// Slot → emoji mapping for gear template items
const SLOT_EMOJI = { weapon: '⚔️', shield: '🛡️', helm: '🪖', armor: '🧥', amulet: '📿', boots: '👢' };

function loadGearTemplates() {
  try {
    if (fs.existsSync(GEAR_TEMPLATES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(GEAR_TEMPLATES_FILE, 'utf8'));
      if (raw) {
        gearTemplates = raw;
        // Merge template items into FULL_GEAR_ITEMS (skip if id already exists)
        const existingIds = new Set(FULL_GEAR_ITEMS.map(g => g.id));
        for (const item of raw.items || []) {
          if (!existingIds.has(item.id)) {
            FULL_GEAR_ITEMS.push({
              id: item.id,
              slot: item.slot,
              tier: item.tier,
              name: item.name,
              emoji: SLOT_EMOJI[item.slot] || '🎒',
              cost: item.price || 0,
              minLevel: item.reqLevel || 1,
              stats: item.stats || {},
              setId: ['adventurer','veteran','master','legendary'][item.tier - 1] || 'adventurer',
              rarity: item.rarity || 'common',
              desc: item.desc || '',
              shopHidden: item.shopHidden || false,
            });
          }
        }
        // Register named set items that aren't yet in FULL_GEAR_ITEMS
        for (const ns of raw.namedSets || []) {
          // namedSets reference piece IDs — items come from NPC givers; no need to add here
          // Just store namedSets for getUserStats to reference
        }
        console.log(`[gear] Loaded ${raw.items?.length || 0} gear templates, ${raw.namedSets?.length || 0} named sets`);
      }
    }
  } catch (e) { console.warn('[gear] Failed to load gear templates:', e.message); }
}

// ─── NPC Quest Giver System ──────────────────────────────────────────────────

function loadNpcGivers() {
  try {
    if (fs.existsSync(NPC_GIVERS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(NPC_GIVERS_FILE, 'utf8'));
      if (raw && raw.givers) {
        npcGivers = raw;
        // Register NPC unique reward items into FULL_GEAR_ITEMS
        const existingIds = new Set(FULL_GEAR_ITEMS.map(g => g.id));
        for (const giver of raw.givers) {
          const item = giver.finalReward?.item;
          if (item && !existingIds.has(item.id)) {
            FULL_GEAR_ITEMS.push({
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
        console.log(`[npc] Loaded ${npcGivers.givers.length} NPC quest givers`);
      }
    }
  } catch (e) { console.warn('[npc] Failed to load npcQuestGivers:', e.message); }
}

function loadNpcState() {
  try {
    if (fs.existsSync(NPC_STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(NPC_STATE_FILE, 'utf8'));
      if (raw) npcState = { activeNpcs: [], cooldowns: {}, lastRotation: null, npcQuestIds: {}, ...raw };
    }
  } catch (e) { console.warn('[npc] Failed to load npcState:', e.message); }
}

function saveNpcState() {
  try { fs.writeFileSync(NPC_STATE_FILE, JSON.stringify(npcState, null, 2)); } catch (e) { console.warn('[npc] Failed to save npcState:', e.message); }
}

function loadAppState() {
  try {
    if (fs.existsSync(APP_STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(APP_STATE_FILE, 'utf8'));
      if (raw) appState = { ...appState, ...raw };
    }
  } catch (e) { /* ignore */ }
}

function saveAppState() {
  try { fs.writeFileSync(APP_STATE_FILE, JSON.stringify(appState, null, 2)); } catch (e) {}
}

function rotateNpcs() {
  const now = new Date();

  // Remove expired NPCs and their uncompleted quests
  const stillActive = [];
  for (const active of npcState.activeNpcs) {
    if (new Date(active.expiresAt) > now) {
      stillActive.push(active);
    } else {
      const questIds = npcState.npcQuestIds[active.giverId] || [];
      const before = quests.length;
      for (let i = quests.length - 1; i >= 0; i--) {
        if (questIds.includes(quests[i].id) && quests[i].status !== 'completed') {
          quests.splice(i, 1);
        }
      }
      if (quests.length !== before) saveQuests();
      console.log(`[npc] ${active.giverId} has left town`);
    }
  }
  npcState.activeNpcs = stillActive;

  // Pick new NPCs if slots are open (aim for 1-2 active)
  const MAX_ACTIVE = 2;
  if (stillActive.length < MAX_ACTIVE) {
    const available = npcGivers.givers.filter(g => {
      if (stillActive.find(a => a.giverId === g.id)) return false;
      const cooldownUntil = npcState.cooldowns[g.id];
      if (cooldownUntil && new Date(cooldownUntil) > now) return false;
      return true;
    }).sort(() => Math.random() - 0.5);

    for (const giver of available.slice(0, MAX_ACTIVE - stillActive.length)) {
      const arrivedAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + giver.stayDays * 86400000).toISOString();
      npcState.activeNpcs.push({ giverId: giver.id, arrivedAt, expiresAt });

      const questIds = [];
      for (const qt of giver.questChain) {
        const quest = {
          id: `quest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: qt.title,
          description: qt.description || '',
          priority: qt.priority || 'medium',
          type: qt.type || 'personal',
          categories: [],
          product: null,
          humanInputRequired: false,
          createdBy: giver.id,
          status: 'open',
          createdAt: arrivedAt,
          claimedBy: null,
          completedBy: null,
          completedAt: null,
          parentQuestId: null,
          recurrence: null,
          streak: 0,
          lastCompletedAt: null,
          proof: null,
          checklist: null,
          nextQuestTemplate: null,
          coopPartners: null,
          coopClaimed: [],
          coopCompletions: [],
          skills: [],
          lore: null,
          chapter: null,
          minLevel: 1,
          npcGiverId: giver.id,
          npcRewards: qt.rewards || { xp: 20, gold: 10 },
        };
        quests.push(quest);
        questIds.push(quest.id);
      }
      npcState.npcQuestIds[giver.id] = questIds;
      // Cooldown starts when they leave
      npcState.cooldowns[giver.id] = new Date(now.getTime() + (giver.stayDays + giver.cooldownDays) * 86400000).toISOString();
      saveQuests();
      console.log(`[npc] ${giver.name} has arrived (${giver.stayDays} days, ${giver.questChain.length} quests)`);
    }
  }

  npcState.lastRotation = now.toISOString();
  saveNpcState();
}

// ─── Quest Catalog store ─────────────────────────────────────────────────────
let questCatalog = { meta: { totalTemplates: 0, byCategory: { generic: 0, classQuest: 0, chainQuest: 0, companionQuest: 0 }, byClass: {}, lastUpdated: new Date().toISOString() }, templates: [] };

function loadQuestCatalog() {
  try {
    if (fs.existsSync(QUEST_CATALOG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(QUEST_CATALOG_FILE, 'utf8'));
      if (raw && raw.templates) questCatalog = raw;
    } else {
      saveQuestCatalog();
    }
  } catch (e) { console.warn('[catalog] Failed to load:', e.message); }
}

function saveQuestCatalog() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(QUEST_CATALOG_FILE, JSON.stringify(questCatalog, null, 2));
  } catch (e) { console.warn('[catalog] Failed to persist:', e.message); }
}

function rebuildCatalogMeta() {
  const t = questCatalog.templates;
  questCatalog.meta.totalTemplates = t.length;
  questCatalog.meta.byCategory = { generic: 0, classQuest: 0, chainQuest: 0, companionQuest: 0 };
  questCatalog.meta.byClass = {};
  for (const tpl of t) {
    const cat = tpl.category || 'generic';
    questCatalog.meta.byCategory[cat] = (questCatalog.meta.byCategory[cat] || 0) + 1;
    if (tpl.classId) questCatalog.meta.byClass[tpl.classId] = (questCatalog.meta.byClass[tpl.classId] || 0) + 1;
  }
  questCatalog.meta.lastUpdated = new Date().toISOString();
}

// ─── Quest Catalog Seed ───────────────────────────────────────────────────────
function seedQuestCatalog() {
  if (questCatalog.templates.length > 0) return;

  const BASE = '2026-03-10T12:00:00Z';
  const at = (offset) => new Date(new Date(BASE).getTime() + offset * 1000).toISOString();

  const xp  = { starter: 15, intermediate: 25, advanced: 40, expert: 60 };
  const gld = { starter: 10, intermediate: 20, advanced: 30, expert: 50 };
  const pri = { starter: 'low', intermediate: 'medium', advanced: 'high', expert: 'high' };

  const tpl = (id, title, description, type, category, classId, minLevel, difficulty, estimatedTime, rewards, tags, chainId, chainOrder, recurrence, lore) => ({
    id,
    title,
    description,
    type,
    category,
    classId: classId || null,
    minLevel: minLevel || 1,
    chainId: chainId || null,
    chainOrder: chainOrder || null,
    difficulty,
    estimatedTime: estimatedTime || null,
    rewards: rewards || { xp: xp[difficulty], gold: gld[difficulty] },
    tags: tags || [],
    recurrence: recurrence || null,
    lore: lore || null,
    createdBy: 'system',
    createdAt: BASE,
  });

  const templates = [
    // ═══════════════════════════════════════════════════════════════════════
    // NETWORK SAGE — Chain: NSE Path
    // ═══════════════════════════════════════════════════════════════════════
    tpl('tpl-nse-01',
      '🎓 NSE 1 — Der Weg beginnt: Information Security Awareness',
      'Erlerne die Grundlagen der Informationssicherheit. Was sind Bedrohungen, wie schützt man sich? Der erste Schritt auf dem Pfad des Network Sage.',
      'learning', 'chainQuest', 'network-sage', 1, 'starter', '1h',
      { xp: 15, gold: 10 }, ['switching', 'firewalls'], 'nse-path', 1),

    tpl('tpl-nse-02',
      '🌐 NSE 2 — Evolution der Cybersicherheit',
      'Verstehe die Geschichte und Entwicklung der Cybersicherheit. Von den ersten Viren bis zu modernen Advanced Persistent Threats — lerne, wohin sich die Bedrohungslandschaft bewegt.',
      'learning', 'chainQuest', 'network-sage', 3, 'intermediate', '2h',
      { xp: 25, gold: 20 }, ['firewalls'], 'nse-path', 2),

    tpl('tpl-nse-03',
      '🛡️ NSE 3 — Erste Schritte mit FortiGate',
      'Richte deine erste FortiGate-Firewall ein. Grundkonfiguration, Interfaces, Policies und grundlegendes Monitoring. Die Fortinet-Ära beginnt.',
      'learning', 'chainQuest', 'network-sage', 5, 'intermediate', '3h',
      { xp: 30, gold: 25 }, ['firewalls', 'vpn'], 'nse-path', 3),

    tpl('tpl-nse-04',
      '⚔️ NSE 4 — Netzwerksicherheits-Meister: Die Prüfung',
      '🐉 BOSS QUEST: Die große Prüfung des Network Security Professional. Fortinet NSE 4-Zertifizierung ablegen und bestehen. Beweise dein Können als Hüter des Netzwerks.',
      'boss', 'chainQuest', 'network-sage', 10, 'expert', '40h',
      { xp: 100, gold: 80 }, ['firewalls', 'vpn', 'switching'], 'nse-path', 4),

    // ═══════════════════════════════════════════════════════════════════════
    // NETWORK SAGE — Chain: Switching Fundamentals
    // ═══════════════════════════════════════════════════════════════════════
    tpl('tpl-sw-01',
      '🔌 Die Kunst des Weiterleitens — Was ist ein Switch?',
      'Lerne, was ein Switch ist, wie er arbeitet und warum er das Rückgrat jedes Netzwerks bildet. MAC-Adressen-Tabellen, Broadcast-Domains und der Unterschied zu Hubs.',
      'learning', 'chainQuest', 'network-sage', 1, 'starter', '1h',
      { xp: 15, gold: 10 }, ['switching'], 'switching-fundamentals', 1),

    tpl('tpl-sw-02',
      '🔀 Die Kunst der VLANs — Netzwerke teilen und herrschen',
      'Verstehe VLANs und konfiguriere sie auf einem Switch. Trunk-Ports, Access-Ports, Native VLANs — lerne, wie du ein physisches Netzwerk in logische Segmente teilst.',
      'learning', 'chainQuest', 'network-sage', 3, 'intermediate', '2h',
      { xp: 25, gold: 20 }, ['switching'], 'switching-fundamentals', 2),

    tpl('tpl-sw-03',
      '🌳 Spanning Tree — Der Wächter vor Schleifen',
      'Meistere das Spanning Tree Protocol (STP/RSTP). Wie verhindert STP Broadcast-Stürme? Root-Bridge-Wahl, Port-Rollen und Konvergenz — unverzichtbar für stabile Netzwerke.',
      'learning', 'chainQuest', 'network-sage', 5, 'intermediate', '3h',
      { xp: 30, gold: 25 }, ['switching'], 'switching-fundamentals', 3),

    tpl('tpl-sw-04',
      '🚦 Inter-VLAN Routing — Brücken zwischen Welten',
      'Konfiguriere Inter-VLAN Routing mit einem Layer-3-Switch oder Router-on-a-Stick. Lass verschiedene VLANs miteinander kommunizieren, ohne die Sicherheit zu opfern.',
      'learning', 'chainQuest', 'network-sage', 7, 'advanced', '3h',
      { xp: 40, gold: 30 }, ['switching'], 'switching-fundamentals', 4),

    tpl('tpl-sw-05',
      '🔒 Switch Security — Port Security & 802.1X: Die Festung',
      '🐉 BOSS QUEST: Härte dein Netzwerk mit Port Security, DHCP Snooping, Dynamic ARP Inspection und 802.1X-Authentifizierung. Nur bekannte Geräte dürfen eintreten.',
      'boss', 'chainQuest', 'network-sage', 10, 'expert', '5h',
      { xp: 80, gold: 60 }, ['switching'], 'switching-fundamentals', 5),

    // ═══════════════════════════════════════════════════════════════════════
    // NETWORK SAGE — Chain: Firewall Mastery
    // ═══════════════════════════════════════════════════════════════════════
    tpl('tpl-fw-01',
      '🔥 Erste Firewall-Regel — Allow & Deny: Wächter am Tor',
      'Erstelle deine erste Firewall-Regel. Verstehe den Unterschied zwischen Allow und Deny, Stateful vs. Stateless Inspection, und warum eine Default-Deny-Policy Gold wert ist.',
      'learning', 'chainQuest', 'network-sage', 1, 'starter', '1.5h',
      { xp: 15, gold: 10 }, ['firewalls'], 'firewall-mastery', 1),

    tpl('tpl-fw-02',
      '🔄 NAT & PAT — Die Magie der Adressübersetzung',
      'Verstehe Network Address Translation und Port Address Translation. Wie versteckt NAT dein internes Netzwerk? Konfiguriere Static NAT, Dynamic NAT und PAT auf einer FortiGate.',
      'learning', 'chainQuest', 'network-sage', 3, 'intermediate', '2h',
      { xp: 25, gold: 20 }, ['firewalls'], 'firewall-mastery', 2),

    tpl('tpl-fw-03',
      '🔐 VPN Tunnel aufbauen — IPSec: Der sichere Tunnel',
      'Konfiguriere einen Site-to-Site IPSec VPN Tunnel. Phase 1 & Phase 2, IKE, ESP — lerne die Magie hinter verschlüsselten Verbindungen zwischen Standorten.',
      'learning', 'chainQuest', 'network-sage', 5, 'intermediate', '3h',
      { xp: 30, gold: 25 }, ['firewalls', 'vpn'], 'firewall-mastery', 3),

    tpl('tpl-fw-04',
      '🌐 SSL VPN — Fernzugriff für die Gilde',
      'Richte einen SSL VPN für Remote-Mitarbeiter ein. Web-Mode, Tunnel-Mode, Split-Tunneling — gib deinen Recken sicheren Zugriff von überall auf der Welt.',
      'learning', 'chainQuest', 'network-sage', 7, 'advanced', '3h',
      { xp: 40, gold: 30 }, ['vpn', 'firewalls'], 'firewall-mastery', 4),

    tpl('tpl-fw-05',
      '🏰 Zero Trust Network Access — Vertraue niemandem',
      'Implementiere Zero Trust: Mikrosegmentierung, Identity-Based Policies, kontinuierliche Verifikation. Kein Gerät wird ohne Beweis vertraut — nicht einmal deine eigenen.',
      'learning', 'chainQuest', 'network-sage', 10, 'advanced', '5h',
      { xp: 50, gold: 40 }, ['firewalls', 'vpn'], 'firewall-mastery', 5),

    tpl('tpl-fw-06',
      '🐉 FortiGate ATP — Fortgeschrittene Bedrohungsabwehr: Endkampf',
      '🐉 BOSS QUEST: Konfiguriere FortiGate Advanced Threat Protection: IPS, Application Control, Web Filtering, SSL Inspection, Sandboxing. Werde zum Erzmagier der Netzwerkverteidigung.',
      'boss', 'chainQuest', 'network-sage', 15, 'expert', '8h',
      { xp: 120, gold: 100 }, ['firewalls', 'vpn', 'switching'], 'firewall-mastery', 6),

    // ═══════════════════════════════════════════════════════════════════════
    // NETWORK SAGE — Einzelquests
    // ═══════════════════════════════════════════════════════════════════════
    tpl('tpl-ns-eq-01',
      '🗺️ Netzwerk-Diagramm erstellen — Karte des Königreichs',
      'Erstelle ein vollständiges Netzwerkdiagramm deiner Umgebung. Erfasse alle Geräte, Verbindungen, IP-Bereiche und VLANs. Eine gute Karte ist der erste Schritt zur Meisterschaft.',
      'learning', 'classQuest', 'network-sage', 1, 'starter', '1h',
      { xp: 15, gold: 10 }, ['switching']),

    tpl('tpl-ns-eq-02',
      '🦈 Wireshark — Den ersten Traffic analysieren',
      'Starte Wireshark und analysiere deinen ersten Netzwerk-Capture. Filter setzen, Protokolle erkennen, Handshakes sehen — lerne, das Netzwerk zu hören.',
      'learning', 'classQuest', 'network-sage', 2, 'starter', '1.5h',
      { xp: 15, gold: 10 }, ['switching', 'firewalls']),

    tpl('tpl-ns-eq-03',
      '📡 DNS & DHCP — Die unsichtbaren Diener',
      'Verstehe wie DNS und DHCP funktionieren, konfiguriere einen lokalen DNS-Server, tracke DHCP-Leases und löse typische DNS-Probleme. Magie im Hintergrund sichtbar machen.',
      'learning', 'classQuest', 'network-sage', 1, 'starter', '1.5h',
      { xp: 15, gold: 10 }, ['switching']),

    tpl('tpl-ns-eq-04',
      '🧮 Subnetting-Challenge — /24 bis /28 beherrschen',
      'Löse 20 Subnetting-Aufgaben ohne Hilfsmittel. Von /24 über /26 bis /28 — berechne Netzwerkadressen, Broadcast, Host-Bereiche und CIDR-Notation. Zahlen sind deine Waffe.',
      'learning', 'classQuest', 'network-sage', 3, 'intermediate', '2h',
      { xp: 25, gold: 20 }, ['switching']),

    tpl('tpl-ns-eq-05',
      '🔍 Troubleshooting-Toolkit — Ping, Traceroute, NSLookup',
      'Meistere die Kommandozeilen-Werkzeuge des Netzwerkdiagnose. Finde Ausfälle, identifiziere Routen, erkenne DNS-Probleme — der Detektiv des Netzwerks zu werden.',
      'learning', 'classQuest', 'network-sage', 2, 'starter', '1h',
      { xp: 15, gold: 10 }, ['switching', 'firewalls']),

    tpl('tpl-ns-eq-06',
      '🧪 Das Labor erwacht — GNS3 oder EVE-NG aufsetzen',
      'Richte dein persönliches Netzwerklabor ein: GNS3 oder EVE-NG installieren, erste virtuelle Topologie erstellen. Ein Labor ist das Schwert des Network Sage — ohne Übung keine Meisterschaft.',
      'learning', 'classQuest', 'network-sage', 5, 'intermediate', '3h',
      { xp: 30, gold: 25 }, ['switching', 'firewalls', 'vpn']),

    tpl('tpl-ns-eq-07',
      '📊 Bandbreiten-Analyse mit FortiView',
      'Analysiere den Netzwerkverkehr mit FortiView. Identifiziere Top-Talker, verdächtige Verbindungen und Bandbreiten-Fressende Anwendungen. Wissen ist Macht — nutze die Logs.',
      'learning', 'classQuest', 'network-sage', 4, 'intermediate', '2h',
      { xp: 25, gold: 20 }, ['firewalls']),

    tpl('tpl-ns-eq-08',
      '⚡ DHCP-Failover — Redundanz für das Königreich',
      'Konfiguriere DHCP-Failover zwischen zwei Servern. Keine DHCP-Ausfälle mehr — das Netzwerk lebt weiter, selbst wenn ein Server fällt. Hochverfügbarkeit ist kein Luxus.',
      'learning', 'classQuest', 'network-sage', 6, 'intermediate', '2.5h',
      { xp: 25, gold: 20 }, ['switching']),

    tpl('tpl-ns-eq-09',
      '🔭 Port-Mirroring & Monitoring — Alles im Blick',
      'Richte Port-Mirroring (SPAN) ein und verbinde ein Monitoring-System. Analysiere Traffic im Live-Betrieb ohne den Fluss zu unterbrechen. Der stille Beobachter sieht alles.',
      'learning', 'classQuest', 'network-sage', 8, 'advanced', '3h',
      { xp: 40, gold: 30 }, ['switching', 'firewalls']),

    tpl('tpl-ns-eq-10',
      '🗺️ Routing-Protokolle — OSPF & BGP: Die Wegfinder',
      'Verstehe dynamische Routing-Protokolle: OSPF für interne Netzwerke, BGP für das Internet. Konfiguriere OSPF in einer kleinen Topologie und verstehe AS-Nummern und BGP-Peering.',
      'learning', 'classQuest', 'network-sage', 12, 'advanced', '5h',
      { xp: 45, gold: 35 }, ['switching', 'firewalls']),

    // ═══════════════════════════════════════════════════════════════════════
    // GENERIC — Personal (15 Quests)
    // ═══════════════════════════════════════════════════════════════════════
    tpl('tpl-per-01',
      '🌅 Morgenritual — Starte den Tag mit Energie',
      'Beginne den Tag strukturiert: aufstehen, kurz dehnen, ein Glas Wasser trinken, 5 Minuten Ziele setzen. Ein guter Start macht den ganzen Tag besser.',
      'personal', 'generic', null, 1, 'starter', '15min',
      { xp: 10, gold: 5 }, ['routine'], 'nse-path', null, 'daily'),

    tpl('tpl-per-02',
      '🌙 Abend-Winddown — Die Seele zur Ruhe bringen',
      'Beende den Tag bewusst: Bildschirme aus, Tagebuch oder 3 Dankbarkeiten aufschreiben, Schlafvorbereitung. Guter Schlaf ist das mächtigste Upgrade.',
      'personal', 'generic', null, 1, 'starter', '20min',
      { xp: 10, gold: 5 }, ['routine'], null, null, 'daily'),

    tpl('tpl-per-03',
      '🥘 Meal Prep Sonntag — Vorkochen für die Woche',
      'Bereite am Sonntag Mahlzeiten für 3-5 Tage vor. Gesund essen spart Zeit und Geld — und gibt dir Energie für größere Quests in der Woche.',
      'personal', 'generic', null, 2, 'starter', '2h',
      { xp: 20, gold: 15 }, ['organization'], null, null, 'weekly'),

    tpl('tpl-per-04',
      '🗑️ Quest: Schreibtisch aufräumen — Ordnung im Reich',
      'Räume deinen Schreibtisch vollständig auf, wische ihn ab und sorge für ein aufgeräumtes Arbeitsumfeld. Ein klarer Schreibtisch = klarer Geist.',
      'personal', 'generic', null, 1, 'starter', '30min',
      { xp: 10, gold: 5 }, ['organization']),

    tpl('tpl-per-05',
      '🗂️ Digitale Aufräumaktion — Downloads & Desktop leeren',
      'Leere den Download-Ordner, räume den Desktop auf, lösche Dateien die nicht mehr gebraucht werden. Digitale Ordnung ist genauso wichtig wie physische.',
      'personal', 'generic', null, 2, 'starter', '45min',
      { xp: 15, gold: 10 }, ['organization']),

    tpl('tpl-per-06',
      '🔑 Passwörter-Audit — Sicherheitsrunde durchführen',
      'Überprüfe und aktualisiere wichtige Passwörter. Nutze einen Passwort-Manager und aktiviere 2FA wo möglich. Deine digitale Identität ist schutzwürdig.',
      'personal', 'generic', null, 1, 'starter', '1h',
      { xp: 15, gold: 10 }, ['security']),

    tpl('tpl-per-07',
      '💾 Backup erstellen — Das Gewölbe sichern',
      'Erstelle ein vollständiges Backup aller wichtigen Daten. Externe Festplatte oder Cloud — teste anschließend die Wiederherstellung. Ein Backup das nicht getestet ist, ist keines.',
      'personal', 'generic', null, 2, 'starter', '1h',
      { xp: 15, gold: 10 }, ['organization']),

    tpl('tpl-per-08',
      '📓 Tagebuch schreiben — 5 Minuten täglich reflektieren',
      'Schreibe täglich 5 Minuten in ein Tagebuch: Was war gut? Was war schwer? Was nimmst du mit? Reflexion ist der Weg zur Weisheit.',
      'personal', 'generic', null, 1, 'starter', '5min',
      { xp: 8, gold: 5 }, ['mindfulness'], null, null, 'daily'),

    tpl('tpl-per-09',
      '🧘 Meditation — 10 Minuten Stille im Lärm der Welt',
      'Meditiere 10 Minuten: Atemübung, Body Scan oder geführte Meditation. Regelmäßige Praxis reduziert Stress und schärft die Konzentration.',
      'personal', 'generic', null, 1, 'starter', '10min',
      { xp: 10, gold: 5 }, ['mindfulness'], null, null, 'daily'),

    tpl('tpl-per-10',
      '📵 Digital Detox — 2 Stunden offline sein',
      'Lege alle digitalen Geräte für 2 Stunden weg. Keine Social Media, kein Scrollen, keine E-Mails. Genieße die analoge Welt bewusst und erlebe, wie sich dein Geist erholt.',
      'personal', 'generic', null, 3, 'intermediate', '2h',
      { xp: 20, gold: 15 }, ['mindfulness']),

    tpl('tpl-per-11',
      '📚 30 Minuten lesen — Wissen ist Macht',
      'Lese 30 Minuten in einem Buch (kein Handy, kein Social-Feed). Sachbücher, Romane oder Fachbücher — jede Seite erweitert deinen Horizont.',
      'personal', 'generic', null, 1, 'starter', '30min',
      { xp: 10, gold: 5 }, ['learning'], null, null, 'daily'),

    tpl('tpl-per-12',
      '📥 Inbox Zero — E-Mails auf null bringen',
      'Bearbeite deinen gesamten E-Mail-Posteingang: Antworten, Archivieren oder Löschen. Inbox Zero ist ein Gefühl von Befreiung — probiere es aus.',
      'personal', 'generic', null, 2, 'starter', '1h',
      { xp: 15, gold: 10 }, ['organization'], null, null, 'weekly'),

    tpl('tpl-per-13',
      '🎯 Monatsziele setzen — Die Quests des nächsten Monats planen',
      'Setze dir 3-5 konkrete Ziele für den kommenden Monat. Schreibe sie auf, mache sie messbar und plane erste Schritte. Wer kein Ziel hat, trifft auch nichts.',
      'personal', 'generic', null, 1, 'starter', '30min',
      { xp: 15, gold: 10 }, ['organization'], null, null, 'monthly'),

    tpl('tpl-per-14',
      '🧹 Zimmer auf Vordermann — Großreinemachen',
      'Räume das Zimmer gründlich auf: staubsaugen, wischen, Klamotten sortieren, Bett frisch beziehen. Ein sauberes Umfeld schafft innere Klarheit.',
      'personal', 'generic', null, 1, 'starter', '1h',
      { xp: 15, gold: 10 }, ['routine'], null, null, 'weekly'),

    tpl('tpl-per-15',
      '🌱 Nächsten Skill planen — Welches Kapitel kommt als nächstes?',
      'Überlege dir, welchen neuen Skill du als nächstes erlernen möchtest. Recherchiere Ressourcen, schätze den Aufwand ab und erstelle einen groben Lernplan.',
      'personal', 'generic', null, 2, 'starter', '30min',
      { xp: 15, gold: 10 }, ['learning']),

    // ═══════════════════════════════════════════════════════════════════════
    // GENERIC — Fitness (12 Quests)
    // ═══════════════════════════════════════════════════════════════════════
    tpl('tpl-fit-01',
      '🚶 Mittagspausen-Spaziergang — 10 Minuten frische Luft',
      'Gehe in der Mittagspause 10 Minuten spazieren. Raus aus dem Büro, frische Luft schnappen, den Kopf lüften. Kleine Bewegung, große Wirkung.',
      'fitness', 'generic', null, 1, 'starter', '10min',
      { xp: 10, gold: 5 }, ['cardio'], null, null, 'daily'),

    tpl('tpl-fit-02',
      '🤸 Morgen-Dehnen — 5 Minuten Stretch-Ritual',
      'Starte den Tag mit 5 Minuten Dehnen: Hüftöffner, Schultern, Nacken, Rücken. Flexibilität ist die Basis jeder körperlichen Leistung — vernachlässige sie nicht.',
      'fitness', 'generic', null, 1, 'starter', '5min',
      { xp: 8, gold: 5 }, ['flexibility'], null, null, 'daily'),

    tpl('tpl-fit-03',
      '💧 Hydrations-Quest — 2 Liter Wasser trinken',
      'Trinke heute mindestens 2 Liter Wasser. Kein Saft, kein Kaffee zählt. Hydration ist das einfachste und wirkungsvollste Upgrade für Körper und Geist.',
      'fitness', 'generic', null, 1, 'starter', null,
      { xp: 8, gold: 5 }, ['health'], null, null, 'daily'),

    tpl('tpl-fit-04',
      '🏋️ Gym-Session — 45 Minuten Kraft aufbauen',
      'Absolviere eine vollständige Gym-Session: Aufwärmen, 3 Hauptübungen, Cool-Down. Kraft ist nicht nur körperlich — sie gibt Selbstvertrauen.',
      'fitness', 'generic', null, 2, 'intermediate', '1h',
      { xp: 25, gold: 20 }, ['strength']),

    tpl('tpl-fit-05',
      '🏃 5km Lauf — Erster Schritt zum Läufer',
      'Laufe 5km am Stück, egal wie langsam. Tempo ist egal — Fertigstellen ist alles. Läufer werden auf der Straße, nicht im Kopf.',
      'fitness', 'generic', null, 3, 'intermediate', '30-40min',
      { xp: 30, gold: 25 }, ['cardio']),

    tpl('tpl-fit-06',
      '💪 30-Minuten-Workout — Zuhause ohne Geräte',
      'Absolviere ein komplettes Bodyweight-Workout: Push-ups, Squats, Burpees, Plank. Kein Gym nötig — dein Körper ist dein Gerät.',
      'fitness', 'generic', null, 2, 'intermediate', '30min',
      { xp: 20, gold: 15 }, ['strength', 'cardio']),

    tpl('tpl-fit-07',
      '🏆 Fitness-Challenge-Woche — 7 Tage am Stück',
      'Bewege dich 7 Tage in Folge mindestens 30 Minuten täglich. Spazieren, Laufen, Gym, Yoga — alles zählt. Gewohnheiten entstehen durch Wiederholung.',
      'fitness', 'generic', null, 5, 'advanced', '7 Tage',
      { xp: 60, gold: 50 }, ['endurance', 'consistency']),

    tpl('tpl-fit-08',
      '🎿 Neue Sportart ausprobieren — Unbekanntes betreten',
      'Probiere eine Sportart aus, die du noch nie gemacht hast. Klettern, Schwimmen, Kampfsport, Tanzen — tritt aus der Komfortzone und entdecke ein neues Talent.',
      'fitness', 'generic', null, 3, 'intermediate', '2h',
      { xp: 25, gold: 20 }, ['variety']),

    tpl('tpl-fit-09',
      '🏅 10km Lauf — Die doppelte Herausforderung',
      'Laufe 10km ohne Stop. Der mentale Kampf bei Kilometer 7 ist die eigentliche Prüfung. Wer 10km rennt, hat bewiesen: Wille überwindet Grenze.',
      'fitness', 'generic', null, 7, 'advanced', '55-70min',
      { xp: 50, gold: 40 }, ['cardio', 'endurance']),

    tpl('tpl-fit-10',
      '💥 Push-up-Challenge — 50 Stück täglich',
      'Schaffe heute 50 Push-ups (in Sätzen ist erlaubt). Starte mit was du kannst und steigere dich. Kraft im Oberkörper ist eine der grundlegendsten körperlichen Fähigkeiten.',
      'fitness', 'generic', null, 2, 'starter', '15min',
      { xp: 15, gold: 10 }, ['strength'], null, null, 'daily'),

    tpl('tpl-fit-11',
      '🧘 Yoga-Flow — 20 Minuten Körper & Geist verbinden',
      'Absolviere eine 20-minütige Yoga-Session: Sun Salutation, Warrior-Folge, Savasana. Yoga verbindet Stärke, Flexibilität und Atemkontrolle — unterschätze es nicht.',
      'fitness', 'generic', null, 1, 'starter', '20min',
      { xp: 15, gold: 10 }, ['flexibility', 'mindfulness']),

    tpl('tpl-fit-12',
      '🏊 Schwimmen — 1km im Becken absolvieren',
      'Schwimme 1km am Stück (40 Bahnen à 25m). Schwimmen trainiert den gesamten Körper und schont die Gelenke. Für viele ein unterschätztes Ganzkörper-Erlebnis.',
      'fitness', 'generic', null, 4, 'intermediate', '30-40min',
      { xp: 30, gold: 25 }, ['cardio', 'strength']),

    // ═══════════════════════════════════════════════════════════════════════
    // GENERIC — Social (13 Quests)
    // ═══════════════════════════════════════════════════════════════════════
    tpl('tpl-soc-01',
      '📞 Einen Freund anrufen — Echte Verbindung',
      'Ruf einen Freund oder ein Familienmitglied an, mit dem du schon länger nicht gesprochen hast. Nicht schreiben — sprechen. Echte Verbindung braucht Stimme.',
      'social', 'generic', null, 1, 'starter', '20min',
      { xp: 10, gold: 5 }, ['connection']),

    tpl('tpl-soc-02',
      '💌 Dankes-Nachricht schreiben — Dankbarkeit zeigen',
      'Schreibe jemandem eine aufrichtige Dankes-Nachricht. Nicht kurz und flüchtig — wirklich. Erkläre, warum du dankbar bist. Dankbarkeit verändert Beziehungen.',
      'social', 'generic', null, 1, 'starter', '15min',
      { xp: 10, gold: 5 }, ['connection']),

    tpl('tpl-soc-03',
      '📅 Ausflug planen — Gemeinsame Abenteuer schmieden',
      'Plane einen Ausflug mit Freunden oder Familie: Wanderung, Stadtbummel, Tagesreise. Organisiere Datum, Ort und lade mindestens 2 Leute ein.',
      'social', 'generic', null, 2, 'starter', '30min',
      { xp: 15, gold: 10 }, ['planning']),

    tpl('tpl-soc-04',
      '🎲 Spieleabend — Die Gilde versammelt sich',
      'Organisiere einen Spieleabend: Brettspiele, Kartenspiele, Konsole oder Rollenspiel. Lade mindestens 2 weitere ein und sorge für gute Stimmung.',
      'social', 'generic', null, 2, 'starter', '3h',
      { xp: 20, gold: 15 }, ['fun']),

    tpl('tpl-soc-05',
      '👨‍🍳 Gemeinsam kochen — Freunde einladen & zusammen essen',
      'Koche gemeinsam mit Freunden. Jeder bringt eine Zutat mit oder übernimmt einen Gang. Essen das man teilt, schmeckt immer besser.',
      'social', 'generic', null, 3, 'intermediate', '3h',
      { xp: 25, gold: 20 }, ['connection', 'fun']),

    tpl('tpl-soc-06',
      '🎁 Jemanden überraschen — Kleine Freude bereiten',
      'Bereite jemandem eine kleine Überraschung: Ein selbstgemachtes Essen, eine Karte, ein kleines Geschenk. Die kleinen Gesten sind oft die mächtigsten.',
      'social', 'generic', null, 2, 'starter', '1h',
      { xp: 20, gold: 15 }, ['connection']),

    tpl('tpl-soc-07',
      '🤝 Einem Kollegen helfen — Die Gilde stärkt sich gegenseitig',
      'Biete einem Kollegen aktiv Hilfe an — nicht weil du gefragt wurdest, sondern weil du siehst, dass er sie braucht. Stärke durch Zusammenhalt.',
      'social', 'generic', null, 1, 'starter', '30min',
      { xp: 10, gold: 5 }, ['teamwork']),

    tpl('tpl-soc-08',
      '📖 Wissen weitergeben — Jemanden mentoren',
      'Mentore jemanden: Erkläre ein Thema das du beherrschst, zeige wie etwas funktioniert, teile deinen Lernweg. Lehren ist die tiefste Form des Verstehens.',
      'social', 'generic', null, 5, 'intermediate', '1h',
      { xp: 30, gold: 25 }, ['teaching', 'teamwork']),

    tpl('tpl-soc-09',
      '🏘️ Community-Event besuchen — Teil von etwas Größerem sein',
      'Besuche ein lokales Community-Event, Meetup, Workshop oder Vereinstreffen. Neue Gesichter, neue Perspektiven, neues Netzwerk.',
      'social', 'generic', null, 3, 'intermediate', '2h',
      { xp: 25, gold: 20 }, ['networking']),

    tpl('tpl-soc-10',
      '🔍 Alten Kontakt wiederbeleben — Verbindung erneuern',
      'Melde dich bei jemandem den du lange nicht gesprochen hast. Eine ehrliche Nachricht — kein Smalltalk. Beziehungen brauchen Pflege.',
      'social', 'generic', null, 2, 'starter', '15min',
      { xp: 15, gold: 10 }, ['connection']),

    tpl('tpl-soc-11',
      '💬 Konstruktives Feedback geben — Ein Kollege wächst',
      'Gib einem Kollegen oder Freund ehrliches, konstruktives Feedback. Nicht kritisieren — aufbauen. Wer Feedback gibt, zeigt, dass ihm die andere Person wichtig ist.',
      'social', 'generic', null, 2, 'starter', '20min',
      { xp: 15, gold: 10 }, ['teamwork']),

    tpl('tpl-soc-12',
      '☕ Kaffeepause einplanen — Qualitätszeit statt Effizienz',
      'Plane bewusst eine gemeinsame Kaffeepause ein: ohne Handy, mit echter Unterhaltung. Pause ist produktiv wenn sie verbindet.',
      'social', 'generic', null, 1, 'starter', '30min',
      { xp: 10, gold: 5 }, ['connection']),

    tpl('tpl-soc-13',
      '👋 Neuen Menschen kennenlernen — Die Welt ist groß',
      'Lerne heute bewusst einen neuen Menschen kennen: Nachbar, Kollege, Mitglied eines Vereins. Stelle echte Fragen, höre zu. Jeder Mensch hat eine Geschichte.',
      'social', 'generic', null, 4, 'intermediate', '1h',
      { xp: 25, gold: 20 }, ['networking', 'connection']),
  ];

  questCatalog.templates = templates;
  rebuildCatalogMeta();
  saveQuestCatalog();

  // Create actual quest instances from templates
  const seedQuests = templates.map((t, i) => {
    const priorityMap = { starter: 'low', intermediate: 'medium', advanced: 'high', expert: 'high' };
    return {
      id: `quest-seed-${String(i + 1).padStart(3, '0')}`,
      title: t.title,
      description: t.description,
      priority: priorityMap[t.difficulty] || 'medium',
      type: t.type,
      categories: [],
      product: null,
      humanInputRequired: false,
      createdBy: 'system',
      status: 'open',
      createdAt: at(i),
      claimedBy: null,
      completedBy: null,
      completedAt: null,
      parentQuestId: null,
      recurrence: t.recurrence || null,
      streak: 0,
      lastCompletedAt: null,
      proof: null,
      checklist: null,
      nextQuestTemplate: null,
      coopPartners: null,
      coopClaimed: [],
      coopCompletions: [],
      skills: t.tags || [],
      lore: t.lore || null,
      chapter: t.chainId || null,
      minLevel: t.minLevel || 1,
    };
  });
  quests.push(...seedQuests);
  saveQuests();

  const classCount   = templates.filter(t => t.classId).length;
  const genericCount = templates.filter(t => !t.classId).length;
  console.log(`🌱 Seeded ${templates.length} quest templates (${classCount} class, ${genericCount} generic)`);
}

// ─── Classes store ────────────────────────────────────────────────────────────
let classesData = { classes: [] };

function loadClasses() {
  try {
    if (fs.existsSync(CLASSES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CLASSES_FILE, 'utf8'));
      if (raw && Array.isArray(raw.classes)) classesData = raw;
    } else {
      saveClasses();
    }
  } catch (e) { console.warn('[classes] Failed to load:', e.message); }
}

function saveClasses() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CLASSES_FILE, JSON.stringify(classesData, null, 2));
  } catch (e) { console.warn('[classes] Failed to persist:', e.message); }
}

// ─── Companions store ─────────────────────────────────────────────────────────
let companionsData = { realTemplates: {}, virtualTemplates: {}, careQuestTemplates: {}, bondLevels: [] };

function loadCompanionsData() {
  try {
    if (fs.existsSync(COMPANIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(COMPANIONS_FILE, 'utf8'));
      if (raw) companionsData = raw;
    }
  } catch (e) { console.warn('[companions] Failed to load:', e.message); }
}

// ─── Bond level helpers ───────────────────────────────────────────────────────
const BOND_LEVELS = [
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
];

function getBondLevel(bondXp) {
  const xp = bondXp || 0;
  let current = BOND_LEVELS[0];
  for (const bl of BOND_LEVELS) {
    if (xp >= bl.minXp) current = bl;
    else break;
  }
  const nextIdx = BOND_LEVELS.indexOf(current) + 1;
  const next = BOND_LEVELS[nextIdx] || null;
  return {
    level: current.level,
    title: current.title,
    xp,
    minXp: current.minXp,
    nextXp: next ? next.minXp : current.minXp,
    progress: next ? Math.min(1, (xp - current.minXp) / (next.minXp - current.minXp)) : 1,
  };
}

// ─── Companion quest creation helper ─────────────────────────────────────────
function createCompanionQuestsForUser(userId) {
  const u = users[userId];
  if (!u || !u.companion) return;
  const companion = u.companion;
  const name = companion.name;

  if (companion.isReal) {
    const species = companion.species || companion.type;
    const speciesData = companionsData.realTemplates[species] || companionsData.realTemplates.other || { careQuests: ['feed', 'care'] };
    const careQuestIds = speciesData.careQuests || ['feed'];
    for (let i = 0; i < careQuestIds.length; i++) {
      const careId = careQuestIds[i];
      const tpl = companionsData.careQuestTemplates[careId];
      if (!tpl) continue;
      const title = tpl.title.replace(/\{name\}/g, name);
      const desc  = tpl.desc.replace(/\{name\}/g, name);
      quests.push({
        id: `quest-${Date.now()}-${i}-${careId}`,
        title,
        description: desc,
        priority: 'medium',
        type: 'companion',
        categories: [],
        product: null,
        humanInputRequired: false,
        createdBy: 'system',
        status: 'open',
        createdAt: now(),
        claimedBy: userId,
        completedBy: null,
        completedAt: null,
        parentQuestId: null,
        recurrence: tpl.recurrence || 'daily',
        streak: 0,
        lore: null,
        chapter: null,
        nextQuestTemplate: null,
        coopPartners: null,
        skills: null,
        minLevel: null,
        proof: null,
        companionCareType: careId,
        companionOwnerId: userId,
      });
    }
  } else {
    const personality = (companionsData.virtualTemplates[companion.type] || {}).personality || 'loyal';
    const msgs = {
      fierce:    `${companion.emoji} ${name} fordert dich heraus: Erledige 3 Quests heute!`,
      wise:      `${companion.emoji} ${name} empfiehlt: Lerne heute etwas Neues`,
      resilient: `${companion.emoji} ${name} erinnert dich: Nach jedem Rückschlag stärker aufstehen`,
      loyal:     `${companion.emoji} ${name} wartet auf dich: Zeit für deine tägliche Routine`,
      clever:    `${companion.emoji} ${name} schlägt vor: Finde einen kreativeren Weg`,
      strong:    `${companion.emoji} ${name} sagt: Du bist stärker als du denkst. Mach Sport!`,
    };
    quests.push({
      id: `quest-${Date.now()}-companion`,
      title: msgs[personality] || `${companion.emoji} ${name}: Bleib auf Kurs!`,
      description: `Dein Begleiter ${name} begleitet dich auf deinem Weg.`,
      priority: 'medium',
      type: 'companion',
      categories: [],
      product: null,
      humanInputRequired: false,
      createdBy: 'system',
      status: 'open',
      createdAt: now(),
      claimedBy: userId,
      completedBy: null,
      completedAt: null,
      parentQuestId: null,
      recurrence: 'daily',
      streak: 0,
      lore: null,
      chapter: null,
      nextQuestTemplate: null,
      coopPartners: null,
      skills: null,
      minLevel: null,
      proof: null,
      companionOwnerId: userId,
    });
  }
  saveQuests();
}

// ─── Roadmap store ────────────────────────────────────────────────────────────
let roadmapData = [];

function loadRoadmap() {
  try {
    if (fs.existsSync(ROADMAP_FILE)) {
      const raw = JSON.parse(fs.readFileSync(ROADMAP_FILE, 'utf8'));
      if (Array.isArray(raw)) roadmapData = raw;
    } else {
      saveRoadmap();
    }
  } catch (e) { console.warn('[roadmap] Failed to load:', e.message); }
}

function saveRoadmap() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ROADMAP_FILE, JSON.stringify(roadmapData, null, 2));
  } catch (e) { console.warn('[roadmap] Failed to persist:', e.message); }
}

// Auto-create campaigns from quests that share parentQuestId chains
function autoCreateCampaigns() {
  const allCampaignQuestIds = new Set(campaigns.flatMap(c => c.questIds));
  // Find root quests (no parentQuestId) that have children not yet in a campaign
  const orphanedChildIds = quests
    .filter(q => q.parentQuestId && !allCampaignQuestIds.has(q.id))
    .map(q => q.id);
  if (orphanedChildIds.length === 0) return;

  // Group by chain root
  const chains = {};
  for (const q of quests) {
    if (!q.parentQuestId) continue;
    if (allCampaignQuestIds.has(q.id)) continue;
    // Walk up to root
    let rootId = q.parentQuestId;
    let parent = quests.find(p => p.id === q.parentQuestId);
    while (parent && parent.parentQuestId) {
      rootId = parent.parentQuestId;
      parent = quests.find(p => p.id === parent.parentQuestId);
    }
    if (!chains[rootId]) chains[rootId] = new Set();
    chains[rootId].add(q.id);
  }

  let created = 0;
  for (const [rootId, childSet] of Object.entries(chains)) {
    if (allCampaignQuestIds.has(rootId)) continue;
    const rootQuest = quests.find(q => q.id === rootId);
    if (!rootQuest) continue;
    const childIds = Array.from(childSet).sort((a, b) => {
      const qa = quests.find(q => q.id === a);
      const qb = quests.find(q => q.id === b);
      return new Date(qa?.createdAt || 0) - new Date(qb?.createdAt || 0);
    });
    const allIds = [rootId, ...childIds];
    const bossQuest = allIds.map(id => quests.find(q => q.id === id)).find(q => q?.type === 'boss');
    const icon = bossQuest ? '🐉' : rootQuest.type === 'learning' ? '📚' : rootQuest.type === 'fitness' ? '💪' : '⚔️';
    const campaign = {
      id: `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: rootQuest.chapter || rootQuest.title,
      description: rootQuest.description || '',
      icon,
      lore: rootQuest.lore || '',
      createdBy: rootQuest.createdBy || 'system',
      createdAt: now(),
      status: 'active',
      questIds: allIds,
      bossQuestId: bossQuest?.id || null,
      rewards: { xp: 0, gold: 0, title: '' },
    };
    campaigns.push(campaign);
    created++;
  }
  if (created > 0) {
    saveCampaigns();
    console.log(`[campaigns] Auto-created ${created} campaign(s) from quest chains`);
  }
}

function getAgent(name) {
  return store.agents[name.toLowerCase()] || null;
}

function now() {
  return new Date().toISOString();
}

function sanitizeAgent(agent) {
  const { commands, ...safe } = agent;
  return { ...safe, pendingCommands: (commands || []).filter(c => c.status === 'pending').length };
}

const XP_BY_PRIORITY  = { high: 30, medium: 20, low: 10 };
const GOLD_BY_PRIORITY = { high: [20, 30], medium: [12, 20], low: [6, 12] };
function randGold(priority) {
  const [min, max] = GOLD_BY_PRIORITY[priority] || [6, 12];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const TEMP_BY_PRIORITY = { high: 15, medium: 10, low: 5 };

// ─── Achievement flavor text descriptions (updated) ─────────────────────────
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

// ─── Achievements catalogue ─────────────────────────────────────────────────
const ACHIEVEMENT_CATALOGUE = [
  // Milestones
  { id: 'first_quest',  name: 'First Quest',        icon: '⚔',  desc: ACHIEVEMENT_FLAVOR['first_quest'] || 'Complete your first quest',        category: 'milestone', hidden: false, trigger: (u) => (u.questsCompleted || 0) >= 1   },
  { id: 'apprentice',   name: 'Apprentice',           icon: '📜', desc: 'Complete 10 quests',               category: 'milestone', hidden: false, trigger: (u) => (u.questsCompleted || 0) >= 10  },
  { id: 'knight',       name: 'Knight',               icon: '🛡',  desc: 'Complete 50 quests',              category: 'milestone', hidden: false, trigger: (u) => (u.questsCompleted || 0) >= 50  },
  { id: 'legend',       name: 'Legend',               icon: '👑', desc: ACHIEVEMENT_FLAVOR['legend'] || 'Complete 100 quests',              category: 'milestone', hidden: false, trigger: (u) => (u.questsCompleted || 0) >= 100 },
  // Streaks
  { id: 'week_warrior', name: 'Week Warrior',         icon: '🔥', desc: ACHIEVEMENT_FLAVOR['dedicated'] || '7-day quest streak',               category: 'streak',    hidden: false, trigger: (u) => (u.streakDays || 0) >= 7   },
  { id: 'monthly_champ',name: 'Monthly Champion',     icon: '💎', desc: ACHIEVEMENT_FLAVOR['marathoner'] || '30-day quest streak',              category: 'streak',    hidden: false, trigger: (u) => (u.streakDays || 0) >= 30  },
  // Speed
  { id: 'lightning',    name: 'Lightning Hands',      icon: '⚡', desc: ACHIEVEMENT_FLAVOR['hot_streak'] || 'Complete 3 quests in one day',     category: 'speed',     hidden: false, trigger: (u) => (u._todayCount || 0) >= 3  },
  // Variety
  { id: 'all_trades',   name: 'Jack of All Trades',   icon: '🎯', desc: ACHIEVEMENT_FLAVOR['versatile'] || 'Complete all quest types',         category: 'variety',   hidden: false, trigger: (u) => (u._completedTypes || new Set()).size >= 5 },
  // Boss Battles
  { id: 'boss_slayer',  name: 'Boss Slayer',          icon: '🐉', desc: ACHIEVEMENT_FLAVOR['boss_slayer'] || 'Defeat your first Boss Battle',    category: 'boss',      hidden: false, trigger: (u) => (u._bossDefeated || false) },
  // Companions
  { id: 'ember_sprite', name: 'Ember Sprite',         icon: '🔮', desc: 'Complete 10 development quests',   category: 'companion', hidden: false, trigger: (u) => (u._devCount || 0) >= 10 },
  { id: 'lore_owl',     name: 'Lore Owl',             icon: '🦉', desc: 'Complete 5 learning quests',       category: 'companion', hidden: false, trigger: (u) => (u._learningCount || 0) >= 5 },
  { id: 'gear_golem',   name: 'Gear Golem',           icon: '🤖', desc: ACHIEVEMENT_FLAVOR['gear_master'] || 'Reach Knight level (300 XP)',       category: 'companion', hidden: false, trigger: (u) => (u.xp || 0) >= 300 },
  // Challenges
  { id: 'challenge_coder',  name: 'Code Sprinter',    icon: '💻', desc: 'Complete the 30-Day Code Sprint',  category: 'challenge', hidden: false, trigger: (u) => (u._challengesCompleted || []).includes('code_sprint') },
  { id: 'challenge_learner',name: 'Marathon Learner', icon: '📖', desc: 'Complete the Learning Marathon',   category: 'challenge', hidden: false, trigger: (u) => (u._challengesCompleted || []).includes('learning_marathon') },
  // New Regular Achievements
  { id: 'night_owl',        name: 'Night Owl',        icon: '🦉',  desc: ACHIEVEMENT_FLAVOR['night_owl'] || 'Complete a quest between 23:00 and 05:00',  category: 'speed',     hidden: false, trigger: (u) => false },
  { id: 'speed_runner',     name: 'Speed Runner',     icon: '⚡',  desc: 'Complete a quest within 1 hour of claiming it',   category: 'speed',     hidden: false, trigger: (u) => false },
  { id: 'social_butterfly', name: 'Social Butterfly', icon: '🦋',  desc: 'Complete 5 social quests',                       category: 'variety',   hidden: false, trigger: (u) => (u._socialCount || 0) >= 5 },
  { id: 'scholar',          name: 'Scholar',          icon: '📚',  desc: 'Complete 10 learning quests',                    category: 'variety',   hidden: false, trigger: (u) => (u._learningCount || 0) >= 10 },
  { id: 'gym_rat',          name: 'Gym Rat',          icon: '🏋',  desc: 'Complete 10 fitness quests',                     category: 'variety',   hidden: false, trigger: (u) => (u._fitnessCount || 0) >= 10 },
  { id: 'chain_master',     name: 'Chain Master',     icon: '🔗',  desc: 'Complete a full quest chain',                    category: 'milestone', hidden: false, trigger: (u) => false },
  { id: 'campaign_victor',  name: 'Campaign Victor',  icon: '🏆',  desc: 'Complete a campaign',                            category: 'milestone', hidden: false, trigger: (u) => false },
  { id: 'npc_whisperer',    name: 'NPC Whisperer',    icon: '💬',  desc: 'Have all agents online at the same time',        category: 'milestone', hidden: false, trigger: (u) => false },
  { id: 'forge_novice',     name: 'Forge Novice',     icon: '🔨',  desc: 'Complete your first development quest',          category: 'milestone', hidden: false, trigger: (u) => (u._devCount || 0) >= 1 },
  { id: 'arena_first',      name: 'Arena Debut',      icon: '🥊',  desc: 'Complete your first fitness quest',              category: 'milestone', hidden: false, trigger: (u) => (u._fitnessCount || 0) >= 1 },
  { id: 'scholar_first',    name: 'First Scroll',     icon: '📜',  desc: 'Complete your first learning quest',             category: 'milestone', hidden: false, trigger: (u) => (u._learningCount || 0) >= 1 },
  { id: 'ten_quests',       name: 'Ten Quest Mark',   icon: '🎯',  desc: 'Complete 10 quests total',                       category: 'milestone', hidden: false, trigger: (u) => (u.questsCompleted || 0) >= 10 },
  { id: 'fifty_quests',     name: 'Half Century',     icon: '🌟',  desc: 'Complete 50 quests total',                       category: 'milestone', hidden: false, trigger: (u) => (u.questsCompleted || 0) >= 50 },
  { id: 'coop_hero',        name: 'Co-op Hero',       icon: '🤜',  desc: 'Complete a co-op quest',                         category: 'milestone', hidden: false, trigger: (u) => false },
  { id: 'early_bird',       name: 'Early Bird',       icon: '🌅',  desc: ACHIEVEMENT_FLAVOR['early_bird'] || 'Complete 3 quests before 08:00', category: 'speed', hidden: false, trigger: (u) => false },
  // Hidden Achievements
  { id: 'forbidden_code',   name: 'The Forbidden Code', icon: '🌑', desc: 'Complete a quest on a Sunday',      category: 'hidden', hidden: true, trigger: (u) => false },
  { id: 'easter_egg',       name: 'Easter Egg Hunter',  icon: '🥚', desc: 'Found something secret...',         category: 'hidden', hidden: true, trigger: (u) => false },
  { id: 'perfectionist',    name: 'Perfectionist',       icon: '💯', desc: ACHIEVEMENT_FLAVOR['completionist'] || 'Complete 100 quests', category: 'hidden', hidden: true, trigger: (u) => (u.questsCompleted || 0) >= 100 },
  { id: 'no_rest',          name: 'No Rest for the Wicked', icon: '😈', desc: ACHIEVEMENT_FLAVOR['marathoner'] || 'Maintain a 30-day streak', category: 'hidden', hidden: true, trigger: (u) => (u.streakDays || 0) >= 30 },
  { id: 'one_ring',         name: 'The One Ring',        icon: '💍', desc: ACHIEVEMENT_FLAVOR['gold_hoarder'] || 'Earn 1000 gold total', category: 'hidden', hidden: true, trigger: (u) => (u.gold || 0) >= 1000 },
];

function checkAndAwardAchievements(userId) {
  const u = users[userId];
  if (!u) return [];
  u.earnedAchievements = u.earnedAchievements || [];
  const earned = new Set(u.earnedAchievements.map(a => a.id));
  const newOnes = [];
  for (const ach of ACHIEVEMENT_CATALOGUE) {
    if (!earned.has(ach.id) && ach.trigger(u)) {
      const entry = { id: ach.id, name: ach.name, icon: ach.icon, desc: ach.desc, category: ach.category, earnedAt: now() };
      u.earnedAchievements.push(entry);
      newOnes.push(entry);
    }
  }
  return newOnes;
}

// Today date string YYYY-MM-DD
function todayStr() { return new Date().toISOString().slice(0, 10); }

function updateUserStreak(userId) {
  const u = users[userId];
  if (!u) return;
  const today = todayStr();
  if (u.streakLastDate === today) return; // already counted today
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (u.streakLastDate === yesterday) {
    u.streakDays = (u.streakDays || 0) + 1;
  } else {
    u.streakDays = 1;
  }
  u.streakLastDate = today;
  // Bond XP for maintaining streak
  if (u.companion) {
    u.companion.bondXp = (u.companion.bondXp || 0) + 0.25;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
  }
}

function awardUserGold(userId, priority, streakDays) {
  const u = users[userId];
  if (!u) return;
  const base = randGold(priority);
  const multiplier = Math.min(1 + (streakDays || 0) * 0.1, 3);
  u.gold = (u.gold || 0) + Math.round(base * multiplier);
}

function updateUserForgeTemp(userId, priority) {
  const u = users[userId];
  if (!u) return;
  const recovery = TEMP_BY_PRIORITY[priority] || 5;
  u.forgeTemp = Math.min(100, (u.forgeTemp ?? 100) + recovery);
}

function getXpMultiplier(userId) {
  const u = users[userId];
  if (!u) return 1;
  const temp = u.forgeTemp ?? 100;
  return temp === 0 ? 0.5 : 1;
}

// Dynamic per-player forgeTemp: based on completed quests in last 24h
// 0 quests=0%, 1=20%, 2=40%, 3=60%, 5+=80%, 8+=100%
function calcDynamicForgeTemp(userId) {
  const now24h = Date.now() - 24 * 3600 * 1000;
  const playerName = userId.toLowerCase();
  let count = 0;
  for (const q of quests) {
    if (q.status === 'completed' && q.completedAt) {
      const completor = (q.completedBy || '').toLowerCase();
      if (completor === playerName && new Date(q.completedAt).getTime() >= now24h) {
        count++;
      }
    }
  }
  if (count >= 8) return 100;
  if (count >= 5) return 80;
  if (count >= 3) return 60;
  if (count >= 2) return 40;
  if (count >= 1) return 20;
  return 0;
}

// Track today's quest completions per user (in-memory, resets on restart)
const todayCompletions = {}; // userId → { date, count, types: Set }

function recordUserCompletion(userId, questType) {
  const today = todayStr();
  if (!todayCompletions[userId] || todayCompletions[userId].date !== today) {
    todayCompletions[userId] = { date: today, count: 0, types: new Set() };
  }
  todayCompletions[userId].count++;
  todayCompletions[userId].types.add(questType || 'development');
}

function onQuestCompletedByUser(userId, quest) {
  const u = users[userId];
  if (!u) return [];
  u.questsCompleted = (u.questsCompleted || 0) + 1;
  const xpBase = XP_BY_PRIORITY[quest.priority] || 10;
  const xpMulti = getXpMultiplier(userId);
  const gear = getUserGear(userId);
  const gearBonus = 1 + (gear.xpBonus || 0) / 100;
  // Companion XP buff: +2% per unlocked forge companion
  const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
  const earnedIds = new Set((u.earnedAchievements || []).map(a => a.id));
  const companionBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
  // Bond level XP bonus: +1% per bond level above 1 (max +9%)
  const bondBonus = 1 + 0.01 * Math.max(0, (u.companion?.bondLevel ?? 1) - 1);
  u.xp = (u.xp || 0) + Math.round(xpBase * xpMulti * gearBonus * companionBonus * bondBonus);
  // Award bond XP for completing a companion quest
  if (quest.type === 'companion' && u.companion) {
    u.companion.bondXp = (u.companion.bondXp || 0) + 1;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
    u._companionQuestCount = (u._companionQuestCount || 0) + 1;
  }
  updateUserStreak(userId);
  awardUserGold(userId, quest.priority, u.streakDays);
  updateUserForgeTemp(userId, quest.priority);
  recordUserCompletion(userId, quest.type);
  // Update temp _todayCount and _completedTypes for achievement checks
  const tc = todayCompletions[userId];
  u._todayCount = tc ? tc.count : 0;
  // accumulate completed types across all time
  u._allCompletedTypes = u._allCompletedTypes || [];
  if (!(u._allCompletedTypes.includes(quest.type || 'development'))) {
    u._allCompletedTypes.push(quest.type || 'development');
  }
  u._completedTypes = new Set(u._allCompletedTypes);
  // Track per-type counts for companions and achievements
  u._devCount = (u._devCount || 0) + ((quest.type === 'development' || !quest.type) ? 1 : 0);
  u._learningCount = (u._learningCount || 0) + (quest.type === 'learning' ? 1 : 0);
  u._fitnessCount = (u._fitnessCount || 0) + (quest.type === 'fitness' ? 1 : 0);
  u._socialCount = (u._socialCount || 0) + (quest.type === 'social' ? 1 : 0);
  // Check boss parent — if all sub-quests complete, mark boss defeated
  if (quest.parentQuestId) {
    const parent = quests.find(q => q.id === quest.parentQuestId);
    if (parent && parent.type === 'boss') {
      const children = quests.filter(q => q.parentQuestId === parent.id);
      const allDone = children.every(c => c.status === 'completed' || c.id === quest.id);
      if (allDone) u._bossDefeated = true;
    }
  }
  const newAchs = checkAndAwardAchievements(userId);
  delete u._todayCount;
  delete u._completedTypes;
  delete u._bossDefeated;
  // Loot drop — level-scaled
  const { level: playerLevel } = getLevelInfo(u.xp || 0);
  const pityGuaranteed = checkLootPity(userId);
  const isBossQuest = quest.type === 'boss' || (quest.parentQuestId && (() => {
    const parent = quests.find(q => q.id === quest.parentQuestId);
    return parent && parent.type === 'boss';
  })());
  let dropChance = pityGuaranteed ? 1 : 0.25;
  let forcedMinRarity = null;
  if (isBossQuest) {
    dropChance = 1; // guaranteed drop on boss quests
    if (playerLevel >= 25 && Math.random() < 0.10) forcedMinRarity = 'legendary';
    else if (playerLevel >= 15 && Math.random() < 0.50) forcedMinRarity = 'epic';
    else forcedMinRarity = 'rare';
  }
  let droppedLoot = null;
  if (forcedMinRarity) {
    // Guaranteed minimum rarity — pick from that tier directly
    const pool = (lootTables[forcedMinRarity] || lootTables.rare || []).filter(item => (item.minLevel || 1) <= playerLevel);
    if (pool.length > 0) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      droppedLoot = { ...item, rarity: forcedMinRarity, rarityColor: RARITY_COLORS[forcedMinRarity] };
    }
  } else {
    droppedLoot = rollLoot(dropChance, playerLevel);
  }
  if (droppedLoot) {
    resetLootPity(userId);
    addLootToInventory(userId, droppedLoot);
    u._lastLoot = droppedLoot;
  }
  saveUsers();
  return newAchs;
}

// ─── Streak Milestones ────────────────────────────────────────────────────────
const STREAK_MILESTONES = [
  { days: 7,   badge: '🥉', label: 'Bronze',           xpBonus: 5,  lootTier: null },
  { days: 14,  badge: '🎁', label: '2-Wochen',         xpBonus: 0,  lootTier: 'uncommon' },
  { days: 21,  badge: '🥈', label: 'Silber',           xpBonus: 10, lootTier: null },
  { days: 30,  badge: '📅', label: 'Monat',            xpBonus: 0,  lootTier: 'rare' },
  { days: 60,  badge: '🥇', label: 'Gold',             xpBonus: 15, lootTier: null },
  { days: 90,  badge: '🗿', label: 'Unerschütterlich', xpBonus: 0,  lootTier: 'epic' },
  { days: 180, badge: '💎', label: 'Diamond',          xpBonus: 25, lootTier: null },
  { days: 365, badge: '🟠', label: 'Legendary',        xpBonus: 0,  lootTier: 'legendary' },
];

function getStreakMilestone(streak) {
  let current = null;
  for (const m of STREAK_MILESTONES) {
    if (streak >= m.days) current = m;
  }
  return current;
}

function getNextStreakMilestone(streak) {
  for (const m of STREAK_MILESTONES) {
    if (streak < m.days) return m;
  }
  return null;
}

function getStreakXpBonus(streak) {
  const m = getStreakMilestone(streak);
  return m ? m.xpBonus / 100 : 0;
}

// ─── Loot System ─────────────────────────────────────────────────────────────
const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
const RARITY_COLORS = {
  common:    '#9ca3af',
  uncommon:  '#22c55e',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f97316',
};

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function getMaxRarity(playerLevel) {
  if (playerLevel >= 25) return 'legendary';
  if (playerLevel >= 17) return 'epic';
  if (playerLevel >= 9)  return 'rare';
  return 'uncommon';
}

function rollLoot(dropChance, playerLevel = 1) {
  if (Math.random() > dropChance) return null;
  const maxRarity = getMaxRarity(playerLevel);
  const maxIdx = RARITY_ORDER.indexOf(maxRarity);
  // Build filtered weights (only rarities up to maxRarity)
  const filteredWeights = {};
  let total = 0;
  for (const [r, w] of Object.entries(RARITY_WEIGHTS)) {
    if (RARITY_ORDER.indexOf(r) <= maxIdx) {
      filteredWeights[r] = w;
      total += w;
    }
  }
  const roll = Math.random() * total;
  let cumulative = 0;
  let rarity = 'common';
  for (const [r, w] of Object.entries(filteredWeights)) {
    cumulative += w;
    if (roll < cumulative) { rarity = r; break; }
  }
  const pool = (lootTables[rarity] || lootTables.common).filter(item => (item.minLevel || 1) <= playerLevel);
  if (!pool || pool.length === 0) {
    const fallback = (lootTables.common || []);
    if (fallback.length === 0) return null;
    const item = fallback[Math.floor(Math.random() * fallback.length)];
    return { ...item, rarity: 'common', rarityColor: RARITY_COLORS['common'] };
  }
  const item = pool[Math.floor(Math.random() * pool.length)];
  return { ...item, rarity, rarityColor: RARITY_COLORS[rarity] };
}

function addLootToInventory(userId, lootItem) {
  const u = users[userId];
  if (!u || !lootItem) return;
  if (!u.inventory) u.inventory = [];
  const entry = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    itemId: lootItem.id,
    name: lootItem.name,
    emoji: lootItem.emoji,
    rarity: lootItem.rarity,
    rarityColor: lootItem.rarityColor,
    effect: lootItem.effect,
    obtainedAt: now(),
  };
  u.inventory.push(entry);
  // Apply immediate effects
  if (lootItem.effect.type === 'gold') u.gold = (u.gold || 0) + lootItem.effect.amount;
  if (lootItem.effect.type === 'xp') u.xp = (u.xp || 0) + lootItem.effect.amount;
  if (lootItem.effect.type === 'streak_shield') {
    u.streakShields = Math.min(3, (u.streakShields || 0) + lootItem.effect.amount);
    // Remove from inventory (consumed immediately)
    u.inventory = u.inventory.filter(i => i.id !== entry.id);
  }
  if (lootItem.effect.type === 'bond' && u.companion) {
    u.companion.bondXp = (u.companion.bondXp || 0) + lootItem.effect.amount;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
  }
  if (lootItem.effect.type === 'forge_temp') {
    u.forgeTemp = Math.min(1, (u.forgeTemp || 0) + (lootItem.effect.amount || 0) / 100);
  }
  if (lootItem.effect.type === 'random_gear' || lootItem.effect.type === 'random_gear_epic') {
    const { level: playerLvl } = getLevelInfo(u.xp || 0);
    const minRarity = lootItem.effect.type === 'random_gear_epic' ? 'epic' : 'rare';
    const minRarityIdx = RARITY_ORDER.indexOf(minRarity);
    const eligible = FULL_GEAR_ITEMS.filter(g =>
      g.minLevel <= playerLvl &&
      !g.shopHidden &&
      RARITY_ORDER.indexOf(g.rarity || 'common') >= minRarityIdx
    );
    const pool = eligible.length > 0 ? eligible : FULL_GEAR_ITEMS.filter(g => g.minLevel <= playerLvl);
    if (pool.length > 0) {
      const gearItem = pool[Math.floor(Math.random() * pool.length)];
      // Add gear ID string to inventory so character screen can show it
      if (!u.inventory.includes(gearItem.id)) u.inventory.push(gearItem.id);
      entry.resolvedGear = { id: gearItem.id, name: gearItem.name, slot: gearItem.slot, emoji: gearItem.emoji };
    }
  }
  saveUsers();
  return entry;
}

// Pity counter: track tasks without loot drops per user
function checkLootPity(userId) {
  const u = users[userId];
  if (!u) return false;
  u._lootPity = (u._lootPity || 0) + 1;
  if (u._lootPity >= 5) {
    u._lootPity = 0;
    return true; // guaranteed drop
  }
  return false;
}

function resetLootPity(userId) {
  const u = users[userId];
  if (u) u._lootPity = 0;
}

// ─── Full Equipment System (6 slots, 4 stats) ────────────────────────────────
const EQUIPMENT_SLOTS = ['weapon', 'shield', 'helm', 'armor', 'amulet', 'boots'];

const FULL_GEAR_ITEMS = [
  // Tier 1 — Abenteurer-Set (Level 1-8)
  { id: 'wood-sword',    slot: 'weapon', tier: 1, name: 'Holzschwert',      emoji: '⚔️', cost: 50,  minLevel: 1, stats: { kraft: 2 },                  setId: 'adventurer' },
  { id: 'wood-shield',   slot: 'shield', tier: 1, name: 'Holzschild',       emoji: '🛡️', cost: 50,  minLevel: 1, stats: { ausdauer: 2 },               setId: 'adventurer' },
  { id: 'leather-helm',  slot: 'helm',   tier: 1, name: 'Lederkappe',       emoji: '🪖', cost: 50,  minLevel: 1, stats: { weisheit: 1 },               setId: 'adventurer' },
  { id: 'leather-armor', slot: 'armor',  tier: 1, name: 'Lederrüstung',     emoji: '🧥', cost: 75,  minLevel: 1, stats: { ausdauer: 1, kraft: 1 },     setId: 'adventurer' },
  { id: 'copper-chain',  slot: 'amulet', tier: 1, name: 'Kupferkette',      emoji: '📿', cost: 50,  minLevel: 1, stats: { glueck: 2 },                 setId: 'adventurer' },
  { id: 'travel-boots',  slot: 'boots',  tier: 1, name: 'Wanderstiefel',    emoji: '👢', cost: 50,  minLevel: 1, stats: { glueck: 1 },                 setId: 'adventurer' },
  // Tier 2 — Veteranen-Set (Level 9-16)
  { id: 'steel-sword',   slot: 'weapon', tier: 2, name: 'Stahlschwert',     emoji: '⚔️', cost: 200, minLevel: 9,  stats: { kraft: 4, ausdauer: 1 },    setId: 'veteran' },
  { id: 'iron-shield',   slot: 'shield', tier: 2, name: 'Eisenschild',      emoji: '🛡️', cost: 200, minLevel: 9,  stats: { ausdauer: 4 },              setId: 'veteran' },
  { id: 'chain-helm',    slot: 'helm',   tier: 2, name: 'Kettenhaube',      emoji: '🪖', cost: 200, minLevel: 9,  stats: { weisheit: 3, ausdauer: 1 }, setId: 'veteran' },
  { id: 'chain-armor',   slot: 'armor',  tier: 2, name: 'Kettenhemd',       emoji: '🧥', cost: 300, minLevel: 9,  stats: { ausdauer: 3, kraft: 2 },    setId: 'veteran' },
  { id: 'silver-amulet', slot: 'amulet', tier: 2, name: 'Silberamulett',    emoji: '📿', cost: 200, minLevel: 9,  stats: { glueck: 4 },                setId: 'veteran' },
  { id: 'iron-boots',    slot: 'boots',  tier: 2, name: 'Eisenstiefel',     emoji: '👢', cost: 200, minLevel: 9,  stats: { glueck: 2, ausdauer: 1 },   setId: 'veteran' },
  // Tier 3 — Meister-Set (Level 17-24)
  { id: 'rune-sword',    slot: 'weapon', tier: 3, name: 'Runenschwert',     emoji: '⚔️', cost: 500, minLevel: 17, stats: { kraft: 7, weisheit: 2 },    setId: 'master' },
  { id: 'dragon-scale',  slot: 'shield', tier: 3, name: 'Drachenschuppe',   emoji: '🛡️', cost: 500, minLevel: 17, stats: { ausdauer: 6, kraft: 2 },    setId: 'master' },
  { id: 'arcane-helm',   slot: 'helm',   tier: 3, name: 'Arkanistenhaube',  emoji: '🪖', cost: 500, minLevel: 17, stats: { weisheit: 6, glueck: 1 },   setId: 'master' },
  { id: 'mythril-armor', slot: 'armor',  tier: 3, name: 'Mythril-Rüstung',  emoji: '🧥', cost: 700, minLevel: 17, stats: { ausdauer: 5, kraft: 3, weisheit: 1 }, setId: 'master' },
  { id: 'gold-medallion',slot: 'amulet', tier: 3, name: 'Gold-Medaillon',   emoji: '📿', cost: 500, minLevel: 17, stats: { glueck: 6, weisheit: 1 },   setId: 'master' },
  { id: 'wind-boots',    slot: 'boots',  tier: 3, name: 'Windläufer-Stiefel',emoji:'👢', cost: 500, minLevel: 17, stats: { glueck: 4, kraft: 2 },      setId: 'master' },
  // Tier 4 — Legendäres Set (Level 25-30)
  { id: 'dawn-blade',    slot: 'weapon', tier: 4, name: 'Klinge der Morgenröte',    emoji: '⚔️', cost: 1000, minLevel: 25, stats: { kraft: 10, weisheit: 4, glueck: 2 }, setId: 'legendary' },
  { id: 'aegis-shield',  slot: 'shield', tier: 4, name: 'Aegis des Unbesiegbaren',  emoji: '🛡️', cost: 1000, minLevel: 25, stats: { ausdauer: 10, kraft: 3 }, setId: 'legendary' },
  { id: 'wise-crown',    slot: 'helm',   tier: 4, name: 'Krone der Weisen',          emoji: '🪖', cost: 1000, minLevel: 25, stats: { weisheit: 10, glueck: 3 }, setId: 'legendary' },
  { id: 'dragon-armor',  slot: 'armor',  tier: 4, name: 'Drachenblut-Panzer',       emoji: '🧥', cost: 1500, minLevel: 25, stats: { ausdauer: 8, kraft: 5, weisheit: 2 }, setId: 'legendary' },
  { id: 'luck-heart',    slot: 'amulet', tier: 4, name: 'Herz des Glücks',           emoji: '📿', cost: 1000, minLevel: 25, stats: { glueck: 10, weisheit: 2 }, setId: 'legendary' },
  { id: 'world-boots',   slot: 'boots',  tier: 4, name: 'Stiefel des Weltenwanderers', emoji: '👢', cost: 1000, minLevel: 25, stats: { glueck: 6, kraft: 4, ausdauer: 2 }, setId: 'legendary' },
];

const SET_BONUSES = {
  adventurer: { name: 'Abenteurer-Set', tier: 1 },
  veteran:    { name: 'Veteranen-Set',  tier: 2 },
  master:     { name: 'Meister-Set',    tier: 3 },
  legendary:  { name: 'Legendäres Set', tier: 4 },
};

function getUserEquipment(userId) {
  const u = users[userId];
  if (!u) return {};
  return u.equipment || {};
}

function getUserStats(userId) {
  const u = users[userId];
  if (!u) return { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 };
  const equipped = u.equipment || {};
  let stats = { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 };
  const equippedItems = [];
  for (const itemId of Object.values(equipped)) {
    const item = FULL_GEAR_ITEMS.find(g => g.id === itemId);
    if (item) {
      equippedItems.push(item);
      for (const [stat, val] of Object.entries(item.stats)) {
        stats[stat] = (stats[stat] || 0) + val;
      }
    }
  }
  // Tier set bonus check (existing)
  const setCount = {};
  for (const item of equippedItems) {
    setCount[item.setId] = (setCount[item.setId] || 0) + 1;
  }
  let setBonus = 1.0;
  for (const [setId, count] of Object.entries(setCount)) {
    if (count >= 6) setBonus = Math.max(setBonus, 1.10);
    else if (count >= 3) setBonus = Math.max(setBonus, 1.05);
  }
  if (setBonus > 1.0) {
    for (const stat of ['kraft', 'ausdauer', 'weisheit', 'glueck']) {
      stats[stat] = Math.round((stats[stat] || 0) * setBonus);
    }
    stats._setBonus = setBonus;
  }
  // Named set bonuses (NPC rewards)
  const equippedIds = new Set(equippedItems.map(i => i.id));
  for (const ns of gearTemplates.namedSets || []) {
    const ownedPieces = ns.pieces.filter(pid => equippedIds.has(pid));
    const count = ownedPieces.length;
    if (count === 0) continue;
    // Check partial bonuses
    if (ns.partialBonus) {
      for (const [threshold, bonus] of Object.entries(ns.partialBonus)) {
        if (count >= Number(threshold)) {
          for (const [stat, val] of Object.entries(bonus)) {
            if (stat !== 'label') stats[stat] = (stats[stat] || 0) + val;
          }
        }
      }
    }
    // Full bonus (all pieces equipped)
    if (count >= ns.pieces.length && ns.fullBonus) {
      const fb = ns.fullBonus;
      if (fb.allStats) {
        for (const stat of ['kraft', 'ausdauer', 'weisheit', 'glueck']) {
          stats[stat] = (stats[stat] || 0) + fb.allStats;
        }
      }
      for (const [stat, val] of Object.entries(fb)) {
        if (stat !== 'label' && stat !== 'allStats') stats[stat] = (stats[stat] || 0) + val;
      }
    }
  }
  return stats;
}

// GLÜ stat increases loot drop chance by 0.5% per point (max +12%)
function getUserDropBonus(userId) {
  const stats = getUserStats(userId);
  return Math.min(0.12, (stats.glueck || 0) * 0.005);
}

function awardXP(agentKey, priority) {
  if (!agentKey || !store.agents[agentKey]) return;
  const xp = XP_BY_PRIORITY[priority] || 10;
  store.agents[agentKey].xp = (store.agents[agentKey].xp || 0) + xp;
}

function updateAgentStreak(agentKey) {
  const agent = store.agents[agentKey];
  if (!agent) return;
  const today = todayStr();
  if (agent.streakLastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (agent.streakLastDate === yesterday) {
    agent.streakDays = (agent.streakDays || 0) + 1;
  } else {
    agent.streakDays = 1;
  }
  agent.streakLastDate = today;
}

function awardAgentGold(agentKey, priority, streakDays) {
  const agent = store.agents[agentKey];
  if (!agent) return;
  const base = randGold(priority);
  const multiplier = Math.min(1 + (streakDays || 0) * 0.1, 3);
  agent.gold = (agent.gold || 0) + Math.round(base * multiplier);
}

// ─── Agent API ─────────────────────────────────────────────────────────────────

// POST /api/agent/:name/status — agent posts its current status
app.post('/api/agent/:name/status', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!store.agents[name]) {
    return res.status(404).json({ error: `Unknown agent: ${name}` });
  }
  const validStatuses = ['online', 'working', 'idle', 'offline'];
  const validHealth = ['ok', 'needs_checkin', 'broken'];

  const { status, platform, uptime, currentJobDuration, jobsCompleted, revenue, health } = req.body;

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });
  }
  if (health && !validHealth.includes(health)) {
    return res.status(400).json({ error: `Invalid health. Use: ${validHealth.join(', ')}` });
  }

  const agent = store.agents[name];
  if (status !== undefined) agent.status = status;
  if (platform !== undefined) agent.platform = platform;
  if (uptime !== undefined) agent.uptime = Number(uptime);
  if (currentJobDuration !== undefined) agent.currentJobDuration = Number(currentJobDuration);
  if (jobsCompleted !== undefined) agent.jobsCompleted = Number(jobsCompleted);
  if (revenue !== undefined) agent.revenue = Number(revenue);
  if (health !== undefined) agent.health = health;
  agent.lastUpdate = now();

  saveData();
  console.log(`[${name}] status → ${agent.status} | platform: ${agent.platform} | health: ${agent.health}`);
  res.json({ ok: true, agent: sanitizeAgent(agent) });
});

// GET /api/agents — get all agents
app.get('/api/agents', (req, res) => {
  const STALE_MS = 30 * 60 * 1000; // 30 minutes
  const nowMs = Date.now();
  for (const agent of Object.values(store.agents)) {
    if (agent.lastUpdate && (nowMs - new Date(agent.lastUpdate).getTime()) > STALE_MS) {
      if (agent.health === 'ok') agent.health = 'stale';
    }
  }
  res.json(Object.values(store.agents).map(sanitizeAgent));
});

// GET /api/agent/:name — get single agent
app.get('/api/agent/:name', (req, res) => {
  const agent = getAgent(req.params.name);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(sanitizeAgent(agent));
});

// POST /api/agent/:name/command — send a command to an agent
app.post('/api/agent/:name/command', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!store.agents[name]) {
    return res.status(404).json({ error: `Unknown agent: ${name}` });
  }
  const { command, params } = req.body;
  if (!command) return res.status(400).json({ error: 'command is required' });
  const cmd = {
    id: `cmd-${Date.now()}`,
    command,
    params: params || {},
    issuedAt: now(),
    status: 'pending',
  };
  store.agents[name].commands = [cmd, ...(store.agents[name].commands || [])].slice(0, 50);
  saveData();
  console.log(`[${name}] command queued: ${command}`);
  res.json({ ok: true, command: cmd });
});

// GET /api/agent/:name/commands — agent polls for pending commands
app.get('/api/agent/:name/commands', (req, res) => {
  const agent = getAgent(req.params.name);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const pending = (agent.commands || []).filter(c => c.status === 'pending');
  res.json(pending);
});

// PATCH /api/agent/:name/command/:cmdId — agent acknowledges/completes a command
app.patch('/api/agent/:name/command/:cmdId', (req, res) => {
  const agent = getAgent(req.params.name);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const cmd = (agent.commands || []).find(c => c.id === req.params.cmdId);
  if (!cmd) return res.status(404).json({ error: 'Command not found' });
  cmd.status = req.body.status || 'acknowledged';
  saveData();
  res.json({ ok: true, command: cmd });
});

// POST /api/agent/:name/register — auto-register a new agent if not known
app.post('/api/agent/:name/register', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  const { role, description, color, avatar } = req.body;
  if (!store.agents[name]) {
    store.agents[name] = {
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
      role: role || 'Agent',
      description: description || '',
      color: color || '#666',
      avatar: avatar || name.slice(0, 2).toUpperCase(),
    };
    AGENT_NAMES.push(name);
    console.log(`[register] new agent: ${name}`);
  } else {
    // Update meta fields if provided in the request body
    if (avatar !== undefined) store.agents[name].avatar = avatar;
    if (role !== undefined) store.agents[name].role = role;
    if (description !== undefined) store.agents[name].description = description;
    if (color !== undefined) store.agents[name].color = color;
  }
  saveData();
  res.json({ ok: true, agent: sanitizeAgent(store.agents[name]) });
});

// POST /api/agent/:name/checkin — mark check-in complete, reset health to "ok"
app.post('/api/agent/:name/checkin', requireApiKey, (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!store.agents[name]) {
    return res.status(404).json({ error: `Unknown agent: ${name}` });
  }
  store.agents[name].health = 'ok';
  store.agents[name].lastUpdate = now();
  saveData();
  console.log(`[${name}] checkin complete — health reset to ok`);
  res.json({ ok: true, agent: sanitizeAgent(store.agents[name]) });
});

// GET /api/version
const dashboardPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const electronPkg  = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'electron-quest-app', 'package.json'), 'utf8')); }
  catch (_) { return { version: '1.0.0' }; }
})();
app.get('/api/version', (req, res) => {
  res.json({ dashboard: dashboardPkg.version, app: electronPkg.version });
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, agents: AGENT_NAMES.length, time: now() });
});

// ─── Quest API ──────────────────────────────────────────────────────────────────

// POST /api/quest — create a new quest
app.post('/api/quest', requireApiKey, (req, res) => {
  const { title, description, priority, category, categories, product, humanInputRequired, createdBy, type, parentQuestId, recurrence, proof, nextQuestTemplate, coopPartners, skills, lore, chapter, suggest, minLevel } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const validPriorities = ['low', 'medium', 'high'];
  const validCategories = ['Coding', 'Research', 'Content', 'Sales', 'Infrastructure', 'Bug Fix', 'Feature'];
  const validProducts = ['Dashboard', 'Companion App', 'Infrastructure', 'Other'];
  const validTypes = ['development', 'personal', 'learning', 'social', 'fitness', 'boss', 'relationship-coop', 'companion'];
  const validRecurrences = ['daily', 'weekly', 'monthly'];
  const PLAYER_QUEST_TYPES = ['personal', 'learning', 'fitness', 'social', 'relationship-coop', 'companion'];
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: `Invalid priority. Use: ${validPriorities.join(', ')}` });
  }
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Use: ${validTypes.join(', ')}` });
  }
  if (recurrence && !validRecurrences.includes(recurrence)) {
    return res.status(400).json({ error: `Invalid recurrence. Use: ${validRecurrences.join(', ')}` });
  }
  // Normalize: support both category (string, backward compat) and categories (array)
  let resolvedCategories = [];
  if (categories && Array.isArray(categories)) {
    const invalid = categories.find(c => !validCategories.includes(c));
    if (invalid) return res.status(400).json({ error: `Invalid category: ${invalid}. Use: ${validCategories.join(', ')}` });
    resolvedCategories = categories;
  } else if (category) {
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Use: ${validCategories.join(', ')}` });
    }
    resolvedCategories = [category];
  }
  if (product && !validProducts.includes(product)) {
    return res.status(400).json({ error: `Invalid product. Use: ${validProducts.join(', ')}` });
  }
  // Validate parentQuestId if provided
  if (parentQuestId) {
    const parent = quests.find(q => q.id === parentQuestId);
    if (!parent) return res.status(400).json({ error: `Parent quest not found: ${parentQuestId}` });
  }
  const resolvedCreatedBy = typeof createdBy === 'string' && createdBy.trim() ? createdBy.trim() : 'unknown';
  // Agent-created quests go to 'suggested' for human review; human-created stay 'open'
  // Player quest types (personal/learning/fitness/social) always bypass review → 'open'
  const HUMAN_CREATORS = ['leon', 'unknown', ...NPC_NAMES];
  const isAgentCreated = !HUMAN_CREATORS.includes(resolvedCreatedBy.toLowerCase());
  const resolvedType = type || 'development';
  const isPlayerQuestType = PLAYER_QUEST_TYPES.includes(resolvedType);
  const incomingKey = req.headers['x-api-key'];
  const masterKey = getMasterKey();
  const isAdminKey = (incomingKey === masterKey) || (incomingKey === ADMIN_KEY);
  // If suggest=true or non-admin creates a development quest, set to suggested
  const forceSuggested = suggest === true;
  const questStatus = forceSuggested ? 'suggested' : ((isPlayerQuestType || !isAgentCreated) ? 'open' : 'suggested');
  // Validate nextQuestTemplate if provided
  let resolvedNextQuestTemplate = null;
  if (nextQuestTemplate && typeof nextQuestTemplate === 'object') {
    resolvedNextQuestTemplate = {
      title: String(nextQuestTemplate.title || '').trim() || null,
      description: String(nextQuestTemplate.description || '').trim() || null,
      type: validTypes.includes(nextQuestTemplate.type) ? nextQuestTemplate.type : resolvedType,
      priority: validPriorities.includes(nextQuestTemplate.priority) ? nextQuestTemplate.priority : (priority || 'medium'),
    };
    if (!resolvedNextQuestTemplate.title) resolvedNextQuestTemplate = null;
  }
  const quest = {
    id: `quest-${Date.now()}`,
    title,
    description: description || '',
    priority: priority || 'medium',
    type: resolvedType,
    categories: resolvedCategories,
    product: product || null,
    humanInputRequired: humanInputRequired === true || humanInputRequired === 'true',
    createdBy: resolvedCreatedBy,
    status: questStatus,
    createdAt: now(),
    claimedBy: null,
    completedBy: null,
    completedAt: null,
    parentQuestId: parentQuestId || null,
    recurrence: validRecurrences.includes(recurrence) ? recurrence : null,
    streak: 0,
    lastCompletedAt: null,
    proof: proof || null,
    checklist: null,
    nextQuestTemplate: resolvedNextQuestTemplate,
    coopPartners: Array.isArray(coopPartners) && coopPartners.length > 0 ? coopPartners.slice(0, 2).map(p => String(p).toLowerCase()) : null,
    coopClaimed: [],
    coopCompletions: [],
    skills: Array.isArray(skills) ? skills.map(s => String(s).trim()).filter(Boolean) : [],
    lore: typeof lore === 'string' && lore.trim() ? lore.trim() : null,
    chapter: typeof chapter === 'string' && chapter.trim() ? chapter.trim() : null,
    minLevel: (typeof minLevel === 'number' && minLevel >= 1) ? Math.floor(minLevel) : 1,
  };
  quests.push(quest);
  saveQuests();
  // Auto-add template entry to catalog
  try {
    const tpl = {
      id: `tpl-${quest.id}`,
      title: quest.title,
      description: quest.description || '',
      type: quest.type,
      category: quest.parentQuestId ? 'chainQuest' : (quest.skills && quest.skills.length > 0 ? 'classQuest' : 'generic'),
      classId: quest.skills && quest.skills.length > 0 ? quest.skills[0] : null,
      minLevel: quest.minLevel || 1,
      chainId: quest.parentQuestId || null,
      chainOrder: null,
      difficulty: quest.priority === 'high' ? 'advanced' : quest.priority === 'medium' ? 'intermediate' : 'starter',
      estimatedTime: null,
      rewards: { xp: XP_BY_PRIORITY[quest.priority] || 10, gold: 0 },
      tags: quest.skills || [],
      createdBy: quest.createdBy,
      createdAt: quest.createdAt,
    };
    questCatalog.templates.push(tpl);
    rebuildCatalogMeta();
    saveQuestCatalog();
  } catch (_) {}
  console.log(`[quest] created: ${quest.id} — "${title}"`);
  res.json({ ok: true, quest });
});

// PATCH /api/quest/:id/checklist — update checklist items on a quest
// Body: { items: [{ text: string, done: boolean }] }
app.patch('/api/quest/:id/checklist', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
  quest.checklist = items.map(i => ({ text: String(i.text || ''), done: !!i.done }));
  saveQuests();
  res.json({ ok: true, checklist: quest.checklist });
});

// POST /api/quests/household-rotate — rotate auto_assign for recurring household quests
// Cycles through the provided assignees list and assigns the next person
app.post('/api/quests/household-rotate', requireApiKey, (req, res) => {
  const { assignees } = req.body; // e.g. ["leon", "user2"]
  if (!Array.isArray(assignees) || assignees.length === 0) {
    return res.status(400).json({ error: 'assignees must be a non-empty array' });
  }
  const household = quests.filter(q => q.recurrence && q.status === 'open' && !q.claimedBy);
  let rotated = 0;
  household.forEach((q, i) => {
    q.claimedBy = assignees[i % assignees.length];
    q.status = 'in_progress';
    rotated++;
  });
  if (rotated > 0) saveQuests();
  res.json({ ok: true, rotated });
});

// POST /api/quest/:id/claim — agent/player claims a quest
app.post('/api/quest/:id/claim', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  const agentKey = agentId.toLowerCase();

  // Player quest types use per-player tracking
  if (PLAYER_QUEST_TYPES.includes(quest.type) && users[agentKey]) {
    const pp = getPlayerProgress(agentKey);
    if (pp.completedQuests && pp.completedQuests[quest.id]) {
      return res.status(409).json({ error: 'Quest already completed by this player' });
    }
    if (pp.claimedQuests.includes(quest.id)) {
      return res.status(409).json({ error: 'Quest already claimed by this player' });
    }
    pp.claimedQuests.push(quest.id);
    savePlayerProgress();
    console.log(`[quest] ${quest.id} claimed (per-player) by ${agentKey}`);
    return res.json({ ok: true, quest: { ...quest, status: 'in_progress', claimedBy: agentKey } });
  }

  // Dev quests / non-player users: global shared state
  if (quest.status !== 'open') return res.status(409).json({ error: `Quest is already ${quest.status}` });
  quest.status = 'in_progress';
  quest.claimedBy = agentId;
  saveQuests();
  console.log(`[quest] ${quest.id} claimed by ${agentId}`);
  res.json({ ok: true, quest });
});

// POST /api/quest/:id/complete — mark quest as done
app.post('/api/quest/:id/complete', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  const agentKey = agentId.toLowerCase();

  // Player quest types: per-player completion (quest stays globally open for others)
  if (PLAYER_QUEST_TYPES.includes(quest.type) && users[agentKey]) {
    const pp = getPlayerProgress(agentKey);
    if (pp.completedQuests && pp.completedQuests[quest.id]) {
      return res.status(409).json({ error: 'Quest already completed by this player' });
    }
    const completedAt = now();
    pp.completedQuests[quest.id] = { at: completedAt, proof: quest.proof || null };
    pp.claimedQuests = (pp.claimedQuests || []).filter(id => id !== quest.id);
    // Track recurrence streak per player (in playerProgress)
    if (quest.recurrence) {
      pp.recurringStreak = pp.recurringStreak || {};
      pp.recurringStreak[quest.id] = (pp.recurringStreak[quest.id] || 0) + 1;
    }
    savePlayerProgress();
    const newAchievements = onQuestCompletedByUser(agentKey, quest);
    const lootDrop = users[agentKey]?._lastLoot || null;
    if (users[agentKey]) delete users[agentKey]._lastLoot;
    console.log(`[quest] ${quest.id} completed (per-player) by ${agentKey}`);
    return res.json({
      ok: true,
      quest: { ...quest, status: 'completed', completedBy: agentKey, completedAt },
      newAchievements,
      lootDrop,
      chainQuestTemplate: quest.nextQuestTemplate || null,
    });
  }

  // Dev quests / non-player users: global shared state
  if (quest.status === 'completed') return res.status(409).json({ error: 'Quest already completed' });
  quest.status = 'completed';
  quest.completedBy = agentId;
  quest.completedAt = now();
  if (quest.recurrence) {
    quest.streak = (quest.streak || 0) + 1;
    quest.lastCompletedAt = now();
  }
  saveQuests();
  let newAchievements = [];
  if (users[agentKey]) {
    newAchievements = onQuestCompletedByUser(agentKey, quest);
  } else if (store.agents[agentKey]) {
    store.agents[agentKey].questsCompleted = (store.agents[agentKey].questsCompleted || 0) + 1;
    awardXP(agentKey, quest.priority);
    awardAgentGold(agentKey, quest.priority, store.agents[agentKey].streakDays);
    updateAgentStreak(agentKey);
    saveData();
  }
  const lootDrop = users[agentKey]?._lastLoot || null;
  if (users[agentKey]) delete users[agentKey]._lastLoot;
  console.log(`[quest] ${quest.id} completed by ${agentId}`);
  res.json({ ok: true, quest, newAchievements, lootDrop, chainQuestTemplate: quest.nextQuestTemplate || null });
});

// POST /api/quest/:id/unclaim — agent/player unclaims a quest
app.post('/api/quest/:id/unclaim', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  const agentKey = agentId.toLowerCase();

  // Player quest types use per-player tracking
  if (PLAYER_QUEST_TYPES.includes(quest.type) && users[agentKey]) {
    const pp = getPlayerProgress(agentKey);
    if (!pp.claimedQuests.includes(quest.id)) {
      return res.status(409).json({ error: 'Quest not claimed by this player' });
    }
    pp.claimedQuests = pp.claimedQuests.filter(id => id !== quest.id);
    savePlayerProgress();
    console.log(`[quest] ${quest.id} unclaimed (per-player) by ${agentKey}`);
    return res.json({ ok: true, quest: { ...quest, status: 'open', claimedBy: null } });
  }

  // Dev quests / non-player users: global shared state
  if (quest.claimedBy !== agentId) {
    return res.status(409).json({ error: `Quest not claimed by this agent` });
  }
  quest.status = 'open';
  quest.claimedBy = null;
  saveQuests();
  console.log(`[quest] ${quest.id} unclaimed by ${agentId}`);
  res.json({ ok: true, quest });
});

// POST /api/quest/:id/coop-claim — player claims their part of a co-op quest
app.post('/api/quest/:id/coop-claim', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.type !== 'relationship-coop') return res.status(400).json({ error: 'Not a co-op quest' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const uid = userId.toLowerCase();
  if (quest.coopPartners && !quest.coopPartners.includes(uid)) {
    return res.status(403).json({ error: 'User is not a co-op partner for this quest' });
  }
  quest.coopClaimed = quest.coopClaimed || [];
  if (quest.coopClaimed.includes(uid)) {
    return res.status(409).json({ error: 'Already claimed by this user' });
  }
  quest.coopClaimed.push(uid);
  if (quest.status === 'open') {
    quest.status = 'in_progress';
    quest.claimedBy = uid;
  }
  saveQuests();
  console.log(`[coop] ${quest.id} co-claimed by ${uid}`);
  res.json({ ok: true, quest });
});

// POST /api/quest/:id/coop-complete — player marks their part as done
app.post('/api/quest/:id/coop-complete', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.type !== 'relationship-coop') return res.status(400).json({ error: 'Not a co-op quest' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const uid = userId.toLowerCase();
  quest.coopCompletions = quest.coopCompletions || [];
  if (quest.coopCompletions.includes(uid)) {
    return res.status(409).json({ error: 'Already marked complete by this user' });
  }
  quest.coopCompletions.push(uid);
  // Check if all partners have completed
  const partners = quest.coopPartners || quest.coopClaimed || [];
  const allDone = partners.length > 0 && partners.every(p => quest.coopCompletions.includes(p));
  let newAchievements = [];
  if (allDone) {
    quest.status = 'completed';
    quest.completedAt = now();
    quest.completedBy = quest.coopCompletions.join('+');
    for (const partnerId of partners) {
      if (users[partnerId]) {
        const achs = onQuestCompletedByUser(partnerId, quest);
        newAchievements = [...newAchievements, ...achs];
      }
    }
  }
  saveQuests();
  console.log(`[coop] ${quest.id} part completed by ${uid} — allDone: ${allDone}`);
  res.json({ ok: true, quest, allDone, newAchievements });
});

// GET /api/quests — list all quests grouped by status
// ?player=X  → overlays per-player state for player quest types + applies minLevel filtering
app.get('/api/quests', (req, res) => {
  const typeFilter  = req.query.type;
  const playerParam = req.query.player ? String(req.query.player).toLowerCase() : null;
  const allCampaignQuestIds = new Set(campaigns.flatMap(c => c.questIds));

  function enrichEpics(list) {
    return list.map(q => {
      const children = quests.filter(c => c.parentQuestId === q.id);
      if (children.length === 0) return q;
      const completedCount = children.filter(c => c.status === 'completed').length;
      return { ...q, children, progress: { completed: completedCount, total: children.length } };
    });
  }

  function filterAndEnrich(statusFilter, sourceList) {
    const src = sourceList || quests;
    let list = src.filter(q => q.status === statusFilter && !q.parentQuestId && !allCampaignQuestIds.has(q.id));
    if (typeFilter) list = list.filter(q => q.type === typeFilter);
    return enrichEpics(list);
  }

  if (playerParam) {
    const userRecord = users[playerParam];
    const playerXp   = userRecord ? (userRecord.xp || 0) : 0;
    const playerLevel = getLevelInfo(playerXp).level;
    const pp = getPlayerProgress(playerParam);
    const completedIds = new Set(Object.keys(pp.completedQuests || {}));
    const claimedIds   = new Set(pp.claimedQuests || []);

    // Partition quests into player-type vs dev-type
    const allTopLevel = quests.filter(q => !q.parentQuestId && !allCampaignQuestIds.has(q.id));
    const playerTypeQuests = allTopLevel.filter(q => PLAYER_QUEST_TYPES.includes(q.type || 'development'));
    const devTypeQuests    = allTopLevel.filter(q => !PLAYER_QUEST_TYPES.includes(q.type || 'development'));

    // Apply per-player status overlay to player quest types
    const openPlayer       = [];
    const inProgressPlayer = [];
    const completedPlayer  = [];
    const lockedPlayer     = [];

    for (const q of playerTypeQuests) {
      if (typeFilter && q.type !== typeFilter) continue;
      // Skip suggested/rejected (not visible to players)
      if (q.status === 'suggested' || q.status === 'rejected') continue;

      const minLvl = q.minLevel || 1;
      if (playerLevel < minLvl) {
        lockedPlayer.push({ ...q, playerStatus: 'locked' });
        continue;
      }
      if (completedIds.has(q.id)) {
        const record = pp.completedQuests[q.id] || {};
        completedPlayer.push({ ...q, status: 'completed', completedBy: playerParam, completedAt: record.at || null, claimedBy: playerParam });
      } else if (claimedIds.has(q.id)) {
        inProgressPlayer.push({ ...q, status: 'in_progress', claimedBy: playerParam });
      } else {
        openPlayer.push({ ...q, status: 'open', claimedBy: null, completedBy: null });
      }
    }

    // Filter open player quests to the active pool (fill if empty)
    let poolFilteredOpen = openPlayer;
    if (POOL_TYPES.some(t => !typeFilter || typeFilter === t)) {
      // Ensure pool is populated
      if (!pp.activeQuestPool || pp.activeQuestPool.length === 0) {
        pp.activeQuestPool = buildQuestPool(playerParam, playerLevel);
        savePlayerProgress();
      } else {
        // Remove stale IDs from pool
        const validIds = new Set(quests.filter(q => q.status === 'open' || q.status === 'in_progress').map(q => q.id));
        pp.activeQuestPool = pp.activeQuestPool.filter(id => validIds.has(id));
        if (pp.activeQuestPool.length < 3) {
          pp.activeQuestPool = buildQuestPool(playerParam, playerLevel);
          savePlayerProgress();
        }
      }
      const poolSet = new Set(pp.activeQuestPool);
      poolFilteredOpen = openPlayer.filter(q => poolSet.has(q.id));
    }

    // Dev quest types use global status as-is
    return res.json({
      open:       [...enrichEpics(poolFilteredOpen),  ...filterAndEnrich('open',        devTypeQuests)],
      inProgress: [...enrichEpics(inProgressPlayer), ...filterAndEnrich('in_progress', devTypeQuests)],
      completed:  [...enrichEpics(completedPlayer),  ...filterAndEnrich('completed',   devTypeQuests)],
      suggested:  filterAndEnrich('suggested', devTypeQuests),
      rejected:   filterAndEnrich('rejected',  devTypeQuests),
      // Show up to 3 locked quests as teaser, sorted by minLevel ascending
      locked: lockedPlayer.sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1)).slice(0, 3),
    });
  }

  res.json({
    open:       filterAndEnrich('open'),
    inProgress: filterAndEnrich('in_progress'),
    completed:  filterAndEnrich('completed'),
    suggested:  filterAndEnrich('suggested'),
    rejected:   filterAndEnrich('rejected'),
  });
});

// POST /api/quest/:id/approve — approve a suggested quest → open
app.post('/api/quest/:id/approve', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.status !== 'suggested') return res.status(409).json({ error: `Quest is not in suggested state (current: ${quest.status})` });
  quest.status = 'open';
  if (req.body && req.body.comment) quest.comment = req.body.comment;
  saveQuests();
  console.log(`[quest] ${quest.id} approved → open`);
  res.json({ ok: true, quest });
});

// POST /api/quest/:id/reject — reject any non-completed quest → rejected
app.post('/api/quest/:id/reject', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.status === 'completed') return res.status(409).json({ error: 'Cannot reject a completed quest' });
  quest.status = 'rejected';
  if (req.body && req.body.comment) quest.comment = req.body.comment;
  saveQuests();
  console.log(`[quest] ${quest.id} rejected`);
  res.json({ ok: true, quest });
});

// PATCH /api/quest/:id — update quest fields (priority, proof, title, description, claimedBy, etc.)
app.patch('/api/quest/:id', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { priority, proof, title, description, status, claimedBy } = req.body;
  if (priority !== undefined) {
    if (!['low', 'medium', 'high'].includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
    quest.priority = priority;
  }
  if (proof !== undefined) quest.proof = proof;
  if (title !== undefined) quest.title = title;
  if (description !== undefined) quest.description = description;
  if (claimedBy !== undefined) {
    quest.claimedBy = claimedBy;
    if (claimedBy && quest.status === 'open') quest.status = 'in_progress';
    if (!claimedBy && quest.status === 'in_progress') quest.status = 'open';
  }
  if (status !== undefined) {
    const validStatuses = ['open', 'in_progress', 'completed', 'suggested', 'rejected'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const wasCompleted = quest.status === 'completed';
    quest.status = status;
    if (status === 'completed' && !wasCompleted) {
      quest.completedAt = quest.completedAt || now();
      if (quest.claimedBy) awardXP(quest.claimedBy.toLowerCase(), quest.priority);
    }
  }
  saveQuests();
  res.json({ ok: true, quest });
});

// PATCH /api/quests/:id/complete — mark a quest as completed
app.patch('/api/quests/:id/complete', requireApiKey, (req, res) => {
  const { id } = req.params;
  const { completedBy } = req.body;

  const quest = quests.find(q => q.id === id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.status === 'completed') return res.status(409).json({ error: 'Quest already completed' });

  quest.status = 'completed';
  quest.completedBy = completedBy || 'unknown';
  quest.completedAt = now();
  saveQuests();
  const agentKey2 = (completedBy || '').toLowerCase();
  let newAchievements = [];
  if (users[agentKey2]) {
    newAchievements = onQuestCompletedByUser(agentKey2, quest);
  } else if (store.agents[agentKey2]) {
    store.agents[agentKey2].questsCompleted = (store.agents[agentKey2].questsCompleted || 0) + 1;
    awardXP(agentKey2, quest.priority);
    awardAgentGold(agentKey2, quest.priority, store.agents[agentKey2].streakDays);
    updateAgentStreak(agentKey2);
    saveData();
  }
  res.json({ success: true, message: 'Quest completed', quest, newAchievements });
});

// POST /api/quests/bulk-update — update status of multiple quests at once
app.post('/api/quests/bulk-update', requireApiKey, (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids must be a non-empty array' });
  const validStatuses = ['open', 'in_progress', 'completed', 'suggested', 'rejected'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });

  const updated = [];
  const notFound = [];
  for (const id of ids) {
    const quest = quests.find(q => q.id === id);
    if (!quest) { notFound.push(id); continue; }
    const wasNotCompleted = quest.status !== 'completed';
    quest.status = status;
    if (status === 'completed' && !quest.completedAt) {
      quest.completedAt = now();
      // Award XP to the agent who claimed it (if any)
      if (wasNotCompleted && quest.claimedBy) {
        awardXP(quest.claimedBy.toLowerCase(), quest.priority);
      }
    }
    updated.push(id);
  }
  if (updated.length > 0) { saveQuests(); saveData(); }
  console.log(`[bulk-update] status=${status} updated=${updated.length} notFound=${notFound.length}`);
  res.json({ ok: true, updated, notFound });
});

// GET /api/leaderboard — returns combined leaderboard
// mode=agents: agents only; mode=players: registered users only (default: agents for backward compat)
app.get('/api/leaderboard', (req, res) => {
  const agentIds = new Set(Object.keys(store.agents));

  // Build agents-only ranked list
  const agentsRanked = Object.values(store.agents)
    .map(a => {
      const levelInfo = getLevelInfo(a.xp || 0);
      return {
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        color: a.color,
        role: a.role,
        xp: a.xp || 0,
        questsCompleted: a.questsCompleted || 0,
        level: levelInfo.level,
        levelTitle: levelInfo.title,
        isAgent: true,
      };
    })
    .sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  // Build players-only ranked list (registered users, exclude agent IDs)
  const playersRanked = Object.values(users)
    .filter(u => !agentIds.has(u.id))
    .map(u => {
      const levelInfo = getLevelInfo(u.xp || 0);
      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        color: u.color,
        role: null,
        xp: u.xp || 0,
        questsCompleted: u.questsCompleted || 0,
        level: levelInfo.level,
        levelTitle: levelInfo.title,
        isAgent: false,
      };
    })
    .sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  // Return combined list with agents first for backward compat (client separates via isAgent)
  res.json([...agentsRanked, ...playersRanked]);
});

// ─── Quest Pool System ─────────────────────────────────────────────────────────
// Maintains a per-player pool of up to 10 player-type quests (personal/fitness/social/learning)
// Mix: 2-3 personal, 2-3 fitness, 2-3 social, 1-2 learning

const POOL_TYPES = ['personal', 'fitness', 'social', 'learning'];
const POOL_MIX = { personal: 3, fitness: 3, social: 2, learning: 2 }; // target counts

function buildQuestPool(playerName, playerLevel) {
  const uid = playerName.toLowerCase();
  const pp = getPlayerProgress(uid);
  const completedIds = new Set(Object.keys(pp.completedQuests || {}));
  const claimedIds = new Set(pp.claimedQuests || []);
  const pool = [];

  for (const type of POOL_TYPES) {
    const target = POOL_MIX[type] || 2;
    const candidates = quests.filter(q =>
      q.status === 'open' &&
      q.type === type &&
      !q.parentQuestId &&
      !completedIds.has(q.id) &&
      !claimedIds.has(q.id) &&
      (q.minLevel || 1) <= playerLevel
    );
    // Shuffle candidates
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(target, shuffled.length); i++) {
      pool.push(shuffled[i].id);
    }
  }
  return pool.slice(0, 10);
}

// GET /api/quests/pool?player=X — get or initialize the quest pool
app.get('/api/quests/pool', (req, res) => {
  const playerParam = req.query.player ? String(req.query.player).toLowerCase() : null;
  if (!playerParam) return res.status(400).json({ error: 'player parameter required' });
  const userRecord = users[playerParam];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(playerParam);
  const playerLevel = getLevelInfo(userRecord.xp || 0).level;

  // Fill pool if empty or has no valid quests
  if (!pp.activeQuestPool || pp.activeQuestPool.length === 0) {
    pp.activeQuestPool = buildQuestPool(playerParam, playerLevel);
    savePlayerProgress();
  } else {
    // Remove completed/rejected quests from pool
    const validIds = new Set(quests.filter(q => q.status === 'open' || q.status === 'in_progress').map(q => q.id));
    pp.activeQuestPool = pp.activeQuestPool.filter(id => validIds.has(id));
    if (pp.activeQuestPool.length < 3) {
      pp.activeQuestPool = buildQuestPool(playerParam, playerLevel);
      savePlayerProgress();
    }
  }

  const poolQuests = pp.activeQuestPool
    .map(id => quests.find(q => q.id === id))
    .filter(Boolean);

  res.json({ pool: poolQuests, lastRefresh: pp.lastPoolRefresh || null });
});

// POST /api/quests/pool/refresh?player=X — refresh the pool (1 per hour cooldown)
app.post('/api/quests/pool/refresh', requireApiKey, (req, res) => {
  const playerParam = req.query.player ? String(req.query.player).toLowerCase() : null;
  if (!playerParam) return res.status(400).json({ error: 'player parameter required' });
  const userRecord = users[playerParam];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(playerParam);
  const playerLevel = getLevelInfo(userRecord.xp || 0).level;

  // Cooldown check: 1 refresh per hour
  const now = Date.now();
  if (pp.lastPoolRefresh) {
    const elapsed = now - new Date(pp.lastPoolRefresh).getTime();
    if (elapsed < 3600 * 1000) {
      const waitMin = Math.ceil((3600 * 1000 - elapsed) / 60000);
      return res.status(429).json({ error: `Pool refresh cooldown. Try again in ${waitMin} min.` });
    }
  }

  pp.activeQuestPool = buildQuestPool(playerParam, playerLevel);
  pp.lastPoolRefresh = new Date().toISOString();
  savePlayerProgress();

  const poolQuests = pp.activeQuestPool
    .map(id => quests.find(q => q.id === id))
    .filter(Boolean);

  res.json({ ok: true, pool: poolQuests, lastRefresh: pp.lastPoolRefresh });
});

// GET /api/quests/reset-recurring — reset completed recurring quests based on interval
app.get('/api/quests/reset-recurring', (req, res) => {
  const nowMs = Date.now();
  const INTERVAL_MS = { daily: 24*3600*1000, weekly: 7*24*3600*1000, monthly: 30*24*3600*1000 };
  let resetCount = 0;
  for (const q of quests) {
    if (q.status !== 'completed' || !q.recurrence) continue;
    const interval = INTERVAL_MS[q.recurrence];
    if (!interval) continue;
    const lastDone = q.lastCompletedAt ? new Date(q.lastCompletedAt).getTime() : 0;
    if (nowMs - lastDone >= interval) {
      q.status = 'open';
      q.claimedBy = null;
      q.completedBy = null;
      q.completedAt = null;
      resetCount++;
    }
  }
  if (resetCount > 0) saveQuests();
  console.log(`[recurring] reset ${resetCount} recurring quest(s)`);
  res.json({ ok: true, reset: resetCount });
});

// GET /api/admin/keys
app.get('/api/admin/keys', requireMasterKey, (req, res) => {
  const master = getMasterKey();
  const allKeys = [
    { key: master, label: 'Master Key', created: null, isMaster: true },
    ...managedKeys.map(k => ({ ...k, isMaster: false })),
  ];
  res.json(allKeys.map(k => ({ ...k, masked: k.key.slice(0, 4) + '****' + k.key.slice(-4) })));
});

// POST /api/admin/keys
app.post('/api/admin/keys', requireMasterKey, (req, res) => {
  const { label } = req.body;
  const newKey = crypto.randomBytes(16).toString('hex');
  const entry = { key: newKey, label: label || `Key ${managedKeys.length + 1}`, created: now() };
  managedKeys.push(entry);
  validApiKeys.add(newKey);
  saveManagedKeys();
  console.log(`[admin] new key created: ${entry.label}`);
  res.json({ ok: true, key: newKey, masked: newKey.slice(0, 4) + '****' + newKey.slice(-4), label: entry.label });
});

// DELETE /api/admin/keys/:key
app.delete('/api/admin/keys/:key', requireMasterKey, (req, res) => {
  const keyParam = req.params.key;
  if (keyParam === getMasterKey()) {
    return res.status(400).json({ error: 'Cannot revoke master key' });
  }
  const before = managedKeys.length;
  managedKeys = managedKeys.filter(k => k.key !== keyParam);
  if (managedKeys.length < before) {
    validApiKeys.delete(keyParam);
    saveManagedKeys();
    console.log(`[admin] key revoked`);
    return res.json({ ok: true });
  }
  res.status(404).json({ error: 'Key not found' });
});

// ─── Campaign Endpoints ──────────────────────────────────────────────────────────

// GET /api/campaigns — list all campaigns with enriched quest details
app.get('/api/campaigns', (req, res) => {
  const enriched = campaigns.map(c => {
    const questDetails = c.questIds.map(id => {
      const q = quests.find(q => q.id === id);
      if (!q) return { id, title: '(deleted)', status: 'deleted' };
      return { id: q.id, title: q.title, status: q.status, priority: q.priority, type: q.type,
               completedBy: q.completedBy, completedAt: q.completedAt, claimedBy: q.claimedBy,
               lore: q.lore || null, description: q.description };
    });
    const completed = questDetails.filter(q => q.status === 'completed').length;
    return { ...c, quests: questDetails, progress: { completed, total: questDetails.length } };
  });
  res.json(enriched);
});

// POST /api/campaigns — create a campaign
app.post('/api/campaigns', requireApiKey, (req, res) => {
  const { title, description, icon, lore, createdBy, questIds, bossQuestId, rewards } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
  const campaign = {
    id: `campaign-${Date.now()}`,
    title: String(title).trim(),
    description: String(description || '').trim(),
    icon: icon || '⚔️',
    lore: String(lore || '').trim(),
    createdBy: createdBy || 'unknown',
    createdAt: now(),
    status: 'active',
    questIds: Array.isArray(questIds) ? questIds.filter(id => quests.find(q => q.id === id)) : [],
    bossQuestId: bossQuestId || null,
    rewards: { xp: Number(rewards?.xp) || 0, gold: Number(rewards?.gold) || 0, title: rewards?.title || '' },
  };
  campaigns.push(campaign);
  saveCampaigns();
  console.log(`[campaigns] Created: ${campaign.id} "${campaign.title}"`);
  res.status(201).json(campaign);
});

// GET /api/campaigns/:id — single campaign with full quest details
app.get('/api/campaigns/:id', (req, res) => {
  const campaign = campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const questDetails = campaign.questIds.map(id => {
    const q = quests.find(q => q.id === id);
    return q || { id, title: '(deleted)', status: 'deleted' };
  });
  const completed = questDetails.filter(q => q.status === 'completed').length;
  res.json({ ...campaign, quests: questDetails, progress: { completed, total: questDetails.length } });
});

// PATCH /api/campaigns/:id — update campaign fields
app.patch('/api/campaigns/:id', requireApiKey, (req, res) => {
  const campaign = campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const { title, description, icon, lore, status, bossQuestId, rewards, questIds } = req.body;
  if (title !== undefined) campaign.title = String(title).trim();
  if (description !== undefined) campaign.description = String(description);
  if (icon !== undefined) campaign.icon = icon;
  if (lore !== undefined) campaign.lore = String(lore);
  if (status !== undefined && ['active', 'completed', 'archived'].includes(status)) campaign.status = status;
  if (bossQuestId !== undefined) campaign.bossQuestId = bossQuestId || null;
  if (rewards !== undefined) campaign.rewards = { ...campaign.rewards, ...rewards };
  if (questIds !== undefined && Array.isArray(questIds)) campaign.questIds = questIds;
  saveCampaigns();
  res.json({ ok: true, campaign });
});

// DELETE /api/campaigns/:id — delete a campaign
app.delete('/api/campaigns/:id', requireApiKey, (req, res) => {
  const idx = campaigns.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });
  campaigns.splice(idx, 1);
  saveCampaigns();
  res.json({ ok: true });
});

// POST /api/campaigns/:id/add-quest — add a quest to a campaign
app.post('/api/campaigns/:id/add-quest', requireApiKey, (req, res) => {
  const campaign = campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const { questId } = req.body;
  if (!questId) return res.status(400).json({ error: 'questId required' });
  if (!quests.find(q => q.id === questId)) return res.status(404).json({ error: 'Quest not found' });
  if (!campaign.questIds.includes(questId)) campaign.questIds.push(questId);
  saveCampaigns();
  res.json({ ok: true, campaign });
});

// POST /api/campaigns/:id/remove-quest — remove a quest from a campaign
app.post('/api/campaigns/:id/remove-quest', requireApiKey, (req, res) => {
  const campaign = campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const { questId } = req.body;
  if (!questId) return res.status(400).json({ error: 'questId required' });
  campaign.questIds = campaign.questIds.filter(id => id !== questId);
  if (campaign.bossQuestId === questId) campaign.bossQuestId = null;
  saveCampaigns();
  res.json({ ok: true, campaign });
});

// GET /api/agent/:name/quests — get agent's active quests
app.get('/api/agent/:name/quests', (req, res) => {
  const name = req.params.name.toLowerCase();
  const active = quests.filter(q => q.claimedBy === name && q.status === 'in_progress');
  res.json(active);
});

// ─── API Documentation ──────────────────────────────────────────────────────────
const API_DOCS = {
  openapi: '3.0.3',
  info: {
    title: 'Agent Dashboard API',
    version: '1.0.0',
    description: 'REST API for managing and monitoring AI agents. Agents report status, receive commands, and can be queried by operators or other AI systems. POST endpoints always require an X-API-Key header. GET endpoints are public. Rate limited to 500 requests per 15 minutes per IP.',
  },
  servers: [
    { url: 'http://localhost:3001',         description: 'Local server' },
    { url: 'http://172.18.0.3:3001',        description: 'Docker internal (same host containers)' },
    { url: 'http://187.77.139.247:3001',    description: 'External access (browser, desktop apps)' },
  ],
  'x-network': {
    docker_internal: 'http://172.18.0.3:3001',
    external:        'http://187.77.139.247:3001',
    note: 'Agents running in Docker containers on the same host should use the docker_internal address. External clients (browser, Electron app) use the external address.',
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Required for all POST operations. GET endpoints are public. Multiple keys supported via API_KEYS env var (comma-separated). Each agent can have its own key.',
      },
    },
    schemas: {
      Agent: {
        type: 'object',
        properties: {
          id:                 { type: 'string',  example: 'nova',                       description: 'Unique agent id (lowercase)' },
          name:               { type: 'string',  example: 'Nova',                       description: 'Display name' },
          status:             { type: 'string',  enum: ['online','working','idle','offline'], example: 'working' },
          platform:           { type: 'string',  nullable: true, example: 'AWS',        description: 'Platform the agent runs on' },
          uptime:             { type: 'number',  example: 3600,                         description: 'Uptime in seconds' },
          currentJobDuration: { type: 'number',  example: 120,                          description: 'Current job duration in seconds' },
          jobsCompleted:      { type: 'number',  example: 42 },
          revenue:            { type: 'number',  example: 125.50,                       description: 'Total revenue generated (USD)' },
          health:             { type: 'string',  enum: ['ok','needs_checkin','broken','stale'], example: 'ok', description: 'ok=healthy, needs_checkin=agent requests attention, broken=error state, stale=no update in 30min' },
          lastUpdate:         { type: 'string',  format: 'date-time', nullable: true,   example: '2026-03-08T12:00:00.000Z' },
          pendingCommands:    { type: 'integer', example: 2,                            description: 'Number of pending commands' },
          role:               { type: 'string',  example: 'Optimizer' },
          description:        { type: 'string',  example: 'Metrics-driven optimizer with dry wit.',  description: 'Short personality-based description' },
          avatar:             { type: 'string',  example: 'NO',                         description: '2-char avatar code' },
          color:              { type: 'string',  example: '#8b5cf6',                    description: 'Hex color for dashboard display' },
        },
      },
      Command: {
        type: 'object',
        properties: {
          id:        { type: 'string', example: 'cmd-1741434000000',              description: 'Command id (cmd-{timestamp})' },
          command:   { type: 'string', example: 'run_task',                       description: 'Command name/type' },
          params:    { type: 'object', example: { task: 'analyze_sales', limit: 100 }, description: 'Optional command parameters' },
          issuedAt:  { type: 'string', format: 'date-time', example: '2026-03-08T12:00:00.000Z' },
          status:    { type: 'string', enum: ['pending','acknowledged','completed'], example: 'pending' },
        },
      },
      Quest: {
        type: 'object',
        properties: {
          id:                 { type: 'string',  example: 'quest-1741434000000' },
          title:              { type: 'string',  example: 'Analyze Q1 sales data' },
          description:        { type: 'string',  example: 'Pull the full Q1 sales report and identify top 3 opportunities.' },
          priority:           { type: 'string',  enum: ['low','medium','high'], example: 'high' },
          type:               { type: 'string',  enum: ['development','personal','learning','social'], example: 'development', description: 'Quest type. development=coding/dev work, personal=life tasks, learning=study/research, social=events/networking. Defaults to development.' },
          categories:         { type: 'array',   items: { type: 'string', enum: ['Coding','Research','Content','Sales','Infrastructure','Bug Fix','Feature'] }, example: ['Research','Coding'], description: 'Array of categories. Replaces the old category field. Send category (string) for backward compat.' },
          product:            { type: 'string',  nullable: true, enum: ['Dashboard','Companion App','Infrastructure','Other'], example: 'Dashboard', description: 'Optional product this quest belongs to.' },
          humanInputRequired: { type: 'boolean', example: false, description: 'If true, this quest requires human input and agents should not claim it alone.' },
          createdBy:          { type: 'string',  example: 'forge', description: 'Identifier of who created the quest. Use agent names (forge, lyra, pixel) for agent-generated quests, or a human name. Defaults to "unknown".' },
          status:             { type: 'string',  enum: ['open','in_progress','completed','suggested','rejected'], example: 'open', description: 'suggested=agent-created, pending human review; rejected=human rejected; open=ready for agents' },
          createdAt:          { type: 'string',  format: 'date-time' },
          claimedBy:          { type: 'string',  nullable: true, example: 'atlas' },
          completedBy:        { type: 'string',  nullable: true, example: 'atlas' },
          completedAt:        { type: 'string',  nullable: true, format: 'date-time' },
          parentQuestId:      { type: 'string',  nullable: true, example: null, description: 'If set, this quest is a sub-quest of the referenced epic quest.' },
          children:           { type: 'array',   description: 'Populated in GET /api/quests for epic quests. Contains child quest objects.', items: { type: 'object' } },
          progress:           { type: 'object',  description: 'Populated in GET /api/quests for epic quests with children.', properties: { completed: { type: 'integer' }, total: { type: 'integer' } } },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Agent not found' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        description: 'Check if the API server is running.',
        operationId: 'getHealth',
        tags: ['System'],
        responses: {
          200: {
            description: 'Server is running',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { ok: { type: 'boolean' }, agents: { type: 'integer' }, time: { type: 'string', format: 'date-time' } } },
                example: { ok: true, agents: 6, time: '2026-03-08T12:00:00.000Z' },
              },
            },
          },
        },
        'x-curl': 'curl http://localhost:3001/api/health',
        'x-python': 'import requests\nresp = requests.get("http://localhost:3001/api/health")\nprint(resp.json())',
      },
    },
    '/api/docs': {
      get: {
        summary: 'API documentation (this endpoint)',
        description: 'Returns the full OpenAPI 3.0 specification as JSON. Machine-parseable.',
        operationId: 'getDocs',
        tags: ['System'],
        responses: {
          200: { description: 'OpenAPI specification', content: { 'application/json': { schema: { type: 'object' } } } },
        },
        'x-curl': 'curl http://localhost:3001/api/docs',
        'x-python': 'import requests\ndocs = requests.get("http://localhost:3001/api/docs").json()\nfor path in docs["paths"]:\n    print(path)',
      },
    },
    '/api/agents': {
      get: {
        summary: 'List all agents',
        description: 'Returns current status of all registered agents. Good for an initial fleet overview. The dashboard polls this every 8 seconds.',
        operationId: 'listAgents',
        tags: ['Agents'],
        responses: {
          200: {
            description: 'Array of all agents',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Agent' } },
                example: [
                  { id: 'nova', name: 'Nova', status: 'working', platform: 'AWS', uptime: 7200, currentJobDuration: 300, jobsCompleted: 42, revenue: 125.50, health: 'ok', lastUpdate: '2026-03-08T12:00:00.000Z', pendingCommands: 1, role: 'Optimizer', avatar: 'NO', color: '#8b5cf6' },
                  { id: 'hex',  name: 'Hex',  status: 'idle',    platform: null, uptime: 1800, currentJobDuration: 0,   jobsCompleted: 17, revenue: 48.00,  health: 'ok', lastUpdate: '2026-03-08T11:55:00.000Z', pendingCommands: 0, role: 'Code Engineer', avatar: 'HX', color: '#10b981' },
                ],
              },
            },
          },
        },
        'x-curl': 'curl http://localhost:3001/api/agents',
        'x-python': 'import requests\nagents = requests.get("http://localhost:3001/api/agents").json()\nfor a in agents:\n    print(f"{a[\'name\']}: {a[\'status\']} | health={a[\'health\']} | revenue=${a[\'revenue\']}")',
      },
    },
    '/api/agent/{name}': {
      get: {
        summary: 'Get single agent',
        description: 'Returns current status for one agent. Agent name is case-insensitive. Known agents: nova, hex, echo, pixel, atlas, lyra.',
        operationId: 'getAgent',
        tags: ['Agents'],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, description: 'Agent name (case-insensitive)', example: 'nova' },
        ],
        responses: {
          200: { description: 'Agent object',    content: { 'application/json': { schema: { $ref: '#/components/schemas/Agent' } } } },
          404: { description: 'Agent not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Agent not found' } } } },
        },
        'x-curl': 'curl http://localhost:3001/api/agent/nova',
        'x-python': 'import requests\nagent = requests.get("http://localhost:3001/api/agent/nova").json()\nprint(agent["status"], agent["health"])',
      },
    },
    '/api/agent/{name}/status': {
      post: {
        summary: 'Update agent status',
        description: 'Agent reports its current status. All fields are optional — only provided fields are updated. Use this as an agent heartbeat. Persists to disk.',
        operationId: 'postAgentStatus',
        tags: ['Agents'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status:             { type: 'string', enum: ['online','working','idle','offline'] },
                  platform:           { type: 'string', example: 'AWS Lambda' },
                  uptime:             { type: 'number', example: 3600, description: 'Uptime in seconds' },
                  currentJobDuration: { type: 'number', example: 120,  description: 'Current job duration in seconds' },
                  jobsCompleted:      { type: 'number', example: 42 },
                  revenue:            { type: 'number', example: 125.50 },
                  health:             { type: 'string', enum: ['ok','needs_checkin','broken'] },
                },
              },
              example: { status: 'working', platform: 'AWS Lambda', uptime: 3600, currentJobDuration: 120, jobsCompleted: 42, revenue: 125.50, health: 'ok' },
            },
          },
        },
        responses: {
          200: { description: 'Status updated',           content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, agent: { $ref: '#/components/schemas/Agent' } } }, example: { ok: true, agent: { id: 'nova', name: 'Nova', status: 'working', health: 'ok', pendingCommands: 0 } } } } },
          400: { description: 'Invalid status/health',    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Invalid status. Use: online, working, idle, offline' } } } },
          401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Unauthorized', hint: 'Set X-API-Key header' } } } },
          404: { description: 'Agent not found',          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl -X POST http://localhost:3001/api/agent/nova/status \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"status":"working","health":"ok","uptime":3600,"revenue":125.50}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://localhost:3001/api/agent/nova/status",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"status": "working", "health": "ok", "uptime": 3600, "revenue": 125.50}\n)\nprint(resp.json())',
      },
    },
    '/api/agent/{name}/command': {
      post: {
        summary: 'Send command to agent',
        description: 'Queue a command for an agent. The agent picks it up on its next poll of /commands. Queue is LIFO, capped at 50. Use PATCH /command/:cmdId to mark commands as done.',
        operationId: 'postAgentCommand',
        tags: ['Commands'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['command'],
                properties: {
                  command: { type: 'string', example: 'run_task',                       description: 'Command name/type to execute' },
                  params:  { type: 'object', example: { task: 'analyze_sales', limit: 100 }, description: 'Optional parameters' },
                },
              },
              example: { command: 'run_task', params: { task: 'analyze_sales', limit: 100 } },
            },
          },
        },
        responses: {
          200: { description: 'Command queued',           content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, command: { $ref: '#/components/schemas/Command' } } }, example: { ok: true, command: { id: 'cmd-1741434000000', command: 'run_task', params: { task: 'analyze_sales' }, issuedAt: '2026-03-08T12:00:00.000Z', status: 'pending' } } } } },
          400: { description: 'Missing command field',    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'command is required' } } } },
          401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Agent not found',          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl -X POST http://localhost:3001/api/agent/nova/command \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"command":"run_task","params":{"task":"analyze_sales"}}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://localhost:3001/api/agent/nova/command",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"command": "run_task", "params": {"task": "analyze_sales"}}\n)\ncmd = resp.json()["command"]\nprint(f"Queued: {cmd[\'id\']}")',
      },
    },
    '/api/agent/{name}/commands': {
      get: {
        summary: 'Get pending commands',
        description: 'Returns all pending commands for an agent. Agents poll this to pick up new work. After processing, PATCH the command id to update its status.',
        operationId: 'getAgentCommands',
        tags: ['Commands'],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
        ],
        responses: {
          200: {
            description: 'Array of pending commands',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Command' } },
                example: [
                  { id: 'cmd-1741434000000', command: 'run_task', params: { task: 'analyze_sales' }, issuedAt: '2026-03-08T12:00:00.000Z', status: 'pending' },
                ],
              },
            },
          },
          404: { description: 'Agent not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl http://localhost:3001/api/agent/nova/commands',
        'x-python': 'import requests\ncmds = requests.get("http://localhost:3001/api/agent/nova/commands").json()\nfor cmd in cmds:\n    print(f"[{cmd[\'id\']}] {cmd[\'command\']} — {cmd[\'params\']}")',
      },
    },
    '/api/agent/{name}/command/{cmdId}': {
      patch: {
        summary: 'Acknowledge or complete a command',
        description: "Update a command's status. Agents call this after processing to acknowledge or mark complete.",
        operationId: 'patchAgentCommand',
        tags: ['Commands'],
        parameters: [
          { name: 'name',  in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
          { name: 'cmdId', in: 'path', required: true, schema: { type: 'string' }, example: 'cmd-1741434000000' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { status: { type: 'string', example: 'completed' } } },
              example: { status: 'completed' },
            },
          },
        },
        responses: {
          200: { description: 'Command updated',           content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, command: { $ref: '#/components/schemas/Command' } } }, example: { ok: true, command: { id: 'cmd-1741434000000', command: 'run_task', params: {}, issuedAt: '2026-03-08T12:00:00.000Z', status: 'completed' } } } } },
          404: { description: 'Agent or command not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl -X PATCH http://localhost:3001/api/agent/nova/command/cmd-1741434000000 \\\n  -H "Content-Type: application/json" \\\n  -d \'{"status":"completed"}\'',
        'x-python': 'import requests\nresp = requests.patch(\n    "http://localhost:3001/api/agent/nova/command/cmd-1741434000000",\n    json={"status": "completed"}\n)\nprint(resp.json())',
      },
    },
    '/api/agent/{name}/checkin': {
      post: {
        summary: 'Mark agent check-in complete',
        description: 'Resets agent health to "ok" after a check-in. Use this after resolving whatever triggered needs_checkin.',
        operationId: 'postAgentCheckin',
        tags: ['Agents'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'nova' },
        ],
        responses: {
          200: { description: 'Health reset to ok', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, agent: { $ref: '#/components/schemas/Agent' } } }, example: { ok: true, agent: { id: 'nova', health: 'ok' } } } } },
          401: { description: 'Missing or invalid API key' },
          404: { description: 'Agent not found' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/agent/nova/checkin \\\n  -H "X-API-Key: YOUR_API_KEY"',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/agent/nova/checkin",\n    headers={"X-API-Key": "YOUR_API_KEY"}\n)\nprint(resp.json())',
      },
    },
    '/api/agent/{name}/register': {
      post: {
        summary: 'Register a new agent',
        description: 'Dynamically register a new agent. If the agent already exists, returns the existing record (idempotent). Use for self-registration.',
        operationId: 'registerAgent',
        tags: ['Agents'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'myagent', description: 'Unique agent name (lowercase)' },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role:        { type: 'string', example: 'Analyzer' },
                  description: { type: 'string', example: 'Analyzes market data' },
                  color:       { type: 'string', example: '#60a5fa', description: 'Hex color' },
                  avatar:      { type: 'string', example: 'MA',      description: '2-char code' },
                },
              },
              example: { role: 'Analyzer', description: 'Analyzes market data', color: '#60a5fa', avatar: 'MA' },
            },
          },
        },
        responses: {
          200: { description: 'Agent registered',           content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, agent: { $ref: '#/components/schemas/Agent' } } } } } },
          401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
        'x-curl': 'curl -X POST http://localhost:3001/api/agent/myagent/register \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"role":"Analyzer","color":"#60a5fa","avatar":"MA"}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://localhost:3001/api/agent/myagent/register",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"role": "Analyzer", "color": "#60a5fa", "avatar": "MA"}\n)\nprint(resp.json())',
      },
    },
    '/api/quest': {
      post: {
        summary: 'Create a quest',
        description: 'Post a new quest to the board. All agents can see open quests and claim them. Use categories (array) for multi-category or category (string) for backward compat.',
        operationId: 'createQuest',
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title:              { type: 'string', example: 'Analyze Q1 sales data' },
                  description:        { type: 'string', example: 'Pull the full Q1 sales report and identify top 3 opportunities.' },
                  priority:           { type: 'string', enum: ['low','medium','high'], example: 'high' },
                  categories:         { type: 'array', items: { type: 'string', enum: ['Coding','Research','Content','Sales','Infrastructure','Bug Fix','Feature'] }, example: ['Research','Coding'], description: 'Preferred: array of categories.' },
                  category:           { type: 'string', enum: ['Coding','Research','Content','Sales','Infrastructure','Bug Fix','Feature'], example: 'Research', description: 'Backward compat: single category string. Converted to categories array internally.' },
                  product:            { type: 'string', enum: ['Dashboard','Companion App','Infrastructure','Other'], example: 'Dashboard', description: 'Optional product this quest belongs to.' },
                  humanInputRequired: { type: 'boolean', example: false, description: 'Set true if this quest requires human input. Agents will avoid claiming it.' },
                  createdBy:          { type: 'string', example: 'forge', description: 'Optional. Who created this quest. Use agent names for agent-generated quests. Defaults to "unknown".' },
                  type:               { type: 'string', enum: ['development','personal','learning','social'], example: 'development', description: 'Quest type. Defaults to development.' },
                  parentQuestId:      { type: 'string', example: 'quest-1741434000000', description: 'Optional. ID of parent epic quest. Makes this a sub-quest.' },
                },
              },
              example: { title: 'Analyze Q1 sales data', description: 'Identify top opportunities.', priority: 'high', categories: ['Research'], product: 'Dashboard', humanInputRequired: false, createdBy: 'forge', type: 'development' },
            },
          },
        },
        responses: {
          200: { description: 'Quest created', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, quest: { $ref: '#/components/schemas/Quest' } } } } } },
          400: { description: 'Missing title or invalid field' },
          401: { description: 'Missing or invalid API key' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/quest \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"title":"Fix login bug","priority":"high","categories":["Coding","Bug Fix"],"product":"Dashboard","humanInputRequired":false}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/quest",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"title": "Fix login bug", "priority": "high", "categories": ["Coding", "Bug Fix"], "product": "Dashboard", "humanInputRequired": False}\n)\nprint(resp.json())',
      },
    },
    '/api/quests': {
      get: {
        summary: 'List all quests',
        description: 'Returns quests grouped by status: open, inProgress, completed, suggested (agent-created, pending review), rejected. Supports ?type=personal|development|learning|social filter. Only top-level quests returned; epic quests include children[] and progress{}.',
        operationId: 'listQuests',
        tags: ['Quests'],
        parameters: [
          { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['development','personal','learning','social'] }, description: 'Filter quests by type.' },
        ],
        responses: {
          200: {
            description: 'Quests grouped by status',
            content: {
              'application/json': {
                schema: { type: 'object', properties: {
                  open:       { type: 'array', items: { $ref: '#/components/schemas/Quest' } },
                  inProgress: { type: 'array', items: { $ref: '#/components/schemas/Quest' } },
                  completed:  { type: 'array', items: { $ref: '#/components/schemas/Quest' } },
                  suggested:  { type: 'array', items: { $ref: '#/components/schemas/Quest' }, description: 'Agent-created quests pending human review' },
                  rejected:   { type: 'array', items: { $ref: '#/components/schemas/Quest' }, description: 'Quests rejected by human reviewer' },
                } },
              },
            },
          },
        },
        'x-curl': 'curl http://187.77.139.247:3001/api/quests',
        'x-python': 'import requests\nquests = requests.get("http://172.18.0.3:3001/api/quests").json()\nprint(f"Open: {len(quests[\'open\'])}, In Progress: {len(quests[\'inProgress\'])}")',
      },
    },
    '/api/quest/{id}/claim': {
      post: {
        summary: 'Claim a quest',
        description: 'Agent claims an open quest. Sets status to in_progress.',
        operationId: 'claimQuest',
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'quest-1741434000000' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string', example: 'atlas' } } }, example: { agentId: 'atlas' } } } },
        responses: {
          200: { description: 'Quest claimed' },
          409: { description: 'Quest already claimed' },
          401: { description: 'Missing or invalid API key' },
          404: { description: 'Quest not found' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/quest/quest-1741434000000/claim \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"agentId":"atlas"}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/quest/quest-1741434000000/claim",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"agentId": "atlas"}\n)\nprint(resp.json())',
      },
    },
    '/api/quest/{id}/unclaim': {
      post: {
        summary: 'Unclaim a quest',
        description: 'Agent releases a quest back to open status. Only the agent that claimed it can unclaim it.',
        operationId: 'unclaimQuest',
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'quest-1741434000000' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string', example: 'atlas' } } }, example: { agentId: 'atlas' } } } },
        responses: {
          200: { description: 'Quest unclaimed, status reset to open', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, quest: { $ref: '#/components/schemas/Quest' } } }, example: { ok: true, quest: { id: 'quest-1741434000000', status: 'open', claimedBy: null } } } } },
          409: { description: 'Quest not claimed by this agent', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Quest not claimed by this agent' } } } },
          401: { description: 'Missing or invalid API key' },
          404: { description: 'Quest not found' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/quest/quest-1741434000000/unclaim \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"agentId":"atlas"}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/quest/quest-1741434000000/unclaim",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"agentId": "atlas"}\n)\nprint(resp.json())',
      },
    },
    '/api/quest/{id}/complete': {
      post: {
        summary: 'Complete a quest',
        description: 'Marks a quest as completed. Any agent can complete any in-progress quest.',
        operationId: 'completeQuest',
        tags: ['Quests'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'quest-1741434000000' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string', example: 'atlas' } } }, example: { agentId: 'atlas' } } } },
        responses: {
          200: { description: 'Quest completed' },
          409: { description: 'Quest already completed' },
          401: { description: 'Missing or invalid API key' },
          404: { description: 'Quest not found' },
        },
        'x-curl': 'curl -X POST http://187.77.139.247:3001/api/quest/quest-1741434000000/complete \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d \'{"agentId":"atlas"}\'',
        'x-python': 'import requests\nresp = requests.post(\n    "http://172.18.0.3:3001/api/quest/quest-1741434000000/complete",\n    headers={"X-API-Key": "YOUR_API_KEY"},\n    json={"agentId": "atlas"}\n)\nprint(resp.json())',
      },
    },
  },
};

app.get('/api/docs', (req, res) => {
  res.json(API_DOCS);
});

// ─── Web UI Documentation ───────────────────────────────────────────────────────
app.get('/docs', (req, res) => {
  res.type('html').send(buildDocsHtml(API_DOCS));
});

function buildDocsHtml(docs) {
  const methodColor = { get: '#3b82f6', post: '#22c55e', patch: '#f59e0b', delete: '#ef4444' };
  const methodBg    = { get: '#1e3a5f', post: '#14532d', patch: '#451a03', delete: '#450a0a' };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderEndpoint(method, pathKey, op) {
    const color       = methodColor[method] || '#888';
    const bg          = methodBg[method]    || '#222';
    const requiresAuth = op.security && op.security.length > 0;
    const params      = op.parameters || [];
    const reqBody     = op.requestBody;

    const paramsHtml = params.length ? `
      <div class="section">
        <div class="section-title">Path Parameters</div>
        <table>
          <tr><th>Name</th><th>Type</th><th>Description</th><th>Example</th></tr>
          ${params.map(p => `<tr>
            <td>${p.name}</td>
            <td><span style="color:#aaa">${p.schema?.type || 'string'}</span></td>
            <td>${esc(p.description || '')}</td>
            <td><code>${esc(String(p.example || ''))}</code></td>
          </tr>`).join('')}
        </table>
      </div>` : '';

    const bodyHtml = reqBody ? `
      <div class="section">
        <div class="section-title">Request Body</div>
        <pre>${esc(JSON.stringify(reqBody.content['application/json'].example, null, 2))}</pre>
      </div>` : '';

    const responsesHtml = Object.entries(op.responses || {}).map(([code, resp]) => {
      const ex = resp.content?.['application/json']?.example;
      const ok = parseInt(code) < 400;
      return `<div style="margin-bottom:0.8rem">
        <span style="font-family:monospace;color:${ok ? '#22c55e' : '#ef4444'};font-weight:700">${code}</span>
        <span style="color:#aaa;font-size:0.9rem;margin-left:0.5rem">${esc(resp.description)}</span>
        ${ex ? `<pre style="margin-top:0.3rem">${esc(JSON.stringify(ex, null, 2))}</pre>` : ''}
      </div>`;
    }).join('');

    const curlHtml = op['x-curl'] ? `
      <div class="section">
        <div class="section-title">curl</div>
        <pre>${esc(op['x-curl'])}</pre>
      </div>` : '';

    const pythonHtml = op['x-python'] ? `
      <div class="section">
        <div class="section-title">Python</div>
        <pre>${esc(op['x-python'])}</pre>
      </div>` : '';

    return `
    <div class="endpoint">
      <div class="endpoint-header">
        <span class="badge" style="background:${bg};color:${color}">${method.toUpperCase()}</span>
        <span class="path">${esc(pathKey)}</span>
        ${requiresAuth ? '<span class="auth-badge">&#128273; API Key</span>' : ''}
        <span class="desc">${esc(op.summary || '')}</span>
      </div>
      <div class="endpoint-body">
        <p>${esc(op.description || '')}</p>
        ${paramsHtml}
        ${bodyHtml}
        <div class="section">
          <div class="section-title">Responses</div>
          ${responsesHtml}
        </div>
        ${curlHtml}
        ${pythonHtml}
      </div>
    </div>`;
  }

  const pathsHtml = Object.entries(docs.paths || {})
    .map(([pathKey, methods]) =>
      Object.entries(methods).map(([method, op]) =>
        renderEndpoint(method, pathKey, op)
      ).join('')
    ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(docs.info.title)} — API Docs</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0d0d0d;color:#e8e8e8;line-height:1.6}
    .container{max-width:860px;margin:0 auto;padding:2rem 1.5rem}
    header{margin-bottom:2.5rem;border-bottom:1px solid #2a2a2a;padding-bottom:1.5rem}
    h1{font-size:1.8rem;color:#ff4444;margin-bottom:0.4rem}
    .chip{display:inline-block;background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:0.15em 0.6em;font-size:0.78rem;font-family:monospace;color:#aaa;margin-right:0.4rem}
    .server{font-family:monospace;font-size:0.9rem;color:#60a5fa;margin-top:0.4rem}
    .desc-main{color:#888;margin-top:0.6rem;font-size:0.9rem}
    h2{font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.1em;margin:2.5rem 0 0.8rem;padding-bottom:0.3rem;border-bottom:1px solid #1a1a1a}
    .endpoint{background:#111;border:1px solid #222;border-radius:8px;margin-bottom:0.8rem;overflow:hidden}
    .endpoint-header{padding:0.85rem 1.2rem;display:flex;align-items:center;gap:0.7rem;flex-wrap:wrap}
    .endpoint-body{padding:1.2rem 1.5rem;border-top:1px solid #1a1a1a}
    .badge{display:inline-block;padding:0.2em 0.55em;border-radius:4px;font-size:0.72rem;font-weight:700;font-family:monospace;letter-spacing:0.05em;min-width:3.5rem;text-align:center}
    .path{font-family:monospace;font-size:0.95rem;color:#e8e8e8}
    .auth-badge{background:#1c1000;color:#f59e0b;border:1px solid #78350f;border-radius:4px;padding:0.15em 0.5em;font-size:0.72rem}
    .desc{color:#666;font-size:0.82rem;margin-left:auto}
    p{color:#888;margin-bottom:1rem;font-size:0.88rem}
    .section{margin-bottom:1.2rem}
    .section-title{font-size:0.68rem;text-transform:uppercase;letter-spacing:0.12em;color:#444;margin-bottom:0.35rem;font-weight:700}
    pre{background:#080808;border:1px solid #1c1c1c;border-radius:6px;padding:0.85rem 1rem;overflow-x:auto;font-family:'Courier New',monospace;font-size:0.8rem;color:#ccc;line-height:1.5;white-space:pre-wrap;word-break:break-word}
    code{font-family:monospace;background:#1a1a1a;padding:0.1em 0.35em;border-radius:3px;font-size:0.88em;color:#7dd3fc}
    table{width:100%;border-collapse:collapse;margin-bottom:0.5rem}
    th{text-align:left;padding:0.35rem 0.8rem;background:#0c0c0c;color:#444;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #1c1c1c}
    td{padding:0.4rem 0.8rem;border-bottom:1px solid #141414;font-size:0.84rem;vertical-align:top}
    td:first-child{font-family:monospace;color:#7dd3fc}
    .auth-box{background:#0c0800;border:1px solid #2d1f00;border-radius:8px;padding:1.1rem 1.4rem;margin-bottom:2rem}
    .auth-box h3{color:#f59e0b;margin-bottom:0.4rem;font-size:0.9rem}
    .auth-box p{margin-bottom:0;font-size:0.84rem}
    footer{margin-top:3rem;padding-top:1.2rem;border-top:1px solid #1a1a1a;color:#333;font-size:0.78rem;text-align:center}
    footer a{color:#444;text-decoration:none}
    footer a:hover{color:#666}
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>${esc(docs.info.title)}</h1>
    <div><span class="chip">v${esc(docs.info.version)}</span><span class="chip">OpenAPI 3.0.3</span></div>
    <div class="server">${esc(docs.servers[0].url)}</div>
    <p class="desc-main">${esc(docs.info.description)}</p>
  </header>
  <div class="auth-box">
    <h3>&#128273; Authentication</h3>
    <p>All POST endpoints require an <code>X-API-Key</code> header. GET endpoints are always public. Rate limited to 2000 requests per 15 minutes per IP (429 Too Many Requests when exceeded).</p>
    <pre style="margin-top:0.6rem">X-API-Key: YOUR_API_KEY</pre>
  </div>
  <div class="auth-box" style="background:#0a0c10;border-color:#1e3a5f;margin-bottom:2rem">
    <h3 style="color:#60a5fa">&#127760; Network Access</h3>
    <p>Use the correct address depending on where you are connecting from:</p>
    <table style="margin-top:0.6rem">
      <tr><th>Context</th><th>Address</th></tr>
      <tr><td>Docker containers (same host)</td><td><code>http://172.18.0.3:3001</code></td></tr>
      <tr><td>External (browser, desktop apps)</td><td><code>http://187.77.139.247:3001</code></td></tr>
      <tr><td>Local development</td><td><code>http://localhost:3001</code></td></tr>
    </table>
  </div>
  <h2>Endpoints</h2>
  ${pathsHtml}
  <footer>Agent Dashboard API &middot; <a href="/api/docs">View as JSON</a></footer>
</div>
</body>
</html>`;
}

// ─── User System ──────────────────────────────────────────────────────────────
let users = {};

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      if (raw && typeof raw === 'object') users = raw;
    }
  } catch (e) { console.warn('[users] Failed to load:', e.message); }
  // Ensure default user Leon exists
  if (!users['leon']) {
    users['leon'] = { id: 'leon', name: 'Leon', avatar: 'L', color: '#f59e0b', xp: 0, questsCompleted: 0, achievements: [], createdAt: now() };
  }
  // Init new fields for all users
  for (const u of Object.values(users)) {
    if (u.streakDays    === undefined) u.streakDays    = 0;
    if (u.streakLastDate=== undefined) u.streakLastDate= null;
    if (u.forgeTemp     === undefined) u.forgeTemp     = 100;
    if (u.gold          === undefined) u.gold          = 0;
    if (!u.earnedAchievements)         u.earnedAchievements = [];
    if (!u._allCompletedTypes)         u._allCompletedTypes = [];
  }
}

function saveUsers() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (e) { console.warn('[users] Failed to save:', e.message); }
}

// ─── Player Progress Store ────────────────────────────────────────────────────
// Per-player quest state: { [playerId]: { completedQuests: {[questId]: {at, proof}}, claimedQuests: [questId] } }
let playerProgress = {};

function loadPlayerProgress() {
  if (fs.existsSync(PLAYER_PROGRESS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(PLAYER_PROGRESS_FILE, 'utf8'));
      if (raw && typeof raw === 'object') playerProgress = raw;
    } catch (e) { console.warn('[playerProgress] Failed to load:', e.message); }
  } else {
    // Migration: seed from existing completedBy on player-type quests
    for (const q of quests) {
      if (!PLAYER_QUEST_TYPES.includes(q.type)) continue;
      if (q.completedBy && q.status === 'completed') {
        const uid = q.completedBy.toLowerCase();
        if (!playerProgress[uid]) playerProgress[uid] = { completedQuests: {}, claimedQuests: [] };
        playerProgress[uid].completedQuests[q.id] = { at: q.completedAt || now(), proof: q.proof || null };
      }
    }
    savePlayerProgress();
    console.log('[playerProgress] Migrated from existing quests');
  }
  // Ensure all user entries have the right shape
  for (const uid of Object.keys(playerProgress)) {
    if (!playerProgress[uid].completedQuests) playerProgress[uid].completedQuests = {};
    if (!Array.isArray(playerProgress[uid].claimedQuests)) playerProgress[uid].claimedQuests = [];
  }
}

function savePlayerProgress() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLAYER_PROGRESS_FILE, JSON.stringify(playerProgress, null, 2));
  } catch (e) { console.warn('[playerProgress] Failed to save:', e.message); }
}

function getPlayerProgress(playerId) {
  const uid = playerId.toLowerCase();
  if (!playerProgress[uid]) playerProgress[uid] = { completedQuests: {}, claimedQuests: [] };
  return playerProgress[uid];
}

// GET /api/users
app.get('/api/users', (req, res) => {
  // Inject dynamic per-player forgeTemp based on last 24h completions
  const result = Object.values(users).map(u => ({
    ...u,
    forgeTemp: calcDynamicForgeTemp(u.id),
  }));
  res.json(result);
});

// GET /api/users/:id
app.get('/api/users/:id', (req, res) => {
  const user = users[req.params.id.toLowerCase()];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users/:id/register — create or update user
app.post('/api/users/:id/register', requireApiKey, (req, res) => {
  const id = req.params.id.toLowerCase();
  const { name, avatar, color } = req.body;
  if (!users[id]) {
    users[id] = { id, name: name || id, avatar: avatar || id[0].toUpperCase(), color: color || '#f59e0b', xp: 0, questsCompleted: 0, achievements: [], earnedAchievements: [], streakDays: 0, streakLastDate: null, forgeTemp: 100, gold: 0, _allCompletedTypes: [], createdAt: now() };
  } else {
    if (name) users[id].name = name;
    if (avatar) users[id].avatar = avatar;
    if (color) users[id].color = color;
  }
  saveUsers();
  res.json({ ok: true, user: users[id] });
});

// POST /api/users/:id/award-xp — award XP to a user
app.post('/api/users/:id/award-xp', requireApiKey, (req, res) => {
  const id = req.params.id.toLowerCase();
  if (!users[id]) return res.status(404).json({ error: 'User not found' });
  const { amount = 10, reason } = req.body;
  users[id].xp = (users[id].xp || 0) + parseInt(amount, 10);
  if (reason) {
    users[id].achievements = users[id].achievements || [];
    users[id].achievements.push({ reason, xp: amount, at: now() });
  }
  saveUsers();
  res.json({ ok: true, xp: users[id].xp });
});

// GET /api/streaks — get streak info for all users and agents
app.get('/api/streaks', (req, res) => {
  const userStreaks = Object.values(users).map(u => ({
    id: u.id, name: u.name, type: 'user',
    streakDays: u.streakDays || 0, streakLastDate: u.streakLastDate || null,
  }));
  const agentStreaks = Object.values(store.agents).map(a => ({
    id: a.id, name: a.name, type: 'agent',
    streakDays: a.streakDays || 0, streakLastDate: a.streakLastDate || null,
  }));
  res.json([...userStreaks, ...agentStreaks].sort((a, b) => b.streakDays - a.streakDays));
});

// GET /api/achievements — list all achievement definitions
app.get('/api/achievements', (req, res) => {
  res.json(ACHIEVEMENT_CATALOGUE.map(a => ({ id: a.id, name: a.name, icon: a.icon, desc: a.desc, category: a.category, hidden: !!a.hidden })));
});

// GET /api/quest-flavor — quest flavor text
app.get('/api/quest-flavor', (req, res) => {
  res.json(QUEST_FLAVOR);
});

// GET /api/levels — all level definitions
app.get('/api/levels', (req, res) => {
  res.json(LEVELS);
});

// GET /api/campaign/npcs — campaign NPCs
app.get('/api/campaign/npcs', (req, res) => {
  res.json(CAMPAIGN_NPCS);
});

// GET /api/auth/check — check API key validity and admin status
app.get('/api/auth/check', (req, res) => {
  const key = req.headers['x-api-key'];
  if (!key || !validApiKeys.has(key)) {
    return res.json({ isAdmin: false, name: null, valid: false });
  }
  const master = getMasterKey();
  const isAdmin = (key === master) || (key === ADMIN_KEY);
  // Find user with this API key
  const user = Object.values(users).find(u => u.apiKey === key);
  return res.json({ isAdmin, name: user ? user.name : null, userId: user ? user.id : null, valid: true });
});

// POST /api/auth/login — validate name + apiKey
app.post('/api/auth/login', (req, res) => {
  const { name, apiKey } = req.body;
  if (!name || !apiKey) return res.status(400).json({ success: false, error: 'name and apiKey required' });
  const master = getMasterKey();
  const isAdmin = (apiKey === master) || (apiKey === ADMIN_KEY);
  // Check against managed keys / master key
  if (!validApiKeys.has(apiKey)) {
    return res.json({ success: false, error: 'Invalid name or key' });
  }
  // Find user by name and matching apiKey
  const nameLower = name.toLowerCase();
  const user = Object.values(users).find(u =>
    u.name.toLowerCase() === nameLower && u.apiKey === apiKey
  );
  if (!user && !isAdmin) {
    // Allow admin to log in with any valid name if key is master/admin
    return res.json({ success: false, error: 'Invalid name or key' });
  }
  const foundUser = user || Object.values(users).find(u => u.name.toLowerCase() === nameLower);
  return res.json({
    success: true,
    userId: foundUser ? foundUser.id : nameLower,
    name: foundUser ? foundUser.name : name,
    isAdmin,
  });
});

// POST /api/register — register a new player
app.post('/api/register', (req, res) => {
  const { name, age, goals, classId, companion } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  const trimmedName = String(name).trim();
  const nameLower = trimmedName.toLowerCase();
  // Check if name already taken
  const existing = Object.values(users).find(u => u.name.toLowerCase() === nameLower);
  if (existing) return res.status(409).json({ error: 'Name already taken' });
  // Generate API key
  const apiKey = crypto.randomBytes(16).toString('hex');
  const userId = nameLower.replace(/\s+/g, '_');
  const finalId = users[userId] ? `${userId}_${Date.now()}` : userId;

  // Resolve classId — check if it exists and is active or pending
  let resolvedClassId = null;
  let classPending = false;
  if (classId) {
    const cls = classesData.classes.find(c => c.id === classId);
    if (cls) {
      resolvedClassId = cls.id;
      classPending = cls.status === 'pending';
      // Increment playerCount for the class
      cls.playerCount = (cls.playerCount || 0) + 1;
      saveClasses();
    }
  }

  users[finalId] = {
    id: finalId,
    name: trimmedName,
    avatar: trimmedName[0].toUpperCase(),
    color: '#a78bfa',
    xp: 0,
    questsCompleted: 0,
    achievements: [],
    earnedAchievements: [],
    streakDays: 0,
    streakLastDate: null,
    forgeTemp: 100,
    gold: 0,
    apiKey,
    _allCompletedTypes: [],
    createdAt: now(),
    // Extended onboarding fields
    age: age ? parseInt(age, 10) : null,
    goals: goals || null,
    classId: resolvedClassId,
    classPending,
    classPendingNotified: false,
    companion: companion ? {
      ...companion,
      bondXp: 0,
      bondLevel: 1,
      lastPetted: null,
      petCountToday: 0,
      petDateStr: null,
    } : null,
  };
  // Add to managed keys
  const entry = { key: apiKey, label: `Player: ${trimmedName}`, created: now() };
  managedKeys.push(entry);
  validApiKeys.add(apiKey);
  saveManagedKeys();
  saveUsers();
  // Auto-create companion quests if companion provided
  if (companion) {
    createCompanionQuestsForUser(finalId);
  }
  console.log(`[register] new player: ${trimmedName} (${finalId}) class=${resolvedClassId || 'none'} companion=${companion ? companion.name : 'none'}`);
  res.json({ name: trimmedName, apiKey, userId: finalId });
});

// GET /api/player/:name — get player progress (level, xp, gold, quest counts, claimed)
app.get('/api/player/:name', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const userRecord = users[uid];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(uid);
  const levelInfo = getLevelInfo(userRecord.xp || 0);
  // Dynamic per-player forgeTemp based on last 24h completions
  const dynamicForgeTemp = calcDynamicForgeTemp(uid);
  // Also update stored value for XP multiplier calculations
  userRecord.forgeTemp = dynamicForgeTemp;
  res.json({
    id: uid,
    name: userRecord.name,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    xp: userRecord.xp || 0,
    nextXp: levelInfo.nextXp,
    levelProgress: levelInfo.progress,
    gold: userRecord.gold || 0,
    completedQuestsCount: Object.keys(pp.completedQuests || {}).length,
    claimedQuests: pp.claimedQuests || [],
    streakDays: userRecord.streakDays || 0,
    forgeTemp: dynamicForgeTemp,
  });
});

// GET /api/player/:name/notifications — check for pending class-activation notifications
app.get('/api/player/:name/notifications', requireApiKey, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const userRecord = users[uid];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });

  const notifications = [];

  // Check if player had a pending class that is now active
  if (userRecord.classId && userRecord.classPending && !userRecord.classPendingNotified) {
    const cls = classesData.classes.find(c => c.id === userRecord.classId);
    if (cls && cls.status === 'active') {
      notifications.push({
        type: 'class_activated',
        classId: cls.id,
        className: cls.fantasy,
        classIcon: cls.icon,
        classDescription: cls.description,
        skillTree: cls.skillTree || [],
      });
      // Mark as notified
      userRecord.classPending = false;
      userRecord.classPendingNotified = true;
      saveUsers();
    }
  }

  res.json({ notifications });
});

// GET /api/users/:id/achievements — get earned achievements for a user
app.get('/api/users/:id/achievements', (req, res) => {
  const u = users[req.params.id.toLowerCase()];
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u.earnedAchievements || []);
});

// GET /api/player/:name/companion — get companion details + quests
app.get('/api/player/:name/companion', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.json({ companion: null, quests: [] });
  const bondInfo = getBondLevel(u.companion.bondXp || 0);
  const companionQuests = quests.filter(q => q.type === 'companion' && q.companionOwnerId === uid && q.status !== 'rejected');
  res.json({ companion: { ...u.companion, bondInfo }, quests: companionQuests });
});

// POST /api/player/:name/companion/pet — pet the companion (bond XP + mood boost, max 2×/day)
app.post('/api/player/:name/companion/pet', requireApiKey, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  if (!u.companion) return res.status(404).json({ error: 'No companion' });

  const today = todayStr();
  if (u.companion.petDateStr !== today) {
    u.companion.petCountToday = 0;
    u.companion.petDateStr = today;
  }
  if ((u.companion.petCountToday || 0) >= 2) {
    return res.status(429).json({ error: 'Already petted 2x today', nextPetAvailable: 'tomorrow' });
  }
  u.companion.petCountToday = (u.companion.petCountToday || 0) + 1;
  u.companion.lastPetted = now();
  u.companion.bondXp = (u.companion.bondXp || 0) + 0.5;
  u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
  saveUsers();
  const bondInfo = getBondLevel(u.companion.bondXp);
  res.json({ success: true, companion: { ...u.companion, bondInfo }, petsToday: u.companion.petCountToday });
});

// GET /api/cv-export — export skills/certs from completed learning quests
app.get('/api/cv-export', (req, res) => {
  const { userId } = req.query;
  const learningQuests = quests.filter(q =>
    q.type === 'learning' &&
    q.status === 'completed' &&
    (!userId || q.completedBy === userId || (q.claimedBy && q.claimedBy.toLowerCase() === userId.toLowerCase()))
  );
  const skillMap = {};
  for (const q of learningQuests) {
    const questSkills = Array.isArray(q.skills) && q.skills.length > 0 ? q.skills : [q.title];
    for (const skill of questSkills) {
      if (!skillMap[skill]) skillMap[skill] = { count: 0, quests: [] };
      skillMap[skill].count++;
      skillMap[skill].quests.push({ id: q.id, title: q.title, completedAt: q.completedAt });
    }
  }
  const skills = Object.entries(skillMap)
    .map(([name, data]) => ({ name, count: data.count, lastEarned: data.quests[data.quests.length - 1]?.completedAt || null, quests: data.quests }))
    .sort((a, b) => b.count - a.count);
  const certifications = learningQuests
    .filter(q => q.title && q.title.toLowerCase().includes('cert'))
    .map(q => ({ title: q.title, earnedAt: q.completedAt, questId: q.id }));
  res.json({ userId: userId || 'all', skills, certifications, totalLearningQuests: learningQuests.length, generatedAt: now() });
});

// GET /api/npcs — list all NPC profiles
app.get('/api/npcs', (req, res) => {
  res.json(Object.entries(NPC_META).map(([id, meta]) => ({ id, ...meta })));
});

// ─── Shop ────────────────────────────────────────────────────────────────────
const SHOP_ITEMS = [
  { id: 'gaming_1h',   name: '1h Gaming',      cost: 100, icon: '🎮', desc: '1 hour of guilt-free gaming' },
  { id: 'snack_break', name: 'Snack Break',     cost: 25,  icon: '🍕', desc: 'Treat yourself to a snack' },
  { id: 'day_off',     name: 'Day Off Quest',   cost: 500, icon: '🏖', desc: 'Skip one day of recurring quests' },
  { id: 'movie_night', name: 'Movie Night',     cost: 150, icon: '🎬', desc: 'Evening off for a movie' },
  { id: 'sleep_in',    name: 'Sleep In',        cost: 75,  icon: '😴', desc: 'Extra hour of sleep, guilt-free' },
];

// ─── Gear / Workshop Tools ───────────────────────────────────────────────────
const GEAR_TIERS = [
  { id: 'worn',       name: 'Worn Tools',       cost: 0,    tier: 0, xpBonus: 0,  icon: '🔨', desc: 'Starting gear. No bonus.' },
  { id: 'sturdy',     name: 'Sturdy Tools',     cost: 100,  tier: 1, xpBonus: 5,  icon: '⚒',  desc: '+5% XP on all quests' },
  { id: 'masterwork', name: 'Masterwork Tools', cost: 300,  tier: 2, xpBonus: 10, icon: '🛠',  desc: '+10% XP on all quests' },
  { id: 'legendary',  name: 'Legendary Tools',  cost: 700,  tier: 3, xpBonus: 15, icon: '⚙',  desc: '+15% XP on all quests' },
  { id: 'mythic',     name: 'Mythic Forge',     cost: 1500, tier: 4, xpBonus: 25, icon: '🔱', desc: '+25% XP on all quests' },
];

function getUserGear(userId) {
  const u = users[userId];
  if (!u) return GEAR_TIERS[0];
  const gearId = u.gear || 'worn';
  return GEAR_TIERS.find(g => g.id === gearId) || GEAR_TIERS[0];
}

// GET /api/shop/gear — list gear tiers
app.get('/api/shop/gear', (req, res) => {
  res.json(GEAR_TIERS);
});

// POST /api/shop/gear/buy — upgrade gear
app.post('/api/shop/gear/buy', requireApiKey, (req, res) => {
  const { userId, gearId } = req.body;
  if (!userId || !gearId) return res.status(400).json({ error: 'userId and gearId are required' });
  const uid = userId.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const gear = GEAR_TIERS.find(g => g.id === gearId);
  if (!gear) return res.status(404).json({ error: 'Gear not found' });
  const currentGear = getUserGear(uid);
  if (gear.tier <= currentGear.tier) return res.status(400).json({ error: 'Already have equal or better gear' });
  if ((u.gold || 0) < gear.cost) return res.status(400).json({ error: `Insufficient gold. Need ${gear.cost}, have ${u.gold || 0}` });
  u.gold -= gear.cost;
  u.gear = gear.id;
  saveUsers();
  console.log(`[gear] ${uid} upgraded to "${gear.name}" for ${gear.cost} gold`);
  res.json({ ok: true, gear, remainingGold: u.gold });
});

// GET /api/user/:id/gear — get user's current gear
app.get('/api/user/:id/gear', (req, res) => {
  const uid = req.params.id.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(getUserGear(uid));
});

// GET /api/shop — list available shop items
app.get('/api/shop', (req, res) => {
  res.json(SHOP_ITEMS);
});

// POST /api/shop/buy — purchase a reward
app.post('/api/shop/buy', requireApiKey, (req, res) => {
  const { userId, itemId } = req.body;
  if (!userId || !itemId) return res.status(400).json({ error: 'userId and itemId are required' });
  const uid = userId.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if ((u.gold || 0) < item.cost) return res.status(400).json({ error: `Insufficient gold. Need ${item.cost}, have ${u.gold || 0}` });
  u.gold -= item.cost;
  u.purchases = u.purchases || [];
  u.purchases.push({ itemId: item.id, name: item.name, cost: item.cost, at: now() });
  saveUsers();
  console.log(`[shop] ${uid} bought "${item.name}" for ${item.cost} gold`);
  res.json({ ok: true, item, remainingGold: u.gold });
});

// ─── Personal Life Quest Templates ───────────────────────────────────────────
const PERSONAL_QUEST_TEMPLATES = [
  {
    id: 'morning_ritual',
    name: 'Morning Ritual',
    icon: '🌅',
    desc: 'Daily morning checklist to start the day strong. Streak tracking built in.',
    type: 'personal',
    priority: 'medium',
    recurrence: 'daily',
    checklist: [
      { text: 'Wake up on time', done: false },
      { text: 'Drink a glass of water', done: false },
      { text: 'Morning stretch / movement', done: false },
      { text: 'Cold shower or freshen up', done: false },
      { text: 'Review the day\'s goals', done: false },
    ],
  },
  {
    id: 'warrior_training',
    name: 'Warrior Training',
    icon: '💪',
    desc: 'Gym session quest. Log workout type, sets, reps, and weight. Rest days count too.',
    type: 'fitness',
    priority: 'high',
    recurrence: null,
    checklist: [
      { text: 'Warm up (10 min)', done: false },
      { text: 'Main workout (strength / cardio)', done: false },
      { text: 'Log weights & reps in notes', done: false },
      { text: 'Cool down & stretch', done: false },
      { text: 'Track progress vs last session', done: false },
    ],
  },
  {
    id: 'network_sage',
    name: 'Path of the Network Sage',
    icon: '🌐',
    desc: 'AirIT learning path study session — Fortinet, Cisco, SD-WAN, MPLS, or BGP.',
    type: 'learning',
    priority: 'high',
    recurrence: null,
    checklist: [
      { text: 'Choose topic (Fortinet / Cisco / SD-WAN / MPLS / BGP)', done: false },
      { text: 'Study module or hands-on lab (45+ min)', done: false },
      { text: 'Take notes / make flashcards', done: false },
      { text: 'Test yourself with quiz or lab scenario', done: false },
    ],
  },
  {
    id: 'daily_deep_dive',
    name: 'Daily Deep Dive',
    icon: '🧠',
    desc: '30-minute focused learning session. One topic, no distractions, full concentration.',
    type: 'learning',
    priority: 'medium',
    recurrence: 'daily',
    checklist: [
      { text: 'Pick one topic', done: false },
      { text: 'Set timer for 30 minutes', done: false },
      { text: 'Focus session — no distractions', done: false },
      { text: 'Write 3 key takeaways', done: false },
    ],
  },
  {
    id: 'cert_quest',
    name: 'Certification Quest',
    icon: '📜',
    desc: 'Exam prep session. Track study hours, mock exams, and certification deadline.',
    type: 'learning',
    priority: 'high',
    recurrence: null,
    checklist: [
      { text: 'Review exam objectives', done: false },
      { text: 'Study session (1+ hour)', done: false },
      { text: 'Complete practice questions / mock exam', done: false },
      { text: 'Log study hours', done: false },
      { text: 'Update progress toward exam deadline', done: false },
    ],
  },
  {
    id: 'date_night',
    name: 'Date Night Quest',
    icon: '❤️',
    desc: 'Quality time with your partner. Plan something special — connection matters.',
    type: 'social',
    priority: 'medium',
    recurrence: 'weekly',
    checklist: [
      { text: 'Plan activity or location', done: false },
      { text: 'No phones during time together', done: false },
      { text: 'Cook or go out for a meal', done: false },
      { text: 'Reflect on one good thing about the week', done: false },
    ],
  },
  {
    id: 'weekly_raid',
    name: 'Weekly Raid Planning',
    icon: '🗺️',
    desc: 'Weekly review and planning session. Strategize the week ahead like a raid leader.',
    type: 'personal',
    priority: 'high',
    recurrence: 'weekly',
    checklist: [
      { text: 'Review last week\'s wins and misses', done: false },
      { text: 'Update quest board / to-do list', done: false },
      { text: 'Set top 3 priorities for the week', done: false },
      { text: 'Block time for deep work', done: false },
      { text: 'Check on recurring quests & streaks', done: false },
    ],
  },
  {
    id: 'rest_recovery',
    name: 'Rest & Recovery',
    icon: '🌙',
    desc: 'Sleep and recovery quest. Target 7–9 hours. Track wind-down routine.',
    type: 'fitness',
    priority: 'medium',
    recurrence: 'daily',
    checklist: [
      { text: 'No screens 30 min before bed', done: false },
      { text: 'Wind-down routine (reading / meditation)', done: false },
      { text: 'Sleep by target time', done: false },
      { text: 'Log sleep hours on wake-up', done: false },
    ],
  },
];

// GET /api/personal-templates — list personal life quest templates
app.get('/api/personal-templates', (req, res) => {
  res.json(PERSONAL_QUEST_TEMPLATES);
});

// POST /api/personal-templates/spawn — create a quest from a personal template
app.post('/api/personal-templates/spawn', requireApiKey, (req, res) => {
  const { templateId, createdBy, claimedBy } = req.body;
  if (!templateId) return res.status(400).json({ error: 'templateId required' });
  const template = PERSONAL_QUEST_TEMPLATES.find(t => t.id === templateId);
  if (!template) return res.status(404).json({ error: `Template not found: ${templateId}` });
  const resolvedCreatedBy = createdBy || 'leon';
  const quest = {
    id: `quest-${Date.now()}`,
    title: template.name,
    description: template.desc,
    priority: template.priority,
    type: template.type,
    categories: [],
    product: null,
    humanInputRequired: false,
    createdBy: resolvedCreatedBy,
    status: 'open',
    createdAt: now(),
    claimedBy: claimedBy || null,
    completedBy: null,
    completedAt: null,
    parentQuestId: null,
    recurrence: template.recurrence || null,
    streak: 0,
    lastCompletedAt: null,
    proof: null,
    checklist: template.checklist ? template.checklist.map(item => ({ ...item, done: false })) : null,
  };
  quests.push(quest);
  saveQuests();
  console.log(`[personal-template] spawned: ${quest.id} — "${quest.title}" (${templateId})`);
  res.json({ ok: true, quest });
});

// ─── Forge Challenges ────────────────────────────────────────────────────────
const FORGE_CHALLENGES = [
  {
    id: 'code_sprint',
    name: '30-Day Code Sprint',
    icon: '💻',
    desc: 'Write code every day for 30 days. Daily development quest auto-created.',
    quests: [
      { title: 'Code Sprint Day', type: 'development', recurrence: 'daily', priority: 'medium' },
    ],
    achievement: 'challenge_coder',
  },
  {
    id: 'learning_marathon',
    name: 'Learning Marathon',
    icon: '📖',
    desc: '4 weeks of focused learning. Weekly learning quest auto-created.',
    quests: [
      { title: 'Learning Marathon Session', type: 'learning', recurrence: 'weekly', priority: 'medium' },
    ],
    achievement: 'challenge_learner',
  },
  {
    id: 'clean_slate',
    name: 'Clean Slate',
    icon: '✨',
    desc: 'Daily personal quest for 2 weeks. Build positive habits.',
    quests: [
      { title: 'Clean Slate Daily Habit', type: 'personal', recurrence: 'daily', priority: 'low' },
    ],
    achievement: null,
  },
];

// GET /api/challenges — list challenge templates
app.get('/api/challenges', (req, res) => {
  // For each challenge, include list of participants (users who joined)
  const result = FORGE_CHALLENGES.map(c => ({
    ...c,
    participants: Object.values(users)
      .filter(u => (u.joinedChallenges || []).includes(c.id))
      .map(u => ({ id: u.id, name: u.name, avatar: u.avatar, color: u.color })),
  }));
  res.json(result);
});

// POST /api/challenges/join — join a challenge (auto-creates recurring quests)
app.post('/api/challenges/join', requireApiKey, (req, res) => {
  const { userId, challengeId } = req.body;
  if (!userId || !challengeId) return res.status(400).json({ error: 'userId and challengeId required' });
  const uid = userId.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const challenge = FORGE_CHALLENGES.find(c => c.id === challengeId);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
  u.joinedChallenges = u.joinedChallenges || [];
  if (u.joinedChallenges.includes(challengeId)) {
    return res.status(409).json({ error: 'Already joined this challenge' });
  }
  u.joinedChallenges.push(challengeId);
  // Auto-create the challenge quests for this user
  const created = [];
  for (const qTemplate of challenge.quests) {
    const q = {
      id: `quest-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      title: `${qTemplate.title} (${u.name})`,
      description: `Part of challenge: ${challenge.name}`,
      priority: qTemplate.priority || 'medium',
      type: qTemplate.type || 'development',
      categories: [],
      product: null,
      humanInputRequired: false,
      createdBy: uid,
      status: 'open',
      createdAt: now(),
      claimedBy: null,
      completedBy: null,
      completedAt: null,
      parentQuestId: null,
      recurrence: qTemplate.recurrence || null,
      streak: 0,
      lastCompletedAt: null,
      proof: null,
      checklist: null,
      challengeId,
    };
    quests.push(q);
    created.push(q);
  }
  saveUsers();
  saveQuests();
  console.log(`[challenge] ${uid} joined "${challenge.name}"`);
  res.json({ ok: true, challenge: challenge.name, questsCreated: created.length });
});

// ─── GitHub Webhook ────────────────────────────────────────────────────────────
// POST /api/webhooks/github — handle GitHub events
// merged PR → create completed quest; new issue → create suggested quest
app.post('/api/webhooks/github', (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
    const pr = payload.pull_request;
    const quest = {
      id: `quest-gh-pr-${pr.number}-${Date.now()}`,
      title: `[PR #${pr.number}] ${pr.title}`,
      description: pr.body ? pr.body.slice(0, 300) : `Merged PR by ${pr.user?.login}`,
      priority: 'medium',
      type: 'development',
      categories: ['Coding'],
      status: 'completed',
      createdBy: 'github-bot',
      humanInputRequired: false,
      xp: 0,
      claimedBy: pr.user?.login || null,
      completedBy: pr.user?.login || null,
      completedAt: pr.merged_at || new Date().toISOString(),
      createdAt: pr.created_at || new Date().toISOString(),
    };
    quests.push(quest);
    saveQuests();
    console.log(`[github] PR #${pr.number} merged → completed quest ${quest.id}`);
    return res.json({ ok: true, event: 'pr_merged', questId: quest.id });
  }

  if (event === 'issues' && payload.action === 'opened') {
    const issue = payload.issue;
    const quest = {
      id: `quest-gh-issue-${issue.number}-${Date.now()}`,
      title: `[Issue #${issue.number}] ${issue.title}`,
      description: issue.body ? issue.body.slice(0, 300) : `GitHub issue opened by ${issue.user?.login}`,
      priority: 'medium',
      type: 'development',
      categories: ['Bug Fix'],
      status: 'suggested',
      createdBy: 'github-bot',
      humanInputRequired: true,
      xp: 0,
      claimedBy: null,
      completedBy: null,
      completedAt: null,
      createdAt: issue.created_at || new Date().toISOString(),
    };
    quests.push(quest);
    saveQuests();
    console.log(`[github] Issue #${issue.number} opened → suggested quest ${quest.id}`);
    return res.json({ ok: true, event: 'issue_opened', questId: quest.id });
  }

  res.json({ ok: true, event, action: payload.action || null, ignored: true });
});

// ─── Spotify Integration (placeholders) ────────────────────────────────────────
// POST /api/integrations/spotify/connect
app.post('/api/integrations/spotify/connect', requireApiKey, (req, res) => {
  const { userId, accessToken, refreshToken } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const u = users[userId];
  if (!u) return res.status(404).json({ error: 'User not found' });
  u.spotify = { connected: true, connectedAt: new Date().toISOString(), accessToken: accessToken || null, refreshToken: refreshToken || null };
  saveUsers();
  console.log(`[spotify] user ${userId} connected`);
  res.json({ ok: true, message: 'Spotify connected (placeholder)' });
});

// GET /api/integrations/spotify/status
app.get('/api/integrations/spotify/status', requireApiKey, (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const u = users[userId];
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true, connected: !!u.spotify?.connected, connectedAt: u.spotify?.connectedAt || null });
});

// POST /api/events/quest-start
app.post('/api/events/quest-start', (req, res) => {
  const { questId, userId } = req.body || {};
  console.log(`[event] quest-start questId=${questId} userId=${userId}`);
  // Placeholder: trigger Spotify playlist, notifications, etc.
  res.json({ ok: true, event: 'quest-start', questId, userId });
});

// POST /api/events/quest-complete
app.post('/api/events/quest-complete', (req, res) => {
  const { questId, userId } = req.body || {};
  console.log(`[event] quest-complete questId=${questId} userId=${userId}`);
  // Placeholder: trigger Spotify celebration track, etc.
  res.json({ ok: true, event: 'quest-complete', questId, userId });
});

// POST /api/events/level-up
app.post('/api/events/level-up', (req, res) => {
  const { userId, newLevel } = req.body || {};
  console.log(`[event] level-up userId=${userId} newLevel=${newLevel}`);
  // Placeholder: trigger Spotify level-up fanfare, etc.
  res.json({ ok: true, event: 'level-up', userId, newLevel });
});

// POST /api/forge/temp-decay — decay forgeTemp for users who missed recurring quests
// Call this from a cron or trigger manually
app.post('/api/forge/temp-decay', requireApiKey, (req, res) => {
  const today = todayStr();
  let decayed = 0;
  for (const u of Object.values(users)) {
    if (!u.streakLastDate || u.streakLastDate === today) continue;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (u.streakLastDate !== yesterday) {
      // missed at least one day
      u.forgeTemp = Math.max(0, (u.forgeTemp ?? 100) - 10);
      decayed++;
    }
  }
  if (decayed > 0) saveUsers();
  res.json({ ok: true, decayed });
});

// ─── Quest Catalog API ────────────────────────────────────────────────────────

// GET /api/catalog — full catalog with meta
app.get('/api/catalog', (req, res) => {
  rebuildCatalogMeta();
  res.json(questCatalog);
});

// GET /api/catalog/stats — just meta stats
app.get('/api/catalog/stats', (req, res) => {
  rebuildCatalogMeta();
  res.json(questCatalog.meta);
});

// POST /api/catalog/template — add new template [auth]
app.post('/api/catalog/template', requireApiKey, (req, res) => {
  const { title, description, type, category, classId, minLevel, chainId, chainOrder, difficulty, estimatedTime, rewards, tags, createdBy } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const validCategories = ['generic', 'classQuest', 'chainQuest', 'companionQuest'];
  const validDifficulties = ['starter', 'intermediate', 'advanced', 'expert'];
  const tpl = {
    id: `tpl-${Date.now()}`,
    title,
    description: description || '',
    type: type || 'development',
    category: validCategories.includes(category) ? category : 'generic',
    classId: classId || null,
    minLevel: typeof minLevel === 'number' ? minLevel : 1,
    chainId: chainId || null,
    chainOrder: typeof chainOrder === 'number' ? chainOrder : null,
    difficulty: validDifficulties.includes(difficulty) ? difficulty : 'starter',
    estimatedTime: estimatedTime || null,
    rewards: rewards || { xp: 0, gold: 0 },
    tags: Array.isArray(tags) ? tags : [],
    createdBy: createdBy || 'unknown',
    createdAt: now(),
  };
  questCatalog.templates.push(tpl);
  rebuildCatalogMeta();
  saveQuestCatalog();
  res.json({ ok: true, template: tpl });
});

// ─── Classes API ──────────────────────────────────────────────────────────────

// GET /api/classes — all active classes
app.get('/api/classes', (req, res) => {
  res.json(classesData.classes.filter(c => c.status === 'active'));
});

// GET /api/classes/pending — pending classes [admin]
app.get('/api/classes/pending', requireMasterKey, (req, res) => {
  res.json(classesData.classes.filter(c => c.status === 'pending'));
});

// GET /api/classes/:id — single class with skill tree + quests
app.get('/api/classes/:id', (req, res) => {
  const cls = classesData.classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const classQuests = quests.filter(q => q.skills && q.skills.includes(cls.id));
  res.json({ ...cls, quests: classQuests });
});

// POST /api/classes — submit new class (status: pending) [auth]
app.post('/api/classes', requireApiKey, (req, res) => {
  const { name, icon, fantasy, description, realWorld, tiers, skillTree, achievements, createdBy } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const cls = {
    id: `class-${Date.now()}`,
    name,
    icon: icon || '⚔️',
    fantasy: fantasy || name,
    description: description || '',
    realWorld: realWorld || '',
    tiers: Array.isArray(tiers) ? tiers : [],
    skillTree: Array.isArray(skillTree) ? skillTree : [],
    achievements: Array.isArray(achievements) ? achievements : [],
    status: 'pending',
    createdBy: createdBy || 'unknown',
    createdAt: now(),
    playerCount: 0,
  };
  classesData.classes.push(cls);
  saveClasses();
  res.json({ ok: true, class: cls });
});

// PATCH /api/classes/:id — update class [admin]
app.patch('/api/classes/:id', requireMasterKey, (req, res) => {
  const cls = classesData.classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const allowed = ['name', 'icon', 'fantasy', 'description', 'realWorld', 'tiers', 'skillTree', 'achievements', 'status', 'playerCount'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) cls[key] = req.body[key];
  }
  saveClasses();
  res.json({ ok: true, class: cls });
});

// ─── Roadmap API ──────────────────────────────────────────────────────────────

// GET /api/roadmap — all items
app.get('/api/roadmap', (req, res) => {
  res.json(roadmapData);
});

// POST /api/roadmap — add item [admin]
app.post('/api/roadmap', requireMasterKey, (req, res) => {
  const { title, desc, status, eta, category } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const validStatuses = ['planned', 'in_progress', 'done'];
  const item = {
    id: `r${Date.now()}`,
    title,
    desc: desc || '',
    status: validStatuses.includes(status) ? status : 'planned',
    eta: eta || '',
    category: category || 'feature',
  };
  roadmapData.push(item);
  saveRoadmap();
  res.json({ ok: true, item });
});

// PATCH /api/roadmap/:id — update item [admin]
app.patch('/api/roadmap/:id', requireMasterKey, (req, res) => {
  const item = roadmapData.find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Roadmap item not found' });
  const allowed = ['title', 'desc', 'status', 'eta', 'category'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  }
  saveRoadmap();
  res.json({ ok: true, item });
});

// ─── Rituale API ──────────────────────────────────────────────────────────────

// GET /api/rituals?player=X
app.get('/api/rituals', (req, res) => {
  const { player } = req.query;
  if (player) {
    return res.json(rituals.filter(r => r.playerId === player.toLowerCase()));
  }
  res.json(rituals);
});

// POST /api/rituals — create ritual [auth]
app.post('/api/rituals', requireApiKey, (req, res) => {
  const { title, description, schedule, difficulty, rewards, playerId, createdBy } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  const ritual = {
    id: `ritual-${Date.now()}`,
    title,
    description: description || '',
    schedule: schedule || { type: 'daily' },
    difficulty: difficulty || 'medium',
    rewards: rewards || { xp: 15, gold: 5 },
    streak: 0,
    lastCompleted: null,
    missedDays: 0,
    createdBy: createdBy || playerId,
    playerId: playerId.toLowerCase(),
    createdAt: now(),
  };
  rituals.push(ritual);
  saveRituals();
  res.json({ ok: true, ritual });
});

// POST /api/rituals/:id/complete — mark done today [auth]
app.post('/api/rituals/:id/complete', requireApiKey, (req, res) => {
  const { playerId } = req.body;
  const ritual = rituals.find(r => r.id === req.params.id);
  if (!ritual) return res.status(404).json({ error: 'Ritual not found' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });

  const today = todayStr();
  if (ritual.lastCompleted === today) {
    return res.status(409).json({ error: 'Ritual already completed today' });
  }

  // Streak logic: was it done yesterday?
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (ritual.lastCompleted === yesterday) {
    ritual.streak = (ritual.streak || 0) + 1;
  } else if (!ritual.lastCompleted) {
    ritual.streak = 1;
  } else {
    // Missed days
    const lastDate = new Date(ritual.lastCompleted);
    const daysMissed = Math.floor((Date.now() - lastDate.getTime()) / 86400000) - 1;
    if (daysMissed === 1) {
      ritual.streak = Math.max(0, (ritual.streak || 0) - 3);
    } else if (daysMissed === 2) {
      ritual.streak = Math.max(0, (ritual.streak || 0) - 7);
    } else {
      ritual.streak = 0;
    }
  }
  ritual.lastCompleted = today;
  ritual.missedDays = 0;

  // Award XP/gold to player
  const uid = playerId.toLowerCase();
  const u = users[uid];
  let newAchievements = [];
  let lootDrop = null;
  let milestoneDrop = null;

  if (u) {
    const streakBonus = getStreakXpBonus(ritual.streak);
    const xpAmount = Math.round((ritual.rewards.xp || 15) * (1 + streakBonus));
    u.xp = (u.xp || 0) + xpAmount;
    u.gold = (u.gold || 0) + (ritual.rewards.gold || 5);

    // Milestone check
    const prevStreak = ritual.streak - 1;
    for (const m of STREAK_MILESTONES) {
      if (ritual.streak === m.days && prevStreak < m.days) {
        if (m.lootTier) {
          const pool = lootTables[m.lootTier] || [];
          if (pool.length > 0) {
            milestoneDrop = { ...pool[Math.floor(Math.random() * pool.length)], rarity: m.lootTier, rarityColor: RARITY_COLORS[m.lootTier] };
            addLootToInventory(uid, milestoneDrop);
          }
        }
      }
    }

    // Loot drop (10% chance + GLÜ bonus)
    const dropBonus = getUserDropBonus(uid);
    const { level: ritualPlayerLevel } = getLevelInfo(u.xp || 0);
    const dropped = rollLoot(0.10 + dropBonus, ritualPlayerLevel);
    if (dropped) {
      resetLootPity(uid);
      addLootToInventory(uid, dropped);
      lootDrop = dropped;
    }

    newAchievements = checkAndAwardAchievements(uid);
    saveUsers();
  }
  saveRituals();

  res.json({ ok: true, ritual, newAchievements, lootDrop, milestoneDrop });
});

// DELETE /api/rituals/:id [auth]
app.delete('/api/rituals/:id', requireApiKey, (req, res) => {
  const idx = rituals.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Ritual not found' });
  rituals.splice(idx, 1);
  saveRituals();
  res.json({ ok: true });
});

// ─── Gewohnheiten API ─────────────────────────────────────────────────────────

// GET /api/habits?player=X
app.get('/api/habits', (req, res) => {
  const { player } = req.query;
  if (player) {
    return res.json(habits.filter(h => h.playerId === player.toLowerCase()));
  }
  res.json(habits);
});

// POST /api/habits — create habit [auth]
app.post('/api/habits', requireApiKey, (req, res) => {
  const { title, positive, negative, playerId } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  const habit = {
    id: `habit-${Date.now()}`,
    title,
    positive: positive !== false,
    negative: negative === true,
    color: 'gray',
    score: 0,
    playerId: playerId.toLowerCase(),
    createdAt: now(),
  };
  habits.push(habit);
  saveHabits();
  res.json({ ok: true, habit });
});

// POST /api/habits/:id/score — score +1 or -1 [auth]
app.post('/api/habits/:id/score', requireApiKey, (req, res) => {
  const { direction, playerId } = req.body;
  const habit = habits.find(h => h.id === req.params.id);
  if (!habit) return res.status(404).json({ error: 'Habit not found' });
  if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'direction must be up or down' });

  if (direction === 'up') habit.score = (habit.score || 0) + 1;
  else habit.score = (habit.score || 0) - 1;

  // Color based on score: negative scores → red/orange, positive → yellow/green/blue
  const s = habit.score;
  if (s <= -5)      habit.color = 'red';
  else if (s <= -2) habit.color = 'orange';
  else if (s === 0) habit.color = 'gray';
  else if (s <= 3)  habit.color = 'yellow';
  else if (s <= 8)  habit.color = 'green';
  else              habit.color = 'blue';

  let lootDrop = null;
  const uid = (playerId || '').toLowerCase();
  const u = users[uid];
  if (u && direction === 'up') {
    // Award small XP for positive habit
    u.xp = (u.xp || 0) + 3;
    // Loot drop (5% chance)
    const dropBonus = getUserDropBonus(uid);
    const { level: habitPlayerLevel } = getLevelInfo(u.xp || 0);
    const dropped = rollLoot(0.05 + dropBonus, habitPlayerLevel);
    if (dropped) {
      resetLootPity(uid);
      addLootToInventory(uid, dropped);
      lootDrop = dropped;
    }
    saveUsers();
  }
  saveHabits();
  res.json({ ok: true, habit, lootDrop });
});

// DELETE /api/habits/:id [auth]
app.delete('/api/habits/:id', requireApiKey, (req, res) => {
  const idx = habits.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Habit not found' });
  habits.splice(idx, 1);
  saveHabits();
  res.json({ ok: true });
});

// ─── Inventory API ────────────────────────────────────────────────────────────

// GET /api/player/:name/inventory
app.get('/api/player/:name/inventory', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  res.json({ inventory: u.inventory || [], streakShields: u.streakShields || 0 });
});

// POST /api/player/:name/inventory/use/:itemId [auth]
app.post('/api/player/:name/inventory/use/:itemId', requireApiKey, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const item = (u.inventory || []).find(i => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found in inventory' });
  u.inventory = u.inventory.filter(i => i.id !== item.id);
  saveUsers();
  res.json({ ok: true, item });
});

// ─── Full Equipment API ───────────────────────────────────────────────────────

// GET /api/shop/equipment — gear items for player's level (?level=X or ?player=name)
// Also excludes shopHidden items by default (pass ?includeHidden=1 to override)
app.get('/api/shop/equipment', (req, res) => {
  const { player, level: levelParam, includeHidden } = req.query;
  const showHidden = includeHidden === '1';
  let items = FULL_GEAR_ITEMS.filter(g => showHidden || !g.shopHidden);
  if (levelParam) {
    const lvl = parseInt(levelParam, 10) || 1;
    return res.json(items.filter(g => g.minLevel <= lvl));
  }
  if (player) {
    const u = users[player.toLowerCase()];
    const playerXp = u ? (u.xp || 0) : 0;
    const { level } = getLevelInfo(playerXp);
    return res.json(items.filter(g => g.minLevel <= level));
  }
  res.json(items);
});

// GET /api/gear/:id — single item details
app.get('/api/gear/:id', (req, res) => {
  const item = FULL_GEAR_ITEMS.find(g => g.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// GET /api/gear-templates — raw template data (tiers + setBonus metadata)
app.get('/api/gear-templates', (req, res) => {
  res.json({ tiers: gearTemplates.tiers, setBonus: gearTemplates.setBonus });
});

// POST /api/player/:name/equip/:itemId [auth]
app.post('/api/player/:name/equip/:itemId', requireApiKey, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const item = FULL_GEAR_ITEMS.find(g => g.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Gear item not found' });

  const { level } = getLevelInfo(u.xp || 0);
  if (level < item.minLevel) return res.status(400).json({ error: `Requires level ${item.minLevel}` });
  if ((u.gold || 0) < item.cost) return res.status(400).json({ error: `Insufficient gold. Need ${item.cost}, have ${u.gold || 0}` });

  if (!u.equipment) u.equipment = {};
  // Check if already equipped
  if (u.equipment[item.slot] === item.id) return res.status(409).json({ error: 'Already equipped' });
  u.gold -= item.cost;
  u.equipment[item.slot] = item.id;

  // Add to purchases
  if (!u.purchases) u.purchases = [];
  u.purchases.push({ type: 'equipment', item: item.id, cost: item.cost, at: now() });

  const stats = getUserStats(uid);
  saveUsers();
  res.json({ ok: true, equipment: u.equipment, stats, gold: u.gold });
});

// GET /api/player/:name/stats — player's current stats from equipment
app.get('/api/player/:name/stats', (req, res) => {
  const uid = req.params.name.toLowerCase();
  if (!users[uid]) return res.status(404).json({ error: 'Player not found' });
  const stats = getUserStats(uid);
  const equipment = getUserEquipment(uid);
  res.json({ stats, equipment });
});

// ─── Stats API ────────────────────────────────────────────────────────────────

// GET /api/stats/content — aggregate content stats
app.get('/api/stats/content', (req, res) => {
  rebuildCatalogMeta();
  const totalQuests = quests.length;
  const byType = {};
  for (const q of quests) {
    const t = q.type || 'development';
    byType[t] = (byType[t] || 0) + 1;
  }
  const totalPlayers = Object.keys(users).length;
  const totalCampaigns = campaigns.length;
  const totalClasses = classesData.classes.length;
  const activeClasses = classesData.classes.filter(c => c.status === 'active').length;
  const pendingClasses = classesData.classes.filter(c => c.status === 'pending').length;

  // Balance check: min/max quests per class
  const questsPerClass = {};
  for (const q of quests) {
    if (q.skills) for (const s of q.skills) {
      questsPerClass[s] = (questsPerClass[s] || 0) + 1;
    }
  }
  const classCounts = Object.values(questsPerClass);
  const balanceCheck = classCounts.length > 0
    ? { min: Math.min(...classCounts), max: Math.max(...classCounts) }
    : { min: 0, max: 0 };

  res.json({
    totalQuests,
    byType,
    totalPlayers,
    totalCampaigns,
    totalClasses,
    activeClasses,
    pendingClasses,
    catalogTemplates: questCatalog.meta.totalTemplates,
    catalogByCategory: questCatalog.meta.byCategory,
    balanceCheck,
  });
});

// ─── Changelog (GitHub Commits) ──────────────────────────────────────────────
let changelogCache = null;
let changelogLastFetch = 0;
const CHANGELOG_TTL = 30 * 60 * 1000; // 30 minutes

async function fetchAndCacheChangelog() {
  try {
    const res = await fetch(
      'https://api.github.com/repos/B4lmoncl/agent-dashboard/commits?per_page=50',
      { headers: { 'User-Agent': 'agent-dashboard-server', 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) {
      console.warn('[changelog] GitHub API returned', res.status);
      return;
    }
    const commits = await res.json();
    if (!Array.isArray(commits)) return;

    // Group by date
    const byDate = {};
    for (const c of commits) {
      const date = c.commit?.author?.date
        ? c.commit.author.date.slice(0, 10)
        : null;
      if (!date) continue;

      const msg = c.commit?.message?.split('\n')[0] || '';
      let type = 'chore';
      let message = msg;
      if (msg.startsWith('feat:')) { type = 'feat'; message = msg.slice(5).trim(); }
      else if (msg.startsWith('fix:')) { type = 'fix'; message = msg.slice(4).trim(); }
      else if (msg.startsWith('chore:')) { type = 'chore'; message = msg.slice(6).trim(); }
      else if (msg.startsWith('docs:')) { type = 'docs'; message = msg.slice(5).trim(); }
      else if (msg.startsWith('refactor:')) { type = 'refactor'; message = msg.slice(9).trim(); }

      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({
        sha: c.sha ? c.sha.slice(0, 7) : '',
        type,
        message,
        author: c.commit?.author?.name || c.author?.login || '',
        url: c.html_url || null,
      });
    }

    const entries = Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, commits]) => ({ date, commits }));

    changelogCache = { entries, fetchedAt: new Date().toISOString() };
    changelogLastFetch = Date.now();
    console.log(`[changelog] Cached ${commits.length} commits across ${entries.length} days`);
  } catch (err) {
    console.warn('[changelog] Failed to fetch from GitHub:', err.message);
  }
}

app.get('/api/changelog', async (req, res) => {
  if (!changelogCache || Date.now() - changelogLastFetch > CHANGELOG_TTL) {
    await fetchAndCacheChangelog();
  }
  if (!changelogCache) {
    return res.json({ entries: [], error: 'Could not fetch changelog from GitHub' });
  }
  res.json(changelogCache);
});

// GET /api/player/:name/character — full character screen data
app.get('/api/player/:name/character', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const xp = u.xp || 0;
  const lvlInfo = getLevelInfo(xp);
  const xpProgress = lvlInfo.nextXp
    ? Math.min(1, (xp - lvlInfo.xpRequired) / (lvlInfo.nextXp - lvlInfo.xpRequired))
    : 1;

  // Stats with and without set bonus
  const equippedIds = Object.values(u.equipment || {}).filter(Boolean);
  let baseStats = { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 };
  const equippedItems = [];
  for (const itemId of equippedIds) {
    const item = FULL_GEAR_ITEMS.find(g => g.id === itemId);
    if (item) {
      equippedItems.push(item);
      for (const [stat, val] of Object.entries(item.stats)) {
        baseStats[stat] = (baseStats[stat] || 0) + val;
      }
    }
  }
  const fullStats = getUserStats(uid);

  // Set bonus info (tier sets)
  let setBonusInfo = null;
  const setCount = {};
  for (const item of equippedItems) {
    setCount[item.setId] = (setCount[item.setId] || 0) + 1;
  }
  for (const [setId, count] of Object.entries(setCount)) {
    const sb = SET_BONUSES[setId];
    if (sb && count >= 3) {
      setBonusInfo = { name: sb.name, count, total: 6 };
      break;
    }
  }
  // Named set bonuses
  const equippedItemIds = new Set(equippedItems.map(i => i.id));
  const namedSetBonuses = [];
  for (const ns of gearTemplates.namedSets || []) {
    const ownedCount = ns.pieces.filter(pid => equippedItemIds.has(pid)).length;
    if (ownedCount === 0) continue;
    const isComplete = ownedCount >= ns.pieces.length;
    let activeLabel = null;
    if (isComplete && ns.fullBonus) activeLabel = ns.fullBonus.label;
    else if (ns.partialBonus) {
      for (const [threshold, bonus] of Object.entries(ns.partialBonus)) {
        if (ownedCount >= Number(threshold)) activeLabel = bonus.label;
      }
    }
    namedSetBonuses.push({ id: ns.id, name: ns.name, rarity: ns.rarity, count: ownedCount, total: ns.pieces.length, isComplete, activeLabel });
  }

  // Class tier
  let classTier = null;
  if (u.classId) {
    const classData = store.classes ? store.classes.find(c => c.id === u.classId) : null;
    if (classData && classData.tiers) {
      const tier = [...classData.tiers].reverse().find(t => xp >= t.minXp);
      if (tier) classTier = tier.title;
    }
  }

  // Inventory — all owned gear items
  const inventoryIds = u.inventory || [];
  const inventoryItems = inventoryIds.map(id => {
    const item = FULL_GEAR_ITEMS.find(g => g.id === id);
    if (!item) return null;
    return { id: item.id, slot: item.slot, name: item.name, emoji: item.emoji, tier: item.tier, minLevel: item.minLevel };
  }).filter(Boolean);

  // Also add equipped items to inventory if not already there
  for (const item of equippedItems) {
    if (!inventoryItems.find(i => i.id === item.id)) {
      inventoryItems.push({ id: item.id, slot: item.slot, name: item.name, emoji: item.emoji, tier: item.tier, minLevel: item.minLevel });
    }
  }

  // Companion
  const companion = u.companion ? {
    name: u.companion.name,
    emoji: u.companion.emoji,
    bondLevel: u.companion.bondLevel || 0,
  } : null;

  res.json({
    name: u.name || uid,
    level: lvlInfo.level,
    xp,
    xpToNext: lvlInfo.nextXp,
    xpProgress,
    title: lvlInfo.title,
    classId: u.classId || null,
    classTier,
    companion,
    equipment: u.equipment || {},
    stats: { kraft: fullStats.kraft || 0, ausdauer: fullStats.ausdauer || 0, weisheit: fullStats.weisheit || 0, glueck: fullStats.glueck || 0 },
    baseStats,
    inventory: inventoryItems,
    forgeTemp: Math.round((u.forgeTemp || 0) * 100),
    season: 'spring',
    setBonusInfo,
    namedSetBonuses,
  });
});

// POST /api/player/:name/unequip/:slot [auth]
app.post('/api/player/:name/unequip/:slot', requireApiKey, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const slot = req.params.slot;
  if (!EQUIPMENT_SLOTS.includes(slot)) return res.status(400).json({ error: 'Invalid slot' });
  if (!u.equipment) u.equipment = {};
  delete u.equipment[slot];
  saveUsers();
  const stats = getUserStats(uid);
  res.json({ ok: true, equipment: u.equipment, stats });
});

// ─── NPC Quest Giver API ──────────────────────────────────────────────────────

// GET /api/npcs/active
app.get('/api/npcs/active', (req, res) => {
  const now = new Date();
  const result = npcState.activeNpcs
    .filter(a => new Date(a.expiresAt) > now)
    .map(active => {
      const giver = npcGivers.givers.find(g => g.id === active.giverId);
      if (!giver) return null;
      const questIds = npcState.npcQuestIds[active.giverId] || [];
      const npcQuests = quests.filter(q => questIds.includes(q.id));
      const msLeft = new Date(active.expiresAt) - now;
      return {
        id: giver.id,
        name: giver.name,
        emoji: giver.emoji,
        title: giver.title,
        description: giver.description,
        portrait: giver.portrait || null,
        greeting: giver.greeting || null,
        rarity: giver.rarity || 'common',
        arrivedAt: active.arrivedAt,
        expiresAt: active.expiresAt,
        daysLeft: Math.max(0, Math.ceil(msLeft / 86400000)),
        hoursLeft: Math.max(0, Math.ceil(msLeft / 3600000)),
        finalReward: giver.finalReward,
        questChain: questIds.map((qid, idx) => {
          const q = npcQuests.find(x => x.id === qid);
          if (!q) return null;
          return {
            questId: q.id,
            title: q.title,
            description: q.description,
            type: q.type,
            priority: q.priority,
            status: q.status,
            claimedBy: q.claimedBy,
            completedBy: q.completedBy,
            rewards: q.npcRewards,
            position: idx + 1,
          };
        }).filter(Boolean),
      };
    }).filter(Boolean);
  res.json({ npcs: result });
});

// GET /api/npcs/:id
app.get('/api/npcs/:id', (req, res) => {
  const id = req.params.id;
  const giver = npcGivers.givers.find(g => g.id === id);
  if (!giver) return res.status(404).json({ error: 'NPC not found' });
  const active = npcState.activeNpcs.find(a => a.giverId === id);
  const questIds = npcState.npcQuestIds[id] || [];
  const npcQuests = quests.filter(q => questIds.includes(q.id));
  res.json({
    ...giver,
    active: !!active,
    arrivedAt: active?.arrivedAt || null,
    expiresAt: active?.expiresAt || null,
    cooldownUntil: npcState.cooldowns[id] || null,
    quests: npcQuests,
  });
});

// POST /api/npcs/rotate [admin]
app.post('/api/npcs/rotate', requireApiKey, (req, res) => {
  const incomingKey = req.headers['x-api-key'];
  const masterKey = getMasterKey();
  if (incomingKey !== masterKey && incomingKey !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Admin only' });
  }
  rotateNpcs();
  res.json({ ok: true, activeNpcs: npcState.activeNpcs });
});

// GET /api/app-state
app.get('/api/app-state', (req, res) => {
  res.json({ version: appState.version });
});

// Serve index.html for non-API routes (SPA fallback)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'out', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run: npm run build' });
  }
});

// ─── Boot ──────────────────────────────────────────────────────────────────────
initStore();
loadData();
loadQuests();
loadCampaigns();
autoCreateCampaigns();
loadManagedKeys();
loadUsers();
loadPlayerProgress();
loadQuestCatalog();
seedQuestCatalog();
loadClasses();
loadCompanionsData();
loadRoadmap();
loadRituals();
loadHabits();
loadLootTables();
loadGearTemplates();
loadNpcGivers();
loadNpcState();
loadAppState();
rotateNpcs();

// Version tracking
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  if (pkg.version) {
    appState.version = pkg.version;
    saveAppState();
  }
} catch (e) { /* ignore */ }

fetchAndCacheChangelog();
setInterval(fetchAndCacheChangelog, CHANGELOG_TTL);

app.listen(PORT, () => {
  console.log(`\n🔴 Agent Dashboard API running on http://localhost:${PORT}`);
  console.log(`   Agents: ${AGENT_NAMES.join(', ')}`);
  console.log(`   API Keys: ${validApiKeys.size} configured`);
  console.log(`   Rate limit: 100 req / 15 min per IP`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /api/agents`);
  console.log(`     GET  /api/agent/:name`);
  console.log(`     POST /api/agent/:name/status  [auth]`);
  console.log(`     POST /api/agent/:name/command [auth]`);
  console.log(`     GET  /api/agent/:name/commands\n`);
});
