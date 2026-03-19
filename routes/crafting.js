/**
 * Crafting & Professions Routes — Schmied, Alchemist, Verzauberer
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers, ensureUserCurrencies } = require('../lib/state');
const { now, getLevelInfo, PRIMARY_STATS, MINOR_STATS, createGearInstance } = require('../lib/helpers');

const VALID_SLOTS = ['weapon', 'shield', 'helm', 'armor', 'amulet', 'boots'];
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const SLOT_RECIPES = ['reroll_stat', 'reroll_minor', 'upgrade_rarity', 'permanent_enchant', 'reinforce_armor', 'enchant_socket'];
const { requireAuth } = require('../lib/middleware');

// ─── Helper: collect equipped item instanceIds ──────────────────────────────
function getEquippedIds(u) {
  const ids = new Set();
  if (u.equipment) {
    for (const v of Object.values(u.equipment)) {
      if (v && typeof v === 'object' && v.instanceId) ids.add(v.instanceId);
    }
  }
  return ids;
}

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

// ─── Proficiency ranks (WoW-style named tiers) ─────────────────────────────
const PROFICIENCY_RANKS = [
  { min: 0, max: 0, name: 'Novice', color: '#6b7280' },
  { min: 1, max: 2, name: 'Apprentice', color: '#22c55e' },
  { min: 3, max: 4, name: 'Journeyman', color: '#3b82f6' },
  { min: 5, max: 6, name: 'Expert', color: '#a855f7' },
  { min: 7, max: 8, name: 'Artisan', color: '#f59e0b' },
  { min: 9, max: 10, name: 'Master', color: '#ef4444' },
];

function getProfRank(level) {
  for (let i = PROFICIENCY_RANKS.length - 1; i >= 0; i--) {
    if (level >= PROFICIENCY_RANKS[i].min) return PROFICIENCY_RANKS[i];
  }
  return PROFICIENCY_RANKS[0];
}

// ─── Skill-up color for recipes (WoW-style: orange/yellow/green/gray) ───────
function getSkillUpColor(profLevel, reqProfLevel) {
  const diff = profLevel - reqProfLevel;
  if (diff <= 0) return 'orange';   // guaranteed skill-up
  if (diff <= 2) return 'yellow';   // likely skill-up
  if (diff <= 4) return 'green';    // rare skill-up
  return 'gray';                     // no skill-up
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

// ─── Helper: check if recipe is discovered for this player ──────────────────
function isRecipeDiscovered(recipe, profProgress) {
  if (!recipe.discovery) return true; // no discovery gate = always visible
  if (recipe.discovery.type === 'profLevel') return profProgress.level >= recipe.discovery.value;
  return true;
}

// ─── Helper: check if player gets daily crafting bonus ───────────────────────
function getDailyBonusInfo(u) {
  const today = new Date().toISOString().slice(0, 10);
  const lastCraftDate = u?.lastCraftDate || null;
  const hasCraftedToday = lastCraftDate === today;
  return { dailyBonusAvailable: !hasCraftedToday, lastCraftDate };
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
    const rank = getProfRank(profProgress.level);
    return {
      ...p,
      unlocked,
      chosen,
      canChoose,
      playerLevel: profProgress.level,
      playerXp: profProgress.xp,
      nextLevelXp: p.levelThresholds[profProgress.level] || null,
      lastCraftAt: lastCraft,
      rank: rank.name,
      rankColor: rank.color,
    };
  });
  // Filter out undiscovered recipes — they should not appear in the UI at all
  const recipes = PROFESSIONS_DATA.recipes
    .filter(r => {
      const profProgress = u ? getProfLevel(u, r.profession) : { level: 0, xp: 0 };
      return isRecipeDiscovered(r, profProgress);
    })
    .map(r => {
      const profProgress = u ? getProfLevel(u, r.profession) : { level: 0 };
      const recipeCooldowns = (u?.professions || {})[r.profession]?.recipeCooldowns || {};
      const lastRecipeCraft = recipeCooldowns[r.id] || null;
      let cooldownRemaining = 0;
      if (r.cooldownMinutes > 0 && lastRecipeCraft) {
        const elapsed = (Date.now() - new Date(lastRecipeCraft).getTime()) / 1000;
        cooldownRemaining = Math.max(0, Math.ceil(r.cooldownMinutes * 60 - elapsed));
      }
      return {
        ...r,
        canCraft: profProgress.level >= r.reqProfLevel,
        skillUpColor: getSkillUpColor(profProgress.level, r.reqProfLevel),
        cooldownRemaining,
      };
    });
  const materials = u?.craftingMaterials || {};
  const currencies = u ? { essenz: u.currencies?.essenz ?? 0, gold: u.currencies?.gold ?? u.gold ?? 0, stardust: u.currencies?.stardust ?? 0 } : {};
  const dailyBonus = u ? getDailyBonusInfo(u) : { dailyBonusAvailable: false };
  res.json({ professions, recipes, materials, materialDefs: PROFESSIONS_DATA.materials, proficiencyRanks: PROFICIENCY_RANKS, currencies, dailyBonus });
});

// ─── POST /api/professions/craft — execute a recipe ─────────────────────────
router.post('/api/professions/craft', requireAuth, (req, res) => {
  const { recipeId, targetSlot, targetStatIndex, count: rawCount } = req.body;
  const count = Math.max(1, Math.min(10, parseInt(rawCount) || 1)); // batch: 1-10
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
    return res.status(400).json({ error: `You already have 2 professions (${u.chosenProfessions.join(', ')}). Drop one first.` });
  }

  // Check profession level
  const profProgress = getProfLevel(u, recipe.profession);
  if (profProgress.level < recipe.reqProfLevel) {
    return res.status(400).json({ error: `Requires ${profDef.name} level ${recipe.reqProfLevel}` });
  }

  // Check cooldown (per-recipe, not per-profession)
  const recipeCooldowns = (u.professions || {})[recipe.profession]?.recipeCooldowns || {};
  const lastRecipeCraft = recipeCooldowns[recipeId] || null;
  if (recipe.cooldownMinutes > 0 && lastRecipeCraft) {
    const elapsed = (Date.now() - new Date(lastRecipeCraft).getTime()) / 60000;
    if (elapsed < recipe.cooldownMinutes) {
      const remaining = Math.ceil(recipe.cooldownMinutes - elapsed);
      return res.status(429).json({ error: `Cooldown: ${remaining} minutes remaining` });
    }
  }

  // ─── Pre-validate recipe requirements BEFORE deducting anything ──────────
  // Validate targetSlot early (needed by Schmied/Verzauberer recipes)
  if (targetSlot && !VALID_SLOTS.includes(targetSlot)) {
    return res.status(400).json({ error: `Invalid slot: ${targetSlot}` });
  }

  // Slot-requiring recipes can't batch (they target specific gear)
  const isSlotRecipe = SLOT_RECIPES.includes(recipeId);
  const effectiveCount = isSlotRecipe ? 1 : count;

  // Validate slot-requiring recipes have a targetSlot and valid gear
  if (isSlotRecipe) {
    if (!targetSlot) return res.status(400).json({ error: 'targetSlot required' });
    const eq = u.equipment?.[targetSlot];
    if (!eq || typeof eq === 'string') return res.status(400).json({ error: 'No gear instance in slot' });
    if (recipeId === 'upgrade_rarity') {
      if (RARITY_ORDER.indexOf(eq.rarity || 'common') >= RARITY_ORDER.length - 1) {
        return res.status(400).json({ error: 'Item is already legendary!' });
      }
    }
    // Pre-validate reroll has valid template/stats BEFORE deducting costs
    if (recipeId === 'reroll_stat') {
      const template = state.gearById.get(eq.templateId) || state.itemTemplates?.get(eq.templateId);
      if (!template?.affixes?.primary?.pool?.length) return res.status(400).json({ error: 'Item has no rerollable primary stats' });
      const primaryStats = Object.keys(eq.stats || {}).filter(s => PRIMARY_STATS.includes(s));
      if (primaryStats.length === 0) return res.status(400).json({ error: 'No primary stats to reroll' });
    }
    if (recipeId === 'reroll_minor') {
      const template = state.gearById.get(eq.templateId) || state.itemTemplates?.get(eq.templateId);
      if (!template?.affixes?.minor?.pool?.length) return res.status(400).json({ error: 'Item has no rerollable minor stats' });
    }
  }

  // Check gold cost (×count for batch)
  const totalGoldCost = (recipe.cost?.gold || 0) * effectiveCount;
  if (totalGoldCost > 0) {
    const userGold = u.currencies?.gold ?? u.gold ?? 0;
    if (userGold < totalGoldCost) {
      return res.status(400).json({ error: `Not enough gold (${userGold}/${totalGoldCost})` });
    }
  }

  // Check materials (×count for batch)
  u.craftingMaterials = u.craftingMaterials || {};
  for (const [matId, amount] of Object.entries(recipe.materials || {})) {
    const needed = amount * effectiveCount;
    if ((u.craftingMaterials[matId] || 0) < needed) {
      const matDef = PROFESSIONS_DATA.materials.find(m => m.id === matId);
      return res.status(400).json({ error: `Not enough ${matDef?.name || matId} (${u.craftingMaterials[matId] || 0}/${needed})` });
    }
  }

  // ─── All validation passed — enroll profession + deduct costs ──────────────
  if (needsEnrollment) u.chosenProfessions.push(recipe.profession);

  // Deduct gold (×count)
  if (totalGoldCost > 0) {
    if (u.currencies) u.currencies.gold -= totalGoldCost;
    else u.gold = (u.gold || 0) - totalGoldCost;
  }
  // Deduct materials (×count)
  for (const [matId, amount] of Object.entries(recipe.materials || {})) {
    u.craftingMaterials[matId] -= amount * effectiveCount;
    if (u.craftingMaterials[matId] <= 0) delete u.craftingMaterials[matId];
  }

  // Update profession XP & timestamp — use recipe-specific xpGain with daily bonus
  u.professions = u.professions || {};
  u.professions[recipe.profession] = u.professions[recipe.profession] || { level: 0, xp: 0 };
  const baseXp = (recipe.xpGain || profDef.xpPerCraft || 10) * effectiveCount;
  const { dailyBonusAvailable } = getDailyBonusInfo(u);
  const xpMultiplier = dailyBonusAvailable ? 2 : 1;
  const totalXpGained = baseXp * xpMultiplier;
  u.professions[recipe.profession].xp += totalXpGained;
  u.professions[recipe.profession].lastCraftAt = now();
  // Track per-recipe cooldown
  if (recipe.cooldownMinutes > 0) {
    u.professions[recipe.profession].recipeCooldowns = u.professions[recipe.profession].recipeCooldowns || {};
    u.professions[recipe.profession].recipeCooldowns[recipeId] = now();
  }
  u.lastCraftDate = new Date().toISOString().slice(0, 10); // track daily bonus
  const newProfLevel = getProfLevel(u, recipe.profession);
  u.professions[recipe.profession].level = newProfLevel.level;

  let result = { success: true, message: '' };

  switch (recipeId) {
    case 'reroll_stat': {
      const eq = u.equipment[targetSlot];
      const template = state.gearById.get(eq.templateId) || state.itemTemplates?.get(eq.templateId);
      const primaryStats = Object.keys(eq.stats || {}).filter(s => PRIMARY_STATS.includes(s));
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
      const minorStats = Object.keys(eq.stats || {}).filter(s => MINOR_STATS.includes(s));
      if (minorStats.length === 0) {
        // Add a new minor stat from pool
        const pick = template.affixes.minor.pool[Math.floor(Math.random() * template.affixes.minor.pool.length)];
        eq.stats[pick.stat] = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
        result.message = `New minor stat: ${pick.stat} +${eq.stats[pick.stat]}`;
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
      const currentIdx = RARITY_ORDER.indexOf(eq.rarity || 'common');
      if (Math.random() < 0.50) {
        eq.rarity = RARITY_ORDER[currentIdx + 1];
        result.message = `Upgrade successful! Item is now ${eq.rarity}!`;
        result.upgraded = true;
      } else {
        result.message = 'Upgrade failed. Materials are lost.';
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
        result.message = 'Too many active buffs! Complete quests first.';
        result.success = false;
        break;
      }
      u.activeBuffs.push({
        type: recipe.result.buffType,
        questsRemaining: 3,
        activatedAt: now(),
      });
      const buffNames = { potion_xp: 'Experience', potion_gold: 'Wealth', potion_luck: 'Luck' };
      result.message = `Elixir of ${buffNames[recipeId] || 'Power'} activated! (3 Quests)`;
      break;
    }

    case 'potion_streak': {
      u.streakShields = Math.min(10, (u.streakShields || 0) + effectiveCount);
      result.message = `Streak Shield received! (Total: ${u.streakShields})`;
      break;
    }

    case 'potion_doubledown': {
      u.activeBuffs = u.activeBuffs || [];
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: 'xp_boost_25', questsRemaining: 5, activatedAt: now() });
        u.activeBuffs.push({ type: 'gold_boost_20', questsRemaining: 5, activatedAt: now() });
      }
      result.message = `Flask of Ambition activated! +25% XP + 20% Gold for 5 quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}`;
      break;
    }

    case 'enchant_gear': {
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
      result.message = `Temporary enchantment: +${value} ${stat} for 24h`;
      break;
    }

    case 'permanent_enchant': {
      const eq = u.equipment[targetSlot];
      const stat = MINOR_STATS[Math.floor(Math.random() * MINOR_STATS.length)];
      const value = 1 + Math.floor(Math.random() * 2); // 1-2
      eq.stats = eq.stats || {};
      eq.stats[stat] = (eq.stats[stat] || 0) + value;
      result.message = `Permanent enchantment: +${value} ${stat}!`;
      result.updatedGear = eq;
      break;
    }

    case 'enchant_socket': {
      const eq = u.equipment[targetSlot];
      const stat = PRIMARY_STATS[Math.floor(Math.random() * PRIMARY_STATS.length)];
      const value = 3 + Math.floor(Math.random() * 3); // 3-5
      eq.stats = eq.stats || {};
      eq.stats[stat] = (eq.stats[stat] || 0) + value;
      result.message = `Arcane Infusion: +${value} ${stat} permanently!`;
      result.updatedGear = eq;
      break;
    }

    case 'reinforce_armor': {
      const eq = u.equipment[targetSlot];
      const stat = PRIMARY_STATS[Math.floor(Math.random() * PRIMARY_STATS.length)];
      const value = 3 + Math.floor(Math.random() * 4); // 3-6
      eq.stats = eq.stats || {};
      eq.stats[stat] = (eq.stats[stat] || 0) + value;
      result.message = `Reinforced! +${value} ${stat} permanently!`;
      result.updatedGear = eq;
      break;
    }

    // ─── Koch recipes ──────────────────────────────────────────────────────
    case 'meal_hearty':
    case 'meal_golden': {
      u.activeBuffs = u.activeBuffs || [];
      const buffType = recipe.result.buffType;
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: buffType, questsRemaining: 5, activatedAt: now() });
      }
      const mealNames = { meal_hearty: 'Hearty Stew', meal_golden: 'Golden Soup' };
      result.message = `${mealNames[recipeId] || 'Meal'} consumed! Buff active for 5 quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}.`;
      break;
    }
    case 'meal_feast': {
      u.activeBuffs = u.activeBuffs || [];
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: 'xp_boost_15', questsRemaining: 3, activatedAt: now() });
        u.activeBuffs.push({ type: 'gold_boost_10', questsRemaining: 3, activatedAt: now() });
      }
      result.message = `Star Banquet! +15% XP + 10% Gold for 3 quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}!`;
      break;
    }
    case 'meal_forge': {
      const totalAmount = (recipe.result.amount || 15) * effectiveCount;
      u.forgeTemp = Math.min(100, (u.forgeTemp || 0) + totalAmount);
      result.message = `Forge temperature raised by ${totalAmount}! (${u.forgeTemp}%)`;
      break;
    }
    case 'meal_endurance': {
      u.streakShields = Math.min(10, (u.streakShields || 0) + effectiveCount);
      result.message = `Endurance Ration! Streak Shield received (Total: ${u.streakShields})`;
      break;
    }
    case 'meal_champions': {
      u.activeBuffs = u.activeBuffs || [];
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: 'xp_boost_20', questsRemaining: 5, activatedAt: now() });
        u.activeBuffs.push({ type: 'gold_boost_15', questsRemaining: 5, activatedAt: now() });
        u.activeBuffs.push({ type: 'luck_boost_10', questsRemaining: 5, activatedAt: now() });
      }
      result.message = `Champion's Feast! +20% XP + 15% Gold + 10% Luck for 5 quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}!`;
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
    xpGained: totalXpGained,
    dailyBonusUsed: dailyBonusAvailable,
    craftCount: effectiveCount,
  });
});

// ─── POST /api/professions/choose — explicitly enroll in a profession ────────
router.post('/api/professions/choose', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { professionId } = req.body;
  if (!professionId) return res.status(400).json({ error: 'professionId required' });

  const profDef = PROFESSIONS_DATA.professions.find(p => p.id === professionId);
  if (!profDef) return res.status(404).json({ error: 'Profession not found' });

  // Check unlock condition
  const playerLevel = getLevelInfo(u.xp || 0).level;
  if (profDef.unlockCondition?.type === 'level' && playerLevel < profDef.unlockCondition.value) {
    return res.status(400).json({ error: `Requires player level ${profDef.unlockCondition.value}` });
  }

  u.chosenProfessions = u.chosenProfessions || [];
  if (u.chosenProfessions.includes(professionId)) {
    return res.status(400).json({ error: `${profDef.name} is already an active profession.` });
  }
  if (u.chosenProfessions.length >= 2) {
    return res.status(400).json({ error: `You already have 2 professions (${u.chosenProfessions.join(', ')}). Drop one first.` });
  }

  u.chosenProfessions.push(professionId);
  u.professions = u.professions || {};
  if (!u.professions[professionId]) u.professions[professionId] = { xp: 0, lastCraftAt: null };
  saveUsers();

  res.json({
    message: `${profDef.name} chosen! You can now craft at ${profDef.npcName}.`,
    chosenProfessions: u.chosenProfessions,
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
    return res.status(400).json({ error: `${dropProfession} is not an active profession` });
  }

  // Cost: 200 essenz to switch (lose all profession XP)
  ensureUserCurrencies(u);
  const switchCost = 200;
  if ((u.currencies.essenz || 0) < switchCost) {
    return res.status(400).json({ error: `Switching professions costs ${switchCost} Essenz (you have ${u.currencies.essenz || 0})` });
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
    message: `${dropProfession} dropped. You can now choose a new profession.`,
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
  if (getEquippedIds(u).has(inventoryItemId)) {
    return res.status(400).json({ error: 'Cannot dismantle equipped items' });
  }

  const rarity = item.rarity || 'common';
  const essenzGained = DISMANTLE_ESSENZ[rarity] || 2;
  const matDrops = DISMANTLE_MATERIALS[rarity] || DISMANTLE_MATERIALS.common;

  // Remove from inventory
  u.inventory.splice(idx, 1);

  // Award essenz
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
    message: `${item.name} dismantled! +${essenzGained} Essenz${materialsGained.length > 0 ? ' + Materials' : ''}`,
    dismantled: { name: item.name, rarity },
    essenzGained,
    materialsGained,
    currencies: u.currencies,
    craftingMaterials: u.craftingMaterials,
  });
});

// POST /api/schmiedekunst/dismantle-all — bulk dismantle by rarity (D3-style Salvage All)
router.post('/api/schmiedekunst/dismantle-all', requireAuth, (req, res) => {
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

  u.inventory = u.inventory || [];
  const equippedIds = getEquippedIds(u);

  const toDismantle = u.inventory.filter(i =>
    (i.rarity || 'common') === rarity && i.name && !equippedIds.has(i.instanceId || i.id)
  );
  if (toDismantle.length === 0) return res.status(400).json({ error: `No ${rarity} items to dismantle` });

  ensureUserCurrencies(u);
  u.craftingMaterials = u.craftingMaterials || {};

  let totalEssenz = 0;
  const allMats = {};
  const dismantleIds = new Set(toDismantle.map(i => i.instanceId || i.id));
  for (const item of toDismantle) {
    totalEssenz += DISMANTLE_ESSENZ[rarity] || 2;
    for (const mat of (DISMANTLE_MATERIALS[rarity] || DISMANTLE_MATERIALS.common)) {
      if (Math.random() < mat.chance) {
        u.craftingMaterials[mat.id] = (u.craftingMaterials[mat.id] || 0) + 1;
        allMats[mat.id] = (allMats[mat.id] || 0) + 1;
      }
    }
  }
  // Remove all dismantled items in one pass (O(n) instead of O(n²))
  u.inventory = u.inventory.filter(i => !dismantleIds.has(i.instanceId || i.id));

  u.currencies.essenz = (u.currencies.essenz || 0) + totalEssenz;
  saveUsers();

  const matList = Object.entries(allMats).map(([id, amt]) => {
    const def = PROFESSIONS_DATA.materials?.find(m => m.id === id);
    return `${def?.name || id} x${amt}`;
  });
  res.json({
    message: `${toDismantle.length}x ${rarity} dismantled! +${totalEssenz} Essenz${matList.length ? ` + ${matList.join(', ')}` : ''}`,
    count: toDismantle.length,
    totalEssenz,
    materialsGained: allMats,
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
    return res.status(400).json({ error: 'All 3 items must be different' });
  }

  u.inventory = u.inventory || [];
  const items = [];
  for (const id of itemIds) {
    const item = u.inventory.find(i => (i.instanceId || i.id) === id);
    if (!item) return res.status(404).json({ error: `Item ${id} not found in inventory` });
    items.push(item);
  }

  // Validate: none can be equipped
  const equippedIds = getEquippedIds(u);
  for (const item of items) {
    if (equippedIds.has(item.instanceId || item.id)) {
      return res.status(400).json({ error: `"${item.name}" is equipped — unequip first` });
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
    g.slot === slot && g.rarity === 'legendary' && g.tier === 4
  );
  if (legendaryPool.length === 0) {
    return res.status(400).json({ error: `No legendary available for slot "${slot}"` });
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
    message: `Transmutation successful! ${legendary.name} has been forged!`,
    consumed: items.map(i => ({ name: i.name, rarity: i.rarity })),
    created: legendary,
    goldSpent: transmuteCost,
    gold: u.currencies?.gold ?? u.gold ?? 0,
  });
});

module.exports = router;
module.exports.loadProfessions = loadProfessions;
