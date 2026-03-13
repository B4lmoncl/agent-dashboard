// ─── Game API (Classes, Roadmap, Rituals) ───────────────────────────────────
const router = require('express').Router();
const {
  state, STREAK_MILESTONES, RARITY_COLORS,
  saveClasses, saveRoadmap, saveRituals, saveUsers,
} = require('../lib/state');
const {
  now, todayStr, getStreakXpBonus, getLevelInfo,
  getUserDropBonus, rollLoot, addLootToInventory, resetLootPity,
  checkAndAwardAchievements,
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
    icon: icon || 'xx',
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
    ...(isAntiRitual ? { isAntiRitual: true, category, commitment, commitmentDays, bloodPact, cleanDays: 0, lastViolated: null } : {}),
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
  }
  saveRituals();

  res.json({ ok: true, ritual, newAchievements, lootDrop, milestoneDrop });
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

module.exports = router;
