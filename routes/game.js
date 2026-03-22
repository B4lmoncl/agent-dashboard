// ─── Game API (Classes, Roadmap, Rituals) ───────────────────────────────────
const router = require('express').Router();
const {
  state, STREAK_MILESTONES, RARITY_COLORS,
  saveClasses, saveRoadmap, saveRituals, saveUsers, ensureUserCurrencies,
} = require('../lib/state');
const {
  now, todayStr, getStreakXpBonus, getLevelInfo,
  getXpMultiplier, getGoldMultiplier, getUserGear, getQuestHoardingMalus,
  hasPassiveEffect, consumePassiveEffect, awardUserGold,
  getUserDropBonus, rollLoot, addLootToInventory, resetLootPity,
  checkAndAwardAchievements, checkAndAwardTitles, getLegendaryModifiers,
} = require('../lib/helpers');
const { requireApiKey, requireMasterKey } = require('../lib/middleware');

// ─── Classes API ────────────────────────────────────────────────────────────

// GET /api/classes — all active classes
router.get('/api/classes', (req, res) => {
  res.json(state.classesData.classes.filter(c => c.status === 'active'));
});

// GET /api/classes/pending — pending classes [admin]
router.get('/api/classes/pending', requireMasterKey, (req, res) => {
  res.json(state.classesData.classes.filter(c => c.status === 'pending'));
});

// GET /api/classes/:id — single class with skill tree + quests
router.get('/api/classes/:id', (req, res) => {
  const cls = state.classesData.classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const classQuests = state.quests.filter(q => q.skills && q.skills.includes(cls.id));
  res.json({ ...cls, quests: classQuests });
});

// POST /api/classes — submit new class (status: pending) [auth]
router.post('/api/classes', requireApiKey, (req, res) => {
  const { name, icon, fantasy, description, realWorld, tiers, skillTree, achievements, createdBy } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const cls = {
    id: `class-${Date.now()}`,
    name,
    icon: icon || null,
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
  state.classesData.classes.push(cls);
  saveClasses();
  res.json({ ok: true, class: cls });
});

// PATCH /api/classes/:id — update class [admin]
router.patch('/api/classes/:id', requireMasterKey, (req, res) => {
  const cls = state.classesData.classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const allowed = ['name', 'icon', 'fantasy', 'description', 'realWorld', 'tiers', 'skillTree', 'achievements', 'status', 'playerCount'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) cls[key] = req.body[key];
  }
  saveClasses();
  res.json({ ok: true, class: cls });
});

// ─── Roadmap API ────────────────────────────────────────────────────────────

// GET /api/roadmap — all items
router.get('/api/roadmap', (req, res) => {
  res.json(state.roadmapData);
});

// POST /api/roadmap — add item [admin]
router.post('/api/roadmap', requireMasterKey, (req, res) => {
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
  state.roadmapData.push(item);
  saveRoadmap();
  res.json({ ok: true, item });
});

// PATCH /api/roadmap/:id — update item [admin]
router.patch('/api/roadmap/:id', requireMasterKey, (req, res) => {
  const item = state.roadmapData.find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Roadmap item not found' });
  const allowed = ['title', 'desc', 'status', 'eta', 'category'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  }
  saveRoadmap();
  res.json({ ok: true, item });
});

// ─── Rituals API ────────────────────────────────────────────────────────────

// GET /api/rituals?player=X
router.get('/api/rituals', (req, res) => {
  const { player } = req.query;
  if (player) {
    return res.json(state.rituals.filter(r => r.playerId === player.toLowerCase()));
  }
  res.json(state.rituals);
});

// POST /api/rituals — create ritual [auth]
router.post('/api/rituals', requireApiKey, (req, res) => {
  const { title, description, schedule, difficulty, rewards, playerId, createdBy, isAntiRitual, category, commitment, commitmentDays, bloodPact } = req.body;
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
    status: 'active',
    ...(commitment ? { commitment } : {}),
    ...(commitmentDays ? { commitmentDays } : {}),
    ...(bloodPact ? { bloodPact: true } : {}),
    ...(isAntiRitual ? { isAntiRitual: true, category, cleanDays: 0, lastViolated: null } : {}),
  };
  state.rituals.push(ritual);
  saveRituals();
  res.json({ ok: true, ritual });
});

// POST /api/rituals/:id/recommit — rise again after broken streak [auth]
router.post('/api/rituals/:id/recommit', requireApiKey, (req, res) => {
  const { playerId } = req.body;
  const ritual = state.rituals.find(r => r.id === req.params.id);
  if (!ritual) return res.status(404).json({ error: 'Ritual not found' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  if (ritual.status !== 'broken') return res.status(400).json({ error: 'Ritual is not broken' });

  // Reset to active with streak 0
  ritual.status = 'active';
  ritual.streak = 0;
  if (ritual.isAntiRitual) ritual.cleanDays = 0;
  ritual.lastCompleted = null;
  ritual.missedDays = 0;

  saveRituals();
  res.json({ ok: true, ritual });
});

// POST /api/rituals/:id/complete — mark done today [auth]
router.post('/api/rituals/:id/complete', requireApiKey, (req, res) => {
  const { playerId } = req.body;
  const ritual = state.rituals.find(r => r.id === req.params.id);
  if (!ritual) return res.status(404).json({ error: 'Ritual not found' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });

  // Block completions on broken rituals — must recommit first
  if (ritual.status === 'broken') return res.status(400).json({ error: 'Ritual is broken. Recommit first.' });

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
      ritual.status = 'broken';
      saveRituals();
      return res.json({ ok: false, broken: true, ritual, message: 'Streak lost — ritual is now broken. Recommit to continue.' });
    }
  }
  ritual.lastCompleted = today;
  ritual.missedDays = 0;

  // Track longest streak and completion history
  if (!ritual.longestStreak || ritual.streak > ritual.longestStreak) {
    ritual.longestStreak = ritual.streak;
  }
  if (!ritual.completedDates) ritual.completedDates = [];
  if (!ritual.completedDates.includes(today)) {
    ritual.completedDates.push(today);
    // Keep only last 90 days to avoid bloat
    if (ritual.completedDates.length > 90) {
      ritual.completedDates = ritual.completedDates.slice(-90);
    }
  }

  // Award XP/gold to player
  const uid = playerId.toLowerCase();
  const u = state.users[uid];
  let newAchievements = [];
  let lootDrop = null;
  let milestoneDrop = null;
  let pactCompletionXp = 0;
  let pactCompletionGold = 0;
  let xpAmount = 0;
  let goldEarnedAmount = 0;

  if (u) {
    // ─── Commitment & difficulty bonus calculation ───
    // Daily: base + bond bonus (no pact multiplier). Pact bonus pays out at commitment completion.
    const COMMITMENT_BONUSES = { none: { gold: 0, xp: 0 }, spark: { gold: 3, xp: 5 }, flame: { gold: 7, xp: 10 }, ember: { gold: 13, xp: 20 }, crucible: { gold: 20, xp: 35 }, eternity: { gold: 30, xp: 50 } };
    const DIFFICULTY_BOND_SCALE = { easy: 0.5, medium: 1.0, hard: 1.5, legendary: 2.0 };
    const BLOOD_PACT_MULTI = { none: 1, spark: 3, flame: 3, ember: 7, crucible: 16, eternity: 30 };
    const commitBonus = COMMITMENT_BONUSES[ritual.commitment] || { gold: 0, xp: 0 };
    const diffScale = DIFFICULTY_BOND_SCALE[ritual.difficulty] || 1.0;
    const commitXp = Math.round(commitBonus.xp * diffScale);
    const commitGold = Math.round(commitBonus.gold * diffScale);

    // Apply full multiplier chain (same as quest completion)
    const xpBase = (ritual.rewards.xp || 15) + commitXp;
    const streakBonus = getStreakXpBonus(ritual.streak);
    const xpMulti = getXpMultiplier(uid);
    const gear = getUserGear(uid);
    const gearBonus = 1 + (gear.xpBonus || 0) / 100;
    const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
    const earnedIds = new Set((u.earnedAchievements || []).map(a => a.id));
    const companionBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
    const bondBonus = 1 + 0.01 * Math.max(0, (u.companion?.bondLevel ?? 1) - 1);
    const hoardingMalus = getQuestHoardingMalus(uid).multiplier;
    let passiveXpBonus = 1;
    if (hasPassiveEffect(uid, 'xp_boost_10')) passiveXpBonus += 0.10;
    if (hasPassiveEffect(uid, 'xp_boost_5')) passiveXpBonus += 0.05;
    xpAmount = Math.round(xpBase * (1 + streakBonus) * xpMulti * gearBonus * companionBonus * bondBonus * hoardingMalus * passiveXpBonus);

    // Legendary effect: ritualStreakBonus — extra XP scaled by streak days
    const ritualMods = getLegendaryModifiers(uid);
    const streakBonusXp = Math.round(xpBase * (u.streakDays || 0) * (ritualMods.ritualStreakBonus || 0));
    xpAmount += streakBonusXp;

    u.xp = (u.xp || 0) + xpAmount;

    // Gold with full multiplier chain
    const goldBase = (ritual.rewards.gold || 5) + commitGold;
    const goldMulti = getGoldMultiplier(uid);
    const streakGoldMulti = Math.min(1 + (u.streakDays || 0) * 0.015, 1.45);
    goldEarnedAmount = Math.round(goldBase * goldMulti * streakGoldMulti);
    if (consumePassiveEffect(uid, 'gold_boost_next')) goldEarnedAmount *= 2;
    u.gold = (u.gold || 0) + goldEarnedAmount;
    ensureUserCurrencies(u);
    u.currencies.gold = u.gold;

    // ─── Blood Pact completion bonus (one-time at end of commitment) ───
    if (ritual.bloodPact && ritual.commitmentDays && ritual.streak >= ritual.commitmentDays && !ritual.pactCompleted) {
      const pactMulti = BLOOD_PACT_MULTI[ritual.commitment] || 3;
      pactCompletionXp = Math.round(commitBonus.xp * diffScale * pactMulti);
      pactCompletionGold = Math.round(commitBonus.gold * diffScale * pactMulti);
      u.xp = (u.xp || 0) + pactCompletionXp;
      u.gold = (u.gold || 0) + pactCompletionGold;
      u.currencies.gold = u.gold;
      ritual.pactCompleted = true;
    }

    // Milestone check
    const prevStreak = ritual.streak - 1;
    for (const m of STREAK_MILESTONES) {
      if (ritual.streak === m.days && prevStreak < m.days) {
        if (m.lootTier) {
          const pool = state.lootTables[m.lootTier] || [];
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

    // Battle Pass XP
    try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'ritual_complete'); } catch {}
    if (ritual.isAntiRitual) {
      try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'vow_clean_day'); } catch {}
    }
  }
  saveRituals();

  const xpEarned = pactCompletionXp > 0 ? xpAmount + pactCompletionXp : xpAmount;
  const goldEarned = pactCompletionGold > 0 ? goldEarnedAmount + pactCompletionGold : goldEarnedAmount;
  res.json({ ok: true, ritual, newAchievements, lootDrop, milestoneDrop, xpEarned, goldEarned, ...(pactCompletionXp > 0 ? { pactCompletion: { xp: pactCompletionXp, gold: pactCompletionGold } } : {}) });
});

// PATCH /api/rituals/:id/extend — extend ritual/vow deadline [auth]
router.patch('/api/rituals/:id/extend', requireApiKey, (req, res) => {
  const { newCommitment, newCommitmentDays } = req.body;
  const ritual = state.rituals.find(r => r.id === req.params.id);
  if (!ritual) return res.status(404).json({ error: 'Ritual not found' });

  // Blood Oaths cannot be extended (they are permanent)
  if (ritual.bloodPact) {
    return res.status(403).json({ error: 'Blood Oaths are permanent and cannot be extended' });
  }

  // New commitment must be longer than current
  if (!newCommitmentDays || newCommitmentDays <= (ritual.commitmentDays || 0)) {
    return res.status(400).json({ error: 'New commitment must be longer than current commitment' });
  }

  ritual.commitment = newCommitment || ritual.commitment;
  ritual.commitmentDays = newCommitmentDays;

  saveRituals();
  res.json({ ok: true, ritual });
});

// POST /api/rituals/:id/violate — mark vow as violated / slipped [auth]
router.post('/api/rituals/:id/violate', requireApiKey, (req, res) => {
  const { playerId } = req.body;
  const ritual = state.rituals.find(r => r.id === req.params.id);
  if (!ritual) return res.status(404).json({ error: 'Ritual not found' });
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });

  // Track longest streak before resetting
  if (!ritual.longestStreak || ritual.streak > ritual.longestStreak) {
    ritual.longestStreak = ritual.streak;
  }

  // Reset streak to 0 and mark as broken
  ritual.streak = 0;
  if (ritual.isAntiRitual) {
    ritual.cleanDays = 0;
  }
  ritual.status = 'broken';
  ritual.lastViolated = todayStr();
  ritual.missedDays = (ritual.missedDays || 0) + 1;

  saveRituals();
  res.json({ ok: true, ritual });
});

// DELETE /api/rituals/:id [auth]
router.delete('/api/rituals/:id', requireApiKey, (req, res) => {
  const idx = state.rituals.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Ritual not found' });
  state.rituals.splice(idx, 1);
  saveRituals();
  res.json({ ok: true });
});

// ─── Titles ─────────────────────────────────────────────────────────────────
const { requireAuth, requireSelf } = require('../lib/middleware');

// GET /api/titles — all title definitions
router.get('/api/titles', (req, res) => {
  res.json(state.titleDefinitions || []);
});

// GET /api/player/:name/titles — player's earned titles + equipped title
router.get('/api/player/:name/titles', (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const newTitles = checkAndAwardTitles(uid);
  if (newTitles.length > 0) saveUsers();
  const defs = state.titleDefinitions || [];
  const earned = (u.earnedTitles || []).map(t => {
    const def = defs.find(d => d.id === t.id);
    return def ? { ...def, earnedAt: t.earnedAt } : { id: t.id, name: t.id, earnedAt: t.earnedAt };
  });
  res.json({ earned, equipped: u.equippedTitle || null });
});

// POST /api/player/:name/title/equip — equip a title
router.post('/api/player/:name/title/equip', requireAuth, requireSelf('name'), (req, res) => {
  const uid = req.params.name.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });
  const { titleId } = req.body;
  if (!titleId) {
    // Unequip
    u.equippedTitle = null;
    saveUsers();
    return res.json({ ok: true, equippedTitle: null });
  }
  const earned = (u.earnedTitles || []).find(t => t.id === titleId);
  if (!earned) return res.status(400).json({ error: 'Title not earned yet' });
  const def = (state.titleDefinitions || []).find(d => d.id === titleId);
  u.equippedTitle = def ? { id: def.id, name: def.name, rarity: def.rarity } : { id: titleId, name: titleId };
  saveUsers();
  res.json({ ok: true, equippedTitle: u.equippedTitle });
});

module.exports = router;
