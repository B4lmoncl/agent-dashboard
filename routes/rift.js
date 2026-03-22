/**
 * Rift / Dungeon System — "The Rift"
 * Timed quest chains with escalating difficulty.
 * 3 tiers: Normal (3 quests/72h), Hard (5 quests/48h), Legendary (7 quests/36h).
 * Mythic+ tiers: Infinite scaling after Legendary completion (7 quests, tighter time, scaling rewards).
 * Fail cooldown: 3/5/7 days. Rewards scale with progress.
 */
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');
const { now, getLevelInfo, awardCurrency, onQuestCompletedByUser } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');

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
    icon: '🌀',
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
    icon: '🔮',
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
    icon: '⚡',
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
    icon: '💀',
    minLevel: 15,
    isMythic: true,
  },
};

// Difficulty labels per quest position
const DIFFICULTY_NAMES = ['Entrance', 'Corridor', 'Chamber', 'Sanctum', 'Abyss', 'Throne', 'Core'];

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
  const expiresAt = startedAt + tier.timeLimitHours * 3600000;

  if (Date.now() > expiresAt && !rift.completed) {
    // Rift expired — mark as failed
    rift.active = false;
    rift.failed = true;
    rift.failedAt = now();
    u.riftCooldowns = u.riftCooldowns || {};
    u.riftCooldowns[rift.tier] = { failedAt: rift.failedAt, cooldownDays: tier.failCooldownDays };
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

  // Build tier info with unlock status
  const tiers = {};
  for (const [id, tier] of Object.entries(RIFT_TIERS)) {
    tiers[id] = {
      ...tier,
      unlocked: lvl >= tier.minLevel,
      onCooldown: cooldowns[id]?.onCooldown || false,
      cooldownEndsAt: cooldowns[id]?.endsAt || null,
    };
  }

  // Rift history
  const history = (u.riftHistory || []).slice(-10);

  res.json({
    tiers,
    activeRift: rift?.active ? {
      tier: rift.tier,
      tierName: RIFT_TIERS[rift.tier]?.name || rift.tier,
      tierColor: RIFT_TIERS[rift.tier]?.color || '#888',
      tierIcon: RIFT_TIERS[rift.tier]?.icon || '🌀',
      startedAt: rift.startedAt,
      expiresAt: new Date(new Date(rift.startedAt).getTime() + (RIFT_TIERS[rift.tier]?.timeLimitHours || 72) * 3600000).toISOString(),
      quests: rift.quests,
      currentStage: rift.quests.filter(q => q.completed).length + 1,
      totalStages: rift.quests.length,
      completed: rift.completed || false,
    } : rift?.failed ? {
      tier: rift.tier,
      failed: true,
      failedAt: rift.failedAt,
      reachedStage: rift.quests.filter(q => q.completed).length,
    } : null,
    cooldowns,
    history,
  });
});

// POST /api/rift/enter — start a new rift
router.post('/api/rift/enter', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

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
    mythicLevel = Math.max(1, parseInt(rawMythicLevel, 10) || 1);

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
  const timeLimitHours = tierId === 'mythic'
    ? Math.max(18, 30 - mythicLevel * 1.5)
    : tier.timeLimitHours;
  const quests = generateRiftQuests(tier, tier.questCount, mythicLevel);

  u.activeRift = {
    active: true,
    tier: tierId,
    startedAt: now(),
    quests,
    completed: false,
    failed: false,
    ...(mythicLevel > 0 && { mythicLevel, timeLimitHours }),
  };

  saveUsers();
  const displayName = mythicLevel > 0 ? `${tier.name} +${mythicLevel}` : tier.name;
  console.log(`[rift] ${uid} entered ${displayName}`);
  res.json({ ok: true, rift: u.activeRift, message: `Entered ${displayName}! Complete ${tier.questCount} quests in ${timeLimitHours}h.` });
});

// POST /api/rift/complete-stage — mark current stage as completed
router.post('/api/rift/complete-stage', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

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
    title: `${RIFT_TIERS[rift.tier]?.name || 'Rift'}: ${nextStage.name}`,
    type: nextStage.type,
    priority: nextStage.difficulty >= 2.5 ? 'high' : nextStage.difficulty >= 1.5 ? 'medium' : 'low',
    rarity: stageRarity,
    status: 'completed',
    rewards: { xp: nextStage.xpReward, gold: nextStage.goldReward },
  };
  onQuestCompletedByUser(uid, syntheticQuest);

  // Check if rift is fully completed
  const allDone = rift.quests.every(q => q.completed);
  if (allDone) {
    rift.completed = true;
    rift.completedAt = now();

    // Award completion bonus currencies (raw — these are bonus on top of quest rewards)
    const tier = RIFT_TIERS[rift.tier];
    if (tier?.completionBonus) {
      for (const [currency, amount] of Object.entries(tier.completionBonus)) {
        awardCurrency(uid, currency, amount);
      }
    }

    // Clear cooldown for this tier (successful completion removes fail penalty)
    if (u.riftCooldowns?.[rift.tier]) delete u.riftCooldowns[rift.tier];

    // Add to history
    u.riftHistory = u.riftHistory || [];
    u.riftHistory.push({
      tier: rift.tier,
      startedAt: rift.startedAt,
      completedAt: rift.completedAt,
      stages: rift.quests.length,
      success: true,
    });
    if (u.riftHistory.length > 20) u.riftHistory = u.riftHistory.slice(-20);
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
    riftCompleted: allDone,
    completionBonus: allDone ? RIFT_TIERS[rift.tier]?.completionBonus : null,
    message: allDone
      ? `Rift Complete! ${RIFT_TIERS[rift.tier]?.name} conquered!`
      : `Stage ${stageNum} cleared! ${rift.quests.length - stageNum} remaining.`,
  });
});

// POST /api/rift/abandon — abandon current rift (counts as fail)
router.post('/api/rift/abandon', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const rift = u.activeRift;
  if (!rift?.active) return res.status(400).json({ error: 'No active rift' });

  const tier = RIFT_TIERS[rift.tier];
  rift.active = false;
  rift.failed = true;
  rift.failedAt = now();

  // Apply cooldown
  u.riftCooldowns = u.riftCooldowns || {};
  u.riftCooldowns[rift.tier] = { failedAt: rift.failedAt, cooldownDays: tier?.failCooldownDays || 3 };

  // Add to history
  u.riftHistory = u.riftHistory || [];
  u.riftHistory.push({
    tier: rift.tier,
    startedAt: rift.startedAt,
    failedAt: rift.failedAt,
    stages: rift.quests.filter(q => q.completed).length,
    totalStages: rift.quests.length,
    success: false,
  });
  if (u.riftHistory.length > 20) u.riftHistory = u.riftHistory.slice(-20);

  saveUsers();
  console.log(`[rift] ${uid} abandoned ${tier?.name || rift.tier} rift`);
  res.json({ ok: true, message: `Rift abandoned. ${tier?.failCooldownDays || 3}-day cooldown applied.` });
});

module.exports = router;
