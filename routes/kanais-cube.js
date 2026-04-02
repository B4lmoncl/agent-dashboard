/**
 * Ätherwürfel Routes — Legendary Effect Extraction (Legendary Effect Extraction)
 * Extract legendary effects from items, store in library, equip 1 per slot category.
 */
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');
const { now, createPlayerLock } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');
const cubeExtractLock = createPlayerLock('cube-extract');

// ─── Effect Category Mapping (D3 style: Offensive / Defensive / Utility) ────

const EFFECT_CATEGORIES = {
  // Offensive
  xp_bonus: 'offensive',
  gold_bonus: 'offensive',
  crit_chance: 'offensive',
  double_quest_chance: 'offensive',
  berserker: 'offensive',
  vampiric: 'offensive',
  // Defensive
  decay_reduction: 'defensive',
  streak_protection: 'defensive',
  auto_streak_shield: 'defensive',
  second_wind: 'defensive',
  resilience: 'defensive',
  fortify: 'defensive',
  guardian: 'defensive',
  // Utility
  drop_bonus: 'utility',
  material_double: 'utility',
  cooldown_reduction: 'utility',
  salvage_bonus: 'utility',
  mentor: 'utility',
  prospector: 'utility',
  scavenger: 'utility',
  diplomat: 'utility',
  cartographer: 'utility',
  scholar: 'utility',
  gem_preserve: 'utility',
  companion_bond_boost: 'utility',
  faction_rep_boost: 'utility',
  challenge_score_bonus: 'utility',
  dungeon_loot_bonus: 'utility',
  forge_temp_flat: 'utility',
  pity_reduction: 'utility',
  expedition_speed: 'utility',
  ritual_streak_bonus: 'utility',
  night_double_gold: 'utility',
  every_nth_bonus: 'utility',
  variety_bonus: 'utility',
};

// Escalating extraction cost: base 500 essenz + 1000 gold, +250 essenz / +1000 gold per extraction
function getExtractionCost(extractionCount) {
  const n = extractionCount || 0;
  return {
    essenz: 500 + n * 250,
    gold: 1000 + n * 1000,
  };
}

function ensureCube(u) {
  if (!u.kanaisCube) {
    u.kanaisCube = { offensive: null, defensive: null, utility: null, library: [] };
  }
  return u.kanaisCube;
}

// ─── GET /api/kanais-cube — Return library + active effects ──────────────────

router.get('/api/kanais-cube', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const cube = ensureCube(u);
  res.json({
    offensive: cube.offensive || null,
    defensive: cube.defensive || null,
    utility: cube.utility || null,
    library: cube.library || [],
    categories: EFFECT_CATEGORIES,
  });
});

// ─── POST /api/kanais-cube/extract — Destroy item, add effect to library ─────

router.post('/api/kanais-cube/extract', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!cubeExtractLock.acquire(uid)) return res.status(429).json({ error: 'Extraction in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { inventoryItemId } = req.body;
  if (!inventoryItemId) return res.status(400).json({ error: 'inventoryItemId required' });

  const inv = u.inventory || [];
  const idx = inv.findIndex(i => (i.instanceId || i.id) === inventoryItemId);
  if (idx === -1) return res.status(404).json({ error: 'Item not in inventory' });

  const item = inv[idx];
  if (item.locked) return res.status(400).json({ error: 'Item is locked — unlock it first' });
  if (!item.legendaryEffect || !item.legendaryEffect.type) {
    return res.status(400).json({ error: 'Item has no legendary effect to extract' });
  }

  // Check escalating extraction cost (essenz + gold)
  ensureUserCurrencies(u);
  const extractionCost = getExtractionCost(u.cubeExtractionCount || 0);
  if ((u.currencies.essenz || 0) < extractionCost.essenz) {
    return res.status(400).json({ error: `Requires ${extractionCost.essenz} Essenz (have ${u.currencies.essenz || 0})` });
  }
  if ((u.currencies.gold ?? u.gold ?? 0) < extractionCost.gold) {
    return res.status(400).json({ error: `Requires ${extractionCost.gold} Gold (have ${u.currencies.gold ?? u.gold ?? 0})` });
  }

  const cube = ensureCube(u);
  const effectType = item.legendaryEffect.type;
  const category = EFFECT_CATEGORIES[effectType];
  if (!category) {
    return res.status(400).json({ error: `Unknown effect type: ${effectType}` });
  }

  // Check library capacity cap
  if (cube.library.length >= 50) {
    return res.status(400).json({ error: 'Library full (max 50 effects). Remove an effect to make room.' });
  }

  // Check if already in library
  if (cube.library.some(e => e.type === effectType)) {
    return res.status(400).json({ error: `Effect "${effectType}" already extracted` });
  }

  // Extract at MINIMUM value (incentive to keep good rolls on gear)
  const template = state.gearById.get(item.templateId);
  let minValue = item.legendaryEffect.value;
  if (template?.legendaryEffect?.min != null) {
    minValue = template.legendaryEffect.min;
  } else if (item.legendaryEffect.value) {
    // Fallback: use 60% of rolled value as approximate minimum
    minValue = Math.max(1, Math.floor(item.legendaryEffect.value * 0.6));
  }

  // Deduct cost (essenz + gold) and track extraction count
  u.currencies.essenz -= extractionCost.essenz;
  u.currencies.gold = (u.currencies.gold ?? u.gold ?? 0) - extractionCost.gold;
  u.gold = u.currencies.gold;
  u.cubeExtractionCount = (u.cubeExtractionCount || 0) + 1;

  // Destroy item
  u.inventory.splice(idx, 1);

  // Add to library
  const extractedEffect = {
    type: effectType,
    value: minValue,
    label: item.legendaryEffect.label || effectType,
    category,
    extractedFrom: item.name,
    extractedAt: now(),
  };
  cube.library.push(extractedEffect);

  saveUsers();
  res.json({
    message: `Extracted "${item.legendaryEffect.label || effectType}" from ${item.name}`,
    extracted: extractedEffect,
    destroyed: { name: item.name, rarity: item.rarity },
    cube: { offensive: cube.offensive, defensive: cube.defensive, utility: cube.utility, library: cube.library },
    currencies: u.currencies,
  });
  } finally { cubeExtractLock.release(uid); }
});

// ─── POST /api/kanais-cube/equip — Set active effect for a slot ──────────────

router.post('/api/kanais-cube/equip', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { slot, effectType } = req.body;
  if (!slot || !['offensive', 'defensive', 'utility'].includes(slot)) {
    return res.status(400).json({ error: 'Valid slot required (offensive/defensive/utility)' });
  }
  if (!effectType) return res.status(400).json({ error: 'effectType required' });

  const cube = ensureCube(u);
  const entry = cube.library.find(e => e.type === effectType);
  if (!entry) return res.status(404).json({ error: 'Effect not in library' });

  // Verify category matches slot
  const category = EFFECT_CATEGORIES[effectType];
  if (category !== slot) {
    return res.status(400).json({ error: `${effectType} is a ${category} effect, cannot equip in ${slot} slot` });
  }

  cube[slot] = { type: entry.type, value: entry.value, label: entry.label };
  saveUsers();
  res.json({
    message: `Equipped "${entry.label || effectType}" in ${slot} slot`,
    cube: { offensive: cube.offensive, defensive: cube.defensive, utility: cube.utility, library: cube.library },
  });
});

// ─── POST /api/kanais-cube/unequip — Remove active effect from slot ──────────

router.post('/api/kanais-cube/unequip', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { slot } = req.body;
  if (!slot || !['offensive', 'defensive', 'utility'].includes(slot)) {
    return res.status(400).json({ error: 'Valid slot required (offensive/defensive/utility)' });
  }

  const cube = ensureCube(u);
  if (!cube[slot]) return res.status(400).json({ error: `No effect equipped in ${slot} slot` });

  const removed = cube[slot];
  cube[slot] = null;
  saveUsers();
  res.json({
    message: `Removed "${removed.label || removed.type}" from ${slot} slot`,
    cube: { offensive: cube.offensive, defensive: cube.defensive, utility: cube.utility, library: cube.library },
  });
});

module.exports = router;
