/**
 * User System Routes — player registration, auth, XP, streaks, achievements.
 */
const crypto = require('crypto');
const { state, ADMIN_KEY, LEVELS, QUEST_FLAVOR, CAMPAIGN_NPCS, saveUsers, saveClasses, saveManagedKeys } = require('../lib/state');
const { now, getLevelInfo, calcDynamicForgeTemp, onQuestCompletedByUser, createCompanionQuestsForUser } = require('../lib/helpers');
const { requireApiKey, getMasterKey } = require('../lib/middleware');

const router = require('express').Router();

// GET /api/users
router.get('/api/users', (req, res) => {
  const { getXpMultiplier, getGoldMultiplier, getUserGear, getQuestHoardingMalus } = require('../lib/helpers');
  const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
  const result = Object.values(state.users).map(u => {
    const ft = calcDynamicForgeTemp(u.id);
    const forgeXp = getXpMultiplier(u.id);
    const forgeGold = getGoldMultiplier(u.id);
    const gear = getUserGear(u.id);
    const gearBonus = 1 + (gear.xpBonus || 0) / 100;
    const earnedIds = new Set((u.earnedAchievements || []).map(a => a.id));
    const compBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
    const bondBonus = 1 + 0.01 * Math.max(0, (u.companion?.bondLevel ?? 1) - 1);
    const streakGold = Math.min(1 + (u.streakDays || 0) * 0.1, 3);
    const hoarding = getQuestHoardingMalus(u.id);
    const hoardingMultiplier = hoarding.multiplier;
    return {
      ...u,
      forgeTemp: ft,
      modifiers: {
        xp: { forge: forgeXp, gear: gearBonus, companions: compBonus, bond: bondBonus, hoarding: hoardingMultiplier, hoardingCount: hoarding.count, hoardingPct: hoarding.malusPct, total: +(forgeXp * gearBonus * compBonus * bondBonus * hoardingMultiplier).toFixed(2) },
        gold: { forge: forgeGold, streak: streakGold, total: +(forgeGold * streakGold).toFixed(2) },
      },
    };
  });
  res.json(result);
});

// GET /api/users/:id
router.get('/api/users/:id', (req, res) => {
  const user = state.users[req.params.id.toLowerCase()];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users/:id/register — create or update user
router.post('/api/users/:id/register', requireApiKey, (req, res) => {
  const id = req.params.id.toLowerCase();
  const { name, avatar, color } = req.body;
  if (!state.users[id]) {
    state.users[id] = { id, name: name || id, avatar: avatar || id[0].toUpperCase(), color: color || '#f59e0b', xp: 0, questsCompleted: 0, achievements: [], earnedAchievements: [], streakDays: 0, streakLastDate: null, forgeTemp: 100, gold: 0, currencies: { gold: 0, stardust: 0, essenz: 0, runensplitter: 0, gildentaler: 0, mondstaub: 0 }, _allCompletedTypes: [], createdAt: now() };
  } else {
    if (name) state.users[id].name = name;
    if (avatar) state.users[id].avatar = avatar;
    if (color) state.users[id].color = color;
  }
  saveUsers();
  res.json({ ok: true, user: state.users[id] });
});

// POST /api/users/:id/award-xp — award XP to a user
router.post('/api/users/:id/award-xp', requireApiKey, (req, res) => {
  const id = req.params.id.toLowerCase();
  if (!state.users[id]) return res.status(404).json({ error: 'User not found' });
  const { amount = 10, reason } = req.body;
  state.users[id].xp = (state.users[id].xp || 0) + parseInt(amount, 10);
  if (reason) {
    state.users[id].achievements = state.users[id].achievements || [];
    state.users[id].achievements.push({ reason, xp: amount, at: now() });
  }
  saveUsers();
  res.json({ ok: true, xp: state.users[id].xp });
});

// GET /api/streaks — get streak info for all users and agents
router.get('/api/streaks', (req, res) => {
  const userStreaks = Object.values(state.users).map(u => ({
    id: u.id, name: u.name, type: 'user',
    streakDays: u.streakDays || 0, streakLastDate: u.streakLastDate || null,
  }));
  const agentStreaks = Object.values(state.store.agents).map(a => ({
    id: a.id, name: a.name, type: 'agent',
    streakDays: a.streakDays || 0, streakLastDate: a.streakLastDate || null,
  }));
  res.json([...userStreaks, ...agentStreaks].sort((a, b) => b.streakDays - a.streakDays));
});

// GET /api/achievements — list all achievement definitions
router.get('/api/achievements', (req, res) => {
  res.json(state.ACHIEVEMENT_CATALOGUE.map(a => ({ id: a.id, name: a.name, icon: a.icon, desc: a.desc, category: a.category, hidden: !!a.hidden, condition: a.condition || null })));
});

// GET /api/quest-flavor — quest flavor text
router.get('/api/quest-flavor', (req, res) => {
  res.json(QUEST_FLAVOR);
});

// GET /api/levels — all level definitions
router.get('/api/levels', (req, res) => {
  res.json(LEVELS);
});

// GET /api/campaign/npcs — campaign NPCs
router.get('/api/campaign/npcs', (req, res) => {
  res.json(CAMPAIGN_NPCS);
});

// GET /api/auth/check — check API key validity and admin status
router.get('/api/auth/check', (req, res) => {
  const key = req.headers['x-api-key'];
  if (!key || !state.validApiKeys.has(key)) {
    return res.json({ isAdmin: false, name: null, valid: false });
  }
  const master = getMasterKey();
  const isAdmin = (key === master) || (key === ADMIN_KEY);
  // Find user with this API key
  const user = Object.values(state.users).find(u => u.apiKey === key);
  return res.json({ isAdmin, name: user ? user.name : null, userId: user ? user.id : null, valid: true });
});

// POST /api/auth/login — validate name + password (returns apiKey for internal use)
router.post('/api/auth/login', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ success: false, error: 'Name and password required' });

  const bcrypt = require('bcryptjs');
  const nameLower = name.toLowerCase();
  const user = Object.values(state.users).find(u => u.name.toLowerCase() === nameLower);

  if (!user) return res.json({ success: false, error: 'Invalid name or password' });

  // Support both new password login and legacy API-key-as-password login
  if (user.passwordHash) {
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.json({ success: false, error: 'Invalid name or password' });
  } else {
    // Legacy: user has no password yet, check if password matches apiKey
    if (password !== user.apiKey) return res.json({ success: false, error: 'Invalid name or password' });
  }

  const master = getMasterKey();
  const isAdmin = (user.apiKey === master) || (user.apiKey === ADMIN_KEY);

  return res.json({
    success: true,
    apiKey: user.apiKey,
    userId: user.id,
    name: user.name,
    isAdmin,
  });
});

// POST /api/auth/set-password — migration: set password for existing user
router.post('/api/auth/set-password', async (req, res) => {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Unauthorized' });

  const user = Object.values(state.users).find(u => u.apiKey === key);
  if (!user) return res.status(401).json({ error: 'Invalid key' });

  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const bcrypt = require('bcryptjs');
  user.passwordHash = await bcrypt.hash(password, 10);
  saveUsers();

  return res.json({ success: true, message: 'Password set' });
});

// POST /api/register — register a new player
router.post('/api/register', async (req, res) => {
  const { name, password, age, goals, pronouns, classId, companion, relationshipStatus, partnerName } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  if (!password) return res.status(400).json({ error: 'password is required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const trimmedName = String(name).trim();
  const nameLower = trimmedName.toLowerCase();
  // Check if name already taken
  const existing = Object.values(state.users).find(u => u.name.toLowerCase() === nameLower);
  if (existing) return res.status(409).json({ error: 'Name already taken' });
  // Generate API key + hash password
  const bcrypt = require('bcryptjs');
  const apiKey = crypto.randomBytes(16).toString('hex');
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = nameLower.replace(/\s+/g, '_');
  const finalId = state.users[userId] ? `${userId}_${Date.now()}` : userId;

  // Resolve classId — check if it exists and is active or pending
  let resolvedClassId = null;
  let classPending = false;
  if (classId) {
    const cls = state.classesData.classes.find(c => c.id === classId);
    if (cls) {
      resolvedClassId = cls.id;
      classPending = cls.status === 'pending';
      // Increment playerCount for the class
      cls.playerCount = (cls.playerCount || 0) + 1;
      saveClasses();
    }
  }

  state.users[finalId] = {
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
    currencies: { gold: 0, stardust: 0, essenz: 0, runensplitter: 0, gildentaler: 0, mondstaub: 0 },
    apiKey,
    passwordHash: hashedPassword,
    _allCompletedTypes: [],
    createdAt: now(),
    // Extended onboarding fields
    age: age ? parseInt(age, 10) : null,
    goals: goals || null,
    relationshipStatus: (['single', 'relationship', 'married', 'complicated', 'other'].includes(relationshipStatus)) ? relationshipStatus : 'single',
    partnerName: partnerName || null,
    pronouns: (['he/him', 'she/her', 'they/them', 'other', 'prefer_not_to_say'].includes(pronouns)) ? pronouns : null,
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
  state.managedKeys.push(entry);
  state.validApiKeys.add(apiKey);
  saveManagedKeys();
  saveUsers();
  // Auto-create companion quests if companion provided
  if (companion) {
    createCompanionQuestsForUser(finalId);
  }
  console.log(`[register] new player: ${trimmedName} (${finalId}) class=${resolvedClassId || 'none'} companion=${companion ? companion.name : 'none'}`);
  res.json({ name: trimmedName, apiKey, userId: finalId });
});

module.exports = router;
