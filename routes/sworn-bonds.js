// ─── Sworn Bonds — 1-on-1 friendship pact with shared weekly objectives ────
const router = require('express').Router();
const { state, saveSocial, ensureUserCurrencies, logActivity } = require('../lib/state');
const { now, getLevelInfo, createPlayerLock } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');

const bondLock = createPlayerLock('sworn-bond');
const BREAK_COOLDOWN_DAYS = 7;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWeekId() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getPreviousWeekId(weekId) {
  const [year, wStr] = weekId.split('-W');
  const wNum = parseInt(wStr, 10);
  if (wNum <= 1) {
    // Check if previous year had 53 weeks (Dec 31 is Thursday → 53 weeks)
    const prevYear = parseInt(year, 10) - 1;
    const dec31 = new Date(prevYear, 11, 31);
    const lastWeek = dec31.getDay() === 4 || (dec31.getDay() === 5 && new Date(prevYear, 1, 29).getMonth() === 1) ? 53 : 52;
    return `${prevYear}-W${String(lastWeek).padStart(2, '0')}`;
  }
  return `${year}-W${String(wNum - 1).padStart(2, '0')}`;
}

function genBondId() {
  return `bond-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function areFriends(a, b) {
  const al = (a || '').toLowerCase();
  const bl = (b || '').toLowerCase();
  return state.socialData.friendships.some(f =>
    (f.player1 === al && f.player2 === bl) || (f.player1 === bl && f.player2 === al)
  );
}

function getActiveBondForPlayer(playerId) {
  const pid = playerId.toLowerCase();
  return state.socialData.swornBonds.find(b =>
    (b.status === 'active' || b.status === 'pending') &&
    (b.player1 === pid || b.player2 === pid)
  ) || null;
}

function getBondLevel(bondXp) {
  const levels = state.SWORN_BOND_LEVELS;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (bondXp >= levels[i].minXp) return levels[i];
  }
  return levels[0];
}

function getBreakCooldownUntil(playerId) {
  const pid = playerId.toLowerCase();
  const broken = state.socialData.swornBonds
    .filter(b => b.status === 'broken' && b.brokenBy === pid && b.brokenAt)
    .sort((a, b) => new Date(b.brokenAt).getTime() - new Date(a.brokenAt).getTime());
  if (broken.length === 0) return null;
  const lastBroken = new Date(broken[0].brokenAt);
  const cooldownEnd = new Date(lastBroken.getTime() + BREAK_COOLDOWN_DAYS * 86400000);
  return cooldownEnd > new Date() ? cooldownEnd.toISOString() : null;
}

// ─── Objective Generation ───────────────────────────────────────────────────

const OBJECTIVE_TYPES = [
  {
    type: 'combined_quests',
    generate: (combinedLevel) => ({
      type: 'combined_quests',
      description: `Schließt zusammen ${6 + Math.floor(combinedLevel / 3)} Quests ab`,
      target: 6 + Math.floor(combinedLevel / 3),
      targetPerPlayer: null,
    }),
  },
  {
    type: 'combined_xp',
    generate: (combinedLevel) => ({
      type: 'combined_xp',
      description: `Verdient zusammen ${200 + combinedLevel * 20} XP`,
      target: 200 + combinedLevel * 20,
      targetPerPlayer: null,
    }),
  },
  {
    type: 'individual_quests',
    generate: (combinedLevel) => {
      const each = 3 + Math.floor(combinedLevel / 8);
      return {
        type: 'individual_quests',
        description: `Schließt jeweils ${each} Quests ab`,
        target: each * 2,
        targetPerPlayer: each,
      };
    },
  },
  {
    type: 'type_variety',
    generate: () => ({
      type: 'type_variety',
      description: 'Schließt jeweils Quests von 3 verschiedenen Typen ab',
      target: 6,
      targetPerPlayer: 3,
    }),
  },
];

function generateObjective(bond, weekId) {
  const u1 = state.users[bond.player1];
  const u2 = state.users[bond.player2];
  const lvl1 = getLevelInfo(u1?.xp || 0).level;
  const lvl2 = getLevelInfo(u2?.xp || 0).level;
  const combinedLevel = lvl1 + lvl2;

  // Deterministic pick based on weekId hash
  const hash = weekId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const typeIdx = hash % OBJECTIVE_TYPES.length;
  const obj = OBJECTIVE_TYPES[typeIdx].generate(combinedLevel);

  return {
    weekId,
    ...obj,
    progress: { player1: 0, player2: 0 },
    // For type_variety, track unique types per player
    _typesSeen: obj.type === 'type_variety' ? { player1: [], player2: [] } : undefined,
    completed: false,
    completedAt: null,
    chestClaimed: { player1: false, player2: false },
  };
}

function ensureBondWeeklyObjective(bond) {
  if (bond.status !== 'active') return;
  const currentWeek = getWeekId();

  if (!bond.weeklyObjective || bond.weeklyObjective.weekId !== currentWeek) {
    // Evaluate previous objective
    if (bond.weeklyObjective) {
      const objWeek = bond.weeklyObjective.weekId;
      const expectedPrevWeek = getPreviousWeekId(currentWeek);

      if (bond.weeklyObjective.completed && bond.lastCompletedWeekId !== objWeek) {
        // Objective was completed but streak not yet tracked
        bond.lastCompletedWeekId = objWeek;
        // Only increment streak if the completed week is DIRECTLY before current week (no gaps)
        if (objWeek === expectedPrevWeek) {
          bond.streak++;
          if (bond.streak > bond.longestStreak) bond.longestStreak = bond.streak;
        } else {
          // Gap detected (skipped week) — reset streak even though objective was completed
          bond.streak = 1; // this week counts as a fresh start
          if (bond.streak > bond.longestStreak) bond.longestStreak = bond.streak;
        }
      } else if (!bond.weeklyObjective.completed) {
        // Previous week failed — streak resets
        bond.streak = 0;
      }
      // else: already tracked (lastCompletedWeekId === objWeek) — no change
    }

    // Generate new objective
    bond.weeklyObjective = generateObjective(bond, currentWeek);
    saveSocial();
  }
}

// ─── Bond Progress Contribution (called from helpers.js) ────────────────────

function contributeToBond(userId, quest) {
  const pid = userId.toLowerCase();
  const bond = state.socialData.swornBonds.find(b =>
    b.status === 'active' && (b.player1 === pid || b.player2 === pid)
  );
  if (!bond) return;

  ensureBondWeeklyObjective(bond);
  const obj = bond.weeklyObjective;
  if (!obj || obj.completed) return;

  const playerKey = bond.player1 === pid ? 'player1' : 'player2';

  switch (obj.type) {
    case 'combined_quests':
    case 'individual_quests':
      obj.progress[playerKey]++;
      break;
    case 'combined_xp': {
      const u = state.users[pid];
      const xpEarned = u?._lastXpEarned || 0;
      obj.progress[playerKey] += xpEarned;
      break;
    }
    case 'type_variety': {
      const questType = quest.type || 'personal';
      if (obj._typesSeen && !obj._typesSeen[playerKey].includes(questType)) {
        obj._typesSeen[playerKey].push(questType);
        obj.progress[playerKey] = obj._typesSeen[playerKey].length;
      }
      break;
    }
  }

  // Check completion
  const totalProgress = obj.progress.player1 + obj.progress.player2;
  if (obj.targetPerPlayer) {
    // Both players must individually meet their target
    if (obj.progress.player1 >= obj.targetPerPlayer && obj.progress.player2 >= obj.targetPerPlayer) {
      obj.completed = true;
      obj.completedAt = now();
    }
  } else {
    if (totalProgress >= obj.target) {
      obj.completed = true;
      obj.completedAt = now();
    }
  }

  saveSocial();
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// Lazy prune broken bonds older than 30 days (cooldown is 7d, safe to remove after 30d)
function pruneStaleBonds() {
  const cutoff = Date.now() - 30 * 86400000;
  const before = state.socialData.swornBonds.length;
  state.socialData.swornBonds = state.socialData.swornBonds.filter(b =>
    b.status !== 'broken' || !b.brokenAt || new Date(b.brokenAt).getTime() > cutoff
  );
  if (state.socialData.swornBonds.length < before) saveSocial();
}

// GET /api/social/:playerId/sworn-bond — get active bond for player
router.get('/api/social/:playerId/sworn-bond', requireAuth, (req, res) => {
  pruneStaleBonds();
  const pid = req.params.playerId.toLowerCase();
  const bond = getActiveBondForPlayer(pid);

  if (!bond) {
    return res.json({
      bond: null,
      cooldownUntil: getBreakCooldownUntil(pid),
    });
  }

  if (bond.status === 'active') ensureBondWeeklyObjective(bond);

  const isP1 = bond.player1 === pid;
  const partnerId = isP1 ? bond.player2 : bond.player1;
  const partner = state.users[partnerId];
  const lvl = getBondLevel(bond.bondXp || 0);
  const nextLvl = state.SWORN_BOND_LEVELS.find(l => l.minXp > (bond.bondXp || 0));

  res.json({
    bond: {
      id: bond.id,
      status: bond.status,
      formedAt: bond.formedAt,
      isInitiator: isP1,
      partner: {
        id: partnerId,
        name: partner?.name || partnerId,
        avatar: partner?.avatar || partnerId.slice(0, 2).toUpperCase(),
        color: partner?.color || '#666666',
        level: getLevelInfo(partner?.xp || 0).level,
      },
      bondLevel: lvl.level,
      bondLevelTitle: lvl.title,
      bondXp: bond.bondXp || 0,
      bondXpToNext: nextLvl ? nextLvl.minXp : lvl.minXp,
      streak: bond.streak || 0,
      longestStreak: bond.longestStreak || 0,
      weeklyObjective: bond.status === 'active' ? {
        weekId: bond.weeklyObjective?.weekId,
        type: bond.weeklyObjective?.type,
        description: bond.weeklyObjective?.description,
        target: bond.weeklyObjective?.target,
        targetPerPlayer: bond.weeklyObjective?.targetPerPlayer,
        progress: {
          mine: isP1 ? bond.weeklyObjective?.progress?.player1 : bond.weeklyObjective?.progress?.player2,
          partner: isP1 ? bond.weeklyObjective?.progress?.player2 : bond.weeklyObjective?.progress?.player1,
        },
        completed: bond.weeklyObjective?.completed || false,
        completedAt: bond.weeklyObjective?.completedAt,
        chestClaimed: isP1
          ? bond.weeklyObjective?.chestClaimed?.player1
          : bond.weeklyObjective?.chestClaimed?.player2,
      } : null,
    },
    cooldownUntil: null,
  });
});

// POST /api/social/sworn-bond/propose — propose a bond to a friend
router.post('/api/social/sworn-bond/propose', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  if (!bondLock.acquire(uid)) return res.status(429).json({ error: 'Bond action in progress' });
  try {
    const { targetPlayer } = req.body;
    if (!targetPlayer) return res.status(400).json({ error: 'targetPlayer required' });
    const target = targetPlayer.toLowerCase();

    if (uid === target) return res.status(400).json({ error: 'A bond with yourself would be remarkably one-sided' });
    if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
    if (!state.users[target]) return res.status(404).json({ error: 'Target player not found' });
    if (!areFriends(uid, target)) return res.status(400).json({ error: 'You must be friends first' });

    // Tavern rest check
    if (state.users[uid]?.tavernRest?.active) return res.status(400).json({ error: 'Cannot form bonds while resting in The Hearth' });

    // Check existing bond
    const existing = getActiveBondForPlayer(uid);
    if (existing) return res.status(409).json({ error: 'You already have an active or pending bond' });
    const targetExisting = getActiveBondForPlayer(target);
    if (targetExisting) return res.status(409).json({ error: 'That player already has an active bond' });

    // Break cooldown
    const cooldown = getBreakCooldownUntil(uid);
    if (cooldown) return res.status(400).json({ error: `Bond cooldown active until ${new Date(cooldown).toLocaleDateString()}. You recently broke a bond.` });

    const bond = {
      id: genBondId(),
      player1: uid,
      player2: target,
      status: 'pending',
      formedAt: null,
      brokenAt: null,
      brokenBy: null,
      bondLevel: 1,
      bondXp: 0,
      streak: 0,
      longestStreak: 0,
      lastCompletedWeekId: null,
      weeklyObjective: null,
    };

    state.socialData.swornBonds.push(bond);
    saveSocial();

    res.json({ ok: true, bondId: bond.id, message: 'Bond proposal sent' });
  } finally { bondLock.release(uid); }
});

// POST /api/social/sworn-bond/:bondId/accept
router.post('/api/social/sworn-bond/:bondId/accept', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  if (!bondLock.acquire(uid)) return res.status(429).json({ error: 'Bond action in progress' });
  try {
    if (state.users[uid]?.tavernRest?.active) return res.status(400).json({ error: 'Cannot accept bonds while resting in The Hearth' });

    const bond = state.socialData.swornBonds.find(b => b.id === req.params.bondId);
    if (!bond) return res.status(404).json({ error: 'Bond not found' });
    if (bond.status !== 'pending') return res.status(400).json({ error: 'Bond is not pending' });
    if (bond.player2 !== uid) return res.status(403).json({ error: 'Only the invited player can accept' });

    // Check if recipient already has another bond
    const existing = state.socialData.swornBonds.find(b =>
      b.id !== bond.id && (b.status === 'active' || b.status === 'pending') &&
      (b.player1 === uid || b.player2 === uid)
    );
    if (existing) return res.status(409).json({ error: 'You already have an active or pending bond' });

    bond.status = 'active';
    bond.formedAt = now();
    bond.weeklyObjective = generateObjective(bond, getWeekId());
    logActivity(uid, 'sworn_bond_formed', { partner: bond.player1, rarity: 'rare' });
    logActivity(bond.player1, 'sworn_bond_formed', { partner: uid, rarity: 'rare' });
    saveSocial();

    res.json({ ok: true, message: 'Bond forged. The pact holds.' });
  } finally { bondLock.release(uid); }
});

// POST /api/social/sworn-bond/:bondId/cancel — initiator cancels pending proposal
router.post('/api/social/sworn-bond/:bondId/cancel', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  const bond = state.socialData.swornBonds.find(b => b.id === req.params.bondId);
  if (!bond) return res.status(404).json({ error: 'Bond not found' });
  if (bond.status !== 'pending') return res.status(400).json({ error: 'Bond is not pending' });
  if (bond.player1 !== uid) return res.status(403).json({ error: 'Only the initiator can cancel' });

  bond.status = 'broken';
  bond.brokenAt = now();
  bond.brokenBy = null; // No cooldown for cancelling own proposal
  saveSocial();

  res.json({ ok: true, message: 'Bond proposal cancelled' });
});

// POST /api/social/sworn-bond/:bondId/decline
router.post('/api/social/sworn-bond/:bondId/decline', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  const bond = state.socialData.swornBonds.find(b => b.id === req.params.bondId);
  if (!bond) return res.status(404).json({ error: 'Bond not found' });
  if (bond.status !== 'pending') return res.status(400).json({ error: 'Bond is not pending' });
  if (bond.player2 !== uid) return res.status(403).json({ error: 'Only the invited player can decline' });

  bond.status = 'broken';
  bond.brokenAt = now();
  bond.brokenBy = null; // No cooldown for declining
  saveSocial();

  res.json({ ok: true, message: 'Bond declined' });
});

// POST /api/social/sworn-bond/:bondId/break — break active bond
router.post('/api/social/sworn-bond/:bondId/break', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  if (!bondLock.acquire(uid)) return res.status(429).json({ error: 'Bond action in progress' });
  try {
    const bond = state.socialData.swornBonds.find(b => b.id === req.params.bondId);
    if (!bond) return res.status(404).json({ error: 'Bond not found' });
    if (bond.status !== 'active') return res.status(400).json({ error: 'Bond is not active' });
    if (bond.player1 !== uid && bond.player2 !== uid) return res.status(403).json({ error: 'You are not part of this bond' });

    bond.status = 'broken';
    bond.brokenAt = now();
    bond.brokenBy = uid;
    saveSocial();

    res.json({ ok: true, message: 'Bond broken. 7-day cooldown applies.' });
  } finally { bondLock.release(uid); }
});

// POST /api/social/sworn-bond/:bondId/claim-chest — claim weekly reward
router.post('/api/social/sworn-bond/:bondId/claim-chest', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  if (!bondLock.acquire(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
    const bond = state.socialData.swornBonds.find(b => b.id === req.params.bondId);
    if (!bond) return res.status(404).json({ error: 'Bond not found' });
    if (bond.status !== 'active') return res.status(400).json({ error: 'Bond is not active' });

    const isP1 = bond.player1 === uid;
    if (!isP1 && bond.player2 !== uid) return res.status(403).json({ error: 'You are not part of this bond' });

    const obj = bond.weeklyObjective;
    if (!obj || !obj.completed) return res.status(400).json({ error: 'Objective not yet completed' });

    const claimKey = isP1 ? 'player1' : 'player2';
    if (obj.chestClaimed[claimKey]) return res.status(400).json({ error: 'Already claimed this week' });

    // Calculate rewards
    const lvl = getBondLevel(bond.bondXp || 0);
    const streak = bond.streak || 0;
    const goldReward = 20 + (streak * 5) + (lvl.goldBonus || 0);
    const essenzReward = 3 + streak + (lvl.essenzBonus || 0);
    const duoFrameChance = Math.min(15, 5 + (lvl.level || 0));
    const wonFrame = Math.random() * 100 < duoFrameChance;

    // Award
    const u = state.users[uid];
    if (!u) return res.status(404).json({ error: 'Player not found' });
    ensureUserCurrencies(u);
    u.currencies.gold = (u.currencies.gold || 0) + goldReward;
    u.gold = u.currencies.gold;
    u.currencies.essenz = (u.currencies.essenz || 0) + essenzReward;

    // Duo frame cosmetic
    let frameAwarded = null;
    if (wonFrame) {
      const partnerId = isP1 ? bond.player2 : bond.player1;
      const partnerName = state.users[partnerId]?.name || partnerId;
      const frameName = `Bund: ${u.name || uid} & ${partnerName}`;
      if (!u.unlockedFrames) u.unlockedFrames = [];
      if (!u.unlockedFrames.some(f => f.id === `duo-${bond.id}`)) {
        u.unlockedFrames.push({ id: `duo-${bond.id}`, name: frameName, color: '#f59e0b', source: 'sworn-bond' });
        frameAwarded = frameName;
      }
    }

    // Bond XP
    const bondXpGained = 10 + (streak * 2);
    bond.bondXp = (bond.bondXp || 0) + bondXpGained;
    const newLvl = getBondLevel(bond.bondXp);
    bond.bondLevel = newLvl.level;

    // Track for adventure tome + achievements
    u._swornBondLevel = Math.max(u._swornBondLevel || 0, newLvl.level);

    // Mark claimed
    obj.chestClaimed[claimKey] = true;

    // Note: streak tracking is handled by ensureBondWeeklyObjective on week rollover
    // Do NOT set lastCompletedWeekId here — that would prevent streak increment

    saveSocial();
    // Activity feed
    const partnerId = isP1 ? bond.player2 : bond.player1;
    const partnerName = state.users[partnerId]?.name || partnerId;
    logActivity(uid, 'sworn_bond_chest', { partner: partnerName, streak: streak, bondLevel: newLvl.level, rarity: newLvl.level >= 5 ? 'epic' : 'rare' });

    // Battle Pass XP for bond chest
    try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'quest_complete', { rarity: 'rare' }); } catch (e) { console.warn('[bp-xp] sworn-bond:', e.message); }

    // Check achievements after bond level change
    try { const { checkAndAwardAchievements, checkAndAwardTitles } = require('../lib/helpers'); checkAndAwardAchievements(uid); checkAndAwardTitles(uid); } catch { /* optional */ }

    const { saveUsers } = require('../lib/state');
    saveUsers();

    res.json({
      ok: true,
      rewards: {
        gold: goldReward,
        essenz: essenzReward,
        frame: frameAwarded,
      },
      bondXpGained,
      newBondLevel: newLvl.level,
      newBondTitle: newLvl.title,
      streak,
      message: `Bond Chest opened. +${goldReward} Gold, +${essenzReward} Essenz.${frameAwarded ? ` Duo Frame earned: "${frameAwarded}".` : ''}`,
    });
  } finally { bondLock.release(uid); }
});

module.exports = router;
module.exports.contributeToBond = contributeToBond;
module.exports.ensureBondWeeklyObjective = ensureBondWeeklyObjective;
