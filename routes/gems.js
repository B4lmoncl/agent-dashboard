/**
 * Gem & Socket Routes — Diablo 3-inspired gem system for gear sockets.
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');
const { now, getLevelInfo, getLegendaryModifiers, createPlayerLock } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');
const gemLock = createPlayerLock('gem-action');

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

  // Build socketedGems from equipped gear for the UI
  const socketedGems = {};
  if (u && u.equipment) {
    for (const [slot, item] of Object.entries(u.equipment)) {
      if (!item || typeof item !== 'object' || !item.sockets || !Array.isArray(item.sockets)) continue;
      const sockets = item.sockets.map(gKey => {
        if (!gKey) return null;
        const p = parseGemKey(gKey);
        if (!p) return null;
        const d = getGemDef(p.type);
        const td = getGemTier(p.type, p.tier);
        return { gemKey: gKey, gemType: p.type, gemName: td?.name || gKey, tier: p.tier, stat: d?.stat, statBonus: td?.statBonus, color: d?.color };
      });
      socketedGems[item.instanceId || slot] = { slot, itemName: item.name || slot, sockets };
    }
  }

  res.json({
    gems: GEMS_DATA.gems,
    socketsByRarity: GEMS_DATA.socketsByRarity,
    dropConfig: GEMS_DATA.dropConfig,
    inventory: enriched,
    socketedGems,
    unsocketCost: 50,
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
  if (!gemLock.acquire(userId)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[userId];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { gemKey: gKey, instanceId, socketIndex } = req.body;
  if (!gKey || !instanceId || socketIndex === undefined) {
    return res.status(400).json({ error: 'Please select a gem and socket slot' });
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
  console.log(`[gems] ${userId} socketed ${gKey} into ${item.name} (socket ${idx})`);
  } finally { gemLock.release(userId); }
});

// ─── POST /api/gems/unsocket — Remove gem from gear (costs gold) ───────────
router.post('/api/gems/unsocket', requireAuth, (req, res) => {
  const userId = (req.auth.userId || req.auth.userName || '').toLowerCase();
  if (!gemLock.acquire(userId)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[userId];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const UNSOCKET_COST = 50;

  const { instanceId, socketIndex } = req.body;
  if (!instanceId || socketIndex === undefined) {
    return res.status(400).json({ error: 'Please select a socket to unsocket' });
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

  // Check gold (normalize currency format first)
  ensureUserCurrencies(u);
  if ((u.currencies.gold || 0) < UNSOCKET_COST) {
    return res.status(400).json({ error: `Not enough gold — need ${UNSOCKET_COST}, have ${u.currencies.gold || 0}` });
  }

  // Deduct gold
  u.currencies.gold -= UNSOCKET_COST;
  u.gold = u.currencies.gold;

  // Legendary effect: gemPreserve — chance to keep gem instead of destroying it
  const gemMods = getLegendaryModifiers(userId);
  const gemPreserved = Math.random() < (gemMods.gemPreserve || 0);

  // Return gem to inventory only if preserved by legendary effect
  u.gems = u.gems || {};
  if (gemPreserved) {
    u.gems[currentGem] = (u.gems[currentGem] || 0) + 1;
  }

  // Clear socket
  item.sockets[idx] = null;

  saveUsers();

  const parsed = parseGemKey(currentGem);
  const tierDef = parsed ? getGemTier(parsed.type, parsed.tier) : null;

  res.json({
    success: true,
    message: gemPreserved
      ? `Removed ${tierDef?.name || currentGem} from ${item.name} — gem preserved! (cost: ${UNSOCKET_COST} gold)`
      : `Removed ${tierDef?.name || currentGem} from ${item.name} — gem destroyed (cost: ${UNSOCKET_COST} gold)`,
    item: {
      instanceId: item.instanceId,
      name: item.name,
      sockets: item.sockets,
    },
    gemReturned: gemPreserved ? currentGem : null,
    gemDestroyed: !gemPreserved,
    goldSpent: UNSOCKET_COST,
  });
  } finally { gemLock.release(userId); }
});

// ─── POST /api/gems/upgrade — Combine 3 gems → 1 higher tier ──────────────
router.post('/api/gems/upgrade', requireAuth, (req, res) => {
  const userId = (req.auth.userId || req.auth.userName || '').toLowerCase();
  if (!gemLock.acquire(userId)) return res.status(429).json({ error: 'Action in progress' });
  try {
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

  // Essenz cost scales by tier: T1→2: 25, T2→3: 50, T3→4: 100, T4→5: 200
  const ESSENZ_BY_TIER = { 1: 25, 2: 50, 3: 100, 4: 200 };
  const essenzCost = ESSENZ_BY_TIER[parsed.tier] || 50;

  // Check player has enough gems
  u.gems = u.gems || {};
  const owned = u.gems[gKey] || 0;
  if (owned < GEMS_REQUIRED) {
    return res.status(400).json({
      error: `Need ${GEMS_REQUIRED} gems of this type, have ${owned}`,
    });
  }

  // Check gold (normalize currency format first)
  ensureUserCurrencies(u);
  if ((u.currencies.gold || 0) < UPGRADE_COST) {
    return res.status(400).json({ error: `Not enough gold — need ${UPGRADE_COST}, have ${u.currencies.gold || 0}` });
  }

  // Check essenz
  if ((u.currencies.essenz || 0) < essenzCost) {
    return res.status(400).json({ error: `Not enough Essenz — need ${essenzCost}, have ${u.currencies.essenz || 0}` });
  }

  // Deduct gold + essenz
  u.currencies.gold -= UPGRADE_COST;
  u.gold = u.currencies.gold;
  u.currencies.essenz -= essenzCost;

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
    essenzSpent: essenzCost,
  });
  } finally { gemLock.release(userId); }
});

// ─── POST /api/gems/unlock-socket — Unlock a new socket on equipped gear ────
router.post('/api/gems/unlock-socket', requireAuth, (req, res) => {
  const userId = (req.auth.userId || req.auth.userName || '').toLowerCase();
  if (!gemLock.acquire(userId)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[userId];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { inventoryItemId, slot } = req.body;
  if (!inventoryItemId && !slot) {
    return res.status(400).json({ error: 'Missing inventoryItemId or slot' });
  }

  // Find item in equipment (must be equipped to add socket)
  let item = null;
  let equipSlot = null;
  if (u.equipment) {
    if (slot && u.equipment[slot] && typeof u.equipment[slot] === 'object') {
      item = u.equipment[slot];
      equipSlot = slot;
    } else {
      // Search by instanceId
      for (const [s, eq] of Object.entries(u.equipment)) {
        if (eq && typeof eq === 'object' && (eq.instanceId === inventoryItemId || eq.id === inventoryItemId)) {
          item = eq;
          equipSlot = s;
          break;
        }
      }
    }
  }

  if (!item) {
    return res.status(404).json({ error: 'Item not found in equipment — must be equipped to unlock sockets' });
  }

  // Determine max sockets for this rarity
  const rarity = (item.rarity || 'common').toLowerCase();
  const maxSocketRange = GEMS_DATA.socketsByRarity[rarity] || [0, 0];
  const maxSockets = maxSocketRange[1] || 0;
  item.sockets = item.sockets || [];
  const currentSockets = item.sockets.length;

  if (currentSockets >= maxSockets) {
    return res.status(400).json({ error: `This ${rarity} item already has the maximum ${maxSockets} socket(s)` });
  }

  // Cost: 1000 gold + 5 essenz per socket
  const goldCost = 1000;
  const essenzCost = 5;

  ensureUserCurrencies(u);
  const userGold = u.currencies?.gold ?? 0;
  const userEssenz = u.currencies?.essenz ?? 0;

  if (userGold < goldCost) {
    return res.status(400).json({ error: `Not enough gold — need ${goldCost}, have ${userGold}` });
  }
  if (userEssenz < essenzCost) {
    return res.status(400).json({ error: `Not enough Essenz — need ${essenzCost}, have ${userEssenz}` });
  }

  // Deduct costs
  u.currencies.gold -= goldCost;
  u.gold = u.currencies.gold;
  u.currencies.essenz -= essenzCost;

  // Add empty socket
  item.sockets.push(null);

  saveUsers();

  res.json({
    success: true,
    message: `Unlocked socket ${item.sockets.length} on ${item.name} (${currentSockets} → ${item.sockets.length})`,
    item: {
      instanceId: item.instanceId,
      name: item.name,
      sockets: item.sockets,
      maxSockets,
    },
    goldSpent: goldCost,
    essenzSpent: essenzCost,
  });
  console.log(`[gems] ${userId} unlocked socket on ${item.name} (now ${item.sockets.length}/${maxSockets})`);
  } finally { gemLock.release(userId); }
});

// ─── POST /api/gems/polish — Upgrade 1 gem via gold (alternative to 3→1 combine)
router.post('/api/gems/polish', requireAuth, (req, res) => {
  const userId = (req.auth.userId || req.auth.userName || '').toLowerCase();
  if (!gemLock.acquire(userId)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[userId];
  if (!u) return res.status(404).json({ error: 'Player not found' });

  const { gemKey: gKey } = req.body;
  if (!gKey) return res.status(400).json({ error: 'Missing gemKey' });

  const parsed = parseGemKey(gKey);
  if (!parsed) return res.status(400).json({ error: 'Invalid gem key' });

  // Can't polish tier 5 (Royal)
  if (parsed.tier >= 5) {
    return res.status(400).json({ error: 'Royal gems (tier 5) cannot be polished further' });
  }

  // Check player owns at least 1
  u.gems = u.gems || {};
  const owned = u.gems[gKey] || 0;
  if (owned < 1) {
    return res.status(400).json({ error: 'You do not own this gem' });
  }

  // Gold cost: 500 × currentTier
  const goldCost = 500 * parsed.tier;
  // Essenz cost: half of gold cost
  const essenzCost = Math.floor(goldCost / 2);

  ensureUserCurrencies(u);
  const userGold = u.currencies?.gold ?? 0;
  const userEssenz = u.currencies?.essenz ?? 0;
  if (userGold < goldCost) {
    return res.status(400).json({ error: `Not enough gold — need ${goldCost}, have ${userGold}` });
  }
  if (userEssenz < essenzCost) {
    return res.status(400).json({ error: `Not enough Essenz — need ${essenzCost}, have ${userEssenz}` });
  }

  // Deduct gold + essenz
  u.currencies.gold -= goldCost;
  u.gold = u.currencies.gold;
  u.currencies.essenz -= essenzCost;

  // Remove 1 of current gem, add 1 of next tier
  u.gems[gKey] = owned - 1;
  if (u.gems[gKey] <= 0) delete u.gems[gKey];

  const upgradedKey = gemKey(parsed.type, parsed.tier + 1);
  u.gems[upgradedKey] = (u.gems[upgradedKey] || 0) + 1;

  saveUsers();

  const def = getGemDef(parsed.type);
  const fromTier = getGemTier(parsed.type, parsed.tier);
  const toTier = getGemTier(parsed.type, parsed.tier + 1);

  res.json({
    success: true,
    message: `Polished ${fromTier?.name || gKey} into ${toTier?.name || upgradedKey}`,
    consumed: { key: gKey, count: 1 },
    result: {
      key: upgradedKey,
      name: toTier?.name,
      tier: parsed.tier + 1,
      stat: def?.stat,
      statBonus: toTier?.statBonus,
    },
    goldSpent: goldCost,
    essenzSpent: essenzCost,
  });
  console.log(`[gems] ${userId} polished ${gKey} → ${upgradedKey} (${goldCost}g + ${essenzCost} essenz)`);
  } finally { gemLock.release(userId); }
});

module.exports = router;
module.exports.loadGems = loadGems;
