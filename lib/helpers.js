/**
 * Shared Helper Functions — utilities used across multiple route files.
 */
const {
  state, LEVELS, TIMEZONE, XP_BY_PRIORITY, GOLD_BY_PRIORITY, TEMP_BY_PRIORITY,
  RARITY_WEIGHTS, RARITY_COLORS, RARITY_ORDER, STREAK_MILESTONES,
  GEAR_TIERS, SET_BONUSES, ACHIEVEMENT_TRIGGERS, EQUIPMENT_SLOTS,
  saveUsers, saveQuests, saveData,
} = require('./state');

// ─── Basic helpers ──────────────────────────────────────────────────────────
function now() {
  return new Date().toISOString();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getTodayBerlin() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function getMsUntilNextMidnightBerlin() {
  const nowDate = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(nowDate);
  const get = (type) => parseInt(parts.find(p => p.type === type).value, 10);
  const h = get('hour'), m = get('minute'), s = get('second');
  const secsSinceMidnight = h * 3600 + m * 60 + s;
  const secsUntilMidnight = 86400 - secsSinceMidnight;
  return secsUntilMidnight * 1000 + 1000;
}

function getLevelInfo(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xpRequired) current = l;
    else break;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  const progress = next
    ? Math.min(1, (xp - current.xpRequired) / (next.xpRequired - current.xpRequired))
    : 1;
  return {
    level: current.level,
    title: current.title,
    xpRequired: current.xpRequired,
    nextXp: next ? next.xpRequired : null,
    progress,
  };
}

function getAgent(name) {
  return state.store.agents[name.toLowerCase()] || null;
}

function sanitizeAgent(agent) {
  const { commands, ...safe } = agent;
  return { ...safe, pendingCommands: (commands || []).filter(c => c.status === 'pending').length };
}

function randGold(priority) {
  const [min, max] = GOLD_BY_PRIORITY[priority] || [6, 12];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Bond Level ─────────────────────────────────────────────────────────────
function getBondLevel(bondXp) {
  const xp = bondXp || 0;
  let current = state.BOND_LEVELS[0];
  for (const bl of state.BOND_LEVELS) {
    if (xp >= bl.minXp) current = bl;
    else break;
  }
  const nextIdx = state.BOND_LEVELS.indexOf(current) + 1;
  const next = state.BOND_LEVELS[nextIdx] || null;
  return {
    level: current.level,
    title: current.title,
    xp,
    minXp: current.minXp,
    nextXp: next ? next.minXp : current.minXp,
    progress: next ? Math.min(1, (xp - current.minXp) / (next.minXp - current.minXp)) : 1,
  };
}

// ─── Player Progress ────────────────────────────────────────────────────────
function getPlayerProgress(playerId) {
  const uid = playerId.toLowerCase();
  if (!state.playerProgress[uid]) state.playerProgress[uid] = { completedQuests: {}, claimedQuests: [], npcQuests: {} };
  if (!state.playerProgress[uid].npcQuests) state.playerProgress[uid].npcQuests = {};
  return state.playerProgress[uid];
}

// ─── Streak helpers ─────────────────────────────────────────────────────────
function getStreakMilestone(streak) {
  let current = null;
  for (const m of STREAK_MILESTONES) {
    if (streak >= m.days) current = m;
  }
  return current;
}

function getNextStreakMilestone(streak) {
  for (const m of STREAK_MILESTONES) {
    if (streak < m.days) return m;
  }
  return null;
}

function getStreakXpBonus(streak) {
  const m = getStreakMilestone(streak);
  return m ? m.xpBonus / 100 : 0;
}

function updateUserStreak(userId) {
  const u = state.users[userId];
  if (!u) return;
  const today = todayStr();
  if (u.streakLastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (u.streakLastDate === yesterday) {
    u.streakDays = (u.streakDays || 0) + 1;
  } else {
    u.streakDays = 1;
  }
  u.streakLastDate = today;
  if (u.companion) {
    u.companion.bondXp = (u.companion.bondXp || 0) + 0.25;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
  }
  // Award Essenz der Beständigkeit for streak
  awardCurrency(userId, 'essenz', 3);
  // Award Runensplitter as daily quest bonus (small)
  awardCurrency(userId, 'runensplitter', 2);
}

// ─── Economy helpers ────────────────────────────────────────────────────────
function awardUserGold(userId, priority, streakDays) {
  const u = state.users[userId];
  if (!u) return;
  const base = randGold(priority);
  const multiplier = Math.min(1 + (streakDays || 0) * 0.1, 3);
  const goldEarned = Math.round(base * multiplier);
  u.gold = (u.gold || 0) + goldEarned;
  // Sync multi-currency
  if (u.currencies) u.currencies.gold = u.gold;
}

function awardCurrency(userId, currency, amount) {
  const u = state.users[userId];
  if (!u || !amount || amount <= 0) return;
  if (!u.currencies) u.currencies = { gold: u.gold || 0, stardust: 0, essenz: 0, runensplitter: 0, gildentaler: 0, mondstaub: 0 };
  u.currencies[currency] = (u.currencies[currency] || 0) + Math.floor(amount);
  if (currency === 'gold') u.gold = u.currencies.gold;
}

function spendCurrency(userId, currency, amount) {
  const u = state.users[userId];
  if (!u || !amount || amount <= 0) return false;
  if (!u.currencies) u.currencies = { gold: u.gold || 0, stardust: 0, essenz: 0, runensplitter: 0, gildentaler: 0, mondstaub: 0 };
  if ((u.currencies[currency] || 0) < amount) return false;
  u.currencies[currency] -= amount;
  if (currency === 'gold') u.gold = u.currencies.gold;
  return true;
}

function updateUserForgeTemp(userId, priority) {
  const u = state.users[userId];
  if (!u) return;
  const recovery = TEMP_BY_PRIORITY[priority] || 5;
  u.forgeTemp = Math.min(100, (u.forgeTemp ?? 100) + recovery);
}

function getXpMultiplier(userId) {
  const u = state.users[userId];
  if (!u) return 1;
  const temp = u.forgeTemp ?? 100;
  return temp === 0 ? 0.5 : 1;
}

function calcDynamicForgeTemp(userId) {
  const now24h = Date.now() - 24 * 3600 * 1000;
  const playerName = userId.toLowerCase();
  const pp = state.playerProgress[playerName];
  let count = 0;
  if (pp && pp.completedQuests) {
    for (const [qid, info] of Object.entries(pp.completedQuests)) {
      const at = info.at ? new Date(info.at).getTime() : 0;
      if (at >= now24h) count++;
    }
  }
  if (count >= 8) return 100;
  if (count >= 5) return 80;
  if (count >= 3) return 60;
  if (count >= 2) return 40;
  if (count >= 1) return 20;
  return 0;
}

function recordUserCompletion(userId, questType) {
  const today = todayStr();
  if (!state.todayCompletions[userId] || state.todayCompletions[userId].date !== today) {
    state.todayCompletions[userId] = { date: today, count: 0, types: new Set() };
  }
  state.todayCompletions[userId].count++;
  state.todayCompletions[userId].types.add(questType || 'development');
}

// ─── Gear helpers ───────────────────────────────────────────────────────────
function getUserGear(userId) {
  const u = state.users[userId];
  if (!u) return GEAR_TIERS[0];
  const gearId = u.gear || 'worn';
  return GEAR_TIERS.find(g => g.id === gearId) || GEAR_TIERS[0];
}

function getUserEquipment(userId) {
  const u = state.users[userId];
  if (!u) return {};
  return u.equipment || {};
}

function getUserStats(userId) {
  const u = state.users[userId];
  if (!u) return { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 };
  const equipped = u.equipment || {};
  let stats = { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 };
  const equippedItems = [];
  for (const itemId of Object.values(equipped)) {
    const item = state.FULL_GEAR_ITEMS.find(g => g.id === itemId);
    if (item) {
      equippedItems.push(item);
      for (const [stat, val] of Object.entries(item.stats)) {
        stats[stat] = (stats[stat] || 0) + val;
      }
    }
  }
  const setCount = {};
  for (const item of equippedItems) {
    setCount[item.setId] = (setCount[item.setId] || 0) + 1;
  }
  let setBonus = 1.0;
  for (const [setId, count] of Object.entries(setCount)) {
    if (count >= 6) setBonus = Math.max(setBonus, 1.10);
    else if (count >= 3) setBonus = Math.max(setBonus, 1.05);
  }
  if (setBonus > 1.0) {
    for (const stat of ['kraft', 'ausdauer', 'weisheit', 'glueck']) {
      stats[stat] = Math.round((stats[stat] || 0) * setBonus);
    }
    stats._setBonus = setBonus;
  }
  const equippedIds = new Set(equippedItems.map(i => i.id));
  for (const ns of state.gearTemplates.namedSets || []) {
    const ownedPieces = ns.pieces.filter(pid => equippedIds.has(pid));
    const count = ownedPieces.length;
    if (count === 0) continue;
    if (ns.partialBonus) {
      for (const [threshold, bonus] of Object.entries(ns.partialBonus)) {
        if (count >= Number(threshold)) {
          for (const [stat, val] of Object.entries(bonus)) {
            if (stat !== 'label') stats[stat] = (stats[stat] || 0) + val;
          }
        }
      }
    }
    if (count >= ns.pieces.length && ns.fullBonus) {
      const fb = ns.fullBonus;
      if (fb.allStats) {
        for (const stat of ['kraft', 'ausdauer', 'weisheit', 'glueck']) {
          stats[stat] = (stats[stat] || 0) + fb.allStats;
        }
      }
      for (const [stat, val] of Object.entries(fb)) {
        if (stat !== 'label' && stat !== 'allStats') stats[stat] = (stats[stat] || 0) + val;
      }
    }
  }
  return stats;
}

function getUserDropBonus(userId) {
  const stats = getUserStats(userId);
  return Math.min(0.12, (stats.glueck || 0) * 0.005);
}

// ─── Loot System ────────────────────────────────────────────────────────────
function getMaxRarity(playerLevel) {
  if (playerLevel >= 25) return 'legendary';
  if (playerLevel >= 17) return 'epic';
  if (playerLevel >= 9)  return 'rare';
  return 'uncommon';
}

function rollLoot(dropChance, playerLevel = 1) {
  if (Math.random() > dropChance) return null;
  const maxRarity = getMaxRarity(playerLevel);
  const maxIdx = RARITY_ORDER.indexOf(maxRarity);
  const filteredWeights = {};
  let total = 0;
  for (const [r, w] of Object.entries(RARITY_WEIGHTS)) {
    if (RARITY_ORDER.indexOf(r) <= maxIdx) {
      filteredWeights[r] = w;
      total += w;
    }
  }
  const roll = Math.random() * total;
  let cumulative = 0;
  let rarity = 'common';
  for (const [r, w] of Object.entries(filteredWeights)) {
    cumulative += w;
    if (roll < cumulative) { rarity = r; break; }
  }
  const pool = (state.lootTables[rarity] || state.lootTables.common).filter(item => (item.minLevel || 1) <= playerLevel);
  if (!pool || pool.length === 0) {
    const fallback = (state.lootTables.common || []);
    if (fallback.length === 0) return null;
    const item = fallback[Math.floor(Math.random() * fallback.length)];
    return { ...item, rarity: 'common', rarityColor: RARITY_COLORS['common'] };
  }
  const item = pool[Math.floor(Math.random() * pool.length)];
  return { ...item, rarity, rarityColor: RARITY_COLORS[rarity] };
}

function addLootToInventory(userId, lootItem) {
  const u = state.users[userId];
  if (!u || !lootItem) return;
  if (!u.inventory) u.inventory = [];
  const entry = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    itemId: lootItem.id,
    name: lootItem.name,
    emoji: lootItem.emoji,
    rarity: lootItem.rarity,
    rarityColor: lootItem.rarityColor,
    effect: lootItem.effect,
    obtainedAt: now(),
  };
  u.inventory.push(entry);
  const effectType = lootItem.effect?.type;
  if (effectType === 'gold') u.gold = (u.gold || 0) + lootItem.effect.amount;
  if (effectType === 'xp') u.xp = (u.xp || 0) + lootItem.effect.amount;
  if (effectType === 'streak_shield') {
    u.streakShields = Math.min(3, (u.streakShields || 0) + lootItem.effect.amount);
    u.inventory = u.inventory.filter(i => i.id !== entry.id);
  }
  if (effectType === 'bond' && u.companion) {
    u.companion.bondXp = (u.companion.bondXp || 0) + lootItem.effect.amount;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
  }
  if (effectType === 'forge_temp') {
    u.forgeTemp = Math.min(1, (u.forgeTemp || 0) + (lootItem.effect.amount || 0) / 100);
  }
  if (effectType === 'random_gear' || effectType === 'random_gear_epic') {
    const { level: playerLvl } = getLevelInfo(u.xp || 0);
    const minRarity = lootItem.effect.type === 'random_gear_epic' ? 'epic' : 'rare';
    const minRarityIdx = RARITY_ORDER.indexOf(minRarity);
    const eligible = state.FULL_GEAR_ITEMS.filter(g =>
      g.minLevel <= playerLvl &&
      !g.shopHidden &&
      RARITY_ORDER.indexOf(g.rarity || 'common') >= minRarityIdx
    );
    const pool = eligible.length > 0 ? eligible : state.FULL_GEAR_ITEMS.filter(g => g.minLevel <= playerLvl);
    if (pool.length > 0) {
      const gearItem = pool[Math.floor(Math.random() * pool.length)];
      if (!u.inventory.includes(gearItem.id)) u.inventory.push(gearItem.id);
      entry.resolvedGear = { id: gearItem.id, name: gearItem.name, slot: gearItem.slot, emoji: gearItem.emoji };
    }
  }
  saveUsers();
  return entry;
}

function checkLootPity(userId) {
  const u = state.users[userId];
  if (!u) return false;
  u._lootPity = (u._lootPity || 0) + 1;
  if (u._lootPity >= 5) {
    u._lootPity = 0;
    return true;
  }
  return false;
}

function resetLootPity(userId) {
  const u = state.users[userId];
  if (u) u._lootPity = 0;
}

// ─── Achievement System ─────────────────────────────────────────────────────
const fs = require('fs');

function loadAchievements() {
  const { FILES } = require('./state');
  try {
    // Primary source: achievementTemplates.json (full definitions with rewards/rarity)
    if (fs.existsSync(FILES.ACHIEVEMENT_TEMPLATES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.ACHIEVEMENT_TEMPLATES, 'utf8'));
      const achievements = raw.achievements || raw;
      if (Array.isArray(achievements) && achievements.length > 0) {
        console.log(`[achievements] Loaded ${achievements.length} from achievementTemplates.json`);
        return achievements.map(a => ({ ...a, trigger: ACHIEVEMENT_TRIGGERS[a.id] || (() => false) }));
      }
    }
    // Fallback: achievements.json (flat array, less detail)
    if (fs.existsSync(FILES.ACHIEVEMENTS)) {
      const raw = JSON.parse(fs.readFileSync(FILES.ACHIEVEMENTS, 'utf8'));
      const achievements = Array.isArray(raw) ? raw : (raw.achievements || []);
      console.log(`[achievements] Loaded ${achievements.length} from achievements.json (fallback)`);
      return achievements.map(a => ({ ...a, trigger: ACHIEVEMENT_TRIGGERS[a.id] || (() => false) }));
    }
    console.warn('[achievements] No achievement files found');
    return [];
  } catch (e) {
    console.warn('[achievements] Failed to load:', e.message);
    return [];
  }
}

function initAchievementCatalogue() {
  state.ACHIEVEMENT_CATALOGUE = loadAchievements();
}

function checkAndAwardAchievements(userId) {
  const u = state.users[userId];
  if (!u) return [];
  u.earnedAchievements = u.earnedAchievements || [];
  const earned = new Set(u.earnedAchievements.map(a => a.id));
  const newOnes = [];
  for (const ach of state.ACHIEVEMENT_CATALOGUE) {
    if (!earned.has(ach.id) && ach.trigger(u)) {
      const entry = { id: ach.id, name: ach.name, icon: ach.icon, desc: ach.desc, category: ach.category, earnedAt: now() };
      u.earnedAchievements.push(entry);
      newOnes.push(entry);
    }
  }
  return newOnes;
}

// ─── Quest Completion Handler ───────────────────────────────────────────────
function onQuestCompletedByUser(userId, quest) {
  const u = state.users[userId];
  if (!u) return [];
  u.questsCompleted = (u.questsCompleted || 0) + 1;
  const xpBase = XP_BY_PRIORITY[quest.priority] || 10;
  const xpMulti = getXpMultiplier(userId);
  const gear = getUserGear(userId);
  const gearBonus = 1 + (gear.xpBonus || 0) / 100;
  const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
  const earnedIds = new Set((u.earnedAchievements || []).map(a => a.id));
  const companionBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
  const bondBonus = 1 + 0.01 * Math.max(0, (u.companion?.bondLevel ?? 1) - 1);
  u.xp = (u.xp || 0) + Math.round(xpBase * xpMulti * gearBonus * companionBonus * bondBonus);
  if (quest.type === 'companion' && u.companion) {
    u.companion.bondXp = (u.companion.bondXp || 0) + 1;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
    u._companionQuestCount = (u._companionQuestCount || 0) + 1;
  }
  const prevLevel = getLevelInfo(u.xp - Math.round(xpBase * xpMulti * gearBonus * companionBonus * bondBonus)).level;
  updateUserStreak(userId);
  awardUserGold(userId, quest.priority, u.streakDays);
  updateUserForgeTemp(userId, quest.priority);
  recordUserCompletion(userId, quest.type);
  // Award small Runensplitter per quest
  awardCurrency(userId, 'runensplitter', quest.priority === 'high' ? 5 : quest.priority === 'medium' ? 3 : 1);
  // Award Gildentaler for coop/social quests
  if (quest.type === 'social' || (quest.coopPartners && quest.coopPartners.length > 0)) {
    awardCurrency(userId, 'gildentaler', 5);
  }
  // Award Stardust on level-up
  const newLevel = getLevelInfo(u.xp).level;
  if (newLevel > prevLevel) {
    awardCurrency(userId, 'stardust', 10 + (newLevel * 2));
  }
  const tc = state.todayCompletions[userId];
  u._todayCount = tc ? tc.count : 0;
  u._allCompletedTypes = u._allCompletedTypes || [];
  if (!(u._allCompletedTypes.includes(quest.type || 'development'))) {
    u._allCompletedTypes.push(quest.type || 'development');
  }
  u._completedTypes = new Set(u._allCompletedTypes);
  u._devCount = (u._devCount || 0) + ((quest.type === 'development' || !quest.type) ? 1 : 0);
  u._learningCount = (u._learningCount || 0) + (quest.type === 'learning' ? 1 : 0);
  u._fitnessCount = (u._fitnessCount || 0) + (quest.type === 'fitness' ? 1 : 0);
  u._socialCount = (u._socialCount || 0) + (quest.type === 'social' ? 1 : 0);
  if (quest.parentQuestId) {
    const parent = state.quests.find(q => q.id === quest.parentQuestId);
    if (parent && parent.type === 'boss') {
      const children = state.quests.filter(q => q.parentQuestId === parent.id);
      const allDone = children.every(c => c.status === 'completed' || c.id === quest.id);
      if (allDone) u._bossDefeated = true;
    }
  }
  const newAchs = checkAndAwardAchievements(userId);
  delete u._todayCount;
  delete u._completedTypes;
  delete u._bossDefeated;
  const { level: playerLevel } = getLevelInfo(u.xp || 0);
  const pityGuaranteed = checkLootPity(userId);
  const isBossQuest = quest.type === 'boss' || (quest.parentQuestId && (() => {
    const parent = state.quests.find(q => q.id === quest.parentQuestId);
    return parent && parent.type === 'boss';
  })());
  let dropChance = pityGuaranteed ? 1 : 0.25;
  let forcedMinRarity = null;
  if (isBossQuest) {
    dropChance = 1;
    if (playerLevel >= 25 && Math.random() < 0.10) forcedMinRarity = 'legendary';
    else if (playerLevel >= 15 && Math.random() < 0.50) forcedMinRarity = 'epic';
    else forcedMinRarity = 'rare';
  }
  let droppedLoot = null;
  if (forcedMinRarity) {
    const pool = (state.lootTables[forcedMinRarity] || state.lootTables.rare || []).filter(item => (item.minLevel || 1) <= playerLevel);
    if (pool.length > 0) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      droppedLoot = { ...item, rarity: forcedMinRarity, rarityColor: RARITY_COLORS[forcedMinRarity] };
    }
  } else {
    droppedLoot = rollLoot(dropChance, playerLevel);
  }
  if (droppedLoot) {
    resetLootPity(userId);
    addLootToInventory(userId, droppedLoot);
    u._lastLoot = droppedLoot;
  }
  saveUsers();
  return newAchs;
}

// ─── Agent helpers ──────────────────────────────────────────────────────────
function awardXP(agentKey, priority) {
  if (!agentKey || !state.store.agents[agentKey]) return;
  const xp = XP_BY_PRIORITY[priority] || 10;
  state.store.agents[agentKey].xp = (state.store.agents[agentKey].xp || 0) + xp;
}

function updateAgentStreak(agentKey) {
  const agent = state.store.agents[agentKey];
  if (!agent) return;
  const today = todayStr();
  if (agent.streakLastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (agent.streakLastDate === yesterday) {
    agent.streakDays = (agent.streakDays || 0) + 1;
  } else {
    agent.streakDays = 1;
  }
  agent.streakLastDate = today;
}

function awardAgentGold(agentKey, priority, streakDays) {
  const agent = state.store.agents[agentKey];
  if (!agent) return;
  const base = randGold(priority);
  const multiplier = Math.min(1 + (streakDays || 0) * 0.1, 3);
  agent.gold = (agent.gold || 0) + Math.round(base * multiplier);
}

// ─── Campaign helpers ───────────────────────────────────────────────────────
function autoCreateCampaigns() {
  const allCampaignQuestIds = new Set(state.campaigns.flatMap(c => c.questIds));
  const orphanedChildIds = state.quests
    .filter(q => q.parentQuestId && !allCampaignQuestIds.has(q.id))
    .map(q => q.id);
  if (orphanedChildIds.length === 0) return;
  const chains = {};
  for (const q of state.quests) {
    if (!q.parentQuestId) continue;
    if (allCampaignQuestIds.has(q.id)) continue;
    let rootId = q.parentQuestId;
    let parent = state.quests.find(p => p.id === q.parentQuestId);
    while (parent && parent.parentQuestId) {
      rootId = parent.parentQuestId;
      parent = state.quests.find(p => p.id === parent.parentQuestId);
    }
    if (!chains[rootId]) chains[rootId] = new Set();
    chains[rootId].add(q.id);
  }
  let created = 0;
  for (const [rootId, childSet] of Object.entries(chains)) {
    if (allCampaignQuestIds.has(rootId)) continue;
    const rootQuest = state.quests.find(q => q.id === rootId);
    if (!rootQuest) continue;
    const childIds = Array.from(childSet).sort((a, b) => {
      const qa = state.quests.find(q => q.id === a);
      const qb = state.quests.find(q => q.id === b);
      return new Date(qa?.createdAt || 0) - new Date(qb?.createdAt || 0);
    });
    const allIds = [rootId, ...childIds];
    const bossQuest = allIds.map(id => state.quests.find(q => q.id === id)).find(q => q?.type === 'boss');
    const icon = bossQuest ? 'x' : rootQuest.type === 'learning' ? 'x' : rootQuest.type === 'fitness' ? 'x' : 'xx';
    const campaign = {
      id: `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: rootQuest.chapter || rootQuest.title,
      description: rootQuest.description || '',
      icon,
      lore: rootQuest.lore || '',
      createdBy: rootQuest.createdBy || 'system',
      createdAt: now(),
      status: 'active',
      questIds: allIds,
      bossQuestId: bossQuest?.id || null,
      rewards: { xp: 0, gold: 0, title: '' },
    };
    state.campaigns.push(campaign);
    created++;
  }
  if (created > 0) {
    const { saveCampaigns } = require('./state');
    saveCampaigns();
    console.log(`[campaigns] Auto-created ${created} campaign(s) from quest chains`);
  }
}

// ─── Companion quest creation ───────────────────────────────────────────────
function createCompanionQuestsForUser(userId) {
  const u = state.users[userId];
  if (!u || !u.companion) return;
  const companion = u.companion;
  const name = companion.name;

  if (companion.isReal) {
    const species = companion.species || companion.type;
    const speciesData = state.companionsData.realTemplates[species] || state.companionsData.realTemplates.other || { careQuests: ['feed', 'care'] };
    const careQuestIds = speciesData.careQuests || ['feed'];
    for (let i = 0; i < careQuestIds.length; i++) {
      const careId = careQuestIds[i];
      const tpl = state.companionsData.careQuestTemplates[careId];
      if (!tpl) continue;
      const title = tpl.title.replace(/\{name\}/g, name);
      const desc  = tpl.desc.replace(/\{name\}/g, name);
      state.quests.push({
        id: `quest-${Date.now()}-${i}-${careId}`,
        title,
        description: desc,
        priority: 'medium',
        type: 'companion',
        categories: [],
        product: null,
        humanInputRequired: false,
        createdBy: 'system',
        status: 'open',
        createdAt: now(),
        claimedBy: userId,
        completedBy: null,
        completedAt: null,
        parentQuestId: null,
        recurrence: tpl.recurrence || 'daily',
        streak: 0,
        lore: null,
        chapter: null,
        nextQuestTemplate: null,
        coopPartners: null,
        skills: null,
        minLevel: null,
        proof: null,
        companionCareType: careId,
        companionOwnerId: userId,
      });
    }
  } else {
    const personality = (state.companionsData.virtualTemplates[companion.type] || {}).personality || 'loyal';
    const msgs = {
      fierce:    `${name} fordert dich heraus: Erledige 3 Quests heute!`,
      wise:      `${name} empfiehlt: Lerne heute etwas Neues`,
      resilient: `${name} erinnert dich: Nach jedem Rückschlag stärker aufstehen`,
      loyal:     `${name} wartet auf dich: Zeit für deine tägliche Routine`,
      clever:    `${name} schlägt vor: Finde einen kreativeren Weg`,
      strong:    `${name} sagt: Du bist stärker als du denkst. Mach Sport!`,
    };
    state.quests.push({
      id: `quest-${Date.now()}-companion`,
      title: msgs[personality] || `${name}: Bleib auf Kurs!`,
      description: `Dein Begleiter ${name} begleitet dich auf deinem Weg.`,
      priority: 'medium',
      type: 'companion',
      categories: [],
      product: null,
      humanInputRequired: false,
      createdBy: 'system',
      status: 'open',
      createdAt: now(),
      claimedBy: userId,
      completedBy: null,
      completedAt: null,
      parentQuestId: null,
      recurrence: 'daily',
      streak: 0,
      lore: null,
      chapter: null,
      nextQuestTemplate: null,
      coopPartners: null,
      skills: null,
      minLevel: null,
      proof: null,
      companionOwnerId: userId,
    });
  }
  saveQuests();
}

// ─── Exports ────────────────────────────────────────────────────────────────
module.exports = {
  now,
  todayStr,
  getTodayBerlin,
  getMsUntilNextMidnightBerlin,
  getLevelInfo,
  getAgent,
  sanitizeAgent,
  randGold,
  getBondLevel,
  getPlayerProgress,
  getStreakMilestone,
  getNextStreakMilestone,
  getStreakXpBonus,
  updateUserStreak,
  awardUserGold,
  updateUserForgeTemp,
  getXpMultiplier,
  calcDynamicForgeTemp,
  recordUserCompletion,
  getUserGear,
  getUserEquipment,
  getUserStats,
  getUserDropBonus,
  getMaxRarity,
  rollLoot,
  addLootToInventory,
  checkLootPity,
  resetLootPity,
  loadAchievements,
  initAchievementCatalogue,
  checkAndAwardAchievements,
  onQuestCompletedByUser,
  awardXP,
  updateAgentStreak,
  awardAgentGold,
  awardCurrency,
  spendCurrency,
  autoCreateCampaigns,
  createCompanionQuestsForUser,
};
