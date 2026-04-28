/**
 * Schmiedekunst Routes — Dismantle, Transmute, Reforge
 * Split from crafting.js
 */
const router = require('express').Router();
const { state, saveUsers, saveUsersSync, ensureUserCurrencies } = require('../lib/state');
const { createGearInstance, getLegendaryModifiers, rollAffixStats, INVENTORY_CAP, createPlayerLock } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');
const { isMoonlightActive, MOONLIGHT_BONUS, RARITY_ORDER, getEquippedIds } = require('./crafting');

const schmiedeLock = createPlayerLock('schmiedekunst');

// ─── Schmiedekunst (Kanai's Cube) ────────────────────────────────────────────
// Dismantle items into Essenz, transmute 3 epics of same slot → 1 legendary

const DISMANTLE_ESSENZ = { common: 2, uncommon: 5, rare: 15, epic: 40, legendary: 100 };
// Materials from dismantling — based on player's chosen professions
const DISMANTLE_MATERIALS_BY_PROF = {
  schmied: { common: [{ id: 'eisenerz', chance: 0.6 }], uncommon: [{ id: 'eisenerz', chance: 0.7 }, { id: 'kristallsplitter', chance: 0.3 }], rare: [{ id: 'kristallsplitter', chance: 0.5 }, { id: 'drachenschuppe', chance: 0.3 }], epic: [{ id: 'drachenschuppe', chance: 0.5 }, { id: 'aetherkern', chance: 0.2 }], legendary: [{ id: 'aetherkern', chance: 0.6 }, { id: 'seelensplitter', chance: 0.1 }] },
  waffenschmied: { common: [{ id: 'eisenerz', chance: 0.6 }], uncommon: [{ id: 'eisenerz', chance: 0.7 }, { id: 'kristallsplitter', chance: 0.3 }], rare: [{ id: 'kristallsplitter', chance: 0.5 }, { id: 'drachenschuppe', chance: 0.3 }], epic: [{ id: 'drachenschuppe', chance: 0.5 }, { id: 'aetherkern', chance: 0.2 }], legendary: [{ id: 'aetherkern', chance: 0.6 }, { id: 'seelensplitter', chance: 0.1 }] },
  schneider: { common: [{ id: 'leinenstoff', chance: 0.6 }], uncommon: [{ id: 'wollstoff', chance: 0.5 }, { id: 'magiestaub', chance: 0.3 }], rare: [{ id: 'seidenstoff', chance: 0.4 }, { id: 'runenstein', chance: 0.3 }], epic: [{ id: 'magiestoff', chance: 0.5 }, { id: 'aetherkern', chance: 0.15 }], legendary: [{ id: 'runenstoff', chance: 0.5 }, { id: 'seelensplitter', chance: 0.1 }] },
  lederverarbeiter: { common: [{ id: 'leichtesleder', chance: 0.6 }], uncommon: [{ id: 'mittleresleder', chance: 0.5 }, { id: 'klauenoel', chance: 0.3 }], rare: [{ id: 'schweresleder', chance: 0.4 }, { id: 'salzgerbung', chance: 0.3 }], epic: [{ id: 'dickesleder', chance: 0.5 }, { id: 'aetherkern', chance: 0.15 }], legendary: [{ id: 'rauesleder', chance: 0.5 }, { id: 'seelensplitter', chance: 0.1 }] },
  juwelier: { common: [{ id: 'kristallsplitter', chance: 0.5 }], uncommon: [{ id: 'kristallsplitter', chance: 0.6 }, { id: 'magiestaub', chance: 0.3 }], rare: [{ id: 'runenstein', chance: 0.5 }, { id: 'drachenschuppe', chance: 0.2 }], epic: [{ id: 'aetherkern', chance: 0.4 }, { id: 'runenstein', chance: 0.3 }], legendary: [{ id: 'aetherkern', chance: 0.6 }, { id: 'seelensplitter', chance: 0.1 }] },
  alchemist: { common: [{ id: 'kraeuterbuendel', chance: 0.6 }], uncommon: [{ id: 'mondblume', chance: 0.4 }, { id: 'kraeuterbuendel', chance: 0.4 }], rare: [{ id: 'mondblume', chance: 0.5 }, { id: 'drachenschuppe', chance: 0.2 }], epic: [{ id: 'aetherkern', chance: 0.3 }, { id: 'phoenixfeder', chance: 0.2 }], legendary: [{ id: 'phoenixfeder', chance: 0.5 }, { id: 'seelensplitter', chance: 0.1 }] },
  koch: { common: [{ id: 'wildfleisch', chance: 0.6 }], uncommon: [{ id: 'feuerwurz', chance: 0.4 }, { id: 'gewuerzmischung', chance: 0.4 }], rare: [{ id: 'sternenfrucht', chance: 0.4 }, { id: 'phoenixgewuerz', chance: 0.3 }], epic: [{ id: 'phoenixgewuerz', chance: 0.5 }, { id: 'mondstaubsalz', chance: 0.3 }], legendary: [{ id: 'phoenixfeder', chance: 0.4 }, { id: 'seelensplitter', chance: 0.1 }] },
  verzauberer: { common: [{ id: 'magiestaub', chance: 0.6 }], uncommon: [{ id: 'magiestaub', chance: 0.5 }, { id: 'runenstein', chance: 0.3 }], rare: [{ id: 'runenstein', chance: 0.5 }, { id: 'kristallsplitter', chance: 0.3 }], epic: [{ id: 'aetherkern', chance: 0.4 }, { id: 'runenstein', chance: 0.4 }], legendary: [{ id: 'aetherkern', chance: 0.6 }, { id: 'seelensplitter', chance: 0.1 }] },
};
// Fallback for players with no professions
const DISMANTLE_MATERIALS_DEFAULT = {
  common: [{ id: 'eisenerz', chance: 0.4 }, { id: 'magiestaub', chance: 0.3 }],
  uncommon: [{ id: 'eisenerz', chance: 0.5 }, { id: 'kristallsplitter', chance: 0.3 }],
  rare: [{ id: 'kristallsplitter', chance: 0.4 }, { id: 'drachenschuppe', chance: 0.2 }],
  epic: [{ id: 'drachenschuppe', chance: 0.4 }, { id: 'aetherkern', chance: 0.15 }],
  legendary: [{ id: 'aetherkern', chance: 0.5 }, { id: 'seelensplitter', chance: 0.1 }],
};

function getDismantleMaterials(userId, rarity) {
  const u = state.users[userId];
  const profs = u?.chosenProfessions || [];
  if (profs.length === 0) return []; // No professions = essenz only, no materials
  // Merge materials from all chosen professions
  const merged = [];
  const seen = new Set();
  for (const prof of profs) {
    const pool = DISMANTLE_MATERIALS_BY_PROF[prof]?.[rarity] || [];
    for (const mat of pool) {
      if (!seen.has(mat.id)) { merged.push(mat); seen.add(mat.id); }
    }
  }
  return merged;
}

// POST /api/schmiedekunst/dismantle — dismantle an inventory item into essenz + materials
router.post('/api/schmiedekunst/dismantle', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!schmiedeLock.acquire(uid)) return res.status(429).json({ error: 'Dismantle in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { inventoryItemId } = req.body;
  if (!inventoryItemId) return res.status(400).json({ error: 'inventoryItemId required' });

  u.inventory = u.inventory || [];
  const idx = u.inventory.findIndex(i => (i.instanceId || i.id) === inventoryItemId);
  if (idx === -1) return res.status(404).json({ error: 'Item not in inventory' });
  const item = u.inventory[idx];

  // Cannot dismantle currently equipped items
  if (getEquippedIds(u).has(inventoryItemId)) {
    return res.status(400).json({ error: 'Cannot dismantle equipped items' });
  }
  if (item.locked) {
    return res.status(400).json({ error: 'Item is locked — unlock it first' });
  }

  const rarity = item.rarity || 'common';
  const essenzGained = DISMANTLE_ESSENZ[rarity] || 2;
  const matDrops = getDismantleMaterials(uid, rarity);

  // Remove from inventory
  u.inventory.splice(idx, 1);

  // Award essenz (Salvage = Essenz only, no crafting materials)
  ensureUserCurrencies(u);
  u.currencies.essenz = (u.currencies.essenz || 0) + essenzGained;

  // Legendary effect: salvageBonus — extra essenz from dismantling
  const salvageMods = getLegendaryModifiers(uid);
  // Talent tree: salvage_essenz_bonus — stacks with legendary
  const { getUserTalentEffects } = require('./talent-tree');
  const talentSalvageBonus = getUserTalentEffects(uid).salvage_essenz_bonus || 0;
  const salvageBonusMult = (salvageMods.salvageBonus || 0) + talentSalvageBonus;
  let bonusEssenz = 0;
  if (salvageBonusMult > 0) {
    bonusEssenz = Math.round(essenzGained * salvageBonusMult);
    u.currencies.essenz += bonusEssenz;
  }

  // Award crafting materials from dismantle — each drop rolls independently against its chance
  u.craftingMaterials = u.craftingMaterials || {};
  const materialsAwarded = [];
  for (const drop of matDrops) {
    if (Math.random() < (drop.chance || 0)) {
      const def = state.professionsData?.materials?.find(m => m.id === drop.id);
      u.craftingMaterials[drop.id] = (u.craftingMaterials[drop.id] || 0) + 1;
      materialsAwarded.push({ id: drop.id, amount: 1, name: def?.name || drop.id });
    }
  }

  // Sync write — dismantle must survive container restarts
  saveUsersSync();
  const matMsg = materialsAwarded.length > 0 ? ` + ${materialsAwarded.map(m => `${m.amount}x ${m.name}`).join(", ")}` : "";
  res.json({
    message: `${item.name} dismantled! +${essenzGained + bonusEssenz} Essenz${matMsg}`,
    dismantled: { name: item.name, rarity },
    essenzGained: essenzGained + bonusEssenz,
    materialsGained: materialsAwarded,
    currencies: u.currencies,
  });
  } finally { schmiedeLock.release(uid); }
});

// POST /api/schmiedekunst/dismantle-preview — preview salvage results without destroying items
router.post('/api/schmiedekunst/dismantle-preview', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { rarity } = req.body;
  if (!rarity || !DISMANTLE_ESSENZ[rarity]) {
    return res.status(400).json({ error: 'Valid rarity required (common/uncommon/rare/epic/legendary)' });
  }
  if (rarity === 'legendary') {
    return res.status(400).json({ error: 'Legendary items must be dismantled individually' });
  }

  const inv = u.inventory || [];
  const equippedIds = getEquippedIds(u);

  const candidates = inv.filter(i =>
    (i.rarity || 'common') === rarity && i.name && !equippedIds.has(i.instanceId || i.id) && !i.locked
  );

  const totalEssenz = candidates.length * (DISMANTLE_ESSENZ[rarity] || 2);
  // Estimate materials based on expected value (chance × count)
  const matDrops = getDismantleMaterials(uid, rarity);
  const estimatedMaterials = {};
  for (const mat of matDrops) {
    const expected = Math.round(candidates.length * mat.chance);
    if (expected > 0) {
      const def = state.professionsData.materials?.find(m => m.id === mat.id);
      estimatedMaterials[mat.id] = { name: def?.name || mat.id, amount: expected };
    }
  }

  res.json({
    items: candidates.map(i => ({
      id: i.instanceId || i.id,
      name: i.name,
      rarity: i.rarity || 'common',
      slot: i.slot || null,
      icon: i.icon || null,
      binding: i.binding || null,
    })),
    count: candidates.length,
    estimatedEssenz: totalEssenz,
    estimatedMaterials,
  });
});

// POST /api/schmiedekunst/dismantle-all — bulk dismantle by rarity (Salvage All)
router.post('/api/schmiedekunst/dismantle-all', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!schmiedeLock.acquire(uid)) return res.status(429).json({ error: 'Dismantle in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { rarity } = req.body;
  if (!rarity || !DISMANTLE_ESSENZ[rarity]) {
    return res.status(400).json({ error: 'Valid rarity required (common/uncommon/rare/epic/legendary)' });
  }
  if (rarity === 'legendary') {
    return res.status(400).json({ error: 'Legendary items must be dismantled individually' });
  }

  u.inventory = u.inventory || [];
  const equippedIds = getEquippedIds(u);

  const toDismantle = u.inventory.filter(i =>
    (i.rarity || 'common') === rarity && i.name && !equippedIds.has(i.instanceId || i.id) && !i.locked
  );
  if (toDismantle.length === 0) return res.status(400).json({ error: `No ${rarity} items to dismantle` });

  ensureUserCurrencies(u);
  u.craftingMaterials = u.craftingMaterials || {};

  let totalEssenz = 0;
  const allMats = {};
  const dismantleIds = new Set(toDismantle.map(i => i.instanceId || i.id));
  // Legendary + Talent: salvageBonus — extra essenz from dismantling
  const salvageMods = getLegendaryModifiers(uid);
  const { getUserTalentEffects } = require('./talent-tree');
  const talentSalvageBonus = getUserTalentEffects(uid).salvage_essenz_bonus || 0;
  const salvageBonusMult = (salvageMods.salvageBonus || 0) + talentSalvageBonus;
  for (const item of toDismantle) {
    let itemEssenz = DISMANTLE_ESSENZ[rarity] || 2;
    if (salvageBonusMult > 0) itemEssenz += Math.round(itemEssenz * salvageBonusMult);
    totalEssenz += itemEssenz;
    // Award materials per item — roll each drop independently against its chance
    const matDrops = getDismantleMaterials(uid, rarity);
    for (const drop of matDrops) {
      if (Math.random() < (drop.chance || 0)) {
        u.craftingMaterials[drop.id] = (u.craftingMaterials[drop.id] || 0) + 1;
        allMats[drop.id] = (allMats[drop.id] || 0) + 1;
      }
    }
  }
  // Remove all dismantled items in one pass (O(n) instead of O(n²))
  u.inventory = u.inventory.filter(i => !dismantleIds.has(i.instanceId || i.id));

  u.currencies.essenz = (u.currencies.essenz || 0) + totalEssenz;
  // Sync write — bulk dismantle must survive container restarts
  saveUsersSync();

  const matCount = Object.keys(allMats).length;
  res.json({
    message: `${toDismantle.length}x ${rarity} dismantled! +${totalEssenz} Essenz${matCount > 0 ? ` + ${matCount} Materialien` : ""}`,
    count: toDismantle.length,
    totalEssenz,
    materialsGained: allMats,
    currencies: u.currencies,
  });
  } finally { schmiedeLock.release(uid); }
});

// POST /api/schmiedekunst/transmute — combine 3 epics of same slot → 1 legendary
router.post('/api/schmiedekunst/transmute', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!schmiedeLock.acquire(uid)) return res.status(429).json({ error: 'Transmute in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { itemIds } = req.body; // array of 3 inventory instanceIds
  if (!itemIds || !Array.isArray(itemIds) || itemIds.length !== 3) {
    return res.status(400).json({ error: '3 itemIds required' });
  }
  // Prevent duplicate IDs (exploit: same item counted 3x)
  if (new Set(itemIds).size !== 3) {
    return res.status(400).json({ error: 'All 3 items must be different' });
  }

  u.inventory = u.inventory || [];
  const items = [];
  for (const id of itemIds) {
    const item = u.inventory.find(i => (i.instanceId || i.id) === id);
    if (!item) return res.status(404).json({ error: `Item ${id} not found in inventory` });
    items.push(item);
  }

  // Validate: none can be equipped or locked
  const equippedIds = getEquippedIds(u);
  for (const item of items) {
    if (equippedIds.has(item.instanceId || item.id)) {
      return res.status(400).json({ error: `"${item.name}" is equipped — unequip first` });
    }
    if (item.locked) {
      return res.status(400).json({ error: `"${item.name}" is locked — unlock it first` });
    }
  }

  // Validate: all must be epic rarity
  const allEpic = items.every(i => (i.rarity || 'common') === 'epic');
  if (!allEpic) return res.status(400).json({ error: 'All 3 items must be epic rarity' });

  // Validate: all must be same slot (look up from template if not on instance)
  const slots = items.map(i => {
    if (i.slot) return i.slot;
    if (i.resolvedGear?.slot) return i.resolvedGear.slot;
    // Fallback: look up template
    const tmpl = state.gearById.get(i.templateId) || state.itemTemplates?.get(i.templateId || i.itemId);
    return tmpl?.slot || null;
  });
  const slot = slots[0];
  if (!slot) return res.status(400).json({ error: 'Could not determine slot — invalid items' });
  if (!slots.every(s => s === slot)) {
    return res.status(400).json({ error: `All items must be in the same slot (${slots.filter(Boolean).join(', ')})` });
  }

  // Gold cost
  const transmuteCost = 500;
  const userGold = u.currencies?.gold ?? u.gold ?? 0;
  if (userGold < transmuteCost) {
    return res.status(400).json({ error: `Not enough gold (${userGold}/${transmuteCost})` });
  }

  // Find legendary items in same slot
  const legendaryPool = state.FULL_GEAR_ITEMS.filter(g =>
    g.slot === slot && g.rarity === 'legendary'
  );
  if (legendaryPool.length === 0) {
    return res.status(400).json({ error: `No legendary available for slot "${slot}"` });
  }

  // Deduct gold — sync both fields
  ensureUserCurrencies(u);
  u.currencies.gold = (u.currencies.gold || 0) - transmuteCost;
  u.gold = u.currencies.gold;

  // Remove the 3 epic items from inventory
  for (const item of items) {
    const removeIdx = u.inventory.findIndex(i => (i.instanceId || i.id) === (item.instanceId || item.id));
    if (removeIdx !== -1) u.inventory.splice(removeIdx, 1);
  }

  // Create legendary (net -2 items: removed 3, adding 1 — cap can't be hit)
  const template = legendaryPool[Math.floor(Math.random() * legendaryPool.length)];
  const legendary = createGearInstance(template, { moonlightBonus: isMoonlightActive() ? MOONLIGHT_BONUS : 0 });
  u.inventory.push(legendary);

  // Sync write — transmute destroys 3 items, must survive container restarts
  saveUsersSync();
  res.json({
    message: `Transmutation successful! ${legendary.name} has been forged!`,
    consumed: items.map(i => ({ name: i.name, rarity: i.rarity })),
    created: legendary,
    goldSpent: transmuteCost,
    gold: u.currencies?.gold ?? u.gold ?? 0,
  });
  } finally { schmiedeLock.release(uid); }
});

// ─── Reforge Legendary (D3 Kanai's Cube "Law of Kulle") ─────────────────────
// Same item identity, completely re-randomized stats
router.post('/api/schmiedekunst/reforge', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!schmiedeLock.acquire(uid)) return res.status(429).json({ error: 'Reforge in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { inventoryItemId } = req.body;
  if (!inventoryItemId) return res.status(400).json({ error: 'inventoryItemId required' });

  u.inventory = u.inventory || [];
  const idx = u.inventory.findIndex(i => (i.instanceId || i.id) === inventoryItemId);
  if (idx === -1) return res.status(404).json({ error: 'Item not in inventory' });
  const item = u.inventory[idx];

  // Must be legendary
  if ((item.rarity || 'common') !== 'legendary') {
    return res.status(400).json({ error: 'Only legendary items can be reforged' });
  }
  // Cannot reforge equipped items
  if (getEquippedIds(u).has(inventoryItemId)) {
    return res.status(400).json({ error: 'Unequip the item first' });
  }
  // Must have a template to re-roll from
  const templateId = item.templateId || item.itemId;
  const template = state.gearById.get(templateId) || state.itemTemplates?.get(templateId);
  if (!template) {
    return res.status(400).json({ error: 'Cannot reforge this item (no template)' });
  }

  // Cost: 1000 gold + 2 seelensplitter + 3 aetherkern
  const goldCost = 1000;
  const matCosts = { seelensplitter: 2, aetherkern: 3 };

  ensureUserCurrencies(u);
  const userGold = u.currencies?.gold ?? u.gold ?? 0;
  if (userGold < goldCost) {
    return res.status(400).json({ error: `Not enough gold (${userGold}/${goldCost})` });
  }
  u.craftingMaterials = u.craftingMaterials || {};
  for (const [matId, needed] of Object.entries(matCosts)) {
    if ((u.craftingMaterials[matId] || 0) < needed) {
      const matDef = state.professionsData.materials?.find(m => m.id === matId);
      return res.status(400).json({ error: `Not enough ${matDef?.name || matId} (${u.craftingMaterials[matId] || 0}/${needed})` });
    }
  }

  // Deduct costs
  u.currencies.gold -= goldCost;
  u.gold = u.currencies.gold;
  for (const [matId, needed] of Object.entries(matCosts)) {
    u.craftingMaterials[matId] -= needed;
    if (u.craftingMaterials[matId] <= 0) delete u.craftingMaterials[matId];
  }

  // Reforge: create new instance from same template, replace in inventory
  const reforged = createGearInstance(template, { moonlightBonus: isMoonlightActive() ? MOONLIGHT_BONUS : 0 });
  // Preserve instanceId for tracking
  reforged.instanceId = item.instanceId || reforged.instanceId;
  u.inventory[idx] = reforged;

  saveUsersSync();
  res.json({
    message: `${reforged.name} has been reforged! Stats re-randomized.`,
    reforged,
    goldSpent: goldCost,
    gold: u.currencies?.gold ?? u.gold ?? 0,
  });
  } finally { schmiedeLock.release(uid); }
});

// ─── General Gear Reforge (Gold Sink) — all rarities, gold-only ─────────────
const REFORGE_GOLD_BY_RARITY = { common: 50, uncommon: 150, rare: 500, epic: 1500, legendary: 5000 };

router.post('/api/schmiedekunst/reforge-stats', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!schmiedeLock.acquire(uid)) return res.status(429).json({ error: 'Reforge in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { inventoryItemId } = req.body;
  if (!inventoryItemId) return res.status(400).json({ error: 'inventoryItemId required' });

  u.inventory = u.inventory || [];
  const idx = u.inventory.findIndex(i => (i.instanceId || i.id) === inventoryItemId);
  if (idx === -1) return res.status(404).json({ error: 'Item not in inventory' });
  const item = u.inventory[idx];

  // Cannot reforge equipped items
  if (getEquippedIds(u).has(inventoryItemId)) {
    return res.status(400).json({ error: 'Unequip the item first' });
  }

  // Cannot reforge locked items
  if (item.locked) {
    return res.status(400).json({ error: 'Unlock the item first' });
  }

  // Must have a template to re-roll from
  const templateId = item.templateId || item.itemId;
  const template = state.gearById.get(templateId) || state.itemTemplates?.get(templateId);
  if (!template) {
    return res.status(400).json({ error: 'Cannot reforge this item (no template)' });
  }

  // Items with fixedStats cannot be reforged
  if (item.fixedStats || template.fixedStats) {
    return res.status(400).json({ error: 'Items with fixed stats cannot be reforged' });
  }

  // Must have affixes
  if (!template.affixes) {
    return res.status(400).json({ error: 'This item has no affixes to reforge' });
  }

  // Gold cost scales with rarity
  const rarity = (item.rarity || 'common').toLowerCase();
  const goldCost = REFORGE_GOLD_BY_RARITY[rarity] || REFORGE_GOLD_BY_RARITY.common;

  ensureUserCurrencies(u);
  const userGold = u.currencies?.gold ?? u.gold ?? 0;
  if (userGold < goldCost) {
    return res.status(400).json({ error: `Not enough gold — need ${goldCost}, have ${userGold}` });
  }

  // Deduct gold
  u.currencies.gold -= goldCost;
  u.gold = u.currencies.gold;

  // Re-roll all stats (and legendary effect if applicable)
  const { stats, legendaryEffect } = rollAffixStats(template);
  item.stats = stats;
  if (template.legendaryEffect) {
    item.legendaryEffect = legendaryEffect;
  }
  // Preserve instanceId, sockets, setId — they stay on the item object untouched

  saveUsersSync();
  res.json({
    message: `${item.name} has been reforged! All stats re-rolled.`,
    reforged: item,
    goldSpent: goldCost,
    gold: u.currencies?.gold ?? u.gold ?? 0,
  });
  } finally { schmiedeLock.release(uid); }
});

module.exports = router;
