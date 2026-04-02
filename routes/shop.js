/**
 * Shop, Gear, Personal Quest Templates & Forge Challenge Routes.
 */
const router = require('express').Router();
const { state, saveUsers, saveQuests, SHOP_ITEMS, GEAR_TIERS, ensureUserCurrencies } = require('../lib/state');
const { now, getUserGear, getLevelInfo, createPlayerLock } = require('../lib/helpers');
const { requireApiKey } = require('../lib/middleware');
const shopBuyLock = createPlayerLock('shop-buy');

// ─── Apply shop item effects (buffs, instant currency) ──────────────────────
function applyShopEffect(u, item) {
  if (!item.effect) return null;
  const { type, questsRemaining, amount } = item.effect;

  // Instant currency grants (multiple naming conventions supported)
  if (type === 'instant_stardust' || type === 'stardust') {
    u.currencies = u.currencies || {};
    u.currencies.stardust = (u.currencies.stardust || 0) + (amount || 1);
    return `+${amount || 1} Stardust received!`;
  }
  if (type === 'instant_essenz' || type === 'essenz') {
    u.currencies = u.currencies || {};
    u.currencies.essenz = (u.currencies.essenz || 0) + (amount || 1);
    return `+${amount || 1} Essenz received!`;
  }
  if (type === 'runensplitter') {
    u.currencies = u.currencies || {};
    u.currencies.runensplitter = (u.currencies.runensplitter || 0) + (amount || 1);
    return `+${amount || 1} Runensplitter received!`;
  }
  if (type === 'sternentaler') {
    u.currencies = u.currencies || {};
    u.currencies.sternentaler = (u.currencies.sternentaler || 0) + (amount || 1);
    return `+${amount || 1} Sternentaler received!`;
  }

  // Instant faction reputation
  if (type === 'faction_rep') {
    const factionId = item.effect.factionId;
    if (factionId) {
      u.factions = u.factions || {};
      u.factions[factionId] = u.factions[factionId] || { rep: 0 };
      u.factions[factionId].rep = (u.factions[factionId].rep || 0) + (amount || 50);
    }
    return `+${amount || 50} Faction reputation!`;
  }

  // Craft discount (reduces vendor reagent costs for N crafts)
  if (type === 'craft_discount') {
    u.activeBuffs = u.activeBuffs || [];
    u.activeBuffs.push({ type: 'craft_discount', questsRemaining: questsRemaining || 10, value: item.effect.value || 0.2, activatedAt: now() });
    return `Crafting discount active for ${questsRemaining || 10} crafts!`;
  }

  // Expedition speed bonus
  if (type === 'expedition_speed') {
    u.activeBuffs = u.activeBuffs || [];
    u.activeBuffs.push({ type: 'expedition_speed', questsRemaining: questsRemaining || 1, value: item.effect.value || 0.25, activatedAt: now() });
    return `Expedition speed boost active!`;
  }

  // Rift time extend (alternative naming for rift_time_extension)
  if (type === 'rift_time_extend') {
    if (!u.activeRift || !u.activeRift.active) return 'No active rift to extend.';
    if (u.activeRift.extended) return 'Rift timer already extended.';
    const hours = item.effect.hours || 6;
    u.activeRift.timeLimitHours = (u.activeRift.timeLimitHours || 48) + hours;
    u.activeRift.extended = true;
    return `Rift timer extended by ${hours} hours!`;
  }

  // Multi-reward (doubles next quest reward)
  if (type === 'multi_reward' || type === 'double_reward') {
    u.activeBuffs = u.activeBuffs || [];
    u.activeBuffs.push({ type: 'double_reward', questsRemaining: questsRemaining || 1, activatedAt: now() });
    return `Next ${questsRemaining || 1} quest(s) give double rewards!`;
  }

  // Instant forge temp boost (self-care rewards)
  if (type === 'instant_forge_temp') {
    u.forgeTemp = Math.min(100, (u.forgeTemp ?? 0) + amount);
    return `+${amount} Forge Temperature!`;
  }

  // Instant streak shield (self-care rewards)
  if (type === 'instant_streak_shield') {
    u.activeBuffs = u.activeBuffs || [];
    u.activeBuffs.push({ type: 'streak_shield', questsRemaining: item.effect.questsRemaining || 1, activatedAt: now() });
    return 'Streak Shield activated!';
  }

  // Combined forge temp + streak shield (premium self-care rewards)
  if (type === 'instant_forge_temp_and_streak_shield') {
    const { forgeTemp, streakShields } = item.effect;
    u.forgeTemp = Math.min(100, (u.forgeTemp ?? 0) + (forgeTemp || 0));
    u.activeBuffs = u.activeBuffs || [];
    for (let i = 0; i < (streakShields || 0); i++) {
      u.activeBuffs.push({ type: 'streak_shield', questsRemaining: 1, activatedAt: now() });
    }
    return `+${forgeTemp} Forge Temperature + ${streakShields} Streak Shield!`;
  }

  // Rift time extension — directly extend active rift timer
  if (type === 'rift_time_extension') {
    if (!u.activeRift || !u.activeRift.active) return 'No active rift to extend.';
    if (u.activeRift.extended) return 'Rift timer already extended this run.';
    const hours = item.effect.hours || 6;
    const tier = u.activeRift.tier;
    const baseTL = u.activeRift.timeLimitHours || { normal: 72, hard: 48, legendary: 36, mythic: 30 }[tier] || 48;
    u.activeRift.timeLimitHours = baseTL + hours;
    u.activeRift.extended = true;
    return `Rift timer extended by ${hours} hours!`;
  }

  // Buff-based effects
  u.activeBuffs = u.activeBuffs || [];
  const buffEntry = { type, questsRemaining, activatedAt: now() };
  // Preserve extra effect fields (value, xpPercent, goldPercent, etc.) so consumers can read them
  if (item.effect.value != null) buffEntry.value = item.effect.value;
  if (item.effect.xpPercent != null) buffEntry.xpPercent = item.effect.xpPercent;
  if (item.effect.goldPercent != null) buffEntry.goldPercent = item.effect.goldPercent;
  u.activeBuffs.push(buffEntry);
  const buffNames = {
    xp_boost_10: `+10% XP for ${questsRemaining} quests`,
    xp_boost_15: `+15% XP for ${questsRemaining} quests`,
    xp_boost_5: `+5% XP for ${questsRemaining} quests`,
    xp_boost_25_return: `+25% XP for ${questsRemaining} quests`,
    xp_boost_50_perfect: `+50% XP for ${questsRemaining} quests`,
    xp_gold_boost: `+${item.effect.xpPercent || 15}% XP +${item.effect.goldPercent || 10}% Gold for ${questsRemaining} quests`,
    gold_boost_10: `+10% Gold for ${questsRemaining} quests`,
    gold_boost_15: `+15% Gold for ${questsRemaining} quests`,
    luck_boost: `Increased loot chance for ${questsRemaining} quests`,
    luck_boost_20: `Increased loot chance for ${questsRemaining} quests`,
    streak_shield: 'Streak Shield activated!',
    material_double: `Double material drops for ${questsRemaining} quests`,
    world_boss_damage_boost: `+${item.effect.value || 25}% boss damage for ${questsRemaining} quests`,
    feast_buff: `+15% XP +10% Gold for ${questsRemaining} quests (Feast)`,
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
    rarity: 'uncommon',
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
    rarity: 'rare',
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
    rarity: 'rare',
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
    rarity: 'uncommon',
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
    rarity: 'rare',
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
    rarity: 'uncommon',
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
    rarity: 'rare',
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
    rarity: 'uncommon',
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
      { title: 'Code Sprint Day', type: 'development', recurrence: 'daily', rarity: 'uncommon' },
    ],
    achievement: 'challenge_coder',
  },
  {
    id: 'learning_marathon',
    name: 'Learning Marathon',
    icon: null,
    desc: '4 weeks of focused learning. Weekly learning quest auto-created.',
    quests: [
      { title: 'Learning Marathon Session', type: 'learning', recurrence: 'weekly', rarity: 'uncommon' },
    ],
    achievement: 'challenge_learner',
  },
  {
    id: 'clean_slate',
    name: 'Clean Slate',
    icon: null,
    desc: 'Daily personal quest for 2 weeks. Build positive habits.',
    quests: [
      { title: 'Clean Slate Daily Habit', type: 'personal', recurrence: 'daily', rarity: 'common' },
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
  if (!shopBuyLock.acquire(uid)) return res.status(429).json({ error: 'Purchase in progress' });
  try {
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
  } finally { shopBuyLock.release(uid); }
});

// POST /api/shop/workshop/buy — buy a workshop upgrade (permanent bonuses)
router.post('/api/shop/workshop/buy', requireApiKey, (req, res) => {
  const { upgradeId } = req.body;
  const uid = req.auth?.userId;
  if (!shopBuyLock.acquire(uid)) return res.status(429).json({ error: 'Purchase in progress' });
  try {
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
  } finally { shopBuyLock.release(uid); }
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
  if (!shopBuyLock.acquire(uid)) return res.status(429).json({ error: 'Purchase in progress' });
  try {
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
  // Talent tree: shop_discount — additional % off shop prices
  const { getUserTalentEffects } = require('./talent-tree');
  const talentDiscount = (getUserTalentEffects(uid).shop_discount || 0) * 100; // stored as decimal e.g. 0.03 → 3%
  const totalDiscount = discount + talentDiscount;
  const finalCost = Math.max(1, Math.floor(item.cost * (1 - totalDiscount / 100)));
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
  } finally { shopBuyLock.release(uid); }
});

// ─── Currency Shop (Sternentaler, Gildentaler, Mondstaub) ────────────────────
// POST /api/shop/currency-buy — purchase items with non-gold currencies
router.post('/api/shop/currency-buy', requireApiKey, (req, res) => {
  const { userId, itemId, shopType } = req.body;
  if (!userId || !itemId || !shopType) return res.status(400).json({ error: 'userId, itemId, and shopType required' });
  const uid = userId.toLowerCase();
  if (!shopBuyLock.acquire(uid)) return res.status(429).json({ error: 'Purchase in progress' });
  try {
  if (!req.auth?.isAdmin) {
    const authId = (req.auth?.userId || req.auth?.userName || '').toLowerCase();
    if (!authId || authId !== uid) return res.status(403).json({ error: 'Cannot buy items for another user' });
  }
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  ensureUserCurrencies(u);

  // Resolve shop pool
  const shopData = state.store.shopData || {};
  const poolMap = { sternentaler: shopData.sternentalerItems, gildentaler: shopData.gildentalerItems, mondstaub: shopData.mondstaubItems };
  const pool = poolMap[shopType];
  if (!pool) return res.status(400).json({ error: `Unknown shop type: ${shopType}` });

  const item = pool.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found in this shop' });

  const currency = item.currency || shopType;
  const cost = Math.max(1, Math.floor(item.cost || 0));
  if ((u.currencies[currency] || 0) < cost) {
    return res.status(400).json({ error: `Not enough ${currency}. Need ${cost}, have ${u.currencies[currency] || 0}` });
  }

  // Deduct currency
  u.currencies[currency] -= cost;

  // Apply item based on type
  let resultMsg = 'Purchased!';
  if (item.type === 'frame') {
    u.unlockedFrames = u.unlockedFrames || [];
    if (u.unlockedFrames.some(f => f.id === item.frameId)) {
      // Refund — already owned
      u.currencies[currency] += cost;
      return res.status(409).json({ error: 'You already own this frame' });
    }
    u.unlockedFrames.push({ id: item.frameId, name: item.frameName, color: item.frameColor, glow: item.frameGlow || false, unlockedAt: now() });
    resultMsg = `Frame "${item.frameName}" unlocked!`;
  } else if (item.type === 'title') {
    u.earnedTitles = u.earnedTitles || [];
    if (u.earnedTitles.some(t => t.id === item.titleId)) {
      u.currencies[currency] += cost;
      return res.status(409).json({ error: 'You already own this title' });
    }
    u.earnedTitles.push({ id: item.titleId, name: item.titleName, rarity: item.titleRarity || 'epic', earnedAt: now() });
    resultMsg = `Title "${item.titleName}" earned!`;
  } else if (item.type === 'boost' && item.effect) {
    // Buff cap check (same as gold shop)
    u.activeBuffs = u.activeBuffs || [];
    if (u.activeBuffs.length >= 50) {
      u.currencies[currency] += cost;
      return res.status(400).json({ error: 'Max 50 active buffs. Use some first.' });
    }
    resultMsg = applyShopEffect(u, item) || 'Boost activated!';
  } else if (item.type === 'cosmetic') {
    u.cosmetics = u.cosmetics || [];
    if (u.cosmetics.includes(item.id)) {
      u.currencies[currency] += cost;
      return res.status(409).json({ error: 'You already own this cosmetic' });
    }
    u.cosmetics.push(item.id);
    resultMsg = `Cosmetic "${item.name}" acquired!`;
  }

  u.purchases = u.purchases || [];
  u.purchases.push({ itemId: item.id, name: item.name, cost, currency, at: now() });
  saveUsers();
  console.log(`[shop] ${uid} bought "${item.name}" for ${cost} ${currency}`);
  res.json({ ok: true, item, cost, currency, remaining: u.currencies[currency], resultMsg });
  } finally { shopBuyLock.release(uid); }
});

// GET /api/shop/currency-items — list all currency shop items
router.get('/api/shop/currency-items', (req, res) => {
  const shopData = state.store.shopData || {};
  res.json({
    sternentaler: shopData.sternentalerItems || [],
    gildentaler: shopData.gildentalerItems || [],
    mondstaub: shopData.mondstaubItems || [],
  });
});

// GET /api/personal-templates — list personal life quest templates
router.get('/api/personal-templates', (req, res) => {
  res.json(PERSONAL_QUEST_TEMPLATES);
});

// POST /api/personal-templates/spawn — create a quest from a personal template
router.post('/api/personal-templates/spawn', requireApiKey, (req, res) => {
  const { templateId, createdBy, claimedBy } = req.body;
  if (!templateId) return res.status(400).json({ error: 'Please select an item' });
  const template = PERSONAL_QUEST_TEMPLATES.find(t => t.id === templateId);
  if (!template) return res.status(404).json({ error: 'Item not available' });
  const resolvedCreatedBy = createdBy || 'leon';
  const quest = {
    id: `quest-${Date.now()}`,
    title: template.name,
    description: template.desc,
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
  if (!shopBuyLock.acquire(uid)) return res.status(429).json({ error: 'Request in progress' });
  try {
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
  } finally { shopBuyLock.release(uid); }
});

module.exports = router;
