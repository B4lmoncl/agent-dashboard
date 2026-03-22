/**
 * Shop, Gear, Personal Quest Templates & Forge Challenge Routes.
 */
const router = require('express').Router();
const { state, saveUsers, saveQuests, SHOP_ITEMS, GEAR_TIERS, ensureUserCurrencies } = require('../lib/state');
const { now, getUserGear, getLevelInfo } = require('../lib/helpers');
const { requireApiKey } = require('../lib/middleware');

// ─── Apply shop item effects (buffs, instant currency) ──────────────────────
function applyShopEffect(u, item) {
  if (!item.effect) return null;
  const { type, questsRemaining, amount } = item.effect;

  // Instant currency grants
  if (type === 'instant_stardust') {
    u.currencies = u.currencies || {};
    u.currencies.stardust = (u.currencies.stardust || 0) + amount;
    return `+${amount} Stardust received!`;
  }
  if (type === 'instant_essenz') {
    u.currencies = u.currencies || {};
    u.currencies.essenz = (u.currencies.essenz || 0) + amount;
    return `+${amount} Essenz received!`;
  }

  // Buff-based effects
  u.activeBuffs = u.activeBuffs || [];
  u.activeBuffs.push({ type, questsRemaining, activatedAt: now() });
  const buffNames = {
    xp_boost_10: `+10% XP for ${questsRemaining} quests`,
    gold_boost_10: `+10% Gold for ${questsRemaining} quests`,
    luck_boost_20: `Increased loot chance for ${questsRemaining} quests`,
    streak_shield: 'Streak Shield activated!',
    material_double: `Double material drops for ${questsRemaining} quests`,
  };
  return buffNames[type] || 'Effect activated!';
}

// ─── Personal Life Quest Templates ───────────────────────────────────────────
const PERSONAL_QUEST_TEMPLATES = [
  {
    id: 'morning_ritual',
    name: 'Morning Ritual',
    icon: null,
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
    icon: null,
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
    icon: null,
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
    icon: null,
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
    icon: null,
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
    icon: null,
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
    icon: null,
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
    icon: null,
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

// ─── Forge Challenges ────────────────────────────────────────────────────────
const FORGE_CHALLENGES = [
  {
    id: 'code_sprint',
    name: '30-Day Code Sprint',
    icon: null,
    desc: 'Write code every day for 30 days. Daily development quest auto-created.',
    quests: [
      { title: 'Code Sprint Day', type: 'development', recurrence: 'daily', priority: 'medium' },
    ],
    achievement: 'challenge_coder',
  },
  {
    id: 'learning_marathon',
    name: 'Learning Marathon',
    icon: null,
    desc: '4 weeks of focused learning. Weekly learning quest auto-created.',
    quests: [
      { title: 'Learning Marathon Session', type: 'learning', recurrence: 'weekly', priority: 'medium' },
    ],
    achievement: 'challenge_learner',
  },
  {
    id: 'clean_slate',
    name: 'Clean Slate',
    icon: null,
    desc: 'Daily personal quest for 2 weeks. Build positive habits.',
    quests: [
      { title: 'Clean Slate Daily Habit', type: 'personal', recurrence: 'daily', priority: 'low' },
    ],
    achievement: null,
  },
];

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/shop/gear — list gear tiers
router.get('/api/shop/gear', (req, res) => {
  res.json(GEAR_TIERS);
});

// POST /api/shop/gear/buy — upgrade gear
router.post('/api/shop/gear/buy', requireApiKey, (req, res) => {
  const { userId, gearId } = req.body;
  if (!userId || !gearId) return res.status(400).json({ error: 'userId and gearId are required' });
  const uid = userId.toLowerCase();
  // Self-check: only allow buying for own account (admins bypass)
  if (!req.auth?.isAdmin) {
    const authId = (req.auth?.userId || req.auth?.userName || '').toLowerCase();
    if (!authId || authId !== uid) return res.status(403).json({ error: 'Cannot buy gear for another user' });
  }
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const gear = GEAR_TIERS.find(g => g.id === gearId);
  if (!gear) return res.status(404).json({ error: 'Gear not found' });
  const currentGear = getUserGear(uid);
  if (gear.tier <= currentGear.tier) return res.status(400).json({ error: 'Already have equal or better gear' });
  if ((u.gold || 0) < gear.cost) return res.status(400).json({ error: `Insufficient gold. Need ${gear.cost}, have ${u.gold || 0}` });
  u.gold = (u.gold || 0) - gear.cost;
  if (!u.currencies) u.currencies = {};
  u.currencies.gold = u.gold;
  u.gear = gear.id;
  saveUsers();
  console.log(`[gear] ${uid} upgraded to "${gear.name}" for ${gear.cost} gold`);
  res.json({ ok: true, gear, remainingGold: u.gold });
});

// POST /api/shop/workshop/buy — buy a workshop upgrade (permanent bonuses)
router.post('/api/shop/workshop/buy', requireApiKey, (req, res) => {
  const { upgradeId } = req.body;
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (!upgradeId) return res.status(400).json({ error: 'upgradeId required' });

  const upgrades = state.store.shopData?.workshopUpgrades || [];
  const upgrade = upgrades.find(up => up.id === upgradeId);
  if (!upgrade) return res.status(404).json({ error: 'Workshop upgrade not found' });

  // Determine current tier
  u.workshopUpgrades = u.workshopUpgrades || {};
  const currentTier = u.workshopUpgrades[upgradeId] || 0;
  const nextTierDef = upgrade.tiers.find(t => t.tier === currentTier + 1);
  if (!nextTierDef) return res.status(400).json({ error: 'Already at max tier' });

  // Check currency
  ensureUserCurrencies(u);
  const currency = nextTierDef.currency || 'gold';
  const balance = currency === 'gold' ? (u.currencies?.gold ?? u.gold ?? 0) : (u.currencies?.[currency] ?? 0);
  if (balance < nextTierDef.cost) return res.status(400).json({ error: `Insufficient ${currency}. Need ${nextTierDef.cost}, have ${balance}` });

  // Deduct cost
  if (currency === 'gold') {
    u.currencies.gold = (u.currencies.gold ?? u.gold ?? 0) - nextTierDef.cost;
    u.gold = u.currencies.gold;
  } else {
    u.currencies[currency] = (u.currencies[currency] || 0) - nextTierDef.cost;
  }

  // Apply upgrade
  u.workshopUpgrades[upgradeId] = currentTier + 1;
  saveUsers();
  console.log(`[workshop] ${uid} upgraded "${upgrade.name}" to tier ${currentTier + 1} for ${nextTierDef.cost} ${currency}`);
  res.json({ ok: true, upgrade: upgrade.name, tier: currentTier + 1, label: nextTierDef.label });
});

// GET /api/shop/workshop — get workshop upgrade definitions + player progress
router.get('/api/shop/workshop', (req, res) => {
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.usersByName.get(playerName) : null;
  const upgrades = state.store.shopData?.workshopUpgrades || [];
  const playerUpgrades = u?.workshopUpgrades || {};

  const result = upgrades.map(up => ({
    ...up,
    currentTier: playerUpgrades[up.id] || 0,
    maxTier: up.tiers.length,
    nextTier: up.tiers.find(t => t.tier === (playerUpgrades[up.id] || 0) + 1) || null,
    currentValue: up.tiers.find(t => t.tier === (playerUpgrades[up.id] || 0))?.value || 0,
  }));

  res.json({ workshopUpgrades: result });
});

// GET /api/user/:id/gear — get user's current gear
router.get('/api/user/:id/gear', (req, res) => {
  const uid = req.params.id.toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(getUserGear(uid));
});

// GET /api/shop — list available shop items
router.get('/api/shop', (req, res) => {
  res.json(SHOP_ITEMS);
});

// POST /api/shop/buy — purchase a reward
router.post('/api/shop/buy', requireApiKey, (req, res) => {
  const { userId, itemId } = req.body;
  if (!userId || !itemId) return res.status(400).json({ error: 'userId and itemId are required' });
  const uid = userId.toLowerCase();
  // Self-check: only allow buying for own account (admins bypass)
  if (!req.auth?.isAdmin) {
    const authId = (req.auth?.userId || req.auth?.userName || '').toLowerCase();
    if (!authId || authId !== uid) return res.status(403).json({ error: 'Cannot buy items for another user' });
  }
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  // Block buff purchase if at cap
  if (item.effect?.questsRemaining && (u.activeBuffs || []).length >= 50) {
    return res.status(400).json({ error: 'Too many active buffs (max 50). Complete quests to consume existing ones.' });
  }
  // Apply faction shop discount (max across all factions)
  let discount = 0;
  if (u.factionBonuses) {
    for (const key of Object.keys(u.factionBonuses)) {
      if (key.endsWith('_discount')) discount = Math.max(discount, u.factionBonuses[key]);
    }
  }
  const finalCost = Math.max(1, Math.floor(item.cost * (1 - discount / 100)));
  if ((u.gold || 0) < finalCost) return res.status(400).json({ error: `Insufficient gold. Need ${finalCost}, have ${u.gold || 0}` });
  u.gold = (u.gold || 0) - finalCost;
  if (!u.currencies) u.currencies = {};
  u.currencies.gold = u.gold;
  u.purchases = u.purchases || [];
  u.purchases.push({ itemId: item.id, name: item.name, cost: finalCost, originalCost: item.cost, at: now() });
  const effectMsg = applyShopEffect(u, item);
  saveUsers();
  console.log(`[shop] ${uid} bought "${item.name}" for ${finalCost}g${discount ? ` (${discount}% faction discount)` : ''}${effectMsg ? ` — ${effectMsg}` : ''}`);
  res.json({ ok: true, item, finalCost, discount, remainingGold: u.gold, effectApplied: effectMsg });
});

// GET /api/personal-templates — list personal life quest templates
router.get('/api/personal-templates', (req, res) => {
  res.json(PERSONAL_QUEST_TEMPLATES);
});

// POST /api/personal-templates/spawn — create a quest from a personal template
router.post('/api/personal-templates/spawn', requireApiKey, (req, res) => {
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
    rarity: template.rarity || 'common',
  };
  state.quests.push(quest);
  state.questsById.set(quest.id, quest);
  saveQuests();
  console.log(`[personal-template] spawned: ${quest.id} — "${quest.title}" (${templateId})`);
  res.json({ ok: true, quest });
});

// GET /api/challenges — list challenge templates
router.get('/api/challenges', (req, res) => {
  // For each challenge, include list of participants (users who joined)
  const result = FORGE_CHALLENGES.map(c => ({
    ...c,
    participants: Object.values(state.users)
      .filter(u => (u.joinedChallenges || []).includes(c.id))
      .map(u => ({ id: u.id, name: u.name, avatar: u.avatar, color: u.color })),
  }));
  res.json(result);
});

// POST /api/challenges/join — join a challenge (auto-creates recurring quests)
router.post('/api/challenges/join', requireApiKey, (req, res) => {
  const { userId, challengeId } = req.body;
  if (!userId || !challengeId) return res.status(400).json({ error: 'userId and challengeId required' });
  const uid = userId.toLowerCase();
  const u = state.users[uid];
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
      rarity: qTemplate.rarity || 'common',
    };
    state.quests.push(q);
    state.questsById.set(q.id, q);
    created.push(q);
  }
  saveUsers();
  saveQuests();
  console.log(`[challenge] ${uid} joined "${challenge.name}"`);
  res.json({ ok: true, challenge: challenge.name, questsCreated: created.length });
});

module.exports = router;
