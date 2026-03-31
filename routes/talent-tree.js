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
    return { meta: { firstPointLevel: 5, pointsPerLevel: 0.5, maxPoints: 25 }, nodes: [] };
  }
})();

// Build node lookup map
const nodeById = new Map();
for (const node of (treeData.nodes || [])) {
  nodeById.set(node.id, node);
}

const META = treeData.meta || {};
const FIRST_POINT_LEVEL = META.firstPointLevel || META.unlockLevel || 5;
const POINTS_PER_LEVEL = META.pointsPerLevel || 0.5;
const RESPEC_COST = META.respecCost || { gold: 500, essenz: 50 };

// ─── Helpers ──────────────────────────────────────────────────────────────

function ensureUserTalents(user) {
  if (!user.talents) {
    user.talents = { allocated: {}, totalSpent: 0 };
  }
  return user.talents;
}

function getAvailablePoints(user) {
  const lvl = getLevelInfo(user.xp || 0).level;
  if (lvl < FIRST_POINT_LEVEL) return 0;
  const talents = ensureUserTalents(user);
  // pointsPerLevel: 0.5 means 1 point per 2 levels
  const levelsAboveUnlock = lvl - FIRST_POINT_LEVEL;
  const earned = Math.floor(levelsAboveUnlock * POINTS_PER_LEVEL) + 1; // +1 for the unlock level itself
  const bonus = user._bonusTalentPoints || 0;
  return Math.max(0, earned + bonus - talents.totalSpent);
}

function getTotalAllocated(talents) {
  return Object.keys(talents.allocated || {}).reduce((sum, nid) => {
    const rank = talents.allocated[nid]?.rank || 1;
    return sum + rank;
  }, 0);
}

function canAllocate(user, nodeId) {
  const node = nodeById.get(nodeId);
  if (!node) return { ok: false, reason: 'Unknown node' };

  const talents = ensureUserTalents(user);
  const currentRank = talents.allocated[nodeId]?.rank || 0;
  const maxRank = node.maxRank || 1;

  if (currentRank >= maxRank) return { ok: false, reason: 'Already at max rank' };
  if (getAvailablePoints(user) < 1) return { ok: false, reason: 'Not enough talent points' };

  // Check reqPoints (minimum total allocated before this node is available)
  const totalAllocated = getTotalAllocated(talents);
  if (node.reqPoints && totalAllocated < node.reqPoints) {
    return { ok: false, reason: `Need ${node.reqPoints} allocated points first (have ${totalAllocated})` };
  }

  // Check prerequisites
  if (node.requires && node.requires.length > 0) {
    for (const reqId of node.requires) {
      if (!talents.allocated[reqId]) {
        const reqNode = nodeById.get(reqId);
        return { ok: false, reason: `Requires: ${reqNode ? reqNode.name : reqId}` };
      }
    }
  }

  // Check exclusions (mutually exclusive nodes)
  if (node.excludes && node.excludes.length > 0) {
    for (const exId of node.excludes) {
      if (talents.allocated[exId]) {
        const exNode = nodeById.get(exId);
        return { ok: false, reason: `Exclusive with: ${exNode ? exNode.name : exId}` };
      }
    }
  }

  return { ok: true };
}

// ─── GET /api/talents ──────────────────────────────────────────────────────
router.get('/api/talents', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  const user = state.users[uid];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const talents = ensureUserTalents(user);
  const lvl = getLevelInfo(user.xp || 0).level;

  res.json({
    meta: treeData.meta,
    nodes: treeData.nodes,
    connections: treeData.connections || [],
    choiceGroups: treeData.choiceGroups || [],
    buildArchetypes: treeData.buildArchetypes || [],
    allocated: talents.allocated,
    totalSpent: talents.totalSpent,
    availablePoints: getAvailablePoints(user),
    bonusPoints: user._bonusTalentPoints || 0,
    playerLevel: lvl,
    unlocked: lvl >= FIRST_POINT_LEVEL,
  });
});

// ─── POST /api/talents/allocate ────────────────────────────────────────────
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
    const currentRank = talents.allocated[nodeId]?.rank || 0;
    const newRank = currentRank + 1;

    talents.allocated[nodeId] = {
      rank: newRank,
      allocatedAt: new Date().toISOString(),
      effect: node.effect,
    };
    talents.totalSpent += 1;

    saveUsers();

    res.json({
      success: true,
      node: { id: node.id, name: node.name, rank: newRank, maxRank: node.maxRank || 1, effect: node.effect },
      availablePoints: getAvailablePoints(user),
      totalSpent: talents.totalSpent,
    });
  } finally {
    talentLock.release(uid);
  }
});

// ─── POST /api/talents/deallocate ──────────────────────────────────────────
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

    const currentRank = talents.allocated[nodeId].rank || 1;
    if (currentRank > 1) {
      // Multi-rank: reduce by 1
      talents.allocated[nodeId].rank = currentRank - 1;
    } else {
      delete talents.allocated[nodeId];
    }
    talents.totalSpent -= 1;
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

// ─── POST /api/talents/reset ───────────────────────────────────────────────
router.post('/api/talents/reset', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  if (!talentLock.acquire(uid)) return res.status(429).json({ error: 'Talent operation in progress' });
  try {
    const user = state.users[uid];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const talents = ensureUserTalents(user);
    const nodeCount = Object.keys(talents.allocated).length;
    if (nodeCount === 0) return res.status(400).json({ error: 'No talents to reset' });

    // Use respecCost from meta
    const goldCost = RESPEC_COST.gold || 500;
    const essenzCost = RESPEC_COST.essenz || 0;

    if ((user.gold || 0) < goldCost) {
      return res.status(400).json({ error: `Not enough gold. Reset costs ${goldCost}g` });
    }
    if (essenzCost > 0) {
      const userEssenz = user.currencies?.essenz || 0;
      if (userEssenz < essenzCost) {
        return res.status(400).json({ error: `Not enough Essenz. Reset costs ${essenzCost}` });
      }
      user.currencies.essenz -= essenzCost;
    }

    user.gold -= goldCost;
    if (user.currencies) user.currencies.gold = user.gold;
    talents.allocated = {};
    talents.totalSpent = 0;

    saveUsers();

    res.json({
      success: true,
      goldSpent: goldCost,
      essenzSpent: essenzCost,
      availablePoints: getAvailablePoints(user),
      gold: user.gold,
    });
  } finally {
    talentLock.release(uid);
  }
});

// ─── POST /api/talents/sacrifice — sacrifice legendary item for bonus talent point
router.post('/api/talents/sacrifice', requireAuth, (req, res) => {
  const uid = req.auth.userId;
  if (!talentLock.acquire(uid)) return res.status(429).json({ error: 'Talent operation in progress' });
  try {
    const user = state.users[uid];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const talents = ensureUserTalents(user);
    // Check if user has the sacrifice talent allocated
    const sacrificeNode = Object.entries(talents.allocated).find(([nid]) => {
      const node = nodeById.get(nid);
      return node?.effect?.type === 'sacrifice_legendary_for_talent_point';
    });
    if (!sacrificeNode) return res.status(400).json({ error: 'Opfergabe talent not allocated' });

    const effect = nodeById.get(sacrificeNode[0]).effect;
    const maxTotal = effect.maxTotal || 3;
    const currentBonus = user._bonusTalentPoints || 0;
    if (currentBonus >= maxTotal) {
      return res.status(400).json({ error: `Already sacrificed maximum (${maxTotal}) items` });
    }

    const { instanceId } = req.body;
    if (!instanceId) return res.status(400).json({ error: 'instanceId required' });

    const inventory = user.inventory || [];
    const idx = inventory.findIndex(i => i.instanceId === instanceId);
    if (idx === -1) return res.status(400).json({ error: 'Item not found in inventory' });

    const item = inventory[idx];
    const rarity = (item.rarity || '').toLowerCase();
    if (rarity !== 'legendary') {
      return res.status(400).json({ error: 'Only legendary items can be sacrificed' });
    }
    if (item.locked) return res.status(400).json({ error: 'Item is locked' });
    // Prevent sacrificing equipped items
    const equipped = user.equipment || {};
    const equippedIds = new Set(Object.values(equipped).map(e => typeof e === 'object' ? e?.instanceId : e).filter(Boolean));
    if (equippedIds.has(instanceId)) return res.status(400).json({ error: 'Cannot sacrifice equipped items' });

    // Remove item and grant bonus talent point
    inventory.splice(idx, 1);
    user._bonusTalentPoints = currentBonus + (effect.pointsPerRank || 1);
    user._sacrificedItems = user._sacrificedItems || [];
    user._sacrificedItems.push({ name: item.name, rarity: item.rarity, at: new Date().toISOString() });

    saveUsers();
    res.json({
      success: true,
      sacrificedItem: item.name,
      bonusTalentPoints: user._bonusTalentPoints,
      availablePoints: getAvailablePoints(user),
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
    const rank = data.rank || 1;

    // Tradeoff nodes: store bonus AND penalty separately
    if (type === 'tradeoff') {
      const bonus = node.effect.bonus;
      const penalty = node.effect.penalty;
      if (bonus?.stat && bonus?.modifier) {
        effects[bonus.stat] = (effects[bonus.stat] || 0) + bonus.modifier;
      }
      if (penalty?.stat && penalty?.modifier) {
        effects[penalty.stat] = (effects[penalty.stat] || 0) + penalty.modifier;
      }
      if (penalty?.stat && penalty?.override !== undefined) {
        effects[`${penalty.stat}_override`] = penalty.override;
      }
      continue;
    }

    // Special complex effects: store as objects
    if (type === 'forge_overcap' || type === 'rift_loot_split' || type === 'completion_chain_bonus' || type === 'variety_chain_bonus' ||
        type === 'streak_break_buffer' || type === 'nth_quest_gamble' || type === 'rift_stage_skip' ||
        type === 'friend_quest_xp_echo' || type === 'tavern_passive_gold' || type === 'daily_mission_extra_slot' ||
        type === 'gacha_lucky_streak' || type === 'codex_permanent_xp' || type === 'sacrifice_legendary_for_talent_point' ||
        type === 'companion_expedition_bond_xp' || type === 'weekly_guaranteed_epic_pull' || type === 'shop_affix_preview' ||
        type === 'tome_progress_bonus' || type === 'unique_item_discovery_xp') {
      effects[type] = node.effect;
      continue;
    }

    // Standard numeric effects
    let value = 0;
    if (node.effect.valuePerRank && Array.isArray(node.effect.valuePerRank)) {
      value = node.effect.valuePerRank[Math.min(rank, node.effect.valuePerRank.length) - 1] || 0;
    } else if (node.effect.chancePerRank && Array.isArray(node.effect.chancePerRank)) {
      value = node.effect.chancePerRank[Math.min(rank, node.effect.chancePerRank.length) - 1] || 0;
    } else {
      value = node.effect.value || 0;
    }
    if (!effects[type]) effects[type] = 0;
    effects[type] += value;
  }
  return effects;
}

module.exports = router;
module.exports.getUserTalentEffects = getUserTalentEffects;
