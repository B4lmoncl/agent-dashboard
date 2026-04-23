/**
 * Expedition Routes — Cooperative weekly challenge
 * All players contribute quests toward shared checkpoints.
 * Scaling: questsPerPlayer × total registered players (no cap — active players compensate for inactive).
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies, RUNTIME_DIR, ensureRuntimeDir } = require('../lib/state');

// ─── Player lock for expedition claims ──────────────────────────────────────
const _expClaimLocks = new Map();
function acquireExpClaimLock(uid) { if (_expClaimLocks.has(uid)) return false; _expClaimLocks.set(uid, true); return true; }
function releaseExpClaimLock(uid) { _expClaimLocks.delete(uid); }
const { now, awardCurrency } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');
const { getWeekId } = require('./challenges-weekly');

// ─── Load expedition data ───────────────────────────────────────────────────
let EXPEDITION_DATA = { expedition: { templates: [], checkpointRewards: {}, questsPerPlayerPerCheckpoint: [8, 12, 18, 25], bonusTitles: [] } };

function loadExpeditions() {
  const filePath = path.join(__dirname, '..', 'public', 'data', 'expeditions.json');
  try {
    if (fs.existsSync(filePath)) {
      EXPEDITION_DATA = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      state.expeditionData = EXPEDITION_DATA.expedition;
      console.log(`[expedition] Loaded ${EXPEDITION_DATA.expedition.templates.length} expedition templates`);
    }
  } catch (e) {
    console.warn('[expedition] Failed to load:', e.message);
  }
}

// ─── Expedition state persistence ───────────────────────────────────────────
const EXPEDITION_FILE = path.join(RUNTIME_DIR, 'expedition.json');

function loadExpeditionState() {
  try {
    if (fs.existsSync(EXPEDITION_FILE)) {
      const raw = JSON.parse(fs.readFileSync(EXPEDITION_FILE, 'utf8'));
      if (raw && typeof raw === 'object') {
        state.expedition = raw;
      }
    }
  } catch (e) {
    console.warn('[expedition] Failed to load state:', e.message);
  }
}

let _saveTimer = null;
function saveExpeditionState() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      ensureRuntimeDir();
      const tmp = EXPEDITION_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state.expedition, null, 2));
      fs.renameSync(tmp, EXPEDITION_FILE);
    } catch (e) {
      console.warn('[expedition] Failed to save state:', e.message);
    }
  }, 200);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPlayerCount() {
  // Count all registered non-agent players
  const agentIds = new Set(Object.keys(state.store.agents));
  return Object.values(state.users).filter(u => !agentIds.has(u.id)).length;
}

function ensureExpedition() {
  const weekId = getWeekId();

  // If expedition exists and is current, return it
  if (state.expedition && state.expedition.weekId === weekId) {
    return state.expedition;
  }

  // Create new expedition for this week
  const templates = EXPEDITION_DATA.expedition?.templates || [];
  if (templates.length === 0) return null;

  const weekSeed = parseInt(weekId.replace(/\D/g, ''), 10);
  // Use different offset from challenge template selection so they don't always align
  const template = templates[(weekSeed + 3) % templates.length];
  const playerCount = Math.max(1, getPlayerCount());
  const perPlayer = EXPEDITION_DATA.expedition?.questsPerPlayerPerCheckpoint || [8, 12, 18, 25];

  state.expedition = {
    weekId,
    templateId: template.id,
    playerCount,
    totalRequired: perPlayer.map(pp => pp * playerCount),
    progress: 0,
    contributions: {},
    checkpointsReached: [],
    claimedRewards: {},
    startedAt: now(),
  };
  saveExpeditionState();
  return state.expedition;
}

// Called from quest completion to auto-contribute
function contributeQuest(userId) {
  const exp = ensureExpedition();
  if (!exp) return;

  exp.progress = (exp.progress || 0) + 1;
  exp.contributions[userId] = (exp.contributions[userId] || 0) + 1;

  // Check if new checkpoints are reached
  let newCheckpoint = false;
  for (let i = 0; i < exp.totalRequired.length; i++) {
    const cpNum = i + 1;
    if (exp.progress >= exp.totalRequired[i] && !exp.checkpointsReached.includes(cpNum)) {
      exp.checkpointsReached.push(cpNum);
      newCheckpoint = true;
    }
  }
  if (newCheckpoint) {
    const u = state.users[userId];
    if (u) u._lastExpeditionCheckpoint = true;
  }

  saveExpeditionState();
}

// ─── GET /api/expedition — get current expedition state ─────────────────────
router.get('/api/expedition', requireAuth, (req, res) => {
  const exp = ensureExpedition();
  if (!exp) return res.json({ expedition: null });

  const template = (EXPEDITION_DATA.expedition?.templates || []).find(t => t.id === exp.templateId);
  if (!template) return res.json({ expedition: null });

  const playerName = (req.query.player || '').toLowerCase();
  // Claimed-checkpoint status is private — only self or admin may see which
  // checkpoints the target player has already claimed. Public contributions
  // stay visible below because the expedition is a shared event.
  const isSelf = playerName && (req.auth?.userId === playerName || req.auth?.isAdmin);
  const u = (playerName && isSelf) ? state.usersByName.get(playerName) : null;

  const rewards = EXPEDITION_DATA.expedition?.checkpointRewards || {};
  const bonusTitles = EXPEDITION_DATA.expedition?.bonusTitles || [];
  const weekSeed = parseInt(exp.weekId.replace(/\D/g, ''), 10);
  const bonusTitle = bonusTitles.length > 0 ? bonusTitles[weekSeed % bonusTitles.length] : null;

  // Build checkpoint info — last checkpoint is always the bonus checkpoint
  const totalCheckpoints = exp.totalRequired.length;
  const checkpoints = exp.totalRequired.map((required, i) => {
    const cpNum = i + 1;
    const isBonus = cpNum === totalCheckpoints;
    const rewardKey = isBonus ? 'bonus' : String(cpNum);
    return {
      number: cpNum,
      name: template.checkpointNames[i] || `Checkpoint ${cpNum}`,
      flavor: (template.checkpointFlavor || [])[i] || null,
      required,
      reached: exp.checkpointsReached.includes(cpNum),
      rewards: rewards[rewardKey] || {},
      isBonus,
      bonusTitle: isBonus ? bonusTitle : null,
      claimedByPlayer: u ? (exp.claimedRewards[u.id] || []).includes(cpNum) : false,
    };
  });

  // Build contribution leaderboard (sorted by contribution, top contributors first)
  const contributions = Object.entries(exp.contributions)
    .map(([userId, count]) => {
      const user = state.users[userId];
      return { userId, name: user?.name || userId, avatar: user?.avatar || '??', color: user?.color || '#888', count };
    })
    .sort((a, b) => b.count - a.count);

  res.json({
    expedition: {
      weekId: exp.weekId,
      templateId: exp.templateId,
      name: template.name,
      description: template.description,
      icon: template.icon,
      progress: exp.progress,
      playerCount: exp.playerCount,
      checkpoints,
      contributions,
      playerContribution: u ? (exp.contributions[u.id] || 0) : 0,
      startedAt: exp.startedAt,
      progressMessages: template.progressMessages || null,
    },
  });
});

// POST /api/expedition/claim — claim checkpoint reward
router.post('/api/expedition/claim', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!acquireExpClaimLock(uid)) return res.status(429).json({ error: 'Claim in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const exp = ensureExpedition();
  if (!exp) return res.status(400).json({ error: 'No active expedition' });

  const { checkpoint } = req.body;
  const cpNum = parseInt(checkpoint, 10);
  const maxCheckpoints = exp.totalRequired.length;
  if (!cpNum || cpNum < 1 || cpNum > maxCheckpoints) {
    return res.status(400).json({ error: 'Invalid checkpoint' });
  }

  // Must have reached this checkpoint
  if (!exp.checkpointsReached.includes(cpNum)) {
    return res.status(400).json({ error: 'Checkpoint not yet reached' });
  }

  // Must have contributed at least 1 quest
  if ((exp.contributions[uid] || 0) < 1) {
    return res.status(400).json({ error: 'You must have contributed at least 1 quest' });
  }

  // Prevent double-claim
  exp.claimedRewards[uid] = exp.claimedRewards[uid] || [];
  if (exp.claimedRewards[uid].includes(cpNum)) {
    return res.status(409).json({ error: 'Reward already claimed' });
  }

  // Award rewards — last checkpoint is always the bonus checkpoint
  const isBonus = cpNum === maxCheckpoints;
  const rewardKey = isBonus ? 'bonus' : String(cpNum);
  const rewards = { ...(EXPEDITION_DATA.expedition?.checkpointRewards[rewardKey] || {}) };

  ensureUserCurrencies(u);
  if (rewards.xp) u.xp = (u.xp || 0) + rewards.xp;
  if (rewards.gold) awardCurrency(uid, 'gold', rewards.gold);
  if (rewards.runensplitter) awardCurrency(uid, 'runensplitter', rewards.runensplitter);
  if (rewards.essenz) awardCurrency(uid, 'essenz', rewards.essenz);
  if (rewards.sternentaler) awardCurrency(uid, 'sternentaler', rewards.sternentaler);

  // Award bonus title for bonus (last) checkpoint
  if (isBonus) {
    const bonusTitles = EXPEDITION_DATA.expedition?.bonusTitles || [];
    const weekSeed = parseInt(exp.weekId.replace(/\D/g, ''), 10);
    const bonusTitle = bonusTitles.length > 0 ? bonusTitles[weekSeed % bonusTitles.length] : null;
    if (bonusTitle) {
      u.earnedTitles = u.earnedTitles || [];
      if (!u.earnedTitles.some(t => t.id === bonusTitle.id)) {
        u.earnedTitles.push({ id: bonusTitle.id, name: bonusTitle.name, rarity: bonusTitle.rarity || 'rare', earnedAt: now() });
      }
    }
  }

  // Battle Pass XP
  try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'expedition_checkpoint'); } catch (e) { console.warn('[bp-xp] expedition_checkpoint:', e.message); }

  exp.claimedRewards[uid].push(cpNum);
  saveExpeditionState();
  saveUsers();

  res.json({
    message: `Checkpoint ${cpNum} reward claimed`,
    checkpoint: cpNum,
    rewards,
  });
  } finally { releaseExpClaimLock(uid); }
});

module.exports = router;
module.exports.loadExpeditions = loadExpeditions;
module.exports.loadExpeditionState = loadExpeditionState;
module.exports.contributeQuest = contributeQuest;
module.exports.ensureExpedition = ensureExpedition;
module.exports.getExpeditionData = () => EXPEDITION_DATA;
