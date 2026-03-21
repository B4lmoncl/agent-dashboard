/**
 * User System Routes — player registration, auth (JWT), XP, streaks, achievements.
 */
const crypto = require('crypto');
const { state, LEVELS, QUEST_FLAVOR, CAMPAIGN_NPCS, DEFAULT_CURRENCIES, ensureUserCurrencies, saveUsers, saveClasses, saveManagedKeys, rebuildUserIndexes } = require('../lib/state');
const { now, getLevelInfo, calcDynamicForgeTemp, onQuestCompletedByUser, createCompanionQuestsForUser, paginate } = require('../lib/helpers');
const { requireAuth, requireMasterKey, getMasterKey } = require('../lib/middleware');
const { generateTokenPair, setRefreshCookie, clearRefreshCookie, getRefreshTokenFromRequest, verifyRefreshToken, revokeRefreshToken, resolveAuth } = require('../lib/auth');

const rateLimit = require('express-rate-limit');
const router = require('express').Router();

// Strict rate limit for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

// ─── Helper: determine admin status for a user ─────────────────────────────
function isUserAdmin(user) {
  const master = getMasterKey();
  return !!(user.apiKey && user.apiKey === master);
}

// GET /api/users
router.get('/api/users', (req, res) => {
  const { getXpMultiplier, getGoldMultiplier, getForgeXpBase, getForgeGoldBase, getKraftBonus, getWeisheitBonus, getUserGear, getQuestHoardingMalus, getLegendaryModifiers } = require('../lib/helpers');
  const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
  const result = Object.values(state.users).map(u => {
    const ft = calcDynamicForgeTemp(u.id);
    const forgeXpPure = getForgeXpBase(u.id);
    const kraftBonus = getKraftBonus(u.id);
    const forgeXp = getXpMultiplier(u.id);
    const forgeGoldPure = getForgeGoldBase(u.id);
    const weisheitBonus = getWeisheitBonus(u.id);
    const forgeGold = getGoldMultiplier(u.id);
    const gear = getUserGear(u.id);
    const gearBonus = 1 + (gear.xpBonus || 0) / 100;
    const earnedIds = new Set((u.earnedAchievements || []).map(a => a.id));
    const compBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
    const bondBonus = 1 + 0.01 * Math.max(0, (u.companion?.bondLevel ?? 1) - 1);
    const streakGold = Math.min(1 + (u.streakDays || 0) * 0.015, 1.45);
    const hoarding = getQuestHoardingMalus(u.id);
    const hoardingMultiplier = hoarding.multiplier;
    const legendaryMods = getLegendaryModifiers(u.id);
    // Strip sensitive fields before exposing user data
    const { passwordHash: _ph, apiKey: _ak, refreshTokens: _rt, spotify: _sp, ...safeUser } = u;
    // Enrich earned achievements with catalogue data (icon/desc may be missing on old entries)
    if (Array.isArray(safeUser.earnedAchievements)) {
      safeUser.earnedAchievements = safeUser.earnedAchievements.map(a => {
        const tpl = state.achievementCatalogueById?.get(a.id);
        if (!tpl) return a;
        return { ...a, icon: a.icon || tpl.icon, desc: a.desc || tpl.desc, rarity: a.rarity || tpl.rarity, category: a.category || tpl.category };
      });
    }
    return {
      ...safeUser,
      forgeTemp: ft,
      equippedTitle: u.equippedTitle || null,
      modifiers: {
        xp: { forge: forgeXpPure, kraft: kraftBonus, gear: gearBonus, companions: compBonus, bond: bondBonus, hoarding: hoardingMultiplier, hoardingCount: hoarding.count, hoardingPct: hoarding.malusPct, legendary: legendaryMods.xpBonus, total: +(forgeXp * gearBonus * compBonus * bondBonus * hoardingMultiplier * legendaryMods.xpBonus).toFixed(2) },
        gold: { forge: forgeGoldPure, weisheit: weisheitBonus, streak: streakGold, legendary: legendaryMods.goldBonus, total: +(forgeGold * streakGold * legendaryMods.goldBonus).toFixed(2) },
      },
    };
  });
  // Support pagination: ?limit=50&offset=0 — without params returns all (backward compat)
  if (req.query.limit) {
    const page = paginate(result, req.query);
    return res.json({ users: page.items, total: page.total, limit: page.limit, offset: page.offset, hasMore: page.hasMore });
  }
  res.json(result);
});

// GET /api/users/:id
router.get('/api/users/:id', (req, res) => {
  const user = state.users[req.params.id.toLowerCase()];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash: _ph, apiKey: _ak, refreshTokens: _rt, spotify: _sp, ...safeUser } = user;
  res.json(safeUser);
});

// POST /api/users/:id/register — create or update user
router.post('/api/users/:id/register', requireAuth, (req, res) => {
  const id = req.params.id.toLowerCase();
  const { name, avatar, color } = req.body;
  if (!state.users[id]) {
    state.users[id] = { id, name: name || id, avatar: avatar || id[0].toUpperCase(), color: color || '#f59e0b', xp: 0, questsCompleted: 0, achievements: [], earnedAchievements: [], streakDays: 0, streakLastDate: null, forgeTemp: 0, currencies: { ...DEFAULT_CURRENCIES }, _allCompletedTypes: [], createdAt: now() };
    ensureUserCurrencies(state.users[id]);
    // Update lookup Maps so usersByName/usersByApiKey stay in sync
    state.usersByName.set((name || id).toLowerCase(), state.users[id]);
  } else {
    if (name && name !== state.users[id].name) {
      // Remove old name from lookup Map before updating
      const oldName = state.users[id].name;
      if (oldName) state.usersByName.delete(oldName.toLowerCase());
      state.users[id].name = name;
      state.usersByName.set(name.toLowerCase(), state.users[id]);
    }
    if (avatar) state.users[id].avatar = avatar;
    if (color) state.users[id].color = color;
  }
  saveUsers();
  res.json({ ok: true, user: state.users[id] });
});

// POST /api/users/:id/award-xp — award XP to a user
router.post('/api/users/:id/award-xp', requireAuth, (req, res) => {
  const id = req.params.id.toLowerCase();
  if (!state.users[id]) return res.status(404).json({ error: 'User not found' });
  const { amount = 10, reason } = req.body;
  const xpAmount = Math.max(0, Math.min(100000, parseInt(amount, 10) || 0));
  if (xpAmount <= 0) return res.status(400).json({ error: 'Amount must be positive' });
  state.users[id].xp = (state.users[id].xp || 0) + xpAmount;
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

// GET /api/achievements — list all achievement definitions + point milestones
router.get('/api/achievements', (req, res) => {
  res.json({
    achievements: state.ACHIEVEMENT_CATALOGUE.map(a => ({ id: a.id, name: a.name, icon: a.icon, desc: a.desc, category: a.category, rarity: a.rarity, points: a.points || 5, hidden: !!a.hidden, condition: a.condition || null })),
    pointMilestones: state.achievementMilestones || [],
  });
});

// POST /api/player/:name/frame — equip a cosmetic frame
router.post('/api/player/:name/frame', requireAuth, (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.usersByName.get(uid);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { frameId } = req.body;
  if (!frameId) {
    u.equippedFrame = null;
    saveUsers();
    return res.json({ message: 'Frame removed', equippedFrame: null });
  }
  u.unlockedFrames = u.unlockedFrames || [];
  const frame = u.unlockedFrames.find(f => f.id === frameId);
  if (!frame) return res.status(400).json({ error: 'Frame not unlocked' });
  u.equippedFrame = { id: frame.id, name: frame.name, color: frame.color, glow: frame.glow || false };
  saveUsers();
  res.json({ message: `Frame "${frame.name}" equipped`, equippedFrame: u.equippedFrame });
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

// ─── Auth endpoints ─────────────────────────────────────────────────────────

// GET /api/auth/check — check token/key validity and admin status
router.get('/api/auth/check', (req, res) => {
  const auth = resolveAuth(req);
  if (!auth) {
    return res.json({ isAdmin: false, name: null, valid: false });
  }
  return res.json({ isAdmin: auth.isAdmin, name: auth.userName, userId: auth.userId, valid: true });
});

// POST /api/auth/login — validate name + password, return JWT tokens
router.post('/api/auth/login', authLimiter, async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ success: false, error: 'Name and password required' });

  const bcrypt = require('bcryptjs');
  const nameLower = name.toLowerCase();
  const user = state.usersByName.get(nameLower);

  if (!user) return res.json({ success: false, error: 'Invalid name or password' });

  // Support both new password login and legacy API-key-as-password login
  if (user.passwordHash) {
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.json({ success: false, error: 'Invalid name or password' });
  } else {
    // Legacy: user has no password yet, check if password matches apiKey
    if (password !== user.apiKey) return res.json({ success: false, error: 'Invalid name or password' });
  }

  const admin = isUserAdmin(user);
  // Tag admin status for token generation
  user._isAdmin = admin;

  const { accessToken, refreshToken } = generateTokenPair(user);
  setRefreshCookie(res, refreshToken);

  return res.json({
    success: true,
    accessToken,
    // Keep apiKey in response for backward compat (agents, Electron app)
    apiKey: user.apiKey,
    userId: user.id,
    name: user.name,
    isAdmin: admin,
  });
});

// POST /api/auth/refresh — exchange refresh token for new access token
router.post('/api/auth/refresh', (req, res) => {
  const token = getRefreshTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  const decoded = verifyRefreshToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  const user = state.users[decoded.sub];
  if (!user) return res.status(401).json({ error: 'User not found' });

  user._isAdmin = isUserAdmin(user);

  // Rotate: revoke old refresh token, issue new pair
  revokeRefreshToken(token);
  const { accessToken, refreshToken: newRefresh } = generateTokenPair(user);
  setRefreshCookie(res, newRefresh);

  return res.json({ accessToken, userId: user.id, name: user.name, isAdmin: user._isAdmin });
});

// POST /api/auth/logout — revoke refresh token
router.post('/api/auth/logout', (req, res) => {
  const token = getRefreshTokenFromRequest(req);
  if (token) revokeRefreshToken(token);
  clearRefreshCookie(res);
  return res.json({ success: true });
});

// POST /api/auth/set-password — migration: set password for existing user
router.post('/api/auth/set-password', async (req, res) => {
  const auth = resolveAuth(req);
  if (!auth || !auth.userId) return res.status(401).json({ error: 'Unauthorized' });

  const user = state.users[auth.userId];
  if (!user) return res.status(401).json({ error: 'User not found' });

  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const bcrypt = require('bcryptjs');
  user.passwordHash = await bcrypt.hash(password, 10);
  saveUsers();

  return res.json({ success: true, message: 'Password set' });
});

// POST /api/register — register a new player (returns JWT tokens)
router.post('/api/register', authLimiter, async (req, res) => {
  const { name, password, age, goals, pronouns, classId, companion, relationshipStatus, partnerName } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  if (!password) return res.status(400).json({ error: 'password is required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const trimmedName = String(name).trim();
  const nameLower = trimmedName.toLowerCase();
  // Check if name already taken
  const existing = state.usersByName.get(nameLower);
  if (existing) return res.status(409).json({ error: 'Name already taken' });
  // Generate API key (legacy compat) + hash password
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
    forgeTemp: 0,
    currencies: { ...DEFAULT_CURRENCIES },
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
  ensureUserCurrencies(state.users[finalId]);
  // Update user lookup indexes
  state.usersByName.set(trimmedName.toLowerCase(), state.users[finalId]);
  state.usersByApiKey.set(apiKey, state.users[finalId]);
  // Add to managed keys (legacy compat for agents)
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

  // Generate JWT tokens for the new user
  const newUser = state.users[finalId];
  newUser._isAdmin = false;
  const { accessToken, refreshToken } = generateTokenPair(newUser);
  setRefreshCookie(res, refreshToken);

  res.json({ name: trimmedName, accessToken, apiKey, userId: finalId });
});

module.exports = router;
