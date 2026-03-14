/**
 * Daily Quest Rotation — seeded random quest selection at midnight Berlin time.
 */
const {
  state, saveQuests, saveRotationState, loadRotationState,
} = require('./state');
const { getTodayBerlin, getMsUntilNextMidnightBerlin, getLevelInfo } = require('./helpers');
const { midnightNpcSpawn } = require('./npc-engine');

function seededRandom(seed) {
  let t = (seed = (seed + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function makeDaySeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function assignRarity(template) {
  if (template.rarity) return template.rarity;
  const roll = Math.random();
  if (roll < 0.01) return 'legendary';
  if (roll < 0.05) return 'epic';
  if (roll < 0.15) return 'rare';
  if (roll < 0.40) return 'uncommon';
  return 'common';
}

function getTemplateWeight(template, playerLevel) {
  const questLevel = template.minLevel || 1;
  const diff = questLevel - playerLevel;
  if (diff >= 0 && diff <= 3) return 3.0;
  if (diff >= -3 && diff < 0) return 2.0;
  if (diff >= -7 && diff < -3) return 0.8;
  if (diff < -7) return 0.2;
  if (diff > 3) return 0.1;
  return 1.0;
}

function weightedShuffle(items, weightFn, rng) {
  const result = [];
  const pool = items.map(item => ({ item, weight: weightFn(item) }));
  while (pool.length > 0) {
    const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
    let roll = rng() * totalWeight;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight;
      if (roll <= 0) { idx = i; break; }
    }
    result.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return result;
}

function getHighestPlayerLevel() {
  const allUsers = Object.values(state.users);
  if (allUsers.length === 0) return 1;
  let maxLevel = 1;
  for (const u of allUsers) {
    const lvl = getLevelInfo(u.xp || 0).level;
    if (lvl > maxLevel) maxLevel = lvl;
  }
  return maxLevel;
}

function selectDailyQuests(templates, opts) {
  const { count, typeDistribution, previousIds, daySeed } = opts;
  let seed = daySeed;
  const rng = () => { seed++; return seededRandom(seed); };

  const playerLevel = getHighestPlayerLevel();

  const byType = {};
  for (const t of templates) {
    const type = t.type || 'personal';
    if (!byType[type]) byType[type] = [];
    byType[type].push(t);
  }

  const selected = [];
  const usedIds = new Set();
  const prevSet = new Set(previousIds || []);

  for (const [type, quota] of Object.entries(typeDistribution)) {
    const pool = (byType[type] || []).filter(t => !usedIds.has(t.id));
    const fresh = pool.filter(t => !prevSet.has(t.id));
    const stale = pool.filter(t => prevSet.has(t.id));

    const weightFn = (t) => getTemplateWeight(t, playerLevel);
    const sortedFresh = weightedShuffle(fresh, weightFn, rng);
    const sortedStale = weightedShuffle(stale, weightFn, rng);
    const ordered = [...sortedFresh, ...sortedStale];

    for (const t of ordered.slice(0, quota)) {
      selected.push(t);
      usedIds.add(t.id);
    }
  }

  const remaining = templates.filter(t => !usedIds.has(t.id));
  const weightFn = (t) => getTemplateWeight(t, playerLevel);
  const weightedRemaining = weightedShuffle(remaining, weightFn, rng);
  for (const t of weightedRemaining) {
    if (selected.length >= count) break;
    selected.push(t);
    usedIds.add(t.id);
  }

  return selected;
}

function dailyQuestRotation() {
  const todayStr = getTodayBerlin();
  console.log(`[Daily Rotation] Starting rotation for ${todayStr}...`);

  const kept = state.quests.filter(q =>
    q.status !== 'open' ||
    q.createdBy !== 'system' ||
    q.npcGiverId ||
    q.category === 'companion' ||
    (q.categories && q.categories.includes('companion'))
  );
  const removed = state.quests.length - kept.length;

  const catalog = state.questCatalog.templates || [];
  const templates = catalog.filter(t =>
    t.category !== 'companion' && t.createdBy !== 'companion'
  );

  if (templates.length === 0) {
    console.warn('[Daily Rotation] No non-companion templates in catalog, skipping');
    return;
  }

  const daySeed = makeDaySeed(todayStr);

  const dailyTemplates = selectDailyQuests(templates, {
    count: 18,
    typeDistribution: { personal: 5, fitness: 4, learning: 4, social: 3, boss: 2 },
    previousIds: state.rotationState.previousQuestTemplateIds,
    daySeed,
  });

  const priorityMap = { starter: 'low', intermediate: 'medium', advanced: 'high', expert: 'high' };
  const newQuests = dailyTemplates.map((t, i) => ({
    id: `quest-daily-${todayStr}-${String(i + 1).padStart(3, '0')}`,
    title: t.title,
    description: t.description,
    priority: priorityMap[t.difficulty] || t.priority || 'medium',
    type: t.type || 'personal',
    categories: t.category ? [t.category] : [],
    product: null,
    humanInputRequired: false,
    createdBy: 'system',
    status: 'open',
    createdAt: new Date().toISOString(),
    claimedBy: null,
    completedBy: null,
    completedAt: null,
    parentQuestId: null,
    recurrence: t.recurrence || null,
    streak: 0,
    lastCompletedAt: null,
    proof: null,
    checklist: null,
    nextQuestTemplate: null,
    coopPartners: null,
    coopClaimed: [],
    coopCompletions: [],
    skills: t.tags || [],
    lore: t.lore || null,
    chapter: t.chainId || null,
    minLevel: t.minLevel || 1,
    classRequired: t.classId || null,
    requiresRelationship: t.requiresRelationship || false,
    rarity: assignRarity(t),
    flavor: t.flavor || null,
    flavorText: t.flavorText || t.flavor || null,
    templateId: t.id,
  }));

  state.quests = [...kept, ...newQuests];
  saveQuests();

  state.rotationState.lastDailyRotation = todayStr;
  state.rotationState.questSeed = daySeed;
  state.rotationState.previousQuestTemplateIds = dailyTemplates.map(t => t.id);
  saveRotationState();

  console.log(`[Daily Rotation] ${newQuests.length} new quests generated, ${kept.length} kept (${removed} old open system quests removed)`);

  midnightNpcSpawn();
}

function scheduleDailyRotation() {
  const ms = getMsUntilNextMidnightBerlin();
  const hours = (ms / 3600000).toFixed(1);
  console.log(`[Daily Rotation] Next rotation in ${hours}h (midnight Europe/Berlin)`);
  setTimeout(() => {
    dailyQuestRotation();
    scheduleDailyRotation();
  }, ms);
}

function checkAndRunDailyRotation() {
  loadRotationState();
  const todayStr = getTodayBerlin();
  if (state.rotationState.lastDailyRotation !== todayStr) {
    console.log(`[Daily Rotation] No rotation yet today (last: ${state.rotationState.lastDailyRotation || 'never'}), running now...`);
    dailyQuestRotation();
  } else {
    console.log(`[Daily Rotation] Already rotated today (${todayStr})`);
  }
  scheduleDailyRotation();
}

module.exports = {
  seededRandom,
  makeDaySeed,
  assignRarity,
  getTemplateWeight,
  weightedShuffle,
  getHighestPlayerLevel,
  selectDailyQuests,
  dailyQuestRotation,
  scheduleDailyRotation,
  checkAndRunDailyRotation,
};
