const router = require('express').Router();
const crypto = require('crypto');
const { state, XP_BY_PRIORITY, GOLD_BY_PRIORITY, TEMP_BY_PRIORITY, XP_BY_RARITY, GOLD_BY_RARITY, RUNENSPLITTER_BY_RARITY, STREAK_MILESTONES, RARITY_WEIGHTS, RARITY_COLORS, RARITY_ORDER, EQUIPMENT_SLOTS, LEVELS, PLAYER_QUEST_TYPES, saveQuests, saveUsers, savePlayerProgress, saveManagedKeys, rebuildQuestsById, ensureUserCurrencies } = require('../lib/state');
const { now, getLevelInfo, getPlayerProgress, getTodayBerlin, awardCurrency } = require('../lib/helpers');
const { requireApiKey, requireAuth, requireMasterKey, getMasterKey } = require('../lib/middleware');
const { assignRarity, selectDailyQuests } = require('../lib/rotation');
const { resolveQuest } = require('../lib/quest-templates');
const { POOL_TYPES, POOL_MIX } = require('./quests');
const { isWorldBossActive } = require('./world-boss');
const { isDungeonActiveForPlayer } = require('./dungeons');

// GET /api/config — expose game constants to frontend (no auth required)
router.get('/api/config', (req, res) => {
  res.json({
    xpByPriority:    XP_BY_PRIORITY,
    goldByPriority:  GOLD_BY_PRIORITY,
    tempByPriority:  TEMP_BY_PRIORITY,
    xpByRarity:      XP_BY_RARITY,
    goldByRarity:    GOLD_BY_RARITY,
    forgeTempPerQuest: 10,
    runensplitterByRarity: RUNENSPLITTER_BY_RARITY,
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
  const [agents, quests, users, achievements, campaigns, npcsData, weeklyChallenge, expedition] = await Promise.all([
    internalGet('/api/agents'),
    internalGet(`/api/quests${playerParam}`),
    internalGet('/api/users'),
    internalGet('/api/achievements'),
    internalGet('/api/campaigns'),
    internalGet(`/api/npcs/active${npcParam}`),
    playerLower ? internalGet(`/api/weekly-challenge${playerParam}`) : Promise.resolve(null),
    internalGet(`/api/expedition${playerParam}`),
  ]);

  // Player-specific lightweight data (direct state access — no complex logic)
  let rituals = [];
  let habits = [];
  let favorites = [];
  if (playerLower) {
    rituals = (state.rituals || []).filter(r => r.playerId === playerLower && !r.isAntiRitual);
    habits = state.habits.filter(h => h.playerId === playerLower);
    const u = state.users[playerLower];
    favorites = u?.favorites || [];
  }

  const activeNpcs = (npcsData && npcsData.npcs) || [];

  // Daily bonus status (lightweight — direct state access)
  let dailyBonusAvailable = false;
  if (playerLower) {
    const u = state.users[playerLower];
    if (u) {
      const today = new Date().toISOString().slice(0, 10);
      dailyBonusAvailable = u.dailyBonusLastClaim !== today;
    }
  }

  // Social summary (lightweight counts for badge indicators)
  let socialSummary = null;
  if (playerLower) {
    const sd = state.socialData;
    const pendingFriendRequests = sd.friendRequests.filter(r => r.to === playerLower && r.status === 'pending').length;
    const unreadMessages = sd.messages.filter(m => m.to === playerLower && !m.read).length;
    const activeTrades = sd.trades.filter(t =>
      (t.initiator === playerLower || t.recipient === playerLower) &&
      (t.status === 'pending_initiator' || t.status === 'pending_recipient')
    ).length;
    socialSummary = { pendingFriendRequests, unreadMessages, activeTrades };
  }

  // Daily missions — computed from existing player actions (no new storage needed)
  let dailyMissions = null;
  if (playerLower) {
    const u = state.users[playerLower];
    if (u) {
      const today = new Date().toISOString().slice(0, 10);
      const pp = state.playerProgress[playerLower] || {};
      // Count quests completed today
      const questsToday = Object.values(pp.completedQuests || {}).filter(cq => cq && cq.at && cq.at.startsWith(today)).length;
      // Check daily bonus claimed
      const dailyClaimed = u.dailyBonusLastClaim === today;
      // Check rituals completed today
      const ritualsToday = (state.rituals || []).filter(r => r.playerId === playerLower && r.lastCompleted === today).length;
      // Check companion petted today (petCountToday is only reset on next pet, so verify date)
      const petCount = (u.companion?.petDateStr === today) ? (u.companion.petCountToday ?? 0) : 0;
      // Check crafted today
      const craftedToday = u.lastCraftDate === today;
      // Build mission list with points
      const missions = [
        { id: 'login', label: 'Claim Daily Bonus', points: 100, done: dailyClaimed },
        { id: 'quest1', label: 'Complete 1 Quest', points: 150, done: questsToday >= 1 },
        { id: 'quest3', label: 'Complete 3 Quests', points: 250, done: questsToday >= 3 },
        { id: 'ritual', label: 'Complete a Ritual', points: 100, done: ritualsToday >= 1 },
        { id: 'pet', label: 'Pet your Companion', points: 50, done: petCount >= 1 },
        { id: 'craft', label: 'Craft an Item', points: 100, done: craftedToday },
      ];
      const earned = missions.filter(m => m.done).reduce((sum, m) => sum + m.points, 0);
      const milestones = [
        { threshold: 100, reward: { gold: 25 }, claimed: (u.dailyMilestonesClaimed || {})[today]?.includes(100) },
        { threshold: 300, reward: { gold: 50, essenz: 3 }, claimed: (u.dailyMilestonesClaimed || {})[today]?.includes(300) },
        { threshold: 500, reward: { gold: 100, runensplitter: 2 }, claimed: (u.dailyMilestonesClaimed || {})[today]?.includes(500) },
        { threshold: 750, reward: { gold: 150, sternentaler: 1 }, claimed: (u.dailyMilestonesClaimed || {})[today]?.includes(750) },
      ];
      dailyMissions = { missions, earned, total: 750, milestones };
    }
  }

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
    dailyBonusAvailable,
    weeklyChallenge: weeklyChallenge?.challenge || null,
    expedition: expedition?.expedition || null,
    socialSummary,
    dailyMissions,
    // Lightweight active-content status for Today drawer (uses in-memory state, no FS I/O)
    worldBossActive: isWorldBossActive(),
    riftActive: (() => {
      if (!playerLower) return false;
      const u = state.users[playerLower];
      return !!(u?.activeRift && !u.activeRift.completed && !u.activeRift.failed && new Date(u.activeRift.expiresAt) > new Date());
    })(),
    dungeonActive: isDungeonActiveForPlayer(playerLower),
    apiLive: true,
  });
});

// POST /api/daily-missions/claim — claim a milestone reward
router.post('/api/daily-missions/claim', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { threshold } = req.body;
  const validThresholds = [100, 300, 500, 750];
  if (!validThresholds.includes(threshold)) return res.status(400).json({ error: 'Invalid threshold' });

  const today = new Date().toISOString().slice(0, 10);
  u.dailyMilestonesClaimed = u.dailyMilestonesClaimed || {};
  u.dailyMilestonesClaimed[today] = u.dailyMilestonesClaimed[today] || [];
  if (u.dailyMilestonesClaimed[today].includes(threshold)) {
    return res.status(409).json({ error: 'Milestone already claimed' });
  }

  // Verify earned points meet threshold
  const pp = state.playerProgress[uid] || {};
  const questsToday = Object.values(pp.completedQuests || {}).filter(cq => cq && cq.at && cq.at.startsWith(today)).length;
  const dailyClaimed = u.dailyBonusLastClaim === today;
  const ritualsToday = (state.rituals || []).filter(r => r.playerId === uid && r.lastCompleted === today).length;
  const petCount = (u.companion?.petDateStr === today) ? (u.companion.petCountToday ?? 0) : 0;
  const craftedToday = u.lastCraftDate === today;
  const missions = [
    { points: 100, done: dailyClaimed },
    { points: 150, done: questsToday >= 1 },
    { points: 250, done: questsToday >= 3 },
    { points: 100, done: ritualsToday >= 1 },
    { points: 50, done: petCount >= 1 },
    { points: 100, done: craftedToday },
  ];
  const earned = missions.filter(m => m.done).reduce((sum, m) => sum + m.points, 0);
  if (earned < threshold) return res.status(400).json({ error: 'Not enough activity points' });

  // Award reward
  const rewards = { 100: { gold: 25 }, 300: { gold: 50, essenz: 3 }, 500: { gold: 100, runensplitter: 2 }, 750: { gold: 150, sternentaler: 1 } };
  const reward = rewards[threshold] || {};
  ensureUserCurrencies(u);
  for (const [currency, amount] of Object.entries(reward)) {
    awardCurrency(uid, currency, amount);
  }
  u.dailyMilestonesClaimed[today].push(threshold);

  // Prune old daily milestone claims (keep last 7 days)
  const dates = Object.keys(u.dailyMilestonesClaimed).sort();
  while (dates.length > 7) {
    delete u.dailyMilestonesClaimed[dates.shift()];
  }

  // Battle Pass XP
  try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'daily_mission_milestone', { points: threshold }); } catch {}

  saveUsers();
  res.json({ success: true, reward, earned });
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

// ─── Leaderboard Seasons (TODO: integrate into Season rework) ─────────────────
// Monthly competitive seasons with bracket-based rankings.
// Each season runs for one calendar month. At month end, top players earn
// exclusive titles, currency caches, and cosmetic frames.
//
// Brackets: Lvl 1-10 (Bronze), 11-20 (Silver), 21-30 (Gold)
// Rewards: Top 1 = "Season Champion" title + 1000 stardust + gold frame
//          Top 3 = "Season Veteran" title + 500 stardust + silver frame
//          Top 5 = "Season Contender" title + 250 stardust + bronze frame
//
// Data model:
//   state.seasonLeaderboard = {
//     currentSeason: "2026-03",       // YYYY-MM
//     seasonName: "Frühlingssturm",   // thematic name
//     startedAt: ISO,
//     brackets: {
//       bronze: [{ userId, xpEarned, questsCompleted, rank }],
//       silver: [...],
//       gold: [...]
//     },
//     archive: {
//       "2026-02": { brackets, winners: [...] }
//     }
//   }
//
// Endpoints:
// router.get('/api/season/leaderboard', (req, res) => {
//   const sl = state.seasonLeaderboard || {};
//   const currentSeason = sl.currentSeason || new Date().toISOString().slice(0, 7);
//   const agentIds = new Set(Object.keys(state.store.agents));
//   const players = Object.values(state.users).filter(u => !agentIds.has(u.id));
//
//   const brackets = { bronze: [], silver: [], gold: [] };
//   for (const u of players) {
//     const { level } = getLevelInfo(u.xp || 0);
//     const bracket = level <= 10 ? 'bronze' : level <= 20 ? 'silver' : 'gold';
//     const seasonXp = u.seasonXp?.[currentSeason] || 0;
//     const seasonQuests = u.seasonQuests?.[currentSeason] || 0;
//     brackets[bracket].push({
//       userId: u.id, name: u.name, avatar: u.avatar, level,
//       xpEarned: seasonXp, questsCompleted: seasonQuests,
//     });
//   }
//   for (const b of Object.keys(brackets)) {
//     brackets[b].sort((a, b) => b.xpEarned - a.xpEarned || b.questsCompleted - a.questsCompleted);
//     brackets[b] = brackets[b].map((p, i) => ({ ...p, rank: i + 1 }));
//   }
//   res.json({ currentSeason, seasonName: sl.seasonName || 'Season', brackets, archive: sl.archive || {} });
// });
//
// router.post('/api/season/end', requireAuth, (req, res) => {
//   // Admin-only: archive current season, distribute rewards, reset
//   // Award titles: season_champion_YYYY_MM, season_veteran_..., season_contender_...
//   // Award stardust caches and cosmetic frames
//   // Reset seasonXp / seasonQuests on all users
// });
//
// In onQuestCompletedByUser: track per-season XP
//   u.seasonXp = u.seasonXp || {};
//   u.seasonXp[currentSeason] = (u.seasonXp[currentSeason] || 0) + xpEarned;
//   u.seasonQuests = u.seasonQuests || {};
//   u.seasonQuests[currentSeason] = (u.seasonQuests[currentSeason] || 0) + 1;

// ─── Quest Pool System ─────────────────────────────────────────────────────────
// Per-player quest pool. Refresh generates 18 NEW quests from templates (per player),
// then picks ~10 for the visible "Open" tab.

// POOL_TYPES and POOL_MIX imported from routes/quests.js (single source of truth)

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
    // Fisher-Yates shuffle (unbiased)
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
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
router.get('/api/quests/pool', requireApiKey, (req, res) => {
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
router.get('/api/quests/reset-recurring', requireApiKey, (req, res) => {
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
