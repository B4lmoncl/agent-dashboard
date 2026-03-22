/**
 * Gem & Socket Routes — Diablo 3-inspired gem system for gear sockets.
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers } = require('../lib/state');
const { now, getLevelInfo } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');

// ─── Load gem definitions at boot ──────────────────────────────────────────
let GEMS_DATA = { gems: [], socketsByRarity: {}, dropConfig: {} };

function loadGems() {
  const filePath = path.join(__dirname, '..', 'public', 'data', 'gems.json');
  try {
    if (fs.existsSync(filePath)) {
      GEMS_DATA = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      state.gemsData = GEMS_DATA;
      console.log(`[gems] Loaded ${GEMS_DATA.gems.length} gem types`);
    }
  } catch (e) {
    console.warn('[gems] Failed to load:', e.message);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getGemDef(gemType) {
  return GEMS_DATA.gems.find(g => g.id === gemType) || null;
}

function getGemTier(gemType, tier) {
  const def = getGemDef(gemType);
  if (!def) return null;
  return def.tiers.find(t => t.tier === tier) || null;
}

function parseGemKey(gemKey) {
  if (!gemKey || typeof gemKey !== 'string') return null;
  const parts = gemKey.split('_');
  if (parts.length < 2) return null;
  const tierStr = parts[parts.length - 1];
  const tier = parseInt(tierStr, 10);
  const type = parts.slice(0, -1).join('_');
  if (isNaN(tier) || tier < 1 || tier > 5) return null;
  if (!getGemDef(type)) return null;
  return { type, tier };
}

function gemKey(type, tier) {
  return `${type}_${tier}`;
}

// Resolve a gear item by instanceId from equipped or inventory
function findGearItem(u, instanceId) {
  // Check equipped
  if (u.equipment) {
    for (const [slot, item] of Object.entries(u.equipment)) {
      if (item && typeof item === 'object' && item.instanceId === instanceId) {
        return { item, location: 'equipped', slot };
      }
    }
  }
  // Check inventory
  if (u.inventory && Array.isArray(u.inventory)) {
    for (let i = 0; i < u.inventory.length; i++) {
      const item = u.inventory[i];
      if (item && typeof item === 'object' && item.instanceId === instanceId) {
        return { item, location: 'inventory', index: i };
      }
    }
  }
  return null;
}

// ─── GET /api/gems — Gem definitions + player gem inventory ────────────────
router.get('/api/gems', requireAuth, (req, res) => {
  const userId = (req.auth.userId || req.auth.userName || '').toLowerCase();
  const u = state.users[userId];
  const inventory = u ? (u.gems || {}) : {};

  // Enrich inventory with gem metadata
  const enriched = {};
  for (const [key, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    const parsed = parseGemKey(key);
    if (!parsed) continue;
    const def = getGemDef(parsed.type);
    const tierDef = getGemTier(parsed.type, parsed.tier);
    if (!def || !tierDef) continue;
    enriched[key] = {
      count,
      gemType: parsed.type,
      tier: parsed.tier,
      name: tierDef.name,
      stat: def.stat,
      statBonus: tierDef.statBonus,
      color: def.color,
      icon: def.icon,
    };
  }

  res.json({
    gems: GEMS_DATA.gems,
    socketsByRarity: GEMS_DATA.socketsByRarity,
    dropConfig: GEMS_DATA.dropConfig,
    inventory: enriched,
  });
});

// ─── GET /api/gems/inventory/:playerId — Player gem inventory ──────────────
router.get('/api/gems/inventory/:playerId', requireAuth, (req, res) => {
  const playerId = req.params.playerId.toLowerCase();
  const u = state.users[playerId];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const inventory = u.gems || {};
  const grouped = {};

  for (const [key, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    const parsed = parseGemKey(key);
    if (!parsed) continue;
    const def = getGemDef(parsed.type);
    const tierDef = getGemTier(parsed.type, parsed.tier);
    if (!def || !tierDef) continue;

    if (!grouped[parsed.type]) {
      grouped[parsed.type] = {
        gemType: parsed.type,
        name: def.name,
        stat: def.stat,
        color: def.color,
        icon: def.icon,
        tiers: [],
      };
    }
    grouped[parsed.type].tiers.push({
      tier: parsed.tier,
      name: tierDef.name,
      statBonus: tierDef.statBonus,
      count,
    });
  }

  // Sort tiers within each gem type
  for (const g of Object.values(grouped)) {
    g.tiers.sort((a, b) => a.tier - b.tier);
  }

  res.json({ playerId, gems: grouped });
});

// ─── POST /api/gems/socket — Socket a gem into gear ─────────────────────────
router.post('/api/gems/socket', requireAuth, (req, res) => {
  const userId = (req.auth.userId || req.auth.userName || '').toLowerCase();
  const u = state.users[userId];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { gemKey: gKey, instanceId, socketIndex } = req.body;
  if (!gKey || !instanceId || socketIndex === undefined) {
    return res.status(400).json({ error: 'Missing gemKey, instanceId, or socketIndex' });
  }

  // Validate gem
  const parsed = parseGemKey(gKey);
  if (!parsed) return res.status(400).json({ error: 'Invalid gem key' });

  // Check player owns the gem
  u.gems = u.gems || {};
  const owned = u.gems[gKey] || 0;
  if (owned < 1) return res.status(400).json({ error: 'You do not own this gem' });

  // Find gear item
  const found = findGearItem(u, instanceId);
  if (!found) return res.status(404).json({ error: 'Gear item not found' });

  const item = found.item;
  if (!item.sockets || !Array.isArray(item.sockets)) {
    return res.status(400).json({ error: 'This gear item has no sockets' });
  }

  const idx = parseInt(socketIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= item.sockets.length) {
    return res.status(400).json({ error: 'Invalid socket index' });
  }
  if (item.sockets[idx] !== null) {
    return res.status(400).json({ error: 'Socket is already occupied — unsocket first' });
  }

  // Socket the gem
  item.sockets[idx] = gKey;
  u.gems[gKey] = owned - 1;
  if (u.gems[gKey] <= 0) delete u.gems[gKey];

  saveUsers();

  const def = getGemDef(parsed.type);
  const tierDef = getGemTier(parsed.type, parsed.tier);

  res.json({
    success: true,
    message: `Socketed ${tierDef?.name || gKey} into ${item.name}`,
    item: {
      instanceId: item.instanceId,
      name: item.name,
      sockets: item.sockets,
    },
    gemUsed: {
      key: gKey,
      name: tierDef?.name,
      stat: def?.stat,
      statBonus: tierDef?.statBonus,
    },
  });
});

// ─── POST /api/gems/unsocket — Remove gem from gear (costs gold) ───────────
router.post('/api/gems/unsocket', requireAuth, (req, res) => {
  const userId = (req.auth.userId || req.auth.userName || '').toLowerCase();
  const u = state.users[userId];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const UNSOCKET_COST = 50;

  const { instanceId, socketIndex } = req.body;
  if (!instanceId || socketIndex === undefined) {
    return res.status(400).json({ error: 'Missing instanceId or socketIndex' });
  }

  // Find gear item
  const found = findGearItem(u, instanceId);
  if (!found) return res.status(404).json({ error: 'Gear item not found' });

  const item = found.item;
  if (!item.sockets || !Array.isArray(item.sockets)) {
    return res.status(400).json({ error: 'This gear item has no sockets' });
  }

  const idx = parseInt(socketIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= item.sockets.length) {
    return res.status(400).json({ error: 'Invalid socket index' });
  }

  const currentGem = item.sockets[idx];
  if (!currentGem) {
    return res.status(400).json({ error: 'Socket is already empty' });
  }

  // Check gold
  const gold = u.currencies?.gold ?? u.gold ?? 0;
  if (gold < UNSOCKET_COST) {
    return res.status(400).json({ error: `Not enough gold — need ${UNSOCKET_COST}, have ${gold}` });
  }

  // Deduct gold
  if (u.currencies) {
    u.currencies.gold = (u.currencies.gold || 0) - UNSOCKET_COST;
  } else {
    u.gold = (u.gold || 0) - UNSOCKET_COST;
  }

  // Return gem to inventory
  u.gems = u.gems || {};
  u.gems[currentGem] = (u.gems[currentGem] || 0) + 1;

  // Clear socket
  item.sockets[idx] = null;

  saveUsers();

  const parsed = parseGemKey(currentGem);
  const tierDef = parsed ? getGemTier(parsed.type, parsed.tier) : null;

  res.json({
    success: true,
    message: `Removed ${tierDef?.name || currentGem} from ${item.name} (cost: ${UNSOCKET_COST} gold)`,
    item: {
      instanceId: item.instanceId,
      name: item.name,
      sockets: item.sockets,
    },
    gemReturned: currentGem,
    goldSpent: UNSOCKET_COST,
  });
});

// ─── POST /api/gems/upgrade — Combine 3 gems → 1 higher tier ──────────────
router.post('/api/gems/upgrade', requireAuth, (req, res) => {
  const userId = (req.auth.userId || req.auth.userName || '').toLowerCase();
  const u = state.users[userId];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { gemKey: gKey } = req.body;
  if (!gKey) return res.status(400).json({ error: 'Missing gemKey' });

  const parsed = parseGemKey(gKey);
  if (!parsed) return res.status(400).json({ error: 'Invalid gem key' });

  // Can't upgrade tier 5 (Royal)
  if (parsed.tier >= 5) {
    return res.status(400).json({ error: 'Royal gems (tier 5) cannot be upgraded further' });
  }

  const UPGRADE_COST = GEMS_DATA.dropConfig?.upgradeCost?.gold || 100;
  const GEMS_REQUIRED = GEMS_DATA.dropConfig?.upgradeCost?.gemsRequired || 3;

  // Check player has enough gems
  u.gems = u.gems || {};
  const owned = u.gems[gKey] || 0;
  if (owned < GEMS_REQUIRED) {
    return res.status(400).json({
      error: `Need ${GEMS_REQUIRED} gems of this type, have ${owned}`,
    });
  }

  // Check gold
  const gold = u.currencies?.gold ?? u.gold ?? 0;
  if (gold < UPGRADE_COST) {
    return res.status(400).json({ error: `Not enough gold — need ${UPGRADE_COST}, have ${gold}` });
  }

  // Deduct gold
  if (u.currencies) {
    u.currencies.gold = (u.currencies.gold || 0) - UPGRADE_COST;
  } else {
    u.gold = (u.gold || 0) - UPGRADE_COST;
  }

  // Remove source gems, add upgraded gem
  u.gems[gKey] = owned - GEMS_REQUIRED;
  if (u.gems[gKey] <= 0) delete u.gems[gKey];

  const upgradedKey = gemKey(parsed.type, parsed.tier + 1);
  u.gems[upgradedKey] = (u.gems[upgradedKey] || 0) + 1;

  saveUsers();

  const def = getGemDef(parsed.type);
  const fromTier = getGemTier(parsed.type, parsed.tier);
  const toTier = getGemTier(parsed.type, parsed.tier + 1);

  res.json({
    success: true,
    message: `Upgraded ${GEMS_REQUIRED}x ${fromTier?.name || gKey} into ${toTier?.name || upgradedKey}`,
    consumed: { key: gKey, count: GEMS_REQUIRED },
    result: {
      key: upgradedKey,
      name: toTier?.name,
      tier: parsed.tier + 1,
      stat: def?.stat,
      statBonus: toTier?.statBonus,
    },
    goldSpent: UPGRADE_COST,
  });
});

module.exports = router;
module.exports.loadGems = loadGems;
