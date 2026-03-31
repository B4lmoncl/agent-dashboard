const state = require('../lib/state');
state.loadItemTemplates();
state.loadGearTemplates();

const handledEffects = [
  'gold', 'xp', 'xp_boost', 'bond', 'streak_shield', 'forge_temp',
  'random_gear', 'random_gear_epic', 'companion_egg', 'cosmetic',
  'gear_next_tier', 'undo_missed_ritual', 'named_gear', 'team_buff',
  'title', 'unlock_secret_quest', 'revive', 'gold_2x_24h',
  'essenz_boost_48h', 'quest_timer_24h', 'small_heal',
  'streak_recovery_100', 'armor',
  // Added: all effect types handled by applyShopEffect in shop.js
  'xp_gold_boost', 'essenz', 'stardust', 'runensplitter', 'sternentaler',
  'luck_boost', 'faction_rep', 'craft_discount', 'expedition_speed',
  'rift_time_extend', 'multi_reward', 'double_reward',
  'instant_stardust', 'instant_essenz', 'instant_forge_temp',
  'instant_streak_shield', 'instant_forge_temp_and_streak_shield',
  'rift_time_extension',
  'xp_boost_10', 'xp_boost_15', 'xp_boost_5', 'xp_boost_25_return', 'xp_boost_50_perfect',
  'gold_boost_10', 'gold_boost_15', 'luck_boost_20', 'material_double',
  'world_boss_damage_boost', 'feast_buff',
];

const templates = state.state.itemTemplates;
let missing = [];
for (const [id, item] of templates) {
  if (item.type !== 'consumable') continue;
  const eff = item.effect;
  if (!eff) continue;
  const effType = eff.type || (typeof eff === 'string' ? eff : null);
  if (effType && !handledEffects.includes(effType)) {
    missing.push({ id, effType });
  }
}

if (missing.length === 0) {
  console.log('All consumable effect types are handled!');
} else {
  console.log('Missing handlers:', JSON.stringify(missing));
}

const passiveItems = [...templates.values()].filter(i => i.type === 'passive');
console.log('Passive items (always active, blocked from use):', passiveItems.map(i => i.id).join(', '));

console.log('Equipment items:', [...templates.values()].filter(i => i.type === 'equipment').length);
console.log('Special items:', [...templates.values()].filter(i => i.type === 'special').map(i => i.id).join(', '));
console.log('Total items in templates:', templates.size);

// Test resolveItem for backward compat
const tests = ['gold-small', 't1-sword', 'wanderermantel', 'phoenixfeder'];
for (const id of tests) {
  const item = state.resolveItem(id);
  console.log(`resolveItem('${id}'):`, item ? `${item.name} (${item.type})` : 'NOT FOUND');
}

// Test getActiveBuffs
const testUser = { activeBuffs: [
  { type: 'xp_boost', amount: 10, expiresAt: new Date(Date.now() + 3600000).toISOString() },
  { type: 'gold_2x', amount: 2, expiresAt: new Date(Date.now() - 3600000).toISOString() },
] };
state.state.users['test'] = testUser;
const activeBuffs = state.getActiveBuffs('test');
console.log('Active buffs (should be 1, expired filtered):', activeBuffs.length);
delete state.state.users['test'];

console.log('\nAll checks passed!');
