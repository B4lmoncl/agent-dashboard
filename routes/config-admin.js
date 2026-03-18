const router = require('express').Router();
const crypto = require('crypto');
const { state, XP_BY_PRIORITY, GOLD_BY_PRIORITY, TEMP_BY_PRIORITY, STREAK_MILESTONES, RARITY_WEIGHTS, RARITY_COLORS, RARITY_ORDER, EQUIPMENT_SLOTS, LEVELS, PLAYER_QUEST_TYPES, saveQuests, savePlayerProgress, saveManagedKeys, rebuildQuestsById } = require('../lib/state');
const { now, getLevelInfo, getPlayerProgress, awardXP, getTodayBerlin } = require('../lib/helpers');
const { requireApiKey, requireMasterKey, getMasterKey } = require('../lib/middleware');
const { assignRarity, selectDailyQuests } = require('../lib/rotation');
const { resolveQuest } = require('../lib/quest-templates');

// GET /api/config — expose game constants to frontend (no auth required)
router.get('/api/config', (req, res) => {
  res.json({
    xpByPriority:    XP_BY_PRIORITY,
    goldByPriority:  GOLD_BY_PRIORITY,
    tempByPriority:  TEMP_BY_PRIORITY,
    streakMilestones: STREAK_MILESTONES,
    rarityWeights:   RARITY_WEIGHTS,
    rarityColors:    RARITY_COLORS,
    rarityOrder:     RARITY_ORDER,
    equipmentSlots:  EQUIPMENT_SLOTS,
    levels:          LEVELS,
    playerQuestTypes: PLAYER_QUEST_TYPES,
  });
});

// GET /api/leaderboard — returns combined leaderboard
// mode=agents: agents only; mode=players: registered users only (default: agents for backward compat)
// GET /api/dashboard?player=X — batch endpoint: returns agents, quests, users,
// leaderboard, achievements, campaigns, rituals, habits, npcs, favorites in one call.
// Reduces 14 separate API calls to 1.
router.get('/api/dashboard', async (req, res) => {
  // Internally fetch from the real endpoints to reuse their full filtering logic.
  // This avoids duplicating the complex player-specific quest overlay.
  const http = require('http');
  const baseUrl = `http://127.0.0.1:${process.env.PORT || 3001}`;
  const playerName = req.query.player || null;
  const playerParam = playerName ? `?player=${encodeURIComponent(playerName)}` : '';
  const playerLower = playerName ? playerName.toLowerCase() : null;

  // Forward auth headers so internal requests pass middleware
  const headers = {};
  if (req.headers['x-api-key']) headers['x-api-key'] = req.headers['x-api-key'];
  if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];
  if (req.headers['cookie']) headers['cookie'] = req.headers['cookie'];

  function internalGet(path) {
    return new Promise((resolve) => {
      const url = `${baseUrl}${path}`;
      http.get(url, { headers, timeout: 3000 }, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });
  }

  // Parallel internal fetches — reuses full route logic including player filtering
  const npcParam = playerLower ? `?player=${encodeURIComponent(playerLower)}` : '';
  const [agents, quests, users, achievements, campaigns, npcsData] = await Promise.all([
    internalGet('/api/agents'),
    internalGet(`/api/quests${playerParam}`),
    internalGet('/api/users'),
    internalGet('/api/achievements'),
    internalGet('/api/campaigns'),
    internalGet(`/api/npcs/active${npcParam}`),
  ]);

  // Player-specific lightweight data (direct state access — no complex logic)
  let rituals = [];
  let habits = [];
  let favorites = [];
  if (playerLower) {
    rituals = (state.rituals?.active || []).filter(r => r.playerId === playerLower && !r.isAntiRitual);
    habits = state.habits.filter(h => h.playerId === playerLower);
    const u = state.users[playerLower];
    favorites = u?.favorites || [];
  }

  const activeNpcs = (npcsData && npcsData.npcs) || [];

  res.json({
    agents: agents || [],
    quests: quests || { open: [], inProgress: [], completed: [], suggested: [], rejected: [] },
    users: users || [],
    achievements: achievements || [],
    campaigns: campaigns || [],
    rituals,
    habits,
    favorites,
    activeNpcs,
    apiLive: true,
  });
});

router.get('/api/leaderboard', (req, res) => {
  const agentIds = new Set(Object.keys(state.store.agents));

  // Build agents-only ranked list
  const agentsRanked = Object.values(state.store.agents)
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
  const playersRanked = Object.values(state.users)
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
// Per-player quest pool. Refresh generates 18 NEW quests from templates (per player),
// then picks ~10 for the visible "Open" tab.

const POOL_TYPES = ['personal', 'fitness', 'social', 'learning', 'boss'];
const POOL_MIX = { personal: 3, fitness: 3, social: 2, learning: 2, boss: 1 }; // visible pool target

function buildVisiblePool(playerName, playerLevel) {
  const uid = playerName.toLowerCase();
  const pp = getPlayerProgress(uid);
  const userRecord = state.users[uid];
  // Exclude quests already claimed (in progress)
  const claimedIds = new Set((userRecord?.openQuests || []).map(q => typeof q === 'string' ? q : q.id));
  const pool = [];

  // Pick from this player's generated quest pool (pp.generatedQuests)
  const generated = (pp.generatedQuests || [])
    .map(id => state.questsById.get(id))
    .filter(q => q && q.status === 'open' && !claimedIds.has(q.id) && (!q.minLevel || q.minLevel <= playerLevel));

  for (const type of POOL_TYPES) {
    const target = POOL_MIX[type] || 1;
    const candidates = generated.filter(q => q.type === type);
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(target, shuffled.length); i++) {
      pool.push(shuffled[i].id);
    }
  }
  return pool.slice(0, 11);
}

// Generate 18 fresh quests from templates for a specific player
function generatePlayerQuests(playerName, playerLevel) {
  const uid = playerName.toLowerCase();
  const pp = getPlayerProgress(uid);
  const userRecord = state.users[uid];
  const todayStr = getTodayBerlin();

  // Collect IDs to exclude: claimed + completed today + current generated pool
  const claimedIds = new Set((userRecord?.openQuests || []).map(q => typeof q === 'string' ? q : q.id));
  const completedTodayIds = new Set();
  for (const [qid, info] of Object.entries(pp.completedQuests || {})) {
    const doneAt = info?.completedAt || info;
    if (typeof doneAt === 'string' && doneAt.startsWith(todayStr)) {
      completedTodayIds.add(qid);
    }
  }
  // Also exclude templateIds of claimed + completed-today quests
  const excludeTemplateIds = new Set();
  for (const q of state.quests) {
    if (claimedIds.has(q.id) || completedTodayIds.has(q.id)) {
      if (q.templateId) excludeTemplateIds.add(q.templateId);
    }
  }
  // Also exclude templateIds of current generated pool (if any still open)
  for (const qid of (pp.generatedQuests || [])) {
    const q = state.questsById.get(qid);
    if (q && q.templateId) excludeTemplateIds.add(q.templateId);
  }

  const catalog = state.questCatalog.templates || [];
  const templates = catalog.filter(t =>
    t.category !== 'companion' && t.createdBy !== 'companion' && !excludeTemplateIds.has(t.id) &&
    (t.minLevel || 1) <= playerLevel
  );

  if (templates.length === 0) {
    console.warn(`[Quest Pool] No available templates for ${uid} (${excludeTemplateIds.size} excluded)`);
    return [];
  }

  const daySeed = Date.now() + uid.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const dailyTemplates = selectDailyQuests(templates, {
    count: 18,
    typeDistribution: { personal: 5, fitness: 4, learning: 4, social: 3, boss: 2 },
    previousIds: pp.previousTemplateIds || [],
    daySeed,
  });

  const priorityMap = { starter: 'low', intermediate: 'medium', advanced: 'high', expert: 'high' };
  const REWARDS_BY_RARITY = {
    common:    { xp: 10, gold: 8  },
    uncommon:  { xp: 18, gold: 14 },
    rare:      { xp: 30, gold: 24 },
    epic:      { xp: 50, gold: 40 },
    legendary: { xp: 80, gold: 65 },
  };
  const newQuests = dailyTemplates.map((t, i) => {
    const resolved = resolveQuest(t);
    const rarity = assignRarity(t);
    return {
      id: `quest-${uid}-${Date.now()}-${String(i + 1).padStart(3, '0')}`,
      title: resolved.title || t.title,
      description: resolved.description || t.description,
      priority: priorityMap[t.difficulty] || t.priority || 'medium',
      type: resolved.type || t.type || 'personal',
      categories: t.category ? [t.category] : [],
      product: null, humanInputRequired: false,
      createdBy: 'system', status: 'open',
      createdAt: new Date().toISOString(),
      claimedBy: null, completedBy: null, completedAt: null,
      parentQuestId: null, recurrence: t.recurrence || null,
      streak: 0, lastCompletedAt: null,
      proof: null, checklist: null, nextQuestTemplate: null,
      coopPartners: null, coopClaimed: [], coopCompletions: [],
      skills: t.tags || [], lore: resolved.lore || t.lore || null,
      chapter: t.chainId || null, minLevel: t.minLevel || 1,
      classRequired: t.classId || null,
      requiresRelationship: t.requiresRelationship || false,
      rarity,
      difficulty: (t.vars && t.vars.difficulty) || t.difficulty || 'starter',
      flavorText: resolved.flavorText || null,
      rewards: REWARDS_BY_RARITY[rarity] || resolved.rewards || { xp: 20, gold: 10 },
      templateId: t.id,
    };
  });

  // Remove old generated quests that are still 'open' (not claimed)
  const oldGenIds = new Set(pp.generatedQuests || []);
  state.quests = state.quests.filter(q => !oldGenIds.has(q.id) || q.status !== 'open');
  rebuildQuestsById();

  // Add new quests
  state.quests.push(...newQuests);
  for (const q of newQuests) state.questsById.set(q.id, q);
  saveQuests();

  // Track generated IDs and previous template IDs
  pp.generatedQuests = newQuests.map(q => q.id);
  pp.previousTemplateIds = dailyTemplates.map(t => t.id);

  console.log(`[Quest Pool] Generated ${newQuests.length} quests for ${uid} (${excludeTemplateIds.size} templates excluded)`);
  return newQuests.map(q => q.id);
}

// GET /api/quests/pool?player=X — get or initialize the quest pool
router.get('/api/quests/pool', (req, res) => {
  const playerParam = req.query.player ? String(req.query.player).toLowerCase() : null;
  if (!playerParam) return res.status(400).json({ error: 'player parameter required' });
  const userRecord = state.users[playerParam];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(playerParam);
  const playerLevel = getLevelInfo(userRecord.xp || 0).level;

  // Auto-generate if player has no generated quests yet
  if (!pp.generatedQuests || pp.generatedQuests.length === 0) {
    pp.generatedQuests = generatePlayerQuests(playerParam, playerLevel);
  }

  // Build/rebuild visible pool if empty or stale
  if (!pp.activeQuestPool || pp.activeQuestPool.length === 0) {
    pp.activeQuestPool = buildVisiblePool(playerParam, playerLevel);
    savePlayerProgress();
  } else {
    // Remove completed/claimed quests from visible pool
    const validIds = new Set(state.quests.filter(q => q.status === 'open').map(q => q.id));
    pp.activeQuestPool = pp.activeQuestPool.filter(id => validIds.has(id));
    if (pp.activeQuestPool.length < 3) {
      pp.activeQuestPool = buildVisiblePool(playerParam, playerLevel);
      savePlayerProgress();
    }
  }

  const poolQuests = pp.activeQuestPool
    .map(id => state.questsById.get(id))
    .filter(Boolean);

  res.json({ pool: poolQuests, lastRefresh: pp.lastPoolRefresh || null });
});

// POST /api/quests/pool/refresh?player=X — full pool refresh (6h cooldown)
// Generates 18 NEW quests from templates (per player), replaces old open ones
router.post('/api/quests/pool/refresh', requireApiKey, (req, res) => {
  const playerParam = req.query.player ? String(req.query.player).toLowerCase() : null;
  if (!playerParam) return res.status(400).json({ error: 'player parameter required' });
  const userRecord = state.users[playerParam];
  if (!userRecord) return res.status(404).json({ error: 'Player not found' });
  const pp = getPlayerProgress(playerParam);
  const playerLevel = getLevelInfo(userRecord.xp || 0).level;

  // Cooldown check: 6 hours
  const COOLDOWN_MS = 6 * 3600 * 1000;
  const nowMs = Date.now();
  if (pp.lastPoolRefresh) {
    const elapsed = nowMs - new Date(pp.lastPoolRefresh).getTime();
    if (elapsed < COOLDOWN_MS) {
      const waitH = Math.floor((COOLDOWN_MS - elapsed) / 3600000);
      const waitMin = Math.ceil(((COOLDOWN_MS - elapsed) % 3600000) / 60000);
      return res.status(429).json({ error: `Pool refresh cooldown. Try again in ${waitH}h ${waitMin}min.` });
    }
  }

  // Generate 18 new quests from templates (old open ones get removed)
  pp.generatedQuests = generatePlayerQuests(playerParam, playerLevel);
  pp.activeQuestPool = buildVisiblePool(playerParam, playerLevel);
  pp.lastPoolRefresh = new Date().toISOString();
  savePlayerProgress();

  const poolQuests = pp.activeQuestPool
    .map(id => state.questsById.get(id))
    .filter(Boolean);

  res.json({ ok: true, pool: poolQuests, generated: pp.generatedQuests.length, lastRefresh: pp.lastPoolRefresh });
});

// GET /api/quests/reset-recurring — reset completed recurring quests based on interval
router.get('/api/quests/reset-recurring', (req, res) => {
  const nowMs = Date.now();
  const INTERVAL_MS = { daily: 24*3600*1000, weekly: 7*24*3600*1000, monthly: 30*24*3600*1000 };
  let resetCount = 0;
  for (const q of state.quests) {
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
router.get('/api/admin/keys', requireMasterKey, (req, res) => {
  const master = getMasterKey();
  const allKeys = [
    { key: master, label: 'Master Key', created: null, isMaster: true },
    ...state.managedKeys.map(k => ({ ...k, isMaster: false })),
  ];
  res.json(allKeys.map(k => ({ ...k, masked: k.key.slice(0, 4) + '****' + k.key.slice(-4) })));
});

// POST /api/admin/keys
router.post('/api/admin/keys', requireMasterKey, (req, res) => {
  const { label } = req.body;
  const newKey = crypto.randomBytes(16).toString('hex');
  const entry = { key: newKey, label: label || `Key ${state.managedKeys.length + 1}`, created: now() };
  state.managedKeys.push(entry);
  state.validApiKeys.add(newKey);
  saveManagedKeys();
  console.log(`[admin] new key created: ${entry.label}`);
  res.json({ ok: true, key: newKey, masked: newKey.slice(0, 4) + '****' + newKey.slice(-4), label: entry.label });
});

// DELETE /api/admin/keys/:key
router.delete('/api/admin/keys/:key', requireMasterKey, (req, res) => {
  const keyParam = req.params.key;
  if (keyParam === getMasterKey()) {
    return res.status(400).json({ error: 'Cannot revoke master key' });
  }
  const before = state.managedKeys.length;
  state.managedKeys = state.managedKeys.filter(k => k.key !== keyParam);
  if (state.managedKeys.length < before) {
    state.validApiKeys.delete(keyParam);
    saveManagedKeys();
    console.log(`[admin] key revoked`);
    return res.json({ ok: true });
  }
  res.status(404).json({ error: 'Key not found' });
});

module.exports = router;
