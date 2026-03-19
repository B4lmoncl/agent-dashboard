/**
 * Crafting & Professions Routes — Schmied, Alchemist, Verzauberer
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers } = require('../lib/state');
const { now, getLevelInfo, rollAffixStats, PRIMARY_STATS, MINOR_STATS } = require('../lib/helpers');

const VALID_SLOTS = ['weapon', 'shield', 'helm', 'armor', 'amulet', 'boots'];
const { requireAuth } = require('../lib/middleware');

// ─── Load professions data at boot ──────────────────────────────────────────
let PROFESSIONS_DATA = { professions: [], materials: [], materialDropRates: {}, recipes: [] };

function loadProfessions() {
  const filePath = path.join(__dirname, '..', 'public', 'data', 'professions.json');
  try {
    if (fs.existsSync(filePath)) {
      PROFESSIONS_DATA = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      state.professionsData = PROFESSIONS_DATA;
      console.log(`[professions] Loaded ${PROFESSIONS_DATA.professions.length} professions, ${PROFESSIONS_DATA.recipes.length} recipes`);
    }
  } catch (e) {
    console.warn('[professions] Failed to load:', e.message);
  }
}

function getProfLevel(u, profId) {
  const prof = (u.professions || {})[profId];
  if (!prof) return { level: 0, xp: 0 };
  const thresholds = PROFESSIONS_DATA.professions.find(p => p.id === profId)?.levelThresholds || [];
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if ((prof.xp || 0) >= thresholds[i]) level = i + 1;
  }
  return { level: Math.min(level, 10), xp: prof.xp || 0 };
}

// ─── GET /api/professions — list all professions + player progress ──────────
router.get('/api/professions', (req, res) => {
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.usersByName.get(playerName) : null;
  const professions = PROFESSIONS_DATA.professions.map(p => {
    const playerLevel = u ? getLevelInfo(u.xp || 0).level : 0;
    const unlocked = u ? (p.unlockCondition?.type === 'level' ? playerLevel >= p.unlockCondition.value : true) : false;
    const profProgress = u ? getProfLevel(u, p.id) : { level: 0, xp: 0 };
    const lastCraft = (u?.professions || {})[p.id]?.lastCraftAt || null;
    const chosen = (u?.chosenProfessions || []).includes(p.id);
    const canChoose = chosen || (u?.chosenProfessions || []).length < 2;
    return {
      ...p,
      unlocked,
      chosen,
      canChoose,
      playerLevel: profProgress.level,
      playerXp: profProgress.xp,
      nextLevelXp: p.levelThresholds[profProgress.level] || null,
      lastCraftAt: lastCraft,
    };
  });
  const recipes = PROFESSIONS_DATA.recipes.map(r => {
    const profProgress = u ? getProfLevel(u, r.profession) : { level: 0 };
    return { ...r, canCraft: profProgress.level >= r.reqProfLevel };
  });
  const materials = u?.craftingMaterials || {};
  res.json({ professions, recipes, materials, materialDefs: PROFESSIONS_DATA.materials });
});

// ─── POST /api/professions/craft — execute a recipe ─────────────────────────
router.post('/api/professions/craft', requireAuth, (req, res) => {
  const { recipeId, targetSlot, targetStatIndex } = req.body;
  if (!recipeId) return res.status(400).json({ error: 'recipeId required' });

  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const recipe = PROFESSIONS_DATA.recipes.find(r => r.id === recipeId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  // Check profession unlock
  const profDef = PROFESSIONS_DATA.professions.find(p => p.id === recipe.profession);
  if (!profDef) return res.status(500).json({ error: 'Profession not found' });

  const playerLevel = getLevelInfo(u.xp || 0).level;
  if (profDef.unlockCondition?.type === 'level' && playerLevel < profDef.unlockCondition.value) {
    return res.status(400).json({ error: `Requires player level ${profDef.unlockCondition.value}` });
  }

  // Check 2-profession limit: player can only have 2 active professions
  u.chosenProfessions = u.chosenProfessions || [];
  const needsEnrollment = !u.chosenProfessions.includes(recipe.profession);
  if (needsEnrollment && u.chosenProfessions.length >= 2) {
    return res.status(400).json({ error: `Du hast bereits 2 Berufe gewählt (${u.chosenProfessions.join(', ')}). Wechsel erst einen ab.` });
  }

  // Check profession level
  const profProgress = getProfLevel(u, recipe.profession);
  if (profProgress.level < recipe.reqProfLevel) {
    return res.status(400).json({ error: `Requires ${profDef.name} level ${recipe.reqProfLevel}` });
  }

  // Check cooldown
  const lastCraft = (u.professions || {})[recipe.profession]?.lastCraftAt;
  if (recipe.cooldownMinutes > 0 && lastCraft) {
    const elapsed = (Date.now() - new Date(lastCraft).getTime()) / 60000;
    if (elapsed < recipe.cooldownMinutes) {
      const remaining = Math.ceil(recipe.cooldownMinutes - elapsed);
      return res.status(429).json({ error: `Cooldown: ${remaining} Minuten verbleibend` });
    }
  }

  // ─── Pre-validate recipe requirements BEFORE deducting anything ──────────
  // Validate targetSlot early (needed by Schmied/Verzauberer recipes)
  if (targetSlot && !VALID_SLOTS.includes(targetSlot)) {
    return res.status(400).json({ error: `Invalid slot: ${targetSlot}` });
  }

  // Validate slot-requiring recipes have a targetSlot and valid gear
  const SLOT_RECIPES = ['reroll_stat', 'reroll_minor', 'upgrade_rarity', 'enchant_gear', 'permanent_enchant'];
  if (SLOT_RECIPES.includes(recipeId)) {
    if (!targetSlot) return res.status(400).json({ error: 'targetSlot required' });
    const eq = u.equipment?.[targetSlot];
    if (!eq || typeof eq === 'string') return res.status(400).json({ error: 'No gear instance in slot' });
    if (recipeId === 'upgrade_rarity') {
      const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      if (RARITY_ORDER.indexOf(eq.rarity || 'common') >= RARITY_ORDER.length - 1) {
        return res.status(400).json({ error: 'Item ist bereits legendär!' });
      }
    }
  }

  // Check gold cost
  if (recipe.cost?.gold) {
    const userGold = u.currencies?.gold ?? u.gold ?? 0;
    if (userGold < recipe.cost.gold) {
      return res.status(400).json({ error: `Nicht genug Gold (${userGold}/${recipe.cost.gold})` });
    }
  }

  // Check materials
  u.craftingMaterials = u.craftingMaterials || {};
  for (const [matId, amount] of Object.entries(recipe.materials || {})) {
    if ((u.craftingMaterials[matId] || 0) < amount) {
      const matDef = PROFESSIONS_DATA.materials.find(m => m.id === matId);
      return res.status(400).json({ error: `Nicht genug ${matDef?.name || matId} (${u.craftingMaterials[matId] || 0}/${amount})` });
    }
  }

  // ─── All validation passed — enroll profession + deduct costs ──────────────
  if (needsEnrollment) u.chosenProfessions.push(recipe.profession);

  if (recipe.cost?.gold) {
    if (u.currencies) u.currencies.gold -= recipe.cost.gold;
    else u.gold = (u.gold || 0) - recipe.cost.gold;
  }
  for (const [matId, amount] of Object.entries(recipe.materials || {})) {
    u.craftingMaterials[matId] -= amount;
    if (u.craftingMaterials[matId] <= 0) delete u.craftingMaterials[matId];
  }

  // Update profession XP & timestamp
  u.professions = u.professions || {};
  u.professions[recipe.profession] = u.professions[recipe.profession] || { level: 0, xp: 0 };
  u.professions[recipe.profession].xp += profDef.xpPerCraft || 10;
  u.professions[recipe.profession].lastCraftAt = now();
  const newProfLevel = getProfLevel(u, recipe.profession);
  u.professions[recipe.profession].level = newProfLevel.level;

  let result = { success: true, message: '' };

  switch (recipeId) {
    case 'reroll_stat': {
      // Reroll one primary stat on an equipped item (pre-validated above)
      const eq = u.equipment[targetSlot];
      const template = state.gearById.get(eq.templateId) || state.itemTemplates?.get(eq.templateId);
      if (!template?.affixes?.primary?.pool?.length) return res.status(400).json({ error: 'Item has no rerollable primary stats' });
      // Pick a random primary stat and reroll it
      const primaryStats = Object.keys(eq.stats || {}).filter(s => PRIMARY_STATS.includes(s));
      if (primaryStats.length === 0) return res.status(400).json({ error: 'No primary stats to reroll' });
      const statIdx = targetStatIndex != null ? Math.min(targetStatIndex, primaryStats.length - 1) : Math.floor(Math.random() * primaryStats.length);
      const statToReroll = primaryStats[statIdx];
      const poolEntry = template.affixes.primary.pool.find(p => p.stat === statToReroll);
      if (poolEntry) {
        const oldVal = eq.stats[statToReroll];
        eq.stats[statToReroll] = poolEntry.min + Math.floor(Math.random() * (poolEntry.max - poolEntry.min + 1));
        result.message = `${statToReroll}: ${oldVal} → ${eq.stats[statToReroll]}`;
      } else {
        // Stat not in pool — pick random from pool
        const randomPool = template.affixes.primary.pool[Math.floor(Math.random() * template.affixes.primary.pool.length)];
        const oldVal = eq.stats[statToReroll];
        delete eq.stats[statToReroll];
        eq.stats[randomPool.stat] = randomPool.min + Math.floor(Math.random() * (randomPool.max - randomPool.min + 1));
        result.message = `${statToReroll} (${oldVal}) → ${randomPool.stat} (${eq.stats[randomPool.stat]})`;
      }
      result.updatedGear = eq;
      break;
    }

    case 'reroll_minor': {
      const eq = u.equipment[targetSlot];
      const template = state.gearById.get(eq.templateId) || state.itemTemplates?.get(eq.templateId);
      if (!template?.affixes?.minor?.pool?.length) return res.status(400).json({ error: 'Item has no rerollable minor stats' });
      const minorStats = Object.keys(eq.stats || {}).filter(s => MINOR_STATS.includes(s));
      if (minorStats.length === 0) {
        // Add a new minor stat from pool
        const pick = template.affixes.minor.pool[Math.floor(Math.random() * template.affixes.minor.pool.length)];
        eq.stats[pick.stat] = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
        result.message = `Neuer Minor-Stat: ${pick.stat} +${eq.stats[pick.stat]}`;
      } else {
        const statToReroll = minorStats[Math.floor(Math.random() * minorStats.length)];
        const poolEntry = template.affixes.minor.pool.find(p => p.stat === statToReroll);
        if (poolEntry) {
          const oldVal = eq.stats[statToReroll];
          eq.stats[statToReroll] = poolEntry.min + Math.floor(Math.random() * (poolEntry.max - poolEntry.min + 1));
          result.message = `${statToReroll}: ${oldVal} → ${eq.stats[statToReroll]}`;
        } else {
          // Stat not in pool — pick random from pool (same logic as reroll_stat)
          const randomPool = template.affixes.minor.pool[Math.floor(Math.random() * template.affixes.minor.pool.length)];
          const oldVal = eq.stats[statToReroll];
          delete eq.stats[statToReroll];
          eq.stats[randomPool.stat] = randomPool.min + Math.floor(Math.random() * (randomPool.max - randomPool.min + 1));
          result.message = `${statToReroll} (${oldVal}) → ${randomPool.stat} (${eq.stats[randomPool.stat]})`;
        }
      }
      result.updatedGear = eq;
      break;
    }

    case 'upgrade_rarity': {
      const eq = u.equipment[targetSlot];
      const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const currentIdx = RARITY_ORDER.indexOf(eq.rarity || 'common');
      if (Math.random() < 0.50) {
        eq.rarity = RARITY_ORDER[currentIdx + 1];
        result.message = `Veredelung erfolgreich! Item ist jetzt ${eq.rarity}!`;
        result.upgraded = true;
      } else {
        result.message = 'Veredelung fehlgeschlagen. Die Materialien sind verloren.';
        result.success = false;
      }
      result.updatedGear = eq;
      break;
    }

    case 'potion_xp':
    case 'potion_gold':
    case 'potion_luck': {
      u.activeBuffs = u.activeBuffs || [];
      if (u.activeBuffs.length >= 50) {
        result.message = 'Zu viele aktive Buffs! Schließe erst Quests ab.';
        result.success = false;
        break;
      }
      u.activeBuffs.push({
        type: recipe.result.buffType,
        questsRemaining: 3,
        activatedAt: now(),
      });
      const buffNames = { potion_xp: 'Erfahrung', potion_gold: 'Reichtum', potion_luck: 'Glück' };
      result.message = `Elixier der ${buffNames[recipeId] || 'Macht'} aktiviert! (3 Quests)`;
      break;
    }

    case 'potion_streak': {
      u.streakShields = (u.streakShields || 0) + 1;
      result.message = `Streak-Shield erhalten! (Gesamt: ${u.streakShields})`;
      break;
    }

    case 'enchant_gear': {
      const eq = u.equipment[targetSlot];
      const allStats = [...PRIMARY_STATS, ...MINOR_STATS];
      const stat = allStats[Math.floor(Math.random() * allStats.length)];
      const value = 2 + Math.floor(Math.random() * 3); // 2-4
      u.activeBuffs = u.activeBuffs || [];
      u.activeBuffs.push({
        type: `enchant_${stat}`,
        stat,
        value,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        activatedAt: now(),
      });
      result.message = `Temporäre Verzauberung: +${value} ${stat} für 24h`;
      break;
    }

    case 'permanent_enchant': {
      const eq = u.equipment[targetSlot];
      const stat = MINOR_STATS[Math.floor(Math.random() * MINOR_STATS.length)];
      const value = 1 + Math.floor(Math.random() * 2); // 1-2
      eq.stats = eq.stats || {};
      eq.stats[stat] = (eq.stats[stat] || 0) + value;
      result.message = `Permanente Verzauberung: +${value} ${stat}!`;
      result.updatedGear = eq;
      break;
    }

    // ─── Koch recipes ──────────────────────────────────────────────────────
    case 'meal_hearty':
    case 'meal_golden': {
      u.activeBuffs = u.activeBuffs || [];
      const buffType = recipe.result.buffType;
      u.activeBuffs.push({ type: buffType, questsRemaining: 5, activatedAt: now() });
      const mealNames = { meal_hearty: 'Herzhafter Eintopf', meal_golden: 'Goldene Suppe' };
      result.message = `${mealNames[recipeId] || 'Mahlzeit'} genossen! Buff aktiv für 5 Quests.`;
      break;
    }
    case 'meal_feast': {
      u.activeBuffs = u.activeBuffs || [];
      u.activeBuffs.push({ type: 'xp_boost_15', questsRemaining: 3, activatedAt: now() });
      u.activeBuffs.push({ type: 'gold_boost_10', questsRemaining: 3, activatedAt: now() });
      result.message = 'Sternenbankett! +15% XP + 10% Gold für 3 Quests!';
      break;
    }
    case 'meal_forge': {
      u.forgeTemp = Math.min(100, (u.forgeTemp || 0) + (recipe.result.amount || 15));
      result.message = `Forge-Temperatur um ${recipe.result.amount || 15} erhöht! (${u.forgeTemp}%)`;
      break;
    }
    case 'meal_endurance': {
      u.streakShields = (u.streakShields || 0) + 1;
      result.message = `Ausdauer-Ration! Streak-Shield erhalten (Gesamt: ${u.streakShields})`;
      break;
    }

    default:
      return res.status(400).json({ error: `Unknown recipe: ${recipeId}` });
  }

  saveUsers();
  res.json({
    ...result,
    professions: u.professions,
    craftingMaterials: u.craftingMaterials,
    gold: u.currencies?.gold ?? u.gold ?? 0,
    newProfLevel: newProfLevel.level,
    profLevelUp: newProfLevel.level > profProgress.level,
  });
});

// ─── POST /api/professions/switch — drop a profession to choose another ─────
router.post('/api/professions/switch', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { dropProfession } = req.body;
  if (!dropProfession) return res.status(400).json({ error: 'dropProfession required' });

  u.chosenProfessions = u.chosenProfessions || [];
  if (!u.chosenProfessions.includes(dropProfession)) {
    return res.status(400).json({ error: `${dropProfession} ist kein aktiver Beruf` });
  }

  // Cost: 200 essenz to switch (lose all profession XP)
  const { ensureUserCurrencies } = require('../lib/state');
  ensureUserCurrencies(u);
  const switchCost = 200;
  if ((u.currencies.essenz || 0) < switchCost) {
    return res.status(400).json({ error: `Berufswechsel kostet ${switchCost} Essenz (du hast ${u.currencies.essenz || 0})` });
  }
  u.currencies.essenz -= switchCost;

  // Remove profession
  u.chosenProfessions = u.chosenProfessions.filter(p => p !== dropProfession);
  // Reset profession XP
  if (u.professions?.[dropProfession]) {
    u.professions[dropProfession] = { level: 0, xp: 0, lastCraftAt: null };
  }

  saveUsers();
  res.json({
    message: `${dropProfession} abgelegt. Du kannst jetzt einen neuen Beruf wählen.`,
    chosenProfessions: u.chosenProfessions,
    essenz: u.currencies.essenz,
  });
});

// ─── Schmiedekunst (Kanai's Cube) ────────────────────────────────────────────
// Dismantle items into Essenz, transmute 3 epics of same slot → 1 legendary

const DISMANTLE_ESSENZ = { common: 2, uncommon: 5, rare: 15, epic: 40, legendary: 100 };
const DISMANTLE_MATERIALS = {
  common: [{ id: 'eisenerz', chance: 0.5 }, { id: 'magiestaub', chance: 0.3 }],
  uncommon: [{ id: 'eisenerz', chance: 0.6 }, { id: 'kristallsplitter', chance: 0.3 }, { id: 'magiestaub', chance: 0.4 }],
  rare: [{ id: 'kristallsplitter', chance: 0.5 }, { id: 'drachenschuppe', chance: 0.2 }, { id: 'runenstein', chance: 0.4 }],
  epic: [{ id: 'drachenschuppe', chance: 0.5 }, { id: 'aetherkern', chance: 0.15 }, { id: 'runenstein', chance: 0.4 }],
  legendary: [{ id: 'aetherkern', chance: 0.6 }, { id: 'seelensplitter', chance: 0.1 }, { id: 'phoenixfeder', chance: 0.3 }],
};

// POST /api/schmiedekunst/dismantle — dismantle an inventory item into essenz + materials
router.post('/api/schmiedekunst/dismantle', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { inventoryItemId } = req.body;
  if (!inventoryItemId) return res.status(400).json({ error: 'inventoryItemId required' });

  u.inventory = u.inventory || [];
  const idx = u.inventory.findIndex(i => (i.instanceId || i.id) === inventoryItemId);
  if (idx === -1) return res.status(404).json({ error: 'Item not in inventory' });
  const item = u.inventory[idx];

  // Cannot dismantle currently equipped items
  if (u.equipment) {
    for (const slotVal of Object.values(u.equipment)) {
      if (slotVal && typeof slotVal === 'object' && slotVal.instanceId === inventoryItemId) {
        return res.status(400).json({ error: 'Kann ausgerüstete Items nicht zerlegen' });
      }
    }
  }

  const rarity = item.rarity || 'common';
  const essenzGained = DISMANTLE_ESSENZ[rarity] || 2;
  const matDrops = DISMANTLE_MATERIALS[rarity] || DISMANTLE_MATERIALS.common;

  // Remove from inventory
  u.inventory.splice(idx, 1);

  // Award essenz
  const { ensureUserCurrencies } = require('../lib/state');
  ensureUserCurrencies(u);
  u.currencies.essenz = (u.currencies.essenz || 0) + essenzGained;

  // Roll material drops
  u.craftingMaterials = u.craftingMaterials || {};
  const materialsGained = [];
  for (const mat of matDrops) {
    if (Math.random() < mat.chance) {
      u.craftingMaterials[mat.id] = (u.craftingMaterials[mat.id] || 0) + 1;
      const matDef = PROFESSIONS_DATA.materials?.find(m => m.id === mat.id);
      materialsGained.push({ id: mat.id, name: matDef?.name || mat.id, amount: 1 });
    }
  }

  saveUsers();
  res.json({
    message: `${item.name} zerlegt! +${essenzGained} Essenz${materialsGained.length > 0 ? ' + Materialien' : ''}`,
    dismantled: { name: item.name, rarity },
    essenzGained,
    materialsGained,
    currencies: u.currencies,
    craftingMaterials: u.craftingMaterials,
  });
});

// POST /api/schmiedekunst/transmute — combine 3 epics of same slot → 1 legendary
router.post('/api/schmiedekunst/transmute', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { itemIds } = req.body; // array of 3 inventory instanceIds
  if (!itemIds || !Array.isArray(itemIds) || itemIds.length !== 3) {
    return res.status(400).json({ error: '3 itemIds required' });
  }
  // Prevent duplicate IDs (exploit: same item counted 3x)
  if (new Set(itemIds).size !== 3) {
    return res.status(400).json({ error: 'Alle 3 Items müssen unterschiedlich sein' });
  }

  u.inventory = u.inventory || [];
  const items = [];
  for (const id of itemIds) {
    const item = u.inventory.find(i => (i.instanceId || i.id) === id);
    if (!item) return res.status(404).json({ error: `Item ${id} not found in inventory` });
    items.push(item);
  }

  // Validate: none can be equipped
  if (u.equipment) {
    const equippedIds = new Set(Object.values(u.equipment).filter(v => v && typeof v === 'object').map(v => v.instanceId));
    for (const item of items) {
      if (equippedIds.has(item.instanceId || item.id)) {
        return res.status(400).json({ error: `"${item.name}" ist ausgerüstet — erst ablegen` });
      }
    }
  }

  // Validate: all must be epic rarity
  const allEpic = items.every(i => (i.rarity || 'common') === 'epic');
  if (!allEpic) return res.status(400).json({ error: 'Alle 3 Items müssen episch sein' });

  // Validate: all must be same slot (look up from template if not on instance)
  const slots = items.map(i => {
    if (i.slot) return i.slot;
    if (i.resolvedGear?.slot) return i.resolvedGear.slot;
    // Fallback: look up template
    const tmpl = state.gearById.get(i.templateId) || state.itemTemplates?.get(i.templateId || i.itemId);
    return tmpl?.slot || null;
  });
  const slot = slots[0];
  if (!slot) return res.status(400).json({ error: 'Slot konnte nicht ermittelt werden — Items ungültig' });
  if (!slots.every(s => s === slot)) {
    return res.status(400).json({ error: `Alle Items müssen denselben Slot haben (${slots.filter(Boolean).join(', ')})` });
  }

  // Gold cost
  const transmuteCost = 500;
  const userGold = u.currencies?.gold ?? u.gold ?? 0;
  if (userGold < transmuteCost) {
    return res.status(400).json({ error: `Nicht genug Gold (${userGold}/${transmuteCost})` });
  }

  // Find legendary items in same slot
  const { createGearInstance } = require('../lib/helpers');
  const legendaryPool = state.FULL_GEAR_ITEMS.filter(g =>
    g.slot === slot && g.rarity === 'legendary' && g.tier === 4
  );
  if (legendaryPool.length === 0) {
    return res.status(400).json({ error: `Kein Legendär für Slot "${slot}" verfügbar` });
  }

  // Deduct gold
  if (u.currencies) u.currencies.gold -= transmuteCost;
  else u.gold = (u.gold || 0) - transmuteCost;

  // Remove the 3 epic items from inventory
  for (const item of items) {
    const removeIdx = u.inventory.findIndex(i => (i.instanceId || i.id) === (item.instanceId || item.id));
    if (removeIdx !== -1) u.inventory.splice(removeIdx, 1);
  }

  // Create legendary
  const template = legendaryPool[Math.floor(Math.random() * legendaryPool.length)];
  const legendary = createGearInstance(template);
  u.inventory.push(legendary);

  saveUsers();
  res.json({
    message: `Schmiedekunst erfolgreich! ${legendary.name} wurde geschmiedet!`,
    consumed: items.map(i => ({ name: i.name, rarity: i.rarity })),
    created: legendary,
    goldSpent: transmuteCost,
    gold: u.currencies?.gold ?? u.gold ?? 0,
  });
});

module.exports = router;
module.exports.loadProfessions = loadProfessions;
