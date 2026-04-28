/**
 * Daily Quest Rotation — seeded random quest selection at midnight Berlin time.
 */
const {
  state, saveQuests, saveRotationState, loadRotationState, savePlayerProgress, rebuildQuestsById,
} = require('./state');
const { getTodayBerlin, getMsUntilNextMidnightBerlin, getLevelInfo } = require('./helpers');
const { midnightNpcSpawn } = require('./npc-engine');
const { resolveQuest } = require('./quest-templates');

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
  const diff = (template.vars && template.vars.difficulty) || template.difficulty || 'starter';
  const roll = Math.random();

  // Rarity chances based on difficulty:
  // starter:       common(60%) uncommon(30%) rare(9%) epic(1%) legendary(0%)
  // intermediate:  common(35%) uncommon(40%) rare(20%) epic(5%) legendary(0%)
  // advanced:      common(10%) uncommon(25%) rare(40%) epic(20%) legendary(5%)
  // expert:        common(0%)  uncommon(10%) rare(30%) epic(40%) legendary(20%)
  switch (diff) {
    case 'starter':
      if (roll < 0.01) return 'epic';
      if (roll < 0.10) return 'rare';
      if (roll < 0.40) return 'uncommon';
      return 'common';
    case 'intermediate':
      if (roll < 0.05) return 'epic';
      if (roll < 0.25) return 'rare';
      if (roll < 0.65) return 'uncommon';
      return 'common';
    case 'advanced':
      if (roll < 0.05) return 'legendary';
      if (roll < 0.25) return 'epic';
      if (roll < 0.65) return 'rare';
      if (roll < 0.90) return 'uncommon';
      return 'common';
    case 'expert':
      if (roll < 0.20) return 'legendary';
      if (roll < 0.60) return 'epic';
      if (roll < 0.90) return 'rare';
      return 'uncommon';
    default:
      // Fallback: old random behavior
      if (roll < 0.01) return 'legendary';
      if (roll < 0.05) return 'epic';
      if (roll < 0.15) return 'rare';
      if (roll < 0.40) return 'uncommon';
      return 'common';
  }
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

  // Filter out templates above player level
  const levelFiltered = templates.filter(t => (t.minLevel || 1) <= playerLevel);

  const byType = {};
  for (const t of levelFiltered) {
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

  const remaining = levelFiltered.filter(t => !usedIds.has(t.id));
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
  // Guard: prevent running twice on the same day (infinite loop protection)
  if (state.rotationState.lastDailyRotation === todayStr) {
    console.log(`[Daily Rotation] Already rotated today (${todayStr}), skipping.`);
    return;
  }
  console.log(`[Daily Rotation] Starting rotation for ${todayStr}...`);

  // ─── Reset recurring quests whose interval has elapsed ─────────────────────
  // Flip their status back to open and clear the per-player completion records
  // for player-quest types (personal/learning/fitness/social) — otherwise the
  // pp.completedQuests entry blocks the next claim forever with HTTP 409.
  const { PLAYER_QUEST_TYPES } = require('./state');
  const nowMs = Date.now();
  const INTERVAL_MS = { daily: 24 * 3600 * 1000, weekly: 7 * 24 * 3600 * 1000, monthly: 30 * 24 * 3600 * 1000 };
  const recurringReset = new Set();
  let recurringFlipped = 0;
  for (const q of state.quests) {
    if (q.status !== 'completed' || !q.recurrence) continue;
    const interval = INTERVAL_MS[q.recurrence];
    if (!interval) continue;
    const lastDone = q.lastCompletedAt ? new Date(q.lastCompletedAt).getTime() : 0;
    if (nowMs - lastDone >= interval) {
      q.status = 'open';
      q.claimedBy = null;
      q.completedBy = null;
      q.completedAt = null;
      recurringFlipped++;
      if (PLAYER_QUEST_TYPES && PLAYER_QUEST_TYPES.includes(q.type || 'development')) {
        recurringReset.add(q.id);
      }
    }
  }
  let playerCompletionsCleared = 0;
  if (recurringReset.size > 0) {
    for (const pp of Object.values(state.playerProgress || {})) {
      if (!pp?.completedQuests) continue;
      for (const qid of recurringReset) {
        if (pp.completedQuests[qid]) {
          delete pp.completedQuests[qid];
          playerCompletionsCleared++;
        }
      }
    }
  }
  if (recurringFlipped > 0) {
    console.log(`[Daily Rotation] Recurring quest reset: ${recurringFlipped} re-opened, ${playerCompletionsCleared} per-player completion records cleared.`);
  }

  // Remove ALL old open system quests (non-NPC, non-companion)
  const kept = state.quests.filter(q =>
    q.status !== 'open' ||
    q.createdBy !== 'system' ||
    q.npcGiverId ||
    q.category === 'companion' ||
    (q.categories && q.categories.includes('companion'))
  );
  const removed = state.quests.length - kept.length;
  state.quests = kept;
  rebuildQuestsById();
  saveQuests();

  // Reset all player pools so they auto-generate fresh on next visit
  const playerProgress = state.playerProgress || {};
  for (const [uid, pp] of Object.entries(playerProgress)) {
    pp.generatedQuests = [];
    pp.activeQuestPool = [];
    delete pp.lastPoolRefresh; // Allow immediate refresh
  }
  savePlayerProgress();

  state.rotationState.lastDailyRotation = todayStr;
  state.rotationState.questSeed = makeDaySeed(todayStr);
  saveRotationState();

  console.log(`[Daily Rotation] Cleared ${removed} old system quests, reset all player pools. Fresh quests on next visit.`);

  midnightNpcSpawn();

  // Schmiedefieber rotation check (every 48h)
  try {
    const { rotateForgeFever } = require('../routes/crafting');
    if (rotateForgeFever) rotateForgeFever();
  } catch (e) { console.error('[forge-fever] Rotation error:', e.message); }
}

function scheduleDailyRotation() {
  let ms = getMsUntilNextMidnightBerlin();
  // Guard: if ms is negative or zero (midnight already passed), schedule for NEXT midnight
  if (ms <= 60000) {
    ms = ms + 86400000; // Add 24 hours
  }
  const hours = (ms / 3600000).toFixed(1);
  console.log(`[Daily Rotation] Next rotation in ${hours}h (midnight Europe/Berlin)`);
  setTimeout(() => {
    try {
      dailyQuestRotation();
    } catch (err) {
      console.error('[Daily Rotation] Error during rotation:', err);
    }
    scheduleDailyRotation();
  }, ms);
}

function checkAndRunDailyRotation() {
  loadRotationState();
  const todayStr = getTodayBerlin();
  if (state.rotationState.lastDailyRotation !== todayStr) {
    console.log(`[Daily Rotation] Missed rotation for today (last: ${state.rotationState.lastDailyRotation || 'never'}) — will run at next midnight (not on restart)`);
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
