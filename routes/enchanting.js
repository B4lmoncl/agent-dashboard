/**
 * Enchanting Routes — D3-Style Stat Reroll (Mystic)
 * Split from crafting.js
 */
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');
const { PRIMARY_STATS, MINOR_STATS, rollAffixStats } = require('../lib/helpers');
const { requireAuth } = require('../lib/middleware');
const { VALID_SLOTS } = require('./crafting');

// ─── D3-Style Stat Reroll ("Enchanting") — standalone, no profession needed ─
const REROLL_BASE_GOLD = 100;
const REROLL_GOLD_CAP = 50000;
const REROLL_ESSENZ_COST = 2; // D3-style: material cost stays constant, only gold escalates

router.post('/api/reroll/preview', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { slot, statToLock } = req.body;
  if (!slot || !VALID_SLOTS.includes(slot)) return res.status(400).json({ error: 'Invalid slot' });

  const eq = u.equipment?.[slot];
  if (!eq || typeof eq !== 'object') return res.status(400).json({ error: 'No item equipped in that slot' });

  const template = state.gearById.get(eq.templateId) || state.itemTemplates?.get(eq.templateId);
  if (!template?.affixes) return res.status(400).json({ error: 'Item has no affix data' });

  // Determine which stat is locked for reroll
  const lockedStat = eq.rerollLocked || statToLock || null;
  if (eq.rerollLocked && statToLock && eq.rerollLocked !== statToLock) {
    return res.status(400).json({ error: `This item is locked to reroll "${eq.rerollLocked}" only` });
  }

  // Validate stat exists on item
  const allStats = { ...(eq.stats || {}) };
  if (lockedStat && !(lockedStat in allStats)) {
    return res.status(400).json({ error: `Stat "${lockedStat}" not found on this item` });
  }

  const rerollCount = eq.rerollCount || 0;
  const goldCost = Math.min(REROLL_GOLD_CAP, Math.round(REROLL_BASE_GOLD * Math.pow(1.5, rerollCount)));
  const essenzCost = REROLL_ESSENZ_COST;

  // Find affix pool for the locked stat
  const isPrimary = PRIMARY_STATS.includes(lockedStat);
  const pool = isPrimary ? template.affixes.primary?.pool : template.affixes.minor?.pool;
  const poolEntry = pool?.find(p => p.stat === lockedStat);

  res.json({
    item: eq,
    lockedStat,
    currentValue: allStats[lockedStat],
    rerollCount,
    cost: { gold: goldCost, essenz: essenzCost },
    range: poolEntry ? { min: poolEntry.min, max: poolEntry.max } : null,
    isFirstReroll: !eq.rerollLocked,
  });
});

router.post('/api/reroll/enchant', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { slot, statToLock, chosenOption } = req.body;
  if (!slot || !VALID_SLOTS.includes(slot)) return res.status(400).json({ error: 'Invalid slot' });

  const eq = u.equipment?.[slot];
  if (!eq || typeof eq !== 'object') return res.status(400).json({ error: 'No item equipped in that slot' });

  const template = state.gearById.get(eq.templateId) || state.itemTemplates?.get(eq.templateId);
  if (!template?.affixes) return res.status(400).json({ error: 'Item has no affix data' });

  // Determine locked stat
  const lockedStat = eq.rerollLocked || statToLock;
  if (!lockedStat) return res.status(400).json({ error: 'Must specify statToLock' });
  if (eq.rerollLocked && eq.rerollLocked !== lockedStat) {
    return res.status(400).json({ error: `This item is locked to reroll "${eq.rerollLocked}" only` });
  }

  const allStats = { ...(eq.stats || {}) };
  if (!(lockedStat in allStats)) {
    return res.status(400).json({ error: `Stat "${lockedStat}" not found on this item` });
  }

  const rerollCount = eq.rerollCount || 0;
  const goldCost = Math.min(REROLL_GOLD_CAP, Math.round(REROLL_BASE_GOLD * Math.pow(1.5, rerollCount)));
  const essenzCost = REROLL_ESSENZ_COST;

  // Find affix pool
  const isPrimary = PRIMARY_STATS.includes(lockedStat);
  const pool = isPrimary ? template.affixes.primary?.pool : template.affixes.minor?.pool;
  const poolEntry = pool?.find(p => p.stat === lockedStat);
  if (!poolEntry) {
    // Stat not in pool — try any pool entry for same category
    const fallbackPool = isPrimary ? template.affixes.primary?.pool : template.affixes.minor?.pool;
    if (!fallbackPool?.length) return res.status(400).json({ error: 'No affix pool available for reroll' });
  }

  const rollMin = poolEntry?.min ?? 1;
  const rollMax = poolEntry?.max ?? 3;

  // If chosenOption is not provided, this is a "roll" request — roll 2 options
  if (chosenOption == null) {
    // Check cost
    ensureUserCurrencies(u);
    const gold = u.currencies?.gold ?? u.gold ?? 0;
    const essenz = u.currencies?.essenz ?? 0;
    if (gold < goldCost) return res.status(400).json({ error: `Not enough gold (need ${goldCost}, have ${gold})` });
    if (essenz < essenzCost) return res.status(400).json({ error: `Not enough essenz (need ${essenzCost}, have ${essenz})` });

    // Deduct cost
    u.currencies.gold -= goldCost;
    u.gold = u.currencies.gold;
    u.currencies.essenz -= essenzCost;

    // Roll 2 new options (guaranteed at least one different from current)
    const currentVal = eq.stats[lockedStat];
    const rollOnce = () => rollMin + Math.floor(Math.random() * (rollMax - rollMin + 1));
    let optionA = rollOnce();
    let optionB = rollOnce();
    // Ensure at least one differs from current
    let attempts = 0;
    while (optionA === currentVal && optionB === currentVal && attempts < 20) {
      optionA = rollOnce();
      optionB = rollOnce();
      attempts++;
    }

    // Lock the stat on first reroll
    if (!eq.rerollLocked) eq.rerollLocked = lockedStat;

    // Store pending options (player must choose)
    eq.rerollPending = { options: [currentVal, optionA, optionB], stat: lockedStat };

    saveUsers();
    return res.json({
      options: [
        { label: 'Keep', value: currentVal, index: 0 },
        { label: 'Option A', value: optionA, index: 1 },
        { label: 'Option B', value: optionB, index: 2 },
      ],
      cost: { gold: goldCost, essenz: essenzCost },
      rerollCount: rerollCount + 1,
      nextCost: {
        gold: Math.min(REROLL_GOLD_CAP, Math.round(REROLL_BASE_GOLD * Math.pow(1.5, rerollCount + 1))),
        essenz: REROLL_ESSENZ_COST,
      },
    });
  }

  // chosenOption provided — apply the selection
  if (!eq.rerollPending) return res.status(400).json({ error: 'No pending reroll options' });
  const idx = parseInt(chosenOption, 10);
  if (idx < 0 || idx > 2) return res.status(400).json({ error: 'Invalid option (0=keep, 1=A, 2=B)' });

  const chosenVal = eq.rerollPending.options[idx];
  const oldVal = eq.stats[lockedStat];
  eq.stats[lockedStat] = chosenVal;
  eq.rerollCount = (eq.rerollCount || 0) + 1;
  delete eq.rerollPending;

  saveUsers();
  res.json({
    success: true,
    message: `${lockedStat}: ${oldVal} → ${chosenVal}`,
    updatedGear: eq,
    rerollCount: eq.rerollCount,
  });
});

module.exports = router;
