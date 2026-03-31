/**
 * Rift / Dungeon System — "The Rift"
 * Timed quest chains with escalating difficulty.
 * 3 tiers: Normal (3 quests/72h), Hard (5 quests/48h), Legendary (7 quests/36h).
 * Mythic+ tiers: Infinite scaling after Legendary completion (7 quests, tighter time, scaling rewards).
 * Fail cooldown: 3/5/7 days. Rewards scale with progress.
 */
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies, logActivity } = require('../lib/state');
const { now, getLevelInfo, awardCurrency, spendCurrency, onQuestCompletedByUser, createPlayerLock, rollCraftingMaterials, getLegendaryModifiers } = require('../lib/helpers');
const riftStageLock = createPlayerLock('rift-stage');
const riftEnterLock = createPlayerLock('rift-enter');
const riftAbandonLock = createPlayerLock('rift-abandon');
const { requireAuth } = require('../lib/middleware');

// ─── Mythic Leaderboard Cache (avoid O(n) user scan on every GET /api/rift) ──
let _mythicLeaderboardCache = null;
let _mythicLeaderboardCacheTime = 0;
const MYTHIC_LB_CACHE_TTL = 60000; // 1 minute

function getMythicLeaderboard() {
  const now = Date.now();
  if (_mythicLeaderboardCache && now - _mythicLeaderboardCacheTime < MYTHIC_LB_CACHE_TTL) {
    return _mythicLeaderboardCache;
  }
  _mythicLeaderboardCache = Object.values(state.users)
    .filter(p => (p.highestMythicCleared || 0) > 0)
    .map(p => ({
      name: p.name,
      highestMythicCleared: p.highestMythicCleared || 0,
      level: getLevelInfo(p.xp || 0).level,
    }))
    .sort((a, b) => b.highestMythicCleared - a.highestMythicCleared)
    .slice(0, 10);
  _mythicLeaderboardCacheTime = now;
  return _mythicLeaderboardCache;
}

// ─── Rift Configuration ──────────────────────────────────────────────────────

const RIFT_TIERS = {
  normal: {
    name: 'Normal Rift',
    questCount: 3,
    timeLimitHours: 72,
    failCooldownDays: 3,
    color: '#22c55e',
    questTypes: ['personal', 'learning', 'fitness'],
    baseXp: 15,
    baseGold: 10,
    completionBonus: { gold: 100, essenz: 5 },
    icon: '/images/icons/rift-normal.png',
    minLevel: 1,
  },
  hard: {
    name: 'Hard Rift',
    questCount: 5,
    timeLimitHours: 48,
    failCooldownDays: 5,
    color: '#a855f7',
    questTypes: ['personal', 'learning', 'fitness', 'social'],
    baseXp: 25,
    baseGold: 18,
    completionBonus: { gold: 300, essenz: 10, runensplitter: 5 },
    icon: '/images/icons/rift-hard.png',
    minLevel: 5,
  },
  legendary: {
    name: 'Legendary Rift',
    questCount: 7,
    timeLimitHours: 36,
    failCooldownDays: 7,
    color: '#f59e0b',
    questTypes: ['personal', 'learning', 'fitness', 'social', 'boss'],
    baseXp: 40,
    baseGold: 30,
    completionBonus: { gold: 750, essenz: 20, runensplitter: 10, sternentaler: 3 },
    icon: '/images/icons/rift-legendary.png',
    minLevel: 10,
  },
  mythic: {
    name: 'Mythic Rift',
    questCount: 7,
    timeLimitHours: 30,
    failCooldownDays: 7,
    color: '#ff4444',
    questTypes: ['personal', 'learning', 'fitness', 'social', 'boss'],
    baseXp: 50,
    baseGold: 40,
    completionBonus: { gold: 1000, essenz: 25, runensplitter: 15, sternentaler: 5 },
    icon: '/images/icons/rift-mythic.png',
    minLevel: 15,
    isMythic: true,
  },
};

// Difficulty labels per quest position
const DIFFICULTY_NAMES = ['Entrance', 'Corridor', 'Chamber', 'Sanctum', 'Abyss', 'Throne', 'Core'];

// ─── Mythic+ Affixes (weekly rotating, D3/WoW M+ style) ─────────────────────
const MYTHIC_AFFIXES = [
  { id: 'tyrannical', name: 'Tyrannisch', desc: 'Final stage difficulty +50%', effect: { type: 'boss_difficulty', value: 1.5 }, minLevel: 2, color: '#ef4444' },
  { id: 'fortified', name: 'Verstärkt', desc: 'All non-final stages difficulty +30%', effect: { type: 'trash_difficulty', value: 1.3 }, minLevel: 2, color: '#f97316' },
  { id: 'bolstering', name: 'Anspornend', desc: 'Each completed stage reduces remaining time by 1h', effect: { type: 'time_penalty', value: 1 }, minLevel: 4, color: '#a855f7' },
  { id: 'raging', name: 'Rasend', desc: 'Must complete 2 quests of same type in a row', effect: { type: 'type_constraint', value: 2 }, minLevel: 7, color: '#dc2626' },
  { id: 'sanguine', name: 'Blutrünstig', desc: '+25% rewards but time limit reduced by 20%', effect: { type: 'risk_reward', value: 0.25 }, minLevel: 4, color: '#22c55e' },
  { id: 'volcanic', name: 'Vulkanisch', desc: 'Every 3rd quest must be fitness category', effect: { type: 'forced_type', value: 'fitness' }, minLevel: 2, color: '#f59e0b' },
  { id: 'necrotic', name: 'Nekrotisch', desc: 'Streak freeze disabled during rift', effect: { type: 'no_freeze', value: 1 }, minLevel: 7, color: '#6b7280' },
  { id: 'explosive', name: 'Explosiv', desc: '+40% XP but 5h less time', effect: { type: 'xp_time_trade', value: 0.4 }, minLevel: 4, color: '#fbbf24' },
  { id: 'inspiring', name: 'Inspirierend', desc: 'Social/creative quests count double for rift progress', effect: { type: 'double_type', value: 'social' }, minLevel: 2, color: '#3b82f6' },
  { id: 'quaking', name: 'Bebend', desc: 'Quest order is fixed — must follow exact stage sequence', effect: { type: 'strict_order', value: 1 }, minLevel: 7, color: '#7c3aed' },
];

function getWeeklyAffixes() {
  // Deterministic weekly rotation based on ISO week number
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  const seed = d.getFullYear() * 100 + weekNum;

  // Select 2 affixes: 1 from first 5 (minor), 1 from last 5 (major)
  const minor = MYTHIC_AFFIXES.slice(0, 5);
  const major = MYTHIC_AFFIXES.slice(5);
  return [
    minor[seed % minor.length],
    major[(seed * 7) % major.length],
  ];
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRiftQuests(tier, questCount, mythicLevel = 0) {
  const types = tier.questTypes;
  const quests = [];
  const xpMultiplier = mythicLevel > 0 ? (1 + mythicLevel * 0.15) : 1;
  const goldMultiplier = mythicLevel > 0 ? (1 + mythicLevel * 0.1) : 1;
  for (let i = 0; i < questCount; i++) {
    const type = types[i % types.length];
    const difficultyScale = mythicLevel > 0
      ? 1 + (i * 0.5) + (mythicLevel * 0.3)  // Mythic: extra scaling per level
      : 1 + (i * 0.5);                         // Normal tiers: 1x, 1.5x, 2x...
    quests.push({
      stage: i + 1,
      name: DIFFICULTY_NAMES[i] || `Stage ${i + 1}`,
      type,
      difficulty: Math.round(difficultyScale * 100) / 100,
      xpReward: Math.round(tier.baseXp * difficultyScale * xpMultiplier),
      goldReward: Math.round(tier.baseGold * difficultyScale * goldMultiplier),
      completed: false,
      completedAt: null,
    });
  }
  return quests;
}

function getRiftStatus(u) {
  const rift = u.activeRift;
  if (!rift || !rift.active) return null;

  // Check if expired
  const startedAt = new Date(rift.startedAt).getTime();
  const tier = RIFT_TIERS[rift.tier];
  if (!tier) return null;
  const effectiveTimeLimit = rift.timeLimitHours || tier.timeLimitHours;
  const expiresAt = startedAt + effectiveTimeLimit * 3600000;

  if (Date.now() > expiresAt && !rift.completed) {
    // Rift expired — mark as failed
    rift.active = false;
    rift.failed = true;
    rift.failedAt = now();
    // Mythic+ has no fail cooldown per spec — retry immediately
    if (!tier.isMythic) {
      u.riftCooldowns = u.riftCooldowns || {};
      u.riftCooldowns[rift.tier] = { failedAt: rift.failedAt, cooldownDays: tier.failCooldownDays };
    }
    saveUsers();
  }

  return rift;
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

// GET /api/rift — get rift status for current player
router.get('/api/rift', (req, res) => {
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.usersByName.get(playerName) : null;
  if (!u) return res.json({ tiers: RIFT_TIERS, activeRift: null, cooldowns: {} });

  const lvl = getLevelInfo(u.xp || 0).level;
  const rift = getRiftStatus(u);

  // Compute cooldowns
  const cooldowns = {};
  for (const [tierId, cd] of Object.entries(u.riftCooldowns || {})) {
    const failedAt = new Date(cd.failedAt).getTime();
    const cooldownMs = (cd.cooldownDays || 3) * 24 * 3600000;
    const endsAt = failedAt + cooldownMs;
    cooldowns[tierId] = {
      onCooldown: Date.now() < endsAt,
      endsAt: new Date(endsAt).toISOString(),
      remainingMs: Math.max(0, endsAt - Date.now()),
    };
  }

  // Build tier info with unlock status + loot preview
  const tiers = {};
  for (const [id, tier] of Object.entries(RIFT_TIERS)) {
    // Resolve rift-exclusive items for this tier as loot preview
    const riftSource = id === 'mythic' ? 'rift:mythic' : `rift:${id}`;
    const riftItems = (state.FULL_GEAR_ITEMS || []).filter(gi => gi.source === riftSource);
    const lootPreview = riftItems.slice(0, 5).map(gi => ({
      id: gi.id, name: gi.name, slot: gi.slot, rarity: gi.rarity,
      desc: gi.desc || null, icon: gi.icon || null,
      legendaryEffect: gi.legendaryEffect ? { type: gi.legendaryEffect.type, label: gi.legendaryEffect.label } : null,
    }));
    tiers[id] = {
      ...tier,
      unlocked: lvl >= tier.minLevel,
      onCooldown: cooldowns[id]?.onCooldown || false,
      cooldownEndsAt: cooldowns[id]?.endsAt || null,
      lootPreview,
    };
  }

  // Rift history
  const history = (u.riftHistory || []).slice(-10);

  // Mythic status
  const hasLegendaryCompletion = (u.riftHistory || []).some(h => h.tier === 'legendary' && h.success);
  const highestMythicCleared = u.highestMythicCleared || 0;

  // Mythic leaderboard — cached top 10 (1min TTL, avoids O(n) user scan per request)
  const mythicLeaderboard = getMythicLeaderboard();

  // Compute effective time limit for active rift (accounts for mythic scaling)
  const effectiveTimeLimit = rift?.timeLimitHours || RIFT_TIERS[rift?.tier]?.timeLimitHours || 72;

  // Current weekly affixes for Mythic+ display
  const weeklyAffixes = getWeeklyAffixes().map(a => ({ id: a.id, name: a.name, desc: a.desc, color: a.color, minLevel: a.minLevel }));

  res.json({
    tiers,
    weeklyAffixes,
    activeRift: rift?.active ? {
      tier: rift.tier,
      tierName: rift.mythicLevel ? `${RIFT_TIERS[rift.tier]?.name || 'Mythic Rift'} +${rift.mythicLevel}` : (RIFT_TIERS[rift.tier]?.name || rift.tier),
      tierColor: RIFT_TIERS[rift.tier]?.color || '#888',
      tierIcon: RIFT_TIERS[rift.tier]?.icon || '/images/icons/rift-normal.png',
      startedAt: rift.startedAt,
      expiresAt: new Date(new Date(rift.startedAt).getTime() + effectiveTimeLimit * 3600000).toISOString(),
      quests: rift.quests,
      currentStage: rift.quests.filter(q => q.completed).length + 1,
      totalStages: rift.quests.length,
      completed: rift.completed || false,
      ...(rift.mythicLevel && { mythicLevel: rift.mythicLevel }),
      affixes: rift.affixes || [],
    } : rift?.failed ? {
      tier: rift.tier,
      failed: true,
      failedAt: rift.failedAt,
      reachedStage: rift.quests.filter(q => q.completed).length,
      ...(rift.mythicLevel && { mythicLevel: rift.mythicLevel }),
    } : null,
    cooldowns,
    history,
    mythicUnlocked: hasLegendaryCompletion,
    highestMythicCleared,
    nextMythicLevel: highestMythicCleared + 1,
    mythicLeaderboard,
  });
});

// POST /api/rift/enter — start a new rift
router.post('/api/rift/enter', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!riftEnterLock.acquire(uid)) return res.status(429).json({ error: 'Enter in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  // Block during tavern rest
  if (u.tavernRest?.active) return res.status(400).json({ error: 'Cannot enter rifts while resting in The Hearth.' });

  const { tier: tierId, mythicLevel: rawMythicLevel } = req.body;
  if (!tierId || !RIFT_TIERS[tierId]) return res.status(400).json({ error: 'Invalid rift tier' });

  const tier = RIFT_TIERS[tierId];
  const lvl = getLevelInfo(u.xp || 0).level;
  if (lvl < tier.minLevel) return res.status(400).json({ error: `Requires level ${tier.minLevel} (current: ${lvl})` });

  // Check active rift
  if (u.activeRift?.active) return res.status(400).json({ error: 'Already in a rift. Complete or let it expire first.' });

  // Mythic tier validation
  let mythicLevel = 0;
  if (tierId === 'mythic') {
    mythicLevel = Math.min(100, Math.max(1, parseInt(rawMythicLevel, 10) || 1));

    // Must have completed a Legendary Rift first
    const hasLegendaryCompletion = (u.riftHistory || []).some(h => h.tier === 'legendary' && h.success);
    if (!hasLegendaryCompletion) {
      return res.status(400).json({ error: 'Must complete a Legendary Rift before entering Mythic.' });
    }

    // Can't skip levels: mythicLevel <= highestMythicCleared + 1
    const highestCleared = u.highestMythicCleared || 0;
    if (mythicLevel > highestCleared + 1) {
      return res.status(400).json({ error: `Cannot skip Mythic levels. Highest cleared: ${highestCleared}, max entry: ${highestCleared + 1}` });
    }
  }

  // Check cooldown
  const cooldownKey = tierId === 'mythic' ? 'mythic' : tierId;
  const cd = (u.riftCooldowns || {})[cooldownKey];
  if (cd) {
    const failedAt = new Date(cd.failedAt).getTime();
    const cooldownMs = (cd.cooldownDays || 3) * 24 * 3600000;
    if (Date.now() < failedAt + cooldownMs) {
      return res.status(429).json({ error: `Rift on cooldown. Try again ${new Date(failedAt + cooldownMs).toLocaleDateString()}` });
    }
  }

  // Generate rift (mythic gets scaled time limit)
  let timeLimitHours = tierId === 'mythic'
    ? Math.max(18, 30 - mythicLevel * 1.5)
    : tier.timeLimitHours;

  // Apply Mythic+ weekly affixes (M+2 and above)
  let activeAffixes = [];
  if (tierId === 'mythic' && mythicLevel >= 2) {
    const weeklyAffixes = getWeeklyAffixes();
    activeAffixes = weeklyAffixes.filter(a => mythicLevel >= a.minLevel);
    // Apply time-modifying affixes
    for (const affix of activeAffixes) {
      if (affix.effect.type === 'risk_reward') timeLimitHours = Math.round(timeLimitHours * 0.8);
      if (affix.effect.type === 'xp_time_trade') timeLimitHours = Math.max(12, timeLimitHours - 5);
    }
  }

  const quests = generateRiftQuests(tier, tier.questCount, mythicLevel);

  u.activeRift = {
    active: true,
    tier: tierId,
    startedAt: now(),
    quests,
    completed: false,
    failed: false,
    ...(mythicLevel > 0 && { mythicLevel, timeLimitHours }),
    ...(activeAffixes.length > 0 && { affixes: activeAffixes.map(a => ({ id: a.id, name: a.name, desc: a.desc, color: a.color, effect: a.effect })) }),
  };

  saveUsers();
  const displayName = mythicLevel > 0 ? `${tier.name} +${mythicLevel}` : tier.name;
  console.log(`[rift] ${uid} entered ${displayName}`);
  res.json({ ok: true, rift: u.activeRift, message: `Entered ${displayName}! Complete ${tier.questCount} quests in ${timeLimitHours}h.` });
  } finally { riftEnterLock.release(uid); }
});

// POST /api/rift/complete-stage — mark current stage as completed
router.post('/api/rift/complete-stage', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!riftStageLock.acquire(uid)) return res.status(429).json({ error: 'Stage completion in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.tavernRest?.active) return res.status(400).json({ error: 'Cannot complete rift stages while resting.' });

  const rift = getRiftStatus(u);
  if (!rift?.active) return res.status(400).json({ error: 'No active rift' });

  // Find next incomplete stage
  const nextStage = rift.quests.find(q => !q.completed);
  if (!nextStage) return res.status(400).json({ error: 'All stages already completed' });

  // Complete the stage
  nextStage.completed = true;
  nextStage.completedAt = now();
  ensureUserCurrencies(u);

  // Map difficulty scale to quest rarity for proper reward multipliers
  const DIFF_TO_RARITY = { 1: 'common', 1.5: 'uncommon', 2: 'rare', 2.5: 'epic', 3: 'epic', 3.5: 'legendary' };
  const stageRarity = DIFF_TO_RARITY[nextStage.difficulty] || (nextStage.difficulty >= 3 ? 'legendary' : 'rare');

  // Use the full reward pipeline: XP multipliers, gold multipliers, forge temp,
  // streaks, loot drops, achievements, titles, expedition, weekly challenge,
  // crafting materials, recipe discovery, activity feed, daily missions
  const syntheticQuest = {
    id: `rift-${rift.tier}-stage-${nextStage.stage}`,
    title: `${rift.mythicLevel ? `Mythic Rift +${rift.mythicLevel}` : (RIFT_TIERS[rift.tier]?.name || 'Rift')}: ${nextStage.name}`,
    type: nextStage.type,
    priority: nextStage.difficulty >= 2.5 ? 'high' : nextStage.difficulty >= 1.5 ? 'medium' : 'low',
    rarity: stageRarity,
    status: 'completed',
    rewards: { xp: nextStage.xpReward, gold: nextStage.goldReward },
  };
  onQuestCompletedByUser(uid, syntheticQuest);

  // ── Rift-exclusive gear drop (from gearTemplates-rift.json pool) ──
  const riftSource = rift.mythicLevel ? 'rift:mythic' : `rift:${rift.tier}`;
  const RARITY_ORDER_RIFT = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const riftMinRarity = rift.tier === 'legendary' || rift.mythicLevel ? 'rare' : rift.tier === 'hard' ? 'uncommon' : 'common';
  const riftMinIdx = RARITY_ORDER_RIFT.indexOf(riftMinRarity);
  const riftPlayerLevel = getLevelInfo(u.xp || 0).level;
  const riftItems = state.FULL_GEAR_ITEMS.filter(gi =>
    gi.source === riftSource &&
    (gi.minLevel || gi.reqLevel || 1) <= riftPlayerLevel &&
    RARITY_ORDER_RIFT.indexOf(gi.rarity || 'common') >= riftMinIdx
  );
  let riftGearDrop = null;
  if (riftItems.length > 0 && Math.random() < 0.35) {
    const { createGearInstance, rollSuffix } = require('../lib/helpers');
    const template = riftItems[Math.floor(Math.random() * riftItems.length)];
    const instance = rollSuffix(createGearInstance(template));
    if (!u.inventory) u.inventory = [];
    u.inventory.push(instance);
    riftGearDrop = { name: instance.name, rarity: instance.rarity, slot: instance.slot, icon: instance.icon || null };
  }

  // ── Material drops from rift stage (content-tier based) ──
  const riftContentTier = rift.tier === 'normal' ? 2 : rift.tier === 'hard' ? 3 : rift.mythicLevel ? Math.min(5, 4 + Math.floor(rift.mythicLevel / 6)) : 4;
  const legendaryMods = getLegendaryModifiers(uid);
  const riftMats = rollCraftingMaterials(null, legendaryMods.materialDoubleChance || 0, u, uid, riftContentTier);
  if (riftMats.length > 0) {
    u.craftingMaterials = u.craftingMaterials || {};
    for (const mat of riftMats) {
      u.craftingMaterials[mat.id] = (u.craftingMaterials[mat.id] || 0) + mat.amount;
    }
  }

  // Check if rift is fully completed
  const allDone = rift.quests.every(q => q.completed);
  if (allDone) {
    rift.completed = true;
    rift.completedAt = now();
    u._riftCompletions = (u._riftCompletions || 0) + 1;

    // Award completion bonus currencies (raw — these are bonus on top of quest rewards)
    const tier = RIFT_TIERS[rift.tier];
    const mythicLvl = rift.mythicLevel || 0;
    // Calculate affix reward multiplier (sanguine +25%, explosive +40% XP)
    const affixes = rift.affixes || [];
    const rewardMulti = 1 + affixes.reduce((sum, a) => sum + (a.effect?.type === 'risk_reward' ? a.effect.value : 0), 0);
    const xpMulti = 1 + affixes.reduce((sum, a) => sum + (a.effect?.type === 'xp_time_trade' ? a.effect.value : 0), 0);
    if (tier?.completionBonus) {
      for (const [currency, amount] of Object.entries(tier.completionBonus)) {
        // Scale mythic completion bonuses
        let scaled = amount;
        if (mythicLvl > 0) {
          const cappedLvl = Math.min(mythicLvl, 100);
          // Cap Mythic+ gold bonus at M+10 (2000g max bonus)
          if (currency === 'gold') scaled = amount + Math.min(cappedLvl * 200, 2000);
          else if (currency === 'essenz') scaled = amount + cappedLvl * 5;
          else scaled = amount;
        }
        // Apply affix reward multipliers
        scaled = Math.round(scaled * rewardMulti);
        awardCurrency(uid, currency, scaled);
      }
    }

    // ── Guaranteed Seelensplitter for Legendary (and Mythic) tier completion ──
    if (rift.tier === 'legendary' || rift.tier === 'mythic') {
      u.craftingMaterials = u.craftingMaterials || {};
      u.craftingMaterials.seelensplitter = (u.craftingMaterials.seelensplitter || 0) + 1;
    }

    // Clear cooldown for this tier (successful completion removes fail penalty)
    const cooldownKey = rift.tier === 'mythic' ? 'mythic' : rift.tier;
    if (u.riftCooldowns?.[cooldownKey]) delete u.riftCooldowns[cooldownKey];

    // Track highest mythic level cleared
    if (mythicLvl > 0) {
      u.highestMythicCleared = Math.max(u.highestMythicCleared || 0, mythicLvl);
    }

    // Add to history
    u.riftHistory = u.riftHistory || [];
    u.riftHistory.push({
      tier: rift.tier,
      startedAt: rift.startedAt,
      completedAt: rift.completedAt,
      stages: rift.quests.length,
      success: true,
      ...(mythicLvl > 0 && { mythicLevel: mythicLvl }),
    });
    if (u.riftHistory.length > 20) u.riftHistory = u.riftHistory.slice(-20);

    // Log rift completion to activity feed
    const riftLabel = mythicLvl > 0 ? `Mythic+${mythicLvl}` : rift.tier.charAt(0).toUpperCase() + rift.tier.slice(1);
    logActivity(uid, 'rift_complete', {
      tier: rift.tier,
      stages: rift.quests.length,
      ...(mythicLvl > 0 && { mythicLevel: mythicLvl }),
      rarity: rift.tier === 'legendary' || mythicLvl > 0 ? 'legendary' : rift.tier === 'hard' ? 'epic' : 'rare',
      label: riftLabel,
    });
  }

  // Read temp fields from onQuestCompletedByUser before cleanup
  const stageNum = rift.quests.filter(q => q.completed).length;
  const xpEarned = u._lastXpEarned || nextStage.xpReward;
  const goldEarned = u._lastGoldEarned || nextStage.goldReward;
  const loot = u._lastLoot || null;
  // Cleanup temp fields to prevent persistence bloat
  delete u._lastXpEarned; delete u._lastGoldEarned; delete u._lastLoot; delete u._lastCompanionReward;
  saveUsers();
  console.log(`[rift] ${uid} completed stage ${stageNum}/${rift.quests.length} in ${rift.tier} rift (+${xpEarned}XP, +${goldEarned}g)`);

  res.json({
    ok: true,
    stage: nextStage,
    stageNum,
    totalStages: rift.quests.length,
    xpEarned,
    goldEarned,
    loot,
    riftGearDrop: riftGearDrop || undefined,
    riftMaterials: riftMats.length > 0 ? riftMats : undefined,
    riftCompleted: allDone,
    completionBonus: allDone ? (() => {
      const base = RIFT_TIERS[rift.tier]?.completionBonus;
      if (!base) return null;
      const affixes = rift.affixes || [];
      const rewardMulti = 1 + affixes.reduce((sum, a) => sum + (a.effect?.type === 'risk_reward' ? a.effect.value : 0), 0);
      const result = {};
      for (const [k, v] of Object.entries(base)) {
        let scaled = v;
        if (rift.mythicLevel) {
          const cappedLvl = Math.min(rift.mythicLevel, 100);
          if (k === 'gold') scaled = v + Math.min(cappedLvl * 200, 2000);
          else if (k === 'essenz') scaled = v + cappedLvl * 5;
        }
        result[k] = Math.round(scaled * rewardMulti);
      }
      return result;
    })() : null,
    ...(rift.mythicLevel && { mythicLevel: rift.mythicLevel }),
    ...(allDone && (rift.tier === 'legendary' || rift.tier === 'mythic') && { seelensplitter: 1 }),
    message: allDone
      ? `Rift Complete! ${rift.mythicLevel ? `Mythic Rift +${rift.mythicLevel}` : RIFT_TIERS[rift.tier]?.name} conquered!`
      : `Stage ${stageNum} cleared! ${rift.quests.length - stageNum} remaining.`,
  });
  } finally { riftStageLock.release(uid); }
});

// POST /api/rift/abandon — abandon current rift (counts as fail)
router.post('/api/rift/abandon', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!riftAbandonLock.acquire(uid)) return res.status(429).json({ error: 'Abandon in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const rift = u.activeRift;
  if (!rift?.active) return res.status(400).json({ error: 'No active rift' });

  const tier = RIFT_TIERS[rift.tier];
  const mythicLvl = rift.mythicLevel || 0;
  rift.active = false;
  rift.failed = true;
  rift.failedAt = now();

  // Apply cooldown — Mythic+ has no fail cooldown (retry immediately per spec)
  const isMythic = tier?.isMythic;
  if (!isMythic) {
    u.riftCooldowns = u.riftCooldowns || {};
    const cooldownKey = rift.tier;
    u.riftCooldowns[cooldownKey] = { failedAt: rift.failedAt, cooldownDays: tier?.failCooldownDays || 3 };
  }

  // Add to history
  u.riftHistory = u.riftHistory || [];
  u.riftHistory.push({
    tier: rift.tier,
    startedAt: rift.startedAt,
    failedAt: rift.failedAt,
    stages: rift.quests.filter(q => q.completed).length,
    totalStages: rift.quests.length,
    success: false,
    ...(mythicLvl > 0 && { mythicLevel: mythicLvl }),
  });
  if (u.riftHistory.length > 20) u.riftHistory = u.riftHistory.slice(-20);

  saveUsers();
  const displayName = mythicLvl > 0 ? `${tier?.name || 'Mythic Rift'} +${mythicLvl}` : (tier?.name || rift.tier);
  console.log(`[rift] ${uid} abandoned ${displayName} rift`);
  res.json({ ok: true, message: isMythic ? 'Mythic Rift abandoned. No cooldown — retry anytime.' : `Rift abandoned. ${tier?.failCooldownDays || 3}-day cooldown applied.` });
  } finally { riftAbandonLock.release(uid); }
});

// ─── POST /api/rift/extend — Extend rift timer with Mondstaub ───────────────
router.post('/api/rift/extend', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const rift = u.activeRift;
  if (!rift?.active) return res.status(400).json({ error: 'No active rift' });

  // Check if rift has already expired
  const tier = RIFT_TIERS[rift.tier];
  if (!tier) return res.status(400).json({ error: 'Invalid rift tier' });
  const effectiveTimeLimit = rift.timeLimitHours || tier.timeLimitHours;
  const startedAt = new Date(rift.startedAt).getTime();
  const expiresAt = startedAt + effectiveTimeLimit * 3600000;
  if (Date.now() > expiresAt) {
    return res.status(400).json({ error: 'Rift has already expired' });
  }

  // Max 1 extension per rift run
  if (rift.extended) {
    return res.status(400).json({ error: 'Rift timer already extended once this run' });
  }

  // Cost: 30 mondstaub
  const cost = 30;
  ensureUserCurrencies(u);
  const hasMondstaub = u.currencies?.mondstaub ?? 0;
  if (hasMondstaub < cost) {
    return res.status(400).json({ error: `Not enough Mondstaub — need ${cost}, have ${hasMondstaub}` });
  }

  // Deduct mondstaub
  if (!spendCurrency(uid, 'mondstaub', cost)) {
    return res.status(400).json({ error: 'Failed to deduct Mondstaub' });
  }

  // Extend by 6 hours
  const extensionHours = 6;
  rift.timeLimitHours = effectiveTimeLimit + extensionHours;
  rift.extended = true;

  saveUsers();

  const newExpiresAt = new Date(startedAt + rift.timeLimitHours * 3600000).toISOString();
  console.log(`[rift] ${uid} extended rift timer by ${extensionHours}h (new expiry: ${newExpiresAt})`);

  res.json({
    success: true,
    message: `Rift timer extended by ${extensionHours} hours!`,
    newExpiresAt,
    mondstaubSpent: cost,
    mondstaubRemaining: u.currencies?.mondstaub ?? 0,
  });
});

module.exports = router;
