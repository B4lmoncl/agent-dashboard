/**
 * Crafting & Professions Routes — Schmied, Alchemist, Verzauberer
 */
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { state, saveUsers } = require('../lib/state');
const { now, getLevelInfo, rollAffixStats, PRIMARY_STATS, MINOR_STATS } = require('../lib/helpers');
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
    return {
      ...p,
      unlocked,
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

  const uid = req.resolvedPlayerId;
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

  // Deduct costs
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

  // ─── Execute recipe effect ──────────────────────────────────────────────
  let result = { success: true, message: '' };

  switch (recipeId) {
    case 'reroll_stat': {
      // Reroll one primary stat on an equipped item
      if (!targetSlot) return res.status(400).json({ error: 'targetSlot required' });
      const eq = u.equipment?.[targetSlot];
      if (!eq || typeof eq === 'string') return res.status(400).json({ error: 'No gear instance in slot' });
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
      if (!targetSlot) return res.status(400).json({ error: 'targetSlot required' });
      const eq = u.equipment?.[targetSlot];
      if (!eq || typeof eq === 'string') return res.status(400).json({ error: 'No gear instance in slot' });
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
        }
      }
      result.updatedGear = eq;
      break;
    }

    case 'upgrade_rarity': {
      if (!targetSlot) return res.status(400).json({ error: 'targetSlot required' });
      const eq = u.equipment?.[targetSlot];
      if (!eq || typeof eq === 'string') return res.status(400).json({ error: 'No gear instance in slot' });
      const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const currentIdx = RARITY_ORDER.indexOf(eq.rarity || 'common');
      if (currentIdx >= RARITY_ORDER.length - 1) {
        result.message = 'Item ist bereits legendär!';
        result.success = false;
        break;
      }
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
      if (!targetSlot) return res.status(400).json({ error: 'targetSlot required' });
      const eq = u.equipment?.[targetSlot];
      if (!eq || typeof eq === 'string') return res.status(400).json({ error: 'No gear instance in slot' });
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
      if (!targetSlot) return res.status(400).json({ error: 'targetSlot required' });
      const eq = u.equipment?.[targetSlot];
      if (!eq || typeof eq === 'string') return res.status(400).json({ error: 'No gear instance in slot' });
      const stat = MINOR_STATS[Math.floor(Math.random() * MINOR_STATS.length)];
      const value = 1 + Math.floor(Math.random() * 2); // 1-2
      eq.stats = eq.stats || {};
      eq.stats[stat] = (eq.stats[stat] || 0) + value;
      result.message = `Permanente Verzauberung: +${value} ${stat}!`;
      result.updatedGear = eq;
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

module.exports = router;
module.exports.loadProfessions = loadProfessions;
