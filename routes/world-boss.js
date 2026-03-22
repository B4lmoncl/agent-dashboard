/**
 * World Boss System — Community-wide bosses that all players fight together.
 * Players deal "damage" by completing quests. Boss active for 7 days.
 * Unique legendary drops, contribution leaderboard, titles for top contributors.
 */
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { state, saveUsers, RUNTIME_DIR } = require('../lib/state');
const { awardCurrency } = require('../lib/helpers');
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
    fs.writeFileSync(BOSS_FILE, JSON.stringify(worldBossState, null, 2));
  } catch (e) {
    console.error('[world-boss] Failed to save state:', e.message);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getActiveBoss() {
  const ab = worldBossState.activeBoss;
  if (!ab) return null;
  // Check if expired
  if (!ab.defeated && new Date(ab.expiresAt) < new Date()) {
    // Boss expired undefeated — move to history
    ab.expired = true;
    worldBossState.history.push({ ...ab });
    worldBossState.activeBoss = null;
    saveWorldBossState();
    return null;
  }
  return ab;
}

function getBossTemplate(bossId) {
  return bossData.bosses.find(b => b.id === bossId) || null;
}

function calcMaxHp() {
  const playerCount = Object.keys(state.users).length;
  const scaled = playerCount * bossData.config.hpPerPlayer;
  return Math.max(scaled, bossData.config.minHp);
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
  const expiresAt = new Date(now.getTime() + bossData.config.activeDurationDays * 24 * 60 * 60 * 1000);
  const maxHp = calcMaxHp();

  const boss = {
    bossId: template.id,
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

  const dmg = bossData.config.damagePerQuest[questRarity] || bossData.config.damagePerQuest.common;

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
 * Auto-spawn check — called from checkPeriodicTasks or boot.
 * Spawns a new boss if enough time has passed since the last one.
 */
function checkAutoSpawn() {
  // Don't spawn if there's already an active boss
  if (getActiveBoss()) return;

  const intervalMs = bossData.config.spawnIntervalDays * 24 * 60 * 60 * 1000;
  const lastEnded = worldBossState.history.length > 0
    ? worldBossState.history[worldBossState.history.length - 1].defeatedAt
      || worldBossState.history[worldBossState.history.length - 1].expiresAt
    : null;

  if (!lastEnded) {
    // No history — spawn first boss if we have players
    if (Object.keys(state.users).length > 0) {
      spawnBoss();
    }
    return;
  }

  const elapsed = Date.now() - new Date(lastEnded).getTime();
  if (elapsed >= intervalMs) {
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
    const nextSpawnEstimate = lastEnded
      ? new Date(new Date(lastEnded).getTime() + bossData.config.spawnIntervalDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

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
    },
    leaderboard,
    playerContribution,
    canClaim: boss.defeated && playerId && playerContribution && !boss.rewardsClaimed.includes(playerId),
  });
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
  const uid = req.auth?.userId;
  const user = uid ? state.users[uid] : null;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const boss = worldBossState.activeBoss;
  if (!boss || !boss.defeated) {
    return res.status(400).json({ error: 'No defeated boss to claim rewards from' });
  }

  if (!boss.contributions[uid]) {
    return res.status(400).json({ error: 'You did not contribute to this boss fight' });
  }

  if (boss.rewardsClaimed.includes(uid)) {
    return res.status(400).json({ error: 'Rewards already claimed' });
  }

  const template = getBossTemplate(boss.bossId);
  const leaderboard = getContributionLeaderboard(boss, 999);
  const rank = leaderboard.findIndex(e => e.playerId === uid) + 1;
  const contribution = boss.contributions[uid];
  const totalDamage = boss.maxHp - boss.currentHp || boss.maxHp; // avoid /0
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
        source: 'world-boss',
        earnedAt: new Date().toISOString(),
      });
      rewards.push({ type: 'title', name: template.titleReward });
    }
  }

  // ── #1 contributor: Exclusive frame ──
  if (rank === 1 && template?.frameReward) {
    if (!user.frames) user.frames = [];
    const frameId = `${template.frameReward.id}-${boss.spawnedAt.slice(0, 10)}`;
    if (!user.frames.find(f => f.id === frameId)) {
      user.frames.push({
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
      if (!user.inventory) user.inventory = [];
      user.inventory.push({
        id: `${dropId}-${Date.now()}`,
        templateId: dropId,
        name: dropId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        rarity: 'legendary',
        source: 'world-boss',
        bossId: template.id,
        obtainedAt: new Date().toISOString(),
      });
      rewards.push({ type: 'legendary-drop', itemId: dropId });
    }
  }

  // ── Bonus stardust for high contributors ──
  if (contributionPercent >= 0.1) {
    const bonusStardust = Math.floor(contributionPercent * 50);
    awardCurrency(uid, 'stardust', bonusStardust);
    rewards.push({ type: 'stardust', amount: bonusStardust });
  }

  boss.rewardsClaimed.push(uid);
  saveWorldBossState();
  saveUsers();

  res.json({
    rewards,
    rank,
    contribution,
    contributionPercent: Math.round(contributionPercent * 10000) / 100,
  });
});

// ─── POST /api/world-boss/spawn — Admin: force spawn ───────────────────────

router.post('/api/world-boss/spawn', requireMasterKey, (req, res) => {
  const { bossId } = req.body;

  // If there's an active boss, move it to history first
  const current = getActiveBoss();
  if (current) {
    current.expired = true;
    worldBossState.history.push({ ...current });
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

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = router;
module.exports.loadWorldBossState = loadWorldBossState;
module.exports.checkAutoSpawn = checkAutoSpawn;
module.exports.dealBossDamage = dealBossDamage;
