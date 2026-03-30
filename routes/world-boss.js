/**
 * World Boss System — Community-wide bosses that all players fight together.
 * Players deal "damage" by completing quests. Boss active for 7 days.
 * Unique legendary drops, contribution leaderboard, titles for top contributors.
 */
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { state, saveUsers, ensureUserCurrencies, RUNTIME_DIR, ensureRuntimeDir } = require('../lib/state');
const { awardCurrency, spendCurrency, createUniqueInstance, trackUniqueInCollection, createPlayerLock } = require('../lib/helpers');
const wbClaimLock = createPlayerLock('wb-claim');
const wbBoostLock = createPlayerLock('wb-boost');
const { requireAuth, requireMasterKey } = require('../lib/middleware');

// ─── Data & Config ──────────────────────────────────────────────────────────

const bossData = require('../public/data/worldBosses.json');
const BOSS_FILE = path.join(RUNTIME_DIR, 'worldBoss.json');

// ─── State ──────────────────────────────────────────────────────────────────

let worldBossState = {
  activeBoss: null,
  history: [],
  lastSpawnCheck: null,
};

// ─── Persistence ────────────────────────────────────────────────────────────

function loadWorldBossState() {
  try {
    if (fs.existsSync(BOSS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(BOSS_FILE, 'utf8'));
      if (raw && typeof raw === 'object') {
        worldBossState.activeBoss = raw.activeBoss || null;
        worldBossState.history = raw.history || [];
        worldBossState.lastSpawnCheck = raw.lastSpawnCheck || null;
      }
    }
  } catch (e) {
    console.warn('[world-boss] Failed to load state:', e.message);
  }
}

function saveWorldBossState() {
  try {
    ensureRuntimeDir();
    const tmp = BOSS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(worldBossState, null, 2));
    fs.renameSync(tmp, BOSS_FILE);
  } catch (e) {
    console.error('[world-boss] Failed to save state:', e.message);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getActiveBoss() {
  const ab = worldBossState.activeBoss;
  if (!ab) return null;
  // Check if expired
  if (!ab.defeated && new Date(ab.expiresAt).getTime() < Date.now()) {
    // Boss expired undefeated — move to history
    ab.expired = true;
    // Strip large contributions map before archiving to keep history lean
    const archived = { ...ab, contributorCount: Object.keys(ab.contributions).length };
    delete archived.contributions;
    delete archived.rewardsClaimed;
    worldBossState.history.push(archived);
    // Cap history at 50 entries
    if (worldBossState.history.length > 50) worldBossState.history = worldBossState.history.slice(-50);
    worldBossState.activeBoss = null;
    saveWorldBossState();
    return null;
  }
  return ab;
}

function getBossTemplate(bossId) {
  return bossData.bosses.find(b => b.id === bossId) || null;
}

const WB_MIN_LEVEL = 15;

function calcMaxHp(template) {
  const { getLevelInfo } = require('../lib/helpers');
  // Only count players who have reached the WB unlock level
  const eligibleCount = Object.values(state.users).filter(u => getLevelInfo(u.xp || 0).level >= WB_MIN_LEVEL).length;
  const scaled = Math.max(1, eligibleCount) * bossData.config.hpPerPlayer;
  // Use template HP if available (individual boss difficulty), scale up with eligible player count
  const templateHp = template?.hp || 0;
  return Math.max(templateHp, scaled, bossData.config.minHp);
}

function pickNextBoss() {
  // Pick a boss that wasn't the most recent one
  const lastBossId = worldBossState.history.length > 0
    ? worldBossState.history[worldBossState.history.length - 1].bossId
    : null;
  const candidates = bossData.bosses.filter(b => b.id !== lastBossId);
  if (candidates.length === 0) return bossData.bosses[0];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function spawnBoss(bossId) {
  const template = bossId ? getBossTemplate(bossId) : pickNextBoss();
  if (!template) return null;

  const now = new Date();
  const expiresAt = getNextMondayMidnight();
  // If we're on Monday and it's early, make sure we don't expire immediately
  if (expiresAt.getTime() - now.getTime() < 12 * 60 * 60 * 1000) {
    expiresAt.setDate(expiresAt.getDate() + 7);
  }
  const maxHp = calcMaxHp(template);

  const boss = {
    bossId: template.id,
    weekId: getWeekId(),
    spawnedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    maxHp,
    currentHp: maxHp,
    defeated: false,
    defeatedAt: null,
    contributions: {},
    rewardsClaimed: [],
  };

  worldBossState.activeBoss = boss;
  worldBossState.lastSpawnCheck = now.toISOString();
  saveWorldBossState();
  console.log(`[world-boss] Spawned "${template.name}" with ${maxHp} HP (expires ${expiresAt.toISOString()})`);
  return boss;
}

/**
 * Deal damage to the active boss. Called from onQuestCompletedByUser.
 */
function dealBossDamage(userId, questRarity) {
  const boss = getActiveBoss();
  if (!boss || boss.defeated) return null;

  // Only players who reached WB unlock level can deal damage
  const { getGearScore, getLevelInfo } = require('../lib/helpers');
  const dmgUser = state.users[userId];
  if (!dmgUser || getLevelInfo(dmgUser.xp || 0).level < WB_MIN_LEVEL) return null;

  const baseDmg = bossData.config.damagePerQuest[questRarity] || bossData.config.damagePerQuest.common;
  // Gear Score multiplier: every 50 GS = +10% damage (additive, cap +100%)
  const { gearScore } = getGearScore(userId);
  const gsMulti = Math.min(2.0, 1 + Math.floor(gearScore / 50) * 0.10);
  let dmg = Math.round(baseDmg * gsMulti);

  // Check for world_boss_damage_boost buff
  const u = state.users[userId];
  if (u && u.activeBuffs && Array.isArray(u.activeBuffs)) {
    const boostIdx = u.activeBuffs.findIndex(b => b.type === 'world_boss_damage_boost' && (b.questsRemaining || 0) > 0);
    if (boostIdx !== -1) {
      const boost = u.activeBuffs[boostIdx];
      dmg = Math.round(dmg * (1 + (boost.value || 25) / 100));
      boost.questsRemaining -= 1;
      if (boost.questsRemaining <= 0) {
        u.activeBuffs.splice(boostIdx, 1);
      }
    }
  }

  // Update contribution
  if (!boss.contributions[userId]) {
    boss.contributions[userId] = { damage: 0, quests: 0 };
  }
  boss.contributions[userId].damage += dmg;
  boss.contributions[userId].quests += 1;

  // Apply damage
  boss.currentHp = Math.max(0, boss.currentHp - dmg);

  // Check if defeated
  if (boss.currentHp <= 0) {
    boss.defeated = true;
    boss.defeatedAt = new Date().toISOString();
    console.log(`[world-boss] "${boss.bossId}" defeated! ${Object.keys(boss.contributions).length} contributors.`);
  }

  saveWorldBossState();
  return { damage: dmg, currentHp: boss.currentHp, defeated: boss.defeated };
}

/**
 * Get ISO week ID (same as challenges-weekly) for sync.
 */
function getWeekId() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Get next Monday midnight (Berlin-aware) for boss expiration.
 */
function getNextMondayMidnight() {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day);
  const next = new Date(d);
  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Auto-spawn check — synced with weekly challenge cycle.
 * Spawns a new boss every Monday (ISO week boundary).
 */
function checkAutoSpawn() {
  // Don't spawn if there's already an active boss
  if (getActiveBoss()) return;

  const weekId = getWeekId();

  // Check if we already spawned a boss this week
  const lastBoss = worldBossState.history.length > 0
    ? worldBossState.history[worldBossState.history.length - 1]
    : null;

  if (lastBoss && lastBoss.weekId === weekId) {
    // Already had a boss this week (defeated or expired)
    return;
  }

  // Spawn a new boss if we have players
  if (Object.keys(state.users).length > 0) {
    spawnBoss();
  }
}

function getContributionLeaderboard(boss, limit = 20) {
  if (!boss || !boss.contributions) return [];
  return Object.entries(boss.contributions)
    .map(([playerId, data]) => ({
      playerId,
      damage: data.damage,
      quests: data.quests,
      name: state.users[playerId]?.name || playerId,
    }))
    .sort((a, b) => b.damage - a.damage)
    .slice(0, limit);
}

// ─── GET /api/world-boss — Current boss status ─────────────────────────────

router.get('/api/world-boss', (req, res) => {
  const boss = getActiveBoss();
  const playerId = req.query.player?.toLowerCase();

  if (!boss) {
    // Check if there's an upcoming spawn estimate
    const lastEnded = worldBossState.history.length > 0
      ? worldBossState.history[worldBossState.history.length - 1].defeatedAt
        || worldBossState.history[worldBossState.history.length - 1].expiresAt
      : null;
    // Next boss spawns next Monday (synced with weekly challenge reset)
    const nextSpawnEstimate = getNextMondayMidnight().toISOString();

    return res.json({
      active: false,
      nextSpawnEstimate,
      lastBoss: worldBossState.history.length > 0
        ? worldBossState.history[worldBossState.history.length - 1]
        : null,
    });
  }

  const template = getBossTemplate(boss.bossId);
  const leaderboard = getContributionLeaderboard(boss);
  const playerContribution = playerId && boss.contributions[playerId]
    ? boss.contributions[playerId]
    : null;
  const contributorCount = Object.keys(boss.contributions).length;
  const totalDamageDealt = boss.maxHp - boss.currentHp;

  // Resolve unique item details for loot preview
  const uniqueItemDetails = (template.uniqueDrops || []).map(uid => {
    const u = state.uniqueItemsById?.get(uid);
    if (!u) return null;
    return { id: u.id, name: u.name, slot: u.slot, desc: u.desc, flavorText: u.flavorText, legendaryEffect: u.legendaryEffect, icon: u.icon };
  }).filter(Boolean);

  res.json({
    active: true,
    boss: {
      ...template,
      spawnedAt: boss.spawnedAt,
      expiresAt: boss.expiresAt,
      maxHp: boss.maxHp,
      currentHp: boss.currentHp,
      defeated: boss.defeated,
      defeatedAt: boss.defeatedAt,
      contributorCount,
      totalDamageDealt,
      uniqueItemDetails,
    },
    leaderboard,
    playerContribution,
    canClaim: boss.defeated && playerId && playerContribution && !boss.rewardsClaimed.includes(playerId),
    projectedDamage: (() => {
      if (!playerId) return null;
      const { getGearScore } = require('../lib/helpers');
      const { gearScore } = getGearScore(playerId);
      const gsMulti = Math.min(2.0, 1 + Math.floor(gearScore / 50) * 0.10);
      const dmgPerRarity = {};
      for (const [rarity, base] of Object.entries(bossData.config.damagePerQuest)) {
        dmgPerRarity[rarity] = Math.round(base * gsMulti);
      }
      return { gearScore, gsMultiplier: gsMulti, perQuest: dmgPerRarity };
    })(),
  });
});

// ─── GET /api/world-boss/history — Past boss encounters ─────────────────────

router.get('/api/world-boss/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const history = (worldBossState.history || []).slice(-limit).reverse();
  const enriched = history.map(h => {
    const template = getBossTemplate(h.bossId);
    return {
      ...h,
      name: template?.name || h.bossId,
      title: template?.title || '',
      icon: template?.icon || '',
      accent: template?.accent || '#888',
    };
  });
  res.json({ history: enriched });
});

// ─── POST /api/world-boss/damage — Record quest damage ─────────────────────

router.post('/api/world-boss/damage', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const { rarity } = req.body;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const result = dealBossDamage(uid, rarity || 'common');
  if (!result) return res.json({ active: false, message: 'No active boss' });

  res.json({
    damage: result.damage,
    currentHp: result.currentHp,
    defeated: result.defeated,
  });
});

// ─── POST /api/world-boss/claim — Claim rewards after defeat ────────────────

router.post('/api/world-boss/claim', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  if (!wbClaimLock.acquire(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { getLevelInfo } = require('../lib/helpers');
  const playerLevel = getLevelInfo(user.xp || 0).level;
  if (playerLevel < WB_MIN_LEVEL) {
    return res.status(403).json({ error: `World Boss requires Level ${WB_MIN_LEVEL} (you are Level ${playerLevel})` });
  }

  const boss = worldBossState.activeBoss;
  if (!boss || !boss.defeated) {
    return res.status(400).json({ error: 'No defeated boss to claim rewards from' });
  }

  if (!boss.contributions[uid]) {
    return res.status(400).json({ error: 'You did not contribute to this boss fight' });
  }

  // Double-claim guard: check BEFORE push (safe in single-threaded Node.js)
  if (boss.rewardsClaimed.includes(uid)) {
    return res.status(400).json({ error: 'Rewards already claimed' });
  }
  boss.rewardsClaimed.push(uid);

  const template = getBossTemplate(boss.bossId);
  const leaderboard = getContributionLeaderboard(boss, 999);
  const rank = leaderboard.findIndex(e => e.playerId === uid) + 1;
  const contribution = boss.contributions[uid];
  const totalDamage = Math.max(boss.maxHp - boss.currentHp, 1); // avoid /0
  const contributionPercent = contribution.damage / totalDamage;

  const rewards = [];

  // ── Base rewards (all participants) ──
  const baseGold = Math.floor(50 + contribution.damage * 0.5);
  const baseEssenz = Math.floor(5 + contribution.damage * 0.1);
  awardCurrency(uid, 'gold', baseGold);
  awardCurrency(uid, 'essenz', baseEssenz);
  rewards.push({ type: 'gold', amount: baseGold });
  rewards.push({ type: 'essenz', amount: baseEssenz });

  // ── Top 3: Unique title ──
  if (rank <= 3 && template?.titleReward) {
    if (!user.earnedTitles) user.earnedTitles = [];
    const titleId = `wb-${template.id}-${boss.spawnedAt.slice(0, 10)}`;
    if (!user.earnedTitles.find(t => t.id === titleId)) {
      user.earnedTitles.push({
        id: titleId,
        name: template.titleReward,
        rarity: 'legendary',
        source: 'world-boss',
        earnedAt: new Date().toISOString(),
      });
      rewards.push({ type: 'title', name: template.titleReward });
    }
  }

  // ── #1 contributor: Exclusive frame ──
  if (rank === 1 && template?.frameReward) {
    if (!user.unlockedFrames) user.unlockedFrames = [];
    const frameId = `${template.frameReward.id}-${boss.spawnedAt.slice(0, 10)}`;
    if (!user.unlockedFrames.find(f => f.id === frameId)) {
      user.unlockedFrames.push({
        id: frameId,
        name: template.frameReward.name,
        color: template.frameReward.color,
        glow: template.frameReward.glow || false,
        source: 'world-boss',
        earnedAt: new Date().toISOString(),
      });
      rewards.push({ type: 'frame', name: template.frameReward.name });
    }
  }

  // ── Unique legendary drop (random, scales with contribution %) ──
  if (template?.uniqueDrops && template.uniqueDrops.length > 0) {
    // Base 5% chance, scales up to 25% for highest contributor
    const dropChance = Math.min(0.05 + contributionPercent * 0.5, 0.25);
    if (Math.random() < dropChance) {
      const dropId = template.uniqueDrops[Math.floor(Math.random() * template.uniqueDrops.length)];
      // Look up unique template from loaded data
      const uniqueTemplate = state.uniqueItemsById.get(dropId);
      if (uniqueTemplate) {
        // Check if player already owns this unique (only one of each allowed)
        const alreadyOwns = (user.equipment && Object.values(user.equipment).some(e => e && e.templateId === dropId && e.isUnique))
          || (user.inventory || []).some(i => i.templateId === dropId && i.isUnique);
        if (!alreadyOwns) {
          const gearInstance = createUniqueInstance(uniqueTemplate);
          if (!user.inventory) user.inventory = [];
          user.inventory.push(gearInstance);
          // Track in collection log
          trackUniqueInCollection(uid, dropId);
          if (!user.collectionLogDates) user.collectionLogDates = {};
          user.collectionLogDates[dropId] = new Date().toISOString();
          rewards.push({ type: 'unique-drop', itemId: dropId, name: uniqueTemplate.name, slot: uniqueTemplate.slot });
        }
      } else {
        // Fallback: unique template not found, use legacy behavior
        if (!user.inventory) user.inventory = [];
        user.inventory.push({
          id: `${dropId}-${Date.now()}`,
          templateId: dropId,
          name: dropId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          rarity: 'legendary',
          source: 'world-boss',
          bossId: template ? template.id : boss.bossId,
          obtainedAt: new Date().toISOString(),
        });
        rewards.push({ type: 'legendary-drop', itemId: dropId });
      }
    }
  }

  // ── Boss-exclusive gear drop (from gearTemplates-worldboss.json pool) ──
  {
    const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const minRarity = rank <= 3 ? 'epic' : rank <= 10 ? 'rare' : 'uncommon';
    const minIdx = RARITY_ORDER.indexOf(minRarity);
    const playerLevel = getLevelInfo(user.xp || 0).level;
    const bossItems = state.FULL_GEAR_ITEMS.filter(gi =>
      gi.source === `world_boss:${boss.bossId}` &&
      (gi.minLevel || gi.reqLevel || 1) <= playerLevel &&
      RARITY_ORDER.indexOf(gi.rarity || 'common') >= minIdx
    );
    if (bossItems.length > 0 && Math.random() < 0.6) {
      const template = bossItems[Math.floor(Math.random() * bossItems.length)];
      const { createGearInstance, rollSuffix } = require('../lib/helpers');
      const instance = rollSuffix(createGearInstance(template));
      if (!user.inventory) user.inventory = [];
      user.inventory.push(instance);
      rewards.push({ type: 'gear-drop', name: instance.name, rarity: instance.rarity, slot: instance.slot });
    }
  }

  // ── Guaranteed Seelensplitter (all contributors) ──
  user.craftingMaterials = user.craftingMaterials || {};
  user.craftingMaterials.seelensplitter = (user.craftingMaterials.seelensplitter || 0) + 1;
  rewards.push({ type: 'material', name: 'Seelensplitter', materialId: 'seelensplitter', amount: 1 });

  // ── Bonus stardust for high contributors ──
  if (contributionPercent >= 0.1) {
    const bonusStardust = Math.floor(contributionPercent * 50);
    awardCurrency(uid, 'stardust', bonusStardust);
    rewards.push({ type: 'stardust', amount: bonusStardust });
  }

  // Battle Pass XP for world boss kill
  try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(user, 'quest_complete', { rarity: 'legendary' }); } catch (e) { console.warn('[bp-xp] world-boss:', e.message); }

  // rewardsClaimed already pushed at top of endpoint (race condition guard)
  saveWorldBossState();
  saveUsers();

  res.json({
    rewards,
    rank,
    contribution,
    contributionPercent: Math.round(contributionPercent * 10000) / 100,
  });
  } finally { wbClaimLock.release(uid); }
});

// ─── POST /api/world-boss/spawn — Admin: force spawn ───────────────────────

router.post('/api/world-boss/spawn', requireMasterKey, (req, res) => {
  const { bossId } = req.body;

  // If there's an active boss, move it to history first (strip contributions like regular expiry)
  const current = getActiveBoss();
  if (current) {
    current.expired = true;
    const { contributions, ...archiveSafe } = current;
    worldBossState.history.push(archiveSafe);
    worldBossState.activeBoss = null;
  }

  const boss = spawnBoss(bossId || null);
  if (!boss) return res.status(400).json({ error: 'Failed to spawn boss' });

  const template = getBossTemplate(boss.bossId);
  res.json({
    message: `Spawned ${template?.name || boss.bossId}`,
    boss: { ...template, ...boss },
  });
});

// ─── POST /api/world-boss/boost — Mondstaub damage boost ─────────────────────

router.post('/api/world-boss/boost', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  if (!wbBoostLock.acquire(uid)) return res.status(429).json({ error: 'Boost in progress' });
  try {
  const u = uid ? state.users[uid] : null;
  if (!u) return res.status(404).json({ error: 'User not found' });

  const boss = getActiveBoss();
  if (!boss || boss.defeated) {
    return res.status(400).json({ error: 'No active boss to boost against' });
  }

  // Max 1 active boss boost at a time
  u.activeBuffs = u.activeBuffs || [];
  const existingBoost = u.activeBuffs.find(b => b.type === 'world_boss_damage_boost' && (b.questsRemaining || 0) > 0);
  if (existingBoost) {
    return res.status(400).json({ error: `Already have an active boss damage boost (${existingBoost.questsRemaining} quests remaining)` });
  }

  // Cost: 50 mondstaub
  const cost = 50;
  ensureUserCurrencies(u);
  const hasMondstaub = (u.currencies?.mondstaub ?? 0);
  if (hasMondstaub < cost) {
    return res.status(400).json({ error: `Not enough Mondstaub — need ${cost}, have ${hasMondstaub}` });
  }

  // Deduct mondstaub
  if (!spendCurrency(uid, 'mondstaub', cost)) {
    return res.status(400).json({ error: 'Failed to deduct Mondstaub' });
  }

  // Grant buff
  u.activeBuffs.push({
    type: 'world_boss_damage_boost',
    value: 25,
    questsRemaining: 10,
    activatedAt: new Date().toISOString(),
  });

  saveUsers();

  res.json({
    success: true,
    message: 'Mondstaub-Boost activated! +25% boss damage for next 10 quests.',
    buff: { type: 'world_boss_damage_boost', value: 25, questsRemaining: 10 },
    mondstaubSpent: cost,
    mondstaubRemaining: u.currencies?.mondstaub ?? 0,
  });
  console.log(`[world-boss] ${uid} activated mondstaub boost (+25% dmg, 10 quests)`);
  } finally { wbBoostLock.release(uid); }
});

// ─── Exports ────────────────────────────────────────────────────────────────

function isWorldBossActive() {
  const ab = worldBossState.activeBoss;
  return !!(ab && !ab.defeated && new Date(ab.expiresAt).getTime() > Date.now());
}

module.exports = router;
module.exports.loadWorldBossState = loadWorldBossState;
module.exports.checkAutoSpawn = checkAutoSpawn;
module.exports.dealBossDamage = dealBossDamage;
module.exports.isWorldBossActive = isWorldBossActive;
