/**
 * Crafting & Professions Routes — Schmied, Alchemist, Verzauberer
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers, saveUsersSync, ensureUserCurrencies } = require('../lib/state');
const { now, getLevelInfo, PRIMARY_STATS, MINOR_STATS, createGearInstance, getLegendaryModifiers, rollAffixStats, getArmorTraitBonus, INVENTORY_CAP, getTodayBerlin } = require('../lib/helpers');

// ─── Mondlicht-Schmiede: +20% better minimum rolls during night hours (22:00-06:00 Berlin) ───
function isMoonlightActive() {
  const berlinHour = new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false });
  const h = parseInt(berlinHour, 10);
  return h >= 22 || h < 6;
}
const MOONLIGHT_BONUS = 0.20; // +20% minimum roll boost

const VALID_SLOTS = ['weapon', 'shield', 'helm', 'armor', 'amulet', 'boots', 'ring'];
const SECONDARY_PROFESSIONS = ['koch', 'verzauberer']; // Don't count against the 2 primary-slot limit

// Fallback icons for recipes without a resolved template/material icon
const RECIPE_TYPE_FALLBACK_ICONS = {
  buff: '/images/icons/gacha-heiltrank.png',
  forge_temp: '/images/icons/gacha-heiltrank.png',
  streak_shield: '/images/icons/gacha-heiltrank.png',
  gear_enhance: '/images/icons/loot-gear-upgrade.png',
  vellum: '/images/icons/ui-ritual-rune.png',
  gem_cut: '/images/icons/gacha-amulet-soul-gem.png',
  gem_merge: '/images/icons/gacha-amulet-soul-gem.png',
  // Per-profession fallbacks (used when result type has no match)
  alchemist: '/images/icons/npc-zara-flask.png',
  koch: '/images/icons/shop-meal.png',
  verzauberer: '/images/icons/ui-ritual-rune.png',
  juwelier: '/images/icons/gacha-amulet-soul-gem.png',
};

// ─── Faction ID mapping (old lore names → current system IDs) ─────────────
const FACTION_ID_MAP = {
  orden_der_klinge: 'glut', zirkel_der_sterne: 'tinte',
  pakt_der_wildnis: 'echo', bund_der_schatten: 'amboss',
  glut: 'glut', tinte: 'tinte', amboss: 'amboss', echo: 'echo',
};
const FACTION_REP_REQUIRED = 500; // Friendly standing minimum for faction recipes

function playerMeetsFactionRep(user, recipeFactionId) {
  if (!recipeFactionId) return true;
  const fid = FACTION_ID_MAP[recipeFactionId] || recipeFactionId;
  const rep = user?.factions?.[fid]?.rep ?? 0;
  return rep >= FACTION_REP_REQUIRED;
}
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
// Slot-requiring recipe types: these target a specific equipped item and can't be batched
const SLOT_RECIPES = ['gear_enhance', 'permanent_enchant', 'reinforce_armor', 'enchant_socket', 'sharpen_blade'];
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

// Skill cap based on trained ranks (not auto-level). Falls back to player level for backward compat.
function getSkillCap(playerLevel, trainedRanks) {
  if (trainedRanks && trainedRanks.length > 0) {
    // Use highest trained rank's cap
    let cap = 75; // Apprentice default
    for (const rank of PROFICIENCY_RANKS) {
      if (trainedRanks.includes(rank.name)) cap = rank.skillCap;
    }
    return cap;
  }
  // Backward compat: auto-cap by player level (for players who haven't trained yet)
  let cap = 0;
  for (const rank of PROFICIENCY_RANKS) {
    if (playerLevel >= rank.reqPlayerLevel) cap = rank.skillCap;
  }
  return cap || 75;
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

// Max PRIMARY profession slots — always 2 (no level gate)
// Secondary professions (Koch, Verzauberer) don't consume a slot.
function getMaxProfessionSlots(playerLevel) {
  return 2;
}

// Count only primary professions (exclude secondary like Koch, Verzauberer)
function countPrimaryProfessions(chosenProfessions) {
  return (chosenProfessions || []).filter(p => !SECONDARY_PROFESSIONS.includes(p)).length;
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
  // Faction-source recipes: must be learned AND player must have faction rep
  if (recipe.source === 'faction') {
    const known = (user?.learnedRecipes || []).includes(recipe.id) || (user?.unlockedRecipes || []).includes(recipe.id);
    return known && playerMeetsFactionRep(user, recipe.factionId);
  }
  // Legacy/free trainer recipes: use old discovery gate system
  if (!recipe.discovery) return true;
  if (recipe.discovery.type === 'profLevel') return profProgress.level >= recipe.discovery.value;
  return true;
}

// ─── Helper: check skill/level requirement (supports reqSkill or legacy reqProfLevel) ─
function meetsSkillReq(recipe, profProgress) {
  if (recipe.reqSkill != null) return profProgress.skill >= recipe.reqSkill;
  return profProgress.level >= (recipe.reqProfLevel || 0);
}

// ─── Helper: check if recipe is visible (show in UI even if locked) ─────────
function isRecipeVisible(recipe, profProgress, user) {
  // Trainer recipes: always visible (like WoW Classic trainer — you see all recipes, buy when skill is met)
  if (recipe.source === 'trainer') return true;
  // Drop recipes: only visible once learned
  if (recipe.source === 'drop') return (user?.learnedRecipes || []).includes(recipe.id);
  // Faction recipes: visible if skill/level met (show as locked until rep earned)
  if (recipe.source === 'faction') return meetsSkillReq(recipe, profProgress);
  // Legacy: use discovery gate
  if (!recipe.discovery) return true;
  if (recipe.discovery.type === 'profLevel') return profProgress.level >= recipe.discovery.value;
  return true;
}

// ─── Helper: check if player gets daily crafting bonus ───────────────────────
function getDailyBonusInfo(u) {
  const today = getTodayBerlin();
  const lastCraftDate = u?.lastCraftDate || null;
  const hasCraftedToday = lastCraftDate === today;
  return { dailyBonusAvailable: !hasCraftedToday, lastCraftDate };
}

// ─── GET /api/professions — list all professions + player progress ──────────
router.get('/api/professions', (req, res) => {
  const playerName = (req.query.player || '').toLowerCase();
  const u = playerName ? state.usersByName.get(playerName) : null;
  // Auto-migrate: chosen professions with skill 0 → skill 1
  if (u && u.chosenProfessions?.length && u.professions) {
    for (const pid of u.chosenProfessions) {
      if (u.professions[pid] && (u.professions[pid].skill || 0) < 1) {
        u.professions[pid].skill = 1;
        u.professions[pid].xp = 1;
        u.professions[pid].level = 1;
      }
    }
  }
  const professions = PROFESSIONS_DATA.professions.map(p => {
    const playerLevel = u ? getLevelInfo(u.xp || 0).level : 0;
    const unlocked = u ? (p.unlockCondition?.type === 'level' ? playerLevel >= p.unlockCondition.value : true) : false;
    const profProgress = u ? getProfSkill(u, p.id) : { skill: 0 };
    const profLevel = u ? getProfLevel(u, p.id) : { level: 0, skill: 0 };
    const lastCraft = (u?.professions || {})[p.id]?.lastCraftAt || null;
    const chosen = (u?.chosenProfessions || []).includes(p.id);
    const pMaxSlots = u ? getMaxProfessionSlots(playerLevel) : 0;
    const isSecondary = SECONDARY_PROFESSIONS.includes(p.id);
    const canChoose = chosen || isSecondary || countPrimaryProfessions(u?.chosenProfessions) < pMaxSlots;
    const rank = getProfRank(profProgress.skill);
    const playerProfData = u ? (u.professions || {})[p.id] : null;
    const skillCap = u ? getSkillCap(playerLevel, playerProfData?.trainedRanks) : 75;
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
      rank: chosen ? rank.name : null,
      rankColor: rank.color,
      masteryActive,
      masteryBonus: p.masteryBonus || null,
      gatheringAffinity: p.gatheringAffinity || [],
    };
  });
  // All recipes: visible ones get full data, hidden ones get masked "???" entries
  const totalRecipesByProf = {};
  for (const r of PROFESSIONS_DATA.recipes) {
    totalRecipesByProf[r.profession] = (totalRecipesByProf[r.profession] || 0) + 1;
  }
  const recipes = PROFESSIONS_DATA.recipes
    .filter(r => {
      const profProgress = u ? getProfLevel(u, r.profession) : { level: 0, xp: 0 };
      // Show visible recipes normally; also include undiscovered drop/faction recipes as masked entries
      if (isRecipeVisible(r, profProgress, u)) return true;
      // Show masked "???" entries for drop/faction recipes the player hasn't found yet
      if (r.source === 'drop' || r.source === 'faction') return true;
      return false;
    })
    .map(r => {
      const profProgress = u ? getProfLevel(u, r.profession) : { level: 0, xp: 0 };
      const visible = isRecipeVisible(r, profProgress, u);
      if (!visible) {
        // Masked recipe: show source hint but hide name/details
        const sourceHint = r.source === 'drop' ? 'Drops from world content' : r.source === 'faction' ? `Requires ${r.factionId || 'faction'} reputation` : 'Unknown source';
        return {
          id: r.id,
          name: '???',
          profession: r.profession,
          source: r.source,
          reqSkill: r.reqSkill || 0,
          materials: {},
          result: null,
          xp: 0,
          desc: sourceHint,
          learned: false,
          canCraft: false,
          hidden: true,
          skillUpColor: 'gray',
          skillUpChance: 0,
          cooldownRemaining: 0,
        };
      }
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
      const factionRepMet = r.source === 'faction' ? playerMeetsFactionRep(u, r.factionId) : true;
      return {
        ...r,
        reqSkill,
        learned,
        canCraft: learned && playerSkill >= reqSkill && factionRepMet && Object.entries(r.materials || {}).every(([matId, amt]) => (u?.craftingMaterials?.[matId] || 0) >= amt),
        factionRepMet,
        skillUpColor: getSkillUpColor(playerSkill, reqSkill),
        skillUpChance: Math.round(getSkillUpChance(playerSkill, reqSkill) * 100),
        cooldownRemaining,
        icon: r.icon || (r.result?.templateId ? (state.gearById.get(r.result.templateId)?.icon || null) : null)
          || (r.result?.type === 'material' || r.result?.type === 'transmute_material' ? (PROFESSIONS_DATA.materials?.find(m => m.id === (r.result.materialId || r.result.outputMaterial))?.icon || null) : null)
          || RECIPE_TYPE_FALLBACK_ICONS[r.result?.type] || RECIPE_TYPE_FALLBACK_ICONS[r.profession] || null,
      };
    });
  const materials = u?.craftingMaterials || {};
  const currencies = u ? { essenz: u.currencies?.essenz ?? 0, gold: u.currencies?.gold ?? u.gold ?? 0, stardust: u.currencies?.stardust ?? 0 } : {};
  const dailyBonus = u ? getDailyBonusInfo(u) : { dailyBonusAvailable: false };
  const playerLvl = u ? getLevelInfo(u.xp || 0).level : 0;
  const maxProfSlots = getMaxProfessionSlots(playerLvl);
  const chosenCount = countPrimaryProfessions(u?.chosenProfessions);
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
  const favoriteRecipes = u?.favoriteRecipes || [];
  // Apply vendor reagent discount from talent tree
  const talentReagentDiscount = u ? (require('./talent-tree').getUserTalentEffects(u.id)).vendor_reagent_discount || 0 : 0;
  const vendorReagents = (PROFESSIONS_DATA.vendorReagents || []).map(r => ({
    ...r,
    discountedPrice: talentReagentDiscount > 0 ? Math.max(1, Math.round(r.price * (1 - talentReagentDiscount))) : null,
  }));
  res.json({ professions, recipes, materials, materialDefs: PROFESSIONS_DATA.materials, vendorReagents, proficiencyRanks: PROFICIENCY_RANKS, skillUpColors: PROFESSIONS_DATA.skillUpColors || {}, currencies, dailyBonus, maxProfSlots, chosenCount, professionSlots: PROFESSIONS_DATA.professionSlots || [], learnedRecipes, masteryConfig, gatheringConfig, slotAffixRanges, totalRecipesByProf, moonlightActive: isMoonlightActive(), favoriteRecipes });
});

// ─── POST /api/professions/learn — buy a recipe from an NPC trainer ─────────
router.post('/api/professions/learn', requireAuth, (req, res) => {
  const { recipeId } = req.body;
  if (!recipeId) return res.status(400).json({ error: 'recipeId required' });

  const uid = req.auth?.userId;
  if (!acquireCraftLock(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
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

  // WoW Classic style: trainer recipes can be LEARNED at any skill level
  // (you just need the right rank/cap trained — the reqSkill only gates CRAFTING, not learning)
  // Only check: does the player's trained rank allow recipes at this skill level?
  const profProgress = getProfLevel(u, recipe.profession);
  const playerLvl = getLevelInfo(u.xp || 0).level;
  const profData = (u.professions || {})[recipe.profession];
  const skillCap = getSkillCap(playerLvl, profData?.trainedRanks);
  const recipeSkill = recipe.reqSkill || reqProfLevelToSkill(recipe.reqProfLevel);
  if (recipeSkill > skillCap) {
    return res.status(400).json({ error: `Train a higher rank first — this recipe requires Skill Cap ${recipeSkill}+ (your cap: ${skillCap})` });
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
  } finally { releaseCraftLock(uid); }
});

// ─── POST /api/professions/craft — execute a recipe ─────────────────────────
router.post('/api/professions/craft', requireAuth, (req, res) => {
  const { recipeId, targetSlot, count: rawCount } = req.body;
  if (!recipeId) return res.status(400).json({ error: 'recipeId required' });

  const uid = req.auth?.userId;
  if (!acquireCraftLock(uid)) return res.status(429).json({ error: 'Craft in progress, please wait' });

  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const recipe = PROFESSIONS_DATA.recipes.find(r => r.id === recipeId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  // Material recipes (transmute_material, material) get higher batch limit (x50)
  const isMaterialRecipe = recipe.result?.type === 'transmute_material' || recipe.result?.type === 'material';
  const maxBatch = isMaterialRecipe ? 50 : 10;
  const count = Math.max(1, Math.min(maxBatch, parseInt(rawCount, 10) || 1));

  // Check profession unlock
  const profDef = PROFESSIONS_DATA.professions.find(p => p.id === recipe.profession);
  if (!profDef) return res.status(500).json({ error: 'Profession not found' });

  const playerLevel = getLevelInfo(u.xp || 0).level;
  if (profDef.unlockCondition?.type === 'level' && playerLevel < profDef.unlockCondition.value) {
    return res.status(400).json({ error: `Requires player level ${profDef.unlockCondition.value}` });
  }

  // Check profession slot limit based on player level
  // Secondary professions (Koch, Verzauberer) don't consume primary slots
  u.chosenProfessions = u.chosenProfessions || [];
  const maxSlots = getMaxProfessionSlots(playerLevel);
  const needsEnrollment = !u.chosenProfessions.includes(recipe.profession);
  const isSecondaryProf = SECONDARY_PROFESSIONS.includes(recipe.profession);
  if (needsEnrollment && !isSecondaryProf && countPrimaryProfessions(u.chosenProfessions) >= maxSlots) {
    const primaryProfs = u.chosenProfessions.filter(p => !SECONDARY_PROFESSIONS.includes(p));
    return res.status(400).json({ error: `You have ${primaryProfs.length}/${maxSlots} primary profession slots (${primaryProfs.join(', ')}). Drop one first.` });
  }

  // Check recipe is learned (trainer+drop source system)
  const profProgress = getProfLevel(u, recipe.profession);
  if (!isRecipeDiscovered(recipe, profProgress, u)) {
    return res.status(400).json({ error: 'You haven\'t learned this recipe yet.' });
  }

  // Check profession skill/level
  if (!meetsSkillReq(recipe, profProgress)) {
    const reqLabel = recipe.reqSkill != null ? `skill ${recipe.reqSkill}` : `level ${recipe.reqProfLevel}`;
    return res.status(400).json({ error: `Requires ${profDef.name} ${reqLabel}` });
  }

  // Check cooldown (per-recipe, not per-profession)
  const recipeCooldowns = (u.professions || {})[recipe.profession]?.recipeCooldowns || {};
  const lastRecipeCraft = recipeCooldowns[recipeId] || null;
  // Transmutes share a global cooldown (WoW Classic style)
  const isTransmute = recipe.result?.type === 'material' && recipe.id.includes('transmute');
  const lastTransmute = isTransmute ? (u._lastTransmuteAt || null) : null;
  const effectiveLast = isTransmute ? (lastTransmute && (!lastRecipeCraft || new Date(lastTransmute) > new Date(lastRecipeCraft)) ? lastTransmute : lastRecipeCraft) : lastRecipeCraft;
  if (recipe.cooldownMinutes > 0 && effectiveLast) {
    // Legendary effect: cooldownReduction — shorten crafting cooldowns
    const craftMods = getLegendaryModifiers(uid);
    const cdReduction = 1 - (craftMods.cooldownReduction || 0);
    const effectiveCooldown = recipe.cooldownMinutes * cdReduction;
    const elapsed = (Date.now() - new Date(effectiveLast).getTime()) / 60000;
    if (elapsed < effectiveCooldown) {
      const remaining = Math.ceil(effectiveCooldown - elapsed);
      return res.status(429).json({ error: `Cooldown: ${remaining} minutes remaining${isTransmute ? ' (shared transmute cooldown)' : ''}` });
    }
  }

  // ─── Pre-validate recipe requirements BEFORE deducting anything ──────────
  // Validate targetSlot early (needed by Schmied/Verzauberer recipes)
  if (targetSlot && !VALID_SLOTS.includes(targetSlot)) {
    return res.status(400).json({ error: `Invalid slot: ${targetSlot}` });
  }

  // Slot-requiring recipes can't batch (they target specific gear)
  const isSlotRecipe = SLOT_RECIPES.includes(recipe.result?.type) || SLOT_RECIPES.includes(recipeId);
  // Gear crafting can't batch (each item is individually rolled + inventory cap)
  const isGearCraft = recipe.result?.type === 'craft_gear';
  // Block batch crafting on gray recipes (0 XP — prevents wasting materials)
  const recipeReqSkill = recipe.reqSkill || reqProfLevelToSkill(recipe.reqProfLevel);
  const isGrayRecipe = getSkillUpColor(profProgress.skill, recipeReqSkill) === 'gray';
  const effectiveCount = (isSlotRecipe || isGearCraft) ? 1 : (isGrayRecipe ? Math.min(count, 1) : count);

  // Validate slot-requiring recipes have a targetSlot and valid gear
  if (isSlotRecipe) {
    if (!targetSlot) return res.status(400).json({ error: 'targetSlot required' });
    const eq = u.equipment?.[targetSlot];
    if (!eq || typeof eq === 'string') return res.status(400).json({ error: 'No gear equipped in this slot. Equip an item first.' });
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

  // ─── Pre-deduction validation for inventory-consuming recipes ──────────────
  // Check inventory cap BEFORE deducting materials to prevent material loss on full inventory
  const resultType = recipe.result?.type;
  if (resultType === 'craft_gear' || resultType === 'vellum') {
    u.inventory = u.inventory || [];
    if (u.inventory.length >= (INVENTORY_CAP || 200)) {
      return res.status(400).json({ error: 'Inventory full — free up space before crafting gear' });
    }
  }

  // ─── All validation passed — enroll profession + deduct costs ──────────────
  if (needsEnrollment) u.chosenProfessions.push(recipe.profession);

  // Deduct gold (×count) — sync both fields
  const totalDeduction = totalGoldCost || 0;
  if (totalDeduction > 0) {
    ensureUserCurrencies(u);
    u.currencies.gold = (u.currencies.gold || 0) - totalDeduction;
    u.gold = u.currencies.gold;
  }
  // Deduct materials (×count) — Talent: craft_material_preserve chance to save materials
  const talentPreserve = (require('./talent-tree').getUserTalentEffects(uid)).craft_material_preserve || 0;
  for (const [matId, amount] of Object.entries(recipe.materials || {})) {
    let totalCost = amount * effectiveCount;
    // Each unit has independent chance to be preserved
    if (talentPreserve > 0) {
      let preserved = 0;
      for (let i = 0; i < totalCost; i++) {
        if (Math.random() < talentPreserve) preserved++;
      }
      totalCost -= preserved;
    }
    if (totalCost > 0) {
      u.craftingMaterials[matId] -= totalCost;
      if (u.craftingMaterials[matId] <= 0) delete u.craftingMaterials[matId];
    }
  }

  // Update profession XP & timestamp — WoW-style: fixed XP per craft, probabilistic skill-up
  // ─── WoW Classic skill-up: 1 point per craft, sliding probability ──────────
  u.professions = u.professions || {};
  u.professions[recipe.profession] = u.professions[recipe.profession] || { skill: 1 };
  const reqSkill = recipe.reqSkill || reqProfLevelToSkill(recipe.reqProfLevel);
  const currentSkill = u.professions[recipe.profession].skill || u.professions[recipe.profession].xp || 0;
  const playerLvl = getLevelInfo(u.xp || 0).level;
  const craftProfData = (u.professions || {})[recipe.profession];
  const skillCap = getSkillCap(playerLvl, craftProfData?.trainedRanks);
  const skillUpColor = getSkillUpColor(currentSkill, reqSkill);
  // Legendary: mentor — +X% skill-up chance
  const mentorBonus = getLegendaryModifiers(uid).mentor || 0;
  const skillUpChance = Math.min(1.0, getSkillUpChance(currentSkill, reqSkill) + mentorBonus);
  const { dailyBonusAvailable } = getDailyBonusInfo(u);
  // Talent tree: profession_daily_bonus_modifier — increases daily bonus multiplier
  const { getUserTalentEffects } = require('./talent-tree');
  const talentEffects = getUserTalentEffects(uid);
  const talentDailyMod = talentEffects.profession_daily_bonus_modifier || 0;
  const dailyMultiplier = dailyBonusAvailable ? (2 + talentDailyMod) : 1;
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
    // Shared transmute cooldown (WoW Classic: all transmutes share one CD)
    const isTransmuteRecipe = recipe.result?.type === 'material' && recipe.id.includes('transmute');
    if (isTransmuteRecipe) u._lastTransmuteAt = now();
  }
  u.lastCraftDate = getTodayBerlin();
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

    // ─── Gear crafting + generic handlers ──────────────────────────────────
    default: {
      // Generic buff handler (for new recipes with buff result type)
      if (recipe.result?.type === 'buff' && recipe.result?.buffType) {
        u.activeBuffs = u.activeBuffs || [];
        const buffDuration = parseInt(recipe.result.duration?.replace('_quests', '')) || 3;
        for (let i = 0; i < effectiveCount; i++) {
          u.activeBuffs.push({ type: recipe.result.buffType, questsRemaining: buffDuration, activatedAt: now() });
        }
        result.message = `${recipe.name} activated! (${buffDuration} quests)${effectiveCount > 1 ? ` (x${effectiveCount})` : ''}`;
        break;
      }
      // Temp enchant handler
      if (recipe.result?.type === 'temp_enchant') {
        const allStats = [...PRIMARY_STATS, ...MINOR_STATS];
        const stat = allStats[Math.floor(Math.random() * allStats.length)];
        const value = (recipe.result.statBonus?.[0] || 1) + Math.floor(Math.random() * ((recipe.result.statBonus?.[1] || 2) - (recipe.result.statBonus?.[0] || 1) + 1));
        const hours = recipe.result.durationHours || 24;
        u.activeBuffs = u.activeBuffs || [];
        u.activeBuffs.push({ type: `enchant_${stat}`, stat, value, expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(), activatedAt: now() });
        result.message = `${recipe.name}: +${value} ${stat} for ${hours}h`;
        break;
      }
      // Perm enchant handler (for new soul_infusion etc.)
      if (recipe.result?.type === 'perm_enchant') {
        const eq = u.equipment?.[targetSlot];
        if (!eq || typeof eq === 'string') { result.message = 'No gear in slot'; result.success = false; break; }
        if (eq.permEnchantCount >= 1 && recipe.result.target === 'minor_stat') { result.message = 'Already has a permanent enchantment.'; result.success = false; break; }
        if (eq.infusionCount >= 1 && recipe.result.target === 'primary_stat') { result.message = 'Already has an infusion.'; result.success = false; break; }
        const statPool = recipe.result.target === 'primary_stat' ? PRIMARY_STATS : MINOR_STATS;
        const stat = statPool[Math.floor(Math.random() * statPool.length)];
        const value = (recipe.result.statBonus?.[0] || 1) + Math.floor(Math.random() * ((recipe.result.statBonus?.[1] || 2) - (recipe.result.statBonus?.[0] || 1) + 1));
        eq.stats = eq.stats || {};
        eq.stats[stat] = (eq.stats[stat] || 0) + value;
        if (recipe.result.target === 'primary_stat') eq.infusionCount = (eq.infusionCount || 0) + 1;
        else eq.permEnchantCount = (eq.permEnchantCount || 0) + 1;
        result.message = `+${value} ${stat} permanently!`;
        result.updatedGear = eq;
        break;
      }
      // Enchant Vellum handler (creates tradeable enchant scroll)
      if (recipe.result?.type === 'vellum') {
        const allStats = [...PRIMARY_STATS, ...MINOR_STATS];
        const vStat = allStats[Math.floor(Math.random() * allStats.length)];
        const enchBonus = masteryDef?.type === 'enchant_power' ? masteryDef.value : 0;
        const vVal = (recipe.result.statBonus?.[0] || 2) + Math.floor(Math.random() * ((recipe.result.statBonus?.[1] || 4) - (recipe.result.statBonus?.[0] || 2) + 1)) + enchBonus;
        const hours = recipe.result.durationHours || 24;
        const vellumRarity = currentSkill >= 225 ? 'epic' : currentSkill >= 125 ? 'rare' : 'uncommon';
        const vellumItem = {
          id: `vellum-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `Verzauberung: +${vVal} ${vStat.charAt(0).toUpperCase() + vStat.slice(1)}`,
          type: 'consumable',
          rarity: vellumRarity,
          desc: `Kann gehandelt werden. Anwenden: Gibt +${vVal} ${vStat} als ${hours}h-Buff.`,
          icon: null,
          binding: 'boe',
          effect: { type: 'vellum' },
          vellumEffect: { stat: vStat, value: vVal, durationHours: hours },
          craftedBy: uid,
          craftedAt: now(),
        };
        u.inventory = u.inventory || [];
        if (u.inventory.length >= INVENTORY_CAP) { result.message = 'Inventory full.'; result.success = false; break; }
        u.inventory.push(vellumItem);
        result.message = `Enchant Vellum: +${vVal} ${vStat} (${hours}h) — can be traded!${masteryDef ? ' (Mastery)' : ''}`;
        break;
      }
      // Material processing handler (smelting bars, weaving bolts, etc.)
      if (recipe.result?.type === 'material') {
        u.craftingMaterials = u.craftingMaterials || {};
        const outMat = recipe.result.materialId || recipe.result.outputMaterial;
        const outAmt = (recipe.result.amount || recipe.result.count || 1) * effectiveCount;
        if (!outMat) { result.message = 'Invalid material recipe'; result.success = false; break; }
        u.craftingMaterials[outMat] = (u.craftingMaterials[outMat] || 0) + outAmt;
        const matDef = PROFESSIONS_DATA.materials?.find(m => m.id === outMat);
        result.message = `${recipe.name}: +${outAmt} ${matDef?.name || outMat}`;
        break;
      }
      // Transmute material handler (alchemist transmutes)
      if (recipe.result?.type === 'transmute_material') {
        u.craftingMaterials = u.craftingMaterials || {};
        const outMat = recipe.result.outputMaterial;
        const outAmt = (recipe.result.outputAmount || 1) * effectiveCount;
        u.craftingMaterials[outMat] = (u.craftingMaterials[outMat] || 0) + outAmt;
        const matDef = PROFESSIONS_DATA.materials?.find(m => m.id === outMat);
        result.message = `Transmuted! +${outAmt} ${matDef?.name || outMat}`;
        break;
      }
      // Forge temp handler
      if (recipe.result?.type === 'forge_temp') {
        const totalAmount = (recipe.result.amount || 15) * effectiveCount;
        u.forgeTemp = Math.min(100, (u.forgeTemp || 0) + totalAmount);
        result.message = `Forge temperature raised by ${totalAmount}! (${u.forgeTemp}%)`;
        break;
      }
      // Streak shield handler
      if (recipe.result?.type === 'streak_shield') {
        u.streakShields = Math.min(10, (u.streakShields || 0) + effectiveCount);
        result.message = `Streak Shield received! (Total: ${u.streakShields})`;
        break;
      }
      if (recipe.result?.type === 'craft_gear') {
        const templateId = recipe.result.templateId;
        const template = state.gearById.get(templateId) || state.itemTemplates?.get(templateId);
        if (!template) {
          return res.status(400).json({ error: 'Item recipe not found. Please try again.' });
        }
        u.inventory = u.inventory || [];
        if (u.inventory.length >= (INVENTORY_CAP || 200)) {
          return res.status(400).json({ error: 'Inventory full' });
        }
        const instance = createGearInstance(template, { moonlightBonus: isMoonlightActive() ? MOONLIGHT_BONUS : 0 });
        // Apply mastery bonus (cloth_stat_boost, gear_stat_boost, or leather_stat_boost)
        if (masteryDef && (masteryDef.type === 'cloth_stat_boost' || masteryDef.type === 'gear_stat_boost' || masteryDef.type === 'leather_stat_boost' || masteryDef.type === 'weapon_stat_boost')) {
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
      // Gear enhancement handler (stat boost on equipped item)
      if (recipe.result?.type === 'gear_enhance') {
        const stat = recipe.result.stat;
        const amount = recipe.result.amount || 1;
        if (!stat) { result.message = 'Invalid enhance recipe'; result.success = false; break; }
        if (!targetSlot) { result.message = 'Select an equipment slot first'; result.success = false; break; }
        const eq = u.equipment?.[targetSlot];
        if (!eq || typeof eq === 'string') { result.message = 'No gear equipped in this slot'; result.success = false; break; }
        eq.stats = eq.stats || {};
        eq.stats[stat] = (eq.stats[stat] || 0) + amount;
        result.message = `Enhanced: +${amount} ${stat} on ${eq.name || targetSlot}`;
        result.updatedGear = eq;
        break;
      }
      // Gem cutting handler (Juwelier: create a gem from materials)
      if (recipe.result?.type === 'gem_cut') {
        const gemType = recipe.result.gemType;
        let gemTier = recipe.result.gemTier;
        if (!gemType || !gemTier) { result.message = 'Invalid gem recipe'; result.success = false; break; }
        // Mastery: gem_quality_boost — chance to create one tier higher
        if (masteryDef && masteryDef.type === 'gem_quality_boost' && gemTier < 5) {
          const upgradeChance = (masteryDef.value || 1) * 0.10; // 10% per mastery value
          if (Math.random() < upgradeChance) {
            gemTier = Math.min(5, gemTier + 1);
            result.masteryProc = true;
          }
        }
        const gemKey = `${gemType}_${gemTier}`;
        u.gems = u.gems || {};
        for (let i = 0; i < effectiveCount; i++) {
          u.gems[gemKey] = (u.gems[gemKey] || 0) + 1;
        }
        const gemData = state.gemsData?.gems?.find(g => g.id === gemType);
        const tierData = gemData?.tiers?.find(t => t.tier === gemTier);
        result.message = `Cut: ${tierData?.name || gemKey}${effectiveCount > 1 ? ` x${effectiveCount}` : ''}${result.masteryProc ? ' (Mastery: Tier UP!)' : ''}`;
        break;
      }
      // Gem merge handler (Juwelier: combine 3 gems → 1 higher tier)
      if (recipe.result?.type === 'gem_merge') {
        // Gem merges are handled via /api/gems/upgrade — this is a recipe wrapper
        // The materials already include the source gems, so just award the result
        const toTier = recipe.result.toTier;
        if (!toTier) { result.message = 'Invalid merge recipe'; result.success = false; break; }
        // Award a random gem of the target tier (player chose which to merge via materials)
        const gemTypes = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'diamond'];
        const randomGem = gemTypes[Math.floor(Math.random() * gemTypes.length)];
        const gemKey = `${randomGem}_${toTier}`;
        u.gems = u.gems || {};
        u.gems[gemKey] = (u.gems[gemKey] || 0) + 1;
        const gemData = state.gemsData?.gems?.find(g => g.id === randomGem);
        const tierData = gemData?.tiers?.find(t => t.tier === toTier);
        result.message = `Merged: ${tierData?.name || gemKey}`;
        break;
      }
      return res.status(400).json({ error: `Unknown recipe: ${recipeId}` });
    }
  }

  // Track craft count for achievements
  u._craftsCompleted = (u._craftsCompleted || 0) + effectiveCount;
  if (isMoonlightActive()) u._moonlightCrafts = (u._moonlightCrafts || 0) + effectiveCount;
  // Check achievements after crafting (profession skill, crafts_completed, moonlight_crafts)
  try { const { checkAndAwardAchievements, checkAndAwardTitles } = require('../lib/helpers'); checkAndAwardAchievements(uid); checkAndAwardTitles(uid); } catch { /* optional */ }

  // Battle Pass XP
  try { const { grantBattlePassXP } = require('./battlepass'); grantBattlePassXP(u, 'crafting'); } catch (e) { console.warn('[bp-xp] crafting:', e.message); }

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
    atSkillCap: newSkill >= skillCap,
    skillCap,
    nextRankNeeded: newSkill >= skillCap && skillCap < MAX_SKILL ? PROFICIENCY_RANKS.find(r => r.skillCap > skillCap)?.name || null : null,
  });
  } finally { releaseCraftLock(uid); }
});

// ─── POST /api/professions/craft-preview — preview recipe output ─────────────
router.post('/api/professions/craft-preview', requireAuth, (req, res) => {
  const { recipeId, targetSlot } = req.body;
  if (!recipeId) return res.status(400).json({ error: 'recipeId required' });

  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const recipe = PROFESSIONS_DATA.recipes.find(r => r.id === recipeId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  const profDef = PROFESSIONS_DATA.professions.find(p => p.id === recipe.profession);
  const moonlightActive = isMoonlightActive();
  const profProgress = getProfLevel(u, recipe.profession);
  const masterySkill = PROFESSIONS_DATA.masteryConfig?.unlockSkill || 225;
  const hasMastery = (profProgress.skill || 0) >= masterySkill;
  const masteryDef = hasMastery ? profDef?.masteryBonus : null;

  const preview = {
    recipeId,
    recipeName: recipe.name,
    profession: profDef?.name || recipe.profession,
    moonlightActive,
    moonlightBonus: moonlightActive ? MOONLIGHT_BONUS : 0,
    mastery: hasMastery ? (masteryDef?.type || true) : false,
    cost: { gold: recipe.cost?.gold || 0, materials: recipe.materials || {} },
    cooldownMinutes: recipe.cooldownMinutes || 0,
  };

  // Determine output type
  if (recipe.result?.type === 'craft_gear') {
    const templateId = recipe.result.templateId;
    const template = state.gearById.get(templateId) || state.itemTemplates?.get(templateId);
    if (!template) return res.json({ ...preview, outputType: 'gear', error: 'Template not found' });

    const gemsData = state.gemsData || require('../public/data/gems.json');
    const socketRange = gemsData.socketsByRarity[template.rarity || 'common'] || [0, 0];

    // Calculate stat ranges (with moonlight)
    const statRanges = { primary: [], minor: [] };
    const mlBonus = moonlightActive ? MOONLIGHT_BONUS : 0;
    if (template.affixes?.primary?.pool) {
      const [minC, maxC] = template.affixes.primary.count || [1, 1];
      statRanges.primaryCount = [minC, maxC];
      for (const affix of template.affixes.primary.pool) {
        const effectiveMin = mlBonus > 0 ? Math.min(affix.max, affix.min + Math.floor((affix.max - affix.min) * mlBonus)) : affix.min;
        statRanges.primary.push({ stat: affix.stat, min: effectiveMin, max: affix.max });
      }
    }
    if (template.affixes?.minor?.pool) {
      const [minC, maxC] = template.affixes.minor.count || [0, 0];
      statRanges.minorCount = [minC, maxC];
      for (const affix of template.affixes.minor.pool) {
        const effectiveMin = mlBonus > 0 ? Math.min(affix.max, affix.min + Math.floor((affix.max - affix.min) * mlBonus)) : affix.min;
        statRanges.minor.push({ stat: affix.stat, min: effectiveMin, max: affix.max });
      }
    }

    preview.outputType = 'gear';
    preview.gear = {
      name: template.name,
      slot: template.slot,
      rarity: template.rarity || 'common',
      tier: template.tier || 1,
      setId: template.setId || null,
      socketRange,
      statRanges,
      legendaryEffect: template.legendaryEffect ? {
        type: template.legendaryEffect.type,
        min: template.legendaryEffect.min,
        max: template.legendaryEffect.max,
        label: template.legendaryEffect.label || null,
      } : null,
      fixedStats: template.fixedStats || null,
      icon: template.icon || null,
      desc: template.desc || template.flavorText || '',
    };
  } else if (recipe.result?.type === 'material') {
    const matId = recipe.result.materialId || recipe.result.outputMaterial;
    const matDef = PROFESSIONS_DATA.materials?.find(m => m.id === matId);
    preview.outputType = 'material';
    preview.material = { id: matId, name: matDef?.name || matId, amount: recipe.result.amount || recipe.result.count || 1 };
  } else if (recipe.result?.type === 'transmute_material') {
    const matDef = PROFESSIONS_DATA.materials?.find(m => m.id === recipe.result.outputMaterial);
    preview.outputType = 'material';
    preview.material = { id: recipe.result.outputMaterial, name: matDef?.name || recipe.result.outputMaterial, amount: recipe.result.outputAmount || 1 };
  } else if (recipe.result?.type === 'buff' || ['potion_xp', 'potion_gold', 'potion_luck', 'potion_streak', 'potion_doubledown'].includes(recipeId)) {
    const buffDuration = recipe.result?.duration ? parseInt(recipe.result.duration.replace('_quests', '')) : 3;
    const masteryExtra = masteryDef?.type === 'potion_duration' ? masteryDef.value : 0;
    preview.outputType = 'buff';
    preview.buff = { type: recipe.result?.buffType || recipeId, duration: buffDuration + masteryExtra, mastery: masteryExtra > 0 };
  } else if (recipe.result?.type === 'temp_enchant') {
    preview.outputType = 'temp_enchant';
    preview.enchant = {
      statPool: [...PRIMARY_STATS, ...MINOR_STATS],
      statRange: recipe.result.statBonus || [1, 2],
      durationHours: recipe.result.durationHours || 24,
      mastery: masteryDef?.type === 'enchant_power' ? masteryDef.value : 0,
    };
  } else if (recipe.result?.type === 'perm_enchant' || SLOT_RECIPES.includes(recipeId)) {
    preview.outputType = 'slot_modify';
    const slotInfo = {};
    if (recipeId === 'upgrade_rarity') slotInfo.action = 'Rarity upgrade (50% success)';
    else if (recipeId === 'reinforce_armor') slotInfo.action = 'Reinforce: +3-6 random primary stat';
    else if (recipeId === 'sharpen_blade') slotInfo.action = 'Sharpen: +1-3 random primary stat';
    else if (recipeId === 'permanent_enchant') slotInfo.action = 'Permanent enchant: +1-2 random minor stat';
    else if (recipeId === 'enchant_socket') slotInfo.action = 'Arcane Infusion: +3-5 random primary stat';
    else if (recipeId === 'enchant_reroll') slotInfo.action = 'Reroll one stat from affix pool';
    else slotInfo.action = recipe.name;
    if (targetSlot) {
      const eq = u.equipment?.[targetSlot];
      if (eq && typeof eq !== 'string') {
        slotInfo.targetItem = { name: eq.name, rarity: eq.rarity, slot: targetSlot };
      }
    }
    preview.slotModify = slotInfo;
  } else if (recipe.result?.type === 'vellum') {
    preview.outputType = 'vellum';
    preview.vellum = {
      statPool: [...PRIMARY_STATS, ...MINOR_STATS],
      statRange: recipe.result.statBonus || [2, 4],
      durationHours: recipe.result.durationHours || 24,
      tradeable: true,
    };
  } else if (recipe.result?.type === 'forge_temp') {
    preview.outputType = 'forge_temp';
    preview.forgeTemp = { amount: recipe.result.amount || 15 };
  } else if (recipe.result?.type === 'streak_shield') {
    preview.outputType = 'streak_shield';
  } else if (recipeId.startsWith('meal_')) {
    const masteryExtra = masteryDef?.type === 'meal_duration' ? masteryDef.value : 0;
    preview.outputType = 'meal';
    preview.meal = { type: recipe.result?.buffType || recipeId, duration: (recipe.result?.duration || 5) + masteryExtra, mastery: masteryExtra > 0 };
  } else if (recipe.result?.type === 'gem_cut') {
    preview.outputType = 'gem';
    const gemData = state.gemsData?.gems?.find(g => g.id === recipe.result.gemType);
    const tierData = gemData?.tiers?.find(t => t.tier === recipe.result.gemTier);
    preview.gem = { type: recipe.result.gemType, tier: recipe.result.gemTier, name: tierData?.name || `Tier ${recipe.result.gemTier}`, stat: gemData?.stat, statBonus: tierData?.statBonus, color: gemData?.color };
  } else if (recipe.result?.type === 'gem_merge') {
    preview.outputType = 'gem_merge';
    preview.gemMerge = { fromTier: recipe.result.fromTier, toTier: recipe.result.toTier };
  } else if (recipe.result?.type === 'gear_enhance') {
    preview.outputType = 'gear_enhance';
    preview.enhance = { stat: recipe.result.stat, amount: recipe.result.amount || 1 };
  } else {
    preview.outputType = 'unknown';
  }

  // Enrich material names
  const materialNames = {};
  for (const matId of Object.keys(recipe.materials || {})) {
    const matDef = PROFESSIONS_DATA.materials?.find(m => m.id === matId);
    materialNames[matId] = matDef?.name || matId;
  }
  preview.materialNames = materialNames;

  res.json(preview);
});

// ─── POST /api/professions/choose — explicitly enroll in a profession ────────
router.post('/api/professions/choose', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!acquireCraftLock(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
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
  const isSecondaryChoice = SECONDARY_PROFESSIONS.includes(professionId);
  if (!isSecondaryChoice && countPrimaryProfessions(u.chosenProfessions) >= chooseMaxSlots) {
    const primaryProfs = u.chosenProfessions.filter(p => !SECONDARY_PROFESSIONS.includes(p));
    return res.status(400).json({ error: `You have ${primaryProfs.length}/${chooseMaxSlots} primary profession slots (${primaryProfs.join(', ')}). Drop one first.` });
  }

  u.chosenProfessions.push(professionId);
  u.professions = u.professions || {};
  if (!u.professions[professionId]) {
    u.professions[professionId] = { skill: 1, xp: 1, level: 1, lastCraftAt: null, trainedRanks: ['Apprentice'], recipeCooldowns: {} };
  } else {
    // Migration: ensure existing 0-skill entries get bumped to 1
    if ((u.professions[professionId].skill || 0) < 1) {
      u.professions[professionId].skill = 1;
      u.professions[professionId].xp = 1;
      u.professions[professionId].level = 1;
    }
  }
  saveUsers();

  res.json({
    message: `${profDef.name} chosen! You can now craft at ${profDef.npcName}.`,
    chosenProfessions: u.chosenProfessions,
  });
  } finally { releaseCraftLock(uid); }
});

// ─── POST /api/professions/switch — drop a profession to choose another ─────
router.post('/api/professions/switch', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!acquireCraftLock(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { dropProfession } = req.body;
  if (!dropProfession) return res.status(400).json({ error: 'dropProfession required' });

  u.chosenProfessions = u.chosenProfessions || [];
  if (!u.chosenProfessions.includes(dropProfession)) {
    return res.status(400).json({ error: `${dropProfession} is not an active profession` });
  }

  // Free to drop (WoW Classic: no cost, just lose all progress)

  // Remove profession
  u.chosenProfessions = u.chosenProfessions.filter(p => p !== dropProfession);
  // Reset profession progress (WoW Classic: dropping = lose everything)
  if (u.professions?.[dropProfession]) {
    u.professions[dropProfession] = { level: 0, skill: 0, xp: 0, lastCraftAt: null, trainedRanks: ['Apprentice'], recipeCooldowns: {} };
  }
  // Remove all learned + unlocked recipes for this profession (WoW-style: dropping = lose everything)
  const profRecipeIds = new Set(
    (PROFESSIONS_DATA.recipes || []).filter(r => r.profession === dropProfession).map(r => r.id)
  );
  if (u.learnedRecipes?.length) {
    u.learnedRecipes = u.learnedRecipes.filter(rid => !profRecipeIds.has(rid));
  }
  if (u.unlockedRecipes?.length) {
    u.unlockedRecipes = u.unlockedRecipes.filter(rid => !profRecipeIds.has(rid));
  }

  saveUsers();
  res.json({
    message: `${dropProfession} dropped. You can now choose a new profession.`,
    chosenProfessions: u.chosenProfessions,
    essenz: u.currencies.essenz,
  });
  } finally { releaseCraftLock(uid); }
});

// ─── Schmiedekunst + Enchanting moved to routes/schmiedekunst.js and routes/enchanting.js ───

// ─── Rank Training (WoW-style: pay gold to unlock next skill cap) ────────────
const RANK_TRAINING_COSTS = [
  { rank: 'Journeyman', fromCap: 75, toCap: 150, cost: 500, reqPlayerLevel: 15, reqSkill: 50 },
  { rank: 'Expert', fromCap: 150, toCap: 225, cost: 2000, reqPlayerLevel: 25, reqSkill: 125 },
  { rank: 'Artisan', fromCap: 225, toCap: 300, cost: 5000, reqPlayerLevel: 40, reqSkill: 200 },
];

router.post('/api/crafting/train-rank', requireAuth, (req, res) => {
  const uid = (req.auth?.userId || '').toLowerCase();
  if (!acquireCraftLock(uid)) return res.status(429).json({ error: 'Action in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { professionId } = req.body;
  if (!professionId) return res.status(400).json({ error: 'professionId required' });
  if (!(u.chosenProfessions || []).includes(professionId)) return res.status(400).json({ error: 'Not your profession' });

  const profData = u.professions?.[professionId];
  if (!profData) return res.status(400).json({ error: 'Profession not started' });
  const playerLevel = getLevelInfo(u.xp || 0).level;
  const currentCap = getSkillCap(playerLevel, profData?.trainedRanks);
  const skill = profData.skill || 0;

  // Find next rank to train
  const nextRank = RANK_TRAINING_COSTS.find(r => skill >= r.fromCap - 10 && (!profData.trainedRanks || !profData.trainedRanks.includes(r.rank)));
  if (!nextRank) return res.status(400).json({ error: 'No rank available to train' });
  if (playerLevel < nextRank.reqPlayerLevel) return res.status(400).json({ error: `Requires player level ${nextRank.reqPlayerLevel} (you are ${playerLevel})` });
  if (nextRank.reqSkill && skill < nextRank.reqSkill) return res.status(400).json({ error: `Requires skill ${nextRank.reqSkill} (you have ${skill})` });

  ensureUserCurrencies(u);
  if (u.currencies.gold < nextRank.cost) return res.status(400).json({ error: `Not enough gold (need ${nextRank.cost}, have ${u.currencies.gold})` });

  u.currencies.gold -= nextRank.cost;
  u.gold = u.currencies.gold;
  profData.trainedRanks = profData.trainedRanks || ['Apprentice'];
  profData.trainedRanks.push(nextRank.rank);
  saveUsers();
  console.log(`[crafting] ${uid} trained ${professionId} rank: ${nextRank.rank} for ${nextRank.cost}g`);
  res.json({ ok: true, rank: nextRank.rank, cost: nextRank.cost, newCap: nextRank.toCap, remainingGold: u.currencies.gold });
  } finally { releaseCraftLock(uid); }
});

// ─── Reforge Legendary (D3 Kanai's Cube "Law of Kulle") ─────────────────────

// ─── POST /api/professions/favorite — toggle recipe favorite ────────────────
router.post('/api/professions/favorite', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { recipeId } = req.body;
  if (!recipeId) return res.status(400).json({ error: 'recipeId required' });
  u.favoriteRecipes = u.favoriteRecipes || [];
  const idx = u.favoriteRecipes.indexOf(recipeId);
  if (idx === -1) {
    if (u.favoriteRecipes.length >= 20) return res.status(400).json({ error: 'Max 20 favorite recipes' });
    u.favoriteRecipes.push(recipeId);
  } else {
    u.favoriteRecipes.splice(idx, 1);
  }
  saveUsers();
  res.json({ ok: true, favoriteRecipes: u.favoriteRecipes });
});

// ─── POST /api/professions/buy-reagent — Buy vendor reagents from trainer ───
router.post('/api/professions/buy-reagent', requireAuth, (req, res) => {
  const uid = req.auth?.userId;
  if (!acquireCraftLock(uid)) return res.status(429).json({ error: 'Purchase in progress' });
  try {
  const u = state.users[uid];
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { reagentId, count } = req.body;
  if (!reagentId || !count || count < 1 || count > 100) {
    return res.status(400).json({ error: 'reagentId and count (1-100) required' });
  }

  const reagent = (PROFESSIONS_DATA.vendorReagents || []).find(r => r.id === reagentId);
  if (!reagent) return res.status(400).json({ error: 'Unknown reagent' });

  const safeCount = Math.min(100, Math.max(1, parseInt(count) || 1));
  // Talent tree: vendor_reagent_discount — reduces vendor reagent cost
  const talentReagentDiscount = (require('./talent-tree').getUserTalentEffects(uid)).vendor_reagent_discount || 0;
  const discountedPrice = Math.max(1, Math.round(reagent.price * (1 - talentReagentDiscount)));
  const totalCost = discountedPrice * safeCount;
  ensureUserCurrencies(u);
  if ((u.currencies.gold ?? u.gold ?? 0) < totalCost) {
    return res.status(400).json({ error: `Not enough gold (need ${totalCost}g)` });
  }

  u.currencies.gold = (u.currencies.gold || 0) - totalCost;
  u.gold = u.currencies.gold;
  u.craftingMaterials = u.craftingMaterials || {};
  u.craftingMaterials[reagentId] = (u.craftingMaterials[reagentId] || 0) + safeCount;

  saveUsers();
  res.json({ ok: true, bought: { id: reagentId, name: reagent.name, count: safeCount, totalCost }, materials: u.craftingMaterials });
  } finally { releaseCraftLock(uid); }
});

// ─── Exports (shared with schmiedekunst.js and enchanting.js) ─────────────
module.exports = router;
module.exports.loadProfessions = loadProfessions;
module.exports.isMoonlightActive = isMoonlightActive;
module.exports.MOONLIGHT_BONUS = MOONLIGHT_BONUS;
module.exports.VALID_SLOTS = VALID_SLOTS;
module.exports.RARITY_ORDER = RARITY_ORDER;
module.exports.getEquippedIds = getEquippedIds;
