/**
 * Shared Helper Functions — utilities used across multiple route files.
 */
const {
  state, LEVELS, TIMEZONE, XP_BY_PRIORITY, GOLD_BY_PRIORITY,
  XP_BY_RARITY, GOLD_BY_RARITY, RUNENSPLITTER_BY_RARITY,
  RARITY_WEIGHTS, RARITY_COLORS, RARITY_ORDER, STREAK_MILESTONES,
  GEAR_TIERS, SET_BONUSES, EQUIPMENT_SLOTS,
  saveUsers, saveQuests, saveData, ensureUserCurrencies,
} = require('./state');

// ─── Basic helpers ──────────────────────────────────────────────────────────
function now() {
  return new Date().toISOString();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Pagination helper ─────────────────────────────────────────────────────
// Extracts limit/offset from query params with sane defaults.
// Returns { items, total, limit, offset, hasMore }.
function paginate(array, query, defaultLimit = 100) {
  const total = array.length;
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 500);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const items = array.slice(offset, offset + limit);
  return { items, total, limit, offset, hasMore: offset + limit < total };
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
  if (!LEVELS.length) return { level: 1, title: 'Adventurer', xpRequired: 0, next: null, progress: 0 };
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

function randGold(priorityOrRarity) {
  // Support both rarity-based and legacy priority-based lookups
  const range = GOLD_BY_RARITY[priorityOrRarity] || GOLD_BY_PRIORITY[priorityOrRarity] || [6, 12];
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Bond Level ─────────────────────────────────────────────────────────────
function getBondLevel(bondXp) {
  const xp = bondXp || 0;
  if (!state.BOND_LEVELS?.length) return { level: 1, name: 'Acquaintance', minXp: 0 };
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
  } else if (u.streakDays > 0) {
    // First check: streak shields (from items + streak_protection legendary)
    if ((u.streakShields || 0) > 0) {
      u.streakShields -= 1;
      u.streakDays = (u.streakDays || 0) + 1;
    } else {
      // Minor stat: vitalitaet adds +1% streak protection chance per point
      const vitBonus = (_getRawStats(userId).vitalitaet || 0) * 0.01;
      const passiveRecovery = hasPassiveEffect(userId, 'streak_recovery_50') ? 0.5 : 0;
      const totalRecoveryChance = Math.min(0.75, passiveRecovery + vitBonus); // cap at 75%
      if (Math.random() < totalRecoveryChance) {
        u.streakDays = (u.streakDays || 0) + 1;
      } else {
        u.streakDays = 1;
      }
    }
  } else {
    u.streakDays = 1;
  }
  u.streakLastDate = today;
  if (u.companion) {
    u.companion.bondXp = (u.companion.bondXp || 0) + 0.25;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
  }
  // Streak currencies moved to daily bonus claim endpoint (POST /api/daily-bonus/claim)
  // No longer awarded silently here — player must actively claim
}

// ─── Economy helpers ────────────────────────────────────────────────────────
function awardUserGold(userId, rarity, streakDays, extraMulti) {
  const u = state.users[userId];
  if (!u) return;
  const base = randGold(rarity);
  const streakMulti = Math.min(1 + (streakDays || 0) * 0.015, 1.45);
  const forgeMulti = getGoldMultiplier(userId);
  // Legendary gear gold bonus
  const legendaryGoldMod = getLegendaryModifiers(userId).goldBonus;
  let goldEarned = Math.round(base * streakMulti * forgeMulti * legendaryGoldMod * (extraMulti || 1));
  // Passive: gold_boost_next doubles gold, consumed after use
  if (consumePassiveEffect(userId, 'gold_boost_next')) {
    goldEarned *= 2;
  }
  u.gold = (u.gold || 0) + goldEarned;
  u._lastGoldEarned = goldEarned;
}

function awardCurrency(userId, currency, amount) {
  const u = state.users[userId];
  if (!u || !amount || amount <= 0) return;
  ensureUserCurrencies(u);
  u.currencies[currency] = (u.currencies[currency] || 0) + Math.floor(amount);
}

function spendCurrency(userId, currency, amount) {
  const u = state.users[userId];
  if (!u || !amount || amount <= 0) return false;
  ensureUserCurrencies(u);
  if ((u.currencies[currency] || 0) < amount) return false;
  u.currencies[currency] -= amount;
  return true;
}

function updateUserForgeTemp(userId) {
  const u = state.users[userId];
  if (!u) return;
  // Apply pending decay before adding recovery
  const nowIso = new Date().toISOString();
  if (u.forgeTempAt) {
    const hoursElapsed = (Date.now() - new Date(u.forgeTempAt).getTime()) / 3600000;
    u.forgeTemp = Math.max(0, (u.forgeTemp ?? 100) - hoursElapsed * 2);
  }
  const baseRecovery = 10; // flat +10 per quest completion
  const tempo = (_getRawStats(userId).tempo || 0);
  // Minor stat: tempo adds percentage-based forge temp recovery (1% per point)
  const tempoMulti = 1 + tempo * 0.01;
  u.forgeTemp = Math.min(100, (u.forgeTemp ?? 100) + Math.round(baseRecovery * tempoMulti));
  u.forgeTempAt = nowIso;
}

function getQuestHoardingMalus(userId) {
  const pp = getPlayerProgress(userId);
  // Use state.questsById Map for O(1) status checks (no rebuild needed)
  const claimedIds = pp.claimedQuests || [];
  const claimedInProgress = claimedIds.filter(qid => {
    const q = state.questsById.get(qid);
    return q && q.status !== 'done' && q.status !== 'completed';
  }).length;
  // Count NPC quest chains that are in_progress AND the NPC is still visible/active AND player has started the chain
  const activeNpcGiverIds = new Set((state.npcState?.activeNpcs || []).map(npc => npc.giverId));
  // Build reverse map: questId -> npcGiverId (small dataset, fast to build)
  const questIdToNpc = {};
  Object.entries(state.npcState?.npcQuestIds || {}).forEach(([giverId, questIds]) => {
    questIds.forEach(qid => { questIdToNpc[qid] = giverId; });
  });
  const npcInProgress = Object.entries(pp.npcQuests || {})
    .filter(([firstQuestId, nq]) => {
      // playerProgress.npcQuests keys are the first quest ID of the chain
      // Map it to the NPC giverId, then check if that NPC is active
      const npcGiverId = questIdToNpc[firstQuestId];
      // Only count if: (1) status is in_progress, (2) NPC is in active rotation
      // If the chain exists in playerProgress and NPC is active, player has claimed it
      return nq.status === 'in_progress' && activeNpcGiverIds.has(npcGiverId);
    }).length;
  const total = claimedInProgress + npcInProgress;
  // First 20 in-progress quests are free; -10% XP per quest over 20
  // Soft cap: -50% at 25 quests; Hard cap: -80% at 30+ quests
  const overLimit = Math.max(0, total - 20);
  let malusPct = 0;
  if (total >= 30) {
    malusPct = 80;
  } else if (overLimit > 0) {
    malusPct = Math.min(50, overLimit * 10);
  }
  return { count: total, malusPct, multiplier: +(1 - malusPct / 100).toFixed(4) };
}

function getForgeXpBase(userId) {
  const temp = calcDynamicForgeTemp(userId);
  if (temp >= 100) return 1.5;
  if (temp >= 80) return 1.25;
  if (temp >= 60) return 1.15;
  if (temp >= 40) return 1.0;
  if (temp >= 20) return 0.8;
  return 0.5;
}

function getKraftBonus(userId) {
  const stats = getUserStats(userId);
  return +Math.min(1.30, 1 + (stats.kraft || 0) * 0.005).toFixed(4);
}

function getXpMultiplier(userId) {
  return +(getForgeXpBase(userId) * getKraftBonus(userId)).toFixed(4);
}

function getForgeGoldBase(userId) {
  const temp = calcDynamicForgeTemp(userId);
  if (temp >= 100) return 1.5;
  if (temp >= 80) return 1.3;
  if (temp >= 60) return 1.15;
  return 1.0;
}

function getWeisheitBonus(userId) {
  const stats = getUserStats(userId);
  return +Math.min(1.30, 1 + (stats.weisheit || 0) * 0.005).toFixed(4);
}

function getGoldMultiplier(userId) {
  return +(getForgeGoldBase(userId) * getWeisheitBonus(userId)).toFixed(4);
}

function calcDynamicForgeTemp(userId) {
  const u = state.users[userId];
  if (!u) return 0;
  const stored = u.forgeTemp ?? 0;
  if (!u.forgeTempAt) return Math.min(100, Math.max(0, Math.round(stored)));
  // Base decay: 2%/h, reduced by 0.5% per Ausdauer point (multiplier floor 0.1 → min 0.2%/h)
  const stats = _getRawStats(userId);
  const ausdauerMultiplier = Math.max(0.1, 1 - (stats.ausdauer || 0) * 0.005);
  // Legendary gear decay reduction
  const legendaryDecayReduction = getLegendaryModifiers(userId).decayReduction;
  const decayRate = 2 * ausdauerMultiplier * Math.max(0.1, 1 - legendaryDecayReduction);
  const hoursElapsed = (Date.now() - new Date(u.forgeTempAt).getTime()) / 3600000;
  const decayed = stored - hoursElapsed * decayRate;
  return Math.min(100, Math.max(0, Math.round(decayed)));
}

// Shared helper: resolve equipped items and sum their base stats (no set bonuses).
// Returns { stats, items } so both _getRawStats and getUserStats can reuse it.
// Supports both new instance format (objects) and legacy string IDs.
function _getEquipmentBaseStats(userId) {
  const u = state.users[userId];
  if (!u) return { stats: { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 }, items: [] };
  const equipped = u.equipment || {};
  const stats = { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0 };
  const items = [];
  for (const val of Object.values(equipped)) {
    let item;
    if (typeof val === 'object' && val !== null && val.instanceId) {
      // New instance format — stats are already rolled
      item = val;
    } else if (typeof val === 'string') {
      // Legacy string ID — look up from templates
      item = state.gearById.get(val);
      if (!item) {
        const tmpl = state.itemTemplates?.get(val);
        if (tmpl && (tmpl.type === 'equipment' || tmpl.stats)) {
          item = { id: tmpl.id, name: tmpl.name, stats: tmpl.stats || {}, slot: tmpl.slot, rarity: tmpl.rarity, setId: tmpl.setId || null };
        }
      }
    }
    if (item) {
      items.push(item);
      for (const [stat, sval] of Object.entries(item.stats || {})) {
        stats[stat] = (stats[stat] || 0) + sval;
      }
    }
  }
  return { stats, items };
}

// Raw stats without set bonuses — used by calcDynamicForgeTemp to avoid circular dependency
function _getRawStats(userId) {
  return _getEquipmentBaseStats(userId).stats;
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

// ─── Affix Rolling System (Diablo-3-style) ──────────────────────────────────
// ALL primary stats
const PRIMARY_STATS = ['kraft', 'ausdauer', 'weisheit', 'glueck'];
// ALL minor stats
const MINOR_STATS = ['fokus', 'vitalitaet', 'charisma', 'tempo'];
const ALL_STATS = [...PRIMARY_STATS, ...MINOR_STATS];

// Fisher-Yates shuffle (unbiased)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Roll random stats for a gear item from its affix template.
 * @param {object} template  — gear template with `affixes` field
 * @returns {object} { stats, legendaryEffect? } with rolled values
 */
function rollAffixStats(template) {
  if (!template || !template.affixes) {
    // Legacy fallback: return old fixed stats if no affixes defined
    return { stats: template?.stats || {} };
  }
  const stats = {};
  const { primary, minor } = template.affixes;

  // Roll primary affixes
  if (primary && primary.pool && primary.pool.length > 0) {
    const [minCount, maxCount] = primary.count || [1, 1];
    const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
    // Shuffle pool and pick `count` unique stats
    const shuffled = shuffle(primary.pool);
    const picked = shuffled.slice(0, Math.min(count, shuffled.length));
    for (const affix of picked) {
      if (!affix.stat || affix.min == null || affix.max == null) continue;
      stats[affix.stat] = affix.min + Math.floor(Math.random() * (affix.max - affix.min + 1));
    }
  }

  // Roll minor affixes
  if (minor && minor.pool && minor.pool.length > 0) {
    const [minCount, maxCount] = minor.count || [0, 0];
    const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
    if (count > 0) {
      const shuffled = shuffle(minor.pool);
      const picked = shuffled.slice(0, Math.min(count, shuffled.length));
      for (const affix of picked) {
        if (!affix.stat || affix.min == null || affix.max == null) continue;
        stats[affix.stat] = affix.min + Math.floor(Math.random() * (affix.max - affix.min + 1));
      }
    }
  }

  // Roll legendary effect value if applicable
  let legendaryEffect = null;
  if (template.legendaryEffect) {
    const le = template.legendaryEffect;
    const value = (le.min != null && le.max != null)
      ? le.min + Math.floor(Math.random() * (le.max - le.min + 1))
      : le.value;
    legendaryEffect = {
      type: le.type,
      value,
      label: (le.label || '').replace('{value}', String(value)),
    };
  }

  return { stats, legendaryEffect };
}

/**
 * Create a gear instance from a template with rolled stats.
 * Returns a self-contained object ready to store in user equipment/inventory.
 */
function createGearInstance(template) {
  const { stats, legendaryEffect } = rollAffixStats(template);
  const setIds = ['adventurer', 'veteran', 'master', 'legendary'];
  return {
    instanceId: `gi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    templateId: template.id,
    name: template.name,
    slot: template.slot,
    tier: template.tier || 1,
    rarity: template.rarity || 'common',
    stats,
    legendaryEffect: legendaryEffect || null,
    setId: template.setId || setIds[(template.tier || 1) - 1] || 'adventurer',
    desc: template.desc || '',
    icon: template.icon || null,
    passiveEffect: template.passiveEffect || null,
    passiveDesc: template.passiveDesc || null,
    affixes: template.affixes || null,  // store template ranges for UI tooltip
    rolledAt: now(),
  };
}

/**
 * Create a gear instance from an NPC unique item definition.
 * NPC items have inline stats + passiveEffect — stats get rolled, passive stays fixed.
 */
function createNpcGearInstance(npcItem) {
  // NPC items may or may not have affixes defined
  if (npcItem.affixes) {
    return createGearInstance(npcItem);
  }
  // Fallback: NPC item has fixed stats (no affix template yet) — use as-is
  return {
    instanceId: `gi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    templateId: npcItem.id,
    name: npcItem.name,
    slot: npcItem.slot,
    tier: npcItem.tier || 0,
    rarity: npcItem.rarity || 'rare',
    stats: npcItem.stats || {},
    legendaryEffect: null,
    setId: npcItem.setId || null,
    desc: npcItem.desc || '',
    icon: npcItem.icon || null,
    passiveEffect: npcItem.passiveEffect || null,
    passiveDesc: npcItem.passiveDesc || null,
    affixes: null,
    rolledAt: now(),
  };
}

/**
 * Migrate a legacy equipment slot (string templateId) to an instance object.
 * Re-rolls stats from the template if possible.
 */
function migrateEquipmentSlot(templateId) {
  // Look up the template from gearById or itemTemplates
  let template = state.gearById.get(templateId);
  if (!template) {
    const tmpl = state.itemTemplates?.get(templateId);
    if (tmpl) template = tmpl;
  }
  if (template) {
    return createGearInstance(template);
  }
  // Can't find template — create minimal instance with no stats
  return {
    instanceId: `gi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    templateId,
    name: templateId,
    slot: 'unknown',
    tier: 0,
    rarity: 'common',
    stats: {},
    legendaryEffect: null,
    setId: null,
    desc: '',
    icon: null,
    passiveEffect: null,
    passiveDesc: null,
    affixes: null,
    rolledAt: now(),
  };
}

/**
 * Ensure all equipment slots for a user are migrated to instance format.
 * Call this at boot or on first access.
 */
function migrateUserEquipment(userId) {
  const u = state.users[userId];
  if (!u || !u.equipment) return;
  let migrated = false;
  for (const [slot, val] of Object.entries(u.equipment)) {
    if (typeof val === 'string') {
      // Legacy format: just a template ID string → migrate to instance
      u.equipment[slot] = migrateEquipmentSlot(val);
      migrated = true;
    }
  }
  if (migrated) saveUsers();
}

function getUserStats(userId) {
  const u = state.users[userId];
  if (!u) return { kraft: 0, ausdauer: 0, weisheit: 0, glueck: 0, fokus: 0, vitalitaet: 0, charisma: 0, tempo: 0 };
  const { stats, items: equippedItems } = _getEquipmentBaseStats(userId);
  // Ensure all stat keys exist
  for (const s of ALL_STATS) stats[s] = stats[s] || 0;
  const setCount = {};
  for (const item of equippedItems) {
    setCount[item.setId] = (setCount[item.setId] || 0) + 1;
  }
  let setBonus = 1.0;
  for (const [, count] of Object.entries(setCount)) {
    if (count >= 6) setBonus = Math.max(setBonus, 1.10);
    else if (count >= 3) setBonus = Math.max(setBonus, 1.05);
  }
  if (setBonus > 1.0) {
    // Set bonus applies to primary stats only (not minor)
    for (const stat of PRIMARY_STATS) {
      stats[stat] = Math.round((stats[stat] || 0) * setBonus);
    }
    stats._setBonus = setBonus;
  }
  // Named set bonuses — use templateId for matching (instances store templateId)
  const equippedTemplateIds = new Set(equippedItems.map(i => i.templateId || i.id));
  for (const ns of state.gearTemplates.namedSets || []) {
    const ownedPieces = ns.pieces.filter(pid => equippedTemplateIds.has(pid));
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
        for (const stat of PRIMARY_STATS) {
          stats[stat] = (stats[stat] || 0) + fb.allStats;
        }
      }
      for (const [stat, val] of Object.entries(fb)) {
        if (stat !== 'label' && stat !== 'allStats' && stat !== 'glowEffect') stats[stat] = (stats[stat] || 0) + val;
      }
    }
  }
  return stats;
}

// ─── Legendary Effects ──────────────────────────────────────────────────────
// Collects all active legendary effects from equipped gear.
// Returns array of { type, value, label, itemName, itemId }
function getLegendaryEffects(userId) {
  const u = state.users[userId];
  if (!u) return [];
  const equipped = u.equipment || {};
  const effects = [];
  for (const val of Object.values(equipped)) {
    let item;
    if (typeof val === 'object' && val !== null && val.instanceId) {
      // New instance format — legendaryEffect is already rolled
      item = val;
    } else if (typeof val === 'string') {
      item = state.gearById.get(val);
      if (!item) {
        const tmpl = state.itemTemplates?.get(val);
        if (tmpl) item = tmpl;
      }
    }
    if (item?.legendaryEffect) {
      effects.push({ ...item.legendaryEffect, itemName: item.name, itemId: item.templateId || item.id });
    }
  }
  return effects;
}

// Compute legendary effect bonuses as modifiers
function getLegendaryModifiers(userId) {
  const effects = getLegendaryEffects(userId);
  let xpBonus = 0;
  let goldBonus = 0;
  let dropBonus = 0;
  let decayReduction = 0;
  let streakProtection = 0;
  let nightDoubleGold = 0;
  let everyNthBonus = 0;
  let autoStreakShieldAt = 0;
  let materialDoubleChance = 0;
  let varietyBonusPct = 0;
  for (const e of effects) {
    if (e.type === 'xp_bonus') xpBonus += e.value;
    else if (e.type === 'gold_bonus') goldBonus += e.value;
    else if (e.type === 'drop_bonus') dropBonus += e.value / 100;
    else if (e.type === 'decay_reduction') decayReduction += e.value;
    else if (e.type === 'streak_protection') streakProtection += e.value;
    else if (e.type === 'night_double_gold') nightDoubleGold = Math.max(nightDoubleGold, e.value);
    else if (e.type === 'every_nth_bonus') everyNthBonus = Math.max(everyNthBonus, e.value);
    else if (e.type === 'auto_streak_shield') autoStreakShieldAt = Math.max(autoStreakShieldAt, e.value);
    else if (e.type === 'material_double') materialDoubleChance += e.value;
    else if (e.type === 'variety_bonus') varietyBonusPct = Math.max(varietyBonusPct, e.value);
  }
  return {
    xpBonus: 1 + xpBonus / 100, goldBonus: 1 + goldBonus / 100, dropBonus,
    decayReduction: decayReduction / 100, streakProtection, effects,
    nightDoubleGold, everyNthBonus, autoStreakShieldAt,
    materialDoubleChance: materialDoubleChance / 100, varietyBonusPct,
  };
}

// Auto-regenerate streak shields from legendary streak_protection (called on quest completion)
function refreshStreakShields(userId) {
  const u = state.users[userId];
  if (!u) return;
  const mods = getLegendaryModifiers(userId);
  if (mods.streakProtection > 0) {
    // Each streak_protection point = 1 max shield, auto-maintained
    u.streakShields = Math.max(u.streakShields || 0, mods.streakProtection);
  }
}

function getUserDropBonus(userId) {
  const stats = getUserStats(userId);
  const legendaryMods = getLegendaryModifiers(userId);
  return Math.min(0.20, (stats.glueck || 0) * 0.005 + legendaryMods.dropBonus);
}

// ─── Passive Item Helpers ────────────────────────────────────────────────────
function hasPassiveEffect(userId, effectString) {
  const u = state.users[userId];
  if (!u || !u.inventory) return false;
  const { resolveItem } = require('./state');
  for (const inv of u.inventory) {
    const templateId = inv.itemId || inv.id;
    const tmpl = resolveItem(templateId);
    if (!tmpl) continue;
    if (tmpl.type === 'passive') {
      const eff = tmpl.effect;
      if (typeof eff === 'string' && eff === effectString) return true;
      if (eff && eff.type === effectString) return true;
    }
  }
  return false;
}

function consumePassiveEffect(userId, effectString) {
  // Find and remove a single consumable passive item with this effect (for gold_boost_next etc.)
  const u = state.users[userId];
  if (!u || !u.inventory) return false;
  const { resolveItem } = require('./state');
  for (let i = 0; i < u.inventory.length; i++) {
    const inv = u.inventory[i];
    const templateId = inv.itemId || inv.id;
    const tmpl = resolveItem(templateId);
    if (!tmpl) continue;
    // gold_boost_next is consumed after use
    const eff = tmpl.effect;
    const effType = typeof eff === 'string' ? eff : eff?.type;
    if (effType === effectString) {
      u.inventory.splice(i, 1);
      return true;
    }
  }
  return false;
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
    // Apply pending decay, then add loot bonus
    if (u.forgeTempAt) {
      const hrs = (Date.now() - new Date(u.forgeTempAt).getTime()) / 3600000;
      u.forgeTemp = Math.max(0, (u.forgeTemp || 0) - hrs * 2);
    }
    u.forgeTemp = Math.min(100, (u.forgeTemp || 0) + (lootItem.effect.amount || 0));
    u.forgeTempAt = new Date().toISOString();
  }
  if (effectType === 'random_gear' || effectType === 'random_gear_epic') {
    const { level: playerLvl } = getLevelInfo(u.xp || 0);
    const minRarity = lootItem.effect.type === 'random_gear_epic' ? 'epic' : 'rare';
    const minRarityIdx = RARITY_ORDER.indexOf(minRarity);
    const eligible = state.FULL_GEAR_ITEMS.filter(g =>
      (g.reqLevel || g.minLevel || 1) <= playerLvl &&
      !g.shopHidden &&
      RARITY_ORDER.indexOf(g.rarity || 'common') >= minRarityIdx
    );
    const pool = eligible.length > 0 ? eligible : state.FULL_GEAR_ITEMS.filter(g => (g.reqLevel || g.minLevel || 1) <= playerLvl);
    if (pool.length > 0) {
      const gearTemplate = pool[Math.floor(Math.random() * pool.length)];
      const instance = createGearInstance(gearTemplate);
      // Remove existing instance of same template if present
      u.inventory = (u.inventory || []).filter(i =>
        typeof i === 'string' ? i !== gearTemplate.id : (i.templateId !== gearTemplate.id)
      );
      u.inventory.push(instance);
      entry.resolvedGear = { id: instance.instanceId, templateId: instance.templateId, name: instance.name, slot: instance.slot, emoji: gearTemplate.emoji, stats: instance.stats, rarity: instance.rarity };
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
  const { FILES, evaluateAchievementCondition } = require('./state');
  try {
    if (fs.existsSync(FILES.ACHIEVEMENT_TEMPLATES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.ACHIEVEMENT_TEMPLATES, 'utf8'));
      const achievements = raw.achievements || raw;
      if (Array.isArray(achievements) && achievements.length > 0) {
        console.log(`[achievements] Loaded ${achievements.length} from achievementTemplates.json`);
        return achievements.map(a => ({
          ...a,
          trigger: a.condition ? (u) => evaluateAchievementCondition(a.condition, u) : (() => false),
        }));
      }
    }
    console.warn('[achievements] No achievementTemplates.json found');
    return [];
  } catch (e) {
    console.warn('[achievements] Failed to load:', e.message);
    return [];
  }
}

function initAchievementCatalogue() {
  state.ACHIEVEMENT_CATALOGUE = loadAchievements();
  // Load point milestones for frame/title unlocks
  const { FILES } = require('./state');
  try {
    if (fs.existsSync(FILES.ACHIEVEMENT_TEMPLATES)) {
      const raw = JSON.parse(fs.readFileSync(FILES.ACHIEVEMENT_TEMPLATES, 'utf8'));
      state.achievementMilestones = raw.pointMilestones || [];
      console.log(`[achievements] Loaded ${state.achievementMilestones.length} point milestones`);
    }
  } catch (e) {
    state.achievementMilestones = [];
  }
  // Build O(1) lookup Map for achievement catalogue
  state.achievementCatalogueById = new Map(state.ACHIEVEMENT_CATALOGUE.map(a => [a.id, a]));
  // Backfill missing icon/desc/rarity on already-earned achievements from catalogue
  const catById = state.achievementCatalogueById;
  let patched = 0;
  for (const u of Object.values(state.users)) {
    if (!Array.isArray(u.earnedAchievements)) continue;
    for (const ea of u.earnedAchievements) {
      const tpl = catById.get(ea.id);
      if (!tpl) continue;
      if (!ea.icon && tpl.icon)       { ea.icon = tpl.icon; patched++; }
      if (!ea.desc && tpl.desc)         ea.desc = tpl.desc;
      if (!ea.rarity && tpl.rarity)     ea.rarity = tpl.rarity;
      if (!ea.category && tpl.category) ea.category = tpl.category;
      if (!ea.points && tpl.points)     ea.points = tpl.points;
    }
  }
  if (patched > 0) {
    console.log(`[achievements] Backfilled ${patched} missing icons on earned achievements`);
    const { saveUsers } = require('./state');
    saveUsers();
  }
}

// Achievement point values by rarity (used when template has no explicit points field)
const ACHIEVEMENT_POINTS_BY_RARITY = { common: 5, uncommon: 10, rare: 25, epic: 50, legendary: 100 };

function getAchievementPoints(userId) {
  const u = state.users[userId];
  if (!u) return 0;
  const earned = u.earnedAchievements || [];
  let total = 0;
  for (const a of earned) {
    const template = state.achievementCatalogueById?.get(a.id);
    total += template?.points || ACHIEVEMENT_POINTS_BY_RARITY[a.rarity || template?.rarity || 'common'] || 5;
  }
  return total;
}

function checkAchievementMilestones(userId) {
  const u = state.users[userId];
  if (!u) return [];
  const points = getAchievementPoints(userId);
  u.achievementPoints = points;
  u.unlockedFrames = u.unlockedFrames || [];
  const unlockedFrameIds = new Set(u.unlockedFrames.map(f => f.id));
  const newUnlocks = [];
  const milestones = state.achievementMilestones || [];
  for (const ms of milestones) {
    if (points >= ms.points && ms.reward.type === 'frame' && !unlockedFrameIds.has(ms.reward.id)) {
      u.unlockedFrames.push({ id: ms.reward.id, name: ms.reward.name, color: ms.reward.color, glow: ms.reward.glow || false, unlockedAt: now() });
      newUnlocks.push({ type: 'frame', ...ms.reward, atPoints: ms.points });
    }
    if (points >= ms.points && ms.reward.type === 'title') {
      u.earnedTitles = u.earnedTitles || [];
      if (!u.earnedTitles.some(t => t.id === ms.reward.id)) {
        u.earnedTitles.push({ id: ms.reward.id, name: ms.reward.name, earnedAt: now() });
        newUnlocks.push({ type: 'title', ...ms.reward, atPoints: ms.points });
      }
    }
  }
  return newUnlocks;
}

function checkAndAwardAchievements(userId) {
  const u = state.users[userId];
  if (!u) return [];
  u.earnedAchievements = u.earnedAchievements || [];
  const earned = new Set(u.earnedAchievements.map(a => a.id));
  const newOnes = [];
  for (const ach of state.ACHIEVEMENT_CATALOGUE) {
    if (!earned.has(ach.id) && ach.trigger(u)) {
      const entry = { id: ach.id, name: ach.name, icon: ach.icon, desc: ach.desc, category: ach.category, rarity: ach.rarity, points: ach.points || ACHIEVEMENT_POINTS_BY_RARITY[ach.rarity] || 5, earnedAt: now() };
      u.earnedAchievements.push(entry);
      newOnes.push(entry);
    }
  }
  // Check point milestones after awarding new achievements
  if (newOnes.length > 0) {
    checkAchievementMilestones(userId);
  }
  return newOnes;
}

// ─── Crafting Material Drops ─────────────────────────────────────────────────
function rollCraftingMaterials(questRarity, materialDoubleChance, userProfessions) {
  const dropRates = state.professionsData?.materialDropRates || {};
  const rateTable = dropRates[questRarity] || dropRates.common || {};
  const drops = [];
  for (const [matId, chance] of Object.entries(rateTable)) {
    if (Math.random() < chance) {
      const amount = (materialDoubleChance && Math.random() < materialDoubleChance) ? 2 : 1;
      drops.push({ id: matId, amount });
    }
  }
  // ─── Passive Gathering: active professions grant bonus affinity material drops ──
  if (userProfessions && state.professionsData?.professions) {
    const gatherCfg = state.professionsData.gatheringConfig || { baseBonusChance: 0.05, perLevelBonus: 0.03, maxBonusChance: 0.35 };
    for (const profDef of state.professionsData.professions) {
      if (!userProfessions.chosenProfessions?.includes(profDef.id)) continue;
      if (!profDef.gatheringAffinity?.length) continue;
      const profData = userProfessions.professions?.[profDef.id];
      if (!profData) continue;
      // Calculate profession level from XP
      let profLevel = 0;
      const thresholds = profDef.levelThresholds || [];
      for (let i = 0; i < thresholds.length; i++) {
        if ((profData.xp || 0) >= thresholds[i]) profLevel = i + 1;
      }
      if (profLevel < 1) continue;
      const bonusChance = Math.min(gatherCfg.maxBonusChance, gatherCfg.baseBonusChance + (profLevel - 1) * gatherCfg.perLevelBonus);
      for (const matId of profDef.gatheringAffinity) {
        if (Math.random() < bonusChance) {
          const existing = drops.find(d => d.id === matId);
          if (existing) existing.amount += 1;
          else drops.push({ id: matId, amount: 1, gathering: true });
        }
      }
    }
  }
  return drops;
}

// ─── Quest Completion Handler ───────────────────────────────────────────────
function onQuestCompletedByUser(userId, quest) {
  const u = state.users[userId];
  if (!u) return [];
  u.questsCompleted = (u.questsCompleted || 0) + 1;
  const userStats = getUserStats(userId);
  const xpBase = (XP_BY_RARITY[quest.rarity] || XP_BY_PRIORITY[quest.priority] || 10) + Math.min(50, userStats.fokus || 0); // minor stat: fokus adds flat XP (capped at +50)
  const xpMulti = getXpMultiplier(userId);
  const gear = getUserGear(userId);
  const gearBonus = 1 + (gear.xpBonus || 0) / 100;
  const companionIds = ['ember_sprite', 'lore_owl', 'gear_golem'];
  const earnedIds = new Set((u.earnedAchievements || []).map(a => a.id));
  const companionBonus = 1 + 0.02 * companionIds.filter(id => earnedIds.has(id)).length;
  const bondBonus = 1 + 0.01 * Math.max(0, (u.companion?.bondLevel ?? 1) - 1);
  const hoardingMalus = getQuestHoardingMalus(userId).multiplier;
  // Passive inventory effects: XP boosts
  let passiveXpBonus = 1;
  if (hasPassiveEffect(userId, 'xp_boost_10')) passiveXpBonus += 0.10;
  if (hasPassiveEffect(userId, 'xp_boost_5')) passiveXpBonus += 0.05;
  // Legendary gear effects
  const legendaryMods = getLegendaryModifiers(userId);
  // Active buffs (quest-counted: alchemist potions, companion ultimates)
  let activeXpBuf = 1;
  let activeGoldBuf = 1;
  let hasLuckBuff = false;
  u.activeBuffs = u.activeBuffs || [];
  for (const buff of u.activeBuffs) {
    // Skip time-based buffs (enchants etc.) — only handle quest-counted ones
    if (!buff.questsRemaining) continue;
    if (buff.type === 'xp_boost_10') activeXpBuf *= 1.10;
    else if (buff.type === 'xp_boost_5') activeXpBuf *= 1.05;
    else if (buff.type === 'xp_boost_15') activeXpBuf *= 1.15;
    else if (buff.type === 'gold_boost_15') activeGoldBuf *= 1.15;
    else if (buff.type === 'gold_boost_10') activeGoldBuf *= 1.10;
    else if (buff.type === 'feast_buff') { activeXpBuf *= 1.15; activeGoldBuf *= 1.10; }
    else if (buff.type === 'luck_boost_20') { hasLuckBuff = true; }
    else if (buff.type === 'double_reward') { activeXpBuf *= 2.0; activeGoldBuf *= 2.0; }
    buff.questsRemaining--;
  }
  // Remove fully consumed quest-counted buffs (questsRemaining reached 0)
  u.activeBuffs = u.activeBuffs.filter(b => b.questsRemaining == null || b.questsRemaining > 0);
  // Legendary: every-Nth quest bonus XP
  let nthBonus = 1;
  if (legendaryMods.everyNthBonus > 0 && u.questsCompleted % 5 === 0) {
    nthBonus = 1 + legendaryMods.everyNthBonus / 100;
  }
  // Legendary: variety bonus — +X% XP per different quest type completed today
  let varietyBonus = 1;
  if (legendaryMods.varietyBonusPct > 0) {
    const tc = state.todayCompletions[userId];
    const typesToday = tc?.types ? (tc.types instanceof Set ? tc.types.size : Object.keys(tc.types).length) : 1;
    varietyBonus = 1 + (typesToday * legendaryMods.varietyBonusPct) / 100;
  }
  // Legendary: night double gold (applied via gold multiplier below)
  const hour = new Date().getHours();
  const isNight = hour >= 23 || hour < 5;
  if (isNight && legendaryMods.nightDoubleGold > 0) {
    activeGoldBuf *= 1 + legendaryMods.nightDoubleGold / 100;
  }
  const xpEarned = Math.round(xpBase * xpMulti * gearBonus * companionBonus * bondBonus * hoardingMalus * passiveXpBonus * legendaryMods.xpBonus * activeXpBuf * nthBonus * varietyBonus);
  const prevLevel = getLevelInfo(u.xp || 0).level;
  u.xp = (u.xp || 0) + xpEarned;
  u._lastXpEarned = xpEarned;
  if (quest.type === 'companion' && u.companion) {
    const prevBondLevel = getBondLevel(u.companion.bondXp || 0).level;
    const charismaBonus = 1 + (userStats.charisma || 0) * 0.05; // minor stat: +5% bond XP per charisma
    u.companion.bondXp = (u.companion.bondXp || 0) + 1 * charismaBonus;
    u.companion.bondLevel = getBondLevel(u.companion.bondXp).level;
    u._lastCompanionReward = {
      companionName: u.companion.name,
      companionType: u.companion.type,
      bondXpGained: 1,
      newBondXp: u.companion.bondXp,
      newBondLevel: u.companion.bondLevel,
      bondLevelUp: u.companion.bondLevel > prevBondLevel,
      bondTitle: getBondLevel(u.companion.bondXp).title,
    };
  }
  updateUserStreak(userId);
  awardUserGold(userId, quest.rarity || quest.priority || 'common', u.streakDays, activeGoldBuf);
  updateUserForgeTemp(userId);
  recordUserCompletion(userId, quest.type);
  // Track time-based completion counters for achievements
  const completionHour = new Date().getHours();
  if (completionHour >= 22 || completionHour < 5) {
    u._nightCompletions = (u._nightCompletions || 0) + 1;
  }
  const completionDay = new Date().getDay();
  if (completionDay === 0 || completionDay === 6) {
    u._weekendCompletions = (u._weekendCompletions || 0) + 1;
  }
  // Award Runensplitter based on quest rarity
  const runensplitterEarned = RUNENSPLITTER_BY_RARITY[quest.rarity] || 1;
  awardCurrency(userId, 'runensplitter', runensplitterEarned);
  u._lastRunensplitterEarned = runensplitterEarned;
  // Refresh streak shields from legendary gear
  refreshStreakShields(userId);
  // Legendary: auto streak shield at X+ days
  if (legendaryMods.autoStreakShieldAt > 0 && (u.streakDays || 0) >= legendaryMods.autoStreakShieldAt) {
    u.streakShields = Math.max(u.streakShields || 0, 1);
  }
  // Award Gildentaler for coop/social quests
  if (quest.type === 'social' || (quest.coopPartners && quest.coopPartners.length > 0)) {
    awardCurrency(userId, 'gildentaler', 5);
    u._lastGildentalerEarned = 5;
  }
  // Award Stardust on level-up
  const newLevel = getLevelInfo(u.xp).level;
  if (newLevel > prevLevel) {
    awardCurrency(userId, 'stardust', 5 + newLevel);
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
    const parent = state.questsById.get(quest.parentQuestId);
    if (parent && parent.type === 'boss') {
      const children = state.quests.filter(q => q.parentQuestId === parent.id);
      const allDone = children.every(c => c.status === 'completed' || c.id === quest.id);
      if (allDone) u._bossDefeated = true;
    }
  }
  const newAchs = checkAndAwardAchievements(userId);
  checkAndAwardTitles(userId);
  delete u._todayCount;
  delete u._completedTypes;
  delete u._bossDefeated;
  const { level: playerLevel } = getLevelInfo(u.xp || 0);
  const pityGuaranteed = checkLootPity(userId);
  const isBossQuest = quest.type === 'boss' || (quest.parentQuestId && (() => {
    const parent = state.questsById.get(quest.parentQuestId);
    return parent && parent.type === 'boss';
  })());
  // Luck buff was already detected in the buff loop above (before decrement)
  // Glück stat bonus adds up to +20% drop chance on top of base
  const glueckBonus = getUserDropBonus(userId);
  let dropChance = pityGuaranteed ? 1 : ((hasLuckBuff ? 0.45 : 0.25) + glueckBonus);
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
  // ─── Crafting material drops (+ passive gathering from professions) ────────
  const droppedMaterials = rollCraftingMaterials(quest.rarity || 'common', legendaryMods.materialDoubleChance, u);
  if (droppedMaterials.length > 0) {
    u.craftingMaterials = u.craftingMaterials || {};
    for (const mat of droppedMaterials) {
      u.craftingMaterials[mat.id] = (u.craftingMaterials[mat.id] || 0) + mat.amount;
    }
  }
  // ─── Recipe drops from quests ──────────────────────────────────────────────
  const questRarity = quest.rarity || 'common';
  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const questRarityIdx = RARITY_ORDER.indexOf(questRarity);
  if (state.professionsData?.recipes && u.chosenProfessions?.length > 0) {
    u.learnedRecipes = u.learnedRecipes || [];
    const dropRecipes = state.professionsData.recipes.filter(r =>
      r.source === 'drop' &&
      r.dropChance > 0 &&
      u.chosenProfessions.includes(r.profession) &&
      !u.learnedRecipes.includes(r.id) &&
      questRarityIdx >= RARITY_ORDER.indexOf(r.dropMinQuestRarity || 'common')
    );
    for (const recipe of dropRecipes) {
      if (Math.random() < recipe.dropChance) {
        u.learnedRecipes.push(recipe.id);
        u._lastRecipeDrop = { id: recipe.id, name: recipe.name, profession: recipe.profession };
        break; // max 1 recipe drop per quest
      }
    }
  }
  // Track progress for weekly challenge
  if (u.weeklyChallenge && u.weeklyChallenge.weekId) {
    u.weeklyChallenge.progress = u.weeklyChallenge.progress || {};
    const p = u.weeklyChallenge.progress;
    p.totalQuests = (p.totalQuests || 0) + 1;
    const qt = quest.type || 'development';
    p[`type_${qt}`] = (p[`type_${qt}`] || 0) + 1;
    p.types = p.types || {};
    p.types[qt] = (p.types[qt] || 0) + 1;
  }
  // Track progress for expedition (cooperative)
  try {
    const { contributeQuest } = require('../routes/expedition');
    contributeQuest(userId);
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') console.warn('[helpers] expedition contribution error:', e.message);
  }
  saveUsers();
  return newAchs;
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
    let parent = state.questsById.get(q.parentQuestId);
    const visited = new Set();
    while (parent && parent.parentQuestId) {
      if (visited.has(parent.id)) break; // cycle guard
      visited.add(parent.id);
      rootId = parent.parentQuestId;
      parent = state.questsById.get(parent.parentQuestId);
    }
    if (!chains[rootId]) chains[rootId] = new Set();
    chains[rootId].add(q.id);
  }
  let created = 0;
  for (const [rootId, childSet] of Object.entries(chains)) {
    if (allCampaignQuestIds.has(rootId)) continue;
    const rootQuest = state.questsById.get(rootId);
    if (!rootQuest) continue;
    const childIds = Array.from(childSet).sort((a, b) => {
      const qa = state.questsById.get(a);
      const qb = state.questsById.get(b);
      return new Date(qa?.createdAt || 0) - new Date(qb?.createdAt || 0);
    });
    const allIds = [rootId, ...childIds];
    const bossQuest = allIds.map(id => state.questsById.get(id)).find(q => q?.type === 'boss');
    const icon = null;
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
      const quest = {
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
      };
      state.quests.push(quest);
      state.questsById.set(quest.id, quest);
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
    const quest = {
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
    };
    state.quests.push(quest);
    state.questsById.set(quest.id, quest);
  }
  saveQuests();
}

// ─── Title System ───────────────────────────────────────────────────────────
// Checks all title conditions and awards newly earned titles to the user.
// Returns array of newly earned title IDs.
function checkAndAwardTitles(userId) {
  const u = state.users[userId];
  if (!u) return [];
  const defs = state.titleDefinitions || [];
  if (defs.length === 0) return [];
  if (!u.earnedTitles) u.earnedTitles = [];
  const earnedIds = new Set(u.earnedTitles.map(t => t.id));
  const newTitles = [];
  const pp = getPlayerProgress(userId);
  const completedCount = u.questsCompleted || 0;
  const level = getLevelInfo(u.xp || 0).level;
  const streak = u.streakDays || 0;
  const invCount = (u.inventory || []).length;
  const gold = (u.gold || 0);
  const npcChains = Object.values(pp.npcQuests || {}).filter(nq => nq.status === 'completed').length;
  const forgeTemp = calcDynamicForgeTemp(userId);
  const equipped = u.equipment || {};
  const slotsFilled = Object.values(equipped).filter(Boolean).length;

  for (const def of defs) {
    if (earnedIds.has(def.id)) continue;
    const cond = def.condition;
    let earned = false;
    if (cond.type === 'level') earned = level >= cond.value;
    else if (cond.type === 'quests_completed') earned = completedCount >= cond.value;
    else if (cond.type === 'streak') earned = streak >= cond.value;
    else if (cond.type === 'inventory_count') earned = invCount >= cond.value;
    else if (cond.type === 'gold') earned = gold >= cond.value;
    else if (cond.type === 'npc_chains') earned = npcChains >= cond.value;
    else if (cond.type === 'forge_temp') earned = forgeTemp >= cond.value;
    else if (cond.type === 'full_equipment') earned = slotsFilled >= 6;
    else if (cond.type === 'gacha_legendary') {
      const gs = state.gachaState[userId];
      const legendaryPulls = (gs?.history || []).filter(h => h.rarity === 'legendary').length;
      earned = legendaryPulls >= cond.value;
    }
    if (earned) {
      u.earnedTitles.push({ id: def.id, earnedAt: now() });
      newTitles.push(def);
    }
  }
  return newTitles;
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
  getQuestHoardingMalus,
  getXpMultiplier,
  getGoldMultiplier,
  getForgeXpBase,
  getForgeGoldBase,
  getKraftBonus,
  getWeisheitBonus,
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
  getAchievementPoints,
  checkAchievementMilestones,
  onQuestCompletedByUser,
  awardCurrency,
  spendCurrency,
  autoCreateCampaigns,
  createCompanionQuestsForUser,
  hasPassiveEffect,
  consumePassiveEffect,
  getLegendaryEffects,
  getLegendaryModifiers,
  refreshStreakShields,
  checkAndAwardTitles,
  paginate,
  // Affix rolling system
  PRIMARY_STATS,
  MINOR_STATS,
  ALL_STATS,
  rollAffixStats,
  createGearInstance,
  createNpcGearInstance,
  migrateEquipmentSlot,
  migrateUserEquipment,
  rollCraftingMaterials,
};
