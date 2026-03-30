/**
 * Gacha Routes — Pull mechanics, banners, history, pity tracking.
 */
const router = require('express').Router();
const { state, saveGachaState, logActivity } = require('../lib/state');
const { requireApiKey } = require('../lib/middleware');
const { spendCurrency, awardCurrency, hasPassiveEffect, rollAffixStats, INVENTORY_CAP, getLegendaryModifiers } = require('../lib/helpers');

// ─── Player-level pull lock (prevents concurrent pulls for same player) ────
const _pullLocks = new Map(); // playerId → true
function acquirePullLock(playerId) {
  if (_pullLocks.has(playerId)) return false;
  _pullLocks.set(playerId, true);
  return true;
}
function releasePullLock(playerId) {
  _pullLocks.delete(playerId);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPlayerGachaState(playerId) {
  if (!state.gachaState[playerId]) {
    state.gachaState[playerId] = {
      pityCounter: 0,       // pulls since last legendary
      epicPityCounter: 0,   // pulls since last epic
      guaranteed5050: false, // next legendary is guaranteed featured
      history: [],           // last 100 pulls
    };
  }
  return state.gachaState[playerId];
}

function getEffectiveLegendaryRate(pityCounter) {
  const BASE_RATE = 0.008;      // 0.8% (nerfed from 1.6%)
  const SOFT_PITY_START = 55;   // was 35
  const HARD_PITY = 75;         // was 50
  const SOFT_PITY_INCREASE = 0.025; // was 0.03

  if (pityCounter >= HARD_PITY - 1) return 1.0; // guaranteed
  if (pityCounter >= SOFT_PITY_START) {
    return Math.min(1.0, BASE_RATE + (pityCounter - SOFT_PITY_START) * SOFT_PITY_INCREASE);
  }
  return BASE_RATE;
}

function rollRarity(pityCounter, epicPityCounter, hasRarityBoost = false) {
  const legendaryRate = getEffectiveLegendaryRate(pityCounter);
  // Passive: rarity_boost_15 adds +15% to rare+ rates
  const boostMult = hasRarityBoost ? 1.15 : 1.0;
  const epicRate = 0.03 * boostMult;      // 3% (was 8% — WoW Classic aligned)
  const rareRate = 0.25 * boostMult;      // 25% (was 38%)
  const uncommonRate = 0.45;              // 45% (was 40%)
  // common fills the rest

  // Epic pity: guaranteed epic at 10 pulls
  if (epicPityCounter >= 9) {
    // Roll for legendary first, if not then guaranteed epic
    const roll = Math.random();
    if (roll < legendaryRate) return 'legendary';
    return 'epic';
  }

  const roll = Math.random();
  if (roll < legendaryRate) return 'legendary';
  if (roll < legendaryRate + epicRate) return 'epic';
  if (roll < legendaryRate + epicRate + rareRate) return 'rare';
  if (roll < legendaryRate + epicRate + rareRate + uncommonRate) return 'uncommon';
  return 'common';
}

function pickItemFromPool(pool, rarity, bannerId) {
  const rarityPool = pool.filter(item => item.rarity === rarity);
  if (rarityPool.length === 0) return pool[Math.floor(Math.random() * pool.length)];
  return rarityPool[Math.floor(Math.random() * rarityPool.length)];
}

const DUPLICATE_REFUND = { common: 1, uncommon: 3, rare: 8, epic: 20, legendary: 50 };

function executePull(playerId, banner, { skipPityPassive = false } = {}) {
  const u = state.users[playerId];
  if (!u) return null;
  const gs = getPlayerGachaState(playerId);

  // Passive: pity_minus_5 — reduce pity counter by 5 (once per pull session, not per item)
  if (!skipPityPassive && hasPassiveEffect(playerId, 'pity_minus_5')) {
    gs.pityCounter = Math.max(0, gs.pityCounter - 5);
  }

  const pool = banner.type === 'featured' && state.gachaPool.featuredPool?.length > 0
    ? state.gachaPool.featuredPool
    : state.gachaPool.standardPool || [];

  if (pool.length === 0) return null;

  // Passive: rarity_boost_15 — +15% chance for rare+ rarity
  const hasRarityBoost = hasPassiveEffect(playerId, 'rarity_boost_15');
  // Legendary effect: pityReduction — effectively boosts pity counter so thresholds are reached sooner
  const gachaMods = getLegendaryModifiers(playerId);
  const effectivePity = gs.pityCounter + (gachaMods.pityReduction || 0);
  const rarity = rollRarity(effectivePity, gs.epicPityCounter, hasRarityBoost);
  let item = pickItemFromPool(pool, rarity, banner.id);

  // 50/50 system for legendaries on featured banner
  if (rarity === 'legendary' && banner.type === 'featured' && banner.featuredItems?.length > 0) {
    if (gs.guaranteed5050) {
      // Guaranteed featured
      const featuredPool = pool.filter(i => banner.featuredItems.includes(i.id) && i.rarity === 'legendary');
      if (featuredPool.length > 0) item = featuredPool[Math.floor(Math.random() * featuredPool.length)];
      gs.guaranteed5050 = false;
    } else {
      // 50/50
      if (Math.random() < 0.5) {
        const featuredPool = pool.filter(i => banner.featuredItems.includes(i.id) && i.rarity === 'legendary');
        if (featuredPool.length > 0) item = featuredPool[Math.floor(Math.random() * featuredPool.length)];
      } else {
        // Lost 50/50 — next legendary guaranteed featured
        gs.guaranteed5050 = true;
      }
    }
  }

  // Update pity counters
  if (rarity === 'legendary') {
    gs.pityCounter = 0;
    gs.epicPityCounter = 0;
  } else if (rarity === 'epic') {
    gs.pityCounter++;
    gs.epicPityCounter = 0;
  } else {
    gs.pityCounter++;
    gs.epicPityCounter++;
  }

  // Check for duplicate
  if (!u.inventory) u.inventory = [];
  const isDuplicate = u.inventory.some(inv => inv.itemId === item.id || inv.id === item.id);
  let duplicateRefund = 0;

  if (isDuplicate) {
    duplicateRefund = DUPLICATE_REFUND[rarity] || 1;
    awardCurrency(playerId, 'runensplitter', duplicateRefund);
  } else {
    // Roll stats for equipment-type items (affix rolling)
    const isEquipment = item.type === 'weapon' || item.type === 'armor' || item.type === 'equipment';
    let rolledStats = item.stats || null;
    let rolledLegendaryEffect = item.legendaryEffect || null;
    if (isEquipment && item.affixes) {
      const rolled = rollAffixStats(item);
      rolledStats = rolled.stats;
      if (rolled.legendaryEffect) rolledLegendaryEffect = rolled.legendaryEffect;
    }
    // Special handling: NPC visit guarantee (doesn't go into inventory)
    if (item.effect === 'npc_visit' && item.npcId) {
      u.guaranteedNpcVisit = item.npcId;
      // Don't push to inventory — it's an instant effect
    } else {
    // Add to inventory
    u.inventory.push({
      id: `gacha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: item.id,
      name: item.name,
      emoji: item.emoji || null,
      icon: item.icon || null,
      rarity: item.rarity,
      rarityColor: { common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f97316', unique: '#e6cc80' }[item.isUnique ? 'unique' : item.rarity] || '#9ca3af',
      effect: item.effect || null,
      stats: rolledStats,
      legendaryEffect: rolledLegendaryEffect,
      affixes: isEquipment ? (item.affixes || null) : null,
      slot: item.slot || (item.type === 'weapon' ? 'weapon' : item.type === 'armor' ? 'armor' : null),
      obtainedAt: new Date().toISOString(),
      source: 'gacha',
    });
    } // end else (non-npc_visit items)
  }

  // Record in history
  const historyEntry = {
    itemId: item.id,
    name: item.name,
    rarity: item.rarity,
    emoji: item.emoji,
    icon: item.icon || null,
    isDuplicate,
    duplicateRefund,
    bannerId: banner.id,
    pulledAt: new Date().toISOString(),
  };
  gs.history.unshift(historyEntry);
  if (gs.history.length > 100) gs.history.length = 100;

  return {
    item,
    isNew: !isDuplicate,
    isDuplicate,
    duplicateRefund,
    pityCounter: gs.pityCounter,
    epicPityCounter: gs.epicPityCounter,
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/gacha/banners — active banners
router.get('/api/gacha/banners', (req, res) => {
  const banners = state.bannerTemplates.filter(b => b.active !== false).map(b => ({
    ...b,
    pool: undefined, // Don't send full pool to client
    poolSize: (b.type === 'featured' && state.gachaPool.featuredPool?.length > 0
      ? state.gachaPool.featuredPool
      : state.gachaPool.standardPool || []).filter(i => true).length,
  }));
  res.json(banners);
});

// GET /api/gacha/pool — full pool info (item names, rarities)
router.get('/api/gacha/pool', (req, res) => {
  const pool = state.gachaPool.standardPool || [];
  const grouped = {};
  for (const item of pool) {
    if (!grouped[item.rarity]) grouped[item.rarity] = [];
    grouped[item.rarity].push({ id: item.id, name: item.name, emoji: item.emoji, icon: item.icon || null, type: item.type, desc: item.desc });
  }
  res.json({ pool: grouped, totalItems: pool.length });
});

// GET /api/gacha/pity/:playerId — pity info
router.get('/api/gacha/pity/:playerId', (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
  const gs = getPlayerGachaState(uid);
  res.json({
    pityCounter: gs.pityCounter,
    epicPityCounter: gs.epicPityCounter,
    guaranteed5050: gs.guaranteed5050,
    hardPity: 75,
    softPityStart: 55,
    epicPity: 10,
  });
});

// GET /api/gacha/history/:playerId — pull history
router.get('/api/gacha/history/:playerId', (req, res) => {
  const uid = req.params.playerId.toLowerCase();
  if (!state.users[uid]) return res.status(404).json({ error: 'Player not found' });
  const gs = getPlayerGachaState(uid);
  res.json({ history: gs.history || [] });
});

// POST /api/gacha/pull — single pull
router.post('/api/gacha/pull', requireApiKey, (req, res) => {
  const { playerId, bannerId } = req.body;
  if (!playerId || !bannerId) return res.status(400).json({ error: 'playerId and bannerId required' });
  const uid = playerId.toLowerCase();
  // Self-check: only pull for yourself (admin bypass)
  const callerId = req.auth?.userId?.toLowerCase();
  if (!req.auth?.isAdmin && callerId !== uid) {
    return res.status(403).json({ error: 'You can only pull for yourself' });
  }
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  if (!acquirePullLock(uid)) {
    return res.status(429).json({ error: 'Pull already in progress, please wait' });
  }

  try {
    const banner = state.bannerTemplates.find(b => b.id === bannerId && b.active !== false);
    if (!banner) return res.status(404).json({ error: 'Banner not found or inactive' });

    // Inventory cap check — prevent pull if inventory is full
    if ((u.inventory || []).length >= INVENTORY_CAP) {
      return res.status(400).json({ error: `Inventory full (${INVENTORY_CAP} items). Dismantle or discard items first.` });
    }

    const currency = banner.currency || 'runensplitter';
    const cost = banner.costSingle || 10;

    if (!spendCurrency(uid, currency, cost)) {
      return res.status(400).json({ error: `Not enough ${currency}. Need ${cost}` });
    }

    const result = executePull(uid, banner);
    if (!result) {
      // Refund currency if pull fails
      awardCurrency(uid, currency, cost);
      return res.status(500).json({ error: 'Pull failed — pool empty?' });
    }

    const { saveUsers } = require('../lib/state');
    saveUsers();
    saveGachaState();

    // Activity feed for epic+ pulls
    if (['epic', 'legendary'].includes(result.item.rarity)) {
      logActivity(uid, 'gacha_pull', { item: result.item.name, rarity: result.item.rarity, banner: banner.name });
    }
    console.log(`[gacha] ${uid} pulled ${result.item.rarity} "${result.item.name}" from ${banner.name}${result.isDuplicate ? ' (DUP→' + result.duplicateRefund + ' Runensplitter)' : ''}`);
    res.json({ ok: true, results: [result], currencies: u.currencies });
  } finally {
    releasePullLock(uid);
  }
});

// POST /api/gacha/pull10 — 10-pull (costs 90 instead of 100, guaranteed min 1 epic)
router.post('/api/gacha/pull10', requireApiKey, (req, res) => {
  const { playerId, bannerId } = req.body;
  if (!playerId || !bannerId) return res.status(400).json({ error: 'playerId and bannerId required' });
  const uid = playerId.toLowerCase();
  // Self-check: only pull for yourself (admin bypass)
  const callerId = req.auth?.userId?.toLowerCase();
  if (!req.auth?.isAdmin && callerId !== uid) {
    return res.status(403).json({ error: 'You can only pull for yourself' });
  }
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  if (!acquirePullLock(uid)) {
    return res.status(429).json({ error: 'Pull already in progress, please wait' });
  }

  try {
  const banner = state.bannerTemplates.find(b => b.id === bannerId && b.active !== false);
  if (!banner) return res.status(404).json({ error: 'Banner not found or inactive' });

  // Inventory cap check — need space for up to 10 items
  if ((u.inventory || []).length + 10 > INVENTORY_CAP) {
    return res.status(400).json({ error: `Inventory too full for 10-pull (need at least 10 free slots). Dismantle or discard items first.` });
  }

  const currency = banner.currency || 'runensplitter';
  const cost = banner.cost10 || 90;

  if (!spendCurrency(uid, currency, cost)) {
    return res.status(400).json({ error: `Not enough ${currency}. Need ${cost}` });
  }

  const results = [];
  let hasEpicOrBetter = false;

  for (let i = 0; i < 10; i++) {
    const result = executePull(uid, banner, { skipPityPassive: i > 0 });
    if (!result) {
      // Refund remaining pulls
      awardCurrency(uid, currency, Math.floor(cost * (10 - i) / 10));
      break;
    }
    results.push(result);
    if (['epic', 'legendary'].includes(result.item.rarity)) hasEpicOrBetter = true;
  }

  // Guarantee at least 1 epic if none rolled
  if (!hasEpicOrBetter && results.length === 10) {
    const pool = state.gachaPool.standardPool || [];
    const epicPool = pool.filter(item => item.rarity === 'epic');
    if (epicPool.length > 0) {
      // Replace the worst item (last common/uncommon)
      let worstIdx = results.findIndex(r => r.item.rarity === 'common');
      if (worstIdx < 0) worstIdx = results.findIndex(r => r.item.rarity === 'uncommon');
      const idx = worstIdx >= 0 ? worstIdx : 9;
      const epicItem = epicPool[Math.floor(Math.random() * epicPool.length)];
      const isDup = u.inventory?.some(inv => inv.itemId === epicItem.id) || false;

      // Remove the replaced item from inventory (it was added by executePull)
      const replacedItemId = results[idx].item.id;
      if (!results[idx].isDuplicate) {
        const invIdx = u.inventory.findIndex(inv => inv.itemId === replacedItemId);
        if (invIdx >= 0) u.inventory.splice(invIdx, 1);
      }

      // Add the guaranteed epic to inventory (or refund if duplicate)
      if (isDup) {
        awardCurrency(uid, 'runensplitter', DUPLICATE_REFUND['epic'] || 20);
      } else {
        const isEquip = epicItem.type === 'weapon' || epicItem.type === 'armor' || epicItem.type === 'equipment';
        let rolledStats = epicItem.stats || null;
        let rolledLegendary = epicItem.legendaryEffect || null;
        if (isEquip && epicItem.affixes) {
          const rolled = rollAffixStats(epicItem);
          rolledStats = rolled.stats;
          if (rolled.legendaryEffect) rolledLegendary = rolled.legendaryEffect;
        }
        u.inventory.push({
          id: `gacha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: epicItem.id,
          name: epicItem.name,
          emoji: epicItem.emoji || null,
          icon: epicItem.icon || null,
          rarity: epicItem.rarity,
          rarityColor: '#a855f7',
          effect: epicItem.effect || null,
          stats: rolledStats,
          legendaryEffect: rolledLegendary,
          affixes: isEquip ? (epicItem.affixes || null) : null,
          slot: epicItem.type === 'weapon' ? 'weapon' : epicItem.type === 'armor' ? 'armor' : null,
          obtainedAt: new Date().toISOString(),
          source: 'gacha',
        });
      }

      results[idx] = {
        item: epicItem,
        isNew: !isDup,
        isDuplicate: isDup,
        duplicateRefund: isDup ? (DUPLICATE_REFUND['epic'] || 20) : 0,
        pityCounter: getPlayerGachaState(uid).pityCounter,
        epicPityCounter: 0,
      };
    }
  }

  const { saveUsers } = require('../lib/state');
  saveUsers();
  saveGachaState();

  // Activity feed for epic+ pulls in 10-pull
  for (const r of results) {
    if (['epic', 'legendary'].includes(r.item.rarity)) {
      logActivity(uid, 'gacha_pull', { item: r.item.name, rarity: r.item.rarity, banner: banner.name });
    }
  }
  const rarityCount = {};
  for (const r of results) rarityCount[r.item.rarity] = (rarityCount[r.item.rarity] || 0) + 1;
  console.log(`[gacha] ${uid} 10-pull from ${banner.name}: ${JSON.stringify(rarityCount)}`);
  res.json({ ok: true, results, currencies: u.currencies });
  } finally {
    releasePullLock(uid);
  }
});

module.exports = router;
