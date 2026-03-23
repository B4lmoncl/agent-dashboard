/**
 * Crafting & Professions Routes — Schmied, Alchemist, Verzauberer
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers, saveUsersSync, ensureUserCurrencies } = require('../lib/state');
const { now, getLevelInfo, PRIMARY_STATS, MINOR_STATS, createGearInstance, getLegendaryModifiers, rollAffixStats, getArmorTraitBonus, INVENTORY_CAP } = require('../lib/helpers');

const VALID_SLOTS = ['weapon', 'shield', 'helm', 'armor', 'amulet', 'boots'];
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const SLOT_RECIPES = ['upgrade_rarity', 'permanent_enchant', 'reinforce_armor', 'enchant_socket', 'sharpen_blade'];
const { requireAuth } = require('../lib/middleware');

// ─── Crafting lock (prevents concurrent craft for same player) ──────────────
const _craftLocks = new Map();
function acquireCraftLock(playerId) {
  if (_craftLocks.has(playerId)) return false;
  _craftLocks.set(playerId, true);
  return true;
}
function releaseCraftLock(playerId) {
  _craftLocks.delete(playerId);
}

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

// ─── WoW Classic-style proficiency ranks (4 tiers with skill caps) ───────────
const PROFICIENCY_RANKS = [
  { name: 'Apprentice', skillCap: 75, reqPlayerLevel: 5, color: '#22c55e' },
  { name: 'Journeyman', skillCap: 150, reqPlayerLevel: 15, color: '#3b82f6' },
  { name: 'Expert', skillCap: 225, reqPlayerLevel: 25, color: '#a855f7' },
  { name: 'Artisan', skillCap: 300, reqPlayerLevel: 40, color: '#f59e0b' },
];
const MAX_SKILL = 300;

function getProfRank(skill) {
  for (let i = PROFICIENCY_RANKS.length - 1; i >= 0; i--) {
    if (skill > (i > 0 ? PROFICIENCY_RANKS[i - 1].skillCap : 0)) return PROFICIENCY_RANKS[i];
  }
  return PROFICIENCY_RANKS[0];
}

function getSkillCap(playerLevel) {
  let cap = 0;
  for (const rank of PROFICIENCY_RANKS) {
    if (playerLevel >= rank.reqPlayerLevel) cap = rank.skillCap;
  }
  return cap || 75; // default Apprentice cap
}

// ─── Convert reqProfLevel (1-10) to reqSkill (1-300) ────────────────────────
const PROF_LEVEL_TO_SKILL = [0, 1, 30, 60, 90, 120, 150, 180, 210, 250, 280];
function reqProfLevelToSkill(reqProfLevel) {
  return PROF_LEVEL_TO_SKILL[reqProfLevel] || reqProfLevel;
}

// ─── WoW Classic skill-up: per-recipe color breakpoints + sliding probability ─
function getRecipeBreakpoints(reqSkill) {
  // WoW-style: ~25 skill span per color zone
  return {
    yellow: reqSkill + 25,
    green: reqSkill + 50,
    gray: reqSkill + 75,
  };
}

function getSkillUpColor(playerSkill, reqSkill) {
  const bp = getRecipeBreakpoints(reqSkill);
  if (playerSkill < bp.yellow) return 'orange';
  if (playerSkill < bp.green) return 'yellow';
  if (playerSkill < bp.gray) return 'green';
  return 'gray';
}

// WoW Classic formula: linear interpolation from yellow→gray
// At yellow threshold: 100% chance. At gray threshold: 0% chance.
function getSkillUpChance(playerSkill, reqSkill) {
  const bp = getRecipeBreakpoints(reqSkill);
  if (playerSkill < bp.yellow) return 1.0; // orange = guaranteed
  if (playerSkill >= bp.gray) return 0;     // gray = impossible
  // Linear slide: (gray - skill) / (gray - yellow)
  return (bp.gray - playerSkill) / (bp.gray - bp.yellow);
}

// Max profession slots based on player level
function getMaxProfessionSlots(playerLevel) {
  const slots = PROFESSIONS_DATA.professionSlots || [{ playerLevel: 5, slot: 1 }, { playerLevel: 15, slot: 2 }];
  let maxSlots = 0;
  for (const s of slots) {
    if (playerLevel >= s.playerLevel) maxSlots = s.slot;
  }
  return maxSlots;
}

// Get player's profession skill (0-300)
function getProfSkill(u, profId) {
  const prof = (u.professions || {})[profId];
  return { skill: Math.min(prof?.skill || prof?.xp || 0, MAX_SKILL) };
}

// Backward compat alias
function getProfLevel(u, profId) {
  const { skill } = getProfSkill(u, profId);
  // Map skill back to approximate level for recipe reqProfLevel checks
  let level = 0;
  for (let i = PROF_LEVEL_TO_SKILL.length - 1; i >= 1; i--) {
    if (skill >= PROF_LEVEL_TO_SKILL[i]) { level = i; break; }
  }
  return { level, skill, xp: skill };
}

// ─── Helper: check if recipe is discovered/learned for this player ───────────
function isRecipeDiscovered(recipe, profProgress, user) {
  // Drop-source recipes: must be in player's learnedRecipes
  if (recipe.source === 'drop') {
    return (user?.learnedRecipes || []).includes(recipe.id);
  }
  // Trainer-source recipes with trainerCost: must be purchased (in learnedRecipes)
  if (recipe.source === 'trainer' && recipe.trainerCost > 0) {
    return (user?.learnedRecipes || []).includes(recipe.id);
  }
  // Faction-source recipes: must be in player's learnedRecipes (unlocked via faction rep)
  if (recipe.source === 'faction') {
    return (user?.learnedRecipes || []).includes(recipe.id);
  }
  // Legacy/free trainer recipes: use old discovery gate system
  if (!recipe.discovery) return true;
  if (recipe.discovery.type === 'profLevel') return profProgress.level >= recipe.discovery.value;
  return true;
}

// ─── Helper: check if recipe is visible (show in UI even if locked) ─────────
function isRecipeVisible(recipe, profProgress, user) {
  // Trainer recipes: always visible if profession level is met (show as "learnable")
  if (recipe.source === 'trainer') return profProgress.level >= recipe.reqProfLevel;
  // Drop recipes: only visible once learned
  if (recipe.source === 'drop') return (user?.learnedRecipes || []).includes(recipe.id);
  // Faction recipes: visible if profession level met (show as locked until rep earned)
  if (recipe.source === 'faction') return profProgress.level >= recipe.reqProfLevel;
  // Legacy: use discovery gate
  if (!recipe.discovery) return true;
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
    const profProgress = u ? getProfSkill(u, p.id) : { skill: 0 };
    const profLevel = u ? getProfLevel(u, p.id) : { level: 0, skill: 0 };
    const lastCraft = (u?.professions || {})[p.id]?.lastCraftAt || null;
    const chosen = (u?.chosenProfessions || []).includes(p.id);
    const pMaxSlots = u ? getMaxProfessionSlots(playerLevel) : 0;
    const canChoose = chosen || (u?.chosenProfessions || []).length < pMaxSlots;
    const rank = getProfRank(profProgress.skill);
    const skillCap = u ? getSkillCap(playerLevel) : 75;
    const masterySkill = PROFESSIONS_DATA.masteryConfig?.unlockSkill || 225;
    const masteryActive = profProgress.skill >= masterySkill;
    return {
      ...p,
      unlocked,
      chosen,
      canChoose,
      skill: profProgress.skill,
      maxSkill: MAX_SKILL,
      skillCap,
      // Legacy compat fields
      playerLevel: profLevel.level,
      playerXp: profProgress.skill,
      nextLevelXp: skillCap,
      lastCraftAt: lastCraft,
      rank: rank.name,
      rankColor: rank.color,
      masteryActive,
      masteryBonus: p.masteryBonus || null,
      gatheringAffinity: p.gatheringAffinity || [],
    };
  });
  // Filter recipes: show visible ones, mark learned/learnable status
  const recipes = PROFESSIONS_DATA.recipes
    .filter(r => {
      const profProgress = u ? getProfLevel(u, r.profession) : { level: 0, xp: 0 };
      return isRecipeVisible(r, profProgress, u);
    })
    .map(r => {
      const profProgress = u ? getProfLevel(u, r.profession) : { level: 0 };
      const learned = isRecipeDiscovered(r, profProgress, u);
      const recipeCooldowns = (u?.professions || {})[r.profession]?.recipeCooldowns || {};
      const lastRecipeCraft = recipeCooldowns[r.id] || null;
      let cooldownRemaining = 0;
      if (r.cooldownMinutes > 0 && lastRecipeCraft) {
        // Legendary effect: cooldownReduction — shorten crafting cooldowns
        const cdMods = u ? getLegendaryModifiers(u.id) : {};
        const cdReduce = 1 - (cdMods.cooldownReduction || 0);
        const effectiveCd = r.cooldownMinutes * cdReduce;
        const elapsed = (Date.now() - new Date(lastRecipeCraft).getTime()) / 1000;
        cooldownRemaining = Math.max(0, Math.ceil(effectiveCd * 60 - elapsed));
      }
      const reqSkill = r.reqSkill || reqProfLevelToSkill(r.reqProfLevel);
      const playerSkill = u ? getProfSkill(u, r.profession).skill : 0;
      return {
        ...r,
        reqSkill,
        learned,
        canCraft: learned && playerSkill >= reqSkill,
        skillUpColor: getSkillUpColor(playerSkill, reqSkill),
        skillUpChance: Math.round(getSkillUpChance(playerSkill, reqSkill) * 100),
        cooldownRemaining,
      };
    });
  const materials = u?.craftingMaterials || {};
  const currencies = u ? { essenz: u.currencies?.essenz ?? 0, gold: u.currencies?.gold ?? u.gold ?? 0, stardust: u.currencies?.stardust ?? 0 } : {};
  const dailyBonus = u ? getDailyBonusInfo(u) : { dailyBonusAvailable: false };
  const playerLvl = u ? getLevelInfo(u.xp || 0).level : 0;
  const maxProfSlots = getMaxProfessionSlots(playerLvl);
  const chosenCount = (u?.chosenProfessions || []).length;
  const learnedRecipes = u?.learnedRecipes || [];
  const masteryConfig = PROFESSIONS_DATA.masteryConfig || null;
  const gatheringConfig = PROFESSIONS_DATA.gatheringConfig || null;
  // Build reroll preview data: per-slot affix ranges for equipped gear
  const slotAffixRanges = {};
  if (u && u.equipment) {
    for (const slot of VALID_SLOTS) {
      const eq = u.equipment[slot];
      if (!eq || typeof eq !== 'object' || !eq.templateId) continue;
      const template = state.gearById.get(eq.templateId) || state.itemTemplates?.get(eq.templateId);
      if (!template || !template.affixes) continue;
      slotAffixRanges[slot] = {
        primary: (template.affixes.primary?.pool || []).map(p => ({ stat: p.stat, min: p.min, max: p.max })),
        minor: (template.affixes.minor?.pool || []).map(p => ({ stat: p.stat, min: p.min, max: p.max })),
        currentStats: eq.stats || {},
        itemName: eq.name || template.name || slot,
        rarity: eq.rarity || template.rarity || 'common',
      };
    }
  }
  res.json({ professions, recipes, materials, materialDefs: PROFESSIONS_DATA.materials, proficiencyRanks: PROFICIENCY_RANKS, skillUpColors: PROFESSIONS_DATA.skillUpColors || {}, currencies, dailyBonus, maxProfSlots, chosenCount, professionSlots: PROFESSIONS_DATA.professionSlots || [], learnedRecipes, masteryConfig, gatheringConfig, slotAffixRanges });
});

// ─── POST /api/professions/learn — buy a recipe from an NPC trainer ─────────
router.post('/api/professions/learn', requireAuth, (req, res) => {
  const { recipeId } = req.body;
  if (!recipeId) return res.status(400).json({ error: 'recipeId required' });

  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const recipe = PROFESSIONS_DATA.recipes.find(r => r.id === recipeId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  if (recipe.source !== 'trainer' || !recipe.trainerCost) {
    return res.status(400).json({ error: 'This recipe cannot be purchased from a trainer.' });
  }

  // Must have chosen the profession
  if (!(u.chosenProfessions || []).includes(recipe.profession)) {
    return res.status(400).json({ error: 'You must choose this profession first.' });
  }

  // Check profession level
  const profProgress = getProfLevel(u, recipe.profession);
  if (profProgress.level < recipe.reqProfLevel) {
    const profDef = PROFESSIONS_DATA.professions.find(p => p.id === recipe.profession);
    return res.status(400).json({ error: `Requires ${profDef?.name || recipe.profession} level ${recipe.reqProfLevel}` });
  }

  // Already learned?
  u.learnedRecipes = u.learnedRecipes || [];
  if (u.learnedRecipes.includes(recipeId)) {
    return res.status(400).json({ error: 'You already know this recipe.' });
  }

  // Check gold
  const goldNeeded = recipe.trainerCost;
  if ((u.currencies?.gold ?? u.gold ?? 0) < goldNeeded) {
    return res.status(400).json({ error: `Not enough gold (need ${goldNeeded})` });
  }

  // Deduct gold and learn — sync both fields
  ensureUserCurrencies(u);
  u.currencies.gold = (u.currencies.gold || 0) - goldNeeded;
  u.gold = u.currencies.gold;
  u.learnedRecipes.push(recipeId);
  saveUsers();

  const profDef = PROFESSIONS_DATA.professions.find(p => p.id === recipe.profession);
  res.json({ success: true, recipe: recipe.name, profession: profDef?.name || recipe.profession, goldSpent: goldNeeded });
});

// ─── POST /api/professions/craft — execute a recipe ─────────────────────────
router.post('/api/professions/craft', requireAuth, (req, res) => {
  const { recipeId, targetSlot, count: rawCount } = req.body;
  const count = Math.max(1, Math.min(10, parseInt(rawCount, 10) || 1)); // batch: 1-10
  if (!recipeId) return res.status(400).json({ error: 'recipeId required' });

  const uid = req.auth?.userId;
  if (!acquireCraftLock(uid)) return res.status(429).json({ error: 'Craft in progress, please wait' });

  try {
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

  // Check profession slot limit based on player level
  u.chosenProfessions = u.chosenProfessions || [];
  const maxSlots = getMaxProfessionSlots(playerLevel);
  const needsEnrollment = !u.chosenProfessions.includes(recipe.profession);
  if (needsEnrollment && u.chosenProfessions.length >= maxSlots) {
    return res.status(400).json({ error: `You have ${u.chosenProfessions.length}/${maxSlots} profession slots (${u.chosenProfessions.join(', ')}). ${maxSlots < 4 ? 'Unlock more slots by leveling up, or d' : 'D'}rop one first.` });
  }

  // Check recipe is learned (trainer+drop source system)
  const profProgress = getProfLevel(u, recipe.profession);
  if (!isRecipeDiscovered(recipe, profProgress, u)) {
    return res.status(400).json({ error: 'You haven\'t learned this recipe yet.' });
  }

  // Check profession level
  if (profProgress.level < recipe.reqProfLevel) {
    return res.status(400).json({ error: `Requires ${profDef.name} level ${recipe.reqProfLevel}` });
  }

  // Check cooldown (per-recipe, not per-profession)
  const recipeCooldowns = (u.professions || {})[recipe.profession]?.recipeCooldowns || {};
  const lastRecipeCraft = recipeCooldowns[recipeId] || null;
  if (recipe.cooldownMinutes > 0 && lastRecipeCraft) {
    // Legendary effect: cooldownReduction — shorten crafting cooldowns
    const craftMods = getLegendaryModifiers(uid);
    const cdReduction = 1 - (craftMods.cooldownReduction || 0);
    const effectiveCooldown = recipe.cooldownMinutes * cdReduction;
    const elapsed = (Date.now() - new Date(lastRecipeCraft).getTime()) / 60000;
    if (elapsed < effectiveCooldown) {
      const remaining = Math.ceil(effectiveCooldown - elapsed);
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
  // Block batch crafting on gray recipes (0 XP — prevents wasting materials)
  const isGrayRecipe = getSkillUpColor(profProgress.level, recipe.reqProfLevel) === 'gray';
  const effectiveCount = isSlotRecipe ? 1 : (isGrayRecipe ? Math.min(count, 1) : count);

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
    // Pre-validate per-item caps BEFORE deducting costs
    if (recipeId === 'permanent_enchant' && eq.permEnchantCount >= 1) {
      return res.status(400).json({ error: 'This item already has a permanent enchantment.' });
    }
    if (recipeId === 'enchant_socket' && eq.infusionCount >= 1) {
      return res.status(400).json({ error: 'This item already has an Arcane Infusion.' });
    }
    if (recipeId === 'reinforce_armor' && eq.reinforceCount >= 1) {
      return res.status(400).json({ error: 'This item has already been reinforced.' });
    }
    if (recipeId === 'sharpen_blade' && eq.sharpenCount >= 1) {
      return res.status(400).json({ error: 'This blade has already been sharpened.' });
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

  // Deduct gold (×count) — sync both fields
  if (totalGoldCost > 0) {
    ensureUserCurrencies(u);
    u.currencies.gold = (u.currencies.gold || 0) - totalGoldCost;
    u.gold = u.currencies.gold;
  }
  // Deduct materials (×count)
  for (const [matId, amount] of Object.entries(recipe.materials || {})) {
    u.craftingMaterials[matId] -= amount * effectiveCount;
    if (u.craftingMaterials[matId] <= 0) delete u.craftingMaterials[matId];
  }

  // Update profession XP & timestamp — WoW-style: fixed XP per craft, probabilistic skill-up
  // ─── WoW Classic skill-up: 1 point per craft, sliding probability ──────────
  u.professions = u.professions || {};
  u.professions[recipe.profession] = u.professions[recipe.profession] || { skill: 0 };
  const reqSkill = recipe.reqSkill || reqProfLevelToSkill(recipe.reqProfLevel);
  const currentSkill = u.professions[recipe.profession].skill || u.professions[recipe.profession].xp || 0;
  const playerLvl = getLevelInfo(u.xp || 0).level;
  const skillCap = getSkillCap(playerLvl);
  const skillUpColor = getSkillUpColor(currentSkill, reqSkill);
  const skillUpChance = getSkillUpChance(currentSkill, reqSkill);
  const { dailyBonusAvailable } = getDailyBonusInfo(u);
  const dailyMultiplier = dailyBonusAvailable ? 2 : 1;
  // Roll skill-up for each craft in the batch — WoW: exactly 1 point per success
  let totalSkillGained = 0;
  for (let i = 0; i < effectiveCount; i++) {
    if (currentSkill + totalSkillGained < skillCap && Math.random() < skillUpChance) {
      totalSkillGained += 1 * dailyMultiplier; // daily bonus: 2 points instead of 1
    }
  }
  u.professions[recipe.profession].skill = Math.min(MAX_SKILL, (u.professions[recipe.profession].skill || 0) + totalSkillGained);
  // Sync legacy xp field
  u.professions[recipe.profession].xp = u.professions[recipe.profession].skill;
  u.professions[recipe.profession].lastCraftAt = now();
  // Track per-recipe cooldown
  if (recipe.cooldownMinutes > 0) {
    u.professions[recipe.profession].recipeCooldowns = u.professions[recipe.profession].recipeCooldowns || {};
    u.professions[recipe.profession].recipeCooldowns[recipeId] = now();
  }
  u.lastCraftDate = new Date().toISOString().slice(0, 10);
  const newSkill = u.professions[recipe.profession].skill;
  const newProfLevel = getProfLevel(u, recipe.profession);
  u.professions[recipe.profession].level = newProfLevel.level;

  // ─── Mastery bonus check (skill 225+) ─────────────────────────────────────────
  const masterySkill = PROFESSIONS_DATA.masteryConfig?.unlockSkill || 225;
  const hasMastery = currentSkill >= masterySkill;
  const masteryDef = hasMastery ? profDef.masteryBonus : null;

  let result = { success: true, message: '' };

  switch (recipeId) {
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
      const potionDuration = 3 + (masteryDef?.type === 'potion_duration' ? masteryDef.value : 0);
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({
          type: recipe.result.buffType,
          questsRemaining: potionDuration,
          activatedAt: now(),
        });
      }
      const buffNames = { potion_xp: 'Experience', potion_gold: 'Wealth', potion_luck: 'Luck' };
      result.message = `Elixir of ${buffNames[recipeId] || 'Power'} activated! (${potionDuration} Quests)${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}${masteryDef ? ' (Mastery)' : ''}`;
      break;
    }

    case 'potion_streak': {
      u.streakShields = Math.min(10, (u.streakShields || 0) + effectiveCount);
      result.message = `Streak Shield received! (Total: ${u.streakShields})`;
      break;
    }

    case 'potion_doubledown': {
      u.activeBuffs = u.activeBuffs || [];
      const flaskDuration = 5 + (masteryDef?.type === 'potion_duration' ? masteryDef.value : 0);
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: 'xp_boost_25', questsRemaining: flaskDuration, activatedAt: now() });
        u.activeBuffs.push({ type: 'gold_boost_20', questsRemaining: flaskDuration, activatedAt: now() });
      }
      result.message = `Flask of Ambition activated! +25% XP + 20% Gold for ${flaskDuration} quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}${masteryDef ? ' (Mastery)' : ''}`;
      break;
    }

    case 'enchant_gear': {
      const allStats = [...PRIMARY_STATS, ...MINOR_STATS];
      const stat = allStats[Math.floor(Math.random() * allStats.length)];
      const enchantBonus = masteryDef?.type === 'enchant_power' ? masteryDef.value : 0;
      const value = 2 + Math.floor(Math.random() * 3) + enchantBonus; // 2-4 + mastery
      u.activeBuffs = u.activeBuffs || [];
      u.activeBuffs.push({
        type: `enchant_${stat}`,
        stat,
        value,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        activatedAt: now(),
      });
      result.message = `Temporary enchantment: +${value} ${stat} for 24h${masteryDef ? ' (Mastery)' : ''}`;
      break;
    }

    case 'runic_polish': {
      const stat = MINOR_STATS[Math.floor(Math.random() * MINOR_STATS.length)];
      const value = 1 + Math.floor(Math.random() * 2); // 1-2
      u.activeBuffs = u.activeBuffs || [];
      u.activeBuffs.push({
        type: `enchant_${stat}`,
        stat,
        value,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        activatedAt: now(),
      });
      result.message = `Runic Polish: +${value} ${stat} for 48h`;
      break;
    }

    case 'glyph_of_warding': {
      u.activeBuffs = u.activeBuffs || [];
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: 'warding_8', questsRemaining: 3, activatedAt: now() });
      }
      result.message = `Glyph of Warding! +8% damage reduction for 3 quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}`;
      break;
    }

    case 'permanent_enchant': {
      const eq = u.equipment[targetSlot];
      // Cap: max 1 permanent enchantment per item
      if (eq.permEnchantCount >= 1) {
        result.message = 'This item already has a permanent enchantment. Use Enchanting to reroll stats instead.';
        result.success = false;
        break;
      }
      const stat = MINOR_STATS[Math.floor(Math.random() * MINOR_STATS.length)];
      const enchantBonus = masteryDef?.type === 'enchant_power' ? masteryDef.value : 0;
      const value = 1 + Math.floor(Math.random() * 2) + enchantBonus; // 1-2 + mastery
      eq.stats = eq.stats || {};
      eq.stats[stat] = (eq.stats[stat] || 0) + value;
      eq.permEnchantCount = (eq.permEnchantCount || 0) + 1;
      result.message = `Permanent enchantment: +${value} ${stat}!${masteryDef ? ' (Mastery)' : ''}`;
      result.updatedGear = eq;
      break;
    }

    case 'enchant_socket': {
      const eq = u.equipment[targetSlot];
      // Cap: max 1 arcane infusion per item
      if (eq.infusionCount >= 1) {
        result.message = 'This item already has an Arcane Infusion. Use Enchanting to reroll stats instead.';
        result.success = false;
        break;
      }
      const stat = PRIMARY_STATS[Math.floor(Math.random() * PRIMARY_STATS.length)];
      const enchantBonus = masteryDef?.type === 'enchant_power' ? masteryDef.value : 0;
      const value = 3 + Math.floor(Math.random() * 3) + enchantBonus; // 3-5 + mastery
      eq.stats = eq.stats || {};
      eq.stats[stat] = (eq.stats[stat] || 0) + value;
      eq.infusionCount = (eq.infusionCount || 0) + 1;
      result.message = `Arcane Infusion: +${value} ${stat} permanently!${masteryDef ? ' (Mastery)' : ''}`;
      result.updatedGear = eq;
      break;
    }

    case 'reinforce_armor': {
      const eq = u.equipment[targetSlot];
      // Cap: max 1 reinforcement per item
      if (eq.reinforceCount >= 1) {
        result.message = 'This item has already been reinforced.';
        result.success = false;
        break;
      }
      const stat = PRIMARY_STATS[Math.floor(Math.random() * PRIMARY_STATS.length)];
      let value = 3 + Math.floor(Math.random() * 4); // 3-6
      if (masteryDef?.type === 'gear_stat_boost') value = Math.ceil(value * (1 + masteryDef.value / 100));
      eq.stats = eq.stats || {};
      eq.stats[stat] = (eq.stats[stat] || 0) + value;
      eq.reinforceCount = (eq.reinforceCount || 0) + 1;
      result.message = `Reinforced! +${value} ${stat} permanently!${masteryDef ? ' (Mastery)' : ''}`;
      result.updatedGear = eq;
      break;
    }

    case 'sharpen_blade': {
      const eq = u.equipment[targetSlot];
      // Cap: max 1 sharpening per item
      if (eq.sharpenCount >= 1) {
        result.message = 'This blade has already been sharpened.';
        result.success = false;
        break;
      }
      const stat = PRIMARY_STATS[Math.floor(Math.random() * PRIMARY_STATS.length)];
      let value = 1 + Math.floor(Math.random() * 3); // 1-3
      if (masteryDef?.type === 'gear_stat_boost') value = Math.ceil(value * (1 + masteryDef.value / 100));
      eq.stats = eq.stats || {};
      eq.stats[stat] = (eq.stats[stat] || 0) + value;
      eq.sharpenCount = (eq.sharpenCount || 0) + 1;
      result.message = `Blade sharpened! +${value} ${stat} permanently!${masteryDef ? ' (Mastery)' : ''}`;
      result.updatedGear = eq;
      break;
    }

    // ─── Koch recipes ──────────────────────────────────────────────────────
    case 'meal_hearty':
    case 'meal_golden': {
      u.activeBuffs = u.activeBuffs || [];
      const buffType = recipe.result.buffType;
      const mealDuration = 5 + (masteryDef?.type === 'meal_duration' ? masteryDef.value : 0);
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: buffType, questsRemaining: mealDuration, activatedAt: now() });
      }
      const mealNames = { meal_hearty: 'Hearty Stew', meal_golden: 'Golden Soup' };
      result.message = `${mealNames[recipeId] || 'Meal'} consumed! Buff active for ${mealDuration} quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}.${masteryDef ? ' (Mastery)' : ''}`;
      break;
    }
    case 'meal_feast': {
      u.activeBuffs = u.activeBuffs || [];
      const feastDuration = 3 + (masteryDef?.type === 'meal_duration' ? masteryDef.value : 0);
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: 'xp_boost_15', questsRemaining: feastDuration, activatedAt: now() });
        u.activeBuffs.push({ type: 'gold_boost_10', questsRemaining: feastDuration, activatedAt: now() });
      }
      result.message = `Star Banquet! +15% XP + 10% Gold for ${feastDuration} quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}!${masteryDef ? ' (Mastery)' : ''}`;
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
      const champDuration = 5 + (masteryDef?.type === 'meal_duration' ? masteryDef.value : 0);
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: 'xp_boost_20', questsRemaining: champDuration, activatedAt: now() });
        u.activeBuffs.push({ type: 'gold_boost_15', questsRemaining: champDuration, activatedAt: now() });
        u.activeBuffs.push({ type: 'luck_boost_10', questsRemaining: champDuration, activatedAt: now() });
      }
      result.message = `Champion's Feast! +20% XP + 15% Gold + 10% Luck for ${champDuration} quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}!${masteryDef ? ' (Mastery)' : ''}`;
      break;
    }

    // ─── Faction recipes (buff-type, handled generically) ────────────────────
    case 'flask_of_embers': {
      const totalAmount = (recipe.result.amount || 15) * effectiveCount;
      u.forgeTemp = Math.min(100, (u.forgeTemp || 0) + totalAmount);
      result.message = `Flask of Embers! Forge temperature raised by ${totalAmount}! (${u.forgeTemp}%)`;
      break;
    }
    case 'scholars_ink':
    case 'resonance_charm':
    case 'artisans_whetstone': {
      u.activeBuffs = u.activeBuffs || [];
      const buffType = recipe.result.buffType;
      const buffDuration = 3;
      for (let i = 0; i < effectiveCount; i++) {
        u.activeBuffs.push({ type: buffType, questsRemaining: buffDuration, activatedAt: now() });
      }
      result.message = `${recipe.name} activated! Buff active for ${buffDuration} quests${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}`;
      break;
    }

    // ─── Gear crafting (Schneider cloth, Schmied heavy) ───────────────────
    default: {
      if (recipe.result?.type === 'craft_gear') {
        const templateId = recipe.result.templateId;
        const template = state.gearById.get(templateId) || state.itemTemplates?.get(templateId);
        if (!template) {
          return res.status(400).json({ error: `Gear template not found: ${templateId}` });
        }
        u.inventory = u.inventory || [];
        if (u.inventory.length >= (INVENTORY_CAP || 200)) {
          return res.status(400).json({ error: 'Inventory full' });
        }
        const instance = createGearInstance(template);
        // Apply mastery bonus (cloth_stat_boost or gear_stat_boost)
        if (masteryDef && (masteryDef.type === 'cloth_stat_boost' || masteryDef.type === 'gear_stat_boost')) {
          const boost = 1 + (masteryDef.value || 10) / 100;
          for (const stat of Object.keys(instance.stats)) {
            instance.stats[stat] = Math.round(instance.stats[stat] * boost);
          }
        }
        u.inventory.push(instance);
        result.message = `Crafted: ${instance.name} (${instance.rarity})`;
        result.craftedItem = instance;
        break;
      }
      return res.status(400).json({ error: `Unknown recipe: ${recipeId}` });
    }
  }

  // Battle Pass XP
  try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'crafting'); } catch {}

  saveUsers();
  res.json({
    ...result,
    professions: u.professions,
    craftingMaterials: u.craftingMaterials,
    gold: u.currencies?.gold ?? u.gold ?? 0,
    newProfLevel: newProfLevel.level,
    profLevelUp: newProfLevel.level > profProgress.level,
    skillGained: totalSkillGained,
    newSkill: newSkill,
    skillUpColor,
    dailyBonusUsed: dailyBonusAvailable,
    craftCount: effectiveCount,
  });
  } finally { releaseCraftLock(uid); }
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
  const choosePLevel = getLevelInfo(u.xp || 0).level;
  const chooseMaxSlots = getMaxProfessionSlots(choosePLevel);
  if (u.chosenProfessions.length >= chooseMaxSlots) {
    return res.status(400).json({ error: `You have ${u.chosenProfessions.length}/${chooseMaxSlots} profession slots (${u.chosenProfessions.join(', ')}). ${chooseMaxSlots < 4 ? 'Unlock more slots by leveling up, or d' : 'D'}rop one first.` });
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
  // Remove all learned recipes for this profession (WoW-style: dropping = lose everything)
  if (u.learnedRecipes?.length) {
    const profRecipeIds = new Set(
      (PROFESSIONS_DATA.recipes || []).filter(r => r.profession === dropProfession).map(r => r.id)
    );
    u.learnedRecipes = u.learnedRecipes.filter(rid => !profRecipeIds.has(rid));
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

  // Legendary effect: salvageBonus — extra materials from dismantling
  const salvageMods = getLegendaryModifiers(uid);
  const salvageBonusMult = salvageMods.salvageBonus || 0;
  if (salvageBonusMult > 0) {
    for (const mat of materialsGained) {
      const bonus = Math.round(mat.amount * salvageBonusMult);
      if (bonus > 0) {
        u.craftingMaterials[mat.id] = (u.craftingMaterials[mat.id] || 0) + bonus;
        mat.amount += bonus;
      }
    }
  }

  // Sync write — dismantle must survive container restarts
  saveUsersSync();
  res.json({
    message: `${item.name} dismantled! +${essenzGained} Essenz${materialsGained.length > 0 ? ' + Materials' : ''}`,
    dismantled: { name: item.name, rarity },
    essenzGained,
    materialsGained,
    currencies: u.currencies,
    craftingMaterials: u.craftingMaterials,
  });
});

// POST /api/schmiedekunst/dismantle-all — bulk dismantle by rarity (Salvage All)
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
  // Legendary effect: salvageBonus — extra materials from dismantling
  const salvageMods = getLegendaryModifiers(uid);
  const salvageBonusMult = salvageMods.salvageBonus || 0;
  for (const item of toDismantle) {
    totalEssenz += DISMANTLE_ESSENZ[rarity] || 2;
    for (const mat of (DISMANTLE_MATERIALS[rarity] || DISMANTLE_MATERIALS.common)) {
      if (Math.random() < mat.chance) {
        let amount = 1;
        if (salvageBonusMult > 0) amount += Math.round(salvageBonusMult);
        u.craftingMaterials[mat.id] = (u.craftingMaterials[mat.id] || 0) + amount;
        allMats[mat.id] = (allMats[mat.id] || 0) + amount;
      }
    }
  }
  // Remove all dismantled items in one pass (O(n) instead of O(n²))
  u.inventory = u.inventory.filter(i => !dismantleIds.has(i.instanceId || i.id));

  u.currencies.essenz = (u.currencies.essenz || 0) + totalEssenz;
  // Sync write — bulk dismantle must survive container restarts
  saveUsersSync();

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

  // Create legendary
  const template = legendaryPool[Math.floor(Math.random() * legendaryPool.length)];
  const legendary = createGearInstance(template);
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
});

// ─── Reforge Legendary (D3 Kanai's Cube "Law of Kulle") ─────────────────────
// Same item identity, completely re-randomized stats
router.post('/api/schmiedekunst/reforge', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
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
      const matDef = PROFESSIONS_DATA.materials?.find(m => m.id === matId);
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
  const reforged = createGearInstance(template);
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
});

// ─── D3-Style Stat Reroll ("Enchanting") — standalone, no profession needed ─
const REROLL_BASE_GOLD = 100;
const REROLL_GOLD_CAP = 50000;
const REROLL_ESSENZ_COST = 2; // D3-style: material cost stays constant, only gold escalates

router.post('/api/reroll/preview', requireAuth, (req, res) => {
  const u = req.user;
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
  const u = req.user;
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
module.exports.loadProfessions = loadProfessions;
