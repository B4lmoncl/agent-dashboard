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
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const QUESTS_FILE = path.join(DATA_DIR, 'quests.json');
const KEYS_FILE   = path.join(DATA_DIR, 'keys.json');
const USERS_FILE  = path.join(DATA_DIR, 'users.json');

app.use(cors());
app.use(express.json());

// ─── Rate Limiting ──────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased for development/testing
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
  lyra:  { avatar: '✦', color: '#e879f9', role: 'AI Orchestrator', description: 'AI Orchestrator. Team lead. Gets shit done.' },
  forge: { avatar: '⚒', color: '#f59e0b', role: 'Idea Smith', description: 'Silent craftsman' },
};

// ─── NPC Catalogue ──────────────────────────────────────────────────────────
const NPC_META = {
  dobbie: { avatar: '🐱', color: '#ff6b9d', role: 'Cat Overlord', description: 'Dobbie the demanding house cat. His requests are not optional. Resistance is futile.' },
};
const NPC_NAMES = Object.keys(NPC_META);

let store = { agents: {} };

// ─── Quest store ────────────────────────────────────────────────────────────────
let quests = [];

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

// ─── Achievements catalogue ─────────────────────────────────────────────────
const ACHIEVEMENT_CATALOGUE = [
  // Milestones
  { id: 'first_quest',  name: 'First Quest',        icon: '⚔',  desc: 'Complete your first quest',        category: 'milestone', trigger: (u) => (u.questsCompleted || 0) >= 1   },
  { id: 'apprentice',   name: 'Apprentice',           icon: '📜', desc: 'Complete 10 quests',               category: 'milestone', trigger: (u) => (u.questsCompleted || 0) >= 10  },
  { id: 'knight',       name: 'Knight',               icon: '🛡',  desc: 'Complete 50 quests',              category: 'milestone', trigger: (u) => (u.questsCompleted || 0) >= 50  },
  { id: 'legend',       name: 'Legend',               icon: '👑', desc: 'Complete 100 quests',              category: 'milestone', trigger: (u) => (u.questsCompleted || 0) >= 100 },
  // Streaks
  { id: 'week_warrior', name: 'Week Warrior',         icon: '🔥', desc: '7-day quest streak',               category: 'streak',    trigger: (u) => (u.streakDays || 0) >= 7   },
  { id: 'monthly_champ',name: 'Monthly Champion',     icon: '💎', desc: '30-day quest streak',              category: 'streak',    trigger: (u) => (u.streakDays || 0) >= 30  },
  // Speed
  { id: 'lightning',    name: 'Lightning Hands',      icon: '⚡', desc: 'Complete 3 quests in one day',     category: 'speed',     trigger: (u) => (u._todayCount || 0) >= 3  },
  // Variety
  { id: 'all_trades',   name: 'Jack of All Trades',   icon: '🎯', desc: 'Complete all quest types',         category: 'variety',   trigger: (u) => (u._completedTypes || new Set()).size >= 5 },
  // Boss Battles
  { id: 'boss_slayer',  name: 'Boss Slayer',          icon: '🐉', desc: 'Defeat your first Boss Battle',    category: 'boss',      trigger: (u) => (u._bossDefeated || false) },
  // Companions
  { id: 'ember_sprite', name: 'Ember Sprite',         icon: '🔮', desc: 'Complete 10 development quests',   category: 'companion', trigger: (u) => (u._devCount || 0) >= 10 },
  { id: 'lore_owl',     name: 'Lore Owl',             icon: '🦉', desc: 'Complete 5 learning quests',       category: 'companion', trigger: (u) => (u._learningCount || 0) >= 5 },
  { id: 'gear_golem',   name: 'Gear Golem',           icon: '🤖', desc: 'Reach Knight level (300 XP)',       category: 'companion', trigger: (u) => (u.xp || 0) >= 300 },
  // Challenges
  { id: 'challenge_coder',  name: 'Code Sprinter',    icon: '💻', desc: 'Complete the 30-Day Code Sprint',  category: 'challenge', trigger: (u) => (u._challengesCompleted || []).includes('code_sprint') },
  { id: 'challenge_learner',name: 'Marathon Learner', icon: '📖', desc: 'Complete the Learning Marathon',   category: 'challenge', trigger: (u) => (u._challengesCompleted || []).includes('learning_marathon') },
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
  // Companion XP buff: +2% per unlocked companion
  const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
  const earnedIds = new Set((u.earnedAchievements || []).map(a => a.id));
  const companionBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
  u.xp = (u.xp || 0) + Math.round(xpBase * xpMulti * gearBonus * companionBonus);
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
  // Track per-type counts for companions
  u._devCount = (u._devCount || 0) + ((quest.type === 'development' || !quest.type) ? 1 : 0);
  u._learningCount = (u._learningCount || 0) + (quest.type === 'learning' ? 1 : 0);
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
  saveUsers();
  return newAchs;
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
  const { title, description, priority, category, categories, product, humanInputRequired, createdBy, type, parentQuestId, recurrence, proof, nextQuestTemplate, coopPartners, skills } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const validPriorities = ['low', 'medium', 'high'];
  const validCategories = ['Coding', 'Research', 'Content', 'Sales', 'Infrastructure', 'Bug Fix', 'Feature'];
  const validProducts = ['Dashboard', 'Companion App', 'Infrastructure', 'Other'];
  const validTypes = ['development', 'personal', 'learning', 'social', 'fitness', 'boss', 'relationship-coop'];
  const validRecurrences = ['daily', 'weekly', 'monthly'];
  const PLAYER_QUEST_TYPES = ['personal', 'learning', 'fitness', 'social', 'relationship-coop'];
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
  const questStatus = (isPlayerQuestType || !isAgentCreated) ? 'open' : 'suggested';
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
  };
  quests.push(quest);
  saveQuests();
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

// POST /api/quest/:id/claim — agent claims a quest
app.post('/api/quest/:id/claim', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  if (quest.status !== 'open') return res.status(409).json({ error: `Quest is already ${quest.status}` });
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
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
  if (quest.status === 'completed') return res.status(409).json({ error: 'Quest already completed' });
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  quest.status = 'completed';
  quest.completedBy = agentId;
  quest.completedAt = now();
  if (quest.recurrence) {
    quest.streak = (quest.streak || 0) + 1;
    quest.lastCompletedAt = now();
  }
  saveQuests();
  const agentKey = agentId.toLowerCase();
  let newAchievements = [];
  // Award to user if exists, otherwise to agent
  if (users[agentKey]) {
    newAchievements = onQuestCompletedByUser(agentKey, quest);
  } else if (store.agents[agentKey]) {
    store.agents[agentKey].questsCompleted = (store.agents[agentKey].questsCompleted || 0) + 1;
    awardXP(agentKey, quest.priority);
    awardAgentGold(agentKey, quest.priority, store.agents[agentKey].streakDays);
    updateAgentStreak(agentKey);
    saveData();
  }
  console.log(`[quest] ${quest.id} completed by ${agentId}`);
  res.json({ ok: true, quest, newAchievements, chainQuestTemplate: quest.nextQuestTemplate || null });
});

// POST /api/quest/:id/unclaim — agent unclaims a quest
app.post('/api/quest/:id/unclaim', requireApiKey, (req, res) => {
  const quest = quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
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
app.get('/api/quests', (req, res) => {
  const typeFilter = req.query.type;

  function enrichEpics(list) {
    return list.map(q => {
      const children = quests.filter(c => c.parentQuestId === q.id);
      if (children.length === 0) return q;
      const completedCount = children.filter(c => c.status === 'completed').length;
      return { ...q, children, progress: { completed: completedCount, total: children.length } };
    });
  }

  function filterAndEnrich(statusFilter) {
    let list = quests.filter(q => q.status === statusFilter && !q.parentQuestId);
    if (typeFilter) list = list.filter(q => q.type === typeFilter);
    return enrichEpics(list);
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

// GET /api/leaderboard — agents ranked by XP
app.get('/api/leaderboard', (req, res) => {
  const ranked = Object.values(store.agents)
    .map(a => ({
      id: a.id,
      name: a.name,
      avatar: a.avatar,
      color: a.color,
      role: a.role,
      xp: a.xp || 0,
      questsCompleted: a.questsCompleted || 0,
    }))
    .sort((a, b) => b.xp - a.xp || b.questsCompleted - a.questsCompleted)
    .map((a, i) => ({ ...a, rank: i + 1 }));
  res.json(ranked);
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
    <p>All POST endpoints require an <code>X-API-Key</code> header. GET endpoints are always public. Rate limited to 100 requests per 15 minutes per IP (429 Too Many Requests when exceeded).</p>
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

// GET /api/users
app.get('/api/users', (req, res) => {
  res.json(Object.values(users));
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
  res.json(ACHIEVEMENT_CATALOGUE.map(a => ({ id: a.id, name: a.name, icon: a.icon, desc: a.desc, category: a.category })));
});

// GET /api/users/:id/achievements — get earned achievements for a user
app.get('/api/users/:id/achievements', (req, res) => {
  const u = users[req.params.id.toLowerCase()];
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u.earnedAchievements || []);
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
loadManagedKeys();
loadUsers();

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
