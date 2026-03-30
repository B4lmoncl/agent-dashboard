const express = require("express");
const router = express.Router();
const { state, saveUsers } = require("../lib/state");
const { requireAuth } = require("../lib/middleware");
const { createPlayerLock, getLevelInfo } = require("../lib/helpers");
const talentLock = createPlayerLock('talent');

// ─── Load talent tree data ────────────────────────────────────────────────
const treeData = (() => {
  try {
    return require("../public/data/talentTree.json");
  } catch (e) {
    console.warn('[talent-tree] talentTree.json not found, using empty tree');
    return { meta: { unlockLevel: 10, pointsPerLevel: 1, maxPoints: 40, rings: 3 }, nodes: [] };
  }
})();

// Build node lookup map
const nodeById = new Map();
for (const node of (treeData.nodes || [])) {
  nodeById.set(node.id, node);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function ensureUserTalents(user) {
  if (!user.talents) {
    user.talents = { allocated: {}, totalSpent: 0 };
  }
  return user.talents;
}

function getAvailablePoints(user) {
  const lvl = getLevelInfo(user.xp || 0).level;
  const unlockLvl = treeData.meta.unlockLevel || 10;
  if (lvl < unlockLvl) return 0;
  const talents = ensureUserTalents(user);
  const earned = (lvl - unlockLvl + 1) * (treeData.meta.pointsPerLevel || 1);
  // Bonus points from "Opfergabe" (sacrifice legendary) — stored as _bonusTalentPoints
  const bonus = user._bonusTalentPoints || 0;
  return Math.max(0, earned + bonus - talents.totalSpent);
}

function canAllocate(user, nodeId) {
  const node = nodeById.get(nodeId);
  if (!node) return { ok: false, reason: 'Unknown node' };

  const talents = ensureUserTalents(user);
  if (talents.allocated[nodeId]) return { ok: false, reason: 'Already allocated' };

  const cost = node.cost || 1;
  if (getAvailablePoints(user) < cost) return { ok: false, reason: 'Not enough talent points' };

  // Check prerequisites
  if (node.requires && node.requires.length > 0) {
    for (const reqId of node.requires) {
      if (!talents.allocated[reqId]) {
        const reqNode = nodeById.get(reqId);
        return { ok: false, reason: `Requires: ${reqNode ? reqNode.name : reqId}` };
      }
    }
  }

  return { ok: true };
}

// ─── Get talent tree data + user state ─────────────────────────────────────
router.get('/api/talents', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  const user = state.users[uid];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const talents = ensureUserTalents(user);
  const lvl = getLevelInfo(user.xp || 0).level;

  res.json({
    meta: treeData.meta,
    paths: treeData.paths,
    nodes: treeData.nodes,
    allocated: talents.allocated,
    totalSpent: talents.totalSpent,
    availablePoints: getAvailablePoints(user),
    bonusPoints: user._bonusTalentPoints || 0,
    playerLevel: lvl,
    unlocked: lvl >= (treeData.meta.unlockLevel || 10),
  });
});

// ─── Allocate a talent point ───────────────────────────────────────────────
router.post('/api/talents/allocate', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  if (!talentLock.acquire(uid)) return res.status(429).json({ error: 'Talent allocation in progress' });
  try {
    const user = state.users[uid];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { nodeId } = req.body;
    if (!nodeId || typeof nodeId !== 'string') {
      return res.status(400).json({ error: 'nodeId required' });
    }

    const check = canAllocate(user, nodeId);
    if (!check.ok) return res.status(400).json({ error: check.reason });

    const node = nodeById.get(nodeId);
    const talents = ensureUserTalents(user);
    talents.allocated[nodeId] = {
      allocatedAt: new Date().toISOString(),
      effect: node.effect,
    };
    talents.totalSpent += (node.cost || 1);

    saveUsers();

    res.json({
      success: true,
      node: { id: node.id, name: node.name, effect: node.effect },
      availablePoints: getAvailablePoints(user),
      totalSpent: talents.totalSpent,
    });
  } finally {
    talentLock.release(uid);
  }
});

// ─── Deallocate a talent point ─────────────────────────────────────────────
router.post('/api/talents/deallocate', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  if (!talentLock.acquire(uid)) return res.status(429).json({ error: 'Talent operation in progress' });
  try {
    const user = state.users[uid];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { nodeId } = req.body;
    if (!nodeId || typeof nodeId !== 'string') {
      return res.status(400).json({ error: 'nodeId required' });
    }

    const talents = ensureUserTalents(user);
    if (!talents.allocated[nodeId]) {
      return res.status(400).json({ error: 'Node not allocated' });
    }

    const node = nodeById.get(nodeId);
    if (!node) return res.status(400).json({ error: 'Unknown node' });

    // Check if any other allocated node depends on this one
    for (const [allocId] of Object.entries(talents.allocated)) {
      if (allocId === nodeId) continue;
      const allocNode = nodeById.get(allocId);
      if (allocNode && allocNode.requires && allocNode.requires.includes(nodeId)) {
        return res.status(400).json({ error: `Cannot remove: ${allocNode.name} depends on this node` });
      }
    }

    delete talents.allocated[nodeId];
    talents.totalSpent -= (node.cost || 1);
    if (talents.totalSpent < 0) talents.totalSpent = 0;

    saveUsers();

    res.json({
      success: true,
      removedNode: nodeId,
      availablePoints: getAvailablePoints(user),
      totalSpent: talents.totalSpent,
    });
  } finally {
    talentLock.release(uid);
  }
});

// ─── Full reset (costs gold) ───────────────────────────────────────────────
router.post('/api/talents/reset', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  if (!talentLock.acquire(uid)) return res.status(429).json({ error: 'Talent operation in progress' });
  try {
    const user = state.users[uid];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const talents = ensureUserTalents(user);
    const nodeCount = Object.keys(talents.allocated).length;
    if (nodeCount === 0) return res.status(400).json({ error: 'No talents to reset' });

    // Cost: 50 gold per allocated node (WoW-style escalating respec)
    const resetCost = nodeCount * 50;
    if ((user.gold || 0) < resetCost) {
      return res.status(400).json({ error: `Not enough gold. Reset costs ${resetCost}g (${nodeCount} nodes × 50g)` });
    }

    user.gold -= resetCost;
    talents.allocated = {};
    talents.totalSpent = 0;

    saveUsers();

    res.json({
      success: true,
      goldSpent: resetCost,
      availablePoints: getAvailablePoints(user),
      gold: user.gold,
    });
  } finally {
    talentLock.release(uid);
  }
});

// ─── Get active talent effects for a user (used by helpers.js) ─────────────
function getUserTalentEffects(userId) {
  const user = state.users[userId];
  if (!user || !user.talents) return {};

  const effects = {};
  for (const [nodeId, data] of Object.entries(user.talents.allocated)) {
    const node = nodeById.get(nodeId);
    if (!node || !node.effect) continue;
    const type = node.effect.type;
    if (!effects[type]) effects[type] = 0;
    effects[type] += (node.effect.value || 0);
  }
  return effects;
}

module.exports = router;
module.exports.getUserTalentEffects = getUserTalentEffects;
