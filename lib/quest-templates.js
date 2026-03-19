/**
 * Quest Template Engine — resolves template + vars into full quest objects.
 */
const fs = require('fs');
const path = require('path');

let _templates = null;

function loadTemplates() {
  if (_templates) return _templates;
  const file = path.join(__dirname, '..', 'public', 'data', 'questTemplates.json');
  try {
    _templates = JSON.parse(fs.readFileSync(file, 'utf8')).templates;
  } catch (e) {
    console.warn('[quest-templates] Failed to load questTemplates.json:', e.message);
    _templates = {};
  }
  return _templates;
}

/**
 * Simple string interpolation: replace {varName} with value from vars.
 */
function interpolate(format, vars) {
  if (!format) return '';
  return format.replace(/\{(\w+)\}/g, (_, key) => vars[key] !== undefined ? vars[key] : `{${key}}`);
}

/**
 * Resolve a quest entry (template ref + vars) into a fully-populated quest data object.
 *
 * @param {object} questData  — quest entry from JSON (may have `template` + `vars`, or be old-format)
 * @param {object} [npcContext] — { npcName, npcRarity, ... } for NPC quests
 * @returns {object} — resolved quest fields: title, description, flavorText, type, priority, rewards, lore
 */
function resolveQuest(questData, npcContext) {
  // Backward compat: no template field → already fully resolved
  if (!questData.template) return questData;

  const templates = loadTemplates();
  const template = templates[questData.template];
  if (!template) {
    console.warn(`[quest-templates] Unknown template: ${questData.template}`);
    return questData;
  }

  const vars = { ...(questData.vars || {}) };

  // Inject NPC context vars
  if (npcContext) {
    if (!vars.npcName) vars.npcName = npcContext.npcName || npcContext.name;
    if (!vars.npcRarity) vars.npcRarity = npcContext.npcRarity || npcContext.rarity;
  }

  // Resolve description: explicit field wins, then build from format + vars
  const description = questData.description || interpolate(template.descFormat, vars);

  // Resolve flavorText: explicit field wins, then build from format + vars
  const flavorText = questData.flavorText || interpolate(template.flavorFormat, vars);

  // Resolve rewards: explicit field wins, then look up from rewardTable by difficulty
  const difficulty = vars.difficulty || questData.difficulty;
  const rewards = questData.rewards
    || (difficulty && template.rewardTable && template.rewardTable[difficulty])
    || { xp: 20, gold: 10 };

  // Resolve rarity for board quests: map difficulty → rarity
  // NPC quests get their rarity from the NPC (handled in npc-engine.js), not here
  const DIFFICULTY_RARITY = {
    starter: 'common', easy: 'common',
    intermediate: 'uncommon', medium: 'uncommon',
    advanced: 'rare', hard: 'rare',
    expert: 'epic', epic: 'epic',
  };
  const rarity = questData.rarity
    || (questData.template === 'board-quest' && difficulty ? DIFFICULTY_RARITY[difficulty] || 'common' : undefined);

  return {
    title: questData.title,
    description,
    flavorText,
    type: questData.type || 'personal',
    priority: questData.priority,
    lore: questData.lore || null,
    rewards,
    ...(rarity ? { rarity } : {}),
  };
}

module.exports = { loadTemplates, interpolate, resolveQuest };
